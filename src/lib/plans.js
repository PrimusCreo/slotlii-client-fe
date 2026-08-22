/**
 * Plan presentation helpers.
 *
 * This file used to mirror the backend's `config/plans.js` by hand. It no longer
 * does, and must not again: the catalog is a database collection that platform
 * admins edit from the back office, so the tiers, their prices, limits and
 * features all come from `GET /api/subscription/plans` via `usePlanCatalog()`.
 *
 * What lives here is purely presentational — formatting, and the layout of the
 * comparison table, which is a design decision rather than data.
 */

/** Rs 1,50,000 — Indian digit grouping, no decimals since Slotlii has no paise. */
export function formatRupees(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return `\u20B9${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/** 1.2 GB / 340 MB / 0 B — one decimal place once we're past kilobytes. */
export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const value = n / 1024 ** i;
  const decimals = i <= 1 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[i]}`;
}

/** Find a tier in a catalog list. Null when it isn't on sale any more. */
export function findPlan(plans, code) {
  if (!code) return null;
  return (plans || []).find((plan) => plan.code === String(code)) || null;
}

/**
 * Cheapest-first position of a tier, for deciding whether a switch reads as an
 * upgrade or a downgrade. -1 when the tier isn't in the list.
 */
export function rankOf(plans, code) {
  return (plans || [])
    .slice()
    .sort((a, b) => a.monthlyPrice - b.monthlyPrice)
    .findIndex((plan) => plan.code === String(code || ''));
}

function limitText(value, formatter) {
  if (value === null || value === undefined) return 'Unlimited';
  return formatter ? formatter(value) : Number(value).toLocaleString('en-IN');
}

/**
 * Rows for the side-by-side comparison table under the plan cards.
 *
 * The grouping and wording are ours; the values are read off whatever the API
 * returned, so a tier an admin adds tomorrow gets a column with no code change.
 * `value` resolves per plan; a boolean renders as a tick or a dash.
 */
export const COMPARISON_GROUPS = [
  {
    title: 'Capacity',
    rows: [
      { label: 'Doctors', value: (p) => limitText(p.limits.maxDoctors) },
      { label: 'Staff accounts', value: (p) => limitText(p.limits.maxStaffUsers) },
      { label: 'Patients and appointments', value: () => 'Unlimited' },
      {
        label: 'File storage',
        value: (p) => limitText(p.limits.maxStorageBytes, formatBytes),
      },
      {
        label: 'WhatsApp messages a month',
        value: (p) => limitText(p.limits.maxWhatsappPerMonth),
      },
      {
        label: 'Branches',
        value: (p) => limitText(p.limits.maxBranches),
        comingSoon: true,
      },
    ],
  },
  {
    title: 'Everyday clinic tools',
    rows: [
      { label: 'WhatsApp booking bot', value: () => true },
      { label: 'Calendar and token queue', value: () => true },
      { label: 'Prescriptions and medical records', value: () => true },
      { label: 'Invoices and payment tracking', value: () => true },
      { label: 'Treatment catalogue', value: () => true },
    ],
  },
  {
    title: 'Growth tools',
    rows: [
      { label: 'Consent forms with e-sign', value: (p) => p.features.consents },
      { label: 'Custom logo and letterhead', value: (p) => p.features.branding },
      {
        label: 'Automated reminders and follow-ups',
        value: (p) => p.features.reminders,
      },
      { label: 'Custom role permissions', value: (p) => p.features.customRoles },
      { label: 'Analytics dashboard', value: (p) => p.features.analytics },
    ],
  },
  {
    title: 'Scale',
    rows: [
      {
        label: 'Multi-branch clinics',
        value: (p) => p.features.multiBranch,
        comingSoon: true,
      },
      {
        label: 'Cross-branch reporting',
        value: (p) => p.features.multiBranch,
        comingSoon: true,
      },
      { label: 'AI natural-language booking', value: (p) => p.features.nlp },
      { label: 'Data export and API access', value: (p) => p.features.apiAccess },
    ],
  },
];

/** Friendly names for the limit keys the backend reports in error payloads. */
export const LIMIT_LABELS = {
  maxBranches: 'branches',
  maxDoctors: 'doctors',
  maxStaffUsers: 'staff accounts',
  maxWhatsappPerMonth: 'WhatsApp messages this month',
  maxStorageBytes: 'file storage',
};
