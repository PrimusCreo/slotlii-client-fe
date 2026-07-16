import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  PauseCircle,
  Search,
  XCircle,
} from 'lucide-react';

import Layout from '../components/Layout/Layout';
import * as api from '../api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Platform-admin WhatsApp fleet dashboard.
 *
 * Renders a single "state of the fleet" snapshot:
 *   - counts per activation status
 *   - a searchable/filterable table of every clinic with its
 *     current status, WhatsApp number, and subaccount SID
 *
 * Data is fetched once on mount; ops can hit refresh in the browser.
 * Real-time updates aren't worth the SSE complexity here — the fleet
 * is small and status flips are minutes-apart at worst.
 */

const STATUS_META = {
  not_activated: {
    label: 'Not activated',
    icon: Clock,
    tone: 'text-muted-foreground',
    badge: 'secondary',
  },
  activating: {
    label: 'Activating',
    icon: Loader2,
    tone: 'text-amber-600',
    badge: 'outline',
    spin: true,
  },
  active: {
    label: 'Active',
    icon: CheckCircle2,
    tone: 'text-emerald-600',
    badge: 'default',
  },
  activation_failed: {
    label: 'Activation failed',
    icon: AlertTriangle,
    tone: 'text-destructive',
    badge: 'destructive',
  },
  suspended: {
    label: 'Suspended',
    icon: PauseCircle,
    tone: 'text-orange-600',
    badge: 'outline',
  },
  disconnected: {
    label: 'Disconnected',
    icon: XCircle,
    tone: 'text-muted-foreground',
    badge: 'secondary',
  },
};

function StatCard({ title, value, tone, icon: Icon, spin }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {title}
          </div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
        </div>
        {Icon ? (
          <Icon className={`size-6 ${tone || ''} ${spin ? 'animate-spin' : ''}`} />
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function AdminWhatsAppOverview() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.adminGetWhatsAppOverview();
        if (!cancelled) setData(res.data?.data || null);
      } catch (err) {
        toast.error(
          err.response?.data?.error || 'Failed to load WhatsApp overview'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const buckets = data?.buckets || {};
  const total = data?.total || 0;

  const filtered = useMemo(() => {
    const list = data?.clinics || [];
    const needle = q.trim().toLowerCase();
    return list.filter((c) => {
      if (statusFilter !== 'all' && c.activationStatus !== statusFilter) {
        return false;
      }
      if (!needle) return true;
      return (
        (c.name || '').toLowerCase().includes(needle) ||
        (c.whatsappNumber || '').toLowerCase().includes(needle) ||
        (c.subaccountSid || '').toLowerCase().includes(needle) ||
        (c.wabaId || '').toLowerCase().includes(needle)
      );
    });
  }, [data, q, statusFilter]);

  return (
    <Layout title="WhatsApp — Fleet overview">
      <div className="space-y-6">
        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            title="Total clinics"
            value={loading ? '—' : total}
            icon={MessageSquare}
            tone="text-primary"
          />
          <StatCard
            title="Active"
            value={loading ? '—' : buckets.active || 0}
            icon={CheckCircle2}
            tone="text-emerald-600"
          />
          <StatCard
            title="Activating"
            value={loading ? '—' : buckets.activating || 0}
            icon={Loader2}
            tone="text-amber-600"
            spin={(buckets.activating || 0) > 0}
          />
          <StatCard
            title="Failed / suspended"
            value={
              loading
                ? '—'
                : (buckets.activation_failed || 0) + (buckets.suspended || 0)
            }
            icon={AlertTriangle}
            tone="text-destructive"
          />
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-base">Clinics</CardTitle>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search name, number, SID…"
                    className="pl-8 md:w-72"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {['all', ...Object.keys(STATUS_META)].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setStatusFilter(k)}
                      className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                        statusFilter === k
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-transparent text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {k === 'all' ? 'All' : STATUS_META[k].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>WhatsApp number</TableHead>
                    <TableHead>Subaccount</TableHead>
                    <TableHead>WABA</TableHead>
                    <TableHead>Activated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        No clinics match the current filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c) => {
                      const meta =
                        STATUS_META[c.activationStatus] ||
                        STATUS_META.not_activated;
                      const Icon = meta.icon;
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <Link
                              to={`/admin/whatsapp/clinics/${c.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {c.name || c.id}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={meta.badge}
                              className="gap-1.5"
                            >
                              <Icon
                                className={`size-3 ${meta.spin ? 'animate-spin' : ''}`}
                              />
                              {meta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {c.whatsappNumber || '—'}
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate font-mono text-xs text-muted-foreground">
                            {c.subaccountSid || '—'}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {c.wabaId || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {c.activatedAt
                              ? new Date(c.activatedAt).toLocaleDateString()
                              : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="size-3.5" />
          Snapshot rendered from{' '}
          <span className="font-mono">/api/admin/whatsapp/overview</span>. Refresh
          the page for a fresh read.
        </div>
      </div>
    </Layout>
  );
}
