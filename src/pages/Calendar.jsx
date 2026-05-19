import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import Layout from '../components/Layout/Layout';
import { useClinic } from '../context/ClinicContext';
import * as api from '../api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { StatusBadge } from '@/components/common/status-badge';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseDateStr(iso) {
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function getVisibleRange(viewMode, d) {
  const y = d.getFullYear();
  const mo = d.getMonth();
  const day = d.getDate();
  if (viewMode === 'day') {
    const ds = toDateStr(d);
    return { start: ds, end: ds };
  }
  if (viewMode === 'week') {
    const dow = d.getDay();
    const start = new Date(y, mo, day - dow);
    const end = new Date(y, mo, day + (6 - dow));
    return { start: toDateStr(start), end: toDateStr(end) };
  }
  const first = `${y}-${pad2(mo + 1)}-01`;
  const lastDay = new Date(y, mo + 1, 0).getDate();
  const last = `${y}-${pad2(mo + 1)}-${pad2(lastDay)}`;
  return { start: first, end: last };
}

function formatHeaderTitle(viewMode, d) {
  if (viewMode === 'month') {
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  if (viewMode === 'day') {
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }
  const { start, end } = getVisibleRange('week', d);
  const a = parseDateStr(start);
  const b = parseDateStr(end);
  const opts = { month: 'short', day: 'numeric' };
  const yOpts = { ...opts, year: 'numeric' };
  if (a.getFullYear() === b.getFullYear()) {
    return `${a.toLocaleDateString('en-US', opts)} — ${b.toLocaleDateString('en-US', yOpts)}`;
  }
  return `${a.toLocaleDateString('en-US', yOpts)} — ${b.toLocaleDateString('en-US', yOpts)}`;
}

function sortAppointments(list) {
  return [...list].sort((x, y) => {
    if (x.date !== y.date) return x.date.localeCompare(y.date);
    return (x.time || '').localeCompare(y.time || '');
  });
}

function resolvePatientId(patientId) {
  if (patientId == null) return null;
  if (typeof patientId === 'string') return patientId;
  return patientId._id ?? null;
}

function startOfWeekContaining(d) {
  const dow = d.getDay();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
}

const PILL_COLORS = {
  booked: 'bg-[color:var(--status-booked-bg)] text-[color:var(--status-booked)] border-[color:var(--status-booked)]/30',
  completed:
    'bg-[color:var(--status-completed-bg)] text-[color:var(--status-completed)] border-[color:var(--status-completed)]/30',
  cancelled:
    'bg-[color:var(--status-cancelled-bg)] text-[color:var(--status-cancelled)] border-[color:var(--status-cancelled)]/30',
  no_show:
    'bg-[color:var(--status-noshow-bg)] text-[color:var(--status-noshow)] border-[color:var(--status-noshow)]/30',
};

function pillClass(status) {
  return PILL_COLORS[status?.toLowerCase()] || 'bg-muted text-muted-foreground border-border';
}

export default function CalendarPage() {
  const { selectedClinicId } = useClinic();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState('month');
  const [statusFilter, setStatusFilter] = useState('all');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [appointmentPopup, setAppointmentPopup] = useState(null);

  const visibleRange = useMemo(
    () => getVisibleRange(viewMode, currentDate),
    [viewMode, currentDate],
  );

  const popupPatientId = appointmentPopup
    ? resolvePatientId(appointmentPopup.patientId)
    : null;

  useEffect(() => {
    if (selectedClinicId) loadAppointmentsForRange();
  }, [selectedClinicId, visibleRange.start, visibleRange.end, statusFilter]);

  async function loadAppointmentsForRange() {
    setLoading(true);
    try {
      const params = {
        clinicId: selectedClinicId,
        limit: 500,
      };
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      const res = await api.getAppointments(params);
      const all = res.data.data || [];
      const { start, end } = visibleRange;
      const filtered = all.filter((a) => a.date >= start && a.date <= end);
      setAppointments(sortAppointments(filtered));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const monthGrid = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const firstDayOfMonth = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysInPrevMonth = new Date(y, m, 0).getDate();
    const days = [];
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, isOtherMonth: true, date: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${pad2(m + 1)}-${pad2(d)}`;
      days.push({ day: d, isOtherMonth: false, date: dateStr });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, isOtherMonth: true, date: null });
    }
    return days;
  }, [currentDate]);

  const weekCells = useMemo(() => {
    const start = startOfWeekContaining(currentDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return {
        date: toDateStr(d),
        day: d.getDate(),
        monthLabel: d.toLocaleDateString('en-US', { month: 'short' }),
        isToday: toDateStr(d) === toDateStr(new Date()),
      };
    });
  }, [currentDate]);

  const appointmentsByDate = useMemo(() => {
    const map = {};
    appointments.forEach((apt) => {
      if (!map[apt.date]) map[apt.date] = [];
      map[apt.date].push(apt);
    });
    Object.keys(map).forEach((k) => {
      map[k] = sortAppointments(map[k]);
    });
    return map;
  }, [appointments]);

  const today = toDateStr(new Date());
  const headerTitle = formatHeaderTitle(viewMode, currentDate);

  function navigatePrev() {
    setCurrentDate((prev) => {
      const y = prev.getFullYear();
      const m = prev.getMonth();
      const day = prev.getDate();
      if (viewMode === 'month') return new Date(y, m - 1, 1);
      if (viewMode === 'week') return new Date(y, m, day - 7);
      return new Date(y, m, day - 1);
    });
  }

  function navigateNext() {
    setCurrentDate((prev) => {
      const y = prev.getFullYear();
      const m = prev.getMonth();
      const day = prev.getDate();
      if (viewMode === 'month') return new Date(y, m + 1, 1);
      if (viewMode === 'week') return new Date(y, m, day + 7);
      return new Date(y, m, day + 1);
    });
  }

  function goToday() {
    const n = new Date();
    setCurrentDate(
      viewMode === 'month' ? new Date(n.getFullYear(), n.getMonth(), 1) : n,
    );
  }

  function openDayViewForDate(dateStr) {
    setCurrentDate(parseDateStr(dateStr));
    setViewMode('day');
  }

  function selectView(mode) {
    setViewMode(mode);
    if (mode === 'month') {
      setCurrentDate(
        new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
      );
    }
  }

  function renderAppointmentPill(apt) {
    return (
      <button
        type="button"
        key={apt._id}
        className={cn(
          'block w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px] font-medium transition-opacity hover:opacity-80',
          pillClass(apt.status),
        )}
        title={`${apt.time} — ${apt.patientId?.name || 'Patient'}${apt.doctorId?.name ? ` · ${apt.doctorId.name}` : ''} (${apt.status})`}
        onClick={(e) => {
          e.stopPropagation();
          setAppointmentPopup(apt);
        }}
      >
        <span className="tabular-nums">{apt.time}</span>{' '}
        <span className="opacity-80">{apt.patientId?.name || ''}</span>
      </button>
    );
  }

  return (
    <Layout title="Calendar">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Monthly, weekly and daily views of all bookings.
          </p>
        </div>
        <Select value={viewMode} onValueChange={selectView}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Day view</SelectItem>
            <SelectItem value="week">Week view</SelectItem>
            <SelectItem value="month">Month view</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <h3 className="text-base font-semibold tracking-tight">{headerTitle}</h3>
          <div className="flex items-center gap-1.5">
            <div className="mr-1 flex items-center gap-2">
              <Label className="text-xs font-medium text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
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
            <Button variant="outline" size="sm" onClick={goToday}>
              Today
            </Button>
            <Button variant="outline" size="icon-sm" onClick={navigatePrev}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={navigateNext}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {viewMode === 'month' ? (
          <div className="grid grid-cols-7 border-t-0">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="border-b border-r px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground last:border-r-0"
              >
                {day}
              </div>
            ))}
            {monthGrid.map((cell, idx) => {
              const dayAppts = cell.date ? appointmentsByDate[cell.date] || [] : [];
              const isTodayCell = cell.date === today;
              const isClickable = cell.date && !cell.isOtherMonth;
              return (
                <div
                  key={idx}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onClick={() => isClickable && openDayViewForDate(cell.date)}
                  onKeyDown={(e) => {
                    if (!isClickable) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openDayViewForDate(cell.date);
                    }
                  }}
                  className={cn(
                    'min-h-[100px] cursor-pointer border-b border-r p-1.5 transition-colors last:border-r-0 sm:min-h-[110px]',
                    '[&:nth-child(7n+1)]:border-l-0 [&:nth-child(7n)]:border-r-0',
                    cell.isOtherMonth && 'bg-muted/20 opacity-50',
                    isClickable && 'hover:bg-accent/40',
                    isTodayCell && 'bg-primary/5',
                  )}
                >
                  <div
                    className={cn(
                      'mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                      isTodayCell
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    {cell.day}
                  </div>
                  <div className="space-y-1">
                    {dayAppts.slice(0, 3).map((apt) => renderAppointmentPill(apt))}
                    {dayAppts.length > 3 ? (
                      <div className="px-1 text-[10px] font-medium text-muted-foreground">
                        +{dayAppts.length - 3} more
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {viewMode === 'week' ? (
          <div className="grid grid-cols-7">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="border-b border-r px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground last:border-r-0"
              >
                {day}
              </div>
            ))}
            {weekCells.map((cell) => {
              const dayAppts = appointmentsByDate[cell.date] || [];
              return (
                <div
                  key={cell.date}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDayViewForDate(cell.date)}
                  className={cn(
                    'min-h-[160px] cursor-pointer border-b border-r p-2 transition-colors last:border-r-0',
                    cell.isToday && 'bg-primary/5',
                    'hover:bg-accent/40',
                  )}
                >
                  <div
                    className={cn(
                      'mb-1.5 text-xs font-semibold',
                      cell.isToday ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {cell.monthLabel} {cell.day}
                  </div>
                  <div className="space-y-1">
                    {dayAppts.map((apt) => renderAppointmentPill(apt))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {viewMode === 'day' ? (
          <CardContent className="py-6">
            {appointments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No appointments on this date.
              </p>
            ) : (
              <ul className="space-y-2">
                {appointments.map((apt) => (
                  <li key={apt._id}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors hover:bg-accent/40',
                      )}
                      onClick={() => setAppointmentPopup(apt)}
                    >
                      <span className="w-16 shrink-0 text-sm font-bold tabular-nums">
                        {apt.time}
                      </span>
                      <span className="flex-1 truncate text-sm">
                        {apt.patientId?.name || 'Patient'}
                      </span>
                      <StatusBadge status={apt.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        ) : null}

        {loading ? (
          <div className="border-t px-4 py-2 text-center text-xs text-muted-foreground">
            Loading appointments…
          </div>
        ) : null}
      </Card>

      <Dialog
        open={!!appointmentPopup}
        onOpenChange={(o) => !o && setAppointmentPopup(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Appointment</DialogTitle>
            {appointmentPopup ? (
              <DialogDescription className="tabular-nums">
                {appointmentPopup.time} · {appointmentPopup.date}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          {appointmentPopup ? (
            <div className="grid grid-cols-[88px_1fr] gap-y-2 text-sm">
              <span className="text-muted-foreground">Patient</span>
              <span className="font-medium">{appointmentPopup.patientId?.name || '—'}</span>
              {appointmentPopup.doctorId?.name ? (
                <>
                  <span className="text-muted-foreground">Doctor</span>
                  <span>{appointmentPopup.doctorId.name}</span>
                </>
              ) : null}
              <span className="text-muted-foreground">Status</span>
              <span>
                <StatusBadge status={appointmentPopup.status} />
              </span>
              {appointmentPopup.issue ? (
                <>
                  <span className="text-muted-foreground">Notes</span>
                  <span>{appointmentPopup.issue}</span>
                </>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="sm:justify-between">
            {popupPatientId ? (
              <Button asChild variant="outline">
                <Link
                  to={`/patients/${popupPatientId}`}
                  onClick={() => setAppointmentPopup(null)}
                >
                  View patient <ChevronRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                Patient record unavailable
              </span>
            )}
            <Button onClick={() => setAppointmentPopup(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
