# Render QPDF Installation & Cryptographic PDF Setup Guide

This document specifies the exact configuration required to enable genuine **ISO 32000-2 AES-256 PDF Password Encryption and Decryption** on Render.

---

## Background & Architecture

The application strictly forbids generating fake or corrupted encrypted PDFs by injecting trailer flags without encrypting the underlying object streams. Standard PDF encryption requires an audited cryptographic binary engine (`qpdf`).

The CONVET PULSE Node.js backend exposes two production cryptographic endpoints:
- `POST /api/pdf/encrypt`: Accepts PDF base64 + passwords, executes `qpdf --encrypt ... 256 -- in out`, cleans up temp files, and returns genuine encrypted PDF.
- `POST /api/pdf/decrypt`: Accepts PDF base64 + password, executes `qpdf --password=... --decrypt in out`, cleans up temp files, and returns genuine decrypted PDF.

When `qpdf` is not detected on the host, these endpoints safely return **HTTP 501** (`SYSTEM_BINARY_NOT_FOUND`) with diagnostic instructions.

---

## Current Render Configuration

Your active `render.yaml` currently uses the native Node environment:
```yaml
services:
  - type: web
    name: convetpulse
    env: node
    plan: starter
    buildCommand: npm install --include=dev && npm run build
    startCommand: node server/index.js
```

Because Render's `env: node` build environment does not grant root/sudo access during `buildCommand`, `apt-get install -y qpdf` cannot be run directly without either:
1. **Option A (Recommended & Standard for Render)**: Migrating the service to `env: docker`.
2. **Option B (Native Node Build Hook)**: Installing a static Linux x86_64 `qpdf` binary during `buildCommand`.

---

## Option A: Docker Service Configuration (Recommended)

1. Create a `Dockerfile` in the root repository:
```dockerfile
# Multi-stage production build
FROM node:22-bullseye-slim AS runner

# Install system dependencies including qpdf
RUN apt-get update && apt-get install -y --no-install-recommends \
    qpdf \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies and build client
COPY package*.json ./
RUN npm install --include=dev

COPY . .
RUN npm run build

# Expose production port
ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["node", "server/index.js"]
```

2. In `render.yaml`, change `env: node` to `env: docker`:
```yaml
services:
  - type: web
    name: convetpulse
    env: docker
    plan: starter
    healthCheckPath: /api/health
    disk:
      name: conveter-data
      mountPath: /data
      sizeGB: 1
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: DATA_DIR
        value: /data
      - key: APP_URL
        value: https://convetpulse.onrender.com
```

---

## Option B: Render Native Node with Binary Download

If you prefer to keep `env: node` without Docker:

Update `render.yaml` `buildCommand`:
```yaml
buildCommand: mkdir -p ./bin && curl -fsSL https://github.com/qpdf/qpdf/releases/download/v11.9.0/qpdf-11.9.0-bin-linux-x86_64.tar.gz | tar -xz -C ./bin --strip-components=1 && export PATH="$PWD/bin/bin:$PATH" && npm install --include=dev && npm run build
```
And add to `envVars`:
```yaml
- key: PATH
  value: /opt/render/project/src/bin/bin:/usr/local/bin:/usr/bin:/bin
```

---

## Verification

Once deployed with QPDF, verify via terminal or curl:
```bash
curl -X POST https://convetpulse.onrender.com/api/pdf/encrypt \
  -H "Content-Type: application/json" \
  -d '{"fileBase64": "JVBERi0xLjQKJcTl8uXr...", "userPassword": "SecurePassword123"}'
```
Expected response: HTTP 200 with `{ "success": true, "fileBase64": "...", "size": ... }`.

