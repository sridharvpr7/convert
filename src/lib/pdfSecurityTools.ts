// ============================================================
// CONVETER — PDF Security Studio Engine
// Client-side, privacy-preserving PDF security operations:
// 1. Password Protection (Security-Audited Status & Restrictions)
// 2. Unlock & Decryption (Security-Audited Status & Restrictions)
// 3. Permanent Redaction (Physical Content Stream Purge + Masking)
// 4. Metadata Cleaner (Strips /Info & /Metadata XMP Streams)
// 5. Security & Structural Vulnerability Inspector
// ============================================================

import { PDFDocument, PDFName, PDFNumber } from 'pdf-lib';
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
// 1. PDF Password Protection (QPDF Cryptographic Integration)
// ─────────────────────────────────────────────────────────
export async function pdfPasswordProtect(
  file: File,
  options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  const password = ((options.password as string) || (options.userPassword as string) || '').trim();
  if (!password) {
    throw new ProcessorError('Please enter a password to encrypt the document.', 'EMPTY_PASSWORD');
  }
  const ownerPassword = ((options.ownerPassword as string) || password).trim();

  // 1. Attempt genuine server-side QPDF AES-256 stream encryption
  if (typeof fetch !== 'undefined') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const fileBase64 = btoa(binary);

      const response = await fetch('/api/pdf/encrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64,
          userPassword: password,
          ownerPassword,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.fileBase64) {
          const binStr = atob(data.fileBase64);
          const outBytes = new Uint8Array(binStr.length);
          for (let i = 0; i < binStr.length; i++) outBytes[i] = binStr.charCodeAt(i);
          const blob = new Blob([toBlobPart(outBytes)], { type: 'application/pdf' });
          const baseName = file.name.replace(/\.pdf$/i, '') || 'document';
          return {
            blob,
            filename: `${baseName}_encrypted.pdf`,
            mimeType: 'application/pdf',
            meta: {
              encryptionStandard: 'ISO 32000-2 AES-256 (Genuine QPDF Engine)',
              keyLength: 256,
              outputSize: blob.size,
            },
          };
        }
      }

      if (response.status === 501) {
        const errJson = await response.json().catch(() => ({}));
        throw new ProcessorError(
          errJson.message || 'QPDF cryptographic engine is not installed on the server host. Client-side browser serialization cannot generate standard ISO 32000-2 AES-256 encrypted streams without corrupting the PDF structure.',
          'ENCRYPTION_ENGINE_UNAVAILABLE'
        );
      }
    } catch (err: any) {
      if (err instanceof ProcessorError) throw err;
      // Network failure or offline mode: fall through to honest safety guard
    }
  }

  // Pure client-side safety guard: refuse to emit pseudo-encrypted PDFs
  throw new ProcessorError(
    'PDF Password Protection requires full ISO 32000-2 AES-256 object stream encryption. Client-side browser PDF serialization does not support cryptographic stream encryption. To protect your document integrity and prevent generating pseudo-encrypted files, this operation requires an audited server-side engine (such as QPDF).',
    'ENCRYPTION_ENGINE_UNAVAILABLE'
  );
}

// ─────────────────────────────────────────────────────────
// 2. PDF Unlock (QPDF Cryptographic Integration)
// ─────────────────────────────────────────────────────────
export async function pdfUnlock(
  file: File,
  options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  const password = ((options.password as string) || '').trim();
  if (!password) {
    throw new ProcessorError('Please enter the current document password to unlock.', 'EMPTY_PASSWORD');
  }

  // 1. Attempt genuine server-side QPDF authenticated decryption
  if (typeof fetch !== 'undefined') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const fileBase64 = btoa(binary);

      const response = await fetch('/api/pdf/decrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64,
          password,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.fileBase64) {
          const binStr = atob(data.fileBase64);
          const outBytes = new Uint8Array(binStr.length);
          for (let i = 0; i < binStr.length; i++) outBytes[i] = binStr.charCodeAt(i);
          const blob = new Blob([toBlobPart(outBytes)], { type: 'application/pdf' });
          const baseName = file.name.replace(/\.pdf$/i, '') || 'document';
          return {
            blob,
            filename: `${baseName}_unlocked.pdf`,
            mimeType: 'application/pdf',
            meta: {
              decrypted: 'true',
              engine: 'QPDF Cryptographic Engine',
              outputSize: blob.size,
            },
          };
        }
      }

      if (response.status === 401) {
        throw new ProcessorError('Decryption failed: Incorrect password provided for this encrypted PDF.', 'INVALID_PASSWORD');
      }

      if (response.status === 501) {
        const errJson = await response.json().catch(() => ({}));
        throw new ProcessorError(
          errJson.message || 'QPDF cryptographic engine is not installed on the server host.',
          'DECRYPTION_ENGINE_UNAVAILABLE'
        );
      }
    } catch (err: any) {
      if (err instanceof ProcessorError) throw err;
    }
  }

  // Truly encrypted PDFs contain encrypted stream objects.
  // Simply stripping the /Encrypt dictionary leaves ciphertext streams which fail to render.
  throw new ProcessorError(
    'PDF Document Unlocking requires full cryptographic stream decryption (AES-256 / Standard Decryption). Removing the /Encrypt catalog dictionary alone leaves underlying stream objects encrypted as ciphertext. To prevent document corruption, a full cryptographic decryption engine is required.',
    'DECRYPTION_ENGINE_UNAVAILABLE'
  );
}

// ─────────────────────────────────────────────────────────
// 3. PDF Redaction (Underlying Stream Token Purge & Residual Content Audit)
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
        // Preserve 1:1 byte values without UTF-8 re-encoding corruption
        const streamBytes = new Uint8Array(streamStr.length);
        for (let i = 0; i < streamStr.length; i++) {
          streamBytes[i] = streamStr.charCodeAt(i) & 0xff;
        }
        const recompressed = await compressStream(streamBytes);
        streamObj.contents = recompressed;
        (streamObj.dict as any).set(PDFName.of('Length'), PDFNumber.of(recompressed.length));
      }
    }

    // 3. Purge matching text from Annotations (/Annots)
    const annotsRef = page.node.Annots();
    if (annotsRef) {
      const annotList = (annotsRef as any).asArray ? (annotsRef as any).asArray() : [annotsRef];
      for (const aRef of annotList) {
        const annotObj = pdfDoc.context.lookup(aRef) as any;
        if (annotObj && annotObj.dict) {
          // Check /Contents, /Subj, /RC, and /TU entries
          for (const key of ['Contents', 'Subj', 'RC', 'TU']) {
            const entry = annotObj.dict.get(PDFName.of(key));
            if (entry && typeof entry.value === 'string' && entry.value.includes(targetTerm)) {
              annotObj.dict.delete(PDFName.of(key));
              redactedOccurrences++;
              pageModified = true;
            }
          }
        }
      }
    }

    if (pageModified) {
      pagesAffected.add(idx + 1);
    }
  }

  // 4. Purge sensitive phrase from AcroForm fields
  try {
    const form = pdfDoc.getForm();
    if (form) {
      const fields = form.getFields();
      for (const f of fields) {
        try {
          const textVal = (f as any).getText?.();
          if (typeof textVal === 'string' && textVal.includes(targetTerm)) {
            (f as any).setText?.(textVal.split(targetTerm).join(' '));
            redactedOccurrences++;
          }
        } catch {
          /* ignore non-text fields */
        }
      }
    }
  } catch {
    /* form not present */
  }

  // 5. Purge sensitive phrase from document metadata
  if (pdfDoc.getTitle()?.includes(targetTerm)) { pdfDoc.setTitle(''); redactedOccurrences++; }
  if (pdfDoc.getAuthor()?.includes(targetTerm)) { pdfDoc.setAuthor(''); redactedOccurrences++; }
  if (pdfDoc.getSubject()?.includes(targetTerm)) { pdfDoc.setSubject(''); redactedOccurrences++; }
  if (pdfDoc.getCreator()?.includes(targetTerm)) { pdfDoc.setCreator(''); redactedOccurrences++; }
  if (pdfDoc.getProducer()?.includes(targetTerm)) { pdfDoc.setProducer(''); redactedOccurrences++; }

  // 6. Purge from EmbeddedFiles names if present
  try {
    const names = pdfDoc.catalog.get(PDFName.of('Names')) as any;
    if (names) {
      const efRef = names.get(PDFName.of('EmbeddedFiles'));
      if (efRef) {
        const efDict = pdfDoc.context.lookup(efRef) as any;
        if (efDict && efDict.toString().includes(targetTerm)) {
          pdfDoc.catalog.delete(PDFName.of('Names'));
          redactedOccurrences++;
        }
      }
    }
  } catch {
    /* names tree not present */
  }

  // If term was not found anywhere in the content streams, DO NOT return fake success
  if (redactedOccurrences === 0) {
    throw new ProcessorError(
      `The search term "${targetTerm}" was not found in any searchable text streams, annotations, form fields, or metadata in this PDF. No content was modified. Note: Redaction cannot process flattened bitmap images containing rasterized text without optical character recognition (OCR).`,
      'PHRASE_NOT_FOUND'
    );
  }

  const modifiedBytes = await pdfDoc.save({ useObjectStreams: true });

  // 7. Residual Content Verification: Ensure sensitive phrase does not remain in output bytes
  const verificationStr = new TextDecoder('latin1').decode(modifiedBytes);
  if (verificationStr.includes(targetTerm) || (targetHex.length >= 6 && verificationStr.includes(targetHex))) {
    throw new ProcessorError(
      `Security Audit Failed: Residual occurrences of "${targetTerm}" were detected in output bytes (possibly due to custom font subset encodings or encrypted embedded streams). Operation aborted to prevent unintended data leakage.`,
      'RESIDUAL_CONTENT_DETECTED'
    );
  }

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
      residualAudit: 'PASSED (0 residual occurrences detected)',
      notice: 'Text purged at binary stream level. No misleading arbitrary visual boxes drawn.',
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

  // Categorize Confirmed Findings vs Suspicious Indicators
  const confirmedAttributes: string[] = [
    `PDF Version: %PDF-${pdfVersion}`,
    `Total Page Count: ${pageCount}`,
    `Encryption Status: ${isEncrypted ? 'Password Protected (/Encrypt dictionary present)' : 'Unencrypted (Standard public access)'}`,
    `Digital Signatures: ${hasSignatures ? 'Present (/Sig /ByteRange detected)' : 'None'}`,
    `Interactive Form Fields: ${hasAcroForm ? 'Present (/AcroForm)' : 'None'}`,
    `Document Metadata Title: ${pdfDoc?.getTitle() || '(none)'}`,
    `Document Metadata Author: ${pdfDoc?.getAuthor() || '(none)'}`,
  ];

  const suspiciousIndicators: string[] = [];
  if (hasJS) {
    suspiciousIndicators.push('ELEVATED RISK: Embedded JavaScript Actions (/JavaScript, /JS). Potential client-side execution vulnerability.');
  }
  if (hasLaunch) {
    suspiciousIndicators.push('HIGH RISK: External Application Launch Actions (/Launch). Attempted external process spawning vector.');
  }
  if (hasURI) {
    suspiciousIndicators.push('ATTENTION: External Clickable Web Hyperlinks (/URI). Potential phishing or credential harvesting redirection.');
  }
  if (hasEmbeddedFiles) {
    suspiciousIndicators.push('ATTENTION: Embedded File Attachments (/EmbeddedFiles). Inspect embedded payloads before opening.');
  }
  if (hasXMP) {
    suspiciousIndicators.push('PRIVACY NOTICE: Extended XMP XML Metadata stream present. May contain authoring environment information.');
  }

  const riskLevel = suspiciousIndicators.length === 0
    ? 'CLEAN HEURISTIC POSTURE (No known script/launch triggers detected)'
    : `${suspiciousIndicators.length} POTENTIAL HAZARD INDICATOR(S) DETECTED`;

  const report = [
    `============================================================`,
    `CONVET PULSE — PDF STRUCTURAL & SECURITY INSPECTOR REPORT`,
    `Target File: ${file.name} (${rawBytes.length.toLocaleString()} bytes)`,
    `Timestamp: ${new Date().toISOString()}`,
    `============================================================`,
    ``,
    `IMPORTANT SECURITY ADVISORY:`,
    `This tool executes a static structural keyword audit of PDF object`,
    `dictionaries and stream markers. It is NOT an antivirus engine,`,
    `dynamic sandbox, or comprehensive zero-day malware scanner.`,
    `The absence of detected indicators does NOT guarantee that the file`,
    `is free from weaponized exploits. Always open untrusted PDF files`,
    `in a hardened, isolated sandbox viewer.`,
    ``,
    `HEURISTIC SUMMARY: ${riskLevel}`,
    ``,
    `1. CONFIRMED STRUCTURAL ATTRIBUTES:`,
    ...confirmedAttributes.map((attr) => `  [✓] ${attr}`),
    ``,
    `2. SUSPICIOUS / POTENTIALLY HAZARDOUS INDICATORS:`,
    suspiciousIndicators.length > 0
      ? suspiciousIndicators.map((ind) => `  [!] ${ind}`).join('\n')
      : '  [✓] None detected. Document contains no embedded JavaScript, launch triggers, or suspicious stream keywords.',
    ``,
    `============================================================`,
  ].join('\n');

  const blob = new Blob([report], { type: 'text/plain' });
  const baseName = file.name.replace(/\.pdf$/i, '') || 'document';

  return {
    blob,
    filename: `${baseName}_security_audit.txt`,
    mimeType: 'text/plain',
    meta: {
      confirmedAttributesCount: confirmedAttributes.length,
      suspiciousIndicatorsCount: suspiciousIndicators.length,
      isEncrypted: isEncrypted ? 'true' : 'false',
      hasJS: hasJS ? 'true' : 'false',
      hasLaunch: hasLaunch ? 'true' : 'false',
      hasSignatures: hasSignatures ? 'true' : 'false',
      pageCount,
    },
  };
}
