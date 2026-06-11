import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  FileSignature,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

import * as api from '../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SignatureCanvas } from '@/components/doctor/SignatureCanvas';
import { ConsentDocument } from '@/components/consents/ConsentDocument';
import { trimSignatureDataUrl } from '@/utils/signatureTrim';

/**
 * Public, unauthenticated consent signing page.
 *
 * Routed at `/sign/consent/:token`. The token is generated when staff shares
 * a consent over WhatsApp. Once submitted, the page swaps to a thank-you
 * confirmation that the patient can keep open or close.
 */
export default function PublicConsentSign() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const [signerName, setSignerName] = useState('');
  const [signerRelation, setSignerRelation] = useState('self');
  const [signatureData, setSignatureData] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getPublicConsent(token);
        if (cancelled) return;
        const payload = res.data?.data;
        setData(payload);
        const reqGuardian = payload?.consent?.templateSnapshot?.requiresGuardian;
        setSignerRelation(reqGuardian ? 'guardian' : 'self');
        setSignerName(payload?.patient?.name || '');
      } catch (err) {
        if (cancelled) return;
        setError(
          err.response?.data?.error || 'This signing link is invalid or expired.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!signerName.trim()) {
      setSubmitError('Please enter your full name');
      return;
    }
    if (!signatureData) {
      setSubmitError('Please add your signature to continue');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const trimmed = await trimSignatureDataUrl(signatureData);
      const res = await api.signPublicConsent(token, {
        signerName: signerName.trim(),
        signerRelation,
        signatureData: trimmed || signatureData,
      });
      setData((prev) => ({
        ...prev,
        consent: { ...prev.consent, ...res.data?.data },
      }));
    } catch (err) {
      setSubmitError(
        err.response?.data?.error || 'Failed to record your signature. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <PublicShell>
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
          <p className="text-sm">Loading your consent form…</p>
        </div>
      </PublicShell>
    );
  }

  if (error) {
    return (
      <PublicShell>
        <ErrorPanel
          title="Link unavailable"
          message={error}
        />
      </PublicShell>
    );
  }

  const consent = data?.consent;
  const patient = data?.patient;
  const clinic = data?.clinic;

  if (!consent) {
    return (
      <PublicShell>
        <ErrorPanel
          title="Consent not found"
          message="We couldn't find a consent for this link."
        />
      </PublicShell>
    );
  }

  if (consent.status === 'expired') {
    return (
      <PublicShell>
        <ErrorPanel
          title="Link expired"
          message={`This signing link has expired. Please contact ${clinic?.name || 'the clinic'} to receive a new one.`}
        />
      </PublicShell>
    );
  }

  if (consent.status === 'signed') {
    return (
      <PublicShell>
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="size-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Thank you, your consent is recorded</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {clinic?.name || 'The clinic'} will see your signed form on
              their records. You can safely close this page.
            </p>
          </div>
        </div>
        <DocumentPaper>
          <ConsentDocument
            consent={consent}
            patient={patient}
            clinic={clinic}
            doctor={consent.doctor ? { name: consent.doctor } : null}
          />
        </DocumentPaper>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <FileSignature className="size-6" />
        </div>
        <h1 className="text-xl font-bold">Please review and sign</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          {clinic?.name || 'Your clinic'} has shared a consent form with you.
          Read it carefully, then enter your name and sign at the bottom to
          submit it.
        </p>
      </div>

      <DocumentPaper>
        <ConsentDocument
          consent={consent}
          patient={patient}
          clinic={clinic}
          doctor={consent.doctor ? { name: consent.doctor } : null}
        />
      </DocumentPaper>

      <form
        onSubmit={handleSubmit}
        className="mx-auto mt-6 max-w-2xl space-y-5 rounded-xl border bg-card p-6 shadow-sm"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4 text-primary" />
          Your signature
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pub-name">Full name *</Label>
          <Input
            id="pub-name"
            required
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="e.g. Mike Smith"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Signing as</Label>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pub-relation"
                value="self"
                checked={signerRelation === 'self'}
                onChange={() => setSignerRelation('self')}
              />
              Self (the patient)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pub-relation"
                value="guardian"
                checked={signerRelation === 'guardian'}
                onChange={() => setSignerRelation('guardian')}
              />
              Guardian / on behalf of patient
            </label>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Signature *</Label>
          <SignatureCanvas value={signatureData} onChange={setSignatureData} />
          <p className="text-[11px] text-muted-foreground">
            Use your finger or mouse to sign in the box above.
          </p>
        </div>

        {submitError ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={submitting || !signerName.trim() || !signatureData}
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Submitting…
            </>
          ) : (
            'Submit signed consent'
          )}
        </Button>
      </form>
    </PublicShell>
  );
}

function PublicShell({ children }) {
  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-3xl">{children}</div>
    </div>
  );
}

function DocumentPaper({ children }) {
  return (
    <div className="mx-auto w-full max-w-[820px] overflow-hidden rounded-lg bg-white shadow-md ring-1 ring-zinc-200">
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function ErrorPanel({ title, message }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center shadow-sm">
      <div className="flex size-14 items-center justify-center rounded-full bg-rose-100 text-rose-700">
        <AlertTriangle className="size-7" />
      </div>
      <h1 className="text-lg font-bold">{title}</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
