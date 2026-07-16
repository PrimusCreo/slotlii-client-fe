/**
 * Shared helpers + constants for the Billing module.
 *
 * Keeping these in one place keeps the listing page, the detail page,
 * the new-bill flow and the patient detail tab visually consistent —
 * status colours, currency formatting and labels all match.
 */

export const STATUS_META = {
  DRAFT: {
    label: 'Draft',
    className:
      'bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-200',
    dot: 'bg-zinc-400',
  },
  UNPAID: {
    label: 'Unpaid',
    className:
      'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
    dot: 'bg-amber-500',
  },
  PARTIALLY_PAID: {
    label: 'Part-paid',
    className:
      'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
    dot: 'bg-blue-500',
  },
  PAID: {
    label: 'Paid',
    className:
      'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
    dot: 'bg-emerald-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    className:
      'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200',
    dot: 'bg-rose-500',
  },
};

export const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'UPI', label: 'UPI' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'OTHER', label: 'Other' },
];

export const PAYMENT_METHOD_LABEL = PAYMENT_METHODS.reduce((acc, m) => {
  acc[m.value] = m.label;
  return acc;
}, {});

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

export function formatInr(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '₹0.00';
  return inrFormatter.format(n);
}

export function formatBillDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatBillDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Pure local recompute that mirrors the server-side pre-save totals. */
export function computeTotals(items, discount) {
  const subtotal = (items || []).reduce((sum, it) => {
    const q = Number(it.quantity || 0);
    const p = Number(it.unitPrice || 0);
    return sum + q * p;
  }, 0);
  let discountAmount = 0;
  if (discount?.type === 'PERCENT') {
    const pct = Math.min(100, Math.max(0, Number(discount.value) || 0));
    discountAmount = (subtotal * pct) / 100;
  } else if (discount?.type === 'FLAT') {
    discountAmount = Math.max(0, Number(discount.value) || 0);
  }
  if (discountAmount > subtotal) discountAmount = subtotal;
  const totalAmount = subtotal - discountAmount;
  return { subtotal, discountAmount, totalAmount };
}
