import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock, RefreshCw, Trash2, Filter, Search,
  FileText, Image, Table, Archive, Wrench, Info,
} from 'lucide-react';
import { CATEGORY_META } from '@/registry/tools';
import { HistoryItem, loadHistory, saveHistory } from '@/lib/history';

const CATEGORY_FILTERS = ['all', 'pdf', 'image', 'data', 'utilities', 'archive'] as const;

const categoryIcon = (cat: string, size = 14) => {
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

export const HistoryPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    setHistory(loadHistory());
    // Listen for storage changes from other tabs
    const onStorage = () => setHistory(loadHistory());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const filtered = history.filter((h) => {
    if (categoryFilter !== 'all' && h.category !== categoryFilter) return false;
    if (query && !h.fileName.toLowerCase().includes(query.toLowerCase()) &&
        !h.toolName.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const toggleSelect = (id: string) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);

  const deleteSelected = () => {
    const updated = history.filter((h) => !selected.includes(h.id));
    setHistory(updated);
    saveHistory(updated);
    setSelected([]);
  };

  const deleteAll = () => {
    setHistory([]);
    saveHistory([]);
    setSelected([]);
  };

  const deleteItem = (id: string) => {
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    saveHistory(updated);
    setSelected((prev) => prev.filter((s) => s !== id));
  };

  return (
    <div className="pt-20 pb-16" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="container-app">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">File History</h1>
            <p className="text-sm text-muted-cv mt-1">
              {history.length > 0 ? `${history.length} recorded conversion${history.length !== 1 ? 's' : ''}` : 'No history yet'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selected.length > 0 && (
              <>
                <span className="text-sm text-muted-cv">{selected.length} selected</span>
                <button
                  onClick={deleteSelected}
                  className="btn-secondary btn-sm gap-1.5"
                  style={{ color: '#ef4444' }}
                >
                  <Trash2 size={13} /> Delete selected
                </button>
              </>
            )}
            {history.length > 0 && (
              <button
                onClick={deleteAll}
                className="btn-secondary btn-sm gap-1.5 text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                <Trash2 size={12} /> Clear all
              </button>
            )}
          </div>
        </div>

        {/* Notice: history is session-local */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg border mb-5"
          style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
        >
          <Info size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }} />
          <p className="text-xs text-muted-cv leading-relaxed">
            History is stored locally in your browser's localStorage. It is never uploaded to any server.
            Clearing browser data will remove it. Re-download of processed files is not available — download
            immediately after processing.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-48 h-9 px-3 rounded-lg border"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files or tools..."
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            {CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className="px-3 h-8 rounded-lg text-xs font-medium capitalize transition-all duration-150"
                style={{
                  backgroundColor: categoryFilter === cat ? 'var(--accent)' : 'var(--muted)',
                  color: categoryFilter === cat ? 'white' : 'var(--text-muted)',
                  border: '1px solid',
                  borderColor: categoryFilter === cat ? 'var(--accent)' : 'var(--border)',
                }}
              >
                {cat === 'all' ? 'All' : cat.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Empty state */}
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Clock size={40} style={{ color: 'var(--text-disabled)' }} />
            <div className="text-center">
              <p className="font-medium text-primary">No history yet</p>
              <p className="text-sm text-muted-cv mt-1">
                Converted files will appear here automatically after processing.
              </p>
            </div>
            <Link to="/tools" className="btn-primary btn-md" style={{ backgroundColor: 'var(--accent)' }}>
              Browse Tools
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Filter size={32} style={{ color: 'var(--text-disabled)' }} />
            <p className="text-sm text-muted-cv">No items match your filters.</p>
            <button onClick={() => { setQuery(''); setCategoryFilter('all'); }} className="btn-secondary btn-sm">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            {/* Table header */}
            <div className="grid gap-4 px-4 py-2.5 border-b text-2xs font-semibold uppercase tracking-wider"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--muted)',
                color: 'var(--text-muted)',
                gridTemplateColumns: '2rem 1fr 180px 100px 100px 80px 80px',
                fontSize: '11px',
              }}
            >
              <span />
              <span>File</span>
              <span>Tool</span>
              <span>Original</span>
              <span>Result</span>
              <span>Type</span>
              <span>Actions</span>
            </div>

            {/* Rows */}
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {filtered.map((item) => {
                const meta = CATEGORY_META[item.category as keyof typeof CATEGORY_META] ?? CATEGORY_META.pdf;
                const isSelected = selected.includes(item.id);

                return (
                  <div
                    key={item.id}
                    className="grid items-center gap-4 px-4 py-3 transition-colors hover:bg-hover-cv"
                    style={{
                      gridTemplateColumns: '2rem 1fr 180px 100px 100px 80px 80px',
                      backgroundColor: isSelected ? 'var(--accent-subtle)' : undefined,
                    }}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item.id)}
                      className="w-4 h-4 rounded"
                      style={{ accentColor: 'var(--accent)' }}
                    />

                    {/* File info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                        style={{ backgroundColor: meta.color + '15', color: meta.color }}
                      >
                        {categoryIcon(item.category)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-primary truncate">{item.fileName}</p>
                        <p className="text-xs text-muted-cv">{item.date}</p>
                      </div>
                    </div>

                    {/* Tool */}
                    <Link
                      to={`/tool/${item.toolSlug}`}
                      className="text-xs font-medium transition-colors truncate"
                      style={{ color: meta.color }}
                    >
                      {item.toolName}
                    </Link>

                    {/* Original size */}
                    <span className="text-xs text-muted-cv font-num">{item.size}</span>

                    {/* Result size / status */}
                    <span className="text-xs font-num"
                      style={{ color: item.status === 'completed' ? '#22c55e' : item.status === 'failed' ? '#ef4444' : 'var(--text-muted)' }}
                    >
                      {item.status === 'completed' ? (item.resultSize || '✓') : item.status === 'failed' ? 'Failed' : '…'}
                    </span>

                    {/* Processing type */}
                    <span className="text-2xs flex items-center gap-1" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: item.processingType === 'local' ? '#22c55e' : '#3b82f6' }}
                      />
                      {item.processingType === 'local' ? 'Local' : 'Cloud'}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {item.status === 'failed' && (
                        <Link
                          to={`/tool/${item.toolSlug}`}
                          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-hover-cv transition-colors"
                          title="Retry"
                        >
                          <RefreshCw size={13} style={{ color: 'var(--text-muted)' }} />
                        </Link>
                      )}
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-hover-cv transition-colors"
                        title="Remove from history"
                      >
                        <Trash2 size={13} style={{ color: 'var(--text-muted)' }} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
