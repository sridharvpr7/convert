import React, { useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export interface GlobalBackButtonProps {
  /** Optional custom class name */
  className?: string;
  /** Fallback route path if no browser/app history exists. Defaults to '/' */
  fallbackPath?: string;
  /** Custom label. Defaults to 'Back' */
  label?: string;
  /** Whether to show the button on the Home page ('/'). Defaults to false */
  showOnHome?: boolean;
}

/**
 * GlobalBackButton
 *
 * A consistent, accessible, theme-aware back button for CONVET PULSE.
 * Safely navigates to the previous page if internal app history exists,
 * or gracefully falls back to the application Home page.
 * Prevents accidental navigation outside the application.
 */
export const GlobalBackButton: React.FC<GlobalBackButtonProps> = ({
  className = '',
  fallbackPath = '/',
  label = 'Back',
  showOnHome = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isNavigatingRef = useRef(false);

  // By default, hide on the application Home page unless explicitly requested
  if (!showOnHome && location.pathname === '/') {
    return null;
  }

  const handleBack = useCallback(
    (e?: React.MouseEvent | React.KeyboardEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      // Prevent duplicate rapid navigation events
      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;

      try {
        // Inspect React Router DOM v6 history state index
        const historyIdx = (window.history.state as { idx?: number } | null)?.idx;
        const hasInternalHistory =
          typeof historyIdx === 'number' ? historyIdx > 0 : window.history.length > 1;

        if (hasInternalHistory) {
          navigate(-1);
        } else {
          // If no internal app history exists (e.g. direct entry or refresh),
          // safely fallback to Home without leaving the app.
          navigate(fallbackPath, { replace: true });
        }
      } catch {
        navigate(fallbackPath, { replace: true });
      } finally {
        setTimeout(() => {
          isNavigatingRef.current = false;
        }, 350);
      }
    },
    [navigate, fallbackPath]
  );

  return (
    <button
      type="button"
      onClick={handleBack}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleBack(e);
        }
      }}
      aria-label="Go back to previous page"
      title={label}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium transition-all duration-150 select-none cursor-pointer group active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${className}`}
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
        boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0, 0, 0, 0.05))',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--hover)';
        e.currentTarget.style.borderColor = 'var(--border-hover, var(--border))';
        e.currentTarget.style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--surface)';
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.color = 'var(--text-secondary)';
      }}
    >
      <ArrowLeft
        size={14}
        className="transition-transform duration-150 group-hover:-translate-x-0.5 flex-shrink-0"
        style={{ color: 'inherit' }}
        aria-hidden="true"
      />
      <span className="font-medium tracking-tight whitespace-nowrap">{label}</span>
    </button>
  );
};

export default GlobalBackButton;
