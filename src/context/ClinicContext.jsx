import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import * as api from '../api';

const ClinicContext = createContext(null);

export function ClinicProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [loading, setLoading] = useState(true);

  // The clinicId comes from the JWT (set during login)
  const selectedClinicId = user?.clinicId || '';

  useEffect(() => {
    if (isAuthenticated && selectedClinicId) {
      loadClinic();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, selectedClinicId]);

  async function loadClinic() {
    try {
      const res = await api.getClinic(selectedClinicId);
      setSelectedClinic(res.data.data || null);
    } catch (err) {
      console.error('Failed to load clinic', err);
      setSelectedClinic(null);
    } finally {
      setLoading(false);
    }
  }

  /**
   * The backend embeds a read-only billing summary on the clinic payload, so
   * plan state costs no extra request. `reloadClinic()` is what refreshes it
   * after a checkout or cancellation.
   */
  const subscription = selectedClinic?.subscription || null;

  const subscriptionState = useMemo(() => {
    // Treat an unknown subscription as unlocked. Guessing "locked" would show
    // a paywall banner during the initial load, and the backend is the real
    // enforcement point regardless.
    if (!subscription) {
      return {
        subscription: null,
        isSubscriptionLocked: false,
        isTrialing: false,
        trialDaysRemaining: null,
        planCode: null,
        planLimits: {},
        planFeatures: {},
        hasFeature: () => true,
      };
    }

    return {
      subscription,
      isSubscriptionLocked: !subscription.isActive,
      isTrialing: Boolean(subscription.isTrialing),
      trialDaysRemaining: subscription.trialDaysRemaining ?? null,
      planCode: subscription.planCode || null,
      planLimits: subscription.limits || {},
      planFeatures: subscription.features || {},
      hasFeature: (key) => Boolean(subscription.features?.[key]),
    };
  }, [subscription]);

  return (
    <ClinicContext.Provider
      value={{
        clinics: selectedClinic ? [selectedClinic] : [],
        selectedClinicId,
        selectedClinic,
        setSelectedClinic,
        reloadClinic: loadClinic,
        setSelectedClinicId: () => {}, // no-op, locked to JWT clinic
        loading,
        ...subscriptionState,
      }}
    >
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic() {
  const ctx = useContext(ClinicContext);
  if (!ctx) throw new Error('useClinic must be used within ClinicProvider');
  return ctx;
}

export default ClinicContext;
