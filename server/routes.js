// ============================================================
// CONVETER — Server API Router
// Dispatches REST endpoints for health, jobs, users, admin, telegram,
// premium configuration, authentication, and real-time telemetry.
// ============================================================

import { db } from './db.js';
import { telegramService } from './telegram.js';
import {
  requireAdmin,
  login,
  authenticate,
  changePassword,
  logout,
  mustChangePassword,
} from './auth.js';
import {
  getPremiumConfig,
  getPublicPremiumConfig,
  updatePremiumConfig,
  updatePremiumTools,
  isToolPremiumRestricted,
  isMaintenanceMode,
} from './premium.js';

export async function handleApiRoute(req, res, url) {
  const method = req.method;
  const pathname = url.pathname;

  // JSON responder helper
  const sendJson = (statusCode, data, extraHeaders = {}) => {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token, X-Admin-Token',
      ...extraHeaders,
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
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
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
      premium: {
        enabled: getPublicPremiumConfig().enabled,
        maintenanceMode: isMaintenanceMode(),
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: process.memoryUsage().rss,
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  // 2. Public Premium Configuration
  // ─────────────────────────────────────────────────────────
  if (pathname === '/api/premium/config' && method === 'GET') {
    return sendJson(200, { config: getPublicPremiumConfig() });
  }

  // Verify access to a specific conversion tool
  if (pathname === '/api/premium/verify-access' && method === 'POST') {
    const body = await readBody();
    const toolSlug = body?.toolSlug;
    const isPremiumUser = Boolean(body?.isPremiumUser);

    if (!toolSlug) {
      return sendJson(400, { error: 'toolSlug is required' });
    }

    if (isMaintenanceMode()) {
      return sendJson(503, {
        authorized: false,
        maintenance: true,
        message: 'The conversion platform is currently undergoing scheduled maintenance.',
      });
    }

    const isRestricted = isToolPremiumRestricted(toolSlug);
    if (isRestricted && !isPremiumUser) {
      return sendJson(403, {
        authorized: false,
        restricted: true,
        error: 'This tool requires an active Premium membership.',
      });
    }

    // Log notification if a premium tool was accessed
    if (isRestricted) {
      telegramService.notifyPremiumAccess(
        { id: body?.userId || 'anon', name: body?.userName || 'User' },
        toolSlug
      ).catch(() => {});
    }

    return sendJson(200, { authorized: true, restricted: isRestricted });
  }

  // ─────────────────────────────────────────────────────────
  // 3. Admin Authentication & Session Endpoints
  // ─────────────────────────────────────────────────────────
  if (pathname === '/api/admin/login' && method === 'POST') {
    const rateCheck = await login(req);
    if (!rateCheck.success) {
      return sendJson(429, { error: rateCheck.error, retryAfter: rateCheck.retryAfter });
    }

    const body = await readBody();
    const username = (body?.username || '').trim();
    const password = body?.password || '';

    if (!username || !password) {
      return sendJson(400, { error: 'Username and password are required' });
    }

    const authResult = await authenticate(username, password, rateCheck.ip);
    if (!authResult.success) {
      db.addAuditLog('admin_login_failed', username, { ip: rateCheck.ip, reason: authResult.error });
      return sendJson(401, { error: authResult.error });
    }

    db.addAuditLog('admin_login_success', username, { ip: rateCheck.ip });
    return sendJson(
      200,
      {
        ok: true,
        mustChangePassword: authResult.mustChangePassword,
        message: 'Authentication successful',
      },
      { 'Set-Cookie': authResult.cookie }
    );
  }

  if (pathname === '/api/admin/logout' && method === 'POST') {
    const clearCookie = logout(req);
    return sendJson(200, { ok: true, message: 'Logged out successfully' }, { 'Set-Cookie': clearCookie });
  }

  if (pathname === '/api/admin/session' && method === 'GET') {
    const session = requireAdmin(req);
    if (!session) {
      return sendJson(200, { authenticated: false });
    }
    return sendJson(200, {
      authenticated: true,
      mustChangePassword: mustChangePassword(),
    });
  }

  if (pathname === '/api/admin/change-password' && method === 'POST') {
    const session = requireAdmin(req);
    if (!session) {
      return sendJson(401, { error: 'Unauthorized: Admin session required' });
    }

    const body = await readBody();
    const currentPassword = body?.currentPassword;
    const newPassword = body?.newPassword;

    if (!currentPassword || !newPassword) {
      return sendJson(400, { error: 'Current password and new password are required' });
    }

    const result = await changePassword(currentPassword, newPassword);
    if (!result.success) {
      return sendJson(400, { error: result.error });
    }

    db.addAuditLog('admin_password_changed', 'admin', { ip: session.ip });
    telegramService.notifyAdminConfigChange('Admin Password Changed', 'Administrator credentials were updated.').catch(() => {});

    return sendJson(200, { ok: true, message: 'Password updated successfully' });
  }

  // ─────────────────────────────────────────────────────────
  // 4. Admin Premium Management Endpoints
  // ─────────────────────────────────────────────────────────
  if (pathname === '/api/admin/premium-config' && method === 'GET') {
    const session = requireAdmin(req);
    if (!session) {
      return sendJson(401, { error: 'Unauthorized: Admin session required' });
    }
    return sendJson(200, { config: getPremiumConfig() });
  }

  if (pathname === '/api/admin/premium-config' && method === 'POST') {
    const session = requireAdmin(req);
    if (!session) {
      return sendJson(401, { error: 'Unauthorized: Admin session required' });
    }

    const body = await readBody();
    const result = updatePremiumConfig(body || {});
    if (!result.success) {
      return sendJson(400, { error: 'Validation failed', details: result.errors });
    }

    db.addAuditLog('admin_update_premium_config', 'Admin', body);
    telegramService.notifyAdminConfigChange('Premium Configuration Updated', body).catch(() => {});

    return sendJson(200, { ok: true, config: result.config });
  }

  if (pathname === '/api/admin/premium-tools' && method === 'POST') {
    const session = requireAdmin(req);
    if (!session) {
      return sendJson(401, { error: 'Unauthorized: Admin session required' });
    }

    const body = await readBody();
    const toolSlugs = body?.allowedTools;
    if (!Array.isArray(toolSlugs)) {
      return sendJson(400, { error: 'allowedTools must be an array of tool slugs' });
    }

    const result = updatePremiumTools(toolSlugs);
    db.addAuditLog('admin_update_premium_tools', 'Admin', { allowedTools: toolSlugs });
    telegramService.notifyAdminConfigChange('Premium Tools Availability Changed', { allowedTools: toolSlugs }).catch(() => {});

    return sendJson(200, { ok: true, allowedTools: result.allowedTools });
  }

  // ─────────────────────────────────────────────────────────
  // 5. Admin Analytics & Telemetry Endpoints
  // ─────────────────────────────────────────────────────────
  if (pathname === '/api/admin/stats' && method === 'GET') {
    const timeRange = url.searchParams.get('range') || 'all';
    const stats = db.getDetailedStats(timeRange);
    return sendJson(200, { stats });
  }

  if (pathname === '/api/admin/detailed-stats' && method === 'GET') {
    const timeRange = url.searchParams.get('range') || 'all';
    const stats = db.getDetailedStats(timeRange);
    return sendJson(200, { stats });
  }

  if (pathname === '/api/admin/audit' && method === 'GET') {
    const session = requireAdmin(req);
    if (!session) {
      return sendJson(401, { error: 'Unauthorized: Admin session required' });
    }
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const logs = db.listAuditLogs({ limit });
    return sendJson(200, { logs });
  }

  if (pathname === '/api/admin/notification-log' && method === 'GET') {
    const session = requireAdmin(req);
    if (!session) {
      return sendJson(401, { error: 'Unauthorized: Admin session required' });
    }
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const logs = db.listNotificationLogs({ limit });
    return sendJson(200, { logs });
  }

  if (pathname === '/api/admin/telegram-diagnostics' && method === 'GET') {
    const session = requireAdmin(req);
    if (!session) {
      return sendJson(401, { error: 'Unauthorized: Admin session required' });
    }
    const diagnostics = await telegramService.getDiagnostics();
    return sendJson(200, { diagnostics });
  }

  if (pathname === '/api/admin/telegram-settings' && method === 'GET') {
    const session = requireAdmin(req);
    if (!session) {
      return sendJson(401, { error: 'Unauthorized: Admin session required' });
    }
    const settings = db.getNotificationSettings();
    return sendJson(200, { settings });
  }

  if (pathname === '/api/admin/telegram-settings' && method === 'POST') {
    const session = requireAdmin(req);
    if (!session) {
      return sendJson(401, { error: 'Unauthorized: Admin session required' });
    }
    const body = await readBody();
    const updated = db.updateNotificationSettings(body || {});
    db.addAuditLog('update_telegram_settings', 'Admin (Web)', body);
    telegramService.notifyAdminConfigChange('Telegram Notification Settings Updated', body).catch(() => {});
    return sendJson(200, { settings: updated });
  }

  if (pathname === '/api/admin/telegram-test' && method === 'POST') {
    const session = requireAdmin(req);
    if (!session) {
      return sendJson(401, { error: 'Unauthorized: Admin session required' });
    }
    const res = await telegramService.sendTestNotification();
    return sendJson(200, { result: res });
  }

  // ─────────────────────────────────────────────────────────
  // 6. Conversion Jobs Endpoints (Preserved & Enhanced)
  // ─────────────────────────────────────────────────────────
  if (pathname === '/api/jobs/start' && method === 'POST') {
    const body = await readBody();
    if (!body || !body.toolSlug) {
      return sendJson(400, { error: 'toolSlug is required' });
    }

    // Verify premium restriction
    if (isToolPremiumRestricted(body.toolSlug) && !body.isPremiumUser) {
      return sendJson(403, { error: 'Premium subscription required for this tool', restricted: true });
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
    const timeRange = url.searchParams.get('range') || 'all';
    const search = url.searchParams.get('search') || '';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const jobs = db.listJobs({ status, toolSlug, search, limit, offset, timeRange });
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
  // 7. User Registration Tracking Endpoints
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
    const session = requireAdmin(req);
    if (!session) {
      return sendJson(401, { error: 'Unauthorized: Admin session required' });
    }
    const users = db.listUsers();
    return sendJson(200, { users });
  }

  // ─────────────────────────────────────────────────────────
  // 8. Telegram Webhook Endpoint
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
