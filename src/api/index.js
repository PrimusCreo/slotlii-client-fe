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
      if (!isLoginRequest) {
        localStorage.removeItem('slotlii_client_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ────────────────────────────────────────────────
export const loginClient = (username, password) =>
  api.post('/auth/login', { username, password, role: 'client' });
export const getMe = () => api.get('/auth/me');

// ── Clinics ─────────────────────────────────────────────
export const getClinics = () => api.get('/clinics');
export const getClinic = (id) => api.get(`/clinics/${id}`);
export const updateClinic = (id, data) => api.put(`/clinics/${id}`, data);
export const connectWhatsAppEmbeddedSignup = (id, payload) =>
  api.post(`/clinics/${id}/whatsapp/embedded-signup`, payload);
export const disconnectWhatsApp = (id) =>
  api.post(`/clinics/${id}/whatsapp/disconnect`);

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

export default api;
