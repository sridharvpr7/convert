// ============================================================
// CONVETER — Server API Router
// Dispatches REST endpoints for health, jobs, users, admin, telegram
// ============================================================

import { db } from './db.js';
import { telegramService } from './telegram.js';

export async function handleApiRoute(req, res, url) {
  const method = req.method;
  const pathname = url.pathname;

  // JSON responder helper
  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token, X-Admin-Token',
    });
    res.end(JSON.stringify(data));
  };

  // Helper to read JSON body
  const readBody = () =>
    new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk;
        if (data.length > 5 * 1024 * 1024) {
          req.destroy();
          resolve(null);
        }
      });
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch {
          resolve({});
        }
      });
    });

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token, X-Admin-Token',
    });
    return res.end();
  }

  // ─────────────────────────────────────────────────────────
  // 1. Health Check Endpoint (Render requirement)
  // ─────────────────────────────────────────────────────────
  if (pathname === '/api/health' && method === 'GET') {
    return sendJson(200, {
      status: 'healthy',
      version: '1.0.0',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: 'connected',
      telegram: telegramService.getPublicStatus(),
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: process.memoryUsage().rss,
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  // 2. Jobs Endpoints
  // ─────────────────────────────────────────────────────────
  if (pathname === '/api/jobs/start' && method === 'POST') {
    const body = await readBody();
    if (!body || !body.toolSlug) {
      return sendJson(400, { error: 'toolSlug is required' });
    }

    const job = db.createJob(body);
    // Asynchronously send Telegram notification
    telegramService.notifyConversionStarted(job).catch((err) => {
      console.error('[API] notifyConversionStarted failed:', err.message);
    });

    return sendJson(201, { job });
  }

  if (pathname === '/api/jobs/complete' && method === 'POST') {
    const body = await readBody();
    if (!body || !body.id) {
      return sendJson(400, { error: 'Job id is required' });
    }

    const updated = db.updateJob(body.id, {
      status: 'completed',
      output_file_name: body.outputFileName || null,
      output_file_size: body.outputFileSize || 0,
      output_format: body.outputFormat || null,
      duration_ms: body.durationMs || 0,
      completed_at: new Date().toISOString(),
    });

    if (updated) {
      telegramService.notifyConversionCompleted(updated).catch((err) => {
        console.error('[API] notifyConversionCompleted failed:', err.message);
      });
    }

    return sendJson(200, { job: updated });
  }

  if (pathname === '/api/jobs/fail' && method === 'POST') {
    const body = await readBody();
    if (!body || !body.id) {
      return sendJson(400, { error: 'Job id is required' });
    }

    const updated = db.updateJob(body.id, {
      status: 'failed',
      duration_ms: body.durationMs || 0,
      error_summary: body.errorSummary || 'Processing failed',
      completed_at: new Date().toISOString(),
    });

    if (updated) {
      telegramService.notifyConversionFailed({
        ...updated,
        errorCategory: body.errorCategory || 'Conversion Error',
      }).catch((err) => {
        console.error('[API] notifyConversionFailed failed:', err.message);
      });
    }

    return sendJson(200, { job: updated });
  }

  if (pathname === '/api/jobs' && method === 'GET') {
    const status = url.searchParams.get('status') || 'all';
    const toolSlug = url.searchParams.get('tool') || 'all';
    const search = url.searchParams.get('search') || '';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const jobs = db.listJobs({ status, toolSlug, search, limit, offset });
    return sendJson(200, { jobs, count: jobs.length });
  }

  // Single job lookup / comment / download: /api/jobs/:id
  const jobMatch = pathname.match(/^\/api\/jobs\/([A-Za-z0-9_-]+)(?:\/(comment|download))?$/);
  if (jobMatch) {
    const jobId = jobMatch[1];
    const subAction = jobMatch[2];

    if (!subAction && method === 'GET') {
      const job = db.getJobById(jobId);
      if (!job) return sendJson(404, { error: 'Job not found' });
      const comments = db.getCommentsForJob(jobId);
      return sendJson(200, { job, comments });
    }

    if (subAction === 'comment' && method === 'POST') {
      const body = await readBody();
      if (!body || !body.comment) {
        return sendJson(400, { error: 'Comment text is required' });
      }
      const saved = db.addAdminComment({
        jobId,
        author: body.author || 'Admin (Web)',
        comment: body.comment,
      });
      return sendJson(201, { comment: saved });
    }

    if (subAction === 'download' && method === 'GET') {
      const job = db.getJobById(jobId);
      if (!job) return sendJson(404, { error: 'Job not found' });
      db.updateJob(jobId, { download_count: (job.download_count || 0) + 1 });
      return sendJson(200, {
        ok: true,
        downloadToken: job.download_token,
        fileName: job.output_file_name,
        fileSize: job.output_file_size,
      });
    }
  }

  // ─────────────────────────────────────────────────────────
  // 3. User Tracking Endpoints
  // ─────────────────────────────────────────────────────────
  if (pathname === '/api/users/register' && method === 'POST') {
    const body = await readBody();
    const result = db.registerUser(body || {});

    if (result.isNew) {
      telegramService.notifyNewUser(result.user).catch((err) => {
        console.error('[API] notifyNewUser failed:', err.message);
      });
    }

    return sendJson(200, result);
  }

  if (pathname === '/api/users' && method === 'GET') {
    const users = db.listUsers();
    return sendJson(200, { users });
  }

  // ─────────────────────────────────────────────────────────
  // 4. Admin Analytics & Settings Endpoints
  // ─────────────────────────────────────────────────────────
  if (pathname === '/api/admin/stats' && method === 'GET') {
    const stats = db.getStats();
    return sendJson(200, { stats });
  }

  if (pathname === '/api/admin/audit' && method === 'GET') {
    const logs = db.listAuditLogs();
    return sendJson(200, { logs });
  }

  if (pathname === '/api/admin/telegram-settings' && method === 'GET') {
    const settings = db.getNotificationSettings();
    return sendJson(200, { settings });
  }

  if (pathname === '/api/admin/telegram-settings' && method === 'POST') {
    const body = await readBody();
    const updated = db.updateNotificationSettings(body || {});
    db.addAuditLog('update_telegram_settings', 'Admin (Web)', body);
    return sendJson(200, { settings: updated });
  }

  if (pathname === '/api/admin/telegram-test' && method === 'POST') {
    const res = await telegramService.sendTestNotification();
    return sendJson(200, { result: res });
  }

  // ─────────────────────────────────────────────────────────
  // 5. Telegram Webhook Endpoint
  // ─────────────────────────────────────────────────────────
  if (pathname === '/api/telegram/webhook' && method === 'POST') {
    const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
    const update = await readBody();
    const result = await telegramService.handleWebhookUpdate(update, secretHeader);
    return sendJson(result.status || 200, result);
  }

  // Not found
  return sendJson(404, { error: 'API endpoint not found', path: pathname });
}

