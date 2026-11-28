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
    optionsHint: 'Extracts searchable PDF text streams into an editable Excel spreadsheet (.xlsx). Generates native editable cells. Note: Scanned bitmap PDFs without text layers require OCR and complex graphical lines are not preserved.',
  },

  'pdf-to-powerpoint': {
    processor: async (files, opts) => (await import('./pdfExtendedTools')).pdfToPowerPoint(files[0], opts),
    optionsHint: 'Converts each PDF page into an editable 16:9 widescreen PowerPoint presentation (.pptx) with structured slide text containers. Note: Vector graphics and proprietary layout geometries are simplified to slide text runs.',
  },

  'word-to-pdf': {
    processor: async (files, opts) => (await import('./pdfExtendedTools')).wordToPdf(files[0], opts),
    optionsHint: 'Converts Microsoft Word (.docx) body text and headings into a portable A4 PDF document with word-wrapping. Note: Converts text and standard paragraphs; complex WordArt, macros, and advanced shapes are omitted.',
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
    optionsHint: 'Converts Microsoft Excel (.xlsx) spreadsheets into a formatted, printable PDF document with auto-sized table columns and page breaks.',
  },

  'powerpoint-to-pdf': {
    processor: async (files, opts) => (await import('./pdfExtendedTools')).powerPointToPdf(files[0], opts),
    optionsHint: 'Converts Microsoft PowerPoint (.pptx) slide text runs into a clean 16:9 widescreen PDF presentation. Note: Text content is converted; complex animations, slide transitions, and vector smart art are not preserved.',
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

  // ── PDF STUDIO PHASE 2 EXPANSIONS (6 tools) ───────────
  'pdf-ocr': {
    processor: async (files, opts) => (await import('./pdfStudioPhase2')).pdfOcr(files[0], opts),
    optionFields: [
      {
        type: 'select',
        key: 'lang',
        label: 'Recognition Language',
        options: [
          { label: 'English (Latin script)', value: 'eng' },
          { label: 'Tamil (தமிழ்)', value: 'tam' },
          { label: 'English + Tamil (Multilingual)', value: 'eng+tam' },
        ],
        default: 'eng',
      },
      {
        type: 'select',
        key: 'outputFormat',
        label: 'Output Format',
        options: [
          { label: 'Searchable PDF (Invisible OCR text layer)', value: 'searchable-pdf' },
          { label: 'Plain Text (.txt)', value: 'text' },
        ],
        default: 'searchable-pdf',
      },
      { type: 'text', key: 'pageRange', label: 'Page Range', placeholder: 'all or e.g. 1-5', default: 'all' },
    ],
    optionsHint: 'Runs Tesseract.js OCR locally in your browser via PDF.js page rendering. OCR language data models may download to your browser on first use; your PDF and recognized text never leave your device.',
  },

  'sign-pdf': {
    processor: async (files, opts) => (await import('./pdfStudioPhase2')).signPdf(files[0], opts),
    optionFields: [
      { type: 'text', key: 'signerName', label: 'Signer Name / Title', placeholder: 'e.g. John Doe, M.D.', default: 'Authorized Signer' },
      {
        type: 'select',
        key: 'targetPage',
        label: 'Apply Signature To',
        options: [
          { label: 'Last Page (Standard)', value: 'last' },
          { label: 'First Page', value: 'first' },
          { label: 'All Pages', value: 'all' },
        ],
        default: 'last',
      },
      {
        type: 'select',
        key: 'position',
        label: 'Signature Placement',
        options: [
          { label: 'Bottom Right', value: 'bottom-right' },
          { label: 'Bottom Left', value: 'bottom-left' },
          { label: 'Top Right', value: 'top-right' },
          { label: 'Center', value: 'center' },
        ],
        default: 'bottom-right',
      },
      { type: 'checkbox', key: 'addTimestamp', label: 'Add Date & Visual Signing Notice', default: true },
    ],
    optionsHint: 'Embeds a visual electronic signature and timestamp notice on target pages (not a PKI certificate-backed digital signature).',
  },

  'fill-pdf-forms': {
    processor: async (files, opts) => (await import('./pdfStudioPhase2')).fillPdfForms(files[0], opts),
    optionFields: [
      { type: 'checkbox', key: 'flatten', label: 'Flatten Form (make fields permanent & non-editable)', default: true },
    ],
    optionsHint: 'Detects and populates interactive AcroForm fields, then locks or exports the PDF. Dynamic Adobe XFA forms are detected and reported as unsupported.',
  },

  'reorder-pdf-pages': {
    processor: async (files, opts) => (await import('./pdfStudioPhase2')).reorderPdfPages(files[0], opts),
    optionFields: [
      { type: 'text', key: 'order', label: 'New Page Order (comma-separated)', placeholder: 'e.g. 3, 1, 2, 4', default: '' },
      {
        type: 'select',
        key: 'rotation',
        label: 'Rotate Pages (clockwise)',
        options: [
          { label: 'No rotation (0°)', value: '0' },
          { label: '90° Clockwise', value: '90' },
          { label: '180° Invert', value: '180' },
          { label: '270° Counter-Clockwise', value: '270' },
        ],
        default: '0',
      },
      { type: 'text', key: 'deletePages', label: 'Delete Pages (comma-separated)', placeholder: 'e.g. 2, 5', default: '' },
    ],
    optionsHint: 'Reorder, rotate, duplicate, or delete specific pages with zero-page guard.',
  },

  'compare-pdf': {
    multiFile: true,
    processor: async (files, opts) => (await import('./pdfStudioPhase2')).comparePdf(files, opts),
    optionsHint: 'Select two PDF documents (Original & Modified) for text and structural comparison (added, removed, and changed text, page count, and page size differences). Visual pixel-level layout comparison is not included.',
  },

  'pdf-to-images': {
    processor: async (files, opts) => (await import('./pdfStudioPhase2')).pdfToImagesBatch(files[0], opts),
    optionFields: [
      {
        type: 'select',
        key: 'format',
        label: 'Image Output Format',
        options: [
          { label: 'PNG (Lossless - Sharp text)', value: 'png' },
          { label: 'JPEG (Compact - Smaller file size)', value: 'jpg' },
        ],
        default: 'png',
      },
      {
        type: 'select',
        key: 'dpi',
        label: 'Render Resolution (DPI)',
        options: [
          { label: '72 DPI (Screen / Fast)', value: '72' },
          { label: '150 DPI (Standard Print)', value: '150' },
          { label: '300 DPI (High Resolution)', value: '300' },
        ],
        default: '150',
      },
      { type: 'text', key: 'pageRange', label: 'Page Range', placeholder: 'all or e.g. 1-3', default: 'all' },
    ],
    optionsHint: 'Renders genuine PDF pages (text, vectors, and images) via PDF.js to PNG/JPEG images with previews, individual downloads, and ZIP batch export.',
  },

  // ── IMAGE & DESIGN STUDIO (Phase 4 - 10 tools) ─────────────
  'image-converter': {
    processor: async (files, opts) => {
      const { imageConvert } = await import('./imageStudio');
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
    optionsHint: 'Converts images between PNG, JPEG, and modern WebP formats while preserving image quality.',
  },

  'image-compressor': {
    processor: async (files, opts) => {
      const { imageCompress } = await import('./imageStudio');
      const q = Number(opts.quality ?? 75) / 100;
      const maxWidth = opts.maxWidth ? Number(opts.maxWidth) : undefined;
      return imageCompress(files[0], { quality: q, maxWidth });
    },
    optionFields: [
      { type: 'range', key: 'quality', label: 'Compression Quality', min: 10, max: 100, step: 5, default: 75, unit: '%' },
      { type: 'number', key: 'maxWidth', label: 'Max Width (px, optional)', min: 100, max: 8000, default: 1920 },
    ],
    optionsHint: 'Shrinks photo file size with adjustable compression quality and maximum resolution downscaling.',
  },

  'image-resize': {
    processor: async (files, opts) => {
      const { imageResize } = await import('./imageStudio');
      const width = Number(opts.width ?? 800);
      const height = Number(opts.height ?? 600);
      const maintainAspect = opts.maintainAspect !== false;
      return imageResize(files[0], { width, height, maintainAspect });
    },
    optionFields: [
      { type: 'number', key: 'width', label: 'Width (px)', min: 10, max: 10000, default: 800 },
      { type: 'number', key: 'height', label: 'Height (px)', min: 10, max: 10000, default: 600 },
      { type: 'checkbox', key: 'maintainAspect', label: 'Maintain aspect ratio lock', default: true },
    ],
    optionsHint: 'Scales picture dimensions with high-quality bicubic smoothing.',
  },

  'image-crop': {
    processor: async (files, opts) => {
      const { imageCrop } = await import('./imageStudio');
      const ratio = (opts.ratio as 'free' | '1:1' | '4:3' | '16:9' | '3:2') ?? '1:1';
      return imageCrop(files[0], { ratio });
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
          { label: 'Classic Photo (3:2)', value: '3:2' },
          { label: 'Free / Unconstrained', value: 'free' },
        ],
        default: '1:1',
      },
    ],
    optionsHint: 'Trims outer margins with aspect ratio constraints.',
  },

  'image-rotator-flipper': {
    processor: async (files, opts) => {
      const { imageRotatorFlipper } = await import('./imageStudio');
      const rotation = Number(opts.rotation ?? 90);
      const flip = (opts.flip as 'none' | 'horizontal' | 'vertical' | 'both') ?? 'none';
      return imageRotatorFlipper(files[0], { rotation, flip });
    },
    optionFields: [
      {
        type: 'select',
        key: 'rotation',
        label: 'Rotation Angle',
        options: [
          { label: '0° (No rotation)', value: '0' },
          { label: '90° Clockwise', value: '90' },
          { label: '180° Half Turn', value: '180' },
          { label: '270° Counter-Clockwise', value: '270' },
        ],
        default: '90',
      },
      {
        type: 'select',
        key: 'flip',
        label: 'Flip / Mirror',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Horizontal Mirror (Left ↔ Right)', value: 'horizontal' },
          { label: 'Vertical Flip (Top ↕ Bottom)', value: 'vertical' },
          { label: 'Both Directions', value: 'both' },
        ],
        default: 'none',
      },
    ],
    optionsHint: 'Rotates images by 90°, 180°, 270° and flips horizontally or vertically with alpha channel preservation.',
  },

  'image-watermark': {
    processor: async (files, opts) => {
      const { imageWatermark } = await import('./imageStudio');
      const text = String(opts.text || 'CONVET PULSE');
      const position = (opts.position as any) || 'center';
      const opacity = Number(opts.opacity ?? 40) / 100;
      const fontSize = Number(opts.fontSize ?? 36);
      const color = String(opts.color || '#ffffff');
      return imageWatermark(files[0], { text, position, opacity, fontSize, color });
    },
    optionFields: [
      { type: 'text', key: 'text', label: 'Watermark Text (English or Tamil)', placeholder: 'CONVET PULSE / முத்திரை', default: 'CONVET PULSE' },
      {
        type: 'select',
        key: 'position',
        label: 'Positioning & Layout',
        options: [
          { label: 'Center (Diagonal Stamp)', value: 'center' },
          { label: 'Tiled Repeating Grid', value: 'tile' },
          { label: 'Bottom Right Corner', value: 'bottom-right' },
          { label: 'Bottom Left Corner', value: 'bottom-left' },
          { label: 'Top Right Corner', value: 'top-right' },
          { label: 'Top Left Corner', value: 'top-left' },
        ],
        default: 'center',
      },
      { type: 'range', key: 'opacity', label: 'Watermark Opacity', min: 10, max: 100, step: 5, default: 40, unit: '%' },
      { type: 'number', key: 'fontSize', label: 'Font Size (px)', min: 12, max: 120, default: 36 },
      { type: 'text', key: 'color', label: 'Text Color (Hex)', placeholder: '#ffffff', default: '#ffffff' },
    ],
    optionsHint: 'Overlays copyright or custom text watermarks with full Unicode and Tamil script rendering support.',
  },

  'image-metadata-cleaner': {
    processor: async (files, opts) => {
      const { imageMetadataCleaner } = await import('./imageStudio');
      const format = (opts.format as 'jpeg' | 'png' | 'webp') || undefined;
      return imageMetadataCleaner(files[0], { format });
    },
    optionFields: [
      {
        type: 'select',
        key: 'format',
        label: 'Output Image Format',
        options: [
          { label: 'Preserve Input Format', value: 'jpeg' },
          { label: 'PNG (Lossless Sanitized)', value: 'png' },
          { label: 'WebP (Modern Compact Sanitized)', value: 'webp' },
        ],
        default: 'jpeg',
      },
    ],
    optionsHint: 'Re-encodes images to permanently strip EXIF metadata, GPS coordinates, device models, and date stamps.',
  },

  'image-adjustments': {
    processor: async (files, opts) => {
      const { imageAdjustments } = await import('./imageStudio');
      return imageAdjustments(files[0], {
        brightness: Number(opts.brightness ?? 0),
        contrast: Number(opts.contrast ?? 0),
        saturation: Number(opts.saturation ?? 0),
        grayscale: Number(opts.grayscale ?? 0),
        blur: Number(opts.blur ?? 0),
        sharpen: Boolean(opts.sharpen),
      });
    },
    optionFields: [
      { type: 'range', key: 'brightness', label: 'Brightness', min: -100, max: 100, step: 5, default: 0, unit: '%' },
      { type: 'range', key: 'contrast', label: 'Contrast', min: -100, max: 100, step: 5, default: 0, unit: '%' },
      { type: 'range', key: 'saturation', label: 'Saturation', min: -100, max: 100, step: 5, default: 0, unit: '%' },
      { type: 'range', key: 'grayscale', label: 'Grayscale Filter', min: 0, max: 100, step: 10, default: 0, unit: '%' },
      { type: 'range', key: 'blur', label: 'Gaussian Blur (px)', min: 0, max: 20, step: 1, default: 0, unit: 'px' },
      { type: 'checkbox', key: 'sharpen', label: 'Apply 3x3 high-pass sharpen convolution filter', default: false },
    ],
    optionsHint: 'Fine-tunes brightness, contrast, saturation, grayscale, blur, and sharpening with genuine canvas filters.',
  },

  'image-color-picker': {
    processor: async (files, opts) => {
      const { imageColorPicker } = await import('./imageStudio');
      const sampleMode = (opts.sampleMode as 'point' | '3x3' | '5x5') || 'point';
      return imageColorPicker(files[0], { sampleMode });
    },
    optionFields: [
      {
        type: 'select',
        key: 'sampleMode',
        label: 'Pixel Sampling Mode',
        options: [
          { label: 'Single Point (Exact Pixel)', value: 'point' },
          { label: '3×3 Average Area Box', value: '3x3' },
          { label: '5×5 Smooth Area Box', value: '5x5' },
        ],
        default: 'point',
      },
    ],
    optionsHint: 'Samples exact pixel colors with HEX, RGB, and HSL values. Generates a downloadable color swatch card.',
  },

  'image-palette-extractor': {
    processor: async (files, opts) => {
      const { imagePaletteExtractor } = await import('./imageStudio');
      const count = Number(opts.count ?? 6);
      return imagePaletteExtractor(files[0], { count });
    },
    optionFields: [
      {
        type: 'select',
        key: 'count',
        label: 'Number of Dominant Colors',
        options: [
          { label: '4 Dominant Colors', value: '4' },
          { label: '6 Dominant Colors (Recommended)', value: '6' },
          { label: '8 Dominant Colors', value: '8' },
        ],
        default: '6',
      },
    ],
    optionsHint: 'Extracts dominant representative colors and generates a high-resolution color palette card (.png).',
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

  // ── DOCUMENT STUDIO PHASE 3 EXPANSIONS (10 tools) ───────────
  'docx-creator': {
    processor: async (files, opts) => (await import('./documentStudio')).processDocxCreator(files, opts),
    optionFields: [
      {
        type: 'select',
        key: 'templateId',
        label: 'Document Template',
        options: [
          { label: 'Blank Document', value: 'blank' },
          { label: 'Formal Letter', value: 'letter' },
          { label: 'Professional Resume', value: 'resume' },
          { label: 'Project Report', value: 'project-report' },
          { label: 'Meeting Notes', value: 'meeting-notes' },
          { label: 'Student Assignment', value: 'student-assignment' },
          { label: 'Research Paper', value: 'research-paper' },
          { label: 'Business Invoice', value: 'invoice' },
          { label: 'Project Proposal', value: 'proposal' },
        ],
        default: 'letter',
      },
      {
        type: 'select',
        key: 'orientation',
        label: 'Page Orientation',
        options: [
          { label: 'Portrait', value: 'portrait' },
          { label: 'Landscape', value: 'landscape' },
        ],
        default: 'portrait',
      },
      {
        type: 'select',
        key: 'fontSize',
        label: 'Font Size',
        options: [
          { label: '10 pt (Compact)', value: '20' },
          { label: '11 pt (Standard Office)', value: '22' },
          { label: '12 pt (Standard Academic)', value: '24' },
          { label: '14 pt (Large Print)', value: '28' },
        ],
        default: '24',
      },
    ],
    optionsHint: 'Create a clean, formatted Word (.docx) document with professional templates and typography.',
  },

  'docx-editor': {
    processor: async (files, opts) => (await import('./documentStudio')).processDocxEditor(files, opts),
    optionFields: [
      {
        type: 'select',
        key: 'outputFormat',
        label: 'Export Format',
        options: [
          { label: 'Word Document (.docx)', value: 'docx' },
          { label: 'Plain Text (.txt)', value: 'txt' },
          { label: 'Web Page (.html)', value: 'html' },
        ],
        default: 'docx',
      },
    ],
    optionsHint: 'Upload a Microsoft Word (.docx) file to view, edit text, or convert to HTML/Text.',
  },

  'markdown-editor': {
    processor: async (files, opts) => (await import('./documentStudio')).processMarkdownStudio(files, opts),
    textPlaceholder: '# My Document\n\nWrite your markdown content here...',
    optionFields: [
      {
        type: 'select',
        key: 'exportFormat',
        label: 'Export Format',
        options: [
          { label: 'Web Page (.html)', value: 'html' },
          { label: 'PDF Document (.pdf)', value: 'pdf' },
          { label: 'Word Document (.docx)', value: 'docx' },
          { label: 'Markdown (.md)', value: 'md' },
        ],
        default: 'html',
      },
    ],
    optionsHint: 'Write Markdown with real-time preview and export to HTML, PDF, or Word DOCX.',
  },

  'text-editor': {
    processor: async (files, opts) => (await import('./documentStudio')).processTextStudio(files, opts),
    textPlaceholder: 'Type or paste plain text here...',
    optionFields: [
      {
        type: 'select',
        key: 'exportFormat',
        label: 'Export Format',
        options: [
          { label: 'Plain Text (.txt)', value: 'txt' },
          { label: 'Word Document (.docx)', value: 'docx' },
          { label: 'Rich Text (.rtf)', value: 'rtf' },
        ],
        default: 'txt',
      },
      { type: 'text', key: 'findText', label: 'Find Text', placeholder: 'Text to replace...', default: '' },
      { type: 'text', key: 'replaceText', label: 'Replace With', placeholder: 'Replacement...', default: '' },
    ],
    optionsHint: 'Analyze word counts, perform search & replace, and export to TXT, DOCX, or RTF.',
  },

  'html-editor': {
    processor: async (files, opts) => (await import('./documentStudio')).processHtmlStudio(files, opts),
    textPlaceholder: '<!DOCTYPE html>\n<html>\n<head><title>Document</title></head>\n<body>\n<h1>Hello World</h1>\n<p>Content goes here...</p>\n</body>\n</html>',
    optionFields: [
      {
        type: 'select',
        key: 'exportFormat',
        label: 'Export Format',
        options: [
          { label: 'HTML Document (.html)', value: 'html' },
          { label: 'PDF Document (.pdf)', value: 'pdf' },
          { label: 'Plain Text (.txt)', value: 'txt' },
        ],
        default: 'html',
      },
    ],
    optionsHint: 'Edit HTML with live sandboxed preview and DOMPurify script protection.',
  },

  'rtf-converter': {
    processor: async (files, opts) => (await import('./documentStudio')).processRtfConverter(files, opts),
    optionsHint: 'Bidirectional conversion between Rich Text (.rtf) and Plain Text (.txt) or DOCX with Unicode escape support.',
  },

  'docx-to-txt': {
    processor: async (files, opts) => (await import('./documentStudio')).processDocxToTxt(files, opts),
    optionsHint: 'Extract clean, readable plain text from Word .docx documents.',
  },

  'markdown-to-pdf': {
    processor: async (files, opts) => (await import('./documentStudio')).processMarkdownToPdf(files, opts),
    optionsHint: 'Convert Markdown documents to clean formatted PDF files.',
  },

  'markdown-to-docx': {
    processor: async (files, opts) => (await import('./documentStudio')).processMarkdownToDocx(files, opts),
    optionsHint: 'Convert Markdown headings, bullet points, and text into Microsoft Word (.docx).',
  },

  'txt-to-docx': {
    processor: async (files, opts) => (await import('./documentStudio')).processTxtToDocx(files, opts),
    optionsHint: 'Convert plain text files into styled Microsoft Word (.docx) documents.',
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
