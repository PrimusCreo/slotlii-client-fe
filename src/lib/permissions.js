/**
 * Permission catalog + role → permissions map.
 *
 * Mirror of the backend catalog at
 * `slotlii-app-be/src/config/permissions.js` — keep the two files in sync
 * when adding, renaming, or reassigning a permission.
 *
 * Runtime model:
 *   - The backend's `getMe()` and `login()` responses embed an expanded
 *     `permissions: [...]` array of the current user's *effective* grants
 *     (with per-clinic overrides already applied). AuthContext exposes
 *     a `can()` bound to that array, so live-editable permissions Just
 *     Work on the next `/me` call.
 *   - The static ROLE_PERMISSIONS map below is a fallback used when
 *     `user.permissions` isn't available yet (e.g. very old JWT). It's
 *     also the "default" shown in the Roles editor before an override
 *     is saved.
 */

export const PERMISSIONS = Object.freeze({
  // ── User & clinic management (admin-only defaults) ─────
  USERS_MANAGE: 'users.manage',
  CLINIC_SETTINGS_MANAGE: 'clinic.settings.manage',
  CLINIC_WHATSAPP_MANAGE: 'clinic.whatsapp.manage',
  TREATMENTS_MANAGE: 'treatments.manage',
  CONSENTS_TEMPLATES_MANAGE: 'consents.templates.manage',
  DOCTORS_MANAGE: 'doctors.manage',
  BILLS_DELETE: 'bills.delete',
  SUBSCRIPTION_MANAGE: 'subscription.manage',

  // ── Everyday operations (all clinic roles by default) ──
  DASHBOARD_VIEW: 'dashboard.view',
  CALENDAR_VIEW: 'calendar.view',
  APPOINTMENTS_VIEW: 'appointments.view',
  APPOINTMENTS_MANAGE: 'appointments.manage',
  PATIENTS_VIEW: 'patients.view',
  PATIENTS_MANAGE: 'patients.manage',
  DOCTORS_VIEW: 'doctors.view',
  TREATMENTS_VIEW: 'treatments.view',
  BILLS_VIEW: 'bills.view',
  BILLS_MANAGE: 'bills.manage',

  // ── Medical scope (admin + doctor by default) ──────────
  PATIENTS_MEDICAL_MANAGE: 'patients.medical.manage',
  CONSENTS_MANAGE: 'consents.manage',
});

export const PERMISSION_METADATA = Object.freeze({
  [PERMISSIONS.USERS_MANAGE]: {
    label: 'Manage users',
    description: 'Invite, edit, and deactivate staff accounts',
    group: 'Administration',
  },
  [PERMISSIONS.CLINIC_SETTINGS_MANAGE]: {
    label: 'Clinic settings',
    description: 'Edit clinic profile, branding, and working hours',
    group: 'Administration',
  },
  [PERMISSIONS.CLINIC_WHATSAPP_MANAGE]: {
    label: 'WhatsApp integration',
    description: 'Connect and manage the WhatsApp Cloud API',
    group: 'Administration',
  },
  [PERMISSIONS.TREATMENTS_MANAGE]: {
    label: 'Manage treatments',
    description: 'Create and edit the treatment catalogue',
    group: 'Catalogue',
  },
  [PERMISSIONS.CONSENTS_TEMPLATES_MANAGE]: {
    label: 'Manage consent templates',
    description: 'Create and edit consent form templates',
    group: 'Catalogue',
  },
  [PERMISSIONS.DOCTORS_MANAGE]: {
    label: 'Manage doctors',
    description: 'Add, edit, or remove doctor records',
    group: 'Directory',
  },
  [PERMISSIONS.BILLS_DELETE]: {
    label: 'Delete bills',
    description: 'Permanently remove an invoice (destructive)',
    group: 'Billing',
  },
  [PERMISSIONS.SUBSCRIPTION_MANAGE]: {
    label: 'Plan and billing',
    description: "View and change the clinic's Slotlii subscription",
    group: 'Administration',
  },
  [PERMISSIONS.DASHBOARD_VIEW]: {
    label: 'View dashboard',
    description: 'See clinic-wide summary and statistics',
    group: 'Everyday',
  },
  [PERMISSIONS.CALENDAR_VIEW]: {
    label: 'View calendar',
    description: 'See the multi-doctor calendar view',
    group: 'Everyday',
  },
  [PERMISSIONS.APPOINTMENTS_VIEW]: {
    label: 'View appointments',
    description: 'See appointment list and details',
    group: 'Appointments',
  },
  [PERMISSIONS.APPOINTMENTS_MANAGE]: {
    label: 'Manage appointments',
    description: 'Create, reschedule, and cancel appointments',
    group: 'Appointments',
  },
  [PERMISSIONS.PATIENTS_VIEW]: {
    label: 'View patients',
    description: 'See patient list and profile details',
    group: 'Patients',
  },
  [PERMISSIONS.PATIENTS_MANAGE]: {
    label: 'Manage patients',
    description: 'Create and edit patient profile details',
    group: 'Patients',
  },
  [PERMISSIONS.PATIENTS_MEDICAL_MANAGE]: {
    label: 'Manage medical records',
    description: 'Add prescriptions and edit medical history',
    group: 'Medical',
  },
  [PERMISSIONS.CONSENTS_MANAGE]: {
    label: 'Manage consents',
    description: 'Create, sign, and share patient consent forms',
    group: 'Medical',
  },
  [PERMISSIONS.DOCTORS_VIEW]: {
    label: 'View doctors',
    description: 'See the doctor directory',
    group: 'Directory',
  },
  [PERMISSIONS.TREATMENTS_VIEW]: {
    label: 'View treatments',
    description: 'See the treatment catalogue',
    group: 'Catalogue',
  },
  [PERMISSIONS.BILLS_VIEW]: {
    label: 'View bills',
    description: 'See invoices and payment history',
    group: 'Billing',
  },
  [PERMISSIONS.BILLS_MANAGE]: {
    label: 'Manage bills',
    description: 'Create, edit, and issue bills; record payments',
    group: 'Billing',
  },
});

export const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));

export const ROLE_PERMISSIONS = Object.freeze({
  admin: ['*'],
  doctor: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CALENDAR_VIEW,
    PERMISSIONS.APPOINTMENTS_VIEW,
    PERMISSIONS.APPOINTMENTS_MANAGE,
    PERMISSIONS.PATIENTS_VIEW,
    PERMISSIONS.PATIENTS_MANAGE,
    PERMISSIONS.PATIENTS_MEDICAL_MANAGE,
    PERMISSIONS.CONSENTS_MANAGE,
    PERMISSIONS.DOCTORS_VIEW,
    PERMISSIONS.TREATMENTS_VIEW,
    PERMISSIONS.BILLS_VIEW,
    PERMISSIONS.BILLS_MANAGE,
  ],
  receptionist: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CALENDAR_VIEW,
    PERMISSIONS.APPOINTMENTS_VIEW,
    PERMISSIONS.APPOINTMENTS_MANAGE,
    PERMISSIONS.PATIENTS_VIEW,
    PERMISSIONS.PATIENTS_MANAGE,
    PERMISSIONS.DOCTORS_VIEW,
    PERMISSIONS.TREATMENTS_VIEW,
    PERMISSIONS.BILLS_VIEW,
    PERMISSIONS.BILLS_MANAGE,
  ],
});

/**
 * Roles that admins can edit through the Roles UI. `admin` is not
 * editable because reducing its permissions could lock a clinic out of
 * user management.
 */
export const EDITABLE_ROLES = Object.freeze(['doctor', 'receptionist']);

/**
 * `can(role, permission)` — role-based fallback used when the current
 * user's live permission list isn't available. Prefer AuthContext's
 * `can` (which reads `user.permissions`) for anything user-facing.
 */
export function can(role, permission) {
  if (!role || !permission) return false;
  const grants = ROLE_PERMISSIONS[role];
  if (!grants) return false;
  return grants.includes('*') || grants.includes(permission);
}

export function canAll(role, permissions = []) {
  return permissions.every((p) => can(role, p));
}

export function canAny(role, permissions = []) {
  return permissions.some((p) => can(role, p));
}
