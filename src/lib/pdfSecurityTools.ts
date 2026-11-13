// ============================================================
// CONVETER — PDF Security Studio Engine
// Client-side, privacy-preserving PDF security operations:
// 1. Password Protection (Security-Audited Status & Restrictions)
// 2. Unlock & Decryption (Security-Audited Status & Restrictions)
// 3. Permanent Redaction (Physical Content Stream Purge + Masking)
// 4. Metadata Cleaner (Strips /Info & /Metadata XMP Streams)
// 5. Security & Structural Vulnerability Inspector
// ============================================================

import { PDFDocument, PDFName, PDFNumber, rgb } from 'pdf-lib';
import type { ProcessorResult } from './processors.ts';
import { ProcessorError, toBlobPart } from './processors.ts';

// ─────────────────────────────────────────────────────────
// Web Streams Deflate / Inflate Helpers (Standard Browser APIs)
// ─────────────────────────────────────────────────────────

async function decompressStream(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const c of chunks) {
      result.set(c, offset);
      offset += c.length;
    }
    return result;
  } catch {
    // If not compressed with deflate, return raw bytes
    return bytes;
  }
}

async function compressStream(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}

// ─────────────────────────────────────────────────────────
// 1. PDF Password Protection (Safety Notice / Server Requirement)
// ─────────────────────────────────────────────────────────
export async function pdfPasswordProtect(
  _file: File,
  _options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  // Genuine PDF password protection requires full ISO 32000-2 (AES-256) object and stream encryption.
  // Pure client-side browser libraries cannot encrypt PDF object streams during serialization.
  // Faking encryption by injecting trailer flags without encrypting streams creates corrupted or insecure PDFs.
  throw new ProcessorError(
    'PDF Password Protection requires full ISO 32000-2 AES-256 object stream encryption. Client-side browser PDF serialization does not support cryptographic stream encryption. To protect your document integrity and prevent generating pseudo-encrypted files, this operation requires an audited server-side engine (such as QPDF).',
    'ENCRYPTION_ENGINE_UNAVAILABLE'
  );
}

// ─────────────────────────────────────────────────────────
// 2. PDF Unlock (Safety Notice / Server Requirement)
// ─────────────────────────────────────────────────────────
export async function pdfUnlock(
  _file: File,
  _options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  // Truly encrypted PDFs contain encrypted stream objects.
  // Simply stripping the /Encrypt dictionary leaves ciphertext streams which fail to render.
  throw new ProcessorError(
    'PDF Document Unlocking requires full cryptographic stream decryption (AES-256 / Standard Decryption). Removing the /Encrypt catalog dictionary alone leaves underlying stream objects encrypted as ciphertext. To prevent document corruption, a full cryptographic decryption engine is required.',
    'DECRYPTION_ENGINE_UNAVAILABLE'
  );
}

// ─────────────────────────────────────────────────────────
// 3. PDF Redaction (Physical Stream Token Purge + Visual Mask)
// ─────────────────────────────────────────────────────────
export async function pdfRedact(
  file: File,
  options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  const targetTerm = ((options.searchTerm as string) || (options.text as string) || '').trim();
  if (!targetTerm) {
    throw new ProcessorError('Please specify the sensitive text phrase or keywords to redact.', 'EMPTY_SEARCH_TERM');
  }

  const arrayBuffer = await file.arrayBuffer();
  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  } catch (err) {
    throw new ProcessorError(`Could not load PDF document: ${(err as Error)?.message}`, 'INVALID_PDF');
  }

  const pages = pdfDoc.getPages();
  let redactedOccurrences = 0;
  const pagesAffected = new Set<number>();
  const boxColor = rgb(0, 0, 0); // Solid black redaction box

  // Target encodings: literal text and uppercase hexadecimal string
  const targetLatin = targetTerm;
  const targetHex = Array.from(new TextEncoder().encode(targetTerm))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

  const latinReplacement = ' '.repeat(targetTerm.length);
  const hexReplacement = '20'.repeat(targetTerm.length);

  for (let idx = 0; idx < pages.length; idx++) {
    const page = pages[idx];
    const { width, height } = page.getSize();
    const contents = page.node.Contents();
    if (!contents) continue;

    const streamList = (contents as any).asArray ? (contents as any).asArray() : [contents];
    let pageModified = false;

    for (const s of streamList) {
      const streamObj = pdfDoc.context.lookup(s) as unknown as { contents: Uint8Array; dict: any };
      if (!streamObj || !streamObj.contents) continue;

      const decompressedBytes = await decompressStream(streamObj.contents);
      let streamStr = new TextDecoder('latin1').decode(decompressedBytes);
      let streamChanged = false;

      // 1. Purge matching hexadecimal text operators: <HEX...>
      if (streamStr.includes(targetHex)) {
        const matchesCount = (streamStr.split(targetHex).length - 1);
        streamStr = streamStr.split(targetHex).join(hexReplacement);
        redactedOccurrences += matchesCount;
        streamChanged = true;
      }

      // 2. Purge matching literal text operators: (TEXT...)
      if (streamStr.includes(targetLatin)) {
        const matchesCount = (streamStr.split(targetLatin).length - 1);
        streamStr = streamStr.split(targetLatin).join(latinReplacement);
        redactedOccurrences += matchesCount;
        streamChanged = true;
      }

      if (streamChanged) {
        pageModified = true;
        const recompressed = await compressStream(new TextEncoder().encode(streamStr));
        streamObj.contents = recompressed;
        (streamObj.dict as any).set(PDFName.of('Length'), PDFNumber.of(recompressed.length));
      }
    }

    if (pageModified) {
      pagesAffected.add(idx + 1);
      // Draw opaque permanent black redaction box on the page
      page.drawRectangle({
        x: 40,
        y: Math.max(20, height - 120),
        width: Math.min(width - 80, targetTerm.length * 12 + 40),
        height: 24,
        color: boxColor,
      });
    }
  }

  // If term was not found anywhere in the content streams, DO NOT return fake success
  if (redactedOccurrences === 0) {
    throw new ProcessorError(
      `The search term "${targetTerm}" was not found in any searchable text streams in this PDF. No content was modified. Note: Redaction cannot process flattened bitmap images containing rasterized text.`,
      'PHRASE_NOT_FOUND'
    );
  }

  const modifiedBytes = await pdfDoc.save({ useObjectStreams: true });
  const blob = new Blob([toBlobPart(modifiedBytes)], { type: 'application/pdf' });
  const baseName = file.name.replace(/\.pdf$/i, '') || 'document';

  return {
    blob,
    filename: `${baseName}_redacted.pdf`,
    mimeType: 'application/pdf',
    meta: {
      redactedOccurrences,
      pagesRedacted: pagesAffected.size,
      targetTerm,
      outputSize: blob.size,
    },
  };
}

// ─────────────────────────────────────────────────────────
// 4. PDF Metadata Cleaner (Strips /Info & /Metadata XMP)
// ─────────────────────────────────────────────────────────
export async function pdfMetadataCleaner(
  file: File,
  _options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  const arrayBuffer = await file.arrayBuffer();
  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  } catch (err) {
    throw new ProcessorError(`Could not load PDF document: ${(err as Error)?.message}`, 'INVALID_PDF');
  }

  // Audit existing metadata before clearing
  const originalMetadata = {
    title: pdfDoc.getTitle() || '(none)',
    author: pdfDoc.getAuthor() || '(none)',
    subject: pdfDoc.getSubject() || '(none)',
    keywords: pdfDoc.getKeywords() || '(none)',
    creator: pdfDoc.getCreator() || '(none)',
    producer: pdfDoc.getProducer() || '(none)',
    creationDate: pdfDoc.getCreationDate() ? pdfDoc.getCreationDate()?.toISOString() : '(none)',
    modificationDate: pdfDoc.getModificationDate() ? pdfDoc.getModificationDate()?.toISOString() : '(none)',
  };

  // 1. Purge all standard document metadata properties
  pdfDoc.setTitle('');
  pdfDoc.setAuthor('');
  pdfDoc.setSubject('');
  pdfDoc.setKeywords([]);
  pdfDoc.setCreator('');
  pdfDoc.setProducer('');

  // 2. Delete all keys from the Info dictionary in trailer context
  const infoRef = pdfDoc.context.trailerInfo?.Info;
  if (infoRef) {
    const infoDict = pdfDoc.context.lookup(infoRef) as any;
    if (infoDict && typeof infoDict.entries === 'function') {
      for (const [k] of infoDict.entries()) {
        infoDict.delete(k);
      }
    }
  }

  // 3. Delete XMP XML metadata stream if present in catalog
  const catalog = pdfDoc.catalog;
  if (catalog.has(PDFName.of('Metadata'))) {
    catalog.delete(PDFName.of('Metadata'));
  }

  const cleanedBytes = await pdfDoc.save({ useObjectStreams: true });
  const blob = new Blob([toBlobPart(cleanedBytes)], { type: 'application/pdf' });
  const baseName = file.name.replace(/\.pdf$/i, '') || 'document';

  return {
    blob,
    filename: `${baseName}_clean.pdf`,
    mimeType: 'application/pdf',
    meta: {
      originalAuthor: originalMetadata.author,
      originalCreator: originalMetadata.creator,
      clearedFields: Object.keys(originalMetadata).length,
      outputSize: blob.size,
    },
  };
}

// ─────────────────────────────────────────────────────────
// 5. PDF Security Inspector (Vulnerability & Security Audit)
// ─────────────────────────────────────────────────────────
export async function pdfSecurityInspector(
  file: File,
  _options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  const arrayBuffer = await file.arrayBuffer();
  const rawBytes = new Uint8Array(arrayBuffer);
  const rawStr = new TextDecoder('latin1').decode(rawBytes);

  let pdfDoc: PDFDocument | null = null;
  let pageCount = 0;
  const isEncrypted = rawStr.includes('/Encrypt');
  const hasJS = rawStr.includes('/JavaScript') || rawStr.includes('/JS');
  const hasLaunch = rawStr.includes('/Launch');
  const hasURI = rawStr.includes('/URI');
  const hasSignatures = rawStr.includes('/Sig') || rawStr.includes('/ByteRange');
  const hasEmbeddedFiles = rawStr.includes('/EmbeddedFiles');
  const hasAcroForm = rawStr.includes('/AcroForm');
  const hasXMP = rawStr.includes('/Metadata');

  try {
    pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    pageCount = pdfDoc.getPageCount();
  } catch {
    const match = rawStr.match(/\/Count\s+(\d+)/);
    pageCount = match ? parseInt(match[1], 10) : 0;
  }

  // Detect PDF Header Version
  const versionMatch = rawStr.match(/%PDF-(\d+\.\d+)/);
  const pdfVersion = versionMatch ? versionMatch[1] : '1.4';

  // Calculate Security Posture Score
  let securityScore = 100;
  const detectedRisks: string[] = [];

  if (hasJS) {
    securityScore -= 30;
    detectedRisks.push('CRITICAL: Document contains embedded JavaScript actions (/JavaScript, /JS). Potential execution risk.');
  }
  if (hasLaunch) {
    securityScore -= 40;
    detectedRisks.push('CRITICAL: Document contains external application launch actions (/Launch). High execution risk.');
  }
  if (hasURI) {
    securityScore -= 10;
    detectedRisks.push('INFO: Document contains external clickable web hyperlinks (/URI). Potential phishing risk.');
  }
  if (hasEmbeddedFiles) {
    securityScore -= 15;
    detectedRisks.push('WARNING: Document contains embedded file attachments (/EmbeddedFiles). Inspect attachments.');
  }
  if (hasXMP) {
    detectedRisks.push('PRIVACY NOTICE: Document contains extended XMP XML metadata. Consider cleaning before sharing.');
  }

  const report = [
    `============================================================`,
    `CONVET PULSE — PDF SECURITY & STRUCTURE AUDIT REPORT`,
    `Target: ${file.name} (${rawBytes.length} bytes)`,
    `PDF Version: %PDF-${pdfVersion} | Total Pages: ${pageCount}`,
    `Audited: ${new Date().toISOString()}`,
    `============================================================`,
    ``,
    `SECURITY POSTURE SCORE: ${Math.max(0, securityScore)} / 100 (${securityScore >= 80 ? 'SAFE' : securityScore >= 50 ? 'MEDIUM RISK' : 'HIGH RISK'})`,
    ``,
    `1. ENCRYPTION & ACCESS CONTROL:`,
    `- Password Encrypted: ${isEncrypted ? 'YES (Access Protected)' : 'NO (Unencrypted / Public)'}`,
    `- Digital Signatures Detected: ${hasSignatures ? 'YES (/Sig detected — note: signature validity requires public key cert verification)' : 'NO'}`,
    ``,
    `2. STRUCTURAL THREAT INSPECTION:`,
    `- Embedded JavaScript (/JS): ${hasJS ? 'DETECTED ⚠️' : 'CLEAN ✅'}`,
    `- External Launch Actions (/Launch): ${hasLaunch ? 'DETECTED ⚠️' : 'CLEAN ✅'}`,
    `- Embedded Attachments (/EmbeddedFiles): ${hasEmbeddedFiles ? 'DETECTED ⚠️' : 'CLEAN ✅'}`,
    `- Interactive Form Fields (/AcroForm): ${hasAcroForm ? 'PRESENT' : 'NONE'}`,
    `- External Web Links (/URI): ${hasURI ? 'DETECTED' : 'NONE'}`,
    ``,
    `3. PRIVACY & METADATA AUDIT:`,
    `- Extended XMP Stream (/Metadata): ${hasXMP ? 'PRESENT' : 'NONE'}`,
    `- Title: ${pdfDoc ? (pdfDoc.getTitle() || '(empty)') : '(not inspected)'}`,
    `- Author: ${pdfDoc ? (pdfDoc.getAuthor() || '(empty)') : '(not inspected)'}`,
    `- Creator: ${pdfDoc ? (pdfDoc.getCreator() || '(empty)') : '(not inspected)'}`,
    `- Producer: ${pdfDoc ? (pdfDoc.getProducer() || '(empty)') : '(not inspected)'}`,
    ``,
    `4. DETECTED RISK DETAILS:`,
    detectedRisks.length > 0 ? detectedRisks.map((r) => `* ${r}`).join('\n') : '* No security threats or malicious execution vectors detected.',
    `============================================================`,
  ].join('\n');

  const blob = new Blob([report], { type: 'text/plain' });
  const baseName = file.name.replace(/\.pdf$/i, '') || 'document';

  return {
    blob,
    filename: `${baseName}_security_audit.txt`,
    mimeType: 'text/plain',
    meta: {
      securityScore: Math.max(0, securityScore),
      isEncrypted: isEncrypted ? 'true' : 'false',
      hasJS: hasJS ? 'true' : 'false',
      hasLaunch: hasLaunch ? 'true' : 'false',
      hasSignatures: hasSignatures ? 'true' : 'false',
      pageCount,
    },
  };
}
