// ============================================================
// CONVET PULSE — Embedded Database Module (Node 22/24 SQLite + Fallback)
// Stores jobs, visitors, users, admin comments, audit logs,
// notification logs, premium entitlements, and notification settings.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Prefer conveter.sqlite, fall back to conveter.db if present
let defaultDbPath = path.join(DATA_DIR, 'conveter.sqlite');
if (!fs.existsSync(defaultDbPath) && fs.existsSync(path.join(DATA_DIR, 'conveter.db'))) {
  defaultDbPath = path.join(DATA_DIR, 'conveter.db');
}
const DB_PATH = process.env.DATABASE_PATH || defaultDbPath;
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
  // 1. Create primary tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      job_id TEXT,
      job_token TEXT,
      tool_id TEXT,
      tool_slug TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      user_id TEXT,
      user_name TEXT,
      user_email TEXT,
      input_file_name TEXT,
      input_file_size INTEGER DEFAULT 0,
      file_size_bytes INTEGER DEFAULT 0,
      input_format TEXT,
      output_file_name TEXT,
      output_file_size INTEGER DEFAULT 0,
      output_format TEXT,
      status TEXT NOT NULL, -- 'queued', 'processing', 'completed', 'failed', 'cancelled', 'started'
      processing_started_at TEXT,
      processing_completed_at TEXT,
      processing_duration_ms INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      error_code TEXT,
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

    CREATE TABLE IF NOT EXISTS visitors (
      id TEXT PRIMARY KEY,
      is_authenticated INTEGER DEFAULT 0,
      user_id TEXT,
      page_views INTEGER DEFAULT 1,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS premium_entitlements (
      user_id TEXT PRIMARY KEY,
      plan TEXT DEFAULT 'pro',
      status TEXT DEFAULT 'active', -- 'active', 'expired', 'revoked'
      activated_at TEXT NOT NULL,
      expires_at TEXT,
      amount_paid REAL DEFAULT 0.0,
      currency TEXT DEFAULT 'INR',
      payment_verified INTEGER DEFAULT 0
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
      job_id TEXT,
      event_type TEXT NOT NULL,
      status TEXT NOT NULL, -- 'sent', 'failed', 'mocked', 'retried'
      chat_id TEXT,
      message_id INTEGER,
      error_message TEXT,
      error_code TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      delivered_at TEXT
    );

    CREATE TABLE IF NOT EXISTS user_usage (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action_slug TEXT NOT NULL,
      action_category TEXT NOT NULL,
      success_count INTEGER DEFAULT 0,
      last_success_at TEXT NOT NULL,
      UNIQUE(user_id, action_slug)
    );

    CREATE TABLE IF NOT EXISTS usage_events (
      event_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      job_id TEXT,
      action_slug TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT UNIQUE NOT NULL,
      payment_id TEXT,
      signature TEXT,
      user_id TEXT NOT NULL,
      user_email TEXT,
      plan TEXT NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'created', -- 'created', 'paid', 'failed'
      created_at TEXT NOT NULL,
      paid_at TEXT
    );

    CREATE TABLE IF NOT EXISTS notification_dedupe (
      dedupe_key TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      entity_id TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_credentials (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      must_change_password INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 2. Safe migrations for existing databases
  const runMigration = (sql) => {
    try {
      db.exec(sql);
    } catch {
      // Column or index already exists
    }
  };

  runMigration('ALTER TABLE jobs ADD COLUMN job_id TEXT');
  runMigration('ALTER TABLE jobs ADD COLUMN job_token TEXT');
  runMigration('ALTER TABLE jobs ADD COLUMN tool_id TEXT');
  runMigration('ALTER TABLE jobs ADD COLUMN file_size_bytes INTEGER DEFAULT 0');
  runMigration('ALTER TABLE jobs ADD COLUMN processing_started_at TEXT');
  runMigration('ALTER TABLE jobs ADD COLUMN processing_completed_at TEXT');
  runMigration('ALTER TABLE jobs ADD COLUMN processing_duration_ms INTEGER DEFAULT 0');
  runMigration('ALTER TABLE jobs ADD COLUMN error_code TEXT');
  runMigration('ALTER TABLE notification_logs ADD COLUMN job_id TEXT');
  runMigration('ALTER TABLE notification_logs ADD COLUMN error_code TEXT');
  runMigration('ALTER TABLE notification_logs ADD COLUMN delivered_at TEXT');

  // 3. Create high-performance indexes
  runMigration('CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)');
  runMigration('CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at)');
  runMigration('CREATE INDEX IF NOT EXISTS idx_jobs_tool_slug ON jobs(tool_slug)');
  runMigration('CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id)');
  runMigration('CREATE INDEX IF NOT EXISTS idx_notif_created_at ON notification_logs(created_at)');
  runMigration('CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id)');
  runMigration('CREATE INDEX IF NOT EXISTS idx_usage_events_event ON usage_events(event_id)');
  runMigration('CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id)');
  runMigration('CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)');
  runMigration('CREATE INDEX IF NOT EXISTS idx_dedupe_expires ON notification_dedupe(expires_at)');
  runMigration('CREATE TABLE IF NOT EXISTS admin_credentials (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL, must_change_password INTEGER DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)');

  // 4. Initialize default notification settings if empty
  const defaultSettings = [
    ['notify_new_visitor', 'true'],
    ['notify_returning_visitor', 'false'],
    ['visitor_cooldown_minutes', '30'],
    ['notify_new_user', 'true'],
    ['notify_user_login', 'true'],
    ['notify_app_open', 'true'],
    ['notify_conversion_started', 'true'],
    ['notify_conversion_completed', 'true'],
    ['notify_conversion_failed', 'true'],
    ['notify_daily_summary', 'true'],
    ['notify_system_errors', 'true'],
    ['notify_premium_access', 'true'],
    ['notify_admin_changes', 'true'],
    ['notify_payment_received', 'true'],
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
  visitors: [],
  premium_entitlements: [],
  admin_comments: [],
  audit_logs: [],
  notification_logs: [],
  user_usage: [],
  usage_events: [],
  payments: [],
  notification_dedupe: [],
  admin_credentials: [],
  notification_settings: {
    notify_new_visitor: 'true',
    notify_returning_visitor: 'false',
    visitor_cooldown_minutes: '30',
    notify_new_user: 'true',
    notify_user_login: 'true',
    notify_app_open: 'true',
    notify_conversion_started: 'true',
    notify_conversion_completed: 'true',
    notify_conversion_failed: 'true',
    notify_daily_summary: 'true',
    notify_system_errors: 'true',
    notify_premium_access: 'true',
    notify_admin_changes: 'true',
    notify_payment_received: 'true',
  },
};

function initJsonStore() {
  if (fs.existsSync(JSON_FALLBACK_PATH)) {
    try {
      jsonStore = JSON.parse(fs.readFileSync(JSON_FALLBACK_PATH, 'utf8'));
      if (!jsonStore.jobs) jsonStore.jobs = [];
      if (!jsonStore.users) jsonStore.users = [];
      if (!jsonStore.visitors) jsonStore.visitors = [];
      if (!jsonStore.premium_entitlements) jsonStore.premium_entitlements = [];
      if (!jsonStore.notification_logs) jsonStore.notification_logs = [];
      if (!jsonStore.notification_dedupe) jsonStore.notification_dedupe = [];
      if (!jsonStore.admin_credentials) jsonStore.admin_credentials = [];
      if (!jsonStore.notification_settings) jsonStore.notification_settings = {};
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

// Timezone Cutoffs for Asia/Kolkata (UTC +05:30)
export function getAsiaKolkataCutoffs() {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffsetMs);

  const todayYear = istTime.getUTCFullYear();
  const todayMonth = istTime.getUTCMonth();
  const todayDate = istTime.getUTCDate();

  // Start of today in Asia/Kolkata converted to UTC ISO
  const startOfTodayUtc = new Date(Date.UTC(todayYear, todayMonth, todayDate) - istOffsetMs);

  // Start of current week in Asia/Kolkata (Monday)
  const dayOfWeek = (istTime.getUTCDay() + 6) % 7;
  const startOfWeekUtc = new Date(Date.UTC(todayYear, todayMonth, todayDate - dayOfWeek) - istOffsetMs);

  // Start of current month in Asia/Kolkata
  const startOfMonthUtc = new Date(Date.UTC(todayYear, todayMonth, 1) - istOffsetMs);

  return {
    today: startOfTodayUtc.toISOString(),
    thisWeek: startOfWeekUtc.toISOString(),
    thisMonth: startOfMonthUtc.toISOString(),
    todayIso: startOfTodayUtc.toISOString(),
    weekIso: startOfWeekUtc.toISOString(),
    monthIso: startOfMonthUtc.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// Database Public API
// ─────────────────────────────────────────────────────────────
export const db = {
  // --- Jobs ---
  createJob(job) {
    const inputFmt = getFileFormat(job.inputFileName, job.inputFormat);
    const id = job.id || `JOB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const nowIso = new Date().toISOString();
    const sizeBytes = job.fileSizeBytes || job.inputFileSize || 0;

    const record = {
      id,
      job_id: id,
      job_token: job.job_token || job.jobToken || crypto.randomBytes(24).toString('hex'),
      tool_id: job.toolSlug || job.toolId,
      tool_slug: job.toolSlug || job.toolId,
      tool_name: job.toolName || job.toolSlug,
      user_id: job.userId || 'anonymous',
      user_name: job.userName || 'Anonymous User',
      user_email: job.userEmail || null,
      input_file_name: job.inputFileName || 'document',
      input_file_size: sizeBytes,
      file_size_bytes: sizeBytes,
      input_format: inputFmt,
      output_file_name: job.outputFileName || null,
      output_file_size: job.outputFileSize || 0,
      output_format: job.outputFormat || null,
      status: job.status || 'started', // 'started', 'queued', 'processing', 'completed', 'failed', 'cancelled'
      processing_started_at: job.processingStartedAt || nowIso,
      processing_completed_at: job.processingCompletedAt || null,
      processing_duration_ms: job.processingDurationMs || job.durationMs || 0,
      duration_ms: job.durationMs || job.processingDurationMs || 0,
      error_code: job.errorCode || null,
      error_summary: job.errorSummary || null,
      download_token: job.downloadToken || crypto.randomUUID(),
      download_count: 0,
      created_at: job.createdAt || nowIso,
      completed_at: job.completedAt || null,
    };

    if (sqliteDb) {
      const stmt = sqliteDb.prepare(`
        INSERT INTO jobs (
          id, job_id, job_token, tool_id, tool_slug, tool_name,
          user_id, user_name, user_email,
          input_file_name, input_file_size, file_size_bytes, input_format,
          output_file_name, output_file_size, output_format,
          status, processing_started_at, processing_completed_at,
          processing_duration_ms, duration_ms, error_code, error_summary,
          download_token, download_count, created_at, completed_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `);
      stmt.run(
        record.id, record.job_id, record.job_token, record.tool_id, record.tool_slug, record.tool_name,
        record.user_id, record.user_name, record.user_email,
        record.input_file_name, record.input_file_size, record.file_size_bytes, record.input_format,
        record.output_file_name, record.output_file_size, record.output_format,
        record.status, record.processing_started_at, record.processing_completed_at,
        record.processing_duration_ms, record.duration_ms, record.error_code, record.error_summary,
        record.download_token, record.download_count, record.created_at, record.completed_at
      );
    } else {
      jsonStore.jobs.unshift(record);
      persistJsonStore();
    }
    return record;
  },

  updateJob(id, updates) {
    // Normalise duration aliases
    if (updates.durationMs && !updates.duration_ms) {
      updates.duration_ms = updates.durationMs;
      updates.processing_duration_ms = updates.durationMs;
    }
    if (updates.outputFileName && !updates.output_file_name) {
      updates.output_file_name = updates.outputFileName;
    }
    if (updates.outputFileSize && !updates.output_file_size) {
      updates.output_file_size = updates.outputFileSize;
    }
    if (updates.outputFormat && !updates.output_format) {
      updates.output_format = updates.outputFormat;
    }
    if (updates.errorSummary && !updates.error_summary) {
      updates.error_summary = updates.errorSummary;
    }
    if (updates.errorCode && !updates.error_code) {
      updates.error_code = updates.errorCode;
    }
    if (updates.status === 'completed' && !updates.completed_at) {
      const now = new Date().toISOString();
      updates.completed_at = now;
      updates.processing_completed_at = now;
    }

    if (sqliteDb) {
      const allowedCols = [
        'output_file_name', 'output_file_size', 'output_format',
        'status', 'processing_completed_at', 'processing_duration_ms',
        'duration_ms', 'error_code', 'error_summary', 'download_count',
        'completed_at', 'file_size_bytes'
      ];
      const fields = [];
      const values = [];
      for (const [key, val] of Object.entries(updates)) {
        if (allowedCols.includes(key)) {
          fields.push(`${key} = ?`);
          values.push(val);
        }
      }
      if (fields.length > 0) {
        values.push(id);
        const query = `UPDATE jobs SET ${fields.join(', ')} WHERE id = ? OR job_id = ?`;
        values.push(id);
        sqliteDb.prepare(query).run(...values);
      }
      return this.getJobById(id);
    } else {
      const idx = jsonStore.jobs.findIndex((j) => j.id === id || j.job_id === id);
      if (idx !== -1) {
        jsonStore.jobs[idx] = { ...jsonStore.jobs[idx], ...updates };
        persistJsonStore();
        return jsonStore.jobs[idx];
      }
      return null;
    }
  },

  getJobById(id) {
    if (!id) return null;
    if (sqliteDb) {
      const stmt = sqliteDb.prepare('SELECT * FROM jobs WHERE id = ? OR job_id = ?');
      return stmt.get(id, id) || null;
    } else {
      return jsonStore.jobs.find((j) => j.id === id || j.job_id === id) || null;
    }
  },

  listJobs({ limit = 50, offset = 0, status, toolSlug, search, timeRange } = {}) {
    let cutoffIso = null;
    if (timeRange && timeRange !== 'all') {
      const { todayIso, weekIso, monthIso } = getAsiaKolkataCutoffs();
      if (timeRange === 'today') {
        cutoffIso = todayIso;
      } else if (timeRange === '7d' || timeRange === 'week') {
        cutoffIso = weekIso;
      } else if (timeRange === '30d' || timeRange === 'month') {
        cutoffIso = monthIso;
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
        query += ' AND (tool_slug = ? OR tool_id = ?)';
        params.push(toolSlug, toolSlug);
      }
      if (cutoffIso) {
        query += ' AND created_at >= ?';
        params.push(cutoffIso);
      }
      if (search) {
        query += ' AND (id LIKE ? OR job_id LIKE ? OR input_file_name LIKE ? OR tool_name LIKE ? OR user_name LIKE ?)';
        const s = `%${search}%`;
        params.push(s, s, s, s, s);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const stmt = sqliteDb.prepare(query);
      return stmt.all(...params);
    } else {
      let list = [...jsonStore.jobs];
      if (status && status !== 'all') list = list.filter((j) => j.status === status);
      if (toolSlug && toolSlug !== 'all') list = list.filter((j) => j.tool_slug === toolSlug || j.tool_id === toolSlug);
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

  countJobs({ status, toolSlug, search, timeRange } = {}) {
    let cutoffIso = null;
    if (timeRange && timeRange !== 'all') {
      const { todayIso, weekIso, monthIso } = getAsiaKolkataCutoffs();
      if (timeRange === 'today') cutoffIso = todayIso;
      else if (timeRange === '7d' || timeRange === 'week') cutoffIso = weekIso;
      else if (timeRange === '30d' || timeRange === 'month') cutoffIso = monthIso;
    }

    if (sqliteDb) {
      let query = 'SELECT COUNT(*) as count FROM jobs WHERE 1=1';
      const params = [];
      if (status && status !== 'all') {
        query += ' AND status = ?';
        params.push(status);
      }
      if (toolSlug && toolSlug !== 'all') {
        query += ' AND (tool_slug = ? OR tool_id = ?)';
        params.push(toolSlug, toolSlug);
      }
      if (cutoffIso) {
        query += ' AND created_at >= ?';
        params.push(cutoffIso);
      }
      if (search) {
        query += ' AND (id LIKE ? OR input_file_name LIKE ? OR tool_name LIKE ?)';
        const s = `%${search}%`;
        params.push(s, s, s);
      }
      const res = sqliteDb.prepare(query).get(...params);
      return res?.count || 0;
    } else {
      return this.listJobs({ limit: 100000, status, toolSlug, search, timeRange }).length;
    }
  },

  // --- Real Visitor Analytics ---
  recordVisitor({ id, isAuthenticated = false, userId = null }) {
    if (!id) return { isNew: false, pageViews: 0 };
    const now = new Date().toISOString();

    if (sqliteDb) {
      const existing = sqliteDb.prepare('SELECT id, page_views FROM visitors WHERE id = ?').get(id);
      if (existing) {
        sqliteDb.prepare(`
          UPDATE visitors SET
            page_views = page_views + 1,
            is_authenticated = MAX(is_authenticated, ?),
            user_id = COALESCE(?, user_id),
            last_seen_at = ?
          WHERE id = ?
        `).run(isAuthenticated ? 1 : 0, userId, now, id);
        return { isNew: false, pageViews: (existing.page_views || 1) + 1 };
      } else {
        sqliteDb.prepare(`
          INSERT INTO visitors (id, is_authenticated, user_id, page_views, first_seen_at, last_seen_at)
          VALUES (?, ?, ?, 1, ?, ?)
        `).run(id, isAuthenticated ? 1 : 0, userId, now, now);
        return { isNew: true, pageViews: 1 };
      }
    } else {
      const idx = jsonStore.visitors.findIndex((v) => v.id === id);
      if (idx !== -1) {
        jsonStore.visitors[idx].page_views = (jsonStore.visitors[idx].page_views || 1) + 1;
        jsonStore.visitors[idx].last_seen_at = now;
        if (isAuthenticated) jsonStore.visitors[idx].is_authenticated = 1;
        if (userId) jsonStore.visitors[idx].user_id = userId;
        persistJsonStore();
        return { isNew: false, pageViews: jsonStore.visitors[idx].page_views };
      } else {
        jsonStore.visitors.push({
          id,
          is_authenticated: isAuthenticated ? 1 : 0,
          user_id: userId,
          page_views: 1,
          first_seen_at: now,
          last_seen_at: now,
        });
        persistJsonStore();
        return { isNew: true, pageViews: 1 };
      }
    }
  },

  getVisitorStats() {
    if (sqliteDb) {
      const totalVisitors = sqliteDb.prepare('SELECT COUNT(*) as total FROM visitors').get()?.total || 0;
      const authenticatedVisitors = sqliteDb.prepare('SELECT COUNT(*) as total FROM visitors WHERE is_authenticated = 1').get()?.total || 0;
      const anonymousVisitors = Math.max(0, totalVisitors - authenticatedVisitors);
      const totalPageViews = sqliteDb.prepare('SELECT SUM(page_views) as total FROM visitors').get()?.total || 0;
      const returningVisitors = sqliteDb.prepare('SELECT COUNT(*) as total FROM visitors WHERE page_views > 1').get()?.total || 0;

      return {
        totalVisitors,
        authenticatedVisitors,
        anonymousVisitors,
        totalPageViews,
        returningVisitors,
      };
    } else {
      const totalVisitors = jsonStore.visitors.length;
      const authenticatedVisitors = jsonStore.visitors.filter((v) => v.is_authenticated === 1).length;
      const anonymousVisitors = Math.max(0, totalVisitors - authenticatedVisitors);
      const totalPageViews = jsonStore.visitors.reduce((acc, v) => acc + (v.page_views || 1), 0);
      const returningVisitors = jsonStore.visitors.filter((v) => (v.page_views || 1) > 1).length;

      return {
        totalVisitors,
        authenticatedVisitors,
        anonymousVisitors,
        totalPageViews,
        returningVisitors,
      };
    }
  },

  // --- Real Premium Analytics ---
  getPremiumStats() {
    if (sqliteDb) {
      const active = sqliteDb.prepare("SELECT COUNT(*) as total FROM premium_entitlements WHERE status = 'active'").get()?.total || 0;
      const expired = sqliteDb.prepare("SELECT COUNT(*) as total FROM premium_entitlements WHERE status = 'expired'").get()?.total || 0;
      const revoked = sqliteDb.prepare("SELECT COUNT(*) as total FROM premium_entitlements WHERE status = 'revoked'").get()?.total || 0;
      const verifiedPaid = sqliteDb.prepare('SELECT SUM(amount_paid) as total FROM premium_entitlements WHERE payment_verified = 1').get()?.total || 0;

      return {
        activeAccounts: active,
        expiredAccounts: expired,
        revokedAccounts: revoked,
        totalVerifiedRevenue: verifiedPaid,
      };
    } else {
      const ents = jsonStore.premium_entitlements || [];
      const active = ents.filter((e) => e.status === 'active').length;
      const expired = ents.filter((e) => e.status === 'expired').length;
      const revoked = ents.filter((e) => e.status === 'revoked').length;
      const verifiedPaid = ents
        .filter((e) => e.payment_verified === 1)
        .reduce((sum, e) => sum + (e.amount_paid || 0), 0);

      return {
        activeAccounts: active,
        expiredAccounts: expired,
        revokedAccounts: revoked,
        totalVerifiedRevenue: verifiedPaid,
      };
    }
  },

  // --- Persistent Usage Tracking (Idempotent & Scoped) ---
  recordSuccessfulUsage({ userId, actionSlug, actionCategory = 'conversion', jobId = null, eventId = null }) {
    if (!userId || !actionSlug) return { actionCount: 0, totalUserCount: 0, wasNewEvent: false };
    const dedupeKey = eventId || (jobId ? `job_${jobId}` : `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const now = new Date().toISOString();

    if (sqliteDb) {
      const existing = sqliteDb.prepare('SELECT event_id FROM usage_events WHERE event_id = ?').get(dedupeKey);
      if (existing) {
        const stats = this.getUserUsageStats(userId);
        return {
          success: true,
          duplicate: true,
          wasNewEvent: false,
          actionCount: stats.byAction[actionSlug] || 0,
          totalUserCount: stats.totalSuccessful || 0,
        };
      }

      sqliteDb.prepare('INSERT INTO usage_events (event_id, user_id, job_id, action_slug, created_at) VALUES (?, ?, ?, ?, ?)').run(
        dedupeKey, userId, jobId, actionSlug, now
      );

      const usageId = `usage_${userId}_${actionSlug}`;
      sqliteDb.prepare(`
        INSERT INTO user_usage (id, user_id, action_slug, action_category, success_count, last_success_at)
        VALUES (?, ?, ?, ?, 1, ?)
        ON CONFLICT(user_id, action_slug) DO UPDATE SET
          success_count = success_count + 1,
          last_success_at = excluded.last_success_at
      `).run(usageId, userId, actionSlug, actionCategory, now);

      const stats = this.getUserUsageStats(userId);
      return {
        success: true,
        duplicate: false,
        wasNewEvent: true,
        actionCount: stats.byAction[actionSlug] || 1,
        totalUserCount: stats.totalSuccessful || 1,
      };
    } else {
      if (!jsonStore.usage_events) jsonStore.usage_events = [];
      if (!jsonStore.user_usage) jsonStore.user_usage = [];

      const existing = jsonStore.usage_events.find((e) => e.event_id === dedupeKey);
      if (existing) {
        const stats = this.getUserUsageStats(userId);
        return {
          success: true,
          duplicate: true,
          wasNewEvent: false,
          actionCount: stats.byAction[actionSlug] || 0,
          totalUserCount: stats.totalSuccessful || 0,
        };
      }

      jsonStore.usage_events.push({ event_id: dedupeKey, user_id: userId, job_id: jobId, action_slug: actionSlug, created_at: now });
      const record = jsonStore.user_usage.find((u) => u.user_id === userId && u.action_slug === actionSlug);
      if (record) {
        record.success_count = (record.success_count || 0) + 1;
        record.last_success_at = now;
      } else {
        jsonStore.user_usage.push({
          id: `usage_${userId}_${actionSlug}`,
          user_id: userId,
          action_slug: actionSlug,
          action_category: actionCategory,
          success_count: 1,
          last_success_at: now,
        });
      }
      persistJsonStore();
      const stats = this.getUserUsageStats(userId);
      return {
        success: true,
        duplicate: false,
        wasNewEvent: true,
        actionCount: stats.byAction[actionSlug] || 1,
        totalUserCount: stats.totalSuccessful || 1,
      };
    }
  },

  getUserUsageStats(userId) {
    if (!userId) return { totalSuccessful: 0, byAction: {} };
    if (sqliteDb) {
      const rows = sqliteDb.prepare('SELECT action_slug, success_count FROM user_usage WHERE user_id = ?').all(userId);
      const byAction = {};
      let totalSuccessful = 0;
      for (const r of rows) {
        byAction[r.action_slug] = r.success_count;
        totalSuccessful += r.success_count;
      }
      return { totalSuccessful, byAction };
    } else {
      if (!jsonStore.user_usage) jsonStore.user_usage = [];
      const userRows = jsonStore.user_usage.filter((u) => u.user_id === userId);
      const byAction = {};
      let totalSuccessful = 0;
      for (const r of userRows) {
        byAction[r.action_slug] = r.success_count;
        totalSuccessful += r.success_count;
      }
      return { totalSuccessful, byAction };
    }
  },

  // --- Secure Razorpay Payments & Entitlements ---
  createPaymentOrder({ orderId, userId, userEmail, plan, planId, amount, currency = 'INR' }) {
    const selectedPlan = plan || planId || 'premium';
    const now = new Date().toISOString();
    const id = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record = {
      id,
      order_id: orderId,
      payment_id: null,
      signature: null,
      user_id: userId,
      user_email: userEmail || null,
      plan: selectedPlan,
      amount,
      currency,
      status: 'created',
      created_at: now,
      paid_at: null,
    };

    if (sqliteDb) {
      sqliteDb.prepare(`
        INSERT INTO payments (id, order_id, user_id, user_email, plan, amount, currency, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(record.id, record.order_id, record.user_id, record.user_email, record.plan, record.amount, record.currency, record.status, record.created_at);
    } else {
      if (!jsonStore.payments) jsonStore.payments = [];
      jsonStore.payments.push(record);
      persistJsonStore();
    }
    return record;
  },

  getPaymentOrderByOrderId(orderId) {
    if (!orderId) return null;
    if (sqliteDb) {
      return sqliteDb.prepare('SELECT * FROM payments WHERE order_id = ?').get(orderId) || null;
    } else {
      if (!jsonStore.payments) jsonStore.payments = [];
      return jsonStore.payments.find((p) => p.order_id === orderId) || null;
    }
  },

  markPaymentSuccess({ orderId, paymentId, signature }) {
    const now = new Date().toISOString();
    if (sqliteDb) {
      sqliteDb.prepare(`
        UPDATE payments
        SET status = 'paid', payment_id = ?, signature = ?, paid_at = ?
        WHERE order_id = ?
      `).run(paymentId, signature, now, orderId);
      return this.getPaymentOrderByOrderId(orderId);
    } else {
      if (!jsonStore.payments) jsonStore.payments = [];
      const payment = jsonStore.payments.find((p) => p.order_id === orderId);
      if (payment) {
        payment.status = 'paid';
        payment.payment_id = paymentId;
        payment.signature = signature;
        payment.paid_at = now;
        persistJsonStore();
      }
      return payment || null;
    }
  },

  grantPremiumEntitlement({ userId, plan = 'pro', amountPaid = 0, currency = 'INR' }) {
    const now = new Date().toISOString();
    if (sqliteDb) {
      sqliteDb.prepare(`
        INSERT INTO premium_entitlements (user_id, plan, status, activated_at, amount_paid, currency, payment_verified)
        VALUES (?, ?, 'active', ?, ?, ?, 1)
        ON CONFLICT(user_id) DO UPDATE SET
          plan = excluded.plan,
          status = 'active',
          activated_at = excluded.activated_at,
          amount_paid = premium_entitlements.amount_paid + excluded.amount_paid,
          currency = excluded.currency,
          payment_verified = 1
      `).run(userId, plan, now, amountPaid, currency);
      return this.getPremiumEntitlement(userId);
    } else {
      if (!jsonStore.premium_entitlements) jsonStore.premium_entitlements = [];
      let ent = jsonStore.premium_entitlements.find((e) => e.user_id === userId);
      if (ent) {
        ent.plan = plan;
        ent.status = 'active';
        ent.activated_at = now;
        ent.amount_paid = (ent.amount_paid || 0) + amountPaid;
        ent.currency = currency;
        ent.payment_verified = 1;
      } else {
        ent = {
          user_id: userId,
          plan,
          status: 'active',
          activated_at: now,
          expires_at: null,
          amount_paid: amountPaid,
          currency,
          payment_verified: 1,
        };
        jsonStore.premium_entitlements.push(ent);
      }
      persistJsonStore();
      return ent;
    }
  },

  getPremiumEntitlement(userId) {
    if (!userId) return null;
    if (sqliteDb) {
      return sqliteDb.prepare('SELECT * FROM premium_entitlements WHERE user_id = ?').get(userId) || null;
    } else {
      if (!jsonStore.premium_entitlements) jsonStore.premium_entitlements = [];
      return jsonStore.premium_entitlements.find((e) => e.user_id === userId) || null;
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
  addNotificationLog({ eventType, status, chatId, messageId = null, errorMessage = null, errorCode = null, retryCount = 0, jobId = null }) {
    const now = new Date().toISOString();
    const record = {
      id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      job_id: jobId || null,
      event_type: eventType,
      status: status || 'sent', // 'sent', 'failed', 'mocked', 'retried'
      chat_id: chatId || null,
      message_id: messageId || null,
      error_message: errorMessage || null,
      error_code: errorCode || null,
      retry_count: retryCount || 0,
      created_at: now,
      delivered_at: status === 'sent' || status === 'retried' ? now : null,
    };

    if (sqliteDb) {
      sqliteDb.prepare(`
        INSERT INTO notification_logs (
          id, job_id, event_type, status, chat_id, message_id,
          error_message, error_code, retry_count, created_at, delivered_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        record.id, record.job_id, record.event_type, record.status, record.chat_id, record.message_id,
        record.error_message, record.error_code, record.retry_count, record.created_at, record.delivered_at
      );
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

  getNotificationLogs(limit = 50) {
    return this.listNotificationLogs({ limit });
  },

  getNotificationStats() {
    const isLiveConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN);
    if (sqliteDb) {
      const total = sqliteDb.prepare('SELECT COUNT(*) as total FROM notification_logs').get()?.total || 0;
      const sent = sqliteDb.prepare("SELECT COUNT(*) as total FROM notification_logs WHERE status IN ('sent', 'retried')").get()?.total || 0;
      const failed = sqliteDb.prepare("SELECT COUNT(*) as total FROM notification_logs WHERE status = 'failed'").get()?.total || 0;
      const mocked = sqliteDb.prepare("SELECT COUNT(*) as total FROM notification_logs WHERE status = 'mocked'").get()?.total || 0;
      const liveAttempts = sent + failed;
      const rate = liveAttempts > 0 ? Math.round((sent / liveAttempts) * 100) : (total > 0 && mocked > 0 ? 0 : 0);
      return { total, sent, failed, mocked, liveAttempts, deliverySuccessRate: rate, deliveryMode: isLiveConfigured ? 'live' : 'mock' };
    } else {
      const logs = jsonStore.notification_logs || [];
      const total = logs.length;
      const sent = logs.filter((l) => l.status === 'sent' || l.status === 'retried').length;
      const failed = logs.filter((l) => l.status === 'failed').length;
      const mocked = logs.filter((l) => l.status === 'mocked').length;
      const liveAttempts = sent + failed;
      const rate = liveAttempts > 0 ? Math.round((sent / liveAttempts) * 100) : (total > 0 && mocked > 0 ? 0 : 0);
      return { total, sent, failed, mocked, liveAttempts, deliverySuccessRate: rate, deliveryMode: isLiveConfigured ? 'live' : 'mock' };
    }
  },

  // --- Notification Settings ---
  getNotificationSettings() {
    const parseVal = (v) => {
      if (v === 'true') return true;
      if (v === 'false') return false;
      if (v !== '' && !isNaN(Number(v))) return Number(v);
      return v;
    };

    if (sqliteDb) {
      const rows = sqliteDb.prepare('SELECT key, value FROM notification_settings').all();
      const settings = {};
      for (const row of rows) {
        settings[row.key] = parseVal(row.value);
      }
      return settings;
    } else {
      const settings = {};
      for (const [k, v] of Object.entries(jsonStore.notification_settings || {})) {
        settings[k] = parseVal(v);
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
      if (!jsonStore.notification_settings) jsonStore.notification_settings = {};
      for (const [k, v] of Object.entries(updates)) {
        jsonStore.notification_settings[k] = String(v);
      }
      persistJsonStore();
    }
    return this.getNotificationSettings();
  },

  // --- Persistent Notification Deduplication ---
  checkAndSetDedupe(dedupeKey, ttlMs = 30000, eventType = '', entityId = '') {
    if (!dedupeKey) return false;
    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

    if (sqliteDb) {
      try {
        // 1. Opportunistically clear expired entries
        sqliteDb.prepare('DELETE FROM notification_dedupe WHERE expires_at < ?').run(nowIso);

        // 2. Query for existing entry
        const existing = sqliteDb.prepare('SELECT dedupe_key, expires_at FROM notification_dedupe WHERE dedupe_key = ?').get(dedupeKey);
        if (existing) {
          if (existing.expires_at >= nowIso) {
            return true; // Duplicate! Active lock
          }
          // Expired, renew lock
          sqliteDb.prepare('UPDATE notification_dedupe SET expires_at = ?, created_at = ?, event_type = ?, entity_id = ? WHERE dedupe_key = ?')
            .run(expiresAt, nowIso, eventType, entityId, dedupeKey);
          return false; // Renewed
        }

        // 3. Atomically insert new key
        sqliteDb.prepare('INSERT INTO notification_dedupe (dedupe_key, event_type, entity_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
          .run(dedupeKey, eventType, entityId, nowIso, expiresAt);
        return false; // Claimed
      } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
          return true; // Caught concurrent duplicate
        }
        return false;
      }
    } else {
      if (!jsonStore.notification_dedupe) jsonStore.notification_dedupe = [];
      // Clean up expired entries
      jsonStore.notification_dedupe = jsonStore.notification_dedupe.filter(
        (item) => item.expires_at >= nowIso
      );

      const existing = jsonStore.notification_dedupe.find((item) => item.dedupe_key === dedupeKey);
      if (existing) {
        return true; // Duplicate
      }

      jsonStore.notification_dedupe.push({
        dedupe_key: dedupeKey,
        event_type: eventType,
        entity_id: entityId,
        created_at: nowIso,
        expires_at: expiresAt,
      });
      persistJsonStore();
      return false; // Claimed
    }
  },

  clearDedupe(dedupeKey) {
    if (!dedupeKey) return;
    if (sqliteDb) {
      sqliteDb.prepare('DELETE FROM notification_dedupe WHERE dedupe_key = ?').run(dedupeKey);
    } else {
      if (jsonStore.notification_dedupe) {
        jsonStore.notification_dedupe = jsonStore.notification_dedupe.filter((item) => item.dedupe_key !== dedupeKey);
        persistJsonStore();
      }
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Persistent Administrator Credentials Store
  // ─────────────────────────────────────────────────────────────
  getAdminCredential(username = 'admin') {
    if (sqliteDb) {
      try {
        const row = sqliteDb.prepare('SELECT * FROM admin_credentials WHERE username = ? LIMIT 1').get(username);
        if (!row) return null;
        return {
          id: row.id,
          username: row.username,
          passwordHash: row.password_hash,
          salt: row.salt,
          mustChangePassword: Boolean(row.must_change_password),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      } catch (err) {
        return null;
      }
    } else {
      const cred = (jsonStore.admin_credentials || []).find((c) => c.username === username);
      if (!cred) return null;
      return {
        id: cred.id,
        username: cred.username,
        passwordHash: cred.password_hash || cred.passwordHash,
        salt: cred.salt,
        mustChangePassword: Boolean(cred.must_change_password ?? cred.mustChangePassword),
        createdAt: cred.created_at || cred.createdAt,
        updatedAt: cred.updated_at || cred.updatedAt,
      };
    }
  },

  saveAdminCredential({ username = 'admin', passwordHash, salt, mustChangePassword = false, updatedAt = null }) {
    if (!passwordHash || !salt) return null;
    const now = new Date().toISOString();
    const updateTime = updatedAt || now;
    const id = `admin_${username}`;
    const mustChangeVal = mustChangePassword ? 1 : 0;

    if (sqliteDb) {
      try {
        // Prevent stale synchronization from overwriting newer database records
        const existing = sqliteDb.prepare('SELECT updated_at FROM admin_credentials WHERE username = ?').get(username);
        if (existing?.updated_at && updateTime < existing.updated_at) {
          return this.getAdminCredential(username);
        }

        sqliteDb.prepare(`
          INSERT INTO admin_credentials (id, username, password_hash, salt, must_change_password, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(username) DO UPDATE SET
            password_hash = excluded.password_hash,
            salt = excluded.salt,
            must_change_password = excluded.must_change_password,
            updated_at = excluded.updated_at
        `).run(id, username, passwordHash, salt, mustChangeVal, now, updateTime);
      } catch (err) {
        console.warn('[DB] Failed to save admin credentials to SQLite:', err.message);
      }
    } else {
      if (!jsonStore.admin_credentials) jsonStore.admin_credentials = [];
      const idx = jsonStore.admin_credentials.findIndex((c) => c.username === username);
      if (idx >= 0 && jsonStore.admin_credentials[idx].updated_at && updateTime < jsonStore.admin_credentials[idx].updated_at) {
        return this.getAdminCredential(username);
      }
      const record = {
        id,
        username,
        password_hash: passwordHash,
        salt,
        must_change_password: mustChangeVal,
        created_at: idx >= 0 ? (jsonStore.admin_credentials[idx].created_at || now) : now,
        updated_at: updateTime,
      };
      if (idx >= 0) {
        jsonStore.admin_credentials[idx] = record;
      } else {
        jsonStore.admin_credentials.push(record);
      }
      persistJsonStore();
    }
    return this.getAdminCredential(username);
  },

  // ─────────────────────────────────────────────────────────────
  // Platform Metrics & Genuine Analytics (Asia/Kolkata timezone)
  // ─────────────────────────────────────────────────────────────
  getStats(timeRange = 'all') {
    return this.getDetailedStats(timeRange);
  },

  getDetailedStats(timeRange = 'all') {
    const { todayIso, weekIso, monthIso } = getAsiaKolkataCutoffs();

    let cutoffIso = null;
    if (timeRange === 'today') {
      cutoffIso = todayIso;
    } else if (timeRange === '7d' || timeRange === 'week') {
      cutoffIso = weekIso;
    } else if (timeRange === '30d' || timeRange === 'month') {
      cutoffIso = monthIso;
    }

    let allFilteredJobs = [];
    let totalUsers = 0;

    if (sqliteDb) {
      const userCount = sqliteDb.prepare('SELECT COUNT(*) as total FROM users').get();
      totalUsers = userCount?.total || 0;

      let query = 'SELECT * FROM jobs';
      const params = [];
      if (cutoffIso) {
        query += ' WHERE created_at >= ?';
        params.push(cutoffIso);
      }
      query += ' ORDER BY created_at DESC';
      allFilteredJobs = sqliteDb.prepare(query).all(...params);
    } else {
      totalUsers = jsonStore.users.length;
      allFilteredJobs = cutoffIso
        ? jsonStore.jobs.filter((j) => j.created_at >= cutoffIso)
        : [...jsonStore.jobs];
      allFilteredJobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    // Accurate calculation of metrics:
    // Helper: genuine completed conversion must have status 'completed' and valid output file
    const isGenuineCompleted = (j) => j.status === 'completed' && Boolean(j.output_file_name && String(j.output_file_name).trim().length > 0);

    // 1. Total Completed Jobs
    const completedJobs = allFilteredJobs.filter((j) => j.status === 'completed').length;
    // 2. Successful Conversions (verified completed conversions with valid output file)
    const successfulConversions = allFilteredJobs.filter(isGenuineCompleted).length;
    // 3. Failed Conversions
    const failedJobs = allFilteredJobs.filter((j) => j.status === 'failed').length;
    // 4. Active conversions in progress
    const activeJobs = allFilteredJobs.filter((j) => j.status === 'started' || j.status === 'processing' || j.status === 'queued').length;
    const totalJobs = allFilteredJobs.length;

    // 5. Success Rate: (Successful / (Successful + Failed)) * 100. If 0 finished jobs, display 0
    const finishedJobs = successfulConversions + failedJobs;
    const successRate = finishedJobs > 0 ? Math.round((successfulConversions / finishedJobs) * 100) : 0;

    // 6. Processing Time: Total and Average of verified completed jobs
    const totalProcessingDurationMs = allFilteredJobs.reduce((acc, j) => {
      const dur = j.processing_duration_ms || j.duration_ms || 0;
      if (j.status === 'completed' && dur > 0) return acc + dur;
      return acc;
    }, 0);
    const avgProcessingTimeMs = successfulConversions > 0
      ? Math.round(totalProcessingDurationMs / successfulConversions)
      : (completedJobs > 0 ? Math.round(totalProcessingDurationMs / completedJobs) : 0);

    // 7. Total Data Processed: sum of file_size_bytes or input_file_size for verified completed jobs
    const totalDataProcessedBytes = allFilteredJobs.reduce((acc, j) => {
      if (j.status === 'completed' && isGenuineCompleted(j)) {
        const size = j.file_size_bytes || j.input_file_size || 0;
        return acc + size;
      }
      return acc;
    }, 0);

    // 8. Total Bytes Saved (for compression tools)
    const totalBytesSaved = allFilteredJobs.reduce((acc, j) => {
      const inp = j.input_file_size || j.file_size_bytes || 0;
      const out = j.output_file_size || 0;
      if (j.status === 'completed' && inp > out && out > 0) {
        return acc + (inp - out);
      }
      return acc;
    }, 0);

    // 9. Period counts in Asia/Kolkata (independent of user timeRange filter)
    let jobsAllTime = [];
    if (sqliteDb) {
      jobsAllTime = sqliteDb.prepare('SELECT created_at, status, output_file_name FROM jobs').all();
    } else {
      jobsAllTime = jsonStore.jobs;
    }
    const todayCount = jobsAllTime.filter((j) => j.created_at >= todayIso && isGenuineCompleted(j)).length;
    const weekCount = jobsAllTime.filter((j) => j.created_at >= weekIso && isGenuineCompleted(j)).length;
    const monthCount = jobsAllTime.filter((j) => j.created_at >= monthIso && isGenuineCompleted(j)).length;

    // 10. Most used conversion tools breakdown
    const usageMap = {};
    for (const j of allFilteredJobs) {
      const slug = j.tool_slug || j.tool_id || 'unknown';
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

    // 11. File format distribution
    const formatMap = {};
    for (const j of allFilteredJobs) {
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

    // 12. Daily conversion trends (last 7 days in Asia/Kolkata)
    const dailyTrends = this.calculateDailyTrends(allFilteredJobs, 7);

    // 13. Recent conversion activity (last 10 jobs)
    const recentActivity = allFilteredJobs.slice(0, 10).map((j) => ({
      id: j.id || j.job_id,
      jobId: j.job_id || j.id,
      toolName: j.tool_name,
      toolSlug: j.tool_slug || j.tool_id,
      inputFileName: j.input_file_name,
      outputFileName: j.output_file_name,
      inputFormat: j.input_format,
      outputFormat: j.output_format,
      status: j.status,
      durationMs: j.duration_ms || j.processing_duration_ms || 0,
      inputFileSize: j.input_file_size || j.file_size_bytes || 0,
      outputFileSize: j.output_file_size || 0,
      createdAt: j.created_at,
      completedAt: j.completed_at || j.processing_completed_at,
    }));

    // 14. Integrated auxiliary metrics
    const visitorStats = this.getVisitorStats();
    const premiumStats = this.getPremiumStats();
    const telegramStats = this.getNotificationStats();

    return {
      totalJobs,
      completedJobs,
      successfulConversions,
      failedJobs,
      activeJobs,
      totalUsers,
      totalBytesSaved,
      totalDataProcessedBytes,
      successRate,
      totalProcessingDurationMs,
      avgProcessingTimeMs,
      todayCount,
      weekCount,
      monthCount,
      toolUsage,
      fileTypeDistribution,
      dailyTrends,
      recentActivity,
      visitorStats,
      visitors: {
        ...visitorStats,
        uniqueVisitors: visitorStats.totalVisitors,
      },
      premiumStats,
      telegramStats,
      timeRange,
      timezone: 'Asia/Kolkata (+05:30)',
      systemHealth: {
        application: 'healthy',
        database: sqliteDb ? 'connected (sqlite)' : 'connected (json fallback)',
        storage: 'available',
      },
    };
  },

  getAsiaKolkataCutoffs,

  calculateDailyTrends(jobsList, days = 7) {
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const trendsMap = {};

    // Pre-populate empty days so there are no missing dates
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000 + istOffsetMs);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const dateKey = `${yyyy}-${mm}-${dd}`;
      trendsMap[dateKey] = {
        date: dateKey,
        label: `${dd}/${mm}`,
        completed: 0,
        failed: 0,
        total: 0,
      };
    }

    for (const j of jobsList) {
      if (!j.created_at) continue;
      const jobTime = new Date(new Date(j.created_at).getTime() + istOffsetMs);
      const yyyy = jobTime.getUTCFullYear();
      const mm = String(jobTime.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(jobTime.getUTCDate()).padStart(2, '0');
      const dateKey = `${yyyy}-${mm}-${dd}`;

      if (trendsMap[dateKey]) {
        trendsMap[dateKey].total++;
        if (j.status === 'completed') trendsMap[dateKey].completed++;
        if (j.status === 'failed') trendsMap[dateKey].failed++;
      }
    }

    return Object.values(trendsMap);
  },
};
