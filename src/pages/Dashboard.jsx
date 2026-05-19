import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  Clock,
  Gift,
  Pill,
  Plus,
  Stethoscope,
  TrendingUp,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';

import Layout from '../components/Layout/Layout';
import { useClinic } from '../context/ClinicContext';
import * as api from '../api';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/common/status-badge';

// ── Theme tokens for status colors (kept consistent with the rest of the app)
const STATUS_TOKENS = {
  BOOKED: {
    text: 'text-[color:var(--status-booked)]',
    bg: 'bg-[color:var(--status-booked-bg)]',
    fill: 'var(--status-booked)',
    label: 'Booked',
  },
  COMPLETED: {
    text: 'text-[color:var(--status-completed)]',
    bg: 'bg-[color:var(--status-completed-bg)]',
    fill: 'var(--status-completed)',
    label: 'Completed',
  },
  CANCELLED: {
    text: 'text-[color:var(--status-cancelled)]',
    bg: 'bg-[color:var(--status-cancelled-bg)]',
    fill: 'var(--status-cancelled)',
    label: 'Cancelled',
  },
  NO_SHOW: {
    text: 'text-[color:var(--status-noshow)]',
    bg: 'bg-[color:var(--status-noshow-bg)]',
    fill: 'var(--status-noshow)',
    label: 'No show',
  },
};

const STAT_TINTS = {
  primary: 'bg-primary/10 text-primary',
  blue: 'bg-[color:var(--status-booked-bg)] text-[color:var(--status-booked)]',
  emerald: 'bg-[color:var(--status-completed-bg)] text-[color:var(--status-completed)]',
  amber: 'bg-[color:var(--status-noshow-bg)] text-[color:var(--status-noshow)]',
};

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

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelative(date) {
  if (!date) return '';
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

function formatPercent(value) {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value * 100)}%`;
}

export default function Dashboard() {
  const { selectedClinicId, selectedClinic } = useClinic();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedClinicId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.getDashboardStats({
          clinicId: selectedClinicId,
          trendDays: 30,
        });
        if (!cancelled) setData(res.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedClinicId]);

  const today = data?.today;
  const next = today?.next;
  const trend = data?.trend || [];
  const doctorLoad = data?.doctorLoad || [];
  const schedule = data?.schedule || [];
  const topDiagnoses = data?.topDiagnoses || [];
  const topMedications = data?.topMedications || [];
  const followUpsDue = data?.followUpsDue || [];
  const birthdays = data?.birthdays || [];
  const recentActivity = data?.recentActivity || [];
  const patientsKpi = data?.patients || {};
  const rangeTotals = data?.rangeTotals || {};

  const trendMax = useMemo(
    () => Math.max(1, ...trend.map((t) => t.total)),
    [trend],
  );

  const statCards = [
    {
      label: "Today's appointments",
      value: today?.total ?? 0,
      hint: next
        ? `Next at ${next.time} · ${next.patientId?.name || 'Patient'}`
        : 'No upcoming appointments',
      icon: CalendarCheck,
      tint: 'primary',
    },
    {
      label: 'Completed today',
      value: today?.COMPLETED ?? 0,
      hint: `${today?.BOOKED ?? 0} still booked`,
      icon: CheckCircle2,
      tint: 'emerald',
    },
    {
      label: 'Show-up rate · today',
      value: formatPercent(today?.showUpRate),
      hint: `${today?.NO_SHOW ?? 0} no-shows · ${today?.CANCELLED ?? 0} cancelled`,
      icon: Activity,
      tint: 'amber',
    },
    {
      label: 'Total patients',
      value: patientsKpi.total ?? 0,
      hint: `+${patientsKpi.newLast7 ?? 0} this week`,
      icon: Users,
      tint: 'blue',
    },
  ];

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Layout title="Dashboard">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome{selectedClinic ? `, ${selectedClinic.name}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/patients')}>
            <UserPlus className="size-4" /> Add patient
          </Button>
          <Button variant="outline" onClick={() => navigate('/doctors')}>
            <Stethoscope className="size-4" /> Add doctor
          </Button>
          <Button onClick={() => navigate('/appointments/new')}>
            <Plus className="size-4" /> New appointment
          </Button>
        </div>
      </div>

      {/* ── KPI cards ──────────────────────────────────────── */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label} className="relative overflow-hidden">
            <CardContent className="flex items-start justify-between gap-4 px-6 py-5">
              <div className="min-w-0 space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {card.label}
                </p>
                {loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <p className="text-3xl font-bold tabular-nums tracking-tight">
                    {card.value}
                  </p>
                )}
                {loading ? (
                  <Skeleton className="h-3 w-32" />
                ) : (
                  <p className="truncate text-xs text-muted-foreground">
                    {card.hint}
                  </p>
                )}
              </div>
              <div
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-lg',
                  STAT_TINTS[card.tint],
                )}
              >
                <card.icon className="size-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Row 1 · Today's schedule + Doctor load today ───── */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
            <div>
              <CardTitle>Today's schedule</CardTitle>
              <CardDescription>
                {schedule.length} appointment{schedule.length === 1 ? '' : 's'} ·{' '}
                {today?.BOOKED ?? 0} still booked
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/appointments')}
            >
              View all <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : schedule.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="No appointments scheduled"
                hint='Tap "New appointment" to book one.'
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Time</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.slice(0, 8).map((apt) => (
                    <TableRow key={apt._id}>
                      <TableCell className="font-medium tabular-nums">
                        {apt.time}
                      </TableCell>
                      <TableCell>
                        {apt.patient ? (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/patients/${apt.patient._id}`)
                            }
                            className="text-left hover:text-primary hover:underline"
                          >
                            {apt.patient.name}
                          </button>
                        ) : (
                          'N/A'
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {apt.doctor?.name || '—'}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">
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

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Doctor load · today</CardTitle>
            <CardDescription>
              Booked vs completed by doctor.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : doctorLoad.length === 0 ? (
              <EmptyState
                icon={Stethoscope}
                title="No active doctors"
                hint="Add a doctor to start scheduling."
              />
            ) : (
              <ul className="space-y-3">
                {doctorLoad.slice(0, 6).map((d) => {
                  const remaining = d.BOOKED;
                  const denom = Math.max(1, d.total);
                  const completedPct = (d.COMPLETED / denom) * 100;
                  const bookedPct = (d.BOOKED / denom) * 100;
                  return (
                    <li key={d.doctorId} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/doctors/${d.doctorId}`)}
                          className="truncate text-left text-sm font-medium hover:text-primary"
                        >
                          {d.name}
                        </button>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {d.COMPLETED}/{d.total}
                          {d.nextTime ? (
                            <span className="ml-1.5 text-foreground/70">
                              · next {d.nextTime}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      {d.total > 0 ? (
                        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-[color:var(--status-completed)]"
                            style={{ width: `${completedPct}%` }}
                          />
                          <div
                            className="h-full bg-[color:var(--status-booked)]"
                            style={{ width: `${bookedPct}%` }}
                          />
                        </div>
                      ) : (
                        <div className="text-[11px] text-muted-foreground">
                          No appointments today
                        </div>
                      )}
                      {remaining > 0 ? (
                        <div className="text-[11px] text-muted-foreground">
                          {remaining} remaining
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2 · Trend chart + Recent activity ──────────── */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
            <div>
              <CardTitle>Appointments · last 30 days</CardTitle>
              <CardDescription>
                {rangeTotals.total ?? 0} total · show-up{' '}
                {formatPercent(rangeTotals.showUpRate)} · no-show{' '}
                {formatPercent(rangeTotals.noShowRate)}
              </CardDescription>
            </div>
            <LegendDots />
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <Skeleton className="h-44 w-full" />
            ) : trend.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="No appointments in this window"
              />
            ) : (
              <TrendChart data={trend} max={trendMax} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              Latest status changes across all appointments.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="Nothing yet"
                hint="Activity will show here as appointments move through statuses."
              />
            ) : (
              <ul className="divide-y">
                {recentActivity.map((a) => {
                  const tok = STATUS_TOKENS[a.status];
                  const Icon =
                    a.status === 'COMPLETED'
                      ? CheckCircle2
                      : a.status === 'CANCELLED'
                      ? XCircle
                      : a.status === 'NO_SHOW'
                      ? CalendarX
                      : CalendarCheck;
                  return (
                    <li
                      key={a._id}
                      className="flex items-start gap-3 px-4 py-3"
                    >
                      <div
                        className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-md',
                          tok?.bg,
                          tok?.text,
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {a.patient}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                            {formatRelative(a.updatedAt)}
                          </span>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {tok?.label || a.status}
                          {a.doctor ? ` · ${a.doctor}` : ''}
                          {a.time ? ` · ${a.time}` : ''}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3 · Top diagnoses + Top medications ────────── */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Top diagnoses · last 30 days</CardTitle>
            <CardDescription>
              Most frequent prescription diagnoses.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <RankedList
              loading={loading}
              items={topDiagnoses}
              icon={Stethoscope}
              emptyTitle="No diagnoses recorded"
              emptyHint="Add prescriptions on a patient page to see trends here."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Top medications · last 30 days</CardTitle>
            <CardDescription>
              Most-prescribed medication names.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <RankedList
              loading={loading}
              items={topMedications}
              icon={Pill}
              emptyTitle="No medications recorded"
              emptyHint="Prescriptions added to patients will surface here."
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4 · Follow-ups + Birthdays ─────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
            <div>
              <CardTitle>Follow-ups due</CardTitle>
              <CardDescription>
                Last visit &gt; 60 days ago, no upcoming booking.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/patients')}
            >
              All patients <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : followUpsDue.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No one waiting"
                hint="Every patient with a recent visit also has a future booking."
              />
            ) : (
              <ul className="divide-y">
                {followUpsDue.map((p) => (
                  <li
                    key={p.patientId}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
                  >
                    <Avatar className="size-9 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                        {initialsOf(p.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {p.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground tabular-nums">
                        Last visit {formatDate(p.lastVisit)} · {p.daysAgo}d ago
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        navigate(`/appointments/new?patientId=${p.patientId}`)
                      }
                    >
                      Book <ArrowUpRight className="size-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Birthdays this week</CardTitle>
            <CardDescription>
              Send a wish — patients with a birthday in the next 7 days.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : birthdays.length === 0 ? (
              <EmptyState
                icon={Gift}
                title="No birthdays this week"
                hint="Patient birthdays will pop up here automatically."
              />
            ) : (
              <ul className="divide-y">
                {birthdays.map((p) => (
                  <li
                    key={p.patientId}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--status-noshow-bg)] text-[color:var(--status-noshow)]">
                      <Gift className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => navigate(`/patients/${p.patientId}`)}
                        className="block truncate text-left text-sm font-medium hover:text-primary"
                      >
                        {p.name}
                      </button>
                      <div className="truncate text-xs text-muted-foreground tabular-nums">
                        {formatDate(p.birthdayOn)} · turning {p.turning}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

// ── Helpers ──────────────────────────────────────────────

function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {hint ? (
        <p className="max-w-xs text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function LegendDots() {
  const items = [
    ['COMPLETED', STATUS_TOKENS.COMPLETED],
    ['BOOKED', STATUS_TOKENS.BOOKED],
    ['CANCELLED', STATUS_TOKENS.CANCELLED],
    ['NO_SHOW', STATUS_TOKENS.NO_SHOW],
  ];
  return (
    <div className="hidden items-center gap-3 sm:flex">
      {items.map(([k, tok]) => (
        <div key={k} className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-full"
            style={{ background: tok.fill }}
          />
          <span className="text-[11px] text-muted-foreground">{tok.label}</span>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ data, max }) {
  return (
    <div className="space-y-2">
      <div className="flex h-44 items-end gap-1">
        {data.map((d) => {
          const isToday = d.date === new Date().toISOString().slice(0, 10);
          const segments = ['COMPLETED', 'BOOKED', 'CANCELLED', 'NO_SHOW'];
          return (
            <div
              key={d.date}
              className="group flex flex-1 flex-col items-stretch justify-end"
              title={`${d.date} · ${d.total} total`}
            >
              <div
                className={cn(
                  'flex flex-col-reverse overflow-hidden rounded-sm transition-opacity',
                  d.total === 0 && 'opacity-30',
                )}
                style={{
                  height: `${Math.max(2, (d.total / max) * 100)}%`,
                  minHeight: d.total > 0 ? 4 : 2,
                }}
              >
                {segments.map((s) =>
                  d[s] > 0 ? (
                    <div
                      key={s}
                      style={{
                        background: STATUS_TOKENS[s].fill,
                        flexGrow: d[s],
                      }}
                    />
                  ) : null,
                )}
                {d.total === 0 ? (
                  <div className="h-full bg-muted" />
                ) : null}
              </div>
              <div
                className={cn(
                  'mt-1 truncate text-center text-[10px] tabular-nums',
                  isToday
                    ? 'font-semibold text-primary'
                    : 'text-muted-foreground',
                )}
              >
                {new Date(d.date).getDate()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RankedList({ loading, items, icon: Icon, emptyTitle, emptyHint }) {
  if (loading) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return <EmptyState icon={Icon} title={emptyTitle} hint={emptyHint} />;
  }
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => {
        const pct = (item.count / max) * 100;
        return (
          <li key={`${item.name}-${i}`} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="truncate font-medium">{item.name}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {item.count}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary/80"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
