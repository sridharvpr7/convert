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
  // ── PDF CORE (6 tools) ────────────────────────────────
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
        label: 'Compression Preset',
        options: [
          { label: 'Balanced (Recommended - Crisp Text)', value: 'medium' },
          { label: 'Smallest File (Maximum Compression)', value: 'high' },
          { label: 'Best Quality (Minimal Size Reduction)', value: 'low' },
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
        label: 'Rotation Angle',
        options: [
          { label: '90° clockwise', value: '90' },
          { label: '180° upside down', value: '180' },
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

  // ── PDF EXTENDED TOOLS (10 tools) ─────────────────────
  'pdf-to-excel': {
    processor: async (files, opts) => (await import('./pdfExtendedTools')).pdfToExcel(files[0], opts),
    optionsHint: 'Extracts PDF tabular data streams and layout into an editable Excel spreadsheet (.xlsx).',
  },

  'pdf-to-powerpoint': {
    processor: async (files, opts) => (await import('./pdfExtendedTools')).pdfToPowerPoint(files[0], opts),
    optionsHint: 'Converts each PDF page into a 16:9 widescreen presentation slide in PowerPoint format (.pptx).',
  },

  'word-to-pdf': {
    processor: async (files, opts) => (await import('./pdfExtendedTools')).wordToPdf(files[0], opts),
    optionsHint: 'Converts Microsoft Word (.docx) documents into clean, portable PDF format.',
  },

  'excel-to-pdf': {
    processor: async (files, opts) => (await import('./pdfExtendedTools')).excelToPdf(files[0], opts),
    optionFields: [
      {
        type: 'select',
        key: 'orientation',
        label: 'Page Orientation',
        options: [
          { label: 'Landscape (Wide Tables)', value: 'landscape' },
          { label: 'Portrait (Standard Vertical)', value: 'portrait' },
        ],
        default: 'landscape',
      },
    ],
    optionsHint: 'Converts Microsoft Excel (.xlsx) spreadsheets into a formatted, printable PDF document.',
  },

  'powerpoint-to-pdf': {
    processor: async (files, opts) => (await import('./pdfExtendedTools')).powerPointToPdf(files[0], opts),
    optionsHint: 'Converts Microsoft PowerPoint (.pptx) presentation slides into a widescreen PDF presentation.',
  },

  'add-page-numbers': {
    processor: async (files, opts) => (await import('./pdfExtendedTools')).addPageNumbers(files[0], opts),
    optionFields: [
      {
        type: 'select',
        key: 'position',
        label: 'Position on Page',
        options: [
          { label: 'Bottom Center (Standard)', value: 'bottom-center' },
          { label: 'Bottom Right', value: 'bottom-right' },
          { label: 'Bottom Left', value: 'bottom-left' },
          { label: 'Top Center', value: 'top-center' },
          { label: 'Top Right', value: 'top-right' },
          { label: 'Top Left', value: 'top-left' },
        ],
        default: 'bottom-center',
      },
      { type: 'text', key: 'format', label: 'Numbering Style', placeholder: 'Page {n} of {total}', default: 'Page {n} of {total}' },
      { type: 'number', key: 'fontSize', label: 'Font Size (pt)', min: 6, max: 24, default: 10 },
      { type: 'number', key: 'startNumber', label: 'Starting Number', min: 1, default: 1 },
      { type: 'text', key: 'pageRange', label: 'Page Range (all, 1-5, 2-)', placeholder: 'all', default: 'all' },
    ],
    optionsHint: 'Appends clean, professional page numbering across selected pages of your PDF.',
  },

  'add-header-footer': {
    processor: async (files, opts) => (await import('./pdfExtendedTools')).addHeaderFooter(files[0], opts),
    optionFields: [
      { type: 'text', key: 'headerText', label: 'Header Text (top of page)', placeholder: 'e.g. Confidential Report', default: '' },
      {
        type: 'select',
        key: 'headerAlign',
        label: 'Header Alignment',
        options: [
          { label: 'Center', value: 'center' },
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
        default: 'center',
      },
      { type: 'text', key: 'footerText', label: 'Footer Text (bottom of page)', placeholder: 'e.g. Page {page} of {total} · {date}', default: 'Page {page} of {total}' },
      {
        type: 'select',
        key: 'footerAlign',
        label: 'Footer Alignment',
        options: [
          { label: 'Center', value: 'center' },
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
        default: 'center',
      },
      { type: 'number', key: 'fontSize', label: 'Font Size (pt)', min: 6, max: 18, default: 9 },
      { type: 'text', key: 'pageRange', label: 'Page Range', placeholder: 'all', default: 'all' },
    ],
    optionsHint: 'Adds custom header and footer text with support for {page}, {total}, and {date} variables.',
  },

  'crop-pdf': {
    processor: async (files, opts) => (await import('./pdfExtendedTools')).cropPdf(files[0], opts),
    optionFields: [
      { type: 'number', key: 'top', label: 'Top Margin Trim (pt)', min: 0, max: 200, default: 20 },
      { type: 'number', key: 'bottom', label: 'Bottom Margin Trim (pt)', min: 0, max: 200, default: 20 },
      { type: 'number', key: 'left', label: 'Left Margin Trim (pt)', min: 0, max: 200, default: 20 },
      { type: 'number', key: 'right', label: 'Right Margin Trim (pt)', min: 0, max: 200, default: 20 },
      { type: 'text', key: 'pageRange', label: 'Page Range', placeholder: 'all', default: 'all' },
    ],
    optionsHint: 'Adjusts printable PDF CropBox margins on selected pages while preserving underlying vector streams.',
  },

  'extract-pdf-images': {
    processor: async (files, opts) => (await import('./pdfExtendedTools')).extractPdfImages(files[0], opts),
    optionsHint: 'Scans all PDF page resources and extracts embedded JPEG/PNG image objects into a ZIP file.',
  },

  'repair-pdf': {
    processor: async (files, opts) => (await import('./pdfExtendedTools')).repairPdf(files[0], opts),
    optionsHint: 'Inspects PDF syntax, resynchronizes broken header offsets, and reconstructs damaged xref tables.',
  },

  // ── IMAGE (4 tools) ──────────────────────────────────
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
        label: 'Target Image Format',
        options: [
          { label: 'WebP (Modern, Smallest Size)', value: 'webp' },
          { label: 'JPEG (Best for Photos)', value: 'jpeg' },
          { label: 'PNG (Lossless with Transparency)', value: 'png' },
        ],
        default: 'webp',
      },
      { type: 'range', key: 'quality', label: 'Quality', min: 10, max: 100, step: 5, default: 85, unit: '%' },
    ],
  },

  'image-compressor': {
    processor: async (files, opts) => {
      const { imageCompress } = await import('./processors');
      const q = Number(opts.quality ?? 75) / 100;
      return imageCompress(files[0], q);
    },
    optionFields: [
      { type: 'range', key: 'quality', label: 'Compression Quality', min: 10, max: 100, step: 5, default: 75, unit: '%' },
    ],
  },

  'image-resize': {
    processor: async (files, opts) => {
      const { imageResize } = await import('./processors');
      const width = Number(opts.width ?? 800);
      const height = Number(opts.height ?? 600);
      return imageResize(files[0], { width, height, maintainAspect: true });
    },
    optionFields: [
      { type: 'number', key: 'width', label: 'Width (px)', min: 10, max: 10000, default: 800 },
      { type: 'number', key: 'height', label: 'Height (px)', min: 10, max: 10000, default: 600 },
    ],
  },

  'image-crop': {
    processor: async (files, opts) => {
      const { imageCropByRatio } = await import('./processors');
      const ratio = (opts.ratio as 'free' | '1:1' | '4:3' | '16:9') ?? '1:1';
      return imageCropByRatio(files[0], ratio);
    },
    optionFields: [
      {
        type: 'select',
        key: 'ratio',
        label: 'Aspect Ratio Crop',
        options: [
          { label: 'Square (1:1)', value: '1:1' },
          { label: 'Standard (4:3)', value: '4:3' },
          { label: 'Widescreen (16:9)', value: '16:9' },
        ],
        default: '1:1',
      },
    ],
  },

  // ── DATA & SPREADSHEETS (4 tools) ─────────────────────
  'csv-to-excel': {
    processor: async (files, opts) => (await import('./dataTools')).csvToExcel(files[0], opts),
    optionFields: [
      { type: 'text', key: 'sheetName', label: 'Worksheet Name', placeholder: 'Sheet1', default: 'Sheet1' },
      { type: 'checkbox', key: 'autoFilter', label: 'Add AutoFilter row on table headers', default: true },
    ],
    optionsHint: 'Converts CSV into formatted Excel spreadsheet (.xlsx) preserving numeric codes.',
  },

  'excel-to-csv': {
    processor: async (files, opts) => (await import('./dataTools')).excelToCsv(files[0], opts),
    optionFields: [
      { type: 'text', key: 'sheetName', label: 'Sheet Name (optional, defaults to first)', placeholder: 'Sheet1', default: '' },
      {
        type: 'select',
        key: 'delimiter',
        label: 'CSV Delimiter',
        options: [
          { label: 'Comma (,)', value: ',' },
          { label: 'Semicolon (;)', value: ';' },
          { label: 'Tab (\\t)', value: '\t' },
        ],
        default: ',',
      },
    ],
    optionsHint: 'Exports Excel spreadsheets into RFC 4180 standard CSV format.',
  },

  'json-to-csv': {
    processor: async (files, opts) => (await import('./dataTools')).jsonToCsv(files[0], opts),
    textPlaceholder: 'Paste JSON array of objects here, e.g. [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]',
    optionFields: [
      { type: 'checkbox', key: 'flatten', label: 'Flatten nested JSON objects with dot notation', default: true },
      {
        type: 'select',
        key: 'delimiter',
        label: 'CSV Delimiter',
        options: [
          { label: 'Comma (,)', value: ',' },
          { label: 'Semicolon (;)', value: ';' },
          { label: 'Tab (\\t)', value: '\t' },
        ],
        default: ',',
      },
    ],
    optionsHint: 'Converts JSON object arrays into CSV tabular format with key union detection.',
  },

  'csv-to-json': {
    processor: async (files, opts) => (await import('./dataTools')).csvToJson(files[0], opts),
    textPlaceholder: 'Paste CSV text here, e.g.\nid,name,role\n1,Alice,Engineer\n2,Bob,Designer',
    optionFields: [
      { type: 'checkbox', key: 'parseNumbers', label: 'Automatically parse numeric strings into numbers', default: true },
      { type: 'checkbox', key: 'parseBooleans', label: 'Parse "true" and "false" into boolean values', default: true },
      { type: 'checkbox', key: 'pretty', label: 'Pretty print JSON with 2-space indentation', default: true },
    ],
    optionsHint: 'Converts CSV tables into structured JSON arrays with RFC 4180 parsing.',
  },

  // ── DEVELOPER STUDIO (9 tools) ────────────────────────
  'json-formatter': {
    processor: async (files, opts) => (await import('./developerTools')).jsonFormat(files[0], opts),
    textPlaceholder: '{\n  "name": "CONVET PULSE",\n  "tools": 42,\n  "offline": true\n}',
    optionFields: [
      {
        type: 'select',
        key: 'indent',
        label: 'Indentation Style',
        options: [
          { label: '2 Spaces (Standard)', value: '2' },
          { label: '4 Spaces (Readable)', value: '4' },
          { label: 'Minified (Compact single-line)', value: '0' },
          { label: 'Tabs', value: 'tab' },
        ],
        default: '2',
      },
    ],
    optionsHint: 'Formats, validates, or minifies JSON data with line & column syntax diagnostics.',
  },

  'sql-formatter': {
    processor: async (files, opts) => (await import('./developerTools')).sqlFormat(files[0], opts),
    textPlaceholder: 'select u.id, u.email, count(j.id) as total_jobs from users u left join jobs j on u.id = j.user_id where u.active = 1 group by u.id, u.email order by total_jobs desc limit 10;',
    optionFields: [
      {
        type: 'select',
        key: 'casing',
        label: 'Keyword Casing',
        options: [
          { label: 'UPPERCASE (Standard)', value: 'upper' },
          { label: 'lowercase', value: 'lower' },
        ],
        default: 'upper',
      },
    ],
    optionsHint: 'Formats complex SQL queries with consistent keyword casing and readable indentation.',
  },

  'diff-checker': {
    processor: async (files, opts) => (await import('./developerTools')).diffCheck(files[0], opts),
    textPlaceholder: '===ORIGINAL===\nfunction convert(file) {\n  return process(file);\n}\n===MODIFIED===\nasync function convert(file, options = {}) {\n  const result = await process(file, options);\n  return result;\n}',
    optionsHint: 'Computes line-by-line unified diff between original and modified text.',
  },

  'hash-generator': {
    processor: async (files, opts) => (await import('./developerTools')).hashGenerate(files[0], opts),
    textPlaceholder: 'Enter text here to generate cryptographic hashes…',
    optionFields: [
      {
        type: 'select',
        key: 'algorithm',
        label: 'Target Hash Algorithm',
        options: [
          { label: 'All Supported Hashes (MD5, SHA-1, SHA-256, SHA-512)', value: 'all' },
          { label: 'SHA-256 (Modern Standard)', value: 'sha256' },
          { label: 'MD5 (Legacy Checksum)', value: 'md5' },
          { label: 'SHA-1 (Legacy Git)', value: 'sha1' },
          { label: 'SHA-512 (High Security)', value: 'sha512' },
        ],
        default: 'all',
      },
    ],
    optionsHint: 'Computes cryptographic hashes via Web Crypto APIs and pure MD5 engine.',
  },

  'base64-encoder-decoder': {
    processor: async (files, opts) => (await import('./developerTools')).base64Codec(files[0], opts),
    textPlaceholder: 'Enter text to encode to Base64, or paste Base64 to decode…',
    optionFields: [
      {
        type: 'select',
        key: 'mode',
        label: 'Operation Mode',
        options: [
          { label: 'Encode to Base64', value: 'encode' },
          { label: 'Decode from Base64', value: 'decode' },
        ],
        default: 'encode',
      },
      { type: 'checkbox', key: 'urlSafe', label: 'Use URL-safe alphabet (- and _ without padding)', default: false },
    ],
    optionsHint: 'Encodes and decodes text with full UTF-8 Unicode support.',
  },

  'url-encoder-decoder': {
    processor: async (files, opts) => (await import('./developerTools')).urlCodec(files[0], opts),
    textPlaceholder: 'https://convetpulse.onrender.com/search?q=pdf tools&category=developer studio',
    optionFields: [
      {
        type: 'select',
        key: 'mode',
        label: 'Operation Mode',
        options: [
          { label: 'Encode URL Components', value: 'encode' },
          { label: 'Decode URL Components', value: 'decode' },
          { label: 'Full URI Encode', value: 'encode-full' },
        ],
        default: 'encode',
      },
    ],
    optionsHint: 'Encodes and decodes percent-encoded URL components and parameters.',
  },

  'uuid-generator': {
    processor: async (files, opts) => (await import('./developerTools')).uuidGenerate(files[0], opts),
    optionFields: [
      { type: 'number', key: 'count', label: 'Quantity to Generate', min: 1, max: 100, default: 5 },
      {
        type: 'select',
        key: 'format',
        label: 'Output Format',
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

  // ── PDF SECURITY STUDIO (5 tools) ─────────────────────
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
      { type: 'text', key: 'searchTerm', label: 'Sensitive Phrase to Permanently Erase', placeholder: 'e.g. CONFIDENTIAL or SSN', default: 'CONFIDENTIAL' },
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

  // ── UTILITIES (2 tools) ───────────────────────────────
  'qr-generator': {
    processor: async (files, opts) => (await import('./textTools')).runTextTool('qr-generator', files[0], opts),
    textPlaceholder: 'Enter the text or URL for the QR code…',
    optionFields: [{ type: 'number', key: 'size', label: 'Image size (px)', min: 128, max: 1024, default: 512 }],
  },

  'barcode-generator': {
    processor: async (files, opts) => (await import('./barcodeTools')).processBarcode(files, opts),
    textPlaceholder: 'CONVET-12345',
    optionFields: [
      {
        type: 'select',
        key: 'format',
        label: 'Barcode Format',
        options: [
          { label: 'Code 128 (Standard Alphanumeric)', value: 'code128' },
          { label: 'EAN-13 (13-Digit Retail / Grocery)', value: 'ean13' },
          { label: 'UPC-A (12-Digit Retail USA)', value: 'upca' },
          { label: 'EAN-8 (8-Digit Compact Retail)', value: 'ean8' },
          { label: 'Code 39 (Industrial & Military)', value: 'code39' },
          { label: 'ITF (Interleaved 2 of 5 - Shipping)', value: 'itf' },
          { label: 'Codabar (Logistics & Libraries)', value: 'codabar' },
        ],
        default: 'code128',
      },
      { type: 'text', key: 'text', label: 'Barcode Content Value', placeholder: 'e.g. 9780201379624 or ITEM-123', default: 'CONVET-12345' },
      {
        type: 'select',
        key: 'outputFormat',
        label: 'Output Image Format',
        options: [
          { label: 'PNG (Raster Image)', value: 'png' },
          { label: 'SVG (Scalable Vector)', value: 'svg' },
        ],
        default: 'png',
      },
      { type: 'range', key: 'width', label: 'Bar Width Scale', min: 1, max: 4, step: 1, default: 2 },
      { type: 'range', key: 'height', label: 'Barcode Height (px)', min: 40, max: 160, step: 10, default: 80, unit: 'px' },
      { type: 'checkbox', key: 'displayValue', label: 'Show human-readable text below barcode', default: true },
    ],
    optionsHint: 'Generates high-precision 1D barcodes with strict format validation and check-digit calculation.',
  },

  // ── ARCHIVE (2 tools) ─────────────────────────────────
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
