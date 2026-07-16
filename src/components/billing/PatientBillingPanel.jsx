import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Receipt, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import * as api from '../../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { StatusPill } from './StatusPill';
import { formatBillDate, formatInr } from './billUtils';

/**
 * Embedded billing widget shown on the patient detail page.
 *
 * Lists this patient's bills, surfaces their outstanding balance, and
 * offers a quick way to create a new bill (prefilled with `patientId`).
 */
export function PatientBillingPanel({ clinicId, patientId }) {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicId || !patientId) return undefined;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.getBills({ clinicId, patientId, limit: 200 }),
      api.getBillsSummary({ clinicId, patientId }),
    ])
      .then(([listRes, sumRes]) => {
        if (cancelled) return;
        setBills(listRes.data?.data || []);
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
  }, [clinicId, patientId]);

  function openNewBill() {
    navigate(`/billing/new?patientId=${patientId}`);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryStat
          label="Outstanding"
          value={formatInr(summary?.outstandingBalance || 0)}
          tone={summary?.outstandingBalance ? 'warn' : 'muted'}
          icon={Wallet}
          loading={loading && !summary}
        />
        <SummaryStat
          label="Collected"
          value={formatInr(summary?.totalCollected || 0)}
          tone="ok"
          icon={Receipt}
          loading={loading && !summary}
        />
        <SummaryStat
          label="Total bills"
          value={String(bills.length)}
          tone="muted"
          icon={Receipt}
          loading={loading}
        />
      </div>

      <Card>
        <CardContent className="space-y-3 p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
            <div className="text-sm font-semibold">Bills</div>
            <Button size="sm" onClick={openNewBill}>
              <Plus className="size-3.5" /> New bill
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : bills.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Receipt className="size-5" />
              </div>
              <p className="text-sm font-medium">No bills yet</p>
              <Button size="sm" variant="outline" onClick={openNewBill}>
                <Plus className="size-3.5" /> Create first bill
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill #</TableHead>
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
                        <span className="italic text-muted-foreground">
                          Draft
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatBillDate(bill.billDate)}
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
      </Card>
    </div>
  );
}

function SummaryStat({ label, value, tone, icon: Icon, loading }) {
  const toneClass =
    tone === 'ok'
      ? 'text-emerald-600 bg-emerald-50'
      : tone === 'warn'
        ? 'text-amber-600 bg-amber-50'
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
            <Skeleton className="mt-1 h-5 w-20" />
          ) : (
            <div className="text-lg font-bold tabular-nums">{value}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
