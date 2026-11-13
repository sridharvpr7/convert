// ============================================================
// CONVETER — Tool Dispatch Map
// Maps tool slugs → processor functions + option schemas.
// The ToolPage uses this to know which processor to call
// and which options UI to render.
// ============================================================

import type { ProcessorResult } from './processors';

// ─────────────────────────────────────────────────────────
// Option field definitions (drives dynamic options UI)
// ─────────────────────────────────────────────────────────
export type OptionField =
  | {
      type: 'select';
      key: string;
      label: string;
      options: { label: string; value: string }[];
      default: string;
    }
  | { type: 'range'; key: string; label: string; min: number; max: number; step: number; default: number; unit?: string }
  | { type: 'text'; key: string; label: string; placeholder?: string; default: string }
  | { type: 'checkbox'; key: string; label: string; default: boolean }
  | { type: 'number'; key: string; label: string; min?: number; max?: number; default: number }
  | { type: 'password'; key: string; label: string; placeholder?: string; default: string }
  | { type: 'textarea'; key: string; label: string; placeholder?: string; default: string; rows?: number };

// ─────────────────────────────────────────────────────────
// Processor function signature
// ─────────────────────────────────────────────────────────
export type ToolProcessor = (
  files: File[],
  options: Record<string, unknown>
) => Promise<ProcessorResult | ProcessorResult[]>;

// ─────────────────────────────────────────────────────────
// Tool dispatch entry
// ─────────────────────────────────────────────────────────
export interface ToolDispatch {
  processor: ToolProcessor;
  optionFields?: OptionField[];
  textPlaceholder?: string;
  /** If true, processor receives all files at once as an array. Otherwise called per-file. */
  multiFile?: boolean;
  /** Human-readable description of what options do */
  optionsHint?: string;
  /** 'url' = show URL input instead of file upload; 'signature' = show signature pad; 'camera' = show camera capture */
  inputMode?: 'url' | 'signature' | 'camera' | 'url-or-file';
}

// ─────────────────────────────────────────────────────────
// The dispatch map
// ─────────────────────────────────────────────────────────
const dispatchMap: Record<string, ToolDispatch> = {
  // ── PDF ──────────────────────────────────────────────
  'merge-pdf': {
    multiFile: true,
    processor: async (files) => {
      const { mergePdfs } = await import('./processors');
      return mergePdfs(files);
    },
    optionsHint: 'Select two or more PDF files to merge into a single document.',
  },

  'split-pdf': {
    processor: async (files, _opts) => {
      const { splitPdf } = await import('./processors');
      return splitPdf(files[0]);
    },
    optionFields: [
      {
        type: 'select',
        key: 'mode',
        label: 'Split Mode',
        options: [
          { label: 'Every page individually', value: 'each' },
          { label: 'By page range', value: 'range' },
        ],
        default: 'each',
      },
    ],
  },

  'compress-pdf': {
    processor: async (files, opts) => {
      const { compressPdf } = await import('./processors');
      return compressPdf(files[0], opts as { level?: 'low' | 'medium' | 'high' });
    },
    optionFields: [
      {
        type: 'select',
        key: 'level',
        label: 'Compression Level',
        options: [
          { label: 'Medium (Balanced Object Streams)', value: 'medium' },
          { label: 'High (Maximum Compression)', value: 'high' },
          { label: 'Low (Quality First)', value: 'low' },
        ],
        default: 'medium',
      },
    ],
    optionsHint: 'Browser-side compression consolidates object streams and strips redundant metadata.',
  },

  'rotate-pdf': {
    processor: async (files, opts) => {
      const { rotatePdf } = await import('./processors');
      return rotatePdf(files[0], (Number(opts.degrees ?? 90) as 90 | 180 | 270) || 90);
    },
    optionFields: [
      {
        type: 'select',
        key: 'degrees',
        label: 'Rotation',
        options: [
          { label: '90° clockwise', value: '90' },
          { label: '180°', value: '180' },
          { label: '270° (90° counter-clockwise)', value: '270' },
        ],
        default: '90',
      },
    ],
  },

  'jpg-to-pdf': {
    multiFile: true,
    processor: async (files) => {
      const { imagesToPdf } = await import('./processors');
      return imagesToPdf(files);
    },
    optionsHint: 'Each image becomes one page in the PDF, maintaining its original dimensions.',
  },

  'pdf-to-text': {
    processor: async (files) => {
      const { extractTextFromPdf } = await import('./processors');
      return extractTextFromPdf(files[0]);
    },
    optionsHint: 'Extracts embedded text from your PDF document.',
  },

  // ── IMAGE ────────────────────────────────────────────
  'image-converter': {
    processor: async (files, opts) => {
      const { imageConvert } = await import('./processors');
      const fmt = (opts.format as 'jpeg' | 'png' | 'webp') ?? 'webp';
      const q = Number(opts.quality ?? 85) / 100;
      return imageConvert(files[0], fmt, q);
    },
    optionFields: [
      {
        type: 'select',
        key: 'format',
        label: 'Output Format',
        options: [
          { label: 'WebP (recommended)', value: 'webp' },
          { label: 'JPEG', value: 'jpeg' },
          { label: 'PNG (lossless)', value: 'png' },
        ],
        default: 'webp',
      },
      { type: 'range', key: 'quality', label: 'Quality', min: 10, max: 100, step: 5, default: 85, unit: '%' },
    ],
  },

  'image-compressor': {
    processor: async (files, opts) => {
      const { imageCompress } = await import('./processors');
      const q = Number(opts.quality ?? 70) / 100;
      return imageCompress(files[0], q);
    },
    optionFields: [
      { type: 'range', key: 'quality', label: 'Quality', min: 10, max: 100, step: 5, default: 70, unit: '%' },
    ],
    optionsHint: 'Lower quality = smaller file size.',
  },

  'image-resize': {
    processor: async (files, opts) => {
      const { imageResize } = await import('./processors');
      return imageResize(files[0], {
        width: opts.width ? Number(opts.width) : undefined,
        height: opts.height ? Number(opts.height) : undefined,
        maintainAspect: Boolean(opts.maintainAspect ?? true),
        format: (opts.format as 'jpeg' | 'png' | 'webp') ?? 'jpeg',
        quality: Number(opts.quality ?? 90) / 100,
      });
    },
    optionFields: [
      { type: 'number', key: 'width', label: 'Width (px)', min: 1, max: 8000, default: 800 },
      { type: 'number', key: 'height', label: 'Height (px)', min: 1, max: 8000, default: 600 },
      { type: 'checkbox', key: 'maintainAspect', label: 'Maintain aspect ratio', default: true },
      {
        type: 'select',
        key: 'format',
        label: 'Output Format',
        options: [
          { label: 'JPEG', value: 'jpeg' },
          { label: 'WebP', value: 'webp' },
          { label: 'PNG', value: 'png' },
        ],
        default: 'jpeg',
      },
      { type: 'range', key: 'quality', label: 'Quality', min: 10, max: 100, step: 5, default: 90, unit: '%' },
    ],
  },

  'image-crop': {
    processor: async (files, opts) => {
      const { imageCropByRatio } = await import('./processors');
      return imageCropByRatio(files[0], (opts.ratio as 'free' | '1:1' | '4:3' | '16:9') ?? '1:1');
    },
    optionFields: [
      {
        type: 'select',
        key: 'ratio',
        label: 'Crop ratio',
        options: [
          { label: 'Square (1:1)', value: '1:1' },
          { label: 'Landscape (4:3)', value: '4:3' },
          { label: 'Wide (16:9)', value: '16:9' },
          { label: 'Original', value: 'free' },
        ],
        default: '1:1',
      },
    ],
  },

  // ── DATA ─────────────────────────────────────────────
  'csv-to-excel': {
    processor: async (files, opts) => (await import('./dataTools')).csvToExcel(files[0], opts),
    optionFields: [
      { type: 'checkbox', key: 'preserveLeadingZeros', label: 'Preserve leading zeros in IDs & codes', default: true },
      { type: 'text', key: 'sheetName', label: 'Worksheet Name', placeholder: 'Sheet1', default: 'Sheet1' },
    ],
    optionsHint: 'Converts CSV into Excel XLSX with RFC 4180 compliance and leading zeros preserved.',
  },

  'excel-to-csv': {
    processor: async (files, opts) => (await import('./dataTools')).excelToCsv(files[0], opts),
    optionFields: [
      { type: 'text', key: 'sheetName', label: 'Sheet Name (optional)', placeholder: 'Leave blank for active sheet', default: '' },
    ],
    optionsHint: 'Converts Excel workbook to CSV formatted with UTF-8 BOM for international characters.',
  },

  'json-to-csv': {
    processor: async (files, opts) => (await import('./dataTools')).jsonToCsv(files[0], opts),
    textPlaceholder: 'Paste JSON data here (e.g. [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}])…',
    optionFields: [
      { type: 'checkbox', key: 'flatten', label: 'Flatten nested objects (user.name)', default: true },
    ],
    optionsHint: 'Converts JSON array into CSV collecting union of all fields without data loss.',
  },

  'csv-to-json': {
    processor: async (files, opts) => (await import('./dataTools')).csvToJson(files[0], opts),
    textPlaceholder: 'Paste CSV text here (e.g. id,name,department\n001,Alice,Engineering)…',
    optionFields: [
      { type: 'checkbox', key: 'hasHeaders', label: 'First row contains column headers', default: true },
      { type: 'checkbox', key: 'parseValues', label: 'Parse numeric and boolean values', default: false },
      {
        type: 'select',
        key: 'indent',
        label: 'JSON Formatting',
        options: [
          { label: '2 Spaces (Readable)', value: '2' },
          { label: '4 Spaces', value: '4' },
          { label: 'Minified (Compact)', value: 'compact' },
        ],
        default: '2',
      },
    ],
    optionsHint: 'Converts CSV to JSON with duplicate header protection and multiline quote support.',
  },

  // ── DEVELOPER STUDIO ──────────────────────────────────
  'json-formatter': {
    processor: async (files, opts) => (await import('./developerTools')).jsonFormat(files[0], opts),
    textPlaceholder: 'Paste raw JSON text here or upload a .json file…',
    optionFields: [
      {
        type: 'select',
        key: 'mode',
        label: 'Formatting Style',
        options: [
          { label: '2 Spaces (Standard)', value: 'pretty2' },
          { label: '4 Spaces', value: 'pretty4' },
          { label: 'Tabs', value: 'tabs' },
          { label: 'Minified (Single Line)', value: 'compact' },
        ],
        default: 'pretty2',
      },
    ],
    optionsHint: 'Validates JSON syntax and provides exact line/column error diagnostics.',
  },

  'sql-formatter': {
    processor: async (files, opts) => (await import('./developerTools')).sqlFormat(files[0], opts),
    textPlaceholder: 'Paste your SQL query here (SELECT u.id, u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id WHERE u.status = 1 GROUP BY u.id ORDER BY o.total DESC)…',
    optionFields: [
      {
        type: 'select',
        key: 'keywordCase',
        label: 'Keyword Case',
        options: [
          { label: 'UPPERCASE (SELECT, FROM, WHERE)', value: 'upper' },
          { label: 'lowercase (select, from, where)', value: 'lower' },
          { label: 'Preserve Original', value: 'preserve' },
        ],
        default: 'upper',
      },
      {
        type: 'select',
        key: 'indent',
        label: 'Indentation',
        options: [
          { label: '2 Spaces', value: '2' },
          { label: '4 Spaces', value: '4' },
        ],
        default: '2',
      },
    ],
    optionsHint: 'Formats complex SQL queries into clean, readable lines while preserving literals.',
  },

  'diff-checker': {
    processor: async (files, opts) => (await import('./developerTools')).diffCheck(files[0], opts),
    textPlaceholder: '===ORIGINAL===\nconst x = 10;\nfunction greet() {\n  console.log("Hello");\n}\n===MODIFIED===\nconst x = 20;\nfunction greet(name) {\n  console.log("Hello, " + name);\n}',
    optionsHint: 'Compares two text or code snippets using Myers LCS algorithm with additions/deletions.',
  },

  'hash-generator': {
    processor: async (files, opts) => (await import('./developerTools')).hashGenerate(files[0], opts),
    textPlaceholder: 'Enter any text to generate MD5, SHA-1, SHA-256, and SHA-512 hashes…',
    optionsHint: 'Computes cryptographic hashes. MD5 and SHA-1 carry explicit vulnerability warnings.',
  },

  'base64-encoder-decoder': {
    processor: async (files, opts) => (await import('./developerTools')).base64Codec(files[0], opts),
    textPlaceholder: 'Enter text to encode into Base64, or paste Base64 to decode…',
    optionFields: [
      {
        type: 'select',
        key: 'mode',
        label: 'Action Mode',
        options: [
          { label: 'Encode to Base64', value: 'encode' },
          { label: 'Decode from Base64', value: 'decode' },
        ],
        default: 'encode',
      },
      { type: 'checkbox', key: 'urlSafe', label: 'URL-Safe encoding (RFC 4648 §5: - and _)', default: false },
    ],
    optionsHint: 'Full Unicode & UTF-8 support with strict decoding error diagnostics.',
  },

  'url-encoder-decoder': {
    processor: async (files, opts) => (await import('./developerTools')).urlCodec(files[0], opts),
    textPlaceholder: 'Enter URL or text query to encode or decode (e.g. https://example.com/search?q=hello world & format=json)…',
    optionFields: [
      {
        type: 'select',
        key: 'mode',
        label: 'Action Mode',
        options: [
          { label: 'Encode URL', value: 'encode' },
          { label: 'Decode URL', value: 'decode' },
        ],
        default: 'encode',
      },
      { type: 'checkbox', key: 'component', label: 'Component mode (encodeURIComponent)', default: true },
    ],
    optionsHint: 'Encodes and decodes URL percent sequences with UTF-8 support and error checks.',
  },

  'uuid-generator': {
    processor: async (files, opts) => (await import('./developerTools')).uuidGenerate(files[0], opts),
    textPlaceholder: 'Click process to generate cryptographically secure UUID v4 identifiers…',
    optionFields: [
      {
        type: 'select',
        key: 'count',
        label: 'Number of UUIDs',
        options: [
          { label: '1 UUID', value: '1' },
          { label: '5 UUIDs', value: '5' },
          { label: '10 UUIDs', value: '10' },
          { label: '25 UUIDs', value: '25' },
          { label: '50 UUIDs', value: '50' },
          { label: '100 UUIDs', value: '100' },
        ],
        default: '5',
      },
      {
        type: 'select',
        key: 'format',
        label: 'Format Style',
        options: [
          { label: 'Standard Lowercase (xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)', value: 'standard' },
          { label: 'Uppercase', value: 'uppercase' },
          { label: 'No Hyphens (32-character hex)', value: 'no-hyphens' },
          { label: 'Braces {GUID}', value: 'braces' },
        ],
        default: 'standard',
      },
    ],
    optionsHint: 'Generates RFC 4122 v4 UUIDs using browser cryptographically secure random values.',
  },

  'regex-tester': {
    processor: async (files, opts) => (await import('./developerTools')).regexTest(files[0], opts),
    textPlaceholder: '===PATTERN===\n\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b\n===TEST_STRING===\nContact us at support@convetpulse.com or admin@company.org for assistance.',
    optionFields: [
      { type: 'text', key: 'pattern', label: 'Regex Pattern (without / slashes)', placeholder: '\\b\\w+@\\w+\\.\\w+\\b', default: '' },
      {
        type: 'select',
        key: 'flags',
        label: 'Flags',
        options: [
          { label: 'Global + Insensitive (gi)', value: 'gi' },
          { label: 'Global + Multiline + Insensitive (gmi)', value: 'gmi' },
          { label: 'Global (g)', value: 'g' },
          { label: 'Case Insensitive (i)', value: 'i' },
        ],
        default: 'gi',
      },
    ],
    optionsHint: 'Safely evaluates regular expressions against test text reporting all matches and groups.',
  },

  'jwt-decoder': {
    processor: async (files, opts) => (await import('./developerTools')).jwtDecode(files[0], opts),
    textPlaceholder: 'Paste JWT token string here (header.payload.signature)…',
    optionsHint: 'Decodes header and payload claims locally. Cryptographic signature is NOT verified.',
  },

  // ── PDF SECURITY STUDIO ──────────────────────────────
  'pdf-password-protect': {
    processor: async (files, opts) => (await import('./pdfSecurityTools')).pdfPasswordProtect(files[0], opts),
    optionFields: [
      { type: 'password', key: 'password', label: 'Document Password', placeholder: 'Enter password to encrypt PDF', default: '' },
      { type: 'password', key: 'ownerPassword', label: 'Owner Password (optional)', placeholder: 'Leave blank to use document password', default: '' },
    ],
    optionsHint: 'Security Notice: Client-side stream encryption is disabled for security safety (ISO 32000-2 AES-256 requires server QPDF engine).',
  },

  'pdf-unlock': {
    processor: async (files, opts) => (await import('./pdfSecurityTools')).pdfUnlock(files[0], opts),
    optionFields: [
      { type: 'password', key: 'password', label: 'Current Password', placeholder: 'Enter current document password', default: '' },
    ],
    optionsHint: 'Security Notice: Client-side stream decryption is disabled for security safety (requires cryptographic stream engine).',
  },

  'pdf-redact': {
    processor: async (files, opts) => (await import('./pdfSecurityTools')).pdfRedact(files[0], opts),
    optionFields: [
      { type: 'text', key: 'searchTerm', label: 'Sensitive Phrase to Redact', placeholder: 'e.g. CONFIDENTIAL or SSN', default: 'CONFIDENTIAL' },
    ],
    optionsHint: 'Physically excises matching text operators from content streams and applies permanent visual redaction.',
  },

  'pdf-metadata-cleaner': {
    processor: async (files, opts) => (await import('./pdfSecurityTools')).pdfMetadataCleaner(files[0], opts),
    optionsHint: 'Permanently strips author, title, creator, producer, creation dates, and XMP XML metadata.',
  },

  'pdf-security-inspector': {
    processor: async (files, opts) => (await import('./pdfSecurityTools')).pdfSecurityInspector(files[0], opts),
    optionsHint: 'Comprehensive security audit inspecting encryption, embedded JS, launch actions, signatures, and permissions.',
  },

  // ── UTILITIES ────────────────────────────────────────
  'qr-generator': {
    processor: async (files, opts) => (await import('./textTools')).runTextTool('qr-generator', files[0], opts),
    textPlaceholder: 'Enter the text or URL for the QR code…',
    optionFields: [{ type: 'number', key: 'size', label: 'Image size (px)', min: 128, max: 1024, default: 512 }],
  },

  // ── ARCHIVE ──────────────────────────────────────────
  'zip-compressor': {
    multiFile: true,
    processor: async (files) => (await import('./processors')).createZip(files, 'archive.zip'),
    optionsHint: 'All selected files will be zipped into a single archive.',
  },

  'zip-extractor': {
    processor: async (files) => (await import('./processors')).extractZip(files[0]),
    optionsHint: 'The ZIP will be extracted and all files made available for download.',
  },
};

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────

/** Get the dispatch entry for a tool slug */
export function getToolDispatch(slug: string): ToolDispatch | null {
  return dispatchMap[slug] ?? null;
}

/** Check if a tool has a real offline processor */
export function hasProcessor(slug: string): boolean {
  return slug in dispatchMap;
}

/** List all implemented tool slugs */
export function getImplementedSlugs(): string[] {
  return Object.keys(dispatchMap);
}
