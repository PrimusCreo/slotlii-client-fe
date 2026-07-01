import { useEffect, useMemo, useState } from 'react';
import { Heart, Phone } from 'lucide-react';

import { PaginatedDocument } from '@/components/documents/PaginatedDocument';
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

const DOC_FONT_FAMILY =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial";

const CONSENT_BODY_CSS = `
  .rx-consent-body h1 { font-size: 16px; font-weight: 700; margin: 18px 0 8px; }
  .rx-consent-body h2 { font-size: 14px; font-weight: 700; margin: 16px 0 6px; color: ${PRIMARY}; }
  .rx-consent-body h3 { font-size: 13px; font-weight: 600; margin: 14px 0 6px; }
  .rx-consent-body p { margin: 0 0 10px; }
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
`;

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

function patientAge(patient) {
  const raw = patient?.age;
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function genderLabel(g) {
  if (!g) return '';
  const lc = String(g).toLowerCase();
  return lc.charAt(0).toUpperCase() + lc.slice(1);
}

function ageGenderLine(patient) {
  const age = patientAge(patient);
  const gender = genderLabel(patient?.gender);
  const parts = [];
  if (age !== null) parts.push(`${age} yrs`);
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
 * Break the consent's rendered body HTML into an array of top-level
 * element strings — each becomes its own paginatable block. This lets
 * pagination happen at natural authoring boundaries (headings, paragraphs,
 * list items) instead of dumping the whole body as one atomic block that
 * would spill past a single page for long templates.
 */
function splitBodyHtmlIntoBlocks(bodyHtml) {
  if (!bodyHtml) return [];
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    // SSR fallback — treat the whole body as one block. Not perfect,
    // but the print route (which runs in a real browser) does the real
    // work so this only hits during server-rendered previews.
    return [bodyHtml];
  }
  const doc = new DOMParser().parseFromString(
    `<div id="__root">${bodyHtml}</div>`,
    'text/html',
  );
  const root = doc.getElementById('__root');
  if (!root) return [bodyHtml];
  const blocks = [];
  root.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      // Stray text node (whitespace between block elements) — skip if
      // empty, otherwise wrap so it renders alongside real blocks.
      const text = node.textContent || '';
      if (!text.trim()) return;
      blocks.push(`<p>${escapeHtml(text)}</p>`);
      return;
    }
    if (node.nodeType === 1) {
      // Long lists (<ul> / <ol>) can themselves exceed a page — split
      // them into per-item blocks so each list item is its own atomic
      // unit and the packer can spread them naturally.
      const el = /** @type {Element} */ (node);
      const tag = el.tagName.toLowerCase();
      if (tag === 'ul' || tag === 'ol') {
        el.querySelectorAll(':scope > li').forEach((li) => {
          blocks.push(`<${tag}>${li.outerHTML}</${tag}>`);
        });
        return;
      }
      blocks.push(el.outerHTML);
    }
  });
  return blocks;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function FallbackHeader({ clinic }) {
  const clinicName = clinic?.name || 'Clinic';
  const clinicAddress = clinic?.address;
  const clinicLogoUrl = clinic?.logoUrl;
  const clinicPhones = [clinic?.phone, ...(clinic?.additionalPhones || [])]
    .map((p) => (p ? String(p).trim() : ''))
    .filter(Boolean);

  return (
    <div className="px-10 pt-6 pb-3">
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 items-start gap-3">
          {clinicLogoUrl ? (
            <img
              src={clinicLogoUrl}
              alt={`${clinicName} logo`}
              className="size-12 shrink-0 rounded-md object-cover"
              style={{ border: `1px solid ${PRIMARY_BORDER}` }}
            />
          ) : null}
          <div className="min-w-0">
            <h1
              className="text-[20px] font-bold leading-tight"
              style={{ color: TEXT }}
            >
              {clinicName}
            </h1>
            {clinicAddress ? (
              <p
                className="mt-1 max-w-[360px] whitespace-pre-line text-[11px] leading-relaxed"
                style={{ color: TEXT_MUTED }}
              >
                {clinicAddress}
              </p>
            ) : null}
            {clinicPhones.length ? (
              <div
                className="mt-1 inline-flex items-center gap-1.5 text-[11px]"
                style={{ color: TEXT_MUTED }}
              >
                <Phone className="size-3" style={{ color: PRIMARY }} />
                <span>{clinicPhones.join(' · ')}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div
          className="shrink-0 rounded-md px-4 py-2 text-[13px] font-bold tracking-wider text-white"
          style={{ backgroundColor: PRIMARY }}
        >
          PATIENT CONSENT
        </div>
      </div>
      <div className="mt-3 h-px" style={{ backgroundColor: PRIMARY_BORDER }} />
    </div>
  );
}

function FallbackFooter() {
  // Attribution moved to the system-footer strip; keep only the clinic
  // thank-you line here so the two rows don't restate the same info.
  return (
    <div
      className="flex items-center border-t px-10 py-3 text-[10.5px]"
      style={{ borderColor: PRIMARY_BORDER, color: TEXT_MUTED }}
    >
      <span className="inline-flex items-center gap-1.5">
        <Heart className="size-3 fill-current" style={{ color: PRIMARY }} />
        Thank you for trusting us with your care.
      </span>
    </div>
  );
}

/**
 * Visual representation of a consent entry. Renders the snapshotted
 * Markdown / HTML with placeholders filled in, spread across as many
 * A4 pages as the body needs. Each page repeats the clinic letterhead
 * (or the auto-generated header/footer if none is uploaded).
 */
export function ConsentDocument({
  consent,
  patient,
  clinic,
  doctor,
  mode = 'preview',
  onReady,
}) {
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

  const snap = consent?.templateSnapshot || {};
  const filled = consent?.filledValues || {};
  const title = fillPlaceholders(
    snap.title || snap.name || 'Consent Form',
    filled,
  );
  const bodyHtml = snap.bodyHtml
    ? fillHtmlVariables(snap.bodyHtml, filled)
    : markdownToHtml(fillPlaceholders(snap.bodyMarkdown || '', filled));

  // Split the rich-text body into per-element chunks so pagination
  // can break between paragraphs / headings / list items. Memoized on
  // the raw HTML — parsing DOM strings on every render would be waste.
  const bodyChunks = useMemo(
    () => splitBodyHtmlIntoBlocks(bodyHtml),
    [bodyHtml],
  );

  if (!consent) return null;

  const letterheadHeaderUrl = clinic?.letterhead?.header?.url;
  const letterheadFooterUrl = clinic?.letterhead?.footer?.url;

  const doctorName = doctor?.name || consent.doctor || '';
  const doctorQualifications = doctor?.qualifications || '';
  const doctorSpec = doctor?.specialization || '';

  const isSigned = consent.status === 'signed';

  const blocks = [
    ...(letterheadHeaderUrl
      ? [
          {
            id: 'meta-strip',
            node: (
              <div className="pb-3">
                <div className="flex items-center justify-between gap-4 text-[12px]">
                  <span
                    className="font-bold tracking-wider"
                    style={{ color: PRIMARY }}
                  >
                    PATIENT CONSENT
                  </span>
                  <span style={{ color: TEXT_MUTED }}>
                    Date:{' '}
                    <span className="font-semibold" style={{ color: TEXT }}>
                      {formatDate(consent.date) || '—'}
                    </span>
                  </span>
                </div>
                <div
                  className="mt-2 h-px"
                  style={{ backgroundColor: PRIMARY_BORDER }}
                />
              </div>
            ),
          },
        ]
      : []),
    {
      id: 'title',
      node: (
        <h2 className="text-[18px] font-bold" style={{ color: TEXT }}>
          {title}
        </h2>
      ),
    },
    {
      id: 'patient-details',
      node: (
        <div
          className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 rounded-md border px-4 py-3"
          style={{ borderColor: PRIMARY_BORDER, backgroundColor: PRIMARY_SOFT }}
        >
          <InfoCell label="Patient Name" value={patient?.name} />
          <InfoCell label="Date" value={formatDate(consent.date)} />
          <InfoCell label="Age / Gender" value={ageGenderLine(patient)} />
          <InfoCell label="Phone" value={patient?.phone} />
        </div>
      ),
    },
    ...(doctorName
      ? [
          {
            id: 'doctor-line',
            node: (
              <p className="mt-3 text-[12px]" style={{ color: TEXT_MUTED }}>
                Doctor:{' '}
                <span style={{ color: TEXT, fontWeight: 600 }}>{doctorName}</span>
                {doctorSpec ? ` · ${doctorSpec}` : ''}
                {doctorQualifications ? ` · ${doctorQualifications}` : ''}
              </p>
            ),
          },
        ]
      : []),
    { id: 'body-gap', node: <div className="h-4" /> },
    ...bodyChunks.map((html, i) => ({
      id: `body-${i}`,
      node: (
        <div
          className="rx-consent-body text-[13px] leading-relaxed"
          style={{ color: TEXT }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ),
    })),
    { id: 'signature-gap', node: <div className="h-6" /> },
    {
      id: 'signature',
      node: (
        <div
          className="flex items-end justify-between gap-6 border-t pt-4"
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
      ),
    },
  ];

  return (
    <div
      style={{
        color: TEXT,
        fontFamily: DOC_FONT_FAMILY,
      }}
    >
      <style>{CONSENT_BODY_CSS}</style>
      <PaginatedDocument
        blocks={blocks}
        letterheadHeaderUrl={letterheadHeaderUrl}
        letterheadFooterUrl={letterheadFooterUrl}
        renderFallbackHeader={() => <FallbackHeader clinic={clinic} />}
        renderFallbackFooter={() => <FallbackFooter />}
        mode={mode}
        onReady={onReady}
      />
    </div>
  );
}
