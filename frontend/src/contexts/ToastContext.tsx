"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, type, message }]);
    // auto remove after 3.5s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(
    () => ({
      success: (msg: string) => push('success', msg),
      error: (msg: string) => push('error', msg),
      info: (msg: string) => push('info', msg),
    }),
    [push]
  );

  // Debug hook - csak fejlesztéshez
  if (typeof window !== 'undefined') {
    (window as any).__TOAST_TEST__ = value;
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed top-4 right-4 z-[99999] space-y-2 pointer-events-none"
        style={{ position: 'fixed', top: '2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 99999 }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              'min-w-[240px] max-w-[420px] px-4 py-3 shadow-lg border pointer-events-auto ' +
              (t.type === 'success'
                ? 'bg-green-500 text-white'
                : t.type === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-gray-600 text-white')
            }
          >
            <p className="text-sm leading-snug">{t.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
