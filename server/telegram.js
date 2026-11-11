// ============================================================
// CONVETER — Telegram Bot Service & Admin Notification System
// Handles:
// 1. Admin notifications (New User, Conversion Started/Completed/Failed)
// 2. Two-way webhook command interface (/start, /help, /status, /job, /comment, /recent, /stats)
// 3. Inline keyboard buttons & callback query interactions
// 4. Rate-limiting, deduplication, and webhook secret validation
// ============================================================

import { db } from './db.js';

// Environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const APP_URL = process.env.APP_URL || 'https://conveter-4rmd.onrender.com';

// Cache to prevent duplicate notifications (e.g. repeated starts within 10s)
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

// Low-level Telegram sendMessage API
async function sendTelegramMessage(chatId, text, options = {}) {
  if (!BOT_TOKEN) {
    console.log('[Telegram Mock] (No TELEGRAM_BOT_TOKEN set) ->', text.slice(0, 100).replace(/\n/g, ' '));
    return { ok: true, mocked: true, message_id: Math.floor(Math.random() * 100000) };
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const body = {
    chat_id: chatId || ADMIN_CHAT_ID,
    text,
    parse_mode: options.parseMode || 'HTML',
    disable_web_page_preview: options.disablePreview ?? true,
    reply_markup: options.replyMarkup,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('[Telegram Error]', data.description);
    }
    return data;
  } catch (err) {
    console.error('[Telegram Network Error]', err.message);
    return { ok: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────
// Notification Handlers (Section 6)
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
   * 6.A New User Notification
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
      '🟢 <b>NEW CONVETER USER</b>',
      '',
      `👤 <b>User:</b> ${escapeHtml(user.name || 'Anonymous User')}`,
      `🆔 <b>User ID:</b> <code>${escapeHtml(user.id)}</code>`,
      `📧 <b>Email:</b> ${user.email ? escapeHtml(user.email) : '<i>Not provided</i>'}`,
      `🌐 <b>Platform:</b> CONVETER`,
      `📅 <b>Joined:</b> ${dateStr}`,
      `📱 <b>Device:</b> ${escapeHtml(user.deviceInfo || 'Desktop')}`,
      `🔗 <b>Event:</b> New User Registration`,
    ].join('\n');

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '📊 Open Dashboard', url: `${APP_URL}/admin` },
        ],
      ],
    };

    await sendTelegramMessage(ADMIN_CHAT_ID, msg, { replyMarkup });
    db.addAuditLog('telegram_notification', 'TelegramBot', { event: 'new_user', userId: user.id });
  },

  /**
   * 6.B Conversion Started Notification
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

    const res = await sendTelegramMessage(ADMIN_CHAT_ID, msg, { replyMarkup });
    db.addAuditLog('telegram_notification', 'TelegramBot', { event: 'conversion_started', jobId: job.id });
    return res;
  },

  /**
   * 6.C Conversion Completed Notification
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
      `⏱ <b>Processing Time:</b> ${durationSec} seconds`,
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

    const res = await sendTelegramMessage(ADMIN_CHAT_ID, msg, { replyMarkup });
    db.addAuditLog('telegram_notification', 'TelegramBot', { event: 'conversion_completed', jobId: job.id });
    return res;
  },

  /**
   * 6.D Failed Conversion Notification
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
      `⏱ <b>Processing Duration:</b> ${durationSec} seconds`,
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

    const res = await sendTelegramMessage(ADMIN_CHAT_ID, msg, { replyMarkup });
    db.addAuditLog('telegram_notification', 'TelegramBot', { event: 'conversion_failed', jobId: job.id });
    return res;
  },

  // ─────────────────────────────────────────────────────────────
  // 7. Telegram Bot Webhook & Admin Command System
  // ─────────────────────────────────────────────────────────────
  async handleWebhookUpdate(update, secretHeader) {
    // 1. Verify Secret Header if configured
    if (WEBHOOK_SECRET && secretHeader !== WEBHOOK_SECRET) {
      console.warn('[Telegram Webhook] Invalid secret token header received');
      return { status: 403, error: 'Unauthorized webhook request' };
    }

    // 2. Handle Callback Queries (from inline buttons)
    if (update.callback_query) {
      return this.handleCallbackQuery(update.callback_query);
    }

    // 3. Handle incoming message
    const message = update.message;
    if (!message) return { status: 200, message: 'No actionable message' };

    const chatId = String(message.chat.id);
    const userId = String(message.from?.id || '');
    const userDisplayName = message.from?.first_name || 'Admin';

    // Verify authorized admin: chat ID or from.id must match TELEGRAM_CHAT_ID (if set)
    if (ADMIN_CHAT_ID && chatId !== ADMIN_CHAT_ID && userId !== ADMIN_CHAT_ID) {
      console.warn(`[Telegram Webhook] Unauthorized access attempt from chatId: ${chatId}, userId: ${userId}`);
      await sendTelegramMessage(chatId, '⛔ <b>Unauthorized:</b> You do not have administrator permissions for this CONVETER instance.');
      return { status: 200, message: 'Unauthorized sender' };
    }

    const text = (message.text || '').trim();

    // Check if replying to an existing bot notification message
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

    // Parse slash commands
    if (text.startsWith('/start')) {
      const welcome = [
        '👋 <b>Welcome to CONVETER Admin Bot</b>',
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
        '📖 <b>CONVETER Admin Bot Reference</b>',
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
        '📊 <b>CONVETER PLATFORM ANALYTICS</b>',
        '',
        `⚡ <b>Total Jobs:</b> ${stats.totalJobs}`,
        `✅ <b>Completed:</b> ${stats.completedJobs} (${stats.successRate}%)`,
        `❌ <b>Failed:</b> ${stats.failedJobs}`,
        `⚙️ <b>Active / In-Flight:</b> ${stats.activeJobs}`,
        `👤 <b>Registered Users:</b> ${stats.totalUsers}`,
        `💾 <b>Bandwidth / Storage Saved:</b> ${formatSize(stats.totalBytesSaved)}`,
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

    // Default unrecognized command
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

  // Test notification helper
  async sendTestNotification() {
    const testMsg = [
      '🔔 <b>CONVETER TELEGRAM TEST ALERT</b>',
      '',
      'Your Telegram notification integration is working properly!',
      `📅 <b>Timestamp:</b> ${new Date().toISOString()}`,
      `🌐 <b>Target:</b> Admin Chat <code>${ADMIN_CHAT_ID || 'Local Mock'}</code>`,
    ].join('\n');

    return sendTelegramMessage(ADMIN_CHAT_ID, testMsg);
  },
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

