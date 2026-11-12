// ============================================================
// CONVET PULSE — Server API Router
// Dispatches REST endpoints for health, jobs, visitors, users, admin,
// telegram, premium configuration, site display controls, and analytics.
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
import {
  getSiteDisplayConfig,
  getPublicSiteDisplayConfig,
  updateSiteDisplayConfig,
  resetSiteDisplayConfig,
  isToolVisible,
  isToolEnabled,
  isToolUnderMaintenance,
  isToolPremium,
  isCategoryVisible,
} from './site-display.js';

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
  // 1. Health Check Endpoint
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
        maintenanceMode: isMaintenanceMode() || getSiteDisplayConfig().global?.maintenanceMode || false,
      },
      siteDisplay: {
        version: getSiteDisplayConfig().version,
        lastModified: getSiteDisplayConfig().lastModified,
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: process.memoryUsage().rss,
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  // 2. Site Display Configuration Endpoints
  // ─────────────────────────────────────────────────────────
  if (pathname === '/api/site-config/public' && method === 'GET') {
    return sendJson(200, { config: getPublicSiteDisplayConfig() });
  }

  if (pathname === '/api/admin/site-config' && method === 'GET') {
    const session = requireAdmin(req);
    if (!session) {
      return sendJson(401, { error: 'Unauthorized: Admin session required' });
    }
    return sendJson(200, { config: getSiteDisplayConfig() });
  }

  if (pathname === '/api/admin/site-config' && (method === 'POST' || method === 'PUT')) {
    const session = requireAdmin(req);
    if (!session) {
      return sendJson(401, { error: 'Unauthorized: Admin session required' });
    }
    const body = await readBody();
    const result = updateSiteDisplayConfig(body || {});
    if (!result.success) {
      return sendJson(400, { error: result.error || 'Failed to update site display configuration' });
    }

    db.addAuditLog('admin_update_site_display', 'Admin', body);
    telegramService.notifyAdminConfigChange(
      'Website Display Controls Updated',
      'Administrator modified website section visibility or tool availability'
    ).catch(() => {});

    return sendJson(200, { ok: true, config: result.config });
  }

  if (pathname === '/api/admin/site-config/reset' && method === 'POST') {
    const session = requireAdmin(req);
    if (!session) {
      return sendJson(401, { error: 'Unauthorized: Admin session required' });
    }
    const result = resetSiteDisplayConfig();
    db.addAuditLog('admin_reset_site_display', 'Admin', 'Reset site display config to defaults');
    return sendJson(200, { ok: true, config: result.config });
  }

  // ─────────────────────────────────────────────────────────
  // 3. Real Visitor Tracking Endpoint
  // ─────────────────────────────────────────────────────────
  if (pathname === '/api/visitors/ping' && method === 'POST') {
    const body = await readBody();
    if (body?.visitorId) {
      db.recordVisitor({
        id: body.visitorId,
        isAuthenticated: Boolean(body.isAuthenticated),
        userId: body.userId || null,
      });
    }
    return sendJson(200, { ok: true });
  }

  // ─────────────────────────────────────────────────────────
  // 4. Live Analytics Summary (Public / Dashboard Safe)
  // ─────────────────────────────────────────────────────────
  if (pathname === '/api/analytics/summary' && method === 'GET') {
    const range = url.searchParams.get('range') || 'all';
    const stats = db.getDetailedStats(range);
    // Sanitize to public metrics without PII
    return sendJson(200, {
      summary: {
        completedJobs: stats.completedJobs,
        successfulConversions: stats.successfulConversions,
        failedJobs: stats.failedJobs,
        activeJobs: stats.activeJobs,
        totalJobs: stats.totalJobs,
        successRate: stats.successRate,
        avgProcessingTimeMs: stats.avgProcessingTimeMs,
        totalDataProcessedBytes: stats.totalDataProcessedBytes,
        totalBytesSaved: stats.totalBytesSaved,
        todayCount: stats.todayCount,
        weekCount: stats.weekCount,
        monthCount: stats.monthCount,
        dailyTrends: stats.dailyTrends,
        toolUsage: stats.toolUsage,
        fileTypeDistribution: stats.fileTypeDistribution,
        timezone: stats.timezone,
        systemHealth: stats.systemHealth,
        lastUpdated: new Date().toISOString(),
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  // 5. Public Premium Configuration
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

    if (isMaintenanceMode() || isToolUnderMaintenance(toolSlug)) {
      return sendJson(503, {
        authorized: false,
        maintenance: true,
        message: 'This conversion tool is currently undergoing scheduled maintenance.',
      });
    }

    if (!isToolEnabled(toolSlug)) {
      return sendJson(403, {
        authorized: false,
        disabled: true,
        error: 'This tool is currently disabled by administrator.',
      });
    }

    const isRestricted = isToolPremium(toolSlug) || isToolPremiumRestricted(toolSlug);
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

    return sendJson(200, {
      authorized: true,
      restricted: isRestricted,
      visible: isToolVisible(toolSlug),
    });
  }

  // ─────────────────────────────────────────────────────────
  // 6. Admin Authentication & Session Endpoints
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
  // 7. Admin Premium Management Endpoints
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
  // 8. Admin Analytics & Telemetry Endpoints
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
  // 9. Conversion Jobs Endpoints (Real Conversion Tracking)
  // ─────────────────────────────────────────────────────────
  if (pathname === '/api/jobs/start' && method === 'POST') {
    const body = await readBody();
    if (!body || !body.toolSlug) {
      return sendJson(400, { error: 'toolSlug is required' });
    }

    const toolSlug = body.toolSlug;

    // Check system maintenance
    if (isMaintenanceMode() || isToolUnderMaintenance(toolSlug)) {
      return sendJson(503, {
        error: 'This tool is currently undergoing scheduled maintenance',
        maintenance: true,
      });
    }

    // Check tool enabled status
    if (!isToolEnabled(toolSlug)) {
      return sendJson(403, {
        error: 'This conversion tool is currently disabled by administrator',
        disabled: true,
      });
    }

    // Verify premium restriction
    const restricted = isToolPremium(toolSlug) || isToolPremiumRestricted(toolSlug);
    if (restricted && !body.isPremiumUser) {
      return sendJson(403, {
        error: 'Premium subscription required for this tool',
        restricted: true,
      });
    }

    const job = db.createJob({
      ...body,
      status: 'processing',
      processingStartedAt: new Date().toISOString(),
      fileSizeBytes: body.inputFileSize || 0,
    });

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

    const existingJob = db.getJobById(body.id);
    if (!existingJob) {
      return sendJson(404, { error: 'Job not found' });
    }

    // Verify ownership via job token
    const clientToken = body.jobToken || body.job_token || body.token;
    if (existingJob.job_token) {
      if (!clientToken || clientToken !== existingJob.job_token) {
        return sendJson(403, { error: 'Unauthorized: Invalid or missing job token' });
      }
    }

    // Prevent duplicate updates or invalid state transitions
    if (['completed', 'failed', 'cancelled'].includes(existingJob.status)) {
      return sendJson(409, {
        error: `Job is already in a terminal state (${existingJob.status})`,
        job: existingJob,
      });
    }

    // Verify valid output file was generated
    const outputFileName = (body.outputFileName || '').trim();
    if (!outputFileName) {
      return sendJson(400, { error: 'outputFileName is required for completed conversions' });
    }

    const nowIso = new Date().toISOString();
    const updated = db.updateJob(body.id, {
      status: 'completed',
      output_file_name: outputFileName,
      output_file_size: Math.max(0, parseInt(body.outputFileSize, 10) || 0),
      output_format: (body.outputFormat || '').trim() || null,
      file_size_bytes: Math.max(0, parseInt(body.fileSizeBytes || body.outputFileSize, 10) || 0),
      duration_ms: Math.max(0, parseInt(body.durationMs, 10) || 0),
      processing_duration_ms: Math.max(0, parseInt(body.durationMs, 10) || 0),
      processing_completed_at: nowIso,
      completed_at: nowIso,
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

    const existingJob = db.getJobById(body.id);
    if (!existingJob) {
      return sendJson(404, { error: 'Job not found' });
    }

    // Verify ownership via job token
    const clientToken = body.jobToken || body.job_token || body.token;
    if (existingJob.job_token) {
      if (!clientToken || clientToken !== existingJob.job_token) {
        return sendJson(403, { error: 'Unauthorized: Invalid or missing job token' });
      }
    }

    // Prevent duplicate updates or overriding a completed job
    if (['completed', 'failed', 'cancelled'].includes(existingJob.status)) {
      return sendJson(409, {
        error: `Job is already in a terminal state (${existingJob.status})`,
        job: existingJob,
      });
    }

    const nowIso = new Date().toISOString();
    const updated = db.updateJob(body.id, {
      status: 'failed',
      duration_ms: Math.max(0, parseInt(body.durationMs, 10) || 0),
      processing_duration_ms: Math.max(0, parseInt(body.durationMs, 10) || 0),
      error_code: body.errorCode || 'CONVERSION_FAILED',
      error_summary: (body.errorSummary || 'Processing failed').slice(0, 500),
      processing_completed_at: nowIso,
      completed_at: nowIso,
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
    const isAdmin = Boolean(requireAdmin(req));
    const status = url.searchParams.get('status') || 'all';
    const toolSlug = url.searchParams.get('tool') || 'all';
    const timeRange = url.searchParams.get('range') || 'all';
    const search = url.searchParams.get('search') || '';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    let jobs = db.listJobs({ status, toolSlug, search, limit, offset, timeRange });
    const totalCount = db.countJobs({ status, toolSlug, search, timeRange });

    // Sanitize sensitive tokens and email for non-admin requests
    if (!isAdmin) {
      jobs = jobs.map((j) => {
        const { job_token, download_token, user_email, ...safe } = j;
        return safe;
      });
    }

    return sendJson(200, {
      jobs,
      count: jobs.length,
      totalCount,
      limit,
      offset,
      page: Math.floor(offset / limit) + 1,
    });
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
  // 10. User Registration Tracking Endpoints
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
  // 11. Telegram Webhook Endpoint
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
