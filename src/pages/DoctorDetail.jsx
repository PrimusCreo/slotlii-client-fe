import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  CalendarCheck,
  Clock,
  FileText,
  Loader2,
  Mail,
  Phone,
  Trash2,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import Layout from '../components/Layout/Layout';
import * as api from '../api';
import DoctorCalendarPanel from '../components/doctor/DoctorCalendarPanel';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/common/status-badge';

const WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

function emptyAvailability() {
  return WEEK.reduce((acc, { key }) => {
    acc[key] = { enabled: false, start: '09:00', end: '17:00' };
    return acc;
  }, {});
}

function toTimeInput(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return '09:00';
  const m = hhmm.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '09:00';
  const h = String(Math.min(23, parseInt(m[1], 10))).padStart(2, '0');
  const min = String(Math.min(59, parseInt(m[2], 10))).padStart(2, '0');
  return `${h}:${min}`;
}

function fromTimeInput(v) {
  if (!v) return '09:00';
  return v.length >= 5 ? v.slice(0, 5) : v;
}

export default function DoctorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAvail, setSavingAvail] = useState(false);

  const [profile, setProfile] = useState({
    name: '',
    specialization: '',
    email: '',
    phone: '',
    notes: '',
    isActive: true,
  });

  const [availability, setAvailability] = useState(emptyAvailability);
  const [doctorAppts, setDoctorAppts] = useState([]);
  const [apptsLoading, setApptsLoading] = useState(false);

  useEffect(() => {
    loadDoctor();
  }, [id]);

  useEffect(() => {
    if (!id || (activeTab !== 'appointments' && activeTab !== 'calendar')) return undefined;
    let cancelled = false;
    (async () => {
      setApptsLoading(true);
      try {
        const res = await api.getDoctorAppointments(id);
        if (!cancelled) setDoctorAppts(res.data.data || []);
      } catch {
        if (!cancelled) setDoctorAppts([]);
      } finally {
        if (!cancelled) setApptsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, activeTab]);

  async function loadDoctor() {
    setLoading(true);
    try {
      const res = await api.getDoctor(id);
      const d = res.data.data;
      setDoctor(d);
      setProfile({
        name: d.name || '',
        specialization: d.specialization || '',
        email: d.email || '',
        phone: d.phone || '',
        notes: d.notes || '',
        isActive: d.isActive !== false,
      });
      const next = emptyAvailability();
      if (d.availability && typeof d.availability === 'object') {
        for (const { key } of WEEK) {
          const slot = d.availability[key];
          if (slot && typeof slot === 'object') {
            next[key] = {
              enabled: !!slot.enabled,
              start: slot.start || '09:00',
              end: slot.end || '17:00',
            };
          }
        }
      }
      setAvailability(next);
    } catch {
      setDoctor(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await api.updateDoctor(id, profile);
      setDoctor(res.data.data);
      toast.success('Profile saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveAvailability(e) {
    e.preventDefault();
    setSavingAvail(true);
    try {
      const res = await api.updateDoctor(id, { availability });
      setDoctor(res.data.data);
      toast.success('Availability saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSavingAvail(false);
    }
  }

  async function handleDelete() {
    if (
      !doctor ||
      !window.confirm(
        `Remove ${doctor.name} from this clinic? This cannot be undone.`,
      )
    )
      return;
    try {
      await api.deleteDoctor(id);
      toast.success('Doctor removed');
      setTimeout(() => navigate('/doctors'), 400);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  }

  function updateDay(key, patch) {
    setAvailability((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  if (loading) {
    return (
      <Layout title="Doctor">
        <div className="space-y-4">
          <Skeleton className="h-12 w-1/3" />
          <Skeleton className="h-72 w-full" />
        </div>
      </Layout>
    );
  }

  if (!doctor) {
    return (
      <Layout title="Doctor">
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Doctor not found
          </CardContent>
        </Card>
      </Layout>
    );
  }

  const clinicName = doctor.clinicId?.name || 'Clinic';

  return (
    <Layout title={doctor.name}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* <Button variant="ghost" size="icon" onClick={() => navigate('/doctors')}>
            <ArrowLeft className="size-5" />
          </Button> */}
          <Avatar className="size-14">
            <AvatarFallback className="bg-primary/15 text-primary text-lg font-semibold">
              {doctor.name?.charAt(0)?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{doctor.name}</h1>
            <p className="text-sm text-muted-foreground">
              {doctor.specialization || 'Doctor'} · {clinicName}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleDelete} className="text-destructive hover:text-destructive">
          <Trash2 className="size-4" /> Remove doctor
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="profile">
            <User className="size-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="availability">
            <Clock className="size-4" /> Availability
          </TabsTrigger>
          <TabsTrigger value="appointments">
            <CalendarCheck className="size-4" /> Appointments
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarIcon className="size-4" /> Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Doctor information</CardTitle>
              <CardDescription>Edit profile and contact details.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="dp-name">Full name *</Label>
                    <Input
                      id="dp-name"
                      required
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dp-spec">Specialization</Label>
                    <Input
                      id="dp-spec"
                      value={profile.specialization}
                      onChange={(e) =>
                        setProfile({ ...profile, specialization: e.target.value })
                      }
                      placeholder="e.g. Orthodontics"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dp-phone" className="flex items-center gap-1.5">
                      <Phone className="size-3.5" /> Phone
                    </Label>
                    <Input
                      id="dp-phone"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dp-email" className="flex items-center gap-1.5">
                      <Mail className="size-3.5" /> Email
                    </Label>
                    <Input
                      id="dp-email"
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dp-notes" className="flex items-center gap-1.5">
                    <FileText className="size-3.5" /> Internal notes
                  </Label>
                  <Textarea
                    id="dp-notes"
                    rows={3}
                    value={profile.notes}
                    onChange={(e) => setProfile({ ...profile, notes: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="dp-active"
                    checked={profile.isActive}
                    onCheckedChange={(v) => setProfile({ ...profile, isActive: !!v })}
                  />
                  <Label htmlFor="dp-active" className="cursor-pointer">
                    Active (listed as available)
                  </Label>
                </div>
                <Button type="submit" disabled={savingProfile}>
                  {savingProfile ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Saving…
                    </>
                  ) : (
                    'Save profile'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="availability" className="mt-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Weekly availability</CardTitle>
              <CardDescription>
                Set which days this doctor sees patients and their hours (24h, HH:MM).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <form onSubmit={handleSaveAvailability}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px]">Day</TableHead>
                      <TableHead className="w-[120px]">Working</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {WEEK.map(({ key, label }) => (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{label}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`av-${key}`}
                              checked={availability[key].enabled}
                              onCheckedChange={(v) =>
                                updateDay(key, { enabled: !!v })
                              }
                            />
                            <Label
                              htmlFor={`av-${key}`}
                              className="cursor-pointer text-xs"
                            >
                              Yes
                            </Label>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="time"
                            value={toTimeInput(availability[key].start)}
                            onChange={(e) =>
                              updateDay(key, { start: fromTimeInput(e.target.value) })
                            }
                            disabled={!availability[key].enabled}
                            className="max-w-[140px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="time"
                            value={toTimeInput(availability[key].end)}
                            onChange={(e) =>
                              updateDay(key, { end: fromTimeInput(e.target.value) })
                            }
                            disabled={!availability[key].enabled}
                            className="max-w-[140px]"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="px-6 pt-4">
                  <Button type="submit" disabled={savingAvail}>
                    {savingAvail ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Saving…
                      </>
                    ) : (
                      'Save availability'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-end justify-between border-b">
              <div>
                <CardTitle>Appointments</CardTitle>
                <CardDescription>
                  Bookings assigned to this doctor.
                </CardDescription>
              </div>
              <Button asChild size="sm">
                <Link to={`/appointments/new?doctorId=${id}`}>New booking</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {apptsLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : doctorAppts.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <CalendarCheck className="size-5" />
                  </div>
                  <p className="text-sm font-medium">
                    No appointments for this doctor yet
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doctorAppts.map((apt) => (
                      <TableRow key={apt._id}>
                        <TableCell className="font-medium tabular-nums">
                          {apt.date}
                        </TableCell>
                        <TableCell className="tabular-nums">{apt.time}</TableCell>
                        <TableCell>
                          {apt.patientId?._id ? (
                            <Link
                              to={`/patients/${apt.patientId._id}`}
                              className="text-primary hover:underline"
                            >
                              {apt.patientId.name}
                            </Link>
                          ) : (
                            apt.patientId?.name || '—'
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {apt.issue || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <StatusBadge status={apt.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <DoctorCalendarPanel appointments={doctorAppts} loading={apptsLoading} />
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
