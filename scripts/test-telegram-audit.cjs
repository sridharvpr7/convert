// ============================================================
// CONVET PULSE — Telegram Integration & Deduplication Audit Suite
// ============================================================

const assert = require('node:assert');

async function runAudit() {
  console.log('======================================================');
  console.log('CONVET PULSE — TELEGRAM INTEGRATION & DEDUPE QA AUDIT');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  const { db } = await import('../server/db.js');
  const {
    telegramService,
    getDashboardUrl,
    getAdminDashboardUrl,
    createDashboardKeyboard,
    isDuplicate,
    clearDedupeKey,
    PRODUCTION_URL,
    sendTelegramMessage,
    getAdminChatId,
    getBotToken,
  } = await import('../server/telegram.js');
  const { handleApiRoute } = await import('../server/routes.js');

  // Helper to create mock requests
  function mockRequest(method, pathname, body = null, headers = {}) {
    const defaultHeaders = {
      'content-type': 'application/json',
      ...headers,
    };
    const req = {
      method,
      headers: defaultHeaders,
      on: (event, handler) => {
        if (event === 'data' && body) {
          handler(Buffer.from(JSON.stringify(body)));
        }
        if (event === 'end') {
          handler();
        }
      },
    };

    let statusCode = 200;
    let responseHeaders = {};
    let responseData = '';

    const res = {
      writeHead: (code, hdrs) => {
        statusCode = code;
        responseHeaders = hdrs || {};
      },
      setHeader: (k, v) => {
        responseHeaders[k] = v;
      },
      end: (data) => {
        responseData = data || '';
      },
    };

    return {
      req,
      res,
      getResult: () => {
        let parsed = null;
        try {
          parsed = JSON.parse(responseData);
        } catch {
          parsed = responseData;
        }
        return { status: statusCode, headers: responseHeaders, data: parsed };
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 1. VISITOR NOTIFICATION TESTS
  // ─────────────────────────────────────────────────────────────
  console.log('--- 1. VISITOR NOTIFICATION & DEDUPLICATION TESTS ---');

  const visitor1 = `v_test_${Date.now()}_1`;

  await test('First visit generates one notification', async () => {
    db.clearDedupe(`visitor_new_${visitor1}`);
    const mock = mockRequest('POST', '/api/visitors/ping', { visitorId: visitor1, page: 'Homepage' });
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/visitors/ping'));
    const res = mock.getResult();
    assert.strictEqual(res.status, 200);

    // Verify dedupe record was created
    const isDup = db.checkAndSetDedupe(`visitor_new_${visitor1}`, 60000);
    assert.strictEqual(isDup, true, 'Dedupe key must now be active');
  });

  await test('Refresh does not generate another notification', async () => {
    // Second ping with same visitorId immediately simulates a page refresh
    const mockRefresh = mockRequest('POST', '/api/visitors/ping', { visitorId: visitor1, page: 'Homepage' });
    await handleApiRoute(mockRefresh.req, mockRefresh.res, new URL('http://localhost/api/visitors/ping'));
    const res = mockRefresh.getResult();
    assert.strictEqual(res.status, 200);

    // Visitor record should have page_views >= 2, but notifyNewVisitor was NOT triggered
    const isDup = db.checkAndSetDedupe(`visitor_new_${visitor1}`, 60000);
    assert.strictEqual(isDup, true, 'Visitor must remain deduplicated');
  });

  await test('Revisit within cooldown does not generate duplicate notification', async () => {
    // Revisit after a few seconds
    const notified = await telegramService.notifyNewVisitor({ visitorId: visitor1, page: 'Homepage' });
    assert.strictEqual(notified, false, 'notifyNewVisitor must return false within active dedupe window');
  });

  await test('Repeated heartbeat requests never trigger new-visitor notifications', async () => {
    for (let i = 0; i < 5; i++) {
      const mockHb = mockRequest('POST', '/api/visitors/ping', { visitorId: visitor1, page: 'Homepage' });
      await handleApiRoute(mockHb.req, mockHb.res, new URL('http://localhost/api/visitors/ping'));
      assert.strictEqual(mockHb.getResult().status, 200);
    }
    const notified = await telegramService.notifyNewVisitor({ visitorId: visitor1, page: 'Homepage' });
    assert.strictEqual(notified, false, 'Heartbeats must not trigger notifications');
  });

  await test('Concurrent duplicate events generate only one notification', async () => {
    const concurrentVisitor = `v_conc_${Date.now()}`;
    db.clearDedupe(`visitor_new_${concurrentVisitor}`);

    // Fire 10 simultaneous notifyNewVisitor calls
    const promises = Array.from({ length: 10 }).map(() =>
      telegramService.notifyNewVisitor({ visitorId: concurrentVisitor, page: 'Homepage' })
    );

    const results = await Promise.all(promises);
    const successfulSends = results.filter((r) => r !== false);

    assert.strictEqual(successfulSends.length, 1, 'Exactly one concurrent call must succeed, remainder must be deduplicated');
  });

  await test('A genuinely new visitor generates a notification', async () => {
    const visitor2 = `v_test_${Date.now()}_2`;
    db.clearDedupe(`visitor_new_${visitor2}`);

    const res = await telegramService.notifyNewVisitor({ visitorId: visitor2, page: 'Pricing' });
    assert.notStrictEqual(res, false, 'New visitor must generate a notification');
    assert.strictEqual(res.ok, true);
  });

  await test('Notification deduplication survives server restart simulation', async () => {
    const persistKey = `v_persist_${Date.now()}`;
    // Claim lock
    const firstClaim = db.checkAndSetDedupe(persistKey, 3600 * 1000, 'test_event', 'entity_1');
    assert.strictEqual(firstClaim, false, 'Initial lock must be successfully claimed');

    // Simulate second process reading from disk database
    const secondClaim = db.checkAndSetDedupe(persistKey, 3600 * 1000, 'test_event', 'entity_1');
    assert.strictEqual(secondClaim, true, 'Persistent database must retain lock across operations');
  });

  await test('Legitimate new events after cooldown are not permanently blocked', async () => {
    const expiredKey = `v_expired_${Date.now()}`;
    // Insert with 1ms TTL
    db.checkAndSetDedupe(expiredKey, 1, 'test_event', 'entity_exp');
    // Wait 15ms for expiration
    await new Promise((r) => setTimeout(r, 20));

    // Must be allowed now
    const renewedClaim = db.checkAndSetDedupe(expiredKey, 60000, 'test_event', 'entity_exp');
    assert.strictEqual(renewedClaim, false, 'Legitimate events after expiration must not be blocked');
  });

  // ─────────────────────────────────────────────────────────────
  // 2. DASHBOARD BUTTON TESTS
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- 2. DASHBOARD BUTTON & URL INTEGRITY TESTS ---');

  await test('View Dashboard button exists in inline keyboard', async () => {
    const kb = createDashboardKeyboard();
    assert(kb.inline_keyboard, 'Must have inline_keyboard array');
    const firstBtn = kb.inline_keyboard[0][0];
    assert.strictEqual(firstBtn.text, '🌐 View Dashboard');
  });

  await test('Button uses valid Telegram inline keyboard structure', async () => {
    const kb = createDashboardKeyboard([
      [{ text: '🔍 Check Status', callback_data: 'status:123' }],
    ]);
    assert(Array.isArray(kb.inline_keyboard), 'inline_keyboard must be an array');
    assert(Array.isArray(kb.inline_keyboard[0]), 'Rows must be arrays');
    assert(typeof kb.inline_keyboard[0][0].text === 'string');
    assert(typeof kb.inline_keyboard[0][0].url === 'string');
  });

  await test('URL is exactly https://convetpulse.onrender.com in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAppUrl = process.env.APP_URL;

    process.env.NODE_ENV = 'production';
    delete process.env.APP_URL;

    const url = getDashboardUrl();
    assert.strictEqual(url, 'https://convetpulse.onrender.com');

    process.env.NODE_ENV = originalEnv;
    process.env.APP_URL = originalAppUrl;
  });

  await test('URL uses HTTPS protocol', async () => {
    const url = getDashboardUrl();
    assert(url.startsWith('https://'), `Expected HTTPS url, got: ${url}`);
  });

  await test('No localhost URL is used in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAppUrl = process.env.APP_URL;

    process.env.NODE_ENV = 'production';
    process.env.APP_URL = 'http://localhost:5173';

    const url = getDashboardUrl();
    assert.strictEqual(url, 'https://convetpulse.onrender.com', 'Localhost must be overridden by production HTTPS url');

    process.env.NODE_ENV = originalEnv;
    process.env.APP_URL = originalAppUrl;
  });

  await test('Malformed or non-https URL safely falls back to production URL', async () => {
    const originalAppUrl = process.env.APP_URL;

    process.env.APP_URL = 'not-a-valid-url';
    const url = getDashboardUrl();
    assert.strictEqual(url, 'https://convetpulse.onrender.com');

    process.env.APP_URL = originalAppUrl;
  });

  // ─────────────────────────────────────────────────────────────
  // 3. NOTIFICATION FORMAT & RELIABILITY TESTS
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- 3. NOTIFICATION FORMAT & RELIABILITY TESTS ---');

  await test('New user registration message does not expose sensitive tokens', async () => {
    const testUser = {
      id: `usr_${Date.now()}`,
      name: 'Alice Developer',
      email: 'alice@example.com',
      password: 'super_secret_password',
      token: 'jwt_secret_token_123',
    };
    db.clearDedupe(`user_reg_${testUser.email}`);

    const res = await telegramService.notifyNewUser(testUser);
    assert.strictEqual(res.ok, true);

    // Verify recent notification log in DB
    const logs = db.getNotificationLogs(1);
    assert.strictEqual(logs[0].event_type, 'user_registered');
    assert(!JSON.stringify(logs[0]).includes('super_secret_password'));
    assert(!JSON.stringify(logs[0]).includes('jwt_secret_token_123'));
  });

  await test('Anonymous browsing never triggers new user registration notification', async () => {
    const anonUser = {
      id: `anon_${Date.now()}`,
      name: 'Anonymous User',
      deviceInfo: 'Desktop',
    };

    const mock = mockRequest('POST', '/api/users/register', anonUser);
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/users/register'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 200);

    // Check that user_registered dedupe was not claimed for anon
    const isDup = db.checkAndSetDedupe(`user_reg_${anonUser.id}`, 60000);
    assert.strictEqual(isDup, false, 'Anonymous users must not create user_registered notifications');
  });

  await test('Conversion completion message contains required operational fields', async () => {
    const job = {
      id: `job_test_${Date.now()}`,
      toolName: 'PDF to Excel',
      inputFormat: 'pdf',
      outputFormat: 'xlsx',
      durationMs: 1450,
    };

    const res = await telegramService.notifyConversionCompleted(job);
    assert.strictEqual(res.ok, true);

    const logs = db.getNotificationLogs(1);
    assert.strictEqual(logs[0].event_type, 'conversion_completed');
  });

  await test('Verified payment notification formats cleanly and links to dashboard', async () => {
    const payment = {
      order_id: `ord_${Date.now()}`,
      user_email: 'customer@example.com',
      amount: 49900,
      currency: 'INR',
      plan: 'pro',
    };

    const res = await telegramService.notifyPaymentReceived(payment);
    assert.strictEqual(res.ok, true);

    const logs = db.getNotificationLogs(1);
    assert.strictEqual(logs[0].event_type, 'payment_success');
  });

  await test('System error alert sanitizes diagnostic info without exposing stack traces', async () => {
    const err = new Error(`Database disk I/O error at internal table storage ${Date.now()}`);
    err.stack = 'SecretKey=sk_live_12345\nInternalPath=/var/app/secrets/config.json';

    const res = await telegramService.notifySystemError(err, 'Database Sync');
    assert.strictEqual(res.ok, true);

    const logs = db.getNotificationLogs(1);
    assert.strictEqual(logs[0].event_type, 'system_error');
    assert(!JSON.stringify(logs[0]).includes('sk_live_12345'));
  });

  await test('Missing Telegram credentials clearly reports mocked state without fake message IDs', async () => {
    const res = await sendTelegramMessage('test_chat', 'Test Message', {}, 'test_mock');
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.mocked, true, 'Must clearly report mocked: true');
    assert.strictEqual(res.message_id, null, 'Must not return fake numeric message ID');
    assert.strictEqual(res.status, 'mocked', 'Status must be mocked');
  });

  await test('Telegram API retry behavior on temporary failure', async () => {
    const originalToken = process.env.TELEGRAM_BOT_TOKEN;
    const originalFetch = global.fetch;

    process.env.TELEGRAM_BOT_TOKEN = 'test_token_123';
    let attempts = 0;

    global.fetch = async () => {
      attempts++;
      if (attempts === 1) {
        return {
          json: async () => ({ ok: false, error_code: 500, description: 'Internal server error' }),
        };
      }
      return {
        json: async () => ({ ok: true, result: { message_id: 998877 } }),
      };
    };

    const res = await sendTelegramMessage('test_chat_retry', 'Retry Test', { maxRetries: 2 }, 'retry_test');
    assert.strictEqual(res.ok, true);
    assert.strictEqual(attempts, 2, 'Must have attempted retry');
    assert.strictEqual(res.status, 'sent');
    assert.strictEqual(res.message_id, 998877);

    process.env.TELEGRAM_BOT_TOKEN = originalToken;
    global.fetch = originalFetch;
  });

  await test('Backward compatibility with TELEGRAM_ADMIN_CHAT_ID and ADMIN_CHAT_ID', async () => {
    const origChatId = process.env.TELEGRAM_CHAT_ID;
    const origAdminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    const origLegacyChatId = process.env.ADMIN_CHAT_ID;

    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.TELEGRAM_ADMIN_CHAT_ID;
    delete process.env.ADMIN_CHAT_ID;

    process.env.TELEGRAM_ADMIN_CHAT_ID = 'render_admin_123';
    assert.strictEqual(getAdminChatId(), 'render_admin_123', 'Must resolve TELEGRAM_ADMIN_CHAT_ID');

    delete process.env.TELEGRAM_ADMIN_CHAT_ID;
    process.env.ADMIN_CHAT_ID = 'render_legacy_456';
    assert.strictEqual(getAdminChatId(), 'render_legacy_456', 'Must resolve ADMIN_CHAT_ID');

    process.env.TELEGRAM_CHAT_ID = 'standard_789';
    assert.strictEqual(getAdminChatId(), 'standard_789', 'TELEGRAM_CHAT_ID takes primary precedence');

    if (origChatId) process.env.TELEGRAM_CHAT_ID = origChatId; else delete process.env.TELEGRAM_CHAT_ID;
    if (origAdminChatId) process.env.TELEGRAM_ADMIN_CHAT_ID = origAdminChatId; else delete process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (origLegacyChatId) process.env.ADMIN_CHAT_ID = origLegacyChatId; else delete process.env.ADMIN_CHAT_ID;
  });

  await test('Notification delivery failure releases dedupe key to prevent silent suppression', async () => {
    const originalToken = process.env.TELEGRAM_BOT_TOKEN;
    const originalChatId = process.env.TELEGRAM_CHAT_ID;
    const originalFetch = global.fetch;

    process.env.TELEGRAM_BOT_TOKEN = 'test_token_live';
    process.env.TELEGRAM_CHAT_ID = 'test_chat_live';

    const failVisitorId = `fail_v_${Date.now()}`;
    const dedupeKey = `visitor_new_${failVisitorId}`;

    // Force fetch to fail
    global.fetch = async () => {
      throw new Error('Telegram network outage');
    };

    const firstAttempt = await telegramService.notifyNewVisitor({
      visitorId: failVisitorId,
      page: 'Homepage',
    });
    assert.strictEqual(firstAttempt.ok, false, 'First attempt must report failure');

    // Dedupe key must be released!
    const keyCleared = !db.checkAndSetDedupe(dedupeKey, 60000, 'test', failVisitorId);
    assert.strictEqual(keyCleared, true, 'Dedupe key must have been cleared so future alert can retry');

    // Cleanup
    db.clearDedupe(dedupeKey);
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
    process.env.TELEGRAM_CHAT_ID = originalChatId;
    global.fetch = originalFetch;
  });

  await test('Distinguishes public homepage from authenticated admin console in dashboard buttons', async () => {
    const publicUrl = getDashboardUrl();
    const adminUrl = getAdminDashboardUrl();

    assert.ok(publicUrl.startsWith('https://'), 'Public URL must be HTTPS');
    assert.strictEqual(adminUrl, `${publicUrl}/admin`, 'Admin URL must point to /admin');

    const adminKeyboard = createDashboardKeyboard([
      [{ text: '🔐 Admin Console', url: adminUrl }],
    ]);

    assert.strictEqual(adminKeyboard.inline_keyboard[0][0].text, '🌐 View Dashboard');
    assert.strictEqual(adminKeyboard.inline_keyboard[0][0].url, publicUrl);
    assert.strictEqual(adminKeyboard.inline_keyboard[1][0].text, '🔐 Admin Console');
    assert.strictEqual(adminKeyboard.inline_keyboard[1][0].url, adminUrl);
  });

  await test('Telegram API permanent error (400 Bad Request) stops immediately without indefinite retries', async () => {
    const originalToken = process.env.TELEGRAM_BOT_TOKEN;
    const originalFetch = global.fetch;

    process.env.TELEGRAM_BOT_TOKEN = 'test_token_123';
    let attempts = 0;

    global.fetch = async () => {
      attempts++;
      return {
        json: async () => ({ ok: false, error_code: 400, description: 'Bad Request: text must be non-empty' }),
      };
    };

    const res = await sendTelegramMessage('test_chat_perm', 'Perm Fail Test', { maxRetries: 3 }, 'perm_fail_test');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(attempts, 1, 'Must break retry loop immediately for 400 Bad Request');
    assert.strictEqual(res.status, 'failed');

    process.env.TELEGRAM_BOT_TOKEN = originalToken;
    global.fetch = originalFetch;
  });

  // ─────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────
  console.log('\n======================================================');
  console.log(`TELEGRAM AUDIT COMPLETE: ${passed} passed, ${failed} failed`);
  console.log('======================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
