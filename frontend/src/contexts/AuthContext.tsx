"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { setAuthCallback, apiFetch } from '@/lib/api';

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  checkAuth: () => Promise<void>;
  setAuthenticated: (value: boolean) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const response = await apiFetch('http://localhost:8080/api/lists');
      setIsAuthenticated(response.ok);
    } catch {
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const setAuthenticated = useCallback((value: boolean) => {
    setIsAuthenticated(value);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('http://localhost:8080/logout', {
        method: 'POST',
      });
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setIsAuthenticated(false);
    }
  }, []);

  // Csak egyszer fusson mount-kor
  useEffect(() => {
    checkAuth();
    // Regisztráljuk a callback-et
    setAuthCallback((authenticated) => {
      setIsAuthenticated(authenticated);
      setLoading(false);
    });
  }, []); // üres dependency array

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, checkAuth, setAuthenticated, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
