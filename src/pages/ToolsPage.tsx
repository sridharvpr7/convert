import React, { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Search, Grid3X3, LayoutList, Star, ArrowRight,
  Layers, WifiOff, Cloud, X,
} from 'lucide-react';
import {
  TOOLS, CATEGORY_META, getToolsByCategory, ToolCategory, Tool,
  searchTools,
} from '@/registry/tools';
import { useAppStore } from '@/store/app.store';

interface ToolCardProps {
  tool: Tool;
  view: 'grid' | 'list';
}

const ToolCard: React.FC<ToolCardProps> = ({ tool, view }) => {
  const { isFavoriteTool, toggleFavoriteTool } = useAppStore();
  const meta = CATEGORY_META[tool.category];
  const isFav = isFavoriteTool(tool.slug);

  if (view === 'list') {
    return (
      <div
        className="group flex items-center gap-4 p-4 rounded-xl border transition-all duration-150"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = meta.color + '50';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
      >
        <div
          className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ backgroundColor: meta.color + '15', color: meta.color }}
        >
          <span className="text-lg">{meta.id[0].toUpperCase()}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-primary">{tool.name}</span>
            <span
              className="badge text-2xs"
              style={{ backgroundColor: meta.color + '15', color: meta.color, fontSize: '10px' }}
            >
              {meta.name.replace(' Tools', '')}
            </span>
            {tool.premium && (
              <span className="badge text-2xs" style={{ backgroundColor: '#f59e0b15', color: '#f59e0b', fontSize: '10px' }}>
                Pro
              </span>
            )}
            {tool.new && (
              <span className="badge text-2xs" style={{ backgroundColor: meta.color + '15', color: meta.color, fontSize: '10px' }}>
                New
              </span>
            )}
          </div>
          <p className="text-xs text-muted-cv truncate">{tool.description}</p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {tool.offlineSupported && (
            <span className="flex items-center gap-1 text-xs text-muted-cv">
              <WifiOff size={12} />
              Offline
            </span>
          )}
          {tool.batchSupported && (
            <span className="flex items-center gap-1 text-xs text-muted-cv">
              <Layers size={12} />
              Batch
            </span>
          )}
          <button
            onClick={(e) => {
              e.preventDefault();
              toggleFavoriteTool(tool.slug);
            }}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-hover-cv transition-colors"
          >
            <Star
              size={13}
              className={isFav ? 'fill-current text-warning-500' : 'text-muted-cv'}
            />
          </button>
          <Link
            to={`/tool/${tool.slug}`}
            className="btn-primary btn-sm"
          >
            Use
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group relative flex flex-col gap-3 p-4 rounded-xl border transition-all duration-200"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = meta.color + '50';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 4px 16px ${meta.color}15`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div
          className="w-9 h-9 flex items-center justify-center rounded-lg"
          style={{ backgroundColor: meta.color + '15', color: meta.color }}
        >
          <span className="text-sm font-bold">{tool.name[0]}</span>
        </div>
        <div className="flex items-center gap-1">
          {tool.new && (
            <span className="badge" style={{ backgroundColor: meta.color + '15', color: meta.color, fontSize: '10px' }}>New</span>
          )}
          {tool.premium && (
            <span className="badge" style={{ backgroundColor: '#f59e0b15', color: '#f59e0b', fontSize: '10px' }}>Pro</span>
          )}
          <button
            onClick={(e) => {
              e.preventDefault();
              toggleFavoriteTool(tool.slug);
            }}
            className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Star size={13} className={isFav ? 'fill-current text-warning-500' : 'text-muted-cv'} />
          </button>
        </div>
      </div>

      {/* Info */}
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">{tool.name}</h3>
        <p className="text-xs text-muted-cv leading-relaxed line-clamp-2">{tool.description}</p>
      </div>

      {/* Formats */}
      {(tool.supportedInputFormats?.length || tool.supportedOutputFormats?.length) && (
        <div className="flex flex-wrap gap-1">
          {[...(tool.supportedInputFormats || []), ...(tool.supportedOutputFormats || [])]
            .filter((v, i, a) => a.indexOf(v) === i)
            .slice(0, 5)
            .map((fmt) => (
              <span
                key={fmt}
                className="text-2xs px-1.5 py-0.5 rounded font-mono uppercase"
                style={{ backgroundColor: 'var(--muted)', color: 'var(--text-muted)', fontSize: '10px' }}
              >
                {fmt}
              </span>
            ))}
        </div>
      )}

      {/* Footer */}
      <div
        className="flex items-center justify-between pt-2 border-t mt-auto"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          {tool.offlineSupported ? (
            <span className="flex items-center gap-1 text-2xs font-medium text-success-600">
              <span className="w-1.5 h-1.5 rounded-full bg-success-500 inline-block" />
              Private (Local)
            </span>
          ) : (
            <span className="flex items-center gap-1 text-2xs text-muted-cv">
              <Cloud size={10} />
              Backend
            </span>
          )}
          {tool.batchSupported && (
            <span className="flex items-center gap-1 text-2xs text-muted-cv">
              <Layers size={10} />
              Batch
            </span>
          )}
        </div>
        <Link
          to={`/tool/${tool.slug}`}
          className="flex items-center gap-1 text-xs font-semibold transition-colors"
          style={{ color: meta.color }}
        >
          Open
          <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────
// All Tools Page
// ────────────────────────────────────────────────
export const ToolsPage: React.FC = () => {
  const { category } = useParams<{ category?: string }>();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filterPremium, setFilterPremium] = useState<'all' | 'free' | 'premium'>('all');
  const [filterOffline, setFilterOffline] = useState(false);

  const activeCategory = category as ToolCategory | undefined;
  const categoryMeta = activeCategory ? CATEGORY_META[activeCategory] : null;

  const allTools = useMemo(() => {
    let result = activeCategory ? getToolsByCategory(activeCategory) : TOOLS;
    if (query) result = result.filter((t) => searchTools(query).some((r) => r.id === t.id));
    if (filterPremium === 'free') result = result.filter((t) => !t.premium);
    if (filterPremium === 'premium') result = result.filter((t) => t.premium);
    if (filterOffline) result = result.filter((t) => t.offlineSupported);
    return result;
  }, [activeCategory, query, filterPremium, filterOffline]);

  const categories = Object.values(CATEGORY_META);

  return (
    <div className="pt-20 pb-16">
      {/* Page header */}
      <div
        className="border-b mb-8"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="container-app py-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              {categoryMeta ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="badge"
                      style={{ backgroundColor: categoryMeta.color + '15', color: categoryMeta.color }}
                    >
                      {categoryMeta.name}
                    </span>
                  </div>
                  <h1 className="text-3xl font-bold mb-2">{categoryMeta.name}</h1>
                  <p className="text-secondary">{categoryMeta.description}</p>
                </>
              ) : (
                <>
                  <h1 className="text-3xl font-bold mb-2">All Tools</h1>
                  <p className="text-secondary">
                    {TOOLS.length}+ professional tools for file conversion, editing, and analysis
                  </p>
                </>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 flex-wrap">
              {[
                { label: 'Tools', value: allTools.length },
                { label: 'Free', value: allTools.filter((t) => !t.premium).length },
                { label: 'Offline', value: allTools.filter((t) => t.offlineSupported).length },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-xl font-bold text-accent">{s.value}</div>
                  <div className="text-xs text-muted-cv">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="container-app flex gap-6">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col gap-3 w-52 flex-shrink-0">
          <p className="text-label">Categories</p>
          <nav className="space-y-0.5">
            <Link
              to="/tools"
              className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                !activeCategory ? 'bg-accent-subtle text-accent font-medium' : 'text-secondary hover:bg-hover-cv hover:text-primary'
              }`}
            >
              <span>All Tools</span>
              <span className="text-xs text-muted-cv">{TOOLS.length}</span>
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/tools/${cat.id}`}
                className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                  activeCategory === cat.id
                    ? 'font-medium'
                    : 'text-secondary hover:bg-hover-cv hover:text-primary'
                }`}
                style={
                  activeCategory === cat.id
                    ? { backgroundColor: cat.color + '15', color: cat.color }
                    : {}
                }
              >
                <span>{cat.name.replace(' Tools', '')}</span>
                <span className="text-xs text-muted-cv">
                  {getToolsByCategory(cat.id).length}
                </span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Mobile Category Chips (Horizontal Scrollable) */}
          <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-3 mb-4 scrollbar-none">
            <Link
              to="/tools"
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border flex-shrink-0 ${
                !activeCategory ? 'bg-accent text-white border-accent' : 'bg-surface-cv text-secondary border-cv hover:border-accent'
              }`}
            >
              All Tools ({TOOLS.length})
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/tools/${cat.id}`}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border flex-shrink-0 ${
                  activeCategory === cat.id
                    ? 'text-white border-transparent'
                    : 'bg-surface-cv text-secondary border-cv hover:border-accent'
                }`}
                style={
                  activeCategory === cat.id
                    ? { backgroundColor: cat.color, borderColor: cat.color }
                    : {}
                }
              >
                {cat.name.replace(' Tools', '')} ({getToolsByCategory(cat.id).length})
              </Link>
            ))}
          </div>

          {/* Filters & search bar */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            {/* Search */}
            <div
              className="flex items-center gap-2 flex-1 min-w-56 h-10 px-3.5 rounded-xl border focus-within:border-accent transition-colors"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tools by name, format, or task..."
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: 'var(--text-primary)' }}
                aria-label="Filter tools"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-hover-cv text-muted-cv hover:text-primary transition-colors"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Premium filter */}
            <div
              className="flex items-center rounded-xl border overflow-hidden flex-shrink-0"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}
            >
              {(['all', 'free', 'premium'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setFilterPremium(opt)}
                  className={`px-3.5 h-10 text-xs font-semibold capitalize transition-all ${
                    filterPremium === opt
                      ? 'bg-card-cv text-primary shadow-cv-sm'
                      : 'text-muted-cv hover:text-primary'
                  }`}
                  aria-pressed={filterPremium === opt}
                >
                  {opt === 'all' ? 'All Plans' : opt === 'free' ? 'Free Only' : 'Pro'}
                </button>
              ))}
            </div>

            {/* Offline filter */}
            <button
              onClick={() => setFilterOffline(!filterOffline)}
              className={`flex items-center gap-1.5 h-10 px-3.5 rounded-xl border text-xs font-semibold transition-all duration-150 flex-shrink-0 ${
                filterOffline ? 'text-success-600' : 'text-muted-cv'
              }`}
              style={{
                borderColor: filterOffline ? '#22c55e50' : 'var(--border)',
                backgroundColor: filterOffline ? '#22c55e10' : 'var(--surface)',
              }}
              aria-pressed={filterOffline}
            >
              <WifiOff size={13} />
              100% Private (Local)
            </button>

            {/* View toggle */}
            <div
              className="flex items-center rounded-xl border overflow-hidden flex-shrink-0"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}
            >
              <button
                onClick={() => setView('grid')}
                className={`w-10 h-10 flex items-center justify-center transition-all ${
                  view === 'grid' ? 'bg-card-cv text-primary shadow-cv-sm' : 'text-muted-cv hover:text-primary'
                }`}
                aria-label="Grid view"
                aria-pressed={view === 'grid'}
              >
                <Grid3X3 size={15} />
              </button>
              <button
                onClick={() => setView('list')}
                className={`w-10 h-10 flex items-center justify-center transition-all ${
                  view === 'list' ? 'bg-card-cv text-primary shadow-cv-sm' : 'text-muted-cv hover:text-primary'
                }`}
                aria-label="List view"
                aria-pressed={view === 'list'}
              >
                <LayoutList size={15} />
              </button>
            </div>
          </div>

          {/* Results count & active filter summary */}
          <div className="flex items-center justify-between text-xs text-muted-cv mb-4">
            <p>
              Showing <span className="font-semibold text-primary">{allTools.length}</span> of {TOOLS.length} tools
              {query && <span> for &ldquo;{query}&rdquo;</span>}
              {filterOffline && <span> · Offline only</span>}
              {filterPremium !== 'all' && <span> · {filterPremium} plan</span>}
            </p>
            {(query || filterOffline || filterPremium !== 'all') && (
              <button
                onClick={() => {
                  setQuery('');
                  setFilterPremium('all');
                  setFilterOffline(false);
                }}
                className="text-xs text-accent hover:underline font-medium"
              >
                Reset filters
              </button>
            )}
          </div>

          {/* Tools grid/list */}
          {allTools.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 rounded-2xl border text-center gap-4"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--muted)', color: 'var(--text-disabled)' }}>
                <Search size={26} />
              </div>
              <div className="max-w-md">
                <p className="font-bold text-primary text-base">No matching tools found</p>
                <p className="text-xs text-muted-cv mt-1">
                  We couldn&rsquo;t find anything matching &ldquo;{query}&rdquo; with your current filters. Try one of these popular tools:
                </p>
              </div>

              {/* Quick suggestions */}
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {[
                  { name: 'Compress PDF', slug: 'compress-pdf' },
                  { name: 'Merge PDF', slug: 'merge-pdf' },
                  { name: 'Image Converter', slug: 'image-converter' },
                  { name: 'Excel to JSON', slug: 'excel-to-json' },
                  { name: 'QR Code Generator', slug: 'qr-code-generator' },
                ].map((s) => (
                  <Link
                    key={s.slug}
                    to={`/tool/${s.slug}`}
                    className="btn-secondary btn-sm gap-1 text-xs"
                  >
                    <span>{s.name}</span>
                    <ArrowRight size={11} />
                  </Link>
                ))}
              </div>

              <button
                onClick={() => {
                  setQuery('');
                  setFilterPremium('all');
                  setFilterOffline(false);
                }}
                className="btn-primary btn-sm mt-2"
              >
                Show All 93 Tools
              </button>
            </div>
          ) : (
            <div
              className={
                view === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                  : 'flex flex-col gap-2.5'
              }
            >
              {allTools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} view={view} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ToolsPage;
