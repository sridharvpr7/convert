// ============================================================
// CONVET PULSE — Cross-Environment PDF.js Rendering Engine
// Renders genuine PDF pages (text, vector graphics, images)
// onto HTML5 Canvas (Browser/Tauri) or @napi-rs/canvas (Node QA).
// ============================================================

export interface RenderedPageCanvas {
  width: number;
  height: number;
  scale: number;
  toBytes: (format: 'png' | 'jpg', quality?: number) => Promise<Uint8Array>;
  cleanup: () => void;
}

export interface PdfJsSession {
  numPages: number;
  renderPage: (
    pageNumber: number,
    options?: { dpi?: number; scale?: number }
  ) => Promise<RenderedPageCanvas>;
  destroy: () => Promise<void>;
}

/**
 * Parse page range strings like "1-3", "2,4,6", or "all" into 0-based page indices.
 */
export function parsePageRange(rangeStr: string, totalPages: number): number[] {
  const trimmed = (rangeStr || 'all').trim().toLowerCase();
  if (!trimmed || trimmed === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i);
  }
  const pages = new Set<number>();
  const parts = trimmed.split(',');
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    if (p.includes('-')) {
      const [startStr, endStr] = p.split('-');
      const start = startStr ? Math.max(1, parseInt(startStr, 10)) : 1;
      const end = endStr ? Math.min(totalPages, parseInt(endStr, 10)) : totalPages;
      for (let i = start; i <= end; i++) {
        if (i >= 1 && i <= totalPages) pages.add(i - 1);
      }
    } else {
      const pageNum = parseInt(p, 10);
      if (pageNum >= 1 && pageNum <= totalPages) {
        pages.add(pageNum - 1);
      }
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}

async function getPdfJsModule() {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const pdfjs = await import('pdfjs-dist');
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = '/workers/pdf.worker.min.mjs';
    }
    return { pdfjs, isBrowser: true };
  }
  // Node.js environment (tests / verification)
  const legacyPath = 'pdfjs-dist/legacy/build/' + 'pdf.mjs';
  const pdfjs = await import(/* @vite-ignore */ legacyPath);
  return { pdfjs, isBrowser: false };
}

async function createCrossEnvCanvas(width: number, height: number): Promise<{
  canvas: any;
  ctx: any;
  toBytes: (format: 'png' | 'jpg', quality?: number) => Promise<Uint8Array>;
  cleanup: () => void;
}> {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not initialize 2D canvas context in browser.');
    }
    return {
      canvas,
      ctx,
      toBytes: async (format: 'png' | 'jpg', quality = 0.92) => {
        const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error(`Canvas toBlob(${mime}) returned null.`))),
            mime,
            format === 'jpg' ? quality : undefined
          );
        });
        return new Uint8Array(await blob.arrayBuffer());
      },
      cleanup: () => {
        canvas.width = 0;
        canvas.height = 0;
      },
    };
  }

  // Node.js @napi-rs/canvas fallback (never bundled into Vite browser build)
  const canvasPkg = '@napi-rs/' + 'canvas';
  const { createCanvas } = await import(/* @vite-ignore */ canvasPkg);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  return {
    canvas,
    ctx,
    toBytes: async (format: 'png' | 'jpg', quality = 0.92) => {
      if (format === 'jpg') {
        const buf: Buffer = canvas.toBuffer('image/jpeg', Math.round(quality * 100));
        return new Uint8Array(buf);
      }
      const buf: Buffer = canvas.toBuffer('image/png');
      return new Uint8Array(buf);
    },
    cleanup: () => {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

/**
 * Opens a PDF document with PDF.js for genuine page-by-page rasterization.
 */
export async function openPdfJsSession(buffer: ArrayBuffer): Promise<PdfJsSession> {
  const { pdfjs, isBrowser } = await getPdfJsModule();

  let standardFontDataUrl: string | undefined;
  if (isBrowser) {
    standardFontDataUrl = '/standard_fonts/';
  } else {
    try {
      const pathMod = await import(/* @vite-ignore */ 'node:path');
      const urlMod = await import(/* @vite-ignore */ 'node:url');
      const fontsDir = pathMod.resolve(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts');
      standardFontDataUrl = urlMod.pathToFileURL(fontsDir).href + '/';
    } catch {
      standardFontDataUrl = undefined;
    }
  }

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl,
    useSystemFonts: true,
    isEvalSupported: false,
  });

  const pdfDoc = await loadingTask.promise;

  return {
    numPages: pdfDoc.numPages,
    renderPage: async (pageNumber: number, options = {}) => {
      const dpi = options.dpi ?? 150;
      const scale = options.scale ?? dpi / 72;
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const width = Math.max(1, Math.round(viewport.width));
      const height = Math.max(1, Math.round(viewport.height));

      const envCanvas = await createCrossEnvCanvas(width, height);

      // Fill solid white background so transparent PDFs export cleanly to PNG/JPEG
      envCanvas.ctx.fillStyle = '#ffffff';
      envCanvas.ctx.fillRect(0, 0, width, height);

      await page.render({
        canvasContext: envCanvas.ctx,
        viewport,
      }).promise;

      page.cleanup();

      return {
        width,
        height,
        scale,
        toBytes: envCanvas.toBytes,
        cleanup: envCanvas.cleanup,
      };
    },
    destroy: async () => {
      if (typeof (pdfDoc as any).destroy === 'function') {
        await (pdfDoc as any).destroy();
      } else if (typeof loadingTask.destroy === 'function') {
        await loadingTask.destroy();
      }
    },
  };
}
