import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  LogOut,
  Stethoscope,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../context/AuthContext';
import { useClinic } from '../context/ClinicContext';
import * as api from '../api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/theme-toggle';
import darkLogo from '../assets/dark-logo.png';

const SLOT_DURATION_OPTIONS = [15, 20, 30, 45, 60];

const STEPS = [
  {
    id: 'profile',
    title: 'Tell us about your clinic',
    icon: Building2,
    description:
      "We'll use these details to power your booking flow, working hours, and scheduling rules.",
  },
  {
    id: 'doctor',
    title: 'Add your first doctor',
    icon: Stethoscope,
    description:
      'You need at least one clinician on the team before you can take appointments. You can add more later.',
  },
];

const emptyProfile = {
  name: '',
  phone: '',
  address: '',
  workingHoursStart: '09:00',
  workingHoursEnd: '18:00',
  slotDuration: 30,
};

const emptyDoctor = {
  name: '',
  specialization: '',
  email: '',
  phone: '',
};

function clinicToProfile(c) {
  if (!c) return emptyProfile;
  return {
    name: c.name || '',
    phone: c.phone || '',
    address: c.address || '',
    workingHoursStart: c.workingHours?.start || '09:00',
    workingHoursEnd: c.workingHours?.end || '18:00',
    slotDuration: c.slotDuration || 30,
  };
}

export default function Onboarding() {
  const { isAuthenticated, logout } = useAuth();
  const {
    selectedClinic,
    selectedClinicId,
    setSelectedClinic,
    loading: clinicLoading,
  } = useClinic();
  const navigate = useNavigate();

  const [stepIdx, setStepIdx] = useState(0);
  const [profile, setProfile] = useState(emptyProfile);
  const [doctor, setDoctor] = useState(emptyDoctor);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingDoctor, setSavingDoctor] = useState(false);

  // Hydrate profile when clinic loads or refreshes (admin invites pre-fill).
  useEffect(() => {
    setProfile(clinicToProfile(selectedClinic));
  }, [selectedClinic]);

  const isOnboarded = !!selectedClinic?.onboardingCompletedAt;

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!clinicLoading && isOnboarded) return <Navigate to="/" replace />;

  async function handleSaveProfile(e) {
    e.preventDefault();

    if (!profile.name.trim()) {
      toast.error('Clinic name is required');
      return;
    }
    if (profile.workingHoursEnd <= profile.workingHoursStart) {
      toast.error('Working hours end must be after start');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await api.updateClinic(selectedClinicId, {
        name: profile.name.trim(),
        phone: profile.phone.trim() || undefined,
        address: profile.address.trim() || undefined,
        slotDuration: parseInt(profile.slotDuration, 10),
        workingHours: {
          start: profile.workingHoursStart,
          end: profile.workingHoursEnd,
        },
      });
      setSelectedClinic(res.data.data);
      setStepIdx(1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save clinic profile');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveDoctor(e) {
    e.preventDefault();

    if (!doctor.name.trim()) {
      toast.error('Doctor name is required');
      return;
    }

    setSavingDoctor(true);
    try {
      await api.createDoctor({
        clinicId: selectedClinicId,
        name: doctor.name.trim(),
        specialization: doctor.specialization.trim() || undefined,
        email: doctor.email.trim() || undefined,
        phone: doctor.phone.trim() || undefined,
        isActive: true,
      });

      // Mark onboarding done — backend re-validates the doctor count.
      const completed = await api.completeOnboarding(selectedClinicId);
      setSelectedClinic(completed.data.data);
      toast.success('Setup complete — welcome to Slotlii!');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to finish setup');
    } finally {
      setSavingDoctor(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const currentStep = STEPS[stepIdx];
  const StepIcon = currentStep.icon;

  // Disable Continue/Finish until basic in-form validation passes — keeps the
  // primary CTA from looking ready when the form isn't.
  const canContinueProfile = useMemo(
    () =>
      profile.name.trim().length > 0 &&
      profile.workingHoursStart < profile.workingHoursEnd,
    [profile],
  );
  const canFinishDoctor = doctor.name.trim().length > 0;

  return (
    <div className="relative min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_440px]">
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="size-4" /> Log out
        </Button>
        <ThemeToggle />
      </div>

      {/* Left pane — wizard */}
      <div className="relative flex min-h-screen flex-col px-6 py-10 sm:px-10 lg:px-12">
        <div className="flex items-center gap-2">
          <img src={darkLogo} alt="Slotlii" className="size-8 rounded-md" />
          <span className="text-sm font-semibold tracking-tight">Slotlii</span>
        </div>

        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-10">
          <StepIndicator stepIdx={stepIdx} />

          <div className="mt-10 mb-8">
            <div className="mb-4 inline-flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <StepIcon className="size-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {currentStep.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {currentStep.description}
            </p>
          </div>

          {clinicLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : stepIdx === 0 ? (
            <ProfileStep
              value={profile}
              onChange={setProfile}
              onSubmit={handleSaveProfile}
              saving={savingProfile}
              canContinue={canContinueProfile}
            />
          ) : (
            <DoctorStep
              value={doctor}
              onChange={setDoctor}
              onBack={() => setStepIdx(0)}
              onSubmit={handleSaveDoctor}
              saving={savingDoctor}
              canFinish={canFinishDoctor}
            />
          )}
        </div>
      </div>

      {/* Right pane — context / brand */}
      <div className="relative hidden overflow-hidden border-l bg-muted/40 lg:block">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -right-32 size-[34rem] rounded-full bg-primary/15 blur-[120px]" />
          <div className="absolute bottom-[-12rem] left-[-8rem] size-[28rem] rounded-full bg-chart-2/15 blur-[120px]" />
        </div>

        <div className="relative flex h-full flex-col justify-center gap-8 px-10 py-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-md">
              Setup · {stepIdx + 1} of {STEPS.length}
            </div>
            <h2 className="mt-6 text-2xl font-bold tracking-tight">
              A few minutes now,
              <br />
              years of smoother schedules.
            </h2>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              You can refine any of these details later from Settings — we just
              need the basics to get you booking appointments today.
            </p>
          </div>

          <ul className="space-y-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < stepIdx;
              const active = i === stepIdx;
              return (
                <li
                  key={s.id}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border bg-background/40 p-3 backdrop-blur-md transition-colors',
                    active && 'border-primary/60 bg-background',
                  )}
                >
                  <div
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-md',
                      done
                        ? 'bg-primary text-primary-foreground'
                        : active
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <Icon className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ stepIdx }) {
  return (
    <div className="flex items-center gap-3">
      {STEPS.map((s, i) => {
        const done = i < stepIdx;
        const active = i === stepIdx;
        return (
          <div key={s.id} className="flex items-center gap-3">
            <div
              className={cn(
                'flex size-7 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors',
                done
                  ? 'border-primary bg-primary text-primary-foreground'
                  : active
                  ? 'border-primary text-primary'
                  : 'border-border text-muted-foreground',
              )}
            >
              {done ? <CheckCircle2 className="size-4" /> : i + 1}
            </div>
            <span
              className={cn(
                'text-xs font-medium',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {s.id === 'profile' ? 'Clinic profile' : 'First doctor'}
            </span>
            {i < STEPS.length - 1 ? (
              <span className="h-px w-6 bg-border sm:w-10" aria-hidden />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ProfileStep({ value, onChange, onSubmit, saving, canContinue }) {
  function update(patch) {
    onChange((prev) => ({ ...prev, ...patch }));
  }
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="o-name">Clinic name *</Label>
        <Input
          id="o-name"
          required
          value={value.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. Bright Smile Dental"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="o-phone">Phone</Label>
          <Input
            id="o-phone"
            value={value.phone}
            onChange={(e) => update({ phone: e.target.value })}
            placeholder="e.g. 15551234567"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="o-slot">Slot duration</Label>
          <select
            id="o-slot"
            value={value.slotDuration}
            onChange={(e) => update({ slotDuration: e.target.value })}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {SLOT_DURATION_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="o-start">Working hours start</Label>
          <Input
            id="o-start"
            type="time"
            value={value.workingHoursStart}
            onChange={(e) => update({ workingHoursStart: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="o-end">Working hours end</Label>
          <Input
            id="o-end"
            type="time"
            value={value.workingHoursEnd}
            onChange={(e) => update({ workingHoursEnd: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="o-address">Address</Label>
        <Input
          id="o-address"
          value={value.address}
          onChange={(e) => update({ address: e.target.value })}
          placeholder="Street, city, postal code"
        />
      </div>

      <div className="flex items-center justify-end pt-2">
        <Button type="submit" disabled={!canContinue || saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {saving ? 'Saving…' : 'Continue'}
          {!saving ? <ArrowRight className="size-4" /> : null}
        </Button>
      </div>
    </form>
  );
}

function DoctorStep({ value, onChange, onBack, onSubmit, saving, canFinish }) {
  function update(patch) {
    onChange((prev) => ({ ...prev, ...patch }));
  }
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="o-doc-name">Full name *</Label>
          <Input
            id="o-doc-name"
            required
            value={value.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Dr. Jane Smith"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="o-doc-spec">Specialization</Label>
          <Input
            id="o-doc-spec"
            value={value.specialization}
            onChange={(e) => update({ specialization: e.target.value })}
            placeholder="e.g. Orthodontics"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="o-doc-phone">Phone</Label>
          <Input
            id="o-doc-phone"
            value={value.phone}
            onChange={(e) => update({ phone: e.target.value })}
            placeholder="Direct line"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="o-doc-email">Email</Label>
          <Input
            id="o-doc-email"
            type="email"
            value={value.email}
            onChange={(e) => update({ email: e.target.value })}
            placeholder="doctor@example.com"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        You can configure each doctor's weekly availability later from their
        profile page.
      </p>

      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" onClick={onBack} disabled={saving}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button type="submit" disabled={!canFinish || saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {saving ? 'Finishing setup…' : 'Finish setup'}
        </Button>
      </div>
    </form>
  );
}
