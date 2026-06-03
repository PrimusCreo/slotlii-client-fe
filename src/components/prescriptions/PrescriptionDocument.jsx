import {
  FileText,
  Mail,
  MapPin,
  Phone,
  Pill,
  Stethoscope,
  User,
  CalendarDays,
} from 'lucide-react';

const PRIMARY = '#F97316';
const PRIMARY_TINT = '#FFF7ED';
const PRIMARY_BORDER = '#FED7AA';

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

function SectionHeader({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex size-6 items-center justify-center rounded-md"
        style={{ backgroundColor: PRIMARY_TINT, color: PRIMARY }}
      >
        <Icon className="size-3.5" />
      </span>
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: PRIMARY }}
      >
        {label}
      </span>
      <span
        className="ml-2 h-px flex-1"
        style={{ backgroundColor: PRIMARY_BORDER }}
      />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: PRIMARY_TINT, color: PRIMARY }}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-zinc-500">
          {label}
        </div>
        <div className="text-sm font-semibold text-zinc-900">{value || '—'}</div>
      </div>
    </div>
  );
}

export function PrescriptionDocument({ prescription, patient, clinic, doctor }) {
  if (!prescription) return null;

  const meds = prescription.medications || [];
  const clinicName = clinic?.name || 'Clinic';
  const clinicAddress = clinic?.address;
  const clinicPhone = clinic?.phone;
  const clinicEmail = clinic?.email;
  const clinicWebsite = clinic?.website;
  const monogram = clinicName.trim().charAt(0).toUpperCase() || 'C';

  const doctorName = doctor?.name || prescription.doctor || '';
  const doctorSpec = doctor?.specialization || '';

  const showContactRow = !!(clinicPhone || clinicEmail || clinicWebsite);

  return (
    <div
      className="mx-auto flex w-full max-w-[820px] flex-1 flex-col bg-white text-zinc-900"
      style={{
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
      }}
    >
      {/* Header — clinic */}
      <div className="flex items-start justify-between gap-6 px-8 pt-8">
        <div className="flex items-start gap-4">
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-lg text-2xl font-extrabold text-white"
            style={{ backgroundColor: PRIMARY }}
          >
            {monogram}
          </div>
          <div>
            <h1
              className="text-[22px] font-bold leading-tight"
              style={{ color: PRIMARY }}
            >
              {clinicName}
            </h1>
            {clinicAddress ? (
              <p className="mt-1 max-w-[320px] whitespace-pre-line text-xs leading-relaxed text-zinc-600">
                {clinicAddress}
              </p>
            ) : null}
            {showContactRow ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-600">
                {clinicPhone ? (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="size-3" style={{ color: PRIMARY }} />
                    {clinicPhone}
                  </span>
                ) : null}
                {clinicEmail ? (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="size-3" style={{ color: PRIMARY }} />
                    {clinicEmail}
                  </span>
                ) : null}
                {clinicWebsite ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" style={{ color: PRIMARY }} />
                    {clinicWebsite}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="my-5 mx-8 h-px" style={{ backgroundColor: PRIMARY_BORDER }} />

      {/* Doctor + Rx title */}
      <div className="flex items-center justify-between gap-6 px-8">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
            <User className="size-5" />
          </div>
          <div>
            <div className="text-base font-bold text-zinc-900">
              {doctorName || '—'}
            </div>
            {doctorSpec ? (
              <div className="text-xs text-zinc-600">{doctorSpec}</div>
            ) : null}
          </div>
        </div>
        <div
          className="flex items-baseline gap-2 text-2xl font-extrabold tracking-wide"
          style={{ color: PRIMARY }}
        >
          <span style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            ℞
          </span>
          <span>PRESCRIPTION</span>
        </div>
      </div>

      {/* Patient details box */}
      <div className="mx-8 mt-5 rounded-md border border-zinc-200 bg-white">
        <div className="grid grid-cols-2 gap-4 px-5 py-4">
          <InfoRow icon={User} label="Patient Name" value={patient?.name} />
          <InfoRow icon={CalendarDays} label="Date" value={formatDate(prescription.date)} />
          <InfoRow icon={User} label="Age / Gender" value={ageGenderLine(patient)} />
          {patient?.phone ? (
            <InfoRow icon={Phone} label="Phone" value={patient.phone} />
          ) : null}
        </div>
      </div>

      {/* Diagnosis */}
      {prescription.condition ? (
        <div className="mx-8 mt-5">
          <SectionHeader icon={Stethoscope} label="Diagnosis" />
          <p className="mt-2 text-sm text-zinc-800">{prescription.condition}</p>
        </div>
      ) : null}

      {/* Medicines */}
      <div className="mx-8 mt-5">
        <SectionHeader icon={Pill} label="Medicines" />
        {meds.length ? (
          <table className="mt-3 w-full border-collapse overflow-hidden rounded-md border border-zinc-200 text-sm">
            <thead>
              <tr style={{ backgroundColor: PRIMARY_TINT, color: PRIMARY }}>
                <th className="w-10 border-b border-zinc-200 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider">
                  #
                </th>
                <th className="border-b border-zinc-200 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider">
                  Medicine
                </th>
                <th className="border-b border-zinc-200 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider">
                  Dosage
                </th>
                <th className="border-b border-zinc-200 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider">
                  Frequency
                </th>
                <th className="border-b border-zinc-200 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider">
                  Duration
                </th>
                <th className="border-b border-zinc-200 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider">
                  Instructions
                </th>
              </tr>
            </thead>
            <tbody>
              {meds.map((m, i) => (
                <tr key={m._id || i} className="even:bg-zinc-50/60">
                  <td className="border-b border-zinc-200 px-3 py-2 text-zinc-500 tabular-nums">
                    {i + 1}
                  </td>
                  <td className="border-b border-zinc-200 px-3 py-2 font-medium">
                    {m.name || '—'}
                  </td>
                  <td className="border-b border-zinc-200 px-3 py-2">
                    {m.dosage || '—'}
                  </td>
                  <td className="border-b border-zinc-200 px-3 py-2">
                    {m.frequency || '—'}
                  </td>
                  <td className="border-b border-zinc-200 px-3 py-2">
                    {m.duration || '—'}
                  </td>
                  <td className="border-b border-zinc-200 px-3 py-2 text-zinc-700">
                    {m.instructions || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : prescription.treatment ? (
          <p className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            {prescription.treatment}
          </p>
        ) : (
          <p className="mt-2 rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-3 py-3 text-center text-xs text-zinc-500">
            No medications recorded.
          </p>
        )}
      </div>

      {/* Notes (if any) */}
      {prescription.notes ? (
        <div className="mx-8 mt-5">
          <SectionHeader icon={FileText} label="Notes" />
          <p className="mt-2 whitespace-pre-line text-sm text-zinc-800">
            {prescription.notes}
          </p>
        </div>
      ) : null}

      {/* Flexible spacer pushes the signature/footer to the bottom of the page */}
      <div className="flex-1" />

      {/* Signature */}
      <div className="mx-8 mt-10 flex items-end justify-end pb-8">
        <div className="text-right">
          <div className="mb-1 h-px w-48" style={{ backgroundColor: PRIMARY_BORDER }} />
          <div className="text-xs text-zinc-500">Doctor Signature</div>
          {doctorName ? (
            <div className="mt-1 text-sm font-semibold text-zinc-900">
              {doctorName}
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer */}
      <div
        className="border-t px-8 py-3 text-center text-[11px] text-zinc-500"
        style={{ borderColor: PRIMARY_BORDER }}
      >
        Generated via{' '}
        <span className="font-semibold" style={{ color: PRIMARY }}>
          Slotlii
        </span>{' '}
        Clinic OS
      </div>

    </div>
  );
}
