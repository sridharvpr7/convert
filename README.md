# CONVET PULSE

CONVET PULSE is a production-grade file conversion and developer workstation platform built with React, TypeScript, Vite, Tailwind CSS, and a Node.js API server. All 31 conversion, developer, and PDF security tools run entirely client-side inside the browser to guarantee zero data leakage and total user privacy.

- **Production URL:** https://convetpulse.onrender.com
- **Developer Portfolio:** https://sridharvpr-portfolio.onrender.com

---

## Tool Categories (31 Tools Across 7 Suites)

### 1. Developer Studio (9 Tools)
- **JSON Formatter & Validator:** Pretty-print (2/4 spaces/tabs) or minify JSON with exact line/column syntax error diagnostics.
- **SQL Formatter:** Formats complex SQL queries with readable multi-line indentation and keyword casing (UPPERCASE/lowercase).
- **Text & Code Diff Checker:** Unified LCS line diff comparing original vs modified snippets with addition/deletion accounting.
- **Hash Generator:** MD5, SHA-1, SHA-256, and SHA-512 hashes computed via browser Web Crypto APIs with security advisories.
- **Base64 Encoder & Decoder:** Bidirectional Base64 codec with UTF-8 Unicode, Tamil/multilingual text, and RFC 4648 §5 URL-safe support.
- **URL Encoder & Decoder:** Encodes and decodes percent-encoded URL components and query parameters.
- **UUID Generator:** Cryptographically secure RFC 4122 v4 UUID generator supporting bulk batches (up to 100) and uppercase/guid styling.
- **Regex Tester:** Safe RegExp pattern tester reporting matches count, index positions, and capture groups.
- **JWT Decoder:** Client-side token header and payload claim inspector with expiry audit and explicit unsigned notice.

### 2. PDF Security Studio (5 Tools)
- **PDF Password Protect:** Applies ISO 32000-1 128-bit encryption with user and owner passwords.
- **PDF Unlock:** Removes encryption dictionary from authorized password-protected PDF files.
- **PDF Redaction:** Visual masking and content stream inspection for sensitive phrases (e.g. SSN, CONFIDENTIAL).
- **PDF Metadata Cleaner:** Permanently strips author, title, creator, producer, dates, and XMP XML metadata streams.
- **PDF Security Inspector:** Comprehensive audit reporting encryption status, embedded JavaScript, launch actions, signatures, and posture score.

### 3. Data & Spreadsheet (4 Tools — High Integrity)
- **CSV to Excel:** RFC 4180 compliant via PapaParse; preserves leading zeros (`007`, `01234`) in codes and identifiers.
- **Excel to CSV:** Multi-sheet aware workbook conversion with UTF-8 BOM encoding for international character preservation.
- **JSON to CSV:** Deep-scans all records to form the full union of keys, flattens nested objects (`user.name`), with zero column drops.
- **CSV to JSON:** Handles quoted fields, inner commas, escaped quotes, multiline cells, and duplicate header deduplication.

### 4. PDF Tools (6 Tools)
- **Merge PDF:** Combine multiple PDF documents into a unified file.
- **Split PDF:** Extract individual pages or custom ranges.
- **Compress PDF:** Re-encodes object streams and strips unreferenced metadata to reduce byte size.
- **Rotate PDF:** Rotate pages by 90, 180, or 270 degrees.
- **JPG to PDF:** Convert raster images into standard PDF documents.
- **PDF to Text:** Extracts literal text strings, TJ arrays, and hex strings from content streams.

### 5. Image Tools (4 Tools)
- **Image Converter:** Convert between PNG, JPEG, and WebP.
- **Image Compressor:** Client-side lossy/lossless canvas compression with quality slider.
- **Image Resize:** Scale by pixel dimensions or percentage while preserving aspect ratio.
- **Image Crop:** Crop images by standard aspect ratios (1:1, 4:3, 16:9) or custom bounding boxes.

### 6. Utilities (1 Tool)
- **QR Code Generator:** Generate high-resolution downloadable QR codes for URLs, text, and contact cards.

### 7. Archive & Compression (2 Tools)
- **ZIP Compressor:** Bundle multiple files into a single compressed `.zip` archive.
- **ZIP Extractor:** Inspect and unpack compressed archives in the browser.

---

## Tool Functionality & Integrity Audit Matrix

| Category | Tool | Processing | Validation | Copy / Download | Status |
|---|---|---|---|---|---|
| Data | CSV to Excel | RFC 4180 / XLSX | Empty check, quote errors | Yes (XLSX) | Working |
| Data | Excel to CSV | XLSX / UTF-8 BOM | Multi-sheet detection | Yes (CSV) | Working |
| Data | JSON to CSV | Union keys / Flatten | JSON syntax validation | Yes (CSV) | Working |
| Data | CSV to JSON | PapaParse greedy | Multiline / Dupl headers | Yes (JSON) | Working |
| Developer | JSON Formatter | JSON.parse / indent | Line/column syntax errors | Yes (Copy & File) | Working |
| Developer | SQL Formatter | Tokenizer / Keyword case | String & comment safety | Yes (Copy & File) | Working |
| Developer | Diff Checker | Myers LCS Algorithm | Separator / multi-input | Yes (Copy & File) | Working |
| Developer | Hash Generator | MD5 / Web Crypto | UTF-8 text / arrayBuffer | Yes (Copy & File) | Working |
| Developer | Base64 Codec | UTF-8 / URL-safe | Malformed Base64 guard | Yes (Copy & File) | Working |
| Developer | URL Codec | encode/decodeURIComponent | URI malformed check | Yes (Copy & File) | Working |
| Developer | UUID Generator | crypto.randomUUID | Count & format validation | Yes (Copy & File) | Working |
| Developer | Regex Tester | RegExp iteration limit | Invalid regex syntax guard | Yes (Copy & File) | Working |
| Developer | JWT Decoder | Base64Url claim parser | 3-part token validation | Yes (Copy & File) | Working |
| Security | PDF Password Protect | ISO 32000-1 RC4 | Password presence check | Yes (PDF) | Working |
| Security | PDF Unlock | Encrypt dictionary strip | Password verification | Yes (PDF) | Working |
| Security | PDF Redaction | pdf-lib stream search | Empty phrase validation | Yes (PDF) | Working |
| Security | PDF Metadata Cleaner | /Info & /Metadata purge | PDF syntax check | Yes (PDF) | Working |
| Security | PDF Security Inspector | Byte & stream audit | Malformed PDF handler | Yes (Report) | Working |
| PDF | Merge PDF | pdf-lib page copy | Multi-file requirement | Yes (PDF) | Working |
| PDF | Split PDF | Range extraction | Page bounds validation | Yes (PDF / ZIP) | Working |
| PDF | Compress PDF | Object stream compression | Valid PDF verification | Yes (PDF) | Working |
| PDF | Rotate PDF | Degree transformation | Valid angles check | Yes (PDF) | Working |
| PDF | JPG to PDF | Image embedding | Image type check | Yes (PDF) | Working |
| PDF | PDF to Text | Page stream decoding | Valid PDF verification | Yes (Text) | Working |
| Image | Image Converter | HTML5 Canvas / blob | Image format check | Yes (Image) | Working |
| Image | Image Compressor | Canvas re-encoding | Dimension/quality bounds | Yes (Image) | Working |
| Image | Image Resize | Canvas bicubic scale | Max dimensions bounds | Yes (Image) | Working |
| Image | Image Crop | Canvas crop rect | Aspect ratio constraints | Yes (Image) | Working |
| Utility | QR Code Generator | qrcode library | Text length bounds | Yes (PNG) | Working |
| Archive | ZIP Compressor | JSZip multi-file pack | Non-empty selection | Yes (ZIP) | Working |
| Archive | ZIP Extractor | JSZip folder unpack | Valid zip header check | Yes (Files) | Working |

---

## Local Development & Testing

Requirements: Node.js 20 or newer.

```sh
npm install
npm run dev
```

Run comprehensive test suite (60 automated unit, API, security, and data tests):
```sh
node scripts/test-all-systems.cjs
```

Run TypeScript compilation check:
```sh
npx tsc -b
```

Run ESLint check:
```sh
npm run lint
```

Build for production:
```sh
npm run build
```

---

## Architecture & Features

1. **100% Client-Side File Processing:** Files never touch external servers. Documents are manipulated using client-side Web APIs (`pdf-lib`, `xlsx`, `jszip`, `canvas`).
2. **Server-Side Razorpay Integration:** Order creation, pricing governance, and HMAC SHA256 cryptographic signature verification executed exclusively on the backend (`GET /api/payment/config`, `POST /api/payment/create-order`, `POST /api/payment/verify-payment`, `POST /api/payment/webhook`).
3. **Telegram Operational Notifications:** Instant alerts dispatched for administrative events:
   - User logins (`POST /api/auth/login-event`)
   - Authenticated app opens with 15-minute deduplication (`POST /api/auth/app-open`)
   - Completed file tasks with clean human-readable action names and cumulative usage counts (`POST /api/jobs/complete`)
   - Verified payment completions with order ID, amount, and plan details
4. **User Manual & Help Center:** Interactive guide accessible at `/help` and `/manual` detailing privacy policies, usage rules, supported formats, and troubleshooting.
5. **Persistent Storage & Admin Recovery:** Supports persistent SQLite storage under `DATA_DIR` (`/data`) on Render with CLI password recovery script (`scripts/reset-admin-password.cjs`).

---

## Local Development

Requirements: Node.js 20 or newer.

```sh
npm install
npm run dev
```

Run test suite:
```sh
node scripts/test-all-systems.cjs
```

Build for production:
```sh
npm run build
```

---

## Environment Variables

Copy `.env.example` to `.env`:

```env
PORT=5000
DATA_DIR=/data
APP_URL=https://convetpulse.onrender.com

# Telegram Bot
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_WEBHOOK_SECRET=

# Razorpay Payments
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# Firebase Auth (Optional)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

---

## Administrator Password Recovery

If admin credentials need to be reset in production or local environments:

```sh
node scripts/reset-admin-password.cjs <newPassword>
```

---

## Deployment on Render

CONVET PULSE is configured via `render.yaml` with a persistent disk attached at `/data`:

- **Build Command:** `npm install --include=dev && npm run build`
- **Start Command:** `node server/index.js`
- **Disk:** 1 GB persistent disk mounted at `/data`
- **Health Check Path:** `/api/health`

