import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

export default function DoctorCalendarPanel({ appointments = [], loading }) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [statusFilter, setStatusFilter] = useState('all');
  const [popup, setPopup] = useState(null);

  const visibleRange = useMemo(() => {
    const y = currentDate.getFullYear();
    const mo = currentDate.getMonth();
    const first = `${y}-${pad2(mo + 1)}-01`;
    const lastDay = new Date(y, mo + 1, 0).getDate();
    const last = `${y}-${pad2(mo + 1)}-${pad2(lastDay)}`;
    return { start: first, end: last };
  }, [currentDate]);

  const popupPatientId = popup ? resolvePatientId(popup.patientId) : null;

  const monthAppointments = useMemo(() => {
    const { start, end } = visibleRange;
    return sortAppointments(
      appointments.filter((a) => {
        if (a.date < start || a.date > end) return false;
        if (statusFilter !== 'all' && a.status !== statusFilter) return false;
        return true;
      }),
    );
  }, [appointments, visibleRange, statusFilter]);

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

  const appointmentsByDate = useMemo(() => {
    const map = {};
    monthAppointments.forEach((apt) => {
      if (!map[apt.date]) map[apt.date] = [];
      map[apt.date].push(apt);
    });
    Object.keys(map).forEach((k) => {
      map[k] = sortAppointments(map[k]);
    });
    return map;
  }, [monthAppointments]);

  const today = toDateStr(new Date());
  const headerTitle = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  function navigatePrev() {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }
  function navigateNext() {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }
  function goToday() {
    const n = new Date();
    setCurrentDate(new Date(n.getFullYear(), n.getMonth(), 1));
  }
  function openDayViewForDate(dateStr) {
    setCurrentDate(parseDateStr(dateStr));
  }

  function renderPill(apt) {
    return (
      <button
        type="button"
        key={apt._id}
        className={cn(
          'block w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px] font-medium transition-opacity hover:opacity-80',
          pillClass(apt.status),
        )}
        title={`${apt.time} — ${apt.patientId?.name || 'Patient'}`}
        onClick={(e) => {
          e.stopPropagation();
          setPopup(apt);
        }}
      >
        <span className="tabular-nums">{apt.time}</span>{' '}
        <span className="opacity-80">{apt.patientId?.name || ''}</span>
      </button>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <h3 className="text-sm font-semibold tracking-tight">{headerTitle}</h3>
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

        <div className="grid grid-cols-7">
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
                className={cn(
                  'min-h-[90px] cursor-pointer border-b border-r p-1.5 transition-colors last:border-r-0',
                  '[&:nth-child(7n)]:border-r-0',
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
                  {dayAppts.slice(0, 3).map((apt) => renderPill(apt))}
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

        {loading ? (
          <div className="border-t px-4 py-2 text-center text-xs text-muted-foreground">
            Loading…
          </div>
        ) : null}
      </Card>

      <Dialog open={!!popup} onOpenChange={(o) => !o && setPopup(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Appointment</DialogTitle>
            {popup ? (
              <DialogDescription className="tabular-nums">
                {popup.time} · {popup.date}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          {popup ? (
            <div className="grid grid-cols-[88px_1fr] gap-y-2 text-sm">
              <span className="text-muted-foreground">Patient</span>
              <span className="font-medium">{popup.patientId?.name || '—'}</span>
              <span className="text-muted-foreground">Status</span>
              <span>
                <StatusBadge status={popup.status} />
              </span>
              {popup.issue ? (
                <>
                  <span className="text-muted-foreground">Issue</span>
                  <span>{popup.issue}</span>
                </>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="sm:justify-between">
            {popupPatientId ? (
              <Button asChild variant="outline">
                <Link to={`/patients/${popupPatientId}`} onClick={() => setPopup(null)}>
                  View patient <ChevronRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                Patient record unavailable
              </span>
            )}
            <Button onClick={() => setPopup(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
