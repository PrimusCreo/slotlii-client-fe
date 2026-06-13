import { useEffect, useState } from 'react';
import { Heart, Phone } from 'lucide-react';

import {
  fillHtmlVariables,
  fillPlaceholders,
  markdownToHtml,
} from '@/utils/consentMarkdown';
import { trimSignatureDataUrl } from '@/utils/signatureTrim';

const PRIMARY = '#fe6e00';
const PRIMARY_SOFT = '#FFFAF5';
const PRIMARY_BORDER = '#FFD7B5';
const TEXT = '#1f2937';
const TEXT_MUTED = '#6b7280';

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${formatDate(d)} ${d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function calcAge(dob) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  if (Number.isNaN(diff)) return null;
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

function genderLabel(g) {
  if (!g) return '';
  const lc = String(g).toLowerCase();
  return lc.charAt(0).toUpperCase() + lc.slice(1);
}

function ageGenderLine(patient) {
  const age = calcAge(patient?.dateOfBirth);
  const gender = genderLabel(patient?.gender);
  const parts = [];
  if (age != null && !Number.isNaN(age)) parts.push(`${age} yrs`);
  if (gender) parts.push(gender);
  return parts.join(' / ') || '—';
}

function InfoCell({ label, value }) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className="shrink-0 text-[11px] font-medium"
        style={{ color: TEXT_MUTED }}
      >
        {label}
      </span>
      <span className="text-[11px]" style={{ color: TEXT_MUTED }}>
        :
      </span>
      <span className="truncate text-[13px] font-semibold" style={{ color: TEXT }}>
        {value || '—'}
      </span>
    </div>
  );
}

/**
 * Visual representation of a consent entry. Renders the snapshotted Markdown
 * with placeholders filled in. Used by the staff viewer, the printable sheet
 * and the public signing page (when `forSigning` is false).
 */
export function ConsentDocument({ consent, patient, clinic, doctor }) {
  const rawSignature = consent?.patientSignatureData || '';
  const [displaySignature, setDisplaySignature] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!rawSignature) {
      setDisplaySignature('');
      return undefined;
    }
    trimSignatureDataUrl(rawSignature).then((trimmed) => {
      if (!cancelled) setDisplaySignature(trimmed);
    });
    return () => {
      cancelled = true;
    };
  }, [rawSignature]);

  if (!consent) return null;

  const snap = consent.templateSnapshot || {};
  const filled = consent.filledValues || {};
  const title = fillPlaceholders(snap.title || snap.name || 'Consent Form', filled);
  // Prefer the rich-text body authored in the visual editor; fall back to the
  // legacy markdown column for older snapshots.
  const bodyHtml = snap.bodyHtml
    ? fillHtmlVariables(snap.bodyHtml, filled)
    : markdownToHtml(fillPlaceholders(snap.bodyMarkdown || '', filled));

  const clinicName = clinic?.name || 'Clinic';
  const clinicAddress = clinic?.address;
  const clinicPhone = clinic?.phone;

  const doctorName = doctor?.name || consent.doctor || '';
  const doctorQualifications = doctor?.qualifications || '';
  const doctorSpec = doctor?.specialization || '';

  const isSigned = consent.status === 'signed';

  return (
    <div
      className="mx-auto flex w-full max-w-[820px] flex-1 flex-col bg-white"
      style={{
        color: TEXT,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-6 px-8 pt-8">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight" style={{ color: TEXT }}>
            {clinicName}
          </h1>
          {clinicAddress ? (
            <p
              className="mt-1.5 max-w-[360px] whitespace-pre-line text-[12px] leading-relaxed"
              style={{ color: TEXT_MUTED }}
            >
              {clinicAddress}
            </p>
          ) : null}
          {clinicPhone ? (
            <div
              className="mt-2 inline-flex items-center gap-1.5 text-[12px]"
              style={{ color: TEXT_MUTED }}
            >
              <Phone className="size-3" style={{ color: PRIMARY }} />
              <span>{clinicPhone}</span>
            </div>
          ) : null}
        </div>

        <div
          className="shrink-0 rounded-md px-5 py-2.5 text-[14px] font-bold tracking-wider text-white"
          style={{ backgroundColor: PRIMARY }}
        >
          PATIENT CONSENT
        </div>
      </div>

      <div
        className="mx-8 mt-5 h-px"
        style={{ backgroundColor: PRIMARY_BORDER }}
      />

      {/* Title */}
      <h2 className="mx-8 mt-5 text-[18px] font-bold" style={{ color: TEXT }}>
        {title}
      </h2>

      {/* Patient details */}
      <div
        className="mx-8 mt-4 grid grid-cols-2 gap-x-6 gap-y-2 rounded-md border px-4 py-3"
        style={{ borderColor: PRIMARY_BORDER, backgroundColor: PRIMARY_SOFT }}
      >
        <InfoCell label="Patient Name" value={patient?.name} />
        <InfoCell label="Date" value={formatDate(consent.date)} />
        <InfoCell label="Age / Gender" value={ageGenderLine(patient)} />
        <InfoCell label="Phone" value={patient?.phone} />
      </div>

      {doctorName ? (
        <p
          className="mx-8 mt-3 text-[12px]"
          style={{ color: TEXT_MUTED }}
        >
          Doctor: <span style={{ color: TEXT, fontWeight: 600 }}>{doctorName}</span>
          {doctorSpec ? ` · ${doctorSpec}` : ''}
          {doctorQualifications ? ` · ${doctorQualifications}` : ''}
        </p>
      ) : null}

      {/* Body */}
      <div
        className="rx-consent-body mx-8 mt-5 text-[13px] leading-relaxed"
        style={{ color: TEXT }}
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />

      <style>{`
        .rx-consent-body h1 { font-size: 16px; font-weight: 700; margin: 18px 0 8px; }
        .rx-consent-body h2 { font-size: 14px; font-weight: 700; margin: 16px 0 6px; color: ${PRIMARY}; }
        .rx-consent-body h3 { font-size: 13px; font-weight: 600; margin: 14px 0 6px; }
        .rx-consent-body p { margin: 0 0 10px; }
        /* Tailwind's preflight resets list-style; restore it explicitly so
           the rendered document (and its print output) matches the PDF. */
        .rx-consent-body ul {
          margin: 0 0 12px 22px;
          padding-left: 0;
          list-style: disc outside;
        }
        .rx-consent-body ol {
          margin: 0 0 12px 22px;
          padding-left: 0;
          list-style: decimal outside;
        }
        .rx-consent-body li { margin-bottom: 4px; padding-left: 4px; }
        .rx-consent-body li::marker { color: ${PRIMARY}; font-weight: 600; }
        .rx-consent-body strong { font-weight: 600; }
      `}</style>

      <div className="flex-1" />

      {/* Signature */}
      <div className="mx-8 mt-8 flex items-end justify-between gap-6 border-t pb-6 pt-4"
        style={{ borderColor: PRIMARY_BORDER }}
      >
        <div>
          <div className="text-[11px]" style={{ color: TEXT_MUTED }}>
            {consent.signerRelation === 'guardian'
              ? 'Signed by Guardian'
              : 'Signed by Patient'}
          </div>
          {isSigned && displaySignature ? (
            <img
              src={displaySignature}
              alt=""
              className="mt-2 h-16 max-w-[240px] object-contain object-left"
            />
          ) : (
            <div
              className="mt-2 flex h-16 w-[240px] items-center justify-center rounded-md border border-dashed text-[11px]"
              style={{ borderColor: PRIMARY_BORDER, color: TEXT_MUTED }}
            >
              Awaiting signature
            </div>
          )}
        </div>

        <div className="text-right">
          {consent.signerName ? (
            <div className="text-[13px] font-bold" style={{ color: TEXT }}>
              {consent.signerName}
            </div>
          ) : null}
          {consent.signerRelation === 'guardian' ? (
            <div className="text-[11px]" style={{ color: TEXT_MUTED }}>
              Guardian
            </div>
          ) : null}
          {consent.signedAt ? (
            <div className="text-[11px]" style={{ color: TEXT_MUTED }}>
              Signed at {formatDateTime(consent.signedAt)}
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between border-t px-8 py-3 text-[11px]"
        style={{ borderColor: PRIMARY_BORDER, color: TEXT_MUTED }}
      >
        <span className="inline-flex items-center gap-1.5">
          <Heart className="size-3 fill-current" style={{ color: PRIMARY }} />
          Thank you for trusting us with your care.
        </span>
        <span>
          Generated via{' '}
          <span className="font-semibold" style={{ color: PRIMARY }}>
            Slotlii
          </span>{' '}
          Clinic OS
        </span>
      </div>
    </div>
  );
}
