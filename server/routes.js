// ============================================================
// CONVET PULSE — Server API Router
// Dispatches REST endpoints for health, jobs, visitors, users, admin,
// telegram, premium configuration, site display controls, and analytics.
// ============================================================

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
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

  // Determine secure CORS origin (never use wildcard with credentials)
  const reqOrigin = req.headers.origin || '';
  const allowedOrigins = [
    'https://convetpulse.onrender.com',
    'http://localhost:5000',
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.APP_URL,
  ].filter(Boolean);

  const isAllowedOrigin = allowedOrigins.includes(reqOrigin) || (reqOrigin && reqOrigin.endsWith('.onrender.com'));
  const safeCorsOrigin = isAllowedOrigin ? reqOrigin : (allowedOrigins[0] || 'https://convetpulse.onrender.com');

  // JSON responder helper
  const sendJson = (statusCode, data, extraHeaders = {}) => {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Access-Control-Allow-Origin': safeCorsOrigin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token, X-Admin-Token',
      ...extraHeaders,
    });
    res.end(JSON.stringify(data));
  };

  // Helper to read raw & parsed JSON body
  let rawBody = '';
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
        rawBody = data;
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
  // PDF Cryptographic Security Endpoints (QPDF Integration)
  // ─────────────────────────────────────────────────────────
  if (pathname === '/api/pdf/encrypt' && method === 'POST') {
    let hasQpdf = false;
    try {
      execFileSync('qpdf', ['--version'], { stdio: 'ignore' });
      hasQpdf = true;
    } catch {
      hasQpdf = false;
    }

    if (!hasQpdf) {
      return sendJson(501, {
        error: 'SYSTEM_BINARY_NOT_FOUND',
        message: 'QPDF binary is not installed on this host environment. Genuine ISO 32000-2 AES-256 PDF encryption requires the QPDF system package. Pseudo-encryption will never be generated to protect document security.',
        requirement: 'Render Native Node does not include qpdf by default. See deployment instructions in docs/RENDER_QPDF_SETUP.md or convert render.yaml service to Docker environment.',
      });
    }

    const body = await readBody();
    if (!body || !body.fileBase64) {
      return sendJson(400, { error: 'fileBase64 is required' });
    }

    const userPassword = String(body.userPassword || body.password || '');
    const ownerPassword = String(body.ownerPassword || userPassword);
    if (!userPassword) {
      return sendJson(400, { error: 'userPassword is required' });
    }

    const tempDir = os.tmpdir();
    const uniqueId = crypto.randomUUID();
    const inPath = path.join(tempDir, `qpdf_in_${uniqueId}.pdf`);
    const outPath = path.join(tempDir, `qpdf_out_${uniqueId}.pdf`);

    try {
      const inBuffer = Buffer.from(body.fileBase64, 'base64');
      fs.writeFileSync(inPath, inBuffer);

      // Safe argument vector prevents shell injection
      execFileSync('qpdf', [
        '--encrypt',
        userPassword,
        ownerPassword,
        '256',
        '--',
        inPath,
        outPath,
      ]);

      const outBuffer = fs.readFileSync(outPath);
      return sendJson(200, {
        success: true,
        fileBase64: outBuffer.toString('base64'),
        size: outBuffer.length,
      });
    } catch (err) {
      return sendJson(500, { error: 'Encryption failed: ' + (err.message || 'QPDF execution error') });
    } finally {
      try { if (fs.existsSync(inPath)) fs.unlinkSync(inPath); } catch {}
      try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch {}
    }
  }

  if (pathname === '/api/pdf/decrypt' && method === 'POST') {
    let hasQpdf = false;
    try {
      execFileSync('qpdf', ['--version'], { stdio: 'ignore' });
      hasQpdf = true;
    } catch {
      hasQpdf = false;
    }

    if (!hasQpdf) {
      return sendJson(501, {
        error: 'SYSTEM_BINARY_NOT_FOUND',
        message: 'QPDF binary is not installed on this host environment. Genuine cryptographic PDF stream decryption requires the QPDF system package. Pseudo-decryption will never be generated to protect document integrity.',
        requirement: 'Render Native Node does not include qpdf by default. See deployment instructions in docs/RENDER_QPDF_SETUP.md or convert render.yaml service to Docker environment.',
      });
    }

    const body = await readBody();
    if (!body || !body.fileBase64) {
      return sendJson(400, { error: 'fileBase64 is required' });
    }

    const password = String(body.password || '');
    const tempDir = os.tmpdir();
    const uniqueId = crypto.randomUUID();
    const inPath = path.join(tempDir, `qpdf_in_${uniqueId}.pdf`);
    const outPath = path.join(tempDir, `qpdf_out_${uniqueId}.pdf`);

    try {
      const inBuffer = Buffer.from(body.fileBase64, 'base64');
      fs.writeFileSync(inPath, inBuffer);

      // Safe argument vector prevents shell injection
      execFileSync('qpdf', [
        `--password=${password}`,
        '--decrypt',
        inPath,
        outPath,
      ]);

      const outBuffer = fs.readFileSync(outPath);
      return sendJson(200, {
        success: true,
        fileBase64: outBuffer.toString('base64'),
        size: outBuffer.length,
      });
    } catch (err) {
      return sendJson(401, { error: 'Decryption failed: Incorrect password or invalid encrypted PDF format.' });
    } finally {
      try { if (fs.existsSync(inPath)) fs.unlinkSync(inPath); } catch {}
      try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch {}
    }
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
  // 5b. Razorpay Payments & Entitlements
  // ─────────────────────────────────────────────────────────
  if (pathname === '/api/payment/config' && method === 'GET') {
    const keyId = process.env.RAZORPAY_KEY_ID || '';
    const isConfigured = Boolean(keyId && process.env.RAZORPAY_KEY_SECRET);
    const premConfig = getPremiumConfig();
    return sendJson(200, {
      enabled: isConfigured && (premConfig?.premium?.enabled ?? true),
      configured: isConfigured,
      keyId: keyId,
      currency: premConfig?.premium?.price?.currency || 'INR',
      amount: premConfig?.premium?.price?.amount || 499,
      isTestMode: keyId.startsWith('rzp_test_'),
    });
  }

  if (pathname === '/api/payment/create-order' && method === 'POST') {
    const keyId = process.env.RAZORPAY_KEY_ID || '';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || '';

    if (!keyId || !keySecret) {
      return sendJson(503, {
        error: 'Razorpay payment gateway is not configured. Please configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Render environment variables.',
        configured: false,
      });
    }

    const body = await readBody();
    const userId = body?.userId;
    const userEmail = body?.userEmail || null;
    const plan = (body?.plan || 'pro').toLowerCase();

    if (!userId) {
      return sendJson(401, { error: 'Authentication required to create a payment order' });
    }

    // Amount and currency derived strictly from trusted server configuration
    const premConfig = getPremiumConfig();
    const amountInRupees = premConfig?.premium?.price?.amount || 499;
    const currency = premConfig?.premium?.price?.currency || 'INR';
    const amountInPaise = Math.round(amountInRupees * 100);
    const receipt = `rcpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    try {
      let rzpData;
      if (keyId.startsWith('rzp_test_mock')) {
        rzpData = {
          id: `order_mock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          amount: amountInPaise,
          currency,
          status: 'created',
        };
      } else {
        const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({
            amount: amountInPaise,
            currency,
            receipt,
            notes: {
              userId: String(userId),
              userEmail: userEmail || '',
              plan,
            },
          }),
        });

        rzpData = await rzpRes.json();
        if (!rzpRes.ok) {
          console.error('[Razorpay Order Creation Error]', rzpData);
          return sendJson(502, { error: rzpData.error?.description || 'Failed to create Razorpay order' });
        }
      }

      db.createPaymentOrder({
        orderId: rzpData.id,
        userId: String(userId),
        userEmail,
        plan,
        amount: amountInPaise,
        currency,
      });

      return sendJson(200, {
        success: true,
        ok: true,
        orderId: rzpData.id,
        amount: rzpData.amount,
        currency: rzpData.currency,
        keyId,
        plan,
      });
    } catch (err) {
      console.error('[Payment API Error]', err.message);
      return sendJson(500, { error: 'Internal payment gateway communication error' });
    }
  }

  if (pathname === '/api/payment/verify-payment' && method === 'POST') {
    const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    if (!keySecret) {
      return sendJson(503, { error: 'Payment verification unavailable: gateway secrets not configured.' });
    }

    const body = await readBody();
    const razorpay_order_id = body?.razorpay_order_id || body?.orderId;
    const razorpay_payment_id = body?.razorpay_payment_id || body?.paymentId;
    const razorpay_signature = body?.razorpay_signature || body?.signature;
    const userId = body?.userId;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return sendJson(400, { success: false, ok: false, error: 'Missing required Razorpay payment signature parameters' });
    }

    // Cryptographic HMAC SHA256 verification
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    let isValidSignature = false;
    try {
      isValidSignature = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(razorpay_signature, 'hex')
      );
    } catch {
      isValidSignature = false;
    }

    if (!isValidSignature) {
      db.addAuditLog('payment_verification_failed', userId || 'anonymous', {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        reason: 'HMAC signature mismatch',
      });
      return sendJson(400, { success: false, ok: false, error: 'Invalid payment signature verification' });
    }

    const order = db.getPaymentOrderByOrderId(razorpay_order_id);
    if (!order) {
      return sendJson(404, { success: false, ok: false, error: 'Payment order record not found' });
    }

    if (userId && order.user_id && order.user_id !== userId) {
      return sendJson(403, { success: false, ok: false, error: 'Payment order does not belong to the authenticated user' });
    }

    // Idempotent processing
    if (order.status === 'paid') {
      return sendJson(200, {
        success: true,
        ok: true,
        status: 'active',
        plan: order.plan,
        alreadyProcessed: true,
        message: 'Payment was already verified successfully.',
      });
    }

    db.markPaymentSuccess({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    const targetUser = order.user_id || userId;
    const entitlement = db.grantPremiumEntitlement({
      userId: targetUser,
      plan: order.plan,
      amountPaid: order.amount / 100,
      currency: order.currency,
    });

    db.addAuditLog('payment_verified', targetUser, {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      amount: order.amount / 100,
      currency: order.currency,
    });

    telegramService.notifyPaymentReceived({
      user_id: targetUser,
      user_email: order.user_email,
      order_id: razorpay_order_id,
      amount: order.amount,
      currency: order.currency,
      plan: order.plan,
    }).catch(() => {});

    return sendJson(200, {
      success: true,
      ok: true,
      status: 'active',
      plan: entitlement.plan,
      message: 'Payment verified successfully. Premium Pro membership is now active!',
    });
  }

  if (pathname === '/api/payment/webhook' && method === 'POST') {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    const receivedSig = req.headers['x-razorpay-signature'];
    const body = await readBody();

    if (webhookSecret && receivedSig) {
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      let isValid = false;
      try {
        isValid = crypto.timingSafeEqual(Buffer.from(expectedSig, 'hex'), Buffer.from(receivedSig, 'hex'));
      } catch {
        isValid = false;
      }

      if (!isValid) {
        return sendJson(400, { error: 'Invalid webhook signature' });
      }
    }

    const event = body?.event;
    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = body?.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;
      if (orderId && paymentId) {
        const order = db.getPaymentOrderByOrderId(orderId);
        if (order && order.status !== 'paid') {
          db.markPaymentSuccess({ orderId, paymentId, signature: 'webhook' });
          db.grantPremiumEntitlement({
            userId: order.user_id,
            plan: order.plan,
            amountPaid: order.amount / 100,
            currency: order.currency,
          });
        }
      }
    }

    return sendJson(200, { status: 'ok' });
  }

  // ─────────────────────────────────────────────────────────
  // 5c. User Auth Events & Usage Tracking
  // ─────────────────────────────────────────────────────────
  if (pathname === '/api/auth/login-event' && method === 'POST') {
    const body = await readBody();
    const { email, name, provider, userId } = body || {};
    if (!userId && !email) {
      return sendJson(400, { error: 'User identifier required' });
    }
    await telegramService.notifySuccessfulLogin({ id: userId || email, name, email }, provider || 'Email & Password').catch(() => {});
    return sendJson(200, { ok: true, success: true });
  }

  if (pathname === '/api/auth/app-open' && method === 'POST') {
    const body = await readBody();
    const { userId, name, email } = body || {};
    if (!userId) {
      return sendJson(400, { error: 'Authenticated userId required' });
    }
    const notified = await telegramService.notifyAppOpen({ id: userId, name, email });
    return sendJson(200, { ok: true, success: true, notified: Boolean(notified), deduplicated: !notified });
  }

  if (pathname === '/api/user/usage' && method === 'GET') {
    const userId = url.searchParams.get('userId');
    if (!userId) {
      return sendJson(400, { error: 'userId parameter is required' });
    }
    const usage = db.getUserUsageStats(userId);
    return sendJson(200, { usage });
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

    let usageStats = null;
    if (updated) {
      // Persistent scoped usage tracking (idempotent, only for genuine successful completions)
      const userId = updated.user_id || body.userId || 'anonymous';
      usageStats = db.recordSuccessfulUsage({
        userId,
        actionSlug: updated.tool_slug,
        actionCategory: updated.category || 'conversion',
        jobId: updated.id,
      });

      telegramService.notifyConversionCompleted(updated, usageStats).catch((err) => {
        console.error('[API] notifyConversionCompleted failed:', err.message);
      });
    }

    return sendJson(200, { job: updated, usage: usageStats });
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
