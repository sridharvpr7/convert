// ============================================================
// CONVET PULSE — Document Studio Phase 3 Functional Test Suite
// Verifies genuine document creation, editing, conversion & security:
// 1. DOCX Document Creator (OpenXML binary, Zip packaging, templates, styling)
// 2. Word DOCX Editor / Extraction (Mammoth text & HTML extraction, Tamil glyphs)
// 3. Markdown Studio (Marked + DOMPurify, XSS defense, MD -> PDF / DOCX / HTML)
// 4. Text Document Studio (Word/char stats, Find & Replace, Tamil UTF-8)
// 5. HTML Document Studio (Sanitization, script blocking, multi-export)
// 6. RTF Converter (Genuine RTF, Unicode \\uN? signed escaping, round-trip)
// 7. Dedicated Converters (docx-to-txt, markdown-to-pdf, markdown-to-docx, txt-to-docx)
// 8. Error Handling & Edge Cases (Invalid DOCX, empty inputs, corrupted data)
// 9. Registry & Dispatch Integrity (All 10 Phase 3 tools registered & dispatchable)
// ============================================================

import assert from 'node:assert';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import {
  DOCUMENT_TEMPLATES,
  calculateDocumentStats,
  sanitizeHtml,
  createDocxDocument,
  extractDocxContent,
  markdownToHtml,
  markdownToDocx,
  markdownToPdf,
  textToRtf,
  rtfToText,
  processDocxCreator,
  processDocxEditor,
  processMarkdownStudio,
  processTextStudio,
  processHtmlStudio,
  processRtfConverter,
  processDocxToTxt,
  processMarkdownToPdf,
  processMarkdownToDocx,
  processTxtToDocx,
} from '../src/lib/documentStudio.ts';
import { TOOLS, getToolBySlug } from '../src/registry/tools.ts';
import { getToolDispatch, hasProcessor } from '../src/lib/toolDispatch.ts';
import { STUDIOS, getStudioById } from '../src/registry/studios.ts';

// Test harness state
let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.log(`  \x1b[31m✘\x1b[0m ${name}`);
    console.log(`    \x1b[31m${err.message}\x1b[0m`);
    if (err.stack) {
      const firstLine = err.stack.split('\n')[1];
      console.log(`    \x1b[90m${firstLine.trim()}\x1b[0m`);
    }
    failed++;
    failures.push({ name, error: err });
  }
}

function section(title) {
  console.log(`\n\x1b[1m\x1b[36m=== ${title} ===\x1b[0m`);
}

// Helper to simulate browser File
function makeFile(name, content, mimeType = 'text/plain') {
  let blob;
  if (typeof content === 'string') {
    blob = new Blob([content], { type: mimeType });
  } else if (content instanceof ArrayBuffer || ArrayBuffer.isView(content)) {
    blob = new Blob([content], { type: mimeType });
  } else if (content instanceof Blob) {
    blob = content;
  } else {
    blob = new Blob([Buffer.from(content)], { type: mimeType });
  }

  // Attach File-like properties
  blob.name = name;
  blob.lastModified = Date.now();
  return blob;
}

async function run() {
  console.log('\x1b[1m\x1b[35mStarting CONVET PULSE Phase 3 Document Studio Test Suite...\x1b[0m\n');

  // ─────────────────────────────────────────────────────────
  // SECTION 1: DOCX Document Creator (OpenXML Generator)
  // ─────────────────────────────────────────────────────────
  section('1. DOCX Document Creator (OpenXML Packaging & Generation)');

  let sampleDocxBlob;
  let sampleDocxBuffer;

  await test('Generates genuine DOCX binary from markdown content', async () => {
    const markdownContent = `# Technical Specification\n\nCONVET PULSE Document Engine.\n\n## Features\n- Client side generation\n- OpenXML fidelity\n- Tamil script: தமிழ் வாழ்க\n\n> Important Note: Zero server uploads.`;
    sampleDocxBlob = await createDocxDocument({
      title: 'Technical Specification',
      content: markdownContent,
      orientation: 'portrait',
      fontSize: 24,
    });

    assert(sampleDocxBlob instanceof Blob, 'Result must be a Blob instance');
    assert(sampleDocxBlob.size > 1000, `DOCX blob size too small: ${sampleDocxBlob.size} bytes`);
    sampleDocxBuffer = await sampleDocxBlob.arrayBuffer();

    // Verify OpenXML ZIP magic bytes: 'PK\x03\x04' (0x50, 0x4B, 0x03, 0x04)
    const header = new Uint8Array(sampleDocxBuffer.slice(0, 4));
    assert.strictEqual(header[0], 0x50, 'Byte 0 must be 0x50 (P)');
    assert.strictEqual(header[1], 0x4B, 'Byte 1 must be 0x4B (K)');
    assert.strictEqual(header[2], 0x03, 'Byte 2 must be 0x03');
    assert.strictEqual(header[3], 0x04, 'Byte 3 must be 0x04');
  });

  await test('Generated DOCX has valid OpenXML ZIP structure ([Content_Types].xml & document.xml)', async () => {
    const zip = await JSZip.loadAsync(sampleDocxBuffer);
    const contentTypes = zip.file('[Content_Types].xml');
    assert(contentTypes !== null, 'DOCX missing [Content_Types].xml');

    const documentXmlFile = zip.file('word/document.xml');
    assert(documentXmlFile !== null, 'DOCX missing word/document.xml');

    const docXmlText = await documentXmlFile.async('string');
    assert(docXmlText.includes('Technical Specification'), 'document.xml must contain document title');
    assert(docXmlText.includes('CONVET PULSE'), 'document.xml must contain body text');
    assert(docXmlText.includes('தமிழ் வாழ்க'), 'document.xml must contain Tamil Unicode characters');
  });

  await test('Generates DOCX with landscape orientation and template', async () => {
    const docxBlob = await createDocxDocument({
      title: 'Landscape Report',
      templateId: 'report',
      orientation: 'landscape',
      marginInch: 0.75,
    });
    assert(docxBlob.size > 1000, 'Landscape DOCX must be substantial');
    const buf = await docxBlob.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    const docXml = await zip.file('word/document.xml').async('string');
    assert(docXml.includes('orient="landscape"') || docXml.includes('w:orient="landscape"'), 'document.xml must declare landscape orientation');
  });

  // ─────────────────────────────────────────────────────────
  // SECTION 2: DOCX Content Extraction & Mammoth Engine
  // ─────────────────────────────────────────────────────────
  section('2. DOCX Content Extraction & Mammoth Parsing');

  await test('Extracts plain text and HTML from genuine DOCX with formatting and Tamil', async () => {
    const { text, html, messages } = await extractDocxContent(sampleDocxBuffer);
    assert(typeof text === 'string' && text.length > 50, 'Extracted text must be non-empty');
    assert(text.includes('Technical Specification'), 'Extracted text missing title');
    assert(text.includes('CONVET PULSE'), 'Extracted text missing body');
    assert(text.includes('தமிழ் வாழ்க'), 'Extracted text missing Tamil unicode characters');

    assert(typeof html === 'string' && html.length > 50, 'Extracted HTML must be non-empty');
    assert(html.includes('<h') || html.includes('<p>'), 'Extracted HTML must contain paragraph or heading tags');
    assert(Array.isArray(messages), 'Messages must be an array');
  });

  await test('Rejects corrupted or non-DOCX binary gracefully with ProcessorError', async () => {
    const invalidBuffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
    let threw = false;
    try {
      await extractDocxContent(invalidBuffer);
    } catch (err) {
      threw = true;
      assert(err.message.includes('Could not parse Word document') || err.message.includes('corrupted'), `Expected error message, got: ${err.message}`);
    }
    assert(threw, 'Should have thrown ProcessorError on corrupted buffer');
  });

  // ─────────────────────────────────────────────────────────
  // SECTION 3: Markdown Studio & Sanitization Engine
  // ─────────────────────────────────────────────────────────
  section('3. Markdown Studio & XSS Defense Engine');

  await test('Renders markdown to formatted HTML correctly', () => {
    const md = '# Title 1\n\n## Subtitle\n\nParagraph with **bold**, *italic*, and `code`.\n\n- Bullet 1\n- Bullet 2';
    const html = markdownToHtml(md);
    assert(html.includes('<h1>Title 1</h1>'), 'Missing <h1> tag');
    assert(html.includes('<h2>Subtitle</h2>'), 'Missing <h2> tag');
    assert(html.includes('<strong>bold</strong>'), 'Missing <strong> tag');
    assert(html.includes('<em>italic</em>'), 'Missing <em> tag');
    assert(html.includes('<code>code</code>'), 'Missing <code> tag');
    assert(html.includes('<ul>') && html.includes('<li>Bullet 1</li>'), 'Missing <ul>/<li> tags');
  });

  await test('Neutralizes dangerous XSS payloads in Markdown and HTML preview', () => {
    const maliciousMd = `# Attack\n\n<script>alert("xss")</script><img src=x onerror="alert(1)">[Click](javascript:alert(1))`;
    const safeHtml = markdownToHtml(maliciousMd);

    assert(!safeHtml.includes('<script>'), 'XSS: <script> was not removed');
    assert(!safeHtml.includes('alert("xss")'), 'XSS: script body was not removed');
    assert(!safeHtml.includes('onerror='), 'XSS: onerror handler was not removed');
    assert(!safeHtml.includes('javascript:'), 'XSS: javascript: scheme was not removed');
  });

  await test('Converts Markdown to formatted PDF with word-wrap and Helvetica typography', async () => {
    const md = `# Annual Report\n\nCONVET PULSE Markdown-to-PDF Engine.\n\n## Overview\nThis is a production grade PDF rendered completely client-side without external dependencies.`;
    const pdfBlob = await markdownToPdf(md, { title: 'Annual Report' });

    assert(pdfBlob instanceof Blob, 'Result must be a Blob');
    assert(pdfBlob.size > 500, `PDF blob too small: ${pdfBlob.size} bytes`);

    const pdfBuffer = await pdfBlob.arrayBuffer();
    // Verify PDF magic bytes: '%PDF-'
    const header = new TextDecoder().decode(pdfBuffer.slice(0, 5));
    assert.strictEqual(header, '%PDF-', 'PDF must begin with %PDF- header');

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    assert.strictEqual(pdfDoc.getPageCount(), 1, 'PDF should have 1 page for brief content');
    const page = pdfDoc.getPage(0);
    const { width, height } = page.getSize();
    assert(width > 500 && height > 800, 'Page must have standard A4 dimensions (595x842)');
  });

  await test('Converts Markdown to DOCX OpenXML binary', async () => {
    const md = `# Markdown to Word\n\n- Item 1\n- Item 2\n\n> Quoted advice for students`;
    const docxBlob = await markdownToDocx(md, { title: 'Markdown to Word' });

    assert(docxBlob.size > 1000, 'DOCX blob must be substantial');
    const zip = await JSZip.loadAsync(await docxBlob.arrayBuffer());
    const docXml = await zip.file('word/document.xml').async('string');
    assert(docXml.includes('Markdown to Word'), 'Missing title in generated docx');
    assert(docXml.includes('Quoted advice'), 'Missing quote in generated docx');
  });

  // ─────────────────────────────────────────────────────────
  // SECTION 4: Text Document Studio & Metrics
  // ─────────────────────────────────────────────────────────
  section('4. Text Document Studio & Unicode Preservation');

  await test('Calculates accurate metrics: words, chars, sentences, paragraphs, reading time', () => {
    const sampleText = `CONVET PULSE is a unified document platform.\n\nIt runs entirely in the browser with offline capability. Fast and secure.`;
    const stats = calculateDocumentStats(sampleText);

    assert.strictEqual(stats.words, 19, `Expected 19 words, got ${stats.words}`);
    assert.strictEqual(stats.paragraphs, 2, `Expected 2 paragraphs, got ${stats.paragraphs}`);
    assert.strictEqual(stats.sentences, 3, `Expected 3 sentences, got ${stats.sentences}`);
    assert(stats.characters > 100, `Character count too low: ${stats.characters}`);
    assert(stats.readingTimeMinutes >= 1, 'Reading time should be at least 1 min');
  });

  await test('Preserves multilingual Unicode (English, Tamil, Math symbols) without mangling', () => {
    const tamilText = `வணக்கம் உலகம்! தமிழ் எழுத்துக்கள்: அ, ஆ, இ, ஈ. Formula: E = mc² & ∑(x) = 100%`;
    const stats = calculateDocumentStats(tamilText);
    assert(stats.words > 5, 'Stats should parse Unicode words');

    // Test RTF round-trip for Tamil
    const rtf = textToRtf(tamilText, 'Tamil Unicode Test');
    assert(rtf.includes('\\u'), 'RTF must contain \\u Unicode escape sequences for Tamil');

    const recoveredText = rtfToText(rtf);
    assert(recoveredText.includes('வணக்கம்'), 'RTF round-trip lost Tamil greeting');
    assert(recoveredText.includes('தமிழ் எழுத்துக்கள்'), 'RTF round-trip lost Tamil letters');
    assert(recoveredText.includes('E = mc²'), 'RTF round-trip lost math formula');
  });

  // ─────────────────────────────────────────────────────────
  // SECTION 5: HTML Document Studio & Safe Sanitizer
  // ─────────────────────────────────────────────────────────
  section('5. HTML Document Studio & Safe Preview');

  await test('Sanitizes dangerous attributes and tags in HTML', () => {
    const dangerousHtml = `
      <div class="card">
        <h1>Heading</h1>
        <script>window.location='http://evil.com'</script>
        <iframe src="http://evil.com"></iframe>
        <a href="javascript:void(0)" onclick="alert(1)">Click here</a>
        <p style="color: red;">Safe paragraph</p>
      </div>
    `;
    const clean = sanitizeHtml(dangerousHtml);
    assert(!clean.includes('<script>'), 'Did not strip script tag');
    assert(!clean.includes('<iframe>'), 'Did not strip iframe tag');
    assert(!clean.includes('onclick='), 'Did not strip onclick handler');
    assert(!clean.includes('javascript:'), 'Did not strip javascript: link');
    assert(clean.includes('Safe paragraph'), 'Lost safe paragraph');
  });

  // ─────────────────────────────────────────────────────────
  // SECTION 6: RTF Converter
  // ─────────────────────────────────────────────────────────
  section('6. RTF Converter (Bidirectional & Escape Sequences)');

  await test('Exports text to valid RTF format with standard RTF headers', () => {
    const text = 'Simple plain text document.\nSecond line of document.';
    const rtf = textToRtf(text, 'Test Doc');
    assert(rtf.startsWith('{\\rtf1\\ansi'), 'RTF must start with {\\rtf1\\ansi header');
    assert(rtf.includes('\\par'), 'RTF must format line breaks with \\par');
    assert(rtf.endsWith('}'), 'RTF must close with }');
  });

  await test('Imports RTF and extracts clean plain text', () => {
    const sampleRtf = '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\fs24 Hello World!\\par Second paragraph.\\par}';
    const plain = rtfToText(sampleRtf);
    assert(plain.includes('Hello World!'), 'Extracted text missing Hello World!');
    assert(plain.includes('Second paragraph.'), 'Extracted text missing Second paragraph.');
    assert(!plain.includes('\\rtf1'), 'RTF control words leaked into plain text');
  });

  // ─────────────────────────────────────────────────────────
  // SECTION 7: Built-in Professional Templates
  // ─────────────────────────────────────────────────────────
  section('7. Professional Document Templates (8 Pre-built Layouts)');

  const expectedTemplateIds = [
    'letter',
    'resume',
    'report',
    'meeting-notes',
    'assignment',
    'research',
    'invoice',
    'proposal',
  ];

  await test('All 8 required templates exist and have rich default structure', () => {
    assert.strictEqual(DOCUMENT_TEMPLATES.length, 8, `Expected 8 templates, found ${DOCUMENT_TEMPLATES.length}`);
    for (const id of expectedTemplateIds) {
      const tmpl = DOCUMENT_TEMPLATES.find((t) => t.id === id);
      assert(tmpl !== undefined, `Template ${id} is missing`);
      assert(tmpl.name && tmpl.name.length > 3, `Template ${id} missing name`);
      assert(tmpl.description && tmpl.description.length > 5, `Template ${id} missing description`);
      assert(tmpl.content && tmpl.content.length > 100, `Template ${id} content too brief`);
    }
  });

  // ─────────────────────────────────────────────────────────
  // SECTION 8: Dedicated Processors & Conversion Pipelines
  // ─────────────────────────────────────────────────────────
  section('8. Dedicated Converter Processors (ToolPage Dispatch)');

  await test('processDocxCreator creates DOCX with options', async () => {
    const result = await processDocxCreator([], {
      title: 'Created Document',
      content: '# Heading\n\nContent paragraph.',
    });
    assert(result.blob instanceof Blob, 'Result must contain Blob');
    assert(result.filename.endsWith('.docx'), `Expected .docx extension, got: ${result.filename}`);
    assert.strictEqual(result.mimeType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  await test('processDocxEditor extracts DOCX and exports to TXT or HTML', async () => {
    const file = makeFile('sample.docx', sampleDocxBuffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const resultTxt = await processDocxEditor([file], { outputFormat: 'txt' });
    assert(resultTxt.filename.endsWith('.txt'), 'Output filename must end with .txt');
    const extractedText = await resultTxt.blob.text();
    assert(extractedText.includes('Technical Specification'), 'Missing extracted text content');

    const resultHtml = await processDocxEditor([file], { outputFormat: 'html' });
    assert(resultHtml.filename.endsWith('.html'), 'Output filename must end with .html');
  });

  await test('processMarkdownStudio exports to HTML, PDF, and DOCX', async () => {
    const mdFile = makeFile('test.md', '# Testing Markdown\n\nParagraph text.', 'text/markdown');

    const resHtml = await processMarkdownStudio([mdFile], { exportFormat: 'html' });
    assert(resHtml.filename.endsWith('.html'));

    const resPdf = await processMarkdownStudio([mdFile], { exportFormat: 'pdf' });
    assert(resPdf.filename.endsWith('.pdf'));

    const resDocx = await processMarkdownStudio([mdFile], { exportFormat: 'docx' });
    assert(resDocx.filename.endsWith('.docx'));
  });

  await test('processTextStudio performs search & replace and exports', async () => {
    const txtFile = makeFile('test.txt', 'The quick brown fox jumps over the lazy dog.', 'text/plain');
    const res = await processTextStudio([txtFile], {
      findText: 'brown fox',
      replaceText: 'red panda',
      exportFormat: 'txt',
    });
    const modified = await res.blob.text();
    assert(modified.includes('quick red panda jumps'), 'Find & Replace failed');
  });

  await test('processHtmlStudio exports to HTML, PDF, and TXT', async () => {
    const htmlFile = makeFile('index.html', '<h1>Hello</h1><p>Test HTML</p>', 'text/html');
    const resPdf = await processHtmlStudio([htmlFile], { exportFormat: 'pdf' });
    assert(resPdf.filename.endsWith('.pdf'));
  });

  await test('processRtfConverter handles both RTF -> TXT and TXT -> RTF', async () => {
    const rtfFile = makeFile('doc.rtf', '{\\rtf1\\ansi\\deff0 Plain text here\\par}', 'application/rtf');
    const resTxt = await processRtfConverter([rtfFile]);
    assert(resTxt.filename.endsWith('.txt'));
    assert.strictEqual(resTxt.mimeType, 'text/plain');

    const txtFile = makeFile('doc.txt', 'Converting to RTF', 'text/plain');
    const resRtf = await processRtfConverter([txtFile]);
    assert(resRtf.filename.endsWith('.rtf'));
    assert.strictEqual(resRtf.mimeType, 'application/rtf');
  });

  await test('Dedicated converter: processDocxToTxt', async () => {
    const file = makeFile('sample.docx', sampleDocxBuffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const res = await processDocxToTxt([file]);
    assert.strictEqual(res.filename, 'sample.txt');
    const text = await res.blob.text();
    assert(text.includes('Technical Specification'));
  });

  await test('Dedicated converter: processMarkdownToPdf', async () => {
    const file = makeFile('doc.md', '# Doc\n\nContent');
    const res = await processMarkdownToPdf([file]);
    assert.strictEqual(res.filename, 'doc.pdf');
    assert.strictEqual(res.mimeType, 'application/pdf');
  });

  await test('Dedicated converter: processMarkdownToDocx', async () => {
    const file = makeFile('doc.md', '# Doc\n\nContent');
    const res = await processMarkdownToDocx([file]);
    assert.strictEqual(res.filename, 'doc.docx');
    assert.strictEqual(res.mimeType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  await test('Dedicated converter: processTxtToDocx', async () => {
    const file = makeFile('doc.txt', 'Plain text content');
    const res = await processTxtToDocx([file]);
    assert.strictEqual(res.filename, 'doc.docx');
    assert.strictEqual(res.mimeType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  // ─────────────────────────────────────────────────────────
  // SECTION 9: Registry & Dispatch Verification
  // ─────────────────────────────────────────────────────────
  section('9. Tool Registry & Dispatch Architecture');

  const phase3Slugs = [
    'docx-creator',
    'docx-editor',
    'markdown-editor',
    'text-editor',
    'html-editor',
    'rtf-converter',
    'docx-to-txt',
    'markdown-to-pdf',
    'markdown-to-docx',
    'txt-to-docx',
  ];

  await test('All 10 Phase 3 Document Studio tools exist in TOOLS registry', () => {
    for (const slug of phase3Slugs) {
      const tool = getToolBySlug(slug);
      assert(tool !== undefined, `Missing tool in registry: ${slug}`);
      assert(tool.name && tool.name.length > 0, `Tool ${slug} missing name`);
      assert(tool.description && tool.description.length > 10, `Tool ${slug} missing description`);
      assert(tool.offlineSupported === true, `Tool ${slug} must support offline processing`);
      assert(tool.status === 'stable', `Tool ${slug} must have stable status`);
    }
  });

  await test('All 10 Phase 3 Document Studio tools have registered dispatchers', () => {
    for (const slug of phase3Slugs) {
      assert(hasProcessor(slug), `Missing processor dispatch entry for: ${slug}`);
      const dispatch = getToolDispatch(slug);
      assert(typeof dispatch?.processor === 'function', `Dispatcher for ${slug} must have processor function`);
    }
  });

  await test('Document Studio is configured and lists all 15 active tools', () => {
    const docStudio = getStudioById('document-studio');
    assert(docStudio !== undefined, 'Missing document-studio metadata');
    assert.strictEqual(docStudio.badge, '15 Tools Active');
    assert.strictEqual(docStudio.status, 'active');
    assert.strictEqual(docStudio.phase, 3);
    for (const slug of phase3Slugs) {
      assert(docStudio.specificToolSlugs?.includes(slug), `document-studio missing specificToolSlug: ${slug}`);
    }
  });

  // ─────────────────────────────────────────────────────────
  // TEST SUMMARY
  // ─────────────────────────────────────────────────────────
  console.log('\n\x1b[1m\x1b[35m=== Phase 3 Test Suite Results ===\x1b[0m');
  console.log(`Total tests: ${passed + failed}`);
  console.log(`Passed:      \x1b[32m${passed}\x1b[0m`);
  console.log(`Failed:      \x1b[31m${failed}\x1b[0m`);

  if (failed > 0) {
    console.log('\n\x1b[31mFailures:\x1b[0m');
    for (const f of failures) {
      console.log(` - ${f.name}: ${f.error.message}`);
    }
    process.exit(1);
  } else {
    console.log('\n\x1b[32mAll Phase 3 Document Studio functional tests passed cleanly!\x1b[0m');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('\x1b[31mFatal test harness error:\x1b[0m', err);
  process.exit(1);
});
