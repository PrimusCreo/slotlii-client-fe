import { createContext, useContext, useState, useEffect } from 'react';
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
