import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarRange,
  Plus,
  Receipt,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import Layout from '../components/Layout/Layout';
import Can from '../components/Can';
import { useClinic } from '../context/ClinicContext';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import { PERMISSIONS } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  formatBillDate,
  formatInr,
} from '../components/billing/billUtils';
import { StatusPill } from '../components/billing/StatusPill';

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'outstanding', label: 'Outstanding (Unpaid + Part-paid)' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'PARTIALLY_PAID', label: 'Part-paid' },
  { value: 'PAID', label: 'Paid' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function Billing() {
  const { selectedClinicId } = useClinic();
  const { isScopedDoctor } = useAuth();
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (searchInput === search) return undefined;
    const id = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput, search]);

  useEffect(() => {
    if (!selectedClinicId) return undefined;
    let cancelled = false;
    setLoading(true);

    const params = { clinicId: selectedClinicId, page, limit };
    if (search) params.q = search;
    if (statusFilter === 'outstanding') {
      params.status = 'UNPAID,PARTIALLY_PAID';
    } else if (statusFilter !== 'all') {
      params.status = statusFilter;
    }

    Promise.all([
      api.getBills(params),
      api.getBillsSummary({ clinicId: selectedClinicId }),
    ])
      .then(([listRes, sumRes]) => {
        if (cancelled) return;
        setBills(listRes.data?.data || []);
        setPages(listRes.data?.pagination?.pages || 1);
        setTotal(listRes.data?.pagination?.total || 0);
        setSummary(sumRes.data?.data || null);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err.response?.data?.error || 'Failed to load bills');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedClinicId, page, limit, search, statusFilter]);

  // Reset to page 1 whenever filters change.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const statusCounts = useMemo(() => summary?.byStatus || {}, [summary]);

  return (
    <Layout title="Billing">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Track invoices, discounts and payments across your clinic.
          </p>
        </div>
        <Can permission={PERMISSIONS.BILLS_MANAGE}>
          <Button onClick={() => navigate('/billing/new')}>
            <Plus className="size-4" /> New bill
          </Button>
        </Can>
      </div>

      {isScopedDoctor ? (
        <div className="mb-4 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
          Showing bills where you are the treating doctor.
        </div>
      ) : null}

      {/* ── Summary cards ────────────────────────────────── */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Outstanding"
          value={formatInr(summary?.outstandingBalance || 0)}
          hint={`${(statusCounts.UNPAID?.count || 0) + (statusCounts.PARTIALLY_PAID?.count || 0)} bills`}
          icon={Wallet}
          tone="warn"
          loading={loading && !summary}
        />
        <SummaryCard
          label="Collected"
          value={formatInr(summary?.totalCollected || 0)}
          hint={`${statusCounts.PAID?.count || 0} fully paid`}
          icon={Receipt}
          tone="ok"
          loading={loading && !summary}
        />
        <SummaryCard
          label="Drafts"
          value={String(statusCounts.DRAFT?.count || 0)}
          hint={formatInr(statusCounts.DRAFT?.totalAmount || 0)}
          icon={Receipt}
          tone="muted"
          loading={loading && !summary}
        />
        <SummaryCard
          label="Cancelled"
          value={String(statusCounts.CANCELLED?.count || 0)}
          hint={formatInr(statusCounts.CANCELLED?.totalAmount || 0)}
          icon={Receipt}
          tone="danger"
          loading={loading && !summary}
        />
      </div>

      {/* ── Filters ──────────────────────────────────────── */}
      <Card className="mb-3">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative w-full sm:w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by bill # or patient"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-9 pl-9 pr-9"
            />
            {searchInput ? (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="ml-auto text-xs text-muted-foreground">
            {total} {total === 1 ? 'bill' : 'bills'}
          </span>
        </CardContent>
      </Card>

      {/* ── List ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : bills.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Receipt className="size-5" />
              </div>
              <p className="text-sm font-medium">No bills found</p>
              <p className="text-xs text-muted-foreground">
                Try changing filters or create your first bill.
              </p>
              <Can permission={PERMISSIONS.BILLS_MANAGE}>
                <Button size="sm" onClick={() => navigate('/billing/new')}>
                  <Plus className="size-3.5" /> New bill
                </Button>
              </Can>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((bill) => (
                  <TableRow
                    key={bill._id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/billing/${bill._id}`)}
                  >
                    <TableCell className="font-medium tabular-nums">
                      {bill.billNumber || (
                        <span className="text-muted-foreground italic">
                          Draft
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {bill.patientId?.name || '—'}
                        </span>
                        {bill.patientId?.phone ? (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {bill.patientId.phone}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarRange className="size-3.5" />
                        {formatBillDate(bill.billDate)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusPill status={bill.status} />
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatInr(bill.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={
                          bill.balanceAmount > 0
                            ? 'font-semibold text-amber-700'
                            : 'text-muted-foreground'
                        }
                      >
                        {formatInr(bill.balanceAmount)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {!loading && bills.length > 0 && pages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Page {page} of {pages}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </Layout>
  );
}

function SummaryCard({ label, value, hint, icon: Icon, tone, loading }) {
  const toneClass =
    tone === 'ok'
      ? 'text-emerald-600 bg-emerald-50'
      : tone === 'warn'
        ? 'text-amber-600 bg-amber-50'
        : tone === 'danger'
          ? 'text-rose-600 bg-rose-50'
          : 'text-muted-foreground bg-muted';
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-md ${toneClass}`}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          {loading ? (
            <Skeleton className="mt-1 h-6 w-24" />
          ) : (
            <div className="text-xl font-bold tabular-nums">{value}</div>
          )}
          {hint ? (
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {hint}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
