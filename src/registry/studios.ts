// ============================================================
// CONVET PULSE — Studios Registry & Architecture Metadata
// Defines the 12 primary studios forming the CONVET PULSE ecosystem.
// ============================================================

import type { Tool, ToolCategory } from './tools.ts';
import { TOOLS, getToolsByCategory } from './tools.ts';

export type StudioId =
  | 'pdf-studio'
  | 'document-studio'
  | 'image-studio'
  | 'audio-video-studio'
  | 'universal-converter'
  | 'data-studio'
  | 'developer-studio'
  | 'student-studio'
  | 'engineering-studio'
  | 'secret-message-studio'
  | 'ai-workspace'
  | 'scanner-studio';

export interface PlannedTool {
  name: string;
  description: string;
  phase: string;
  badge?: string;
}

export interface StudioMeta {
  id: StudioId;
  name: string;
  shortName: string;
  slug: string;
  description: string;
  longDescription: string;
  icon: string; // Lucide icon name
  color: string; // Brand accent hex color
  bgGradient: string;
  badge: string;
  status: 'active' | 'preview';
  phase: number;
  mappedCategories: ToolCategory[];
  specificToolSlugs?: string[];
  plannedTools?: PlannedTool[];
}

export const STUDIOS: StudioMeta[] = [
  {
    id: 'pdf-studio',
    name: 'PDF Studio',
    shortName: 'PDF',
    slug: 'pdf-studio',
    description: 'Merge, split, compress, rotate, edit, and secure PDF documents.',
    longDescription:
      'A complete suite of client-side PDF tools designed for high security and performance. Manipulate, optimize, redact sensitive text, and verify documents without uploading files to remote servers.',
    icon: 'FileText',
    color: '#ef4444',
    bgGradient: 'from-red-500/10 via-rose-500/5 to-transparent',
    badge: '22 Tools Active',
    status: 'active',
    phase: 2,
    mappedCategories: ['pdf', 'security'],
    plannedTools: [
      { name: 'PDF OCR', description: 'Extract searchable text from scanned PDF pages', phase: 'Phase 2' },
      { name: 'Sign PDF', description: 'Draw, type, or upload verifiable digital signatures', phase: 'Phase 2' },
      { name: 'Fill PDF Forms', description: 'Interactive AcroForm field detector and filler', phase: 'Phase 2' },
      { name: 'Reorder PDF Pages', description: 'Drag-and-drop visual thumbnail grid', phase: 'Phase 2' },
      { name: 'Compare PDF', description: 'Side-by-side text and visual difference comparator', phase: 'Phase 2' },
      { name: 'PDF to Images', description: 'Export pages as crisp JPG or PNG in a ZIP bundle', phase: 'Phase 2' },
    ],
  },
  {
    id: 'document-studio',
    name: 'Document Studio',
    shortName: 'Documents',
    slug: 'document-studio',
    description: 'View, edit, and convert Word, Excel, PowerPoint, and rich text documents.',
    longDescription:
      'Seamlessly bridge document formats. Convert Microsoft Office files to clean PDFs and inspect documents with client-side formatting engines.',
    icon: 'FileEdit',
    color: '#3b82f6',
    bgGradient: 'from-blue-500/10 via-indigo-500/5 to-transparent',
    badge: '15 Tools Active',
    status: 'active',
    phase: 3,
    mappedCategories: ['pdf'],
    specificToolSlugs: [
      'docx-creator',
      'docx-editor',
      'markdown-editor',
      'text-editor',
      'html-editor',
      'rtf-converter',
      'docx-to-txt',
      'markdown-to-pdf',
      'markdown-to-docx',
      'txt-to-docx',
      'word-to-pdf',
      'excel-to-pdf',
      'powerpoint-to-pdf',
      'pdf-to-excel',
      'pdf-to-powerpoint',
    ],
    plannedTools: [
      { name: 'XLSX Spreadsheet Editor', description: 'Interactive grid editor with formulas and CSV import/export', phase: 'Phase 7' },
      { name: 'PPTX Presentation Editor', description: 'Slide viewer and presentation text editor', phase: 'Phase 7' },
      { name: 'EPUB to PDF Converter', description: 'E-book rendering and PDF compilation engine', phase: 'Phase 7' },
    ],
  },
  {
    id: 'image-studio',
    name: 'Image & Design Studio',
    shortName: 'Images',
    slug: 'image-studio',
    description: 'Convert image formats, reduce file size, resize dimensions, and crop.',
    longDescription:
      'High-performance image processing using HTML5 Canvas and WebAssembly. Convert between modern and legacy formats, compress without perceptual quality loss, and crop precisely.',
    icon: 'Image',
    color: '#f59e0b',
    bgGradient: 'from-amber-500/10 via-yellow-500/5 to-transparent',
    badge: '10 Tools Active',
    status: 'active',
    phase: 4,
    mappedCategories: ['image'],
    plannedTools: [
      { name: 'Sanitized SVG Converter', description: 'Convert vector SVG to raster PNG/JPG with script sanitization', phase: 'Phase 7' },
      { name: 'GIF Maker & MP4 to GIF', description: 'Create animated GIFs with custom framerate and loop controls', phase: 'Phase 7' },
      { name: 'Favicon Generator', description: 'Generate multi-resolution icons (.ico and .png)', phase: 'Phase 7' },
    ],
  },
  {
    id: 'audio-video-studio',
    name: 'Audio & Video Studio',
    shortName: 'Media',
    slug: 'audio-video-studio',
    description: 'Compress, convert, trim, and extract high-definition audio and video files.',
    longDescription:
      'Powerful client-side media manipulation powered by lazy-loaded WebAssembly engines. Process media locally with zero server bandwidth and zero file exposure.',
    icon: 'Video',
    color: '#ec4899',
    bgGradient: 'from-pink-500/10 via-rose-500/5 to-transparent',
    badge: 'Phase 7 Preview',
    status: 'preview',
    phase: 7,
    mappedCategories: [],
    plannedTools: [
      { name: 'Video Compressor', description: 'Compress MP4, WEBM, and MKV with bitrate and resolution controls', phase: 'Phase 7' },
      { name: 'Video to MP3 Audio', description: 'Extract crystal-clear audio tracks from videos', phase: 'Phase 7' },
      { name: 'Audio Trimmer & Merger', description: 'Cut and concatenate MP3, WAV, AAC, and FLAC files', phase: 'Phase 7' },
      { name: 'Video Trimmer', description: 'Lossless video trimming with precise start/end markers', phase: 'Phase 7' },
      { name: 'Speech to Text & Subtitles', description: 'Generate transcripts and subtitles locally', phase: 'Phase 7' },
    ],
  },
  {
    id: 'universal-converter',
    name: 'Universal Converter',
    shortName: 'Converter',
    slug: 'universal-converter',
    description: 'Universal drag-and-drop file conversion across all document, image, and data formats.',
    longDescription:
      'Drop any file to instantly detect its MIME type and magic byte signature. Choose an output format and execute batch conversions with real-time progress and ZIP downloads.',
    icon: 'ArrowLeftRight',
    color: '#8b5cf6',
    bgGradient: 'from-purple-500/10 via-violet-500/5 to-transparent',
    badge: 'Universal Engine',
    status: 'active',
    phase: 4,
    mappedCategories: ['pdf', 'image', 'data', 'archive'],
    specificToolSlugs: ['image-converter', 'csv-to-excel', 'excel-to-csv', 'json-to-csv', 'csv-to-json', 'zip-compressor', 'zip-extractor'],
    plannedTools: [
      { name: 'MIME Magic Byte Detection', description: 'Automatic file signature identification', phase: 'Phase 4' },
      { name: 'Cross-Format Matrix', description: 'Unified conversion router for all 6 format groups', phase: 'Phase 4' },
      { name: 'Batch Queue & ZIP Bundle', description: 'Process dozens of files concurrently and download all in one ZIP', phase: 'Phase 4' },
    ],
  },
  {
    id: 'data-studio',
    name: 'Data Studio',
    shortName: 'Data',
    slug: 'data-studio',
    description: 'Convert and transform CSV spreadsheets, Excel workbooks, and JSON payloads.',
    longDescription:
      'Seamless spreadsheet and tabular data manipulation. Handles nested quotes, Unicode encoding, leading zeros, and malformed datasets with robust validation.',
    icon: 'Table',
    color: '#10b981',
    bgGradient: 'from-emerald-500/10 via-teal-500/5 to-transparent',
    badge: '4 Tools Active',
    status: 'active',
    phase: 8,
    mappedCategories: ['data'],
    plannedTools: [
      { name: 'Excel to JSON & JSON to Excel', description: 'Bi-directional conversions with schema inference', phase: 'Phase 8' },
      { name: 'XML to JSON & JSON to XML', description: 'Fast hierarchical XML/JSON transformations', phase: 'Phase 8' },
      { name: 'YAML to JSON & JSON to YAML', description: 'Config format conversion for DevOps and developers', phase: 'Phase 8' },
      { name: 'Invoice & Calendar Generator', description: 'Generate printable invoices and schedule calendars', phase: 'Phase 8' },
    ],
  },
  {
    id: 'developer-studio',
    name: 'Developer Studio',
    shortName: 'Developer',
    slug: 'developer-studio',
    description: 'Format code, inspect JWTs, test regex, calculate hashes, and compare diffs.',
    longDescription:
      'Essential utility workbench for software engineers. All operations run locally in browser memory — secrets, tokens, and code snippets never leave your machine.',
    icon: 'Code2',
    color: '#6366f1',
    bgGradient: 'from-indigo-500/10 via-blue-500/5 to-transparent',
    badge: '9 Tools Active',
    status: 'active',
    phase: 8,
    mappedCategories: ['developer'],
    plannedTools: [
      { name: 'HTML / CSS / JS Minifier', description: 'Clean, format, and minify web source code', phase: 'Phase 8' },
      { name: 'XML & YAML Validator', description: 'Syntax validation with line-by-line error highlights', phase: 'Phase 8' },
      { name: 'Markdown Editor & Live Preview', description: 'Split-pane GitHub Flavored Markdown editor with HTML export', phase: 'Phase 8' },
      { name: 'Cron Expression Generator', description: 'Interactive visual cron schedule builder and descriptor', phase: 'Phase 8' },
      { name: 'Color Code Converter', description: 'HEX, RGB, HSL, and CMYK bidirectional converter', phase: 'Phase 8' },
    ],
  },
  {
    id: 'student-studio',
    name: 'Student Studio',
    shortName: 'Student',
    slug: 'student-studio',
    description: 'GPA/CGPA calculators, study planners, timetable organizer, citations, and resume builder.',
    longDescription:
      'A dedicated productivity hub engineered specifically for students, fresh graduates, and researchers. Calculate academic scores, plan study sprints, and format academic citations.',
    icon: 'GraduationCap',
    color: '#06b6d4',
    bgGradient: 'from-cyan-500/10 via-sky-500/5 to-transparent',
    badge: 'Phase 5 Preview',
    status: 'preview',
    phase: 5,
    mappedCategories: ['utilities'],
    specificToolSlugs: ['qr-generator', 'barcode-generator'],
    plannedTools: [
      { name: 'Configurable GPA & CGPA Calculator', description: 'Custom university grading scales and credit weighting', phase: 'Phase 5' },
      { name: 'Interactive Study Planner', description: 'Task deadlines, priority queues, and visual progress tracking', phase: 'Phase 5' },
      { name: 'Weekly Timetable Planner', description: 'Visual class schedule organizer with printable export', phase: 'Phase 5' },
      { name: 'Academic Citation Generator', description: 'Instant APA, MLA, and IEEE reference formatter', phase: 'Phase 5' },
      { name: 'Student Resume Builder', description: 'ATS-friendly resume templates with instant PDF export', phase: 'Phase 5' },
      { name: 'Scientific & Unit Converter', description: 'Comprehensive SI units and precision scientific calculations', phase: 'Phase 5' },
    ],
  },
  {
    id: 'engineering-studio',
    name: 'Engineering Studio',
    shortName: 'Engineering',
    slug: 'engineering-studio',
    description: 'Digital electronics, logic gates, circuit calculators, and number system solvers.',
    longDescription:
      'A specialized mathematical and hardware engineering workbench. Calculate electrical circuit parameters, verify logic gate truth tables, and convert base representations.',
    icon: 'Cpu',
    color: '#14b8a6',
    bgGradient: 'from-teal-500/10 via-emerald-500/5 to-transparent',
    badge: 'Phase 5 Preview',
    status: 'preview',
    phase: 5,
    mappedCategories: ['developer'],
    specificToolSlugs: ['base64-encoder-decoder', 'hash-generator'],
    plannedTools: [
      { name: 'Binary / Decimal / Octal / Hex Converter', description: 'Base conversions with step-by-step arithmetic steps', phase: 'Phase 5' },
      { name: 'Logic Gate & Truth Table Simulator', description: 'Simulate AND, OR, XOR, NAND, NOR with dynamic tables', phase: 'Phase 5' },
      { name: 'Boolean Algebra Simplifier', description: 'Reduce logic expressions with Boolean laws', phase: 'Phase 5' },
      { name: "Ohm's Law & Resistor Color Code", description: '4-band, 5-band, and SMD resistor decoder and circuit solver', phase: 'Phase 5' },
      { name: 'RC / RL / RLC Circuit Solvers', description: 'Resonance, cutoff frequency, and impedance formulas', phase: 'Phase 5' },
      { name: '8085 / 8086 Hex Opcode Helper', description: 'Assembly opcode lookup and hex memory calculator', phase: 'Phase 5' },
    ],
  },
  {
    id: 'secret-message-studio',
    name: 'Secret Message Studio',
    shortName: 'Secret Message',
    slug: 'secret-message-studio',
    description: 'Encoders, classical ciphers, and authenticated AES-256-GCM zero-knowledge encryption.',
    longDescription:
      'Military-grade authenticated encryption alongside educational classical ciphers. Encrypt messages and files with AES-256-GCM using Web Crypto API — zero servers, zero plaintext leakage.',
    icon: 'ShieldAlert',
    color: '#f43f5e',
    bgGradient: 'from-rose-500/10 via-red-500/5 to-transparent',
    badge: 'Phase 6 Preview',
    status: 'preview',
    phase: 6,
    mappedCategories: ['security', 'developer'],
    specificToolSlugs: ['base64-encoder-decoder', 'hash-generator', 'pdf-redact'],
    plannedTools: [
      { name: 'Classical Encoders & Ciphers', description: 'ROT13, Caesar, Vigenère, Morse Code, Binary, and Hex', phase: 'Phase 6' },
      { name: 'AES-256-GCM Authenticated Encryption', description: 'PBKDF2 key derivation, unique IV per message, and tamper detection', phase: 'Phase 6' },
      { name: 'Client-Side File Encryptor', description: 'Encrypt any file into an encrypted payload bundle (.convet)', phase: 'Phase 6' },
      { name: 'QR Secret Message', description: 'Embed encrypted payload into high-density QR codes for air-gapped sharing', phase: 'Phase 6' },
    ],
  },
  {
    id: 'ai-workspace',
    name: 'AI Workspace',
    shortName: 'AI',
    slug: 'ai-workspace',
    description: 'AI PDF summarizer, document translator, grammar analyzer, and document chat.',
    longDescription:
      'Intelligent document assistance with strict privacy boundaries. Secure backend proxy architecture with rate limits, token quotas, and zero training on user documents.',
    icon: 'Sparkles',
    color: '#a855f7',
    bgGradient: 'from-purple-500/10 via-fuchsia-500/5 to-transparent',
    badge: 'Phase 9 Preview',
    status: 'preview',
    phase: 9,
    mappedCategories: [],
    plannedTools: [
      { name: 'AI PDF Summarizer', description: 'Extract executive summaries and key action items from lengthy PDFs', phase: 'Phase 9' },
      { name: 'Chat with PDF', description: 'Conversational semantic question answering over uploaded documents', phase: 'Phase 9' },
      { name: 'AI Document Translator', description: 'High-fidelity document translation preserving structure and layout', phase: 'Phase 9' },
      { name: 'AI Grammar & Style Checker', description: 'Professional syntax, tone, and grammar suggestions', phase: 'Phase 9' },
      { name: 'AI Resume Analyzer', description: 'Actionable ATS scoring and feedback for fresher and student resumes', phase: 'Phase 9' },
    ],
  },
  {
    id: 'scanner-studio',
    name: 'Document Scanner Studio',
    shortName: 'Scanner',
    slug: 'scanner-studio',
    description: 'Camera document scanner, edge detection, perspective crop, and Tesseract OCR.',
    longDescription:
      'Transform your phone camera or webcam into a professional document scanner. Auto-crop edges, apply high-contrast B&W filters, run client-side OCR in English & Tamil, and export to PDF.',
    icon: 'ScanLine',
    color: '#0284c7',
    bgGradient: 'from-sky-500/10 via-blue-500/5 to-transparent',
    badge: 'Phase 3 Preview',
    status: 'preview',
    phase: 3,
    mappedCategories: ['pdf', 'image'],
    plannedTools: [
      { name: 'Camera & Webcam Multi-Page Scanner', description: 'Instant document capture with camera permission management', phase: 'Phase 3' },
      { name: 'Auto Edge & Perspective Correction', description: 'Quad-corner perspective transformation and manual corner drag', phase: 'Phase 3' },
      { name: 'Document Enhancement Filters', description: 'Grayscale, Crisp High-Contrast B&W, and Color Enhancer', phase: 'Phase 3' },
      { name: 'Tesseract OCR (English & Tamil)', description: 'Extract text locally in Web Workers with confidence scores', phase: 'Phase 3' },
      { name: 'Multi-Format Scanned Export', description: 'Export as searchable PDF, multi-page PDF, JPG, or TXT', phase: 'Phase 3' },
    ],
  },
];

// ─────────────────────────────────────────────────────────
// Query & Lookup Helpers
// ─────────────────────────────────────────────────────────

export const getAllStudios = (): StudioMeta[] => STUDIOS;

export const getStudioById = (id: string): StudioMeta | undefined =>
  STUDIOS.find((s) => s.id === id);

export const getStudioBySlug = (slug: string): StudioMeta | undefined =>
  STUDIOS.find((s) => s.slug === slug || s.id === slug);

export const getToolsForStudio = (studioId: StudioId): Tool[] => {
  const studio = getStudioById(studioId);
  if (!studio) return [];

  // If studio has specific tool slugs listed
  const specific = (studio.specificToolSlugs || [])
    .map((slug) => TOOLS.find((t) => t.slug === slug))
    .filter(Boolean) as Tool[];

  // Tools from mapped categories
  const fromCategories = studio.mappedCategories.flatMap((cat) => getToolsByCategory(cat));

  // Combine and deduplicate
  const combined = [...specific, ...fromCategories];
  const seen = new Set<string>();
  return combined.filter((tool) => {
    if (seen.has(tool.id)) return false;
    seen.add(tool.id);
    return true;
  });
};

export const getStudiosForTool = (tool: Tool): StudioMeta[] => {
  return STUDIOS.filter((studio) => {
    if (studio.specificToolSlugs?.includes(tool.slug)) return true;
    return studio.mappedCategories.includes(tool.category);
  });
};
