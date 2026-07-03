import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import * as api from '../api';
import {
  can as canForRole,
  canAll as canAllForRole,
  canAny as canAnyForRole,
} from '../lib/permissions';

const AuthContext = createContext(null);

/**
 * Roles the backend can emit in the JWT for a *clinic* login:
 *   - 'admin'        — clinic owner/manager (manages users)
 *   - 'doctor'       — treating physician
 *   - 'receptionist' — front-desk staff
 *
 * The env-based platform admin login emits `role: 'platform_admin'` and
 * has no clinic scope.
 */
const CLINIC_ROLES = new Set(['admin', 'doctor', 'receptionist']);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const token = localStorage.getItem('slotlii_client_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.getMe();
      setUser(res.data.data);
    } catch {
      localStorage.removeItem('slotlii_client_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const res = await api.loginClient(email, password);
    const { token, user: userData } = res.data.data;
    localStorage.setItem('slotlii_client_token', token);
    setUser(userData);
    return userData;
  }

  /**
   * Used by every "invite acceptance" surface (signup verify, admin-invite
   * set-password, staff-invite accept) — all of them respond with a JWT
   * that we just persist + hydrate.
   */
  function applyAuthPayload({ token, user: userData }) {
    localStorage.setItem('slotlii_client_token', token);
    setUser(userData);
    return userData;
  }

  function logout() {
    localStorage.removeItem('slotlii_client_token');
    setUser(null);
  }

  const value = useMemo(() => {
    const role = user?.role || null;
    const isClinicUser = role ? CLINIC_ROLES.has(role) : false;

    // The backend ships the current user's *effective* permissions (with
    // any per-clinic overrides already applied). Prefer that live list
    // over the static role → permissions map so admin-edited role
    // changes take effect on the next getMe / re-login without a code
    // deploy. Fall back to the map only if the server payload is
    // missing (very old JWT / unexpected shape).
    const grants = Array.isArray(user?.permissions) ? user.permissions : null;
    const canFn = grants
      ? (permission) => (permission ? grants.includes(permission) : false)
      : (permission) => canForRole(role, permission);
    const canAllFn = grants
      ? (list) => (list || []).every((p) => grants.includes(p))
      : (list) => canAllForRole(role, list || []);
    const canAnyFn = grants
      ? (list) => (list || []).some((p) => grants.includes(p))
      : (list) => canAnyForRole(role, list || []);

    return {
      user,
      loading,
      isAuthenticated: !!user,
      role,
      isClinicUser,
      isAdmin: role === 'admin',
      isDoctor: role === 'doctor',
      isReceptionist: role === 'receptionist',
      isPlatformAdmin: role === 'platform_admin',
      hasRole: (...roles) => (role ? roles.includes(role) : false),
      /**
       * `true` for a doctor account that has a linked `Doctor` record.
       * The backend narrows list / detail responses to their own data in
       * that case, so the UI should hide doctor-selector filters and
       * surface "Showing your data" hints.
       */
      isScopedDoctor: role === 'doctor' && !!user?.doctorId,
      doctorId: user?.doctorId || null,
      /**
       * Permission helpers bound to the current user's effective grants.
       * All three return false when there's no user (e.g. during initial
       * load), so gated UI stays hidden until authentication resolves.
       */
      can: canFn,
      canAll: canAllFn,
      canAny: canAnyFn,
      /**
       * Force AuthContext to re-read the current user's permissions from
       * the server — used after an admin edits role permissions so their
       * own UI reflects the change immediately.
       */
      refreshMe: checkAuth,
      login,
      logout,
      applyAuthPayload,
    };
  }, [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
