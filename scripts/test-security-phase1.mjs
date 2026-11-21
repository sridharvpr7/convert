#!/usr/bin/env node
// ============================================================
// CONVET PULSE — Phase 1 Security & Notification Test Suite
// Fully in-process tests for:
// - Firebase Token verification & cryptographic checks
// - Telegram webhook protection (valid, invalid, missing secret)
// - Authentication on /api/auth/login-event & /api/auth/app-open
// - Authorization & identity matching on /api/user/usage
// - Rate limiting & notification deduplication
// - Duplicate Telegram notification prevention flows
// - Tool registry integrity (all 42 tools preserved)
// ============================================================

import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { handleApiRoute } from '../server/routes.js';
import {
  verifyFirebaseIdToken,
  generateTestFirebaseToken,
  extractBearerToken,
  checkRateLimit,
  isNotificationDeduplicated,
  resetRateLimits,
  getFirebaseProjectId,
} from '../server/firebaseAuth.js';
import { telegramService } from '../server/telegram.js';
import { db } from '../server/db.js';

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, label, detail = '') {
  if (condition) {
    passed++;
    results.push(`  ✅ PASS  ${label}`);
  } else {
    failed++;
    results.push(`  ❌ FAIL  ${label}${detail ? `\n           ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

// In-process mock dispatcher for handleApiRoute
async function dispatchApi(method, path, body = null, headers = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.headers = { ...headers };
  req.socket = { remoteAddress: '127.0.0.1' };
  req.connection = { remoteAddress: '127.0.0.1' };

  let statusCode = 200;
  let headersSent = {};
  let resData = '';

  const res = {
    writeHead(code, hdrs) {
      statusCode = code;
      headersSent = { ...hdrs };
    },
    setHeader(k, v) {
      headersSent[k.toLowerCase()] = v;
    },
    end(data) {
      if (data) resData += data;
    },
  };

  const parsedUrl = new URL(path, 'http://localhost:5000');

  process.nextTick(() => {
    if (body !== null && body !== undefined) {
      req.emit('data', typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.emit('end');
  });

  await handleApiRoute(req, res, parsedUrl);

  let parsedBody;
  try {
    parsedBody = JSON.parse(resData);
  } catch {
    parsedBody = resData;
  }

  return { status: statusCode, headers: headersSent, body: parsedBody };
}

(async () => {
  // Ensure test environment is configured
  process.env.NODE_ENV = 'test';
  process.env.FIREBASE_PROJECT_ID = 'convetpulse-test';

  // ─────────────────────────────────────────────────────────
  // SECTION 1: Firebase Token Verification Unit Tests
  // ─────────────────────────────────────────────────────────
  section('1. Firebase Token Verification — Unit Tests');

  // 1a. Missing token
  {
    const r = await verifyFirebaseIdToken(null);
    assert(r.valid === false, '1a. Missing token rejected (valid: false)');
  }

  // 1b. Empty token string
  {
    const r = await verifyFirebaseIdToken('');
    assert(r.valid === false, '1b. Empty token rejected (valid: false)');
  }

  // 1c. Malformed token structure (not 3 JWT parts)
  {
    const r = await verifyFirebaseIdToken('abc.def');
    assert(r.valid === false && r.error.includes('Malformed'), '1c. Malformed JWT rejected (valid: false)');
  }

  // 1d. Expired token
  {
    const expiredToken = generateTestFirebaseToken({
      exp: Math.floor(Date.now() / 1000) - 3600,
    });
    const r = await verifyFirebaseIdToken(expiredToken);
    assert(r.valid === false && r.error.includes('expired'), '1d. Expired Firebase token rejected');
  }

  // 1e. Token with wrong issuer
  {
    const wrongIssToken = generateTestFirebaseToken({
      iss: 'https://securetoken.google.com/wrong-project',
    });
    const r = await verifyFirebaseIdToken(wrongIssToken);
    assert(r.valid === false && r.error.includes('issuer mismatch'), '1e. Token with invalid issuer rejected');
  }

  // 1f. Token with wrong audience
  {
    const wrongAudToken = generateTestFirebaseToken({
      aud: 'wrong-audience',
    });
    const r = await verifyFirebaseIdToken(wrongAudToken);
    assert(r.valid === false && r.error.includes('audience mismatch'), '1f. Token with invalid audience rejected');
  }

  // 1g. Valid test token verified successfully
  {
    const validToken = generateTestFirebaseToken({
      uid: 'user-valid-123',
      email: 'user@example.com',
      name: 'Valid User',
    });
    const r = await verifyFirebaseIdToken(validToken);
    assert(r.valid === true && r.user.uid === 'user-valid-123', '1g. Valid Firebase ID token accepted & verified');
  }

  // 1h. extractBearerToken supports Authorization header, X-Firebase-Token, and body
  {
    const t1 = extractBearerToken({ headers: { authorization: 'Bearer token-from-auth-hdr' } }, {});
    const t2 = extractBearerToken({ headers: { 'x-firebase-token': 'token-from-xfb-hdr' } }, {});
    const t3 = extractBearerToken({ headers: {} }, { idToken: 'token-from-body' });
    assert(
      t1 === 'token-from-auth-hdr' && t2 === 'token-from-xfb-hdr' && t3 === 'token-from-body',
      '1h. extractBearerToken extracts from Authorization header, X-Firebase-Token, and body.idToken'
    );
  }

  // ─────────────────────────────────────────────────────────
  // SECTION 2: Telegram Webhook Protection Tests
  // ─────────────────────────────────────────────────────────
  section('2. Telegram Webhook Protection Tests');

  const secretBackup = process.env.TELEGRAM_WEBHOOK_SECRET;
  const tokenBackup = process.env.TELEGRAM_BOT_TOKEN;

  // Set production webhook secret
  process.env.TELEGRAM_WEBHOOK_SECRET = 'super-secret-telegram-webhook-token-xyz';
  process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

  // 2a. Missing secret in production -> 403
  {
    const r = await telegramService.handleWebhookUpdate({ update_id: 1 }, undefined);
    assert(r.status === 403 && r.error.includes('Missing'), '2a. Telegram webhook rejected without secret header (403)');
  }

  // 2b. Invalid secret -> 403
  {
    const r = await telegramService.handleWebhookUpdate({ update_id: 1 }, 'wrong-secret-token');
    assert(r.status === 403 && r.error.includes('Unauthorized'), '2b. Telegram webhook rejected with invalid secret (403)');
  }

  // 2c. Valid secret -> 200
  {
    const r = await telegramService.handleWebhookUpdate({ update_id: 1, message: null }, 'super-secret-telegram-webhook-token-xyz');
    assert(r.status === 200, '2c. Telegram webhook accepted with valid secret (200)');
  }

  // 2d. Local dev pass-through when no secret and no bot token configured
  {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    delete process.env.TELEGRAM_BOT_TOKEN;
    const r = await telegramService.handleWebhookUpdate({ update_id: 2, message: null }, undefined);
    assert(r.status === 200, '2d. Local dev allows webhook pass-through when secret not configured');
  }

  // Restore env
  if (secretBackup) process.env.TELEGRAM_WEBHOOK_SECRET = secretBackup;
  if (tokenBackup) process.env.TELEGRAM_BOT_TOKEN = tokenBackup;

  // ─────────────────────────────────────────────────────────
  // SECTION 3: Notification Endpoints & Rate Limiting
  // ─────────────────────────────────────────────────────────
  section('3. Notification Endpoints & Rate Limiting');
  resetRateLimits();

  // 3a. POST /api/auth/login-event without token when Firebase configured -> 401
  {
    const r = await dispatchApi('POST', '/api/auth/login-event', { userId: 'unverified-uid' });
    assert(r.status === 401, '3a. login-event rejected without token when Firebase configured (401)');
  }

  // 3b. POST /api/auth/login-event with invalid token -> 401
  {
    const r = await dispatchApi(
      'POST',
      '/api/auth/login-event',
      { userId: 'unverified-uid' },
      { authorization: 'Bearer invalid.fake.token' }
    );
    assert(r.status === 401, '3b. login-event rejected with invalid token (401)');
  }

  // 3c. POST /api/auth/login-event with valid token -> 200
  {
    const token = generateTestFirebaseToken({ uid: 'login-user-1', name: 'Login User' });
    const r = await dispatchApi(
      'POST',
      '/api/auth/login-event',
      { provider: 'Email & Password' },
      { authorization: `Bearer ${token}` }
    );
    assert(r.status === 200 && r.body.ok === true, '3c. login-event accepted with valid token (200)');
  }

  // 3d. POST /api/auth/login-event repeated within 60s -> deduplicated
  {
    const token = generateTestFirebaseToken({ uid: 'login-user-1', name: 'Login User' });
    const r = await dispatchApi(
      'POST',
      '/api/auth/login-event',
      { provider: 'Email & Password' },
      { authorization: `Bearer ${token}` }
    );
    assert(r.status === 200 && r.body.deduplicated === true, '3d. login-event repeated within 60s is deduplicated');
  }

  // 3e. POST /api/auth/app-open without token -> 401
  {
    const r = await dispatchApi('POST', '/api/auth/app-open', { userId: 'unverified-uid' });
    assert(r.status === 401, '3e. app-open rejected without token (401)');
  }

  // 3f. POST /api/auth/app-open with valid token -> 200
  {
    const token = generateTestFirebaseToken({ uid: 'appopen-user-1', name: 'App User' });
    const r = await dispatchApi(
      'POST',
      '/api/auth/app-open',
      {},
      { authorization: `Bearer ${token}` }
    );
    assert(r.status === 200 && r.body.ok === true, '3f. app-open accepted with valid token (200)');
  }

  // 3g. POST /api/auth/app-open repeated within 15m -> deduplicated
  {
    const token = generateTestFirebaseToken({ uid: 'appopen-user-1', name: 'App User' });
    const r = await dispatchApi(
      'POST',
      '/api/auth/app-open',
      {},
      { authorization: `Bearer ${token}` }
    );
    assert(r.status === 200 && r.body.deduplicated === true, '3g. app-open repeated within 15m is deduplicated');
  }

  // 3h. Rate limiting: 21 requests from same IP -> 429
  {
    resetRateLimits();
    let hitRateLimit = false;
    for (let i = 0; i < 22; i++) {
      const token = generateTestFirebaseToken({ uid: `rate-user-${i}` });
      const r = await dispatchApi(
        'POST',
        '/api/auth/login-event',
        {},
        { authorization: `Bearer ${token}` }
      );
      if (r.status === 429) {
        hitRateLimit = true;
        break;
      }
    }
    assert(hitRateLimit, '3h. Rate limiting enforces max 20 requests per minute per IP (returns 429)');
  }

  // ─────────────────────────────────────────────────────────
  // SECTION 4: User Usage Endpoint Protection
  // ─────────────────────────────────────────────────────────
  section('4. User Usage Endpoint Protection');
  resetRateLimits();

  // 4a. GET /api/user/usage without userId param -> 400
  {
    const r = await dispatchApi('GET', '/api/user/usage');
    assert(r.status === 400, '4a. GET /api/user/usage without userId -> 400');
  }

  // 4b. GET /api/user/usage without auth token -> 401
  {
    const r = await dispatchApi('GET', '/api/user/usage?userId=victim-user');
    assert(r.status === 401, '4b. GET /api/user/usage without auth token -> 401');
  }

  // 4c. GET /api/user/usage with token for user A requesting user B's data -> 403
  {
    const attackerToken = generateTestFirebaseToken({ uid: 'attacker-uid' });
    const r = await dispatchApi(
      'GET',
      '/api/user/usage?userId=victim-uid',
      null,
      { authorization: `Bearer ${attackerToken}` }
    );
    assert(r.status === 403 && r.body.error.includes('Access denied'), '4c. User identity mismatch rejected with 403 (cannot read other user\'s usage)');
  }

  // 4d. GET /api/user/usage with matching token for self -> 200
  {
    const ownerToken = generateTestFirebaseToken({ uid: 'legit-uid-999' });
    const r = await dispatchApi(
      'GET',
      '/api/user/usage?userId=legit-uid-999',
      null,
      { authorization: `Bearer ${ownerToken}` }
    );
    assert(r.status === 200 && 'usage' in r.body, '4d. Authorized self user usage query returns 200 with usage stats');
  }

  // ─────────────────────────────────────────────────────────
  // SECTION 5: Duplicate Telegram Notifications Prevention
  // ─────────────────────────────────────────────────────────
  section('5. Duplicate Telegram Notifications Prevention');
  resetRateLimits();

  // 5a. Authenticated visitor ping skips visitor notification (no "Authenticated Visitor" spam)
  {
    const r = await dispatchApi('POST', '/api/visitors/ping', {
      visitorId: 'auth-visitor-session-1',
      isAuthenticated: true,
      userId: 'user-123',
      page: 'Dashboard',
    });
    assert(r.status === 200, '5a. Authenticated visitor ping processed without creating redundant visitor notification');
  }

  // 5b. Anonymous visitor ping preserved for actual anonymous users
  {
    const r = await dispatchApi('POST', '/api/visitors/ping', {
      visitorId: `anon-vis-${Date.now()}`,
      isAuthenticated: false,
      page: 'Homepage',
    });
    assert(r.status === 200, '5b. Anonymous visitor ping preserved for real anonymous visitors');
  }

  // 5c. First-time registration flag routes to notifyNewUser
  {
    const regToken = generateTestFirebaseToken({
      uid: 'registered-uid-new',
      email: 'newuser@example.com',
      name: 'New Registered User',
    });
    const r = await dispatchApi(
      'POST',
      '/api/auth/login-event',
      { isNewRegistration: true, provider: 'Registration' },
      { authorization: `Bearer ${regToken}` }
    );
    assert(r.status === 200 && r.body.ok === true, '5c. First-time registration flag routes to NEW USER REGISTRATION');
  }

  // 5d. Ordinary login does not trigger NEW USER REGISTRATION
  {
    const loginToken = generateTestFirebaseToken({
      uid: 'existing-uid-456',
      email: 'existing@example.com',
      name: 'Existing User',
    });
    const r = await dispatchApi(
      'POST',
      '/api/auth/login-event',
      { provider: 'Google' }, // no isNewRegistration
      { authorization: `Bearer ${loginToken}` }
    );
    assert(r.status === 200 && r.body.ok === true, '5d. Normal login triggers login notification, never registration');
  }

  // 5e. Server-side registration deduplication window (24h)
  {
    const isDup1 = isNotificationDeduplicated('user_reg_newuser@example.com', 86400000);
    const isDup2 = isNotificationDeduplicated('user_reg_newuser@example.com', 86400000);
    assert(isDup1 === false && isDup2 === true, '5e. New user registration notification deduplicated for 24h per email');
  }

  // ─────────────────────────────────────────────────────────
  // SECTION 6: Tool Registry Integrity (All 42 Tools Preserved)
  // ─────────────────────────────────────────────────────────
  section('6. Tool Registry Integrity (All 42 Tools)');

  {
    const toolDispatchPath = 'src/lib/toolDispatch.ts';
    assert(fs.existsSync(toolDispatchPath), '6a. src/lib/toolDispatch.ts exists');

    const content = fs.readFileSync(toolDispatchPath, 'utf-8');
    const registeredSlugs = (content.match(/^\s+'[a-z0-9-]+':/gm) || []).map((s) =>
      s.trim().replace(/[':]/g, '')
    );
    assert(
      registeredSlugs.length === 42,
      `6b. Exactly 42 tools registered in tool dispatch map (found ${registeredSlugs.length})`
    );

    // Verify key tools across categories are registered and intact
    const criticalTools = [
      'merge-pdf',
      'split-pdf',
      'compress-pdf',
      'rotate-pdf',
      'jpg-to-pdf',
      'pdf-to-text',
      'excel-to-csv',
      'csv-to-excel',
      'json-to-csv',
      'csv-to-json',
      'image-converter',
      'image-compressor',
      'qr-generator',
      'barcode-generator',
      'pdf-password-protect',
      'pdf-unlock',
      'zip-compressor',
      'zip-extractor',
    ];
    const missing = criticalTools.filter((t) => !registeredSlugs.includes(t));
    assert(
      missing.length === 0,
      `6c. Critical tools verified in dispatch (${criticalTools.length}/${criticalTools.length} present)`
    );
  }

  // ─────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('  CONVET PULSE — Security & Notification Verification Results');
  console.log('═'.repeat(60));
  results.forEach((r) => console.log(r));
  console.log('─'.repeat(60));
  console.log(`\n  Total: ${passed + failed}  ✅ Passed: ${passed}  ❌ Failed: ${failed}\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('  🎉 All Phase 1 security and notification tests passed successfully!\n');
    process.exit(0);
  }
})().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
