// ============================================================
// CONVETER — Premium Dashboard Redesign (Section 2)
// Linear / Vercel SaaS style dashboard with:
// - Personalized welcome & system telemetry
// - Quick Upload section with smart file-type auto-detection
// - Quick action shortcuts for instant conversion
// - Conversion statistics & space saved
// - All 17 tools organized by category with search
// - Recent activity list with status badges & direct actions
// ============================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
  Sparkles, Upload, FileText, Clock, Zap,
  ArrowRight, Plus, WifiOff, ShieldCheck, CheckCircle2,
  Search, ChevronRight,
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
  const [toolSearch, setToolSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [droppedFile, setDroppedFile] = useState<File | null>(null);

  // Load history and stats
  useEffect(() => {
    setHistory(loadHistory());
    apiClient.getAdminStats().then((res) => {
      if (res) setStats(res);
    });
  }, []);

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

  const totalCount = stats?.totalJobs || history.length;
  const successCount = stats?.completedJobs || history.filter((h) => h.status === 'completed').length;
  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;

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
          {/* Subtle gradient glow */}
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
                  <Sparkles size={12} /> CONVETER PRO
                </span>
                <span className="badge badge-success text-xs">
                  <ShieldCheck size={12} /> 100% Client-Side Privacy
                </span>
              </div>
              <h1 className="text-3xl font-extrabold text-primary tracking-tight">
                Welcome back{user?.name ? `, ${user.name}` : ''}
              </h1>
              <p className="text-sm text-secondary mt-1 max-w-xl">
                Convert, compress, and transform your files with blazing fast local processors. Zero uploads, total privacy.
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

        {/* ── 2. Conversion Statistics Strip ───────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between text-muted-cv mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Conversions</span>
              <FileText size={16} className="text-indigo-500" />
            </div>
            <p className="text-2xl font-bold text-primary font-num">{totalCount}</p>
            <p className="text-xs text-muted-cv mt-1">Processed securely</p>
          </div>

          <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between text-muted-cv mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Success Rate</span>
              <CheckCircle2 size={16} className="text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-primary font-num">{successRate}%</p>
            <p className="text-xs text-emerald-500 mt-1">{successCount} completed</p>
          </div>

          <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between text-muted-cv mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Local &amp; Offline</span>
              <WifiOff size={16} className="text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-primary font-num">100%</p>
            <p className="text-xs text-muted-cv mt-1">Zero cloud leaks</p>
          </div>

          <div className="p-5 rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between text-muted-cv mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Tools</span>
              <Zap size={16} className="text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-primary font-num">{TOOLS.length}</p>
            <p className="text-xs text-muted-cv mt-1">5 core categories</p>
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
                    Recommended tool: <span className="font-semibold text-primary">{detectedTool.name}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/tool/${detectedTool.slug}`)}
                  className="btn-primary btn-sm gap-1 text-xs"
                >
                  Open Tool <ArrowRight size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── 4. All Tools Workspace ───────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-primary">Available Conversion Tools</h2>
              <p className="text-xs text-muted-cv mt-0.5">
                Every tool is verified and runs directly in your browser.
              </p>
            </div>

            {/* Search & Category Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-cv" />
                <input
                  type="text"
                  value={toolSearch}
                  onChange={(e) => setToolSearch(e.target.value)}
                  placeholder="Search tools or formats..."
                  className="input pl-8 h-9 text-xs w-48 sm:w-64"
                />
              </div>

              <div className="flex items-center gap-1 p-1 rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                {['all', 'pdf', 'image', 'data', 'utilities', 'archive'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                      selectedCategory === cat ? 'bg-primary text-white shadow-sm' : 'text-muted-cv hover:text-primary'
                    }`}
                    style={selectedCategory === cat ? { backgroundColor: 'var(--accent)', color: '#ffffff' } : {}}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTools.map((tool) => {
              const meta = CATEGORY_META[tool.category];
              return (
                <Link
                  key={tool.id}
                  to={`/tool/${tool.slug}`}
                  className="p-5 rounded-2xl border transition-all duration-200 group hover:border-accent hover:shadow-cv flex flex-col justify-between"
                  style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0"
                        style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
                      >
                        {tool.name[0]}
                      </div>
                      <span
                        className="badge text-2xs uppercase tracking-wider font-semibold"
                        style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
                      >
                        {meta.name.replace(' Tools', '')}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-primary group-hover:text-accent transition-colors">
                      {tool.name}
                    </h3>
                    <p className="text-xs text-muted-cv mt-1 line-clamp-2 leading-relaxed">
                      {tool.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t flex items-center justify-between text-2xs text-muted-cv" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {tool.supportedInputFormats?.slice(0, 3).map((fmt) => (
                        <span key={fmt} className="px-1.5 py-0.5 rounded border uppercase font-mono" style={{ borderColor: 'var(--border)' }}>
                          {fmt}
                        </span>
                      ))}
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
              <h2 className="text-base font-bold text-primary">Recent Conversions</h2>
              <p className="text-xs text-muted-cv mt-0.5">Your most recent local processing tasks</p>
            </div>
            <Link to="/history" className="text-xs text-accent hover:underline flex items-center gap-1 font-semibold">
              View all <ChevronRight size={13} />
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
