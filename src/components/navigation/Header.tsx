import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Search, Bell, ChevronDown, Menu, X, LogIn, Zap, AlertTriangle, Sparkles,
  User, RefreshCw, CheckCircle2, RotateCcw, AlertCircle
} from 'lucide-react';
import { ConveterLogo } from '@/components/ui/Logo';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { MegaMenu } from './MegaMenu';
import { useAppStore } from '@/store/app.store';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { apiClient } from '@/lib/api';
import { TOOLS } from '@/registry/tools';
import { isTauri } from '@/lib/platform';
import { checkForUpdate, relaunchApp, type AppUpdateInfo } from '@/lib/updater';
import { UpdateModal } from '@/components/updater/UpdateModal';

export const Header: React.FC = () => {
  const location = useLocation();
  const {
    setSearchOpen,
    megaMenuOpen,
    setMegaMenuOpen,
    user,
    notificationsOpen,
    setNotificationsOpen,
    notifications,
    setUser,
    premiumConfig,
    setPremiumConfig,
    siteDisplayConfig,
    setSiteDisplayConfig,
  } = useAppStore();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const toolsButtonRef = useRef<HTMLButtonElement>(null);

  // Tauri updater state (Windows Desktop & Android only; inactive on web)
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<
    'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'restart-required' | 'error'
  >('idle');
  const [updateErrorMessage, setUpdateErrorMessage] = useState('');

  // Silent update check in background on launch (Tauri only)
  useEffect(() => {
    if (!isTauri()) return;
    let isMounted = true;
    checkForUpdate({ silent: true })
      .then((res) => {
        if (!isMounted) return;
        if (res.status === 'update-available') {
          setUpdateInfo(res.update);
          setUpdateStatus('available');
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCheckForUpdates = async () => {
    if (!isTauri()) return;
    if (updateStatus === 'checking' || updateStatus === 'downloading') return;

    if (updateStatus === 'restart-required') {
      await relaunchApp();
      return;
    }

    if (updateStatus === 'available' && updateInfo) {
      setUpdateModalOpen(true);
      return;
    }

    setUpdateStatus('checking');
    setUpdateErrorMessage('');

    try {
      const res = await checkForUpdate();
      if (res.status === 'update-available') {
        setUpdateInfo(res.update);
        setUpdateStatus('available');
        setUpdateModalOpen(true);
      } else if (res.status === 'up-to-date') {
        setUpdateStatus('up-to-date');
        setTimeout(() => {
          setUpdateStatus((prev) => (prev === 'up-to-date' ? 'idle' : prev));
        }, 4000);
      } else if (res.status === 'error') {
        setUpdateStatus('error');
        setUpdateErrorMessage(res.message);
      } else {
        setUpdateStatus('idle');
      }
    } catch (err) {
      setUpdateStatus('error');
      setUpdateErrorMessage(err instanceof Error ? err.message : 'Update check failed.');
    }
  };

  // Fetch server-side configs on mount if not already present
  useEffect(() => {
    if (!premiumConfig) {
      apiClient.getPublicPremiumConfig().then((config) => {
        if (config) setPremiumConfig(config);
      }).catch(() => {});
    }
    if (!siteDisplayConfig) {
      apiClient.getPublicSiteConfig().then((config) => {
        if (config) setSiteDisplayConfig(config);
      }).catch(() => {});
    }
  }, [premiumConfig, siteDisplayConfig, setPremiumConfig, setSiteDisplayConfig]);

  // Track scroll for header shadow
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mega menu on route change
  useEffect(() => {
    setMegaMenuOpen(false);
  }, [location.pathname, setMegaMenuOpen]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [setSearchOpen]);

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  // If header is disabled globally in admin display controls
  if (siteDisplayConfig?.global?.showHeader === false) {
    return null;
  }

  // Determine whether to display the Premium button according to JSON config rules:
  const showPremium =
    (premiumConfig ? Boolean(premiumConfig.enabled && premiumConfig.showPremiumButton) : true) &&
    (siteDisplayConfig?.navigation?.showPremium !== false);

  const isMaintenance = Boolean(
    premiumConfig?.maintenanceMode || siteDisplayConfig?.global?.maintenanceMode
  );

  const showAnnouncement = Boolean(siteDisplayConfig?.global?.showAnnouncementBar);
  const announcementText =
    siteDisplayConfig?.global?.announcementText ||
    '⚡ CONVET PULSE: Fast, Private, Client-Side Conversions · Zero tracking';

  // Dynamic Navigation Links based on display controls
  const navLinks = [
    { label: 'Home', href: '/', show: siteDisplayConfig?.navigation?.showHome !== false },
    { label: 'Studios', href: '/studios', show: true },
    { label: 'Tools', href: '/tools', hasMegaMenu: true, show: siteDisplayConfig?.navigation?.showTools !== false },
    { label: 'Dashboard', href: '/dashboard', show: siteDisplayConfig?.navigation?.showDashboard !== false },
    { label: 'PDF', href: '/tools/pdf', show: siteDisplayConfig?.categories?.pdf?.visible !== false },
    { label: 'Image', href: '/tools/image', show: siteDisplayConfig?.categories?.image?.visible !== false },
    { label: 'Data', href: '/tools/data', show: siteDisplayConfig?.categories?.data?.visible !== false },
    { label: 'Utilities', href: '/tools/utilities', show: siteDisplayConfig?.categories?.utilities?.visible !== false },
    { label: 'Archive', href: '/tools/archive', show: siteDisplayConfig?.categories?.archive?.visible !== false },
    { label: 'Pricing', href: '/pricing', show: siteDisplayConfig?.navigation?.showPricing !== false },
    { label: 'Manual', href: '/help', show: true },
    { label: 'Download', href: '/download', show: true },
  ].filter((item) => item.show);

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-200"
        style={{
          backgroundColor: scrolled ? 'var(--surface)' : 'var(--bg)',
          borderBottom: '1px solid',
          borderColor: scrolled ? 'var(--border)' : 'transparent',
          boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
        }}
      >
        {/* Status Bar Safe-Area Spacer for Android Edge-to-Edge & notch devices */}
        <div
          className="w-full pointer-events-none"
          style={{
            height: 'env(safe-area-inset-top, 0px)',
            backgroundColor: scrolled ? 'var(--surface)' : 'var(--bg)',
            transition: 'background-color 0.2s ease',
          }}
          aria-hidden="true"
        />

        {/* Announcement Bar (if enabled) */}
        {showAnnouncement && (
          <div
            className="w-full text-xs py-1.5 px-4 text-center font-medium flex items-center justify-center gap-2 shadow-sm"
            style={{
              backgroundColor: 'var(--accent)',
              color: '#ffffff',
            }}
          >
            <Sparkles size={12} className="flex-shrink-0" />
            <span className="truncate">{announcementText}</span>
          </div>
        )}

        {/* Maintenance Banner (if enabled) */}
        {isMaintenance && (
          <div
            className="w-full bg-warning-500/95 text-white text-xs py-1 px-4 text-center font-medium flex items-center justify-center gap-1.5 shadow-sm"
          >
            <AlertTriangle size={13} className="flex-shrink-0" />
            <span className="truncate">Scheduled maintenance mode is active. Some tools may be temporarily limited.</span>
          </div>
        )}

        {/* Main Header Bar (starts below status bar) */}
        <header className="h-14 flex items-center w-full">
          <div
            className="w-full max-w-[1440px] mx-auto flex items-center justify-between h-full gap-2 sm:gap-4"
            style={{
              paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
            }}
          >
            {/* Logo */}
            <Link to="/" className="flex-shrink-0 flex items-center gap-2 group outline-none" aria-label="CONVET PULSE Home">
              <ConveterLogo size={28} showText />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-0.5 flex-1 mx-4">
              {navLinks.map((link) => {
                if (link.hasMegaMenu) {
                  return (
                    <button
                      key={link.href}
                      ref={toolsButtonRef}
                      onClick={() => setMegaMenuOpen(!megaMenuOpen)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                        megaMenuOpen || isActive(link.href)
                          ? 'bg-accent-subtle text-accent'
                          : 'text-secondary hover:bg-hover-cv hover:text-primary'
                      }`}
                      aria-expanded={megaMenuOpen}
                      aria-haspopup="dialog"
                    >
                      {link.label}
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-200 ${
                          megaMenuOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  );
                }
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                      isActive(link.href) && link.href !== '/'
                        ? 'bg-accent-subtle text-accent'
                        : 'text-secondary hover:bg-hover-cv hover:text-primary'
                    } ${
                      link.href === '/' && isActive('/')
                        ? 'text-primary'
                        : ''
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right section */}
            <div className="flex items-center gap-1 sm:gap-1.5 ml-auto flex-shrink-0">
              {/* Search */}
              {siteDisplayConfig?.features?.showSearch !== false && (
                <>
                  <button
                    onClick={() => setSearchOpen(true)}
                    className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-lg text-sm transition-all duration-150 border hover:border-accent"
                    style={{
                      backgroundColor: 'var(--muted)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-muted)',
                      minWidth: '200px',
                    }}
                    aria-label="Search all tools (Shortcut: Ctrl+K)"
                  >
                    <Search size={15} className="text-secondary flex-shrink-0" />
                    <span className="flex-1 text-left text-xs font-medium">Search all tools...</span>
                    <kbd
                      className="hidden md:inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono border shadow-sm"
                      style={{
                        borderColor: 'var(--border)',
                        backgroundColor: 'var(--surface)',
                        color: 'var(--text-muted)',
                        fontSize: '10px',
                      }}
                    >
                      Ctrl+K
                    </kbd>
                  </button>

                  <button
                    onClick={() => setSearchOpen(true)}
                    className="sm:hidden btn-ghost w-9 h-9 p-0 flex items-center justify-center rounded-lg flex-shrink-0"
                    aria-label="Search tools"
                    title="Search tools"
                  >
                    <Search size={16} />
                  </button>
                </>
              )}

              {/* Theme switcher */}
              {siteDisplayConfig?.features?.showThemeToggle !== false && (
                <ThemeSwitcher compact />
              )}

              {/* Pricing / Premium Button (Controlled by server-side JSON config) */}
              {showPremium && (
                <Link
                  to="/pricing"
                  className="hidden md:flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all duration-150 shadow-sm flex-shrink-0"
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    color: '#f59e0b',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                  }}
                >
                  <Zap size={12} className="fill-current" />
                  Premium
                </Link>
              )}

              {/* Notifications */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="btn-ghost w-9 h-9 p-0 flex items-center justify-center rounded-lg relative"
                  aria-label="Notifications"
                >
                  <Bell size={16} />
                  {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
                </button>
              </div>

              {/* User menu or Auth buttons */}
              {(user || isTauri()) ? (
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setProfileMenuOpen((open) => !open)}
                    aria-expanded={profileMenuOpen}
                    className="flex items-center gap-1.5 h-9 px-1.5 sm:px-2 rounded-lg transition-all duration-150 hover:bg-hover-cv relative"
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 overflow-hidden"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      {user?.avatar ? (
                        <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                      ) : user?.name ? (
                        user.name[0]
                      ) : (
                        <User size={13} />
                      )}
                    </div>
                    {/* Visual update indicator dot if update is ready */}
                    {isTauri() && (updateStatus === 'available' || updateStatus === 'restart-required') && (
                      <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[var(--surface)] animate-pulse" />
                    )}
                    <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
                  </button>
                  {profileMenuOpen && (
                    <div
                      className="absolute right-0 top-11 z-[120] w-64 rounded-xl border p-2 shadow-cv-lg"
                      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                    >
                      {user ? (
                        <>
                          <p className="px-3 py-2 text-xs text-muted-cv truncate">{user.email}</p>
                          <Link onClick={() => setProfileMenuOpen(false)} to="/dashboard" className="block rounded-lg px-3 py-2 text-sm text-primary hover:bg-hover-cv">Dashboard</Link>
                          <Link onClick={() => setProfileMenuOpen(false)} to="/history" className="block rounded-lg px-3 py-2 text-sm text-primary hover:bg-hover-cv">Conversion History</Link>
                          <Link onClick={() => setProfileMenuOpen(false)} to="/admin" className="block rounded-lg px-3 py-2 text-sm text-primary hover:bg-hover-cv">Admin Console</Link>
                          <Link onClick={() => setProfileMenuOpen(false)} to="/settings" className="block rounded-lg px-3 py-2 text-sm text-primary hover:bg-hover-cv">Account settings</Link>
                        </>
                      ) : (
                        <>
                          <div className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-cv">
                            CONVET PULSE Desktop
                          </div>
                          <Link onClick={() => setProfileMenuOpen(false)} to="/login" className="block rounded-lg px-3 py-2 text-sm text-primary hover:bg-hover-cv">Sign In</Link>
                          <Link onClick={() => setProfileMenuOpen(false)} to="/register" className="block rounded-lg px-3 py-2 text-sm text-primary hover:bg-hover-cv">Get Started</Link>
                        </>
                      )}

                      {/* TAURI ONLY: Check for Updates item (Strictly hidden on web) */}
                      {isTauri() && (
                        <div className="pt-1 mt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                          <button
                            type="button"
                            onClick={() => {
                              handleCheckForUpdates();
                            }}
                            disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                            className="w-full text-left rounded-lg px-3 py-2 text-sm flex items-center justify-between transition-colors hover:bg-hover-cv disabled:opacity-60 group"
                            title={
                              updateStatus === 'checking'
                                ? 'Checking for updates...'
                                : updateStatus === 'up-to-date'
                                ? 'Application is on latest version'
                                : updateStatus === 'available'
                                ? 'New update available - click to install'
                                : updateStatus === 'downloading'
                                ? 'Downloading update...'
                                : updateStatus === 'restart-required'
                                ? 'Restart required to complete update'
                                : updateStatus === 'error'
                                ? (updateErrorMessage || 'Update check failed - click to retry')
                                : 'Check for application updates'
                            }
                          >
                            <div className="flex items-center gap-2 truncate">
                              {updateStatus === 'checking' && (
                                <RefreshCw size={14} className="animate-spin text-accent shrink-0" />
                              )}
                              {updateStatus === 'up-to-date' && (
                                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                              )}
                              {updateStatus === 'available' && (
                                <Sparkles size={14} className="text-emerald-400 shrink-0" />
                              )}
                              {updateStatus === 'downloading' && (
                                <RefreshCw size={14} className="animate-spin text-accent shrink-0" />
                              )}
                              {updateStatus === 'restart-required' && (
                                <RotateCcw size={14} className="text-emerald-400 shrink-0" />
                              )}
                              {updateStatus === 'error' && (
                                <AlertCircle size={14} className="text-red-400 shrink-0" />
                              )}
                              {updateStatus === 'idle' && (
                                <RefreshCw size={14} className="text-muted-cv shrink-0 group-hover:rotate-45 transition-transform" />
                              )}

                              <span className="truncate text-xs font-medium">
                                {updateStatus === 'checking' && 'Checking...'}
                                {updateStatus === 'up-to-date' && "You're up to date"}
                                {updateStatus === 'available' && `Update v${updateInfo?.version || ''} available`}
                                {updateStatus === 'downloading' && 'Downloading...'}
                                {updateStatus === 'restart-required' && 'Restart required'}
                                {updateStatus === 'error' && 'Update failed (retry)'}
                                {updateStatus === 'idle' && 'Check for Updates'}
                              </span>
                            </div>

                            {updateStatus === 'available' && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse ml-1" />
                            )}
                            {updateStatus === 'restart-required' && (
                              <span className="text-2xs font-mono font-semibold text-emerald-400 uppercase">Apply</span>
                            )}
                          </button>

                          {updateStatus === 'error' && updateErrorMessage && (
                            <p className="px-3 pb-1 text-2xs text-red-400 truncate" title={updateErrorMessage}>
                              {updateErrorMessage}
                            </p>
                          )}
                        </div>
                      )}

                      {user && (
                        <div className="pt-1 mt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                          <button
                            onClick={async () => {
                              if (auth) await signOut(auth);
                              setUser(null);
                              setProfileMenuOpen(false);
                            }}
                            className="w-full text-left rounded-lg px-3 py-2 text-sm text-error-600 hover:bg-hover-cv"
                          >
                            Sign out
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Link to="/login" className="btn-ghost btn-sm hidden sm:flex">
                    <LogIn size={14} />
                    Sign In
                  </Link>
                  <Link to="/register" className="btn-primary btn-sm hidden sm:flex">
                    Get Started
                  </Link>
                </div>
              )}

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden btn-ghost w-9 h-9 p-0 flex items-center justify-center rounded-lg ml-0.5 flex-shrink-0"
                aria-label="Menu"
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>

          {/* Mobile menu dropdown */}
          {mobileMenuOpen && (
            <div
              className="absolute top-full left-0 right-0 border-t animate-slide-down lg:hidden"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--shadow-lg)',
                maxHeight: 'calc(100vh - 3.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
                overflowY: 'auto',
                paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))',
              }}
            >
              <div className="p-4 space-y-3">
                {/* Mobile Quick Search */}
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setSearchOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 h-11 px-3.5 rounded-xl border text-sm font-medium transition-all"
                  style={{
                    backgroundColor: 'var(--muted)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <Search size={16} className="text-secondary" />
                  <span>Search {TOOLS.length} tools...</span>
                </button>

                <nav className="space-y-1">
                  {navLinks.map((link: { label: string; href: string; hasMegaMenu?: boolean; show: boolean }) => (
                    <Link
                      key={link.href}
                      to={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 touch-target flex items-center justify-between ${
                        isActive(link.href)
                          ? 'bg-accent-subtle text-accent font-semibold'
                          : 'text-secondary hover:bg-hover-cv hover:text-primary'
                      }`}
                    >
                      <span>{link.label}</span>
                      {link.hasMegaMenu && <span className="text-2xs text-muted-cv">{TOOLS.length} tools</span>}
                    </Link>
                  ))}
                  <div className="pt-3 mt-3 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-2 px-4 py-1 text-2xs text-muted-cv">
                      <span className="w-1.5 h-1.5 rounded-full bg-success-500" />
                      <span>Private &amp; local processing in your browser</span>
                    </div>
                    <Link
                      to="/dashboard"
                      className="block px-4 py-3 rounded-lg text-sm font-medium text-secondary hover:bg-hover-cv"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/history"
                      className="block px-4 py-3 rounded-lg text-sm font-medium text-secondary hover:bg-hover-cv"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Conversion History
                    </Link>
                    <Link
                      to="/admin"
                      className="block px-4 py-3 rounded-lg text-sm font-medium text-secondary hover:bg-hover-cv"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Admin Console
                    </Link>
                    {showPremium && (
                      <Link
                        to="/pricing"
                        className="block px-4 py-3 rounded-lg text-sm font-medium text-warning-600 hover:bg-hover-cv"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        ⚡ Premium Features
                      </Link>
                    )}
                    {/* TAURI ONLY: Check for Updates in Mobile Drawer */}
                    {isTauri() && (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleCheckForUpdates();
                        }}
                        disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                        className="w-full text-left px-4 py-3 rounded-lg text-sm font-medium text-secondary hover:bg-hover-cv flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <RefreshCw size={14} className={updateStatus === 'checking' || updateStatus === 'downloading' ? 'animate-spin text-accent' : 'text-muted-cv'} />
                          {updateStatus === 'checking' ? 'Checking for updates...' : updateStatus === 'available' ? 'Update available!' : 'Check for Updates'}
                        </span>
                        {updateStatus === 'available' && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                      </button>
                    )}
                    {!user && (
                      <div className="flex gap-2 pt-1">
                        <Link
                          to="/login"
                          className="btn-secondary btn-md flex-1 justify-center"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Sign In
                        </Link>
                        <Link
                          to="/register"
                          className="btn-primary btn-md flex-1 justify-center"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Get Started
                        </Link>
                      </div>
                    )}
                  </div>
                </nav>
              </div>
            </div>
          )}
        </header>
      </div>

      {/* Mega menu rendered outside header */}
      <MegaMenu />

      {/* Tauri In-App Update Modal (Windows Desktop & Android) */}
      {isTauri() && (
        <UpdateModal
          updateInfo={updateInfo}
          isOpen={updateModalOpen}
          onClose={() => setUpdateModalOpen(false)}
          onUpdateStatusChange={(status) => {
            if (status === 'restart-required') {
              setUpdateStatus('restart-required');
            } else if (status === 'downloading') {
              setUpdateStatus('downloading');
            }
          }}
        />
      )}
    </>
  );
};

export default Header;
