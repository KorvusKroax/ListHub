"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { setAuthCallback, apiFetch } from '@/lib/api';

type AuthUser = {
  id?: number;
  username: string;
  email: string;
  roles?: string[];
};

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  user: AuthUser | null;
  checkAuth: () => Promise<void>;
  setAuthenticated: (value: boolean, user?: AuthUser | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      const response = await apiFetch('http://localhost:8080/api/me');
      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(true);
        setUser(data.user ?? null);
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch {
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const setAuthenticated = useCallback((value: boolean, nextUser: AuthUser | null = null) => {
    setIsAuthenticated(value);
    setUser(value ? nextUser : null);
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
      setUser(null);
    }
  }, []);

  // Csak egyszer fusson mount-kor
  useEffect(() => {
    // Ne ellenőrizzük auth-ot a login oldalon
    if (typeof window !== 'undefined' && window.location.pathname === '/login') {
      setLoading(false);
    } else {
      checkAuth();
    }

    // Regisztráljuk a callback-et
    setAuthCallback((authenticated) => {
      setIsAuthenticated(authenticated);
      if (!authenticated) {
        setUser(null);
      }
      setLoading(false);
    });
  }, []); // üres dependency array

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, user, checkAuth, setAuthenticated, logout }}>
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
