import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Search, Bell, ChevronDown, Menu, X, LogIn, Zap, AlertTriangle, Sparkles,
} from 'lucide-react';
import { ConveterLogo } from '@/components/ui/Logo';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { MegaMenu } from './MegaMenu';
import { useAppStore } from '@/store/app.store';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { apiClient } from '@/lib/api';

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
    { label: 'Tools', href: '/tools', hasMegaMenu: true, show: siteDisplayConfig?.navigation?.showTools !== false },
    { label: 'Dashboard', href: '/dashboard', show: siteDisplayConfig?.navigation?.showDashboard !== false },
    { label: 'PDF', href: '/tools/pdf', show: siteDisplayConfig?.categories?.pdf?.visible !== false },
    { label: 'Image', href: '/tools/image', show: siteDisplayConfig?.categories?.image?.visible !== false },
    { label: 'Data', href: '/tools/data', show: siteDisplayConfig?.categories?.data?.visible !== false },
    { label: 'Utilities', href: '/tools/utilities', show: siteDisplayConfig?.categories?.utilities?.visible !== false },
    { label: 'Archive', href: '/tools/archive', show: siteDisplayConfig?.categories?.archive?.visible !== false },
    { label: 'Pricing', href: '/pricing', show: siteDisplayConfig?.navigation?.showPricing !== false },
    { label: 'Manual', href: '/help', show: true },
  ].filter((item) => item.show);

  // Offset calculation for banners
  let topOffsetClass = 'top-0';
  if (isMaintenance && showAnnouncement) {
    topOffsetClass = 'top-14';
  } else if (isMaintenance || showAnnouncement) {
    topOffsetClass = 'top-7';
  }

  return (
    <>
      {showAnnouncement && (
        <div
          className="fixed top-0 left-0 right-0 z-[65] text-xs py-1.5 px-4 text-center font-medium flex items-center justify-center gap-2 shadow-sm"
          style={{
            backgroundColor: 'var(--accent)',
            color: '#ffffff',
          }}
        >
          <Sparkles size={12} />
          <span>{announcementText}</span>
        </div>
      )}

      {isMaintenance && (
        <div
          className={`fixed left-0 right-0 z-[60] bg-warning-500/95 text-white text-xs py-1 px-4 text-center font-medium flex items-center justify-center gap-1.5 shadow-sm ${
            showAnnouncement ? 'top-7' : 'top-0'
          }`}
        >
          <AlertTriangle size={13} />
          <span>Scheduled maintenance mode is active. Some tools may be temporarily limited.</span>
        </div>
      )}

      <header
        className={`fixed left-0 right-0 z-50 h-14 flex items-center transition-all duration-200 ${topOffsetClass}`}
        style={{
          backgroundColor: scrolled ? 'var(--surface)' : 'var(--bg)',
          borderBottom: '1px solid',
          borderColor: scrolled ? 'var(--border)' : 'transparent',
          boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
        }}
      >
        <div className="container-app flex items-center gap-4 h-full">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0 mr-2" aria-label="CONVET PULSE Home">
            <ConveterLogo size={28} showText />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1">
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
          <div className="flex items-center gap-1 ml-auto">
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
                  className="sm:hidden btn-ghost touch-target w-10 h-10 flex items-center justify-center rounded-lg"
                  aria-label="Search tools"
                  title="Search tools"
                >
                  <Search size={18} />
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
                className="hidden md:flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all duration-150 shadow-sm"
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
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="btn-ghost btn-md w-9 h-9 px-0 relative"
                aria-label="Notifications"
              >
                <Bell size={16} />
                {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
              </button>
            </div>

            {/* User menu */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setProfileMenuOpen((open) => !open)}
                  aria-expanded={profileMenuOpen}
                  className="flex items-center gap-2 h-9 px-2 rounded-lg transition-all duration-150 hover:bg-hover-cv"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : user.name[0]}
                  </div>
                  <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
                </button>
                {profileMenuOpen && (
                  <div
                    className="absolute right-0 top-11 z-[120] w-56 rounded-xl border p-2 shadow-cv-lg"
                    style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <p className="px-3 py-2 text-xs text-muted-cv truncate">{user.email}</p>
                    <Link onClick={() => setProfileMenuOpen(false)} to="/dashboard" className="block rounded-lg px-3 py-2 text-sm text-primary hover:bg-hover-cv">Dashboard</Link>
                    <Link onClick={() => setProfileMenuOpen(false)} to="/history" className="block rounded-lg px-3 py-2 text-sm text-primary hover:bg-hover-cv">Conversion History</Link>
                    <Link onClick={() => setProfileMenuOpen(false)} to="/admin" className="block rounded-lg px-3 py-2 text-sm text-primary hover:bg-hover-cv">Admin Console</Link>
                    <Link onClick={() => setProfileMenuOpen(false)} to="/settings" className="block rounded-lg px-3 py-2 text-sm text-primary hover:bg-hover-cv">Account settings</Link>
                    <button onClick={async () => { if (auth) await signOut(auth); setUser(null); setProfileMenuOpen(false); }} className="w-full text-left rounded-lg px-3 py-2 text-sm text-error-600 hover:bg-hover-cv">Sign out</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Link to="/login" className="btn-ghost btn-sm hidden sm:flex">
                  <LogIn size={14} />
                  Sign In
                </Link>
                <Link to="/register" className="btn-primary btn-sm">
                  Get Started
                </Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden btn-ghost btn-md w-9 h-9 px-0 ml-1"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div
            className="absolute top-14 left-0 right-0 border-t animate-slide-down lg:hidden"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              boxShadow: 'var(--shadow-lg)',
              maxHeight: 'calc(100vh - 56px)',
              overflowY: 'auto',
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
                <span>Search 17 tools...</span>
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
                    {link.hasMegaMenu && <span className="text-2xs text-muted-cv">17 tools</span>}
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

      {/* Mega menu rendered outside header */}
      <MegaMenu />
    </>
  );
};

export default Header;
