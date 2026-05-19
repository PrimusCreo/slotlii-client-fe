import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  Link2Off,
  Loader2,
  MessageSquare,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const FB_CONFIG_ID = import.meta.env.VITE_FACEBOOK_CONFIG_ID;

export default function Settings() {
  const { selectedClinic, selectedClinicId, setSelectedClinic } = useClinic();
  const { ready: fbReady, error: fbError } = useFacebookSdk();

  const [waForm, setWaForm] = useState({
    apiUrl: '',
    phoneNumberId: '',
    accessToken: '',
    verifyToken: '',
  });
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [savingWA, setSavingWA] = useState(false);
  const [connectingWA, setConnectingWA] = useState(false);
  const [disconnectingWA, setDisconnectingWA] = useState(false);

  const wc = selectedClinic?.whatsappConfig || {};
  const waConfigured = !!(wc.phoneNumberId && wc.accessToken);
  const connectedViaSignup = wc.tokenSource === 'embedded_signup';

  // Cache the phone_number_id + waba_id that Meta posts during the popup
  // flow. Meta sends these via window.postMessage, separately from the
  // OAuth `code` that arrives in the FB.login callback.
  const signupAssetsRef = useRef({ phoneNumberId: null, wabaId: null });

  useEffect(() => {
    if (selectedClinic?.whatsappConfig) {
      const c = selectedClinic.whatsappConfig;
      setWaForm({
        apiUrl: c.apiUrl || 'https://graph.facebook.com/v25.0',
        phoneNumberId: c.phoneNumberId || '',
        accessToken: c.accessToken || '',
        verifyToken: c.verifyToken || '',
      });
    }
  }, [selectedClinic]);

  // Listen for Meta's WA_EMBEDDED_SIGNUP postMessage. It fires once the
  // user finishes adding their phone number inside the popup, before
  // FB.login's callback resolves.
  useEffect(() => {
    function handleSignupMessage(event) {
      if (!event.origin || !event.origin.endsWith('facebook.com')) return;
      try {
        const data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
        // v4 may emit FINISH, FINISH_ONLY_WABA, FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING,
        // FINISH_OBO_MIGRATION, FINISH_GRANT_ONLY_API_ACCESS — all indicate success and carry IDs.
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

  async function handleSaveWhatsApp(e) {
    e.preventDefault();
    if (!selectedClinicId) return;

    if (!waForm.phoneNumberId || !waForm.accessToken) {
      toast.error('Phone Number ID and Access Token are required');
      return;
    }

    setSavingWA(true);
    try {
      const res = await api.updateClinic(selectedClinicId, {
        whatsappConfig: {
          ...wc,
          apiUrl: waForm.apiUrl || 'https://graph.facebook.com/v25.0',
          phoneNumberId: waForm.phoneNumberId,
          accessToken: waForm.accessToken,
          verifyToken: waForm.verifyToken,
          tokenSource: 'manual',
        },
      });
      setSelectedClinic(res.data.data);
      toast.success('WhatsApp configuration saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save WhatsApp config');
    } finally {
      setSavingWA(false);
    }
  }

  return (
    <Layout title="Settings">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Clinic configuration & integrations.
        </p>
      </div>

      <div className="grid max-w-4xl gap-4">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              Clinic profile
            </CardTitle>
            <CardDescription>Basic information about your clinic.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {selectedClinic ? (
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <InfoItem label="Name">{selectedClinic.name}</InfoItem>
                <InfoItem label="Phone">{selectedClinic.phone}</InfoItem>
                <InfoItem label="Working hours">
                  {selectedClinic.workingHours?.start} – {selectedClinic.workingHours?.end}
                </InfoItem>
                <InfoItem label="Slot duration">
                  {selectedClinic.slotDuration} minutes
                </InfoItem>
                <InfoItem label="Address">{selectedClinic.address || '—'}</InfoItem>
                <InfoItem label="Status">
                  <Badge variant="success" className="font-normal">
                    Active
                  </Badge>
                </InfoItem>
              </dl>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
                <Building2 className="size-6" />
                <p className="text-sm">No clinic selected</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-end justify-between border-b">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="size-4 text-[#25D366]" />
                WhatsApp Cloud API
              </CardTitle>
              <CardDescription>
                Configure WhatsApp Business API credentials for the chatbot.
              </CardDescription>
            </div>
            {waConfigured ? (
              <Badge variant="success" className="font-normal">
                <CheckCircle2 className="size-3" /> Configured
              </Badge>
            ) : (
              <Badge variant="warning" className="font-normal">
                <AlertCircle className="size-3" /> Not configured
              </Badge>
            )}
          </CardHeader>
          <CardContent className="pt-6">
            {waConfigured ? (
              <ConnectedPanel
                wc={wc}
                connectedViaSignup={connectedViaSignup}
                onDisconnect={handleDisconnect}
                disconnecting={disconnectingWA}
              />
            ) : (
              <NotConnectedPanel
                onConnect={handleEmbeddedSignup}
                connecting={connectingWA}
                fbReady={fbReady}
                fbError={fbError}
                hasConfigId={!!FB_CONFIG_ID}
              />
            )}

            <details className="mt-6 rounded-md border bg-muted/20">
              <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
                <span className="inline-flex items-center gap-2">
                  <SettingsIcon className="size-3.5" />
                  Advanced: enter credentials manually
                </span>
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t px-4 py-5">
                <div className="mb-4 flex items-start gap-2 rounded-md border bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                  <p>
                    Use this only for self-managed test numbers. Production
                    clinics should use the Connect WhatsApp button above —
                    Meta's flow handles OTP verification, business naming and
                    long-lived token issuance automatically.
                  </p>
                </div>
                <a
                  href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  View Meta setup guide <ExternalLink className="size-3" />
                </a>

                <form onSubmit={handleSaveWhatsApp} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="wa-url">API URL</Label>
                <Input
                  id="wa-url"
                  value={waForm.apiUrl}
                  onChange={(e) => setWaForm({ ...waForm, apiUrl: e.target.value })}
                  placeholder="https://graph.facebook.com/v25.0"
                />
                <p className="text-xs text-muted-foreground">
                  Default: <code className="rounded bg-muted px-1 py-0.5 text-[11px]">https://graph.facebook.com/v25.0</code>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wa-phone">
                  Phone Number ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="wa-phone"
                  value={waForm.phoneNumberId}
                  onChange={(e) =>
                    setWaForm({ ...waForm, phoneNumberId: e.target.value })
                  }
                  placeholder="e.g. 971751466032870"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Found in Meta Developer Dashboard → WhatsApp → API Setup.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wa-token">
                  Access Token <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="wa-token"
                    type={showAccessToken ? 'text' : 'password'}
                    value={waForm.accessToken}
                    onChange={(e) =>
                      setWaForm({ ...waForm, accessToken: e.target.value })
                    }
                    placeholder="Paste your permanent access token"
                    required
                    className="pr-10 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccessToken((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showAccessToken ? 'Hide token' : 'Show token'}
                  >
                    {showAccessToken ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Generate a permanent token from System Users in Meta Business Settings.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wa-verify">Verify Token</Label>
                <Input
                  id="wa-verify"
                  value={waForm.verifyToken}
                  onChange={(e) =>
                    setWaForm({ ...waForm, verifyToken: e.target.value })
                  }
                  placeholder="e.g. my_custom_verify_token"
                />
                <p className="text-xs text-muted-foreground">
                  A custom string set in the Meta webhook for verification.
                </p>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={savingWA}>
                  {savingWA ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  {savingWA ? 'Saving…' : 'Save WhatsApp config'}
                </Button>
              </div>
                </form>
              </div>
            </details>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="size-4 text-primary" />
              API configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Backend API URL</Label>
              <Input defaultValue="http://localhost:3000" disabled />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp bot status</Label>
              <div className="flex flex-wrap items-center gap-2">
                {waConfigured ? (
                  <>
                    <Badge variant="success" className="font-normal">
                      Connected
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      via Meta Cloud API
                    </span>
                  </>
                ) : (
                  <>
                    <Badge variant="warning" className="font-normal">
                      Not connected
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Configure above to connect
                    </span>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
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

function NotConnectedPanel({
  onConnect,
  connecting,
  fbReady,
  fbError,
  hasConfigId,
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-md border bg-primary/5 px-4 py-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="space-y-1.5 text-muted-foreground">
          <p>
            Connect your clinic's WhatsApp number in one click. Meta will guide
            you through verifying the number, naming your business, and granting
            Slotlii permission to send messages on your behalf. No tokens to
            copy and paste.
          </p>
          <a
            href="https://developers.facebook.com/docs/whatsapp/embedded-signup"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            How Embedded Signup works <ExternalLink className="size-3" />
          </a>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-md border border-dashed bg-muted/20 px-6 py-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-[#25D366]/10">
          <MessageSquare className="size-6 text-[#25D366]" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">No WhatsApp number connected</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Click below to launch Meta's secure onboarding popup. You will need
            access to the phone number you want to register (for OTP).
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
          <p className="text-[11px] text-muted-foreground">
            Loading Meta SDK…
          </p>
        )}
        {fbError && (
          <p className="text-[11px] text-destructive">{fbError.message}</p>
        )}
      </div>
    </div>
  );
}

function ConnectedPanel({ wc, connectedViaSignup, onDisconnect, disconnecting }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-md border bg-emerald-500/5 px-4 py-3 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <div className="space-y-1 text-muted-foreground">
          <p className="font-medium text-foreground">
            WhatsApp is connected and ready to receive messages.
          </p>
          <p className="text-xs">
            {connectedViaSignup
              ? 'Onboarded via Meta Embedded Signup. Tokens are managed automatically.'
              : 'Configured manually. Switch to Embedded Signup for managed tokens.'}
          </p>
        </div>
      </div>

      <dl className="grid gap-x-6 gap-y-4 rounded-md border bg-muted/20 px-4 py-4 sm:grid-cols-2">
        <InfoItem label="Business name">
          {wc.verifiedName || <span className="text-muted-foreground">—</span>}
        </InfoItem>
        <InfoItem label="Phone number">
          {wc.displayPhoneNumber || (
            <span className="text-muted-foreground">—</span>
          )}
        </InfoItem>
        <InfoItem label="Phone number ID">
          <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px]">
            {wc.phoneNumberId}
          </code>
        </InfoItem>
        <InfoItem label="WABA ID">
          {wc.wabaId ? (
            <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px]">
              {wc.wabaId}
            </code>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </InfoItem>
        {wc.connectedAt && (
          <InfoItem label="Connected">
            {new Date(wc.connectedAt).toLocaleString()}
          </InfoItem>
        )}
        <InfoItem label="Source">
          <Badge
            variant={connectedViaSignup ? 'success' : 'warning'}
            className="font-normal"
          >
            {connectedViaSignup ? 'Embedded Signup' : 'Manual'}
          </Badge>
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
          {disconnecting ? 'Disconnecting…' : 'Disconnect WhatsApp'}
        </Button>
      </div>
    </div>
  );
}
