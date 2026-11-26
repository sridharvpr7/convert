// ============================================================
// CONVET PULSE — Document Studio Phase 3 Engine
// Professional Document Creation, Editing & Conversion
// Supports: DOCX, Markdown, Text, HTML, RTF, PDF Export & Templates
// 100% Client-Side Local Processing · Zero Remote Telemetry
// ============================================================

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  UnderlineType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  PageOrientation,
} from 'docx';
import mammoth from 'mammoth';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { ProcessorResult } from './processors.ts';
import { ProcessorError, toBlobPart } from './processors.ts';

// ─────────────────────────────────────────────────────────
// Document Templates
// ─────────────────────────────────────────────────────────
export interface DocumentTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  defaultTitle: string;
  content: string; // Markdown / Plain Text representation
}

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'letter',
    name: 'Professional Letter',
    category: 'Business',
    description: 'Formal business correspondence with sender, recipient, and date formatting',
    defaultTitle: 'Formal Business Letter',
    content: `# [Your Name / Company Name]
[Street Address] · [City, State, ZIP] · [Email] · [Phone]

**Date:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

**To:**
[Recipient Name / Title]
[Company / Organization Name]
[Street Address]
[City, State, ZIP]

**Subject: Notice of Formal Correspondence**

Dear [Recipient Name],

I am writing to formally communicate regarding [subject of letter]. We have reviewed the recent developments and would like to propose the following key points:

1. **First Priority:** Outline the initial step or agreement here with full detail.
2. **Next Steps:** Describe required actions, deliverables, and associated deadlines.
3. **Mutual Collaboration:** Highlight ongoing support and communication channels.

Please feel free to contact me directly should you require further clarification or supplementary documentation. We look forward to your response.

Sincerely,

**[Your Name]**
[Your Professional Title]
[Company Name]`,
  },
  {
    id: 'resume',
    name: 'Professional Resume',
    category: 'Career',
    description: 'Clean modern resume with summary, experience, education, and technical skills',
    defaultTitle: 'Curriculum Vitae',
    content: `# [Your Full Name]
[City, Country] · [Email Address] · [Phone Number] · [LinkedIn / Portfolio URL]

---

## Professional Summary
Results-driven professional with over [X] years of experience delivering high-impact solutions in [industry/field]. Proven track record of leading cross-functional teams, optimizing processes, and accelerating organizational growth.

---

## Core Competencies
- Strategic Planning & Leadership
- Full-Stack Architecture & Systems Design
- Agile Delivery & Project Management
- Quality Assurance & Security Compliance

---

## Professional Experience

### **Senior Specialist** — *[Company Name]*, [City, State]
*Month Year – Present*
- Spearheaded the modernization of legacy platform services, reducing latency by 45%.
- Collaborated across engineering, product, and QA stakeholders to deliver quarterly milestones on schedule.
- Mentored junior associates and established standardized engineering best practices.

### **Project Engineer** — *[Previous Company]*, [City, State]
*Month Year – Month Year*
- Designed and maintained customer-facing workflows utilized by over 50,000 active users.
- Automated deployment scripts and operational monitors, increasing system uptime to 99.9%.

---

## Education
**Bachelor of Science in Computer Science / Engineering**
*[University / Institute Name]*, [Graduation Year]

---

## Certifications & Languages
- Certified Professional Specialist (2024)
- English (Fluent), Tamil (Native)`,
  },
  {
    id: 'report',
    name: 'Project Report',
    category: 'Management',
    description: 'Executive project summary, objectives, findings, and recommendations',
    defaultTitle: 'Quarterly Project Status Report',
    content: `# Project Execution & Status Report
**Project Name:** CONVET PULSE System Modernization
**Author:** Engineering Leadership Team
**Date:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
**Status:** In Progress / On Schedule

---

## 1. Executive Summary
This document outlines the milestones achieved during the current execution cycle. Overall progress aligns with planned deliverables, and no blocking risks have been identified.

## 2. Project Objectives
- Expand core studio capabilities across client document management.
- Eliminate external cloud dependencies to ensure 100% client-side privacy.
- Maintain full cross-platform compatibility across Windows, Android, and Web platforms.

## 3. Milestones & Progress
| Milestone | Target Date | Current Status | Notes |
| :--- | :--- | :--- | :--- |
| Phase 1: Foundation & Studios | Week 1 | Completed | Navigation & Store |
| Phase 2: PDF Studio Expansion | Week 2 | Completed | OCR & Rasterization |
| Phase 3: Document Studio | Week 3 | In Progress | DOCX, MD, RTF Engine |

## 4. Key Findings & Analytics
- Client-side processing reduces infrastructure costs by 95%.
- User privacy is preserved with zero document transmission over external networks.

## 5. Next Steps & Recommendations
1. Finalize Document Studio automated test suites.
2. Advance to Document Scanner Studio integration.
3. Review performance telemetry across mobile touch devices.`,
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    category: 'Productivity',
    description: 'Structured meeting agenda, attendees, discussion points, and action items',
    defaultTitle: 'Team Sync Meeting Notes',
    content: `# Meeting Notes: Architecture & Roadmap Sync
**Date & Time:** ${new Date().toLocaleString()}
**Facilitator:** Product Engineering Lead
**Attendees:** Engineering, Product Management, UI/UX Design

---

## Agenda
1. Review of current release candidates and QA test results.
2. Discussion of Document Studio editing workflows and formats.
3. Allocation of upcoming sprints and team action items.

---

## Discussion Summary
- **Phase 2.1 Audit:** Verified genuine Tesseract OCR and PDF.js rasterization with 100% pass rate.
- **Document Studio Scope:** Confirmed support for DOCX, Markdown, Text, HTML, and RTF formats.
- **Security Protocols:** Strict HTML sanitization enforced to prevent cross-site scripting (XSS).

---

## Action Items
- [ ] Implement DOCX generator with customizable typography.
- [ ] Verify Tamil Unicode character preservation in generated documents.
- [ ] Package test suites for automated release verification.`,
  },
  {
    id: 'assignment',
    name: 'Academic Assignment',
    category: 'Education',
    description: 'University assignment cover page, section headers, citations, and references',
    defaultTitle: 'Academic Research Assignment',
    content: `# Course Title: Advanced Distributed Systems
## Assignment Title: Client-Side Privacy in Modern Web Architectures

**Student Name:** [Your Name]
**Student ID:** [Your Student ID]
**Instructor:** [Professor's Name]
**Institution:** Department of Computer Science, [University Name]
**Submission Date:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

---

### Abstract
This paper examines the computational feasibility of performing cryptographic and document-processing workloads entirely within client-side WebAssembly and modern browser runtimes, eliminating privacy vulnerabilities associated with cloud transmission.

---

### 1. Introduction
Modern cloud productivity platforms often require users to upload confidential files to remote servers. This introduces compliance challenges under privacy frameworks such as GDPR and HIPAA...

### 2. Methodology
We evaluated client-side OpenXML generation, Canvas-based rasterization, and in-memory WebAssembly OCR using standard benchmark documents.

### 3. Conclusion
The findings demonstrate that local client-side processing achieves acceptable latency for documents up to 500 pages while ensuring zero data exposure.

---

### References
1. Berners-Lee, T. et al. (2023). Universal Client Architecture. Journal of Web Systems.
2. Smith, J. (2024). Privacy-Preserving Offline Utilities. IEEE Computing.`,
  },
  {
    id: 'research',
    name: 'Research Paper',
    category: 'Education',
    description: 'Formal academic paper template with abstract, methodology, results, and references',
    defaultTitle: 'Scientific Research Paper',
    content: `# Technical Research Paper: Offline Document Processing
**Author:** Engineering Research Group
**Contact:** research@convetpulse.internal

---

## Abstract
We present a zero-knowledge document productivity engine capable of client-side formatting, parsing, and conversion across DOCX, Markdown, and PDF formats.

## 1. Introduction & Background
Data privacy is paramount when handling sensitive legal, financial, and educational files...

## 2. Experimental Setup
- Engine: Node 22 / Chromium V8 Web Worker
- Language Models: English (eng), Tamil (tam)
- Parsing Pipeline: OpenXML AST, CommonMark specification

## 3. Results & Evaluation
Performance benchmarks showed an average rendering throughput of 14.2 pages per second for pure vector text streams.

## 4. Discussion
Client-side processing eliminates network latency and egress data transfer costs.`,
  },
  {
    id: 'invoice',
    name: 'Business Invoice',
    category: 'Business',
    description: 'Professional invoice with itemized table, tax calculation, and payment terms',
    defaultTitle: 'Commercial Invoice',
    content: `# INVOICE
**Invoice Number:** INV-2026-0042
**Invoice Date:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
**Payment Due:** Within 30 days of receipt

---

### Billed By (Supplier)
**CONVET PULSE Software Solutions**
100 Innovation Parkway, Suite 400
Email: billing@convetpulse.onrender.com

### Billed To (Client)
**Client Company / Organization**
Attn: Accounts Payable
456 Commerce Avenue, Floor 12
Email: finance@clientorg.com

---

### Itemized Services & Deliverables
| Description | Hours / Qty | Rate | Amount |
| :--- | :--- | :--- | :--- |
| Professional Software Engineering | 40 hrs | $120.00 | $4,800.00 |
| Systems Architecture & Security Audit | 15 hrs | $150.00 | $2,250.00 |
| Client-Side Document Pipeline Integration | 1 unit | $1,500.00 | $1,500.00 |

---

**Subtotal:** $8,550.00
**Tax (0%):** $0.00
**Total Amount Due:** **$8,550.00 USD**

---

### Payment Instructions
- **Bank Transfer:** Wire details available upon request.
- **Reference:** Please reference INV-2026-0042 on all remittances.
Thank you for your business!`,
  },
  {
    id: 'proposal',
    name: 'Simple Business Proposal',
    category: 'Business',
    description: 'Executive project proposal detailing project scope, deliverables, timeline, and investment',
    defaultTitle: 'Business Partnership Proposal',
    content: `# Strategic Business Proposal
**Prepared For:** Executive Leadership Team
**Prepared By:** CONVET PULSE Product Development
**Date:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

---

## 1. Project Overview & Opportunity
The objective of this proposal is to establish a unified document productivity architecture that allows users to create, edit, and convert documents directly inside their browser with enterprise-grade reliability.

## 2. Proposed Scope of Work
- **Phase 3:** Complete Document Studio (DOCX, Markdown, Text, HTML, RTF).
- **Security:** In-memory isolation and strict DOM sanitization.
- **Accessibility:** Fully responsive cross-platform desktop and mobile interfaces.

## 3. Timeline & Major Deliverables
- **Week 1–2:** Core parser engines and template scaffolding.
- **Week 3:** Automated QA suites and regression validation.
- **Week 4:** Production rollout and documentation.

## 4. Investment Summary
Fixed-fee engagement covering all discovery, implementation, testing, and 90-day post-launch support.

Please sign below to indicate formal acceptance of this proposal.

______________________________________
**Authorized Representative Signature**`,
  },
];

// ─────────────────────────────────────────────────────────
// Document Text Statistics Helper
// ─────────────────────────────────────────────────────────
export interface DocumentStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  paragraphs: number;
  sentences: number;
  readingTimeMinutes: number;
}

export function calculateDocumentStats(text: string): DocumentStats {
  const clean = text || '';
  const words = clean.trim() ? clean.trim().split(/\s+/).filter(Boolean).length : 0;
  const characters = clean.length;
  const charactersNoSpaces = clean.replace(/\s/g, '').length;
  const paragraphs = clean.trim()
    ? clean.split(/\n+/).filter((p) => p.trim().length > 0).length
    : 0;
  const sentences = clean.trim()
    ? clean.split(/[.!?]+/).filter((s) => s.trim().length > 0).length
    : 0;
  const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));

  return {
    words,
    characters,
    charactersNoSpaces,
    paragraphs,
    sentences,
    readingTimeMinutes,
  };
}

// ─────────────────────────────────────────────────────────
// HTML Sanitizer
// ─────────────────────────────────────────────────────────
export function sanitizeHtml(rawHtml: string): string {
  if (typeof window !== 'undefined' && DOMPurify && typeof DOMPurify.sanitize === 'function') {
    return DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
        'strong', 'b', 'em', 'i', 'u', 's', 'strike',
        'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'a', 'span', 'div', 'img',
      ],
      ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'class', 'style', 'width', 'height', 'target'],
    });
  }

  // Headless / Node.js fallback sanitizer
  let safe = rawHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?<\/embed>/gi, '')
    .replace(/on\w+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, 'blocked:');
  return safe;
}

// ─────────────────────────────────────────────────────────
// 1. DOCX Document Creator (OpenXML Generator)
// ─────────────────────────────────────────────────────────
export interface DocxCreatorOptions {
  title?: string;
  content?: string;
  fontSize?: number; // half-points: 24 = 12pt
  lineSpacing?: number; // 240 = 1.0 line spacing
  orientation?: 'portrait' | 'landscape';
  marginInch?: number;
  templateId?: string;
}

export async function createDocxDocument(
  options: DocxCreatorOptions = {}
): Promise<Blob> {
  let rawContent = (options.content || '').trim();
  if (!rawContent && options.templateId) {
    const tmpl = DOCUMENT_TEMPLATES.find((t) => t.id === options.templateId);
    if (tmpl) rawContent = tmpl.content;
  }
  if (!rawContent) {
    rawContent = `# ${options.title || 'Untitled Document'}\n\nStart typing your document content here...`;
  }

  const lines = rawContent.split('\n');
  const docChildren: (Paragraph | Table)[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      docChildren.push(new Paragraph({ text: '' }));
      continue;
    }

    // Markdown Heading 1
    if (trimmed.startsWith('# ')) {
      docChildren.push(
        new Paragraph({
          text: trimmed.replace(/^#\s+/, ''),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
        })
      );
    } else if (trimmed.startsWith('## ')) {
      docChildren.push(
        new Paragraph({
          text: trimmed.replace(/^##\s+/, ''),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );
    } else if (trimmed.startsWith('### ')) {
      docChildren.push(
        new Paragraph({
          text: trimmed.replace(/^###\s+/, ''),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 80 },
        })
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      docChildren.push(
        new Paragraph({
          text: trimmed.replace(/^[-*]\s+/, ''),
          bullet: { level: 0 },
        })
      );
    } else if (/^\d+\.\s+/.test(trimmed)) {
      docChildren.push(
        new Paragraph({
          text: trimmed.replace(/^\d+\.\s+/, ''),
          numbering: { reference: 'numbered-list', level: 0 },
        })
      );
    } else {
      // Parse inline formatting: **bold**, *italic*, __underline__
      const runs: TextRun[] = [];
      const parts = trimmed.split(/(\*\*.*?\*\*|\*.*?\*|__.*?__)/g);

      for (const part of parts) {
        if (!part) continue;
        if (part.startsWith('**') && part.endsWith('**')) {
          runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
        } else if (part.startsWith('*') && part.endsWith('*')) {
          runs.push(new TextRun({ text: part.slice(1, -1), italics: true }));
        } else if (part.startsWith('__') && part.endsWith('__')) {
          runs.push(new TextRun({ text: part.slice(2, -2), underline: { type: UnderlineType.SINGLE } }));
        } else {
          runs.push(new TextRun({ text: part }));
        }
      }

      docChildren.push(
        new Paragraph({
          children: runs,
          spacing: { after: 120, line: options.lineSpacing ? Math.round(options.lineSpacing * 240) : 276 },
        })
      );
    }
  }

  const marginTwips = Math.round((options.marginInch ?? 1) * 1440);
  const isLandscape = options.orientation === 'landscape';

  const doc = new Document({
    title: options.title || 'Document',
    creator: 'CONVET PULSE Document Studio',
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: {
              top: marginTwips,
              bottom: marginTwips,
              left: marginTwips,
              right: marginTwips,
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Blob([toBlobPart(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

// ─────────────────────────────────────────────────────────
// 2. DOCX Content Extraction via Mammoth
// ─────────────────────────────────────────────────────────
export interface DocxExtractionResult {
  text: string;
  html: string;
  messages: string[];
}

export async function extractDocxContent(
  file: File | Blob | ArrayBuffer | Uint8Array | Buffer
): Promise<DocxExtractionResult> {
  let rawBuffer: Buffer;
  if (Buffer.isBuffer(file)) {
    rawBuffer = file;
  } else if (file instanceof ArrayBuffer) {
    rawBuffer = Buffer.from(file);
  } else if (ArrayBuffer.isView(file)) {
    rawBuffer = Buffer.from(file.buffer, file.byteOffset, file.byteLength);
  } else if (file && typeof (file as Blob).arrayBuffer === 'function') {
    const ab = await (file as Blob).arrayBuffer();
    rawBuffer = Buffer.from(ab);
  } else {
    throw new ProcessorError('Invalid input provided to Word parser.', 'INVALID_INPUT');
  }

  try {
    const rawTextResult = await mammoth.extractRawText({ buffer: rawBuffer });
    const htmlResult = await mammoth.convertToHtml({ buffer: rawBuffer });

    const messages = [
      ...(rawTextResult.messages || []).map((m) => m.message),
      ...(htmlResult.messages || []).map((m) => m.message),
    ];

    return {
      text: (rawTextResult.value || '').trim(),
      html: sanitizeHtml(htmlResult.value || ''),
      messages: Array.from(new Set(messages)),
    };
  } catch (err) {
    throw new ProcessorError(
      `Could not parse Word document: ${(err as Error)?.message || 'Invalid or corrupted DOCX file.'}`,
      'INVALID_DOCX'
    );
  }
}

// ─────────────────────────────────────────────────────────
// 3. Markdown Engine (Parsing & Conversion)
// ─────────────────────────────────────────────────────────
export function markdownToHtml(markdown: string): string {
  const rawHtml = marked.parse(markdown || '') as string;
  return sanitizeHtml(rawHtml);
}

export async function markdownToDocx(
  markdown: string,
  options: { title?: string } = {}
): Promise<Blob> {
  return createDocxDocument({
    title: options.title || 'Markdown Document',
    content: markdown,
  });
}

export async function markdownToPdf(
  markdown: string,
  options: { title?: string } = {}
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentY = pageHeight - margin;

  function checkPageBreak(requiredHeight: number) {
    if (currentY - requiredHeight < margin) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      currentY = pageHeight - margin;
    }
  }

  // Render title
  const title = options.title || 'Document';
  checkPageBreak(30);
  currentPage.drawText(title, {
    x: margin,
    y: currentY - 20,
    size: 20,
    font: boldFont,
    color: rgb(0.1, 0.2, 0.4),
  });
  currentY -= 40;

  const lines = (markdown || '').split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      currentY -= 10;
      continue;
    }

    if (line.startsWith('# ')) {
      checkPageBreak(28);
      currentPage.drawText(line.replace(/^#\s+/, ''), {
        x: margin,
        y: currentY - 16,
        size: 16,
        font: boldFont,
        color: rgb(0.1, 0.1, 0.2),
      });
      currentY -= 28;
    } else if (line.startsWith('## ')) {
      checkPageBreak(24);
      currentPage.drawText(line.replace(/^##\s+/, ''), {
        x: margin,
        y: currentY - 14,
        size: 14,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.3),
      });
      currentY -= 24;
    } else {
      const cleanLine = line.replace(/[*_#`[\]()]/g, '');
      const words = cleanLine.split(/\s+/);
      let currentLineText = '';

      for (const word of words) {
        const testLine = currentLineText ? `${currentLineText} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, 10);

        if (width > contentWidth && currentLineText) {
          checkPageBreak(14);
          currentPage.drawText(currentLineText, {
            x: margin,
            y: currentY - 10,
            size: 10,
            font,
            color: rgb(0.15, 0.15, 0.15),
          });
          currentY -= 14;
          currentLineText = word;
        } else {
          currentLineText = testLine;
        }
      }

      if (currentLineText) {
        checkPageBreak(14);
        currentPage.drawText(currentLineText, {
          x: margin,
          y: currentY - 10,
          size: 10,
          font,
          color: rgb(0.15, 0.15, 0.15),
        });
        currentY -= 16;
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([toBlobPart(pdfBytes)], { type: 'application/pdf' });
}

// ─────────────────────────────────────────────────────────
// 4. RTF Codec (Rich Text Format with Full Unicode / Tamil)
// ─────────────────────────────────────────────────────────
export function textToRtf(text: string, title = 'Document'): string {
  let rtf = `{\\rtf1\\ansi\\ansicpg1252\\deff0\\nouicompat\\deflang1033{\\fonttbl{\\f0\\fnil\\fcharset0 Arial;}{\\f1\\fnil\\fcharset0 Times New Roman;}}\n`;
  rtf += `{\\colortbl ;\\red0\\green0\\blue0;\\red30\\green70\\blue150;}\n`;
  rtf += `{\\*\\generator CONVET PULSE Document Studio;}\n`;
  rtf += `\\viewkind4\\uc1\\pard\\sa200\\sl276\\slmult1\\f0\\fs24 `;

  const cleanText = text || '';
  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const code = cleanText.charCodeAt(i);

    if (char === '\n') {
      rtf += '\\par\n';
    } else if (char === '\\') {
      rtf += '\\\\';
    } else if (char === '{') {
      rtf += '\\{';
    } else if (char === '}') {
      rtf += '\\}';
    } else if (code < 128) {
      rtf += char;
    } else {
      // RTF Unicode escape representation: \uN?
      const signedCode = code > 32767 ? code - 65536 : code;
      rtf += `\\u${signedCode}?`;
    }
  }

  rtf += '\\par\n}';
  return rtf;
}

export function rtfToText(rtfString: string): string {
  if (!rtfString || !rtfString.includes('\\rtf')) {
    return rtfString || '';
  }

  let text = rtfString;

  // Remove control headers like font tables, color tables, stylesheet, info
  text = text.replace(/\{\\\*[\s\S]*?\}/g, '');
  text = text.replace(/\{\\(?:fonttbl|colortbl|stylesheet|info)[\s\S]*?\}/g, '');

  // Convert Unicode escapes: \uN? or \uN
  text = text.replace(/\\u(-?\d+)[^\\{}]?/g, (_, numStr) => {
    let code = parseInt(numStr, 10);
    if (code < 0) code += 65536;
    return String.fromCharCode(code);
  });

  // Paragraph and line breaks
  text = text.replace(/\\(?:par|line)\b/g, '\n');
  text = text.replace(/\\tab\b/g, '\t');

  // Strip remaining control words
  text = text.replace(/\\[a-zA-Z]+-?\d*\s?/g, '');

  // Strip unescaped grouping braces
  text = text.replace(/([^\\]|^)[{}]/g, '$1');

  // Unescape literal braces and backslashes
  text = text
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}')
    .replace(/\\\\/g, '\\');

  return text.trim();
}

// ─────────────────────────────────────────────────────────
// 5. Tool Processor Implementations for Registry & Dispatch
// ─────────────────────────────────────────────────────────

/** DOCX Document Creator Tool */
export async function processDocxCreator(
  files: File[],
  options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  const title = (options.title as string)?.trim() || 'Document';
  const content = (options.content as string) || '';
  const templateId = (options.template as string) || '';

  const docxBlob = await createDocxDocument({
    title,
    content,
    templateId,
    orientation: (options.orientation as 'portrait' | 'landscape') || 'portrait',
  });

  const baseName = title.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'document';
  return {
    blob: docxBlob,
    filename: `${baseName}.docx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    meta: {
      title,
      template: templateId || 'custom',
      outputFormat: 'DOCX',
      outputSize: docxBlob.size,
    },
  };
}

/** DOCX Editor / Inspector Tool */
export async function processDocxEditor(
  files: File[],
  options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  if (!files || files.length === 0) {
    throw new ProcessorError('Please upload a Microsoft Word (.docx) document to edit.', 'NO_FILE');
  }

  const file = files[0];
  const extracted = await extractDocxContent(file);
  const targetFormat = ((options.exportFormat as string) || (options.outputFormat as string) || 'docx').toLowerCase();
  const baseName = file.name.replace(/\.docx$/i, '') || 'document';

  if (targetFormat === 'txt') {
    const txtBlob = new Blob([extracted.text], { type: 'text/plain;charset=utf-8' });
    return {
      blob: txtBlob,
      filename: `${baseName}.txt`,
      mimeType: 'text/plain',
      meta: {
        words: calculateDocumentStats(extracted.text).words,
        extractedLines: extracted.text.split('\n').length,
        outputSize: txtBlob.size,
      },
    };
  }

  if (targetFormat === 'html') {
    const htmlBlob = new Blob([extracted.html], { type: 'text/html;charset=utf-8' });
    return {
      blob: htmlBlob,
      filename: `${baseName}.html`,
      mimeType: 'text/html',
      meta: {
        outputFormat: 'HTML',
        outputSize: htmlBlob.size,
      },
    };
  }

  // Default: Re-export DOCX
  const updatedDocx = await createDocxDocument({
    title: baseName,
    content: extracted.text,
  });

  return {
    blob: updatedDocx,
    filename: `${baseName}_edited.docx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    meta: {
      originalFileName: file.name,
      words: calculateDocumentStats(extracted.text).words,
      disclaimer: 'Preserved core text and paragraphs. Complex WordArt and embedded macros are omitted.',
      outputSize: updatedDocx.size,
    },
  };
}

/** Markdown Studio Tool */
export async function processMarkdownStudio(
  files: File[],
  options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  let markdown = (options.markdown as string) || '';
  let filename = 'document';

  if (files && files.length > 0) {
    markdown = await files[0].text();
    filename = files[0].name.replace(/\.md$/i, '');
  }

  const exportFormat = (options.exportFormat as string) || 'html';

  if (exportFormat === 'docx') {
    const docxBlob = await markdownToDocx(markdown, { title: filename });
    return {
      blob: docxBlob,
      filename: `${filename}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      meta: { format: 'DOCX', outputSize: docxBlob.size },
    };
  }

  if (exportFormat === 'pdf') {
    const pdfBlob = await markdownToPdf(markdown, { title: filename });
    return {
      blob: pdfBlob,
      filename: `${filename}.pdf`,
      mimeType: 'application/pdf',
      meta: { format: 'PDF', outputSize: pdfBlob.size },
    };
  }

  // Export HTML
  const html = markdownToHtml(markdown);
  const htmlBlob = new Blob([html], { type: 'text/html;charset=utf-8' });
  return {
    blob: htmlBlob,
    filename: `${filename}.html`,
    mimeType: 'text/html',
    meta: {
      format: 'HTML',
      words: calculateDocumentStats(markdown).words,
      outputSize: htmlBlob.size,
    },
  };
}

/** Text Document Studio Tool */
export async function processTextStudio(
  files: File[],
  options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  let content = (options.content as string) || '';
  let filename = 'document';

  if (files && files.length > 0) {
    content = await files[0].text();
    filename = files[0].name.replace(/\.txt$/i, '');
  }

  // Handle Find & Replace
  const findText = (options.findText as string) || (options.find as string) || '';
  const replaceText = (options.replaceText as string) || (options.replace as string) || '';
  if (findText) {
    content = content.split(findText).join(replaceText);
  }

  const exportFormat = ((options.exportFormat as string) || (options.outputFormat as string) || 'txt').toLowerCase();
  const stats = calculateDocumentStats(content);

  if (exportFormat === 'docx') {
    const docxBlob = await createDocxDocument({ title: filename, content });
    return {
      blob: docxBlob,
      filename: `${filename}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      meta: { words: stats.words, characters: stats.characters, outputSize: docxBlob.size },
    };
  }

  if (exportFormat === 'rtf') {
    const rtf = textToRtf(content, filename);
    const rtfBlob = new Blob([rtf], { type: 'application/rtf' });
    return {
      blob: rtfBlob,
      filename: `${filename}.rtf`,
      mimeType: 'application/rtf',
      meta: { words: stats.words, characters: stats.characters, outputSize: rtfBlob.size },
    };
  }

  const txtBlob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  return {
    blob: txtBlob,
    filename: `${filename}.txt`,
    mimeType: 'text/plain',
    meta: {
      words: stats.words,
      characters: stats.characters,
      paragraphs: stats.paragraphs,
      encoding: 'UTF-8',
      outputSize: txtBlob.size,
    },
  };
}

/** HTML Document Studio Tool */
export async function processHtmlStudio(
  files: File[],
  options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  let html = (options.html as string) || '<h1>Hello World</h1>\n<p>Safe HTML document.</p>';
  let filename = 'document';

  if (files && files.length > 0) {
    html = await files[0].text();
    filename = files[0].name.replace(/\.html?$/i, '');
  }

  const sanitized = sanitizeHtml(html);
  const exportFormat = ((options.exportFormat as string) || (options.outputFormat as string) || 'html').toLowerCase();

  if (exportFormat === 'pdf') {
    const strippedText = sanitized.replace(/<[^>]*>/g, '\n').replace(/\n\s*\n/g, '\n\n').trim();
    const pdfBlob = await markdownToPdf(strippedText, { title: filename });
    return {
      blob: pdfBlob,
      filename: `${filename}.pdf`,
      mimeType: 'application/pdf',
      meta: {
        outputFormat: 'PDF',
        isSanitized: 'yes',
        outputSize: pdfBlob.size,
      },
    };
  }

  if (exportFormat === 'txt') {
    const strippedText = sanitized.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const txtBlob = new Blob([strippedText], { type: 'text/plain;charset=utf-8' });
    return {
      blob: txtBlob,
      filename: `${filename}.txt`,
      mimeType: 'text/plain',
      meta: {
        outputFormat: 'TXT',
        outputSize: txtBlob.size,
      },
    };
  }

  const blob = new Blob([sanitized], { type: 'text/html;charset=utf-8' });

  return {
    blob,
    filename: `${filename}_sanitized.html`,
    mimeType: 'text/html',
    meta: {
      isSanitized: 'yes',
      scriptExecutionBlocked: 'yes',
      outputSize: blob.size,
    },
  };
}

/** RTF Converter Tool */
export async function processRtfConverter(
  files: File[],
  options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  if (!files || files.length === 0) {
    throw new ProcessorError('Please upload an RTF (.rtf) or Text (.txt) document.', 'NO_FILE');
  }

  const file = files[0];
  const fileContent = await file.text();
  const isRtfInput = file.name.endsWith('.rtf') || fileContent.includes('\\rtf');

  if (isRtfInput) {
    // RTF -> Plain Text
    const plainText = rtfToText(fileContent);
    const txtBlob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
    const baseName = file.name.replace(/\.rtf$/i, '');

    return {
      blob: txtBlob,
      filename: `${baseName}.txt`,
      mimeType: 'text/plain',
      meta: {
        sourceFormat: 'RTF',
        targetFormat: 'TXT',
        words: calculateDocumentStats(plainText).words,
        outputSize: txtBlob.size,
      },
    };
  }

  // TXT -> RTF
  const rtfOutput = textToRtf(fileContent, file.name);
  const rtfBlob = new Blob([rtfOutput], { type: 'application/rtf' });
  const baseName = file.name.replace(/\.txt$/i, '');

  return {
    blob: rtfBlob,
    filename: `${baseName}.rtf`,
    mimeType: 'application/rtf',
    meta: {
      sourceFormat: 'TXT',
      targetFormat: 'RTF',
      encoding: 'Unicode RTF (\\uN?)',
      outputSize: rtfBlob.size,
    },
  };
}

/** DOCX to TXT Converter Tool */
export async function processDocxToTxt(
  files: File[],
  _options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  if (!files || files.length === 0) {
    throw new ProcessorError('Please upload a Word document (.docx).', 'NO_FILE');
  }
  const file = files[0];
  const arrayBuffer = await file.arrayBuffer();
  const { text } = await extractDocxContent(arrayBuffer);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const baseName = file.name.replace(/\.docx$/i, '');

  return {
    blob,
    filename: `${baseName}.txt`,
    mimeType: 'text/plain',
    meta: {
      sourceFormat: 'DOCX',
      targetFormat: 'TXT',
      words: calculateDocumentStats(text).words,
      outputSize: blob.size,
    },
  };
}

/** Markdown to PDF Converter Tool */
export async function processMarkdownToPdf(
  files: File[],
  _options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  if (!files || files.length === 0) {
    throw new ProcessorError('Please upload a Markdown file (.md) or provide text.', 'NO_FILE');
  }
  const file = files[0];
  const markdown = await file.text();
  const baseName = file.name.replace(/\.md$/i, '').replace(/\.markdown$/i, '');
  const blob = await markdownToPdf(markdown, { title: baseName });

  return {
    blob,
    filename: `${baseName}.pdf`,
    mimeType: 'application/pdf',
    meta: {
      sourceFormat: 'MD',
      targetFormat: 'PDF',
      words: calculateDocumentStats(markdown).words,
      outputSize: blob.size,
    },
  };
}

/** Markdown to DOCX Converter Tool */
export async function processMarkdownToDocx(
  files: File[],
  _options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  if (!files || files.length === 0) {
    throw new ProcessorError('Please upload a Markdown file (.md).', 'NO_FILE');
  }
  const file = files[0];
  const markdown = await file.text();
  const baseName = file.name.replace(/\.md$/i, '').replace(/\.markdown$/i, '');
  const blob = await markdownToDocx(markdown, { title: baseName });

  return {
    blob,
    filename: `${baseName}.docx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    meta: {
      sourceFormat: 'MD',
      targetFormat: 'DOCX',
      words: calculateDocumentStats(markdown).words,
      outputSize: blob.size,
    },
  };
}

/** TXT to DOCX Converter Tool */
export async function processTxtToDocx(
  files: File[],
  _options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  if (!files || files.length === 0) {
    throw new ProcessorError('Please upload a Text file (.txt).', 'NO_FILE');
  }
  const file = files[0];
  const text = await file.text();
  const baseName = file.name.replace(/\.txt$/i, '');
  const blob = await createDocxDocument({ title: baseName, content: text });

  return {
    blob,
    filename: `${baseName}.docx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    meta: {
      sourceFormat: 'TXT',
      targetFormat: 'DOCX',
      words: calculateDocumentStats(text).words,
      outputSize: blob.size,
    },
  };
}
