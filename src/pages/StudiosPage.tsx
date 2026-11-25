import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, FileEdit, Image, Video, ArrowLeftRight, Table, Code2,
  GraduationCap, Cpu, ShieldAlert, Sparkles, ScanLine, ArrowRight,
  Search, Star, Clock, Layers, CheckCircle2, ChevronRight, X,
} from 'lucide-react';
import { getAllStudios, getToolsForStudio, StudioMeta } from '@/registry/studios';
import { getToolBySlug, CATEGORY_META } from '@/registry/tools';
import { useAppStore } from '@/store/app.store';

const STUDIO_ICONS: Record<string, import("lucide-react").LucideIcon> = {
  FileText,
  FileEdit,
  Image,
  Video,
  ArrowLeftRight,
  Table,
  Code2,
  GraduationCap,
  Cpu,
  ShieldAlert,
  Sparkles,
  ScanLine,
};

export const StudiosPage: React.FC = () => {
  const { recentTools, favoriteTools, isFavoriteTool, toggleFavoriteTool } = useAppStore();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'preview'>('all');

  const studios = getAllStudios();

  const filteredStudios = useMemo(() => {
    return studios.filter((studio) => {
      if (filterStatus === 'active' && studio.status !== 'active') return false;
      if (filterStatus === 'preview' && studio.status !== 'preview') return false;
      if (!search.trim()) return true;

      const q = search.toLowerCase().trim();
      return (
        studio.name.toLowerCase().includes(q) ||
        studio.description.toLowerCase().includes(q) ||
        studio.longDescription.toLowerCase().includes(q) ||
        studio.plannedTools?.some((pt) => pt.name.toLowerCase().includes(q) || pt.description.toLowerCase().includes(q))
      );
    });
  }, [studios, search, filterStatus]);

  const recentToolItems = useMemo(() => {
    return recentTools
      .slice(0, 6)
      .map((slug) => getToolBySlug(slug))
      .filter(Boolean);
  }, [recentTools]);

  const favoriteToolItems = useMemo(() => {
    return favoriteTools
      .slice(0, 6)
      .map((slug) => getToolBySlug(slug))
      .filter(Boolean);
  }, [favoriteTools]);

  return (
    <div className="pt-20 pb-20 min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Hero Header */}
      <div
        className="border-b relative overflow-hidden"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-cyan-500/5 pointer-events-none" />
        <div className="container-app py-10 relative">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide mb-3 border bg-accent-subtle text-accent border-accent/20">
                <Sparkles size={13} />
                <span>Ecosystem Architecture</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary mb-3">
                Productivity Studios
              </h1>
              <p className="text-base text-secondary leading-relaxed">
                Explore 12 dedicated studios engineered for documents, digital engineering, academic workflows, media manipulation, and military-grade client-side encryption.
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
              <div className="p-4 rounded-xl border bg-card-cv border-cv text-center min-w-28 shadow-cv-sm">
                <div className="text-2xl font-bold font-num text-accent">12</div>
                <div className="text-xs text-muted-cv">Studios</div>
              </div>
              <div className="p-4 rounded-xl border bg-card-cv border-cv text-center min-w-28 shadow-cv-sm">
                <div className="text-2xl font-bold font-num text-success-600">42</div>
                <div className="text-xs text-muted-cv">Active Tools</div>
              </div>
              <div className="p-4 rounded-xl border bg-card-cv border-cv text-center min-w-28 shadow-cv-sm">
                <div className="text-2xl font-bold font-num text-primary">100%</div>
                <div className="text-xs text-muted-cv">Client-Side</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container-app mt-8">
        {/* Quick Access Bar: Recents & Favorites */}
        {(recentToolItems.length > 0 || favoriteToolItems.length > 0) && (
          <div className="mb-10 grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentToolItems.length > 0 && (
              <div
                className="p-4 rounded-xl border flex flex-col gap-3 shadow-cv-sm"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                    <Clock size={14} className="text-accent" />
                    <span>Recently Opened</span>
                  </div>
                  <Link to="/history" className="text-xs text-accent hover:underline">
                    View all history
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentToolItems.map((tool) => {
                    if (!tool) return null;
                    const catMeta = CATEGORY_META[tool.category];
                    return (
                      <Link
                        key={tool.id}
                        to={`/tool/${tool.slug}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all hover:-translate-y-0.5"
                        style={{
                          backgroundColor: 'var(--surface)',
                          borderColor: 'var(--border)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: catMeta?.color || '#3b82f6' }} />
                        <span className="truncate max-w-[130px]">{tool.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {favoriteToolItems.length > 0 && (
              <div
                className="p-4 rounded-xl border flex flex-col gap-3 shadow-cv-sm"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                    <Star size={14} className="text-warning-500 fill-warning-500" />
                    <span>Starred Favorites</span>
                  </div>
                  <Link to="/favorites" className="text-xs text-accent hover:underline">
                    Manage favorites
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2">
                  {favoriteToolItems.map((tool) => {
                    if (!tool) return null;
                    const catMeta = CATEGORY_META[tool.category];
                    return (
                      <Link
                        key={tool.id}
                        to={`/tool/${tool.slug}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all hover:-translate-y-0.5"
                        style={{
                          backgroundColor: 'var(--surface)',
                          borderColor: 'var(--border)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: catMeta?.color || '#3b82f6' }} />
                        <span className="truncate max-w-[130px]">{tool.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
          <div
            className="flex items-center gap-2 flex-1 min-w-64 max-w-md h-10 px-3.5 rounded-xl border focus-within:border-accent transition-colors"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <Search size={15} className="text-muted-cv flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search studios by title or capability..."
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--text-primary)' }}
              aria-label="Filter studios"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-hover-cv text-muted-cv"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Status Tabs */}
          <div
            className="flex items-center rounded-xl border p-1"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            {(['all', 'active', 'preview'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterStatus(tab)}
                className={`px-3.5 py-1.5 text-xs font-semibold capitalize rounded-lg transition-all ${
                  filterStatus === tab
                    ? 'bg-accent text-white shadow-cv-sm'
                    : 'text-secondary hover:text-primary hover:bg-hover-cv'
                }`}
              >
                {tab === 'all' ? 'All Studios (12)' : tab === 'active' ? 'Active Now' : 'Roadmap Previews'}
              </button>
            ))}
          </div>
        </div>

        {/* Studios Grid */}
        {filteredStudios.length === 0 ? (
          <div className="py-24 text-center border rounded-2xl bg-card-cv border-cv">
            <Search size={32} className="mx-auto text-muted-cv mb-3" />
            <p className="text-base font-semibold text-primary">No studios match your search</p>
            <p className="text-xs text-muted-cv mt-1">Try clearing filters or search terms</p>
            <button
              onClick={() => { setSearch(''); setFilterStatus('all'); }}
              className="btn-secondary btn-sm mt-4"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStudios.map((studio) => {
              const IconComponent = STUDIO_ICONS[studio.icon] || Layers;
              const activeTools = getToolsForStudio(studio.id);
              return (
                <div
                  key={studio.id}
                  className="group relative rounded-2xl border p-6 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 shadow-cv-sm"
                  style={{
                    backgroundColor: 'var(--card)',
                    borderColor: 'var(--border)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = studio.color + '55';
                    e.currentTarget.style.boxShadow = `0 8px 24px ${studio.color}15`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div>
                    {/* Top Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
                        style={{
                          backgroundColor: `${studio.color}18`,
                          color: studio.color,
                        }}
                      >
                        <IconComponent size={24} />
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
                          style={{
                            backgroundColor: studio.status === 'active' ? '#10b98115' : `${studio.color}15`,
                            color: studio.status === 'active' ? '#10b981' : studio.color,
                            borderColor: studio.status === 'active' ? '#10b98130' : `${studio.color}30`,
                          }}
                        >
                          {studio.badge}
                        </span>
                        <span className="text-[10px] text-muted-cv">
                          {activeTools.length > 0 ? `${activeTools.length} live tools` : 'Roadmap Phase ' + studio.phase}
                        </span>
                      </div>
                    </div>

                    {/* Title & Description */}
                    <h2 className="text-xl font-bold text-primary mb-2 flex items-center gap-1.5">
                      {studio.name}
                    </h2>
                    <p className="text-xs text-secondary leading-relaxed line-clamp-3 mb-4">
                      {studio.description}
                    </p>

                    {/* Mapped Categories or Planned Tools */}
                    {activeTools.length > 0 ? (
                      <div className="mb-6">
                        <p className="text-[11px] font-semibold text-muted-cv uppercase tracking-wider mb-2">
                          Available Tools
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {activeTools.slice(0, 4).map((tool) => (
                            <span
                              key={tool.id}
                              className="text-[11px] px-2 py-0.5 rounded-md border font-medium truncate max-w-[140px]"
                              style={{
                                backgroundColor: 'var(--muted)',
                                borderColor: 'var(--border)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {tool.name}
                            </span>
                          ))}
                          {activeTools.length > 4 && (
                            <span
                              className="text-[11px] px-2 py-0.5 rounded-md font-medium text-accent"
                              style={{ backgroundColor: 'var(--accent-subtle)' }}
                            >
                              +{activeTools.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mb-6">
                        <p className="text-[11px] font-semibold text-muted-cv uppercase tracking-wider mb-2">
                          Key Capabilities
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {studio.plannedTools?.slice(0, 3).map((pt) => (
                            <span
                              key={pt.name}
                              className="text-[11px] px-2 py-0.5 rounded-md border font-medium truncate max-w-[140px]"
                              style={{
                                backgroundColor: 'var(--muted)',
                                borderColor: 'var(--border)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {pt.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer link */}
                  <div
                    className="pt-4 border-t flex items-center justify-between"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <span className="text-xs font-semibold" style={{ color: studio.color }}>
                      {studio.status === 'active' ? 'Enter Studio' : 'Explore Preview'}
                    </span>
                    <Link
                      to={`/studios/${studio.slug}`}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all group-hover:translate-x-1"
                      style={{
                        backgroundColor: `${studio.color}15`,
                        color: studio.color,
                      }}
                      aria-label={`Enter ${studio.name}`}
                    >
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
