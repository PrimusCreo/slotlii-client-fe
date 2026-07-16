import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Loader2,
  PauseCircle,
  Play,
  Receipt,
  RefreshCcw,
  RotateCcw,
  Send,
  Shield,
  XCircle,
} from 'lucide-react';

import Layout from '../components/Layout/Layout';
import * as api from '../api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * Admin per-clinic WhatsApp drill-down.
 *
 * Bundles four separate concerns into one page because ops always
 * arrives here with the same intent — "why is this clinic's WA
 * behaving weirdly?":
 *
 *   1. Overview + sender health (top summary)
 *   2. Usage — send volume & cost over a rolling window
 *   3. Messages — chronological inbound/outbound feed for support
 *   4. Templates — approval state and one-click resubmit
 *
 * Lifecycle actions (suspend, rotate token, close subaccount) live in
 * a footer bar; each is confirmed via dialog to prevent fat-finger ops.
 */

const APPROVAL_TONE = {
  approved: 'default',
  pending: 'outline',
  submitted: 'outline',
  rejected: 'destructive',
  paused: 'secondary',
  unsubmitted: 'secondary',
};

function copyToClipboard(text, label = 'Copied') {
  if (!text) return;
  navigator.clipboard?.writeText(text).then(
    () => toast.success(label),
    () => toast.error('Clipboard blocked by browser')
  );
}

function formatCurrency(value, unit = 'USD') {
  if (value == null || Number.isNaN(Number(value))) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: unit,
      maximumFractionDigits: 4,
    }).format(value);
  } catch (_) {
    return `${value.toFixed(4)} ${unit}`;
  }
}

// ── Usage sparkline ──────────────────────────────────────
// Renders inbound + outbound day-by-day as a stacked column
// chart in plain SVG. Charts library isn't in this app; the
// dataset is small so hand-rolled SVG is fine.
function UsageChart({ byDay = [] }) {
  const size = { w: 720, h: 180, pad: 24 };
  const rows = byDay.slice(-30);
  const max = rows.reduce((m, r) => Math.max(m, r.in + r.out), 0) || 1;
  const barW = Math.max(4, (size.w - size.pad * 2) / Math.max(rows.length, 1) - 4);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${size.w} ${size.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="min-w-[560px]"
      >
        {rows.map((row, i) => {
          const x = size.pad + i * (barW + 4);
          const outH = ((row.out || 0) / max) * (size.h - size.pad * 2);
          const inH = ((row.in || 0) / max) * (size.h - size.pad * 2);
          const outY = size.h - size.pad - outH;
          const inY = outY - inH;
          return (
            <g key={row.date}>
              <rect
                x={x}
                y={outY}
                width={barW}
                height={outH}
                className="fill-primary"
              />
              <rect
                x={x}
                y={inY}
                width={barW}
                height={inH}
                className="fill-emerald-500"
              />
              {i % 5 === 0 ? (
                <text
                  x={x + barW / 2}
                  y={size.h - 6}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[9px]"
                >
                  {row.date.slice(5)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-sm bg-primary" />
          Outbound
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-sm bg-emerald-500" />
          Inbound
        </span>
      </div>
    </div>
  );
}

// ── Confirmation dialog helper ───────────────────────────
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive,
  onConfirm,
  busy,
  children,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Working…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminWhatsAppClinicDetail() {
  const { id } = useParams();

  const [overview, setOverview] = useState(null);
  const [health, setHealth] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [usage, setUsage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [rollups, setRollups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usageDays, setUsageDays] = useState(30);
  const [messageFilter, setMessageFilter] = useState('all');
  const [replayBusy, setReplayBusy] = useState(false);

  // Action dialogs
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotateToken, setRotateToken] = useState('');
  const [closeOpen, setCloseOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState('');
  const [busy, setBusy] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      // Reuse fleet endpoint and pick the one row we care about;
      // saves us adding a dedicated per-clinic overview endpoint.
      const res = await api.adminGetWhatsAppOverview();
      const row = (res.data?.data?.clinics || []).find((c) => c.id === id);
      setOverview(row || null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load clinic');
    }
  }, [id]);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await api.adminGetClinicWhatsAppTemplates(id);
      setTemplates(res.data?.data || []);
    } catch (_) {
      // handled elsewhere
    }
  }, [id]);

  const loadHealth = useCallback(async () => {
    try {
      const res = await api.adminGetClinicSenderHealth(id);
      setHealth(res.data?.data || null);
    } catch (_) {
      setHealth(null);
    }
  }, [id]);

  const loadUsage = useCallback(
    async (days = usageDays) => {
      try {
        const res = await api.adminGetClinicWhatsAppUsage(id, { days });
        setUsage(res.data?.data || null);
      } catch (_) {
        setUsage(null);
      }
    },
    [id, usageDays]
  );

  const loadRollups = useCallback(async () => {
    try {
      const res = await api.adminGetClinicRollups(id);
      setRollups(res.data?.data || []);
    } catch (_) {
      setRollups([]);
    }
  }, [id]);

  const loadMessages = useCallback(async () => {
    try {
      const params =
        messageFilter !== 'all' ? { direction: messageFilter, limit: 100 } : { limit: 100 };
      const res = await api.adminGetClinicWhatsAppMessages(id, params);
      setMessages(res.data?.data?.items || []);
    } catch (_) {
      setMessages([]);
    }
  }, [id, messageFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await Promise.all([
        loadOverview(),
        loadTemplates(),
        loadHealth(),
        loadUsage(usageDays),
        loadMessages(),
        loadRollups(),
      ]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally only re-run on id change; interior changes trigger
    // their own reloads below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    loadUsage(usageDays);
  }, [usageDays, loadUsage]);

  useEffect(() => {
    loadMessages();
  }, [messageFilter, loadMessages]);

  const status = overview?.activationStatus || 'not_activated';
  const statusVariant =
    status === 'active'
      ? 'default'
      : status === 'activating'
        ? 'outline'
        : status === 'activation_failed' || status === 'suspended'
          ? 'destructive'
          : 'secondary';

  // ── Actions ────────────────────────────────────────────
  async function handleResyncAllTemplates() {
    setBusy(true);
    try {
      await api.adminResyncClinicTemplates(id);
      toast.success('Template resync started');
      await loadTemplates();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to resync');
    } finally {
      setBusy(false);
    }
  }

  async function handleResubmitTemplate(name) {
    try {
      await api.adminResubmitClinicTemplate(id, name);
      toast.success(`Resubmitted ${name}`);
      await loadTemplates();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to resubmit');
    }
  }

  async function handleSuspend() {
    setBusy(true);
    try {
      if (status === 'suspended') {
        await api.adminUnsuspendClinicWhatsApp(id);
        toast.success('Clinic unsuspended');
      } else {
        await api.adminSuspendClinicWhatsApp(id);
        toast.success('Clinic suspended');
      }
      setSuspendOpen(false);
      await loadOverview();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleRotate() {
    if (!rotateToken.trim()) {
      toast.error('Enter the new auth token from Twilio console');
      return;
    }
    setBusy(true);
    try {
      await api.adminRotateClinicToken(id, rotateToken.trim());
      toast.success('Auth token rotated');
      setRotateOpen(false);
      setRotateToken('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Rotation failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleReplayRollup(offset = 1) {
    setReplayBusy(true);
    try {
      await api.adminReplayClinicRollup(id, { offset });
      toast.success('Rollup regenerated');
      await loadRollups();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Replay failed');
    } finally {
      setReplayBusy(false);
    }
  }

  async function handleClose() {
    if (confirmClose.trim() !== 'CLOSE') {
      toast.error('Type CLOSE to confirm');
      return;
    }
    setBusy(true);
    try {
      await api.adminCloseClinicSubaccount(id);
      toast.success('Subaccount closed');
      setCloseOpen(false);
      setConfirmClose('');
      await loadOverview();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Close failed');
    } finally {
      setBusy(false);
    }
  }

  const templateStats = useMemo(() => {
    const total = templates.length;
    const approved = templates.filter((t) => t.approvalStatus === 'approved').length;
    const rejected = templates.filter((t) => t.approvalStatus === 'rejected').length;
    return { total, approved, rejected };
  }, [templates]);

  return (
    <Layout title="WhatsApp — Clinic detail">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              to="/admin/whatsapp"
              className="mb-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Fleet overview
            </Link>
            <h2 className="text-xl font-semibold">
              {loading ? <Skeleton className="inline-block h-6 w-40" /> : overview?.name || id}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={statusVariant}>{status}</Badge>
              {overview?.whatsappNumber ? (
                <button
                  type="button"
                  onClick={() => copyToClipboard(overview.whatsappNumber, 'Number copied')}
                  className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono hover:bg-muted"
                >
                  {overview.whatsappNumber} <Copy className="size-3" />
                </button>
              ) : null}
              {overview?.subaccountSid ? (
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(overview.subaccountSid, 'Subaccount SID copied')
                  }
                  className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono hover:bg-muted"
                >
                  {overview.subaccountSid} <Copy className="size-3" />
                </button>
              ) : null}
              {overview?.wabaId ? (
                <span className="font-mono">WABA {overview.wabaId}</span>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadOverview();
                loadHealth();
                loadTemplates();
                loadUsage(usageDays);
                loadMessages();
              }}
            >
              <RefreshCcw className="mr-1.5 size-4" /> Refresh
            </Button>
          </div>
        </div>

        {/* Top summary cards */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Subaccount health
              </div>
              <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                {health?.subaccountStatus === 'active' ? (
                  <>
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    Active
                  </>
                ) : health?.subaccountStatus ? (
                  <>
                    <XCircle className="size-4 text-destructive" />
                    {health.subaccountStatus}
                  </>
                ) : (
                  <Skeleton className="h-5 w-24" />
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground truncate">
                {health?.friendlyName || '—'}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Templates approved
              </div>
              <div className="mt-1 text-lg font-semibold">
                {templateStats.approved}/{templateStats.total}
              </div>
              <div className="mt-1 text-xs text-destructive">
                {templateStats.rejected
                  ? `${templateStats.rejected} rejected`
                  : 'No rejections'}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Sent · {usage?.windowDays || usageDays}d
              </div>
              <div className="mt-1 text-lg font-semibold">
                {usage?.totals?.outbound ?? '—'}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {usage?.totals?.inbound ?? 0} inbound
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Est. cost · {usage?.windowDays || usageDays}d
              </div>
              <div className="mt-1 text-lg font-semibold">
                {formatCurrency(usage?.totals?.cost)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Rolled up from status callbacks
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="usage" className="space-y-4">
          <TabsList>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>

          {/* USAGE */}
          <TabsContent value="usage" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm">Traffic over time</CardTitle>
                <div className="flex gap-1">
                  {[7, 30, 90].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setUsageDays(d)}
                      className={`rounded-md border px-2 py-1 text-xs ${
                        usageDays === d
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-transparent text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {usage?.byDay?.length ? (
                  <UsageChart byDay={usage.byDay} />
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No traffic in the selected window.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">By category</CardTitle>
                </CardHeader>
                <CardContent>
                  {usage?.byCategory?.length ? (
                    <Table>
                      <TableBody>
                        {usage.byCategory.map((c) => (
                          <TableRow key={c.category}>
                            <TableCell className="capitalize">{c.category}</TableCell>
                            <TableCell className="text-right">{c.count}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {formatCurrency(c.cost)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      No categorised traffic yet.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Top templates</CardTitle>
                </CardHeader>
                <CardContent>
                  {usage?.byTemplate?.length ? (
                    <Table>
                      <TableBody>
                        {usage.byTemplate.map((t) => (
                          <TableRow key={t.name}>
                            <TableCell className="font-mono text-xs">
                              {t.name}
                            </TableCell>
                            <TableCell className="text-right">{t.count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      No template sends yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* MESSAGES */}
          <TabsContent value="messages" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm">Recent messages</CardTitle>
                <div className="flex gap-1">
                  {[
                    { k: 'all', l: 'All' },
                    { k: 'inbound', l: 'Inbound' },
                    { k: 'outbound', l: 'Outbound' },
                  ].map(({ k, l }) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setMessageFilter(k)}
                      className={`rounded-md border px-2 py-1 text-xs ${
                        messageFilter === k
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-transparent text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>When</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Body / Template</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {messages.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            No messages yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        messages.map((m) => (
                          <TableRow key={m._id || m.messageSid}>
                            <TableCell>
                              {m.direction === 'inbound' ? (
                                <Download className="size-3.5 text-emerald-600" />
                              ) : (
                                <Send className="size-3.5 text-primary" />
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              {new Date(m.sentAt).toLocaleString()}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {m.direction === 'inbound' ? m.from : m.to}
                            </TableCell>
                            <TableCell className="max-w-[320px] truncate text-xs">
                              {m.templateName ? (
                                <Badge variant="outline" className="mr-1 font-mono">
                                  {m.templateName}
                                </Badge>
                              ) : null}
                              <span className="text-muted-foreground">
                                {m.body || '—'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  m.status === 'delivered' || m.status === 'read'
                                    ? 'default'
                                    : m.status === 'failed' || m.status === 'undelivered'
                                      ? 'destructive'
                                      : 'secondary'
                                }
                              >
                                {m.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {m.price != null
                                ? formatCurrency(m.price, m.priceUnit || 'USD')
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TEMPLATES */}
          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm">Content templates</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResyncAllTemplates}
                  disabled={busy}
                >
                  <RotateCcw className="mr-1.5 size-4" /> Resync all
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Template</TableHead>
                        <TableHead>Content SID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Approved</TableHead>
                        <TableHead>Last checked</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            No templates provisioned.
                          </TableCell>
                        </TableRow>
                      ) : (
                        templates.map((t) => (
                          <TableRow key={t.name}>
                            <TableCell className="font-mono text-xs">
                              {t.name}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {t.sid ? (
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(t.sid, 'SID copied')}
                                  className="inline-flex items-center gap-1 hover:underline"
                                >
                                  {t.sid} <Copy className="size-3" />
                                </button>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={APPROVAL_TONE[t.approvalStatus] || 'secondary'}
                              >
                                {t.approvalStatus}
                              </Badge>
                              {t.rejectionReason ? (
                                <div className="mt-1 max-w-[220px] truncate text-[10px] text-destructive">
                                  {t.rejectionReason}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {t.approvedAt
                                ? new Date(t.approvedAt).toLocaleDateString()
                                : '—'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {t.lastCheckedAt
                                ? new Date(t.lastCheckedAt).toLocaleString()
                                : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResubmitTemplate(t.name)}
                                disabled={t.approvalStatus === 'approved'}
                              >
                                Resubmit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BILLING — monthly rollups (Phase 10) */}
          <TabsContent value="billing" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-sm">Monthly rollups</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Reconciles Slotlii's message log against Twilio's usage
                    records. Generated on the 3rd of each month.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReplayRollup(1)}
                  disabled={replayBusy || !overview?.subaccountSid}
                >
                  {replayBusy ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <Receipt className="mr-1.5 size-4" />
                  )}
                  Replay last month
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Sent</TableHead>
                        <TableHead className="text-right">Delivered</TableHead>
                        <TableHead className="text-right">Failed</TableHead>
                        <TableHead className="text-right">Twilio count</TableHead>
                        <TableHead className="text-right">Twilio charge</TableHead>
                        <TableHead>Reconciliation</TableHead>
                        <TableHead>Billing</TableHead>
                        <TableHead className="text-right">Generated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rollups.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={9}
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            No rollups yet. First run of the cron is on the
                            3rd of next month.
                          </TableCell>
                        </TableRow>
                      ) : (
                        rollups.map((r) => (
                          <TableRow key={r._id}>
                            <TableCell className="font-mono text-xs">
                              {r.period}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {r.slotliiCounts?.outbound ?? 0}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {r.slotliiCounts?.delivered ?? 0}
                            </TableCell>
                            <TableCell className="text-right text-xs text-destructive">
                              {r.slotliiCounts?.failed ?? 0}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {r.twilioTotals?.count ?? 0}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {formatCurrency(
                                r.twilioTotals?.price,
                                r.twilioTotals?.priceUnit || 'USD'
                              )}
                            </TableCell>
                            <TableCell>
                              {r.reconciliationNote ? (
                                <Badge
                                  variant="destructive"
                                  className="max-w-[220px] truncate"
                                >
                                  {r.reconciliationNote}
                                </Badge>
                              ) : (
                                <Badge variant="default" className="gap-1">
                                  <CheckCircle2 className="size-3" />
                                  Clean
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  r.billingStatus === 'invoiced'
                                    ? 'default'
                                    : r.billingStatus === 'error'
                                      ? 'destructive'
                                      : 'secondary'
                                }
                              >
                                {r.billingStatus}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {r.generatedAt
                                ? new Date(r.generatedAt).toLocaleString()
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Danger zone */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Shield className="size-4" /> Lifecycle
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant={status === 'suspended' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSuspendOpen(true)}
              disabled={!overview?.subaccountSid}
            >
              {status === 'suspended' ? (
                <>
                  <Play className="mr-1.5 size-4" /> Unsuspend
                </>
              ) : (
                <>
                  <PauseCircle className="mr-1.5 size-4" /> Suspend sends
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRotateOpen(true)}
              disabled={!overview?.subaccountSid}
            >
              <KeyRound className="mr-1.5 size-4" /> Rotate auth token
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setCloseOpen(true)}
              disabled={!overview?.subaccountSid}
            >
              <Ban className="mr-1.5 size-4" /> Close subaccount
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Confirm dialogs ── */}
      <ConfirmDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title={status === 'suspended' ? 'Unsuspend clinic?' : 'Suspend clinic?'}
        description={
          status === 'suspended'
            ? 'Sends will resume immediately.'
            : 'This blocks all outbound WhatsApp sends. Inbound messages will still be logged. Templates and the Twilio subaccount remain intact.'
        }
        confirmLabel={status === 'suspended' ? 'Unsuspend' : 'Suspend'}
        destructive={status !== 'suspended'}
        onConfirm={handleSuspend}
        busy={busy}
      />

      <ConfirmDialog
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        title="Rotate subaccount auth token"
        description="Generate a new auth token in the Twilio Console for this subaccount and paste it below. The old token is invalidated immediately."
        confirmLabel="Rotate"
        onConfirm={handleRotate}
        busy={busy}
      >
        <div className="space-y-2">
          <Label htmlFor="new-token">New auth token</Label>
          <Input
            id="new-token"
            type="password"
            autoComplete="off"
            value={rotateToken}
            onChange={(e) => setRotateToken(e.target.value)}
            placeholder="Paste from Twilio Console…"
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={closeOpen}
        onOpenChange={(v) => {
          setCloseOpen(v);
          if (!v) setConfirmClose('');
        }}
        title="Close Twilio subaccount"
        description="This is a one-way door in Twilio's UX. Message history and templates are lost. Only do this for clinics that are permanently offboarding."
        confirmLabel="Close subaccount"
        destructive
        onConfirm={handleClose}
        busy={busy}
      >
        <div className="space-y-2">
          <Label htmlFor="confirm-close">
            Type <span className="font-mono">CLOSE</span> to confirm
          </Label>
          <Input
            id="confirm-close"
            value={confirmClose}
            onChange={(e) => setConfirmClose(e.target.value)}
            placeholder="CLOSE"
          />
        </div>
      </ConfirmDialog>
    </Layout>
  );
}
