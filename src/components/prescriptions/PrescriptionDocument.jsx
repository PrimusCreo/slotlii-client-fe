import { useEffect, useState } from 'react';
import { Heart, Phone } from 'lucide-react';

import { trimSignatureDataUrl } from '@/utils/signatureTrim';

const PRIMARY = '#fe6e00';
const PRIMARY_TINT = '#FFF4EB';
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
  if (age !== null && age !== undefined && !Number.isNaN(age)) {
    parts.push(`${age} yrs`);
  }
  if (gender) parts.push(gender);
  return parts.join(' / ') || '—';
}

/**
 * Derive a stable, human-readable prescription id from the entry's date and
 * Mongo `_id`. Format: RX + YYMMDD + last 4 hex chars (uppercase) of _id.
 * Falls back to a numeric-only suffix when no _id is present yet (preview).
 */
function buildPrescriptionId(prescription) {
  const d = prescription?.date ? new Date(prescription.date) : new Date();
  const yy = String(d.getFullYear() % 100).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const id = String(prescription?._id || '').replace(/[^a-zA-Z0-9]/g, '');
  const suffix = id ? id.slice(-4).toUpperCase() : '0001';
  return `RX${yy}${mm}${dd}${suffix}`;
}

/**
 * Split a free-text findings string into bullet points by newlines.
 * Returns null when the input is empty.
 */
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

export function PrescriptionDocument({ prescription, patient, clinic, doctor }) {
  const rawSignatureData = doctor?.signatureData || '';
  const [displaySignature, setDisplaySignature] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!rawSignatureData) {
      setDisplaySignature('');
      return undefined;
    }
    trimSignatureDataUrl(rawSignatureData).then((trimmed) => {
      if (!cancelled) setDisplaySignature(trimmed);
    });
    return () => {
      cancelled = true;
    };
  }, [rawSignatureData]);

  if (!prescription) return null;

  const meds = prescription.medications || [];
  const clinicName = clinic?.name || 'Clinic';
  const clinicAddress = clinic?.address;
  const clinicPhone = clinic?.phone;

  const doctorName = doctor?.name || prescription.doctor || '';
  const doctorQualifications = doctor?.qualifications || '';
  const doctorSpec = doctor?.specialization || '';
  const doctorRegNo = doctor?.registrationNo || '';

  const rxId = buildPrescriptionId(prescription);

  // Map "Chief Complaint" → falls back to entry.notes so the section is
  // never empty for legacy prescriptions; same for Assessment & Plan ←
  // legacy `condition` (diagnosis) field.
  const chiefComplaint = prescription.chiefComplaint || prescription.notes || '';
  const medicalHistory = prescription.medicalHistory || '';
  const examinationFindings = prescription.examinationFindings || '';
  const treatmentDone =
    prescription.treatmentDone ||
    prescription.assessmentPlan ||
    prescription.condition ||
    '';
  const followUp = formatFollowUp(prescription.followUp);

  return (
    <div
      className="mx-auto flex w-full max-w-[820px] flex-1 flex-col bg-white"
      style={{
        color: TEXT,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
      }}
    >
      {/* Header — clinic + Rx pill */}
      <div className="flex items-start justify-between gap-6 px-8 pt-8">
        <div className="min-w-0">
          <h1
            className="text-[22px] font-bold leading-tight"
            style={{ color: TEXT }}
          >
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

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div
            className="flex items-center gap-3 rounded-md px-5 py-2.5 text-white"
            style={{ backgroundColor: PRIMARY }}
          >
            <span className="text-[15px] font-bold tracking-wider">
              PRESCRIPTION
            </span>
            <span
              className="flex size-7 items-center justify-center rounded-md bg-white text-[15px] font-bold"
              style={{ color: PRIMARY, fontFamily: 'Georgia, serif' }}
            >
              ℞
            </span>
          </div>
          <div className="text-[11px]" style={{ color: TEXT_MUTED }}>
            Prescription ID :{' '}
            <span className="font-semibold" style={{ color: TEXT }}>
              {rxId}
            </span>
          </div>
        </div>
      </div>

      <div
        className="mx-8 mt-5 h-px"
        style={{ backgroundColor: PRIMARY_BORDER }}
      />

      {/* Doctor + Patient details row */}
      <div className="mx-8 mt-5 grid grid-cols-[1fr_1.4fr] gap-5">
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

      {/* Clinical sections */}
      <div
        className="mx-8 mt-5 overflow-hidden rounded-md border"
        style={{ borderColor: PRIMARY_BORDER }}
      >
        <ClinicalRow
          label="Chief Complaint / Subjective"
          value={chiefComplaint}
          striped={false}
        />
        <ClinicalRow
          label="Medical History"
          value={medicalHistory}
          striped
        />
        <ClinicalRow
          label="Examination / Findings"
          value={examinationFindings}
          striped={false}
        />
        <ClinicalRow
          label="Treatment Done"
          value={treatmentDone}
          striped
        />
      </div>

      {/* Medicines */}
      <div className="mx-8 mt-5">
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
        {meds.length ? (
          <table
            className="mt-3 w-full border-collapse overflow-hidden rounded-md border text-[12.5px]"
            style={{ borderColor: PRIMARY_BORDER }}
          >
            <thead>
              <tr style={{ backgroundColor: PRIMARY_TINT, color: PRIMARY }}>
                <th
                  className="w-9 border-b px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider"
                  style={{ borderColor: PRIMARY_BORDER }}
                >
                  #
                </th>
                <th
                  className="border-b px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider"
                  style={{ borderColor: PRIMARY_BORDER }}
                >
                  Medicine
                </th>
                <th
                  className="border-b px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider"
                  style={{ borderColor: PRIMARY_BORDER }}
                >
                  Dose
                </th>
                <th
                  className="border-b px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider"
                  style={{ borderColor: PRIMARY_BORDER }}
                >
                  Frequency
                </th>
                <th
                  className="border-b px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider"
                  style={{ borderColor: PRIMARY_BORDER }}
                >
                  Duration
                </th>
                <th
                  className="border-b px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider"
                  style={{ borderColor: PRIMARY_BORDER }}
                >
                  Instructions
                </th>
              </tr>
            </thead>
            <tbody>
              {meds.map((m, i) => (
                <tr
                  key={m._id || i}
                  style={{
                    backgroundColor: i % 2 === 1 ? PRIMARY_SOFT : '#ffffff',
                  }}
                >
                  <td
                    className="border-b px-3 py-2.5 tabular-nums"
                    style={{ borderColor: PRIMARY_BORDER, color: TEXT_MUTED }}
                  >
                    {i + 1}
                  </td>
                  <td
                    className="border-b px-3 py-2.5 font-medium"
                    style={{ borderColor: PRIMARY_BORDER, color: TEXT }}
                  >
                    {m.name || '—'}
                  </td>
                  <td
                    className="border-b px-3 py-2.5"
                    style={{ borderColor: PRIMARY_BORDER, color: TEXT }}
                  >
                    {m.dosage || '—'}
                  </td>
                  <td
                    className="border-b px-3 py-2.5"
                    style={{ borderColor: PRIMARY_BORDER, color: TEXT }}
                  >
                    {m.frequency || '—'}
                  </td>
                  <td
                    className="border-b px-3 py-2.5"
                    style={{ borderColor: PRIMARY_BORDER, color: TEXT }}
                  >
                    {m.duration || '—'}
                  </td>
                  <td
                    className="border-b px-3 py-2.5"
                    style={{ borderColor: PRIMARY_BORDER, color: TEXT }}
                  >
                    {m.instructions || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p
            className="mt-2 rounded-md border border-dashed px-3 py-3 text-center text-xs"
            style={{ borderColor: PRIMARY_BORDER, color: TEXT_MUTED }}
          >
            No medications recorded.
          </p>
        )}
      </div>

      {/* Follow up */}
      {followUp ? (
        <div
          className="mx-8 mt-5 overflow-hidden rounded-md border"
          style={{ borderColor: PRIMARY_BORDER }}
        >
          <ClinicalRow label="Follow Up" value={followUp} striped={false} />
        </div>
      ) : null}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Signature */}
      <div className="mx-8 mt-10 flex items-end justify-end pb-6">
        <div className="text-right">
          <div className="text-[11px]" style={{ color: TEXT_MUTED }}>
            Doctor Signature
          </div>
          {displaySignature ? (
            <img
              src={displaySignature}
              alt=""
              className="ml-auto mt-2 h-16 max-w-[200px] object-contain object-right"
            />
          ) : null}
          <div
            className="mt-2 h-px w-48 ml-auto"
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

      {/* Footer */}
      <div
        className="flex items-center justify-between border-t px-8 py-3 text-[11px]"
        style={{ borderColor: PRIMARY_BORDER, color: TEXT_MUTED }}
      >
        <span className="inline-flex items-center gap-1.5">
          <Heart
            className="size-3 fill-current"
            style={{ color: PRIMARY }}
          />
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
