import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  FileText, FileEdit, Image, Video, ArrowLeftRight, Table, Code2,
  GraduationCap, Cpu, ShieldAlert, Sparkles, ScanLine, ArrowRight,
  ArrowLeft, Search, Star, Layers, CheckCircle2, WifiOff, Cloud,
  Grid3X3, LayoutList, ChevronRight, X, Clock,
} from 'lucide-react';
import { getStudioBySlug, getAllStudios, getToolsForStudio, StudioMeta } from '@/registry/studios';
import { CATEGORY_META, Tool } from '@/registry/tools';
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

export const StudioViewPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isFavoriteTool, toggleFavoriteTool, siteDisplayConfig } = useAppStore();

  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filterOffline, setFilterOffline] = useState(false);

  const studio = slug ? getStudioBySlug(slug) : undefined;
  const allStudios = getAllStudios();

  const IconComponent = studio ? STUDIO_ICONS[studio.icon] || Layers : Layers;
  const activeTools = useMemo(() => {
    if (!studio) return [];
    return getToolsForStudio(studio.id);
  }, [studio]);

  const filteredTools = useMemo(() => {
    let list = activeTools;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          t.supportedInputFormats?.some((fmt) => fmt.toLowerCase().includes(q))
      );
    }
    if (filterOffline) {
      list = list.filter((t) => t.offlineSupported);
    }
    return list;
  }, [activeTools, search, filterOffline]);

  if (!studio) {
    return (
      <div className="pt-28 pb-20 min-h-screen container-app text-center">
        <h1 className="text-2xl font-bold text-primary mb-2">Studio Not Found</h1>
        <p className="text-muted-cv mb-6">The requested studio does not exist or has been moved.</p>
        <Link to="/studios" className="btn-primary btn-md">
          Back to All Studios
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-20 min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Studio Header Banner */}
      <div
        className="border-b relative overflow-hidden"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            background: `radial-gradient(circle at top right, ${studio.color} 0%, transparent 60%)`,
          }}
        />

        <div className="container-app py-8 relative">
          {/* Breadcrumb & Navigation */}
          <div className="flex items-center gap-2 text-xs text-muted-cv mb-4">
            <Link to="/studios" className="hover:text-primary transition-colors flex items-center gap-1">
              <ArrowLeft size={12} />
              Studios
            </Link>
            <ChevronRight size={12} />
            <span className="text-primary font-medium">{studio.name}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-cv-md"
                style={{
                  backgroundColor: `${studio.color}20`,
                  color: studio.color,
                  border: `1px solid ${studio.color}40`,
                }}
              >
                <IconComponent size={30} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
                    {studio.name}
                  </h1>
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
                </div>
                <p className="text-sm text-secondary max-w-2xl leading-relaxed">
                  {studio.longDescription}
                </p>
              </div>
            </div>

            {/* Studio Switcher Dropdown / Pill */}
            <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
              <Link to="/studios" className="btn-secondary btn-sm gap-1.5">
                <Layers size={13} />
                All Studios
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container-app mt-8">
        {/* Active Tools Section */}
        {activeTools.length > 0 && (
          <div className="mb-12">
            {/* Search and Filters Bar */}
            <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
              <div
                className="flex items-center gap-2 flex-1 min-w-56 max-w-md h-10 px-3.5 rounded-xl border focus-within:border-accent transition-colors"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <Search size={15} className="text-muted-cv flex-shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${activeTools.length} tools in ${studio.shortName}...`}
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: 'var(--text-primary)' }}
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

              <div className="flex items-center gap-2 flex-wrap">
                {/* Offline Filter */}
                <button
                  onClick={() => setFilterOffline(!filterOffline)}
                  className={`flex items-center gap-1.5 h-10 px-3.5 rounded-xl border text-xs font-semibold transition-all ${
                    filterOffline ? 'text-success-600 border-success-500/30 bg-success-500/10' : 'text-muted-cv border-cv bg-surface-cv'
                  }`}
                >
                  <WifiOff size={13} />
                  100% Private (Local)
                </button>

                {/* View Switcher */}
                <div
                  className="flex items-center rounded-xl border overflow-hidden"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}
                >
                  <button
                    onClick={() => setView('grid')}
                    className={`w-10 h-10 flex items-center justify-center transition-all ${
                      view === 'grid' ? 'bg-card-cv text-primary shadow-cv-sm' : 'text-muted-cv'
                    }`}
                    aria-label="Grid view"
                  >
                    <Grid3X3 size={15} />
                  </button>
                  <button
                    onClick={() => setView('list')}
                    className={`w-10 h-10 flex items-center justify-center transition-all ${
                      view === 'list' ? 'bg-card-cv text-primary shadow-cv-sm' : 'text-muted-cv'
                    }`}
                    aria-label="List view"
                  >
                    <LayoutList size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Tools Listing */}
            {filteredTools.length === 0 ? (
              <div className="py-16 text-center border rounded-2xl bg-card-cv border-cv">
                <Search size={28} className="mx-auto text-muted-cv mb-2" />
                <p className="text-sm font-semibold text-primary">No tools match your query</p>
                <button onClick={() => { setSearch(''); setFilterOffline(false); }} className="btn-secondary btn-sm mt-3">
                  Clear Filters
                </button>
              </div>
            ) : view === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredTools.map((tool) => {
                  const catMeta = CATEGORY_META[tool.category];
                  const isFav = isFavoriteTool(tool.slug);
                  return (
                    <div
                      key={tool.id}
                      className="group relative flex flex-col justify-between p-4 rounded-xl border transition-all duration-200 hover:-translate-y-1 shadow-cv-sm"
                      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = `${catMeta?.color || studio.color}50`;
                        e.currentTarget.style.boxShadow = `0 4px 16px ${catMeta?.color || studio.color}15`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                            style={{
                              backgroundColor: `${catMeta?.color || studio.color}18`,
                              color: catMeta?.color || studio.color,
                            }}
                          >
                            {tool.name[0]}
                          </div>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              toggleFavoriteTool(tool.slug);
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-cv text-muted-cv transition-colors"
                            aria-label="Toggle favorite"
                          >
                            <Star size={14} className={isFav ? 'fill-warning-500 text-warning-500' : ''} />
                          </button>
                        </div>

                        <h3 className="text-sm font-semibold text-primary mb-1 group-hover:text-accent transition-colors">
                          {tool.name}
                        </h3>
                        <p className="text-xs text-muted-cv line-clamp-2 leading-relaxed mb-3">
                          {tool.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                        <span className="text-2xs font-medium text-success-600 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-success-500" />
                          Local
                        </span>
                        <Link
                          to={`/tool/${tool.slug}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                          style={{ color: catMeta?.color || studio.color }}
                        >
                          Launch
                          <ArrowRight size={12} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTools.map((tool) => {
                  const catMeta = CATEGORY_META[tool.category];
                  const isFav = isFavoriteTool(tool.slug);
                  return (
                    <div
                      key={tool.id}
                      className="flex items-center justify-between p-3.5 rounded-xl border transition-all"
                      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{
                            backgroundColor: `${catMeta?.color || studio.color}18`,
                            color: catMeta?.color || studio.color,
                          }}
                        >
                          {tool.name[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-primary truncate">{tool.name}</span>
                            <span className="text-2xs px-1.5 py-0.5 rounded bg-muted-cv text-muted-cv uppercase font-mono">
                              {catMeta?.name}
                            </span>
                          </div>
                          <p className="text-xs text-muted-cv truncate">{tool.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        <button
                          onClick={() => toggleFavoriteTool(tool.slug)}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-cv text-muted-cv"
                        >
                          <Star size={14} className={isFav ? 'fill-warning-500 text-warning-500' : ''} />
                        </button>
                        <Link to={`/tool/${tool.slug}`} className="btn-primary btn-sm gap-1">
                          Use
                          <ArrowRight size={12} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Roadmap / Planned Tools Section */}
        {studio.plannedTools && studio.plannedTools.length > 0 && (
          <div className="mt-12 p-6 sm:p-8 rounded-2xl border bg-card-cv border-cv shadow-cv-sm">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full mb-1 border bg-accent-subtle text-accent border-accent/20">
                  <Sparkles size={12} />
                  <span>Architecture Expansion Roadmap</span>
                </div>
                <h2 className="text-xl font-bold text-primary">
                  {studio.status === 'active' ? 'Upcoming Studio Enhancements' : `${studio.name} Roadmap`}
                </h2>
                <p className="text-xs text-muted-cv mt-0.5">
                  Scheduled for phased implementation in accordance with the CONVET PULSE expansion specification.
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-lg border bg-surface-cv border-cv text-secondary">
                Target: {studio.plannedTools[0]?.phase || `Phase ${studio.phase}`}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {studio.plannedTools.map((pt) => (
                <div
                  key={pt.name}
                  className="p-4 rounded-xl border flex flex-col justify-between"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-accent">{pt.phase}</span>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: studio.color }} />
                    </div>
                    <h4 className="text-sm font-semibold text-primary mb-1">{pt.name}</h4>
                    <p className="text-xs text-muted-cv leading-relaxed">{pt.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
