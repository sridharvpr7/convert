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
  Search, Plus, Eye, EyeOff, Bell, Lock, LogOut, Check,
  AlertTriangle, Settings, Zap, Download, KeyRound, Clock,
  Wrench, CheckCircle2, Sliders, Globe, Layout, Palette,
  Star, HardDrive, Layers, HelpCircle,
} from 'lucide-react';
import { TOOLS } from '@/registry/tools';
import {
  apiClient, ApiJob, ApiStats, ApiAdminComment, ApiAuditLog,
  NotificationSettings, FullPremiumConfig, TelegramDiagnostics,
  ApiNotificationLog, SiteDisplayConfig, ToolDisplaySetting,
} from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/ToastContext';
import { useAppStore } from '@/store/app.store';

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

  // Site Display Controls State
  const { setSiteDisplayConfig: setGlobalDisplayConfig } = useAppStore();
  const [siteDisplay, setSiteDisplay] = useState<SiteDisplayConfig | null>(null);
  const [hasUnsavedDisplayChanges, setHasUnsavedDisplayChanges] = useState(false);
  const [isSavingDisplay, setIsSavingDisplay] = useState(false);
  const [displaySearch, setDisplaySearch] = useState('');

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'display' | 'premium' | 'tools' | 'telegram' | 'analytics' | 'audit'>('overview');
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
        displayRes,
      ] = await Promise.all([
        apiClient.getAdminStats(dateRangeFilter),
        apiClient.getAdminJobs({ status: statusFilter, tool: toolFilter, search: searchQuery, range: dateRangeFilter }),
        apiClient.getAdminAuditLogs(50),
        apiClient.getNotificationLogs(50),
        apiClient.getTelegramSettings(),
        apiClient.getTelegramDiagnostics(),
        apiClient.getAdminPremiumConfig(),
        apiClient.getAdminSiteConfig(),
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
      if (displayRes) {
        setSiteDisplay(displayRes);
        setGlobalDisplayConfig(displayRes);
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

  // ── Website Display Controls Handlers ────────────────────
  const handleToggleDisplayField = (pathStr: string) => {
    if (!siteDisplay) return;
    const clone = structuredClone(siteDisplay);
    const parts = pathStr.split('.');
    let curr: any = clone;
    for (let i = 0; i < parts.length - 1; i++) {
      curr = curr[parts[i]];
    }
    curr[parts[parts.length - 1]] = !curr[parts[parts.length - 1]];
    setSiteDisplay(clone);
    setHasUnsavedDisplayChanges(true);
  };

  const handleUpdateDisplayText = (pathStr: string, textVal: string) => {
    if (!siteDisplay) return;
    const clone = structuredClone(siteDisplay);
    const parts = pathStr.split('.');
    let curr: any = clone;
    for (let i = 0; i < parts.length - 1; i++) {
      curr = curr[parts[i]];
    }
    curr[parts[parts.length - 1]] = textVal;
    setSiteDisplay(clone);
    setHasUnsavedDisplayChanges(true);
  };

  const handleUpdateToolDisplay = (slug: string, field: keyof ToolDisplaySetting, value: any) => {
    if (!siteDisplay) return;
    const clone = structuredClone(siteDisplay);
    if (!clone.tools[slug]) {
      const canonical = TOOLS.find((t) => t.slug === slug);
      clone.tools[slug] = {
        name: canonical?.name || slug,
        category: canonical?.category || 'utilities',
        visible: true,
        enabled: true,
        tier: 'free',
        featured: false,
        maintenance: false,
      };
    }
    (clone.tools[slug] as any)[field] = value;
    setSiteDisplay(clone);
    setHasUnsavedDisplayChanges(true);
  };

  const handleSaveDisplayConfig = async () => {
    if (!siteDisplay) return;
    setIsSavingDisplay(true);
    try {
      const res = await apiClient.updateAdminSiteConfig(siteDisplay);
      if (res.ok && res.config) {
        setSiteDisplay(res.config);
        setHasUnsavedDisplayChanges(false);
        setGlobalDisplayConfig(res.config);
        toast.success('Website display controls updated persistently!');
      } else {
        toast.error(res.error || 'Failed to save website display controls');
      }
    } catch {
      toast.error('Network error saving display controls');
    } finally {
      setIsSavingDisplay(false);
    }
  };

  const handleResetDisplayConfig = async () => {
    if (!window.confirm('Reset all website display controls to system default settings?')) return;
    try {
      const res = await apiClient.resetAdminSiteConfig();
      if (res.ok && res.config) {
        setSiteDisplay(res.config);
        setHasUnsavedDisplayChanges(false);
        setGlobalDisplayConfig(res.config);
        toast.success('Website display controls reset to defaults');
      } else {
        toast.error(res.error || 'Failed to reset display controls');
      }
    } catch {
      toast.error('Network error resetting display controls');
    }
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
            {
              id: 'display',
              label: 'Website Display Controls',
              icon: <Sliders size={14} />,
              badge: hasUnsavedDisplayChanges ? 'Unsaved' : undefined,
            },
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
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="badge badge-warning text-2xs px-1.5 py-0.5 ml-0.5 animate-pulse">
                  {tab.badge}
                </span>
              )}
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
                <p className="text-2xs text-muted-cv mt-1">
                  {stats?.todayCount !== undefined ? `${stats.todayCount} today · ${stats.weekCount} this week` : 'Verified completed jobs'}
                </p>
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
                  <span className="text-xs font-semibold uppercase tracking-wider">Data Processed</span>
                  <HardDrive size={16} className="text-purple-500" />
                </div>
                <p className="text-3xl font-extrabold text-primary font-num">
                  {stats?.totalDataProcessedBytes ? `${(stats.totalDataProcessedBytes / (1024 * 1024)).toFixed(1)} MB` : '0 MB'}
                </p>
                <p className="text-2xs text-muted-cv mt-1">
                  {stats?.totalBytesSaved ? `${(stats.totalBytesSaved / 1024).toFixed(0)} KB saved` : 'Actual file bandwidth'}
                </p>
              </div>
            </div>

            {/* System Health Status Panel */}
            <div className="p-6 rounded-2xl border shadow-sm space-y-3" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-accent" />
                  <h3 className="text-sm font-bold text-primary">System Infrastructure Health</h3>
                </div>
                <span className="badge badge-success text-2xs font-bold">All Subsystems Monitored</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="p-3.5 rounded-xl border bg-surface" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-2xs uppercase tracking-wider font-semibold text-muted-cv">Application</span>
                  <p className="text-xs font-bold text-success-600 mt-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-success-500" />
                    Operational (Node.js)
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border bg-surface" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-2xs uppercase tracking-wider font-semibold text-muted-cv">Database Engine</span>
                  <p className="text-xs font-bold text-primary mt-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-success-500" />
                    {stats?.systemHealth?.database || 'Connected'}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border bg-surface" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-2xs uppercase tracking-wider font-semibold text-muted-cv">Telegram Alerts</span>
                  <p className="text-xs font-bold text-primary mt-1 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${telegramDiagnostics?.apiReachable ? 'bg-success-500' : 'bg-warning-500'}`} />
                    {telegramDiagnostics?.apiReachable ? 'API Verified' : 'Local Mock'}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border bg-surface" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-2xs uppercase tracking-wider font-semibold text-muted-cv">Local Storage</span>
                  <p className="text-xs font-bold text-success-600 mt-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-success-500" />
                    Available (Read/Write)
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Status Banners (Visitors & Telegram Delivery) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Visitor Analytics */}
              <div className="p-5 rounded-2xl border shadow-sm flex flex-col justify-between" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-cv">Real Visitor Analytics</span>
                    <span className="badge badge-neutral text-2xs font-bold">Privacy-First</span>
                  </div>
                  <p className="text-2xl font-extrabold text-primary font-num">
                    {stats?.visitorStats?.totalVisitors ?? stats?.totalUsers ?? 0}
                  </p>
                  <p className="text-xs text-muted-cv mt-1">
                    {stats?.visitorStats?.anonymousVisitors ?? 0} anonymous · {stats?.visitorStats?.authenticatedVisitors ?? stats?.totalUsers ?? 0} auth
                  </p>
                  <p className="text-2xs text-muted-cv mt-0.5">
                    {stats?.visitorStats?.totalPageViews ?? 0} total pageviews · {stats?.visitorStats?.returningVisitors ?? 0} returning
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t text-2xs text-muted-cv" style={{ borderColor: 'var(--border)' }}>
                  Anonymous UUID / session tracking (zero PII)
                </div>
              </div>

              {/* Telegram Delivery Stats */}
              <div className="p-5 rounded-2xl border shadow-sm flex flex-col justify-between" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-cv">Telegram Delivery</span>
                    <span className="badge badge-success text-2xs font-bold">
                      {stats?.telegramStats?.deliverySuccessRate ?? 100}% Delivered
                    </span>
                  </div>
                  <p className="text-2xl font-extrabold text-primary font-num">
                    {stats?.telegramStats?.sent ?? 0} alerts
                  </p>
                  <p className="text-xs text-muted-cv mt-1">
                    {stats?.telegramStats?.failed ?? 0} failed · {stats?.telegramStats?.mocked ?? 0} mock dispatches
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                  <button
                    type="button"
                    onClick={handleTestTelegram}
                    className="btn-primary btn-sm text-xs gap-1"
                  >
                    <Send size={11} /> Test Bot
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('telegram')}
                    className="text-xs text-accent hover:underline font-semibold"
                  >
                    Settings →
                  </button>
                </div>
              </div>

              {/* Premium Entitlement Stats */}
              <div className="p-5 rounded-2xl border shadow-sm flex flex-col justify-between" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-cv">Premium Entitlements</span>
                    <span className={`badge text-2xs font-bold ${premiumConfig?.premium.enabled ? 'badge-success' : 'badge-error'}`}>
                      {premiumConfig?.premium.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-2xl font-extrabold text-primary font-num">
                    {stats?.premiumStats?.activeAccounts ?? 0} active
                  </p>
                  <p className="text-xs text-muted-cv mt-1">
                    {stats?.premiumStats?.expiredAccounts ?? 0} expired · {stats?.premiumStats?.revokedAccounts ?? 0} revoked
                  </p>
                  <p className="text-2xs text-muted-cv mt-0.5">
                    Verified Revenue: ₹{stats?.premiumStats?.totalVerifiedRevenue ?? 0} (Zero dummy revenue)
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('display')}
                    className="text-xs text-accent hover:underline font-semibold"
                  >
                    Display Controls →
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('premium')}
                    className="text-xs text-accent hover:underline font-semibold"
                  >
                    Pricing &amp; Rates →
                  </button>
                </div>
              </div>
            </div>

            {/* Daily Trends Visualization */}
            {stats?.dailyTrends && stats.dailyTrends.length > 0 && (
              <div className="p-6 rounded-2xl border shadow-sm space-y-3" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-primary">Daily Conversion Trend (Asia/Kolkata Calendar)</h3>
                    <p className="text-xs text-muted-cv">Actual completed and failed jobs per day</p>
                  </div>
                  <span className="text-xs font-semibold text-accent">Last 7 Days</span>
                </div>

                <div className="grid grid-cols-7 gap-2 pt-2">
                  {stats.dailyTrends.map((day) => {
                    const totalDay = day.completed + day.failed;
                    const maxInPeriod = Math.max(...(stats.dailyTrends?.map((d) => d.completed + d.failed) || [1]), 1);
                    const heightPct = totalDay > 0 ? Math.max(Math.round((totalDay / maxInPeriod) * 100), 12) : 6;

                    return (
                      <div key={day.date} className="flex flex-col items-center gap-1.5">
                        <div className="w-full h-24 bg-surface rounded-xl flex flex-col justify-end p-1 relative overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                          {totalDay > 0 ? (
                            <div
                              className="w-full rounded-lg transition-all flex flex-col justify-end overflow-hidden"
                              style={{ height: `${heightPct}%`, backgroundColor: 'var(--accent)' }}
                            >
                              {day.failed > 0 && (
                                <div
                                  className="w-full bg-error-500"
                                  style={{ height: `${Math.round((day.failed / totalDay) * 100)}%` }}
                                />
                              )}
                            </div>
                          ) : (
                            <div className="w-full h-1 bg-border rounded-full" />
                          )}
                        </div>
                        <span className="text-2xs font-bold text-primary font-num">{day.label}</span>
                        <span className="text-2xs text-muted-cv font-num">{day.completed} / {day.failed}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
        {/* TAB 2: WEBSITE DISPLAY CONTROLS                       */}
        {/* ═════════════════════════════════════════════════════ */}
        {activeTab === 'display' && siteDisplay && (
          <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="p-5 rounded-2xl border shadow-sm flex items-center justify-between gap-4 flex-wrap" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <Sliders size={18} className="text-accent" />
                  <h2 className="text-base font-bold text-primary">Website Visibility &amp; Feature Control System</h2>
                  {hasUnsavedDisplayChanges && (
                    <span className="badge badge-warning text-xs font-bold animate-pulse">
                      ● Unsaved Changes
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-cv mt-0.5">
                  Live JSON-driven visibility and access toggles. Modify sections, navigation, and tools without code deployment.
                  {siteDisplay.lastModified && (
                    <span className="ml-2 font-mono text-2xs">Last saved: {new Date(siteDisplay.lastModified).toLocaleString()}</span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetDisplayConfig}
                  className="btn-secondary btn-sm text-xs gap-1.5"
                  title="Reset all visibility toggles to default"
                >
                  <RefreshCw size={12} /> Reset to Defaults
                </button>
                <button
                  type="button"
                  onClick={handleSaveDisplayConfig}
                  disabled={!hasUnsavedDisplayChanges || isSavingDisplay}
                  className={`btn-primary btn-sm text-xs gap-1.5 font-bold shadow-sm ${
                    !hasUnsavedDisplayChanges ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isSavingDisplay ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                  Save All Changes
                </button>
              </div>
            </div>

            {/* Sub-panels in a responsive 3-column layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* 1. Global Controls */}
              <div className="p-5 rounded-2xl border shadow-sm space-y-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                  <Globe size={16} className="text-accent" />
                  <h3 className="text-sm font-bold text-primary">Global Website Controls</h3>
                </div>

                <div className="space-y-3 text-xs">
                  <label className="flex items-center justify-between p-2.5 rounded-xl border cursor-pointer hover:bg-hover-cv" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <p className="font-bold text-primary">Show Navigation Header</p>
                      <p className="text-2xs text-muted-cv">Top sticky bar with logo and nav</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={siteDisplay.global.showHeader}
                      onChange={() => handleToggleDisplayField('global.showHeader')}
                      className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl border cursor-pointer hover:bg-hover-cv" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <p className="font-bold text-primary">Show Website Footer</p>
                      <p className="text-2xs text-muted-cv">Bottom links and copyright</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={siteDisplay.global.showFooter}
                      onChange={() => handleToggleDisplayField('global.showFooter')}
                      className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl border cursor-pointer hover:bg-hover-cv" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <p className="font-bold text-primary">Show Announcement Bar</p>
                      <p className="text-2xs text-muted-cv">Top notification alert banner</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={siteDisplay.global.showAnnouncementBar}
                      onChange={() => handleToggleDisplayField('global.showAnnouncementBar')}
                      className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                    />
                  </label>

                  <div className="p-2.5 rounded-xl border bg-surface" style={{ borderColor: 'var(--border)' }}>
                    <label className="block text-2xs uppercase tracking-wider font-semibold text-muted-cv mb-1">
                      Announcement Banner Text
                    </label>
                    <input
                      type="text"
                      value={siteDisplay.global.announcementText || ''}
                      onChange={(e) => handleUpdateDisplayText('global.announcementText', e.target.value)}
                      className="input w-full h-8 text-xs"
                      placeholder="Banner text..."
                    />
                  </div>

                  <label className="flex items-center justify-between p-2.5 rounded-xl border cursor-pointer bg-error-500/5 hover:bg-error-500/10" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <p className="font-bold text-error-600">Platform Maintenance Mode</p>
                      <p className="text-2xs text-muted-cv">Temporarily blocks file conversions with notice</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={siteDisplay.global.maintenanceMode}
                      onChange={() => handleToggleDisplayField('global.maintenanceMode')}
                      className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* 2. Navigation Link Controls */}
              <div className="p-5 rounded-2xl border shadow-sm space-y-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                  <Layout size={16} className="text-emerald-500" />
                  <h3 className="text-sm font-bold text-primary">Navigation Bar Links</h3>
                </div>

                <div className="space-y-2.5 text-xs">
                  {[
                    { key: 'navigation.showHome', label: 'Home Link', path: 'navigation.showHome' },
                    { key: 'navigation.showTools', label: 'Tools Dropdown Menu', path: 'navigation.showTools' },
                    { key: 'navigation.showDashboard', label: 'Dashboard Link', path: 'navigation.showDashboard' },
                    { key: 'navigation.showPricing', label: 'Pricing Page Link', path: 'navigation.showPricing' },
                    { key: 'navigation.showPremium', label: 'Premium Gold Button', path: 'navigation.showPremium' },
                    { key: 'navigation.showAbout', label: 'About Us Link', path: 'navigation.showAbout' },
                    { key: 'navigation.showContact', label: 'Contact Us Link', path: 'navigation.showContact' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center justify-between p-2.5 rounded-xl border cursor-pointer hover:bg-hover-cv" style={{ borderColor: 'var(--border)' }}>
                      <span className="font-bold text-primary">{item.label}</span>
                      <input
                        type="checkbox"
                        checked={(siteDisplay as any)[item.path.split('.')[0]][item.path.split('.')[1]]}
                        onChange={() => handleToggleDisplayField(item.path)}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* 3. Homepage Section Controls */}
              <div className="p-5 rounded-2xl border shadow-sm space-y-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                  <Layers size={16} className="text-amber-500" />
                  <h3 className="text-sm font-bold text-primary">Homepage Sections</h3>
                </div>

                <div className="space-y-2 text-xs">
                  {[
                    { key: 'homepage.showHero', label: 'Hero Header & AI Prompt Box', path: 'homepage.showHero' },
                    { key: 'homepage.showStatistics', label: 'Verified Metrics KPI Strip', path: 'homepage.showStatistics' },
                    { key: 'homepage.showCategories', label: 'Category Cards Grid', path: 'homepage.showCategories' },
                    { key: 'homepage.showFeaturedTools', label: 'Featured / Popular Tools Grid', path: 'homepage.showFeaturedTools' },
                    { key: 'homepage.showHowItWorks', label: 'How It Works 4-Step Guide', path: 'homepage.showHowItWorks' },
                    { key: 'homepage.showFeatures', label: 'Client-Side Privacy Features', path: 'homepage.showFeatures' },
                    { key: 'homepage.showTestimonials', label: 'User Testimonials Section', path: 'homepage.showTestimonials' },
                    { key: 'homepage.showPricing', label: 'Premium Pricing CTA Box', path: 'homepage.showPricing' },
                    { key: 'homepage.showCTA', label: 'Workflows & Automation Banner', path: 'homepage.showCTA' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center justify-between p-2 rounded-xl border cursor-pointer hover:bg-hover-cv" style={{ borderColor: 'var(--border)' }}>
                      <span className="font-medium text-primary">{item.label}</span>
                      <input
                        type="checkbox"
                        checked={(siteDisplay as any)[item.path.split('.')[0]][item.path.split('.')[1]]}
                        onChange={() => handleToggleDisplayField(item.path)}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* 4. Feature Toggles */}
              <div className="p-5 rounded-2xl border shadow-sm space-y-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                  <Zap size={16} className="text-purple-500" />
                  <h3 className="text-sm font-bold text-primary">Interactive Features</h3>
                </div>

                <div className="space-y-2 text-xs">
                  {[
                    { key: 'features.showSearch', label: 'Command Palette & Search Box', path: 'features.showSearch' },
                    { key: 'features.showFileUpload', label: 'Quick Upload Drop Area', path: 'features.showFileUpload' },
                    { key: 'features.showDragAndDrop', label: 'Drag and Drop File Support', path: 'features.showDragAndDrop' },
                    { key: 'features.showLiveAnalytics', label: 'Live Platform Analytics Widget', path: 'features.showLiveAnalytics' },
                    { key: 'features.showRecentActivity', label: 'Recent Conversion Activity Feed', path: 'features.showRecentActivity' },
                    { key: 'features.showVisitorCounter', label: 'Real Visitor Analytics Metrics', path: 'features.showVisitorCounter' },
                    { key: 'features.showThemeToggle', label: 'Light/Dark Theme Switcher', path: 'features.showThemeToggle' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center justify-between p-2 rounded-xl border cursor-pointer hover:bg-hover-cv" style={{ borderColor: 'var(--border)' }}>
                      <span className="font-medium text-primary">{item.label}</span>
                      <input
                        type="checkbox"
                        checked={(siteDisplay as any)[item.path.split('.')[0]][item.path.split('.')[1]]}
                        onChange={() => handleToggleDisplayField(item.path)}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* 5. Pricing Controls */}
              <div className="p-5 rounded-2xl border shadow-sm space-y-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                  <Palette size={16} className="text-indigo-500" />
                  <h3 className="text-sm font-bold text-primary">Pricing Page Controls</h3>
                </div>

                <div className="space-y-2.5 text-xs">
                  {[
                    { key: 'pricing.showPricingPage', label: 'Pricing Page Route Active', path: 'pricing.showPricingPage' },
                    { key: 'pricing.showFreePlan', label: 'Show Free Community Tier', path: 'pricing.showFreePlan' },
                    { key: 'pricing.showPremiumPlan', label: 'Show Pro / Premium Plan Tier', path: 'pricing.showPremiumPlan' },
                    { key: 'pricing.showPrices', label: 'Display Numerical Prices', path: 'pricing.showPrices' },
                    { key: 'pricing.showUpgradeButtons', label: 'Show Upgrade CTA Buttons', path: 'pricing.showUpgradeButtons' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center justify-between p-2.5 rounded-xl border cursor-pointer hover:bg-hover-cv" style={{ borderColor: 'var(--border)' }}>
                      <span className="font-medium text-primary">{item.label}</span>
                      <input
                        type="checkbox"
                        checked={(siteDisplay as any)[item.path.split('.')[0]][item.path.split('.')[1]]}
                        onChange={() => handleToggleDisplayField(item.path)}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* 6. Branding & Category Controls */}
              <div className="p-5 rounded-2xl border shadow-sm space-y-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                  <Shield size={16} className="text-cyan-500" />
                  <h3 className="text-sm font-bold text-primary">Category &amp; Branding Controls</h3>
                </div>

                <div className="space-y-2 text-xs">
                  <p className="text-2xs uppercase tracking-wider font-semibold text-muted-cv mb-1">
                    Tool Categories Visibility
                  </p>
                  {Object.entries(siteDisplay.categories || {}).map(([catKey, cat]) => (
                    <label key={catKey} className="flex items-center justify-between p-2 rounded-xl border cursor-pointer hover:bg-hover-cv" style={{ borderColor: 'var(--border)' }}>
                      <span className="font-semibold text-primary">{cat.name}</span>
                      <input
                        type="checkbox"
                        checked={cat.visible !== false}
                        onChange={() => handleToggleDisplayField(`categories.${catKey}.visible`)}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                    </label>
                  ))}

                  <p className="text-2xs uppercase tracking-wider font-semibold text-muted-cv pt-2 mb-1">
                    Branding Elements
                  </p>
                  {[
                    { key: 'branding.showLogo', label: 'Logo SVG Icon & Text', path: 'branding.showLogo' },
                    { key: 'branding.showSocialLinks', label: 'Social & Community Links', path: 'branding.showSocialLinks' },
                    { key: 'branding.showCopyright', label: 'Copyright & Legal Notice', path: 'branding.showCopyright' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center justify-between p-2 rounded-xl border cursor-pointer hover:bg-hover-cv" style={{ borderColor: 'var(--border)' }}>
                      <span className="font-medium text-primary">{item.label}</span>
                      <input
                        type="checkbox"
                        checked={(siteDisplay as any)[item.path.split('.')[0]][item.path.split('.')[1]]}
                        onChange={() => handleToggleDisplayField(item.path)}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* 7. Individual Tool Visibility & Access Management Table */}
            <div className="rounded-2xl border overflow-hidden shadow-sm space-y-0" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="p-5 border-b flex items-center justify-between gap-4 flex-wrap" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                    <Wrench size={16} className="text-accent" />
                    Individual Tool Visibility &amp; Functional Access Controls
                  </h3>
                  <p className="text-xs text-muted-cv mt-0.5">
                    Separately control public visibility, functional enablement, and access tier for all {TOOLS.length} conversion tools.
                  </p>
                </div>

                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-cv" />
                  <input
                    type="text"
                    value={displaySearch}
                    onChange={(e) => setDisplaySearch(e.target.value)}
                    placeholder="Search tools..."
                    className="input pl-8 h-8 text-xs w-52"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                    <tr>
                      <th className="px-4 py-3 font-semibold text-muted-cv">Tool Name</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv">Category</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv text-center">Visible</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv text-center">Enabled</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv text-center">Access Tier</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv text-center">Featured</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv text-center">Maintenance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {TOOLS
                      .filter((t) => {
                        if (!displaySearch) return true;
                        const q = displaySearch.toLowerCase();
                        return t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q);
                      })
                      .map((tool) => {
                        const toolConfig = siteDisplay.tools[tool.slug] || {
                          name: tool.name,
                          category: tool.category,
                          visible: true,
                          enabled: true,
                          tier: 'free',
                          featured: false,
                          maintenance: false,
                        };

                        const isVisible = toolConfig.visible !== false;
                        const isEnabled = toolConfig.enabled !== false;
                        const isPremium = toolConfig.tier === 'premium';
                        const isFeatured = Boolean(toolConfig.featured);
                        const isMaint = Boolean(toolConfig.maintenance);

                        return (
                          <tr key={tool.slug} className="hover:bg-hover-cv transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-bold text-primary">{tool.name}</p>
                              <code className="text-2xs text-muted-cv">{tool.slug}</code>
                            </td>
                            <td className="px-4 py-3">
                              <span className="badge badge-neutral uppercase text-2xs">{tool.category}</span>
                            </td>
                            {/* Visible Toggle */}
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleUpdateToolDisplay(tool.slug, 'visible', !isVisible)}
                                className={`px-2 py-1 rounded text-2xs font-semibold flex items-center gap-1 mx-auto ${
                                  isVisible ? 'bg-success-500/10 text-success-600' : 'bg-muted text-muted-cv'
                                }`}
                                title={isVisible ? 'Visible in UI' : 'Hidden from UI'}
                              >
                                {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                                {isVisible ? 'Shown' : 'Hidden'}
                              </button>
                            </td>
                            {/* Enabled Toggle */}
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleUpdateToolDisplay(tool.slug, 'enabled', !isEnabled)}
                                className={`px-2 py-1 rounded text-2xs font-semibold mx-auto ${
                                  isEnabled ? 'bg-indigo-500/10 text-indigo-600' : 'bg-error-500/10 text-error-600'
                                }`}
                                title={isEnabled ? 'Tool can be used' : 'Functional execution blocked'}
                              >
                                {isEnabled ? 'Active' : 'Disabled'}
                              </button>
                            </td>
                            {/* Tier Toggle */}
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleUpdateToolDisplay(tool.slug, 'tier', isPremium ? 'free' : 'premium')}
                                className={`px-2 py-1 rounded text-2xs font-bold mx-auto ${
                                  isPremium ? 'badge-brand' : 'badge-neutral'
                                }`}
                              >
                                {isPremium ? '⭐ Premium' : 'Free'}
                              </button>
                            </td>
                            {/* Featured Toggle */}
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleUpdateToolDisplay(tool.slug, 'featured', !isFeatured)}
                                className={`p-1.5 rounded-lg transition-colors mx-auto ${
                                  isFeatured ? 'text-amber-500 bg-amber-500/10' : 'text-muted-cv hover:text-primary'
                                }`}
                                title={isFeatured ? 'Featured on Homepage' : 'Not Featured'}
                              >
                                <Star size={14} className={isFeatured ? 'fill-current' : ''} />
                              </button>
                            </td>
                            {/* Maintenance Toggle */}
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleUpdateToolDisplay(tool.slug, 'maintenance', !isMaint)}
                                className={`px-2 py-1 rounded text-2xs font-semibold mx-auto ${
                                  isMaint ? 'bg-warning-500/10 text-warning-600' : 'text-muted-cv'
                                }`}
                              >
                                {isMaint ? 'Under Maint' : 'Normal'}
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
