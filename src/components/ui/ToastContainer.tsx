// ============================================================
// CONVETER — Modern Floating Toast Notifications (Linear/Vercel style)
// ============================================================

import React, { useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { ToastContext, ToastMessage } from './ToastContext';

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, type, duration = 4000 }: Omit<ToastMessage, 'id'>) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-4), { id, title, description, type, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback((title: string, description?: string) => toast({ title, description, type: 'success' }), [toast]);
  const error = useCallback((title: string, description?: string) => toast({ title, description, type: 'error' }), [toast]);
  const info = useCallback((title: string, description?: string) => toast({ title, description, type: 'info' }), [toast]);
  const warning = useCallback((title: string, description?: string) => toast({ title, description, type: 'warning' }), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info, warning }}>
      {children}
      {/* Toast viewport */}
      <div
        className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-cv-lg backdrop-blur-md animate-slide-down transition-all"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex-shrink-0 mt-0.5">
              {t.type === 'success' && <CheckCircle2 size={18} className="text-success-500" />}
              {t.type === 'error' && <AlertCircle size={18} className="text-error-500" />}
              {t.type === 'warning' && <AlertTriangle size={18} className="text-warning-500" />}
              {t.type === 'info' && <Info size={18} style={{ color: 'var(--accent)' }} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary">{t.title}</p>
              {t.description && (
                <p className="text-xs text-muted-cv mt-0.5 leading-relaxed">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-muted-cv hover:text-primary transition-colors flex-shrink-0 p-1 rounded-md"
              aria-label="Close notification"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
