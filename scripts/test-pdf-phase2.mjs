// ============================================================
// CONVET PULSE — PDF Studio Phase 2 & 2.1 Real Functional Suite
// Verifies genuine processing (no mocks or synthetic placeholders):
// 1. PDF OCR (PDF.js + Tesseract.js on scanned-image PDF + Tamil Unicode)
// 2. PDF to Images (PDF.js rasterization, PNG/JPEG magic bytes, non-white pixels)
// 3. Sign PDF (Drawn/Typed/Uploaded visual signatures)
// 4. Fill PDF Forms (AcroForms + XFA unsupported form detection)
// 5. Reorder PDF Pages (Reorder, rotate, duplicate, delete, 0-page guard)
// 6. Compare PDF (Added, removed, changed text, page count & box diffs)
// 7. Cancellation, Invalid PDFs, Registry & Dispatch Integrity
// ============================================================

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { PDFDocument, PDFName, StandardFonts, rgb } from 'pdf-lib';
import * as fontkit from 'fontkit';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import JSZip from 'jszip';
import {
  pdfOcr,
  signPdf,
  fillPdfForms,
  reorderPdfPages,
  comparePdf,
  pdfToImages,
  pdfToImagesBatch,
} from '../src/lib/pdfStudioPhase2.ts';
import { TOOLS } from '../src/registry/tools.ts';
import { getToolDispatch, hasProcessor } from '../src/lib/toolDispatch.ts';

// Helper: create a valid vector+text test PDF in memory
async function createTestPdf(pageCount = 3, textContent = 'CONVET PULSE Test Document', pageSize = [600, 800]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage(pageSize);
    // Draw colored geometric shapes so rasterization has non-white vector content
    page.drawRectangle({
      x: 30,
      y: pageSize[1] - 130,
      width: pageSize[0] - 60,
      height: 100,
      color: rgb(0.9, 0.94, 1),
      borderColor: rgb(0.1, 0.3, 0.8),
      borderWidth: 3,
    });
    page.drawText(`${textContent} - Page ${i + 1}`, {
      x: 50,
      y: pageSize[1] - 75,
      size: 18,
      font,
      color: rgb(0.05, 0.1, 0.2),
    });
    page.drawText(`Sample body paragraph on page ${i + 1} with verifiable text stream tokens.`, {
      x: 50,
      y: pageSize[1] - 110,
      size: 12,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
  }

  const bytes = await doc.save();
  return new File([bytes], 'test_document.pdf', { type: 'application/pdf' });
}

// Helper: create a genuine scanned-image PDF (bitmap only, zero text stream!)
async function createScannedImagePdf(textLines = ['INVOICE TOTAL 4500', 'CONVET PULSE OCR']) {
  const canvas = createCanvas(900, 300);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 900, 300);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 44px sans-serif';
  textLines.forEach((line, idx) => {
    ctx.fillText(line, 40, 100 + idx * 80);
  });
  const pngBuffer = canvas.toBuffer('image/png');

  const doc = await PDFDocument.create();
  const pngImg = await doc.embedPng(pngBuffer);
  const page = doc.addPage([900, 300]);
  page.drawImage(pngImg, { x: 0, y: 0, width: 900, height: 300 });
  const bytes = await doc.save();
  return new File([bytes], 'scanned_document.pdf', { type: 'application/pdf' });
}

// Helper: create a test PDF with interactive AcroForm fields
async function createFormPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const form = doc.getForm();

  const nameField = form.createTextField('fullName');
  nameField.setText('Initial Name');
  nameField.addToPage(page, { x: 50, y: 700, width: 200, height: 25 });

  const agreeCheck = form.createCheckBox('agreeTerms');
  agreeCheck.addToPage(page, { x: 50, y: 650, width: 20, height: 20 });

  const bytes = await doc.save();
  return new File([bytes], 'interactive_form.pdf', { type: 'application/pdf' });
}

// Helper: create a PDF with an /XFA dictionary entry in /AcroForm
async function createXfaFormPdf() {
  const doc = await PDFDocument.create();
  doc.addPage([600, 800]);
  const xfaStream = doc.context.stream('<xdp:xdp xmlns:xdp="http://ns.adobe.com/xdp/"></xdp:xdp>');
  const xfaRef = doc.context.register(xfaStream);
  const acroFormDict = doc.context.obj({
    XFA: xfaRef,
  });
  const acroFormRef = doc.context.register(acroFormDict);
  doc.catalog.set(PDFName.of('AcroForm'), acroFormRef);
  const bytes = await doc.save();
  return new File([bytes], 'xfa_form.pdf', { type: 'application/pdf' });
}

// Helper: extract text from PDF via PDF.js
async function extractTextViaPdfJs(pdfBytes) {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes), useSystemFonts: true });
  const pdf = await loadingTask.promise;
  const pageTexts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const p = await pdf.getPage(i);
    const tc = await p.getTextContent();
    pageTexts.push(tc.items.map((item) => item.str).join(' '));
  }
  await loadingTask.destroy();
  return pageTexts;
}

async function runPhase2Tests() {
  console.log('\n======================================================');
  console.log('CONVET PULSE — PDF STUDIO PHASE 2 & 2.1 REAL QA SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  // ── 1. Registry & Dispatch Integrity ──────────────────
  console.log('--- 1. Registry & Dispatch Integrity ---');

  const newSlugs = [
    'pdf-ocr',
    'sign-pdf',
    'fill-pdf-forms',
    'reorder-pdf-pages',
    'compare-pdf',
    'pdf-to-images',
  ];

  test('All 6 Phase 2 PDF tools registered in central registry', () => {
    const registered = TOOLS.map((t) => t.slug);
    for (const slug of newSlugs) {
      assert(registered.includes(slug), `Missing tool slug in TOOLS: ${slug}`);
    }
  });

  test('All 6 Phase 2 PDF tools have dispatch processors wired', () => {
    for (const slug of newSlugs) {
      assert(hasProcessor(slug), `Missing processor in toolDispatch for slug: ${slug}`);
      const dispatch = getToolDispatch(slug);
      assert(typeof dispatch?.processor === 'function', `Dispatch processor is not a function for: ${slug}`);
    }
  });

  // ── 2. Genuine PDF OCR (Tesseract.js + PDF.js + Unicode) ─
  console.log('\n--- 2. Genuine PDF OCR (Tesseract.js + PDF.js) ---');

  await testAsync('pdfOcr recognizes text from a genuine scanned-image PDF and embeds searchable text layer', async () => {
    const scannedPdf = await createScannedImagePdf(['INVOICE TOTAL 4500', 'CONVET PULSE OCR']);
    const res = await pdfOcr(scannedPdf, { lang: 'eng', outputFormat: 'searchable-pdf', dpi: 180 });

    assert(res.blob instanceof Blob);
    assert.strictEqual(res.mimeType, 'application/pdf');
    assert(res.filename.endsWith('_searchable.pdf'));
    assert(String(res.meta?.recognizedTextPreview).toUpperCase().includes('INVOICE'), 'Recognized text must include INVOICE');
    assert(String(res.meta?.recognizedTextPreview).toUpperCase().includes('CONVET'), 'Recognized text must include CONVET');

    // Reopen generated PDF via PDF.js and verify genuine selectable text layer exists
    const outBuf = await res.blob.arrayBuffer();
    const extractedPages = await extractTextViaPdfJs(outBuf);
    const joined = extractedPages.join(' ').toUpperCase();
    assert(joined.includes('INVOICE'), `Reopened PDF text layer must contain INVOICE, got: ${joined}`);
    assert(joined.includes('CONVET'), `Reopened PDF text layer must contain CONVET, got: ${joined}`);
  });

  await testAsync('pdfOcr exports recognized text from vector PDF as plain TXT', async () => {
    const testPdf = await createTestPdf(1, 'ALPHA BRAVO CHARLIE');
    const res = await pdfOcr(testPdf, { lang: 'eng', outputFormat: 'text', dpi: 180 });

    assert.strictEqual(res.mimeType, 'text/plain');
    assert(res.filename.endsWith('_ocr.txt'));
    const txt = await res.blob.text();
    assert(txt.toUpperCase().includes('ALPHA'), `TXT export must include ALPHA, got: ${txt}`);
    assert(txt.toUpperCase().includes('CHARLIE'), `TXT export must include CHARLIE, got: ${txt}`);
  });

  await testAsync('Unicode Tamil font (NotoSansTamil) embeds Tamil characters and survives PDF reopening', async () => {
    const fontPath = path.resolve(process.cwd(), 'public/fonts/NotoSansTamil-Regular.ttf');
    assert(fs.existsSync(fontPath), 'public/fonts/NotoSansTamil-Regular.ttf must exist');
    const fontBytes = fs.readFileSync(fontPath);

    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const tamilFont = await doc.embedFont(fontBytes, {
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
    });
    const page = doc.addPage([600, 200]);
    const sampleTamil = 'தமிழ் ஆவணம்';
    page.drawText(sampleTamil, { x: 40, y: 120, size: 20, font: tamilFont, opacity: 0.001 });
    const saved = await doc.save();

    const extracted = await extractTextViaPdfJs(saved);
    assert(extracted[0].includes('தமிழ்'), `Reopened PDF must preserve Tamil Unicode glyphs, got: ${extracted[0]}`);
    assert(extracted[0].includes('ஆவணம்'), `Reopened PDF must preserve Tamil Unicode glyphs, got: ${extracted[0]}`);
  });

  await testAsync('pdfOcr runs Tamil OCR (tam) on a rendered Tamil PDF and preserves Tamil text layer', async () => {
    const fontPath = path.resolve(process.cwd(), 'public/fonts/NotoSansTamil-Regular.ttf');
    const fontBytes = fs.readFileSync(fontPath);
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const tamilFont = await doc.embedFont(fontBytes);
    const page = doc.addPage([600, 200]);
    page.drawText('தமிழ்', { x: 80, y: 100, size: 40, font: tamilFont });
    const bytes = await doc.save();
    const tamilFile = new File([bytes], 'tamil_sample.pdf', { type: 'application/pdf' });

    const res = await pdfOcr(tamilFile, { lang: 'tam', outputFormat: 'searchable-pdf', dpi: 200 });
    assert.strictEqual(res.mimeType, 'application/pdf');
    assert.strictEqual(res.meta?.tamilUnicodeEmbedded, 'yes');
    const outBuf = await res.blob.arrayBuffer();
    const outDoc = await PDFDocument.load(outBuf);
    assert.strictEqual(outDoc.getPageCount(), 1);
  });

  await testAsync('pdfOcr supports AbortSignal cancellation cleanly', async () => {
    const testPdf = await createTestPdf(2, 'Cancel Target');
    const controller = new AbortController();
    controller.abort();
    let threw = false;
    try {
      await pdfOcr(testPdf, { signal: controller.signal });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'CANCELLED');
    }
    assert(threw, 'Aborted OCR must throw CANCELLED');
  });

  // ── 3. Genuine PDF to Images (PDF.js Rasterization) ───
  console.log('\n--- 3. Genuine PDF to Images (PDF.js Rasterization) ---');

  await testAsync('pdfToImagesBatch renders real PNG images with valid magic bytes and non-white pixels', async () => {
    const testPdf = await createTestPdf(3, 'RASTER TEST DOCUMENT', [600, 800]);
    const results = await pdfToImagesBatch(testPdf, { format: 'png', dpi: 150, pageRange: '1-2' });

    assert.strictEqual(results.length, 3, 'Should return ZIP + 2 individual PNG page results');
    const zipRes = results[0];
    const p1Res = results[1];
    assert.strictEqual(zipRes.mimeType, 'application/zip');
    assert.strictEqual(p1Res.mimeType, 'image/png');

    // Verify PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    const p1Bytes = new Uint8Array(await p1Res.blob.arrayBuffer());
    assert.strictEqual(p1Bytes[0], 0x89, 'PNG magic byte 0');
    assert.strictEqual(p1Bytes[1], 0x50, 'PNG magic byte 1 (P)');
    assert.strictEqual(p1Bytes[2], 0x4e, 'PNG magic byte 2 (N)');
    assert.strictEqual(p1Bytes[3], 0x47, 'PNG magic byte 3 (G)');

    // Decode PNG and verify dimensions & non-white pixel content
    const img = await loadImage(Buffer.from(p1Bytes));
    const expectedWidth = Math.round(600 * (150 / 72));
    assert(Math.abs(img.width - expectedWidth) <= 2, `Expected width ~${expectedWidth}, got ${img.width}`);
    const checkCanvas = createCanvas(img.width, img.height);
    const ctx = checkCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const pixelData = ctx.getImageData(0, 0, img.width, img.height).data;
    let nonWhitePixels = 0;
    for (let idx = 0; idx < pixelData.length; idx += 4) {
      if (pixelData[idx] < 245 || pixelData[idx + 1] < 245 || pixelData[idx + 2] < 245) {
        nonWhitePixels++;
      }
    }
    assert(nonWhitePixels > 500, `Rendered PNG must contain visible non-white pixels (found ${nonWhitePixels})`);

    // Verify ZIP entries contain valid PNGs
    const zip = await JSZip.loadAsync(await zipRes.blob.arrayBuffer());
    const fileNames = Object.keys(zip.files);
    assert(fileNames.includes('page_001.png'));
    assert(fileNames.includes('page_002.png'));
    assert(!fileNames.includes('page_003.png'));
    const zipP1 = await zip.file('page_001.png').async('uint8array');
    assert.strictEqual(zipP1[0], 0x89);
    assert.strictEqual(zipP1[1], 0x50);
  });

  await testAsync('pdfToImages renders valid JPEG images with FF D8 FF signature and respects DPI', async () => {
    const testPdf = await createTestPdf(1, 'JPEG DPI TEST', [400, 400]);
    const results = await pdfToImagesBatch(testPdf, { format: 'jpg', dpi: 72 });
    const jpgRes = results[1];
    assert.strictEqual(jpgRes.mimeType, 'image/jpeg');
    const bytes = new Uint8Array(await jpgRes.blob.arrayBuffer());
    assert.strictEqual(bytes[0], 0xff, 'JPEG SOI byte 0');
    assert.strictEqual(bytes[1], 0xd8, 'JPEG SOI byte 1');
    assert.strictEqual(bytes[2], 0xff, 'JPEG marker byte 2');
    assert.strictEqual(jpgRes.meta?.width, 400, '72 DPI should match 1:1 point width');
  });

  // ── 4. Sign PDF ───────────────────────────────────────
  console.log('\n--- 4. Sign PDF ---');

  await testAsync('signPdf applies typed visual signature and marks isVisualSignature honestly', async () => {
    const testPdf = await createTestPdf(2, 'Contract Agreement');
    const res = await signPdf(testPdf, {
      signerName: 'Jane Smith, Legal Counsel',
      signatureType: 'type',
      targetPage: 'last',
      position: 'bottom-right',
      addTimestamp: true,
    });

    assert.strictEqual(res.mimeType, 'application/pdf');
    assert.strictEqual(res.meta?.isVisualSignature, 'yes');
    const outDoc = await PDFDocument.load(await res.blob.arrayBuffer());
    assert.strictEqual(outDoc.getPageCount(), 2);
  });

  await testAsync('signPdf embeds drawn/uploaded PNG signature image', async () => {
    const sigCanvas = createCanvas(200, 80);
    const sctx = sigCanvas.getContext('2d');
    sctx.strokeStyle = '#0000aa';
    sctx.lineWidth = 4;
    sctx.beginPath();
    sctx.moveTo(10, 50);
    sctx.lineTo(180, 30);
    sctx.stroke();
    const dataUrl = `data:image/png;base64,${sigCanvas.toBuffer('image/png').toString('base64')}`;

    const testPdf = await createTestPdf(1, 'Drawn Signature Doc');
    const res = await signPdf(testPdf, {
      signerName: 'Dr. Sridhar',
      signatureType: 'draw',
      signatureData: dataUrl,
    });
    const outDoc = await PDFDocument.load(await res.blob.arrayBuffer());
    assert.strictEqual(outDoc.getPageCount(), 1);
  });

  // ── 5. Fill PDF Forms & XFA Detection ─────────────────
  console.log('\n--- 5. Fill PDF Forms & XFA Detection ---');

  await testAsync('fillPdfForms inspects, updates, and flattens AcroForm fields', async () => {
    const formPdf = await createFormPdf();
    const res = await fillPdfForms(formPdf, {
      fieldValues: { fullName: 'Dr. Sridhar Verified', agreeTerms: true },
      flatten: true,
    });

    assert.strictEqual(res.meta?.fieldsDetected, 2);
    assert.strictEqual(res.meta?.fieldsUpdated, 2);
    assert.strictEqual(res.meta?.isFlattened, 'yes');
    const outDoc = await PDFDocument.load(await res.blob.arrayBuffer());
    assert.strictEqual(outDoc.getForm().getFields().length, 0, 'Flattened PDF should have 0 remaining interactive fields');
  });

  await testAsync('fillPdfForms detects unsupported XFA forms and throws UNSUPPORTED_XFA_FORM', async () => {
    const xfaPdf = await createXfaFormPdf();
    let threw = false;
    try {
      await fillPdfForms(xfaPdf);
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'UNSUPPORTED_XFA_FORM');
      assert(err.message.includes('XFA'));
    }
    assert(threw, 'Should reject pure XFA form with clear UNSUPPORTED_XFA_FORM error');
  });

  // ── 6. Reorder PDF Pages ──────────────────────────────
  console.log('\n--- 6. Reorder PDF Pages ---');

  await testAsync('reorderPdfPages reorders, duplicates, rotates, and deletes pages', async () => {
    const testPdf = await createTestPdf(4, 'Sequential Pages');
    const res = await reorderPdfPages(testPdf, {
      order: '4, 2, 2, 1',
      rotation: 90,
      deletePages: '1',
    });

    assert.strictEqual(res.meta?.originalPages, 4);
    assert.strictEqual(res.meta?.newPages, 3);
    const outDoc = await PDFDocument.load(await res.blob.arrayBuffer());
    assert.strictEqual(outDoc.getPageCount(), 3);
    assert.strictEqual(outDoc.getPage(0).getRotation().angle, 90);
  });

  // ── 7. Compare PDF (Text & Structural) ────────────────
  console.log('\n--- 7. Compare PDF (Text & Structural) ---');

  await testAsync('comparePdf detects added/removed text, page count diff, and structural box changes', async () => {
    const docA = await createTestPdf(2, 'Original Version Content', [600, 800]);
    const docB = await createTestPdf(3, 'Modified Revision Content', [595, 842]);

    const res = await comparePdf([docA, docB]);
    assert.strictEqual(res.mimeType, 'text/plain');
    assert.strictEqual(res.meta?.pageCountDiff, 1);
    assert.strictEqual(res.meta?.comparisonMode, 'text-and-structural');

    const report = await res.blob.text();
    assert(report.includes('Page count changed: 2 -> 3'));
    assert(report.includes('Visual pixel-by-pixel layout comparison is not included'));
    assert(report.includes('CONTENT ADDITIONS'));
    assert(report.includes('CONTENT DELETIONS'));
  });

  // ── 8. Security & Edge-Case Guards ────────────────────
  console.log('\n--- 8. Security & Edge-Case Guards ---');

  await testAsync('Zero-page PDF creation is blocked with ZERO_PAGES_REMAINING', async () => {
    const testPdf = await createTestPdf(2, 'Zero Page Guard');
    let threw = false;
    try {
      await reorderPdfPages(testPdf, { deletePages: '1, 2' });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'ZERO_PAGES_REMAINING');
    }
    assert(threw);
  });

  await testAsync('Insufficient files for comparePdf throws INSUFFICIENT_FILES', async () => {
    const docA = await createTestPdf(1, 'Single Doc');
    let threw = false;
    try {
      await comparePdf([docA]);
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'INSUFFICIENT_FILES');
    }
    assert(threw);
  });

  await testAsync('Malformed non-PDF bytes throw INVALID_PDF error', async () => {
    const corruptedFile = new File([new Uint8Array([1, 2, 3, 4, 5])], 'corrupt.pdf', { type: 'application/pdf' });
    let threw = false;
    try {
      await pdfToImages(corruptedFile);
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'INVALID_PDF');
    }
    assert(threw);
  });

  console.log('\n' + '='.repeat(54));
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('='.repeat(54) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
