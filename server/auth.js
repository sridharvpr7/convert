// ============================================================
// CONVETER — Admin Authentication Module
// Uses Node.js built-in crypto (scrypt) for password hashing.
// Session management with crypto.randomUUID() tokens.
// ============================================================

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = path.resolve(__dirname, '../config');
const ADMIN_CONFIG_PATH = path.join(CONFIG_DIR, 'admin.json');

// In-memory session store (survives across requests, lost on restart)
const sessions = new Map();

// Login rate limiting: IP -> { count, windowStart }
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 5;

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─────────────────────────────────────────────────────────────
// Password Hashing (scrypt)
// ─────────────────────────────────────────────────────────────
function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    const saltBuf = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(32);
    crypto.scrypt(password, saltBuf, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve({
        hash: derivedKey.toString('hex'),
        salt: saltBuf.toString('hex'),
      });
    });
  });
}

export function isScryptHash(str) {
  return typeof str === 'string' && str.length === 128 && /^[0-9a-fA-F]{128}$/.test(str);
}

async function verifyPassword(password, storedHash, storedSalt) {
  if (!password || !storedHash || !storedSalt) return false;

  // Enforce genuine 128-hex-character scrypt hash; never accept plaintext
  if (!isScryptHash(storedHash)) {
    return false;
  }

  // Salt must be a valid hex string of at least 32 characters (16+ bytes)
  if (typeof storedSalt !== 'string' || storedSalt.length < 32 || !/^[0-9a-fA-F]+$/.test(storedSalt)) {
    return false;
  }

  try {
    const { hash } = await hashPassword(password, storedSalt);
    const bufA = Buffer.from(hash, 'hex');
    const bufB = Buffer.from(storedHash, 'hex');
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Admin Config Management
// ─────────────────────────────────────────────────────────────
let adminConfig = null;

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function ensureLocalAdminJsonMirror(cfg) {
  try {
    ensureConfigDir();
    if (!fs.existsSync(ADMIN_CONFIG_PATH) && cfg?.admin) {
      fs.writeFileSync(ADMIN_CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
    }
  } catch {}
}

function syncToDatabase(cfg) {
  try {
    if (db && typeof db.saveAdminCredential === 'function' && cfg?.admin) {
      db.saveAdminCredential({
        username: cfg.admin.username,
        passwordHash: cfg.admin.passwordHash,
        salt: cfg.admin.salt,
        mustChangePassword: cfg.admin.mustChangePassword,
      });
    }
  } catch (err) {
    console.warn('[Auth] Database sync error:', err.message);
  }
}

/**
 * Performs a safe, one-time migration if legacy plaintext credentials are detected.
 * Converts plaintext to genuine scrypt hash and immediately persists it.
 */
async function migrateIfLegacyCredentials(cfg) {
  if (!cfg?.admin?.passwordHash) return false;

  if (!isScryptHash(cfg.admin.passwordHash)) {
    const legacyPlaintext = String(cfg.admin.passwordHash).trim();
    if (!legacyPlaintext) return false;

    const { hash, salt } = await hashPassword(legacyPlaintext);
    cfg.admin.passwordHash = hash;
    cfg.admin.salt = salt;
    saveAdminConfig();
    console.log('[Auth Security] One-time migration completed: legacy credentials migrated to scrypt hash.');
    return true;
  }
  return false;
}

async function loadAdminConfig() {
  ensureConfigDir();

  // 1. Try SQLite / JSON store first (primary persistent database)
  try {
    if (db && typeof db.getAdminCredential === 'function') {
      const dbCred = db.getAdminCredential('admin');
      if (dbCred && dbCred.passwordHash && dbCred.salt) {
        adminConfig = {
          admin: {
            username: dbCred.username,
            passwordHash: dbCred.passwordHash,
            salt: dbCred.salt,
            mustChangePassword: Boolean(dbCred.mustChangePassword),
          },
        };
        await migrateIfLegacyCredentials(adminConfig);
        ensureLocalAdminJsonMirror(adminConfig);
        return false; // Found in persistent database!
      }
    }
  } catch (err) {
    console.warn('[Auth] Database admin lookup error:', err.message);
  }

  // 2. Try persistent disk path if DATA_DIR is configured (Render persistent disk)
  if (process.env.DATA_DIR) {
    const candidates = [
      path.join(process.env.DATA_DIR, 'config', 'admin.json'),
      path.join(process.env.DATA_DIR, 'admin.json'),
    ];
    for (const persistentPath of candidates) {
      if (fs.existsSync(persistentPath)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(persistentPath, 'utf8'));
          if (parsed?.admin?.passwordHash) {
            adminConfig = parsed;
            await migrateIfLegacyCredentials(adminConfig);
            syncToDatabase(adminConfig);
            ensureLocalAdminJsonMirror(adminConfig);
            return false;
          }
        } catch (err) {
          console.error('[Auth] Failed to parse persistent admin.json:', err.message);
        }
      }
    }
  }

  // 3. Fall back to application CONFIG_DIR (local config/admin.json)
  if (fs.existsSync(ADMIN_CONFIG_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(ADMIN_CONFIG_PATH, 'utf8'));
      if (parsed?.admin?.passwordHash) {
        adminConfig = parsed;
        await migrateIfLegacyCredentials(adminConfig);
        syncToDatabase(adminConfig);
        return false; // not first run
      }
    } catch (err) {
      console.error('[Auth] Failed to parse admin.json:', err.message);
    }
  }

  return true; // Genuinely first run, needs initialization
}

function saveAdminConfig() {
  if (!adminConfig?.admin) return;

  // 1. Persist to primary SQLite / JSON database
  syncToDatabase(adminConfig);

  // 2. Persist to application CONFIG_DIR
  ensureConfigDir();
  try {
    fs.writeFileSync(ADMIN_CONFIG_PATH, JSON.stringify(adminConfig, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Auth] Failed to persist admin.json (ephemeral FS?):', err.message);
  }

  // 3. Persist to Render Persistent Disk if DATA_DIR is configured
  if (process.env.DATA_DIR) {
    try {
      const persistentDir = path.join(process.env.DATA_DIR, 'config');
      if (!fs.existsSync(persistentDir)) {
        fs.mkdirSync(persistentDir, { recursive: true });
      }
      fs.writeFileSync(path.join(persistentDir, 'admin.json'), JSON.stringify(adminConfig, null, 2), 'utf8');
      fs.writeFileSync(path.join(process.env.DATA_DIR, 'admin.json'), JSON.stringify(adminConfig, null, 2), 'utf8');
    } catch (err) {
      console.warn('[Auth] Failed to persist admin.json to DATA_DIR:', err.message);
    }
  }
}

/**
 * Initialize admin credentials. Call on server startup.
 * Returns credentials summary if freshly created, null if already exists.
 */
export async function initializeAuth() {
  const isFirstRun = await loadAdminConfig();

  // If administrator already exists anywhere, NEVER overwrite or recreate!
  if (!isFirstRun && adminConfig?.admin) {
    return null;
  }

  // Check if an admin password was supplied via environment variables
  // (e.g. ADMIN_PASSWORD or ADMIN_INITIAL_PASSWORD)
  const envPassword = (process.env.ADMIN_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD || '').trim();
  const envUsername = (process.env.ADMIN_USERNAME || 'admin').trim();

  let initialPassword = envPassword;
  let isGenerated = false;

  if (!initialPassword) {
    initialPassword = crypto.randomBytes(12).toString('base64url');
    isGenerated = true;
  }

  const { hash, salt } = await hashPassword(initialPassword);

  adminConfig = {
    admin: {
      username: envUsername,
      passwordHash: hash,
      salt: salt,
      mustChangePassword: isGenerated,
    },
  };

  saveAdminConfig();

  return {
    username: envUsername,
    password: initialPassword,
    isGenerated,
  };
}

// ─────────────────────────────────────────────────────────────
// Rate Limiting
// ─────────────────────────────────────────────────────────────
function checkRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStart: now });
    return true; // allowed
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false; // blocked
  }

  entry.count++;
  return true; // allowed
}

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

// ─────────────────────────────────────────────────────────────
// Session Management
// ─────────────────────────────────────────────────────────────
function createSession(ip) {
  const token = crypto.randomUUID();
  const now = Date.now();
  sessions.set(token, {
    ip,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
  return token;
}

function validateSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function destroySession(token) {
  if (token) sessions.delete(token);
}

/**
 * Clean up expired sessions. Called periodically.
 */
export function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now > session.expiresAt) {
      sessions.delete(token);
    }
  }
  // Also clean up stale rate limit entries
  for (const [ip, entry] of loginAttempts) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      loginAttempts.delete(ip);
    }
  }
}

// Run cleanup every 30 minutes
setInterval(cleanupExpiredSessions, 30 * 60 * 1000).unref();

// ─────────────────────────────────────────────────────────────
// Cookie Helpers
// ─────────────────────────────────────────────────────────────
function parseCookies(req) {
  const cookies = {};
  const header = req.headers.cookie || '';
  for (const pair of header.split(';')) {
    const [key, ...rest] = pair.trim().split('=');
    if (key) cookies[key.trim()] = rest.join('=').trim();
  }
  return cookies;
}

function buildSessionCookie(token, maxAge) {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
  const parts = [
    `conveter_session=${token}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Strict`,
    `Max-Age=${maxAge}`,
  ];
  if (isProduction) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function buildClearCookie() {
  return 'conveter_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0';
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Middleware: Validate admin session from cookie.
 * Returns session object if valid, null otherwise.
 */
export function requireAdmin(req) {
  const cookies = parseCookies(req);
  const token = cookies.conveter_session;
  return validateSession(token);
}

/**
 * Get the session token from request cookies.
 */
export function getSessionToken(req) {
  const cookies = parseCookies(req);
  return cookies.conveter_session || null;
}

/**
 * Attempt admin login.
 * Returns { success, token?, mustChangePassword?, error?, retryAfter? }
 */
export async function login(req) {
  const ip = getClientIp(req);

  if (!checkRateLimit(ip)) {
    const entry = loginAttempts.get(ip);
    const retryAfter = Math.ceil(
      (RATE_LIMIT_WINDOW_MS - (Date.now() - entry.windowStart)) / 1000
    );
    return {
      success: false,
      error: 'Too many login attempts. Please try again later.',
      retryAfter,
    };
  }

  return { success: true, ip };
}

/**
 * Verify credentials and create session.
 */
export async function authenticate(username, password, ip) {
  if (!adminConfig?.admin) {
    await loadAdminConfig();
  }

  if (!adminConfig?.admin) {
    return { success: false, error: 'Admin not configured' };
  }

  if (username !== adminConfig.admin.username) {
    return { success: false, error: 'Invalid credentials' };
  }

  const valid = await verifyPassword(
    password,
    adminConfig.admin.passwordHash,
    adminConfig.admin.salt
  );

  if (!valid) {
    return { success: false, error: 'Invalid credentials' };
  }

  const token = createSession(ip);
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const cookie = buildSessionCookie(token, maxAge);

  return {
    success: true,
    token,
    cookie,
    mustChangePassword: adminConfig.admin.mustChangePassword || false,
  };
}

/**
 * Change admin password.
 */
export async function changePassword(currentPassword, newPassword) {
  if (!adminConfig?.admin) {
    return { success: false, error: 'Admin not configured' };
  }

  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'New password must be at least 8 characters' };
  }

  const valid = await verifyPassword(
    currentPassword,
    adminConfig.admin.passwordHash,
    adminConfig.admin.salt
  );

  if (!valid) {
    return { success: false, error: 'Current password is incorrect' };
  }

  const { hash, salt } = await hashPassword(newPassword);
  adminConfig.admin.passwordHash = hash;
  adminConfig.admin.salt = salt;
  adminConfig.admin.mustChangePassword = false;
  saveAdminConfig();

  return { success: true };
}

/**
 * Logout: destroy session and return clear cookie header.
 */
export function logout(req) {
  const token = getSessionToken(req);
  destroySession(token);
  return buildClearCookie();
}

/**
 * Check if admin must change password.
 */
export function mustChangePassword() {
  return adminConfig?.admin?.mustChangePassword || false;
}
