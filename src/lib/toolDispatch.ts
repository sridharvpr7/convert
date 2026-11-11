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
    processor: async (files, _opts) => {
      const { watermarkPdf } = await import('./processors');
      return watermarkPdf(files[0], '', { opacity: 0 });
    },
    optionFields: [
      {
        type: 'select',
        key: 'level',
        label: 'Compression Level',
        options: [
          { label: 'Low (better quality)', value: 'low' },
          { label: 'Medium (balanced)', value: 'medium' },
          { label: 'High (smaller file)', value: 'high' },
        ],
        default: 'medium',
      },
    ],
    optionsHint: 'Browser-side compression re-saves the PDF and strips unused objects.',
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
    processor: async (files) => (await import('./dataTools')).csvToExcel(files[0]),
  },

  'excel-to-csv': {
    processor: async (files) => (await import('./dataTools')).excelToCsv(files[0]),
  },

  'json-to-csv': {
    processor: async (files) => {
      const { jsonToCsv } = await import('./processors');
      return jsonToCsv(files[0]);
    },
  },

  'csv-to-json': {
    processor: async (files) => {
      const { csvToJson } = await import('./processors');
      return csvToJson(files[0]);
    },
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
