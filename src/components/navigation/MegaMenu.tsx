import React, { useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText, Image, Table, Archive, Wrench, ChevronRight, TrendingUp,
  Code2, ShieldCheck,
} from 'lucide-react';
import { CATEGORY_META, getToolsByCategory, ToolCategory } from '@/registry/tools';
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
  const [activeCategory, setActiveCategory] = React.useState<ToolCategory>('pdf');
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (megaMenuOpen && megaMenuCategory) {
      setActiveCategory(megaMenuCategory as ToolCategory);
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

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ top: '57px', backgroundColor: 'rgba(0,0,0,0.3)' }}
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
        <div className="container-app flex" style={{ height: '440px' }}>
          {/* Left: category list */}
          <div
            className="w-56 flex-shrink-0 py-4 pr-4 overflow-y-auto scrollable border-r"
            style={{ borderColor: 'var(--border)' }}
          >
            <p className="text-label mb-3 px-2">All Categories</p>
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
          </div>

          {/* Right: tools for active category */}
          <div className="flex-1 py-4 pl-6 overflow-y-auto scrollable">
            {/* Category header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ color: activeMeta.color }}>
                    {CATEGORY_ICONS[activeCategory]}
                  </span>
                  <h3 className="text-subtitle" style={{ color: activeMeta.color }}>
                    {activeMeta.name}
                  </h3>
                </div>
                <p className="text-xs text-muted-cv max-w-md">{activeMeta.description}</p>
              </div>
              <Link
                to={`/tools/${activeCategory}`}
                onClick={handleClose}
                className="flex items-center gap-1 text-xs font-medium transition-colors duration-150 flex-shrink-0"
                style={{ color: activeMeta.color }}
              >
                View all
                <ChevronRight size={13} />
              </Link>
            </div>

            {/* Popular indicator */}
            <div className="flex items-center gap-1.5 mb-3">
              <TrendingUp size={12} style={{ color: 'var(--text-muted)' }} />
              <span className="text-label">Popular Tools</span>
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
          </div>
        </div>
      </div>
    </>
  );
};

export default MegaMenu;
