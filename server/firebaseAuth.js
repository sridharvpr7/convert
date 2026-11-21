// ============================================================
// CONVET PULSE — Server-Side Firebase Auth & Token Verification
// Cryptographically verifies Firebase ID tokens using Google's
// official public x509 certificates and Node.js built-in crypto.
// Zero third-party dependencies required.
// ============================================================

import crypto from 'node:crypto';
import https from 'node:https';

// Google's official public certificate endpoint for Firebase ID tokens
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

// In-memory certificate cache: { certs: Record<string, string>, expiresAt: number }
let certCache = {
  certs: null,
  expiresAt: 0,
};

// In-memory rate limiting and deduplication stores
// Map<string, { count: number, windowStart: number }>
const rateLimitMap = new Map();
// Map<string, number> (key -> lastTimestamp)
const deduplicationMap = new Map();

// Test RSA key pair for offline test environment (NODE_ENV === 'test')
let testKeyPair = null;

/**
 * Returns the configured Firebase Project ID
 */
export function getFirebaseProjectId() {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    ''
  ).trim();
}

/**
 * Fetch Google's public certificates with Cache-Control caching
 */
async function fetchGooglePublicCerts() {
  const now = Date.now();
  if (certCache.certs && certCache.expiresAt > now) {
    return certCache.certs;
  }

  return new Promise((resolve) => {
    https.get(GOOGLE_CERTS_URL, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            return resolve(certCache.certs || {});
          }
          const parsed = JSON.parse(data);
          let maxAge = 3600; // default 1 hour
          const cacheControl = res.headers['cache-control'];
          if (cacheControl) {
            const match = cacheControl.match(/max-age=(\d+)/);
            if (match && match[1]) {
              maxAge = parseInt(match[1], 10);
            }
          }
          certCache = {
            certs: parsed,
            expiresAt: Date.now() + maxAge * 1000,
          };
          resolve(parsed);
        } catch {
          resolve(certCache.certs || {});
        }
      });
    }).on('error', () => {
      resolve(certCache.certs || {});
    });
  });
}

/**
 * Base64URL decode helper
 */
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Base64URL encode helper
 */
export function base64UrlEncode(bufferOrString) {
  const buf = Buffer.isBuffer(bufferOrString)
    ? bufferOrString
    : Buffer.from(bufferOrString, 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Initialize test keypair for deterministic testing in NODE_ENV === 'test'
 */
export function getTestKeyPair() {
  if (!testKeyPair) {
    testKeyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
  }
  return testKeyPair;
}

/**
 * Generate a signed Firebase ID token for testing
 */
export function generateTestFirebaseToken(payloadOverrides = {}, kid = 'test-key-1') {
  const { privateKey } = getTestKeyPair();
  const projectId = getFirebaseProjectId() || 'convetpulse-test';
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'RS256',
    kid,
    typ: 'JWT',
  };

  const payload = {
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    sub: payloadOverrides.sub || payloadOverrides.uid || 'test-user-123',
    email: payloadOverrides.email || 'test@example.com',
    name: payloadOverrides.name || 'Test User',
    email_verified: payloadOverrides.email_verified !== false,
    auth_time: now - 10,
    iat: now - 10,
    exp: now + 3600, // 1 hour validity
    ...payloadOverrides,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(dataToSign);
  const signature = signer.sign(privateKey);
  const encodedSignature = base64UrlEncode(signature);

  return `${dataToSign}.${encodedSignature}`;
}

/**
 * Cryptographically verify a Firebase ID token
 * @param {string} token - The raw Firebase ID JWT string
 * @returns {Promise<{ valid: boolean, user?: object, error?: string }>}
 */
export async function verifyFirebaseIdToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token is required' };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed JWT token structure' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header;
  let payload;
  try {
    header = JSON.parse(base64UrlDecode(headerB64));
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    return { valid: false, error: 'Invalid JWT header or payload encoding' };
  }

  if (header.alg !== 'RS256') {
    return { valid: false, error: 'Unsupported JWT algorithm; RS256 required' };
  }

  if (!header.kid) {
    return { valid: false, error: 'JWT header missing key ID (kid)' };
  }

  const now = Math.floor(Date.now() / 1000);
  const tolerance = 60; // 60s clock skew tolerance

  // Verify expiration
  if (typeof payload.exp !== 'number' || payload.exp < now - tolerance) {
    return { valid: false, error: 'Firebase ID token has expired' };
  }

  // Verify issued-at
  if (typeof payload.iat !== 'number' || payload.iat > now + tolerance) {
    return { valid: false, error: 'Firebase ID token issued in the future' };
  }

  // Verify non-empty subject
  if (!payload.sub || typeof payload.sub !== 'string') {
    return { valid: false, error: 'Firebase ID token missing subject (uid)' };
  }

  // Verify project ID / Audience / Issuer
  const projectId = getFirebaseProjectId();
  if (projectId) {
    const expectedIssuer = `https://securetoken.google.com/${projectId}`;
    if (payload.iss !== expectedIssuer) {
      return { valid: false, error: 'Firebase ID token issuer mismatch' };
    }
    if (payload.aud !== projectId) {
      return { valid: false, error: 'Firebase ID token audience mismatch' };
    }
  }

  // Test environment verification
  if (process.env.NODE_ENV === 'test') {
    const { publicKey } = getTestKeyPair();
    try {
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(`${headerB64}.${payloadB64}`);
      const sigBuf = Buffer.from(signatureB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
      const isSigValid = verifier.verify(publicKey, sigBuf);
      if (!isSigValid) {
        return { valid: false, error: 'Invalid cryptographic signature' };
      }
      return {
        valid: true,
        user: {
          uid: payload.sub,
          email: payload.email || '',
          name: payload.name || (payload.email ? payload.email.split('@')[0] : 'User'),
          provider: payload.firebase?.sign_in_provider || 'Firebase',
          claims: payload,
        },
      };
    } catch {
      return { valid: false, error: 'Cryptographic signature verification failed' };
    }
  }

  // Live Google Certificate Verification
  const certs = await fetchGooglePublicCerts();
  const cert = certs[header.kid];
  if (!cert) {
    return { valid: false, error: 'Public certificate for token key ID not found' };
  }

  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    const sigBuf = Buffer.from(signatureB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const isSigValid = verifier.verify(cert, sigBuf);
    if (!isSigValid) {
      return { valid: false, error: 'Invalid cryptographic signature' };
    }

    return {
      valid: true,
      user: {
        uid: payload.sub,
        email: payload.email || '',
        name: payload.name || (payload.email ? payload.email.split('@')[0] : 'User'),
        provider: payload.firebase?.sign_in_provider || 'Firebase',
        claims: payload,
      },
    };
  } catch (err) {
    return { valid: false, error: `Signature verification error: ${err.message}` };
  }
}

/**
 * Extract Firebase bearer token from HTTP request
 */
export function extractBearerToken(req, body = {}) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.headers['x-firebase-token']) {
    return String(req.headers['x-firebase-token']).trim();
  }
  if (body && typeof body === 'object') {
    if (body.idToken && typeof body.idToken === 'string') {
      return body.idToken.trim();
    }
    if (body.token && typeof body.token === 'string') {
      return body.token.trim();
    }
  }
  return null;
}

/**
 * Rate limit check for sensitive endpoints
 * @param {string} key - Identifier (e.g. `login:${userId}` or `ip:${clientIp}`)
 * @param {number} maxRequests - Max requests permitted in the window
 * @param {number} windowMs - Window duration in milliseconds
 * @returns {{ allowed: boolean, retryAfter: number }}
 */
export function checkRateLimit(key, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  let entry = rateLimitMap.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    entry = { count: 1, windowStart: now };
    rateLimitMap.set(key, entry);
    return { allowed: true, retryAfter: 0 };
  }

  entry.count += 1;
  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }

  return { allowed: true, retryAfter: 0 };
}

/**
 * Notification deduplication checker
 * @param {string} key - Deduplication key (e.g. `login:${userId}` or `app-open:${userId}`)
 * @param {number} windowMs - Suppress duplicates within this duration
 * @returns {boolean} - Returns true if this is a DUPLICATE (should be suppressed)
 */
export function isNotificationDeduplicated(key, windowMs) {
  const now = Date.now();
  const lastTime = deduplicationMap.get(key) || 0;
  if (now - lastTime < windowMs) {
    return true; // Duplicate! Suppress
  }
  deduplicationMap.set(key, now);
  return false; // New! Allow
}

/**
 * Reset rate limit and deduplication state (useful for tests)
 */
export function resetRateLimits() {
  rateLimitMap.clear();
  deduplicationMap.clear();
}
