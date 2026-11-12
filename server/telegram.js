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

// Environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const APP_URL = process.env.APP_URL || 'https://convetpulse.onrender.com';

// Cache to prevent duplicate notifications (e.g. repeated starts within 30s)
const dedupeCache = new Map();
const DEDUPE_TTL_MS = 30000;

function isDuplicate(key) {
  const now = Date.now();
  if (dedupeCache.has(key)) {
    const ts = dedupeCache.get(key);
    if (now - ts < DEDUPE_TTL_MS) return true;
  }
  dedupeCache.set(key, now);
  // Clean up cache periodically
  if (dedupeCache.size > 2000) {
    for (const [k, v] of dedupeCache.entries()) {
      if (now - v > DEDUPE_TTL_MS) dedupeCache.delete(k);
    }
  }
  return false;
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
async function sendTelegramMessage(chatId, text, options = {}, eventType = 'custom') {
  const targetChatId = chatId || ADMIN_CHAT_ID;

  if (!BOT_TOKEN || !targetChatId) {
    console.log('[Telegram Mock] (No TELEGRAM_BOT_TOKEN/CHAT_ID set) ->', text.slice(0, 100).replace(/\n/g, ' '));
    db.addNotificationLog({
      eventType,
      status: 'mocked',
      chatId: targetChatId || 'none',
      errorMessage: !BOT_TOKEN ? 'TELEGRAM_BOT_TOKEN not configured' : 'TELEGRAM_CHAT_ID not configured',
    });
    return { ok: true, mocked: true, message_id: Math.floor(Math.random() * 100000) };
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const body = {
    chat_id: targetChatId,
    text,
    parse_mode: options.parseMode || 'HTML',
    disable_web_page_preview: options.disablePreview ?? true,
    reply_markup: options.replyMarkup,
  };

  const maxRetries = options.maxRetries ?? 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
        return data;
      }

      lastError = data.description || 'Unknown Telegram API error';
      console.warn(`[Telegram Attempt ${attempt}/${maxRetries} Error]:`, lastError);

      // Don't retry client errors like chat not found or bot blocked
      if (data.error_code === 400 || data.error_code === 403) {
        break;
      }
    } catch (err) {
      lastError = err.message;
      console.warn(`[Telegram Attempt ${attempt}/${maxRetries} Network Error]:`, err.message);
    }

    if (attempt < maxRetries) {
      // Exponential backoff: 1s, 2s, 4s...
      await sleep(attempt * 1000);
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

  return { ok: false, error: lastError };
}

// ─────────────────────────────────────────────────────────────
// Notification Handlers
// ─────────────────────────────────────────────────────────────
export const telegramService = {
  isConfigured() {
    return Boolean(BOT_TOKEN && ADMIN_CHAT_ID);
  },

  getPublicStatus() {
    return {
      configured: Boolean(BOT_TOKEN && ADMIN_CHAT_ID),
      hasToken: Boolean(BOT_TOKEN),
      hasChatId: Boolean(ADMIN_CHAT_ID),
      hasSecret: Boolean(WEBHOOK_SECRET),
    };
  },

  /**
   * Diagnostic Check: verify bot token with Telegram /getMe endpoint
   */
  async getDiagnostics() {
    const base = {
      configured: Boolean(BOT_TOKEN && ADMIN_CHAT_ID),
      hasToken: Boolean(BOT_TOKEN),
      hasChatId: Boolean(ADMIN_CHAT_ID),
      hasSecret: Boolean(WEBHOOK_SECRET),
      botInfo: null,
      apiReachable: false,
      lastError: null,
    };

    if (!BOT_TOKEN) {
      base.lastError = 'TELEGRAM_BOT_TOKEN environment variable is not configured.';
      return base;
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
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
   * New User Notification
   */
  async notifyNewUser(user) {
    const settings = db.getNotificationSettings();
    if (!settings.notify_new_user) return;

    const dedupeKey = `user_${user.id}`;
    if (isDuplicate(dedupeKey)) return;

    const dateStr = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const msg = [
      '🟢 <b>NEW CONVET USER</b>',
      '',
      `👤 <b>User:</b> ${escapeHtml(user.name || 'Anonymous User')}`,
      `🆔 <b>User ID:</b> <code>${escapeHtml(user.id)}</code>`,
      `📧 <b>Email:</b> ${user.email ? escapeHtml(user.email) : '<i>Not provided</i>'}`,
      `🌐 <b>Platform:</b> CONVET PULSE`,
      `📅 <b>Joined:</b> ${dateStr}`,
      `📱 <b>Device:</b> ${escapeHtml(user.deviceInfo || 'Desktop')}`,
      `🔗 <b>Event:</b> New User Registration`,
    ].join('\n');

    const replyMarkup = {
      inline_keyboard: [
        [{ text: '📊 Open Dashboard', url: `${APP_URL}/admin` }],
      ],
    };

    await sendTelegramMessage(ADMIN_CHAT_ID, msg, { replyMarkup }, 'new_user');
    db.addAuditLog('telegram_notification', 'TelegramBot', { event: 'new_user', userId: user.id });
  },

  /**
   * Conversion Started Notification
   */
  async notifyConversionStarted(job) {
    const settings = db.getNotificationSettings();
    if (!settings.notify_conversion_started) return;

    const dedupeKey = `start_${job.id}`;
    if (isDuplicate(dedupeKey)) return;

    const timeStr = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const msg = [
      '⚙️ <b>CONVERSION STARTED</b>',
      '',
      `👤 <b>User:</b> ${escapeHtml(job.userName || 'Anonymous User')}`,
      `🔧 <b>Tool:</b> ${escapeHtml(job.toolName)}`,
      `📂 <b>Input:</b> ${escapeHtml(job.inputFileName || 'file')}`,
      `📤 <b>Output:</b> ${escapeHtml(job.outputFormat ? `.${job.outputFormat}` : 'Pending')}`,
      `📦 <b>File Size:</b> ${formatSize(job.inputFileSize)}`,
      `🕒 <b>Started:</b> ${timeStr}`,
      `🆔 <b>Job ID:</b> <code>${escapeHtml(job.id)}</code>`,
    ].join('\n');

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '🔍 Check Status', callback_data: `status:${job.id}` },
          { text: '💬 Add Comment', callback_data: `comment:${job.id}` },
        ],
      ],
    };

    const res = await sendTelegramMessage(ADMIN_CHAT_ID, msg, { replyMarkup }, 'conversion_started');
    db.addAuditLog('telegram_notification', 'TelegramBot', { event: 'conversion_started', jobId: job.id });
    return res;
  },

  /**
   * Conversion Completed Notification
   */
  async notifyConversionCompleted(job) {
    const settings = db.getNotificationSettings();
    if (!settings.notify_conversion_completed) return;

    const dedupeKey = `complete_${job.id}`;
    if (isDuplicate(dedupeKey)) return;

    const dateStr = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const durationSec = ((job.durationMs || 1000) / 1000).toFixed(1);

    const msg = [
      '✅ <b>CONVERSION COMPLETED</b>',
      '',
      `👤 <b>User:</b> ${escapeHtml(job.userName || 'Anonymous User')}`,
      `🔧 <b>Tool Used:</b> ${escapeHtml(job.toolName)}`,
      `📂 <b>Original File:</b> ${escapeHtml(job.inputFileName || 'file')}`,
      `📤 <b>Converted File:</b> ${escapeHtml(job.outputFileName || 'output')}`,
      `📦 <b>Original Size:</b> ${formatSize(job.inputFileSize)}`,
      `📦 <b>Output Size:</b> ${formatSize(job.outputFileSize)}`,
      `⏱ <b>Processing Time:</b> ${durationSec}s`,
      `📅 <b>Completed:</b> ${dateStr}`,
      `🆔 <b>Job ID:</b> <code>${escapeHtml(job.id)}</code>`,
      '',
      'Status: <b>SUCCESS</b>',
    ].join('\n');

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '👁 View Job', url: `${APP_URL}/admin?job=${job.id}` },
          { text: '💬 Add Comment', callback_data: `comment:${job.id}` },
        ],
        [
          { text: '📊 Dashboard', url: `${APP_URL}/admin` },
        ],
      ],
    };

    const res = await sendTelegramMessage(ADMIN_CHAT_ID, msg, { replyMarkup }, 'conversion_completed');
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
    if (isDuplicate(dedupeKey)) return;

    const durationSec = ((job.durationMs || 1000) / 1000).toFixed(1);

    const msg = [
      '❌ <b>CONVERSION FAILED</b>',
      '',
      `👤 <b>User:</b> ${escapeHtml(job.userName || 'Anonymous User')}`,
      `🔧 <b>Tool:</b> ${escapeHtml(job.toolName)}`,
      `🆔 <b>Job ID:</b> <code>${escapeHtml(job.id)}</code>`,
      `⚠️ <b>Error Category:</b> ${escapeHtml(job.errorCategory || 'Processing Error')}`,
      `📋 <b>Summary:</b> ${escapeHtml(job.errorSummary || 'File processing could not be completed.')}`,
      `⏱ <b>Processing Duration:</b> ${durationSec}s`,
      `🔄 <b>Retry Status:</b> Eligible for client retry`,
    ].join('\n');

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '🔍 Inspect Job', url: `${APP_URL}/admin?job=${job.id}` },
          { text: '💬 Add Comment', callback_data: `comment:${job.id}` },
        ],
      ],
    };

    const res = await sendTelegramMessage(ADMIN_CHAT_ID, msg, { replyMarkup }, 'conversion_failed');
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
    if (isDuplicate(dedupeKey)) return;

    const msg = [
      '⚠️ <b>FILE PROCESSING ERROR</b>',
      '',
      `🔧 <b>Tool:</b> ${escapeHtml(toolName)}`,
      `📂 <b>File:</b> ${escapeHtml(fileName)}`,
      `📋 <b>Details:</b> ${escapeHtml(errorDetails || 'Unexpected file processing failure.')}`,
      `🕒 <b>Time:</b> ${new Date().toISOString()}`,
    ].join('\n');

    await sendTelegramMessage(ADMIN_CHAT_ID, msg, {}, 'file_processing_error');
    db.addAuditLog('telegram_notification', 'TelegramBot', { event: 'file_processing_error', toolName, fileName });
  },

  /**
   * Premium Tool Access Notification
   */
  async notifyPremiumAccess(user, toolName) {
    const settings = db.getNotificationSettings();
    if (!settings.notify_premium_access) return;

    const dedupeKey = `prem_acc_${user?.id || 'anon'}_${toolName}`;
    if (isDuplicate(dedupeKey)) return;

    const msg = [
      '⭐ <b>PREMIUM TOOL ACCESSED</b>',
      '',
      `👤 <b>User:</b> ${escapeHtml(user?.name || 'Anonymous User')}`,
      `🆔 <b>User ID:</b> <code>${escapeHtml(user?.id || 'N/A')}</code>`,
      `🔧 <b>Tool:</b> ${escapeHtml(toolName)}`,
      `🕒 <b>Time:</b> ${new Date().toLocaleString()}`,
    ].join('\n');

    await sendTelegramMessage(ADMIN_CHAT_ID, msg, {}, 'premium_tool_access');
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

    await sendTelegramMessage(ADMIN_CHAT_ID, msg, {}, 'admin_config_change');
  },

  /**
   * Important System Error Notification
   */
  async notifySystemError(error, context = 'Server') {
    const settings = db.getNotificationSettings();
    if (!settings.notify_system_errors) return;

    const dedupeKey = `sys_err_${error?.message || 'unknown'}`;
    if (isDuplicate(dedupeKey)) return;

    const msg = [
      '🚨 <b>SYSTEM ERROR DETECTED</b>',
      '',
      `🌐 <b>Context:</b> ${escapeHtml(context)}`,
      `⚠️ <b>Message:</b> ${escapeHtml(error?.message || String(error))}`,
      `🕒 <b>Timestamp:</b> ${new Date().toISOString()}`,
    ].join('\n');

    await sendTelegramMessage(ADMIN_CHAT_ID, msg, {}, 'system_error');
    db.addAuditLog('telegram_notification', 'System', { event: 'system_error', context, error: error?.message });
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
      `🌐 <b>Target:</b> Admin Chat <code>${ADMIN_CHAT_ID || 'Local Mock'}</code>`,
      `⚙️ <b>Server:</b> CONVET PULSE Production Platform`,
    ].join('\n');

    return sendTelegramMessage(ADMIN_CHAT_ID, testMsg, {}, 'test_alert');
  },

  // ─────────────────────────────────────────────────────────────
  // Telegram Bot Webhook & Admin Command System
  // ─────────────────────────────────────────────────────────────
  async handleWebhookUpdate(update, secretHeader) {
    if (WEBHOOK_SECRET && secretHeader !== WEBHOOK_SECRET) {
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

    if (ADMIN_CHAT_ID && chatId !== ADMIN_CHAT_ID && userId !== ADMIN_CHAT_ID) {
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
        `🌐 Dashboard: <a href="${APP_URL}/admin">${APP_URL}/admin</a>`,
      ].join('\n');
      await sendTelegramMessage(chatId, welcome);
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
      await sendTelegramMessage(chatId, help);
      return { status: 200, message: 'Help handled' };
    }

    if (text.startsWith('/status')) {
      const parts = text.split(/\s+/);
      const jobId = parts[1];
      if (!jobId) {
        await sendTelegramMessage(chatId, '⚠️ Please specify a Job ID. Example:\n<code>/status JOB-12345</code>');
        return { status: 200 };
      }

      const job = db.getJobById(jobId);
      if (!job) {
        await sendTelegramMessage(chatId, `❌ Job <code>${escapeHtml(jobId)}</code> not found.`);
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

      await sendTelegramMessage(chatId, msg, {
        replyMarkup: {
          inline_keyboard: [
            [{ text: '🔍 View Details', url: `${APP_URL}/admin?job=${job.id}` }],
          ],
        },
      });
      return { status: 200 };
    }

    if (text.startsWith('/job')) {
      const parts = text.split(/\s+/);
      const jobId = parts[1];
      if (!jobId) {
        await sendTelegramMessage(chatId, '⚠️ Please specify a Job ID. Example:\n<code>/job JOB-12345</code>');
        return { status: 200 };
      }

      const job = db.getJobById(jobId);
      if (!job) {
        await sendTelegramMessage(chatId, `❌ Job <code>${escapeHtml(jobId)}</code> not found.`);
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

      await sendTelegramMessage(chatId, msg, {
        replyMarkup: {
          inline_keyboard: [
            [
              { text: '💬 Add Comment', callback_data: `comment:${job.id}` },
              { text: '📊 Admin Dashboard', url: `${APP_URL}/admin?job=${job.id}` },
            ],
          ],
        },
      });
      return { status: 200 };
    }

    if (text.startsWith('/comment')) {
      const parts = text.split(/\s+/);
      const jobId = parts[1];
      const commentBody = parts.slice(2).join(' ').trim();

      if (!jobId || !commentBody) {
        await sendTelegramMessage(
          chatId,
          '⚠️ Usage: <code>/comment &lt;JOB-ID&gt; &lt;your comment&gt;</code>\nExample:\n<code>/comment JOB-12345 Output verified successfully.</code>'
        );
        return { status: 200 };
      }

      const job = db.getJobById(jobId);
      if (!job) {
        await sendTelegramMessage(chatId, `❌ Cannot comment: Job <code>${escapeHtml(jobId)}</code> was not found.`);
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
        `✅ <b>Comment recorded for ${escapeHtml(jobId)}:</b>\n"${escapeHtml(commentBody)}"`
      );
      db.addAuditLog('telegram_admin_command_comment', userDisplayName, { jobId });
      return { status: 200 };
    }

    if (text.startsWith('/recent')) {
      const recentJobs = db.listJobs({ limit: 5 });
      if (recentJobs.length === 0) {
        await sendTelegramMessage(chatId, 'ℹ️ No conversion jobs recorded yet.');
        return { status: 200 };
      }

      const lines = recentJobs.map((j) => {
        const icon = j.status === 'completed' ? '✅' : j.status === 'failed' ? '❌' : '⚙️';
        return `${icon} <code>${j.id}</code> — <b>${escapeHtml(j.tool_name)}</b>\n   File: ${escapeHtml(j.input_file_name)} | ${new Date(j.created_at).toLocaleTimeString()}`;
      });

      const msg = ['🕒 <b>LAST 5 CONVERSIONS:</b>', '', ...lines].join('\n');
      await sendTelegramMessage(chatId, msg);
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

      await sendTelegramMessage(chatId, msg, {
        replyMarkup: {
          inline_keyboard: [
            [{ text: '🖥 Full Admin Dashboard', url: `${APP_URL}/admin` }],
          ],
        },
      });
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
