import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText, Image, Table, Archive, Wrench, ChevronRight, TrendingUp,
  Code2, ShieldCheck, Sparkles, ArrowRight,
} from 'lucide-react';
import { CATEGORY_META, getToolsByCategory, ToolCategory } from '@/registry/tools';
import { getAllStudios, getToolsForStudio, StudioMeta } from '@/registry/studios';
import { useAppStore } from '@/store/app.store';

// Category icons map
const CATEGORY_ICONS: Record<ToolCategory, React.ReactNode> = {
  pdf: <FileText size={18} />,
  image: <Image size={18} />,
  data: <Table size={18} />,
  developer: <Code2 size={18} />,
  security: <ShieldCheck size={18} />,
  utilities: <Wrench size={18} />,
  archive: <Archive size={18} />,
};

const CATEGORIES = Object.keys(CATEGORY_META) as ToolCategory[];

export const MegaMenu: React.FC = () => {
  const { megaMenuOpen, megaMenuCategory, setMegaMenuOpen } = useAppStore();
  const [mode, setMode] = useState<'categories' | 'studios'>('categories');
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('pdf');
  const [activeStudioId, setActiveStudioId] = useState<string>('pdf-studio');
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const studios = getAllStudios();

  useEffect(() => {
    if (megaMenuOpen && megaMenuCategory) {
      if (megaMenuCategory.includes('studio') || megaMenuCategory === 'universal-converter' || megaMenuCategory === 'ai-workspace') {
        setMode('studios');
        setActiveStudioId(megaMenuCategory);
      } else {
        setMode('categories');
        setActiveCategory(megaMenuCategory as ToolCategory);
      }
    }
  }, [megaMenuOpen, megaMenuCategory]);

  const handleClose = useCallback(() => {
    setMegaMenuOpen(false);
  }, [setMegaMenuOpen]);

  useEffect(() => {
    if (!megaMenuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [megaMenuOpen, handleClose]);

  if (!megaMenuOpen) return null;

  const activeMeta = CATEGORY_META[activeCategory];
  const activeTools = getToolsByCategory(activeCategory).slice(0, 8);

  const activeStudio = studios.find((s) => s.id === activeStudioId) || studios[0];
  const activeStudioTools = getToolsForStudio(activeStudio.id).slice(0, 8);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{
          top: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
          backgroundColor: 'rgba(0,0,0,0.3)',
        }}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Menu panel */}
      <div
        ref={menuRef}
        className="mega-menu animate-slide-down"
        role="dialog"
        aria-label="Tools Menu"
      >
        <div className="container-app flex" style={{ height: '460px' }}>
          {/* Left: mode switcher & navigation */}
          <div
            className="w-60 flex-shrink-0 py-4 pr-4 overflow-y-auto scrollable border-r"
            style={{ borderColor: 'var(--border)' }}
          >
            {/* Mode Switcher */}
            <div
              className="flex rounded-lg border p-0.5 mb-3"
              style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
            >
              <button
                onClick={() => setMode('categories')}
                className={`flex-1 py-1 text-2xs font-semibold rounded-md transition-all ${
                  mode === 'categories'
                    ? 'bg-card-cv text-primary shadow-cv-sm'
                    : 'text-muted-cv hover:text-primary'
                }`}
              >
                Categories (7)
              </button>
              <button
                onClick={() => setMode('studios')}
                className={`flex-1 py-1 text-2xs font-semibold rounded-md transition-all ${
                  mode === 'studios'
                    ? 'bg-card-cv text-primary shadow-cv-sm'
                    : 'text-muted-cv hover:text-primary'
                }`}
              >
                Studios (12)
              </button>
            </div>

            {mode === 'categories' ? (
              <nav className="space-y-0.5">
                {CATEGORIES.map((cat) => {
                  const meta = CATEGORY_META[cat];
                  const isActive = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      onMouseEnter={() => setActiveCategory(cat)}
                      onClick={() => {
                        navigate(`/tools/${cat}`);
                        handleClose();
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-100 text-left ${
                        isActive ? 'bg-accent-subtle text-accent' : 'text-secondary hover:bg-hover-cv hover:text-primary'
                      }`}
                      style={isActive ? { color: meta.color } : {}}
                    >
                      <span
                        className="w-7 h-7 flex items-center justify-center rounded-md flex-shrink-0"
                        style={{
                          backgroundColor: isActive ? `${meta.color}18` : 'transparent',
                          color: isActive ? meta.color : 'var(--text-muted)',
                        }}
                      >
                        {CATEGORY_ICONS[cat]}
                      </span>
                      <span>{meta.name}</span>
                      {isActive && <ChevronRight size={14} className="ml-auto opacity-50" />}
                    </button>
                  );
                })}
              </nav>
            ) : (
              <nav className="space-y-0.5">
                {studios.map((s) => {
                  const isActive = activeStudioId === s.id;
                  return (
                    <button
                      key={s.id}
                      onMouseEnter={() => setActiveStudioId(s.id)}
                      onClick={() => {
                        navigate(`/studios/${s.slug}`);
                        handleClose();
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-100 text-left ${
                        isActive ? 'bg-accent-subtle text-accent' : 'text-secondary hover:bg-hover-cv hover:text-primary'
                      }`}
                      style={isActive ? { color: s.color } : {}}
                    >
                      <span className="truncate">{s.name}</span>
                      <span
                        className="text-[10px] font-mono px-1 py-0.2 rounded"
                        style={{ backgroundColor: `${s.color}15`, color: s.color }}
                      >
                        {s.badge.includes('Active') ? 'Live' : 'P' + s.phase}
                      </span>
                    </button>
                  );
                })}
              </nav>
            )}
          </div>

          {/* Right: tools / details */}
          <div className="flex-1 py-4 pl-6 overflow-y-auto scrollable">
            {mode === 'categories' ? (
              <>
                {/* Category header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ color: activeMeta.color }}>
                        {CATEGORY_ICONS[activeCategory]}
                      </span>
                      <h3 className="text-subtitle font-bold" style={{ color: activeMeta.color }}>
                        {activeMeta.name}
                      </h3>
                    </div>
                    <p className="text-xs text-muted-cv max-w-md">{activeMeta.description}</p>
                  </div>
                  <Link
                    to={`/tools/${activeCategory}`}
                    onClick={handleClose}
                    className="flex items-center gap-1 text-xs font-semibold transition-colors duration-150 flex-shrink-0"
                    style={{ color: activeMeta.color }}
                  >
                    View all ({getToolsByCategory(activeCategory).length})
                    <ChevronRight size={13} />
                  </Link>
                </div>

                {/* Popular indicator */}
                <div className="flex items-center gap-1.5 mb-3">
                  <TrendingUp size={12} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-label">Available Tools</span>
                </div>

                {/* Tools grid */}
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {activeTools.map((tool) => (
                    <Link
                      key={tool.id}
                      to={`/tool/${tool.slug}`}
                      onClick={handleClose}
                      className="group flex flex-col gap-1 p-3 rounded-lg border transition-all duration-150 cursor-pointer"
                      style={{
                        borderColor: 'var(--border)',
                        backgroundColor: 'var(--card)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = activeMeta.color + '50';
                        e.currentTarget.style.backgroundColor = activeMeta.color + '08';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.backgroundColor = 'var(--card)';
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-primary leading-tight">
                          {tool.name}
                        </span>
                        <div className="flex gap-1">
                          {tool.new && (
                            <span
                              className="badge text-2xs"
                              style={{
                                backgroundColor: `${activeMeta.color}15`,
                                color: activeMeta.color,
                                fontSize: '10px',
                                padding: '1px 5px',
                              }}
                            >
                              New
                            </span>
                          )}
                          {tool.premium && (
                            <span
                              className="badge text-2xs"
                              style={{
                                backgroundColor: '#f59e0b15',
                                color: '#f59e0b',
                                fontSize: '10px',
                                padding: '1px 5px',
                              }}
                            >
                              Pro
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-cv leading-snug line-clamp-2">
                        {tool.description}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        {tool.offlineSupported && (
                          <span className="text-2xs text-muted-cv flex items-center gap-1">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: '#22c55e' }}
                            />
                            Offline
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>

                {/* View all link & privacy assurance */}
                <div className="mt-4 pt-3 border-t flex items-center justify-between gap-4 flex-wrap" style={{ borderColor: 'var(--border)' }}>
                  <Link
                    to={`/tools/${activeCategory}`}
                    onClick={handleClose}
                    className="btn-ghost btn-sm inline-flex font-semibold"
                    style={{ color: activeMeta.color }}
                  >
                    Explore all {getToolsByCategory(activeCategory).length} {activeMeta.name}
                    <ChevronRight size={14} />
                  </Link>
                  <div className="flex items-center gap-2 text-2xs text-muted-cv" style={{ fontSize: '11px' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-success-500 inline-block" />
                    <span>Runs privately on your device · Zero file uploads</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Studio header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-subtitle font-bold" style={{ color: activeStudio.color }}>
                        {activeStudio.name}
                      </h3>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                        style={{
                          backgroundColor: activeStudio.status === 'active' ? '#10b98115' : `${activeStudio.color}15`,
                          color: activeStudio.status === 'active' ? '#10b981' : activeStudio.color,
                          borderColor: activeStudio.status === 'active' ? '#10b98130' : `${activeStudio.color}30`,
                        }}
                      >
                        {activeStudio.badge}
                      </span>
                    </div>
                    <p className="text-xs text-muted-cv max-w-md">{activeStudio.description}</p>
                  </div>
                  <Link
                    to={`/studios/${activeStudio.slug}`}
                    onClick={handleClose}
                    className="btn-primary btn-sm inline-flex items-center gap-1 flex-shrink-0"
                  >
                    Open Studio
                    <ArrowRight size={12} />
                  </Link>
                </div>

                {/* Studio Tools Grid or Roadmap */}
                {activeStudioTools.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <TrendingUp size={12} style={{ color: 'var(--text-muted)' }} />
                      <span className="text-label">Active Studio Tools</span>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                      {activeStudioTools.map((tool) => (
                        <Link
                          key={tool.id}
                          to={`/tool/${tool.slug}`}
                          onClick={handleClose}
                          className="group flex flex-col gap-1 p-3 rounded-lg border transition-all duration-150 cursor-pointer"
                          style={{
                            borderColor: 'var(--border)',
                            backgroundColor: 'var(--card)',
                          }}
                        >
                          <span className="text-sm font-medium text-primary leading-tight">
                            {tool.name}
                          </span>
                          <span className="text-xs text-muted-cv leading-snug line-clamp-2">
                            {tool.description}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border bg-card-cv border-cv">
                    <p className="text-xs font-semibold text-accent mb-2">Upcoming Features</p>
                    <div className="grid grid-cols-2 gap-2">
                      {activeStudio.plannedTools?.slice(0, 4).map((pt) => (
                        <div key={pt.name} className="p-2.5 rounded-lg border bg-surface-cv border-cv">
                          <p className="text-xs font-semibold text-primary">{pt.name}</p>
                          <p className="text-[11px] text-muted-cv line-clamp-1">{pt.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                  <Link
                    to="/studios"
                    onClick={handleClose}
                    className="text-xs text-accent font-semibold hover:underline"
                  >
                    Browse all 12 studios
                  </Link>
                  <span className="text-[11px] text-muted-cv">
                    Phase {activeStudio.phase} Architecture
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default MegaMenu;
