import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useClinic } from '../context/ClinicContext';

/**
 * ProtectedRoute
 *
 * Wraps a page and enforces access control before rendering.
 *
 * Props:
 *   - children:            page to render if the caller is authorized.
 *   - requiredRole:        optional 'admin' | 'doctor' | 'receptionist' (or
 *                          array). Legacy escape hatch — prefer
 *                          `requiredPermission` for new gates.
 *   - requiredPermission:  single permission string, checked against the
 *                          shared catalog. Preferred.
 *   - requiredPermissionAny: array of permissions; the user only needs one.
 *
 * Unauthorized users are redirected to `/` (dashboard) rather than the
 * login screen — they *are* logged in, just not entitled to this page.
 */
export default function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
  requiredPermissionAny,
}) {
  const {
    isAuthenticated,
    loading: authLoading,
    isClinicUser,
    role,
    can,
    canAny,
  } = useAuth();
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

  // Onboarding gate — applies to every clinic staff user regardless of role.
  // Platform admins bypass this because they don't belong to a clinic.
  if (isClinicUser) {
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

  if (requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowed.includes(role)) {
      return <Navigate to="/" replace />;
    }
  }

  if (requiredPermission && !can(requiredPermission)) {
    return <Navigate to="/" replace />;
  }

  if (
    Array.isArray(requiredPermissionAny) &&
    requiredPermissionAny.length &&
    !canAny(requiredPermissionAny)
  ) {
    return <Navigate to="/" replace />;
  }

  return children;
}
