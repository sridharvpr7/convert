// ============================================================
// CONVETER — Admin Authentication Module
// Uses Node.js built-in crypto (scrypt) for password hashing.
// Session management with crypto.randomUUID() tokens.
// ============================================================

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

async function verifyPassword(password, storedHash, storedSalt) {
  const { hash } = await hashPassword(password, storedSalt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
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

function loadAdminConfig() {
  ensureConfigDir();
  if (fs.existsSync(ADMIN_CONFIG_PATH)) {
    try {
      adminConfig = JSON.parse(fs.readFileSync(ADMIN_CONFIG_PATH, 'utf8'));
      return false; // not first run
    } catch (err) {
      console.error('[Auth] Failed to parse admin.json:', err.message);
    }
  }
  return true; // needs initialization
}

function saveAdminConfig() {
  ensureConfigDir();
  try {
    fs.writeFileSync(ADMIN_CONFIG_PATH, JSON.stringify(adminConfig, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Auth] Failed to persist admin.json (ephemeral FS?):', err.message);
    // Continue with in-memory config
  }
}

/**
 * Initialize admin credentials. Call on server startup.
 * Returns the initial password if this is first run, null otherwise.
 */
export async function initializeAuth() {
  const isFirstRun = loadAdminConfig();

  if (isFirstRun || !adminConfig?.admin) {
    const initialPassword = crypto.randomBytes(12).toString('base64url');
    const { hash, salt } = await hashPassword(initialPassword);

    adminConfig = {
      admin: {
        username: 'admin',
        passwordHash: hash,
        salt: salt,
        mustChangePassword: true,
      },
    };

    saveAdminConfig();
    return initialPassword;
  }

  return null;
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
