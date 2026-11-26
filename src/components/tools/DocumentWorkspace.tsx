// ============================================================
// CONVET PULSE — Document Studio Interactive Workspace
// Rich Document Editor, Markdown Previewer, HTML Sandbox,
// Template Scaffolding, and Universal Format Exporter
// ============================================================

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  FileText, Bold, Italic, Underline, Heading1, Heading2, Heading3,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Download, Upload, RefreshCw, Copy, Check, Eye, EyeOff,
  Search, Replace, Sparkles, AlertTriangle, FileCode, BookOpen,
  Maximize2, Minimize2, Trash2, ArrowLeftRight, HelpCircle
} from 'lucide-react';
import type { Tool } from '@/registry/tools';
import {
  DOCUMENT_TEMPLATES,
  calculateDocumentStats,
  createDocxDocument,
  markdownToHtml,
  markdownToPdf,
  textToRtf,
  rtfToText,
  extractDocxContent,
  sanitizeHtml
} from '@/lib/documentStudio';
import { nativeSaveFile } from '@/lib/platform';

interface DocumentWorkspaceProps {
  tool: Tool;
  color: string;
}

export const DocumentWorkspace: React.FC<DocumentWorkspaceProps> = ({ tool, color }) => {
  const [title, setTitle] = useState('Untitled Document');
  const [content, setContent] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeMode, setActiveMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Find & Replace State
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Set initial content based on tool
  useEffect(() => {
    if (tool.slug === 'docx-creator') {
      const defaultTmpl = DOCUMENT_TEMPLATES.find((t) => t.id === 'letter');
      if (defaultTmpl && !content) {
        setTitle(defaultTmpl.defaultTitle);
        setContent(defaultTmpl.content);
      }
    } else if (tool.slug === 'markdown-editor' && !content) {
      setTitle('Markdown Notes');
      setContent(
        `# Welcome to Markdown Studio\n\nWrite with **bold**, *italics*, and [links](https://convetpulse.onrender.com).\n\n## Key Features\n- Live split preview\n- Export to DOCX, HTML, or PDF\n- 100% private in-browser editing\n\n> "Simplicity is prerequisite for reliability." — Edsger W. Dijkstra\n\n\`\`\`javascript\nconsole.log("Hello from CONVET PULSE!");\n\`\`\``
      );
    } else if (tool.slug === 'html-editor' && !content) {
      setTitle('Document Page');
      setContent(
        `<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; padding: 24px; }\n    h1 { color: #0284c7; }\n    .badge { background: #e0f2fe; color: #0369a1; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }\n  </style>\n</head>\n<body>\n  <h1>HTML Document Studio</h1>\n  <span class="badge">Safe Sandboxed Preview</span>\n  <p>Create and edit clean HTML documents with live isolated preview.</p>\n</body>\n</html>`
      );
    } else if (tool.slug === 'text-editor' && !content) {
      setTitle('Plain Text Note');
      setContent('Start typing your plain text here. Supports Unicode and Tamil: தமிழ் வணக்கம்.\n\nParagraph 2 with full word count and find-replace capabilities.');
    }
  }, [tool.slug]);

  // Document statistics
  const stats = useMemo(() => calculateDocumentStats(content), [content]);

  // Find matches count
  const findMatchCount = useMemo(() => {
    if (!findQuery) return 0;
    try {
      const flags = matchCase ? 'g' : 'gi';
      const escaped = findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, flags);
      const matches = content.match(regex);
      return matches ? matches.length : 0;
    } catch {
      return 0;
    }
  }, [content, findQuery, matchCase]);

  // Insert formatting into textarea
  const insertFormatting = (prefix: string, suffix = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value;
    const selected = text.slice(start, end);
    const replacement = `${prefix}${selected || 'text'}${suffix}`;

    const newText = text.slice(0, start) + replacement + text.slice(end);
    setContent(newText);
    setHasUnsavedChanges(true);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + (selected ? selected.length : 4));
    }, 10);
  };

  // Find & Replace Handlers
  const handleReplaceOne = () => {
    if (!findQuery) return;
    const flags = matchCase ? '' : 'i';
    const escaped = findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, flags);
    setContent((prev) => prev.replace(regex, replaceQuery));
    setHasUnsavedChanges(true);
  };

  const handleReplaceAll = () => {
    if (!findQuery) return;
    const flags = matchCase ? 'g' : 'gi';
    const escaped = findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, flags);
    setContent((prev) => prev.replace(regex, replaceQuery));
    setHasUnsavedChanges(true);
  };

  // Template Loader
  const handleSelectTemplate = (tmpl: typeof DOCUMENT_TEMPLATES[0]) => {
    setTitle(tmpl.defaultTitle);
    setContent(tmpl.content);
    setSelectedTemplate(tmpl.id);
    setShowTemplatesModal(false);
    setHasUnsavedChanges(true);
  };

  // File Importer
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      setTitle(file.name.replace(/\.[^/.]+$/, ''));

      if (ext === 'docx') {
        const extracted = await extractDocxContent(file);
        setContent(extracted.text);
      } else if (ext === 'rtf') {
        const raw = await file.text();
        setContent(rtfToText(raw));
      } else {
        const raw = await file.text();
        setContent(raw);
      }
      setHasUnsavedChanges(false);
    } catch (err) {
      alert(`Could not import document: ${(err as Error).message}`);
    }
  };

  // Exporters
  const handleExport = async (format: 'docx' | 'pdf' | 'md' | 'txt' | 'html' | 'rtf') => {
    setExporting(format);
    const baseName = title.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'document';

    try {
      let blob: Blob;
      let filename = `${baseName}.${format}`;

      if (format === 'docx') {
        blob = await createDocxDocument({ title, content });
      } else if (format === 'pdf') {
        blob = await markdownToPdf(content, { title });
      } else if (format === 'html') {
        const html = tool.slug === 'html-editor' ? sanitizeHtml(content) : markdownToHtml(content);
        blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      } else if (format === 'rtf') {
        const rtfStr = textToRtf(content, title);
        blob = new Blob([rtfStr], { type: 'application/rtf' });
      } else if (format === 'md') {
        blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      } else {
        // Plain text
        blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      }

      await nativeSaveFile(blob, filename);
      setHasUnsavedChanges(false);
    } catch (err) {
      alert(`Export failed: ${(err as Error).message}`);
    } finally {
      setExporting(null);
    }
  };

  // Copy Content
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Rendered preview HTML
  const previewHtml = useMemo(() => {
    if (tool.slug === 'html-editor') {
      return sanitizeHtml(content);
    }
    return markdownToHtml(content);
  }, [content, tool.slug]);

  return (
    <div className="w-full flex flex-col gap-4 animate-fade-in">
      {/* ── Top Bar: Title, Save Status, Actions ────────────────── */}
      <div
        className="p-4 rounded-2xl border flex items-center justify-between gap-4 flex-wrap shadow-sm"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
            style={{ backgroundColor: color }}
          >
            <FileText size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setHasUnsavedChanges(true);
              }}
              className="text-base font-bold text-primary bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none w-full truncate transition-colors"
              placeholder="Document Title"
            />
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-cv">
              <span>{tool.name}</span>
              <span>·</span>
              <span className={hasUnsavedChanges ? 'text-amber-500 font-medium' : 'text-emerald-500 font-medium'}>
                {hasUnsavedChanges ? '● Unsaved edits' : '✓ Up to date'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowTemplatesModal(true)}
            className="btn-secondary btn-sm gap-1.5"
            title="Browse pre-built templates"
          >
            <Sparkles size={14} className="text-amber-500" />
            <span className="hidden sm:inline">Templates</span>
          </button>

          <label className="btn-secondary btn-sm gap-1.5 cursor-pointer">
            <Upload size={14} />
            <span className="hidden sm:inline">Import</span>
            <input
              type="file"
              accept=".docx,.md,.txt,.html,.htm,.rtf"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleCopy}
            className="btn-ghost btn-sm gap-1.5"
            title="Copy document text"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Export Dropdown / Quick Save */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={Boolean(exporting)}
              onClick={() => handleExport(tool.slug.includes('docx') ? 'docx' : tool.slug.includes('md') ? 'md' : 'txt')}
              className="btn-primary btn-sm gap-1.5 font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              <Download size={14} />
              <span>{exporting ? 'Exporting...' : 'Download'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Toolbar: Formatting, Mode Switch, Find/Replace ────────── */}
      <div
        className="p-2.5 rounded-xl border flex items-center justify-between gap-2 flex-wrap"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        {/* Formatting Actions */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => insertFormatting('**', '**')}
            className="btn-ghost btn-sm p-1.5"
            title="Bold (**text**)"
          >
            <Bold size={15} />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('*', '*')}
            className="btn-ghost btn-sm p-1.5"
            title="Italic (*text*)"
          >
            <Italic size={15} />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('__', '__')}
            className="btn-ghost btn-sm p-1.5"
            title="Underline (__text__)"
          >
            <Underline size={15} />
          </button>
          <div className="w-[1px] h-5 bg-border mx-1" />
          <button
            type="button"
            onClick={() => insertFormatting('# ')}
            className="btn-ghost btn-sm p-1.5"
            title="Heading 1"
          >
            <Heading1 size={15} />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('## ')}
            className="btn-ghost btn-sm p-1.5"
            title="Heading 2"
          >
            <Heading2 size={15} />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('### ')}
            className="btn-ghost btn-sm p-1.5"
            title="Heading 3"
          >
            <Heading3 size={15} />
          </button>
          <div className="w-[1px] h-5 bg-border mx-1" />
          <button
            type="button"
            onClick={() => insertFormatting('- ')}
            className="btn-ghost btn-sm p-1.5"
            title="Bullet List"
          >
            <List size={15} />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('1. ')}
            className="btn-ghost btn-sm p-1.5"
            title="Numbered List"
          >
            <ListOrdered size={15} />
          </button>
          <div className="w-[1px] h-5 bg-border mx-1" />
          <button
            type="button"
            onClick={() => setShowFindReplace((prev) => !prev)}
            className={`btn-ghost btn-sm p-1.5 ${showFindReplace ? 'bg-muted text-primary' : ''}`}
            title="Find & Replace"
          >
            <Search size={15} />
          </button>
          <button
            type="button"
            onClick={() => setShowConfirmClear(true)}
            className="btn-ghost btn-sm p-1.5 text-error-600 hover:text-error-700"
            title="Clear Document"
          >
            <Trash2 size={15} />
          </button>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveMode('edit')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
              activeMode === 'edit' ? 'bg-card text-primary shadow-xs' : 'text-muted-cv hover:text-primary'
            }`}
          >
            Editor
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('split')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
              activeMode === 'split' ? 'bg-card text-primary shadow-xs' : 'text-muted-cv hover:text-primary'
            }`}
          >
            Split
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('preview')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
              activeMode === 'preview' ? 'bg-card text-primary shadow-xs' : 'text-muted-cv hover:text-primary'
            }`}
          >
            Preview
          </button>
        </div>
      </div>

      {/* ── Optional Find & Replace Floating Bar ────────────────── */}
      {showFindReplace && (
        <div
          className="p-3 rounded-xl border flex items-center gap-3 flex-wrap animate-slide-down"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <Search size={14} className="text-muted-cv" />
            <input
              type="text"
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              placeholder="Find..."
              className="text-xs bg-card border rounded px-2 py-1 w-full text-primary focus:outline-none focus:border-primary"
            />
            {findQuery && (
              <span className="text-2xs text-muted-cv whitespace-nowrap">
                {findMatchCount} match{findMatchCount !== 1 ? 'es' : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <Replace size={14} className="text-muted-cv" />
            <input
              type="text"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              placeholder="Replace with..."
              className="text-xs bg-card border rounded px-2 py-1 w-full text-primary focus:outline-none focus:border-primary"
            />
          </div>

          <label className="flex items-center gap-1 text-2xs text-muted-cv cursor-pointer">
            <input
              type="checkbox"
              checked={matchCase}
              onChange={(e) => setMatchCase(e.target.checked)}
              className="rounded"
            />
            Match Case
          </label>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleReplaceOne}
              disabled={findMatchCount === 0}
              className="btn-secondary btn-sm text-xs py-1 px-2.5"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={handleReplaceAll}
              disabled={findMatchCount === 0}
              className="btn-secondary btn-sm text-xs py-1 px-2.5"
            >
              Replace All
            </button>
          </div>
        </div>
      )}

      {/* ── Editor Canvas & Live Preview ───────────────────────── */}
      <div
        className="rounded-2xl border overflow-hidden min-h-[460px] flex flex-col md:flex-row shadow-sm"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        {/* Editor Area */}
        {(activeMode === 'edit' || activeMode === 'split') && (
          <div className={`flex-1 flex flex-col min-h-[460px] ${activeMode === 'split' ? 'border-b md:border-b-0 md:border-r border-border' : ''}`}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setHasUnsavedChanges(true);
              }}
              className="flex-1 w-full p-6 text-sm font-mono leading-relaxed bg-transparent text-primary resize-none focus:outline-none"
              placeholder="Type your content here or choose a pre-built template..."
            />
          </div>
        )}

        {/* Live Sandboxed Preview */}
        {(activeMode === 'preview' || activeMode === 'split') && (
          <div className="flex-1 flex flex-col min-h-[460px] bg-white overflow-hidden">
            <div className="p-2 border-b flex items-center justify-between text-2xs text-muted-cv bg-slate-50 border-slate-200">
              <span className="font-semibold uppercase tracking-wider">Live Document Preview</span>
              <span className="badge badge-neutral text-2xs">Sandboxed (Scripts Blocked)</span>
            </div>
            <iframe
              title="Document Preview"
              srcDoc={`<!DOCTYPE html><html><head><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1e293b; padding: 28px; max-width: 760px; margin: 0 auto; word-wrap: break-word; } h1,h2,h3 { color: #0f172a; margin-top: 1.4em; } hr { border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0; } blockquote { border-left: 4px solid #3b82f6; padding-left: 16px; color: #64748b; margin: 16px 0; } code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; } pre { background: #0f172a; color: #f8fafc; padding: 14px; border-radius: 8px; overflow-x: auto; } table { border-collapse: collapse; width: 100%; margin: 16px 0; } th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; } th { background: #f8fafc; }</style></head><body>${previewHtml}</body></html>`}
              sandbox="allow-same-origin"
              className="w-full flex-1 border-0"
            />
          </div>
        )}
      </div>

      {/* ── Bottom Bar: Document Statistics & Multi-Format Exporter */}
      <div
        className="p-4 rounded-2xl border flex items-center justify-between gap-4 flex-wrap text-xs shadow-sm"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        {/* Document Stats */}
        <div className="flex items-center gap-4 text-muted-cv flex-wrap">
          <span className="flex items-center gap-1.5">
            <strong className="text-primary font-semibold">{stats.words}</strong> words
          </span>
          <span>·</span>
          <span>
            <strong className="text-primary font-semibold">{stats.characters}</strong> characters
          </span>
          <span>·</span>
          <span>
            <strong className="text-primary font-semibold">{stats.paragraphs}</strong> paragraphs
          </span>
          <span>·</span>
          <span>~{stats.readingTimeMinutes} min read</span>
        </div>

        {/* Multi-Format Export Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-2xs text-muted-cv uppercase font-semibold tracking-wider mr-1">
            Export As:
          </span>
          <button
            type="button"
            onClick={() => handleExport('docx')}
            disabled={Boolean(exporting)}
            className="btn-secondary btn-sm text-xs py-1 px-2.5"
            title="Microsoft Word (.docx)"
          >
            DOCX
          </button>
          <button
            type="button"
            onClick={() => handleExport('pdf')}
            disabled={Boolean(exporting)}
            className="btn-secondary btn-sm text-xs py-1 px-2.5"
            title="Adobe PDF (.pdf)"
          >
            PDF
          </button>
          <button
            type="button"
            onClick={() => handleExport('html')}
            disabled={Boolean(exporting)}
            className="btn-secondary btn-sm text-xs py-1 px-2.5"
            title="Clean HTML (.html)"
          >
            HTML
          </button>
          <button
            type="button"
            onClick={() => handleExport('md')}
            disabled={Boolean(exporting)}
            className="btn-secondary btn-sm text-xs py-1 px-2.5"
            title="Markdown (.md)"
          >
            MD
          </button>
          <button
            type="button"
            onClick={() => handleExport('txt')}
            disabled={Boolean(exporting)}
            className="btn-secondary btn-sm text-xs py-1 px-2.5"
            title="Plain Text (.txt)"
          >
            TXT
          </button>
          <button
            type="button"
            onClick={() => handleExport('rtf')}
            disabled={Boolean(exporting)}
            className="btn-secondary btn-sm text-xs py-1 px-2.5"
            title="Rich Text Format (.rtf)"
          >
            RTF
          </button>
        </div>
      </div>

      {/* ── Templates Modal ────────────────────────────────────── */}
      {showTemplatesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-fade-in backdrop-blur-xs">
          <div
            className="w-full max-w-2xl rounded-2xl border shadow-2xl p-6 flex flex-col gap-5 max-h-[85vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="text-base font-bold text-primary">Document Templates</h3>
                <p className="text-xs text-muted-cv mt-0.5">
                  Select a pre-built template to populate your document workspace instantly.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplatesModal(false)}
                className="btn-ghost btn-sm p-1.5"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DOCUMENT_TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.id}
                  onClick={() => handleSelectTemplate(tmpl)}
                  className="p-4 rounded-xl border cursor-pointer hover:border-primary transition-all duration-200 flex flex-col justify-between"
                  style={{
                    backgroundColor: selectedTemplate === tmpl.id ? `${color}0c` : 'var(--surface)',
                    borderColor: selectedTemplate === tmpl.id ? color : 'var(--border)',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-primary">{tmpl.name}</span>
                      <span className="badge badge-neutral text-2xs">{tmpl.category}</span>
                    </div>
                    <p className="text-xs text-muted-cv line-clamp-2 leading-relaxed">
                      {tmpl.description}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t flex items-center justify-end text-xs font-semibold text-primary" style={{ borderColor: 'var(--border)' }}>
                    <span>Use Template →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Clear Document Confirmation Modal ──────────────────── */}
      {showConfirmClear && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-fade-in">
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl p-6 flex flex-col gap-4 text-center"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="w-12 h-12 rounded-full bg-error-50 text-error-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-primary">Clear Document Content?</h3>
              <p className="text-xs text-muted-cv mt-1">
                This will remove all text and unsaved edits from the editor canvas. This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmClear(false)}
                className="btn-secondary btn-sm px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setContent('');
                  setTitle('Untitled Document');
                  setHasUnsavedChanges(false);
                  setShowConfirmClear(false);
                }}
                className="btn-primary btn-sm px-4 bg-error-600 hover:bg-error-700 text-white"
              >
                Clear Content
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
