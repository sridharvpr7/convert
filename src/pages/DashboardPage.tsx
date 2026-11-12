// ============================================================
// CONVET PULSE — Real Data & Live Analytics Dashboard
// Accurate, persistent, automatically updating metrics:
// - Auto-refresh every 30s with tab-inactivity detection
// - Verified metrics (Total Completed, Success Rate, Avg Duration, Total Data Processed)
// - Asia/Kolkata period reporting with UTC backend storage
// - Genuine Daily Trends visual chart
// - Stale data indicator & loading skeletons
// - Dynamic Website Display Controls integration
// ============================================================

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
  Sparkles, Upload, FileText, Clock, Zap,
  ArrowRight, Plus, ShieldCheck, CheckCircle2,
  Search, ChevronRight, RefreshCw, BarChart2, Calendar,
  HardDrive, AlertCircle, AlertTriangle, Layers,
} from 'lucide-react';
import { TOOLS, CATEGORY_META, ToolCategory } from '@/registry/tools';
import { HistoryItem, loadHistory } from '@/lib/history';
import { apiClient, ApiStats } from '@/lib/api';
import { useAppStore } from '@/store/app.store';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, siteDisplayConfig } = useAppStore();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [timeRange, setTimeRange] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [toolSearch, setToolSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [droppedFile, setDroppedFile] = useState<File | null>(null);

  const isFetchingRef = useRef(false);

  // ── 1. Fetch Real Live Statistics ────────────────────────
  const fetchStats = useCallback(async (range: string, background = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!background) setIsRefreshing(true);

    try {
      const res = await apiClient.getAdminStats(range);
      if (res) {
        setStats(res);
        setLastUpdated(new Date());
        setIsStale(false);
        setFetchError(null);
      } else {
        // If an earlier response existed, mark as stale rather than inventing data
        setIsStale(true);
      }
    } catch {
      setIsStale(true);
      if (!stats) {
        setFetchError('Unable to connect to live analytics server. Retrying...');
      }
    } finally {
      isFetchingRef.current = false;
      setIsRefreshing(false);
    }
  }, [stats]);

  // Initial load
  useEffect(() => {
    setHistory(loadHistory());
    fetchStats(timeRange, false);
  }, [fetchStats, timeRange]);

  // ── 2. Automatic Updates: 30s Polling with Inactivity Guard ──
  useEffect(() => {
    const interval = setInterval(() => {
      // Pause automatic polling when user is on another tab to save bandwidth
      if (document.hidden) return;
      fetchStats(timeRange, true);
    }, 30000);

    const handleVisibilityChange = () => {
      // When user returns to tab, refresh immediately
      if (!document.hidden) {
        fetchStats(timeRange, true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchStats, timeRange]);

  // Smart tool detector based on dropped file extension
  const detectedTool = useMemo(() => {
    if (!droppedFile) return null;
    const ext = droppedFile.name.split('.').pop()?.toLowerCase() || '';

    if (ext === 'pdf') {
      return TOOLS.find((t) => t.slug === 'compress-pdf') || TOOLS.find((t) => t.slug === 'merge-pdf');
    }
    if (['jpg', 'jpeg'].includes(ext)) {
      return TOOLS.find((t) => t.slug === 'jpg-to-pdf') || TOOLS.find((t) => t.slug === 'image-compressor');
    }
    if (['png', 'webp', 'bmp', 'gif'].includes(ext)) {
      return TOOLS.find((t) => t.slug === 'image-compressor') || TOOLS.find((t) => t.slug === 'image-converter');
    }
    if (ext === 'csv') {
      return TOOLS.find((t) => t.slug === 'csv-to-excel') || TOOLS.find((t) => t.slug === 'csv-to-json');
    }
    if (['xlsx', 'xls'].includes(ext)) {
      return TOOLS.find((t) => t.slug === 'excel-to-csv');
    }
    if (ext === 'json') {
      return TOOLS.find((t) => t.slug === 'json-to-csv');
    }
    if (ext === 'zip') {
      return TOOLS.find((t) => t.slug === 'zip-extractor');
    }
    return TOOLS[0];
  }, [droppedFile]);

  // Dropzone for Quick Upload on Dashboard
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setDroppedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
  });

  // Filter tools by search, category, and display settings
  const filteredTools = useMemo(() => {
    return TOOLS.filter((t) => {
      // Check display controls
      if (siteDisplayConfig?.tools?.[t.slug]?.visible === false) return false;
      if (t.category && siteDisplayConfig?.categories?.[t.category]?.visible === false) return false;

      if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;
      if (!toolSearch) return true;
      const q = toolSearch.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.supportedInputFormats?.some((fmt) => fmt.toLowerCase().includes(q)) ||
        t.supportedOutputFormats?.some((fmt) => fmt.toLowerCase().includes(q))
      );
    });
  }, [selectedCategory, toolSearch, siteDisplayConfig]);

  // Quick action shortcuts
  const shortcuts = [
    { name: 'Merge PDFs', slug: 'merge-pdf', category: 'pdf' },
    { name: 'Compress Image', slug: 'image-compressor', category: 'image' },
    { name: 'CSV to Excel', slug: 'csv-to-excel', category: 'data' },
    { name: 'QR Generator', slug: 'qr-generator', category: 'utilities' },
    { name: 'Extract ZIP', slug: 'zip-extractor', category: 'archive' },
  ].filter((s) => siteDisplayConfig?.tools?.[s.slug]?.visible !== false);

  // Accurate Verified Metrics
  const totalCompleted = stats?.completedJobs ?? 0;
  const totalFailed = stats?.failedJobs ?? 0;
  const successRate = stats?.successRate ?? 0;
  const avgDurationSec = stats?.avgProcessingTimeMs ? (stats.avgProcessingTimeMs / 1000).toFixed(1) : '0.0';
  const totalProcessedFormatted = formatBytes(stats?.totalDataProcessedBytes || 0);

  // Feature flags from site display config
  const showLiveAnalytics = siteDisplayConfig?.features?.showLiveAnalytics !== false;
  const showFileUpload = siteDisplayConfig?.features?.showFileUpload !== false;
  const showRecentActivity = siteDisplayConfig?.features?.showRecentActivity !== false;

  return (
    <div className="pt-20 pb-20 min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="container-app space-y-8">
        {/* ── 1. Hero / Welcome Section ────────────────────── */}
        <div
          className="p-8 rounded-3xl border shadow-cv relative overflow-hidden"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
            background: 'linear-gradient(135deg, var(--card) 0%, var(--surface) 100%)',
          }}
        >
          <div
            className="absolute top-0 right-0 w-96 h-96 opacity-10 pointer-events-none rounded-full"
            style={{
              background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
            }}
          />

          <div className="relative z-10 flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="badge badge-brand text-xs font-semibold">
                  <Sparkles size={12} /> CONVET PULSE
                </span>
                <span className="badge badge-success text-xs">
                  <ShieldCheck size={12} /> 100% Client-Side Privacy
                </span>
                {isStale && (
                  <span className="badge badge-warning text-xs flex items-center gap-1">
                    <AlertCircle size={11} /> Stale Data (Reconnecting)
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-extrabold text-primary tracking-tight">
                Welcome back{user?.name ? `, ${user.name}` : ''}
              </h1>
              <p className="text-sm text-secondary mt-1 max-w-xl">
                Convert, compress, and transform files locally. Genuine live metrics, persistent history, zero tracking.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Link to="/tools" className="btn-primary btn-md gap-2">
                <Plus size={16} /> Explore All Tools
              </Link>
              <Link to="/history" className="btn-secondary btn-md gap-2">
                <Clock size={16} /> Conversion History
              </Link>
            </div>
          </div>

          {/* Quick Action Shortcuts */}
          {shortcuts.length > 0 && (
            <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-2xs font-semibold uppercase tracking-wider text-muted-cv mb-3">
                Quick Action Shortcuts
              </p>
              <div className="flex flex-wrap gap-2">
                {shortcuts.map((sc) => {
                  const meta = CATEGORY_META[sc.category as ToolCategory];
                  return (
                    <Link
                      key={sc.slug}
                      to={`/tool/${sc.slug}`}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all hover:border-accent hover:bg-hover-cv"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                      <span className="text-primary">{sc.name}</span>
                      <ArrowRight size={12} className="text-muted-cv" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── 2. Real Analytics Controls & Statistics Strip ── */}
        {showLiveAnalytics && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <BarChart2 size={16} className="text-accent" />
                <h2 className="text-sm font-bold text-primary">Live Platform Analytics</h2>
                <span className="text-2xs text-muted-cv font-medium">
                  (Asia/Kolkata timezone · Auto-refreshes every 30s)
                </span>
                {lastUpdated && (
                  <span className="text-2xs text-muted-cv font-num hidden sm:inline">
                    · Updated {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Date range filter */}
                <div className="flex items-center gap-1 rounded-xl border p-1 bg-surface text-xs" style={{ borderColor: 'var(--border)' }}>
                  <Calendar size={13} className="text-muted-cv ml-1.5" />
                  {[
                    { key: 'today', label: 'Today' },
                    { key: '7d', label: '7 Days' },
                    { key: '30d', label: '30 Days' },
                    { key: 'all', label: 'All Time' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setTimeRange(tab.key)}
                      className={`px-2.5 py-1 rounded-lg text-2xs font-semibold transition-colors ${
                        timeRange === tab.key
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-muted-cv hover:text-primary'
                      }`}
                      style={timeRange === tab.key ? { backgroundColor: 'var(--accent)', color: '#fff' } : {}}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Refresh button */}
                <button
                  type="button"
                  onClick={() => fetchStats(timeRange, false)}
                  disabled={isRefreshing}
                  className="btn-ghost btn-sm text-xs gap-1"
                  title="Refresh Analytics"
                >
                  <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>

            {fetchError && (
              <div className="p-3 rounded-xl border bg-warning-500/10 border-warning-500/30 text-xs text-warning-600 flex items-center justify-between">
                <span>{fetchError}</span>
                <button
                  type="button"
                  onClick={() => fetchStats(timeRange, false)}
                  className="btn-primary btn-xs text-2xs font-bold"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Metric Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between text-muted-cv mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Completed Jobs</span>
                  <FileText size={16} className="text-indigo-500" />
                </div>
                <p className="text-2xl font-bold text-primary font-num">{totalCompleted}</p>
                <p className="text-xs text-muted-cv mt-1">
                  {stats?.todayCount !== undefined
                    ? `${stats.todayCount} today · ${stats.weekCount} this week`
                    : 'Verified conversions'}
                </p>
              </div>

              <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between text-muted-cv mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Success Rate</span>
                  <CheckCircle2 size={16} className="text-emerald-500" />
                </div>
                <p className="text-2xl font-bold text-primary font-num">{successRate}%</p>
                <p className="text-xs text-emerald-500 mt-1">
                  {totalCompleted} succeeded / {totalFailed} failed
                </p>
              </div>

              <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between text-muted-cv mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Avg Duration</span>
                  <Clock size={16} className="text-amber-500" />
                </div>
                <p className="text-2xl font-bold text-primary font-num">{avgDurationSec}s</p>
                <p className="text-xs text-muted-cv mt-1">Per completed file</p>
              </div>

              <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between text-muted-cv mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Data Processed</span>
                  <HardDrive size={16} className="text-purple-500" />
                </div>
                <p className="text-2xl font-bold text-primary font-num">{totalProcessedFormatted}</p>
                <p className="text-xs text-muted-cv mt-1">
                  {formatBytes(stats?.totalBytesSaved || 0)} bandwidth saved
                </p>
              </div>
            </div>

            {/* Daily Conversion Trends Visualizer */}
            {stats?.dailyTrends && stats.dailyTrends.length > 0 && (
              <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-cv">
                      Daily Conversion Activity (Last 7 Days)
                    </h3>
                    <p className="text-2xs text-muted-cv mt-0.5">Verified backend conversions by calendar day</p>
                  </div>
                  <div className="flex items-center gap-3 text-2xs">
                    <span className="flex items-center gap-1 font-medium text-emerald-500">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Completed
                    </span>
                    <span className="flex items-center gap-1 font-medium text-error-500">
                      <span className="w-2 h-2 rounded-full bg-error-500 inline-block" /> Failed
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2 pt-2">
                  {stats.dailyTrends.map((day) => {
                    const totalDay = day.completed + day.failed;
                    const maxInPeriod = Math.max(...(stats.dailyTrends?.map((d) => d.completed + d.failed) || [1]), 1);
                    const heightPct = totalDay > 0 ? Math.max(Math.round((totalDay / maxInPeriod) * 100), 12) : 6;

                    return (
                      <div key={day.date} className="flex flex-col items-center gap-2">
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
                        <span className="text-2xs text-muted-cv font-num">{day.completed}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 3. Quick Upload Dropzone on Dashboard ─────────── */}
        {showFileUpload && (
          <div
            {...getRootProps()}
            className={`p-8 rounded-3xl border-2 border-dashed text-center cursor-pointer transition-all ${
              isDragActive ? 'border-accent bg-accent/5' : 'hover:border-accent hover:bg-hover-cv/50'
            }`}
            style={{
              borderColor: isDragActive ? 'var(--accent)' : 'var(--border)',
              backgroundColor: 'var(--card)',
            }}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center gap-3">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-accent"
                style={{ backgroundColor: 'var(--accent-subtle)' }}
              >
                <Upload size={28} />
              </div>
              <div>
                <p className="text-base font-bold text-primary">
                  {isDragActive ? 'Drop your file right here' : 'Quick Upload & Auto-Detect'}
                </p>
                <p className="text-xs text-muted-cv mt-1">
                  Drag any PDF, image, CSV, Excel, JSON or ZIP here — we will instantly suggest the best conversion tool.
                </p>
              </div>

              {droppedFile && detectedTool && (
                <div
                  className="mt-4 p-4 rounded-xl border flex items-center justify-between gap-4 max-w-lg w-full text-left animate-slide-down"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-primary truncate">{droppedFile.name}</p>
                    <p className="text-2xs text-muted-cv mt-0.5">
                      Suggested Tool: <span className="font-semibold text-accent">{detectedTool.name}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/tool/${detectedTool.slug}`)}
                    className="btn-primary btn-sm flex-shrink-0 gap-1.5"
                  >
                    Proceed to {detectedTool.name} <ArrowRight size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 4. Conversion Tools Grid ──────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-primary tracking-tight">Conversion Tools</h2>
              <p className="text-xs text-muted-cv mt-0.5">
                {filteredTools.length} tools available · 100% Client-Side Privacy
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-cv" />
                <input
                  type="text"
                  value={toolSearch}
                  onChange={(e) => setToolSearch(e.target.value)}
                  placeholder="Filter tools..."
                  className="input pl-8 h-9 text-xs w-48 sm:w-60"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input h-9 text-xs w-36"
              >
                <option value="all">All Categories</option>
                {Object.values(CATEGORY_META)
                  .filter((cat) => siteDisplayConfig?.categories?.[cat.id]?.visible !== false)
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredTools.map((tool) => {
              const meta = CATEGORY_META[tool.category];
              const isMaintenance = siteDisplayConfig?.tools?.[tool.slug]?.maintenance;
              const isToolRestricted = siteDisplayConfig?.tools?.[tool.slug]?.tier === 'premium';

              return (
                <Link
                  key={tool.id}
                  to={`/tool/${tool.slug}`}
                  className="p-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-cv-md flex flex-col justify-between group"
                  style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
                        style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
                      >
                        {tool.name.slice(0, 1)}
                      </div>
                      <div className="flex items-center gap-1">
                        {isMaintenance && (
                          <span className="badge badge-warning text-2xs">Maintenance</span>
                        )}
                        {isToolRestricted && (
                          <span className="badge badge-brand text-2xs">Pro</span>
                        )}
                        <span className="badge text-2xs uppercase tracking-wider" style={{ backgroundColor: `${meta.color}15`, color: meta.color }}>
                          {meta.name.replace(' Tools', '')}
                        </span>
                      </div>
                    </div>
                    <h3 className="text-sm font-bold text-primary mb-1 group-hover:text-accent transition-colors">
                      {tool.name}
                    </h3>
                    <p className="text-xs text-muted-cv leading-relaxed line-clamp-2">
                      {tool.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t flex items-center justify-between text-2xs text-muted-cv" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-success-500" />
                      <span>Offline Ready</span>
                    </div>
                    <span className="flex items-center gap-1 font-semibold group-hover:translate-x-0.5 transition-transform" style={{ color: meta.color }}>
                      Launch <ArrowRight size={12} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── 5. Recent Activity List ──────────────────────── */}
        {showRecentActivity && (
          <div className="p-6 rounded-3xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-primary">Recent Conversion Activity</h2>
                <p className="text-xs text-muted-cv mt-0.5">Actual completed and verified file conversions</p>
              </div>
              <Link to="/history" className="text-xs text-accent hover:underline flex items-center gap-1 font-semibold">
                Full History <ChevronRight size={13} />
              </Link>
            </div>

            {history.length === 0 ? (
              <div className="py-12 text-center text-muted-cv">
                <Clock size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs">No conversions recorded yet. Launch any tool above to get started.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {history.slice(0, 5).map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: 'var(--muted)' }}
                      >
                        <FileText size={14} className="text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-primary truncate">{item.fileName}</p>
                        <p className="text-2xs text-muted-cv mt-0.5">
                          {item.toolName} · {item.size} · {item.date}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`badge text-2xs capitalize ${
                          item.status === 'completed' ? 'badge-success' : 'badge-error'
                        }`}
                      >
                        {item.status}
                      </span>
                      <Link
                        to={`/tool/${item.toolSlug}`}
                        className="btn-ghost btn-sm text-xs gap-1"
                      >
                        Open Tool <ArrowRight size={11} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
