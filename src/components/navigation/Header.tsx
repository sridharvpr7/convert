import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Search, Bell, ChevronDown, Menu, X, LogIn, Zap,
} from 'lucide-react';
import { ConveterLogo } from '@/components/ui/Logo';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { MegaMenu } from './MegaMenu';
import { useAppStore } from '@/store/app.store';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Tools', href: '/tools', hasMegaMenu: true },
  { label: 'PDF', href: '/tools/pdf' },
  { label: 'Image', href: '/tools/image' },
  { label: 'Data', href: '/tools/data' },
  { label: 'Utilities', href: '/tools/utilities' },
  { label: 'Archive', href: '/tools/archive' },
];

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
  } = useAppStore();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const toolsButtonRef = useRef<HTMLButtonElement>(null);

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

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center"
        style={{
          backgroundColor: scrolled ? 'var(--surface)' : 'var(--bg)',
          borderBottom: '1px solid',
          borderColor: scrolled ? 'var(--border)' : 'transparent',
          boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
          transition: 'background-color 0.2s, border-color 0.2s, box-shadow 0.2s',
        }}
      >
        <div className="container-app flex items-center gap-4 h-full">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0 mr-2" aria-label="CONVETER Home">
            <ConveterLogo size={28} showText />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1">
            {NAV_LINKS.map((link) => {
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

            {/* Theme switcher */}
            <ThemeSwitcher compact />

            {/* Pricing */}
            <Link
              to="/pricing"
              className="hidden md:flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all duration-150"
              style={{
                backgroundColor: '#f59e0b15',
                color: '#f59e0b',
              }}
            >
              <Zap size={12} />
              Premium
            </Link>

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
                <button onClick={() => setProfileMenuOpen((open) => !open)} aria-expanded={profileMenuOpen} className="flex items-center gap-2 h-9 px-2 rounded-lg transition-all duration-150 hover:bg-hover-cv">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 overflow-hidden" style={{ backgroundColor: 'var(--accent)' }}>
                    {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : user.name[0]}
                  </div>
                  <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
                </button>
                {profileMenuOpen && (
                  <div className="absolute right-0 top-11 z-[120] w-56 rounded-xl border p-2 shadow-cv-lg" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
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
                {NAV_LINKS.map((link) => (
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
                  <Link
                    to="/pricing"
                    className="block px-4 py-3 rounded-lg text-sm font-medium text-warning-600 hover:bg-hover-cv"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    ⚡ Premium Features
                  </Link>
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
