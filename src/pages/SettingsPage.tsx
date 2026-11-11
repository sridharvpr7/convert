import React, { useState } from 'react';
import {
  User, Bell, Shield, Palette, KeyRound, Trash2,
  ChevronRight, Save, CheckCircle2, AlertCircle, LogIn,
} from 'lucide-react';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { useAppStore } from '@/store/app.store';
import { auth } from '@/lib/firebase';
import { updatePassword } from 'firebase/auth';
import { Link } from 'react-router-dom';

type SettingsTab = 'profile' | 'security' | 'notifications' | 'appearance' | 'privacy';

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User size={16} /> },
  { id: 'security', label: 'Security', icon: <KeyRound size={16} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
  { id: 'privacy', label: 'Privacy', icon: <Shield size={16} /> },
];

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const { user, setUser } = useAppStore();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setErrorMessage(null);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setToastMessage(null);
    setTimeout(() => setErrorMessage(null), 4000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showError('Name cannot be empty.');
      return;
    }
    setUser({
      id: user?.id ?? 'guest',
      name: name.trim(),
      email: email.trim(),
      plan: user?.plan ?? 'free',
    });
    showToast('Profile information saved.');
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      showError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showError('Passwords do not match.');
      return;
    }
    if (auth?.currentUser) {
      try {
        await updatePassword(auth.currentUser, newPassword);
        setNewPassword('');
        setConfirmPassword('');
        showToast('Password updated successfully.');
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Failed to update password.');
      }
    } else {
      showError('Password update requires an active Firebase email session. Please sign in first.');
    }
  };

  const handleDeleteHistory = () => {
    try {
      localStorage.removeItem('conveter_history');
      showToast('All conversion history has been cleared.');
    } catch {
      showError('Failed to clear history.');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-primary mb-4">Profile Information</h2>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-2xl text-white font-bold flex-shrink-0"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    {user?.name?.[0] ?? 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-primary">{user?.name || 'Local User'}</p>
                    <p className="text-xs text-muted-cv">{user?.email || 'Guest Mode'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input-lg"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="label">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-lg"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <button type="submit" className="btn-primary btn-md gap-2">
                  <Save size={14} />
                  Save Changes
                </button>
              </form>
            </div>

            <div className="divider" />

            <div>
              <h3 className="text-sm font-semibold text-primary mb-3">Plan</h3>
              <div
                className="flex items-center justify-between p-4 rounded-xl border"
                style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
              >
                <div>
                  <p className="text-sm font-semibold text-primary">Free Plan</p>
                  <p className="text-xs text-muted-cv">Access to all 93 tools · Local processing</p>
                </div>
                <Link to="/pricing" className="btn-primary btn-sm">Upgrade to Premium</Link>
              </div>
            </div>

            <div className="divider" />

            <div>
              <h3 className="text-sm font-semibold text-error-600 mb-3">Danger Zone</h3>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Are you sure you want to reset your local account profile?')) {
                    setUser(null);
                    setName('');
                    setEmail('');
                    showToast('Profile reset.');
                  }
                }}
                className="btn-danger btn-sm gap-2"
              >
                <Trash2 size={13} />
                Reset Account Profile
              </button>
            </div>
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-primary mb-1">Appearance</h2>
              <p className="text-sm text-muted-cv mb-6">Customize how CONVETER looks for you</p>

              <div>
                <label className="label mb-3">Theme</label>
                <ThemeSwitcher />
                <p className="text-xs text-muted-cv mt-2">
                  System mode will follow your operating system preference.
                </p>
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-primary mb-4">Notification Preferences</h2>
              <div className="space-y-3">
                {[
                  { label: 'Job completed', desc: 'When a file conversion finishes', default: true },
                  { label: 'Job failed', desc: 'When a file conversion fails', default: true },
                  { label: 'Workflow completed', desc: 'When an automated workflow finishes', default: true },
                  { label: 'Account security', desc: 'New logins and security events', default: true },
                ].map((n) => (
                  <div
                    key={n.label}
                    className="flex items-center justify-between p-3 rounded-lg border"
                    style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
                  >
                    <div>
                      <p className="text-sm font-medium text-primary">{n.label}</p>
                      <p className="text-xs text-muted-cv">{n.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked={n.default}
                      className="w-4 h-4"
                      style={{ accentColor: 'var(--accent)' }}
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => showToast('Preferences updated.')}
                className="btn-primary btn-md mt-4 gap-2"
              >
                <Save size={14} />
                Save Preferences
              </button>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-primary mb-4">Security</h2>
              {auth?.currentUser ? (
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div>
                    <label className="label">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input-lg"
                      placeholder="Min 8 characters"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-lg"
                      placeholder="Repeat new password"
                      required
                    />
                  </div>
                  <button type="submit" className="btn-primary btn-md gap-2">
                    <KeyRound size={14} />
                    Update Password
                  </button>
                </form>
              ) : (
                <div
                  className="p-5 rounded-xl border flex flex-col gap-3"
                  style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
                >
                  <p className="text-sm font-semibold text-primary">Guest Session</p>
                  <p className="text-xs text-muted-cv leading-relaxed">
                    You are currently using CONVETER in guest mode. To protect your settings and synchronize across devices, sign in or register with email or Google.
                  </p>
                  <Link to="/login" className="btn-primary btn-sm gap-2 self-start mt-1">
                    <LogIn size={13} />
                    Sign In to Manage Credentials
                  </Link>
                </div>
              )}
            </div>

            <div className="divider" />

            <div>
              <h3 className="text-sm font-semibold text-primary mb-3">Active Session</h3>
              <div
                className="flex items-center justify-between p-3 rounded-lg border"
                style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
              >
                <div>
                  <p className="text-sm font-medium text-primary">Current device</p>
                  <p className="text-xs text-muted-cv">Web Browser · Local Storage Active</p>
                </div>
                <span className="badge badge-success">Active</span>
              </div>
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-primary mb-4">Privacy Settings</h2>
              <div className="space-y-3">
                {[
                  { label: 'Save file history', desc: 'Keep local browser records of processed files', default: true },
                  { label: 'Personalization', desc: 'Remember your preferred tools and favorite options locally', default: true },
                ].map((p) => (
                  <div
                    key={p.label}
                    className="flex items-center justify-between p-3 rounded-lg border"
                    style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
                  >
                    <div>
                      <p className="text-sm font-medium text-primary">{p.label}</p>
                      <p className="text-xs text-muted-cv">{p.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked={p.default}
                      className="w-4 h-4"
                      style={{ accentColor: 'var(--accent)' }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs text-muted-cv mb-3">
                  All file processing in local tools occurs entirely within your browser sandbox. No file data is sent to external servers unless using backend/cloud-dependent tools.
                </p>
                <button
                  type="button"
                  onClick={handleDeleteHistory}
                  className="btn-secondary btn-sm gap-2 text-error-600"
                >
                  <Trash2 size={13} />
                  Delete all my history
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="pt-20 pb-16" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="container-narrow">
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 p-4 rounded-xl shadow-cv-lg text-white bg-success-600 text-sm animate-slide-up">
            <CheckCircle2 size={16} />
            {toastMessage}
          </div>
        )}
        {errorMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 p-4 rounded-xl shadow-cv-lg text-white bg-red-600 text-sm animate-slide-up">
            <AlertCircle size={16} />
            {errorMessage}
          </div>
        )}

        <h1 className="text-2xl font-bold text-primary mb-8">Account Settings</h1>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <aside className="w-full md:w-52 flex-shrink-0">
            <nav className="space-y-0.5">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-left ${
                    activeTab === tab.id
                      ? 'bg-accent-subtle text-accent'
                      : 'text-secondary hover:bg-hover-cv hover:text-primary'
                  }`}
                >
                  <span style={activeTab === tab.id ? { color: 'var(--accent)' } : { color: 'var(--text-muted)' }}>
                    {tab.icon}
                  </span>
                  {tab.label}
                  {activeTab === tab.id && (
                    <ChevronRight size={14} className="ml-auto opacity-50" />
                  )}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <div
            className="flex-1 p-6 rounded-xl border min-h-96"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
