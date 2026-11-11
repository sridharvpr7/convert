import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useAppStore, Theme } from '@/store/app.store';

const themes: { value: Theme; icon: React.ReactNode; label: string }[] = [
  { value: 'light', icon: <Sun size={14} />, label: 'Light' },
  { value: 'dark', icon: <Moon size={14} />, label: 'Dark' },
  { value: 'system', icon: <Monitor size={14} />, label: 'System' },
];

interface ThemeSwitcherProps {
  compact?: boolean;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ compact = false }) => {
  const { theme, setTheme } = useAppStore();

  if (compact) {
    // Icon-only toggle button cycling through light → dark → system
    const current = themes.find((t) => t.value === theme) ?? themes[1];
    const next = themes[(themes.findIndex((t) => t.value === theme) + 1) % themes.length];
    return (
      <button
        onClick={() => setTheme(next.value)}
        className="btn-ghost btn-md w-9 h-9 px-0 rounded-lg"
        title={`Switch to ${next.label} mode`}
        aria-label={`Switch to ${next.label} mode`}
      >
        {current.icon}
      </button>
    );
  }

  return (
    <div
      className="flex items-center p-0.5 rounded-lg border"
      style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
    >
      {themes.map((t) => (
        <button
          key={t.value}
          onClick={() => setTheme(t.value)}
          className={`flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium transition-all duration-150 ${
            theme === t.value
              ? 'bg-surface-cv shadow-cv-sm text-primary'
              : 'text-muted-cv hover:text-primary'
          }`}
          title={`${t.label} mode`}
          aria-pressed={theme === t.value}
        >
          {t.icon}
          <span className="hidden sm:inline">{t.label}</span>
        </button>
      ))}
    </div>
  );
};

export default ThemeSwitcher;
