import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, ArrowRight, FileText, Image, Table, Archive, Wrench, Star, X,
} from 'lucide-react';
import { searchTools, getPopularTools, Tool, CATEGORY_META, ToolCategory } from '@/registry/tools';
import { useAppStore } from '@/store/app.store';

const CATEGORY_ICON_MAP: Record<ToolCategory, React.ReactNode> = {
  pdf: <FileText size={14} />,
  image: <Image size={14} />,
  data: <Table size={14} />,
  utilities: <Wrench size={14} />,
  archive: <Archive size={14} />,
};

interface SearchResultItem {
  type: 'tool' | 'category' | 'page';
  tool?: Tool;
  label?: string;
  description?: string;
  href?: string;
  icon?: React.ReactNode;
}

export const CommandPalette: React.FC = () => {
  const { searchOpen, searchQuery, setSearchOpen, setSearchQuery, isFavoriteTool } = useAppStore();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Results
  const results: SearchResultItem[] = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return getPopularTools(8).map((tool) => ({
        type: 'tool' as const,
        tool,
      }));
    }
    return searchTools(searchQuery).slice(0, 12).map((tool) => ({
      type: 'tool' as const,
      tool,
    }));
  }, [searchQuery]);

  // Focus input on open
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    }
  }, [searchOpen]);

  // Reset on close
  useEffect(() => {
    if (!searchOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [searchOpen, setSearchQuery]);

  const handleSelect = useCallback(
    (item: SearchResultItem) => {
      if (item.tool) {
        navigate(`/tool/${item.tool.slug}`);
      } else if (item.href) {
        navigate(item.href);
      }
      setSearchOpen(false);
    },
    [navigate, setSearchOpen]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [searchOpen, results, selectedIndex, handleSelect, setSearchOpen]);

  if (!searchOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] animate-fade-in"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={() => setSearchOpen(false)}
        aria-hidden
      />

      {/* Palette */}
      <div
        className="fixed z-[201] top-16 left-1/2 -translate-x-1/2 w-full max-w-2xl rounded-xl border animate-scale-in overflow-hidden"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--shadow-lg)',
        }}
        role="dialog"
        aria-label="Search tools"
        aria-modal="true"
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 h-14 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search all tools... e.g. 'compress pdf', 'jpg to pdf', 'excel to csv'"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
            aria-label="Search tools"
            autoComplete="off"
            spellCheck="false"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-hover-cv transition-colors"
            >
              <X size={14} style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
          <kbd
            className="hidden sm:flex items-center gap-0.5 px-2 py-1 rounded text-2xs font-mono border"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--muted)',
              color: 'var(--text-muted)',
              fontSize: '10px',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Section label */}
        <div className="px-4 py-2.5">
          <p className="text-label">
            {searchQuery ? `${results.length} results` : 'Popular Tools'}
          </p>
        </div>

        {/* Results */}
        <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Search size={32} style={{ color: 'var(--text-disabled)' }} />
              <p className="text-sm text-muted-cv">No tools found for "{searchQuery}"</p>
              <p className="text-xs text-muted-cv">Try: compress, pdf, convert, image...</p>
            </div>
          ) : (
            <ul role="listbox">
              {results.map((item, idx) => {
                const tool = item.tool!;
                const meta = CATEGORY_META[tool.category];
                const isFav = isFavoriteTool(tool.slug);
                return (
                  <li key={tool.id} role="option" aria-selected={idx === selectedIndex}>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-100"
                      style={{
                        backgroundColor:
                          idx === selectedIndex ? 'var(--hover)' : 'transparent',
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => handleSelect(item)}
                    >
                      {/* Category icon */}
                      <span
                        className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                        style={{
                          backgroundColor: `${meta.color}15`,
                          color: meta.color,
                        }}
                      >
                        {CATEGORY_ICON_MAP[tool.category]}
                      </span>

                      {/* Tool info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-primary">
                            {tool.name}
                          </span>
                          <span
                            className="badge text-2xs flex-shrink-0"
                            style={{
                              backgroundColor: `${meta.color}15`,
                              color: meta.color,
                              fontSize: '10px',
                              padding: '1px 6px',
                            }}
                          >
                            {meta.name}
                          </span>
                          {tool.premium && (
                            <span
                              className="badge text-2xs flex-shrink-0"
                              style={{
                                backgroundColor: '#f59e0b15',
                                color: '#f59e0b',
                                fontSize: '10px',
                                padding: '1px 6px',
                              }}
                            >
                              Pro
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-cv truncate mt-0.5">
                          {tool.description}
                        </p>
                      </div>

                      {/* Indicators */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isFav && (
                          <Star size={12} className="text-warning-500 fill-current" />
                        )}
                        {tool.offlineSupported && (
                          <span className="text-2xs text-muted-cv flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-success-500 inline-block" />
                            Local
                          </span>
                        )}
                        <ArrowRight
                          size={14}
                          style={{
                            color:
                              idx === selectedIndex
                                ? 'var(--accent)'
                                : 'var(--text-disabled)',
                          }}
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-4 py-2 border-t"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}
        >
          <div className="flex items-center gap-3 text-2xs" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border" style={{ borderColor: 'var(--border)', fontSize: '10px' }}>↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border" style={{ borderColor: 'var(--border)', fontSize: '10px' }}>↵</kbd>
              Open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border" style={{ borderColor: 'var(--border)', fontSize: '10px' }}>ESC</kbd>
              Close
            </span>
          </div>
          <span className="text-2xs" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            {results.length} tool{results.length !== 1 ? 's' : ''} available
          </span>
        </div>
      </div>
    </>
  );
};

export default CommandPalette;
