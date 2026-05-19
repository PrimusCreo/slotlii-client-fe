import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import { ClinicProvider } from './context/ClinicContext';
import { ThemeProvider } from './components/theme-provider';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from './components/ui/sonner';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import NewAppointment from './pages/NewAppointment';
import CalendarPage from './pages/Calendar';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Doctors from './pages/Doctors';
import DoctorDetail from './pages/DoctorDetail';
import Settings from './pages/Settings';

export default function App() {
  return (
    <ThemeProvider defaultTheme="system">
      <TooltipProvider delayDuration={250}>
        <BrowserRouter>
          <AuthProvider>
            <ClinicProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
                <Route path="/appointments/new" element={<ProtectedRoute><NewAppointment /></ProtectedRoute>} />
                <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
                <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
                <Route path="/patients/:id" element={<ProtectedRoute><PatientDetail /></ProtectedRoute>} />
                <Route path="/doctors" element={<ProtectedRoute><Doctors /></ProtectedRoute>} />
                <Route path="/doctors/:id" element={<ProtectedRoute><DoctorDetail /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              </Routes>
            </ClinicProvider>
          </AuthProvider>
        </BrowserRouter>
        <Toaster position="top-right" />
      </TooltipProvider>
    </ThemeProvider>
  );
}
