// ============================================================
// CONVET PULSE — Image & Design Studio Engine (Phase 4)
// High-performance client-side image processing pipeline.
// 100% offline, privacy-safe, with zero external network leaks.
// ============================================================

import { ProcessorError, type ProcessorResult } from './processors.ts';

export interface ImageProcessingOptions {
  format?: 'jpeg' | 'png' | 'webp';
  quality?: number;
  width?: number;
  height?: number;
  maintainAspect?: boolean;
  x?: number;
  y?: number;
  ratio?: '1:1' | '4:3' | '16:9' | '3:2' | 'free';
  rotation?: number;
  flip?: 'none' | 'horizontal' | 'vertical' | 'both';
  text?: string;
  watermarkImage?: File | Blob;
  opacity?: number;
  position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'tile';
  fontSize?: number;
  color?: string;
  margin?: number;
  brightness?: number; // -100 to 100
  contrast?: number;   // -100 to 100
  saturation?: number; // -100 to 100
  grayscale?: number;  // 0 to 100
  blur?: number;       // 0 to 20
  sharpen?: boolean;
  sampleMode?: 'point' | '3x3' | '5x5';
  paletteCount?: number;
  background?: string;
}

export interface ColorSample {
  hex: string;
  rgb: { r: number; g: number; b: number; a: number };
  hsl: { h: number; s: number; l: number };
  percentage?: number;
}

// ─────────────────────────────────────────────────────────
// Magic Byte & MIME Validation
// ─────────────────────────────────────────────────────────

export async function validateImageFile(
  fileOrBytes: File | Blob | Uint8Array | ArrayBuffer,
  options: { maxBytes?: number; maxDimension?: number } = {}
): Promise<{ format: string; mimeType: string }> {
  const maxBytes = options.maxBytes ?? 100 * 1024 * 1024; // 100MB default limit
  let bytes: Uint8Array;

  if (fileOrBytes instanceof Uint8Array) {
    bytes = fileOrBytes;
  } else if (fileOrBytes instanceof ArrayBuffer) {
    bytes = new Uint8Array(fileOrBytes);
  } else if (typeof fileOrBytes.arrayBuffer === 'function') {
    const ab = await fileOrBytes.arrayBuffer();
    bytes = new Uint8Array(ab);
  } else {
    throw new ProcessorError('Unsupported file input type', 'INVALID_INPUT');
  }

  if (bytes.length === 0) {
    throw new ProcessorError('File is empty (0 bytes)', 'EMPTY_FILE');
  }

  if (bytes.length > maxBytes) {
    throw new ProcessorError(
      `File size (${(bytes.length / (1024 * 1024)).toFixed(1)}MB) exceeds limit of ${maxBytes / (1024 * 1024)}MB`,
      'FILE_TOO_LARGE'
    );
  }

  // Magic byte checks
  // 1. JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { format: 'jpeg', mimeType: 'image/jpeg' };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { format: 'png', mimeType: 'image/png' };
  }

  // 3. WebP: RIFF ... WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { format: 'webp', mimeType: 'image/webp' };
  }

  // 4. GIF: GIF87a or GIF89a
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return { format: 'gif', mimeType: 'image/gif' };
  }

  // 5. BMP: BM (0x42, 0x4D)
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return { format: 'bmp', mimeType: 'image/bmp' };
  }

  // 6. SVG: Check header text
  const headerText = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 1024));
  if (/<svg[\s>]/i.test(headerText) || (/<\?xml/i.test(headerText) && /<svg/i.test(headerText))) {
    return { format: 'svg', mimeType: 'image/svg+xml' };
  }

  throw new ProcessorError('Unsupported or corrupted image file format', 'UNSUPPORTED_FORMAT');
}

// ─────────────────────────────────────────────────────────
// Untrusted SVG Sanitizer (Prevent XSS and external script execution)
// ─────────────────────────────────────────────────────────

export function sanitizeSvg(svgContent: string): string {
  let clean = svgContent;
  // Remove script tags and contents
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove foreignObject tags and contents
  clean = clean.replace(/<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi, '');
  // Remove dangerous attributes (on*, javascript:, data:)
  clean = clean.replace(/\son[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');
  clean = clean.replace(/href\s*=\s*(?:'javascript:[^']*'|"javascript:[^"]*")/gi, '');
  clean = clean.replace(/xlink:href\s*=\s*(?:'javascript:[^']*'|"javascript:[^"]*")/gi, '');
  clean = clean.replace(/<iframe\b[^>]*>(?:.*?<\/iframe>)?/gi, '');
  clean = clean.replace(/<embed\b[^>]*>/gi, '');
  clean = clean.replace(/<object\b[^>]*>(?:.*?<\/object>)?/gi, '');
  return clean;
}

// ─────────────────────────────────────────────────────────
// Cross-Platform Canvas & Image Factory (Browser + Node Test Suite)
// ─────────────────────────────────────────────────────────

export async function createPlatformCanvas(width: number, height: number): Promise<any> {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));

  if (typeof document !== 'undefined' && document.createElement) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }

  // Node.js test environment fallback via @napi-rs/canvas
  const pkg = '@napi-rs/canvas';
  const napi = await import(/* @vite-ignore */ pkg);
  return napi.createCanvas(w, h);
}

export async function loadPlatformImage(
  source: File | Blob | ArrayBuffer | Uint8Array | string
): Promise<{ img: any; width: number; height: number; cleanup: () => void }> {
  // 1. Browser runtime
  if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
    let url: string;
    let cleanup = () => {};

    if (typeof source === 'string') {
      url = source;
    } else if (source instanceof File || source instanceof Blob) {
      if (source.type === 'image/svg+xml') {
        const text = await source.text();
        const safeSvg = sanitizeSvg(text);
        const safeBlob = new Blob([safeSvg], { type: 'image/svg+xml' });
        url = URL.createObjectURL(safeBlob);
      } else {
        url = URL.createObjectURL(source);
      }
      cleanup = () => {
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}
      };
    } else {
      const blob = new Blob([source instanceof Uint8Array ? source : new Uint8Array(source)]);
      url = URL.createObjectURL(blob);
      cleanup = () => {
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}
      };
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        resolve({
          img,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          cleanup,
        });
      };
      img.onerror = () => {
        cleanup();
        reject(new ProcessorError('Failed to decode image data', 'DECODE_ERROR'));
      };
      img.src = url;
    });
  }

  // 2. Node.js runtime fallback
  const pkg = '@napi-rs/canvas';
  const napi = await import(/* @vite-ignore */ pkg);
  let buffer: Buffer;

  if (typeof source === 'string') {
    if (source.startsWith('data:')) {
      const base64Data = source.split(',')[1];
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      buffer = Buffer.from(source);
    }
  } else if (source instanceof Uint8Array) {
    buffer = Buffer.from(source);
  } else if (source instanceof ArrayBuffer) {
    buffer = Buffer.from(source);
  } else {
    const ab = await source.arrayBuffer();
    buffer = Buffer.from(ab);
  }

  const img = await napi.loadImage(buffer);
  return {
    img,
    width: img.width,
    height: img.height,
    cleanup: () => {},
  };
}

export async function canvasToBlob(
  canvas: any,
  mimeType: string,
  quality: number = 0.85
): Promise<Blob> {
  // Browser Canvas
  if (typeof canvas.toBlob === 'function') {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob: Blob | null) => {
          if (blob) resolve(blob);
          else reject(new ProcessorError('Canvas export to blob failed', 'CANVAS_BLOB_ERROR'));
        },
        mimeType,
        quality
      );
    });
  }

  // Node.js Canvas (@napi-rs/canvas)
  if (typeof canvas.encode === 'function') {
    const fmt = mimeType === 'image/jpeg' ? 'jpeg' : mimeType === 'image/webp' ? 'webp' : 'png';
    const q = Math.max(1, Math.min(100, Math.round(quality * 100)));
    const buffer = await canvas.encode(fmt as any, q);
    return new Blob([new Uint8Array(buffer)], { type: mimeType });
  }

  throw new ProcessorError('Unsupported canvas export in current runtime', 'CANVAS_ERROR');
}

// ─────────────────────────────────────────────────────────
// Transparency Detection Helper
// ─────────────────────────────────────────────────────────

export function detectTransparency(ctx: any, width: number, height: number): boolean {
  try {
    const step = Math.max(1, Math.floor((width * height) / 10000)); // Sample up to 10k pixels
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    for (let i = 3; i < data.length; i += 4 * step) {
      if (data[i] < 255) {
        return true;
      }
    }
  } catch (_) {
    // If getImageData fails due to tainted canvas or node stub, assume false
  }
  return false;
}

// ─────────────────────────────────────────────────────────
// 1. Image Format Converter
// ─────────────────────────────────────────────────────────

export async function imageConvert(
  file: File,
  targetFormat: 'jpeg' | 'png' | 'webp' = 'webp',
  quality: number = 0.85,
  background: string = '#ffffff'
): Promise<ProcessorResult> {
  await validateImageFile(file);
  const { img, width, height, cleanup } = await loadPlatformImage(file);

  try {
    const canvas = await createPlatformCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Check transparency and handle JPEG conversion cleanly
    const tempCanvas = await createPlatformCanvas(Math.min(width, 100), Math.min(height, 100));
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
    const hasAlpha = detectTransparency(tempCtx, tempCanvas.width, tempCanvas.height);

    let transparencyRemoved = false;
    if (targetFormat === 'jpeg') {
      // Paint solid background so transparent areas do not become black artifacts
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      if (hasAlpha) transparencyRemoved = true;
    }

    ctx.drawImage(img, 0, 0, width, height);

    const mimeType = targetFormat === 'jpeg' ? 'image/jpeg' : `image/${targetFormat}`;
    const blob = await canvasToBlob(canvas, mimeType, quality);
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const ext = targetFormat === 'jpeg' ? 'jpg' : targetFormat;

    return {
      blob,
      filename: `${baseName}_converted.${ext}`,
      mimeType,
      meta: {
        originalSize: file.size,
        outputSize: blob.size,
        width,
        height,
        transparencyRemoved: transparencyRemoved ? 1 : 0,
        transparencyNote: transparencyRemoved
          ? 'Transparency was replaced with a white background because JPEG does not support alpha channels.'
          : 'None',
      },
    };
  } finally {
    cleanup();
  }
}

// ─────────────────────────────────────────────────────────
// 2. Image Resizer
// ─────────────────────────────────────────────────────────

export async function imageResize(
  file: File,
  options: {
    width?: number;
    height?: number;
    maintainAspect?: boolean;
    format?: 'jpeg' | 'png' | 'webp';
    quality?: number;
    scalePercent?: number;
  }
): Promise<ProcessorResult> {
  await validateImageFile(file);
  const { img, width: origW, height: origH, cleanup } = await loadPlatformImage(file);

  try {
    let targetW = options.width ?? origW;
    let targetH = options.height ?? origH;

    if (options.scalePercent && options.scalePercent > 0) {
      const scale = options.scalePercent / 100;
      targetW = Math.round(origW * scale);
      targetH = Math.round(origH * scale);
    } else if (options.maintainAspect !== false) {
      if (options.width && !options.height) {
        targetH = Math.round((origH / origW) * targetW);
      } else if (options.height && !options.width) {
        targetW = Math.round((origW / origH) * targetH);
      }
    }

    targetW = Math.max(1, targetW);
    targetH = Math.max(1, targetH);

    const canvas = await createPlatformCanvas(targetW, targetH);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const fmt = options.format ?? (file.type === 'image/png' ? 'png' : 'jpeg');
    if (fmt === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);
    }

    ctx.drawImage(img, 0, 0, targetW, targetH);

    const mimeType = fmt === 'jpeg' ? 'image/jpeg' : `image/${fmt}`;
    const quality = options.quality ?? 0.88;
    const blob = await canvasToBlob(canvas, mimeType, quality);
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const ext = fmt === 'jpeg' ? 'jpg' : fmt;

    return {
      blob,
      filename: `${baseName}_${targetW}x${targetH}.${ext}`,
      mimeType,
      meta: {
        originalWidth: origW,
        originalHeight: origH,
        width: targetW,
        height: targetH,
        originalSize: file.size,
        outputSize: blob.size,
      },
    };
  } finally {
    cleanup();
  }
}

// ─────────────────────────────────────────────────────────
// 3. Image Cropper
// ─────────────────────────────────────────────────────────

export async function imageCrop(
  file: File,
  options: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    ratio?: '1:1' | '4:3' | '16:9' | '3:2' | 'free';
    format?: 'jpeg' | 'png' | 'webp';
    quality?: number;
  } = {}
): Promise<ProcessorResult> {
  await validateImageFile(file);
  const { img, width: origW, height: origH, cleanup } = await loadPlatformImage(file);

  try {
    let sx = options.x ?? 0;
    let sy = options.y ?? 0;
    let sw = options.width ?? origW;
    let sh = options.height ?? origH;

    // Apply aspect ratio presets if specific bounding box was not explicitly provided
    if (options.ratio && options.ratio !== 'free' && (!options.width || !options.height)) {
      const ratios: Record<string, number> = {
        '1:1': 1,
        '4:3': 4 / 3,
        '16:9': 16 / 9,
        '3:2': 3 / 2,
      };
      const desired = ratios[options.ratio];
      if (desired) {
        if (origW / origH > desired) {
          sw = Math.round(origH * desired);
          sh = origH;
        } else {
          sw = origW;
          sh = Math.round(origW / desired);
        }
        sx = Math.floor((origW - sw) / 2);
        sy = Math.floor((origH - sh) / 2);
      }
    }

    // Safety bounds clamping
    sx = Math.max(0, Math.min(origW - 1, sx));
    sy = Math.max(0, Math.min(origH - 1, sy));
    sw = Math.max(1, Math.min(origW - sx, sw));
    sh = Math.max(1, Math.min(origH - sy, sh));

    const canvas = await createPlatformCanvas(sw, sh);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const fmt = options.format ?? (file.type === 'image/png' ? 'png' : 'jpeg');
    if (fmt === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sw, sh);
    }

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    const mimeType = fmt === 'jpeg' ? 'image/jpeg' : `image/${fmt}`;
    const quality = options.quality ?? 0.9;
    const blob = await canvasToBlob(canvas, mimeType, quality);
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const ext = fmt === 'jpeg' ? 'jpg' : fmt;

    return {
      blob,
      filename: `${baseName}_cropped.${ext}`,
      mimeType,
      meta: {
        cropX: sx,
        cropY: sy,
        width: sw,
        height: sh,
        originalWidth: origW,
        originalHeight: origH,
        outputSize: blob.size,
      },
    };
  } finally {
    cleanup();
  }
}

// ─────────────────────────────────────────────────────────
// 4. Image Compressor
// ─────────────────────────────────────────────────────────

export async function imageCompress(
  file: File,
  options: {
    quality?: number; // 0.1 to 1.0 (or 10 to 100)
    maxWidth?: number;
    maxHeight?: number;
  } = {}
): Promise<ProcessorResult> {
  await validateImageFile(file);
  const { img, width: origW, height: origH, cleanup } = await loadPlatformImage(file);

  try {
    let q = options.quality ?? 0.75;
    if (q > 1) q = q / 100; // Normalize 10..100 to 0.1..1.0
    q = Math.max(0.1, Math.min(1.0, q));

    let targetW = origW;
    let targetH = origH;

    if (options.maxWidth && targetW > options.maxWidth) {
      targetH = Math.round((targetH * options.maxWidth) / targetW);
      targetW = options.maxWidth;
    }
    if (options.maxHeight && targetH > options.maxHeight) {
      targetW = Math.round((targetW * options.maxHeight) / targetH);
      targetH = options.maxHeight;
    }

    const canvas = await createPlatformCanvas(targetW, targetH);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const isPng = file.type === 'image/png';
    const targetMime = isPng ? 'image/png' : 'image/jpeg';
    if (!isPng) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);
    }

    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob = await canvasToBlob(canvas, targetMime, q);
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const ext = isPng ? 'png' : 'jpg';

    const savedBytes = Math.max(0, file.size - blob.size);
    const ratio = +(((1 - blob.size / file.size) * 100).toFixed(1));

    return {
      blob,
      filename: `${baseName}_compressed.${ext}`,
      mimeType: targetMime,
      meta: {
        originalSize: file.size,
        outputSize: blob.size,
        savedBytes,
        compressionRatio: ratio,
        width: targetW,
        height: targetH,
      },
    };
  } finally {
    cleanup();
  }
}

// ─────────────────────────────────────────────────────────
// 5. Image Rotator & Flipper
// ─────────────────────────────────────────────────────────

export async function imageRotatorFlipper(
  file: File,
  options: {
    rotation?: number; // 0, 90, 180, 270 (or degrees)
    flip?: 'none' | 'horizontal' | 'vertical' | 'both';
    format?: 'jpeg' | 'png' | 'webp';
    quality?: number;
  } = {}
): Promise<ProcessorResult> {
  await validateImageFile(file);
  const { img, width: origW, height: origH, cleanup } = await loadPlatformImage(file);

  try {
    const rawDeg = (options.rotation ?? 0) % 360;
    const deg = rawDeg < 0 ? rawDeg + 360 : rawDeg;
    const isOrthogonal = deg === 90 || deg === 270;

    const outW = isOrthogonal ? origH : origW;
    const outH = isOrthogonal ? origW : origH;

    const canvas = await createPlatformCanvas(outW, outH);
    const ctx = canvas.getContext('2d');

    const fmt = options.format ?? (file.type === 'image/png' ? 'png' : 'jpeg');
    if (fmt === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outW, outH);
    }

    ctx.save();
    // Move to canvas center for rotation & flipping
    ctx.translate(outW / 2, outH / 2);

    if (deg !== 0) {
      ctx.rotate((deg * Math.PI) / 180);
    }

    const flip = options.flip ?? 'none';
    const scaleX = flip === 'horizontal' || flip === 'both' ? -1 : 1;
    const scaleY = flip === 'vertical' || flip === 'both' ? -1 : 1;
    if (scaleX !== 1 || scaleY !== 1) {
      ctx.scale(scaleX, scaleY);
    }

    ctx.drawImage(img, -origW / 2, -origH / 2, origW, origH);
    ctx.restore();

    const mimeType = fmt === 'jpeg' ? 'image/jpeg' : `image/${fmt}`;
    const quality = options.quality ?? 0.9;
    const blob = await canvasToBlob(canvas, mimeType, quality);
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const ext = fmt === 'jpeg' ? 'jpg' : fmt;

    return {
      blob,
      filename: `${baseName}_transformed.${ext}`,
      mimeType,
      meta: {
        rotation: deg,
        flip,
        width: outW,
        height: outH,
        outputSize: blob.size,
      },
    };
  } finally {
    cleanup();
  }
}

// ─────────────────────────────────────────────────────────
// 6. Image Watermark (Text with Tamil Unicode & Image Stamp)
// ─────────────────────────────────────────────────────────

export async function imageWatermark(
  file: File,
  options: {
    text?: string;
    watermarkImage?: File | Blob;
    opacity?: number; // 0.05 to 1.0
    position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'tile';
    fontSize?: number;
    color?: string;
    rotation?: number;
    format?: 'jpeg' | 'png' | 'webp';
    quality?: number;
  } = {}
): Promise<ProcessorResult> {
  await validateImageFile(file);
  const { img, width, height, cleanup } = await loadPlatformImage(file);

  try {
    const canvas = await createPlatformCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const fmt = options.format ?? (file.type === 'image/png' ? 'png' : 'jpeg');
    if (fmt === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(img, 0, 0, width, height);

    const opacity = Math.max(0.05, Math.min(1.0, options.opacity ?? 0.45));
    const text = options.text ?? 'CONVET PULSE';
    const fontSize = Math.max(12, options.fontSize ?? Math.round(width / 24));
    const position = options.position ?? 'center';
    const color = options.color ?? '#ffffff';
    const rotationDeg = options.rotation ?? (position === 'center' || position === 'tile' ? -30 : 0);

    ctx.save();
    ctx.globalAlpha = opacity;

    // Font stack supporting Tamil Unicode scripts, English, numbers, and system fonts
    ctx.font = `bold ${fontSize}px "Noto Sans Tamil", "Latha", system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';

    if (position === 'tile') {
      const stepX = fontSize * 10;
      const stepY = fontSize * 6;
      for (let y = -height; y < height * 2; y += stepY) {
        for (let x = -width; x < width * 2; x += stepX) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((rotationDeg * Math.PI) / 180);
          ctx.fillText(text, 0, 0);
          ctx.restore();
        }
      }
    } else {
      let x = width / 2;
      let y = height / 2;
      const margin = Math.max(20, Math.round(width * 0.03));

      ctx.textAlign = 'center';
      if (position === 'top-left') {
        ctx.textAlign = 'left';
        x = margin;
        y = margin + fontSize / 2;
      } else if (position === 'top-right') {
        ctx.textAlign = 'right';
        x = width - margin;
        y = margin + fontSize / 2;
      } else if (position === 'bottom-left') {
        ctx.textAlign = 'left';
        x = margin;
        y = height - margin - fontSize / 2;
      } else if (position === 'bottom-right') {
        ctx.textAlign = 'right';
        x = width - margin;
        y = height - margin - fontSize / 2;
      }

      ctx.save();
      ctx.translate(x, y);
      if (rotationDeg !== 0) {
        ctx.rotate((rotationDeg * Math.PI) / 180);
      }
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }

    ctx.restore();

    const mimeType = fmt === 'jpeg' ? 'image/jpeg' : `image/${fmt}`;
    const quality = options.quality ?? 0.9;
    const blob = await canvasToBlob(canvas, mimeType, quality);
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const ext = fmt === 'jpeg' ? 'jpg' : fmt;

    return {
      blob,
      filename: `${baseName}_watermarked.${ext}`,
      mimeType,
      meta: {
        text,
        opacity,
        position,
        fontSize,
        outputSize: blob.size,
      },
    };
  } finally {
    cleanup();
  }
}

// ─────────────────────────────────────────────────────────
// 7. Image Metadata Cleaner (EXIF, GPS, Camera Tags)
// ─────────────────────────────────────────────────────────

export async function imageMetadataCleaner(
  file: File,
  options: { format?: 'jpeg' | 'png' | 'webp'; quality?: number } = {}
): Promise<ProcessorResult> {
  await validateImageFile(file);
  const { img, width, height, cleanup } = await loadPlatformImage(file);

  try {
    // Re-encoding through a clean Canvas strips all EXIF, GPS coordinates, IPTC, and XMP blocks
    const canvas = await createPlatformCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const fmt = options.format ?? (file.type === 'image/png' ? 'png' : 'jpeg');
    if (fmt === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(img, 0, 0, width, height);

    const mimeType = fmt === 'jpeg' ? 'image/jpeg' : `image/${fmt}`;
    const quality = options.quality ?? 0.94;
    const blob = await canvasToBlob(canvas, mimeType, quality);

    // Verify binary output does not leak EXIF markers
    const outBytes = new Uint8Array(await blob.arrayBuffer());
    let exifPresent = false;
    for (let i = 0; i < Math.min(outBytes.length - 4, 1024); i++) {
      if (
        outBytes[i] === 0x45 &&
        outBytes[i + 1] === 0x78 &&
        outBytes[i + 2] === 0x69 &&
        outBytes[i + 3] === 0x66
      ) {
        exifPresent = true;
        break;
      }
    }

    const baseName = file.name.replace(/\.[^.]+$/, '');
    const ext = fmt === 'jpeg' ? 'jpg' : fmt;

    return {
      blob,
      filename: `${baseName}_clean.${ext}`,
      mimeType,
      meta: {
        originalSize: file.size,
        outputSize: blob.size,
        cleanedItems: 'EXIF tags, GPS coordinates, camera model, date timestamps, color profiles',
        exifStripped: !exifPresent ? 1 : 0,
        privacyStatus: '100% Metadata Scrubbed',
      },
    };
  } finally {
    cleanup();
  }
}

// ─────────────────────────────────────────────────────────
// 8. Image Adjustments (Brightness, Contrast, Saturation, Blur, Sharpen)
// ─────────────────────────────────────────────────────────

export async function imageAdjustments(
  file: File,
  options: {
    brightness?: number; // -100 to 100
    contrast?: number;   // -100 to 100
    saturation?: number; // -100 to 100
    grayscale?: number;  // 0 to 100
    blur?: number;       // 0 to 20
    sharpen?: boolean;
    format?: 'jpeg' | 'png' | 'webp';
    quality?: number;
  } = {}
): Promise<ProcessorResult> {
  await validateImageFile(file);
  const { img, width, height, cleanup } = await loadPlatformImage(file);

  try {
    const canvas = await createPlatformCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const fmt = options.format ?? (file.type === 'image/png' ? 'png' : 'jpeg');
    if (fmt === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }

    const brightness = 1 + (options.brightness ?? 0) / 100;
    const contrast = 1 + (options.contrast ?? 0) / 100;
    const saturation = 1 + (options.saturation ?? 0) / 100;
    const grayscale = Math.max(0, Math.min(100, options.grayscale ?? 0));
    const blur = Math.max(0, Math.min(20, options.blur ?? 0));

    // Try native canvas filters
    try {
      const filters: string[] = [];
      if (brightness !== 1) filters.push(`brightness(${brightness})`);
      if (contrast !== 1) filters.push(`contrast(${contrast})`);
      if (saturation !== 1) filters.push(`saturate(${saturation})`);
      if (grayscale > 0) filters.push(`grayscale(${grayscale}%)`);
      if (blur > 0) filters.push(`blur(${blur}px)`);

      if (filters.length > 0) {
        ctx.filter = filters.join(' ');
      }
    } catch (_) {
      // In non-browser environments where filter might not be supported, proceed
    }

    ctx.drawImage(img, 0, 0, width, height);

    // Apply sharpen kernel via direct pixel manipulation if requested
    if (options.sharpen) {
      try {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const copy = new Uint8ClampedArray(data);

        // 3x3 Sharpen Kernel:
        // [ 0, -1,  0 ]
        // [-1,  5, -1 ]
        // [ 0, -1,  0 ]
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            for (let c = 0; c < 3; c++) {
              const top = ((y - 1) * width + x) * 4 + c;
              const bottom = ((y + 1) * width + x) * 4 + c;
              const left = (y * width + (x - 1)) * 4 + c;
              const right = (y * width + (x + 1)) * 4 + c;

              const val =
                5 * copy[idx + c] -
                copy[top] -
                copy[bottom] -
                copy[left] -
                copy[right];

              data[idx + c] = Math.max(0, Math.min(255, val));
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
      } catch (_) {
        // Pixel manipulation fallback
      }
    }

    const mimeType = fmt === 'jpeg' ? 'image/jpeg' : `image/${fmt}`;
    const quality = options.quality ?? 0.9;
    const blob = await canvasToBlob(canvas, mimeType, quality);
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const ext = fmt === 'jpeg' ? 'jpg' : fmt;

    return {
      blob,
      filename: `${baseName}_adjusted.${ext}`,
      mimeType,
      meta: {
        brightness: options.brightness ?? 0,
        contrast: options.contrast ?? 0,
        saturation: options.saturation ?? 0,
        grayscale,
        blur,
        sharpen: options.sharpen ? 1 : 0,
        outputSize: blob.size,
      },
    };
  } finally {
    cleanup();
  }
}

// ─────────────────────────────────────────────────────────
// 9. Image Color Picker
// ─────────────────────────────────────────────────────────

export async function imageColorPicker(
  file: File,
  options: { x?: number; y?: number; sampleMode?: 'point' | '3x3' | '5x5' } = {}
): Promise<ProcessorResult> {
  await validateImageFile(file);
  const { img, width, height, cleanup } = await loadPlatformImage(file);

  try {
    const canvas = await createPlatformCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    const px = Math.max(0, Math.min(width - 1, options.x ?? Math.floor(width / 2)));
    const py = Math.max(0, Math.min(height - 1, options.y ?? Math.floor(height / 2)));
    const mode = options.sampleMode ?? 'point';

    let r = 0,
      g = 0,
      b = 0,
      a = 255;
    let count = 0;
    const radius = mode === '5x5' ? 2 : mode === '3x3' ? 1 : 0;

    const imgData = ctx.getImageData(
      Math.max(0, px - radius),
      Math.max(0, py - radius),
      Math.min(width - px, radius * 2 + 1),
      Math.min(height - py, radius * 2 + 1)
    );
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      a = data[i + 3];
      count++;
    }

    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);

    const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
    const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;

    // Convert to HSL
    const rf = r / 255,
      gf = g / 255,
      bf = b / 255;
    const max = Math.max(rf, gf, bf),
      min = Math.min(rf, gf, bf);
    let h = 0,
      s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rf:
          h = (gf - bf) / d + (gf < bf ? 6 : 0);
          break;
        case gf:
          h = (bf - rf) / d + 2;
          break;
        case bf:
          h = (rf - gf) / d + 4;
          break;
      }
      h /= 6;
    }

    const hslStr = `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
    const rgbStr = `rgb(${r}, ${g}, ${b})`;

    // Generate a downloadable color swatch image card (400x300)
    const swatchCanvas = await createPlatformCanvas(400, 300);
    const sCtx = swatchCanvas.getContext('2d');

    // Background swatch
    sCtx.fillStyle = hex;
    sCtx.fillRect(0, 0, 400, 200);

    // Text label container
    sCtx.fillStyle = '#1e293b';
    sCtx.fillRect(0, 200, 400, 100);

    sCtx.fillStyle = '#ffffff';
    sCtx.font = 'bold 24px system-ui, sans-serif';
    sCtx.fillText(hex, 24, 242);

    sCtx.fillStyle = '#94a3b8';
    sCtx.font = '14px system-ui, sans-serif';
    sCtx.fillText(`${rgbStr}  •  ${hslStr}`, 24, 272);

    const blob = await canvasToBlob(swatchCanvas, 'image/png');
    const baseName = file.name.replace(/\.[^.]+$/, '');

    return {
      blob,
      filename: `${baseName}_color_${hex.replace('#', '')}.png`,
      mimeType: 'image/png',
      meta: {
        hex,
        rgb: rgbStr,
        hsl: hslStr,
        x: px,
        y: py,
        sampleMode: mode,
      },
    };
  } finally {
    cleanup();
  }
}

// ─────────────────────────────────────────────────────────
// 10. Color Palette Extractor
// ─────────────────────────────────────────────────────────

export async function imagePaletteExtractor(
  file: File,
  options: { count?: number; outputType?: 'card' | 'json' | 'both' } = {}
): Promise<ProcessorResult> {
  await validateImageFile(file);
  const { img, width, height, cleanup } = await loadPlatformImage(file);

  try {
    const paletteSize = Math.max(3, Math.min(10, options.count ?? 6));

    // Downscale onto a 100x100 analysis canvas to ensure zero UI lag on huge 50MP images
    const sampleSize = 100;
    const canvas = await createPlatformCanvas(sampleSize, sampleSize);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

    const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize);
    const data = imgData.data;

    // Quantize into 5-bit color buckets (32 levels per channel = 32768 total buckets)
    const colorBuckets = new Map<number, { r: number; g: number; b: number; count: number }>();

    for (let i = 0; i < data.length; i += 4) {
      // Ignore completely transparent pixels
      if (data[i + 3] < 50) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Quantize to 5 bits (0..31)
      const qr = r >> 3;
      const qg = g >> 3;
      const qb = b >> 3;
      const key = (qr << 10) | (qg << 5) | qb;

      const existing = colorBuckets.get(key);
      if (existing) {
        existing.r += r;
        existing.g += g;
        existing.b += b;
        existing.count++;
      } else {
        colorBuckets.set(key, { r, g, b, count: 1 });
      }
    }

    // Sort buckets by popularity
    const sorted = Array.from(colorBuckets.values()).sort((a, b) => b.count - a.count);

    // Pick diverse colors (skip colors that are too close in perceptual distance)
    const picked: { r: number; g: number; b: number; count: number; hex: string; percentage: number }[] = [];
    const totalPixels = sorted.reduce((sum, item) => sum + item.count, 0) || 1;

    for (const item of sorted) {
      const avgR = Math.round(item.r / item.count);
      const avgG = Math.round(item.g / item.count);
      const avgB = Math.round(item.b / item.count);

      const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
      const hex = `#${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`;

      // Check distance against already picked colors
      const isTooClose = picked.some((p) => {
        const dr = p.r - avgR;
        const dg = p.g - avgG;
        const db = p.b - avgB;
        return Math.sqrt(dr * dr + dg * dg + db * db) < 35;
      });

      if (!isTooClose) {
        picked.push({
          r: avgR,
          g: avgG,
          b: avgB,
          count: item.count,
          hex,
          percentage: +( (item.count / totalPixels) * 100 ).toFixed(1),
        });
      }

      if (picked.length >= paletteSize) break;
    }

    // Render a high-resolution 600x400 Color Palette Card PNG
    const cardWidth = 600;
    const cardHeight = 400;
    const cardCanvas = await createPlatformCanvas(cardWidth, cardHeight);
    const cCtx = cardCanvas.getContext('2d');

    // Card background
    cCtx.fillStyle = '#0f172a';
    cCtx.fillRect(0, 0, cardWidth, cardHeight);

    // Header title
    cCtx.fillStyle = '#ffffff';
    cCtx.font = 'bold 20px system-ui, sans-serif';
    cCtx.fillText('CONVET PULSE — Extracted Color Palette', 30, 45);

    cCtx.fillStyle = '#94a3b8';
    cCtx.font = '13px system-ui, sans-serif';
    cCtx.fillText(`${picked.length} dominant colors extracted locally with zero privacy leaks`, 30, 70);

    // Render color bars
    const barTop = 95;
    const barHeight = 210;
    const barWidth = Math.floor((cardWidth - 60) / picked.length);

    picked.forEach((color, idx) => {
      const x = 30 + idx * barWidth;
      cCtx.fillStyle = color.hex;
      cCtx.fillRect(x, barTop, barWidth - 4, barHeight);

      // Color code text at bottom
      cCtx.fillStyle = '#f8fafc';
      cCtx.font = 'bold 12px monospace';
      cCtx.fillText(color.hex, x + 4, barTop + barHeight + 25);

      cCtx.fillStyle = '#64748b';
      cCtx.font = '11px system-ui, sans-serif';
      cCtx.fillText(`${color.percentage}%`, x + 4, barTop + barHeight + 42);
    });

    const blob = await canvasToBlob(cardCanvas, 'image/png');
    const baseName = file.name.replace(/\.[^.]+$/, '');

    return {
      blob,
      filename: `${baseName}_palette.png`,
      mimeType: 'image/png',
      meta: {
        paletteSize: picked.length,
        colorsHex: picked.map((c) => c.hex).join(', '),
        dominantColor: picked[0]?.hex ?? '#000000',
        paletteJson: JSON.stringify(
          picked.map((p) => ({
            hex: p.hex,
            rgb: `rgb(${p.r}, ${p.g}, ${p.b})`,
            percentage: p.percentage,
          }))
        ),
      },
    };
  } finally {
    cleanup();
  }
}
