// ============================================================
// CONVETER — Premium Admin Dashboard (Section 8)
// Comprehensive administrative console:
// - Real-time conversion metrics & tool usage analytics
// - Filterable jobs ledger (status, tool, search)
// - In-depth job inspection modal with timeline & comment thread
// - Telegram Bot live notification controls & connection tester
// - Audit logs
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Shield, Activity, Users, FileCheck, Send, RefreshCw,
  Search, Plus, Eye, Bell,
} from 'lucide-react';
import { TOOLS } from '@/registry/tools';
import { apiClient, ApiJob, ApiStats, ApiAdminComment, ApiAuditLog, NotificationSettings } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/ToastContext';

export const AdminPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const [stats, setStats] = useState<ApiStats | null>(null);
  const [jobs, setJobs] = useState<ApiJob[]>([]);
  const [auditLogs, setAuditLogs] = useState<ApiAuditLog[]>([]);
  const [telegramSettings, setTelegramSettings] = useState<NotificationSettings | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<{ configured: boolean; hasToken: boolean; hasChatId: boolean } | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [toolFilter, setToolFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'jobs' | 'telegram' | 'audit'>('jobs');

  // Job Detail Modal State
  const [selectedJob, setSelectedJob] = useState<ApiJob | null>(null);
  const [jobComments, setJobComments] = useState<ApiAdminComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load initial data
  const loadAdminData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsRes, jobsRes, logsRes, settingsRes, healthRes] = await Promise.all([
        apiClient.getAdminStats(),
        apiClient.getAdminJobs({ status: statusFilter, tool: toolFilter, search: searchQuery }),
        apiClient.getAdminAuditLogs(),
        apiClient.getTelegramSettings(),
        apiClient.getHealth(),
      ]);

      if (statsRes) setStats(statsRes);
      if (jobsRes) setJobs(jobsRes);
      if (logsRes) setAuditLogs(logsRes);
      if (settingsRes) setTelegramSettings(settingsRes);
      if (healthRes?.telegram) setTelegramStatus(healthRes.telegram);
    } catch {
      toast.error('Failed to load admin data');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, toolFilter, searchQuery, toast]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  // Open specific job if in query param ?job=ID
  useEffect(() => {
    const jobParam = searchParams.get('job');
    if (jobParam) {
      apiClient.getJob(jobParam).then((res) => {
        if (res?.job) {
          setSelectedJob(res.job);
          setJobComments(res.comments || []);
        }
      });
    }
  }, [searchParams]);

  // Open job detail
  const handleOpenJob = async (job: ApiJob) => {
    setSelectedJob(job);
    const res = await apiClient.getJob(job.id);
    if (res?.comments) {
      setJobComments(res.comments);
    }
  };

  // Submit comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob || !newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const comment = await apiClient.addComment(selectedJob.id, newComment.trim(), 'Admin (Dashboard)');
      if (comment) {
        setJobComments((prev) => [...prev, comment]);
        setNewComment('');
        toast.success('Comment added to job');
      }
    } catch {
      toast.error('Could not save comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Toggle notification settings
  const handleToggleSetting = async (key: keyof NotificationSettings) => {
    if (!telegramSettings) return;
    const updated = { ...telegramSettings, [key]: !telegramSettings[key] };
    setTelegramSettings(updated);
    try {
      await apiClient.updateTelegramSettings(updated);
      toast.success('Notification settings updated');
    } catch {
      toast.error('Failed to update settings');
    }
  };

  // Test Telegram Bot
  const handleTestTelegram = async () => {
    try {
      const res = await apiClient.testTelegramAlert();
      if (res?.ok) {
        toast.success('Telegram test alert sent successfully!');
      } else {
        toast.warning('Telegram bot alert triggered (check bot token or chat ID)');
      }
    } catch {
      toast.error('Failed to test Telegram integration');
    }
  };

  return (
    <div className="pt-20 pb-20 min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="container-app space-y-8">
        {/* ── Admin Header ───────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-brand text-xs font-semibold flex items-center gap-1">
                <Shield size={12} /> SYSTEM CONSOLE
              </span>
              <span className="text-2xs text-muted-cv">v1.0.0 Production</span>
            </div>
            <h1 className="text-2xl font-extrabold text-primary tracking-tight">Admin Dashboard</h1>
            <p className="text-xs text-secondary mt-0.5">
              Live observability, Telegram notification controls, and conversion job audit.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAdminData}
              disabled={isLoading}
              className="btn-secondary btn-sm gap-1.5"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={handleTestTelegram}
              className="btn-primary btn-sm gap-1.5"
            >
              <Send size={13} />
              Test Telegram Bot
            </button>
          </div>
        </div>

        {/* ── KPI Grid ───────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between text-muted-cv mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Conversions</span>
              <Activity size={16} className="text-indigo-500" />
            </div>
            <p className="text-2xl font-bold text-primary font-num">{stats?.totalJobs ?? jobs.length}</p>
            <p className="text-2xs text-muted-cv mt-1">Platform aggregate</p>
          </div>

          <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between text-muted-cv mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Success Rate</span>
              <FileCheck size={16} className="text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-primary font-num">{stats?.successRate ?? 100}%</p>
            <p className="text-2xs text-emerald-500 mt-1">{stats?.completedJobs ?? 0} successful</p>
          </div>

          <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between text-muted-cv mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Registered Users</span>
              <Users size={16} className="text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-primary font-num">{stats?.totalUsers ?? 1}</p>
            <p className="text-2xs text-muted-cv mt-1">Active platform accounts</p>
          </div>

          <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between text-muted-cv mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Telegram Status</span>
              <Bell size={16} className="text-purple-500" />
            </div>
            <p className="text-sm font-bold text-primary mt-1 flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  telegramStatus?.hasToken ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              {telegramStatus?.hasToken ? 'Connected' : 'Mock Mode'}
            </p>
            <p className="text-2xs text-muted-cv mt-1">Webhook &amp; Alerts Active</p>
          </div>
        </div>

        {/* ── Navigation Tabs ────────────────────────────── */}
        <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('jobs')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'jobs' ? 'bg-primary text-white shadow-sm' : 'text-muted-cv hover:text-primary'
            }`}
            style={activeTab === 'jobs' ? { backgroundColor: 'var(--accent)', color: '#ffffff' } : {}}
          >
            Conversion Jobs ({jobs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('telegram')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'telegram' ? 'bg-primary text-white shadow-sm' : 'text-muted-cv hover:text-primary'
            }`}
            style={activeTab === 'telegram' ? { backgroundColor: 'var(--accent)', color: '#ffffff' } : {}}
          >
            Telegram Bot Settings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'audit' ? 'bg-primary text-white shadow-sm' : 'text-muted-cv hover:text-primary'
            }`}
            style={activeTab === 'audit' ? { backgroundColor: 'var(--accent)', color: '#ffffff' } : {}}
          >
            Audit Log ({auditLogs.length})
          </button>
        </div>

        {/* ── TAB 1: Jobs Table ──────────────────────────── */}
        {activeTab === 'jobs' && (
          <div className="space-y-4">
            {/* Filters bar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-cv" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by ID, file, user..."
                    className="input pl-8 h-9 text-xs w-48 sm:w-64"
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
                    <option key={t.slug} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-xs text-muted-cv font-num">
                Showing {jobs.length} jobs
              </span>
            </div>

            {/* Table */}
            <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                    <tr>
                      <th className="px-4 py-3 font-semibold text-muted-cv">Job ID</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv">Tool</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv">User</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv">Input File</th>
                      <th className="px-4 py-3 font-semibold text-muted-cv">Output File</th>
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
                          No conversion jobs match the selected criteria.
                        </td>
                      </tr>
                    ) : (
                      jobs.map((job) => (
                        <tr key={job.id} className="hover:bg-hover-cv transition-colors">
                          <td className="px-4 py-3 font-mono font-medium text-primary">
                            <code>{job.id}</code>
                          </td>
                          <td className="px-4 py-3 font-semibold text-primary">
                            {job.toolName}
                          </td>
                          <td className="px-4 py-3 text-secondary">
                            {job.userName || 'Anonymous'}
                          </td>
                          <td className="px-4 py-3 text-muted-cv truncate max-w-[150px]">
                            {job.inputFileName}
                          </td>
                          <td className="px-4 py-3 text-muted-cv truncate max-w-[150px]">
                            {job.outputFileName || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`badge text-2xs uppercase tracking-wider font-semibold ${
                                job.status === 'completed'
                                  ? 'badge-success'
                                  : job.status === 'failed'
                                  ? 'badge-error'
                                  : 'badge-neutral'
                              }`}
                            >
                              {job.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-num text-muted-cv">
                            {((job.durationMs || 0) / 1000).toFixed(1)}s
                          </td>
                          <td className="px-4 py-3 text-2xs text-muted-cv font-num">
                            {new Date(job.createdAt).toLocaleString()}
                          </td>
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

        {/* ── TAB 2: Telegram Settings ───────────────────── */}
        {activeTab === 'telegram' && (
          <div className="max-w-3xl space-y-6">
            <div className="p-6 rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <h2 className="text-base font-bold text-primary mb-1">Telegram Bot Notification Configuration</h2>
              <p className="text-xs text-muted-cv mb-6">
                Toggle which system events trigger real-time alerts to the administrator chat ID.
              </p>

              {telegramSettings ? (
                <div className="space-y-4 divide-y" style={{ borderColor: 'var(--border)' }}>
                  {[
                    { key: 'notify_new_user', label: 'New User Registration', desc: 'Alert when a new visitor or registered user joins the platform' },
                    { key: 'notify_conversion_started', label: 'Conversion Started', desc: 'Alert immediately when a client launches a file conversion' },
                    { key: 'notify_conversion_completed', label: 'Conversion Completed', desc: 'Alert with full metadata, output size, and duration upon completion' },
                    { key: 'notify_conversion_failed', label: 'Failed Conversion', desc: 'Alert when file processing errors occur' },
                    { key: 'notify_daily_summary', label: 'Daily Analytics Digest', desc: 'Summary of daily conversions and tool usage' },
                  ].map((item) => (
                    <div key={item.key} className="pt-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-primary">{item.label}</p>
                        <p className="text-xs text-muted-cv">{item.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleSetting(item.key as keyof NotificationSettings)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          telegramSettings[item.key as keyof NotificationSettings]
                            ? 'bg-success-500'
                            : 'bg-muted-cv'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                            telegramSettings[item.key as keyof NotificationSettings]
                              ? 'right-1'
                              : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-muted-cv">Loading settings...</div>
              )}
            </div>

            {/* Telegram Command Guide Card */}
            <div className="p-6 rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-bold text-primary mb-2">Telegram Two-Way Commands</h3>
              <p className="text-xs text-muted-cv mb-4">
                Administrators can reply directly to job alerts or send commands in Telegram:
              </p>
              <div className="space-y-2 text-xs font-mono">
                <div className="p-2 rounded bg-surface border" style={{ borderColor: 'var(--border)' }}>
                  <code className="text-accent font-bold">/status &lt;JOB-ID&gt;</code> — Look up live job status
                </div>
                <div className="p-2 rounded bg-surface border" style={{ borderColor: 'var(--border)' }}>
                  <code className="text-accent font-bold">/comment &lt;JOB-ID&gt; &lt;text&gt;</code> — Record an audit comment
                </div>
                <div className="p-2 rounded bg-surface border" style={{ borderColor: 'var(--border)' }}>
                  <code className="text-accent font-bold">/stats</code> — Retrieve live platform metrics
                </div>
                <div className="p-2 rounded bg-surface border" style={{ borderColor: 'var(--border)' }}>
                  <code className="text-accent font-bold">/recent</code> — View the 5 most recent conversion jobs
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: Audit Logs ──────────────────────────── */}
        {activeTab === 'audit' && (
          <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-bold text-primary">System Audit Log</h2>
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

        {/* ── Job Details Modal ──────────────────────────── */}
        <Modal
          isOpen={Boolean(selectedJob)}
          onClose={() => setSelectedJob(null)}
          title={`Job Inspection: ${selectedJob?.id}`}
          subtitle={`Initiated ${selectedJob ? new Date(selectedJob.createdAt).toLocaleString() : ''}`}
        >
          {selectedJob && (
            <div className="space-y-6">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl border bg-hover-cv/30" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <span className="text-2xs text-muted-cv uppercase font-semibold">Tool</span>
                  <p className="text-xs font-bold text-primary mt-0.5">{selectedJob.toolName}</p>
                </div>
                <div>
                  <span className="text-2xs text-muted-cv uppercase font-semibold">Status</span>
                  <p className="text-xs font-bold capitalize mt-0.5 text-emerald-500">{selectedJob.status}</p>
                </div>
                <div>
                  <span className="text-2xs text-muted-cv uppercase font-semibold">Input File</span>
                  <p className="text-xs text-primary mt-0.5 truncate">{selectedJob.inputFileName}</p>
                </div>
                <div>
                  <span className="text-2xs text-muted-cv uppercase font-semibold">Output File</span>
                  <p className="text-xs text-primary mt-0.5 truncate">{selectedJob.outputFileName || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-2xs text-muted-cv uppercase font-semibold">User</span>
                  <p className="text-xs text-primary mt-0.5">{selectedJob.userName || 'Anonymous'}</p>
                </div>
                <div>
                  <span className="text-2xs text-muted-cv uppercase font-semibold">Duration</span>
                  <p className="text-xs font-num text-primary mt-0.5">{((selectedJob.durationMs || 0) / 1000).toFixed(2)}s</p>
                </div>
              </div>

              {/* Comments Thread (Telegram & Web) */}
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

                {/* Add Comment Form */}
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
      </div>
    </div>
  );
};
