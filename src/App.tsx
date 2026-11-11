import React, { Suspense, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, toAppUser } from '@/lib/firebase';

// Layout
import { Header } from '@/components/navigation/Header';
import { CommandPalette } from '@/components/navigation/CommandPalette';

// Pages
import { HomePage } from '@/pages/HomePage';
import { ToolsPage } from '@/pages/ToolsPage';
import { ToolPage } from '@/pages/ToolPage';
import { AuthPage } from '@/pages/AuthPage';
import { PricingPage } from '@/pages/PricingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { FavoritesPage } from '@/pages/FavoritesPage';
import { WorkflowsPage } from '@/pages/WorkflowsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AdminPage } from '@/pages/AdminPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// UI Providers & Client
import { ToastProvider } from '@/components/ui/ToastContainer';
import { apiClient } from '@/lib/api';

// Store
import { useAppStore } from '@/store/app.store';

// ─────────────────────────────────────────────────────────
// QueryClient
// ─────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

// ─────────────────────────────────────────────────────────
// Scroll-to-top on route change
// ─────────────────────────────────────────────────────────
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
};

// ─────────────────────────────────────────────────────────
// Page wrapper — adds .page-enter animation + header offset
// ─────────────────────────────────────────────────────────
const PageWrapper: React.FC<{ children: React.ReactNode; noHeader?: boolean }> = ({
  children,
  noHeader = false,
}) => {
  return (
    <div className="page-enter min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      {!noHeader && <Header />}
      <main id="main-content" tabIndex={-1} className="outline-none">
        {children}
      </main>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// Loading fallback
// ─────────────────────────────────────────────────────────
const PageSkeleton: React.FC = () => (
  <div
    className="min-h-screen flex items-center justify-center"
    style={{ backgroundColor: 'var(--bg)' }}
  >
    <div className="flex flex-col items-center gap-4">
      <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="var(--accent)" />
        <path d="M9 13L13 9L17 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 9V21" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <path d="M23 19L19 23L15 19" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 23V11" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full animate-pulse"
            style={{
              backgroundColor: 'var(--accent)',
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────
// Notification panel (global overlay)
// ─────────────────────────────────────────────────────────
const NotificationsPanel: React.FC = () => {
  const {
    notificationsOpen,
    setNotificationsOpen,
    notifications,
    markNotificationsAsRead,
    clearNotifications,
  } = useAppStore();

  if (!notificationsOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[150]"
        onClick={() => setNotificationsOpen(false)}
        aria-hidden
      />
      <div
        className="fixed top-16 right-4 z-[151] w-80 rounded-xl border shadow-cv-lg animate-slide-down overflow-hidden"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="text-sm font-semibold text-primary">Notifications</span>
          <div className="flex items-center gap-2">
            {notifications.some((n) => !n.read) && (
              <button
                onClick={markNotificationsAsRead}
                className="text-xs text-muted-cv hover:text-accent transition-colors"
              >
                Mark read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearNotifications}
                className="text-xs text-muted-cv hover:text-error-600 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-cv">
            No notifications yet
          </div>
        ) : (
          <div className="divide-y max-h-80 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
            {notifications.map((n) => (
              <div
                key={n.id}
                className="flex gap-3 px-4 py-3 transition-colors hover:bg-hover-cv"
              >
                <div
                  className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                  style={{
                    backgroundColor: n.read
                      ? 'transparent'
                      : n.type === 'success'
                      ? '#22c55e'
                      : n.type === 'error'
                      ? '#ef4444'
                      : n.type === 'promo'
                      ? '#f59e0b'
                      : 'var(--accent)',
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-medium ${n.read ? 'text-muted-cv' : 'text-primary'}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-cv mt-0.5 break-words">{n.desc}</p>
                  <p className="text-2xs text-muted-cv mt-1" style={{ fontSize: '10px' }}>{n.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────
// App Routes
// ─────────────────────────────────────────────────────────
const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ScrollToTop />
      <CommandPalette />
      <NotificationsPanel />

      <Routes>
        {/* Public pages WITH header */}
        <Route
          path="/"
          element={
            <PageWrapper>
              <HomePage />
            </PageWrapper>
          }
        />
        <Route
          path="/tools"
          element={
            <PageWrapper>
              <ToolsPage />
            </PageWrapper>
          }
        />
        <Route
          path="/tools/:category"
          element={
            <PageWrapper>
              <ToolsPage />
            </PageWrapper>
          }
        />
        <Route
          path="/tool/:slug"
          element={
            <PageWrapper>
              <ToolPage />
            </PageWrapper>
          }
        />
        <Route
          path="/pricing"
          element={
            <PageWrapper>
              <PricingPage />
            </PageWrapper>
          }
        />

        {/* Auth pages — no header (standalone layout) */}
        <Route
          path="/login"
          element={
            <PageWrapper noHeader>
              <AuthPage mode="login" />
            </PageWrapper>
          }
        />
        <Route
          path="/register"
          element={
            <PageWrapper noHeader>
              <AuthPage mode="register" />
            </PageWrapper>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PageWrapper noHeader>
              <AuthPage mode="forgot" />
            </PageWrapper>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PageWrapper noHeader>
              <AuthPage mode="reset" />
            </PageWrapper>
          }
        />

        {/* User dashboard pages */}
        <Route
          path="/dashboard"
          element={
            <PageWrapper>
              <DashboardPage />
            </PageWrapper>
          }
        />
        <Route
          path="/history"
          element={
            <PageWrapper>
              <HistoryPage />
            </PageWrapper>
          }
        />
        <Route
          path="/favorites"
          element={
            <PageWrapper>
              <FavoritesPage />
            </PageWrapper>
          }
        />
        <Route
          path="/workflows"
          element={
            <PageWrapper>
              <WorkflowsPage />
            </PageWrapper>
          }
        />
        <Route
          path="/settings"
          element={
            <PageWrapper>
              <SettingsPage />
            </PageWrapper>
          }
        />
        <Route
          path="/admin"
          element={
            <PageWrapper>
              <AdminPage />
            </PageWrapper>
          }
        />

        {/* 404 */}
        <Route
          path="*"
          element={
            <PageWrapper>
              <NotFoundPage />
            </PageWrapper>
          }
        />
      </Routes>
    </Suspense>
  );
};

// ─────────────────────────────────────────────────────────
// Root App
// ─────────────────────────────────────────────────────────
const App: React.FC = () => {
  const setUser = useAppStore((state) => state.setUser);

  useEffect(() => {
    // Register visitor / user session for Telegram notifications
    try {
      let anonymousId = localStorage.getItem('conveter_anon_id');
      if (!anonymousId) {
        anonymousId = `user_${Date.now().toString(36)}`;
        localStorage.setItem('conveter_anon_id', anonymousId);
      }
      apiClient.registerUser({
        id: anonymousId,
        name: 'Anonymous User',
        deviceInfo: `${navigator.platform || 'Desktop'} · ${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'}`,
      }).catch(() => {});
    } catch {
      /* ignore */
    }

    if (!auth) {
      setUser(null);
      return;
    }
    return onAuthStateChanged(auth, (user) => {
      const appUser = user ? toAppUser(user) : null;
      setUser(appUser);
      if (appUser) {
        apiClient.registerUser({
          id: appUser.id,
          name: appUser.name || 'User',
          email: appUser.email,
          deviceInfo: `${navigator.platform || 'Desktop'}`,
        }).catch(() => {});
      }
    });
  }, [setUser]);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
};

export default App;
