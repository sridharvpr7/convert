// ============================================================
// CONVETER — Premium Dashboard (Section 2)
// SaaS style dashboard with:
// - Real metrics & analytics with date range filters
// - Personalized welcome & system telemetry
// - Quick Upload section with smart file-type auto-detection
// - All 17 tools organized by category with search
// - Recent activity list with status badges & direct actions
// ============================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
  Sparkles, Upload, FileText, Clock, Zap,
  ArrowRight, Plus, WifiOff, ShieldCheck, CheckCircle2,
  Search, ChevronRight, RefreshCw, BarChart2, Calendar,
} from 'lucide-react';
import { TOOLS, CATEGORY_META, ToolCategory } from '@/registry/tools';
import { HistoryItem, loadHistory } from '@/lib/history';
import { apiClient, ApiStats } from '@/lib/api';
import { useAppStore } from '@/store/app.store';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAppStore();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [timeRange, setTimeRange] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toolSearch, setToolSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [droppedFile, setDroppedFile] = useState<File | null>(null);

  const fetchStats = useCallback(async (range: string) => {
    setIsRefreshing(true);
    try {
      const res = await apiClient.getAdminStats(range);
      if (res) setStats(res);
    } catch {
      // offline / mock fallback
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Load history and stats
  useEffect(() => {
    setHistory(loadHistory());
    fetchStats(timeRange);
  }, [fetchStats, timeRange]);

  // Smart tool detector based on dropped file extension
  const detectedTool = useMemo(() => {
    if (!droppedFile) return null;
    const ext = droppedFile.name.split('.').pop()?.toLowerCase() || '';

    // Match file extension to the best tool
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

  // Filter tools by search and category
  const filteredTools = useMemo(() => {
    return TOOLS.filter((t) => {
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
  }, [selectedCategory, toolSearch]);

  // Quick shortcuts
  const shortcuts = [
    { name: 'Merge PDFs', slug: 'merge-pdf', category: 'pdf', icon: 'FileText' },
    { name: 'Compress Image', slug: 'image-compressor', category: 'image', icon: 'Image' },
    { name: 'CSV to Excel', slug: 'csv-to-excel', category: 'data', icon: 'Table' },
    { name: 'QR Generator', slug: 'qr-generator', category: 'utilities', icon: 'Wrench' },
    { name: 'Extract ZIP', slug: 'zip-extractor', category: 'archive', icon: 'Archive' },
  ];

  // Genuine Statistics Calculations according to exact rules:
  // - Files Processed = Actual completed processing jobs
  // - Success Rate = (Successful / (Successful + Failed)) * 100
  // - Avg Processing Time = Total duration / Completed jobs
  // Display 0 when no data
  const totalCompleted = stats?.completedJobs ?? history.filter((h) => h.status === 'completed').length;
  const totalFailed = stats?.failedJobs ?? history.filter((h) => h.status === 'failed').length;
  const finishedTotal = totalCompleted + totalFailed;
  const calculatedSuccessRate = finishedTotal > 0 ? Math.round((totalCompleted / finishedTotal) * 100) : 0;
  const avgDurationSec = stats?.avgProcessingTimeMs ? (stats.avgProcessingTimeMs / 1000).toFixed(1) : '0.0';

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
              </div>
              <h1 className="text-3xl font-extrabold text-primary tracking-tight">
                Welcome back{user?.name ? `, ${user.name}` : ''}
              </h1>
              <p className="text-sm text-secondary mt-1 max-w-xl">
                Convert, compress, and transform files locally with genuine privacy. Real metrics, reliable tools, zero tracking.
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
        </div>

        {/* ── 2. Real Analytics Controls & Statistics Strip ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <BarChart2 size={16} className="text-accent" />
              <h2 className="text-sm font-bold text-primary">Live Platform Analytics</h2>
              <span className="text-2xs text-muted-cv font-medium">(Verified completed jobs)</span>
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
                onClick={() => fetchStats(timeRange)}
                disabled={isRefreshing}
                className="btn-ghost btn-sm text-xs gap-1"
                title="Refresh Analytics"
              >
                <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between text-muted-cv mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Completed Jobs</span>
                <FileText size={16} className="text-indigo-500" />
              </div>
              <p className="text-2xl font-bold text-primary font-num">{totalCompleted}</p>
              <p className="text-xs text-muted-cv mt-1">
                {stats?.todayCount !== undefined ? `${stats.todayCount} today · ${stats.weekCount} this week` : 'Genuine conversions'}
              </p>
            </div>

            <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between text-muted-cv mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Success Rate</span>
                <CheckCircle2 size={16} className="text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-primary font-num">{calculatedSuccessRate}%</p>
              <p className="text-xs text-emerald-500 mt-1">
                {totalCompleted} completed / {totalFailed} failed
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
                <span className="text-xs font-semibold uppercase tracking-wider">Active Tools</span>
                <Zap size={16} className="text-purple-500" />
              </div>
              <p className="text-2xl font-bold text-primary font-num">{TOOLS.length}</p>
              <p className="text-xs text-muted-cv mt-1">100% Client-side ready</p>
            </div>
          </div>
        </div>

        {/* ── 3. Quick Upload Dropzone on Dashboard ─────────── */}
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

        {/* ── 4. Conversion Tools Grid ──────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-primary tracking-tight">Conversion Tools</h2>
              <p className="text-xs text-muted-cv mt-0.5">Choose from all 17 private conversion tools</p>
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
                {Object.values(CATEGORY_META).map((cat) => (
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
                      <span className="badge text-2xs uppercase tracking-wider" style={{ backgroundColor: `${meta.color}15`, color: meta.color }}>
                        {meta.name.replace(' Tools', '')}
                      </span>
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
      </div>
    </div>
  );
};
