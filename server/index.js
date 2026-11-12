// ============================================================
// CONVETER — Production Full-Stack Server
// Serves API endpoints + static SPA frontend from dist/
// ============================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRoute } from './routes.js';
import { initializeAuth } from './auth.js';
import { initializePremiumConfig } from './premium.js';
import { initializeSiteDisplayConfig } from './site-display.js';
import { telegramService } from './telegram.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;
const DIST_DIR = path.resolve(__dirname, '../dist');

// Initialize modules on boot
let initialAdminPassword = null;
try {
  initializePremiumConfig();
  initializeSiteDisplayConfig();
  initialAdminPassword = await initializeAuth();
} catch (err) {
  console.error('[Server Init Error]', err);
}

// Global exception handlers for system stability & Telegram alerting
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
  telegramService.notifySystemError(err, 'Uncaught Exception').catch(() => {});
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
  telegramService.notifySystemError(new Error(String(reason)), 'Unhandled Rejection').catch(() => {});
});

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Prevent any attempt to access private directories like /config, /data, /.env
  const lowerPath = parsedUrl.pathname.toLowerCase();
  if (
    lowerPath.startsWith('/config') ||
    lowerPath.startsWith('/data') ||
    lowerPath.includes('/.') ||
    lowerPath.includes('..')
  ) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Access Forbidden');
  }

  // 1. API routes
  if (parsedUrl.pathname.startsWith('/api/')) {
    try {
      await handleApiRoute(req, res, parsedUrl);
    } catch (err) {
      console.error('[API Error]', err);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
    }
    return;
  }

  // 2. Static file serving (dist/)
  let filePath = path.join(DIST_DIR, parsedUrl.pathname);

  // Security check: prevent directory traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // SPA fallback: serve index.html for client-side routing
    const indexPath = path.join(DIST_DIR, 'index.html');
    fs.readFile(indexPath, (readErr, content) => {
      if (readErr) {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>CONVET PULSE</title></head>
            <body style="font-family:sans-serif;padding:40px;text-align:center;">
              <h2>CONVET PULSE Backend Server Active</h2>
              <p>Frontend is currently building or running in development mode.</p>
              <p><a href="/api/health">Check API Health</a></p>
            </body>
          </html>
        `);
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Cache-Control': 'no-cache',
      });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`[CONVET PULSE] Server running at http://localhost:${PORT}`);
  console.log(`[CONVET PULSE] Healthcheck ready at http://localhost:${PORT}/api/health`);
  if (initialAdminPassword) {
    console.log('─────────────────────────────────────────────────────────────');
    console.log('[Auth] Initial Administrator Account Created:');
    console.log('       Username: admin');
    console.log(`       Password: ${initialAdminPassword}`);
    console.log('       Note: Change this password upon first login.');
    console.log('─────────────────────────────────────────────────────────────');
  }
});
