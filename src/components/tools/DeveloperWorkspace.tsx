import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Copy, Check, Trash2, ClipboardPaste, Download, Play, RefreshCw,
  AlertCircle, Sparkles, Upload, Maximize2, Minimize2,
} from 'lucide-react';
import type { Tool } from '@/registry/tools';
import type { ToolDispatch } from '@/lib/toolDispatch';

interface DeveloperWorkspaceProps {
  tool: Tool;
  dispatch: ToolDispatch;
  onProcess: (input: string, options: Record<string, unknown>) => Promise<string>;
  options: Record<string, unknown>;
  setOption: (key: string, value: unknown) => void;
  color: string;
}

const TOOL_SAMPLES: Record<string, string> = {
  'json-formatter': '{\n  "app": "CONVET PULSE",\n  "version": "2.0.0",\n  "status": "production",\n  "features": ["42 conversion tools", "100% offline privacy", "real encryption validation"],\n  "config": {\n    "port": 5000,\n    "ssl": true\n  }\n}',
  'sql-formatter': 'select u.id, u.email, u.created_at, count(j.id) as total_jobs, sum(case when j.status = \'completed\' then 1 else 0 end) as successful_conversions from users u left join jobs j on u.id = j.user_id where u.active = 1 and u.created_at >= \'2026-01-01\' group by u.id, u.email, u.created_at having count(j.id) > 5 order by total_jobs desc limit 25;',
  'diff-checker': '===ORIGINAL===\nfunction processFile(file, options) {\n  console.log("Processing " + file.name);\n  return convertLegacy(file);\n}\n===MODIFIED===\nasync function processFile(file, options = {}) {\n  const startTime = Date.now();\n  console.log(`Processing ${file.name} with options:`, options);\n  const result = await convertModern(file, options);\n  console.log(`Finished in ${Date.now() - startTime}ms`);\n  return result;\n}',
  'hash-generator': 'CONVET PULSE - High Performance Developer Studio & Cryptographic Checksum Engine 2026',
  'base64-encoder-decoder': 'CONVET PULSE delivers 100% private, client-side browser file conversion and developer utilities with zero data leaks.',
  'url-encoder-decoder': 'https://convetpulse.onrender.com/tools/developer?category=Developer Studio&filter=code & format#quick-run',
  'uuid-generator': 'Click Process or press Ctrl+Enter to generate a batch of cryptographically secure RFC 4122 v4 UUIDs.',
  'regex-tester': '===PATTERN===\n\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b\n===TEST_STRING===\nContact our support team at support@convetpulse.com or security audit lead at audit-sec@company.org. Billing queries: billing@payments.io.',
  'jwt-decoder': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlNyaWRoYXIgViIsImlhdCI6MTUxNjIzOTAyMiwiZXhwIjoyMDgwMDAwMDAwLCJyb2xlIjoiYWRtaW4iLCJwcmVtaXVtIjp0cnVlfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
};

export const DeveloperWorkspace: React.FC<DeveloperWorkspaceProps> = ({
  tool,
  dispatch,
  onProcess,
  options,
  setOption,
  color,
}) => {
  const [input, setInput] = useState<string>(() => TOOL_SAMPLES[tool.slug] || dispatch.textPlaceholder || '');
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState(false);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [fullWidth, setFullWidth] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute line numbers
  const inputLines = input.split('\n').length;
  const outputLines = output ? output.split('\n').length : 1;

  const handleProcess = useCallback(async () => {
    if (!input.trim() && tool.slug !== 'uuid-generator') {
      setError('Please provide input text or load a sample first.');
      return;
    }
    setError(null);
    setIsProcessing(true);
    const start = performance.now();
    try {
      const result = await onProcess(input, options);
      setOutput(result);
      setDurationMs(Math.round(performance.now() - start));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setOutput('');
    } finally {
      setIsProcessing(false);
    }
  }, [input, tool.slug, onProcess, options]);

  // Keyboard shortcut: Ctrl+Enter or Cmd+Enter to run
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        void handleProcess();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleProcess]);

  const handleCopy = async () => {
    if (!output) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(output);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = output;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Unable to copy to clipboard.');
    }
  };

  const handlePaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setInput(text);
          setPasted(true);
          setTimeout(() => setPasted(false), 2000);
          setError(null);
        }
      } else {
        inputRef.current?.focus();
      }
    } catch {
      inputRef.current?.focus();
    }
  };

  const handleClear = () => {
    setInput('');
    setError(null);
    inputRef.current?.focus();
  };

  const handleClearOutput = () => {
    setOutput('');
    setError(null);
    setDurationMs(null);
  };

  const handleLoadSample = () => {
    const sample = TOOL_SAMPLES[tool.slug] || dispatch.textPlaceholder || '';
    setInput(sample);
    setError(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (typeof text === 'string') {
        setInput(text);
        setError(null);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownload = () => {
    if (!output) return;
    const ext = tool.slug === 'json-formatter' ? 'json'
      : tool.slug === 'sql-formatter' ? 'sql'
      : tool.slug === 'diff-checker' ? 'diff'
      : 'txt';
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tool.slug}_output.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top action / configuration bar */}
      <div
        className="p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => void handleProcess()}
            disabled={isProcessing}
            className="btn-primary btn-md gap-2 font-bold shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: color, color: '#ffffff' }}
          >
            {isProcessing ? (
              <RefreshCw size={15} className="animate-spin" />
            ) : (
              <Play size={15} className="fill-current" />
            )}
            <span>Process</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-2xs rounded bg-white/20 font-mono">
              Ctrl+Enter
            </kbd>
          </button>

          <button
            type="button"
            onClick={handleLoadSample}
            className="btn-secondary btn-sm gap-1.5"
            title="Load standard sample input"
          >
            <Sparkles size={13} style={{ color }} />
            Load Sample
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.json,.sql,.js,.ts,.csv,.xml,.html,.md"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary btn-sm gap-1.5"
            title="Load input from local file"
          >
            <Upload size={13} />
            Import File
          </button>
        </div>

        {/* Dynamic Tool Options Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {dispatch.optionFields?.map((field) => (
            <div key={field.key} className="flex items-center gap-2">
              <label className="text-xs text-muted-cv font-medium">{field.label}:</label>
              {field.type === 'select' && (
                <select
                  value={String(options[field.key] ?? field.default)}
                  onChange={(e) => setOption(field.key, e.target.value)}
                  className="input-sm text-xs py-1 px-2.5 rounded-lg border font-medium"
                  style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
                >
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
              {field.type === 'checkbox' && (
                <input
                  type="checkbox"
                  checked={Boolean(options[field.key] ?? field.default)}
                  onChange={(e) => setOption(field.key, e.target.checked)}
                  className="checkbox checkbox-sm"
                />
              )}
              {field.type === 'number' && (
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  value={Number(options[field.key] ?? field.default)}
                  onChange={(e) => setOption(field.key, Number(e.target.value))}
                  className="input-sm text-xs py-1 px-2.5 w-16 rounded-lg border font-mono"
                  style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
                />
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => setFullWidth((prev) => !prev)}
            className="btn-ghost btn-sm p-1.5 text-muted-cv hover:text-primary"
            title={fullWidth ? 'Split View' : 'Full Width'}
          >
            {fullWidth ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          className="p-3.5 rounded-xl border flex items-start gap-3 animate-slide-down text-xs"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            borderColor: 'rgba(239, 68, 68, 0.25)',
            color: '#ef4444',
          }}
        >
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1 font-mono leading-relaxed whitespace-pre-wrap">{error}</div>
        </div>
      )}

      {/* Split Pane Editor Playground */}
      <div className={`grid gap-4 ${fullWidth ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
        {/* Left Panel: Input Editor */}
        <div
          className="rounded-2xl border flex flex-col overflow-hidden shadow-sm"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          {/* Header */}
          <div
            className="px-4 py-2.5 border-b flex items-center justify-between text-xs"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2 font-semibold text-primary">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span>Input</span>
              <span className="text-2xs text-muted-cv font-mono">
                {inputLines} {inputLines === 1 ? 'line' : 'lines'} · {input.length} chars
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePaste}
                className="btn-ghost btn-xs gap-1 text-muted-cv hover:text-primary"
                title="Paste from clipboard"
              >
                {pasted ? <Check size={12} className="text-success-500" /> : <ClipboardPaste size={12} />}
                <span>{pasted ? 'Pasted' : 'Paste'}</span>
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="btn-ghost btn-xs gap-1 text-muted-cv hover:text-danger-500"
                title="Clear input"
              >
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Textarea Area */}
          <div className="relative flex-1 min-h-[380px] flex">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste or type input text here..."
              spellCheck={false}
              className="w-full h-full min-h-[380px] p-4 font-mono text-xs leading-relaxed resize-y focus:outline-none"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        {/* Right Panel: Output Editor */}
        <div
          className="rounded-2xl border flex flex-col overflow-hidden shadow-sm"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          {/* Header */}
          <div
            className="px-4 py-2.5 border-b flex items-center justify-between text-xs"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2 font-semibold text-primary">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Output</span>
              {durationMs !== null && (
                <span className="badge badge-success text-2xs py-0 px-1.5">
                  {durationMs}ms
                </span>
              )}
              {output && (
                <span className="text-2xs text-muted-cv font-mono">
                  {outputLines} {outputLines === 1 ? 'line' : 'lines'} · {output.length} chars
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!output}
                className="btn-ghost btn-xs gap-1 text-muted-cv hover:text-primary disabled:opacity-40"
                title="Copy output to clipboard"
              >
                {copied ? <Check size={12} className="text-success-500" /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!output}
                className="btn-ghost btn-xs gap-1 text-muted-cv hover:text-primary disabled:opacity-40"
                title="Download output file"
              >
                <Download size={12} />
                <span>Save</span>
              </button>
              <button
                type="button"
                onClick={handleClearOutput}
                disabled={!output}
                className="btn-ghost btn-xs gap-1 text-muted-cv hover:text-danger-500 disabled:opacity-40"
                title="Clear output"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* Textarea Area */}
          <div className="relative flex-1 min-h-[380px] flex">
            {output ? (
              <textarea
                readOnly
                value={output}
                spellCheck={false}
                className="w-full h-full min-h-[380px] p-4 font-mono text-xs leading-relaxed resize-y focus:outline-none"
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                }}
              />
            ) : (
              <div className="w-full flex flex-col items-center justify-center p-8 text-center text-muted-cv">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                  style={{ backgroundColor: 'var(--muted)' }}
                >
                  <Sparkles size={20} className="text-muted-cv" />
                </div>
                <p className="text-xs font-medium text-secondary mb-1">No Output Generated Yet</p>
                <p className="text-2xs text-muted-cv max-w-xs">
                  Press &ldquo;Process&rdquo; above or use Ctrl+Enter to evaluate the input snippet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

