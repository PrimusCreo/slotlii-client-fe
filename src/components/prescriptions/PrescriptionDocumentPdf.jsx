/**
 * PDF-safe prescription layout — all hex/rgb inline styles, no Tailwind classes.
 * Used by generatePrescriptionPdf so html2canvas never hits oklch() from Tailwind v4.
 */

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
const TEXT = '#18181b';
const TEXT_MUTED = '#52525b';
const TEXT_SOFT = '#71717a';
const BORDER = '#e4e4e7';
const BG_SOFT = '#fafafa';
const BG_MUTED = '#f4f4f5';
const FONT =
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

function IconBadge({ children, size = 24 }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 6,
        backgroundColor: PRIMARY_TINT,
        color: PRIMARY,
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

function SectionHeader({ icon: Icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <IconBadge>
        <Icon size={14} color={PRIMARY} strokeWidth={2} />
      </IconBadge>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: PRIMARY,
        }}
      >
        {label}
      </span>
      <span
        style={{ marginLeft: 8, height: 1, flex: 1, backgroundColor: PRIMARY_BORDER }}
      />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <span style={{ marginTop: 2 }}>
        <IconBadge size={28}>
          <Icon size={14} color={PRIMARY} strokeWidth={2} />
        </IconBadge>
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: TEXT_SOFT,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{value || '—'}</div>
      </div>
    </div>
  );
}

export function PrescriptionDocumentPdf({ prescription, patient, clinic, doctor }) {
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

  const cellStyle = {
    borderBottom: `1px solid ${BORDER}`,
    padding: '8px 12px',
    fontSize: 14,
    color: TEXT,
    verticalAlign: 'top',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: 820,
        minHeight: 1050,
        margin: '0 auto',
        backgroundColor: '#ffffff',
        color: TEXT,
        fontFamily: FONT,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 24,
          padding: '32px 32px 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              width: 56,
              height: 56,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              backgroundColor: PRIMARY,
              color: '#ffffff',
              fontSize: 24,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {monogram}
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                lineHeight: 1.2,
                color: PRIMARY,
              }}
            >
              {clinicName}
            </h1>
            {clinicAddress ? (
              <p
                style={{
                  margin: '4px 0 0',
                  maxWidth: 320,
                  whiteSpace: 'pre-line',
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: TEXT_MUTED,
                }}
              >
                {clinicAddress}
              </p>
            ) : null}
            {showContactRow ? (
              <div
                style={{
                  marginTop: 8,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px 16px',
                  fontSize: 11,
                  color: TEXT_MUTED,
                }}
              >
                {clinicPhone ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Phone size={12} color={PRIMARY} /> {clinicPhone}
                  </span>
                ) : null}
                {clinicEmail ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Mail size={12} color={PRIMARY} /> {clinicEmail}
                  </span>
                ) : null}
                {clinicWebsite ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={12} color={PRIMARY} /> {clinicWebsite}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        style={{ margin: '20px 32px', height: 1, backgroundColor: PRIMARY_BORDER }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          padding: '0 32px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              backgroundColor: BG_MUTED,
              color: TEXT_SOFT,
            }}
          >
            <User size={20} color={TEXT_SOFT} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>
              {doctorName || '—'}
            </div>
            {doctorSpec ? (
              <div style={{ fontSize: 12, color: TEXT_MUTED }}>{doctorSpec}</div>
            ) : null}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: '0.04em',
            color: PRIMARY,
          }}
        >
          <span style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>℞</span>
          <span>PRESCRIPTION</span>
        </div>
      </div>

      <div
        style={{
          margin: '20px 32px 0',
          borderRadius: 6,
          border: `1px solid ${BORDER}`,
          backgroundColor: '#ffffff',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            padding: '16px 20px',
          }}
        >
          <InfoRow icon={User} label="Patient Name" value={patient?.name} />
          <InfoRow
            icon={CalendarDays}
            label="Date"
            value={formatDate(prescription.date)}
          />
          <InfoRow icon={User} label="Age / Gender" value={ageGenderLine(patient)} />
          {patient?.phone ? (
            <InfoRow icon={Phone} label="Phone" value={patient.phone} />
          ) : null}
        </div>
      </div>

      {prescription.condition ? (
        <div style={{ margin: '20px 32px 0' }}>
          <SectionHeader icon={Stethoscope} label="Diagnosis" />
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#27272a' }}>
            {prescription.condition}
          </p>
        </div>
      ) : null}

      <div style={{ margin: '20px 32px 0' }}>
        <SectionHeader icon={Pill} label="Medicines" />
        {meds.length ? (
          <table
            style={{
              marginTop: 12,
              width: '100%',
              borderCollapse: 'collapse',
              border: `1px solid ${BORDER}`,
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ backgroundColor: PRIMARY_TINT, color: PRIMARY }}>
                {['#', 'Medicine', 'Dosage', 'Frequency', 'Duration', 'Instructions'].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        ...cellStyle,
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        textAlign: 'left',
                        width: h === '#' ? 40 : undefined,
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {meds.map((m, i) => (
                <tr
                  key={m._id || i}
                  style={{ backgroundColor: i % 2 === 1 ? BG_SOFT : '#ffffff' }}
                >
                  <td style={{ ...cellStyle, color: TEXT_SOFT }}>{i + 1}</td>
                  <td style={{ ...cellStyle, fontWeight: 500 }}>{m.name || '—'}</td>
                  <td style={cellStyle}>{m.dosage || '—'}</td>
                  <td style={cellStyle}>{m.frequency || '—'}</td>
                  <td style={cellStyle}>{m.duration || '—'}</td>
                  <td style={{ ...cellStyle, color: '#3f3f46' }}>
                    {m.instructions || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : prescription.treatment ? (
          <p
            style={{
              marginTop: 8,
              borderRadius: 6,
              border: `1px solid ${BORDER}`,
              backgroundColor: BG_SOFT,
              padding: '8px 12px',
              fontSize: 14,
              color: '#3f3f46',
            }}
          >
            {prescription.treatment}
          </p>
        ) : (
          <p
            style={{
              marginTop: 8,
              borderRadius: 6,
              border: `1px dashed ${BORDER}`,
              backgroundColor: BG_SOFT,
              padding: '12px',
              textAlign: 'center',
              fontSize: 12,
              color: TEXT_SOFT,
            }}
          >
            No medications recorded.
          </p>
        )}
      </div>

      {prescription.notes ? (
        <div style={{ margin: '20px 32px 0' }}>
          <SectionHeader icon={FileText} label="Notes" />
          <p
            style={{
              margin: '8px 0 0',
              whiteSpace: 'pre-line',
              fontSize: 14,
              color: '#27272a',
            }}
          >
            {prescription.notes}
          </p>
        </div>
      ) : null}

      <div style={{ flex: 1, minHeight: 40 }} />

      <div
        style={{
          margin: '40px 32px 0',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          paddingBottom: 32,
        }}
      >
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              marginBottom: 4,
              height: 1,
              width: 192,
              backgroundColor: PRIMARY_BORDER,
              marginLeft: 'auto',
            }}
          />
          <div style={{ fontSize: 12, color: TEXT_SOFT }}>Doctor Signature</div>
          {doctorName ? (
            <div style={{ marginTop: 4, fontSize: 14, fontWeight: 600, color: TEXT }}>
              {doctorName}
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          borderTop: `1px solid ${PRIMARY_BORDER}`,
          padding: '12px 32px',
          textAlign: 'center',
          fontSize: 11,
          color: TEXT_SOFT,
        }}
      >
        Generated via{' '}
        <span style={{ fontWeight: 600, color: PRIMARY }}>Slotlii</span> Clinic OS
      </div>
    </div>
  );
}

export default PrescriptionDocumentPdf;
