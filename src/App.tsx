import React, { Suspense, useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { isTauri, isAndroid, isDesktop } from '@/lib/platform';
import { checkForUpdate, type AppUpdateInfo } from '@/lib/updater';
import { UpdateModal } from '@/components/updater/UpdateModal';
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
import { DesktopAuthCallbackPage } from '@/pages/DesktopAuthCallbackPage';
import { PricingPage } from '@/pages/PricingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { FavoritesPage } from '@/pages/FavoritesPage';
import { WorkflowsPage } from '@/pages/WorkflowsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AdminPage } from '@/pages/AdminPage';
import { HelpPage } from '@/pages/HelpPage';
import { DownloadPage } from '@/pages/DownloadPage';
import { StudiosPage } from '@/pages/StudiosPage';
import { StudioViewPage } from '@/pages/StudioViewPage';
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
// Android hardware back-button listener (Tauri mobile integration)
// ─────────────────────────────────────────────────────────
const MobileNavigationHandler: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    if (isTauri() && isAndroid()) {
      import('@tauri-apps/api/event')
        .then(({ listen }) => {
          return listen('tauri://back-button', () => {
            if (window.history.length > 1) {
              navigate(-1);
            }
          });
        })
        .then((fn) => {
          unlisten = fn;
        })
        .catch(() => {});
    }
    return () => {
      if (unlisten) unlisten();
    };
  }, [navigate]);

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
        className="fixed right-4 z-[151] w-80 max-w-[calc(100vw-2rem)] rounded-xl border shadow-cv-lg animate-slide-down overflow-hidden"
        style={{
          top: 'calc(4rem + env(safe-area-inset-top, 0px))',
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
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
      <MobileNavigationHandler />
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
          path="/studios"
          element={
            <PageWrapper>
              <StudiosPage />
            </PageWrapper>
          }
        />
        <Route
          path="/studios/:slug"
          element={
            <PageWrapper>
              <StudioViewPage />
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
        <Route
          path="/help"
          element={
            <PageWrapper>
              <HelpPage />
            </PageWrapper>
          }
        />
        <Route
          path="/manual"
          element={
            <PageWrapper>
              <HelpPage />
            </PageWrapper>
          }
        />
        <Route
          path="/download"
          element={
            <PageWrapper>
              <DownloadPage />
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
        <Route
          path="/auth/desktop"
          element={
            <PageWrapper noHeader>
              <DesktopAuthCallbackPage />
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
  const setPremiumConfig = useAppStore((state) => state.setPremiumConfig);
  const setSiteDisplayConfig = useAppStore((state) => state.setSiteDisplayConfig);

  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    // Check for desktop updates on app launch (silent mode: no disruption if up to date)
    if (isDesktop()) {
      checkForUpdate({ silent: true })
        .then((result) => {
          if (result.status === 'update-available') {
            setUpdateInfo(result.update);
            setShowUpdateModal(true);
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    // 1. Fetch live configurations
    apiClient.getPublicPremiumConfig().then(setPremiumConfig).catch(() => {});
    apiClient.getPublicSiteConfig().then(setSiteDisplayConfig).catch(() => {});

    // 2. Register visitor / user session
    // anonymousId persists across page loads as a stable session fingerprint
    let anonymousId = localStorage.getItem('conveter_anon_id');
    if (!anonymousId) {
      anonymousId = `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      localStorage.setItem('conveter_anon_id', anonymousId);
    }
    // Register the anonymous session for DB tracking (no Telegram notification yet —
    // we wait for onAuthStateChanged so we know if the user is already authenticated
    // before deciding whether to send an anonymous or authenticated visitor notification)
    try {
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
      // No Firebase — treat as anonymous visitor
      apiClient.pingVisitor(anonymousId, false).catch(() => {});
      return;
    }
    return onAuthStateChanged(auth, (user) => {
      const appUser = user ? toAppUser(user) : null;
      setUser(appUser);
      if (appUser) {
        // Authenticated user: register with real identity, ping as authenticated
        apiClient.registerUser({
          id: appUser.id,
          name: appUser.name || 'User',
          email: appUser.email,
          deviceInfo: `${navigator.platform || 'Desktop'}`,
        }).catch(() => {});
        // Authenticated ping — server skips anonymous visitor notification for auth'd users
        apiClient.pingVisitor(appUser.id, true, appUser.id).catch(() => {});

        // Authenticated app-open notification — suppress if an explicit login/register
        // notification was just sent (within the last 2 minutes) to avoid double firing
        const lastLoginNotified = Number(sessionStorage.getItem('conveter_login_notified') || 0);
        const lastAppOpen = Number(sessionStorage.getItem('conveter_last_app_open') || 0);
        const now = Date.now();
        const loginJustNotified = now - lastLoginNotified < 2 * 60 * 1000;

        if (!loginJustNotified && now - lastAppOpen > 15 * 60 * 1000) {
          sessionStorage.setItem('conveter_last_app_open', String(now));
          apiClient.notifyAppOpen({
            userId: appUser.id,
            name: appUser.name || 'User',
            email: appUser.email,
          }).catch(() => {});
        }
      } else {
        // User is not authenticated — send anonymous visitor notification once per session
        const lastAnonPing = Number(sessionStorage.getItem('conveter_anon_ping') || 0);
        const now = Date.now();
        if (now - lastAnonPing > 15 * 60 * 1000) {
          sessionStorage.setItem('conveter_anon_ping', String(now));
          apiClient.pingVisitor(anonymousId, false).catch(() => {});
        }
      }
    });
  }, [setUser, setPremiumConfig, setSiteDisplayConfig]);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <UpdateModal
          isOpen={showUpdateModal}
          updateInfo={updateInfo}
          onClose={() => setShowUpdateModal(false)}
        />
      </ToastProvider>
    </QueryClientProvider>
  );
};

export default App;
