import { Link } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  ChevronRight,
  CircleDot,
  ClipboardList,
  FileText,
  Hash,
  Phone,
  Stethoscope,
  User,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/common/status-badge';

function resolvePatientId(patientId) {
  if (patientId == null) return null;
  if (typeof patientId === 'string') return patientId;
  return patientId._id ?? null;
}

function formatTime12h(timeStr) {
  if (!timeStr) return '';
  const [hStr, mStr] = String(timeStr).split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  const hr12 = ((h + 11) % 12) + 1;
  return `${hr12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatHeaderDateTime(dateStr, timeStr) {
  if (!dateStr) return formatTime12h(timeStr);
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) {
    const t = formatTime12h(timeStr);
    return t ? `${dateStr} • ${t}` : dateStr;
  }
  const dateLabel = new Date(y, m - 1, d).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeLabel = formatTime12h(timeStr);
  return timeLabel ? `${dateLabel} • ${timeLabel}` : dateLabel;
}

function DetailRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <span className="flex-1 text-sm">{children}</span>
    </div>
  );
}

export function AppointmentDetailsDialog({ appointment, onClose }) {
  const open = !!appointment;
  const patientId = appointment ? resolvePatientId(appointment.patientId) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="text-base font-semibold">
            Appointment details
          </DialogTitle>
        </DialogHeader>

        {appointment ? (
          <div className="px-5 pb-2 pt-4">
            <div className="flex items-center gap-2 pb-2 text-sm font-medium">
              <span className="flex size-7 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
                <CalendarIcon className="size-3.5" />
              </span>
              <span className="tabular-nums">
                {formatHeaderDateTime(appointment.date, appointment.time)}
              </span>
            </div>

            <div className="divide-y">
              {appointment.tokenNumber ? (
                <DetailRow icon={Hash} label="Token">
                  <span className="inline-flex items-center rounded-md border bg-muted/50 px-2 py-0.5 text-xs font-semibold tabular-nums">
                    #{appointment.tokenNumber}
                  </span>
                </DetailRow>
              ) : null}
              <DetailRow icon={User} label="Patient">
                <span className="font-medium">
                  {appointment.patientId?.name || '—'}
                </span>
              </DetailRow>
              {appointment.patientId?.phone ? (
                <DetailRow icon={Phone} label="Phone">
                  <span className="tabular-nums">
                    {appointment.patientId.phone}
                  </span>
                </DetailRow>
              ) : null}
              {appointment.doctorId?.name ? (
                <DetailRow icon={Stethoscope} label="Doctor">
                  {appointment.doctorId.name}
                </DetailRow>
              ) : null}
              <DetailRow icon={CircleDot} label="Status">
                <StatusBadge status={appointment.status} />
              </DetailRow>
              {appointment.issue ? (
                <DetailRow icon={FileText} label="Issue">
                  {appointment.issue}
                </DetailRow>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="border-t bg-muted/20 px-5 py-3">
          {patientId ? (
            <Button asChild variant="soft" className="w-full">
              <Link to={`/patients/${patientId}`} onClick={() => onClose?.()}>
                <ClipboardList className="size-4" />
                View patient
                <ChevronRight className="ml-auto size-4" />
              </Link>
            </Button>
          ) : (
            <span className="block text-center text-xs text-muted-foreground">
              Patient record unavailable
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
