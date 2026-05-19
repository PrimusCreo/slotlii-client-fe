import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Calendar,
  ClipboardList,
  Clock,
  Download,
  Eye,
  FileText,
  Heart,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Pill,
  Plus,
  Search,
  Share2,
  Stethoscope,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import Layout from '../components/Layout/Layout';
import * as api from '../api';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/common/status-badge';

const TABS = [
  { key: 'timeline', label: 'Timeline', icon: Activity },
  { key: 'consultation', label: 'Consultations', icon: Stethoscope },
  { key: 'prescription', label: 'Prescriptions', icon: Pill },
  { key: 'reports', label: 'Reports', icon: ClipboardList },
];

const TYPE_META = {
  consultation: {
    label: 'Consultation',
    icon: Stethoscope,
    tint: 'bg-[color:var(--status-completed-bg)] text-[color:var(--status-completed)]',
    dotBg: 'var(--status-completed)',
  },
  prescription: {
    label: 'Prescription',
    icon: Pill,
    tint: 'bg-[color:var(--status-booked-bg)] text-[color:var(--status-booked)]',
    dotBg: 'var(--status-booked)',
  },
  report: {
    label: 'Report',
    icon: ClipboardList,
    tint: 'bg-[color:var(--status-noshow-bg)] text-[color:var(--status-noshow)]',
    dotBg: 'var(--status-noshow)',
  },
  appointment: {
    label: 'Appointment',
    icon: Calendar,
    tint: 'bg-primary/10 text-primary',
    dotBg: 'var(--primary)',
  },
};

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function calcAge(dob) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n === 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const emptyMedication = () => ({
  name: '',
  dosage: '',
  duration: '',
  frequency: '',
  instructions: '',
});

const FREQUENCY_OPTIONS = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  'Every 4 hours',
  'Every 6 hours',
  'Every 8 hours',
  'As needed',
  'Before meals',
  'After meals',
  'At bedtime',
];

const DURATION_UNITS = ['days', 'weeks', 'months'];

function parseDuration(value) {
  const str = String(value || '').trim();
  if (!str) return { count: '', unit: 'days' };
  const match = str.match(/^(\d+)\s*(days?|weeks?|months?)?$/i);
  if (!match) return { count: '', unit: 'days' };
  const count = match[1];
  let unit = (match[2] || 'days').toLowerCase();
  if (!unit.endsWith('s')) unit += 's';
  if (!DURATION_UNITS.includes(unit)) unit = 'days';
  return { count, unit };
}

function joinDuration(count, unit) {
  const c = String(count || '').trim();
  if (!c) return '';
  return `${c} ${unit || 'days'}`;
}

const initialForm = {
  date: new Date().toISOString().slice(0, 10),
  title: '',
  doctor: '',
  doctorId: '',
  notes: '',
  medications: [emptyMedication()],
  diagnosis: '',
  reportName: '',
  files: [],
};

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline');
  const [search, setSearch] = useState('');

  const [modalType, setModalType] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [savingRecord, setSavingRecord] = useState(false);

  const [doctors, setDoctors] = useState([]);

  const [editingSummary, setEditingSummary] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);
  const [summaryForm, setSummaryForm] = useState(null);
  const [chipDrafts, setChipDrafts] = useState({ chronic: '', allergy: '' });

  const [viewingReport, setViewingReport] = useState(null);
  const [editingReport, setEditingReport] = useState(null);
  const [editReportForm, setEditReportForm] = useState({
    date: '',
    condition: '',
    notes: '',
    doctorId: '',
    doctor: '',
  });
  const [savingEditReport, setSavingEditReport] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState(null);

  const [viewingPrescription, setViewingPrescription] = useState(null);
  const [editingPrescription, setEditingPrescription] = useState(null);
  const [editPrescriptionForm, setEditPrescriptionForm] = useState({
    date: '',
    diagnosis: '',
    doctorId: '',
    doctor: '',
    medications: [emptyMedication()],
  });
  const [savingEditPrescription, setSavingEditPrescription] = useState(false);
  const [deletingPrescriptionId, setDeletingPrescriptionId] = useState(null);

  useEffect(() => {
    loadPatientData();
  }, [id]);

  const clinicId =
    typeof patient?.clinicId === 'object'
      ? patient?.clinicId?._id
      : patient?.clinicId;

  useEffect(() => {
    if (!clinicId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getDoctors({ clinicId, limit: 200 });
        if (!cancelled) setDoctors(res.data.data || []);
      } catch {
        if (!cancelled) setDoctors([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clinicId]);

  async function loadPatientData() {
    try {
      const [patientRes, aptsRes] = await Promise.all([
        api.getPatient(id),
        api.getPatientAppointments(id),
      ]);
      setPatient(patientRes.data.data);
      setAppointments(aptsRes.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal(type) {
    setModalType(type);
    setForm({ ...initialForm, files: [], medications: [emptyMedication()] });
  }

  async function handleSaveRecord(e) {
    e.preventDefault();
    setSavingRecord(true);
    try {
      if (modalType === 'report') {
        if (!form.files || form.files.length === 0) {
          toast.error('Please attach at least one file');
          setSavingRecord(false);
          return;
        }
        const fd = new FormData();
        fd.append('condition', (form.reportName || 'Report').trim());
        fd.append('date', form.date || '');
        if (form.notes) fd.append('notes', form.notes);
        if (form.doctorId) fd.append('doctorId', form.doctorId);
        if (form.doctor) fd.append('doctor', form.doctor);
        for (const file of form.files) fd.append('files', file);
        await api.addPatientReport(id, fd);
      } else if (modalType === 'prescription') {
        const meds = (form.medications || [])
          .map((m) => ({
            name: (m.name || '').trim(),
            dosage: (m.dosage || '').trim(),
            duration: (m.duration || '').trim(),
            frequency: (m.frequency || '').trim(),
            instructions: (m.instructions || '').trim(),
          }))
          .filter((m) => m.name);
        if (meds.length === 0) {
          toast.error('Please add at least one medication with a name');
          setSavingRecord(false);
          return;
        }
        if (!form.diagnosis.trim()) {
          toast.error('Diagnosis is required');
          setSavingRecord(false);
          return;
        }
        await api.addMedicalHistory(id, {
          type: 'prescription',
          date: form.date,
          condition: form.diagnosis.trim(),
          medications: meds,
          doctor: form.doctor,
          doctorId: form.doctorId || undefined,
        });
      } else {
        const payload = {
          type: modalType,
          date: form.date,
          condition: form.title || form.diagnosis,
          treatment: form.diagnosis,
          notes: form.notes,
          doctor: form.doctor,
        };
        await api.addMedicalHistory(id, payload);
      }
      toast.success(`${TYPE_META[modalType].label} added`);
      setModalType(null);
      loadPatientData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save record');
    } finally {
      setSavingRecord(false);
    }
  }

  function openEditSummary() {
    const ec = patient.emergencyContact;
    const emergency =
      ec && typeof ec === 'object'
        ? { name: ec.name || '', relation: ec.relation || '', phone: ec.phone || '' }
        : { name: typeof ec === 'string' ? ec : '', relation: '', phone: '' };
    const v = patient.vitals || patient.latestVitals || {};
    setSummaryForm({
      name: patient.name || '',
      dateOfBirth: patient.dateOfBirth
        ? new Date(patient.dateOfBirth).toISOString().slice(0, 10)
        : '',
      gender: patient.gender || '',
      phone: patient.phone || '',
      email: patient.email || '',
      address: patient.address || '',
      occupation: patient.occupation || '',
      emergencyContact: emergency,
      chronicConditions: (patient.chronicConditions || [])
        .map((c) => (typeof c === 'string' ? c : c.name))
        .filter(Boolean),
      allergies: (patient.allergies || [])
        .map((a) => (typeof a === 'string' ? a : a.name))
        .filter(Boolean),
      vitals: {
        bp: v.bp || '',
        pulse: v.pulse || '',
        weight: v.weight || '',
        height: v.height || '',
        temperature: v.temperature || '',
        bmi: v.bmi || '',
        bmiCategory: v.bmiCategory || '',
      },
    });
    setChipDrafts({ chronic: '', allergy: '' });
    setEditingSummary(true);
  }

  function addChip(field, draftKey) {
    const value = chipDrafts[draftKey].trim();
    if (!value) return;
    setSummaryForm((s) => ({
      ...s,
      [field]: s[field].includes(value) ? s[field] : [...s[field], value],
    }));
    setChipDrafts((d) => ({ ...d, [draftKey]: '' }));
  }

  function removeChip(field, idx) {
    setSummaryForm((s) => ({ ...s, [field]: s[field].filter((_, i) => i !== idx) }));
  }

  async function handleSaveSummary(e) {
    e.preventDefault();
    setSavingSummary(true);
    try {
      const payload = {
        name: summaryForm.name,
        dateOfBirth: summaryForm.dateOfBirth || null,
        gender: summaryForm.gender,
        phone: summaryForm.phone,
        email: summaryForm.email,
        address: summaryForm.address,
        occupation: summaryForm.occupation,
        emergencyContact: summaryForm.emergencyContact,
        chronicConditions: summaryForm.chronicConditions,
        allergies: summaryForm.allergies,
        vitals: summaryForm.vitals,
      };
      await api.updatePatient(id, payload);
      toast.success('Patient summary updated');
      setEditingSummary(false);
      loadPatientData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update summary');
    } finally {
      setSavingSummary(false);
    }
  }

  function openViewReport(report) {
    setViewingReport(report);
  }

  function openEditReport(report) {
    setEditReportForm({
      date: report.date
        ? new Date(report.date).toISOString().slice(0, 10)
        : '',
      condition: report.condition || '',
      notes: report.notes || '',
      doctorId: report.doctorId || '',
      doctor: report.doctor || '',
    });
    setEditingReport(report);
  }

  async function handleEditReportSubmit(e) {
    e.preventDefault();
    if (!editingReport) return;
    setSavingEditReport(true);
    try {
      await api.updatePatientMedicalHistory(id, editingReport._id, {
        date: editReportForm.date,
        condition: editReportForm.condition,
        notes: editReportForm.notes,
        doctorId: editReportForm.doctorId || null,
        doctor: editReportForm.doctor,
      });
      toast.success('Report updated');
      setEditingReport(null);
      loadPatientData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update report');
    } finally {
      setSavingEditReport(false);
    }
  }

  async function shareReport(report) {
    const links = (report.attachments || [])
      .map((a) => a.publicUrl)
      .filter(Boolean);
    if (links.length === 0) {
      toast.error('No file links available to share');
      return;
    }
    const text =
      links.length === 1
        ? links[0]
        : `${report.condition || 'Report'}\n${links.join('\n')}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(
        links.length === 1
          ? 'Report link copied — paste it in your chat with the patient'
          : `${links.length} links copied — paste them in your chat with the patient`,
      );
    } catch {
      toast.error('Could not copy link to clipboard');
    }
  }

  async function deleteReport(report) {
    if (
      !window.confirm(
        `Delete "${report.condition || 'this report'}"? This will also remove its attached files. This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingReportId(report._id);
    try {
      await api.deletePatientMedicalHistory(id, report._id);
      toast.success('Report deleted');
      loadPatientData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete report');
    } finally {
      setDeletingReportId(null);
    }
  }

  function openViewPrescription(rx) {
    setViewingPrescription(rx);
  }

  function openEditPrescription(rx) {
    setEditPrescriptionForm({
      date: rx.date ? new Date(rx.date).toISOString().slice(0, 10) : '',
      diagnosis: rx.condition || '',
      doctorId: rx.doctorId || '',
      doctor: rx.doctor || '',
      medications:
        rx.medications && rx.medications.length > 0
          ? rx.medications.map((m) => ({
              name: m.name || '',
              dosage: m.dosage || '',
              duration: m.duration || '',
              frequency: m.frequency || '',
              instructions: m.instructions || '',
            }))
          : [emptyMedication()],
    });
    setEditingPrescription(rx);
  }

  async function handleEditPrescriptionSubmit(e) {
    e.preventDefault();
    if (!editingPrescription) return;
    const meds = (editPrescriptionForm.medications || [])
      .map((m) => ({
        name: (m.name || '').trim(),
        dosage: (m.dosage || '').trim(),
        duration: (m.duration || '').trim(),
        frequency: (m.frequency || '').trim(),
        instructions: (m.instructions || '').trim(),
      }))
      .filter((m) => m.name);
    if (meds.length === 0) {
      toast.error('Please add at least one medication with a name');
      return;
    }
    if (!editPrescriptionForm.diagnosis.trim()) {
      toast.error('Diagnosis is required');
      return;
    }
    setSavingEditPrescription(true);
    try {
      await api.updatePatientMedicalHistory(id, editingPrescription._id, {
        date: editPrescriptionForm.date,
        condition: editPrescriptionForm.diagnosis.trim(),
        medications: meds,
        doctor: editPrescriptionForm.doctor,
        doctorId: editPrescriptionForm.doctorId || null,
      });
      toast.success('Prescription updated');
      setEditingPrescription(null);
      loadPatientData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update prescription');
    } finally {
      setSavingEditPrescription(false);
    }
  }

  async function sharePrescription(rx) {
    const lines = [];
    lines.push(`Prescription — ${rx.condition || 'Diagnosis'}`);
    if (rx.doctor) lines.push(`Doctor: ${rx.doctor}`);
    if (rx.date) lines.push(`Date: ${formatDate(rx.date)}`);
    lines.push('');
    (rx.medications || []).forEach((m, i) => {
      const segs = [m.name];
      if (m.dosage) segs.push(m.dosage);
      if (m.frequency) segs.push(m.frequency);
      if (m.duration) segs.push(m.duration);
      lines.push(`${i + 1}. ${segs.join(' · ')}`);
      if (m.instructions) lines.push(`   ${m.instructions}`);
    });
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Prescription copied — paste it in your chat with the patient');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  async function deletePrescription(rx) {
    if (
      !window.confirm(
        `Delete prescription "${rx.condition || 'this prescription'}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingPrescriptionId(rx._id);
    try {
      await api.deletePatientMedicalHistory(id, rx._id);
      toast.success('Prescription deleted');
      loadPatientData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete prescription');
    } finally {
      setDeletingPrescriptionId(null);
    }
  }

  const records = useMemo(() => patient?.medicalHistory || [], [patient]);

  const recordsByType = useMemo(() => {
    const grouped = { consultation: [], prescription: [], report: [] };
    records.forEach((r) => {
      const t = r.type && grouped[r.type] ? r.type : 'consultation';
      grouped[t].push(r);
    });
    Object.keys(grouped).forEach((k) => {
      grouped[k].sort((a, b) => new Date(b.date) - new Date(a.date));
    });
    return grouped;
  }, [records]);

  const timelineItems = useMemo(() => {
    const items = [];
    appointments.forEach((a) => {
      items.push({
        id: `apt-${a._id}`,
        date: a.date,
        time: a.time,
        type: 'appointment',
        title:
          a.status === 'cancelled'
            ? 'Appointment Cancelled'
            : `Appointment — ${a.issue || 'Visit'}`,
        subtitle: a.doctorName ? `Doctor: ${a.doctorName}` : null,
        description: a.issue,
        status: a.status,
      });
    });
    records.forEach((r, idx) => {
      const t = r.type || 'consultation';
      items.push({
        id: r._id || `rec-${idx}`,
        date: r.date,
        type: t,
        title: r.condition || TYPE_META[t]?.label,
        subtitle: r.doctor ? `Doctor: ${r.doctor}` : null,
        description: r.notes,
        treatment: r.treatment,
        medications: r.medications || [],
        attachments: r.attachments || [],
      });
    });
    return items
      .filter(
        (i) => !search || JSON.stringify(i).toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [appointments, records, search]);

  if (loading) {
    return (
      <Layout title="Patient">
        <div className="space-y-4">
          <Skeleton className="h-12 w-1/3" />
          <div className="grid gap-4 lg:grid-cols-[minmax(280px,30%)_1fr]">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!patient) {
    return (
      <Layout title="Patient">
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Patient not found
          </CardContent>
        </Card>
      </Layout>
    );
  }

  const age = calcAge(patient.dateOfBirth);
  const chronicConditions = patient.chronicConditions || [];
  const allergies = patient.allergies || [];
  const vitals = patient.vitals || patient.latestVitals || {};
  const headerMeta = [
    age != null ? `${age} Y` : null,
    patient.gender
      ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)
      : null,
    patient.phone || null,
  ].filter(Boolean);

  return (
    <Layout title={patient.name}>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar className="size-14">
          <AvatarFallback className="bg-primary/15 text-primary text-lg font-semibold">
            {patient.name?.charAt(0)?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{patient.name}</h1>
          <p className="text-sm text-muted-foreground">
            {headerMeta.length ? headerMeta.join(' · ') : 'Patient profile'}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,30%)_1fr]">
        {/* LEFT: Summary */}
        <Card className="self-start lg:sticky lg:top-20">
          <CardHeader className="flex flex-row items-end justify-between border-b">
            <div>
              <CardTitle>Patient summary</CardTitle>
              {/* <CardDescription>
                Demographics, conditions and vitals.
              </CardDescription> */}
            </div>
            <Button variant="outline" size="sm" onClick={openEditSummary}>
              <Pencil className="size-3.5" /> Edit
            </Button>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <SummarySection title="Personal information">
              <SummaryRow icon={Calendar} label="Date of birth">
                {patient.dateOfBirth
                  ? `${formatDate(patient.dateOfBirth)}${age != null ? ` (${age} Y)` : ''
                  }`
                  : '—'}
              </SummaryRow>
              <SummaryRow icon={User} label="Gender" capitalize>
                {patient.gender || '—'}
              </SummaryRow>
              <SummaryRow icon={Phone} label="Phone">
                {patient.phone || '—'}
              </SummaryRow>
              <SummaryRow icon={Mail} label="Email">
                {patient.email || '—'}
              </SummaryRow>
              <SummaryRow icon={MapPin} label="Address">
                {patient.address || '—'}
              </SummaryRow>
              {patient.occupation ? (
                <SummaryRow icon={Briefcase} label="Occupation">
                  {patient.occupation}
                </SummaryRow>
              ) : null}
              {patient.emergencyContact &&
                (typeof patient.emergencyContact === 'string'
                  ? patient.emergencyContact.trim()
                  : patient.emergencyContact.name ||
                  patient.emergencyContact.phone ||
                  patient.emergencyContact.relation) ? (
                <SummaryRow icon={Heart} label="Emergency">
                  {typeof patient.emergencyContact === 'string'
                    ? patient.emergencyContact
                    : `${patient.emergencyContact.name || ''}${patient.emergencyContact.relation
                      ? ` (${patient.emergencyContact.relation})`
                      : ''
                    }${patient.emergencyContact.phone
                      ? ` • ${patient.emergencyContact.phone}`
                      : ''
                    }`}
                </SummaryRow>
              ) : null}
            </SummarySection>

            <Separator />

            <SummarySection title="Chronic conditions">
              {chronicConditions.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">
                  No chronic conditions recorded
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {chronicConditions.map((c, i) => (
                    <Badge key={i} variant="info" className="font-normal">
                      {typeof c === 'string' ? c : c.name}
                    </Badge>
                  ))}
                </div>
              )}
            </SummarySection>

            <Separator />

            <SummarySection title="Allergies">
              {allergies.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">
                  No known allergies
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {allergies.map((a, i) => (
                    <Badge key={i} variant="warning" className="font-normal">
                      <AlertTriangle className="size-3" />
                      {typeof a === 'string' ? a : a.name}
                    </Badge>
                  ))}
                </div>
              )}
            </SummarySection>

            <Separator />

            <SummarySection
              title="Vitals (latest)"
              meta={vitals.recordedAt ? formatDate(vitals.recordedAt) : null}
            >
              {Object.keys(vitals).length === 0 ? (
                <p className="text-sm italic text-muted-foreground">
                  No vitals recorded
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <VitalCard label="BP" value={vitals.bp} unit="mmHg" />
                  <VitalCard label="Pulse" value={vitals.pulse} unit="bpm" />
                  <VitalCard label="Weight" value={vitals.weight} unit="kg" />
                  <VitalCard label="Height" value={vitals.height} unit="cm" />
                  <VitalCard label="Temp" value={vitals.temperature} unit="°F" />
                  <VitalCard
                    label="BMI"
                    value={vitals.bmi}
                    unit={vitals.bmiCategory || ''}
                  />
                </div>
              )}
            </SummarySection>
          </CardContent>
        </Card>

        {/* RIGHT: tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key}>
                <tab.icon className="size-4" /> {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="timeline" className="mt-4">
            <Card>
              <CardHeader className="border-b">
                <div className="relative w-full sm:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search timeline…"
                    className="h-9 pl-9 pr-9"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label="Clear search"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <TimelineView items={timelineItems} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="consultation" className="mt-4">
            <RecordsTabCard
              type="consultation"
              records={recordsByType.consultation}
              onAdd={() => openAddModal('consultation')}
            />
          </TabsContent>

          <TabsContent value="prescription" className="mt-4">
            <RecordsTabCard
              type="prescription"
              records={recordsByType.prescription}
              onAdd={() => openAddModal('prescription')}
              onView={openViewPrescription}
              onEdit={openEditPrescription}
              onShare={sharePrescription}
              onDelete={deletePrescription}
              deletingPrescriptionId={deletingPrescriptionId}
            />
          </TabsContent>

          <TabsContent value="reports" className="mt-4">
            <RecordsTabCard
              type="report"
              records={recordsByType.report}
              onAdd={() => openAddModal('report')}
              onView={openViewReport}
              onEdit={openEditReport}
              onShare={shareReport}
              onDelete={deleteReport}
              deletingReportId={deletingReportId}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Record modal */}
      <Dialog open={!!modalType} onOpenChange={(o) => !o && setModalType(null)}>
        <DialogContent
          className={cn(
            modalType === 'prescription' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
            'max-h-[90vh] overflow-y-auto',
          )}
        >
          <DialogHeader>
            <DialogTitle>
              Add {modalType ? TYPE_META[modalType].label : ''}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveRecord} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="r-date">Date</Label>
                <Input
                  id="r-date"
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-doc">Doctor</Label>
                {modalType === 'report' || modalType === 'prescription' ? (
                  <Select
                    value={form.doctorId || undefined}
                    onValueChange={(v) => {
                      const picked = doctors.find((d) => d._id === v);
                      setForm({
                        ...form,
                        doctorId: v,
                        doctor: picked?.name || '',
                      });
                    }}
                  >
                    <SelectTrigger id="r-doc">
                      <SelectValue
                        placeholder={
                          doctors.length === 0
                            ? 'No doctors in clinic'
                            : 'Select doctor'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((d) => (
                        <SelectItem key={d._id} value={d._id}>
                          {d.name}
                          {d.specialization ? ` · ${d.specialization}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="r-doc"
                    value={form.doctor}
                    onChange={(e) => setForm({ ...form, doctor: e.target.value })}
                    placeholder="e.g. Dr. Sharma"
                  />
                )}
              </div>
            </div>

            {modalType === 'consultation' ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="r-title">Reason / title *</Label>
                  <Input
                    id="r-title"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Visited for fever"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-diag">Diagnosis</Label>
                  <Input
                    id="r-diag"
                    value={form.diagnosis}
                    onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                    placeholder="e.g. Viral fever"
                  />
                </div>
              </>
            ) : null}

            {modalType === 'prescription' ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="r-diag">Diagnosis *</Label>
                  <Input
                    id="r-diag"
                    required
                    value={form.diagnosis}
                    onChange={(e) =>
                      setForm({ ...form, diagnosis: e.target.value })
                    }
                    placeholder="e.g. Insomnia"
                  />
                </div>

                <MedicationsSection
                  medications={form.medications}
                  onChange={(meds) => setForm({ ...form, medications: meds })}
                />
              </>
            ) : null}

            {modalType === 'report' ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="r-rname">Report name *</Label>
                  <Input
                    id="r-rname"
                    required
                    value={form.reportName}
                    onChange={(e) => setForm({ ...form, reportName: e.target.value })}
                    placeholder="e.g. Complete Blood Count"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-files">Attach files *</Label>
                  <Input
                    id="r-files"
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt,image/*"
                    onChange={(e) => {
                      const incoming = Array.from(e.target.files || []);
                      setForm((f) => ({
                        ...f,
                        files: [...(f.files || []), ...incoming],
                      }));
                      e.target.value = '';
                    }}
                    className="h-auto cursor-pointer py-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-accent"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    PDF, images or docs. Max 10 files, 5 MB each.
                  </p>
                  {form.files?.length ? (
                    <ul className="space-y-1.5 pt-1">
                      {form.files.map((f, i) => (
                        <li
                          key={`${f.name}-${i}`}
                          className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs"
                        >
                          <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate max-w-xs">{f.name}</span>
                          <span className="shrink-0 text-muted-foreground tabular-nums">
                            {formatFileSize(f.size)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setForm((s) => ({
                                ...s,
                                files: s.files.filter((_, idx) => idx !== i),
                              }))
                            }
                            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                            aria-label={`Remove ${f.name}`}
                          >
                            <X className="size-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </>
            ) : null}

            {modalType !== 'prescription' ? (
              <div className="space-y-1.5">
                <Label htmlFor="r-notes">Notes</Label>
                <Textarea
                  id="r-notes"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Additional notes…"
                />
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalType(null)}
                disabled={savingRecord}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingRecord}>
                {savingRecord ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {modalType === 'report' ? 'Uploading…' : 'Saving…'}
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View report modal */}
      <Dialog
        open={!!viewingReport}
        onOpenChange={(o) => !o && setViewingReport(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="truncate">
              {viewingReport?.condition || 'Report'}
            </DialogTitle>
            <DialogDescription>
              Report details and attached files.
            </DialogDescription>
          </DialogHeader>
          {viewingReport ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Date
                  </div>
                  <div className="mt-0.5 tabular-nums">
                    {formatDate(viewingReport.date)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Doctor
                  </div>
                  <div className="mt-0.5">{viewingReport.doctor || '—'}</div>
                </div>
              </div>

              {viewingReport.notes ? (
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Notes
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/80">
                    {viewingReport.notes}
                  </p>
                </div>
              ) : null}

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Attachments ({viewingReport.attachments?.length || 0})
                  </div>
                </div>
                {viewingReport.attachments?.length ? (
                  <ul className="space-y-1.5">
                    {viewingReport.attachments.map((a, i) => (
                      <li
                        key={a._id || i}
                        className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
                      >
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate max-w-xs" title={a.name}>
                          {a.name}
                        </span>
                        {a.size ? (
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {formatFileSize(a.size)}
                          </span>
                        ) : null}
                        <a
                          href={a.publicUrl || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          aria-label={`Open ${a.name}`}
                        >
                          <Download className="size-3.5" />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-md border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
                    No files attached.
                  </div>
                )}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingReport(null)}>
              Close
            </Button>
            {viewingReport ? (
              <Button
                onClick={() => {
                  const target = viewingReport;
                  setViewingReport(null);
                  openEditReport(target);
                }}
              >
                <Pencil className="size-3.5" /> Edit
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit report modal */}
      <Dialog
        open={!!editingReport}
        onOpenChange={(o) => !o && setEditingReport(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit report</DialogTitle>
            <DialogDescription>
              Update the report details. To change attached files, delete this
              report and upload a new one.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditReportSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="er-date">Date</Label>
                <Input
                  id="er-date"
                  type="date"
                  required
                  value={editReportForm.date}
                  onChange={(e) =>
                    setEditReportForm({ ...editReportForm, date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="er-doc">Doctor</Label>
                <Select
                  value={editReportForm.doctorId || undefined}
                  onValueChange={(v) => {
                    const picked = doctors.find((d) => d._id === v);
                    setEditReportForm({
                      ...editReportForm,
                      doctorId: v,
                      doctor: picked?.name || '',
                    });
                  }}
                >
                  <SelectTrigger id="er-doc">
                    <SelectValue
                      placeholder={
                        doctors.length === 0
                          ? 'No doctors in clinic'
                          : 'Select doctor'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => (
                      <SelectItem key={d._id} value={d._id}>
                        {d.name}
                        {d.specialization ? ` · ${d.specialization}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="er-name">Report name *</Label>
              <Input
                id="er-name"
                required
                value={editReportForm.condition}
                onChange={(e) =>
                  setEditReportForm({
                    ...editReportForm,
                    condition: e.target.value,
                  })
                }
                placeholder="e.g. Complete Blood Count"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="er-notes">Notes</Label>
              <Textarea
                id="er-notes"
                rows={3}
                value={editReportForm.notes}
                onChange={(e) =>
                  setEditReportForm({ ...editReportForm, notes: e.target.value })
                }
                placeholder="Additional notes…"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingReport(null)}
                disabled={savingEditReport}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingEditReport}>
                {savingEditReport ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View prescription modal */}
      <Dialog
        open={!!viewingPrescription}
        onOpenChange={(o) => !o && setViewingPrescription(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="truncate">
              {viewingPrescription?.condition || 'Prescription'}
            </DialogTitle>
            <DialogDescription>
              Prescription details and medications.
            </DialogDescription>
          </DialogHeader>
          {viewingPrescription ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Date
                  </div>
                  <div className="mt-0.5 tabular-nums">
                    {formatDate(viewingPrescription.date)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Doctor
                  </div>
                  <div className="mt-0.5">
                    {viewingPrescription.doctor || '—'}
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Medications ({viewingPrescription.medications?.length || 0})
                </div>
                {viewingPrescription.medications?.length ? (
                  <ul className="space-y-2">
                    {viewingPrescription.medications.map((m, i) => (
                      <li
                        key={m._id || i}
                        className="rounded-md border bg-muted/30 px-3 py-2.5 text-sm"
                      >
                        <div className="flex items-baseline gap-2">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full border bg-background text-[10px] font-semibold tabular-nums text-muted-foreground">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">{m.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {[m.dosage, m.frequency, m.duration]
                                .filter(Boolean)
                                .join(' · ') || '—'}
                            </div>
                            {m.instructions ? (
                              <div className="mt-1 text-xs leading-relaxed text-foreground/70">
                                {m.instructions}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : viewingPrescription.treatment ? (
                  <p className="rounded-md border bg-muted/30 px-3 py-2.5 text-sm text-foreground/80">
                    {viewingPrescription.treatment}
                  </p>
                ) : (
                  <div className="rounded-md border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
                    No medications recorded.
                  </div>
                )}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewingPrescription(null)}
            >
              Close
            </Button>
            {viewingPrescription ? (
              <Button
                onClick={() => {
                  const target = viewingPrescription;
                  setViewingPrescription(null);
                  openEditPrescription(target);
                }}
              >
                <Pencil className="size-3.5" /> Edit
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit prescription modal */}
      <Dialog
        open={!!editingPrescription}
        onOpenChange={(o) => !o && setEditingPrescription(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit prescription</DialogTitle>
            <DialogDescription>
              Update the diagnosis, doctor and medications.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleEditPrescriptionSubmit}
            className="space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ep-date">Date</Label>
                <Input
                  id="ep-date"
                  type="date"
                  required
                  value={editPrescriptionForm.date}
                  onChange={(e) =>
                    setEditPrescriptionForm({
                      ...editPrescriptionForm,
                      date: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-doc">Doctor</Label>
                <Select
                  value={editPrescriptionForm.doctorId || undefined}
                  onValueChange={(v) => {
                    const picked = doctors.find((d) => d._id === v);
                    setEditPrescriptionForm({
                      ...editPrescriptionForm,
                      doctorId: v,
                      doctor: picked?.name || '',
                    });
                  }}
                >
                  <SelectTrigger id="ep-doc">
                    <SelectValue
                      placeholder={
                        doctors.length === 0
                          ? 'No doctors in clinic'
                          : 'Select doctor'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => (
                      <SelectItem key={d._id} value={d._id}>
                        {d.name}
                        {d.specialization ? ` · ${d.specialization}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ep-diag">Diagnosis *</Label>
              <Input
                id="ep-diag"
                required
                value={editPrescriptionForm.diagnosis}
                onChange={(e) =>
                  setEditPrescriptionForm({
                    ...editPrescriptionForm,
                    diagnosis: e.target.value,
                  })
                }
                placeholder="e.g. Insomnia"
              />
            </div>

            <MedicationsSection
              medications={editPrescriptionForm.medications}
              onChange={(meds) =>
                setEditPrescriptionForm({
                  ...editPrescriptionForm,
                  medications: meds,
                })
              }
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingPrescription(null)}
                disabled={savingEditPrescription}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingEditPrescription}>
                {savingEditPrescription ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit summary modal */}
      <Dialog
        open={editingSummary && !!summaryForm}
        onOpenChange={(o) => !o && setEditingSummary(false)}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit patient summary</DialogTitle>
            <DialogDescription>
              Update demographics, chronic conditions, allergies, and latest vitals.
            </DialogDescription>
          </DialogHeader>
          {summaryForm ? (
            <form onSubmit={handleSaveSummary} className="space-y-5">
              <SectionTitle>Personal information</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="s-name" label="Full name *" required value={summaryForm.name}
                  onChange={(v) => setSummaryForm({ ...summaryForm, name: v })} />
                <Field id="s-dob" label="Date of birth" type="date"
                  value={summaryForm.dateOfBirth}
                  onChange={(v) => setSummaryForm({ ...summaryForm, dateOfBirth: v })} />
                <div className="space-y-1.5">
                  <Label htmlFor="s-gender">Gender</Label>
                  <Select
                    value={summaryForm.gender || undefined}
                    onValueChange={(v) =>
                      setSummaryForm({ ...summaryForm, gender: v })
                    }
                  >
                    <SelectTrigger id="s-gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Field id="s-occ" label="Occupation" value={summaryForm.occupation}
                  onChange={(v) => setSummaryForm({ ...summaryForm, occupation: v })} placeholder="e.g. Business" />
                <Field id="s-phone" label="Phone" value={summaryForm.phone}
                  onChange={(v) => setSummaryForm({ ...summaryForm, phone: v })} placeholder="9876543210" />
                <Field id="s-email" label="Email" type="email" value={summaryForm.email}
                  onChange={(v) => setSummaryForm({ ...summaryForm, email: v })} placeholder="patient@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-addr">Address</Label>
                <Textarea id="s-addr" rows={2}
                  value={summaryForm.address}
                  onChange={(e) =>
                    setSummaryForm({ ...summaryForm, address: e.target.value })
                  }
                  placeholder="Street, City, State"
                />
              </div>

              <SectionTitle>Emergency contact</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field id="ec-name" label="Name" value={summaryForm.emergencyContact.name}
                  onChange={(v) => setSummaryForm({
                    ...summaryForm,
                    emergencyContact: { ...summaryForm.emergencyContact, name: v },
                  })}
                  placeholder="e.g. Ramesh Kumar" />
                <Field id="ec-rel" label="Relation" value={summaryForm.emergencyContact.relation}
                  onChange={(v) => setSummaryForm({
                    ...summaryForm,
                    emergencyContact: { ...summaryForm.emergencyContact, relation: v },
                  })}
                  placeholder="e.g. Father" />
                <Field id="ec-ph" label="Phone" value={summaryForm.emergencyContact.phone}
                  onChange={(v) => setSummaryForm({
                    ...summaryForm,
                    emergencyContact: { ...summaryForm.emergencyContact, phone: v },
                  })}
                  placeholder="9876543210" />
              </div>

              <SectionTitle>Chronic conditions</SectionTitle>
              <ChipInput
                items={summaryForm.chronicConditions}
                draft={chipDrafts.chronic}
                onDraftChange={(v) => setChipDrafts({ ...chipDrafts, chronic: v })}
                onCommit={() => addChip('chronicConditions', 'chronic')}
                onRemove={(i) => removeChip('chronicConditions', i)}
                placeholder="Type and press Enter (e.g. Diabetes Type 2)"
                variant="info"
              />

              <SectionTitle>Allergies</SectionTitle>
              <ChipInput
                items={summaryForm.allergies}
                draft={chipDrafts.allergy}
                onDraftChange={(v) => setChipDrafts({ ...chipDrafts, allergy: v })}
                onCommit={() => addChip('allergies', 'allergy')}
                onRemove={(i) => removeChip('allergies', i)}
                placeholder="Type and press Enter (e.g. Penicillin)"
                variant="warning"
                icon={AlertTriangle}
              />

              <SectionTitle>Latest vitals</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field id="v-bp" label="Blood pressure" value={summaryForm.vitals.bp}
                  onChange={(v) =>
                    setSummaryForm({
                      ...summaryForm,
                      vitals: { ...summaryForm.vitals, bp: v },
                    })
                  }
                  placeholder="e.g. 130/85" />
                <Field id="v-pulse" label="Pulse (bpm)" value={summaryForm.vitals.pulse}
                  onChange={(v) =>
                    setSummaryForm({
                      ...summaryForm,
                      vitals: { ...summaryForm.vitals, pulse: v },
                    })
                  }
                  placeholder="e.g. 82" />
                <Field id="v-temp" label="Temp (°F)" value={summaryForm.vitals.temperature}
                  onChange={(v) =>
                    setSummaryForm({
                      ...summaryForm,
                      vitals: { ...summaryForm.vitals, temperature: v },
                    })
                  }
                  placeholder="e.g. 98.6" />
                <Field id="v-w" label="Weight (kg)" value={summaryForm.vitals.weight}
                  onChange={(v) =>
                    setSummaryForm({
                      ...summaryForm,
                      vitals: { ...summaryForm.vitals, weight: v },
                    })
                  }
                  placeholder="e.g. 72" />
                <Field id="v-h" label="Height (cm)" value={summaryForm.vitals.height}
                  onChange={(v) =>
                    setSummaryForm({
                      ...summaryForm,
                      vitals: { ...summaryForm.vitals, height: v },
                    })
                  }
                  placeholder="e.g. 175" />
                <Field id="v-bmi" label="BMI" value={summaryForm.vitals.bmi}
                  onChange={(v) =>
                    setSummaryForm({
                      ...summaryForm,
                      vitals: { ...summaryForm.vitals, bmi: v },
                    })
                  }
                  placeholder="e.g. 23.5" />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingSummary(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={savingSummary}>
                  {savingSummary ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Saving…
                    </>
                  ) : (
                    'Save changes'
                  )}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

/* ───────────────────────── helpers ───────────────────────── */

function SummarySection({ title, meta, children }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {meta ? <span className="text-[11px] text-muted-foreground">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

function SummaryRow({ icon: Icon, label, capitalize, children }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </span>
      <span
        className={cn(
          'text-right font-medium break-words',
          capitalize && 'capitalize',
        )}
      >
        {children}
      </span>
    </div>
  );
}

function VitalCard({ label, value, unit }) {
  if (!value) return null;
  return (
    <div className="rounded-md border bg-muted/40 px-2.5 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-bold tabular-nums leading-tight">{value}</div>
      <div className="text-[10px] text-muted-foreground">{unit}</div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 className="pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

function Field({ id, label, type = 'text', value, onChange, placeholder, required }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function ChipInput({ items, draft, onDraftChange, onCommit, onRemove, placeholder, variant, icon: Icon }) {
  return (
    <div className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-md border bg-background px-2.5 py-2 focus-within:ring-2 focus-within:ring-ring/30 focus-within:border-ring">
      {items.map((c, i) => (
        <Badge key={i} variant={variant || 'secondary'} className="gap-1.5 pr-1 font-normal">
          {Icon ? <Icon className="size-3" /> : null}
          {c}
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full hover:bg-foreground/10"
            aria-label={`Remove ${c}`}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <input
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            onCommit();
          }
        }}
        onBlur={onCommit}
        placeholder={placeholder}
        className="flex-1 min-w-[160px] bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

function TimelineView({ items }) {
  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Activity className="size-5" />
          </div>
          <p className="text-sm font-medium">No timeline events yet</p>
        </div>
      ) : (
        <ol className="relative space-y-5 pl-[110px]">
          <span className="absolute left-[100px] top-3 bottom-3 w-px bg-border" />
          {items.map((item) => {
            const meta = TYPE_META[item.type] || TYPE_META.consultation;
            const Icon = meta.icon;
            const cancelled = item.status === 'cancelled';
            return (
              <li key={item.id} className="relative">
                <div className="absolute left-[-110px] top-1 w-[88px] text-right">
                  <div className="text-base font-bold leading-none tabular-nums">
                    {String(new Date(item.date).getDate()).padStart(2, '0')}
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {new Date(item.date).toLocaleDateString('en-US', { month: 'short' })}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(item.date).getFullYear()}
                  </div>
                  {item.time ? (
                    <div className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                      {item.time}
                    </div>
                  ) : null}
                </div>

                <div
                  className={cn(
                    'absolute left-[-22px] top-1 flex size-6 items-center justify-center rounded-full border-[3px] border-card',
                  )}
                  style={{ background: cancelled ? 'var(--status-cancelled)' : meta.dotBg }}
                >
                  {cancelled ? (
                    <X className="size-3 text-white" />
                  ) : (
                    <Icon className="size-3 text-white" />
                  )}
                </div>

                <div
                  className={cn(
                    'rounded-md border bg-muted/30 px-3.5 py-3 transition-colors hover:bg-accent/40',
                    cancelled && 'opacity-80',
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{item.title}</span>
                    {item.status ? <StatusBadge status={item.status} /> : null}
                  </div>
                  {item.subtitle ? (
                    <div className="text-xs text-muted-foreground">{item.subtitle}</div>
                  ) : null}
                  {item.type === 'prescription' && item.medications?.length ? (
                    <ul className="mt-1.5 space-y-1">
                      {item.medications.map((m, i) => (
                        <li
                          key={m._id || i}
                          className="flex items-baseline gap-1.5 text-xs text-muted-foreground"
                        >
                          <Pill className="size-3 shrink-0 translate-y-0.5 text-foreground/60" />
                          <div className="min-w-0">
                            <span className="font-medium text-foreground/90">
                              {m.name}
                            </span>
                            {m.dosage ? <span> · {m.dosage}</span> : null}
                            {m.frequency ? <span> · {m.frequency}</span> : null}
                            {m.duration ? <span> · {m.duration}</span> : null}
                            {m.instructions ? (
                              <div className="text-[11px] text-muted-foreground/80">
                                {m.instructions}
                              </div>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : item.treatment ? (
                    <div className="text-xs text-muted-foreground">
                      <strong className="font-semibold text-foreground/80">
                        {item.type === 'prescription' ? 'Medications:' : 'Treatment:'}
                      </strong>{' '}
                      {item.treatment}
                    </div>
                  ) : null}
                  {item.description ? (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  ) : null}
                  {item.attachments?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.attachments.map((a, i) => (
                        <a
                          key={a._id || i}
                          href={a.publicUrl || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-accent"
                          title={a.name}
                        >
                          <FileText className="size-3 shrink-0" />
                          <span className="max-w-[160px] truncate">{a.name}</span>
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function RecordsTabCard({
  type,
  records,
  onAdd,
  onView,
  onEdit,
  onShare,
  onDelete,
  deletingReportId,
  deletingPrescriptionId,
}) {
  const meta = TYPE_META[type];
  const [search, setSearch] = useState('');
  const isReport = type === 'report';
  const isPrescription = type === 'prescription';
  const isTable = isReport || isPrescription;

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => {
      const fields = [r.condition, r.doctor, r.notes, r.treatment];
      if (Array.isArray(r.medications)) {
        for (const m of r.medications) {
          fields.push(m.name, m.dosage, m.frequency, m.duration, m.instructions);
        }
      }
      return fields
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [records, search]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${meta.label.toLowerCase()}s…`}
            className="h-9 pl-9 pr-9"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <Button size="sm" onClick={onAdd}>
          <Plus className="size-3.5" /> New {meta.label.toLowerCase()}
        </Button>
      </CardHeader>
      <CardContent className={isTable ? 'p-0' : 'pt-6'}>
        {isReport ? (
          <ReportsTable
            records={filteredRecords}
            onAdd={onAdd}
            onView={onView}
            onEdit={onEdit}
            onShare={onShare}
            onDelete={onDelete}
            deletingReportId={deletingReportId}
          />
        ) : isPrescription ? (
          <PrescriptionsTable
            records={filteredRecords}
            onAdd={onAdd}
            onView={onView}
            onEdit={onEdit}
            onShare={onShare}
            onDelete={onDelete}
            deletingPrescriptionId={deletingPrescriptionId}
          />
        ) : (
          <RecordsList type={type} records={filteredRecords} onAdd={onAdd} />
        )}
      </CardContent>
    </Card>
  );
}

function RecordsList({ type, records, onAdd }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
        <div
          className={cn(
            'flex size-12 items-center justify-center rounded-full',
            meta.tint,
          )}
        >
          <Icon className="size-5" />
        </div>
        <p className="text-sm font-medium">No {meta.label.toLowerCase()}s yet</p>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="size-3.5" /> Add first {meta.label.toLowerCase()}
        </Button>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {records.map((r, idx) => (
        <li key={r._id || idx}>
          <article className="flex gap-3 rounded-md border bg-muted/30 p-4 transition-colors hover:bg-accent/40">
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-md',
                meta.tint,
              )}
            >
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold">{r.condition || meta.label}</h4>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
                  <Clock className="size-3" /> {formatDate(r.date)}
                </span>
              </div>
              {r.doctor ? (
                <div className="text-xs text-muted-foreground">Doctor: {r.doctor}</div>
              ) : null}
              {type === 'prescription' ? (
                r.medications?.length ? (
                  <ul className="mt-1 space-y-1">
                    {r.medications.map((m, i) => (
                      <li
                        key={m._id || i}
                        className="flex items-baseline gap-1.5 text-xs text-muted-foreground"
                      >
                        <Pill className="size-3 shrink-0 translate-y-0.5 text-foreground/60" />
                        <div className="min-w-0">
                          <span className="font-medium text-foreground/90">
                            {m.name}
                          </span>
                          {m.dosage ? <span> · {m.dosage}</span> : null}
                          {m.frequency ? <span> · {m.frequency}</span> : null}
                          {m.duration ? <span> · {m.duration}</span> : null}
                          {m.instructions ? (
                            <div className="text-[11px] text-muted-foreground/80">
                              {m.instructions}
                            </div>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : r.treatment ? (
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground/80">Medications:</strong>{' '}
                    {r.treatment}
                  </p>
                ) : null
              ) : null}
              {type === 'consultation' && r.treatment ? (
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground/80">Diagnosis:</strong>{' '}
                  {r.treatment}
                </p>
              ) : null}
              {r.notes ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {r.notes}
                </p>
              ) : null}
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}

function ReportsTable({
  records,
  onAdd,
  onView,
  onEdit,
  onShare,
  onDelete,
  deletingReportId,
}) {
  const meta = TYPE_META.report;
  const Icon = meta.icon;

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
        <div
          className={cn(
            'flex size-12 items-center justify-center rounded-full',
            meta.tint,
          )}
        >
          <Icon className="size-5" />
        </div>
        <p className="text-sm font-medium">No reports yet</p>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="size-3.5" /> Add first report
        </Button>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Report name</TableHead>
          <TableHead>Doctor</TableHead>
          <TableHead>Notes</TableHead>
          <TableHead className="w-[60px] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((r) => {
          const fileCount = r.attachments?.length || 0;
          return (
            <TableRow
              key={r._id}
              onClick={() => onView(r)}
              className="cursor-pointer"
            >
              <TableCell className="align-top">
                <div className="flex items-start gap-2.5">
                  <div
                    className={cn(
                      'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md',
                      meta.tint,
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {r.condition || 'Report'}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" /> {formatDate(r.date)}
                      </span>
                      {fileCount > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <FileText className="size-3" /> {fileCount} file
                          {fileCount === 1 ? '' : 's'}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="align-top text-sm text-muted-foreground">
                {r.doctor || '—'}
              </TableCell>
              <TableCell className="max-w-[320px] align-top text-sm text-muted-foreground">
                {r.notes ? (
                  <span className="line-clamp-2 whitespace-pre-line">
                    {r.notes}
                  </span>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell
                className="text-right align-top"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Report actions"
                      disabled={deletingReportId === r._id}
                    >
                      {deletingReportId === r._id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <MoreHorizontal className="size-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => onEdit(r)}>
                      <Pencil className="size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onView(r)}>
                      <Eye className="size-4" />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onShare(r)}>
                      <Share2 className="size-4" />
                      Share with patient
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(r)}
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function PrescriptionsTable({
  records,
  onAdd,
  onView,
  onEdit,
  onShare,
  onDelete,
  deletingPrescriptionId,
}) {
  const meta = TYPE_META.prescription;
  const Icon = meta.icon;

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
        <div
          className={cn(
            'flex size-12 items-center justify-center rounded-full',
            meta.tint,
          )}
        >
          <Icon className="size-5" />
        </div>
        <p className="text-sm font-medium">No prescriptions yet</p>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="size-3.5" /> Add first prescription
        </Button>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Diagnosis</TableHead>
          <TableHead>Doctor</TableHead>
          <TableHead>Medications</TableHead>
          <TableHead className="w-[60px] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((r) => {
          const medCount = r.medications?.length || 0;
          return (
            <TableRow
              key={r._id}
              onClick={() => onView(r)}
              className="cursor-pointer"
            >
              <TableCell className="align-top">
                <div className="flex items-start gap-2.5">
                  <div
                    className={cn(
                      'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md',
                      meta.tint,
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {r.condition || 'Prescription'}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" /> {formatDate(r.date)}
                      </span>
                      {medCount > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Pill className="size-3" /> {medCount} med
                          {medCount === 1 ? '' : 's'}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="align-top text-sm text-muted-foreground">
                {r.doctor || '—'}
              </TableCell>
              <TableCell className="max-w-[360px] align-top text-sm text-muted-foreground">
                {r.medications?.length ? (
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span
                      className="truncate"
                      title={[
                        r.medications[0].name,
                        r.medications[0].dosage,
                        r.medications[0].frequency,
                        r.medications[0].duration,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    >
                      <span className="font-medium text-foreground/90">
                        {r.medications[0].name}
                      </span>
                      {r.medications[0].dosage ? (
                        <span className="text-muted-foreground">
                          {' '}
                          · {r.medications[0].dosage}
                        </span>
                      ) : null}
                      {r.medications[0].frequency ? (
                        <span className="text-muted-foreground">
                          {' '}
                          · {r.medications[0].frequency}
                        </span>
                      ) : null}
                    </span>
                    {r.medications.length > 1 ? (
                      <span className="text-[11px] text-muted-foreground">
                        +{r.medications.length - 1} more
                      </span>
                    ) : null}
                  </div>
                ) : r.treatment ? (
                  <span className="line-clamp-2">{r.treatment}</span>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell
                className="text-right align-top"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Prescription actions"
                      disabled={deletingPrescriptionId === r._id}
                    >
                      {deletingPrescriptionId === r._id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <MoreHorizontal className="size-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => onEdit(r)}>
                      <Pencil className="size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onView(r)}>
                      <Eye className="size-4" />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onShare(r)}>
                      <Share2 className="size-4" />
                      Share with patient
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(r)}
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function MedicationsSection({ medications, onChange }) {
  function update(idx, patch) {
    onChange(medications.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  }
  function remove(idx) {
    if (medications.length <= 1) {
      onChange([emptyMedication()]);
      return;
    }
    onChange(medications.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...medications, emptyMedication()]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-md bg-[color:var(--status-completed-bg)] text-[color:var(--status-completed)]">
          <Pill className="size-4" />
        </div>
        <div>
          <h4 className="text-sm font-semibold">Medications</h4>
          <p className="text-xs text-muted-foreground">
            Add one or more medications for this prescription.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {medications.map((med, idx) => (
          <div
            key={idx}
            className="space-y-3 rounded-md border bg-muted/30 p-3.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full border bg-background text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {idx + 1}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Drug Details
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(idx)}
                aria-label={`Remove medication ${idx + 1}`}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`med-name-${idx}`}>Medication Name *</Label>
              <Input
                id={`med-name-${idx}`}
                required
                value={med.name}
                onChange={(e) => update(idx, { name: e.target.value })}
                placeholder="e.g. Melatonin"
                className="bg-background"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`med-dosage-${idx}`}>Dosage</Label>
                <Input
                  id={`med-dosage-${idx}`}
                  value={med.dosage}
                  onChange={(e) => update(idx, { dosage: e.target.value })}
                  placeholder="e.g. 3mg"
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`med-duration-${idx}`}>Duration</Label>
                {(() => {
                  const { count, unit } = parseDuration(med.duration);
                  return (
                    <div className="flex gap-2">
                      <Input
                        id={`med-duration-${idx}`}
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={count}
                        onChange={(e) =>
                          update(idx, {
                            duration: joinDuration(e.target.value, unit),
                          })
                        }
                        placeholder="e.g. 30"
                        className="bg-background"
                      />
                      <Select
                        value={unit}
                        onValueChange={(v) =>
                          update(idx, { duration: joinDuration(count, v) })
                        }
                      >
                        <SelectTrigger
                          className="w-[110px] shrink-0 bg-background"
                          aria-label="Duration unit"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DURATION_UNITS.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`med-freq-${idx}`}>Frequency</Label>
              <Select
                value={med.frequency || undefined}
                onValueChange={(v) => update(idx, { frequency: v })}
              >
                <SelectTrigger id={`med-freq-${idx}`} className="bg-background">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`med-instr-${idx}`}>Instructions</Label>
              <Textarea
                id={`med-instr-${idx}`}
                rows={2}
                value={med.instructions}
                onChange={(e) => update(idx, { instructions: e.target.value })}
                placeholder="e.g. Take 30 min before sleep"
                className="bg-background"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
      >
        <Plus className="size-4" />
        Add Another Medication
      </button>
    </div>
  );
}
