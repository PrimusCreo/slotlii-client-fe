import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import { ClinicProvider } from './context/ClinicContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './components/theme-provider';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from './components/ui/sonner';
import ProtectedRoute from './components/ProtectedRoute';
import { UpgradeDialogHost } from './components/subscription/UpgradeDialog';
import { PERMISSIONS } from '@/lib/permissions';

import Login from './pages/Login';
import Signup from './pages/Signup';
import VerifyEmail from './pages/VerifyEmail';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import NewAppointment from './pages/NewAppointment';
import CalendarPage from './pages/Calendar';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Doctors from './pages/Doctors';
import DoctorDetail from './pages/DoctorDetail';
import Settings from './pages/Settings';
import Plans from './pages/Plans';
import Treatments from './pages/Treatments';
import Billing from './pages/Billing';
import NewBill from './pages/NewBill';
import BillDetail from './pages/BillDetail';
import Users from './pages/Users';
import PublicConsentSign from './pages/PublicConsentSign';

export default function App() {
  return (
    <ThemeProvider defaultTheme="system">
      <TooltipProvider delayDuration={250}>
        <BrowserRouter>
          <AuthProvider>
            <ClinicProvider>
              <NotificationProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/set-password" element={<VerifyEmail />} />
                <Route path="/accept-invite" element={<VerifyEmail />} />
                <Route path="/sign/consent/:token" element={<PublicConsentSign />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/" element={<ProtectedRoute requiredPermission={PERMISSIONS.DASHBOARD_VIEW}><Dashboard /></ProtectedRoute>} />
                <Route path="/appointments" element={<ProtectedRoute requiredPermission={PERMISSIONS.APPOINTMENTS_VIEW}><Appointments /></ProtectedRoute>} />
                <Route path="/appointments/new" element={<ProtectedRoute requiredPermission={PERMISSIONS.APPOINTMENTS_MANAGE}><NewAppointment /></ProtectedRoute>} />
                <Route path="/calendar" element={<ProtectedRoute requiredPermission={PERMISSIONS.CALENDAR_VIEW}><CalendarPage /></ProtectedRoute>} />
                <Route path="/patients" element={<ProtectedRoute requiredPermission={PERMISSIONS.PATIENTS_VIEW}><Patients /></ProtectedRoute>} />
                <Route path="/patients/:id" element={<ProtectedRoute requiredPermission={PERMISSIONS.PATIENTS_VIEW}><PatientDetail /></ProtectedRoute>} />
                <Route path="/doctors" element={<ProtectedRoute requiredPermission={PERMISSIONS.DOCTORS_VIEW}><Doctors /></ProtectedRoute>} />
                <Route path="/doctors/:id" element={<ProtectedRoute requiredPermission={PERMISSIONS.DOCTORS_VIEW}><DoctorDetail /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute requiredPermission={PERMISSIONS.CLINIC_SETTINGS_MANAGE}><Settings /></ProtectedRoute>} />
                <Route path="/settings/treatments" element={<ProtectedRoute requiredPermission={PERMISSIONS.TREATMENTS_MANAGE}><Treatments /></ProtectedRoute>} />
                <Route path="/settings/plans" element={<ProtectedRoute requiredPermission={PERMISSIONS.SUBSCRIPTION_MANAGE}><Plans /></ProtectedRoute>} />
                <Route path="/billing" element={<ProtectedRoute requiredPermission={PERMISSIONS.BILLS_VIEW}><Billing /></ProtectedRoute>} />
                <Route path="/billing/new" element={<ProtectedRoute requiredPermission={PERMISSIONS.BILLS_MANAGE}><NewBill /></ProtectedRoute>} />
                <Route path="/billing/:id" element={<ProtectedRoute requiredPermission={PERMISSIONS.BILLS_VIEW}><BillDetail /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute requiredPermission={PERMISSIONS.USERS_MANAGE}><Users /></ProtectedRoute>} />
              </Routes>
              <UpgradeDialogHost />
              </NotificationProvider>
            </ClinicProvider>
          </AuthProvider>
        </BrowserRouter>
        <Toaster position="top-right" />
      </TooltipProvider>
    </ThemeProvider>
  );
}
