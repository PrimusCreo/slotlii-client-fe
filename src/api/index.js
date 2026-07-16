import axios from 'axios';

// In dev, leave VITE_API_BASE_URL unset to use the Vite proxy at `/api`.
// In prod, set it to the full API origin, e.g. `https://api.slotlii.com/api`.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach JWT token ──────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('slotlii_client_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor — auto-logout on 401 ───────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      // Don't bounce visitors who are on a public page (e.g. the patient
      // signing a consent link). Those pages must remain reachable even if
      // there's a stale token in localStorage from a previous session on
      // the same device.
      const onPublicPage =
        typeof window !== 'undefined' &&
        /^\/sign\//.test(window.location.pathname);
      if (!isLoginRequest && !onPublicPage) {
        localStorage.removeItem('slotlii_client_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ────────────────────────────────────────────────
export const loginClient = (email, password) =>
  api.post('/auth/login', { email, password, role: 'client' });
export const signup = (email, password) =>
  api.post('/auth/signup', { email, password });
export const verifyEmail = (token) =>
  api.post('/auth/verify-email', { token });
export const setPassword = (token, password) =>
  api.post('/auth/set-password', { token, password });
export const acceptStaffInvite = (token, password) =>
  api.post('/auth/accept-staff-invite', { token, password });
export const getInvite = (token) => api.get(`/auth/invite/${token}`);
export const resendVerification = (email) =>
  api.post('/auth/resend-verification', { email });
export const getMe = () => api.get('/auth/me');

// ── Users (clinic staff RBAC) ───────────────────────────
export const getUsers = () => api.get('/users');
export const inviteUser = (payload) => api.post('/users/invite', payload);
export const resendUserInvite = (inviteId) =>
  api.post(`/users/invites/${inviteId}/resend`);
export const revokeUserInvite = (inviteId) =>
  api.delete(`/users/invites/${inviteId}`);
export const updateUser = (userId, payload) =>
  api.patch(`/users/${userId}`, payload);
export const deactivateUser = (userId) => api.delete(`/users/${userId}`);

// ── Roles (permission editor) ───────────────────────────
export const getRoles = () => api.get('/roles');
export const updateRolePermissions = (role, permissions) =>
  api.put(`/roles/${role}`, { permissions });
export const resetRolePermissions = (role) =>
  api.post(`/roles/${role}/reset`);

// ── Clinics ─────────────────────────────────────────────
export const getClinics = () => api.get('/clinics');
export const getClinic = (id) => api.get(`/clinics/${id}`);
export const updateClinic = (id, data) => api.put(`/clinics/${id}`, data);
export const completeOnboarding = (id) =>
  api.post(`/clinics/${id}/onboarding-complete`);
export const connectWhatsAppEmbeddedSignup = (id, payload) =>
  api.post(`/clinics/${id}/whatsapp/embedded-signup`, payload);
export const registerWhatsApp = (id, payload) =>
  api.post(`/clinics/${id}/whatsapp/register`, payload);
export const disconnectWhatsApp = (id) =>
  api.post(`/clinics/${id}/whatsapp/disconnect`);
export const uploadClinicLogo = (id, blob, meta = {}) => {
  const form = new FormData();
  const fileName = meta.fileName || 'logo.png';
  form.append('file', blob, fileName);
  if (meta.width) form.append('width', String(meta.width));
  if (meta.height) form.append('height', String(meta.height));
  return api.post(`/clinics/${id}/logo`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const deleteClinicLogo = (id) => api.delete(`/clinics/${id}/logo`);

/**
 * Upload a letterhead part ("header" or "footer") for a clinic. The
 * cropper commits a fixed 794×107 PNG blob; we forward its dimensions
 * so the backend can persist them alongside the file for reference.
 */
export const uploadClinicLetterhead = (id, part, blob, meta = {}) => {
  const form = new FormData();
  const fileName = meta.fileName || `letterhead-${part}.png`;
  form.append('file', blob, fileName);
  if (meta.width) form.append('width', String(meta.width));
  if (meta.height) form.append('height', String(meta.height));
  return api.post(`/clinics/${id}/letterhead/${part}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const deleteClinicLetterhead = (id, part) =>
  api.delete(`/clinics/${id}/letterhead/${part}`);

// ── Appointments ────────────────────────────────────────
export const getAppointments = (params) => api.get('/appointments', { params });
export const getAvailableSlots = (params) => api.get('/appointments/slots', { params });
export const getAppointment = (id) => api.get(`/appointments/${id}`);
export const createAppointment = (data) => api.post('/appointments', data);
export const cancelAppointment = (id) => api.patch(`/appointments/${id}/cancel`);
export const rescheduleAppointment = (id, data) => api.patch(`/appointments/${id}/reschedule`, data);
export const updateAppointmentStatus = (id, status) => api.patch(`/appointments/${id}/status`, { status });

// ── Patients ────────────────────────────────────────────
export const getPatients = (params) => api.get('/patients', { params });
export const getPatient = (id) => api.get(`/patients/${id}`);
export const createPatient = (data) => api.post('/patients', data);
export const updatePatient = (id, data) => api.put(`/patients/${id}`, data);
export const getPatientAppointments = (id) => api.get(`/patients/${id}/appointments`);
export const addMedicalHistory = (id, data) => api.post(`/patients/${id}/medical-history`, data);
export const addPatientReport = (id, formData) =>
  api.post(`/patients/${id}/reports`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const updatePatientMedicalHistory = (id, entryId, data) =>
  api.patch(`/patients/${id}/medical-history/${entryId}`, data);
export const deletePatientMedicalHistory = (id, entryId) =>
  api.delete(`/patients/${id}/medical-history/${entryId}`);
export const shareMedicalHistoryViaWhatsApp = (patientId, entryId) =>
  api.post(`/patients/${patientId}/medical-history/${entryId}/share-whatsapp`);

// ── Doctors ─────────────────────────────────────────────
export const getDoctors = (params) => api.get('/doctors', { params });
export const getDoctor = (id) => api.get(`/doctors/${id}`);
export const createDoctor = (data) => api.post('/doctors', data);
export const updateDoctor = (id, data) => api.put(`/doctors/${id}`, data);
export const deleteDoctor = (id) => api.delete(`/doctors/${id}`);
export const getDoctorAppointments = (doctorId) => api.get(`/doctors/${doctorId}/appointments`);

// ── Feedback ────────────────────────────────────────────
export const submitFeedback = (data) => api.post('/feedback', data);

// ── Stats ───────────────────────────────────────────────
export const getDashboardStats = (params) =>
  api.get('/stats/dashboard', { params });

// ── Medicines (autocomplete) ────────────────────────────
export const searchMedicines = (q, limit = 10, opts = {}) =>
  api.get('/medicines/autocomplete', { params: { q, limit }, ...opts });

// ── Consent templates ───────────────────────────────────
export const getConsentTemplates = (params) =>
  api.get('/consent-templates', { params });
export const getConsentTemplate = (id) => api.get(`/consent-templates/${id}`);
export const createConsentTemplate = (data) =>
  api.post('/consent-templates', data);
export const updateConsentTemplate = (id, data) =>
  api.patch(`/consent-templates/${id}`, data);
export const deleteConsentTemplate = (id) =>
  api.delete(`/consent-templates/${id}`);

// ── Treatments catalogue ────────────────────────────────
export const getTreatments = (params) => api.get('/treatments', { params });
export const getTreatment = (id) => api.get(`/treatments/${id}`);
export const createTreatment = (data) => api.post('/treatments', data);
export const updateTreatment = (id, data) =>
  api.patch(`/treatments/${id}`, data);
export const deleteTreatment = (id, params) =>
  api.delete(`/treatments/${id}`, { params });

// ── Bills / invoices ────────────────────────────────────
export const getBills = (params) => api.get('/bills', { params });
export const getBillsSummary = (params) =>
  api.get('/bills/summary', { params });
export const getBill = (id) => api.get(`/bills/${id}`);
export const createBill = (data) => api.post('/bills', data);
export const updateBill = (id, data) => api.patch(`/bills/${id}`, data);
export const issueBill = (id) => api.post(`/bills/${id}/issue`);
export const cancelBill = (id, data) => api.post(`/bills/${id}/cancel`, data);
export const addBillPayment = (id, data) =>
  api.post(`/bills/${id}/payments`, data);
export const deleteBillPayment = (id, paymentId) =>
  api.delete(`/bills/${id}/payments/${paymentId}`);
export const deleteBill = (id) => api.delete(`/bills/${id}`);
export const downloadBillPdfUrl = (id) => `${API_BASE_URL}/bills/${id}/pdf`;

// ── Patient consents ────────────────────────────────────
export const createPatientConsent = (patientId, data) =>
  api.post(`/patients/${patientId}/consents`, data);
export const updatePatientConsent = (patientId, entryId, data) =>
  api.patch(`/patients/${patientId}/consents/${entryId}`, data);
export const sharePatientConsentViaWhatsApp = (patientId, entryId) =>
  api.post(`/patients/${patientId}/consents/${entryId}/share-whatsapp`);
export const signPatientConsentStaff = (patientId, entryId, data) =>
  api.post(`/patients/${patientId}/consents/${entryId}/sign-staff`, data);
export const downloadPatientConsentPdfUrl = (patientId, entryId) =>
  `${API_BASE_URL}/patients/${patientId}/consents/${entryId}/pdf`;

// ── Public consent signing (no auth) ────────────────────
// We build a dedicated axios instance so the global JWT interceptor /
// 401-redirect logic don't interfere with the public flow.
const publicApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});
export const getPublicConsent = (token) =>
  publicApi.get(`/public/consents/${token}`);
export const signPublicConsent = (token, data) =>
  publicApi.post(`/public/consents/${token}/sign`, data);

// ── Notifications ───────────────────────────────────────
export const getNotifications = (params) =>
  api.get('/notifications', { params });
export const getUnreadNotificationCount = () =>
  api.get('/notifications/unread-count');
export const markNotificationRead = (id) =>
  api.post(`/notifications/${id}/read`);
export const markAllNotificationsRead = () =>
  api.post('/notifications/mark-all-read');
/**
 * SSE stream URL for the notification bus. `EventSource` cannot set an
 * Authorization header, so the JWT is passed via `?token=` and the
 * backend validates it inline before upgrading the response to a stream.
 *
 * In dev, `API_BASE_URL` is the relative `/api` (proxied by Vite). In
 * prod it's the absolute origin from `VITE_API_BASE_URL`. Either way the
 * browser resolves the returned URL correctly.
 */
export const notificationStreamUrl = () => {
  const token = localStorage.getItem('slotlii_client_token');
  if (!token) return null;
  return `${API_BASE_URL}/notifications/stream?token=${encodeURIComponent(token)}`;
};

export default api;
