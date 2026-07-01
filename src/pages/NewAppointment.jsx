import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CalendarCheck,
  Check,
  ChevronDown,
  ClipboardList,
  Clock,
  Loader2,
  Mail,
  Phone,
  Search,
  Stethoscope,
  Ticket,
  User,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import Layout from '../components/Layout/Layout';
import { useClinic } from '../context/ClinicContext';
import * as api from '../api';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

// ── Small helpers ─────────────────────────────────────────
const normPhone = (s) => (s || '').replace(/\D/g, '');
const looksLikePhone = (q) => normPhone(q).length >= 7;

function initialsOf(name) {
  if (!name) return '?';
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

function formatLongDate(yyyyMmDd) {
  if (!yyyyMmDd) return '';
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function NewAppointment() {
  const { selectedClinicId, selectedClinic } = useClinic();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState('scheduled'); // 'scheduled' | 'walkin'
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [treatments, setTreatments] = useState([]);
  const [loadingTreatments, setLoadingTreatments] = useState(true);
  const [form, setForm] = useState({
    doctorId: '',
    patientId: '',
    date: '',
    time: '',
    issue: '',
    treatmentIds: [],
  });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // After a walk-in is booked we show a celebratory token banner instead of
  // navigating away immediately — staff need to read the number aloud.
  const [walkInResult, setWalkInResult] = useState(null);

  useEffect(() => {
    if (!selectedClinicId) return;
    loadPatients();
    loadDoctors();
    loadTreatments();
  }, [selectedClinicId]);

  const presetDoctorId = searchParams.get('doctorId');
  const presetPatientId = searchParams.get('patientId');

  useEffect(() => {
    if (!presetDoctorId || !doctors.length) return;
    const exists = doctors.some((d) => d._id === presetDoctorId);
    if (exists) setForm((f) => ({ ...f, doctorId: presetDoctorId }));
  }, [presetDoctorId, doctors]);

  useEffect(() => {
    if (!presetPatientId || !patients.length) return;
    const exists = patients.some((p) => p._id === presetPatientId);
    if (exists) setForm((f) => ({ ...f, patientId: presetPatientId }));
  }, [presetPatientId, patients]);

  async function loadDoctors() {
    setLoadingDoctors(true);
    try {
      const res = await api.getDoctors({
        clinicId: selectedClinicId,
        limit: 200,
        isActive: 'true',
      });
      setDoctors(res.data.data || []);
    } catch {
      setDoctors([]);
    } finally {
      setLoadingDoctors(false);
    }
  }

  async function loadPatients() {
    setLoadingPatients(true);
    try {
      const res = await api.getPatients({
        clinicId: selectedClinicId,
        grouped: true,
        limit: 500,
      });
      const payload = res.data.data;
      const groups = payload?.groups ?? [];
      const flat = groups.flatMap((g) => g.patients || []);
      setPatients(flat);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPatients(false);
    }
  }

  async function loadTreatments() {
    setLoadingTreatments(true);
    try {
      const res = await api.getTreatments({
        clinicId: selectedClinicId,
        activeOnly: 'true',
      });
      setTreatments(res.data?.data || []);
    } catch {
      setTreatments([]);
    } finally {
      setLoadingTreatments(false);
    }
  }

  useEffect(() => {
    if (!form.date || !selectedClinic || !selectedClinicId) return;
    if (doctors.length > 0 && !form.doctorId) {
      setAvailableSlots([]);
      setLoadingSlots(false);
      return;
    }
    generateSlots();
  }, [form.date, form.doctorId, selectedClinic, selectedClinicId, doctors.length]);

  function generateSlots() {
    if (!selectedClinic?.workingHours) return;
    setLoadingSlots(true);

    const params = { clinicId: selectedClinicId, date: form.date };
    if (doctors.length > 0 && form.doctorId) params.doctorId = form.doctorId;

    api
      .getAvailableSlots(params)
      .then((res) => {
        setAvailableSlots(res.data.data || []);
      })
      .catch(() => setAvailableSlots([]))
      .finally(() => setLoadingSlots(false));
  }

  async function handleCreatePatient({ name, phone, email }) {
    const res = await api.createPatient({
      name,
      phone,
      email,
      clinicId: selectedClinicId,
      relationship: 'SELF',
    });
    const created = res.data.data;
    setPatients((prev) => [created, ...prev]);
    toast.success('Patient created');
    return created;
  }

  function handlePatientChange(patient) {
    setForm((f) => ({ ...f, patientId: patient?._id || '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.patientId) {
      toast.error('Please select a patient');
      return;
    }

    const isWalkIn = mode === 'walkin';
    if (isWalkIn) {
      // Date/time are server-assigned for walk-ins; only the patient is required.
    } else {
      if (!form.date || !form.time) {
        toast.error('Please fill all required fields');
        return;
      }
      if (doctors.length > 0 && !form.doctorId) {
        toast.error('Please select a doctor');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        clinicId: selectedClinicId,
        patientId: form.patientId,
        doctorId: form.doctorId || undefined,
        issue: form.issue,
      };
      if (isWalkIn) {
        payload.appointmentType = 'WALK_IN';
        payload.treatmentIds = form.treatmentIds;
      } else {
        payload.date = form.date;
        payload.time = form.time;
      }
      const res = await api.createAppointment(payload);
      const appt = res.data?.data;
      const draftBill = res.data?.bill || null;
      if (isWalkIn) {
        setWalkInResult({ appointment: appt, bill: draftBill });
        toast.success(
          draftBill
            ? 'Walk-in registered · draft bill ready'
            : 'Walk-in registered',
        );
      } else {
        toast.success('Appointment booked!');
        setTimeout(() => navigate('/appointments'), 600);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForNextWalkIn() {
    setWalkInResult(null);
    setForm({
      doctorId: '',
      patientId: '',
      date: '',
      time: '',
      issue: '',
      treatmentIds: [],
    });
  }

  function toggleTreatment(treatmentId) {
    setForm((f) => {
      const has = f.treatmentIds.includes(treatmentId);
      return {
        ...f,
        treatmentIds: has
          ? f.treatmentIds.filter((id) => id !== treatmentId)
          : [...f.treatmentIds, treatmentId],
      };
    });
  }

  const minDate = new Date().toISOString().split('T')[0];
  const dateDisabled = doctors.length > 0 && !form.doctorId;
  const scheduledSubmitDisabled =
    submitting ||
    !form.patientId ||
    !form.date ||
    !form.time ||
    (doctors.length > 0 && !form.doctorId);
  const walkInSubmitDisabled = submitting || !form.patientId;

  const selectedDoctor = doctors.find((d) => d._id === form.doctorId) || null;
  const selectedPatient = patients.find((p) => p._id === form.patientId) || null;
  const showSummary = Boolean(
    selectedDoctor || selectedPatient || form.date || form.time,
  );

  return (
    <Layout title="New appointment">
      {/* ── Page header ────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Book appointment</h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'walkin'
              ? 'Register a walk-in patient — date and time are set to now, and a token is issued automatically.'
              : 'Find or add a patient, pick a doctor, then choose an open slot.'}
          </p>
        </div>
      </div>

      <Tabs
        value={mode}
        onValueChange={(v) => {
          setMode(v);
          setWalkInResult(null);
        }}
        className="max-w-3xl"
      >
        <TabsList className="mb-4">
          <TabsTrigger value="scheduled" className="gap-1.5">
            <CalendarCheck className="size-3.5" /> Scheduled
          </TabsTrigger>
          <TabsTrigger value="walkin" className="gap-1.5">
            <Zap className="size-3.5" /> Walk-in
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scheduled" className="mt-0">
          <Card className="overflow-hidden">
            <form onSubmit={handleSubmit}>
              <div className="divide-y">
                <Section
                  icon={User}
                  title="Patient"
                  description="Search by name or phone — new phone numbers can be added on the spot."
                >
                  <PatientCombobox
                    patients={patients}
                    loading={loadingPatients}
                    value={form.patientId}
                    onChange={handlePatientChange}
                    onCreate={handleCreatePatient}
                  />
                </Section>

                {loadingDoctors ? (
                  <Section icon={Stethoscope} title="Doctor">
                    <Skeleton className="h-9 w-full" />
                  </Section>
                ) : doctors.length > 0 ? (
                  <Section
                    icon={Stethoscope}
                    title="Doctor"
                    description="Slots follow this doctor's schedule."
                  >
                    <Select
                      value={form.doctorId}
                      onValueChange={(v) =>
                        setForm({ ...form, doctorId: v, time: '' })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a doctor…" />
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
                  </Section>
                ) : null}

                <Section
                  icon={CalendarCheck}
                  title="When"
                  description={
                    dateDisabled
                      ? "Choose a doctor first — available times follow their schedule."
                      : form.date && (doctors.length === 0 || form.doctorId)
                        ? `${formatLongDate(form.date)}${selectedDoctor ? ` · ${selectedDoctor.name}` : ''}`
                        : 'Pick a date to see open time slots.'
                  }
                >
                  <div className="space-y-4">
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) =>
                        setForm({ ...form, date: e.target.value, time: '' })
                      }
                      min={minDate}
                      required
                      disabled={dateDisabled}
                      className="max-w-xs"
                    />

                    {form.date && (doctors.length === 0 || form.doctorId) ? (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Clock className="size-3.5" /> Available time slots
                        </Label>
                        {loadingSlots ? (
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                            {Array.from({ length: 12 }).map((_, i) => (
                              <Skeleton key={i} className="h-9 w-full" />
                            ))}
                          </div>
                        ) : availableSlots.length === 0 ? (
                          <div className="flex flex-col items-center gap-2 rounded-md border bg-muted/30 px-4 py-8 text-center">
                            <AlertCircle className="size-5 text-muted-foreground" />
                            <p className="text-sm font-medium">
                              {doctors.length > 0 && form.doctorId
                                ? 'No open slots for this doctor on this date.'
                                : 'No available slots for this date.'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Try another date or doctor.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                            {availableSlots.map((slot) => {
                              const selected = form.time === slot;
                              return (
                                <button
                                  type="button"
                                  key={slot}
                                  onClick={() =>
                                    setForm({ ...form, time: slot })
                                  }
                                  className={cn(
                                    'h-9 rounded-md border text-sm font-medium tabular-nums transition-colors',
                                    selected
                                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                      : 'border-border bg-background hover:border-primary/40 hover:bg-primary/5',
                                  )}
                                >
                                  {slot}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </Section>

                <Section
                  title="Reason for visit"
                  description="Optional note for the doctor."
                >
                  <Textarea
                    rows={3}
                    value={form.issue}
                    onChange={(e) =>
                      setForm({ ...form, issue: e.target.value })
                    }
                    placeholder="e.g. Toothache, cleaning, check-up…"
                  />
                </Section>
              </div>

              {/* ── Footer · summary + actions ─────────────── */}
              <div className="border-t bg-muted/30">
                {showSummary ? (
                  <div className="border-b px-5 py-3 sm:px-6">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
                      <SummaryItem
                        icon={User}
                        label="Patient"
                        value={selectedPatient?.name}
                      />
                      {doctors.length > 0 ? (
                        <SummaryItem
                          icon={Stethoscope}
                          label="Doctor"
                          value={selectedDoctor?.name}
                        />
                      ) : null}
                      <SummaryItem
                        icon={CalendarCheck}
                        label="Date"
                        value={form.date ? formatLongDate(form.date) : null}
                      />
                      <SummaryItem
                        icon={Clock}
                        label="Time"
                        value={form.time}
                        tabular
                      />
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-4 sm:px-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/appointments')}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={scheduledSubmitDisabled}>
                    {submitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CalendarCheck className="size-4" />
                    )}
                    {submitting ? 'Booking…' : 'Book appointment'}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="walkin" className="mt-0">
          {walkInResult ? (
            <WalkInSuccess
              appointment={walkInResult.appointment}
              bill={walkInResult.bill}
              onAddAnother={resetForNextWalkIn}
              onViewQueue={() => navigate('/appointments')}
              onViewBill={(billId) => navigate(`/billing/${billId}`)}
            />
          ) : (
            <Card className="overflow-hidden">
              <form onSubmit={handleSubmit}>
                <div className="divide-y">
                  <Section
                    icon={Users}
                    title="Patient"
                    description="Search by name or phone — new phone numbers can be added on the spot."
                  >
                    <PatientCombobox
                      patients={patients}
                      loading={loadingPatients}
                      value={form.patientId}
                      onChange={handlePatientChange}
                      onCreate={handleCreatePatient}
                    />
                  </Section>

                  <Section
                    icon={Stethoscope}
                    title="Doctor"
                    description="Optional — staff can assign a doctor later."
                  >
                    {loadingDoctors ? (
                      <Skeleton className="h-9 w-full" />
                    ) : doctors.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No doctors set up for this clinic yet.
                      </p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={form.doctorId || undefined}
                          onValueChange={(v) =>
                            setForm({ ...form, doctorId: v })
                          }
                        >
                          <SelectTrigger className="max-w-sm">
                            <SelectValue placeholder="Assign a doctor (optional)…" />
                          </SelectTrigger>
                          <SelectContent>
                            {doctors.map((d) => (
                              <SelectItem key={d._id} value={d._id}>
                                {d.name}
                                {d.specialization
                                  ? ` — ${d.specialization}`
                                  : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {form.doctorId ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setForm({ ...form, doctorId: '' })}
                          >
                            <X className="size-3.5" /> Clear
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </Section>

                  <Section
                    icon={ClipboardList}
                    title="Treatments"
                    description="Pick the procedures or services for this visit. Used later for billing."
                  >
                    <TreatmentMultiSelect
                      treatments={treatments}
                      loading={loadingTreatments}
                      selectedIds={form.treatmentIds}
                      onToggle={toggleTreatment}
                      onClear={() =>
                        setForm((f) => ({ ...f, treatmentIds: [] }))
                      }
                    />
                  </Section>

                  <Section
                    title="Reason for visit"
                    description="Optional note for the doctor."
                  >
                    <Textarea
                      rows={3}
                      value={form.issue}
                      onChange={(e) =>
                        setForm({ ...form, issue: e.target.value })
                      }
                      placeholder="e.g. Toothache, cleaning, check-up…"
                    />
                  </Section>
                </div>

                {/* ── Footer · actions ─────────────────────── */}
                <div className="border-t bg-muted/30">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 sm:px-6">
                    <p className="text-xs text-muted-foreground">
                      Date &amp; time will be set to now. A token number is issued
                      automatically.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate('/appointments')}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={walkInSubmitDisabled}>
                        {submitting ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Ticket className="size-4" />
                        )}
                        {submitting ? 'Registering…' : 'Register walk-in'}
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </Layout>
  );
}

/**
 * Token-number banner shown after a walk-in is registered. Lets staff read
 * the number aloud to the patient and then either register another walk-in
 * or jump to the day's appointment queue.
 */
function WalkInSuccess({
  appointment,
  bill,
  onAddAnother,
  onViewQueue,
  onViewBill,
}) {
  const patientName =
    appointment?.patientId?.name ||
    (typeof appointment?.patientId === 'string' ? '' : '') ||
    'Patient';
  const doctorName = appointment?.doctorId?.name || null;
  const token = appointment?.tokenNumber;
  const time = appointment?.time || '';

  return (
    <Card className="overflow-hidden border-primary/30 bg-primary/[0.03]">
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Ticket className="size-7" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Walk-in registered for{' '}
          <span className="text-foreground">{patientName}</span>
        </p>
        <div className="my-1 flex items-baseline gap-2">
          <span className="text-sm font-medium text-muted-foreground">Token</span>
          <span className="text-5xl font-extrabold tracking-tight text-primary tabular-nums">
            #{token ?? '—'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Arrival logged at <span className="tabular-nums">{time}</span>
          {doctorName ? <> · with {doctorName}</> : null}
        </p>
        {bill ? (
          <p className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
            Draft bill {bill.totalAmount
              ? `· ₹${Number(bill.totalAmount).toLocaleString('en-IN')}`
              : ''}{' '}
            ready to collect
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Button type="button" variant="outline" onClick={onAddAnother}>
            <UserPlus className="size-4" /> Register another
          </Button>
          {bill ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => onViewBill?.(bill._id)}
            >
              <Ticket className="size-4" /> Open bill
            </Button>
          ) : null}
          <Button type="button" onClick={onViewQueue}>
            <CalendarCheck className="size-4" /> Today&apos;s queue
          </Button>
        </div>
      </div>
    </Card>
  );
}

function formatInr(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

/**
 * Dropdown multi-select for the active treatment catalogue.
 *
 * Trigger looks like a regular `<Select>` trigger and shows a one-line
 * summary (count + price total). Opening it reveals a search input and a
 * scrollable checkbox list. Picked treatments also render as removable
 * chips below the trigger so staff can see (and clear) selections without
 * re-opening the dropdown.
 */
function TreatmentMultiSelect({
  treatments,
  loading,
  selectedIds,
  onToggle,
  onClear,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Selected treatments in the order the user picked them — used for the
  // chips row + price total. Falls back to lookup by ID to survive a stale
  // selection when the catalogue is refetched.
  const selected = useMemo(() => {
    const byId = new Map(treatments.map((t) => [t._id, t]));
    return selectedIds.map((id) => byId.get(id)).filter(Boolean);
  }, [treatments, selectedIds]);

  const total = useMemo(
    () => selected.reduce((sum, t) => sum + Number(t.price || 0), 0),
    [selected],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return treatments;
    return treatments.filter((t) =>
      String(t.name || '').toLowerCase().includes(q),
    );
  }, [treatments, query]);

  if (loading) {
    return <Skeleton className="h-10 w-full max-w-md" />;
  }

  if (!treatments.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No treatments configured yet — add them under{' '}
        <span className="font-medium">Settings → Treatments</span>.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQuery('');
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex h-10 w-full max-w-md items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm shadow-sm transition-colors',
              'hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/40',
            )}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span
              className={cn(
                'flex-1 truncate',
                selected.length === 0 && 'text-muted-foreground',
              )}
            >
              {selected.length === 0
                ? 'Select treatments…'
                : `${selected.length} treatment${selected.length === 1 ? '' : 's'} · ${formatInr(total)}`}
            </span>
            <ChevronDown
              className={cn(
                'size-4 shrink-0 text-muted-foreground transition-transform',
                open && 'rotate-180',
              )}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <div className="border-b p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search treatments…"
                className="h-8 pl-8 pr-2 text-sm"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No matches.
            </p>
          ) : (
            <ul role="listbox" className="max-h-64 overflow-y-auto p-1">
              {filtered.map((t) => {
                const isSelected = selectedSet.has(t._id);
                return (
                  <li key={t._id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => onToggle(t._id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors',
                        isSelected
                          ? 'bg-primary/5'
                          : 'hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        // Visual only — the parent button handles toggling.
                        tabIndex={-1}
                        aria-hidden="true"
                        className="pointer-events-none"
                      />
                      <span className="flex-1 truncate">{t.name}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {formatInr(t.price)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {selected.length > 0 ? (
            <div className="flex items-center justify-between border-t px-2 py-1.5 text-[11px] text-muted-foreground">
              <span>
                {selected.length} selected · {formatInr(total)}
              </span>
              <button
                type="button"
                onClick={() => {
                  onClear?.();
                  setQuery('');
                }}
                className="font-medium text-primary hover:underline"
              >
                Clear
              </button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((t) => (
            <Badge
              key={t._id}
              variant="secondary"
              className="gap-1.5 pr-1 font-normal"
            >
              <span className="truncate">{t.name}</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {formatInr(t.price)}
              </span>
              <button
                type="button"
                onClick={() => onToggle(t._id)}
                className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full hover:bg-foreground/10"
                aria-label={`Remove ${t.name}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// One internal section inside the single page Card.
function Section({ icon: Icon, title, description, children }) {
  return (
    <div className="px-5 py-5 sm:px-6">
      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          {Icon ? <Icon className="size-4 text-primary" /> : null}
          {title}
        </h3>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// PatientCombobox
// One smart input that finds existing patients by name/phone, and offers
// inline "Create new patient" when the typed value looks like a phone and
// doesn't match anyone — no manual mode toggle.
// ─────────────────────────────────────────────────────────
function PatientCombobox({ patients, loading, value, onChange, onCreate }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(null); // { phone }
  const [draftFields, setDraftFields] = useState({ name: '', email: '' });
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const inputRef = useRef(null);

  const selected = patients.find((p) => p._id === value) || null;

  const matches = useMemo(() => {
    if (!query.trim()) return patients.slice(0, 50);
    const ql = query.toLowerCase();
    const qd = normPhone(query);
    return patients
      .filter(
        (p) =>
          (p.name || '').toLowerCase().includes(ql) ||
          (qd && normPhone(p.phone).includes(qd)),
      )
      .slice(0, 50);
  }, [patients, query]);

  const exactPhoneMatch = useMemo(() => {
    const qd = normPhone(query);
    if (!qd) return null;
    return patients.find((p) => normPhone(p.phone) === qd) || null;
  }, [patients, query]);

  function clearSelection() {
    onChange(null);
    setQuery('');
    setCreatingDraft(null);
    setDraftFields({ name: '', email: '' });
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function pickPatient(p) {
    onChange(p);
    setOpen(false);
    setQuery('');
  }

  function startCreate() {
    setCreatingDraft({ phone: query.trim() });
    setOpen(false);
  }

  async function submitCreate() {
    if (!draftFields.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSubmittingCreate(true);
    try {
      const created = await onCreate({
        name: draftFields.name.trim(),
        phone: creatingDraft.phone,
        email: draftFields.email.trim() || undefined,
      });
      onChange(created);
      setCreatingDraft(null);
      setDraftFields({ name: '', email: '' });
      setQuery('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create patient');
    } finally {
      setSubmittingCreate(false);
    }
  }

  // ── Selected state ──
  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border bg-primary/5 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-9 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-semibold">
              {initialsOf(selected.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold">
                {selected.name}
              </span>
              <Badge variant="success" className="font-normal">
                <Check className="size-3" /> Selected
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3" /> {selected.phone}
              </span>
              {selected.email ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Mail className="size-3" />
                    <span className="truncate">{selected.email}</span>
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearSelection}
        >
          <X className="size-3.5" /> Change
        </Button>
      </div>
    );
  }

  // ── Inline "create new patient" form ──
  if (creatingDraft) {
    return (
      <div className="rounded-md border bg-muted/30 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserPlus className="size-3.5" />
            </span>
            <span className="font-medium">New patient</span>
            <Badge variant="info" className="font-normal tabular-nums">
              <Phone className="size-3" /> {creatingDraft.phone}
            </Badge>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setCreatingDraft(null);
              setDraftFields({ name: '', email: '' });
            }}
          >
            <X className="size-3.5" /> Cancel
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="np-name">
              Full name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="np-name"
              autoFocus
              required
              value={draftFields.name}
              onChange={(e) =>
                setDraftFields({ ...draftFields, name: e.target.value })
              }
              placeholder="e.g. John Doe"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-email">Email</Label>
            <Input
              id="np-email"
              type="email"
              value={draftFields.email}
              onChange={(e) =>
                setDraftFields({ ...draftFields, email: e.target.value })
              }
              placeholder="optional"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end">
          <Button
            type="button"
            size="sm"
            onClick={submitCreate}
            disabled={submittingCreate}
          >
            {submittingCreate ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <UserPlus className="size-3.5" />
            )}
            {submittingCreate ? 'Creating…' : 'Create & select'}
          </Button>
        </div>
      </div>
    );
  }

  // ── Search state ──
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search by name or phone, or type a new phone number…"
            className="h-10 pl-9 pr-9"
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Clear"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-[320px] overflow-y-auto py-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Loading patients…
            </div>
          ) : matches.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {looksLikePhone(query)
                ? 'No matching patients.'
                : query
                  ? 'No matches. Type a phone number to create a new patient.'
                  : 'No patients yet.'}
            </div>
          ) : (
            <ul className="px-1">
              {matches.map((p) => (
                <li key={p._id}>
                  <button
                    type="button"
                    onClick={() => pickPatient(p)}
                    onMouseDown={(e) => e.preventDefault()}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent"
                  >
                    <Avatar className="size-7">
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                        {initialsOf(p.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {p.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground tabular-nums">
                        {p.phone}
                        {p.email ? ` · ${p.email}` : ''}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {looksLikePhone(query) && !exactPhoneMatch ? (
            <>
              <div className="my-1 border-t" />
              <button
                type="button"
                onClick={startCreate}
                onMouseDown={(e) => e.preventDefault()}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserPlus className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">Create new patient</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    with phone {query.trim()}
                  </span>
                </span>
              </button>
            </>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SummaryItem({ icon: Icon, label, value, tabular }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          'truncate font-medium',
          !value && 'italic text-muted-foreground',
          tabular && 'tabular-nums',
        )}
      >
        {value || 'not set'}
      </span>
    </div>
  );
}
