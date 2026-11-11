// ============================================================
// CONVETER — Tool Processor Engine
// Browser-side processing pipeline for all offline tools.
// Each processor returns a ProcessorResult.
// ============================================================

export interface ProcessorResult {
  blob: Blob;
  filename: string;
  mimeType: string;
  meta?: Record<string, string | number>;
}

export class ProcessorError extends Error {
  constructor(
    message: string,
    public code: string = 'PROCESSING_ERROR'
  ) {
    super(message);
    this.name = 'ProcessorError';
  }
}

// ─────────────────────────────────────────────────────────
// Image Processing (Canvas API — no external dependencies)
// ─────────────────────────────────────────────────────────

/** Convert image to target format using Canvas API */
export async function imageConvert(
  file: File,
  targetFormat: 'jpeg' | 'png' | 'webp',
  quality = 0.85
): Promise<ProcessorResult> {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const mimeType = `image/${targetFormat === 'jpeg' ? 'jpeg' : targetFormat}`;
  const blob = await canvasToBlob(canvas, mimeType, quality);
  const ext = targetFormat === 'jpeg' ? 'jpg' : targetFormat;
  const baseName = file.name.replace(/\.[^.]+$/, '');

  return {
    blob,
    filename: `${baseName}.${ext}`,
    mimeType,
    meta: {
      originalSize: file.size,
      outputSize: blob.size,
      width: canvas.width,
      height: canvas.height,
    },
  };
}

/** Crop an image around its center to a selected aspect ratio */
export async function imageCropByRatio(
  file: File,
  ratio: 'free' | '1:1' | '4:3' | '16:9' = '1:1'
): Promise<ProcessorResult> {
  const img = await loadImage(file);
  let width = img.naturalWidth;
  let height = img.naturalHeight;
  const ratios: Record<string, number> = { '1:1': 1, '4:3': 4 / 3, '16:9': 16 / 9 };
  const desired = ratios[ratio];
  if (desired) {
    if (width / height > desired) width = Math.round(height * desired);
    else height = Math.round(width / desired);
  }
  const sx = Math.floor((img.naturalWidth - width) / 2);
  const sy = Math.floor((img.naturalHeight - height) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(img, sx, sy, width, height, 0, 0, width, height);
  const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await canvasToBlob(canvas, mimeType, 0.92);
  return {
    blob,
    filename: `${file.name.replace(/\.[^.]+$/, '')}_crop.${mimeType === 'image/png' ? 'png' : 'jpg'}`,
    mimeType,
    meta: { width, height, outputSize: blob.size },
  };
}

/** Resize image to target dimensions */
export async function imageResize(
  file: File,
  options: {
    width?: number;
    height?: number;
    maintainAspect?: boolean;
    format?: 'jpeg' | 'png' | 'webp';
    quality?: number;
  }
): Promise<ProcessorResult> {
  const img = await loadImage(file);
  const { width: origW, height: origH } = img;
  let targetW = options.width ?? origW;
  let targetH = options.height ?? origH;

  if (options.maintainAspect !== false) {
    if (options.width && !options.height) {
      targetH = Math.round((origH / origW) * targetW);
    } else if (options.height && !options.width) {
      targetW = Math.round((origW / origH) * targetH);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const fmt = options.format ?? 'jpeg';
  const mimeType = `image/${fmt}`;
  const quality = options.quality ?? 0.85;
  const blob = await canvasToBlob(canvas, mimeType, quality);
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const ext = fmt === 'jpeg' ? 'jpg' : fmt;

  return {
    blob,
    filename: `${baseName}_${targetW}x${targetH}.${ext}`,
    mimeType,
    meta: { width: targetW, height: targetH, outputSize: blob.size },
  };
}

/** Compress image by reducing quality */
export async function imageCompress(
  file: File,
  quality = 0.7
): Promise<ProcessorResult> {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const isPNG = file.type === 'image/png';
  const mimeType = isPNG ? 'image/png' : 'image/jpeg';
  const blob = await canvasToBlob(canvas, mimeType, quality);
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const ext = isPNG ? 'png' : 'jpg';

  return {
    blob,
    filename: `${baseName}_compressed.${ext}`,
    mimeType,
    meta: {
      originalSize: file.size,
      outputSize: blob.size,
      savedBytes: file.size - blob.size,
      compressionRatio: +(((1 - blob.size / file.size) * 100).toFixed(1)),
    },
  };
}

// ─────────────────────────────────────────────────────────
// Images → PDF (pdf-lib)
// ─────────────────────────────────────────────────────────

/** Convert one or more images into a PDF document */
export async function imagesToPdf(files: File[]): Promise<ProcessorResult> {
  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let img;
    if (file.type === 'image/png') {
      img = await pdfDoc.embedPng(uint8);
    } else {
      img = await pdfDoc.embedJpg(uint8);
    }
    const page = pdfDoc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const baseName = files[0].name.replace(/\.[^.]+$/, '');

  return {
    blob,
    filename: files.length > 1 ? 'images_to_pdf.pdf' : `${baseName}.pdf`,
    mimeType: 'application/pdf',
    meta: { pages: files.length, outputSize: blob.size },
  };
}

// ─────────────────────────────────────────────────────────
// PDF Processing (pdf-lib)
// ─────────────────────────────────────────────────────────

/** Merge multiple PDF files into one */
export async function mergePdfs(files: File[]): Promise<ProcessorResult> {
  const { PDFDocument } = await import('pdf-lib');
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    pages.forEach((page) => mergedPdf.addPage(page));
  }

  const pdfBytes = await mergedPdf.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });

  return {
    blob,
    filename: 'merged.pdf',
    mimeType: 'application/pdf',
    meta: { totalPages: mergedPdf.getPageCount(), files: files.length },
  };
}

/** Split a PDF into individual pages or page ranges */
export async function splitPdf(
  file: File,
  ranges?: { from: number; to: number }[]
): Promise<ProcessorResult[]> {
  const { PDFDocument } = await import('pdf-lib');
  const arrayBuffer = await file.arrayBuffer();
  const srcPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = srcPdf.getPageCount();
  const results: ProcessorResult[] = [];
  const baseName = file.name.replace(/\.pdf$/i, '');

  if (!ranges || ranges.length === 0) {
    // Split every page individually
    for (let i = 0; i < totalPages; i++) {
      const newPdf = await PDFDocument.create();
      const [page] = await newPdf.copyPages(srcPdf, [i]);
      newPdf.addPage(page);
      const bytes = await newPdf.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      results.push({
        blob,
        filename: `${baseName}_page_${i + 1}.pdf`,
        mimeType: 'application/pdf',
        meta: { page: i + 1 },
      });
    }
  } else {
    for (const range of ranges) {
      const newPdf = await PDFDocument.create();
      const from = Math.max(0, range.from - 1);
      const to = Math.min(totalPages - 1, range.to - 1);
      const indices = Array.from({ length: to - from + 1 }, (_, i) => from + i);
      const pages = await newPdf.copyPages(srcPdf, indices);
      pages.forEach((p) => newPdf.addPage(p));
      const bytes = await newPdf.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      results.push({
        blob,
        filename: `${baseName}_pages_${range.from}-${range.to}.pdf`,
        mimeType: 'application/pdf',
        meta: { pages: indices.length },
      });
    }
  }

  return results;
}

/** Rotate PDF pages */
export async function rotatePdf(
  file: File,
  degrees: 90 | 180 | 270,
  pageNumbers?: number[]
): Promise<ProcessorResult> {
  const { PDFDocument, degrees: deg } = await import('pdf-lib');
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  const targetPages = pageNumbers ?? Array.from({ length: totalPages }, (_, i) => i + 1);

  for (const pageNum of targetPages) {
    const page = pdfDoc.getPage(pageNum - 1);
    page.setRotation(deg(degrees));
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const baseName = file.name.replace(/\.pdf$/i, '');

  return {
    blob,
    filename: `${baseName}_rotated${degrees}.pdf`,
    mimeType: 'application/pdf',
    meta: { rotation: degrees, affectedPages: targetPages.length },
  };
}

/** Add a text watermark / re-save to strip unused objects for compression */
export async function watermarkPdf(
  file: File,
  text: string,
  options: { opacity?: number; fontSize?: number; color?: [number, number, number] } = {}
): Promise<ProcessorResult> {
  const { PDFDocument, StandardFonts, rgb, degrees: deg } = await import('pdf-lib');
  const { opacity = 0.3, fontSize = 60, color = [0.5, 0.5, 0.5] } = options;
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

  if (text && opacity > 0) {
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    for (const page of pdfDoc.getPages()) {
      const { width, height } = page.getSize();
      page.drawText(text, {
        x: width / 2 - (text.length * fontSize * 0.3) / 2,
        y: height / 2,
        size: fontSize,
        font,
        color: rgb(color[0], color[1], color[2]),
        opacity,
        rotate: deg(45),
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const baseName = file.name.replace(/\.pdf$/i, '');

  return {
    blob,
    filename: text ? `${baseName}_watermarked.pdf` : `${baseName}_compressed.pdf`,
    mimeType: 'application/pdf',
    meta: { originalSize: file.size, outputSize: blob.size, pages: pdfDoc.getPageCount() },
  };
}

/** Extract text from PDF (embedded text) */
export async function extractTextFromPdf(file: File): Promise<ProcessorResult> {
  const arrayBuffer = await file.arrayBuffer();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const raw = decoder.decode(arrayBuffer);

  const texts: string[] = [];
  const btEtRegex = /BT([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(raw)) !== null) {
    const inner = match[1];
    const strRegex = /\((.*?)\)/g;
    let strMatch;
    while ((strMatch = strRegex.exec(inner)) !== null) {
      const s = strMatch[1].replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
      if (s.trim()) texts.push(s);
    }
  }

  const text = texts.join(' ') || '(No extractable text found — file may be a scanned PDF)';
  const blob = new Blob([text], { type: 'text/plain' });
  const baseName = file.name.replace(/\.pdf$/i, '');

  return {
    blob,
    filename: `${baseName}_text.txt`,
    mimeType: 'text/plain',
    meta: { characters: text.length, words: text.split(/\s+/).length },
  };
}

// ─────────────────────────────────────────────────────────
// Archive (JSZip)
// ─────────────────────────────────────────────────────────

/** Create a ZIP archive from multiple files */
export async function createZip(
  files: File[],
  zipName = 'archive.zip'
): Promise<ProcessorResult> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    zip.file(file.name, arrayBuffer);
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    blob,
    filename: zipName,
    mimeType: 'application/zip',
    meta: { files: files.length, outputSize: blob.size },
  };
}

/** Extract all files from a ZIP archive */
export async function extractZip(file: File): Promise<ProcessorResult[]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);
  const results: ProcessorResult[] = [];

  for (const [filename, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    const content = await zipEntry.async('blob');
    results.push({
      blob: content,
      filename,
      mimeType: guessMime(filename),
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────
// Data Conversion (CSV <-> JSON)
// ─────────────────────────────────────────────────────────

/** CSV to JSON */
export async function csvToJson(file: File): Promise<ProcessorResult> {
  const text = await file.text();
  const lines = text.trim().split('\n');
  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = values[idx]?.trim() ?? '';
    });
    rows.push(row);
  }

  const json = JSON.stringify(rows, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const baseName = file.name.replace(/\.csv$/i, '');

  return {
    blob,
    filename: `${baseName}.json`,
    mimeType: 'application/json',
    meta: { rows: rows.length, columns: headers.length },
  };
}

/** JSON to CSV */
export async function jsonToCsv(file: File): Promise<ProcessorResult> {
  const text = await file.text();
  let data: Record<string, unknown>[];

  try {
    const parsed = JSON.parse(text);
    data = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    throw new ProcessorError('Invalid JSON file', 'INVALID_JSON');
  }

  if (data.length === 0) {
    throw new ProcessorError('JSON array is empty', 'EMPTY_DATA');
  }

  const headers = Object.keys(data[0]);
  const csvLines = [headers.map(csvEscape).join(',')];
  for (const row of data) {
    csvLines.push(headers.map((h) => csvEscape(String(row[h] ?? ''))).join(','));
  }

  const csv = csvLines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const baseName = file.name.replace(/\.json$/i, '');

  return {
    blob,
    filename: `${baseName}.csv`,
    mimeType: 'text/csv',
    meta: { rows: data.length, columns: headers.length },
  };
}

// ─────────────────────────────────────────────────────────
// Helper Utilities
// ─────────────────────────────────────────────────────────

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ProcessorError(`Could not load image: ${file.name}`, 'IMAGE_LOAD_ERROR'));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new ProcessorError('Canvas toBlob failed', 'CANVAS_BLOB_ERROR'));
      },
      mimeType,
      quality
    );
  });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function guessMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    txt: 'text/plain',
    csv: 'text/csv',
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    ts: 'text/plain',
    zip: 'application/zip',
  };
  return map[ext] ?? 'application/octet-stream';
}
