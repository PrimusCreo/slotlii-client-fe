import { Heart, Phone } from 'lucide-react';

import { PaginatedDocument } from '@/components/documents/PaginatedDocument';

const PRIMARY = '#fe6e00';
const PRIMARY_TINT = '#FFF4EB';
const PRIMARY_SOFT = '#FFFAF5';
const PRIMARY_BORDER = '#FFD7B5';
const TEXT = '#1f2937';
const TEXT_MUTED = '#6b7280';

const DOC_FONT_FAMILY =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial";

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

function buildPrescriptionId(prescription) {
  const d = prescription?.date ? new Date(prescription.date) : new Date();
  const yy = String(d.getFullYear() % 100).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const id = String(prescription?._id || '').replace(/[^a-zA-Z0-9]/g, '');
  const suffix = id ? id.slice(-4).toUpperCase() : '0001';
  return `RX${yy}${mm}${dd}${suffix}`;
}

function formatFollowUp(value) {
  if (!value) return '';
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return formatDate(str);
  const d = new Date(str);
  if (!Number.isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(str)) {
    return formatDate(str);
  }
  return str;
}

function splitBullets(text) {
  if (!text) return null;
  const items = String(text)
    .split(/\r?\n/)
    .map((s) => s.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean);
  return items.length ? items : null;
}

/**
 * Compose the "Treatment Done" string. See the backend `prescriptionPdf`
 * for the mirroring logic — kept identical here so the on-screen preview
 * and the printed PDF list the same bullets in the same order.
 */
function formatTreatmentDone(prescription) {
  const items = Array.isArray(prescription?.treatmentDoneItems)
    ? prescription.treatmentDoneItems
    : [];
  const lines = [];
  for (const item of items) {
    const name = (item?.name || '').trim();
    const note = (item?.note || '').trim();
    if (!name && !note) continue;
    if (name && note) lines.push(`${name} \u2014 ${note}`);
    else lines.push(name || note);
  }
  if (lines.length) return lines.join('\n');
  // Legacy fallbacks — `condition` intentionally excluded so it doesn't
  // duplicate the dedicated "Diagnosis" row rendered below.
  return prescription?.treatmentDone || prescription?.assessmentPlan || '';
}

// ── Building blocks ──────────────────────────────────────

function ClinicalRow({ label, value, striped }) {
  if (!value) return null;
  const bullets = splitBullets(value);
  const isList = bullets && bullets.length > 1;
  return (
    <div
      className="grid grid-cols-[200px_16px_1fr] items-start gap-x-3 border-l-[3px] px-5 py-3.5"
      style={{
        borderColor: PRIMARY,
        backgroundColor: striped ? PRIMARY_SOFT : '#ffffff',
      }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: PRIMARY }}
      >
        {label}
      </div>
      <div className="text-[11px] font-semibold" style={{ color: PRIMARY }}>
        :
      </div>
      <div className="text-[13px] leading-relaxed" style={{ color: TEXT }}>
        {isList ? (
          <ul className="list-disc space-y-1 pl-4">
            {bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        ) : (
          <p className="whitespace-pre-line">{value}</p>
        )}
      </div>
    </div>
  );
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
      <span
        className="truncate text-[13px] font-semibold"
        style={{ color: TEXT }}
      >
        {value || '—'}
      </span>
    </div>
  );
}

/**
 * The compact "meta strip" that identifies the document at the top of
 * page 1 — used both when the clinic uploaded a letterhead (the strip
 * lives inside the content region under the artwork) and as part of
 * the auto-generated fallback header.
 */
function MetaStrip({ rxId, date }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[12px]">
      <span className="font-bold tracking-wider" style={{ color: PRIMARY }}>
        PRESCRIPTION
      </span>
      <span style={{ color: TEXT_MUTED }}>
        Rx ID:{' '}
        <span className="font-semibold" style={{ color: TEXT }}>
          {rxId}
        </span>
        {'   ·   '}Date:{' '}
        <span className="font-semibold" style={{ color: TEXT }}>
          {date || '—'}
        </span>
      </span>
    </div>
  );
}

/**
 * The auto-generated clinic header block used when no letterhead is
 * uploaded. Rendered inside `PaginatedDocument`'s header slot so it
 * repeats on every page.
 */
function FallbackHeader({ clinic, rxId, prescription }) {
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

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div
            className="flex items-center gap-2 rounded-md px-4 py-2 text-white"
            style={{ backgroundColor: PRIMARY }}
          >
            <span className="text-[13px] font-bold tracking-wider">
              PRESCRIPTION
            </span>
            <span
              className="flex size-6 items-center justify-center rounded-md bg-white text-[13px] font-bold"
              style={{ color: PRIMARY, fontFamily: 'Georgia, serif' }}
            >
              ℞
            </span>
          </div>
          <div className="text-[10.5px]" style={{ color: TEXT_MUTED }}>
            {formatDate(prescription?.date) || '—'} · Rx :{' '}
            <span className="font-semibold" style={{ color: TEXT }}>
              {rxId}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 h-px" style={{ backgroundColor: PRIMARY_BORDER }} />
    </div>
  );
}

function FallbackFooter() {
  // The Slotlii attribution now lives in the system-footer strip
  // rendered by PaginatedDocument, so this fallback footer only needs
  // to carry the clinic's "thank you" note.
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

// ── Table pieces ─────────────────────────────────────────

const MED_COL_WIDTHS = ['36px', '160px', '72px', '92px', '72px', '1fr'];

function MedsSectionTitle() {
  return (
    <div className="flex items-center gap-3">
      <span
        className="inline-block h-4 w-[3px]"
        style={{ backgroundColor: PRIMARY }}
      />
      <span
        className="text-[12px] font-semibold uppercase tracking-[0.1em]"
        style={{ color: PRIMARY }}
      >
        Prescription
      </span>
    </div>
  );
}

/**
 * Table header row + first row wrapper. The `borderTop` /
 * `borderBottom` on the row divs create the illusion of a single
 * bordered table even though every row is a standalone block that the
 * pagination layer can freely rearrange.
 */
function MedsTableHeader() {
  const headerCells = ['#', 'Medicine', 'Dose', 'Frequency', 'Duration', 'Instructions'];
  return (
    <div
      className="grid rounded-t-md border text-[10.5px] font-semibold uppercase tracking-wider"
      style={{
        gridTemplateColumns: MED_COL_WIDTHS.join(' '),
        borderColor: PRIMARY_BORDER,
        backgroundColor: PRIMARY_TINT,
        color: PRIMARY,
      }}
    >
      {headerCells.map((h, i) => (
        <div key={i} className="px-3 py-2.5">
          {h}
        </div>
      ))}
    </div>
  );
}

function MedsTableRow({ index, med, isLast }) {
  return (
    <div
      className="grid border-x border-b text-[12.5px]"
      style={{
        gridTemplateColumns: MED_COL_WIDTHS.join(' '),
        borderColor: PRIMARY_BORDER,
        backgroundColor: index % 2 === 1 ? PRIMARY_SOFT : '#ffffff',
        borderBottomLeftRadius: isLast ? 6 : undefined,
        borderBottomRightRadius: isLast ? 6 : undefined,
      }}
    >
      <div className="px-3 py-2.5 tabular-nums" style={{ color: TEXT_MUTED }}>
        {index + 1}
      </div>
      <div className="px-3 py-2.5 font-medium" style={{ color: TEXT }}>
        {med.name || '—'}
      </div>
      <div className="px-3 py-2.5" style={{ color: TEXT }}>
        {med.dosage || '—'}
      </div>
      <div className="px-3 py-2.5" style={{ color: TEXT }}>
        {med.frequency || '—'}
      </div>
      <div className="px-3 py-2.5" style={{ color: TEXT }}>
        {med.duration || '—'}
      </div>
      <div className="px-3 py-2.5" style={{ color: TEXT }}>
        {med.instructions || '—'}
      </div>
    </div>
  );
}

function MedsEmpty() {
  return (
    <p
      className="rounded-md border border-dashed px-3 py-3 text-center text-xs"
      style={{ borderColor: PRIMARY_BORDER, color: TEXT_MUTED }}
    >
      No medications recorded.
    </p>
  );
}

function DoctorPatientBlock({ doctor, patient, prescription }) {
  const doctorName = doctor?.name || prescription.doctor || '';
  const doctorQualifications = doctor?.qualifications || '';
  const doctorSpec = doctor?.specialization || '';
  return (
    <div className="grid grid-cols-[1fr_1.4fr] gap-5">
      <div className="min-w-0">
        <div className="text-[15px] font-bold" style={{ color: TEXT }}>
          {doctorName || '—'}
        </div>
        {doctorQualifications ? (
          <div className="mt-0.5 text-[12px]" style={{ color: TEXT_MUTED }}>
            {doctorQualifications}
          </div>
        ) : null}
        {doctorSpec ? (
          <div className="mt-0.5 text-[12px]" style={{ color: TEXT_MUTED }}>
            {doctorSpec}
          </div>
        ) : null}
      </div>
      <div
        className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-md border px-4 py-3"
        style={{ borderColor: PRIMARY_BORDER, backgroundColor: PRIMARY_SOFT }}
      >
        <InfoCell label="Patient Name" value={patient?.name} />
        <InfoCell label="Date" value={formatDate(prescription.date)} />
        <InfoCell label="Age / Gender" value={ageGenderLine(patient)} />
        <InfoCell label="Phone" value={patient?.phone} />
      </div>
    </div>
  );
}

function SignatureBlock({ doctor, prescription }) {
  const doctorName = doctor?.name || prescription.doctor || '';
  const doctorQualifications = doctor?.qualifications || '';
  const doctorRegNo = doctor?.registrationNo || '';
  return (
    <div className="mt-8 flex items-end justify-end">
      <div className="text-right">
        <div className="text-[11px]" style={{ color: TEXT_MUTED }}>
          Doctor Signature
        </div>
        <div
          className="mt-12 ml-auto h-px w-48"
          style={{ backgroundColor: PRIMARY_BORDER }}
        />
        {doctorName ? (
          <div
            className="mt-2 text-[13px] font-bold"
            style={{ color: TEXT }}
          >
            {doctorName}
          </div>
        ) : null}
        {doctorQualifications ? (
          <div className="text-[11px]" style={{ color: TEXT_MUTED }}>
            {doctorQualifications}
          </div>
        ) : null}
        {doctorRegNo ? (
          <div className="text-[11px]" style={{ color: TEXT_MUTED }}>
            Reg. No. {doctorRegNo}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Top-level document ──────────────────────────────────

/**
 * Renders a prescription as a paginated A4 document. Each visible
 * "page" carries the clinic letterhead (or the auto-generated fallback
 * header + footer if none is uploaded) so long prescriptions with lots
 * of medications flow across sheets naturally.
 *
 * `mode="preview"` (default) shows the Google-Docs style chrome; the
 * headless-browser print route uses `mode="print"` to strip the chrome
 * so Chrome's `page.pdf` treats each `.pd-page` div as one PDF page.
 */
export function PrescriptionDocument({
  prescription,
  patient,
  clinic,
  doctor,
  mode = 'preview',
  onReady,
}) {
  if (!prescription) return null;

  const meds = prescription.medications || [];
  const letterheadHeaderUrl = clinic?.letterhead?.header?.url;
  const letterheadFooterUrl = clinic?.letterhead?.footer?.url;
  const rxId = buildPrescriptionId(prescription);
  const dateLine = formatDate(prescription.date);

  // Clinical values — falling back to `notes` for chief complaint
  // preserves the sane display for legacy prescriptions that predate
  // the structured fields.
  const chiefComplaint = prescription.chiefComplaint || prescription.notes || '';
  const medicalHistory = prescription.medicalHistory || '';
  const examinationFindings = prescription.examinationFindings || '';
  // The prescription form's "Diagnosis *" input is persisted on the
  // record as `condition`, so we read that key here.
  const diagnosis = prescription.condition || '';
  const treatmentDone = formatTreatmentDone(prescription);
  const treatmentAdvice = prescription.treatmentAdvice || '';
  const followUp = formatFollowUp(prescription.followUp);

  // Assign the stripe pattern AFTER filtering out empty rows so the
  // alternating background stays consistent regardless of which
  // sections a given prescription actually populates.
  const clinicalRows = [
    { id: 'clinical-cc', label: 'Chief Complaint / Subjective', value: chiefComplaint },
    { id: 'clinical-mh', label: 'Medical History', value: medicalHistory },
    { id: 'clinical-ex', label: 'Examination / Findings', value: examinationFindings },
    { id: 'clinical-dx', label: 'Diagnosis', value: diagnosis },
    { id: 'clinical-td', label: 'Treatment Done', value: treatmentDone },
    { id: 'clinical-ta', label: 'Treatment Advice', value: treatmentAdvice },
  ]
    .filter((r) => r.value)
    .map((r, i) => ({ ...r, striped: i % 2 === 1 }));

  // Build the ordered block list. We use spacer blocks (`gap-*`) as
  // deliberate breathing room between sections — the packer treats
  // them as regular blocks so they can absorb the "keep-together"
  // margins naturally instead of leaking into the next page.
  const blocks = [
    // Meta strip only when letterhead is active — the fallback header
    // has its own inline meta line, so we skip it there.
    ...(letterheadHeaderUrl
      ? [
          {
            id: 'meta-strip',
            node: (
              <div className="pb-3">
                <MetaStrip rxId={rxId} date={dateLine} />
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
      id: 'doctor-patient',
      node: (
        <div className="pb-4">
          <DoctorPatientBlock
            doctor={doctor}
            patient={patient}
            prescription={prescription}
          />
        </div>
      ),
    },
    ...(clinicalRows.length
      ? [
          {
            id: 'clinical-wrap-start',
            node: (
              <div
                className="rounded-t-md border-x border-t"
                style={{ borderColor: PRIMARY_BORDER, height: 0 }}
              />
            ),
          },
          ...clinicalRows.map((r, idx) => ({
            id: r.id,
            node: (
              <div
                className={idx === clinicalRows.length - 1 ? 'pb-0' : ''}
                style={{
                  borderLeft: `1px solid ${PRIMARY_BORDER}`,
                  borderRight: `1px solid ${PRIMARY_BORDER}`,
                  borderBottom:
                    idx === clinicalRows.length - 1
                      ? `1px solid ${PRIMARY_BORDER}`
                      : 'none',
                  borderBottomLeftRadius:
                    idx === clinicalRows.length - 1 ? 6 : undefined,
                  borderBottomRightRadius:
                    idx === clinicalRows.length - 1 ? 6 : undefined,
                }}
              >
                <ClinicalRow label={r.label} value={r.value} striped={r.striped} />
              </div>
            ),
          })),
          {
            id: 'clinical-gap',
            node: <div className="h-4" />,
          },
        ]
      : []),
    { id: 'meds-title', node: <MedsSectionTitle /> },
    { id: 'meds-title-gap', node: <div className="h-2" /> },
    ...(meds.length
      ? [
          { id: 'meds-header', node: <MedsTableHeader /> },
          ...meds.map((m, i) => ({
            id: `med-${m._id || i}`,
            node: (
              <MedsTableRow
                index={i}
                med={m}
                isLast={i === meds.length - 1}
              />
            ),
          })),
        ]
      : [{ id: 'meds-empty', node: <MedsEmpty /> }]),
    ...(followUp
      ? [
          { id: 'follow-up-gap', node: <div className="h-4" /> },
          {
            id: 'follow-up',
            node: (
              <div
                className="overflow-hidden rounded-md border"
                style={{ borderColor: PRIMARY_BORDER }}
              >
                <ClinicalRow label="Follow Up" value={followUp} striped={false} />
              </div>
            ),
          },
        ]
      : []),
    {
      id: 'signature',
      node: (
        <SignatureBlock doctor={doctor} prescription={prescription} />
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
      <PaginatedDocument
        blocks={blocks}
        letterheadHeaderUrl={letterheadHeaderUrl}
        letterheadFooterUrl={letterheadFooterUrl}
        renderFallbackHeader={() => (
          <FallbackHeader
            clinic={clinic}
            rxId={rxId}
            prescription={prescription}
          />
        )}
        renderFallbackFooter={() => <FallbackFooter />}
        mode={mode}
        onReady={onReady}
      />
    </div>
  );
}
