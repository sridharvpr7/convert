# CONVET PULSE

CONVET PULSE is a production-grade file conversion platform built with React, TypeScript, Vite, Tailwind CSS, and a Node.js API server. All 17 document and media conversion tools run entirely client-side inside the browser to preserve user privacy.

- **Production URL:** https://convetpulse.onrender.com
- **Developer Portfolio:** https://sridharvpr-portfolio.onrender.com

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

