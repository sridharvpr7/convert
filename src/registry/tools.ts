// ============================================================
// CONVETER — Central Tool Registry
// Every tool in the platform is registered here.
// The UI automatically builds from this registry.
// ============================================================

export type ToolCategory =
  | 'pdf'
  | 'image'
  | 'data'
  | 'utilities'
  | 'archive';

export type ProcessingMode = 'local' | 'cloud' | 'hybrid';

export interface Tool {
  id: string;
  name: string;
  slug: string;
  category: ToolCategory;
  description: string;
  longDescription?: string;
  icon: string; // Lucide icon name
  tags: string[];
  supportedInputFormats?: string[];
  supportedOutputFormats?: string[];
  inputTypes: ('file' | 'text' | 'url' | 'camera' | 'clipboard')[];
  outputTypes: ('file' | 'text' | 'preview')[];
  processingMode: ProcessingMode;
  offlineSupported: boolean;
  onlineSupported: boolean;
  premium: boolean;
  batchSupported: boolean;
  workflowSupported: boolean;
  popular?: boolean;
  new?: boolean;
  status: 'stable' | 'beta' | 'coming-soon';
  relatedTools?: string[]; // tool slugs
}

export interface ToolCategory_Meta {
  id: ToolCategory;
  name: string;
  description: string;
  icon: string;
  color: string;
  bgClass: string;
}

// ============================================================
// CATEGORY METADATA
// ============================================================
export const CATEGORY_META: Record<ToolCategory, ToolCategory_Meta> = {
  pdf: {
    id: 'pdf',
    name: 'PDF Tools',
    description: 'Merge, split, compress, rotate, and convert PDF files',
    icon: 'FileText',
    color: '#ef4444',
    bgClass: 'cat-pdf',
  },
  image: {
    id: 'image',
    name: 'Image Tools',
    description: 'Convert, compress, resize, and crop images',
    icon: 'Image',
    color: '#f59e0b',
    bgClass: 'cat-image',
  },
  data: {
    id: 'data',
    name: 'Data & Spreadsheet',
    description: 'Convert between CSV, Excel, and JSON formats',
    icon: 'Table',
    color: '#10b981',
    bgClass: 'cat-data',
  },
  utilities: {
    id: 'utilities',
    name: 'Utilities',
    description: 'Quick everyday utilities including QR code generator',
    icon: 'Wrench',
    color: '#06b6d4',
    bgClass: 'cat-utilities',
  },
  archive: {
    id: 'archive',
    name: 'Archive & Compression',
    description: 'Compress and extract ZIP archives',
    icon: 'Archive',
    color: '#8b5cf6',
    bgClass: 'cat-archive',
  },
};

// ============================================================
// MASTER TOOL LIST (17 Tools)
// ============================================================
export const TOOLS: Tool[] = [
  // ── PDF (6 tools) ──────────────────────────────────────────
  {
    id: 'pdf-merge',
    name: 'Merge PDF',
    slug: 'merge-pdf',
    category: 'pdf',
    description: 'Combine multiple PDF files into one document',
    icon: 'FilePlus2',
    tags: ['merge', 'combine', 'join', 'pdf'],
    supportedInputFormats: ['pdf'],
    supportedOutputFormats: ['pdf'],
    inputTypes: ['file'],
    outputTypes: ['file'],
    processingMode: 'local',
    offlineSupported: true,
    onlineSupported: true,
    premium: false,
    batchSupported: false,
    workflowSupported: true,
    popular: true,
    status: 'stable',
    relatedTools: ['split-pdf', 'compress-pdf', 'rotate-pdf'],
  },
  {
    id: 'pdf-split',
    name: 'Split PDF',
    slug: 'split-pdf',
    category: 'pdf',
    description: 'Split a PDF into multiple files by pages or ranges',
    icon: 'Scissors',
    tags: ['split', 'separate', 'extract', 'pdf', 'pages'],
    supportedInputFormats: ['pdf'],
    supportedOutputFormats: ['pdf'],
    inputTypes: ['file'],
    outputTypes: ['file'],
    processingMode: 'local',
    offlineSupported: true,
    onlineSupported: true,
    premium: false,
    batchSupported: false,
    workflowSupported: true,
    popular: true,
    status: 'stable',
    relatedTools: ['merge-pdf', 'compress-pdf', 'rotate-pdf'],
  },
  {
    id: 'pdf-compress',
    name: 'Compress PDF',
    slug: 'compress-pdf',
    category: 'pdf',
    description: 'Reduce PDF file size while maintaining quality',
    icon: 'Minimize2',
    tags: ['compress', 'reduce', 'size', 'optimize', 'pdf'],
    supportedInputFormats: ['pdf'],
    supportedOutputFormats: ['pdf'],
    inputTypes: ['file'],
    outputTypes: ['file'],
    processingMode: 'local',
    offlineSupported: true,
    onlineSupported: true,
    premium: false,
    batchSupported: true,
    workflowSupported: true,
    popular: true,
    status: 'stable',
    relatedTools: ['merge-pdf', 'split-pdf', 'pdf-to-text'],
  },
  {
    id: 'pdf-rotate',
    name: 'Rotate PDF',
    slug: 'rotate-pdf',
    category: 'pdf',
    description: 'Rotate PDF pages by 90°, 180° or 270°',
    icon: 'RotateCw',
    tags: ['rotate', 'orientation', 'pages', 'pdf'],
    supportedInputFormats: ['pdf'],
    supportedOutputFormats: ['pdf'],
    inputTypes: ['file'],
    outputTypes: ['file'],
    processingMode: 'local',
    offlineSupported: true,
    onlineSupported: true,
    premium: false,
    batchSupported: true,
    workflowSupported: true,
    status: 'stable',
    relatedTools: ['merge-pdf', 'split-pdf'],
  },
  {
    id: 'jpg-to-pdf',
    name: 'JPG to PDF',
    slug: 'jpg-to-pdf',
    category: 'pdf',
    description: 'Convert JPG images to PDF document',
    icon: 'ImagePlus',
    tags: ['jpg', 'jpeg', 'image', 'to', 'pdf', 'convert'],
    supportedInputFormats: ['jpg', 'jpeg'],
    supportedOutputFormats: ['pdf'],
    inputTypes: ['file'],
    outputTypes: ['file'],
    processingMode: 'local',
    offlineSupported: true,
    onlineSupported: true,
    premium: false,
    batchSupported: true,
    workflowSupported: true,
    popular: true,
    status: 'stable',
    relatedTools: ['merge-pdf', 'image-converter'],
  },
  {
    id: 'pdf-to-txt',
    name: 'PDF to Text',
    slug: 'pdf-to-text',
    category: 'pdf',
    description: 'Extract all text content from PDF files',
    icon: 'AlignLeft',
    tags: ['pdf', 'to', 'text', 'txt', 'extract'],
    supportedInputFormats: ['pdf'],
    supportedOutputFormats: ['txt'],
    inputTypes: ['file'],
    outputTypes: ['file', 'text'],
    processingMode: 'local',
    offlineSupported: true,
    onlineSupported: true,
    premium: false,
    batchSupported: true,
    workflowSupported: true,
    status: 'stable',
    relatedTools: ['merge-pdf', 'split-pdf'],
  },

  // ── IMAGE (4 tools) ────────────────────────────────────────
  {
    id: 'image-converter',
    name: 'Image Converter',
    slug: 'image-converter',
    category: 'image',
    description: 'Convert images between JPG, PNG, and WEBP formats',
    icon: 'RefreshCw',
    tags: ['convert', 'image', 'jpg', 'png', 'webp'],
    supportedInputFormats: ['jpg', 'jpeg', 'png', 'webp'],
    supportedOutputFormats: ['jpg', 'png', 'webp'],
    inputTypes: ['file'],
    outputTypes: ['file'],
    processingMode: 'local',
    offlineSupported: true,
    onlineSupported: true,
    premium: false,
    batchSupported: true,
    workflowSupported: true,
    popular: true,
    status: 'stable',
    relatedTools: ['image-compressor', 'image-resize', 'image-crop'],
  },
  {
    id: 'image-compressor',
    name: 'Image Compressor',
    slug: 'image-compressor',
    category: 'image',
    description: 'Reduce image file size without visible quality loss',
    icon: 'Minimize2',
    tags: ['compress', 'reduce', 'optimize', 'image'],
    supportedInputFormats: ['jpg', 'jpeg', 'png', 'webp'],
    supportedOutputFormats: ['jpg', 'png', 'webp'],
    inputTypes: ['file'],
    outputTypes: ['file'],
    processingMode: 'local',
    offlineSupported: true,
    onlineSupported: true,
    premium: false,
    batchSupported: true,
    workflowSupported: true,
    popular: true,
    status: 'stable',
    relatedTools: ['image-converter', 'image-resize', 'image-crop'],
  },
  {
    id: 'image-resize',
    name: 'Image Resize',
    slug: 'image-resize',
    category: 'image',
    description: 'Resize images by dimensions or percentage',
    icon: 'Scaling',
    tags: ['resize', 'scale', 'dimension', 'image'],
    supportedInputFormats: ['jpg', 'jpeg', 'png', 'webp'],
    supportedOutputFormats: ['jpg', 'png', 'webp'],
    inputTypes: ['file'],
    outputTypes: ['file'],
    processingMode: 'local',
    offlineSupported: true,
    onlineSupported: true,
    premium: false,
    batchSupported: true,
    workflowSupported: true,
    popular: true,
    status: 'stable',
    relatedTools: ['image-crop', 'image-compressor', 'image-converter'],
  },
  {
    id: 'image-crop',
    name: 'Image Crop',
    slug: 'image-crop',
    category: 'image',
    description: 'Crop images to specific dimensions or aspect ratios',
    icon: 'Crop',
    tags: ['crop', 'trim', 'cut', 'image'],
    supportedInputFormats: ['jpg', 'jpeg', 'png', 'webp'],
    supportedOutputFormats: ['jpg', 'png', 'webp'],
    inputTypes: ['file'],
    outputTypes: ['file'],
    processingMode: 'local',
    offlineSupported: true,
    onlineSupported: true,
    premium: false,
    batchSupported: false,
    workflowSupported: true,
    status: 'stable',
    relatedTools: ['image-resize', 'image-compressor', 'image-converter'],
  },

  // ── DATA (4 tools) ─────────────────────────────────────────
  {
    id: 'csv-to-excel',
    name: 'CSV to Excel',
    slug: 'csv-to-excel',
    category: 'data',
    description: 'Convert CSV files to Excel spreadsheets',
    icon: 'Table2',
    tags: ['csv', 'to', 'excel', 'xlsx', 'convert'],
    supportedInputFormats: ['csv', 'tsv'],
    supportedOutputFormats: ['xlsx'],
    inputTypes: ['file'],
    outputTypes: ['file'],
    processingMode: 'local',
    offlineSupported: true,
    onlineSupported: true,
    premium: false,
    batchSupported: true,
    workflowSupported: true,
    popular: true,
    status: 'stable',
    relatedTools: ['excel-to-csv', 'csv-to-json', 'json-to-csv'],
  },
  {
    id: 'excel-to-csv',
    name: 'Excel to CSV',
    slug: 'excel-to-csv',
    category: 'data',
    description: 'Convert Excel spreadsheets to CSV format',
    icon: 'Table',
    tags: ['excel', 'xlsx', 'to', 'csv', 'convert'],
    supportedInputFormats: ['xlsx', 'xls'],
    supportedOutputFormats: ['csv'],
    inputTypes: ['file'],
    outputTypes: ['file'],
    processingMode: 'local',
    offlineSupported: true,
    onlineSupported: true,
    premium: false,
    batchSupported: true,
    workflowSupported: true,
    popular: true,
    status: 'stable',
    relatedTools: ['csv-to-excel', 'csv-to-json', 'json-to-csv'],
  },
  {
    id: 'json-to-csv',
    name: 'JSON to CSV',
    slug: 'json-to-csv',
    category: 'data',
    description: 'Convert JSON data to CSV format',
    icon: 'Braces',
    tags: ['json', 'to', 'csv', 'convert', 'data'],
    supportedInputFormats: ['json'],
    supportedOutputFormats: ['csv'],
    inputTypes: ['file', 'text'],
    outputTypes: ['file', 'text'],
    processingMode: 'local',
    offlineSupported: true,
    onlineSupported: true,
    premium: false,
    batchSupported: false,
    workflowSupported: true,
    status: 'stable',
    relatedTools: ['csv-to-json', 'csv-to-excel', 'excel-to-csv'],
  },
  {
    id: 'csv-to-json',
    name: 'CSV to JSON',
    slug: 'csv-to-json',
    category: 'data',
    description: 'Convert CSV data to JSON format',
    icon: 'FileJson',
    tags: ['csv', 'to', 'json', 'convert', 'data'],
    supportedInputFormats: ['csv'],
    supportedOutputFormats: ['json'],
    inputTypes: ['file', 'text'],
    outputTypes: ['file', 'text'],
    processingMode: 'local',
    offlineSupported: true,
    onlineSupported: true,
    premium: false,
    batchSupported: false,
    workflowSupported: true,
    popular: true,
    status: 'stable',
    relatedTools: ['json-to-csv', 'csv-to-excel', 'excel-to-csv'],
  },

  // ── UTILITIES (1 tool) ──────────────────────────────────────
  {
    id: 'qr-generator',
    name: 'QR Code Generator',
    slug: 'qr-generator',
    category: 'utilities',
    description: 'Generate high-resolution QR codes for text, links, and URLs',
    icon: 'QrCode',
    tags: ['qr', 'code', 'generate', 'url', 'utilities'],
    inputTypes: ['text'],
    outputTypes: ['file', 'preview'],
    processingMode: 'local',
    offlineSupported: true,
    onlineSupported: true,
    premium: false,
    batchSupported: false,
    workflowSupported: false,
    popular: true,
    status: 'stable',
    relatedTools: ['image-converter'],
  },

  // ── ARCHIVE (2 tools) ───────────────────────────────────────
  {
    id: 'zip-compress',
    name: 'ZIP Compressor',
    slug: 'zip-compressor',
    category: 'archive',
    description: 'Create ZIP archives from multiple files',
    icon: 'Archive',
    tags: ['zip', 'compress', 'archive', 'files'],
    supportedInputFormats: ['*'],
    supportedOutputFormats: ['zip'],
    inputTypes: ['file'],
    outputTypes: ['file'],
    processingMode: 'local',
    offlineSupported: true,
    onlineSupported: true,
    premium: false,
    batchSupported: true,
    workflowSupported: true,
    popular: true,
    status: 'stable',
    relatedTools: ['zip-extractor'],
  },
  {
    id: 'zip-extract',
    name: 'ZIP Extractor',
    slug: 'zip-extractor',
    category: 'archive',
    description: 'Extract files from ZIP archives',
    icon: 'PackageOpen',
    tags: ['zip', 'extract', 'archive'],
    supportedInputFormats: ['zip'],
    supportedOutputFormats: ['*'],
    inputTypes: ['file'],
    outputTypes: ['file'],
    processingMode: 'local',
    offlineSupported: true,
    onlineSupported: true,
    premium: false,
    batchSupported: false,
    workflowSupported: true,
    popular: true,
    status: 'stable',
    relatedTools: ['zip-compressor'],
  },
];

// ============================================================
// HELPER QUERY FUNCTIONS
// ============================================================

export const getAllTools = (): Tool[] => TOOLS;

export const getToolById = (id: string): Tool | undefined =>
  TOOLS.find((t) => t.id === id);

export const getToolBySlug = (slug: string): Tool | undefined =>
  TOOLS.find((t) => t.slug === slug);

export const getToolsByCategory = (category: ToolCategory): Tool[] =>
  TOOLS.filter((t) => t.category === category);

export const getPopularTools = (limit = 8): Tool[] =>
  TOOLS.filter((t) => t.popular).slice(0, limit);

export const getNewTools = (limit = 6): Tool[] =>
  TOOLS.filter((t) => t.new).slice(0, limit);

export const searchTools = (query: string): Tool[] => {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return TOOLS.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
      t.supportedInputFormats?.some((fmt) => fmt.toLowerCase().includes(q)) ||
      t.supportedOutputFormats?.some((fmt) => fmt.toLowerCase().includes(q))
  );
};

export const getRelatedTools = (tool: Tool): Tool[] => {
  if (!tool.relatedTools?.length) {
    return getToolsByCategory(tool.category)
      .filter((t) => t.id !== tool.id)
      .slice(0, 4);
  }
  return tool.relatedTools
    .map((slug) => getToolBySlug(slug))
    .filter(Boolean) as Tool[];
};
