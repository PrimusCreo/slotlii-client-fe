import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  FileImage,
  ImageIcon,
  Loader2,
  MessageSquare,
  Pencil,
  Link2Off,
  Phone,
  Plus,
  ShieldOff,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import Layout from '../components/Layout/Layout';
import { useClinic } from '../context/ClinicContext';
import { useAuth } from '../context/AuthContext';
import { useFacebookSdk } from '../hooks/useFacebookSdk';
import * as api from '../api';
import { PERMISSIONS } from '@/lib/permissions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ConsentTemplatesManager } from '../components/consents/ConsentTemplatesManager';
import { TreatmentsManager } from '../components/treatments/TreatmentsManager';
import { LogoCropperDialog } from '../components/clinic/LogoCropperDialog';
import { LetterheadCropperDialog } from '../components/clinic/LetterheadCropperDialog';
import { UsageMeters } from '../components/subscription/UsageMeters';

const FB_CONFIG_ID = import.meta.env.VITE_FACEBOOK_CONFIG_ID;
// Twilio Partner Solution ID (Meta App Dashboard → WhatsApp → Partner
// Solutions). REQUIRED: without it, the customer's WABA is shared only
// with our Meta app — Twilio can't access it, and sender registration
// fails with Twilio error 63100 at the import_sender step.
const FB_SOLUTION_ID = import.meta.env.VITE_FACEBOOK_SOLUTION_ID;
const SLOT_DURATION_OPTIONS = [15, 20, 30, 45, 60];

// Meta's Embedded Signup postMessage returns only `phone_number_id` and
// `waba_id` — never the dialable number. Twilio's Senders API needs the
// number in E.164 for `sender_id`, so we collect it here before opening
// the popup. See Twilio's Tech Provider integration guide: "If you allow
// your customers to bring their own phone number... you must collect it
// from your customers separately from the Embedded Signup flow."
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

function normalizeE164(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';
  const digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) return '';
  return `+${digits}`;
}

function isValidE164(input) {
  return E164_PATTERN.test(normalizeE164(input));
}

const emptyProfile = {
  name: '',
  phone: '',
  additionalPhones: [],
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
    additionalPhones: Array.isArray(c.additionalPhones)
      ? c.additionalPhones.filter(Boolean)
      : [],
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

  // Logo upload state: a freshly-picked file opens the cropper dialog,
  // the cropped Blob is uploaded straight to the server.
  const [pendingLogoFile, setPendingLogoFile] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [deletingLogo, setDeletingLogo] = useState(false);
  const logoInputRef = useRef(null);

  // Letterhead upload state — one cropper is shared for the header and
  // footer parts, `pendingLetterheadPart` tracks which slot the picked
  // file belongs to so the confirm handler knows where to send it.
  const [pendingLetterheadFile, setPendingLetterheadFile] = useState(null);
  const [pendingLetterheadPart, setPendingLetterheadPart] = useState(null);
  const [uploadingLetterheadPart, setUploadingLetterheadPart] = useState(null);
  const [deletingLetterheadPart, setDeletingLetterheadPart] = useState(null);
  const letterheadHeaderInputRef = useRef(null);
  const letterheadFooterInputRef = useRef(null);

  function handleLogoFilePicked(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      toast.error('Please choose a PNG, JPEG or WebP image.');
    } else {
      setPendingLogoFile(file);
    }
    // Reset so picking the same file twice still triggers onChange.
    if (logoInputRef.current) logoInputRef.current.value = '';
  }

  async function handleLogoConfirm(blob, meta) {
    if (!selectedClinicId || !blob) return;
    setUploadingLogo(true);
    try {
      const res = await api.uploadClinicLogo(selectedClinicId, blob, {
        ...meta,
        fileName: 'logo.png',
      });
      setSelectedClinic(res.data.data);
      setPendingLogoFile(null);
      toast.success('Logo updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleLogoDelete() {
    if (!selectedClinicId) return;
    if (!window.confirm('Remove the current logo?')) return;
    setDeletingLogo(true);
    try {
      const res = await api.deleteClinicLogo(selectedClinicId);
      setSelectedClinic(res.data.data);
      toast.success('Logo removed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove logo');
    } finally {
      setDeletingLogo(false);
    }
  }

  function handleLetterheadFilePicked(e, part) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      toast.error('Please choose a PNG, JPEG or WebP image.');
    } else {
      setPendingLetterheadPart(part);
      setPendingLetterheadFile(file);
    }
    // Reset so picking the same file twice still triggers onChange.
    if (part === 'header' && letterheadHeaderInputRef.current) {
      letterheadHeaderInputRef.current.value = '';
    } else if (part === 'footer' && letterheadFooterInputRef.current) {
      letterheadFooterInputRef.current.value = '';
    }
  }

  async function handleLetterheadConfirm(blob, meta) {
    if (!selectedClinicId || !blob || !pendingLetterheadPart) return;
    const part = pendingLetterheadPart;
    setUploadingLetterheadPart(part);
    try {
      const res = await api.uploadClinicLetterhead(
        selectedClinicId,
        part,
        blob,
        { ...meta, fileName: `letterhead-${part}.png` },
      );
      setSelectedClinic(res.data.data);
      setPendingLetterheadFile(null);
      setPendingLetterheadPart(null);
      toast.success(
        part === 'footer' ? 'Letterhead footer updated' : 'Letterhead header updated',
      );
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload letterhead');
    } finally {
      setUploadingLetterheadPart(null);
    }
  }

  async function handleLetterheadDelete(part) {
    if (!selectedClinicId) return;
    if (
      !window.confirm(
        part === 'footer'
          ? 'Remove the letterhead footer?'
          : 'Remove the letterhead header?',
      )
    ) {
      return;
    }
    setDeletingLetterheadPart(part);
    try {
      const res = await api.deleteClinicLetterhead(selectedClinicId, part);
      setSelectedClinic(res.data.data);
      toast.success(
        part === 'footer' ? 'Letterhead footer removed' : 'Letterhead header removed',
      );
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove letterhead');
    } finally {
      setDeletingLetterheadPart(null);
    }
  }

  const [connectingWA, setConnectingWA] = useState(false);
  const [disconnectingWA, setDisconnectingWA] = useState(false);
  // The WhatsApp number the clinic intends to register, collected before
  // the Meta popup opens because Embedded Signup never returns it.
  const [waNumberInput, setWaNumberInput] = useState('');
  // Live status snapshot fetched from GET /clinics/:id/whatsapp/status
  // while the clinic sits in the `activating` state. Contains template
  // approval progress so the panel can render a useful progress bar.
  const [waStatus, setWaStatus] = useState(null);

  const wc = selectedClinic?.whatsappConfig || {};
  const activationStatus = wc.activationStatus || 'not_activated';

  // Cache the phone_number_id + waba_id Meta posts during the popup flow.
  // Meta sends them via window.postMessage, separately from FB.login's `code`.
  const signupAssetsRef = useRef({
    phoneNumberId: null,
    wabaId: null,
  });

  // Hydrate the editable profile whenever the clinic loads or changes.
  useEffect(() => {
    setProfile(clinicToProfile(selectedClinic));
  }, [selectedClinic]);

  // Seed the WhatsApp number field from whatever we already know about
  // this clinic — the previously registered WhatsApp number if there is
  // one, otherwise their contact phone. Saves retyping on reconnect and
  // makes the common case a single click.
  useEffect(() => {
    const known =
      selectedClinic?.whatsappConfig?.whatsappNumber || selectedClinic?.phone;
    setWaNumberInput(known ? normalizeE164(known) : '');
  }, [selectedClinicId, selectedClinic?.whatsappConfig?.whatsappNumber, selectedClinic?.phone]);

  // Listen for Meta's WA_EMBEDDED_SIGNUP postMessage. It fires once the
  // user finishes the popup, before FB.login's callback resolves. Meta's
  // FINISH payload carries only `phone_number_id` and `waba_id`; the
  // dialable number comes from `waNumberInput` instead. Meta also reports
  // ERROR events here, which are far more useful to surface than a
  // generic failure later on.
  useEffect(() => {
    function handleSignupMessage(event) {
      if (!event.origin || !event.origin.endsWith('facebook.com')) return;
      try {
        const data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (typeof data.event === 'string' && data.event.startsWith('FINISH')) {
          signupAssetsRef.current = {
            phoneNumberId: data.data?.phone_number_id || null,
            wabaId: data.data?.waba_id || null,
          };
        } else if (data.event === 'ERROR') {
          toast.error(
            data.data?.error_message ||
              'Meta reported an error during WhatsApp onboarding.'
          );
        }
      } catch {
        // non-JSON messages from other senders — ignore
      }
    }
    window.addEventListener('message', handleSignupMessage);
    return () => window.removeEventListener('message', handleSignupMessage);
  }, []);

  const submitActivation = useCallback(
    async (code, whatsappNumber) => {
      const { phoneNumberId, wabaId } = signupAssetsRef.current;
      if (!wabaId) {
        toast.error(
          'Onboarding finished but Meta did not return a WhatsApp Business Account. Please try again.'
        );
        return;
      }
      setConnectingWA(true);
      try {
        const res = await api.activateWhatsApp(selectedClinicId, {
          code,
          phoneNumberId,
          wabaId,
          whatsappNumber,
        });
        setSelectedClinic(res.data.data);
        toast.success(
          'WhatsApp activated. Templates are being submitted for approval.'
        );
      } catch (err) {
        toast.error(
          err.response?.data?.error || 'Failed to complete WhatsApp activation'
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
    if (!FB_SOLUTION_ID) {
      toast.error(
        'Twilio Partner Solution is not configured. Set VITE_FACEBOOK_SOLUTION_ID in .env — without it the WABA is not shared with Twilio and activation will fail.'
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
    // Captured now, before the popup opens: Meta's response never
    // includes the dialable number but Twilio's Senders API requires it.
    const whatsappNumber = normalizeE164(waNumberInput);
    if (!isValidE164(whatsappNumber)) {
      toast.error(
        'Enter the WhatsApp number in international format, e.g. +919876543210.'
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
        submitActivation(code, whatsappNumber);
      },
      {
        config_id: FB_CONFIG_ID,
        // Avoids "user is already logged in" errors when the button is
        // clicked again without a page refresh.
        auth_type: 'rerequest',
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          version: 'v4',
          // Required so Meta's postMessage payload includes the WABA ID.
          sessionInfoVersion: 3,
          setup: {
            // Twilio Partner Solution ID — shares the customer's WABA
            // with BOTH our Meta app and Twilio, which is what allows
            // the backend's POST /v2/Channels/Senders to register the
            // number. The signup dialog will show a Meta-mandated note
            // that we work with Twilio.
            solutionID: FB_SOLUTION_ID,
          },
        },
      }
    );
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

  // While the clinic sits in a transient state (`activating` after
  // signup, or `resetting` while admin performs a reset), poll the
  // status endpoint every 15s so the frontend flips to a terminal
  // state (`active`, `activation_failed`) without a page reload.
  useEffect(() => {
    if (!selectedClinicId) return undefined;
    const isTransient =
      activationStatus === 'activating' || activationStatus === 'resetting';
    if (!isTransient) {
      setWaStatus(null);
      return undefined;
    }

    let cancelled = false;
    async function poll() {
      try {
        const res = await api.getWhatsAppStatus(selectedClinicId);
        if (cancelled) return;
        setWaStatus(res.data.data);
        // Server flipped us out of the transient state — refresh the
        // clinic doc so the rest of the UI sees the new status.
        const newStatus = res.data.data.activationStatus;
        if (newStatus !== 'activating' && newStatus !== 'resetting') {
          const clinicRes = await api.getClinic(selectedClinicId);
          if (!cancelled) setSelectedClinic(clinicRes.data.data);
        }
      } catch (err) {
        // Silent on poll failure — a transient error is fine.
      }
    }
    poll();
    const handle = setInterval(poll, 15_000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [selectedClinicId, activationStatus, setSelectedClinic]);

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
        additionalPhones: (profile.additionalPhones || [])
          .map((p) => String(p || '').trim())
          .filter(Boolean),
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
        <PlanSummaryCard />

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 border-b">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="size-4 text-primary" />
                Clinic logo
              </CardTitle>
              <CardDescription>
                Shown in the sidebar, header and printed on every prescription,
                consent and invoice PDF.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : !selectedClinic ? (
              <p className="text-sm text-muted-foreground">No clinic selected</p>
            ) : (
              <LogoUploader
                logoUrl={selectedClinic.logoUrl}
                onPick={() => logoInputRef.current?.click()}
                onRemove={handleLogoDelete}
                uploading={uploadingLogo}
                removing={deletingLogo}
              />
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleLogoFilePicked}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 border-b">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <FileImage className="size-4 text-primary" />
                Letterhead
              </CardTitle>
              <CardDescription>
                Optional A4-width strips stamped on the top and bottom of
                every prescription, bill and consent PDF. Uploading a
                letterhead replaces the auto-generated clinic header /
                footer on those documents.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : !selectedClinic ? (
              <p className="text-sm text-muted-foreground">No clinic selected</p>
            ) : (
              <>
                <LetterheadPartRow
                  part="header"
                  label="Header"
                  hint="Sits at the very top of each printed page."
                  imageUrl={selectedClinic.letterhead?.header?.url}
                  onPick={() => letterheadHeaderInputRef.current?.click()}
                  onRemove={() => handleLetterheadDelete('header')}
                  uploading={uploadingLetterheadPart === 'header'}
                  removing={deletingLetterheadPart === 'header'}
                  disabled={
                    uploadingLetterheadPart !== null ||
                    deletingLetterheadPart !== null
                  }
                />
                <LetterheadPartRow
                  part="footer"
                  label="Footer"
                  hint="Sits at the very bottom of each printed page."
                  imageUrl={selectedClinic.letterhead?.footer?.url}
                  onPick={() => letterheadFooterInputRef.current?.click()}
                  onRemove={() => handleLetterheadDelete('footer')}
                  uploading={uploadingLetterheadPart === 'footer'}
                  removing={deletingLetterheadPart === 'footer'}
                  disabled={
                    uploadingLetterheadPart !== null ||
                    deletingLetterheadPart !== null
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Recommended source size 794×107 px (A4 width at 96 DPI).
                  Anything wider is cropped to fit on upload. PNG, JPEG or
                  WebP up to 3MB.
                </p>
              </>
            )}
            <input
              ref={letterheadHeaderInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => handleLetterheadFilePicked(e, 'header')}
            />
            <input
              ref={letterheadFooterInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => handleLetterheadFilePicked(e, 'footer')}
            />
          </CardContent>
        </Card>

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
            <WhatsAppStatusBadge status={activationStatus} />
          </CardHeader>

          <CardContent className="pt-6">
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <WhatsAppPanel
                status={activationStatus}
                wc={wc}
                waStatus={waStatus}
                onConnect={handleEmbeddedSignup}
                onDisconnect={handleDisconnect}
                connecting={connectingWA}
                disconnecting={disconnectingWA}
                fbReady={fbReady}
                fbError={fbError}
                hasConfigId={!!FB_CONFIG_ID}
                hasSolutionId={!!FB_SOLUTION_ID}
                numberInput={waNumberInput}
                onNumberInputChange={setWaNumberInput}
              />
            )}
          </CardContent>
        </Card>

        {selectedClinicId ? (
          <TreatmentsManager clinicId={selectedClinicId} />
        ) : null}

        {selectedClinicId ? (
          <ConsentTemplatesManager clinicId={selectedClinicId} />
        ) : null}
      </div>

      <LogoCropperDialog
        open={!!pendingLogoFile}
        file={pendingLogoFile}
        saving={uploadingLogo}
        onCancel={() => setPendingLogoFile(null)}
        onConfirm={handleLogoConfirm}
      />

      <LetterheadCropperDialog
        open={!!pendingLetterheadFile}
        file={pendingLetterheadFile}
        part={pendingLetterheadPart || 'header'}
        saving={
          !!pendingLetterheadPart &&
          uploadingLetterheadPart === pendingLetterheadPart
        }
        onCancel={() => {
          setPendingLetterheadFile(null);
          setPendingLetterheadPart(null);
        }}
        onConfirm={handleLetterheadConfirm}
      />
    </Layout>
  );
}

/**
 * Plan state at a glance, with storage usage — the limit clinics hit first and
 * the one they can't infer from anything else on this page. Full pricing and the
 * plan switch live on `/settings/plans`.
 */
function PlanSummaryCard() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { subscription, loading } = useClinic();

  if (!can(PERMISSIONS.SUBSCRIPTION_MANAGE)) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-4 text-primary" />
            Plan &amp; billing
            {subscription?.isTrialing ? (
              <Badge variant="soft">Free trial</Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            {loading || !subscription
              ? 'Your plan, limits and payment history.'
              : subscription.isTrialing
                ? `Your free trial has ${subscription.trialDaysRemaining} ${
                    subscription.trialDaysRemaining === 1 ? 'day' : 'days'
                  } left. Choose a plan to keep going.`
                : `You are on the ${subscription.planName} plan, billed ${
                    subscription.billingCycle === 'yearly' ? 'yearly' : 'monthly'
                  }.`}
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/settings/plans')}
        >
          Manage plan
        </Button>
      </CardHeader>
      <CardContent className="pt-6">
        {loading ? <Skeleton className="h-10 w-full" /> : <UsageMeters storageOnly />}
      </CardContent>
    </Card>
  );
}

// ── Clinic profile sub-components ─────────────────────────

function ProfileView({ clinic }) {
  const extras = Array.isArray(clinic.additionalPhones)
    ? clinic.additionalPhones.filter(Boolean)
    : [];
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
      <div className="space-y-1 sm:col-span-2">
        <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Additional phones
        </dt>
        <dd className="text-sm font-medium">
          {extras.length === 0 ? (
            <Muted>None</Muted>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {extras.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs font-medium"
                >
                  <Phone className="size-3 text-muted-foreground" />
                  {p}
                </span>
              ))}
            </div>
          )}
        </dd>
      </div>
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
          <Label htmlFor="c-phone">Primary phone</Label>
          <Input
            id="c-phone"
            value={value.phone}
            onChange={(e) => update({ phone: e.target.value })}
            placeholder="e.g. 15551234567"
          />
          <p className="text-[11px] text-muted-foreground">
            Bound to WhatsApp. Add extras below for reception, owner, etc.
          </p>
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

        <div className="space-y-1.5 sm:col-span-2">
          <Label>Additional phones</Label>
          <PhonesEditor
            phones={value.additionalPhones || []}
            onChange={(next) => update({ additionalPhones: next })}
          />
          <p className="text-[11px] text-muted-foreground">
            Printed alongside the primary number on prescriptions, consent
            forms and invoices. Up to 10 additional numbers.
          </p>
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

function PhonesEditor({ phones, onChange }) {
  const MAX = 10;
  const [draft, setDraft] = useState('');

  function commitDraft() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (phones.length >= MAX) {
      toast.error(`Up to ${MAX} additional phones`);
      return;
    }
    if (phones.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('That number is already in the list');
      setDraft('');
      return;
    }
    onChange([...phones, trimmed]);
    setDraft('');
  }

  function remove(index) {
    onChange(phones.filter((_, i) => i !== index));
  }

  function updateAt(index, value) {
    onChange(phones.map((p, i) => (i === index ? value : p)));
  }

  return (
    <div className="space-y-2">
      {phones.length > 0 ? (
        <div className="space-y-2">
          {phones.map((phone, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Phone className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={phone}
                  onChange={(e) => updateAt(idx, e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="pl-8"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(idx)}
                aria-label="Remove phone"
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Plus className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitDraft();
              }
            }}
            placeholder="Add another number…"
            disabled={phones.length >= MAX}
            className="pl-8"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={commitDraft}
          disabled={!draft.trim() || phones.length >= MAX}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

/**
 * Renders one row of the Letterhead card — a preview of the current
 * header / footer strip (or an empty placeholder) plus upload / remove
 * buttons. The preview is scaled down but keeps the exact 794:107
 * aspect ratio so the user sees a faithful representation of what will
 * land on the printed page.
 */
function LetterheadPartRow({
  part,
  label,
  hint,
  imageUrl,
  onPick,
  onRemove,
  uploading,
  removing,
  disabled,
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </div>
      <div
        className="flex w-full items-center justify-center overflow-hidden rounded-md border bg-muted/30"
        style={{ aspectRatio: '794 / 107' }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Letterhead ${part}`}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileImage className="size-4" />
            No {label.toLowerCase()} uploaded yet.
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPick}
          disabled={disabled}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {imageUrl ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
        </Button>
        {imageUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={disabled}
          >
            {removing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function LogoUploader({ logoUrl, onPick, onRemove, uploading, removing }) {
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      <div
        className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30"
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Clinic logo"
            className="size-full object-cover"
          />
        ) : (
          <ImageIcon className="size-8 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 space-y-2">
        <p className="text-sm">
          {logoUrl
            ? 'Replace the current logo or remove it entirely.'
            : 'Upload a square logo. A cropper opens so you can zoom and rotate before saving.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPick}
            disabled={uploading || removing}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {logoUrl ? 'Replace logo' : 'Upload logo'}
          </Button>
          {logoUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={uploading || removing}
            >
              {removing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-[11px] text-muted-foreground">
          PNG, JPEG or WebP up to 4MB. Stored as a 512×512 PNG after cropping.
        </p>
      </div>
    </div>
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

function WhatsAppStatusBadge({ status }) {
  switch (status) {
    case 'active':
      return (
        <Badge variant="success" className="font-normal">
          <CheckCircle2 className="size-3" /> Connected
        </Badge>
      );
    case 'activating':
      return (
        <Badge variant="warning" className="font-normal">
          <Clock className="size-3" /> Activating…
        </Badge>
      );
    case 'resetting':
      return (
        <Badge variant="warning" className="font-normal">
          <Loader2 className="size-3 animate-spin" /> Being fixed…
        </Badge>
      );
    case 'activation_failed':
      return (
        <Badge variant="destructive" className="font-normal">
          <XCircle className="size-3" /> Activation failed
        </Badge>
      );
    case 'suspended':
      return (
        <Badge variant="destructive" className="font-normal">
          <ShieldOff className="size-3" /> Suspended
        </Badge>
      );
    case 'disconnected':
      return (
        <Badge variant="warning" className="font-normal">
          <Link2Off className="size-3" /> Disconnected
        </Badge>
      );
    default:
      return (
        <Badge variant="warning" className="font-normal">
          <AlertCircle className="size-3" /> Not connected
        </Badge>
      );
  }
}

function WhatsAppPanel({
  status,
  wc,
  waStatus,
  onConnect,
  onDisconnect,
  connecting,
  disconnecting,
  fbReady,
  fbError,
  hasConfigId,
  hasSolutionId,
  numberInput,
  onNumberInputChange,
}) {
  if (status === 'active') {
    return (
      <ConnectedPanel
        wc={wc}
        onDisconnect={onDisconnect}
        disconnecting={disconnecting}
      />
    );
  }
  if (status === 'activating') {
    return <ActivatingPanel wc={wc} waStatus={waStatus} />;
  }
  if (status === 'resetting') {
    return <ResettingPanel wc={wc} />;
  }
  if (status === 'activation_failed') {
    return <ActivationFailedPanel wc={wc} />;
  }
  if (status === 'suspended') {
    return <SuspendedPanel wc={wc} />;
  }
  if (status === 'disconnected') {
    return (
      <DisconnectedPanel
        onReconnect={onConnect}
        reconnecting={connecting}
        fbReady={fbReady}
        fbError={fbError}
        hasConfigId={hasConfigId}
        hasSolutionId={hasSolutionId}
        numberInput={numberInput}
        onNumberInputChange={onNumberInputChange}
      />
    );
  }
  return (
    <NotConnectedPanel
      onConnect={onConnect}
      connecting={connecting}
      fbReady={fbReady}
      fbError={fbError}
      hasConfigId={hasConfigId}
      hasSolutionId={hasSolutionId}
      numberInput={numberInput}
      onNumberInputChange={onNumberInputChange}
    />
  );
}

/**
 * Shared number field + Connect button used by both the never-connected
 * and previously-disconnected panels. The number must be collected
 * before Meta's popup opens — Embedded Signup returns only IDs, and
 * Twilio's Senders API needs E.164 for `sender_id`.
 */
function WhatsAppNumberForm({
  numberInput,
  onNumberInputChange,
  onSubmit,
  busy,
  busyLabel,
  submitLabel,
  fbReady,
  fbError,
  hasConfigId,
  hasSolutionId,
}) {
  const normalized = normalizeE164(numberInput);
  const touched = numberInput.trim().length > 0;
  const valid = isValidE164(normalized);
  const configReady = hasConfigId && hasSolutionId;

  return (
    <div className="w-full max-w-sm space-y-3">
      <div className="space-y-1.5 text-left">
        <Label htmlFor="wa-number">WhatsApp number</Label>
        <Input
          id="wa-number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+919876543210"
          value={numberInput}
          onChange={(e) => onNumberInputChange(e.target.value)}
          disabled={busy}
          aria-invalid={touched && !valid}
        />
        <p className="text-[11px] text-muted-foreground">
          Include the country code. Use the exact number you'll register
          inside Meta's popup — they must match.
        </p>
        {touched && !valid && (
          <p className="text-[11px] text-destructive">
            Enter a valid international number, e.g. +919876543210.
          </p>
        )}
      </div>

      <Button
        onClick={onSubmit}
        disabled={busy || !fbReady || !configReady || !valid}
        className="w-full bg-[#25D366] text-white hover:bg-[#1ebe57]"
      >
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" /> {busyLabel}
          </>
        ) : (
          <>
            <MessageSquare className="size-4" /> {submitLabel}
          </>
        )}
      </Button>

      {!hasConfigId && (
        <p className="text-[11px] text-destructive">
          VITE_FACEBOOK_CONFIG_ID is missing. Add it to .env to enable this
          button.
        </p>
      )}
      {hasConfigId && !hasSolutionId && (
        <p className="text-[11px] text-destructive">
          VITE_FACEBOOK_SOLUTION_ID is missing. Without the Twilio Partner
          Solution ID, Meta won't share the WhatsApp account with Twilio and
          activation will fail.
        </p>
      )}
      {configReady && !fbReady && !fbError && (
        <p className="text-[11px] text-muted-foreground">Loading Meta SDK…</p>
      )}
      {fbError && (
        <p className="text-[11px] text-destructive">{fbError.message}</p>
      )}
    </div>
  );
}

function NotConnectedPanel({
  onConnect,
  connecting,
  fbReady,
  fbError,
  hasConfigId,
  hasSolutionId,
  numberInput,
  onNumberInputChange,
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-dashed bg-muted/20 px-6 py-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-[#25D366]/10">
        <MessageSquare className="size-6 text-[#25D366]" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">No WhatsApp number connected</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Enter the number you want to use, then connect through Meta's
          secure flow. Slotlii provisions messaging and submits your
          message templates for approval — usually done within minutes.
        </p>
      </div>
      <WhatsAppNumberForm
        numberInput={numberInput}
        onNumberInputChange={onNumberInputChange}
        onSubmit={onConnect}
        busy={connecting}
        busyLabel="Activating…"
        submitLabel="Connect WhatsApp"
        fbReady={fbReady}
        fbError={fbError}
        hasConfigId={hasConfigId}
        hasSolutionId={hasSolutionId}
      />
    </div>
  );
}

function ConnectedPanel({ wc, onDisconnect, disconnecting }) {
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-4 rounded-md border bg-muted/20 px-4 py-4 sm:grid-cols-2">
        <InfoItem label="Business name">
          {wc.businessDisplayName || <Muted>Not set</Muted>}
        </InfoItem>
        <InfoItem label="Phone number">
          {wc.whatsappNumber || <Muted>Not set</Muted>}
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

function ActivatingPanel({ wc }) {
  // Historically we surfaced a "N of M templates approved" progress
  // bar here. That leaked internal Slotlii machinery to clinic users
  // — they shouldn't know or care that message templates need Meta
  // approval; they just want to know WhatsApp is coming up.
  //
  // If clinics are curious about "why is this taking so long?", the
  // admin dashboard has the real answer. The clinic-facing copy stays
  // abstract and reassuring.
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-4 rounded-md border bg-muted/20 px-4 py-4 sm:grid-cols-2">
        <InfoItem label="Business name">
          {wc.businessDisplayName || <Muted>Not set</Muted>}
        </InfoItem>
        <InfoItem label="Phone number">
          {wc.whatsappNumber || <Muted>Not set</Muted>}
        </InfoItem>
      </dl>

      <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
        <Clock className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-2 w-full">
          <p className="font-medium">Setting things up on your behalf</p>
          <p className="text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/80">
            We're getting your WhatsApp number ready to send messages. This
            usually finishes within a few minutes but can occasionally take a
            few hours depending on Meta. You can safely leave this page — the
            status will update automatically here and on your dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}

function ResettingPanel({ wc }) {
  // Admin-triggered reset in progress (level: templates / sender /
  // full). No user-facing action is possible — status will flip
  // automatically once the reset completes and the clinic re-enters
  // its normal lifecycle (activating → active, or not_activated for
  // sender/full resets).
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-4 rounded-md border bg-muted/20 px-4 py-4 sm:grid-cols-2">
        <InfoItem label="Business name">
          {wc.businessDisplayName || <Muted>Not set</Muted>}
        </InfoItem>
        <InfoItem label="Phone number">
          {wc.whatsappNumber || <Muted>Not set</Muted>}
        </InfoItem>
      </dl>

      <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
        <div className="space-y-2 w-full">
          <p className="font-medium">Our team is looking into this</p>
          <p className="text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/80">
            The Slotlii team is currently fixing something with your WhatsApp
            setup. Sending is paused for a few minutes. Nothing is required
            from you — this page will refresh automatically when we're done.
          </p>
        </div>
      </div>
    </div>
  );
}

function ActivationFailedPanel({ wc }) {
  // We intentionally do NOT surface `wc.activationError` here — that
  // field contains raw error strings from Twilio/Meta that would only
  // confuse clinic staff (e.g. "Media URL with placeholder must be a
  // valid URL"). The admin dashboard shows the full detail; the
  // clinic-facing view stays abstract.
  //
  // We also removed the client-side "Retry activation" button. Retries
  // now require admin intervention via slotlii-admin-fe because most
  // failures are structural (bad template defs, Meta rejections, etc.)
  // that a retry won't fix on its own.
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-4 rounded-md border bg-muted/20 px-4 py-4 sm:grid-cols-2">
        <InfoItem label="Business name">
          {wc.businessDisplayName || <Muted>Not set</Muted>}
        </InfoItem>
        <InfoItem label="Phone number">
          {wc.whatsappNumber || <Muted>Not set</Muted>}
        </InfoItem>
      </dl>

      <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
        <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="space-y-2 w-full">
          <p className="font-medium">Something needs our attention</p>
          <p className="text-xs leading-relaxed text-destructive/90">
            Your WhatsApp activation ran into a problem. Our team has been
            notified and is working on it — you'll get an email as soon as
            it's fixed. If you need it resolved sooner, please email us at{' '}
            <a
              href="mailto:support@slotlii.com"
              className="font-medium underline underline-offset-2"
            >
              support@slotlii.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function SuspendedPanel({ wc }) {
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-4 rounded-md border bg-muted/20 px-4 py-4 sm:grid-cols-2">
        <InfoItem label="Business name">
          {wc.businessDisplayName || <Muted>Not set</Muted>}
        </InfoItem>
        <InfoItem label="Phone number">
          {wc.whatsappNumber || <Muted>Not set</Muted>}
        </InfoItem>
      </dl>
      <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
        <ShieldOff className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="space-y-1">
          <p className="font-medium">Suspended by Slotlii</p>
          <p className="text-xs leading-relaxed text-destructive/90">
            WhatsApp sending is temporarily suspended for this clinic. Please
            contact support@slotlii.com to resolve.
          </p>
        </div>
      </div>
    </div>
  );
}

function DisconnectedPanel({
  onReconnect,
  reconnecting,
  fbReady,
  fbError,
  hasConfigId,
  hasSolutionId,
  numberInput,
  onNumberInputChange,
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-dashed bg-muted/20 px-6 py-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-[#25D366]/10">
        <Link2Off className="size-6 text-[#25D366]" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">WhatsApp is disconnected</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Reconnecting reuses your existing Twilio setup — no template
          re-approval needed. Confirm the number below before continuing.
        </p>
      </div>
      <WhatsAppNumberForm
        numberInput={numberInput}
        onNumberInputChange={onNumberInputChange}
        onSubmit={onReconnect}
        busy={reconnecting}
        busyLabel="Reconnecting…"
        submitLabel="Reconnect WhatsApp"
        fbReady={fbReady}
        fbError={fbError}
        hasConfigId={hasConfigId}
        hasSolutionId={hasSolutionId}
      />
    </div>
  );
}
