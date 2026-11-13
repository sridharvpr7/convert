import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
  Upload, ChevronRight, Star, DownloadCloud,
  RefreshCw, Info, Shield, Cloud, WifiOff, CheckCircle2,
  AlertCircle, X, Loader2, FileText, Layers, ArrowRight,
  Sparkles, Settings, Copy, Globe, PenLine, Camera,
  Eraser, Trash2, Check, ChevronDown, ChevronUp, ArrowLeft,
  Lock, Zap,
} from 'lucide-react';
import { getToolBySlug, getRelatedTools, CATEGORY_META } from '@/registry/tools';
import { useAppStore } from '@/store/app.store';
import { getToolDispatch, hasProcessor, type OptionField } from '@/lib/toolDispatch';
import type { ProcessorResult } from '@/lib/processors';
import { recordHistory } from '@/lib/history';
import { DownloadCenter } from '@/components/tools/DownloadCenter';
import { DeveloperWorkspace } from '@/components/tools/DeveloperWorkspace';
import { BarcodeWorkspace } from '@/components/tools/BarcodeWorkspace';
import { apiClient } from '@/lib/api';

// ────────────────────────────────────────────────
// Processing states
// ────────────────────────────────────────────────
type ProcessingState =
  | 'idle'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

interface ProcessingFile {
  id: string;
  file: File;
  state: ProcessingState;
  progress: number;
  error?: string;
  result?: ProcessorResult;
  results?: ProcessorResult[];
  durationMs?: number;
  completedAt?: Date;
  jobId?: string;
}

const TOOL_PRESETS: Record<string, { label: string; desc: string; values: Record<string, unknown> }[]> = {
  'image-compressor': [
    { label: 'Balanced (Recommended)', desc: '75% quality, 1080p full detail', values: { quality: 75, maxWidth: 1920 } },
    { label: 'Smallest File', desc: '50% quality, smaller dimensions', values: { quality: 50, maxWidth: 1280 } },
    { label: 'Best Quality', desc: '92% quality, maximum crispness', values: { quality: 92, maxWidth: 3840 } },
  ],
  'compress-pdf': [
    { label: 'Balanced (Recommended)', desc: 'Crisp text and readable graphics', values: { level: 'medium' } },
    { label: 'Smallest File', desc: 'Aggressive object compaction', values: { level: 'high' } },
    { label: 'Best Quality', desc: 'Minimal compression, retains fidelity', values: { level: 'low' } },
  ],
  'image-converter': [
    { label: 'WebP (Smallest File)', desc: 'Modern high-efficiency WebP format', values: { format: 'webp', quality: 85 } },
    { label: 'JPEG (Universal)', desc: 'Standard photo compatibility', values: { format: 'jpeg', quality: 85 } },
    { label: 'PNG (Lossless)', desc: 'Preserves sharp text and transparency', values: { format: 'png', quality: 100 } },
  ],
  'split-pdf': [
    { label: 'All Pages', desc: 'Split each page individually', values: { mode: 'each' } },
    { label: 'Page Range', desc: 'Extract custom page ranges', values: { mode: 'range' } },
  ],
  'excel-to-pdf': [
    { label: 'Landscape (Wide Tables)', desc: 'Expands wide columns cleanly', values: { orientation: 'landscape' } },
    { label: 'Portrait (Standard)', desc: 'Vertical document orientation', values: { orientation: 'portrait' } },
  ],
  'add-page-numbers': [
    { label: 'Bottom Center', desc: 'Standard Page X of Y', values: { position: 'bottom-center', format: 'Page {n} of {total}' } },
    { label: 'Bottom Right', desc: 'Page numbers at outer right', values: { position: 'bottom-right', format: 'Page {n} of {total}' } },
    { label: 'Header Right', desc: 'Top right corner numbering', values: { position: 'top-right', format: 'Page {n} of {total}' } },
  ],
};

// ────────────────────────────────────────────────
// Utility: download a blob
// ────────────────────────────────────────────────
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ────────────────────────────────────────────────
// Upload Zone
// ────────────────────────────────────────────────
interface UploadZoneProps {
  onFiles: (files: File[]) => void;
  accept?: Record<string, string[]>;
  multiple?: boolean;
  supportedFormats?: string[];
  color: string;
  disabled?: boolean;
  disabledReason?: string;
}

const UploadZone: React.FC<UploadZoneProps> = ({
  onFiles, accept, multiple = true, supportedFormats, color, disabled, disabledReason,
}) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: disabled ? () => {} : onFiles,
    accept,
    multiple,
    disabled: Boolean(disabled),
  });

  return (
    <div
      {...getRootProps()}
      className={`upload-zone py-16 px-8 transition-all duration-200 ${disabled ? 'opacity-60 cursor-not-allowed border-dashed' : 'cursor-pointer'} ${isDragActive ? 'active' : ''}`}
      style={isDragActive ? { borderColor: color, backgroundColor: color + '08' } : {}}
    >
      <input {...getInputProps()} disabled={Boolean(disabled)} />
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className="w-16 h-16 flex items-center justify-center rounded-2xl transition-all duration-200"
          style={{
            backgroundColor: disabled ? 'var(--muted)' : (isDragActive ? color + '15' : 'var(--muted)'),
            color: disabled ? 'var(--text-muted)' : (isDragActive ? color : 'var(--text-muted)'),
          }}
        >
          {disabled ? <Lock size={30} /> : (isDragActive ? <DownloadCloud size={32} /> : <Upload size={32} />)}
        </div>
        <div>
          <p className="text-base font-semibold text-primary mb-1">
            {disabled
              ? (disabledReason || 'Uploads are currently disabled for this tool')
              : (isDragActive ? 'Drop files here' : 'Drag & drop files here')}
          </p>
          {!disabled && (
            <p className="text-sm text-muted-cv">
              or <span style={{ color }} className="font-medium">browse to upload</span>
            </p>
          )}
        </div>
        {supportedFormats && supportedFormats.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <span className="text-xs text-muted-cv">Supported:</span>
            {supportedFormats.map((fmt) => (
              <span key={fmt} className="text-2xs px-2 py-0.5 rounded font-mono uppercase font-medium border"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)', color: 'var(--text-muted)', fontSize: '10px' }}
              >
                {fmt}
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-cv">
          {multiple ? 'Multiple files supported' : 'Single file mode'} · Up to 100MB free
        </p>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────
// URL Input Panel (for web tools)
// ────────────────────────────────────────────────
const UrlInputPanel: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isRunning: boolean;
  color: string;
  hint?: string;
}> = ({ value, onChange, onSubmit, isRunning, color, hint }) => (
  <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-3">
    <label htmlFor="tool-url-input" className="label">URL</label>
    <div className="flex gap-2">
      <div className="flex-1 flex items-center gap-2 input-lg" style={{ padding: 0 }}>
        <Globe size={16} style={{ color: 'var(--text-muted)', marginLeft: '12px', flexShrink: 0 }} />
        <input
          id="tool-url-input"
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com"
          className="flex-1 bg-transparent border-0 outline-none px-2 py-3 text-sm text-primary"
          required
        />
      </div>
      <button
        type="submit"
        disabled={isRunning || !value.trim()}
        className="btn-primary btn-lg gap-2 flex-shrink-0"
        style={{ backgroundColor: color, opacity: isRunning ? 0.7 : 1 }}
      >
        {isRunning ? <><Loader2 size={16} className="animate-spin" />Processing…</> : <><Sparkles size={16} />Analyze</>}
      </button>
    </div>
    {hint && (
      <p className="text-xs text-muted-cv flex items-start gap-1.5">
        <Info size={12} style={{ flexShrink: 0, marginTop: 2 }} />
        {hint}
      </p>
    )}
  </form>
);

// ────────────────────────────────────────────────
// Signature Pad (for sign-pdf)
// ────────────────────────────────────────────────
const SignaturePad: React.FC<{
  onSignature: (dataUrl: string) => void;
  color: string;
}> = ({ onSignature, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    isDrawing.current = true;
    const pos = getPos(e.nativeEvent, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    e.preventDefault();
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e.nativeEvent, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setHasSignature(true);
    e.preventDefault();
  }, []);

  const endDraw = useCallback(() => {
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    onSignature(canvas.toDataURL('image/png'));
  }, [hasSignature, onSignature]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSignature('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="label">Draw Your Signature</label>
        <button type="button" onClick={clear} className="btn-secondary btn-sm gap-1.5 text-xs">
          <Eraser size={12} /> Clear
        </button>
      </div>
      <div className="relative rounded-xl border-2 border-dashed overflow-hidden"
        style={{ borderColor: color + '40', backgroundColor: '#fafafa', touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full"
          style={{ cursor: 'crosshair', display: 'block' }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-muted-cv flex items-center gap-2">
              <PenLine size={16} /> Sign here
            </p>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-cv">Draw your signature above, then upload a PDF and click Process.</p>
    </div>
  );
};

// ────────────────────────────────────────────────
// Camera Capture (for tools declaring camera input)
// ────────────────────────────────────────────────
const CameraCapture: React.FC<{
  onCapture: (file: File) => void;
  color: string;
}> = ({ onCapture, color }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera is not supported on this browser or connection.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      setIsOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Camera access denied or unavailable.');
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `camera-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
        stopCamera();
      }
    }, 'image/jpeg', 0.95);
  };

  return (
    <div className="mb-4">
      {!isOpen ? (
        <button
          type="button"
          onClick={startCamera}
          className="btn-secondary btn-md gap-2 w-full justify-center"
        >
          <Camera size={16} /> Use Camera to Capture Document / Photo
        </button>
      ) : (
        <div className="p-4 rounded-xl border space-y-3" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
            <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-contain" />
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={takePhoto}
              className="btn-primary btn-md gap-2"
              style={{ backgroundColor: color }}
            >
              <Camera size={16} /> Capture Photo
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="btn-secondary btn-md gap-2"
            >
              <X size={16} /> Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs mt-2 flex items-center gap-2">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────
// File Item
// ────────────────────────────────────────────────
const FileItem: React.FC<{
  pf: ProcessingFile;
  color: string;
  onRemove: (id: string) => void;
  onDownload: (pf: ProcessingFile) => void;
}> = ({ pf, color, onRemove, onDownload }) => {
  const stateConfig: Record<ProcessingState, { icon: React.ReactNode; label: string; stateColor: string }> = {
    idle: { icon: <FileText size={14} />, label: 'Ready', stateColor: 'var(--text-muted)' },
    processing: { icon: <Loader2 size={14} className="animate-spin" />, label: `Processing ${pf.progress}%`, stateColor: color },
    completed: { icon: <CheckCircle2 size={14} />, label: 'Done', stateColor: '#22c55e' },
    failed: { icon: <AlertCircle size={14} />, label: pf.error || 'Failed', stateColor: '#ef4444' },
    cancelled: { icon: <X size={14} />, label: 'Cancelled', stateColor: 'var(--text-muted)' },
  };
  const cfg = stateConfig[pf.state];
  const hasMultiResult = (pf.results?.length ?? 0) > 1;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border"
      style={{
        borderColor: pf.state === 'failed' ? '#ef444440' : pf.state === 'completed' ? '#22c55e30' : 'var(--border)',
        backgroundColor: pf.state === 'completed' ? '#22c55e06' : pf.state === 'failed' ? '#ef444406' : 'var(--card)',
      }}
    >
      <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
        style={{ backgroundColor: 'var(--muted)', color: 'var(--text-muted)' }}
      >
        <FileText size={16} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate">{pf.file.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-muted-cv">{(pf.file.size / 1024 / 1024).toFixed(2)} MB</span>
          {pf.result?.meta?.outputSize && (
            <span className="text-xs text-muted-cv">
              → {((pf.result.meta.outputSize as number) / 1024 / 1024).toFixed(2)} MB
            </span>
          )}
          {pf.result?.meta?.compressionRatio && (
            <span className="text-xs font-medium" style={{ color: '#22c55e' }}>
              -{pf.result.meta.compressionRatio}%
            </span>
          )}
          <span className="flex items-center gap-1 text-xs font-medium" style={{ color: cfg.stateColor }}>
            {cfg.icon}
            {cfg.label}
          </span>
        </div>
        {pf.state === 'processing' && (
          <div className="progress-bar mt-1.5">
            <div className="progress-fill" style={{ width: `${pf.progress}%`, backgroundColor: color }} />
          </div>
        )}
        {/* Multi-result download links */}
        {hasMultiResult && pf.state === 'completed' && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {pf.results!.map((r, i) => (
              <button
                key={i}
                onClick={() => downloadBlob(r.blob, r.filename)}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border transition-colors"
                style={{ borderColor: color + '60', color, backgroundColor: color + '10' }}
              >
                <DownloadCloud size={10} />
                {r.filename}
              </button>
            ))}
          </div>
        )}
        {/* Error detail */}
        {pf.state === 'failed' && pf.error && (
          <p className="text-xs mt-1 leading-relaxed" style={{ color: '#ef4444' }}>{pf.error}</p>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {pf.state === 'completed' && !hasMultiResult && (
          <button
            onClick={() => onDownload(pf)}
            className="btn-sm flex items-center gap-1 text-xs"
            style={{ color, backgroundColor: color + '15', borderRadius: '6px', padding: '4px 10px' }}
          >
            <DownloadCloud size={12} />
            Download
          </button>
        )}
        <button
          onClick={() => onRemove(pf.id)}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-hover-cv transition-colors"
        >
          <X size={12} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────
// Friendly Error Parser
// ────────────────────────────────────────────────
function parseFriendlyError(errorMsg?: string, isCloud?: boolean): { headline: string; detail: string; tips: string[] } {
  const msg = errorMsg || 'An unexpected issue occurred while processing this file.';
  const lower = msg.toLowerCase();

  if (lower.includes('fetch') || lower.includes('backend') || lower.includes('network') || lower.includes('connection') || lower.includes('econnrefused')) {
    return {
      headline: 'Backend Service Required',
      detail: isCloud
        ? 'This tool requires the CONVETER backend service (VITE_BACKEND_URL), which is currently not reachable.'
        : 'Network connection issue while communicating with the processing worker.',
      tips: [
        'Ensure your companion backend server is running',
        'Check that VITE_BACKEND_URL in your environment is properly set',
        'Verify network connectivity and CORS permissions',
      ],
    };
  }

  if (lower.includes('password') || lower.includes('encrypt') || lower.includes('protected')) {
    return {
      headline: 'File is Password-Protected',
      detail: 'This document requires an authorization password to read or modify.',
      tips: [
        'Enter the file password in the Options tab',
        'Use the Unlock PDF tool to decrypt the file first',
        'Ensure you have permission to modify this document',
      ],
    };
  }

  if (lower.includes('format') || lower.includes('unsupported') || lower.includes('corrupt') || lower.includes('invalid') || lower.includes('signature')) {
    return {
      headline: 'File Format Issue',
      detail: msg,
      tips: [
        'Check that the uploaded file is not corrupted',
        'Verify the file extension matches the actual file content',
        'Try opening and re-saving the file in your default viewer first',
      ],
    };
  }

  return {
    headline: 'Processing Error',
    detail: msg,
    tips: [
      'Check that the file size is within limits (up to 100MB)',
      'Try running with default options',
      'Refresh the page and try one file at a time',
    ],
  };
}

// ────────────────────────────────────────────────
// Dynamic Options Panel with Progressive Disclosure
// ────────────────────────────────────────────────
const OptionsPanel: React.FC<{
  fields: OptionField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onReset?: () => void;
  hint?: string;
  color: string;
}> = ({ fields, values, onChange, onReset, hint, color }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // If more than 3 fields, split into primary and advanced
  const primaryFields = fields.length > 4 ? fields.slice(0, 3) : fields;
  const advancedFields = fields.length > 4 ? fields.slice(3) : [];

  const renderField = (field: OptionField) => {
    const val = values[field.key] ?? field.default;
    return (
      <div key={field.key} className="space-y-1.5">
        {field.type !== 'checkbox' && (
          <div className="flex items-center justify-between">
            <label htmlFor={`opt-${field.key}`} className="label mb-0 font-medium">
              {field.label}
            </label>
            {field.default !== undefined && (
              <span className="text-2xs text-muted-cv" style={{ fontSize: '11px' }}>
                Default: {String(field.default)}
              </span>
            )}
          </div>
        )}

        {field.type === 'select' && (
          <div className="flex flex-wrap gap-2 pt-0.5">
            {field.options.map((opt) => {
              const isSelected = val === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  id={`opt-${field.key}-${opt.value}`}
                  aria-pressed={isSelected}
                  onClick={() => onChange(field.key, opt.value)}
                  className="px-3.5 py-2 rounded-lg border text-sm font-medium transition-all duration-150 flex items-center gap-1.5"
                  style={{
                    borderColor: isSelected ? color : 'var(--border)',
                    backgroundColor: isSelected ? `${color}15` : 'var(--muted)',
                    color: isSelected ? color : 'var(--text-secondary)',
                    boxShadow: isSelected ? `0 0 0 1px ${color}` : 'none',
                  }}
                >
                  {isSelected && <Check size={13} style={{ color }} />}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {field.type === 'range' && (
          <div className="flex items-center gap-3 pt-1">
            <input
              type="range"
              id={`opt-${field.key}`}
              min={field.min}
              max={field.max}
              step={field.step}
              value={Number(val)}
              onChange={(e) => onChange(field.key, Number(e.target.value))}
              className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: color }}
              aria-label={field.label}
            />
            <span
              className="text-sm font-semibold font-num px-2.5 py-1 rounded-md border min-w-[64px] text-center"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)', color }}
            >
              {String(val)}{field.unit ?? ''}
            </span>
          </div>
        )}

        {field.type === 'number' && (
          <input
            type="number"
            id={`opt-${field.key}`}
            min={field.min}
            max={field.max}
            value={Number(val)}
            onChange={(e) => onChange(field.key, Number(e.target.value))}
            className="input-lg mt-1"
            style={{ maxWidth: '180px' }}
          />
        )}

        {field.type === 'text' && (
          <input
            type="text"
            id={`opt-${field.key}`}
            placeholder={field.placeholder}
            value={String(val)}
            onChange={(e) => onChange(field.key, e.target.value)}
            className="input-lg mt-1 w-full"
          />
        )}

        {field.type === 'password' && (
          <input
            type="password"
            id={`opt-${field.key}`}
            placeholder={field.placeholder}
            value={String(val)}
            onChange={(e) => onChange(field.key, e.target.value)}
            className="input-lg w-full mt-1"
            autoComplete="new-password"
          />
        )}

        {field.type === 'textarea' && (
          <textarea
            id={`opt-${field.key}`}
            placeholder={field.placeholder}
            value={String(val)}
            rows={field.rows ?? 4}
            onChange={(e) => onChange(field.key, e.target.value)}
            className="input-lg mt-1 w-full resize-y font-mono text-sm"
          />
        )}

        {field.type === 'checkbox' && (
          <div className="flex items-center gap-2.5 pt-1">
            <input
              type="checkbox"
              id={`opt-${field.key}`}
              checked={Boolean(val)}
              onChange={(e) => onChange(field.key, e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer"
              style={{ accentColor: color }}
            />
            <label htmlFor={`opt-${field.key}`} className="text-sm text-secondary cursor-pointer select-none font-medium">
              {field.label}
            </label>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Primary fields */}
      <div className="space-y-5">
        {primaryFields.map(renderField)}
      </div>

      {/* Advanced fields toggle */}
      {advancedFields.length > 0 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg border transition-colors hover:bg-hover-cv"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            aria-expanded={showAdvanced}
          >
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>{showAdvanced ? 'Hide advanced settings' : `Show advanced settings (${advancedFields.length} more)`}</span>
          </button>

          {showAdvanced && (
            <div className="mt-4 p-4 rounded-xl border space-y-5 animate-slide-down" style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}>
              <p className="text-2xs font-semibold uppercase tracking-wider text-muted-cv">Advanced Configuration</p>
              {advancedFields.map(renderField)}
            </div>
          )}
        </div>
      )}

      {hint && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg border"
          style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
        >
          <Info size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }} />
          <p className="text-xs text-muted-cv leading-relaxed">{hint}</p>
        </div>
      )}

      {onReset && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-muted-cv hover:text-primary transition-colors flex items-center gap-1"
          >
            <RefreshCw size={11} /> Reset all settings to defaults
          </button>
        </div>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────
// Main Tool Page
// ────────────────────────────────────────────────
export const ToolPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { isFavoriteTool, toggleFavoriteTool, addNotification, user, siteDisplayConfig } = useAppStore();

  const tool = slug ? getToolBySlug(slug) : undefined;
  const dispatch = slug ? getToolDispatch(slug) : null;
  const implemented = slug ? hasProcessor(slug) : false;

  const toolSetting = slug && siteDisplayConfig?.tools ? siteDisplayConfig.tools[slug] : undefined;
  const isMaintenance = Boolean(siteDisplayConfig?.global?.maintenanceMode || toolSetting?.maintenance);
  const isDisabled = toolSetting ? toolSetting.enabled === false : false;

  const [files, setFiles] = useState<ProcessingFile[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [overallState, setOverallState] = useState<ProcessingState>('idle');
  const [activeTab, setActiveTab] = useState<'upload' | 'options' | 'result'>('upload');
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [accessRestricted, setAccessRestricted] = useState(false);
  const [restrictionReason, setRestrictionReason] = useState<string | null>(null);

  useEffect(() => {
    if (!tool) return;
    apiClient.verifyToolAccess({
      toolSlug: tool.slug,
      isPremiumUser: user?.plan === 'premium',
      userId: user?.id,
      userName: user?.name,
    }).then((res) => {
      if (res && !res.authorized) {
        setAccessRestricted(true);
        setRestrictionReason(res.error || 'This tool requires an active Premium membership.');
      } else {
        setAccessRestricted(false);
      }
    }).catch(() => {});
  }, [tool, user]);
  const [options, setOptions] = useState<Record<string, unknown>>(() => {
    const defaults: Record<string, unknown> = {};
    dispatch?.optionFields?.forEach((f) => { defaults[f.key] = f.default; });
    return defaults;
  });

  useEffect(() => {
    const defaults: Record<string, unknown> = {};
    dispatch?.optionFields?.forEach((f) => { defaults[f.key] = f.default; });
    setOptions(defaults);
    setFiles([]);
    setOverallState('idle');
    setActiveTab('upload');
    setTextInput('');
    setUrlInput('');
    setSignatureDataUrl('');
  }, [slug, dispatch?.optionFields]);

  const handleFiles = useCallback((acceptedFiles: File[]) => {
    if (isDisabled) {
      addNotification({
        title: 'Tool Disabled',
        desc: 'This tool is temporarily disabled by administrator.',
        type: 'error',
      });
      return;
    }
    if (isMaintenance) {
      addNotification({
        title: 'Maintenance in Progress',
        desc: 'This tool is currently undergoing maintenance. Processing is paused.',
        type: 'info',
      });
      return;
    }
    const newFiles = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).slice(2),
      file,
      state: 'idle' as ProcessingState,
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, [isDisabled, isMaintenance, addNotification]);

  const handleRemove = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleDownload = useCallback((pf: ProcessingFile) => {
    if (pf.result) {
      downloadBlob(pf.result.blob, pf.result.filename);
    }
  }, []);

  const runProcessor = useCallback(async (
    inputFiles: ProcessingFile[],
    extraOpts: Record<string, unknown> = {}
  ) => {
    if (isDisabled) {
      addNotification({
        title: 'Tool Disabled',
        desc: 'This tool is temporarily disabled by administrator.',
        type: 'error',
      });
      return;
    }

    if (isMaintenance) {
      addNotification({
        title: 'Maintenance in Progress',
        desc: 'This tool is currently undergoing maintenance. Processing is paused.',
        type: 'info',
      });
      return;
    }

    if (accessRestricted) {
      addNotification({
        title: 'Premium Required',
        desc: restrictionReason || 'This tool requires a Premium subscription. Please upgrade to continue.',
        type: 'error',
      });
      return;
    }

    if (!dispatch) {
      const message = 'This tool does not have a processor in this build.';
      setFiles((prev) => prev.map((f) =>
        inputFiles.some((pf) => pf.id === f.id)
          ? { ...f, state: 'failed', progress: 0, error: message }
          : f
      ));
      return;
    }

    const mergedOpts = { ...options, ...extraOpts };

    if (dispatch.multiFile) {
      const fileList = inputFiles.map((pf) => pf.file);
      setFiles((prev) => prev.map((f, i) => i === 0 ? { ...f, state: 'processing', progress: 50 } : f));
      const startTime = Date.now();

      // Notify backend & Telegram that conversion started
      const totalSize = fileList.reduce((acc, f) => acc + f.size, 0);
      let startedJob: { id: string; job_token?: string; jobToken?: string } | null = null;
      try {
        startedJob = await apiClient.startJob({
          toolSlug: tool!.slug,
          toolName: tool!.name,
          inputFileName: fileList.map((f) => f.name).join(', '),
          inputFileSize: totalSize,
          inputFormat: tool!.supportedInputFormats?.[0] || 'file',
        });
      } catch {
        /* ignore telemetry error */
      }

      try {
        const result = await dispatch.processor(fileList, mergedOpts);
        const results = Array.isArray(result) ? result : [result];
        const durationMs = Date.now() - startTime;
        const completedAt = new Date();

        setFiles((prev) => prev.map((f, i) => i === 0 ? {
          ...f,
          state: 'completed',
          progress: 100,
          result: results[0],
          results: results.length > 1 ? results : undefined,
          durationMs,
          completedAt,
          jobId: startedJob?.id,
        } : { ...f, state: 'completed', progress: 100, durationMs, completedAt, jobId: startedJob?.id }));

        // Notify backend & Telegram that conversion completed
        if (startedJob?.id && results[0]) {
          apiClient.completeJob({
            id: startedJob.id,
            jobToken: startedJob.job_token || (startedJob as any).jobToken,
            outputFileName: results[0].filename,
            outputFileSize: results[0].blob.size,
            outputFormat: results[0].filename.split('.').pop() || '',
            durationMs,
          }).catch(() => {});
        }

        recordHistory({
          fileName: fileList.map((f) => f.name).join(', '),
          toolName: tool!.name,
          toolSlug: tool!.slug,
          category: tool!.category,
          size: (totalSize / (1024 * 1024)).toFixed(2) + ' MB',
          resultSize: results[0]?.meta?.outputSize
            ? ((results[0].meta.outputSize as number) / (1024 * 1024)).toFixed(2) + ' MB'
            : undefined,
          status: 'completed',
          processingType: tool!.processingMode === 'local' ? 'local' : 'cloud',
        });
        addNotification({
          title: `${tool!.name} completed`,
          desc: `${fileList.length} files processed successfully`,
          type: 'success',
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        const durationMs = Date.now() - startTime;

        if (startedJob?.id) {
          apiClient.failJob({
            id: startedJob.id,
            jobToken: startedJob.job_token || (startedJob as any).jobToken,
            durationMs,
            errorSummary: msg,
          }).catch(() => {});
        }

        setFiles((prev) => prev.map((f) => ({ ...f, state: 'failed', error: msg, durationMs })));
        recordHistory({
          fileName: fileList.map((f) => f.name).join(', '),
          toolName: tool!.name,
          toolSlug: tool!.slug,
          category: tool!.category,
          size: (totalSize / (1024 * 1024)).toFixed(2) + ' MB',
          status: 'failed',
          processingType: tool!.processingMode === 'local' ? 'local' : 'cloud',
        });
        addNotification({
          title: `${tool!.name} failed`,
          desc: msg,
          type: 'error',
        });
      }
    } else {
      for (const pf of inputFiles) {
        setFiles((prev) => prev.map((f) => f.id === pf.id ? { ...f, state: 'processing', progress: 10 } : f));
        const startTime = Date.now();

        let startedJob: { id: string; job_token?: string; jobToken?: string } | null = null;
        try {
          startedJob = await apiClient.startJob({
            toolSlug: tool!.slug,
            toolName: tool!.name,
            inputFileName: pf.file.name,
            inputFileSize: pf.file.size,
            inputFormat: pf.file.name.split('.').pop() || '',
          });
        } catch {
          /* ignore */
        }

        try {
          const progressInterval = setInterval(() => {
            setFiles((prev) => prev.map((f) => {
              if (f.id === pf.id && f.progress < 80) {
                return { ...f, progress: Math.min(f.progress + 15, 80) };
              }
              return f;
            }));
          }, 200);

          const result = await dispatch.processor([pf.file], mergedOpts);
          clearInterval(progressInterval);

          const durationMs = Date.now() - startTime;
          const completedAt = new Date();
          const results = Array.isArray(result) ? result : null;
          const primaryRes = Array.isArray(result) ? result[0] : result;

          if (startedJob?.id && primaryRes) {
            apiClient.completeJob({
              id: startedJob.id,
              jobToken: startedJob.job_token || (startedJob as any).jobToken,
              outputFileName: primaryRes.filename,
              outputFileSize: primaryRes.blob.size,
              outputFormat: primaryRes.filename.split('.').pop() || '',
              durationMs,
            }).catch(() => {});
          }

          setFiles((prev) => prev.map((f) => f.id === pf.id ? {
            ...f,
            state: 'completed',
            progress: 100,
            result: primaryRes,
            results: results && results.length > 1 ? results : undefined,
            durationMs,
            completedAt,
            jobId: startedJob?.id,
          } : f));

          recordHistory({
            fileName: pf.file.name,
            toolName: tool!.name,
            toolSlug: tool!.slug,
            category: tool!.category,
            size: (pf.file.size / (1024 * 1024)).toFixed(2) + ' MB',
            resultSize: primaryRes?.meta?.outputSize
              ? ((primaryRes.meta.outputSize as number) / (1024 * 1024)).toFixed(2) + ' MB'
              : undefined,
            status: 'completed',
            processingType: tool!.processingMode === 'local' ? 'local' : 'cloud',
          });
          addNotification({
            title: `${tool!.name} completed`,
            desc: `${pf.file.name} processed successfully`,
            type: 'success',
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Processing failed';
          const durationMs = Date.now() - startTime;

          if (startedJob?.id) {
            apiClient.failJob({
              id: startedJob.id,
              jobToken: startedJob.job_token || (startedJob as any).jobToken,
              durationMs,
              errorSummary: msg,
            }).catch(() => {});
          }

          setFiles((prev) => prev.map((f) => f.id === pf.id ? {
            ...f, state: 'failed', error: msg, progress: 0, durationMs,
          } : f));
          recordHistory({
            fileName: pf.file.name,
            toolName: tool!.name,
            toolSlug: tool!.slug,
            category: tool!.category,
            size: (pf.file.size / (1024 * 1024)).toFixed(2) + ' MB',
            status: 'failed',
            processingType: tool!.processingMode === 'local' ? 'local' : 'cloud',
          });
          addNotification({
            title: `${tool!.name} failed`,
            desc: msg,
            type: 'error',
          });
        }
      }
    }
  }, [dispatch, options, tool, addNotification]);

  const handleProcess = useCallback(async (inputFiles?: ProcessingFile[]) => {
    const filesToProcess = inputFiles ?? files;
    if (filesToProcess.length === 0) return;
    setIsRunning(true);
    setOverallState('processing');
    setActiveTab('result');
    await runProcessor(filesToProcess);
    setOverallState('completed');
    setIsRunning(false);
  }, [files, runProcessor]);

  const handleTextProcess = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    if (!slug) return;
    const file = new File([textInput], `${slug}-input.txt`, { type: 'text/plain' });
    const processingFile: ProcessingFile = { id: crypto.randomUUID(), file, state: 'idle', progress: 0 };
    setFiles([processingFile]);
    setIsRunning(true);
    setOverallState('processing');
    setActiveTab('result');
    void runProcessor([processingFile]).then(() => {
      setOverallState('completed');
      setIsRunning(false);
    });
  }, [slug, textInput, runProcessor]);

  const handleUrlProcess = useCallback(() => {
    if (!urlInput.trim()) return;
    const file = new File([''], `url-input.txt`, { type: 'text/plain' });
    const processingFile: ProcessingFile = { id: crypto.randomUUID(), file, state: 'idle', progress: 0 };
    setFiles([processingFile]);
    setIsRunning(true);
    setOverallState('processing');
    setActiveTab('result');
    void runProcessor([processingFile], { _url: urlInput.trim() }).then(() => {
      setOverallState('completed');
      setIsRunning(false);
    });
  }, [urlInput, runProcessor]);

  const handleReset = () => {
    setFiles([]);
    setOverallState('idle');
    setActiveTab('upload');
    setSignatureDataUrl('');
  };

  const setOption = (key: string, value: unknown) => setOptions((prev) => ({ ...prev, [key]: value }));

  const handleDeveloperProcess = useCallback(async (inputStr: string, extraOpts: Record<string, unknown> = {}): Promise<string> => {
    if (!dispatch) throw new Error('No processor available for this tool.');
    const dummyFile = new File([inputStr], `${slug || 'developer'}-input.txt`, { type: 'text/plain' });
    const mergedOpts = { ...options, ...extraOpts };
    const res = await dispatch.processor([dummyFile], mergedOpts);
    const single = Array.isArray(res) ? res[0] : res;
    return await single.blob.text();
  }, [dispatch, slug, options]);

  const acceptMap = useMemo(() => (tool?.supportedInputFormats ?? []).reduce(
    (acc, fmt) => {
      const mime = fmt === 'pdf' ? 'application/pdf'
        : fmt.startsWith('jp') ? 'image/jpeg'
        : fmt === 'png' ? 'image/png'
        : fmt === 'webp' ? 'image/webp'
        : fmt === 'gif' ? 'image/gif'
        : fmt === 'tiff' || fmt === 'tif' ? 'image/tiff'
        : fmt === 'bmp' ? 'image/bmp'
        : fmt === 'svg' ? 'image/svg+xml'
        : fmt === 'zip' ? 'application/zip'
        : fmt === 'csv' ? 'text/csv'
        : fmt === 'json' ? 'application/json'
        : fmt === 'txt' ? 'text/plain'
        : fmt === 'md' || fmt === 'markdown' ? 'text/markdown'
        : fmt === 'html' || fmt === 'htm' ? 'text/html'
        : fmt === 'xml' ? 'application/xml'
        : fmt === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : fmt === 'doc' ? 'application/msword'
        : fmt === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : fmt === 'xls' ? 'application/vnd.ms-excel'
        : fmt === 'epub' ? 'application/epub+zip'
        : fmt === 'mp4' ? 'video/mp4'
        : fmt === 'mov' ? 'video/quicktime'
        : fmt === 'mkv' ? 'video/x-matroska'
        : fmt === 'avi' ? 'video/x-msvideo'
        : fmt === 'webm' ? 'video/webm'
        : fmt === 'mp3' ? 'audio/mpeg'
        : fmt === 'wav' ? 'audio/wav'
        : fmt === 'aac' ? 'audio/aac'
        : fmt === 'm4a' ? 'audio/mp4'
        : fmt === 'flac' ? 'audio/flac'
        : fmt === 'ogg' ? 'audio/ogg'
        : 'application/octet-stream';
      if (!acc[mime]) acc[mime] = [];
      if (!acc[mime].includes(`.${fmt}`)) acc[mime].push(`.${fmt}`);
      return acc;
    },
    {} as Record<string, string[]>
  ), [tool?.supportedInputFormats]);

  // ── Derived variables (computed after all hooks) ──────────────────
  const toolNotFound = !tool;
  const meta = tool ? CATEGORY_META[tool.category] : CATEGORY_META['pdf'];
  // Text tools expose textPlaceholder without inputMode; URL tools use inputMode='url'/'url-or-file'
  const isTextTool = !!(dispatch?.textPlaceholder && !dispatch?.inputMode);
  const isUrlTool = dispatch?.inputMode === 'url' || dispatch?.inputMode === 'url-or-file';
  const isSignatureTool = tool?.slug === 'sign-pdf';
  const canRunEmptyText = false; // text tools always require input
  const completedCount = files.filter((f) => f.state === 'completed').length;
  const failedCount = files.filter((f) => f.state === 'failed').length;
  const relatedTools = tool ? getRelatedTools(tool) : [];

  // Truthful status label
  const statusLabel = implemented
    ? (tool?.processingMode === 'local' ? 'Local processor' : 'Cloud processor (backend required)')
    : 'Processor not yet available';

  const isFav = tool ? isFavoriteTool(tool.slug) : false;

  if (toolNotFound) {
    return (
      <div className="pt-14 min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="text-center">
          <AlertCircle size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
          <h1 className="text-2xl font-bold text-primary mb-2">Tool Not Found</h1>
          <p className="text-secondary mb-6">The tool &ldquo;{slug}&rdquo; does not exist in the catalog.</p>
          <Link to="/tools" className="btn-primary btn-md">Browse All Tools</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-14 min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Breadcrumb */}
      <div className="border-b" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="container-app py-3 flex items-center gap-2 text-xs text-muted-cv flex-wrap">
          <Link to="/" className="hover:text-primary transition-colors">Home</Link>
          <ChevronRight size={12} />
          <Link to="/tools" className="hover:text-primary transition-colors">Tools</Link>
          <ChevronRight size={12} />
          <Link to={`/tools/${tool.category}`} className="hover:text-primary transition-colors" style={{ color: meta.color }}>
            {meta.name}
          </Link>
          <ChevronRight size={12} />
          <span className="text-primary font-medium">{tool.name}</span>
          {implemented && tool.processingMode === 'local' && (
            <span className="ml-2 badge badge-success text-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-success-500 mr-1 inline-block" />
              Offline Ready
            </span>
          )}
          {implemented && tool.processingMode !== 'local' && (
            <span className="ml-2 badge badge-neutral text-2xs">
              <Cloud size={10} className="mr-1 inline-block" />
              Backend Required
            </span>
          )}
        </div>
      </div>

      <div className="container-app py-6">
        <div className="flex gap-6">
          {/* Main workspace */}
          <div className="flex-1 min-w-0">
            {/* Tool header */}
            <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 flex items-center justify-center rounded-xl flex-shrink-0 text-2xl font-bold"
                  style={{ backgroundColor: meta.color + '15', color: meta.color }}
                >
                  {tool.name[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h1 className="text-2xl font-bold text-primary">{tool.name}</h1>
                    {tool.new && <span className="badge" style={{ backgroundColor: meta.color + '15', color: meta.color }}>New</span>}
                    {tool.premium && <span className="badge" style={{ backgroundColor: '#f59e0b15', color: '#f59e0b' }}>Premium</span>}
                    {tool.status === 'beta' && <span className="badge badge-neutral">Beta</span>}
                  </div>
                  <p className="text-secondary">{tool.description}</p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {implemented && tool.processingMode === 'local' ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-success-600">
                        <WifiOff size={12} /> Processes locally on your device
                      </span>
                    ) : implemented ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#3b82f6' }}>
                        <Cloud size={12} /> Requires backend service
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        <AlertCircle size={12} /> Processor not available in this build
                      </span>
                    )}
                    {tool.batchSupported && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-cv">
                        <Layers size={12} /> Batch supported
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggleFavoriteTool(tool!.slug)} className="btn-secondary btn-sm gap-1.5">
                  <Star size={13} className={isFav ? 'fill-current text-warning-500' : ''} />
                  {isFav ? 'Saved' : 'Save'}
                </button>
                <button
                  onClick={() => { navigator.clipboard.writeText(window.location.href); }}
                  className="btn-secondary btn-sm gap-1.5"
                  title="Copy link"
                >
                  <Copy size={13} />
                  Share
                </button>
              </div>
            </div>

            {/* Disabled Banner */}
            {isDisabled && (
              <div
                className="p-5 rounded-2xl border mb-6 flex items-start gap-4 animate-slide-down"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  borderColor: 'rgba(239, 68, 68, 0.25)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}
                >
                  <AlertCircle size={20} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-primary">Tool Temporarily Disabled</h3>
                    <span className="badge text-2xs uppercase tracking-wider font-semibold" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                      Admin Locked
                    </span>
                  </div>
                  <p className="text-xs text-secondary leading-relaxed mb-3">
                    This tool has been temporarily taken offline by the administrator for updates or configuration. Processing is temporarily disabled.
                  </p>
                  <Link
                    to="/tools"
                    className="btn-secondary btn-sm gap-1.5 font-bold text-xs inline-flex items-center"
                  >
                    <ArrowLeft size={13} /> Browse Other Tools
                  </Link>
                </div>
              </div>
            )}

            {/* Maintenance Banner */}
            {isMaintenance && !isDisabled && (
              <div
                className="p-5 rounded-2xl border mb-6 flex items-start gap-4 animate-slide-down"
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  borderColor: 'rgba(245, 158, 11, 0.25)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}
                >
                  <RefreshCw size={20} className="animate-spin text-amber-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-primary">Scheduled Maintenance in Progress</h3>
                    <span className="badge text-2xs uppercase tracking-wider font-semibold" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                      Maintenance
                    </span>
                  </div>
                  <p className="text-xs text-secondary leading-relaxed">
                    This conversion module is currently undergoing planned maintenance to improve reliability and speed. Conversion queues are temporarily paused.
                  </p>
                </div>
              </div>
            )}

            {/* Premium Locked Banner */}
            {accessRestricted && (
              <div
                className="p-5 rounded-2xl border mb-6 flex items-start gap-4 animate-slide-down"
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  borderColor: 'rgba(245, 158, 11, 0.25)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}
                >
                  <Lock size={20} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-primary">Premium Feature Restricted</h3>
                    <span className="badge text-2xs uppercase tracking-wider font-semibold" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                      Pro Required
                    </span>
                  </div>
                  <p className="text-xs text-secondary leading-relaxed mb-3">
                    {restrictionReason || 'This conversion tool has been configured for Premium members only by the system administrator. Upgrade your plan to unlock unlimited batch processing.'}
                  </p>
                  <Link
                    to="/pricing"
                    className="btn-primary btn-sm gap-1.5 font-bold text-xs inline-flex items-center"
                    style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b', color: '#ffffff' }}
                  >
                    <Zap size={13} className="fill-current" /> View Upgrade Options
                  </Link>
                </div>
              </div>
            )}

            {/* Developer Workspace & Barcode Workspace Special Views */}
            {tool.category === 'developer' ? (
              <DeveloperWorkspace
                tool={tool}
                dispatch={dispatch!}
                onProcess={handleDeveloperProcess}
                options={options}
                setOption={setOption}
                color={meta.color}
              />
            ) : tool.slug === 'barcode-generator' ? (
              <BarcodeWorkspace color={meta.color} />
            ) : (
              <>
                {/* Guided Workflow Stepper */}
                <nav aria-label="Tool steps" className="mb-6 p-1.5 rounded-xl border flex items-center gap-1 sm:gap-2 flex-wrap" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                  {/* Step 1: Input */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('upload')}
                    className={`flex-1 min-w-[130px] flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'upload' ? 'shadow-sm' : 'hover:bg-hover-cv opacity-80 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: activeTab === 'upload' ? `${meta.color}15` : 'transparent',
                      color: activeTab === 'upload' ? meta.color : 'var(--text-secondary)',
                    }}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-2xs font-bold"
                      style={{
                        backgroundColor: files.length > 0 || urlInput || textInput ? '#22c55e' : (activeTab === 'upload' ? meta.color : 'var(--muted)'),
                        color: files.length > 0 || urlInput || textInput || activeTab === 'upload' ? '#ffffff' : 'var(--text-muted)',
                      }}
                    >
                      {files.length > 0 || urlInput || textInput ? <Check size={11} strokeWidth={3} /> : '1'}
                    </span>
                    <span className="truncate">1. Configure &amp; Upload</span>
                    {files.length > 0 && (
                      <span className="badge badge-success text-2xs ml-auto" style={{ fontSize: '10px' }}>
                        {files.length} ready
                      </span>
                    )}
                  </button>

                  <ChevronRight size={13} className="text-muted-cv hidden sm:block flex-shrink-0" />

                  {/* Step 2: Result */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('result')}
                    className={`flex-1 min-w-[130px] flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'result' ? 'shadow-sm' : 'hover:bg-hover-cv opacity-80 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: activeTab === 'result' ? `${meta.color}15` : 'transparent',
                      color: activeTab === 'result' ? meta.color : 'var(--text-secondary)',
                    }}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-2xs font-bold"
                      style={{
                        backgroundColor: completedCount > 0 ? '#22c55e' : (activeTab === 'result' ? meta.color : 'var(--muted)'),
                        color: completedCount > 0 || activeTab === 'result' ? '#ffffff' : 'var(--text-muted)',
                      }}
                    >
                      {completedCount > 0 ? <Check size={11} strokeWidth={3} /> : '2'}
                    </span>
                    <span className="truncate">2. Results &amp; Download</span>
                    {completedCount > 0 && (
                      <span className="badge badge-success text-2xs ml-auto" style={{ fontSize: '10px' }}>
                        {completedCount} done
                      </span>
                    )}
                  </button>
                </nav>

                {/* Upload / Input tab */}
                {activeTab === 'upload' && (
                  <div className="space-y-5">
                    {/* Privacy reminder banner */}
                    <div
                      className="p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs"
                      style={{
                        backgroundColor: implemented && tool.processingMode === 'local' ? '#22c55e08' : '#3b82f608',
                        borderColor: implemented && tool.processingMode === 'local' ? '#22c55e25' : '#3b82f625',
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        {implemented && tool.processingMode === 'local' ? (
                          <WifiOff size={16} className="text-success-600 flex-shrink-0" />
                        ) : (
                          <Cloud size={16} style={{ color: '#3b82f6' }} className="flex-shrink-0" />
                        )}
                        <span className="text-secondary">
                          {implemented && tool.processingMode === 'local'
                            ? 'Files are processed 100% locally on your computer. Zero uploads, total privacy.'
                            : 'Processes securely via companion backend service.'}
                        </span>
                      </div>
                      {tool.batchSupported && (
                        <span className="badge badge-neutral text-2xs flex-shrink-0">
                          Batch Enabled
                        </span>
                      )}
                    </div>

                    {/* Inline Configuration Directly on the File Upload Page */}
                    {dispatch?.optionFields && dispatch.optionFields.length > 0 && (
                      <div
                        className="p-5 rounded-2xl border shadow-sm space-y-4"
                        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                      >
                        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                          <div className="flex items-center gap-2">
                            <Settings size={16} style={{ color: meta.color }} />
                            <h2 className="text-sm font-bold text-primary">Configuration &amp; Output Settings</h2>
                          </div>
                          <span className="text-2xs text-muted-cv">Adjust options before processing</span>
                        </div>

                        {/* Quick Presets Bar (Smallest File, Balanced, Best Quality) */}
                        {TOOL_PRESETS[tool.slug] && (
                          <div className="space-y-1.5">
                            <label className="text-2xs font-semibold uppercase tracking-wider text-muted-cv">
                              Quality &amp; Compression Presets
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {TOOL_PRESETS[tool.slug].map((pr) => (
                                <button
                                  key={pr.label}
                                  type="button"
                                  onClick={() => {
                                    setOptions((prev) => ({ ...prev, ...pr.values }));
                                  }}
                                  className="p-2.5 rounded-xl border text-left transition-all hover:border-accent hover:bg-hover-cv"
                                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
                                >
                                  <p className="text-xs font-semibold text-primary">{pr.label}</p>
                                  <p className="text-2xs text-muted-cv mt-0.5">{pr.desc}</p>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <OptionsPanel
                          fields={dispatch.optionFields}
                          values={options}
                          onChange={setOption}
                          onReset={() => {
                            const defaults: Record<string, unknown> = {};
                            dispatch.optionFields?.forEach((f) => { defaults[f.key] = f.default; });
                            setOptions(defaults);
                          }}
                          hint={dispatch.optionsHint}
                          color={meta.color}
                        />
                      </div>
                    )}

                    {/* URL input mode */}
                    {isUrlTool && (
                      <UrlInputPanel
                        value={urlInput}
                        onChange={setUrlInput}
                        onSubmit={handleUrlProcess}
                        isRunning={isRunning}
                        color={meta.color}
                        hint={dispatch?.optionsHint}
                      />
                    )}

                    {/* Text input mode */}
                    {isTextTool && (
                      <form onSubmit={handleTextProcess} className="space-y-3">
                        <label htmlFor="tool-text-input" className="label">Input Text</label>
                        <textarea
                          id="tool-text-input"
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                          placeholder={dispatch?.textPlaceholder}
                          rows={8}
                          className="input-lg w-full resize-y font-mono text-sm"
                        />
                        <div className="flex items-center gap-3">
                          <button
                            type="submit"
                            disabled={isRunning || (!textInput.trim() && !canRunEmptyText)}
                            className="btn-primary btn-lg gap-2"
                            style={{ backgroundColor: meta.color, opacity: isRunning ? 0.7 : 1 }}
                          >
                            {isRunning ? <><Loader2 size={16} className="animate-spin" />Processing…</> : <><Sparkles size={16} />{tool.name}</>}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* File upload mode */}
                    {!isTextTool && !isUrlTool && (
                      <>
                        {/* Signature pad (for sign-pdf) */}
                        {isSignatureTool && (
                          <div className="mb-4">
                            <SignaturePad
                              color={meta.color}
                              onSignature={(dataUrl) => {
                                setSignatureDataUrl(dataUrl);
                                setOption('signatureDataUrl', dataUrl);
                              }}
                            />
                          </div>
                        )}

                        {tool.inputTypes?.includes('camera') && (
                          <CameraCapture
                            onCapture={(capturedFile) => handleFiles([capturedFile])}
                            color={meta.color}
                          />
                        )}

                        <UploadZone
                          onFiles={handleFiles}
                          multiple={tool.batchSupported || dispatch?.multiFile}
                          supportedFormats={tool.supportedInputFormats}
                          color={meta.color}
                          accept={acceptMap}
                          disabled={isDisabled || isMaintenance}
                          disabledReason={isDisabled ? 'Tool is temporarily disabled by administrator' : isMaintenance ? 'Tool is currently under scheduled maintenance' : undefined}
                        />
                      </>
                    )}

                    {/* Selected File list & Direct Process Action */}
                    {!isTextTool && !isUrlTool && files.length > 0 && (
                      <div className="space-y-3 pt-2">
                        {/* High-visibility Action Banner */}
                        <div
                          className="p-4 rounded-xl border flex items-center justify-between flex-wrap gap-4"
                          style={{ backgroundColor: 'var(--card)', borderColor: `${meta.color}40`, boxShadow: `0 2px 12px ${meta.color}10` }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                              style={{ backgroundColor: meta.color }}
                            >
                              <Sparkles size={18} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-primary">
                                {files.length} file{files.length !== 1 ? 's' : ''} ready to process
                              </p>
                              <p className="text-xs text-muted-cv">
                                Configuration applied. Click Process to convert.
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleProcess()}
                              disabled={isRunning || (isSignatureTool && !signatureDataUrl)}
                              className="btn-primary btn-md gap-2 font-bold shadow-md"
                              style={{ backgroundColor: meta.color }}
                            >
                              {isRunning ? (
                                <><Loader2 size={16} className="animate-spin" />Processing…</>
                              ) : (
                                <><Sparkles size={16} />Process File<ArrowRight size={14} /></>
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <p className="text-xs font-semibold text-muted-cv uppercase tracking-wider">
                            Selected Files ({files.length})
                          </p>
                          <button
                            onClick={() => setFiles([])}
                            className="text-xs text-muted-cv hover:text-error-600 transition-colors flex items-center gap-1"
                          >
                            <Trash2 size={11} /> Clear all
                          </button>
                        </div>

                        <div className="space-y-2">
                          {files.map((pf) => (
                            <FileItem key={pf.id} pf={pf} color={meta.color} onRemove={handleRemove} onDownload={handleDownload} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Not implemented notice */}
                    {!implemented && (
                      <div className="flex items-start gap-3 p-4 rounded-xl border mt-4"
                        style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
                      >
                        <AlertCircle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <p className="text-sm font-medium text-primary mb-1">Processor preview</p>
                          <p className="text-xs text-muted-cv leading-relaxed">
                            This tool is registered in the catalog and will execute once its dedicated engine is connected.
                            No mock or fake conversion outputs are produced.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Result tab */}
            {activeTab === 'result' && (
              <div className="space-y-4">
                {/* Idle empty state */}
                {overallState === 'idle' && (
                  <div className="flex flex-col items-center justify-center py-16 px-4 rounded-xl border text-center gap-4"
                    style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                  >
                    <div className="w-16 h-16 flex items-center justify-center rounded-2xl"
                      style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
                    >
                      <Upload size={28} />
                    </div>
                    <div className="max-w-md">
                      <h3 className="font-semibold text-primary text-base">Ready to start conversion</h3>
                      <p className="text-xs text-muted-cv mt-1.5 leading-relaxed">
                        {isUrlTool
                          ? 'Enter a web URL in Step 1 to analyze and export results.'
                          : isTextTool
                          ? 'Enter your input text in Step 1 to generate output.'
                          : 'Select or drag your files into Step 1 to begin. Processed results will appear here with direct download links.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('upload')}
                      className="btn-primary btn-md gap-2"
                      style={{ backgroundColor: meta.color }}
                    >
                      <Upload size={14} />
                      Go to Step 1: {isUrlTool ? 'Enter URL' : 'Select Files'}
                    </button>
                  </div>
                )}

                {/* Processing State */}
                {overallState === 'processing' && (
                  <div
                    className="p-8 rounded-xl border flex flex-col items-center justify-center text-center gap-4"
                    style={{ backgroundColor: 'var(--card)', borderColor: `${meta.color}40` }}
                  >
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-white"
                      style={{ backgroundColor: meta.color }}
                    >
                      <Loader2 size={26} className="animate-spin" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-primary">Converting your files...</h3>
                      <p className="text-xs text-muted-cv mt-1 max-w-sm">
                        {tool.processingMode === 'local'
                          ? 'Processing directly in your browser. Your files never leave this device.'
                          : 'Sending task securely to the conversion service.'}
                      </p>
                    </div>
                    <div className="w-full max-w-md progress-bar">
                      <div className="progress-fill" style={{ width: '65%', backgroundColor: meta.color }} />
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-2xs text-muted-cv">Please keep this browser window open</p>
                      <button
                        type="button"
                        onClick={handleReset}
                        className="text-xs text-error-600 hover:underline font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Completed State with Premium Download Center */}
                {overallState === 'completed' && (
                  <>
                    {completedCount > 0 && (
                      <DownloadCenter
                        files={files
                          .filter((f) => f.state === 'completed')
                          .map((f) => ({
                            id: f.id,
                            originalFile: f.file,
                            result: f.result,
                            results: f.results,
                            durationMs: f.durationMs || 1000,
                            completedAt: f.completedAt || new Date(),
                            jobId: f.jobId,
                          }))}
                        toolName={tool.name}
                        toolSlug={tool.slug}
                        categoryColor={meta.color}
                        onRetry={handleReset}
                        onClear={handleReset}
                      />
                    )}

                    {/* Friendly Error Banner when failures occur */}
                    {failedCount > 0 && (
                      <div
                        className="p-5 rounded-xl border space-y-3 mt-4"
                        style={{ backgroundColor: '#ef444408', borderColor: '#ef444430' }}
                      >
                        <div className="flex items-start gap-3">
                          <AlertCircle size={20} className="text-error-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-semibold text-error-600">
                              {parseFriendlyError(files.find((f) => f.state === 'failed')?.error, tool.processingMode !== 'local').headline}
                            </h4>
                            <p className="text-xs text-secondary mt-1">
                              {parseFriendlyError(files.find((f) => f.state === 'failed')?.error, tool.processingMode !== 'local').detail}
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t text-xs text-muted-cv space-y-1.5" style={{ borderColor: '#ef444420' }}>
                          <p className="font-semibold text-primary">Suggested next actions:</p>
                          <ul className="list-disc list-inside space-y-1 pl-1">
                            {parseFriendlyError(files.find((f) => f.state === 'failed')?.error, tool.processingMode !== 'local').tips.map((tip, idx) => (
                              <li key={idx}>{tip}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <button
                            onClick={() => {
                              setActiveTab('upload');
                              void handleProcess();
                            }}
                            className="btn-primary btn-sm gap-1.5"
                            style={{ backgroundColor: meta.color }}
                          >
                            <RefreshCw size={13} /> Try Again
                          </button>
                          <button
                            onClick={handleReset}
                            className="btn-secondary btn-sm gap-1.5"
                          >
                            <Upload size={13} /> Choose Another File
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Fallback item list if no download center displayed */}
                    {completedCount === 0 && files.length > 0 && (
                      <div className="space-y-2 mt-4">
                        {files.map((pf) => (
                          <FileItem key={pf.id} pf={pf} color={meta.color} onRemove={handleRemove} onDownload={handleDownload} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <aside className="hidden xl:flex flex-col gap-4 w-64 flex-shrink-0">
            {/* Privacy indicator */}
            <div className="p-4 rounded-xl border"
              style={{
                backgroundColor: implemented && tool.processingMode === 'local' ? '#22c55e08' : '#3b82f608',
                borderColor: implemented && tool.processingMode === 'local' ? '#22c55e30' : '#3b82f630',
              }}
            >
              <div className="flex items-start gap-3">
                {implemented && tool.processingMode === 'local'
                  ? <WifiOff size={16} style={{ color: '#22c55e', flexShrink: 0, marginTop: 2 }} />
                  : <Shield size={16} style={{ color: '#3b82f6', flexShrink: 0, marginTop: 2 }} />
                }
                <div>
                  <p className="text-xs font-semibold mb-1"
                    style={{ color: implemented && tool.processingMode === 'local' ? '#22c55e' : '#3b82f6' }}
                  >
                    {implemented && tool.processingMode === 'local' ? 'LOCAL PROCESSING' : 'CLOUD / BACKEND'}
                  </p>
                  <p className="text-xs text-muted-cv leading-relaxed">
                    {implemented && tool.processingMode === 'local'
                      ? 'Your file stays on this device. Nothing is uploaded.'
                      : 'Processed via the configured backend service. Requires VITE_BACKEND_URL.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Tool info */}
            <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold text-primary mb-3">Tool Information</p>
              <div className="space-y-2">
                {[
                  { label: 'Category', value: meta.name },
                  { label: 'Processing', value: tool.processingMode === 'local' ? 'Local (browser)' : 'Backend service' },
                  { label: 'Batch', value: tool.batchSupported ? 'Supported' : 'Not supported' },
                  { label: 'Plan', value: tool.premium ? 'Premium' : 'Free' },
                  { label: 'Status', value: tool.status === 'stable' ? 'Stable' : tool.status === 'beta' ? 'Beta' : 'Coming soon' },
                  { label: 'Engine', value: statusLabel },
                ].map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-2">
                    <span className="text-xs text-muted-cv flex-shrink-0">{item.label}</span>
                    <span className="text-xs font-medium text-primary text-right">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Formats */}
            {(tool.supportedInputFormats || tool.supportedOutputFormats) && (
              <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold text-primary mb-3">Supported Formats</p>
                {tool.supportedInputFormats && (
                  <div className="mb-3">
                    <p className="text-2xs text-muted-cv mb-1.5 uppercase tracking-wider font-semibold">Input</p>
                    <div className="flex flex-wrap gap-1">
                      {tool.supportedInputFormats.map((fmt) => (
                        <span key={fmt} className="text-2xs px-1.5 py-0.5 rounded font-mono uppercase border"
                          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)', color: 'var(--text-muted)', fontSize: '10px' }}
                        >
                          {fmt}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {tool.supportedOutputFormats && (
                  <div>
                    <p className="text-2xs text-muted-cv mb-1.5 uppercase tracking-wider font-semibold">Output</p>
                    <div className="flex flex-wrap gap-1">
                      {tool.supportedOutputFormats.map((fmt) => (
                        <span key={fmt} className="text-2xs px-1.5 py-0.5 rounded font-mono uppercase"
                          style={{ backgroundColor: meta.color + '15', color: meta.color, fontSize: '10px' }}
                        >
                          {fmt}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Related tools */}
            {relatedTools.length > 0 && (
              <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold text-primary mb-3">Related Tools</p>
                <div className="space-y-2">
                  {relatedTools.slice(0, 5).map((rt) => {
                    const rtMeta = CATEGORY_META[rt.category];
                    return (
                      <Link key={rt.id} to={`/tool/${rt.slug}`}
                        className="flex items-center gap-2.5 p-2 rounded-lg transition-all duration-150 group"
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <div className="w-6 h-6 flex items-center justify-center rounded-md flex-shrink-0 text-xs font-bold"
                          style={{ backgroundColor: rtMeta.color + '15', color: rtMeta.color }}
                        >
                          {rt.name[0]}
                        </div>
                        <span className="text-xs font-medium text-primary truncate">{rt.name}</span>
                        <ArrowRight size={11} className="ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: rtMeta.color }}
                        />
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default ToolPage;
