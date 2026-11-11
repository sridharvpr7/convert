import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Search, Zap } from 'lucide-react';
import { useAppStore } from '@/store/app.store';
import { getPopularTools, CATEGORY_META } from '@/registry/tools';

export const NotFoundPage: React.FC = () => {
  const { setSearchOpen } = useAppStore();
  const popular = getPopularTools(4);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-20 pt-32"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      {/* 404 visual */}
      <div className="relative mb-8">
        <div
          className="text-[160px] font-black leading-none select-none"
          style={{
            background: 'linear-gradient(135deg, var(--accent) 0%, rgba(90,106,248,0.15) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1,
          }}
        >
          404
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none"
          style={{ fontSize: '160px', lineHeight: 1 }}
          aria-hidden
        >
          <Zap size={80} style={{ color: 'var(--accent)' }} />
        </div>
      </div>

      <h1 className="text-3xl font-bold text-primary mb-3 text-center">
        Page not found
      </h1>
      <p className="text-secondary text-center max-w-md mb-8">
        The page you're looking for doesn't exist or has been moved.
        Try searching for what you need.
      </p>

      <div className="flex items-center gap-3 mb-12">
        <Link to="/" className="btn-secondary btn-md gap-2">
          <Home size={15} />
          Go Home
        </Link>
        <button
          onClick={() => setSearchOpen(true)}
          className="btn-primary btn-md gap-2"
        >
          <Search size={15} />
          Search Tools
        </button>
      </div>

      {/* Suggest popular tools */}
      <div className="w-full max-w-lg">
        <p className="text-xs text-center text-muted-cv mb-4 uppercase tracking-widest font-semibold">
          Popular Tools
        </p>
        <div className="grid grid-cols-2 gap-3">
          {popular.map((tool) => {
            const meta = CATEGORY_META[tool.category];
            return (
              <Link
                key={tool.id}
                to={`/tool/${tool.slug}`}
                className="flex items-center gap-3 p-3 rounded-xl border transition-all duration-150"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = meta.color + '60';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                <div
                  className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ backgroundColor: meta.color + '15', color: meta.color }}
                >
                  <span className="text-sm font-bold">{tool.name[0]}</span>
                </div>
                <span className="text-sm font-medium text-primary truncate">{tool.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
