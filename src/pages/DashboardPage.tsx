import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Clock, Workflow, Star, Zap,
  ArrowRight, Plus, WifiOff, Cloud, Sparkles, X,
} from 'lucide-react';
import { getPopularTools, CATEGORY_META } from '@/registry/tools';
import type { HistoryItem } from '@/lib/history';

interface SavedWorkflow {
  id: string;
  name: string;
  description: string;
  steps: { id: string; name: string; toolSlug: string; color: string }[];
  lastRun?: string;
  runCount: number;
}

export const DashboardPage: React.FC = () => {
  const favoriteTools = getPopularTools(6);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [workflows, setWorkflows] = useState<SavedWorkflow[]>([]);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try {
      return localStorage.getItem('conveter_hide_onboarding') !== 'true';
    } catch {
      return true;
    }
  });

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try {
      localStorage.setItem('conveter_hide_onboarding', 'true');
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    try {
      const savedHistory: HistoryItem[] = JSON.parse(localStorage.getItem('conveter_history') ?? '[]');
      setHistory(savedHistory);
    } catch {
      setHistory([]);
    }

    try {
      const savedWfs: SavedWorkflow[] = JSON.parse(localStorage.getItem('conveter_workflows') ?? '[]');
      setWorkflows(savedWfs);
    } catch {
      setWorkflows([]);
    }
  }, []);

  const offlineCount = history.filter((h) => h.processingType === 'local').length;
  const cloudCount = history.filter((h) => h.processingType === 'cloud').length;
  const totalCount = history.length;

  const todayStr = new Date().toLocaleDateString();
  const todayCount = history.filter((h) => {
    try {
      return new Date(h.date).toLocaleDateString() === todayStr;
    } catch {
      return false;
    }
  }).length;

  const statCards = [
    { label: 'Files Processed', value: String(totalCount), change: `${todayCount} today`, icon: <FileText size={18} />, color: '#5b6af8' },
    { label: 'Saved Workflows', value: String(workflows.length), change: 'Custom pipelines', icon: <Workflow size={18} />, color: '#10b981' },
    { label: 'Offline Operations', value: String(offlineCount), change: totalCount > 0 ? `${Math.round((offlineCount / totalCount) * 100)}% of total` : '0%', icon: <WifiOff size={18} />, color: '#22c55e' },
    { label: 'Cloud Operations', value: String(cloudCount), change: totalCount > 0 ? `${Math.round((cloudCount / totalCount) * 100)}% of total` : '0%', icon: <Cloud size={18} />, color: '#3b82f6' },
  ];

  return (
    <div className="pt-20 pb-16" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="container-app">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
            <p className="text-sm text-muted-cv mt-1">Real-time overview of your conversions and tools.</p>
          </div>
          <Link to="/tools" className="btn-primary btn-md gap-2">
            <Plus size={16} />
            New Conversion
          </Link>
        </div>

        {/* First-time onboarding card */}
        {showOnboarding && (
          <div
            className="mb-8 p-5 rounded-2xl border relative animate-slide-down"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              background: 'linear-gradient(135deg, var(--card) 0%, var(--surface) 100%)',
            }}
          >
            <button
              onClick={dismissOnboarding}
              className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-hover-cv text-muted-cv hover:text-primary transition-colors"
              aria-label="Dismiss quick start guide"
            >
              <X size={15} />
            </button>

            <div className="flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-accent flex-shrink-0"
                style={{ backgroundColor: 'var(--accent-subtle)' }}
              >
                <Sparkles size={20} />
              </div>
              <div className="flex-1 pr-6">
                <h3 className="text-base font-bold text-primary mb-1">
                  Welcome to CONVETER · Quick Start &amp; Privacy Guide
                </h3>
                <p className="text-xs text-muted-cv mb-4 max-w-2xl">
                  CONVETER is built with privacy-first principles. Here is how your files are handled:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 rounded-xl border bg-surface-cv" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-primary">
                      <WifiOff size={14} className="text-success-600" />
                      <span>1. Private &amp; Local</span>
                    </div>
                    <p className="text-2xs text-muted-cv leading-relaxed">
                      Most tools run 100% locally in your browser. Your files never leave your device and are never uploaded to any cloud server.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl border bg-surface-cv" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-primary">
                      <FileText size={14} className="text-accent" />
                      <span>2. 17 Essential Tools</span>
                    </div>
                    <p className="text-2xs text-muted-cv leading-relaxed">
                      Convert PDFs, images, data formats, and archives with instant drag-and-drop processing and zero queues.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl border bg-surface-cv" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-primary">
                      <Cloud size={14} style={{ color: '#3b82f6' }} />
                      <span>3. 100% Client-Side</span>
                    </div>
                    <p className="text-2xs text-muted-cv leading-relaxed">
                      All retained tools run entirely in your browser using WebAssembly and standard web standards.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <Link to="/tools" className="btn-primary btn-sm gap-1.5">
                    Browse All Tools <ArrowRight size={12} />
                  </Link>
                  <button onClick={dismissOnboarding} className="btn-ghost btn-sm text-xs text-muted-cv">
                    Got it, dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="p-4 rounded-xl border"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-8 h-8 flex items-center justify-center rounded-lg"
                  style={{ backgroundColor: card.color + '15', color: card.color }}
                >
                  {card.icon}
                </div>
              </div>
              <div className="text-2xl font-bold font-num text-primary">{card.value}</div>
              <div className="text-xs text-muted-cv mt-1">{card.label}</div>
              <div className="text-xs mt-0.5" style={{ color: card.color }}>{card.change}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent files */}
          <div
            className="lg:col-span-2 rounded-xl border flex flex-col"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Clock size={16} style={{ color: 'var(--text-muted)' }} />
                <h2 className="text-sm font-semibold text-primary">Recent Conversions</h2>
              </div>
              <Link to="/history" className="text-xs text-accent hover:underline">View all</Link>
            </div>
            {history.length === 0 ? (
              <div className="p-8 text-center flex-1 flex flex-col items-center justify-center gap-3">
                <FileText size={32} style={{ color: 'var(--text-disabled)' }} />
                <p className="text-sm font-medium text-primary">No conversions yet</p>
                <p className="text-xs text-muted-cv max-w-sm">
                  Run any of the 17 tools in CONVETER to see your processed files and results here.
                </p>
                <Link to="/tools" className="btn-primary btn-sm mt-2">
                  Explore Tools
                </Link>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {history.slice(0, 5).map((file) => {
                  const meta = CATEGORY_META[file.category as keyof typeof CATEGORY_META] || { color: '#5b6af8' };
                  return (
                    <div key={file.id} className="flex items-center gap-3 px-5 py-3">
                      <div
                        className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                        style={{ backgroundColor: meta.color + '15', color: meta.color }}
                      >
                        <FileText size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link to={`/tool/${file.toolSlug}`} className="text-sm font-medium text-primary hover:underline truncate block">
                          {file.fileName}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-cv">{file.toolName}</span>
                          <span className="text-xs text-muted-cv">·</span>
                          <span className="text-xs text-muted-cv">{file.size}</span>
                          {file.resultSize && (
                            <>
                              <span className="text-xs text-muted-cv">→</span>
                              <span className="text-xs font-medium text-success-600">{file.resultSize}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-cv">{file.date}</span>
                        <span
                          className={`w-2 h-2 rounded-full inline-block ${file.status === 'completed' ? 'bg-success-500' : 'bg-red-500'}`}
                          title={file.status}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Workflows */}
            <div
              className="rounded-xl border"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <Workflow size={16} style={{ color: 'var(--text-muted)' }} />
                  <h2 className="text-sm font-semibold text-primary">Saved Workflows</h2>
                </div>
                <Link to="/workflows" className="text-xs text-accent hover:underline">Manage</Link>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {workflows.length === 0 ? (
                  <div className="p-4 text-center">
                    <p className="text-xs text-muted-cv">No custom workflows saved yet.</p>
                  </div>
                ) : (
                  workflows.slice(0, 3).map((wf) => (
                    <div key={wf.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-xs font-medium text-primary">{wf.name}</p>
                        <p className="text-xs text-muted-cv mt-0.5">{wf.steps.length} steps · {wf.lastRun || 'Not run yet'}</p>
                      </div>
                      <Link to="/workflows" className="btn-ghost btn-sm">
                        <ArrowRight size={12} />
                      </Link>
                    </div>
                  ))
                )}
                <div className="px-5 py-3">
                  <Link to="/workflows" className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--accent)' }}>
                    <Plus size={12} />
                    {workflows.length === 0 ? 'Create first workflow' : 'Create workflow'}
                  </Link>
                </div>
              </div>
            </div>

            {/* Favorite tools */}
            <div
              className="rounded-xl border"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <Star size={16} style={{ color: 'var(--text-muted)' }} />
                <h2 className="text-sm font-semibold text-primary">Quick Access</h2>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2">
                {favoriteTools.map((tool) => {
                  const meta = CATEGORY_META[tool.category];
                  return (
                    <Link
                      key={tool.id}
                      to={`/tool/${tool.slug}`}
                      className="flex items-center gap-2 p-2 rounded-lg transition-all duration-150"
                      style={{ backgroundColor: 'var(--muted)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = meta.color + '12';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--muted)';
                      }}
                    >
                      <div
                        className="w-6 h-6 flex items-center justify-center rounded-md flex-shrink-0"
                        style={{ backgroundColor: meta.color + '20', color: meta.color }}
                      >
                        <span className="text-xs font-bold">{tool.name[0]}</span>
                      </div>
                      <span className="text-xs font-medium text-primary truncate">{tool.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Plan status card */}
            <div
              className="p-4 rounded-xl border"
              style={{
                background: 'linear-gradient(135deg, var(--accent-subtle) 0%, var(--card) 100%)',
                borderColor: 'var(--accent)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Zap size={14} style={{ color: '#f59e0b' }} />
                <span className="text-xs font-semibold" style={{ color: '#f59e0b' }}>Free Plan</span>
              </div>
              <p className="text-xs text-secondary mb-3">
                Upgrade to Premium for larger files, AI tools, and batch processing.
              </p>
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-muted-cv mb-1">
                  <span>Daily conversions</span>
                  <span>{todayCount} / 5 used today</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(100, (todayCount / 5) * 100)}%`, backgroundColor: '#f59e0b' }}
                  />
                </div>
              </div>
              <Link to="/pricing" className="btn-primary btn-sm w-full justify-center" style={{ backgroundColor: 'var(--accent)' }}>
                Upgrade to Premium
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
