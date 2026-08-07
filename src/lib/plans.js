/**
 * Subscription plan catalog.
 *
 * Mirror of the backend catalog at `slotlii-app-be/src/config/plans.js` — keep
 * the two files in sync when adding, renaming, or repricing anything (same
 * convention as `lib/permissions.js`).
 *
 * The live plan list is also served by `GET /api/subscription/plans`, but this
 * mirror lets the Plans page render instantly without waiting on a round trip,
 * and it owns the comparison-table layout, which is purely presentational.
 */

const GB = 1024 * 1024 * 1024;

const YEARLY_MONTHS_CHARGED = 11;

export const PLAN_ORDER = ['starter', 'growth', 'pro'];

export const BILLING_CYCLES = ['monthly', 'yearly'];

export const PLANS = {
  starter: {
    code: 'starter',
    name: 'Starter',
    tagline: 'For a single clinic finding its feet',
    monthlyMrp: 2000,
    monthlyPrice: 1500,
    popular: false,
    limits: {
      maxBranches: 1,
      maxDoctors: 2,
      maxStaffUsers: 3,
      maxWhatsappPerMonth: 1000,
      maxStorageBytes: 1 * GB,
    },
    features: {
      consents: false,
      branding: false,
      reminders: false,
      customRoles: false,
      analytics: false,
      nlp: false,
      multiBranch: false,
      apiAccess: false,
    },
    featureList: [
      { label: 'Unlimited patients and appointments' },
      { label: 'Calendar and token queue' },
      { label: 'WhatsApp booking bot on 1 number' },
      { label: 'Up to 1,000 WhatsApp messages a month' },
      { label: 'Up to 2 doctors and 3 staff accounts' },
      { label: 'Prescriptions and patient medical records' },
      { label: '1 GB file storage for reports and scans' },
      { label: 'Invoices with PDF and WhatsApp share' },
      { label: 'Treatment catalogue and pricing' },
      { label: 'Email support' },
    ],
  },

  growth: {
    code: 'growth',
    name: 'Growth',
    tagline: 'For busy practices with a full front desk',
    monthlyMrp: 3999,
    monthlyPrice: 2999,
    popular: true,
    limits: {
      maxBranches: 2,
      maxDoctors: 6,
      maxStaffUsers: 10,
      maxWhatsappPerMonth: 5000,
      maxStorageBytes: 2 * GB,
    },
    features: {
      consents: true,
      branding: true,
      reminders: true,
      customRoles: true,
      analytics: true,
      nlp: false,
      multiBranch: false,
      apiAccess: false,
    },
    featureList: [
      { label: 'Everything in Starter' },
      { label: 'Up to 6 doctors and 10 staff accounts' },
      { label: 'Up to 5,000 WhatsApp messages a month' },
      { label: '2 GB file storage' },
      { label: 'Consent forms with patient e-sign' },
      { label: 'Custom logo and letterhead on all PDFs' },
      { label: 'Automated appointment reminders and follow-ups' },
      { label: 'Custom role permissions for your team' },
      { label: 'Analytics dashboard' },
      { label: 'Priority email and WhatsApp support' },
    ],
  },

  pro: {
    code: 'pro',
    name: 'Pro',
    tagline: 'For multi-doctor groups scaling to more locations',
    monthlyMrp: 7999,
    monthlyPrice: 5999,
    popular: false,
    limits: {
      maxBranches: 5,
      maxDoctors: null,
      maxStaffUsers: null,
      maxWhatsappPerMonth: 20000,
      maxStorageBytes: 5 * GB,
    },
    features: {
      consents: true,
      branding: true,
      reminders: true,
      customRoles: true,
      analytics: true,
      nlp: true,
      multiBranch: true,
      apiAccess: true,
    },
    featureList: [
      { label: 'Everything in Growth' },
      { label: 'Unlimited doctors and staff accounts' },
      { label: 'Up to 20,000 WhatsApp messages a month' },
      { label: '5 GB file storage' },
      { label: 'Multi-branch clinics, up to 5 branches', comingSoon: true },
      { label: 'Cross-branch consolidated reporting', comingSoon: true },
      { label: 'AI natural-language booking' },
      { label: 'Data export and API access' },
      { label: 'Dedicated onboarding and account manager' },
    ],
  },
};

export function getPlan(code) {
  return PLANS[String(code || '')] || null;
}

export function rankOf(code) {
  return PLAN_ORDER.indexOf(String(code || ''));
}

/**
 * Pricing for one plan on one billing cycle. Yearly charges 11 months, and its
 * `mrp` is 12x the monthly price so the strike-through communicates exactly the
 * month you get free.
 */
export function priceFor(code, cycle) {
  const plan = getPlan(code);
  if (!plan) return null;

  if (cycle === 'yearly') {
    const amount = plan.monthlyPrice * YEARLY_MONTHS_CHARGED;
    return {
      cycle,
      amount,
      mrp: plan.monthlyPrice * 12,
      perMonth: Math.round(amount / 12),
      savings: plan.monthlyPrice * (12 - YEARLY_MONTHS_CHARGED),
    };
  }

  return {
    cycle: 'monthly',
    amount: plan.monthlyPrice,
    mrp: plan.monthlyMrp,
    perMonth: plan.monthlyPrice,
    savings: plan.monthlyMrp - plan.monthlyPrice,
  };
}

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

function limitText(value, formatter) {
  if (value === null || value === undefined) return 'Unlimited';
  return formatter ? formatter(value) : value.toLocaleString('en-IN');
}

/**
 * Rows for the side-by-side comparison table under the plan cards. `value`
 * resolves per plan; a boolean renders as a tick or a dash.
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
  {
    title: 'Support',
    rows: [
      {
        label: 'Support level',
        value: (p) =>
          ({
            starter: 'Email',
            growth: 'Priority email and WhatsApp',
            pro: 'Dedicated account manager',
          })[p.code],
      },
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
