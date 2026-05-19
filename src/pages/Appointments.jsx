import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import Layout from '../components/Layout/Layout';
import { useClinic } from '../context/ClinicContext';
import * as api from '../api';
import { cn } from '@/lib/utils';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/common/status-badge';

export default function Appointments() {
  const { selectedClinicId } = useClinic();
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    date: '',
    status: 'all',
    doctorId: 'all',
    sortBy: 'date_desc',
    search: '',
    limit: 10,
    page: 1,
  });
  const [searchInput, setSearchInput] = useState('');
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [rescheduleModal, setRescheduleModal] = useState({
    open: false,
    appointment: null,
  });
  const [rescheduleForm, setRescheduleForm] = useState({
    date: '',
    time: '',
    slots: [],
    loading: false,
  });

  useEffect(() => {
    if (selectedClinicId) loadAppointments();
  }, [selectedClinicId, filters]);

  useEffect(() => {
    if (!selectedClinicId) {
      setDoctors([]);
      return;
    }
    loadDoctors();
  }, [selectedClinicId]);

  // Debounce the search input so we don't fire a request on every keystroke.
  useEffect(() => {
    if (searchInput === filters.search) return;
    const timeoutId = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }));
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchInput, filters.search]);

  async function loadAppointments() {
    setLoading(true);
    try {
      const params = {
        clinicId: selectedClinicId,
        limit: filters.limit,
        page: filters.page,
      };
      if (filters.date) params.date = filters.date;
      if (filters.status && filters.status !== 'all') params.status = filters.status;
      if (filters.doctorId && filters.doctorId !== 'all') {
        params.doctorId = filters.doctorId;
      }
      if (filters.sortBy) params.sort = filters.sortBy;
      if (filters.search) params.search = filters.search;

      const res = await api.getAppointments(params);
      setAppointments(res.data.data || []);
      setPagination(res.data.pagination || { total: 0, pages: 1 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadDoctors() {
    try {
      const res = await api.getDoctors({
        clinicId: selectedClinicId,
        limit: 200,
        isActive: 'true',
      });
      setDoctors(res.data.data || []);
    } catch (err) {
      console.error(err);
      setDoctors([]);
    }
  }

  async function handleAction(id, action) {
    try {
      if (action === 'cancel') {
        await api.cancelAppointment(id);
        toast.success('Appointment cancelled');
      } else {
        await api.updateAppointmentStatus(id, action);
        toast.success(`Marked as ${action.toLowerCase()}`);
      }
      loadAppointments();
    } catch {
      toast.error('Action failed');
    }
  }

  async function openReschedule(appointment) {
    setRescheduleModal({ open: true, appointment });
    setRescheduleForm({
      date: appointment.date,
      time: '',
      slots: [],
      loading: false,
    });
    await loadRescheduleSlots(appointment, appointment.date);
  }

  async function loadRescheduleSlots(appointment, date) {
    setRescheduleForm((prev) => ({ ...prev, date, time: '', loading: true }));
    try {
      const doctorRaw = appointment.doctorId;
      const doctorId =
        doctorRaw && typeof doctorRaw === 'object' ? doctorRaw._id : doctorRaw;

      const res = await api.getAvailableSlots({
        clinicId: selectedClinicId,
        date,
        excludeAppointmentId: appointment._id,
        ...(doctorId ? { doctorId } : {}),
      });
      setRescheduleForm((prev) => ({
        ...prev,
        slots: res.data.data || [],
        loading: false,
      }));
    } catch {
      setRescheduleForm((prev) => ({ ...prev, slots: [], loading: false }));
      toast.error('Failed to load slots');
    }
  }

  async function handleRescheduleSubmit() {
    if (!rescheduleModal.appointment || !rescheduleForm.date || !rescheduleForm.time) {
      toast.error('Choose a new date and time');
      return;
    }

    try {
      await api.rescheduleAppointment(rescheduleModal.appointment._id, {
        date: rescheduleForm.date,
        time: rescheduleForm.time,
      });
      setRescheduleModal({ open: false, appointment: null });
      toast.success('Appointment rescheduled');
      loadAppointments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reschedule failed');
    }
  }

  const hasFilters =
    filters.date ||
    (filters.status && filters.status !== 'all') ||
    (filters.doctorId && filters.doctorId !== 'all') ||
    !!filters.search;

  return (
    <Layout title="Appointments">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by patient, phone, or issue"
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
        <Button asChild className="ml-auto">
          <Link to="/appointments/new">
            <Plus className="size-4" />
            New appointment
          </Link>
        </Button>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium text-muted-foreground">Date</Label>
            <Input
              type="date"
              value={filters.date}
              onChange={(e) =>
                setFilters({ ...filters, date: e.target.value, page: 1 })
              }
              className="h-9 w-[160px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium text-muted-foreground">Status</Label>
            <Select
              value={filters.status}
              onValueChange={(v) => setFilters({ ...filters, status: v, page: 1 })}
            >
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="BOOKED">Booked</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="NO_SHOW">No show</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium text-muted-foreground">Doctor</Label>
            <Select
              value={filters.doctorId}
              onValueChange={(v) =>
                setFilters({ ...filters, doctorId: v, page: 1 })
              }
            >
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue placeholder="All doctors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All doctors</SelectItem>
                {doctors.map((doc) => (
                  <SelectItem key={doc._id} value={doc._id}>
                    {doc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchInput('');
                setFilters((prev) => ({
                  ...prev,
                  date: '',
                  status: 'all',
                  doctorId: 'all',
                  sortBy: 'date_desc',
                  search: '',
                  page: 1,
                }));
              }}
            >
              <X className="size-3.5" /> Clear
            </Button>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <Label className="text-xs font-medium text-muted-foreground">Sort by</Label>
            <Select
              value={filters.sortBy}
              onValueChange={(v) =>
                setFilters({ ...filters, sortBy: v, page: 1 })
              }
            >
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Date (newest first)</SelectItem>
                <SelectItem value="date_asc">Date (oldest first)</SelectItem>
                <SelectItem value="name_asc">Name (A → Z)</SelectItem>
                <SelectItem value="name_desc">Name (Z → A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <CalendarX className="size-5" />
              </div>
              <p className="text-sm font-medium">No appointments found</p>
              <p className="text-xs text-muted-foreground">
                Try clearing the filters or booking a new appointment.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((apt) => (
                  <TableRow key={apt._id}>
                    <TableCell className="font-medium">
                      {apt.patientId?.name || 'N/A'}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {apt.patientId?.phone || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {apt.doctorId?.name || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {apt.date}
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">{apt.time}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">
                      {apt.issue || '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={apt.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {apt.status === 'BOOKED' ? (
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="soft"
                            onClick={() => handleAction(apt._id, 'COMPLETED')}
                          >
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openReschedule(apt)}
                          >
                            Reschedule
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(apt._id, 'NO_SHOW')}
                          >
                            No show
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleAction(apt._id, 'cancel')}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {!loading ? (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {appointments.length} of {pagination.total} row(s).
            </span>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Rows per page
                </Label>
                <Select
                  value={String(filters.limit)}
                  onValueChange={(v) =>
                    setFilters({ ...filters, limit: Number(v), page: 1 })
                  }
                >
                  <SelectTrigger className="h-9 w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 15, 20, 30, 50].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-sm font-medium tabular-nums">
                Page {filters.page} of {Math.max(pagination.pages, 1)}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={filters.page <= 1}
                  onClick={() => setFilters({ ...filters, page: 1 })}
                  aria-label="First page"
                >
                  <ChevronsLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={filters.page <= 1}
                  onClick={() =>
                    setFilters({ ...filters, page: filters.page - 1 })
                  }
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={filters.page >= pagination.pages}
                  onClick={() =>
                    setFilters({ ...filters, page: filters.page + 1 })
                  }
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={filters.page >= pagination.pages}
                  onClick={() =>
                    setFilters({ ...filters, page: pagination.pages })
                  }
                  aria-label="Last page"
                >
                  <ChevronsRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      <Dialog
        open={rescheduleModal.open}
        onOpenChange={(open) =>
          setRescheduleModal(open ? rescheduleModal : { open: false, appointment: null })
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule appointment</DialogTitle>
            <DialogDescription>
              Pick a new date and time. Old slot is freed automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resch-date">New date</Label>
              <Input
                id="resch-date"
                type="date"
                value={rescheduleForm.date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) =>
                  loadRescheduleSlots(rescheduleModal.appointment, e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label>New time</Label>
              {rescheduleForm.loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : rescheduleForm.slots.length === 0 ? (
                <div className="rounded-md border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
                  No available slots for this date
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {rescheduleForm.slots.map((slot) => {
                    const selected = rescheduleForm.time === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() =>
                          setRescheduleForm((prev) => ({ ...prev, time: slot }))
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
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setRescheduleModal({ open: false, appointment: null })
              }
            >
              Cancel
            </Button>
            <Button onClick={handleRescheduleSubmit}>Save reschedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
