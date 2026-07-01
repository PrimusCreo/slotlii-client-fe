import { Heart, Phone } from 'lucide-react';

import { PaginatedDocument } from '@/components/documents/PaginatedDocument';
import {
  PAYMENT_METHOD_LABEL,
  formatBillDate,
  formatInr,
} from './billUtils';

const PRIMARY = '#fe6e00';
const PRIMARY_TINT = '#FFF4EB';
const PRIMARY_SOFT = '#FFFAF5';
const PRIMARY_BORDER = '#FFD7B5';
const TEXT = '#1f2937';
const TEXT_MUTED = '#6b7280';

const STATUS_COLORS = {
  DRAFT: '#6b7280',
  UNPAID: '#b45309',
  PARTIALLY_PAID: '#1d4ed8',
  PAID: '#15803d',
  CANCELLED: '#b91c1c',
};

const STATUS_LABEL = {
  DRAFT: 'DRAFT',
  UNPAID: 'UNPAID',
  PARTIALLY_PAID: 'PART-PAID',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
};

const DOC_FONT_FAMILY =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial";

function patientAge(patient) {
  const raw = patient?.age;
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function ageGenderLine(patient) {
  const age = patientAge(patient);
  const gender = patient?.gender
    ? String(patient.gender).charAt(0).toUpperCase() +
      String(patient.gender).slice(1).toLowerCase()
    : '';
  const parts = [];
  if (age !== null) parts.push(`${age} yrs`);
  if (gender) parts.push(gender);
  return parts.join(' / ') || '—';
}

function billTitle(bill) {
  return bill?.billNumber || 'DRAFT BILL';
}

// ── Layout pieces ────────────────────────────────────────

const ITEM_COL_WIDTHS = ['36px', '1fr', '60px', '96px', '110px'];

function ItemsTableHeader() {
  const headers = ['#', 'Item', 'Qty', 'Unit', 'Amount'];
  const aligns = ['left', 'left', 'right', 'right', 'right'];
  return (
    <div
      className="grid rounded-t-md border text-[10.5px] font-semibold uppercase tracking-wider"
      style={{
        gridTemplateColumns: ITEM_COL_WIDTHS.join(' '),
        borderColor: PRIMARY_BORDER,
        backgroundColor: PRIMARY_TINT,
        color: PRIMARY,
      }}
    >
      {headers.map((h, i) => (
        <div
          key={i}
          className="px-3 py-2.5"
          style={{ textAlign: aligns[i] }}
        >
          {h}
        </div>
      ))}
    </div>
  );
}

function ItemsTableRow({ index, item, isLast }) {
  const q = Number(item.quantity || 0);
  const p = Number(item.unitPrice || 0);
  const lineTotal = q * p;
  return (
    <div
      className="grid border-x border-b text-[12.5px]"
      style={{
        gridTemplateColumns: ITEM_COL_WIDTHS.join(' '),
        borderColor: PRIMARY_BORDER,
        backgroundColor: index % 2 === 1 ? PRIMARY_SOFT : '#ffffff',
        borderBottomLeftRadius: isLast ? 6 : undefined,
        borderBottomRightRadius: isLast ? 6 : undefined,
      }}
    >
      <div className="px-3 py-2.5 tabular-nums" style={{ color: TEXT_MUTED }}>
        {index + 1}
      </div>
      <div className="px-3 py-2.5" style={{ color: TEXT }}>
        <div className="font-medium">{item.name || '—'}</div>
        {item.description ? (
          <div className="mt-0.5 text-[10.5px]" style={{ color: TEXT_MUTED }}>
            {item.description}
          </div>
        ) : null}
      </div>
      <div
        className="px-3 py-2.5 tabular-nums"
        style={{ color: TEXT, textAlign: 'right' }}
      >
        {q}
      </div>
      <div
        className="px-3 py-2.5 tabular-nums"
        style={{ color: TEXT, textAlign: 'right' }}
      >
        {formatInr(p)}
      </div>
      <div
        className="px-3 py-2.5 tabular-nums font-medium"
        style={{ color: TEXT, textAlign: 'right' }}
      >
        {formatInr(lineTotal)}
      </div>
    </div>
  );
}

function TotalsRow({ label, value, muted, bold, size = 12, color }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span
        style={{
          fontSize: size,
          fontWeight: bold ? 700 : 400,
          color: muted ? TEXT_MUTED : TEXT,
        }}
      >
        {label}
      </span>
      <span
        className="tabular-nums"
        style={{
          fontSize: size,
          fontWeight: bold ? 700 : 400,
          color: color || TEXT,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function BillToBlock({ patient }) {
  return (
    <div>
      <div
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: TEXT_MUTED }}
      >
        Bill to
      </div>
      <div className="mt-1 text-[15px] font-bold" style={{ color: TEXT }}>
        {patient?.name || '—'}
      </div>
      {patient?.phone ? (
        <div className="mt-0.5 text-[12px]" style={{ color: TEXT_MUTED }}>
          {patient.phone}
        </div>
      ) : null}
      {(patientAge(patient) !== null || patient?.gender) ? (
        <div className="text-[12px]" style={{ color: TEXT_MUTED }}>
          {ageGenderLine(patient)}
        </div>
      ) : null}
    </div>
  );
}

function StatusPillBlock({ status, doctor }) {
  const color = STATUS_COLORS[status] || TEXT_MUTED;
  return (
    <div>
      <div
        className="rounded-md px-4 py-2 text-center text-[13px] font-bold tracking-widest"
        style={{
          color,
          backgroundColor: `${color}1A`,
          border: `1px solid ${color}`,
        }}
      >
        {STATUS_LABEL[status] || status || 'DRAFT'}
      </div>
      {doctor?.name ? (
        <div className="mt-2 text-right">
          <div
            className="text-[10.5px] font-semibold uppercase tracking-wider"
            style={{ color: TEXT_MUTED }}
          >
            Doctor
          </div>
          <div className="mt-0.5 text-[12px]" style={{ color: TEXT }}>
            {doctor.name}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FallbackHeader({ clinic, bill }) {
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
            className="rounded-md px-4 py-2 text-[13px] font-bold tracking-widest text-white"
            style={{ backgroundColor: PRIMARY }}
          >
            INVOICE
          </div>
          <div className="text-[10.5px]" style={{ color: TEXT_MUTED }}>
            Bill{' '}
            <span className="font-semibold" style={{ color: TEXT }}>
              #{billTitle(bill)}
            </span>{' '}
            · {formatBillDate(bill?.billDate || bill?.createdAt) || '—'}
          </div>
        </div>
      </div>
      <div className="mt-3 h-px" style={{ backgroundColor: PRIMARY_BORDER }} />
    </div>
  );
}

function FallbackFooter() {
  // Attribution moved to the system-footer strip.
  return (
    <div
      className="flex items-center border-t px-10 py-3 text-[10.5px]"
      style={{ borderColor: PRIMARY_BORDER, color: TEXT_MUTED }}
    >
      <span className="inline-flex items-center gap-1.5">
        <Heart className="size-3 fill-current" style={{ color: PRIMARY }} />
        Thank you for choosing us.
      </span>
    </div>
  );
}

/**
 * Renders a bill / invoice as a paginated A4 document. Item lists spill
 * across pages automatically (each row is its own block), letterhead
 * (or fallback) header + footer repeat on every page. Mirrors the
 * server-side `billPdf.js` layout closely enough that the doctor and
 * patient see the same sections in the same order in both.
 */
export function BillDocument({
  bill,
  patient,
  clinic,
  doctor,
  mode = 'preview',
  onReady,
}) {
  if (!bill) return null;

  const items = bill.items || [];
  const payments = bill.payments || [];
  const status = bill.status || 'DRAFT';
  const letterheadHeaderUrl = clinic?.letterhead?.header?.url;
  const letterheadFooterUrl = clinic?.letterhead?.footer?.url;

  const totalsBlock = (
    <div className="ml-auto w-[260px] space-y-2">
      <TotalsRow label="Subtotal" value={formatInr(bill.subtotal)} />
      {bill.discountAmount > 0 ? (
        <TotalsRow
          label={
            bill.discount?.type === 'PERCENT'
              ? `Discount (${bill.discount.value}%)`
              : 'Discount'
          }
          value={`- ${formatInr(bill.discountAmount)}`}
          color={PRIMARY}
        />
      ) : null}
      <div className="my-1 h-px" style={{ backgroundColor: PRIMARY_BORDER }} />
      <TotalsRow
        label="Total"
        value={formatInr(bill.totalAmount)}
        bold
        size={14}
      />
      <TotalsRow
        label="Paid"
        value={formatInr(bill.paidAmount)}
        muted
      />
      <TotalsRow
        label="Balance"
        value={formatInr(bill.balanceAmount)}
        bold
        color={bill.balanceAmount > 0 ? STATUS_COLORS.UNPAID : STATUS_COLORS.PAID}
      />
    </div>
  );

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
                    INVOICE
                  </span>
                  <span style={{ color: TEXT_MUTED }}>
                    Bill #{' '}
                    <span className="font-semibold" style={{ color: TEXT }}>
                      {billTitle(bill)}
                    </span>
                    {'   ·   '}Date:{' '}
                    <span className="font-semibold" style={{ color: TEXT }}>
                      {formatBillDate(bill.billDate || bill.createdAt) || '—'}
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
      id: 'billto-status',
      node: (
        <div className="grid grid-cols-[1.4fr_1fr] gap-6">
          <BillToBlock patient={patient} />
          <StatusPillBlock status={status} doctor={doctor} />
        </div>
      ),
    },
    { id: 'items-gap', node: <div className="h-4" /> },
    { id: 'items-header', node: <ItemsTableHeader /> },
    ...items.map((it, i) => ({
      id: `item-${i}-${it._id || it.name || i}`,
      node: (
        <ItemsTableRow
          index={i}
          item={it}
          isLast={i === items.length - 1}
        />
      ),
    })),
    ...(bill.discount?.reason
      ? [
          {
            id: 'discount-note',
            node: (
              <p className="mt-3 text-[11px]" style={{ color: TEXT_MUTED }}>
                Discount note: {bill.discount.reason}
              </p>
            ),
          },
        ]
      : []),
    { id: 'totals-gap', node: <div className="h-4" /> },
    { id: 'totals', node: totalsBlock },
    ...(status !== 'DRAFT' && payments.length
      ? [
          { id: 'payments-gap', node: <div className="h-4" /> },
          {
            id: 'payments-title',
            node: (
              <div className="flex items-center gap-3">
                <span
                  className="inline-block h-4 w-[3px]"
                  style={{ backgroundColor: PRIMARY }}
                />
                <span
                  className="text-[12px] font-semibold uppercase tracking-[0.1em]"
                  style={{ color: PRIMARY }}
                >
                  Payments
                </span>
              </div>
            ),
          },
          { id: 'payments-title-gap', node: <div className="h-2" /> },
          {
            id: 'payments-header',
            node: (
              <div
                className="grid rounded-t-md border text-[10.5px] font-semibold uppercase tracking-wider"
                style={{
                  gridTemplateColumns: '110px 110px 1fr 110px',
                  borderColor: PRIMARY_BORDER,
                  backgroundColor: PRIMARY_TINT,
                  color: PRIMARY,
                }}
              >
                <div className="px-3 py-2.5">Date</div>
                <div className="px-3 py-2.5">Method</div>
                <div className="px-3 py-2.5">Reference</div>
                <div className="px-3 py-2.5 text-right">Amount</div>
              </div>
            ),
          },
          ...payments.map((p, i) => ({
            id: `pay-${i}`,
            node: (
              <div
                className="grid border-x border-b text-[12px]"
                style={{
                  gridTemplateColumns: '110px 110px 1fr 110px',
                  borderColor: PRIMARY_BORDER,
                  backgroundColor: i % 2 === 1 ? PRIMARY_SOFT : '#ffffff',
                  borderBottomLeftRadius: i === payments.length - 1 ? 6 : 0,
                  borderBottomRightRadius: i === payments.length - 1 ? 6 : 0,
                }}
              >
                <div className="px-3 py-2" style={{ color: TEXT }}>
                  {formatBillDate(p.paidAt)}
                </div>
                <div className="px-3 py-2" style={{ color: TEXT }}>
                  {PAYMENT_METHOD_LABEL[p.method] || p.method}
                </div>
                <div className="px-3 py-2" style={{ color: TEXT_MUTED }}>
                  {p.reference || '—'}
                </div>
                <div
                  className="px-3 py-2 tabular-nums font-medium"
                  style={{ color: TEXT, textAlign: 'right' }}
                >
                  {formatInr(p.amount)}
                </div>
              </div>
            ),
          })),
        ]
      : []),
    ...(bill.notes
      ? [
          { id: 'notes-gap', node: <div className="h-4" /> },
          {
            id: 'notes',
            node: (
              <div>
                <div
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: TEXT_MUTED }}
                >
                  Notes
                </div>
                <p
                  className="mt-1 whitespace-pre-line text-[12.5px]"
                  style={{ color: TEXT }}
                >
                  {bill.notes}
                </p>
              </div>
            ),
          },
        ]
      : []),
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
          <FallbackHeader clinic={clinic} bill={bill} />
        )}
        renderFallbackFooter={() => <FallbackFooter />}
        mode={mode}
        onReady={onReady}
      />
    </div>
  );
}
