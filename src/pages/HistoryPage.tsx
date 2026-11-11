// ============================================================
// CONVETER — Premium Conversion History (Section 9)
// Provides full audit of previous jobs with search, category &
// status filters, sorting (date, name, size), and retry actions.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Clock, RefreshCw, Trash2, Search, ArrowRight,
} from 'lucide-react';
import { CATEGORY_META } from '@/registry/tools';
import { HistoryItem, loadHistory, saveHistory } from '@/lib/history';
import { useToast } from '@/components/ui/ToastContext';

type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'size-desc';

const CATEGORY_FILTERS = ['all', 'pdf', 'image', 'data', 'utilities', 'archive'] as const;

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [selected, setSelected] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    const onStorage = () => setHistory(loadHistory());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const filteredAndSorted = useMemo(() => {
    let list = history.filter((h) => {
      if (categoryFilter !== 'all' && h.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && h.status !== statusFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        const matchesFile = h.fileName.toLowerCase().includes(q);
        const matchesTool = h.toolName.toLowerCase().includes(q);
        if (!matchesFile && !matchesTool) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'date-desc') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (sortBy === 'date-asc') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (sortBy === 'name-asc') {
        return a.fileName.localeCompare(b.fileName);
      }
      if (sortBy === 'size-desc') {
        return parseFloat(b.size) - parseFloat(a.size);
      }
      return 0;
    });

    return list;
  }, [history, categoryFilter, statusFilter, query, sortBy]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const selectAll = () => {
    if (selected.length === filteredAndSorted.length) {
      setSelected([]);
    } else {
      setSelected(filteredAndSorted.map((h) => h.id));
    }
  };

  const deleteSelected = () => {
    const updated = history.filter((h) => !selected.includes(h.id));
    setHistory(updated);
    saveHistory(updated);
    setSelected([]);
    toast.success('Selected records removed');
  };

  const deleteAll = () => {
    setHistory([]);
    saveHistory([]);
    setSelected([]);
    toast.info('Conversion history cleared');
  };

  const deleteItem = (id: string) => {
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    saveHistory(updated);
    setSelected((prev) => prev.filter((s) => s !== id));
  };

  return (
    <div className="pt-20 pb-20 min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="container-app space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-brand text-xs font-semibold">
                <Clock size={12} /> RECORD LEDGER
              </span>
            </div>
            <h1 className="text-2xl font-bold text-primary">Conversion History</h1>
            <p className="text-xs text-muted-cv mt-0.5">
              Review previous conversions performed in your current browser session.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selected.length > 0 && (
              <button
                type="button"
                onClick={deleteSelected}
                className="btn-secondary btn-sm gap-1.5 text-error-600 hover:text-error-700"
              >
                <Trash2 size={13} /> Delete Selected ({selected.length})
              </button>
            )}
            {history.length > 0 && (
              <button
                type="button"
                onClick={deleteAll}
                className="btn-ghost btn-sm gap-1.5 text-xs text-muted-cv hover:text-primary"
              >
                <Trash2 size={12} /> Clear All
              </button>
            )}
          </div>
        </div>

        {/* Filter & Sort Controls */}
        <div
          className="p-4 rounded-2xl border flex items-center justify-between gap-3 flex-wrap shadow-sm"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <div className="relative min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-cv" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search history by file or tool..."
                className="input pl-8 h-9 text-xs w-full"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input h-9 text-xs w-36 capitalize"
            >
              <option value="all">All Categories</option>
              {CATEGORY_FILTERS.filter((c) => c !== 'all').map((cat) => (
                <option key={cat} value={cat}>
                  {cat.toUpperCase()}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input h-9 text-xs w-32"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="input h-9 text-xs w-36"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="name-asc">Filename A-Z</option>
              <option value="size-desc">Largest Size</option>
            </select>
          </div>

          <span className="text-2xs text-muted-cv font-num">
            {filteredAndSorted.length} record{filteredAndSorted.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* History Ledger Table */}
        <div
          className="rounded-2xl border overflow-hidden shadow-sm"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                <tr>
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selected.length === filteredAndSorted.length && filteredAndSorted.length > 0}
                      onChange={selectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold text-muted-cv">File Name</th>
                  <th className="px-4 py-3 font-semibold text-muted-cv">Tool</th>
                  <th className="px-4 py-3 font-semibold text-muted-cv">Original Size</th>
                  <th className="px-4 py-3 font-semibold text-muted-cv">Output Size</th>
                  <th className="px-4 py-3 font-semibold text-muted-cv">Status</th>
                  <th className="px-4 py-3 font-semibold text-muted-cv">Date</th>
                  <th className="px-4 py-3 font-semibold text-muted-cv text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {filteredAndSorted.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-muted-cv">
                      <Clock size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-semibold text-primary">No conversion records found</p>
                      <p className="text-xs text-muted-cv mt-1">
                        Files you convert will appear here with instant relaunch shortcuts.
                      </p>
                      <Link to="/tools" className="btn-primary btn-sm mt-4 inline-flex items-center gap-1">
                        Browse Tools <ArrowRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ) : (
                  filteredAndSorted.map((item) => {
                    const isSelected = selected.includes(item.id);
                    const meta = CATEGORY_META[item.category as keyof typeof CATEGORY_META];

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${isSelected ? 'bg-hover-cv' : 'hover:bg-hover-cv/50'}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(item.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-primary max-w-[220px] truncate">
                          {item.fileName}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="font-semibold text-xs inline-flex items-center gap-1"
                            style={{ color: meta?.color || 'var(--accent)' }}
                          >
                            {item.toolName}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-num text-muted-cv">
                          {item.size}
                        </td>
                        <td className="px-4 py-3 font-num text-muted-cv">
                          {item.resultSize || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`badge text-2xs uppercase tracking-wider font-semibold ${
                              item.status === 'completed'
                                ? 'badge-success'
                                : 'badge-error'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-num text-2xs text-muted-cv">
                          {item.date}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => navigate(`/tool/${item.toolSlug}`)}
                              className="btn-ghost btn-sm text-xs gap-1"
                              title="Convert another with this tool"
                            >
                              <RefreshCw size={11} /> Relaunch
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteItem(item.id)}
                              className="w-7 h-7 flex items-center justify-center rounded text-muted-cv hover:text-error-600 transition-colors"
                              title="Delete record"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
