import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, FileText, Loader2, Save, User } from 'lucide-react';
import { toast } from 'sonner';

import Layout from '../components/Layout/Layout';
import { useClinic } from '../context/ClinicContext';
import * as api from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

import { PatientPicker } from '../components/billing/PatientPicker';
import { BillItemsEditor } from '../components/billing/BillItemsEditor';
import { DiscountEditor } from '../components/billing/DiscountEditor';
import {
  computeTotals,
  formatInr,
} from '../components/billing/billUtils';

function todayYyyyMmDd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export default function NewBill() {
  const { selectedClinicId } = useClinic();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefilledPatientId = searchParams.get('patientId') || '';
  const prefilledAppointmentId = searchParams.get('appointmentId') || '';

  const [doctors, setDoctors] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [patientId, setPatientId] = useState(prefilledPatientId);
  const [doctorId, setDoctorId] = useState('');
  const [billDate, setBillDate] = useState(todayYyyyMmDd());
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState({
    type: 'NONE',
    value: 0,
    reason: '',
  });
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Load catalogue + doctors ──
  useEffect(() => {
    if (!selectedClinicId) return undefined;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.getTreatments({ clinicId: selectedClinicId, activeOnly: true }),
      api.getDoctors({ clinicId: selectedClinicId }),
    ])
      .then(([trRes, docRes]) => {
        if (cancelled) return;
        setTreatments(trRes.data?.data || []);
        setDoctors(docRes.data?.data || []);
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load reference data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedClinicId]);

  // ── Prefill from appointment (treatments selected at intake) ──
  useEffect(() => {
    if (!prefilledAppointmentId || !selectedClinicId) return undefined;
    let cancelled = false;
    api
      .getAppointment(prefilledAppointmentId)
      .then((res) => {
        if (cancelled) return;
        const appt = res.data?.data;
        if (!appt) return;
        if (appt.patientId?._id) setPatientId(appt.patientId._id);
        if (appt.doctorId?._id) setDoctorId(appt.doctorId._id);
        const ids = (appt.treatmentIds || []).map((t) =>
          typeof t === 'object' ? t._id : t,
        );
        if (ids.length) {
          const byId = new Map((treatments || []).map((t) => [t._id, t]));
          const lines = ids
            .map((id) => byId.get(id))
            .filter(Boolean)
            .map((t) => ({
              type: 'TREATMENT',
              treatmentId: t._id,
              name: t.name,
              description: t.description || '',
              quantity: 1,
              unitPrice: Number(t.price) || 0,
            }));
          if (lines.length) setItems(lines);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [prefilledAppointmentId, selectedClinicId, treatments]);

  const totals = useMemo(
    () => computeTotals(items, discount),
    [items, discount],
  );
  const canSubmit = Boolean(patientId && items.length > 0);

  async function save({ issue }) {
    if (!patientId) {
      toast.error('Please select a patient');
      return;
    }
    if (items.length === 0) {
      toast.error('Add at least one line item');
      return;
    }
    for (const it of items) {
      if (!it.name?.trim()) {
        toast.error('Every line item needs a name');
        return;
      }
      if (!(Number(it.unitPrice) >= 0)) {
        toast.error('Unit price must be a non-negative number');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        clinicId: selectedClinicId,
        patientId,
        doctorId: doctorId || undefined,
        appointmentId: prefilledAppointmentId || undefined,
        billDate,
        items: items.map((it) => ({
          type: it.type || 'CUSTOM',
          treatmentId: it.treatmentId || undefined,
          name: String(it.name || '').trim(),
          description: String(it.description || '').trim(),
          quantity: Math.max(1, Number(it.quantity) || 1),
          unitPrice: Math.max(0, Number(it.unitPrice) || 0),
        })),
        discount,
        notes: notes.trim(),
        status: issue ? 'UNPAID' : 'DRAFT',
      };
      const res = await api.createBill(payload);
      const created = res.data?.data;
      toast.success(
        issue ? 'Bill issued' : 'Saved as draft',
      );
      navigate(`/billing/${created._id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save bill');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout title="New bill">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New bill</h1>
          <p className="text-sm text-muted-foreground">
            Build an invoice line by line, apply a discount and either save
            it as a draft or issue it immediately.
          </p>
        </div>
      </div>

      <Card className="max-w-5xl overflow-hidden">
        <CardContent className="space-y-6 p-5">
          {/* ── Patient + meta ───────────────────────── */}
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <User className="size-3.5" /> Patient *
              </Label>
              <PatientPicker
                clinicId={selectedClinicId}
                value={patientId}
                onChange={(p) => setPatientId(p?._id || '')}
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="bill-date"
                className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Bill date
              </Label>
              <Input
                id="bill-date"
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
              />
            </div>
          </div>

          {doctors.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Doctor (optional)
              </Label>
              <Select
                value={doctorId || undefined}
                onValueChange={(v) => setDoctorId(v)}
              >
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="No doctor assigned" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d._id} value={d._id}>
                      {d.name}
                      {d.specialization ? ` — ${d.specialization}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* ── Items ────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Items *
            </Label>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <BillItemsEditor
                items={items}
                onChange={setItems}
                treatments={treatments}
              />
            )}
          </div>

          {/* ── Discount + Notes ─────────────────────── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <DiscountEditor
              discount={discount}
              onChange={setDiscount}
              subtotal={totals.subtotal}
            />
            <div className="space-y-2">
              <Label
                htmlFor="bill-notes"
                className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Notes (optional)
              </Label>
              <Textarea
                id="bill-notes"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything you want printed on the invoice — refund policy, follow-up advice, etc."
              />
            </div>
          </div>

          {/* ── Totals footer ────────────────────────── */}
          <TotalsSummary totals={totals} discount={discount} />
        </CardContent>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/30 px-5 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/billing')}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => save({ issue: false })}
            disabled={!canSubmit || submitting}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save as draft
          </Button>
          <Button
            type="button"
            onClick={() => save({ issue: true })}
            disabled={!canSubmit || submitting}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            Save &amp; issue
          </Button>
        </div>
      </Card>
    </Layout>
  );
}

function TotalsSummary({ totals, discount }) {
  return (
    <div className="ml-auto max-w-sm rounded-md border bg-muted/30 p-4">
      <Row label="Subtotal" value={formatInr(totals.subtotal)} />
      {totals.discountAmount > 0 ? (
        <Row
          label={
            discount.type === 'PERCENT'
              ? `Discount (${discount.value}%)`
              : 'Discount'
          }
          value={`- ${formatInr(totals.discountAmount)}`}
          valueClass="text-primary"
        />
      ) : null}
      <div className="my-2 border-t" />
      <Row
        label="Total"
        value={formatInr(totals.totalAmount)}
        bold
        size="lg"
      />
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <FileText className="size-3" />
        Save as draft to edit later. Issuing assigns the next bill number.
      </p>
    </div>
  );
}

function Row({ label, value, bold, size = 'sm', valueClass = '' }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className={
          bold
            ? 'text-sm font-semibold text-foreground'
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
