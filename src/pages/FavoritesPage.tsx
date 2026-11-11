import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ArrowRight, FileText, Image, Table, Archive, Wrench } from 'lucide-react';
import { useAppStore } from '@/store/app.store';
import { getToolBySlug, CATEGORY_META } from '@/registry/tools';

const getCategoryIcon = (cat: string, size = 16) => {
  const props = { size };
  const m: Record<string, React.ReactNode> = {
    pdf: <FileText {...props} />,
    image: <Image {...props} />,
    data: <Table {...props} />,
    utilities: <Wrench {...props} />,
    archive: <Archive {...props} />,
  };
  return m[cat] ?? <FileText {...props} />;
};

export const FavoritesPage: React.FC = () => {
  const { favoriteTools, toggleFavoriteTool } = useAppStore();
  const tools = favoriteTools.map((slug) => getToolBySlug(slug)).filter(Boolean);

  return (
    <div className="pt-20 pb-16" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="container-app">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-primary">Favorites</h1>
            <p className="text-sm text-muted-cv mt-1">
              {tools.length} saved tool{tools.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link to="/tools" className="btn-secondary btn-md gap-2">
            Browse all tools
            <ArrowRight size={14} />
          </Link>
        </div>

        {tools.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-5">
            <div
              className="w-20 h-20 flex items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--text-disabled)' }}
            >
              <Star size={36} />
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-primary mb-2">No favorites yet</p>
              <p className="text-secondary max-w-sm">
                Star any tool from the tools page or tool workspace to save it here for quick access.
              </p>
            </div>
            <Link to="/tools" className="btn-primary btn-lg">
              Explore Tools
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tools.map((tool) => {
              if (!tool) return null;
              const meta = CATEGORY_META[tool.category];
              return (
                <div
                  key={tool.id}
                  className="group relative flex flex-col gap-3 p-4 rounded-xl border transition-all duration-200"
                  style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = meta.color + '50';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Unfavorite button */}
                  <button
                    onClick={() => toggleFavoriteTool(tool.slug)}
                    className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-hover-cv"
                    title="Remove from favorites"
                  >
                    <Star size={14} className="fill-current text-warning-500" />
                  </button>

                  <div
                    className="w-10 h-10 flex items-center justify-center rounded-xl"
                    style={{ backgroundColor: meta.color + '15', color: meta.color }}
                  >
                    {getCategoryIcon(tool.category, 18)}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-1">{tool.name}</h3>
                    <p className="text-xs text-muted-cv leading-relaxed line-clamp-2">
                      {tool.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-2 border-t"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <span
                      className="badge text-2xs"
                      style={{ backgroundColor: meta.color + '15', color: meta.color, fontSize: '10px' }}
                    >
                      {meta.name.replace(' Tools', '')}
                    </span>
                    <Link
                      to={`/tool/${tool.slug}`}
                      className="flex items-center gap-1 text-xs font-medium"
                      style={{ color: meta.color }}
                    >
                      Use tool
                      <ArrowRight size={12} />
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

export default FavoritesPage;
