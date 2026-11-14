// ============================================================
// CONVETER — Telegram Bot Service & Admin Notification System
// Handles:
// 1. Admin notifications (New User, Conversion Started/Completed/Failed,
//    File Error, Premium Access, Admin Config Changes, System Errors)
// 2. Retry logic with exponential backoff & delivery logging to DB
// 3. Diagnostics & Telegram Bot API health verification (/getMe)
// 4. Two-way webhook command interface (/start, /help, /status, /job, /comment, /recent, /stats)
// 5. Rate-limiting, deduplication, and webhook secret validation
// ============================================================

import { db } from './db.js';

// Environment variables (dynamically resolved to allow live config / test env / backward compatibility with Render names)
export const getBotToken = () =>
  (process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '').trim();
export const getAdminChatId = () =>
  (process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.ADMIN_CHAT_ID || '').trim();
export const getWebhookSecret = () =>
  (process.env.TELEGRAM_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '').trim();

// Canonical production HTTPS URL (ending with slash as required)
export const PRODUCTION_URL = 'https://convetpulse.onrender.com/';

// Known obsolete / deprecated domains that must NEVER be used
export const DEPRECATED_DOMAINS = [
  'conveter-4rmd.onrender.com',
  'conveter.onrender.com',
];

/**
 * Checks if any environment variable attempts to override the URL with an obsolete domain
 */
export function checkEnvironmentUrlOverrides() {
  const varsToCheck = [
    'APP_URL',
    'DASHBOARD_URL',
    'FRONTEND_URL',
    'RENDER_EXTERNAL_URL',
    'RENDER_URL',
  ];
  const overrides = [];

  for (const varName of varsToCheck) {
    const rawVal = process.env[varName];
    if (rawVal) {
      const val = String(rawVal).trim();
      const isDeprecated = DEPRECATED_DOMAINS.some((domain) => val.includes(domain));
      overrides.push({
        varName,
        isDeprecated,
        domain: val.replace(/^https?:\/\//, '').split('/')[0],
      });
      if (isDeprecated) {
        console.warn(
          `[CRITICAL CONFIG WARNING] Environment variable ${varName} is configured with obsolete Render domain ("${val}"). ` +
          `CONVET PULSE will safely ignore this and use canonical URL: ${PRODUCTION_URL}. ` +
          `ACTION REQUIRED: Update ${varName} to https://convetpulse.onrender.com/ in your Render Environment settings!`
        );
      }
    }
  }

  return overrides;
}

/**
 * Returns a validated production-safe HTTPS Dashboard URL ending with /
 */
export function getDashboardUrl() {
  // Check common URL environment variables
  const envUrl = (
    process.env.APP_URL ||
    process.env.DASHBOARD_URL ||
    process.env.FRONTEND_URL ||
    ''
  ).trim();

  // If environment variable contains a known obsolete domain, log warning and discard
  if (envUrl) {
    const hasDeprecatedDomain = DEPRECATED_DOMAINS.some((domain) => envUrl.includes(domain));
    if (hasDeprecatedDomain) {
      console.warn(
        `[Config Warning] Outdated Render domain detected in environment variable: "${envUrl}". ` +
        `Falling back to canonical production URL: ${PRODUCTION_URL}. Please update APP_URL in your Render settings!`
      );
      return PRODUCTION_URL;
    }
  }

  if (!envUrl) return PRODUCTION_URL;

  // In production, reject localhost or non-https URLs
  if (process.env.NODE_ENV === 'production') {
    if (envUrl.includes('localhost') || envUrl.startsWith('http://') || !envUrl.startsWith('https://')) {
      return PRODUCTION_URL;
    }
  }

  try {
    const parsed = new URL(envUrl);
    if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && process.env.NODE_ENV !== 'production')) {
      const clean = envUrl.replace(/\/+$/, '');
      return `${clean}/`;
    }
  } catch {
    // Malformed URL, use production fallback
  }

  return PRODUCTION_URL;
}

/**
 * Returns the authenticated Admin Console URL
 */
export function getAdminDashboardUrl(query = '') {
  const base = getDashboardUrl().replace(/\/+$/, '');
  const suffix = query ? `/admin${query.startsWith('?') ? query : `?${query}`}` : '/admin';
  return `${base}${suffix}`;
}

/**
 * Builds standard Telegram inline_keyboard containing the validated "🌐 View Dashboard" button
 */
export function createDashboardKeyboard(extraRows = []) {
  const url = getDashboardUrl();
  const primaryRow = [{ text: '🌐 View Dashboard', url }];
  const keyboard = [primaryRow];

  if (Array.isArray(extraRows) && extraRows.length > 0) {
    for (const row of extraRows) {
      if (Array.isArray(row) && row.length > 0) {
        keyboard.push(row);
      }
    }
  }

  return { inline_keyboard: keyboard };
}

// In-process cache for sub-second high-concurrency requests, backed by persistent DB dedupe
const dedupeCache = new Map();
const DEDUPE_TTL_MS = 30000;

export function clearDedupeKey(key) {
  if (!key) return;
  dedupeCache.delete(key);
  if (db && typeof db.clearDedupe === 'function') {
    db.clearDedupe(key);
  }
}

export function isDuplicate(key, ttlMs = DEDUPE_TTL_MS, eventType = '', entityId = '') {
  // 1. Check persistent SQLite/JSON store deduplication (survives restarts)
  if (db && typeof db.checkAndSetDedupe === 'function') {
    return db.checkAndSetDedupe(key, ttlMs, eventType, entityId);
  }

  // 2. Fallback to in-process memory map
  const now = Date.now();
  if (dedupeCache.has(key)) {
    const ts = dedupeCache.get(key);
    if (now - ts < ttlMs) return true;
  }
  dedupeCache.set(key, now);
  if (dedupeCache.size > 2000) {
    for (const [k, v] of dedupeCache.entries()) {
      if (now - v > ttlMs) dedupeCache.delete(k);
    }
  }
  return false;
}

// Human-readable action mappings (never reveal internal slugs/raw operation IDs)
export const ACTION_DESCRIPTIONS = {
  'merge-pdf': 'Combined multiple PDF files into one document',
  'split-pdf': 'Split PDF document into individual pages',
  'compress-pdf': 'Optimized and compressed PDF file size',
  'rotate-pdf': 'Adjusted PDF page rotation and orientation',
  'jpg-to-pdf': 'Converted image files into a PDF document',
  'pdf-to-text': 'Extracted readable text content from a PDF document',
  'image-converter': 'Converted image to target graphic format',
  'image-compressor': 'Compressed image while optimizing visual quality',
  'image-resizer': 'Resized image dimensions to specified scale',
  'image-cropper': 'Cropped image to target aspect ratio',
  'csv-to-json': 'Converted tabular CSV data into structured JSON',
  'json-to-csv': 'Converted structured JSON data into tabular CSV format',
  'csv-to-excel': 'Exported CSV data into Excel spreadsheet (.xlsx)',
  'excel-to-csv': 'Extracted spreadsheet sheet data into CSV format',
  'qr-generator': 'Generated high-resolution QR code graphic',
  'zip-create': 'Created compressed ZIP file archive',
  'zip-extract': 'Extracted files from compressed ZIP archive',
};

export function getHumanReadableAction(slug, fallbackName) {
  if (slug && ACTION_DESCRIPTIONS[slug]) return ACTION_DESCRIPTIONS[slug];
  if (fallbackName) return `Completed ${fallbackName} operation successfully`;
  return 'Your requested operation was completed successfully.';
}

// Format file size nicely
function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// Delay helper for retry backoff
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Low-level Telegram sendMessage API with retry logic and database audit logging
export async function sendTelegramMessage(chatId, text, options = {}, eventType = 'custom') {
  const botToken = getBotToken();
  const targetChatId = chatId || getAdminChatId();

  if (!botToken || !targetChatId) {
    console.log('[Telegram Mock] (No TELEGRAM_BOT_TOKEN/CHAT_ID set) ->', text.slice(0, 100).replace(/\n/g, ' '));
    db.addNotificationLog({
      eventType,
      status: 'mocked',
      chatId: targetChatId || 'none',
      errorMessage: !botToken ? 'TELEGRAM_BOT_TOKEN not configured' : 'TELEGRAM_CHAT_ID not configured',
    });
    return { ok: true, mocked: true, message_id: null, status: 'mocked' };
  }

  // Validate and sanitize inline keyboard URLs before dispatching
  const replyMarkup = options.replyMarkup ? JSON.parse(JSON.stringify(options.replyMarkup)) : undefined;
  if (replyMarkup?.inline_keyboard) {
    for (const row of replyMarkup.inline_keyboard) {
      if (Array.isArray(row)) {
        for (const btn of row) {
          if (btn.url && typeof btn.url === 'string') {
            // Force-replace any deprecated Render domain with canonical domain
            for (const deprecated of DEPRECATED_DOMAINS) {
              if (btn.url.includes(deprecated)) {
                btn.url = btn.url.replace(deprecated, 'convetpulse.onrender.com');
              }
            }
            try {
              const parsed = new URL(btn.url);
              if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
                btn.url = getDashboardUrl();
              }
            } catch {
              btn.url = getDashboardUrl();
            }
          }
        }
      }
    }
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body = {
    chat_id: targetChatId,
    text,
    parse_mode: options.parseMode || 'HTML',
    disable_web_page_preview: options.disablePreview ?? true,
    reply_markup: replyMarkup,
  };

  const maxRetries = options.maxRetries ?? 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(options.timeoutMs || 10000),
      });

      const data = await res.json();
      if (data.ok) {
        db.addNotificationLog({
          eventType,
          status: attempt > 1 ? 'retried' : 'sent',
          chatId: targetChatId,
          messageId: data.result?.message_id,
          retryCount: attempt - 1,
        });
        return { ok: true, mocked: false, message_id: data.result?.message_id, status: 'sent', result: data.result };
      }

      lastError = data.description || 'Unknown Telegram API error';
      console.warn(`[Telegram Attempt ${attempt}/${maxRetries} Error]:`, lastError);

      // Don't retry permanent client/auth errors (bad request, unauthorized bot token, or bot blocked)
      if (data.error_code === 400 || data.error_code === 401 || data.error_code === 403) {
        break;
      }

      // Rate limit (429) backoff
      if (data.error_code === 429) {
        const retryAfter = data.parameters?.retry_after || 2;
        await sleep(retryAfter * 1000);
        continue;
      }
    } catch (err) {
      lastError = err.message;
      console.warn(`[Telegram Attempt ${attempt}/${maxRetries} Network Error]:`, err.message);
    }

    if (attempt < maxRetries) {
      // Exponential backoff: 1s, 2s, 4s...
      await sleep(Math.pow(2, attempt - 1) * 1000);
    }
  }

  // Record permanent failure in database
  db.addNotificationLog({
    eventType,
    status: 'failed',
    chatId: targetChatId,
    errorMessage: lastError,
    retryCount: maxRetries,
  });

  return { ok: false, mocked: false, error: lastError, status: 'failed' };
}

// ─────────────────────────────────────────────────────────────
// Notification Handlers
// ─────────────────────────────────────────────────────────────
export const telegramService = {
  isConfigured() {
    return Boolean(getBotToken() && getAdminChatId());
  },

  getPublicStatus() {
    return {
      configured: Boolean(getBotToken() && getAdminChatId()),
      hasToken: Boolean(getBotToken()),
      hasChatId: Boolean(getAdminChatId()),
      hasSecret: Boolean(getWebhookSecret()),
    };
  },

  /**
   * Diagnostic Check: verify bot token with Telegram /getMe endpoint
   */
  async getDiagnostics() {
    const botToken = getBotToken();
    const adminChatId = getAdminChatId();
    const webhookSecret = getWebhookSecret();
    const base = {
      configured: Boolean(botToken && adminChatId),
      hasToken: Boolean(botToken),
      hasChatId: Boolean(adminChatId),
      hasSecret: Boolean(webhookSecret),
      botInfo: null,
      apiReachable: false,
      lastError: null,
    };

    if (!botToken) {
      base.lastError = 'TELEGRAM_BOT_TOKEN environment variable is not configured.';
      return base;
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const data = await res.json();
      if (data.ok) {
        base.apiReachable = true;
        base.botInfo = {
          id: data.result.id,
          name: data.result.first_name,
          username: data.result.username,
        };
      } else {
        base.lastError = data.description || 'Invalid Telegram bot token.';
      }
    } catch (err) {
      base.lastError = `Network connection error: ${err.message}`;
    }

    return base;
  },

  /**
   * New Visitor Notification (Deduplicated with 24h window)
   */
  async notifyNewVisitor({ visitorId, page = 'Homepage', isAuthenticated = false, userId = null }) {
    const settings = db.getNotificationSettings();
    if (settings.notify_new_visitor === false) return false;

    const dedupeKey = `visitor_new_${visitorId}`;
    if (isDuplicate(dedupeKey, 24 * 60 * 60 * 1000, 'new_visitor', visitorId)) {
      return false;
    }

    const timeStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    const shortId = visitorId ? (visitorId.length > 12 ? visitorId.slice(0, 12) + '...' : visitorId) : 'anon';
    const visitorType = isAuthenticated ? 'Authenticated Visitor' : 'Anonymous Visitor';

    const msg = [
      '🚀 <b>CONVET PULSE — NEW VISITOR</b>',
      '',
      `👤 <b>Visitor:</b> ${escapeHtml(visitorType)}`,
      `🌐 <b>Page:</b> ${escapeHtml(page)}`,
      `🕒 <b>Time:</b> ${timeStr}`,
      `🆔 <b>Visitor ID:</b> <code>${escapeHtml(shortId)}</code>`,
      '',
      '📊 <b>VISITOR ACTIVITY</b>',
      '• New visitor detected',
      '• Session status: Active',
    ].join('\n');

    const replyMarkup = createDashboardKeyboard();
    const res = await sendTelegramMessage(getAdminChatId(), msg, { replyMarkup }, 'new_visitor');
    if (!res || !res.ok) {
      clearDedupeKey(dedupeKey);
    }
    db.addAuditLog('telegram_notification', 'TelegramBot', { event: 'new_visitor', visitorId: shortId });
    return res;
  },

  /**
   * Returning Visitor Notification (Configurable & Deduplicated with cooldown)
   */
  async notifyReturningVisitor({ visitorId, page = 'Homepage', pageViews = 2, isAuthenticated = false }) {
    const settings = db.getNotificationSettings();
    if (settings.notify_returning_visitor !== true) return false;

    const cooldownMinutes = Number(settings.visitor_cooldown_minutes) || 30;
    const cooldownMs = cooldownMinutes * 60 * 1000;
    const dedupeKey = `visitor_return_${visitorId}`;

    if (isDuplicate(dedupeKey, cooldownMs, 'returning_visitor', visitorId)) {
      return false;
    }

    const timeStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    const shortId = visitorId ? (visitorId.length > 12 ? visitorId.slice(0, 12) + '...' : visitorId) : 'anon';

    const msg = [
      '🔄 <b>CONVET PULSE — RETURNING VISITOR</b>',
      '',
      `👤 <b>Visitor:</b> ${isAuthenticated ? 'Authenticated Visitor' : 'Returning Visitor'}`,
      `🌐 <b>Page:</b> ${escapeHtml(page)}`,
      `🕒 <b>Time:</b> ${timeStr}`,
      `🆔 <b>Visitor ID:</b> <code>${escapeHtml(shortId)}</code>`,
      `📄 <b>Total Pageviews:</b> ${pageViews}`,
    ].join('\n');

    const replyMarkup = createDashboardKeyboard();
    const res = await sendTelegramMessage(getAdminChatId(), msg, { replyMarkup }, 'returning_visitor');
    if (!res || !res.ok) {
      clearDedupeKey(dedupeKey);
    }
    return res;
  },

  /**
   * New User Registration Notification
   */
  async notifyNewUser(user) {
    const settings = db.getNotificationSettings();
    if (!settings.notify_new_user) return false;

    const entityId = user.email || user.id;
    const dedupeKey = `user_reg_${entityId}`;
    if (isDuplicate(dedupeKey, 24 * 60 * 60 * 1000, 'user_registered', entityId)) {
      return false;
    }

    const timeStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    const displayName = user.name || 'Registered User';
    const emailDisplay = user.email ? escapeHtml(user.email) : '<i>Not provided</i>';

    const msg = [
      '👤 <b>NEW USER REGISTRATION</b>',
      '',
      `👤 <b>Name:</b> ${escapeHtml(displayName)}`,
      `📧 <b>Email:</b> ${emailDisplay}`,
      `🕒 <b>Time:</b> ${timeStr}`,
      'ℹ️ <b>Account Status:</b> Active',
      '🌐 <b>Platform:</b> CONVET PULSE',
    ].join('\n');

    const replyMarkup = createDashboardKeyboard();
    const res = await sendTelegramMessage(getAdminChatId(), msg, { replyMarkup }, 'user_registered');
    if (!res || !res.ok) {
      clearDedupeKey(dedupeKey);
    }
    db.addAuditLog('telegram_notification', 'TelegramBot', { event: 'user_registered', userId: user.id });
    return res;
  },

  /**
   * Successful User Login Notification
   */
  async notifySuccessfulLogin(user, provider = 'Email & Password') {
    const settings = db.getNotificationSettings();
    if (settings.notify_user_login === false) return;

    const dedupeKey = `login_${user.id}_${Math.floor(Date.now() / 60000)}`;
    if (isDuplicate(dedupeKey, 60000, 'user_login', user.id)) return;

    const timeStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    const userDisplay = user.name || user.displayName || 'User';
    const emailDisplay = user.email || 'Not provided';

    const msg = [
      '🟢 <b>CONVET PULSE — User Login</b>',
      '',
      `👤 <b>User:</b> ${escapeHtml(userDisplay)}`,
      `📧 <b>Email:</b> ${escapeHtml(emailDisplay)}`,
      `🔑 <b>Provider:</b> ${escapeHtml(provider)}`,
      `🕒 <b>Time:</b> ${timeStr}`,
      'ℹ️ <b>Status:</b> User authenticated successfully.',
    ].join('\n');

    const replyMarkup = createDashboardKeyboard();
    const res = await sendTelegramMessage(getAdminChatId(), msg, { replyMarkup }, 'user_login');
    if (!res || !res.ok) {
      clearDedupeKey(dedupeKey);
    }
    db.addAuditLog('telegram_notification', 'TelegramBot', { event: 'user_login', userId: user.id });
  },

  /**
   * Authenticated App-Open Notification (Deduplicated with 15m window)
   */
  async notifyAppOpen(user) {
    const settings = db.getNotificationSettings();
    if (settings.notify_app_open === false) return false;

    // Deduplicate per user for 15 minutes (900,000 ms)
    const dedupeKey = `app_open_${user.id}`;
    if (isDuplicate(dedupeKey, 15 * 60 * 1000, 'app_open', user.id)) return false;

    const timeStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    const userDisplay = user.name || user.displayName || 'User';
    const emailDisplay = user.email || 'Verified Account';

    const msg = [
      '📱 <b>CONVET PULSE — Authenticated User Visit</b>',
      '',
      `👤 <b>User:</b> ${escapeHtml(userDisplay)}`,
      `📧 <b>Email:</b> ${escapeHtml(emailDisplay)}`,
      `🕒 <b>Time:</b> ${timeStr}`,
      'ℹ️ <b>Status:</b> Authenticated user opened the application.',
    ].join('\n');

    const replyMarkup = createDashboardKeyboard();
    const res = await sendTelegramMessage(getAdminChatId(), msg, { replyMarkup }, 'app_open');
    if (!res || !res.ok) {
      clearDedupeKey(dedupeKey);
    }
    db.addAuditLog('telegram_notification', 'TelegramBot', { event: 'app_open', userId: user.id });
    return true;
  },

  /**
   * Premium Payment Received Notification
   */
  async notifyPaymentReceived(payment) {
    const settings = db.getNotificationSettings();
    if (settings.notify_payment_received === false) return false;

    const dedupeKey = `payment_success_${payment.order_id || payment.id}`;
    if (isDuplicate(dedupeKey, 86400 * 1000, 'payment_success', payment.order_id)) {
      return false;
    }

    const timeStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    const amountVal = typeof payment.amount === 'number' && payment.amount > 1000
      ? (payment.amount / 100).toFixed(0)
      : payment.amount;

    const userDisplay = payment.user_email || payment.userId || payment.user_id || 'Customer';
    const planName = (payment.plan || 'PREMIUM PRO').toUpperCase();
    const orderRef = payment.order_id || payment.orderId || 'N/A';

    const msg = [
      '💳 <b>PAYMENT SUCCESSFUL</b>',
      '',
      `👤 <b>User:</b> ${escapeHtml(userDisplay)}`,
      `⭐ <b>Plan:</b> ${escapeHtml(planName)}`,
      `💰 <b>Amount:</b> ₹${amountVal} ${escapeHtml(payment.currency || 'INR')}`,
      `💳 <b>Reference:</b> <code>${escapeHtml(orderRef)}</code>`,
      `🕒 <b>Time:</b> ${timeStr}`,
      '✅ <b>Status:</b> Verified & Activated',
    ].join('\n');

    const replyMarkup = createDashboardKeyboard();
    const res = await sendTelegramMessage(getAdminChatId(), msg, { replyMarkup }, 'payment_success');
    if (!res || !res.ok) {
      clearDedupeKey(dedupeKey);
    }
    db.addAuditLog('telegram_notification', 'TelegramBot', { event: 'payment_success', orderId: orderRef });
    return res;
  },

  /**
   * Conversion Started Notification
   */
  async notifyConversionStarted(job) {
    const settings = db.getNotificationSettings();
    if (!settings.notify_conversion_started) return;

    const dedupeKey = `start_${job.id}`;
    if (isDuplicate(dedupeKey, 60000, 'conversion_started', job.id)) return;

    const timeStr = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const msg = [
      '⚙️ <b>CONVERSION STARTED</b>',
      '',
      `👤 <b>User:</b> ${escapeHtml(job.userName || 'Anonymous User')}`,
      `🔧 <b>Tool:</b> ${escapeHtml(job.toolName || job.tool_name)}`,
      `📂 <b>Input:</b> ${escapeHtml(job.inputFileName || 'file')}`,
      `📤 <b>Output:</b> ${escapeHtml(job.outputFormat ? `.${job.outputFormat}` : 'Pending')}`,
      `📦 <b>File Size:</b> ${formatSize(job.inputFileSize || job.file_size_bytes)}`,
      `🕒 <b>Started:</b> ${timeStr}`,
      `🆔 <b>Job ID:</b> <code>${escapeHtml(job.id)}</code>`,
    ].join('\n');

    const replyMarkup = createDashboardKeyboard([
      [
        { text: '🔍 Check Status', callback_data: `status:${job.id}` },
        { text: '💬 Add Comment', callback_data: `comment:${job.id}` },
      ],
    ]);

    const res = await sendTelegramMessage(getAdminChatId(), msg, { replyMarkup }, 'conversion_started');
    if (!res || !res.ok) {
      clearDedupeKey(dedupeKey);
    }
    db.addAuditLog('telegram_notification', 'TelegramBot', { event: 'conversion_started', jobId: job.id });
    return res;
  },

  /**
   * Conversion Completed Notification
   */
  async notifyConversionCompleted(job, usageStats = null) {
    const settings = db.getNotificationSettings();
    if (!settings.notify_conversion_completed) return false;

    const dedupeKey = `complete_${job.id}`;
    if (isDuplicate(dedupeKey, 3600 * 1000, 'conversion_completed', job.id)) {
      return false;
    }

    const durationSec = typeof job.durationMs === 'number'
      ? (job.durationMs / 1000).toFixed(1)
      : typeof job.duration_ms === 'number'
      ? (job.duration_ms / 1000).toFixed(1)
      : '1.0';

    const inputFormat = job.inputFormat || (job.inputFileName ? job.inputFileName.split('.').pop() : 'file');
    const outputFormat = job.outputFormat || (job.outputFileName ? job.outputFileName.split('.').pop() : 'converted');
    const timeStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

    const msg = [
      '✅ <b>CONVERSION COMPLETED</b>',
      '',
      `🔧 <b>Tool:</b> ${escapeHtml(job.toolName || job.tool_name || 'File Converter')}`,
      `📂 <b>Input Format:</b> .${escapeHtml(inputFormat.replace(/^\./, ''))}`,
      `📤 <b>Output Format:</b> .${escapeHtml(outputFormat.replace(/^\./, ''))}`,
      `⏱ <b>Duration:</b> ${durationSec}s`,
      `🕒 <b>Time:</b> ${timeStr}`,
      '📊 <b>Status:</b> Success',
    ].join('\n');

    const replyMarkup = createDashboardKeyboard();
    const res = await sendTelegramMessage(getAdminChatId(), msg, { replyMarkup }, 'conversion_completed');
    if (!res || !res.ok) {
      clearDedupeKey(dedupeKey);
    }
    db.addAuditLog('telegram_notification', 'TelegramBot', { event: 'conversion_completed', jobId: job.id });
    return res;
  },

  /**
   * Failed Conversion Notification
   */
  async notifyConversionFailed(job) {
    const settings = db.getNotificationSettings();
    if (!settings.notify_conversion_failed) return;

    const dedupeKey = `fail_${job.id}`;
    if (isDuplicate(dedupeKey, 60000, 'conversion_failed', job.id)) return;

    const durationSec = ((job.durationMs || job.duration_ms || 1000) / 1000).toFixed(1);

    const msg = [
      '❌ <b>CONVERSION FAILED</b>',
      '',
      `👤 <b>User:</b> ${escapeHtml(job.userName || 'Anonymous User')}`,
      `🔧 <b>Tool:</b> ${escapeHtml(job.toolName || job.tool_name)}`,
      `🆔 <b>Job ID:</b> <code>${escapeHtml(job.id)}</code>`,
      `⚠️ <b>Error Category:</b> ${escapeHtml(job.errorCategory || 'Processing Error')}`,
      `📋 <b>Summary:</b> ${escapeHtml(job.errorSummary || 'File processing could not be completed.')}`,
      `⏱ <b>Processing Duration:</b> ${durationSec}s`,
      `🔄 <b>Retry Status:</b> Eligible for client retry`,
    ].join('\n');

    const replyMarkup = createDashboardKeyboard([
      [
        { text: '💬 Add Comment', callback_data: `comment:${job.id}` },
      ],
    ]);

    const res = await sendTelegramMessage(getAdminChatId(), msg, { replyMarkup }, 'conversion_failed');
    if (!res || !res.ok) {
      clearDedupeKey(dedupeKey);
    }
    db.addAuditLog('telegram_notification', 'TelegramBot', { event: 'conversion_failed', jobId: job.id });
    return res;
  },

  /**
   * File Processing Error Notification
   */
  async notifyFileProcessingError({ toolName, fileName, errorDetails }) {
    const settings = db.getNotificationSettings();
    if (!settings.notify_conversion_failed) return;

    const dedupeKey = `file_err_${toolName}_${fileName}`;
    if (isDuplicate(dedupeKey, 60000, 'file_processing_error', `${toolName}_${fileName}`)) return;

    const msg = [
      '⚠️ <b>FILE PROCESSING ERROR</b>',
      '',
      `🔧 <b>Tool:</b> ${escapeHtml(toolName)}`,
      `📂 <b>File:</b> ${escapeHtml(fileName)}`,
      `📋 <b>Details:</b> ${escapeHtml(errorDetails || 'Unexpected file processing failure.')}`,
      `🕒 <b>Time:</b> ${new Date().toISOString()}`,
    ].join('\n');

    const replyMarkup = createDashboardKeyboard();
    const res = await sendTelegramMessage(getAdminChatId(), msg, { replyMarkup }, 'file_processing_error');
    if (!res || !res.ok) {
      clearDedupeKey(dedupeKey);
    }
    db.addAuditLog('telegram_notification', 'TelegramBot', { event: 'file_processing_error', toolName, fileName });
  },

  /**
   * Premium Tool Access Notification
   */
  async notifyPremiumAccess(user, toolName) {
    const settings = db.getNotificationSettings();
    if (!settings.notify_premium_access) return;

    const dedupeKey = `prem_acc_${user?.id || 'anon'}_${toolName}`;
    if (isDuplicate(dedupeKey, 60000, 'premium_access', `${user?.id}_${toolName}`)) return;

    const msg = [
      '⭐ <b>PREMIUM TOOL ACCESSED</b>',
      '',
      `👤 <b>User:</b> ${escapeHtml(user?.name || 'Anonymous User')}`,
      `🆔 <b>User ID:</b> <code>${escapeHtml(user?.id || 'N/A')}</code>`,
      `🔧 <b>Tool:</b> ${escapeHtml(toolName)}`,
      `🕒 <b>Time:</b> ${new Date().toLocaleString()}`,
    ].join('\n');

    const replyMarkup = createDashboardKeyboard();
    const res = await sendTelegramMessage(getAdminChatId(), msg, { replyMarkup }, 'premium_tool_access');
    if (!res || !res.ok) {
      clearDedupeKey(dedupeKey);
    }
    db.addAuditLog('telegram_notification', 'TelegramBot', { event: 'premium_access', toolName, userId: user?.id });
  },

  /**
   * Admin Config Change Notification
   */
  async notifyAdminConfigChange(changeType, details) {
    const settings = db.getNotificationSettings();
    if (!settings.notify_admin_changes) return;

    const msg = [
      '🛡️ <b>ADMIN CONFIGURATION CHANGED</b>',
      '',
      `⚙️ <b>Action:</b> ${escapeHtml(changeType)}`,
      `📋 <b>Details:</b> ${escapeHtml(typeof details === 'object' ? JSON.stringify(details, null, 2) : details)}`,
      `🕒 <b>Timestamp:</b> ${new Date().toLocaleString()}`,
    ].join('\n');

    const replyMarkup = createDashboardKeyboard();
    await sendTelegramMessage(getAdminChatId(), msg, { replyMarkup }, 'admin_config_change');
  },

  /**
   * System Error Notification (Sanitized safe diagnostics without secrets)
   */
  async notifySystemError(error, context = 'Server') {
    const settings = db.getNotificationSettings();
    if (!settings.notify_system_errors) return false;

    const rawMsg = error?.message || String(error);
    // Sanitize: take primary error line and truncate to 150 chars (no tokens or secrets)
    const safeDiagnostic = rawMsg.split('\n')[0].slice(0, 150);

    const dedupeKey = `sys_err_${context}_${safeDiagnostic}`;
    if (isDuplicate(dedupeKey, 5 * 60 * 1000, 'system_error', context)) return false;

    const timeStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

    const msg = [
      '⚠️ <b>SYSTEM ALERT</b>',
      '',
      `🌐 <b>Component:</b> ${escapeHtml(context)}`,
      `⚠️ <b>Category:</b> System Exception`,
      `🕒 <b>Time:</b> ${timeStr}`,
      `📋 <b>Details:</b> ${escapeHtml(safeDiagnostic)}`,
    ].join('\n');

    // Include both the public Dashboard button and the direct Admin Console button for fast administrative triage
    const replyMarkup = createDashboardKeyboard([
      [{ text: '🔐 Admin Console', url: getAdminDashboardUrl() }],
    ]);
    const res = await sendTelegramMessage(getAdminChatId(), msg, { replyMarkup }, 'system_error');
    if (!res || !res.ok) {
      clearDedupeKey(dedupeKey);
    }
    db.addAuditLog('telegram_notification', 'System', { event: 'system_error', context, error: safeDiagnostic });
    return res;
  },

  /**
   * Send Test Notification
   */
  async sendTestNotification() {
    const testMsg = [
      '🔔 <b>CONVET PULSE TELEGRAM TEST ALERT</b>',
      '',
      'Your Telegram notification integration is working properly!',
      `📅 <b>Timestamp:</b> ${new Date().toISOString()}`,
      `🌐 <b>Target:</b> Admin Chat <code>${getAdminChatId() || 'Local Mock'}</code>`,
      `⚙️ <b>Server:</b> CONVET PULSE Production Platform`,
    ].join('\n');

    const replyMarkup = createDashboardKeyboard();
    return sendTelegramMessage(getAdminChatId(), testMsg, { replyMarkup }, 'test_alert');
  },

  // ─────────────────────────────────────────────────────────────
  // Telegram Bot Webhook & Admin Command System
  // ─────────────────────────────────────────────────────────────
  async handleWebhookUpdate(update, secretHeader) {
    const webhookSecret = getWebhookSecret();
    if (webhookSecret && secretHeader !== webhookSecret) {
      console.warn('[Telegram Webhook] Invalid secret token header received');
      return { status: 403, error: 'Unauthorized webhook request' };
    }

    if (update.callback_query) {
      return this.handleCallbackQuery(update.callback_query);
    }

    const message = update.message;
    if (!message) return { status: 200, message: 'No actionable message' };

    const chatId = String(message.chat.id);
    const userId = String(message.from?.id || '');
    const userDisplayName = message.from?.first_name || 'Admin';

    const adminChatId = getAdminChatId();
    if (adminChatId && chatId !== adminChatId && userId !== adminChatId) {
      console.warn(`[Telegram Webhook] Unauthorized access attempt from chatId: ${chatId}, userId: ${userId}`);
      await sendTelegramMessage(chatId, '⛔ <b>Unauthorized:</b> You do not have administrator permissions for this CONVET instance.');
      return { status: 200, message: 'Unauthorized sender' };
    }

    const text = (message.text || '').trim();

    if (message.reply_to_message && text && !text.startsWith('/')) {
      const replyText = message.reply_to_message.text || '';
      const jobMatch = replyText.match(/Job ID:\s*([A-Za-z0-9_-]+)/i);
      if (jobMatch) {
        const jobId = jobMatch[1];
        const saved = db.addAdminComment({
          jobId,
          author: `Telegram Admin (${userDisplayName})`,
          comment: text,
          telegramMessageId: message.message_id,
        });

        await sendTelegramMessage(
          chatId,
          `💬 <b>ADMIN COMMENT RECORDED</b>\n\n<b>Job ID:</b> <code>${jobId}</code>\n<b>Comment:</b> "${escapeHtml(text)}"\n\n✅ <i>Associated with job and visible in Admin Dashboard.</i>`
        );
        db.addAuditLog('telegram_admin_comment', userDisplayName, { jobId, commentId: saved.id });
        return { status: 200, message: 'Reply comment saved' };
      }
    }

    if (text.startsWith('/start')) {
      const welcome = [
        '👋 <b>Welcome to CONVET PULSE Admin Bot</b>',
        '',
        'This bot delivers real-time conversion alerts and allows two-way administration.',
        '',
        '<b>Available Commands:</b>',
        '• <code>/status JOB-ID</code> — Check live status of a job',
        '• <code>/job JOB-ID</code> — Full metadata & comments for a job',
        '• <code>/comment JOB-ID Your comment</code> — Add note to job',
        '• <code>/recent</code> — View 5 most recent conversion jobs',
        '• <code>/stats</code> — View platform conversion analytics',
        '• <code>/help</code> — Show this manual',
        '',
        `🌐 Dashboard: <a href="${getDashboardUrl()}">${getDashboardUrl()}</a>`,
      ].join('\n');
      const replyMarkup = createDashboardKeyboard([
        [{ text: '📊 Admin Console', url: getAdminDashboardUrl() }],
      ]);
      await sendTelegramMessage(chatId, welcome, { replyMarkup });
      return { status: 200, message: 'Start handled' };
    }

    if (text.startsWith('/help')) {
      const help = [
        '📖 <b>CONVET Admin Bot Reference</b>',
        '',
        '<b>Commands:</b>',
        '• <code>/status &lt;job_id&gt;</code> — Quick status lookup',
        '• <code>/job &lt;job_id&gt;</code> — In-depth job inspection',
        '• <code>/comment &lt;job_id&gt; &lt;text&gt;</code> — Record an audit comment',
        '• <code>/recent</code> — List last 5 system jobs',
        '• <code>/stats</code> — System KPIs & tool usage statistics',
        '',
        '<b>Interactive Features:</b>',
        '• Reply directly to any conversion alert to add a comment.',
        '• Use inline buttons beneath alerts for one-tap actions.',
      ].join('\n');
      const replyMarkup = createDashboardKeyboard();
      await sendTelegramMessage(chatId, help, { replyMarkup });
      return { status: 200, message: 'Help handled' };
    }

    if (text.startsWith('/status')) {
      const parts = text.split(/\s+/);
      const jobId = parts[1];
      if (!jobId) {
        await sendTelegramMessage(chatId, '⚠️ Please specify a Job ID. Example:\n<code>/status JOB-12345</code>', { replyMarkup: createDashboardKeyboard() });
        return { status: 200 };
      }

      const job = db.getJobById(jobId);
      if (!job) {
        await sendTelegramMessage(chatId, `❌ Job <code>${escapeHtml(jobId)}</code> not found.`, { replyMarkup: createDashboardKeyboard() });
        return { status: 200 };
      }

      const statusIcon = job.status === 'completed' ? '✅' : job.status === 'failed' ? '❌' : '⚙️';
      const msg = [
        `${statusIcon} <b>JOB STATUS: ${escapeHtml(job.status.toUpperCase())}</b>`,
        '',
        `🆔 <b>Job ID:</b> <code>${job.id}</code>`,
        `🔧 <b>Tool:</b> ${escapeHtml(job.tool_name)}`,
        `👤 <b>User:</b> ${escapeHtml(job.user_name || 'Anonymous')}`,
        `📂 <b>File:</b> ${escapeHtml(job.input_file_name)} (${formatSize(job.input_file_size)})`,
        `⏱ <b>Duration:</b> ${(job.duration_ms / 1000).toFixed(1)}s`,
        `📅 <b>Created:</b> ${new Date(job.created_at).toLocaleString()}`,
      ].join('\n');

      const replyMarkup = createDashboardKeyboard([
        [{ text: '🔍 View Details', url: getAdminDashboardUrl(`?job=${job.id}`) }],
      ]);
      await sendTelegramMessage(chatId, msg, { replyMarkup });
      return { status: 200 };
    }

    if (text.startsWith('/job')) {
      const parts = text.split(/\s+/);
      const jobId = parts[1];
      if (!jobId) {
        await sendTelegramMessage(chatId, '⚠️ Please specify a Job ID. Example:\n<code>/job JOB-12345</code>', { replyMarkup: createDashboardKeyboard() });
        return { status: 200 };
      }

      const job = db.getJobById(jobId);
      if (!job) {
        await sendTelegramMessage(chatId, `❌ Job <code>${escapeHtml(jobId)}</code> not found.`, { replyMarkup: createDashboardKeyboard() });
        return { status: 200 };
      }

      const comments = db.getCommentsForJob(jobId);
      const commentsText = comments.length > 0
        ? comments.map((c) => `• <i>${escapeHtml(c.author)}</i>: "${escapeHtml(c.comment)}"`).join('\n')
        : '<i>None yet</i>';

      const msg = [
        `📋 <b>JOB RECORD: ${escapeHtml(job.id)}</b>`,
        '',
        `🔧 <b>Tool:</b> ${escapeHtml(job.tool_name)} (<code>${job.tool_slug}</code>)`,
        `👤 <b>User:</b> ${escapeHtml(job.user_name)} (${escapeHtml(job.user_id)})`,
        `📂 <b>Input:</b> ${escapeHtml(job.input_file_name)} (${formatSize(job.input_file_size)})`,
        `📤 <b>Output:</b> ${escapeHtml(job.output_file_name || 'N/A')} (${formatSize(job.output_file_size)})`,
        `📊 <b>Status:</b> ${job.status.toUpperCase()}`,
        `⏱ <b>Duration:</b> ${(job.duration_ms / 1000).toFixed(1)}s`,
        `📅 <b>Timestamp:</b> ${new Date(job.created_at).toLocaleString()}`,
        '',
        '💬 <b>Admin Comments:</b>',
        commentsText,
      ].join('\n');

      const replyMarkup = createDashboardKeyboard([
        [
          { text: '💬 Add Comment', callback_data: `comment:${job.id}` },
          { text: '📊 Admin Dashboard', url: getAdminDashboardUrl(`?job=${job.id}`) },
        ],
      ]);
      await sendTelegramMessage(chatId, msg, { replyMarkup });
      return { status: 200 };
    }

    if (text.startsWith('/comment')) {
      const parts = text.split(/\s+/);
      const jobId = parts[1];
      const commentBody = parts.slice(2).join(' ').trim();

      if (!jobId || !commentBody) {
        await sendTelegramMessage(
          chatId,
          '⚠️ Usage: <code>/comment &lt;JOB-ID&gt; &lt;your comment&gt;</code>\nExample:\n<code>/comment JOB-12345 Output verified successfully.</code>',
          { replyMarkup: createDashboardKeyboard() }
        );
        return { status: 200 };
      }

      const job = db.getJobById(jobId);
      if (!job) {
        await sendTelegramMessage(chatId, `❌ Cannot comment: Job <code>${escapeHtml(jobId)}</code> was not found.`, { replyMarkup: createDashboardKeyboard() });
        return { status: 200 };
      }

      db.addAdminComment({
        jobId,
        author: `Admin (${userDisplayName})`,
        comment: commentBody,
        telegramMessageId: message.message_id,
      });

      await sendTelegramMessage(
        chatId,
        `✅ <b>Comment recorded for ${escapeHtml(jobId)}:</b>\n"${escapeHtml(commentBody)}"`,
        { replyMarkup: createDashboardKeyboard() }
      );
      db.addAuditLog('telegram_admin_command_comment', userDisplayName, { jobId });
      return { status: 200 };
    }

    if (text.startsWith('/recent')) {
      const recentJobs = db.listJobs({ limit: 5 });
      if (recentJobs.length === 0) {
        await sendTelegramMessage(chatId, 'ℹ️ No conversion jobs recorded yet.', { replyMarkup: createDashboardKeyboard() });
        return { status: 200 };
      }

      const lines = recentJobs.map((j) => {
        const icon = j.status === 'completed' ? '✅' : j.status === 'failed' ? '❌' : '⚙️';
        return `${icon} <code>${j.id}</code> — <b>${escapeHtml(j.tool_name)}</b>\n   File: ${escapeHtml(j.input_file_name)} | ${new Date(j.created_at).toLocaleTimeString()}`;
      });

      const msg = ['🕒 <b>LAST 5 CONVERSIONS:</b>', '', ...lines].join('\n');
      await sendTelegramMessage(chatId, msg, { replyMarkup: createDashboardKeyboard() });
      return { status: 200 };
    }

    if (text.startsWith('/stats')) {
      const stats = db.getStats();
      const msg = [
        '📊 <b>CONVET PLATFORM ANALYTICS</b>',
        '',
        `⚡ <b>Total Jobs:</b> ${stats.totalJobs}`,
        `✅ <b>Completed:</b> ${stats.completedJobs} (${stats.successRate}%)`,
        `❌ <b>Failed:</b> ${stats.failedJobs}`,
        `⚙️ <b>Active / In-Flight:</b> ${stats.activeJobs}`,
        `👤 <b>Registered Users:</b> ${stats.totalUsers}`,
        `💾 <b>Bandwidth / Storage Saved:</b> ${formatSize(stats.totalBytesSaved)}`,
        `⏱ <b>Avg Processing Duration:</b> ${(stats.avgProcessingTimeMs / 1000).toFixed(1)}s`,
        '',
        '🔥 <b>Top Tools:</b>',
        ...stats.toolUsage.slice(0, 5).map((t, i) => `${i + 1}. ${escapeHtml(t.tool_name)}: ${t.count} runs`),
      ].join('\n');

      const replyMarkup = createDashboardKeyboard([
        [{ text: '🖥 Full Admin Dashboard', url: getAdminDashboardUrl() }],
      ]);
      await sendTelegramMessage(chatId, msg, { replyMarkup });
      return { status: 200 };
    }

    await sendTelegramMessage(
      chatId,
      '❓ Unknown command. Type <code>/help</code> for available admin actions.'
    );
    return { status: 200 };
  },

  async handleCallbackQuery(cb) {
    const data = cb.data || '';
    const chatId = String(cb.message?.chat?.id || ADMIN_CHAT_ID);

    if (data.startsWith('status:')) {
      const jobId = data.slice('status:'.length);
      const job = db.getJobById(jobId);
      const text = job
        ? `Status for ${job.id}: ${job.status.toUpperCase()} (${(job.duration_ms / 1000).toFixed(1)}s)`
        : 'Job not found.';
      await sendTelegramMessage(chatId, text);
    } else if (data.startsWith('comment:')) {
      const jobId = data.slice('comment:'.length);
      await sendTelegramMessage(
        chatId,
        `To comment on <code>${escapeHtml(jobId)}</code>, reply to this message or send:\n<code>/comment ${jobId} Your comment</code>`
      );
    }

    return { status: 200 };
  },
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
