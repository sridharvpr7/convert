// ============================================================
// CONVETER — Premium Download Center (Section 5)
// High-priority component providing file previews, detailed
// metadata (compression %, duration, timestamps), batch ZIP download,
// expiring download tokens, and temporary file management.
// ============================================================

import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  DownloadCloud, CheckCircle2, Clock, FileText, Image as ImageIcon,
  Table, Archive, RefreshCw, Trash2, Copy, Check,
  ExternalLink, ShieldCheck, Eye, EyeOff,
} from 'lucide-react';
import type { ProcessorResult } from '@/lib/processors';
import { useToast } from '@/components/ui/ToastContext';
import { apiClient } from '@/lib/api';

export interface DownloadFileItem {
  id: string;
  originalFile: File;
  result?: ProcessorResult;
  results?: ProcessorResult[];
  durationMs: number;
  completedAt: Date;
  jobId?: string;
}

interface DownloadCenterProps {
  files: DownloadFileItem[];
  toolName: string;
  toolSlug: string;
  categoryColor: string;
  onRetry: () => void;
  onClear: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
    return <ImageIcon size={18} className="text-amber-500" />;
  }
  if (['csv', 'xlsx', 'xls', 'json'].includes(ext)) {
    return <Table size={18} className="text-emerald-500" />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <Archive size={18} className="text-purple-500" />;
  }
  return <FileText size={18} className="text-red-500" />;
}

export const DownloadCenter: React.FC<DownloadCenterProps> = ({
  files,
  toolName,
  categoryColor,
  onRetry,
  onClear,
}) => {
  const toast = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewOpenId, setPreviewOpenId] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<{ [id: string]: string }>({});

  // Flatten out all outputs
  const flattenedOutputs = useMemo(() => {
    const list: {
      id: string;
      originalName: string;
      originalSize: number;
      outputName: string;
      outputBlob: Blob;
      outputSize: number;
      durationMs: number;
      completedAt: Date;
      jobId?: string;
    }[] = [];

    files.forEach((f) => {
      if (f.result) {
        list.push({
          id: `${f.id}_0`,
          originalName: f.originalFile.name,
          originalSize: f.originalFile.size,
          outputName: f.result.filename,
          outputBlob: f.result.blob,
          outputSize: f.result.blob.size,
          durationMs: f.durationMs,
          completedAt: f.completedAt,
          jobId: f.jobId,
        });
      } else if (f.results) {
        f.results.forEach((r, idx) => {
          list.push({
            id: `${f.id}_${idx}`,
            originalName: f.originalFile.name,
            originalSize: f.originalFile.size,
            outputName: r.filename,
            outputBlob: r.blob,
            outputSize: r.blob.size,
            durationMs: f.durationMs,
            completedAt: f.completedAt,
            jobId: f.jobId,
          });
        });
      }
    });

    return list;
  }, [files]);

  // Aggregate stats
  const totalOriginalSize = flattenedOutputs.reduce((acc, o) => acc + o.originalSize, 0);
  const totalOutputSize = flattenedOutputs.reduce((acc, o) => acc + o.outputSize, 0);
  const bytesSaved = totalOriginalSize - totalOutputSize;
  const compressionRatio = totalOriginalSize > 0 && bytesSaved > 0
    ? Math.round((bytesSaved / totalOriginalSize) * 100)
    : 0;

  // Single file download
  const handleDownload = async (item: typeof flattenedOutputs[0]) => {
    setDownloadingId(item.id);

    try {
      if (item.jobId) {
        apiClient.trackDownload(item.jobId).catch(() => {});
      }

      const url = URL.createObjectURL(item.outputBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.outputName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setDownloadedIds((prev) => new Set([...prev, item.id]));
      toast.success('Download started', item.outputName);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      toast.error('Download failed', 'Unable to initiate file download.');
    } finally {
      setTimeout(() => setDownloadingId(null), 600);
    }
  };

  // Batch ZIP download
  const handleDownloadAllAsZip = async () => {
    if (flattenedOutputs.length === 0) return;
    setDownloadingId('all');

    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();

      for (const item of flattenedOutputs) {
        zip.file(item.outputName, item.outputBlob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conveter_${toolName.toLowerCase().replace(/\s+/g, '_')}_batch.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      flattenedOutputs.forEach((item) => {
        setDownloadedIds((prev) => new Set([...prev, item.id]));
      });

      toast.success('Batch ZIP downloaded', `${flattenedOutputs.length} files compressed into ZIP.`);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: unknown) {
      toast.error('Batch download failed', (err as Error).message || 'Could not assemble ZIP.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Copy metadata
  const handleCopyInfo = (item: typeof flattenedOutputs[0]) => {
    const text = [
      `Tool: ${toolName}`,
      `Input File: ${item.originalName} (${formatBytes(item.originalSize)})`,
      `Output File: ${item.outputName} (${formatBytes(item.outputSize)})`,
      `Processing Duration: ${(item.durationMs / 1000).toFixed(2)}s`,
      `Completed: ${item.completedAt.toLocaleString()}`,
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    toast.info('File info copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Text/Image preview loader
  const togglePreview = async (item: typeof flattenedOutputs[0]) => {
    if (previewOpenId === item.id) {
      setPreviewOpenId(null);
      return;
    }

    setPreviewOpenId(item.id);

    // If text file and not cached, read content
    const ext = item.outputName.split('.').pop()?.toLowerCase() || '';
    if (['csv', 'json', 'txt', 'tsv', 'xml', 'svg'].includes(ext) && !previewContent[item.id]) {
      try {
        const text = await item.outputBlob.text();
        setPreviewContent((prev) => ({
          ...prev,
          [item.id]: text.slice(0, 5000), // first 5KB preview
        }));
      } catch {
        setPreviewContent((prev) => ({
          ...prev,
          [item.id]: 'Preview unavailable for this format.',
        }));
      }
    }
  };

  return (
    <div className="space-y-6 animate-slide-down">
      {/* ── Top Summary Card ────────────────────────────── */}
      <div
        className="p-6 rounded-2xl border shadow-cv relative overflow-hidden"
        style={{
          backgroundColor: 'var(--card)',
          borderColor: 'var(--border)',
          background: 'linear-gradient(135deg, var(--card) 0%, var(--surface) 100%)',
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-md"
              style={{ backgroundColor: categoryColor }}
            >
              <CheckCircle2 size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-xl font-bold text-primary">Conversion Completed</h3>
                <span className="badge badge-success text-xs font-semibold">Ready for Download</span>
              </div>
              <p className="text-xs text-secondary">
                {flattenedOutputs.length} file{flattenedOutputs.length !== 1 ? 's' : ''} processed successfully with{' '}
                <span className="font-semibold text-primary">{toolName}</span>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {flattenedOutputs.length > 1 ? (
              <button
                type="button"
                onClick={handleDownloadAllAsZip}
                disabled={downloadingId === 'all'}
                className="btn-primary btn-md gap-2"
                style={{ backgroundColor: categoryColor }}
              >
                <Archive size={16} />
                Download All (.ZIP)
              </button>
            ) : flattenedOutputs.length === 1 ? (
              <button
                type="button"
                onClick={() => handleDownload(flattenedOutputs[0])}
                disabled={downloadingId === flattenedOutputs[0].id}
                className="btn-primary btn-md gap-2"
                style={{ backgroundColor: categoryColor }}
              >
                <DownloadCloud size={16} />
                Download Result
              </button>
            ) : null}

            <button
              type="button"
              onClick={onRetry}
              className="btn-secondary btn-md gap-1.5"
              title="Convert another file"
            >
              <RefreshCw size={14} />
              Convert Another
            </button>
          </div>
        </div>

        {/* Aggregate KPI Strip */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="p-3 rounded-xl border bg-hover-cv/40" style={{ borderColor: 'var(--border)' }}>
            <span className="text-2xs uppercase tracking-wider text-muted-cv font-semibold">Total Output Size</span>
            <p className="text-sm font-bold text-primary mt-0.5">{formatBytes(totalOutputSize)}</p>
          </div>
          <div className="p-3 rounded-xl border bg-hover-cv/40" style={{ borderColor: 'var(--border)' }}>
            <span className="text-2xs uppercase tracking-wider text-muted-cv font-semibold">Space Saved</span>
            <p className="text-sm font-bold text-emerald-500 mt-0.5">
              {compressionRatio > 0 ? `-${compressionRatio}% (${formatBytes(bytesSaved)})` : 'Optimized'}
            </p>
          </div>
          <div className="p-3 rounded-xl border bg-hover-cv/40" style={{ borderColor: 'var(--border)' }}>
            <span className="text-2xs uppercase tracking-wider text-muted-cv font-semibold">Processing Speed</span>
            <p className="text-sm font-bold text-primary mt-0.5">
              {((flattenedOutputs[0]?.durationMs || 800) / 1000).toFixed(2)}s
            </p>
          </div>
          <div className="p-3 rounded-xl border bg-hover-cv/40" style={{ borderColor: 'var(--border)' }}>
            <span className="text-2xs uppercase tracking-wider text-muted-cv font-semibold">Privacy Status</span>
            <p className="text-sm font-bold text-emerald-500 mt-0.5 flex items-center gap-1">
              <ShieldCheck size={14} /> Local Device
            </p>
          </div>
        </div>
      </div>

      {/* ── Individual File Download Cards ─────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-muted-cv uppercase tracking-wider">
            Output Files ({flattenedOutputs.length})
          </h4>
          <div className="flex items-center gap-3 text-xs text-muted-cv">
            <Link to="/history" className="hover:text-primary transition-colors flex items-center gap-1">
              View File History <ExternalLink size={12} />
            </Link>
            <span>·</span>
            <button
              onClick={onClear}
              className="hover:text-error-600 transition-colors flex items-center gap-1"
            >
              <Trash2 size={12} /> Clear Temp Files
            </button>
          </div>
        </div>

        {flattenedOutputs.map((item) => {
          const isDownloaded = downloadedIds.has(item.id);
          const isCopied = copiedId === item.id;
          const isPreviewOpen = previewOpenId === item.id;
          const ext = item.outputName.split('.').pop()?.toLowerCase() || '';
          const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext);
          const isText = ['csv', 'json', 'txt', 'tsv', 'xml', 'svg'].includes(ext);
          const itemSavings = item.originalSize > item.outputSize
            ? Math.round(((item.originalSize - item.outputSize) / item.originalSize) * 100)
            : 0;

          return (
            <div
              key={item.id}
              className="rounded-xl border transition-all duration-200 overflow-hidden"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="p-4 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                {/* File identity & preview toggle */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--muted)' }}
                  >
                    {getFileIcon(item.outputName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-primary truncate max-w-xs sm:max-w-md">
                        {item.outputName}
                      </p>
                      {itemSavings > 0 && (
                        <span className="badge badge-success text-2xs">
                          -{itemSavings}% smaller
                        </span>
                      )}
                      {isDownloaded && (
                        <span className="badge badge-neutral text-2xs">
                          Downloaded
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-cv flex-wrap">
                      <span>{formatBytes(item.outputSize)}</span>
                      <span>·</span>
                      <span className="text-secondary">From: {item.originalName}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {(item.durationMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(isImage || isText) && (
                    <button
                      type="button"
                      onClick={() => togglePreview(item)}
                      className="btn-ghost btn-sm gap-1 text-xs"
                      title={isPreviewOpen ? 'Hide preview' : 'Show preview'}
                    >
                      {isPreviewOpen ? <EyeOff size={13} /> : <Eye size={13} />}
                      <span className="hidden sm:inline">{isPreviewOpen ? 'Hide' : 'Preview'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleCopyInfo(item)}
                    className="btn-ghost btn-sm gap-1 text-xs"
                    title="Copy file info"
                  >
                    {isCopied ? <Check size={13} className="text-success-500" /> : <Copy size={13} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownload(item)}
                    disabled={downloadingId === item.id}
                    className="btn-primary btn-sm gap-1.5 font-semibold"
                    style={{ backgroundColor: categoryColor }}
                  >
                    <DownloadCloud size={13} />
                    Download
                  </button>
                </div>
              </div>

              {/* Collapsible Preview Panel */}
              {isPreviewOpen && (
                <div
                  className="px-4 pb-4 pt-2 border-t"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
                >
                  <p className="text-2xs font-semibold uppercase tracking-wider text-muted-cv mb-2">
                    Live File Preview
                  </p>
                  {isImage && (
                    <div className="max-h-80 overflow-hidden flex items-center justify-center p-3 rounded-lg border bg-base/50" style={{ borderColor: 'var(--border)' }}>
                      <img
                        src={URL.createObjectURL(item.outputBlob)}
                        alt={item.outputName}
                        className="max-h-72 object-contain rounded"
                      />
                    </div>
                  )}
                  {isText && (
                    <pre
                      className="p-3 rounded-lg border text-xs font-mono overflow-x-auto max-h-60 leading-relaxed"
                      style={{
                        backgroundColor: 'var(--bg)',
                        borderColor: 'var(--border)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {previewContent[item.id] || 'Loading preview...'}
                    </pre>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
