import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Download,
  Eye,
  Loader2,
  Pencil,
  Phone,
  Plus,
  Printer,
  Save,
  Trash2,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import Layout from '../components/Layout/Layout';
import { useClinic } from '../context/ClinicContext';
import * as api from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

import { BillItemsEditor } from '../components/billing/BillItemsEditor';
import { BillDocument } from '../components/billing/BillDocument';
import { DiscountEditor } from '../components/billing/DiscountEditor';
import { Separator } from '@/components/ui/separator';
import { StatusPill } from '../components/billing/StatusPill';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  computeTotals,
  formatBillDate,
  formatBillDateTime,
  formatInr,
} from '../components/billing/billUtils';

export default function BillDetail() {
  const { id } = useParams();
  const { selectedClinicId } = useClinic();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [treatments, setTreatments] = useState([]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'CASH',
    reference: '',
    note: '',
  });
  const [recordingPayment, setRecordingPayment] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);

  // Cache clinic + doctor lookups so the paginated preview matches what
  // the PDF renderer produces (letterhead artwork, phones, doctor
  // qualifications). We fetch on demand — the preview button is the
  // primary use case, and staff editing bills don't need this data.
  const [clinicSnapshot, setClinicSnapshot] = useState(null);
  const [doctorSnapshot, setDoctorSnapshot] = useState(null);

  useEffect(() => {
    if (!previewOpen || !bill?.clinicId) return undefined;
    let cancelled = false;
    const clinicId =
      typeof bill.clinicId === 'string' ? bill.clinicId : bill.clinicId?._id;
    if (!clinicId) return undefined;
    api
      .getClinic(clinicId)
      .then((res) => {
        if (!cancelled) setClinicSnapshot(res.data?.data || null);
      })
      .catch(() => {});
    const doctorId =
      typeof bill.doctorId === 'string' ? bill.doctorId : bill.doctorId?._id;
    if (doctorId) {
      api
        .getDoctor(doctorId)
        .then((res) => {
          if (!cancelled) setDoctorSnapshot(res.data?.data || null);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [previewOpen, bill]);

  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    setLoading(true);
    api
      .getBill(id)
      .then((res) => {
        if (!cancelled) setBill(res.data?.data || null);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err.response?.data?.error || 'Failed to load bill');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Treatments are only required when editing.
  useEffect(() => {
    if (!editing || !selectedClinicId) return undefined;
    if (treatments.length > 0) return undefined;
    let cancelled = false;
    api
      .getTreatments({ clinicId: selectedClinicId, activeOnly: true })
      .then((res) => {
        if (!cancelled) setTreatments(res.data?.data || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [editing, selectedClinicId, treatments.length]);

  const draftTotals = useMemo(() => {
    if (!draft) return { subtotal: 0, discountAmount: 0, totalAmount: 0 };
    return computeTotals(draft.items, draft.discount);
  }, [draft]);

  if (loading) {
    return (
      <Layout title="Bill">
        <div className="space-y-4">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }
  if (!bill) {
    return (
      <Layout title="Bill">
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <p className="text-sm font-medium">Bill not found</p>
          <Button onClick={() => navigate('/billing')}>
            <ArrowLeft className="size-3.5" /> Back to billing
          </Button>
        </div>
      </Layout>
    );
  }

  const title = bill.billNumber || 'Draft bill';
  const canEdit = bill.status === 'DRAFT';
  const canIssue = bill.status === 'DRAFT' && (bill.items || []).length > 0;
  const canCancel = bill.status !== 'CANCELLED';
  const canRecordPayment =
    bill.status !== 'CANCELLED' && bill.balanceAmount > 0;

  function startEdit() {
    setDraft({
      items: bill.items?.map((it) => ({ ...it })) || [],
      discount: bill.discount
        ? { ...bill.discount }
        : { type: 'NONE', value: 0, reason: '' },
      notes: bill.notes || '',
    });
    setEditing(true);
  }
  function cancelEdit() {
    setEditing(false);
    setDraft(null);
  }

  async function saveEdit() {
    if (!draft) return;
    if (draft.items.length === 0) {
      toast.error('A bill needs at least one line item');
      return;
    }
    for (const it of draft.items) {
      if (!it.name?.trim()) {
        toast.error('Every line item needs a name');
        return;
      }
    }
    setSavingEdit(true);
    try {
      const res = await api.updateBill(bill._id, {
        items: draft.items.map((it) => ({
          type: it.type || 'CUSTOM',
          treatmentId: it.treatmentId || undefined,
          name: String(it.name || '').trim(),
          description: String(it.description || '').trim(),
          quantity: Math.max(1, Number(it.quantity) || 1),
          unitPrice: Math.max(0, Number(it.unitPrice) || 0),
        })),
        discount: draft.discount,
        notes: draft.notes,
      });
      setBill(res.data?.data || bill);
      setEditing(false);
      setDraft(null);
      toast.success('Bill updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update bill');
    } finally {
      setSavingEdit(false);
    }
  }

  async function issueBill() {
    setIssuing(true);
    try {
      const res = await api.issueBill(bill._id);
      setBill(res.data?.data || bill);
      toast.success(`Issued as ${res.data?.data?.billNumber || 'invoice'}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to issue bill');
    } finally {
      setIssuing(false);
    }
  }

  async function recordPayment() {
    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }
    setRecordingPayment(true);
    try {
      const res = await api.addBillPayment(bill._id, {
        amount,
        method: paymentForm.method,
        reference: paymentForm.reference.trim(),
        note: paymentForm.note.trim(),
      });
      setBill(res.data?.data || bill);
      setPaymentOpen(false);
      setPaymentForm({ amount: '', method: 'CASH', reference: '', note: '' });
      toast.success('Payment recorded');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
    }
  }

  async function removePayment(paymentId) {
    if (!window.confirm('Remove this payment? Status will be recalculated.')) {
      return;
    }
    try {
      const res = await api.deleteBillPayment(bill._id, paymentId);
      setBill(res.data?.data || bill);
      toast.success('Payment removed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove payment');
    }
  }

  async function cancelBillFlow() {
    setCancelling(true);
    try {
      const res = await api.cancelBill(bill._id, { reason: cancelReason });
      setBill(res.data?.data || bill);
      setCancelOpen(false);
      setCancelReason('');
      toast.success('Bill cancelled');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel bill');
    } finally {
      setCancelling(false);
    }
  }

  async function deleteDraft() {
    if (!window.confirm('Delete this draft bill permanently?')) return;
    try {
      await api.deleteBill(bill._id);
      toast.success('Draft deleted');
      navigate('/billing');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete bill');
    }
  }

  function downloadPdf() {
    const token = localStorage.getItem('slotlii_client_token');
    const url = api.downloadBillPdfUrl(bill._id);
    // Direct nav so the browser handles the file download. The PDF
    // endpoint requires auth, so include the token via fetch+blob fallback
    // when navigation alone won't carry the header.
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to download');
        return res.blob();
      })
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${bill.billNumber || 'bill'}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => toast.error('Failed to download bill PDF'));
  }

  return (
    <Layout title={title}>
      {/* ── Header strip ─────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <StatusPill status={bill.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Issued on {formatBillDate(bill.billDate)}
            {bill.appointmentId ? ' · linked to an appointment' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!editing && canEdit ? (
            <Button variant="outline" size="sm" onClick={startEdit}>
              <Pencil className="size-3.5" /> Edit
            </Button>
          ) : null}
          {!editing && canIssue ? (
            <Button size="sm" onClick={issueBill} disabled={issuing}>
              {issuing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              Issue bill
            </Button>
          ) : null}
          {!editing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="size-3.5" /> Preview
            </Button>
          ) : null}
          {!editing && bill.status !== 'DRAFT' ? (
            <Button variant="outline" size="sm" onClick={downloadPdf}>
              <Download className="size-3.5" /> PDF
            </Button>
          ) : null}
          {!editing && canRecordPayment ? (
            <Button size="sm" onClick={() => setPaymentOpen(true)}>
              <Wallet className="size-3.5" /> Record payment
            </Button>
          ) : null}
          {!editing && canCancel && bill.status === 'DRAFT' ? (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={deleteDraft}
            >
              <Trash2 className="size-3.5" /> Delete draft
            </Button>
          ) : null}
          {!editing && canCancel && bill.status !== 'DRAFT' ? (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setCancelOpen(true)}
            >
              <Ban className="size-3.5" /> Cancel bill
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* ── Left column · items + payments ────────────── */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-5">
              {editing ? (
                <BillItemsEditor
                  items={draft.items}
                  onChange={(items) => setDraft({ ...draft, items })}
                  treatments={treatments}
                />
              ) : (
                <ItemsTable items={bill.items || []} />
              )}
            </CardContent>
          </Card>

          {editing ? (
            <Card>
              <CardContent className="p-5">
                <DiscountEditor
                  discount={draft.discount}
                  onChange={(discount) => setDraft({ ...draft, discount })}
                  subtotal={draftTotals.subtotal}
                />
                <div className="mt-4 space-y-1.5">
                  <Label
                    htmlFor="ed-notes"
                    className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    Notes
                  </Label>
                  <Textarea
                    id="ed-notes"
                    rows={3}
                    value={draft.notes}
                    onChange={(e) =>
                      setDraft({ ...draft, notes: e.target.value })
                    }
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={cancelEdit}
                    disabled={savingEdit}
                  >
                    <X className="size-3.5" /> Discard
                  </Button>
                  <Button onClick={saveEdit} disabled={savingEdit}>
                    {savingEdit ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Save changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!editing && bill.notes ? (
            <Card>
              <CardContent className="p-5">
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Notes
                </div>
                <p className="text-sm whitespace-pre-wrap">{bill.notes}</p>
              </CardContent>
            </Card>
          ) : null}

          {!editing && bill.status !== 'DRAFT' ? (
            <Card>
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Payments</div>
                  {canRecordPayment ? (
                    <Button size="sm" onClick={() => setPaymentOpen(true)}>
                      <Plus className="size-3.5" /> Add payment
                    </Button>
                  ) : null}
                </div>
                <PaymentsList
                  payments={bill.payments || []}
                  onRemove={removePayment}
                  status={bill.status}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* ── Right column · meta + totals ──────────────── */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Bill to
                </div>
                <div className="text-base font-semibold">
                  {bill.patientId?.name || '—'}
                </div>
                {bill.patientId?.phone ? (
                  <Link
                    to={`/patients/${bill.patientId._id}`}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:underline tabular-nums"
                  >
                    <Phone className="size-3" /> {bill.patientId.phone}
                  </Link>
                ) : null}
                {bill.patientId?._id ? (
                  <div>
                    <Link
                      to={`/patients/${bill.patientId._id}`}
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      <User className="size-3" /> Open patient profile
                    </Link>
                  </div>
                ) : null}
              </div>

              {bill.doctorId ? (
                <div className="space-y-0.5 border-t pt-3">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Doctor
                  </div>
                  <div className="text-sm">{bill.doctorId.name}</div>
                  {bill.doctorId.specialization ? (
                    <div className="text-xs text-muted-foreground">
                      {bill.doctorId.specialization}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <TotalsBlock
                bill={
                  editing
                    ? {
                        ...bill,
                        subtotal: draftTotals.subtotal,
                        discountAmount: draftTotals.discountAmount,
                        totalAmount: draftTotals.totalAmount,
                        discount: draft?.discount,
                      }
                    : bill
                }
                editing={editing}
              />
            </CardContent>
          </Card>

          {bill.status === 'CANCELLED' ? (
            <Card>
              <CardContent className="space-y-1 p-5">
                <div className="text-[11px] font-medium uppercase tracking-wider text-rose-700">
                  Cancelled
                </div>
                <p className="text-sm">
                  {bill.cancelledAt
                    ? formatBillDateTime(bill.cancelledAt)
                    : ''}
                </p>
                {bill.cancelReason ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {bill.cancelReason}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {/* ── Payment modal ──────────────────────────────── */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              Outstanding balance:{' '}
              <span className="font-semibold tabular-nums">
                {formatInr(bill.balanceAmount)}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Amount (₹) *</Label>
              <Input
                id="pay-amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={paymentForm.amount}
                onChange={(e) =>
                  setPaymentForm((f) => ({ ...f, amount: e.target.value }))
                }
                placeholder={String(bill.balanceAmount || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select
                value={paymentForm.method}
                onValueChange={(v) =>
                  setPaymentForm((f) => ({ ...f, method: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-ref">Reference (optional)</Label>
              <Input
                id="pay-ref"
                value={paymentForm.reference}
                onChange={(e) =>
                  setPaymentForm((f) => ({ ...f, reference: e.target.value }))
                }
                placeholder="UPI txn id, card auth code, cheque #…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-note">Note (optional)</Label>
              <Textarea
                id="pay-note"
                rows={2}
                value={paymentForm.note}
                onChange={(e) =>
                  setPaymentForm((f) => ({ ...f, note: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPaymentOpen(false)}
              disabled={recordingPayment}
            >
              Cancel
            </Button>
            <Button onClick={recordPayment} disabled={recordingPayment}>
              {recordingPayment ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wallet className="size-4" />
              )}
              Record payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Paginated preview overlay ──────────────────── */}
      <BillPreviewOverlay
        open={previewOpen}
        bill={bill}
        patient={bill.patientId}
        clinic={clinicSnapshot}
        doctor={doctorSnapshot || bill.doctorId}
        onClose={() => setPreviewOpen(false)}
      />

      {/* ── Cancel modal ───────────────────────────────── */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this bill?</DialogTitle>
            <DialogDescription>
              The bill will be marked cancelled and won't count toward
              outstanding balances. Existing payment records are kept for
              the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Duplicate bill, billing error"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelOpen(false)}
              disabled={cancelling}
            >
              Keep bill
            </Button>
            <Button
              variant="destructive"
              onClick={cancelBillFlow}
              disabled={cancelling}
            >
              {cancelling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Ban className="size-4" />
              )}
              Cancel bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function ItemsTable({ items }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No items on this bill.</p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Unit</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((it, idx) => (
          <TableRow key={it._id || idx}>
            <TableCell>
              <div className="font-medium">{it.name}</div>
              {it.description ? (
                <div className="text-xs text-muted-foreground">
                  {it.description}
                </div>
              ) : null}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {it.quantity}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatInr(it.unitPrice)}
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {formatInr(Number(it.quantity || 0) * Number(it.unitPrice || 0))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TotalsBlock({ bill, editing }) {
  const balance = editing
    ? Math.max(0, (bill.totalAmount || 0) - (bill.paidAmount || 0))
    : bill.balanceAmount;
  return (
    <div className="space-y-2 border-t pt-3">
      <Row label="Subtotal" value={formatInr(bill.subtotal)} />
      {bill.discountAmount > 0 ? (
        <Row
          label={
            bill.discount?.type === 'PERCENT'
              ? `Discount (${bill.discount.value}%)`
              : 'Discount'
          }
          value={`- ${formatInr(bill.discountAmount)}`}
          valueClass="text-primary"
        />
      ) : null}
      <div className="border-t" />
      <Row
        label="Total"
        value={formatInr(bill.totalAmount)}
        bold
        size="lg"
      />
      {!editing ? (
        <>
          <Row
            label="Paid"
            value={formatInr(bill.paidAmount)}
            muted
          />
          <Row
            label="Balance"
            value={formatInr(balance)}
            bold
            valueClass={
              balance > 0 ? 'text-amber-700' : 'text-emerald-700'
            }
          />
        </>
      ) : null}
    </div>
  );
}

function Row({ label, value, bold, size = 'sm', muted, valueClass = '' }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className={
          bold
            ? 'text-sm font-semibold text-foreground'
            : muted
              ? 'text-sm text-muted-foreground'
              : 'text-sm text-muted-foreground'
        }
      >
        {label}
      </span>
      <span
        className={`${size === 'lg' ? 'text-lg' : 'text-sm'} ${bold ? 'font-bold' : 'font-medium'} tabular-nums ${valueClass}`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Full-screen paginated bill preview. Uses the same portal + print-CSS
 * approach as the prescription and consent viewers so browser Print /
 * Save-as-PDF produces properly paginated output that mirrors what the
 * user sees on screen.
 */
function BillPreviewOverlay({ open, bill, patient, clinic, doctor, onClose }) {
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    body.classList.add('rx-print-mode');
    return () => {
      body.style.overflow = prevOverflow;
      body.classList.remove('rx-print-mode');
    };
  }, [open]);

  function handlePrint() {
    if (typeof window !== 'undefined') window.print();
  }

  if (!open || !bill || typeof document === 'undefined') return null;

  return createPortal(
    <div
      data-rx-portal
      className="fixed inset-0 z-50 flex flex-col bg-zinc-100 dark:bg-zinc-950"
    >
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body.rx-print-mode > *:not([data-rx-portal]) { display: none !important; }
          [data-rx-screen-only] { display: none !important; }
          [data-rx-portal] {
            position: static !important;
            inset: auto !important;
            background: #ffffff !important;
            display: block !important;
          }
          [data-rx-portal] [data-rx-scroll] {
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
          }
          [data-rx-portal] [data-doc-container] {
            background: #ffffff !important;
            padding: 0 !important;
            gap: 0 !important;
          }
          [data-rx-portal] .pd-page {
            box-shadow: none !important;
            outline: none !important;
            border-radius: 0 !important;
            page-break-after: always;
            break-after: page;
          }
          [data-rx-portal] .pd-page:last-of-type {
            page-break-after: auto;
            break-after: auto;
          }
          [data-rx-portal] [data-doc-container] > .text-muted-foreground {
            display: none !important;
          }
        }
      `}</style>

      <div
        data-rx-screen-only
        className="flex items-center justify-between gap-3 border-b bg-background px-4 py-3 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="size-4" /> Close
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm font-medium">
            Invoice preview {bill.billNumber ? `— ${bill.billNumber}` : ''}
          </span>
          <StatusPill status={bill.status} />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handlePrint}>
            <Printer className="size-4" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      <div data-rx-scroll className="flex-1 overflow-auto">
        <BillDocument
          bill={bill}
          patient={patient}
          clinic={clinic}
          doctor={doctor}
        />
      </div>
    </div>,
    document.body,
  );
}

function PaymentsList({ payments, onRemove, status }) {
  if (!payments || payments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No payments recorded yet.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Method</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((p) => (
          <TableRow key={p._id}>
            <TableCell className="text-muted-foreground tabular-nums">
              {formatBillDateTime(p.paidAt)}
            </TableCell>
            <TableCell>{PAYMENT_METHOD_LABEL[p.method] || p.method}</TableCell>
            <TableCell className="text-muted-foreground">
              <div>{p.reference || '—'}</div>
              {p.note ? (
                <div className="text-[11px] text-muted-foreground">
                  {p.note}
                </div>
              ) : null}
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {formatInr(p.amount)}
            </TableCell>
            <TableCell className="text-right">
              {status !== 'CANCELLED' ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(p._id)}
                  aria-label="Remove payment"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
