// ============================================================
// CONVETER — Embedded Database Module (Node 22/24 SQLite + Fallback)
// Stores jobs, users, admin comments, audit logs, notification logs, and settings.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'conveter.db');
const JSON_FALLBACK_PATH = path.join(DATA_DIR, 'conveter_store.json');

// Check if node:sqlite is available
let sqliteDb = null;
let useJsonFallback = false;

try {
  const { DatabaseSync } = await import('node:sqlite');
  sqliteDb = new DatabaseSync(DB_PATH);
  initSqliteTables(sqliteDb);
} catch (err) {
  console.warn('[DB] node:sqlite initialization failed, falling back to JSON store:', err.message);
  useJsonFallback = true;
  initJsonStore();
}

function initSqliteTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      user_email TEXT,
      tool_slug TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      input_file_name TEXT,
      input_file_size INTEGER DEFAULT 0,
      input_format TEXT,
      output_file_name TEXT,
      output_file_size INTEGER DEFAULT 0,
      output_format TEXT,
      status TEXT NOT NULL, -- 'started', 'completed', 'failed', 'cancelled'
      duration_ms INTEGER DEFAULT 0,
      error_summary TEXT,
      download_token TEXT,
      download_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      platform TEXT DEFAULT 'CONVETER',
      device_info TEXT,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_comments (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      author TEXT NOT NULL,
      comment TEXT NOT NULL,
      telegram_message_id INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_logs (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      status TEXT NOT NULL, -- 'sent', 'failed', 'mocked', 'retried'
      chat_id TEXT,
      message_id INTEGER,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  // Initialize default notification settings if empty
  const defaultSettings = [
    ['notify_new_user', 'true'],
    ['notify_conversion_started', 'true'],
    ['notify_conversion_completed', 'true'],
    ['notify_conversion_failed', 'true'],
    ['notify_daily_summary', 'true'],
    ['notify_system_errors', 'true'],
    ['notify_premium_access', 'true'],
    ['notify_admin_changes', 'true'],
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO notification_settings (key, value) VALUES (?, ?)');
  for (const [k, v] of defaultSettings) {
    stmt.run(k, v);
  }
}

// ─────────────────────────────────────────────────────────────
// JSON Store Fallback
// ─────────────────────────────────────────────────────────────
let jsonStore = {
  jobs: [],
  users: [],
  admin_comments: [],
  audit_logs: [],
  notification_logs: [],
  notification_settings: {
    notify_new_user: 'true',
    notify_conversion_started: 'true',
    notify_conversion_completed: 'true',
    notify_conversion_failed: 'true',
    notify_daily_summary: 'true',
    notify_system_errors: 'true',
    notify_premium_access: 'true',
    notify_admin_changes: 'true',
  },
};

function initJsonStore() {
  if (fs.existsSync(JSON_FALLBACK_PATH)) {
    try {
      jsonStore = JSON.parse(fs.readFileSync(JSON_FALLBACK_PATH, 'utf8'));
      if (!jsonStore.notification_logs) jsonStore.notification_logs = [];
    } catch {
      // keep default
    }
  } else {
    persistJsonStore();
  }
}

function persistJsonStore() {
  try {
    fs.writeFileSync(JSON_FALLBACK_PATH, JSON.stringify(jsonStore, null, 2), 'utf8');
  } catch (err) {
    console.error('[DB] Failed to persist JSON store:', err);
  }
}

// Helper to extract file extension / format
function getFileFormat(filename, explicitFormat) {
  if (explicitFormat && explicitFormat !== 'file') return explicitFormat.toLowerCase().replace(/^\./, '');
  if (!filename) return 'unknown';
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : 'unknown';
}

// ─────────────────────────────────────────────────────────────
// Database Public API
// ─────────────────────────────────────────────────────────────
export const db = {
  // --- Jobs ---
  createJob(job) {
    const inputFmt = getFileFormat(job.inputFileName, job.inputFormat);
    const record = {
      id: job.id || `JOB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      user_id: job.userId || 'anonymous',
      user_name: job.userName || 'Anonymous User',
      user_email: job.userEmail || null,
      tool_slug: job.toolSlug,
      tool_name: job.toolName,
      input_file_name: job.inputFileName || 'document',
      input_file_size: job.inputFileSize || 0,
      input_format: inputFmt,
      output_file_name: job.outputFileName || null,
      output_file_size: job.outputFileSize || 0,
      output_format: job.outputFormat || null,
      status: job.status || 'started',
      duration_ms: job.durationMs || 0,
      error_summary: job.errorSummary || null,
      download_token: job.downloadToken || crypto.randomUUID(),
      download_count: 0,
      created_at: job.createdAt || new Date().toISOString(),
      completed_at: job.completedAt || null,
    };

    if (sqliteDb) {
      const stmt = sqliteDb.prepare(`
        INSERT INTO jobs (
          id, user_id, user_name, user_email, tool_slug, tool_name,
          input_file_name, input_file_size, input_format,
          output_file_name, output_file_size, output_format,
          status, duration_ms, error_summary, download_token, download_count,
          created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        record.id, record.user_id, record.user_name, record.user_email,
        record.tool_slug, record.tool_name, record.input_file_name,
        record.input_file_size, record.input_format, record.output_file_name,
        record.output_file_size, record.output_format, record.status,
        record.duration_ms, record.error_summary, record.download_token,
        record.download_count, record.created_at, record.completed_at
      );
    } else {
      jsonStore.jobs.unshift(record);
      persistJsonStore();
    }
    return record;
  },

  updateJob(id, updates) {
    if (sqliteDb) {
      const fields = [];
      const values = [];
      for (const [key, val] of Object.entries(updates)) {
        fields.push(`${key} = ?`);
        values.push(val);
      }
      values.push(id);
      const query = `UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`;
      sqliteDb.prepare(query).run(...values);
      return this.getJobById(id);
    } else {
      const idx = jsonStore.jobs.findIndex((j) => j.id === id);
      if (idx !== -1) {
        jsonStore.jobs[idx] = { ...jsonStore.jobs[idx], ...updates };
        persistJsonStore();
        return jsonStore.jobs[idx];
      }
      return null;
    }
  },

  getJobById(id) {
    if (sqliteDb) {
      const stmt = sqliteDb.prepare('SELECT * FROM jobs WHERE id = ?');
      return stmt.get(id) || null;
    } else {
      return jsonStore.jobs.find((j) => j.id === id) || null;
    }
  },

  listJobs({ limit = 50, offset = 0, status, toolSlug, search, timeRange } = {}) {
    let cutoffIso = null;
    if (timeRange && timeRange !== 'all') {
      const now = Date.now();
      if (timeRange === 'today') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        cutoffIso = startOfDay.toISOString();
      } else if (timeRange === '7d') {
        cutoffIso = new Date(now - 7 * 86400000).toISOString();
      } else if (timeRange === '30d') {
        cutoffIso = new Date(now - 30 * 86400000).toISOString();
      }
    }

    if (sqliteDb) {
      let query = 'SELECT * FROM jobs WHERE 1=1';
      const params = [];

      if (status && status !== 'all') {
        query += ' AND status = ?';
        params.push(status);
      }
      if (toolSlug && toolSlug !== 'all') {
        query += ' AND tool_slug = ?';
        params.push(toolSlug);
      }
      if (cutoffIso) {
        query += ' AND created_at >= ?';
        params.push(cutoffIso);
      }
      if (search) {
        query += ' AND (id LIKE ? OR input_file_name LIKE ? OR tool_name LIKE ? OR user_name LIKE ?)';
        const s = `%${search}%`;
        params.push(s, s, s, s);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const stmt = sqliteDb.prepare(query);
      return stmt.all(...params);
    } else {
      let list = [...jsonStore.jobs];
      if (status && status !== 'all') list = list.filter((j) => j.status === status);
      if (toolSlug && toolSlug !== 'all') list = list.filter((j) => j.tool_slug === toolSlug);
      if (cutoffIso) list = list.filter((j) => j.created_at >= cutoffIso);
      if (search) {
        const s = search.toLowerCase();
        list = list.filter(
          (j) =>
            j.id.toLowerCase().includes(s) ||
            j.input_file_name?.toLowerCase().includes(s) ||
            j.tool_name?.toLowerCase().includes(s) ||
            j.user_name?.toLowerCase().includes(s)
        );
      }
      return list.slice(offset, offset + limit);
    }
  },

  // --- Users ---
  registerUser(user) {
    const existing = this.getUserById(user.id);
    const now = new Date().toISOString();

    if (existing) {
      this.updateUserLastSeen(user.id);
      return { user: existing, isNew: false };
    }

    const record = {
      id: user.id || `user_${Date.now()}`,
      name: user.name || 'Anonymous User',
      email: user.email || null,
      platform: 'CONVETER',
      device_info: user.deviceInfo || 'Desktop',
      created_at: now,
      last_seen_at: now,
    };

    if (sqliteDb) {
      const stmt = sqliteDb.prepare(`
        INSERT INTO users (id, name, email, platform, device_info, created_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(record.id, record.name, record.email, record.platform, record.device_info, record.created_at, record.last_seen_at);
    } else {
      jsonStore.users.unshift(record);
      persistJsonStore();
    }

    return { user: record, isNew: true };
  },

  getUserById(id) {
    if (!id) return null;
    if (sqliteDb) {
      const stmt = sqliteDb.prepare('SELECT * FROM users WHERE id = ?');
      return stmt.get(id) || null;
    } else {
      return jsonStore.users.find((u) => u.id === id) || null;
    }
  },

  updateUserLastSeen(id) {
    const now = new Date().toISOString();
    if (sqliteDb) {
      sqliteDb.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now, id);
    } else {
      const u = jsonStore.users.find((user) => user.id === id);
      if (u) {
        u.last_seen_at = now;
        persistJsonStore();
      }
    }
  },

  listUsers({ limit = 50 } = {}) {
    if (sqliteDb) {
      return sqliteDb.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ?').all(limit);
    } else {
      return jsonStore.users.slice(0, limit);
    }
  },

  // --- Admin Comments ---
  addAdminComment({ jobId, author, comment, telegramMessageId = null }) {
    const record = {
      id: `comm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      job_id: jobId,
      author: author || 'Admin',
      comment: String(comment).trim(),
      telegram_message_id: telegramMessageId,
      created_at: new Date().toISOString(),
    };

    if (sqliteDb) {
      sqliteDb.prepare(`
        INSERT INTO admin_comments (id, job_id, author, comment, telegram_message_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(record.id, record.job_id, record.author, record.comment, record.telegram_message_id, record.created_at);
    } else {
      jsonStore.admin_comments.push(record);
      persistJsonStore();
    }
    return record;
  },

  getCommentsForJob(jobId) {
    if (sqliteDb) {
      return sqliteDb.prepare('SELECT * FROM admin_comments WHERE job_id = ? ORDER BY created_at ASC').all(jobId);
    } else {
      return jsonStore.admin_comments.filter((c) => c.job_id === jobId);
    }
  },

  // --- Audit Logs ---
  addAuditLog(eventType, actor, details = {}) {
    const record = {
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      event_type: eventType,
      actor: actor || 'System',
      details: typeof details === 'string' ? details : JSON.stringify(details),
      created_at: new Date().toISOString(),
    };

    if (sqliteDb) {
      sqliteDb.prepare(`
        INSERT INTO audit_logs (id, event_type, actor, details, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(record.id, record.event_type, record.actor, record.details, record.created_at);
    } else {
      jsonStore.audit_logs.unshift(record);
      if (jsonStore.audit_logs.length > 500) jsonStore.audit_logs.pop();
      persistJsonStore();
    }
    return record;
  },

  listAuditLogs({ limit = 50 } = {}) {
    if (sqliteDb) {
      return sqliteDb.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?').all(limit);
    } else {
      return jsonStore.audit_logs.slice(0, limit);
    }
  },

  // --- Notification Logs ---
  addNotificationLog({ eventType, status, chatId, messageId = null, errorMessage = null, retryCount = 0 }) {
    const record = {
      id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      event_type: eventType,
      status: status || 'sent',
      chat_id: chatId || null,
      message_id: messageId || null,
      error_message: errorMessage || null,
      retry_count: retryCount || 0,
      created_at: new Date().toISOString(),
    };

    if (sqliteDb) {
      sqliteDb.prepare(`
        INSERT INTO notification_logs (id, event_type, status, chat_id, message_id, error_message, retry_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(record.id, record.event_type, record.status, record.chat_id, record.message_id, record.error_message, record.retry_count, record.created_at);
    } else {
      if (!jsonStore.notification_logs) jsonStore.notification_logs = [];
      jsonStore.notification_logs.unshift(record);
      if (jsonStore.notification_logs.length > 300) jsonStore.notification_logs.pop();
      persistJsonStore();
    }
    return record;
  },

  listNotificationLogs({ limit = 50 } = {}) {
    if (sqliteDb) {
      return sqliteDb.prepare('SELECT * FROM notification_logs ORDER BY created_at DESC LIMIT ?').all(limit);
    } else {
      return (jsonStore.notification_logs || []).slice(0, limit);
    }
  },

  // --- Notification Settings ---
  getNotificationSettings() {
    if (sqliteDb) {
      const rows = sqliteDb.prepare('SELECT key, value FROM notification_settings').all();
      const settings = {};
      for (const row of rows) {
        settings[row.key] = row.value === 'true';
      }
      return settings;
    } else {
      const settings = {};
      for (const [k, v] of Object.entries(jsonStore.notification_settings)) {
        settings[k] = v === 'true';
      }
      return settings;
    }
  },

  updateNotificationSettings(updates) {
    if (sqliteDb) {
      const stmt = sqliteDb.prepare(`
        INSERT INTO notification_settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);
      for (const [k, v] of Object.entries(updates)) {
        stmt.run(k, String(v));
      }
    } else {
      for (const [k, v] of Object.entries(updates)) {
        jsonStore.notification_settings[k] = String(v);
      }
      persistJsonStore();
    }
    return this.getNotificationSettings();
  },

  // --- Platform Metrics / Real Analytics ---
  getStats(timeRange = 'all') {
    return this.getDetailedStats(timeRange);
  },

  getDetailedStats(timeRange = 'all') {
    let cutoffIso = null;
    const now = Date.now();
    if (timeRange === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      cutoffIso = startOfDay.toISOString();
    } else if (timeRange === '7d') {
      cutoffIso = new Date(now - 7 * 86400000).toISOString();
    } else if (timeRange === '30d') {
      cutoffIso = new Date(now - 30 * 86400000).toISOString();
    }

    // Cutoffs for today, week, month for global KPI cards
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayIso = startOfToday.toISOString();
    const weekIso = new Date(now - 7 * 86400000).toISOString();
    const monthIso = new Date(now - 30 * 86400000).toISOString();

    let allJobs = [];
    let totalUsers = 0;

    if (sqliteDb) {
      const userCount = sqliteDb.prepare('SELECT COUNT(*) as total FROM users').get();
      totalUsers = userCount.total || 0;

      let query = 'SELECT * FROM jobs';
      const params = [];
      if (cutoffIso) {
        query += ' WHERE created_at >= ?';
        params.push(cutoffIso);
      }
      allJobs = sqliteDb.prepare(query).all(...params);
    } else {
      totalUsers = jsonStore.users.length;
      allJobs = cutoffIso
        ? jsonStore.jobs.filter((j) => j.created_at >= cutoffIso)
        : [...jsonStore.jobs];
    }

    const totalJobs = allJobs.length;
    const completedJobs = allJobs.filter((j) => j.status === 'completed').length;
    const failedJobs = allJobs.filter((j) => j.status === 'failed').length;
    const activeJobs = allJobs.filter((j) => j.status === 'started').length;

    // Accurate Success Rate calculation: (Successful / (Successful + Failed)) * 100
    // If no finished jobs, display 0
    const finishedJobs = completedJobs + failedJobs;
    const successRate = finishedJobs > 0 ? Math.round((completedJobs / finishedJobs) * 100) : 0;

    // Total and Average Processing Time
    const totalProcessingDurationMs = allJobs.reduce((acc, j) => {
      if (j.status === 'completed' && j.duration_ms) return acc + j.duration_ms;
      return acc;
    }, 0);
    const avgProcessingTimeMs = completedJobs > 0 ? Math.round(totalProcessingDurationMs / completedJobs) : 0;

    // Total bytes saved
    const totalBytesSaved = allJobs.reduce((acc, j) => {
      if (j.input_file_size > j.output_file_size && j.output_file_size > 0) {
        return acc + (j.input_file_size - j.output_file_size);
      }
      return acc;
    }, 0);

    // Period counts (independent of timeRange filter)
    let jobsAllTime = [];
    if (sqliteDb) {
      jobsAllTime = sqliteDb.prepare('SELECT created_at, status FROM jobs').all();
    } else {
      jobsAllTime = jsonStore.jobs;
    }
    const todayCount = jobsAllTime.filter((j) => j.created_at >= todayIso && j.status === 'completed').length;
    const weekCount = jobsAllTime.filter((j) => j.created_at >= weekIso && j.status === 'completed').length;
    const monthCount = jobsAllTime.filter((j) => j.created_at >= monthIso && j.status === 'completed').length;

    // Tool usage breakdown
    const usageMap = {};
    for (const j of allJobs) {
      const slug = j.tool_slug || 'unknown';
      const name = j.tool_name || slug;
      if (!usageMap[slug]) {
        usageMap[slug] = { tool_slug: slug, tool_name: name, count: 0, completed: 0, failed: 0 };
      }
      usageMap[slug].count++;
      if (j.status === 'completed') usageMap[slug].completed++;
      if (j.status === 'failed') usageMap[slug].failed++;
    }
    const toolUsage = Object.values(usageMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // File type distribution
    const formatMap = {};
    for (const j of allJobs) {
      const fmt = (j.input_format || getFileFormat(j.input_file_name) || 'other').toUpperCase();
      formatMap[fmt] = (formatMap[fmt] || 0) + 1;
    }
    const fileTypeDistribution = Object.entries(formatMap)
      .map(([format, count]) => ({
        format,
        count,
        percentage: totalJobs > 0 ? Math.round((count / totalJobs) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Recent conversion activity (last 10 jobs)
    const recentActivity = allJobs
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map((j) => ({
        id: j.id,
        toolName: j.tool_name,
        toolSlug: j.tool_slug,
        inputFileName: j.input_file_name,
        outputFileName: j.output_file_name,
        inputFormat: j.input_format,
        outputFormat: j.output_format,
        status: j.status,
        durationMs: j.duration_ms,
        inputFileSize: j.input_file_size,
        outputFileSize: j.output_file_size,
        createdAt: j.created_at,
        completedAt: j.completed_at,
      }));

    return {
      totalJobs,
      completedJobs,
      failedJobs,
      activeJobs,
      totalUsers,
      totalBytesSaved,
      successRate,
      totalProcessingDurationMs,
      avgProcessingTimeMs,
      todayCount,
      weekCount,
      monthCount,
      toolUsage,
      fileTypeDistribution,
      recentActivity,
      timeRange,
    };
  },
};
