// ============================================================
// CONVETER — Toast Context & Hook
// ============================================================

import { createContext, useContext } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
  duration?: number;
}

export interface ToastContextType {
  toast: (msg: Omit<ToastMessage, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

export const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: () => {},
      success: (t: string) => console.log('[Toast Success]', t),
      error: (t: string) => console.error('[Toast Error]', t),
      info: (t: string) => console.log('[Toast Info]', t),
      warning: (t: string) => console.warn('[Toast Warning]', t),
    };
  }
  return ctx;
}

