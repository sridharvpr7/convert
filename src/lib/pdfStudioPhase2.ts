// ============================================================
// CONVET PULSE — PDF Studio Phase 2 Expansion Engine
// Implements 6 genuine local-first PDF processors:
// 1. PDF OCR (PDF.js rendering + Tesseract.js OCR + Fontkit Unicode layer)
// 2. Sign PDF (Draw, type, or upload visual electronic signature)
// 3. Fill PDF Forms (AcroForms inspection/filling + XFA detection)
// 4. Reorder PDF Pages (Ordering, rotation, duplication, deletion)
// 5. Compare PDF (Text & structural diff, page count & box differences)
// 6. PDF to Images (PDF.js high-res PNG/JPG rasterization & ZIP bundle)
// ============================================================

import {
  PDFDocument,
  PDFDict,
  PDFName,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  rgb,
  degrees,
  StandardFonts,
} from 'pdf-lib';
import * as fontkit from 'fontkit';
import JSZip from 'jszip';
import type { ProcessorResult } from './processors.ts';
import { ProcessorError, toBlobPart } from './processors.ts';
import { openPdfJsSession, parsePageRange } from './pdfRenderer.ts';

export interface ProgressInfo {
  page: number;
  total: number;
  stage: string;
  percent: number;
  message?: string;
}

// ─────────────────────────────────────────────────────────
// Helper: Load Unicode Tamil Font (NotoSansTamil-Regular.ttf)
// ─────────────────────────────────────────────────────────
async function loadTamilUnicodeFontBytes(): Promise<Uint8Array> {
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    const resp = await fetch('/fonts/NotoSansTamil-Regular.ttf');
    if (!resp.ok) {
      throw new ProcessorError(
        `Failed to load Unicode Tamil font (/fonts/NotoSansTamil-Regular.ttf, HTTP ${resp.status}). Cannot embed Tamil text layer without dropping characters.`,
        'FONT_LOAD_ERROR'
      );
    }
    return new Uint8Array(await resp.arrayBuffer());
  }

  // Node.js environment
  try {
    const fsMod = await import(/* @vite-ignore */ 'node:fs');
    const pathMod = await import(/* @vite-ignore */ 'node:path');
    const fontPath = pathMod.resolve(process.cwd(), 'public/fonts/NotoSansTamil-Regular.ttf');
    const buf = fsMod.readFileSync(fontPath);
    return new Uint8Array(buf);
  } catch (err) {
    throw new ProcessorError(
      `Failed to load Unicode Tamil font from public/fonts/NotoSansTamil-Regular.ttf: ${(err as Error).message}`,
      'FONT_LOAD_ERROR'
    );
  }
}

// ─────────────────────────────────────────────────────────
// Helper: Extract text streams from a PDF document (for Compare PDF)
// ─────────────────────────────────────────────────────────
async function extractPageTexts(pdfDoc: PDFDocument, arrayBuffer: ArrayBuffer): Promise<string[]> {
  const pageCount = pdfDoc.getPageCount();
  const pageTexts: string[] = [];

  for (let pIdx = 0; pIdx < pageCount; pIdx++) {
    const page = pdfDoc.getPage(pIdx);
    const chunks: string[] = [];
    const contents = page.node.Contents();

    if (contents) {
      const streamList = (contents as any).asArray ? (contents as any).asArray() : [contents];
      for (const s of streamList) {
        const streamObj = pdfDoc.context.lookup(s) as { getContents?: () => Uint8Array };
        if (streamObj && typeof streamObj.getContents === 'function') {
          const rawStreamBytes = streamObj.getContents();
          const str = new TextDecoder('latin1').decode(rawStreamBytes);

          // Parenthesized literal strings: (Text) Tj
          const tjMatches = str.matchAll(/\(([^)]+)\)\s*(?:Tj|'|")/g);
          for (const m of tjMatches) {
            const clean = m[1]
              .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r')
              .replace(/\\t/g, '\t')
              .replace(/\\/g, '');
            if (clean.trim()) chunks.push(clean);
          }

          // Array strings: [(Text1) 20 (Text2)] TJ
          const arrayMatches = str.matchAll(/\[(.*?)\]\s*TJ/gs);
          for (const m of arrayMatches) {
            const inner = m[1];
            const ipm = inner.matchAll(/\(([^)]*)\)/g);
            const words: string[] = [];
            for (const item of ipm) {
              if (item[1].trim()) words.push(item[1]);
            }
            if (words.length > 0) chunks.push(words.join(' '));
          }

          // Hex strings: <48656c6c6f> Tj
          const hexMatches = str.matchAll(/<([0-9a-fA-F]+)>\s*(?:Tj|'|")/g);
          for (const hm of hexMatches) {
            const hex = hm[1];
            let decodedHex = '';
            for (let c = 0; c < hex.length; c += 2) {
              const code = parseInt(hex.substr(c, 2), 16);
              if (code >= 32 && code <= 126) decodedHex += String.fromCharCode(code);
            }
            if (decodedHex.trim()) chunks.push(decodedHex);
          }
        }
      }
    }

    // Heuristic fallback if stream decoding yielded nothing on this page
    if (chunks.length === 0) {
      const raw = new TextDecoder('latin1').decode(new Uint8Array(arrayBuffer));
      const btEtRegex = /BT([\s\S]*?)ET/g;
      let match;
      while ((match = btEtRegex.exec(raw)) !== null) {
        const inner = match[1];
        const strRegex = /\((.*?)\)/g;
        let strMatch;
        while ((strMatch = strRegex.exec(inner)) !== null) {
          const s = strMatch[1].replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
          if (s.trim()) chunks.push(s);
        }
      }
    }

    pageTexts.push(chunks.join(' ').replace(/\s+/g, ' ').trim());
  }

  return pageTexts;
}

// ─────────────────────────────────────────────────────────
// 1. PDF OCR & Searchable Text Generation (Tesseract.js + PDF.js)
// ─────────────────────────────────────────────────────────
export async function pdfOcr(
  file: File,
  options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  const signal = options.signal as AbortSignal | undefined;
  const onProgress = options.onProgress as ((info: ProgressInfo) => void) | undefined;

  if (signal?.aborted) {
    throw new ProcessorError('OCR operation was cancelled before starting.', 'CANCELLED');
  }

  const arrayBuffer = await file.arrayBuffer();
  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  } catch (err) {
    throw new ProcessorError(`Could not read PDF document: ${(err as Error)?.message}`, 'INVALID_PDF');
  }

  const lang = ((options.lang as string) || 'eng').trim();
  const outputFormat = (options.outputFormat as string) || 'searchable-pdf';
  const pageRangeStr = (options.pageRange as string) || 'all';
  const ocrDpi = Math.min(300, Math.max(100, Number(options.dpi ?? 180)));

  const totalPages = pdfDoc.getPageCount();
  const targetIndices = parsePageRange(pageRangeStr, totalPages);
  if (targetIndices.length === 0) {
    throw new ProcessorError('No valid pages selected in page range.', 'INVALID_PAGE_RANGE');
  }

  onProgress?.({
    page: 0,
    total: targetIndices.length,
    stage: 'init',
    percent: 5,
    message: `Initializing Tesseract OCR engine (${lang})...`,
  });

  // Load PDF.js session for genuine rasterization
  const pdfJsSession = await openPdfJsSession(arrayBuffer);

  // Initialize Tesseract.js worker
  const { createWorker } = await import('tesseract.js');
  const workerOptions: Record<string, unknown> = {};
  if (typeof window === 'undefined') {
    const osMod = await import(/* @vite-ignore */ 'node:os');
    workerOptions.cachePath = osMod.tmpdir();
  }

  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  try {
    worker = await createWorker(lang, 1, workerOptions);

    if (signal?.aborted) {
      throw new ProcessorError('OCR operation was cancelled.', 'CANCELLED');
    }

    const ocrResultsByPage: { page: number; text: string; confidence: number }[] = [];

    // Prepare fonts for searchable PDF layer
    const needsTamilFont = lang.includes('tam');
    let tamilFont: Awaited<ReturnType<PDFDocument['embedFont']>> | null = null;
    const latinFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    if (needsTamilFont && outputFormat !== 'text') {
      pdfDoc.registerFontkit(fontkit);
      const tamilBytes = await loadTamilUnicodeFontBytes();
      tamilFont = await pdfDoc.embedFont(tamilBytes, {
        features: {
          calt: false,
          liga: false,
          clig: false,
          dlig: false,
          rlig: false,
          pres: false,
          abvs: false,
          blws: false,
          psts: false,
          haln: false,
          akhn: false,
        },
      } as any);
    }

    for (let i = 0; i < targetIndices.length; i++) {
      if (signal?.aborted) {
        throw new ProcessorError('OCR operation was cancelled by user.', 'CANCELLED');
      }

      const pageIdx = targetIndices[i];
      const pageNum = pageIdx + 1;

      onProgress?.({
        page: i + 1,
        total: targetIndices.length,
        stage: 'rendering',
        percent: Math.round(10 + ((i + 0.3) / targetIndices.length) * 80),
        message: `Rendering page ${pageNum} of ${totalPages} for OCR...`,
      });

      const rendered = await pdfJsSession.renderPage(pageNum, { dpi: ocrDpi });
      let pngBytes: Uint8Array;
      try {
        pngBytes = await rendered.toBytes('png');
      } finally {
        rendered.cleanup();
      }

      if (signal?.aborted) {
        throw new ProcessorError('OCR operation was cancelled by user.', 'CANCELLED');
      }

      onProgress?.({
        page: i + 1,
        total: targetIndices.length,
        stage: 'ocr',
        percent: Math.round(10 + ((i + 0.7) / targetIndices.length) * 80),
        message: `Recognizing text on page ${pageNum} (${lang.toUpperCase()})...`,
      });

      const recognizeInput =
        typeof Buffer !== 'undefined' ? Buffer.from(pngBytes) : new Blob([toBlobPart(pngBytes)], { type: 'image/png' });
      const { data } = await worker.recognize(recognizeInput);

      const recognizedText = (data.text || '').trim();
      const confidence = Math.round(data.confidence || 0);
      ocrResultsByPage.push({ page: pageNum, text: recognizedText, confidence });

      // Inject invisible searchable text layer aligned to Tesseract bounding boxes
      if (outputFormat === 'searchable-pdf' || outputFormat === 'both') {
        const page = pdfDoc.getPage(pageIdx);
        const { height } = page.getSize();
        const scale = rendered.scale;

        // If recognized text has non-WinAnsi characters (e.g. Tamil) and Tamil font wasn't loaded yet, load it now
        const hasNonLatin = /[^\x00-\xFF]/.test(recognizedText);
        if (hasNonLatin && !tamilFont) {
          pdfDoc.registerFontkit(fontkit);
          const tamilBytes = await loadTamilUnicodeFontBytes();
          tamilFont = await pdfDoc.embedFont(tamilBytes, {
            features: {
              calt: false,
              liga: false,
              clig: false,
              dlig: false,
              rlig: false,
              pres: false,
              abvs: false,
              blws: false,
              psts: false,
              haln: false,
              akhn: false,
            },
          } as any);
        }

        const blocks = (data as any).blocks as Array<{ paragraphs?: Array<{ lines?: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }> }> }> | undefined;
        const lines: { text: string; bbox?: { x0: number; y0: number; x1: number; y1: number } }[] = [];

        if (blocks && blocks.length > 0) {
          for (const block of blocks) {
            for (const para of block.paragraphs || []) {
              for (const line of para.lines || []) {
                if (line.text?.trim()) {
                  lines.push({ text: line.text.trim(), bbox: line.bbox });
                }
              }
            }
          }
        }

        // Fallback to plain line splitting if block/line structure is empty
        if (lines.length === 0 && recognizedText) {
          recognizedText.split('\n').forEach((l) => {
            if (l.trim()) lines.push({ text: l.trim() });
          });
        }

        let fallbackY = height - 40;
        for (const item of lines) {
          const cleanLine = item.text.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
          if (!cleanLine) continue;

          const lineNeedsUnicode = /[^\x00-\xFF]/.test(cleanLine);
          const chosenFont = lineNeedsUnicode ? tamilFont : latinFont;
          if (!chosenFont) {
            throw new ProcessorError(
              'Unicode font is required to embed non-Latin OCR characters.',
              'FONT_LOAD_ERROR'
            );
          }

          let x = 40;
          let y = fallbackY;
          let fontSize = 10;

          if (item.bbox) {
            x = Math.max(0, item.bbox.x0 / scale);
            y = Math.max(4, height - item.bbox.y1 / scale);
            fontSize = Math.max(6, Math.min(28, (item.bbox.y1 - item.bbox.y0) / scale));
          } else {
            fallbackY -= 14;
            if (fallbackY < 20) break;
          }

          page.drawText(cleanLine, {
            x,
            y,
            size: fontSize,
            font: chosenFont,
            color: rgb(0, 0, 0),
            opacity: 0.001, // Invisible searchable OCR layer
          });
        }
      }
    }

    onProgress?.({
      page: targetIndices.length,
      total: targetIndices.length,
      stage: 'finalizing',
      percent: 95,
      message: 'Finalizing OCR output...',
    });

    const baseName = file.name.replace(/\.pdf$/i, '') || 'document';
    const avgConfidence =
      ocrResultsByPage.length > 0
        ? Math.round(ocrResultsByPage.reduce((acc, r) => acc + r.confidence, 0) / ocrResultsByPage.length)
        : 0;
    const fullTextOutput = ocrResultsByPage
      .map((r) => `=== Page ${r.page} (Confidence: ${r.confidence}%) ===\n${r.text || '[No text recognized on this page]'}`)
      .join('\n\n');

    if (outputFormat === 'text') {
      const txtBlob = new Blob([fullTextOutput], { type: 'text/plain;charset=utf-8' });
      return {
        blob: txtBlob,
        filename: `${baseName}_ocr.txt`,
        mimeType: 'text/plain',
        meta: {
          pagesProcessed: targetIndices.length,
          language: lang,
          averageConfidence: avgConfidence,
          isSearchable: 'yes',
          recognizedTextPreview: fullTextOutput.slice(0, 2000),
          outputSize: txtBlob.size,
        },
      };
    }

    const modifiedBytes = await pdfDoc.save();
    const pdfBlob = new Blob([toBlobPart(modifiedBytes)], { type: 'application/pdf' });

    return {
      blob: pdfBlob,
      filename: `${baseName}_searchable.pdf`,
      mimeType: 'application/pdf',
      meta: {
        pagesProcessed: targetIndices.length,
        totalPages,
        language: lang,
        averageConfidence: avgConfidence,
        isSearchable: 'yes',
        tamilUnicodeEmbedded: tamilFont ? 'yes' : 'no',
        recognizedTextPreview: fullTextOutput.slice(0, 2000),
        outputSize: pdfBlob.size,
      },
    };
  } finally {
    if (worker) {
      await worker.terminate().catch(() => {});
    }
    await pdfJsSession.destroy().catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────
// 2. Sign PDF (Draw, Type, or Upload Visual Electronic Signature)
// ─────────────────────────────────────────────────────────
export async function signPdf(
  file: File,
  options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  const arrayBuffer = await file.arrayBuffer();
  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  } catch (err) {
    throw new ProcessorError(`Could not read PDF document: ${(err as Error)?.message}`, 'INVALID_PDF');
  }

  const signerName = (options.signerName as string)?.trim() || 'Authorized Signer';
  const signatureType = (options.signatureType as string) || 'type'; // 'draw' | 'type' | 'upload'
  const signatureData = (options.signatureData as string) || '';
  const targetPageOption = (options.targetPage as string) || 'last'; // 'first' | 'last' | 'all' | 'custom'
  const customPage = Number(options.customPage ?? 1);
  const position = (options.position as string) || 'bottom-right';
  const addTimestamp = options.addTimestamp !== false;
  const sigWidth = Math.min(300, Math.max(80, Number(options.sigWidth ?? 160)));
  const sigHeight = Math.round(sigWidth * 0.45);

  const totalPages = pdfDoc.getPageCount();
  const targetIndices: number[] = [];

  if (targetPageOption === 'first') {
    targetIndices.push(0);
  } else if (targetPageOption === 'all') {
    for (let i = 0; i < totalPages; i++) targetIndices.push(i);
  } else if (targetPageOption === 'custom') {
    const idx = Math.min(totalPages, Math.max(1, customPage)) - 1;
    targetIndices.push(idx);
  } else {
    targetIndices.push(totalPages - 1);
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const italicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  let embeddedImage: any = null;
  if (signatureData.startsWith('data:image/png;base64,')) {
    const base64Data = signatureData.split(',')[1];
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    embeddedImage = await pdfDoc.embedPng(imageBytes);
  } else if (signatureData.startsWith('data:image/jpeg;base64,') || signatureData.startsWith('data:image/jpg;base64,')) {
    const base64Data = signatureData.split(',')[1];
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    embeddedImage = await pdfDoc.embedJpg(imageBytes);
  }

  const dateStr = new Date().toISOString().slice(0, 10);

  for (const pageIdx of targetIndices) {
    const page = pdfDoc.getPage(pageIdx);
    const { width, height } = page.getSize();

    let x = width - sigWidth - 40;
    let y = 50;

    if (position === 'bottom-left') {
      x = 40;
      y = 50;
    } else if (position === 'top-right') {
      x = width - sigWidth - 40;
      y = height - sigHeight - 50;
    } else if (position === 'center') {
      x = width / 2 - sigWidth / 2;
      y = height / 2 - sigHeight / 2;
    }

    if (embeddedImage) {
      page.drawImage(embeddedImage, {
        x,
        y,
        width: sigWidth,
        height: sigHeight,
      });
    } else {
      page.drawRectangle({
        x: x - 4,
        y: y - 4,
        width: sigWidth + 8,
        height: sigHeight + 8,
        borderColor: rgb(0.2, 0.4, 0.8),
        borderWidth: 1,
        color: rgb(0.96, 0.98, 1),
      });

      page.drawText(signerName, {
        x: x + 8,
        y: y + sigHeight - 24,
        size: 18,
        font: italicFont,
        color: rgb(0.1, 0.2, 0.6),
      });
    }

    if (addTimestamp) {
      const caption = `Visual Signature: ${signerName} · ${dateStr}`;
      page.drawText(caption, {
        x,
        y: y - 14,
        size: 8,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
  }

  const modifiedBytes = await pdfDoc.save();
  const blob = new Blob([toBlobPart(modifiedBytes)], { type: 'application/pdf' });
  const baseName = file.name.replace(/\.pdf$/i, '') || 'document';

  return {
    blob,
    filename: `${baseName}_signed.pdf`,
    mimeType: 'application/pdf',
    meta: {
      signerName,
      signatureType,
      pagesSigned: targetIndices.length,
      totalPages,
      date: dateStr,
      isVisualSignature: 'yes',
      signatureNotice: 'Visual electronic signature applied (not a PKI certificate-backed digital signature).',
      outputSize: blob.size,
    },
  };
}

// ─────────────────────────────────────────────────────────
// 3. Fill PDF Forms (AcroForms + XFA Detection)
// ─────────────────────────────────────────────────────────
export async function fillPdfForms(
  file: File,
  options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  const arrayBuffer = await file.arrayBuffer();
  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  } catch (err) {
    throw new ProcessorError(`Could not read PDF document: ${(err as Error)?.message}`, 'INVALID_PDF');
  }

  // Inspect PDF catalog AcroForm dictionary for unsupported XFA forms
  let hasXfa = false;
  try {
    const acroFormRef = pdfDoc.catalog.get(PDFName.of('AcroForm'));
    if (acroFormRef) {
      const acroFormDict = pdfDoc.context.lookup(acroFormRef);
      if (acroFormDict instanceof PDFDict && acroFormDict.has(PDFName.of('XFA'))) {
        hasXfa = true;
      }
    }
  } catch {
    // Ignore catalog inspection errors
  }

  const form = pdfDoc.getForm();
  const fields = form.getFields();

  // Pure XFA forms without editable AcroForm fields cannot be edited client-side
  if (hasXfa && fields.length === 0) {
    throw new ProcessorError(
      'This PDF uses Adobe XML Forms Architecture (XFA), which is not supported for interactive form filling. Your original PDF has not been modified.',
      'UNSUPPORTED_XFA_FORM'
    );
  }

  const flatten = options.flatten !== false;
  const fieldValues = (options.fieldValues as Record<string, string | boolean>) || {};

  let updatedCount = 0;
  const detectedFieldNames: string[] = [];

  for (const field of fields) {
    const name = field.getName();
    detectedFieldNames.push(name);

    if (Object.prototype.hasOwnProperty.call(fieldValues, name)) {
      const val = fieldValues[name];
      try {
        if (field instanceof PDFTextField && typeof val === 'string') {
          field.setText(val);
          updatedCount++;
        } else if (field instanceof PDFCheckBox) {
          if (Boolean(val)) field.check();
          else field.uncheck();
          updatedCount++;
        } else if (field instanceof PDFDropdown && typeof val === 'string') {
          field.select(val);
          updatedCount++;
        } else if (field instanceof PDFRadioGroup && typeof val === 'string') {
          field.select(val);
          updatedCount++;
        }
      } catch {
        // Continue on individual field mapping mismatch
      }
    }
  }

  if (flatten && fields.length > 0) {
    form.flatten();
  }

  const modifiedBytes = await pdfDoc.save();
  const blob = new Blob([toBlobPart(modifiedBytes)], { type: 'application/pdf' });
  const baseName = file.name.replace(/\.pdf$/i, '') || 'document';

  const meta: Record<string, string | number> = {
    fieldsDetected: fields.length,
    fieldsUpdated: updatedCount,
    fieldNames: detectedFieldNames.slice(0, 20).join(', '),
    isFlattened: flatten ? 'yes' : 'no',
    hasInteractiveFields: fields.length > 0 ? 'yes' : 'no',
    hasXfa: hasXfa ? 'yes' : 'no',
    outputSize: blob.size,
  };

  if (hasXfa) {
    meta.xfaWarning = 'Hybrid XFA/AcroForm detected: standard AcroForm fields were processed, but dynamic XFA XML scripts are unsupported.';
  }

  return {
    blob,
    filename: `${baseName}_filled.pdf`,
    mimeType: 'application/pdf',
    meta,
  };
}

// ─────────────────────────────────────────────────────────
// 4. Reorder PDF Pages (Reorder, Rotate, Duplicate, Delete)
// ─────────────────────────────────────────────────────────
export async function reorderPdfPages(
  file: File,
  options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  const arrayBuffer = await file.arrayBuffer();
  let srcDoc: PDFDocument;
  try {
    srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  } catch (err) {
    throw new ProcessorError(`Could not read PDF document: ${(err as Error)?.message}`, 'INVALID_PDF');
  }

  const totalPages = srcDoc.getPageCount();
  const orderStr = (options.order as string)?.trim();
  const rotateAngle = Number(options.rotation ?? 0);
  const deletePagesStr = (options.deletePages as string)?.trim();

  let targetIndices: number[] = [];
  if (orderStr) {
    const parts = orderStr.split(',').map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      const pageNum = parseInt(p, 10);
      if (pageNum >= 1 && pageNum <= totalPages) {
        targetIndices.push(pageNum - 1);
      }
    }
  } else {
    targetIndices = Array.from({ length: totalPages }, (_, i) => i);
  }

  if (deletePagesStr) {
    const toDelete = new Set(
      deletePagesStr
        .split(',')
        .map((s) => parseInt(s.trim(), 10) - 1)
        .filter((idx) => !isNaN(idx))
    );
    targetIndices = targetIndices.filter((idx) => !toDelete.has(idx));
  }

  if (targetIndices.length === 0) {
    throw new ProcessorError(
      'Cannot create an empty PDF document. Please specify at least one valid page to keep.',
      'ZERO_PAGES_REMAINING'
    );
  }

  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(srcDoc, targetIndices);

  for (const page of copiedPages) {
    if (rotateAngle !== 0) {
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees((currentRotation + rotateAngle) % 360));
    }
    newDoc.addPage(page);
  }

  const modifiedBytes = await newDoc.save();
  const blob = new Blob([toBlobPart(modifiedBytes)], { type: 'application/pdf' });
  const baseName = file.name.replace(/\.pdf$/i, '') || 'document';

  return {
    blob,
    filename: `${baseName}_reordered.pdf`,
    mimeType: 'application/pdf',
    meta: {
      originalPages: totalPages,
      newPages: targetIndices.length,
      rotationApplied: rotateAngle,
      orderSequence: targetIndices.map((i) => i + 1).join(','),
      outputSize: blob.size,
    },
  };
}

// ─────────────────────────────────────────────────────────
// 5. Compare PDF Documents (Text & Structural Diff)
// ─────────────────────────────────────────────────────────
export async function comparePdf(
  files: File[],
  _options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  if (!files || files.length < 2) {
    throw new ProcessorError(
      'Please select exactly two PDF documents to compare (Original and Modified).',
      'INSUFFICIENT_FILES'
    );
  }

  const [fileA, fileB] = files;
  const bufA = await fileA.arrayBuffer();
  const bufB = await fileB.arrayBuffer();

  let docA: PDFDocument;
  let docB: PDFDocument;

  try {
    docA = await PDFDocument.load(bufA, { ignoreEncryption: true });
    docB = await PDFDocument.load(bufB, { ignoreEncryption: true });
  } catch (err) {
    throw new ProcessorError(`Could not parse comparison PDFs: ${(err as Error)?.message}`, 'INVALID_PDF');
  }

  const pagesA = docA.getPageCount();
  const pagesB = docB.getPageCount();

  // Structural box differences per page
  const structuralDiffs: string[] = [];
  const sharedCount = Math.min(pagesA, pagesB);
  for (let i = 0; i < sharedCount; i++) {
    const sA = docA.getPage(i).getSize();
    const sB = docB.getPage(i).getSize();
    if (Math.round(sA.width) !== Math.round(sB.width) || Math.round(sA.height) !== Math.round(sB.height)) {
      structuralDiffs.push(
        `Page ${i + 1} dimensions changed: ${Math.round(sA.width)}x${Math.round(sA.height)}pt -> ${Math.round(sB.width)}x${Math.round(sB.height)}pt`
      );
    }
  }
  if (pagesA !== pagesB) {
    structuralDiffs.push(`Page count changed: ${pagesA} -> ${pagesB}`);
  }

  const textsA = await extractPageTexts(docA, bufA);
  const textsB = await extractPageTexts(docB, bufB);

  const changedPages: string[] = [];
  for (let i = 0; i < sharedCount; i++) {
    if (textsA[i] !== textsB[i]) {
      changedPages.push(`Page ${i + 1}: text content differs`);
    }
  }

  const fullTextA = textsA.join('\n');
  const fullTextB = textsB.join('\n');

  const linesA = fullTextA.split('\n').map((l) => l.trim()).filter(Boolean);
  const linesB = fullTextB.split('\n').map((l) => l.trim()).filter(Boolean);

  const setA = new Set(linesA);
  const setB = new Set(linesB);

  const addedLines = linesB.filter((l) => !setA.has(l));
  const removedLines = linesA.filter((l) => !setB.has(l));
  const commonLines = linesA.filter((l) => setB.has(l));

  const totalLines = Math.max(1, linesA.length + linesB.length);
  const similarityScore = Math.min(100, Math.round((commonLines.length * 200) / totalLines));

  const reportLines: string[] = [
    '============================================================',
    'CONVET PULSE — PDF Text & Structural Comparison Report',
    'Note: Compares extracted text tokens and PDF structure.',
    'Visual pixel-by-pixel layout comparison is not included.',
    '============================================================\n',
    `Document A: ${fileA.name} (${pagesA} pages, ${(fileA.size / 1024).toFixed(1)} KB)`,
    `Document B: ${fileB.name} (${pagesB} pages, ${(fileB.size / 1024).toFixed(1)} KB)`,
    `Generated On: ${new Date().toISOString()}\n`,
    '------------------------------------------------------------',
    'METRIC COMPARISON',
    '------------------------------------------------------------',
    `Page Count:   Doc A: ${pagesA} | Doc B: ${pagesB} (Diff: ${pagesB - pagesA >= 0 ? '+' : ''}${pagesB - pagesA})`,
    `File Size:    Doc A: ${(fileA.size / 1024).toFixed(1)} KB | Doc B: ${(fileB.size / 1024).toFixed(1)} KB`,
    `Text Match:   ${similarityScore}% Text Token Similarity\n`,
    '------------------------------------------------------------',
    'STRUCTURAL & PAGE-LEVEL CHANGES',
    '------------------------------------------------------------',
    structuralDiffs.length > 0 ? structuralDiffs.join('\n') : 'No structural page count or page dimension changes.',
    changedPages.length > 0 ? changedPages.join('\n') : 'All shared pages have identical extracted text streams.\n',
    '------------------------------------------------------------',
    `CONTENT ADDITIONS (+${addedLines.length} lines in Document B)`,
    '------------------------------------------------------------',
    addedLines.length > 0
      ? addedLines.slice(0, 25).map((l) => `+ ${l}`).join('\n') +
        (addedLines.length > 25 ? `\n... and ${addedLines.length - 25} more additions` : '')
      : 'None (No unique lines added in Document B)',
    '',
    '------------------------------------------------------------',
    `CONTENT DELETIONS (-${removedLines.length} lines from Document A)`,
    '------------------------------------------------------------',
    removedLines.length > 0
      ? removedLines.slice(0, 25).map((l) => `- ${l}`).join('\n') +
        (removedLines.length > 25 ? `\n... and ${removedLines.length - 25} more deletions` : '')
      : 'None (No unique lines removed from Document A)',
  ];

  const reportText = reportLines.join('\n');
  const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });

  return {
    blob,
    filename: `compare_${fileA.name.replace(/\.pdf$/i, '')}_vs_${fileB.name.replace(/\.pdf$/i, '')}.txt`,
    mimeType: 'text/plain',
    meta: {
      docAName: fileA.name,
      docBName: fileB.name,
      pagesA,
      pagesB,
      pageCountDiff: pagesB - pagesA,
      changedPagesCount: changedPages.length,
      structuralDiffsCount: structuralDiffs.length,
      addedLinesCount: addedLines.length,
      removedLinesCount: removedLines.length,
      similarityScore,
      comparisonMode: 'text-and-structural',
      outputSize: blob.size,
    },
  };
}

// ─────────────────────────────────────────────────────────
// 6. PDF to Images (PDF.js Real Rasterization to PNG/JPG + ZIP)
// ─────────────────────────────────────────────────────────
export async function pdfToImages(
  file: File,
  options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  const results = await pdfToImagesBatch(file, options);
  return results[0];
}

export async function pdfToImagesBatch(
  file: File,
  options: Record<string, unknown> = {}
): Promise<ProcessorResult[]> {
  const signal = options.signal as AbortSignal | undefined;
  const onProgress = options.onProgress as ((info: ProgressInfo) => void) | undefined;

  if (signal?.aborted) {
    throw new ProcessorError('PDF to Images conversion was cancelled.', 'CANCELLED');
  }

  const arrayBuffer = await file.arrayBuffer();
  // Validate with pdf-lib first for consistent INVALID_PDF error handling
  try {
    await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  } catch (err) {
    throw new ProcessorError(`Could not read PDF document: ${(err as Error)?.message}`, 'INVALID_PDF');
  }

  const format: 'png' | 'jpg' = (options.format as string) === 'jpg' ? 'jpg' : 'png';
  const dpi = Math.min(300, Math.max(72, Number(options.dpi ?? 150)));
  const pageRangeStr = (options.pageRange as string) || 'all';
  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';

  const pdfJsSession = await openPdfJsSession(arrayBuffer);
  const totalPages = pdfJsSession.numPages;
  const targetIndices = parsePageRange(pageRangeStr, totalPages);

  if (targetIndices.length === 0) {
    await pdfJsSession.destroy().catch(() => {});
    throw new ProcessorError('No valid pages selected in page range.', 'INVALID_PAGE_RANGE');
  }

  const zip = new JSZip();
  const baseName = file.name.replace(/\.pdf$/i, '') || 'document';
  const individualResults: ProcessorResult[] = [];

  try {
    for (let i = 0; i < targetIndices.length; i++) {
      if (signal?.aborted) {
        throw new ProcessorError('PDF to Images conversion was cancelled by user.', 'CANCELLED');
      }

      const pageIdx = targetIndices[i];
      const pageNum = pageIdx + 1;

      onProgress?.({
        page: i + 1,
        total: targetIndices.length,
        stage: 'rasterizing',
        percent: Math.round(10 + ((i + 0.5) / targetIndices.length) * 80),
        message: `Rendering page ${pageNum} of ${totalPages} at ${dpi} DPI...`,
      });

      const rendered = await pdfJsSession.renderPage(pageNum, { dpi });
      let imageBytes: Uint8Array;
      let width = rendered.width;
      let height = rendered.height;
      try {
        imageBytes = await rendered.toBytes(format, 0.92);
      } finally {
        rendered.cleanup();
      }

      const paddedNum = String(pageNum).padStart(3, '0');
      const imgFilename = `${baseName}_page_${paddedNum}.${format}`;
      zip.file(`page_${paddedNum}.${format}`, imageBytes);

      const imgBlob = new Blob([toBlobPart(imageBytes)], { type: mimeType });
      individualResults.push({
        blob: imgBlob,
        filename: imgFilename,
        mimeType,
        meta: {
          pageNumber: pageNum,
          width,
          height,
          dpi,
          format: format.toUpperCase(),
          outputSize: imgBlob.size,
        },
      });
    }

    onProgress?.({
      page: targetIndices.length,
      total: targetIndices.length,
      stage: 'packaging',
      percent: 95,
      message: 'Packaging rendered images into ZIP archive...',
    });

    const zipContent = await zip.generateAsync({ type: 'uint8array' });
    const zipBlob = new Blob([toBlobPart(zipContent)], { type: 'application/zip' });

    const zipResult: ProcessorResult = {
      blob: zipBlob,
      filename: `${baseName}_images.zip`,
      mimeType: 'application/zip',
      meta: {
        pagesConverted: individualResults.length,
        totalPages,
        dpi,
        format: format.toUpperCase(),
        outputSize: zipBlob.size,
      },
    };

    return [zipResult, ...individualResults];
  } finally {
    await pdfJsSession.destroy().catch(() => {});
  }
}
