import { createContext, useContext, useState, useEffect } from 'react';
import * as api from '../api';

const AuthContext = createContext(null);

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

  async function login(username, password) {
    const res = await api.loginClient(username, password);
    const { token, user: userData } = res.data.data;
    localStorage.setItem('slotlii_client_token', token);
    setUser(userData);
    return userData;
  }

  function logout() {
    localStorage.removeItem('slotlii_client_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
