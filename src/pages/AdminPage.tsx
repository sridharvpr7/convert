// ============================================================
// CONVETER — Premium Admin Dashboard (Production Upgrade)
// Comprehensive administrative console:
// - Secure Admin Authentication & Password Management
// - JSON-based Premium Configuration & Pricing Editor
// - Granular Premium Tool Access Management (all 17 tools)
// - Telegram Bot Live Diagnostics & Notification Delivery Log
// - Real Analytics, Conversion Metrics, Date Filters & Report Export
// - System Audit Logs
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Shield, Activity, Users, FileCheck, Send, RefreshCw,
  Search, Plus, Eye, Bell, Lock, LogOut, Check,
  AlertTriangle, Settings, Zap, Download, KeyRound, Clock,
  Wrench, CheckCircle2,
} from 'lucide-react';
import { TOOLS } from '@/registry/tools';
import {
  apiClient, ApiJob, ApiStats, ApiAdminComment, ApiAuditLog,
  NotificationSettings, FullPremiumConfig, TelegramDiagnostics,
  ApiNotificationLog,
} from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/ToastContext';

export const AdminPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const toast = useToast();

  // ── Authentication State ─────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Password change form
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdChangeLoading, setPwdChangeLoading] = useState(false);
  const [showPwdModal, setShowPwdModal] = useState(false);

  // ── Dashboard Data State ─────────────────────────────────
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [jobs, setJobs] = useState<ApiJob[]>([]);
  const [auditLogs, setAuditLogs] = useState<ApiAuditLog[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<ApiNotificationLog[]>([]);
  const [telegramSettings, setTelegramSettings] = useState<NotificationSettings | null>(null);
  const [telegramDiagnostics, setTelegramDiagnostics] = useState<TelegramDiagnostics | null>(null);
  const [premiumConfig, setPremiumConfig] = useState<FullPremiumConfig | null>(null);
  const [premiumTools, setPremiumTools] = useState<string[]>([]);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'premium' | 'tools' | 'telegram' | 'analytics' | 'audit'>('overview');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toolFilter, setToolFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Job Detail Modal State
  const [selectedJob, setSelectedJob] = useState<ApiJob | null>(null);
  const [jobComments, setJobComments] = useState<ApiAdminComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // ── 1. Check Session on Mount ─────────────────────────────
  const checkSession = useCallback(async () => {
    try {
      const res = await apiClient.adminCheckSession();
      setIsAuthenticated(res.authenticated);
      setMustChangePassword(Boolean(res.mustChangePassword));
      if (res.mustChangePassword) {
        setShowPwdModal(true);
      }
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // ── 2. Load Admin Data ───────────────────────────────────
  const loadAdminData = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const [
        statsRes,
        jobsRes,
        logsRes,
        notifLogsRes,
        settingsRes,
        diagRes,
        premRes,
      ] = await Promise.all([
        apiClient.getAdminStats(dateRangeFilter),
        apiClient.getAdminJobs({ status: statusFilter, tool: toolFilter, search: searchQuery, range: dateRangeFilter }),
        apiClient.getAdminAuditLogs(50),
        apiClient.getNotificationLogs(50),
        apiClient.getTelegramSettings(),
        apiClient.getTelegramDiagnostics(),
        apiClient.getAdminPremiumConfig(),
      ]);

      if (statsRes) setStats(statsRes);
      if (jobsRes) setJobs(jobsRes);
      if (logsRes) setAuditLogs(logsRes);
      if (notifLogsRes) setNotificationLogs(notifLogsRes);
      if (settingsRes) setTelegramSettings(settingsRes);
      if (diagRes) setTelegramDiagnostics(diagRes);
      if (premRes) {
        setPremiumConfig(premRes);
        setPremiumTools(premRes.premium.allowedTools || []);
      }
    } catch {
      toast.error('Failed to load some administrator data');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, statusFilter, toolFilter, searchQuery, dateRangeFilter, toast]);

  useEffect(() => {
    if (isAuthenticated) {
      loadAdminData();
    }
  }, [isAuthenticated, loadAdminData]);

  // Open specific job if in query param ?job=ID
  useEffect(() => {
    const jobParam = searchParams.get('job');
    if (jobParam && isAuthenticated) {
      apiClient.getJob(jobParam).then((res) => {
        if (res?.job) {
          setSelectedJob(res.job);
          setJobComments(res.comments || []);
        }
      });
    }
  }, [searchParams, isAuthenticated]);

  // ── Authentication Handlers ──────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    const res = await apiClient.adminLogin(loginUsername, loginPassword);
    setLoginLoading(false);

    if (res.ok) {
      setIsAuthenticated(true);
      toast.success('Admin authentication verified');
      if (res.mustChangePassword) {
        setMustChangePassword(true);
        setShowPwdModal(true);
      }
    } else {
      setLoginError(res.error || 'Invalid credentials');
    }
  };

  const handleLogout = async () => {
    await apiClient.adminLogout();
    setIsAuthenticated(false);
    toast.success('Logged out successfully');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPwd.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setPwdChangeLoading(true);
    const res = await apiClient.adminChangePassword(currentPwd, newPwd);
    setPwdChangeLoading(false);

    if (res.ok) {
      toast.success('Admin password updated successfully');
      setMustChangePassword(false);
      setShowPwdModal(false);
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } else {
      toast.error(res.error || 'Failed to update password');
    }
  };

  // ── Premium Settings Handlers ────────────────────────────
  const handleSavePremiumConfig = async () => {
    if (!premiumConfig) return;
    try {
      const res = await apiClient.updateAdminPremiumConfig(premiumConfig);
      if (res.ok && res.config) {
        setPremiumConfig(res.config);
        toast.success('Premium configuration persisted to server');
      } else {
        toast.error(res.error || 'Failed to save configuration');
      }
    } catch {
      toast.error('Network error updating configuration');
    }
  };

  const handleSavePremiumTools = async () => {
    try {
      const res = await apiClient.updatePremiumTools(premiumTools);
      if (res.ok) {
        toast.success(`Premium tool availability updated (${premiumTools.length} restricted)`);
      } else {
        toast.error(res.error || 'Failed to update tools');
      }
    } catch {
      toast.error('Network error updating tools');
    }
  };

  const toggleToolPremium = (slug: string) => {
    setPremiumTools((prev) => {
      if (prev.includes(slug)) {
        return prev.filter((s) => s !== slug);
      }
      return [...prev, slug];
    });
  };

  // ── Telegram Handlers ────────────────────────────────────
  const handleToggleNotificationSetting = async (key: keyof NotificationSettings) => {
    if (!telegramSettings) return;
    const updated = { ...telegramSettings, [key]: !telegramSettings[key] };
    setTelegramSettings(updated);
    try {
      await apiClient.updateTelegramSettings(updated);
      toast.success('Notification preferences updated');
    } catch {
      toast.error('Failed to update settings');
    }
  };

  const handleTestTelegram = async () => {
    try {
      const res = await apiClient.testTelegramAlert();
      if (res?.ok) {
        toast.success('Telegram test notification dispatched!');
        // Reload notification logs
        apiClient.getNotificationLogs(50).then(setNotificationLogs);
      } else {
        toast.warning('Test alert triggered (check bot token or chat ID)');
      }
    } catch {
      toast.error('Failed to test Telegram integration');
    }
  };

  // ── Job Inspection & Comments ────────────────────────────
  const handleOpenJob = async (job: ApiJob) => {
    setSelectedJob(job);
    const res = await apiClient.getJob(job.id);
    if (res?.comments) {
      setJobComments(res.comments);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob || !newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const comment = await apiClient.addComment(selectedJob.id, newComment.trim(), 'Admin (Web)');
      if (comment) {
        setJobComments((prev) => [...prev, comment]);
        setNewComment('');
        toast.success('Comment recorded on job');
      }
    } catch {
      toast.error('Could not save comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // ── Export Analytics Report ──────────────────────────────
  const handleExportReport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      platform: 'CONVET PULSE',
      summary: stats,
      premiumConfiguration: premiumConfig,
      telegramStatus: telegramDiagnostics,
      recentConversions: jobs,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `convet-pulse-analytics-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('Analytics report exported as JSON');
  };

  // ── Login Gate ───────────────────────────────────────────
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen pt-28 pb-20 flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={24} className="animate-spin text-accent" />
          <p className="text-xs text-muted-cv">Verifying administrator session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-28 pb-20 flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg)' }}>
        <div
          className="max-w-md w-full p-8 rounded-3xl border shadow-cv-lg space-y-6"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 text-accent"
              style={{ backgroundColor: 'var(--accent-subtle)' }}
            >
              <Shield size={24} />
            </div>
            <h1 className="text-2xl font-extrabold text-primary tracking-tight">Admin Console</h1>
            <p className="text-xs text-secondary mt-1">
              Secure administrator access for CONVET PULSE
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl border bg-error-500/10 border-error-500/30 text-error-600 text-xs font-medium flex items-center gap-2">
              <AlertTriangle size={15} className="flex-shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-2xs uppercase tracking-wider font-semibold text-muted-cv mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
                className="input w-full h-10 text-xs"
                placeholder="admin"
              />
            </div>

            <div>
              <label className="block text-2xs uppercase tracking-wider font-semibold text-muted-cv mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="input w-full h-10 text-xs"
                placeholder="••••••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="btn-primary w-full h-10 text-xs font-bold gap-2 justify-center shadow-sm"
            >
              {loginLoading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Lock size={14} />
                  Sign In to Admin
                </>
              )}
            </button>
          </form>

          <div className="p-3 rounded-xl border bg-surface text-2xs text-muted-cv leading-relaxed" style={{ borderColor: 'var(--border)' }}>
            <span className="font-semibold text-primary block mb-0.5">Setup Instruction:</span>
            Default admin credentials were generated on first server boot in <code className="text-accent">config/admin.json</code> and logged to server output.
          </div>
        </div>
      </div>
    );
  }

  // ── Authenticated Admin Console ──────────────────────────
  return (
    <div className="pt-20 pb-20 min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="container-app space-y-8">
        {/* ── Top Header Bar ──────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="badge badge-brand text-xs font-semibold flex items-center gap-1">
                <Shield size={12} /> SYSTEM CONSOLE
              </span>
              <span className="text-2xs text-muted-cv font-mono">CONVET PULSE SaaS v1.0.0</span>
              {mustChangePassword && (
                <span className="badge badge-error text-2xs font-semibold animate-pulse">
                  Password Change Required
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-primary tracking-tight">Administrator Control Center</h1>
            <p className="text-xs text-secondary mt-0.5">
              Real-time analytics, Telegram notifications, and server-side JSON premium configuration.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowPwdModal(true)}
              className="btn-secondary btn-sm gap-1.5 text-xs"
            >
              <KeyRound size={13} />
              Change Password
            </button>
            <button
              type="button"
              onClick={handleExportReport}
              className="btn-secondary btn-sm gap-1.5 text-xs"
            >
              <Download size={13} />
              Export Report
            </button>
            <button
              type="button"
              onClick={loadAdminData}
              disabled={isLoading}
              className="btn-secondary btn-sm gap-1.5 text-xs"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="btn-ghost btn-sm text-xs text-error-600 gap-1.5"
            >
              <LogOut size={13} />
              Logout
            </button>
          </div>
        </div>

        {/* ── Navigation Tabs ────────────────────────────── */}
        <div className="flex items-center gap-1.5 border-b pb-3 overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
          {[
            { id: 'overview', label: 'Overview', icon: <Activity size={14} /> },
            { id: 'premium', label: 'Premium Settings', icon: <Zap size={14} /> },
            { id: 'tools', label: `Tools Manager (${TOOLS.length})`, icon: <Wrench size={14} /> },
            { id: 'telegram', label: 'Telegram Bot', icon: <Bell size={14} /> },
            { id: 'analytics', label: 'Real Analytics & Jobs', icon: <FileCheck size={14} /> },
            { id: 'audit', label: `Activity Logs (${auditLogs.length})`, icon: <Clock size={14} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-cv hover:text-primary hover:bg-hover-cv'
              }`}
              style={activeTab === tab.id ? { backgroundColor: 'var(--accent)', color: '#ffffff' } : {}}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═════════════════════════════════════════════════════ */}
        {/* TAB 1: OVERVIEW                                       */}
        {/* ═════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between text-muted-cv mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Completed Conversions</span>
                  <Activity size={16} className="text-indigo-500" />
                </div>
                <p className="text-3xl font-extrabold text-primary font-num">{stats?.completedJobs ?? 0}</p>
                <p className="text-2xs text-muted-cv mt-1">Verified successful jobs</p>
              </div>

              <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between text-muted-cv mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Overall Success Rate</span>
                  <FileCheck size={16} className="text-emerald-500" />
                </div>
                <p className="text-3xl font-extrabold text-primary font-num">{stats?.successRate ?? 0}%</p>
                <p className="text-2xs text-emerald-500 mt-1">{stats?.completedJobs ?? 0} success / {stats?.failedJobs ?? 0} failed</p>
              </div>

              <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between text-muted-cv mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Avg Duration</span>
                  <Clock size={16} className="text-amber-500" />
                </div>
                <p className="text-3xl font-extrabold text-primary font-num">
                  {stats?.avgProcessingTimeMs ? `${(stats.avgProcessingTimeMs / 1000).toFixed(1)}s` : '0.0s'}
                </p>
                <p className="text-2xs text-muted-cv mt-1">Average execution time</p>
              </div>

              <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between text-muted-cv mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Registered Accounts</span>
                  <Users size={16} className="text-purple-500" />
                </div>
                <p className="text-3xl font-extrabold text-primary font-num">{stats?.totalUsers ?? 0}</p>
                <p className="text-2xs text-muted-cv mt-1">Platform user identities</p>
              </div>
            </div>

            {/* Quick Status Banners */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Telegram Status Card */}
              <div className="p-5 rounded-2xl border shadow-sm flex flex-col justify-between" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-cv">Telegram Bot Health</span>
                    <span
                      className={`badge text-2xs font-bold ${
                        telegramDiagnostics?.apiReachable ? 'badge-success' : 'badge-neutral'
                      }`}
                    >
                      {telegramDiagnostics?.apiReachable ? 'API Verified' : 'Local Mock Mode'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-primary">
                    {telegramDiagnostics?.botInfo?.name ? `@${telegramDiagnostics.botInfo.username}` : 'Bot Status'}
                  </p>
                  <p className="text-xs text-muted-cv mt-1">
                    {telegramDiagnostics?.lastError
                      ? telegramDiagnostics.lastError
                      : 'Real-time alert delivery is active for all conversion and admin events.'}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                  <button
                    type="button"
                    onClick={handleTestTelegram}
                    className="btn-primary btn-sm text-xs gap-1.5"
                  >
                    <Send size={12} /> Test Notification
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('telegram')}
                    className="text-xs text-accent hover:underline font-semibold"
                  >
                    Manage Settings →
                  </button>
                </div>
              </div>

              {/* Premium Status Card */}
              <div className="p-5 rounded-2xl border shadow-sm flex flex-col justify-between" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-cv">Premium Subscriptions</span>
                    <span
                      className={`badge text-2xs font-bold ${
                        premiumConfig?.premium.enabled ? 'badge-success' : 'badge-error'
                      }`}
                    >
                      {premiumConfig?.premium.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-primary">
                    Current Rate: {premiumConfig?.premium.price.label || '₹199/month'}
                  </p>
                  <p className="text-xs text-muted-cv mt-1">
                    {premiumConfig?.premium.allowedTools?.length
                      ? `${premiumConfig.premium.allowedTools.length} tool(s) restricted to Premium`
                      : 'All 17 tools currently available to all users.'}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-2xs text-muted-cv">JSON-persisted configuration</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('premium')}
                    className="text-xs text-accent hover:underline font-semibold"
                  >
                    Edit Pricing &amp; Features →
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Audit Activities */}
            <div className="p-6 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-bold text-primary mb-3">Recent Administrative Actions</h3>
              <div className="divide-y text-xs" style={{ borderColor: 'var(--border)' }}>
                {auditLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="badge badge-neutral text-2xs uppercase font-mono">{log.event_type}</span>
                      <span className="text-primary font-medium truncate">{log.details}</span>
                    </div>
                    <span className="text-2xs text-muted-cv flex-shrink-0 font-num">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════ */}
        {/* TAB 2: PREMIUM SETTINGS                               */}
        {/* ═════════════════════════════════════════════════════ */}
        {activeTab === 'premium' && premiumConfig && (
          <div className="max-w-3xl space-y-6">
            <div className="p-6 rounded-2xl border shadow-sm space-y-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <div>
                <h2 className="text-base font-bold text-primary">Global Premium Configuration</h2>
                <p className="text-xs text-muted-cv mt-0.5">
                  Changes are persisted to <code className="text-accent">config/premium.json</code> and instantly update the public website.
                </p>
              </div>

              {/* Global switches */}
              <div className="space-y-4 divide-y" style={{ borderColor: 'var(--border)' }}>
                <div className="pt-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-primary">Enable Premium System</p>
                    <p className="text-xs text-muted-cv">Master switch for all premium locks and pricing</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={premiumConfig.premium.enabled}
                    onChange={(e) =>
                      setPremiumConfig({
                        ...premiumConfig,
                        premium: { ...premiumConfig.premium, enabled: e.target.checked },
                      })
                    }
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-primary">Show Premium Button in Navigation</p>
                    <p className="text-xs text-muted-cv">Controls visibility of the header Premium CTA</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={premiumConfig.premium.showPremiumButton}
                    onChange={(e) =>
                      setPremiumConfig({
                        ...premiumConfig,
                        premium: { ...premiumConfig.premium, showPremiumButton: e.target.checked },
                      })
                    }
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-primary">Maintenance Mode</p>
                    <p className="text-xs text-muted-cv">Puts file processing tools in maintenance notification mode</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={premiumConfig.premium.maintenanceMode}
                    onChange={(e) =>
                      setPremiumConfig({
                        ...premiumConfig,
                        premium: { ...premiumConfig.premium, maintenanceMode: e.target.checked },
                      })
                    }
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Price Editor */}
              <div className="pt-4 border-t space-y-4" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-sm font-bold text-primary">Pricing Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-2xs uppercase tracking-wider font-semibold text-muted-cv mb-1">
                      Price Amount
                    </label>
                    <input
                      type="number"
                      value={premiumConfig.premium.price.amount}
                      onChange={(e) => {
                        const amt = Number(e.target.value);
                        setPremiumConfig({
                          ...premiumConfig,
                          premium: {
                            ...premiumConfig.premium,
                            price: {
                              ...premiumConfig.premium.price,
                              amount: amt,
                              label: `${premiumConfig.premium.price.currency === 'INR' ? '₹' : '$'}${amt}/${premiumConfig.premium.price.billingPeriod}`,
                            },
                          },
                        });
                      }}
                      className="input w-full h-9 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-2xs uppercase tracking-wider font-semibold text-muted-cv mb-1">
                      Currency
                    </label>
                    <select
                      value={premiumConfig.premium.price.currency}
                      onChange={(e) => {
                        const curr = e.target.value;
                        setPremiumConfig({
                          ...premiumConfig,
                          premium: {
                            ...premiumConfig.premium,
                            price: {
                              ...premiumConfig.premium.price,
                              currency: curr,
                              label: `${curr === 'INR' ? '₹' : '$'}${premiumConfig.premium.price.amount}/${premiumConfig.premium.price.billingPeriod}`,
                            },
                          },
                        });
                      }}
                      className="input w-full h-9 text-xs"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-2xs uppercase tracking-wider font-semibold text-muted-cv mb-1">
                      Billing Period
                    </label>
                    <select
                      value={premiumConfig.premium.price.billingPeriod}
                      onChange={(e) => {
                        const bp = e.target.value;
                        setPremiumConfig({
                          ...premiumConfig,
                          premium: {
                            ...premiumConfig.premium,
                            price: {
                              ...premiumConfig.premium.price,
                              billingPeriod: bp,
                              label: `${premiumConfig.premium.price.currency === 'INR' ? '₹' : '$'}${premiumConfig.premium.price.amount}/${bp}`,
                            },
                          },
                        });
                      }}
                      className="input w-full h-9 text-xs"
                    >
                      <option value="month">Month (/month)</option>
                      <option value="year">Year (/year)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-2xs uppercase tracking-wider font-semibold text-muted-cv mb-1">
                      Display Price Label
                    </label>
                    <input
                      type="text"
                      value={premiumConfig.premium.price.label}
                      onChange={(e) =>
                        setPremiumConfig({
                          ...premiumConfig,
                          premium: {
                            ...premiumConfig.premium,
                            price: { ...premiumConfig.premium.price, label: e.target.value },
                          },
                        })
                      }
                      className="input w-full h-9 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Feature Management */}
              <div className="pt-4 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-sm font-bold text-primary">Feature Management</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {Object.entries(premiumConfig.premium.features).map(([feat, enabled]) => (
                    <label key={feat} className="flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer hover:bg-hover-cv" style={{ borderColor: 'var(--border)' }}>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) =>
                          setPremiumConfig({
                            ...premiumConfig,
                            premium: {
                              ...premiumConfig.premium,
                              features: { ...premiumConfig.premium.features, [feat]: e.target.checked },
                            },
                          })
                        }
                        className="w-4 h-4 accent-indigo-600 rounded"
                      />
                      <span className="capitalize text-primary font-medium">
                        {feat.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-6 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={handleSavePremiumConfig}
                  className="btn-primary btn-md gap-2 text-xs font-bold"
                >
                  <Check size={14} /> Save Configuration
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════ */}
        {/* TAB 3: TOOLS MANAGER                                  */}
        {/* ═════════════════════════════════════════════════════ */}
        {activeTab === 'tools' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-base font-bold text-primary">Conversion Tools Access Manager</h2>
                <p className="text-xs text-muted-cv mt-0.5">
                  Control which of the {TOOLS.length} conversion tools require a Premium membership.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSavePremiumTools}
                className="btn-primary btn-sm text-xs gap-1.5"
              >
                <Check size={13} /> Save Tool Restrictions
              </button>
            </div>

            <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                    <tr>
                      <th className="px-4 py-3 font-semibold text-muted-cv">Tool Name</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv">Slug</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv">Category</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv">Access Tier</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv text-right">Premium Requirement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {TOOLS.map((tool) => {
                      const isRestricted = premiumTools.includes(tool.slug);
                      return (
                        <tr key={tool.slug} className="hover:bg-hover-cv transition-colors">
                          <td className="px-4 py-3 font-bold text-primary">{tool.name}</td>
                          <td className="px-4 py-3 font-mono text-muted-cv"><code>{tool.slug}</code></td>
                          <td className="px-4 py-3">
                            <span className="badge badge-neutral uppercase text-2xs">{tool.category}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`badge text-2xs font-bold ${isRestricted ? 'badge-brand' : 'badge-success'}`}>
                              {isRestricted ? '⭐ Premium Only' : '🟢 Free'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => toggleToolPremium(tool.slug)}
                              className={`btn-sm text-2xs font-semibold ${
                                isRestricted ? 'btn-secondary text-error-600' : 'btn-ghost text-accent'
                              }`}
                            >
                              {isRestricted ? 'Make Free' : 'Lock to Premium'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════ */}
        {/* TAB 4: TELEGRAM BOT                                   */}
        {/* ═════════════════════════════════════════════════════ */}
        {activeTab === 'telegram' && (
          <div className="space-y-6">
            {/* Diagnostics Card */}
            <div className="p-6 rounded-2xl border shadow-sm space-y-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-base font-bold text-primary">Telegram Bot Connection Diagnostics</h2>
                  <p className="text-xs text-muted-cv mt-0.5">Real-time status check with the official Telegram Bot API</p>
                </div>
                <button
                  type="button"
                  onClick={handleTestTelegram}
                  className="btn-primary btn-sm text-xs gap-1.5"
                >
                  <Send size={13} /> Send Test Alert
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-4 rounded-xl border bg-surface" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-2xs uppercase tracking-wider font-semibold text-muted-cv">Bot Token Status</span>
                  <p className="text-xs font-bold text-primary mt-1 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${telegramDiagnostics?.hasToken ? 'bg-success-500' : 'bg-error-500'}`} />
                    {telegramDiagnostics?.hasToken ? 'Configured (Env)' : 'Not Set'}
                  </p>
                </div>

                <div className="p-4 rounded-xl border bg-surface" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-2xs uppercase tracking-wider font-semibold text-muted-cv">Admin Chat ID</span>
                  <p className="text-xs font-bold text-primary mt-1 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${telegramDiagnostics?.hasChatId ? 'bg-success-500' : 'bg-error-500'}`} />
                    {telegramDiagnostics?.hasChatId ? 'Configured (Env)' : 'Not Set'}
                  </p>
                </div>

                <div className="p-4 rounded-xl border bg-surface" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-2xs uppercase tracking-wider font-semibold text-muted-cv">API Reachability</span>
                  <p className="text-xs font-bold text-primary mt-1 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${telegramDiagnostics?.apiReachable ? 'bg-success-500' : 'bg-warning-500'}`} />
                    {telegramDiagnostics?.apiReachable ? 'Connected & Verified' : 'Local Mock Mode'}
                  </p>
                </div>
              </div>

              {telegramDiagnostics?.botInfo && (
                <div className="p-3 rounded-xl border bg-success-500/10 border-success-500/30 text-xs text-success-700 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Verified Telegram Bot: <strong>{telegramDiagnostics.botInfo.name}</strong> (@{telegramDiagnostics.botInfo.username})</span>
                </div>
              )}
            </div>

            {/* Notification Event Settings */}
            <div className="p-6 rounded-2xl border shadow-sm space-y-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-bold text-primary">Notification Event Toggles</h3>
              {telegramSettings ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: 'notify_conversion_started', label: 'Conversion Started', desc: 'Alert when client begins conversion' },
                    { key: 'notify_conversion_completed', label: 'Conversion Completed', desc: 'Alert with duration and file sizes' },
                    { key: 'notify_conversion_failed', label: 'Conversion Failed', desc: 'Alert with error summary and retry state' },
                    { key: 'notify_new_user', label: 'New User Registration', desc: 'Alert when new user creates account' },
                    { key: 'notify_premium_access', label: 'Premium Tool Access', desc: 'Alert when a user launches a premium tool' },
                    { key: 'notify_admin_changes', label: 'Admin Settings Changed', desc: 'Alert when admin updates pricing or passwords' },
                    { key: 'notify_system_errors', label: 'System Errors', desc: 'Alert on uncaught server exceptions' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center justify-between p-3 rounded-xl border cursor-pointer hover:bg-hover-cv" style={{ borderColor: 'var(--border)' }}>
                      <div>
                        <p className="text-xs font-bold text-primary">{item.label}</p>
                        <p className="text-2xs text-muted-cv">{item.desc}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={telegramSettings[item.key as keyof NotificationSettings]}
                        onChange={() => handleToggleNotificationSetting(item.key as keyof NotificationSettings)}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-cv">Loading preferences...</p>
              )}
            </div>

            {/* Delivery Logs */}
            <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-sm font-bold text-primary">Notification Delivery History</h3>
                <span className="text-2xs text-muted-cv font-num">{notificationLogs.length} logged attempts</span>
              </div>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                    <tr>
                      <th className="px-4 py-2.5 font-semibold text-muted-cv">Event Type</th>
                      <th className="px-4 py-2.5 font-semibold text-muted-cv">Delivery Status</th>
                      <th className="px-4 py-2.5 font-semibold text-muted-cv">Retries</th>
                      <th className="px-4 py-2.5 font-semibold text-muted-cv">Message ID / Error</th>
                      <th className="px-4 py-2.5 font-semibold text-muted-cv">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {notificationLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-cv">
                          No notifications delivered yet.
                        </td>
                      </tr>
                    ) : (
                      notificationLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-hover-cv">
                          <td className="px-4 py-2.5 font-mono text-primary">{log.event_type}</td>
                          <td className="px-4 py-2.5">
                            <span className={`badge text-2xs uppercase ${
                              log.status === 'sent' ? 'badge-success' : log.status === 'retried' ? 'badge-warning' : 'badge-neutral'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-num">{log.retry_count}</td>
                          <td className="px-4 py-2.5 text-muted-cv truncate max-w-xs">
                            {log.error_message || (log.message_id ? `Msg #${log.message_id}` : '-')}
                          </td>
                          <td className="px-4 py-2.5 font-num text-2xs text-muted-cv">
                            {new Date(log.created_at).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════ */}
        {/* TAB 5: REAL ANALYTICS & CONVERSION JOBS               */}
        {/* ═════════════════════════════════════════════════════ */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Filters Bar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-cv" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by ID, file, user..."
                    className="input pl-8 h-9 text-xs w-48 sm:w-60"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input h-9 text-xs w-32"
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="started">Processing</option>
                </select>

                <select
                  value={toolFilter}
                  onChange={(e) => setToolFilter(e.target.value)}
                  className="input h-9 text-xs w-36"
                >
                  <option value="all">All Tools</option>
                  {TOOLS.map((t) => (
                    <option key={t.slug} value={t.slug}>{t.name}</option>
                  ))}
                </select>

                <select
                  value={dateRangeFilter}
                  onChange={(e) => setDateRangeFilter(e.target.value)}
                  className="input h-9 text-xs w-32"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-cv font-num">
                  {jobs.length} conversion records
                </span>
                <button
                  type="button"
                  onClick={handleExportReport}
                  className="btn-secondary btn-sm text-xs gap-1"
                >
                  <Download size={12} /> Export
                </button>
              </div>
            </div>

            {/* Visual Breakdown Strip */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tool Usage Breakdown */}
              <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-cv mb-3">
                  Most Used Conversion Tools
                </h3>
                {stats?.toolUsage && stats.toolUsage.length > 0 ? (
                  <div className="space-y-2.5">
                    {stats.toolUsage.slice(0, 5).map((tool) => {
                      const maxCount = Math.max(...stats.toolUsage.map((t) => t.count), 1);
                      const pct = Math.round((tool.count / maxCount) * 100);
                      return (
                        <div key={tool.tool_slug} className="text-xs space-y-1">
                          <div className="flex justify-between text-2xs">
                            <span className="font-semibold text-primary">{tool.tool_name}</span>
                            <span className="text-muted-cv font-num">{tool.count} runs</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-surface overflow-hidden">
                            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-cv italic py-4">No tool usage data recorded yet.</p>
                )}
              </div>

              {/* File Format Distribution */}
              <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-cv mb-3">
                  File Format Distribution
                </h3>
                {stats?.fileTypeDistribution && stats.fileTypeDistribution.length > 0 ? (
                  <div className="space-y-2.5">
                    {stats.fileTypeDistribution.slice(0, 5).map((fmt) => (
                      <div key={fmt.format} className="text-xs space-y-1">
                        <div className="flex justify-between text-2xs">
                          <span className="font-semibold text-primary font-mono">.{fmt.format.toLowerCase()}</span>
                          <span className="text-muted-cv font-num">{fmt.count} files ({fmt.percentage}%)</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-surface overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${fmt.percentage}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-cv italic py-4">No file formats recorded yet.</p>
                )}
              </div>
            </div>

            {/* Jobs Ledger Table */}
            <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                    <tr>
                      <th className="px-4 py-3 font-semibold text-muted-cv">Job ID</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv">Tool</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv">User</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv">Input</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv">Output</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv">Status</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv">Duration</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv">Timestamp</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {jobs.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center text-muted-cv">
                          No conversion jobs match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      jobs.map((job) => (
                        <tr key={job.id} className="hover:bg-hover-cv transition-colors">
                          <td className="px-4 py-3 font-mono font-medium text-primary">
                            <code>{job.id}</code>
                          </td>
                          <td className="px-4 py-3 font-semibold text-primary">{job.toolName}</td>
                          <td className="px-4 py-3 text-secondary">{job.userName || 'Anonymous'}</td>
                          <td className="px-4 py-3 text-muted-cv truncate max-w-[140px]">{job.inputFileName}</td>
                          <td className="px-4 py-3 text-muted-cv truncate max-w-[140px]">{job.outputFileName || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`badge text-2xs uppercase ${
                              job.status === 'completed' ? 'badge-success' : job.status === 'failed' ? 'badge-error' : 'badge-neutral'
                            }`}>
                              {job.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-num text-muted-cv">{((job.durationMs || 0) / 1000).toFixed(1)}s</td>
                          <td className="px-4 py-3 text-2xs text-muted-cv font-num">{new Date(job.createdAt).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenJob(job)}
                              className="btn-ghost btn-sm text-xs gap-1"
                            >
                              <Eye size={12} /> Inspect
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════ */}
        {/* TAB 6: ACTIVITY LOGS                                  */}
        {/* ═════════════════════════════════════════════════════ */}
        {activeTab === 'audit' && (
          <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h2 className="text-sm font-bold text-primary">System Audit Trail</h2>
                <p className="text-xs text-muted-cv">Chronological ledger of logins, price changes, and tool alterations</p>
              </div>
              <span className="text-xs text-muted-cv font-num">{auditLogs.length} entries</span>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-cv">No audit logs recorded yet.</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-4 flex items-start justify-between gap-4 text-xs">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge badge-neutral uppercase font-mono">{log.event_type}</span>
                        <span className="font-semibold text-primary">{log.actor}</span>
                      </div>
                      <p className="text-muted-cv font-mono break-all">{log.details}</p>
                    </div>
                    <span className="text-2xs text-muted-cv font-num flex-shrink-0">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Job Inspection Modal ───────────────────────── */}
        <Modal
          isOpen={Boolean(selectedJob)}
          onClose={() => setSelectedJob(null)}
          title={`Job Inspection: ${selectedJob?.id}`}
          subtitle={`Initiated ${selectedJob ? new Date(selectedJob.createdAt).toLocaleString() : ''}`}
        >
          {selectedJob && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl border bg-surface text-xs" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <span className="text-2xs text-muted-cv uppercase font-semibold">Tool</span>
                  <p className="font-bold text-primary mt-0.5">{selectedJob.toolName}</p>
                </div>
                <div>
                  <span className="text-2xs text-muted-cv uppercase font-semibold">Status</span>
                  <p className="font-bold capitalize mt-0.5 text-emerald-500">{selectedJob.status}</p>
                </div>
                <div>
                  <span className="text-2xs text-muted-cv uppercase font-semibold">Input File</span>
                  <p className="text-primary mt-0.5 truncate">{selectedJob.inputFileName}</p>
                </div>
                <div>
                  <span className="text-2xs text-muted-cv uppercase font-semibold">Output File</span>
                  <p className="text-primary mt-0.5 truncate">{selectedJob.outputFileName || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-2xs text-muted-cv uppercase font-semibold">User</span>
                  <p className="text-primary mt-0.5">{selectedJob.userName || 'Anonymous'}</p>
                </div>
                <div>
                  <span className="text-2xs text-muted-cv uppercase font-semibold">Duration</span>
                  <p className="font-num text-primary mt-0.5">{((selectedJob.durationMs || 0) / 1000).toFixed(2)}s</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">
                  Admin Comments &amp; Telegram Notes ({jobComments.length})
                </h4>

                <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                  {jobComments.length === 0 ? (
                    <p className="text-xs text-muted-cv italic">No comments attached to this job.</p>
                  ) : (
                    jobComments.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-lg border text-xs"
                        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-primary">{c.author}</span>
                          <span className="text-2xs text-muted-cv">{new Date(c.created_at).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-secondary leading-relaxed">{c.comment}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add an admin comment or verification note..."
                    className="input h-9 text-xs flex-1"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingComment || !newComment.trim()}
                    className="btn-primary btn-sm gap-1.5"
                  >
                    <Plus size={13} /> Add
                  </button>
                </form>
              </div>
            </div>
          )}
        </Modal>

        {/* ── Password Change Modal ──────────────────────── */}
        <Modal
          isOpen={showPwdModal}
          onClose={() => {
            if (!mustChangePassword) setShowPwdModal(false);
          }}
          title="Change Administrator Password"
          subtitle={mustChangePassword ? 'First-time setup: You must update your initial default password.' : 'Update your administrator password'}
        >
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-2xs uppercase tracking-wider font-semibold text-muted-cv mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                required
                className="input w-full h-9 text-xs"
                placeholder="Enter current password"
              />
            </div>

            <div>
              <label className="block text-2xs uppercase tracking-wider font-semibold text-muted-cv mb-1">
                New Password (minimum 8 characters)
              </label>
              <input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                required
                minLength={8}
                className="input w-full h-9 text-xs"
                placeholder="Enter strong new password"
              />
            </div>

            <div>
              <label className="block text-2xs uppercase tracking-wider font-semibold text-muted-cv mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                required
                minLength={8}
                className="input w-full h-9 text-xs"
                placeholder="Re-enter new password"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              {!mustChangePassword && (
                <button
                  type="button"
                  onClick={() => setShowPwdModal(false)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={pwdChangeLoading}
                className="btn-primary btn-sm gap-1.5"
              >
                {pwdChangeLoading ? <RefreshCw size={13} className="animate-spin" /> : <KeyRound size={13} />}
                Update Password
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
};

export default AdminPage;
