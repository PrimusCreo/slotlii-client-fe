import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Pencil,
  Link2Off,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import Layout from '../components/Layout/Layout';
import { useClinic } from '../context/ClinicContext';
import { useFacebookSdk } from '../hooks/useFacebookSdk';
import * as api from '../api';
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
import { Skeleton } from '@/components/ui/skeleton';

const FB_CONFIG_ID = import.meta.env.VITE_FACEBOOK_CONFIG_ID;
const SLOT_DURATION_OPTIONS = [15, 20, 30, 45, 60];

const emptyProfile = {
  name: '',
  phone: '',
  address: '',
  workingHoursStart: '09:00',
  workingHoursEnd: '18:00',
  slotDuration: 30,
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

export default function Settings() {
  const { selectedClinic, selectedClinicId, setSelectedClinic, loading } =
    useClinic();
  const { ready: fbReady, error: fbError } = useFacebookSdk();

  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(emptyProfile);
  const [savingProfile, setSavingProfile] = useState(false);

  const [connectingWA, setConnectingWA] = useState(false);
  const [disconnectingWA, setDisconnectingWA] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registeringWA, setRegisteringWA] = useState(false);

  const wc = selectedClinic?.whatsappConfig || {};
  const waConfigured = !!(wc.phoneNumberId && wc.accessToken);
  // Legacy connected records pre-date this field; treat missing as 'pending'
  // so the Register button shows up for them too.
  const waRegistered = wc.registrationStatus === 'registered';

  // Cache the phone_number_id + waba_id Meta posts during the popup flow.
  // Meta sends them via window.postMessage, separately from FB.login's `code`.
  const signupAssetsRef = useRef({ phoneNumberId: null, wabaId: null });

  // Hydrate the editable profile whenever the clinic loads or changes.
  useEffect(() => {
    setProfile(clinicToProfile(selectedClinic));
  }, [selectedClinic]);

  // Listen for Meta's WA_EMBEDDED_SIGNUP postMessage. It fires once the user
  // finishes adding their phone number inside the popup, before FB.login's
  // callback resolves.
  useEffect(() => {
    function handleSignupMessage(event) {
      if (!event.origin || !event.origin.endsWith('facebook.com')) return;
      try {
        const data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (typeof data.event === 'string' && data.event.startsWith('FINISH')) {
          signupAssetsRef.current = {
            phoneNumberId: data.data?.phone_number_id,
            wabaId: data.data?.waba_id,
          };
        }
      } catch {
        // non-JSON messages from other senders — ignore
      }
    }
    window.addEventListener('message', handleSignupMessage);
    return () => window.removeEventListener('message', handleSignupMessage);
  }, []);

  const submitSignup = useCallback(
    async (code) => {
      const { phoneNumberId, wabaId } = signupAssetsRef.current;
      if (!phoneNumberId || !wabaId) {
        toast.error(
          'Onboarding finished but Meta did not return a phone number. Please try again.'
        );
        return;
      }
      setConnectingWA(true);
      try {
        const res = await api.connectWhatsAppEmbeddedSignup(selectedClinicId, {
          code,
          phoneNumberId,
          wabaId,
        });
        setSelectedClinic(res.data.data);
        toast.success('WhatsApp connected successfully');
      } catch (err) {
        toast.error(
          err.response?.data?.error || 'Failed to complete WhatsApp signup'
        );
      } finally {
        setConnectingWA(false);
        signupAssetsRef.current = { phoneNumberId: null, wabaId: null };
      }
    },
    [selectedClinicId, setSelectedClinic]
  );

  function handleEmbeddedSignup() {
    if (!FB_CONFIG_ID) {
      toast.error(
        'Embedded Signup is not configured. Set VITE_FACEBOOK_CONFIG_ID in .env.'
      );
      return;
    }
    if (!fbReady || !window.FB) {
      toast.error(
        fbError?.message ||
          'Facebook SDK is still loading. Please wait a moment and try again.'
      );
      return;
    }

    signupAssetsRef.current = { phoneNumberId: null, wabaId: null };

    window.FB.login(
      (response) => {
        const code = response?.authResponse?.code;
        if (!code) {
          if (response?.status !== 'unknown') {
            toast.error('Meta sign-in was cancelled or denied.');
          }
          return;
        }
        submitSignup(code);
      },
      {
        config_id: FB_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { version: 'v4' },
      }
    );
  }

  async function handleRegister(pin) {
    if (!selectedClinicId) return;
    setRegisteringWA(true);
    try {
      const res = await api.registerWhatsApp(selectedClinicId, { pin });
      setSelectedClinic(res.data.data);
      setRegisterOpen(false);
      const generated = res.data.generatedPin;
      if (generated) {
        toast.success(
          `Your number is live. We generated your 2FA PIN: ${generated} — write it down.`,
          { duration: 12000 }
        );
      } else {
        toast.success('Your number is now live on WhatsApp.');
      }
    } catch (err) {
      toast.error(
        err.response?.data?.error || 'Failed to register WhatsApp number'
      );
    } finally {
      setRegisteringWA(false);
    }
  }

  async function handleDisconnect() {
    if (!selectedClinicId) return;
    if (
      !window.confirm(
        'Disconnect WhatsApp? Messages will stop being delivered to this clinic until you reconnect.'
      )
    ) {
      return;
    }
    setDisconnectingWA(true);
    try {
      const res = await api.disconnectWhatsApp(selectedClinicId);
      setSelectedClinic(res.data.data);
      toast.success('WhatsApp disconnected');
    } catch (err) {
      toast.error(
        err.response?.data?.error || 'Failed to disconnect WhatsApp'
      );
    } finally {
      setDisconnectingWA(false);
    }
  }

  function startEdit() {
    setProfile(clinicToProfile(selectedClinic));
    setEditing(true);
  }

  function cancelEdit() {
    setProfile(clinicToProfile(selectedClinic));
    setEditing(false);
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!selectedClinicId) return;
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
      setEditing(false);
      toast.success('Clinic profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <Layout title="Settings">
      <div className="grid max-w-4xl gap-4">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 border-b">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                Clinic profile
              </CardTitle>
              <CardDescription>
                Basic information and operating hours for your clinic.
              </CardDescription>
            </div>
            {!loading && selectedClinic && !editing ? (
              <Button variant="outline" size="sm" onClick={startEdit}>
                <Pencil className="size-3.5" /> Edit
              </Button>
            ) : null}
          </CardHeader>

          <CardContent className="pt-6">
            {loading ? (
              <ProfileSkeleton />
            ) : !selectedClinic ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <Building2 className="size-5" />
                </div>
                <p className="text-sm">No clinic selected</p>
              </div>
            ) : editing ? (
              <ProfileForm
                value={profile}
                onChange={setProfile}
                onSubmit={handleSaveProfile}
                onCancel={cancelEdit}
                saving={savingProfile}
              />
            ) : (
              <ProfileView clinic={selectedClinic} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 border-b">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="size-4 text-[#25D366]" />
                WhatsApp
              </CardTitle>
              <CardDescription>
                Connect a WhatsApp number to send and receive messages.
              </CardDescription>
            </div>
            {!waConfigured ? (
              <Badge variant="warning" className="font-normal">
                <AlertCircle className="size-3" /> Not connected
              </Badge>
            ) : waRegistered ? (
              <Badge variant="success" className="font-normal">
                <CheckCircle2 className="size-3" /> Connected
              </Badge>
            ) : (
              <Badge variant="warning" className="font-normal">
                <AlertCircle className="size-3" /> Pending registration
              </Badge>
            )}
          </CardHeader>

          <CardContent className="pt-6">
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : !waConfigured ? (
              <NotConnectedPanel
                onConnect={handleEmbeddedSignup}
                connecting={connectingWA}
                fbReady={fbReady}
                fbError={fbError}
                hasConfigId={!!FB_CONFIG_ID}
              />
            ) : !waRegistered ? (
              <PendingRegistrationPanel
                wc={wc}
                onRegister={() => setRegisterOpen(true)}
                onDisconnect={handleDisconnect}
                disconnecting={disconnectingWA}
              />
            ) : (
              <ConnectedPanel
                wc={wc}
                onDisconnect={handleDisconnect}
                disconnecting={disconnectingWA}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <RegisterNumberDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onSubmit={handleRegister}
        submitting={registeringWA}
        displayPhoneNumber={wc.displayPhoneNumber}
      />
    </Layout>
  );
}

// ── Clinic profile sub-components ─────────────────────────

function ProfileView({ clinic }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      <InfoItem label="Name">{clinic.name}</InfoItem>
      <InfoItem label="Phone">
        {clinic.phone || <Muted>Not set</Muted>}
      </InfoItem>
      <InfoItem label="Working hours">
        {clinic.workingHours?.start} – {clinic.workingHours?.end}
      </InfoItem>
      <InfoItem label="Slot duration">{clinic.slotDuration} minutes</InfoItem>
      <InfoItem label="Address">
        {clinic.address || <Muted>Not set</Muted>}
      </InfoItem>
      <InfoItem label="Status">
        <Badge variant="success" className="font-normal">
          Active
        </Badge>
      </InfoItem>
    </dl>
  );
}

function ProfileForm({ value, onChange, onSubmit, onCancel, saving }) {
  function update(patch) {
    onChange((prev) => ({ ...prev, ...patch }));
  }
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="c-name">Clinic name *</Label>
          <Input
            id="c-name"
            required
            value={value.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="e.g. Bright Smile Dental"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-phone">Phone</Label>
          <Input
            id="c-phone"
            value={value.phone}
            onChange={(e) => update({ phone: e.target.value })}
            placeholder="e.g. 15551234567"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-slot">Slot duration</Label>
          <select
            id="c-slot"
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
          <Label htmlFor="c-start">Working hours start</Label>
          <Input
            id="c-start"
            type="time"
            value={value.workingHoursStart}
            onChange={(e) => update({ workingHoursStart: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-end">Working hours end</Label>
          <Input
            id="c-end"
            type="time"
            value={value.workingHoursEnd}
            onChange={(e) => update({ workingHoursEnd: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="c-address">Address</Label>
          <Input
            id="c-address"
            value={value.address}
            onChange={(e) => update({ address: e.target.value })}
            placeholder="Street, city, postal code"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

function InfoItem({ label, children }) {
  return (
    <div className="space-y-1">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

function Muted({ children }) {
  return <span className="text-muted-foreground font-normal">{children}</span>;
}

// ── WhatsApp sub-components ───────────────────────────────

function NotConnectedPanel({
  onConnect,
  connecting,
  fbReady,
  fbError,
  hasConfigId,
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed bg-muted/20 px-6 py-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-[#25D366]/10">
        <MessageSquare className="size-6 text-[#25D366]" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">No WhatsApp number connected</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Connect through Meta's secure flow — you'll need access to the phone
          number you want to register for OTP.
        </p>
      </div>
      <Button
        onClick={onConnect}
        disabled={connecting || !fbReady || !hasConfigId}
        className="bg-[#25D366] text-white hover:bg-[#1ebe57]"
      >
        {connecting ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Finishing setup…
          </>
        ) : (
          <>
            <MessageSquare className="size-4" /> Connect WhatsApp
          </>
        )}
      </Button>
      {!hasConfigId && (
        <p className="text-[11px] text-destructive">
          VITE_FACEBOOK_CONFIG_ID is missing. Add it to .env to enable this
          button.
        </p>
      )}
      {hasConfigId && !fbReady && !fbError && (
        <p className="text-[11px] text-muted-foreground">Loading Meta SDK…</p>
      )}
      {fbError && (
        <p className="text-[11px] text-destructive">{fbError.message}</p>
      )}
    </div>
  );
}

function ConnectedPanel({ wc, onDisconnect, disconnecting }) {
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-4 rounded-md border bg-muted/20 px-4 py-4 sm:grid-cols-2">
        <InfoItem label="Business name">
          {wc.verifiedName || <Muted>Not set</Muted>}
        </InfoItem>
        <InfoItem label="Phone number">
          {wc.displayPhoneNumber || <Muted>Not set</Muted>}
        </InfoItem>
      </dl>

      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={onDisconnect}
          disabled={disconnecting}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {disconnecting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Link2Off className="size-4" />
          )}
          {disconnecting ? 'Disconnecting…' : 'Disconnect'}
        </Button>
      </div>
    </div>
  );
}

function PendingRegistrationPanel({
  wc,
  onRegister,
  onDisconnect,
  disconnecting,
}) {
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-4 rounded-md border bg-muted/20 px-4 py-4 sm:grid-cols-2">
        <InfoItem label="Business name">
          {wc.verifiedName || <Muted>Not set</Muted>}
        </InfoItem>
        <InfoItem label="Phone number">
          {wc.displayPhoneNumber || <Muted>Not set</Muted>}
        </InfoItem>
      </dl>

      <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">One more step to go live</p>
          <p className="text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/80">
            Your number is attached to your WhatsApp Business Account but
            isn't activated on the Cloud API yet. Register it to set a 6-digit
            security PIN and start sending and receiving messages.
          </p>
        </div>
      </div>

      <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
        <Button
          variant="outline"
          onClick={onDisconnect}
          disabled={disconnecting}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {disconnecting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Link2Off className="size-4" />
          )}
          {disconnecting ? 'Disconnecting…' : 'Disconnect'}
        </Button>
        <Button onClick={onRegister} className="bg-[#25D366] text-white hover:bg-[#1ebe57]">
          <ShieldCheck className="size-4" /> Register number
        </Button>
      </div>
    </div>
  );
}

// Mirrors the server-side rules in clinicController.validateWhatsAppPin.
// Keep these in sync — server is the source of truth, this is just to
// give the user instant feedback without a round trip.
function validatePinLocal(pin) {
  if (!/^\d{6}$/.test(pin)) return 'PIN must be exactly 6 digits';
  if (/^(\d)\1{5}$/.test(pin)) return 'PIN cannot be all the same digit';
  const digits = pin.split('').map(Number);
  const asc = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1);
  const desc = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1);
  if (asc || desc) return 'PIN cannot be a simple sequence';
  return null;
}

function generateRandomPin() {
  for (let i = 0; i < 50; i += 1) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    if (!validatePinLocal(pin)) return pin;
  }
  return '482937';
}

function RegisterNumberDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
  displayPhoneNumber,
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [autoGenerate, setAutoGenerate] = useState(true);

  // Reset state every time the dialog opens.
  useEffect(() => {
    if (open) {
      setPin('');
      setError(null);
      setAutoGenerate(true);
    }
  }, [open]);

  function handleAutofill() {
    setAutoGenerate(false);
    setPin(generateRandomPin());
    setError(null);
  }

  function handlePinChange(e) {
    setAutoGenerate(false);
    const next = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(next);
    setError(null);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (autoGenerate) {
      onSubmit(undefined);
      return;
    }
    const validationError = validatePinLocal(pin);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSubmit(pin);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-[#25D366]" />
            Register your WhatsApp number
          </DialogTitle>
          <DialogDescription>
            Activates {displayPhoneNumber || 'your number'} on WhatsApp Cloud
            API and sets a 6-digit two-step verification PIN. You'll need this
            PIN if you ever move the number to a different platform.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="wa-pin">6-digit PIN</Label>
            <Input
              id="wa-pin"
              inputMode="numeric"
              autoComplete="off"
              placeholder={autoGenerate ? 'Auto-generate for me' : '••••••'}
              value={pin}
              onChange={handlePinChange}
              maxLength={6}
              className="font-mono tracking-[0.4em]"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground">
                Avoid sequences (123456) or repeats (000000).
              </p>
              <button
                type="button"
                onClick={handleAutofill}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <Sparkles className="size-3" /> Generate one for me
              </button>
            </div>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>

          <div className="rounded-md border bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            We'll save this PIN securely so we can show it to you again later.
            For your records, write it down — Meta requires it to re-register
            this number anywhere else.
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Registering…
                </>
              ) : (
                <>
                  <ShieldCheck className="size-4" /> Register
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
