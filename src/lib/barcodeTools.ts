// ============================================================
// CONVETER — Barcode Studio Engine
// High-precision barcode encoding and vector/raster rendering:
// Supports: Code 128, Code 39, EAN-13, EAN-8, UPC-A, ITF, Codabar
// ============================================================

import type { ProcessorResult } from './processors.ts';
import { ProcessorError } from './processors.ts';

export type BarcodeFormat =
  | 'code128'
  | 'code39'
  | 'ean13'
  | 'ean8'
  | 'upca'
  | 'itf'
  | 'codabar';

export interface BarcodeOptions {
  format?: BarcodeFormat;
  text?: string;
  width?: number; // bar scale factor (1-5, default 2)
  height?: number; // bar height in px (30-200, default 80)
  displayValue?: boolean; // show human-readable text (default true)
  margin?: number; // quiet zone margin in px (default 10)
  lineColor?: string; // hex foreground color (default #000000)
  background?: string; // hex background color (default #ffffff)
  fontSize?: number; // text font size in px (default 14)
}

export interface BarcodeRenderResult {
  svg: string;
  pngBlob?: Blob;
  format: BarcodeFormat;
  text: string;
  displayValue: string;
}

// ─────────────────────────────────────────────────────────
// 1. Checksum & Validation Utilities
// ─────────────────────────────────────────────────────────

export function calculateEan13Checksum(digits12: string): number {
  let sumOdd = 0;
  let sumEven = 0;
  for (let i = 0; i < 12; i++) {
    const val = parseInt(digits12[i], 10);
    if (i % 2 === 0) sumOdd += val;
    else sumEven += val;
  }
  const total = sumOdd + sumEven * 3;
  return (10 - (total % 10)) % 10;
}

export function calculateEan8Checksum(digits7: string): number {
  let sumOdd = 0;
  let sumEven = 0;
  for (let i = 0; i < 7; i++) {
    const val = parseInt(digits7[i], 10);
    if (i % 2 === 0) sumOdd += val * 3;
    else sumEven += val;
  }
  const total = sumOdd + sumEven;
  return (10 - (total % 10)) % 10;
}

export function calculateUpcAChecksum(digits11: string): number {
  let sumOdd = 0;
  let sumEven = 0;
  for (let i = 0; i < 11; i++) {
    const val = parseInt(digits11[i], 10);
    if (i % 2 === 0) sumOdd += val * 3;
    else sumEven += val;
  }
  const total = sumOdd + sumEven;
  return (10 - (total % 10)) % 10;
}

export function validateBarcodeFormat(format: BarcodeFormat, text: string): { valid: boolean; normalized: string; error?: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { valid: false, normalized: '', error: 'Barcode value cannot be empty.' };
  }

  switch (format) {
    case 'ean13': {
      if (!/^\d{12,13}$/.test(trimmed)) {
        return { valid: false, normalized: '', error: 'EAN-13 requires exactly 12 or 13 numeric digits.' };
      }
      const base12 = trimmed.slice(0, 12);
      const expectedChecksum = calculateEan13Checksum(base12);
      if (trimmed.length === 13) {
        const actualChecksum = parseInt(trimmed[12], 10);
        if (actualChecksum !== expectedChecksum) {
          return {
            valid: false,
            normalized: '',
            error: `Invalid EAN-13 check digit. Expected ${expectedChecksum}, but got ${actualChecksum}. Use ${base12}${expectedChecksum} instead.`,
          };
        }
        return { valid: true, normalized: trimmed };
      }
      return { valid: true, normalized: `${base12}${expectedChecksum}` };
    }

    case 'ean8': {
      if (!/^\d{7,8}$/.test(trimmed)) {
        return { valid: false, normalized: '', error: 'EAN-8 requires exactly 7 or 8 numeric digits.' };
      }
      const base7 = trimmed.slice(0, 7);
      const expectedChecksum = calculateEan8Checksum(base7);
      if (trimmed.length === 8) {
        const actualChecksum = parseInt(trimmed[7], 10);
        if (actualChecksum !== expectedChecksum) {
          return {
            valid: false,
            normalized: '',
            error: `Invalid EAN-8 check digit. Expected ${expectedChecksum}, but got ${actualChecksum}. Use ${base7}${expectedChecksum} instead.`,
          };
        }
        return { valid: true, normalized: trimmed };
      }
      return { valid: true, normalized: `${base7}${expectedChecksum}` };
    }

    case 'upca': {
      if (!/^\d{11,12}$/.test(trimmed)) {
        return { valid: false, normalized: '', error: 'UPC-A requires exactly 11 or 12 numeric digits.' };
      }
      const base11 = trimmed.slice(0, 11);
      const expectedChecksum = calculateUpcAChecksum(base11);
      if (trimmed.length === 12) {
        const actualChecksum = parseInt(trimmed[11], 10);
        if (actualChecksum !== expectedChecksum) {
          return {
            valid: false,
            normalized: '',
            error: `Invalid UPC-A check digit. Expected ${expectedChecksum}, but got ${actualChecksum}. Use ${base11}${expectedChecksum} instead.`,
          };
        }
        return { valid: true, normalized: trimmed };
      }
      return { valid: true, normalized: `${base11}${expectedChecksum}` };
    }

    case 'code39': {
      const upper = trimmed.toUpperCase();
      if (!/^[0-9A-Z\-. $/+%]+$/.test(upper)) {
        return { valid: false, normalized: '', error: 'Code 39 only supports uppercase letters (A-Z), digits (0-9), and characters: - . $ / + % and space.' };
      }
      return { valid: true, normalized: upper };
    }

    case 'itf': {
      if (!/^\d+$/.test(trimmed)) {
        return { valid: false, normalized: '', error: 'ITF (Interleaved 2 of 5) only supports numeric digits.' };
      }
      const padded = trimmed.length % 2 === 0 ? trimmed : `0${trimmed}`;
      return { valid: true, normalized: padded };
    }

    case 'codabar': {
      let upper = trimmed.toUpperCase();
      // Ensure start/stop characters A, B, C, or D
      if (!/^[ABCD]/.test(upper)) upper = `A${upper}`;
      if (!/[ABCD]$/.test(upper)) upper = `${upper}A`;
      if (!/^[ABCD][0-9\-$:/.+]+[ABCD]$/.test(upper)) {
        return { valid: false, normalized: '', error: 'Codabar supports numbers 0-9, characters -$:/., and start/stop characters A, B, C, D.' };
      }
      return { valid: true, normalized: upper };
    }

    case 'code128':
    default: {
      // Code 128 supports ASCII 0-127
      for (let i = 0; i < trimmed.length; i++) {
        if (trimmed.charCodeAt(i) > 127) {
          return { valid: false, normalized: '', error: 'Code 128 supports standard 7-bit ASCII characters (0-127).' };
        }
      }
      return { valid: true, normalized: trimmed };
    }
  }
}

// ─────────────────────────────────────────────────────────
// 2. Barcode Encoders (Returning binary module pattern string: '1' = bar, '0' = space)
// ─────────────────────────────────────────────────────────

// --- Code 128 Patterns (ISO/IEC 15417) ---
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

function widthsToModules(pattern: string): string {
  let result = '';
  let isBar = true;
  for (let i = 0; i < pattern.length; i++) {
    const count = parseInt(pattern[i], 10);
    result += (isBar ? '1' : '0').repeat(count);
    isBar = !isBar;
  }
  return result;
}

function encodeCode128(text: string): string {
  // Use Code 128 Set B (ASCII 32-126)
  const START_B = 104;
  const STOP = 106;
  const codes = [START_B];

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    codes.push(code >= 0 && code <= 95 ? code : 0);
  }

  // Calculate checksum modulo 103
  let checksum = codes[0];
  for (let i = 1; i < codes.length; i++) {
    checksum += codes[i] * i;
  }
  checksum %= 103;
  codes.push(checksum);
  codes.push(STOP);

  let modules = '';
  for (const c of codes) {
    modules += widthsToModules(CODE128_PATTERNS[c]);
  }
  return modules;
}

// --- Code 39 Patterns (ISO/IEC 16388) ---
// 9 elements per char: 1=wide, 0=narrow
const CODE39_MAP: Record<string, string> = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000', '4': '000110001',
  '5': '100110000', '6': '001110000', '7': '000100101', '8': '100100100', '9': '001100100',
  'A': '100001001', 'B': '001001001', 'C': '101001000', 'D': '000011001', 'E': '100011000',
  'F': '001011000', 'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011', 'O': '100010010',
  'P': '001010010', 'Q': '000000111', 'R': '100000110', 'S': '001000110', 'T': '000010110',
  'U': '110000001', 'V': '011000001', 'W': '111000000', 'X': '010010001', 'Y': '110010000',
  'Z': '011010000', '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
  '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100',
};

function encodeCode39(text: string): string {
  const full = `*${text}*`;
  let modules = '';
  for (let i = 0; i < full.length; i++) {
    const char = full[i];
    const pattern = CODE39_MAP[char] || CODE39_MAP['*'];
    // 9 elements: 5 bars, 4 spaces
    for (let p = 0; p < 9; p++) {
      const isBar = p % 2 === 0;
      const isWide = pattern[p] === '1';
      const width = isWide ? 3 : 1;
      modules += (isBar ? '1' : '0').repeat(width);
    }
    // Inter-character space
    if (i < full.length - 1) {
      modules += '0';
    }
  }
  return modules;
}

// --- EAN-13 & EAN-8 Patterns (ISO/IEC 15420) ---
const EAN_L: Record<string, string> = {
  '0': '0001101', '1': '0011001', '2': '0010011', '3': '0111101', '4': '0100011',
  '5': '0110001', '6': '0101111', '7': '0111011', '8': '0110111', '9': '0001011',
};
const EAN_G: Record<string, string> = {
  '0': '0100111', '1': '0110011', '2': '0011011', '3': '0100001', '4': '0011101',
  '5': '0111001', '6': '0000101', '7': '0010001', '8': '0001001', '9': '0010111',
};
const EAN_R: Record<string, string> = {
  '0': '1110010', '1': '1100110', '2': '1101100', '3': '1000010', '4': '1011100',
  '5': '1001110', '6': '1010000', '7': '1000100', '8': '1001000', '9': '1110100',
};
const EAN13_PARITIES: Record<string, string> = {
  '0': 'LLLLLL', '1': 'LLGLGG', '2': 'LLGGLG', '3': 'LLGGGL', '4': 'LGLLGG',
  '5': 'LGGLLG', '6': 'LGGGLL', '7': 'LGLGLG', '8': 'LGLGGL', '9': 'LGGLGL',
};

function encodeEan13(digits13: string): string {
  const first = digits13[0];
  const parity = EAN13_PARITIES[first];
  let modules = '101'; // Left guard

  // Left 6 digits
  for (let i = 0; i < 6; i++) {
    const digit = digits13[i + 1];
    const isG = parity[i] === 'G';
    modules += isG ? EAN_G[digit] : EAN_L[digit];
  }

  modules += '01010'; // Center guard

  // Right 6 digits
  for (let i = 7; i < 13; i++) {
    const digit = digits13[i];
    modules += EAN_R[digit];
  }

  modules += '101'; // Right guard
  return modules;
}

function encodeEan8(digits8: string): string {
  let modules = '101'; // Left guard

  // Left 4 digits (L-code)
  for (let i = 0; i < 4; i++) {
    modules += EAN_L[digits8[i]];
  }

  modules += '01010'; // Center guard

  // Right 4 digits (R-code)
  for (let i = 4; i < 8; i++) {
    modules += EAN_R[digits8[i]];
  }

  modules += '101'; // Right guard
  return modules;
}

function encodeUpcA(digits12: string): string {
  return encodeEan13(`0${digits12}`);
}

// --- ITF (Interleaved 2 of 5 - ISO/IEC 16390) ---
const ITF_PATTERNS: Record<string, string> = {
  '0': '00110', '1': '10001', '2': '01001', '3': '11000', '4': '00101',
  '5': '10100', '6': '01100', '7': '00011', '8': '10010', '9': '01010',
};

function encodeItf(digits: string): string {
  let modules = '1010'; // Start pattern
  for (let i = 0; i < digits.length; i += 2) {
    const barDigit = digits[i];
    const spaceDigit = digits[i + 1];
    const barPattern = ITF_PATTERNS[barDigit];
    const spacePattern = ITF_PATTERNS[spaceDigit];

    for (let p = 0; p < 5; p++) {
      const barWide = barPattern[p] === '1';
      const spaceWide = spacePattern[p] === '1';
      modules += (barWide ? '111' : '1');
      modules += (spaceWide ? '000' : '0');
    }
  }
  modules += '1101'; // Stop pattern
  return modules;
}

// --- Codabar (USD-4 / NW-7) ---
const CODABAR_PATTERNS: Record<string, string> = {
  '0': '101010011', '1': '101011001', '2': '101001011', '3': '110010101',
  '4': '101101001', '5': '110101001', '6': '100101011', '7': '100101101',
  '8': '100110101', '9': '110100101', '-': '101001101', '$': '101100101',
  ':': '1101011011', '/': '1101101011', '.': '1101101101', '+': '1011011011',
  'A': '1011001001', 'B': '1001001011', 'C': '1010010011', 'D': '1010011001',
};

function encodeCodabar(text: string): string {
  let modules = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const pat = CODABAR_PATTERNS[char] || CODABAR_PATTERNS['A'];
    modules += pat;
    if (i < text.length - 1) {
      modules += '0'; // Inter-character gap
    }
  }
  return modules;
}

// ─────────────────────────────────────────────────────────
// 3. Master Barcode Generator & Renderer
// ─────────────────────────────────────────────────────────

export function generateBarcodeModules(format: BarcodeFormat, text: string): { modules: string; normalizedText: string } {
  const { valid, normalized, error } = validateBarcodeFormat(format, text);
  if (!valid || !normalized) {
    throw new ProcessorError(error || 'Invalid barcode input.', 'INVALID_BARCODE_FORMAT');
  }

  let modules = '';
  switch (format) {
    case 'code128':
      modules = encodeCode128(normalized);
      break;
    case 'code39':
      modules = encodeCode39(normalized);
      break;
    case 'ean13':
      modules = encodeEan13(normalized);
      break;
    case 'ean8':
      modules = encodeEan8(normalized);
      break;
    case 'upca':
      modules = encodeUpcA(normalized);
      break;
    case 'itf':
      modules = encodeItf(normalized);
      break;
    case 'codabar':
      modules = encodeCodabar(normalized);
      break;
    default:
      modules = encodeCode128(normalized);
  }

  return { modules, normalizedText: normalized };
}

export function renderBarcodeSvg(
  modules: string,
  displayValue: string,
  options: BarcodeOptions = {}
): string {
  const barWidth = Math.max(1, Math.min(6, options.width ?? 2));
  const barHeight = Math.max(30, Math.min(300, options.height ?? 80));
  const margin = Math.max(0, Math.min(50, options.margin ?? 10));
  const showText = options.displayValue !== false;
  const fontSize = options.fontSize ?? 14;
  const textColor = options.lineColor ?? '#000000';
  const barColor = options.lineColor ?? '#000000';
  const bgColor = options.background ?? '#ffffff';

  const barcodeWidth = modules.length * barWidth;
  const textHeight = showText ? fontSize + 6 : 0;
  const totalWidth = barcodeWidth + margin * 2;
  const totalHeight = barHeight + margin * 2 + textHeight;

  let rects = '';
  let inBar = false;
  let barStart = 0;

  for (let i = 0; i <= modules.length; i++) {
    const isBar = i < modules.length && modules[i] === '1';
    if (isBar && !inBar) {
      inBar = true;
      barStart = i;
    } else if (!isBar && inBar) {
      inBar = false;
      const x = margin + barStart * barWidth;
      const w = (i - barStart) * barWidth;
      rects += `<rect x="${x}" y="${margin}" width="${w}" height="${barHeight}" fill="${barColor}" />`;
    }
  }

  const textElement = showText
    ? `<text x="${totalWidth / 2}" y="${margin + barHeight + fontSize}" font-family="ui-monospace, monospace" font-size="${fontSize}" fill="${textColor}" text-anchor="middle" font-weight="600" letter-spacing="1.5">${displayValue}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" style="background-color: ${bgColor}">
  <rect width="${totalWidth}" height="${totalHeight}" fill="${bgColor}" />
  ${rects}
  ${textElement}
</svg>`;
}

// ─────────────────────────────────────────────────────────
// 4. Client/Server Dispatch Processor
// ─────────────────────────────────────────────────────────

export async function processBarcode(
  _files: File[],
  options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  const format = (options.format as BarcodeFormat) || 'code128';
  const rawText = (options.text as string) || (options.code as string) || 'CONVET-12345';
  const width = typeof options.width === 'number' ? options.width : 2;
  const height = typeof options.height === 'number' ? options.height : 80;
  const margin = typeof options.margin === 'number' ? options.margin : 10;
  const displayValue = options.displayValue !== false;
  const lineColor = (options.lineColor as string) || '#000000';
  const background = (options.background as string) || '#ffffff';
  const outputFormat = (options.outputFormat as string) || 'png';

  const { modules, normalizedText } = generateBarcodeModules(format, rawText);
  const svgString = renderBarcodeSvg(modules, normalizedText, {
    format,
    width,
    height,
    margin,
    displayValue,
    lineColor,
    background,
  });

  if (outputFormat === 'svg') {
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    return {
      blob,
      filename: `barcode-${format}-${normalizedText}.svg`,
      mimeType: 'image/svg+xml',
      meta: {
        format,
        code: normalizedText,
        modulesLength: modules.length,
        outputSize: blob.size,
      },
    };
  }

  // Rasterize to PNG via OffscreenCanvas / Canvas if available in browser
  let pngBlob: Blob;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((b) => {
            if (b) {
              pngBlob = b;
              resolve();
            } else {
              reject(new Error('Failed to create PNG blob from canvas'));
            }
          }, 'image/png');
        } else {
          reject(new Error('Canvas 2D context unavailable'));
        }
      };
      img.onerror = () => reject(new Error('Failed to load barcode SVG image'));
      img.src = url;
    });
    URL.revokeObjectURL(url);
  } else {
    // Node.js fallback: return SVG blob
    pngBlob = new Blob([svgString], { type: 'image/svg+xml' });
  }

  return {
    blob: pngBlob!,
    filename: `barcode-${format}-${normalizedText}.${outputFormat === 'svg' ? 'svg' : 'png'}`,
    mimeType: outputFormat === 'svg' ? 'image/svg+xml' : 'image/png',
    meta: {
      format,
      code: normalizedText,
      modulesCount: modules.length,
      outputSize: pngBlob!.size,
    },
  };
}

