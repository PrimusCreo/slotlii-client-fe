import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useClinic } from '../context/ClinicContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { selectedClinic, loading: clinicLoading } = useClinic();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Onboarding gate (clients only — admins are not subject to it).
  // Wait for clinic to load before deciding to redirect, otherwise we'd
  // briefly bounce users to /onboarding while their clinic state is still
  // resolving on the very first render.
  if (user?.role === 'client') {
    if (clinicLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      );
    }
    if (selectedClinic && !selectedClinic.onboardingCompletedAt) {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return children;
}
