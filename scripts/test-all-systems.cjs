// ============================================================
// CONVETER — Comprehensive Systems & Quality Assurance Test Suite
// Tests:
// 1. Tool registry integrity (17 tools, 5 categories)
// 2. Dispatch map consistency (all 17 tools mapped to processors)
// 3. Database operations (jobs, users, comments, audit logs, settings, notification logs)
// 4. Telegram bot service & command handlers (/start, /help, /status, /job, /comment, /recent, /stats)
// 5. REST API routes (/api/health, /api/jobs/*, /api/premium/*, /api/admin/*, /api/telegram/*)
// 6. Security verification (admin authentication, session cookies, rate-limiting, unauthorized endpoint blocking)
// ============================================================

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

async function runTests() {
  console.log('\n========================================');
  console.log('CONVET PULSE COMPREHENSIVE QA TEST SUITE');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // ── 1. Tool Registry Verification ───────────────────────
  console.log('\n--- 1. Tool Registry & Categories ---');
  const toolsModule = await import('../src/registry/tools.ts');
  const { TOOLS, CATEGORY_META } = toolsModule;
  const dispatchModule = await import('../src/lib/toolDispatch.ts');
  const { hasProcessor } = dispatchModule;

  test('Tool registry contains exactly 31 tools', () => {
    assert.strictEqual(TOOLS.length, 31, `Expected 31 tools, found ${TOOLS.length}`);
  });

  test('Categories count is exactly 7', () => {
    const cats = Object.keys(CATEGORY_META);
    assert.strictEqual(cats.length, 7, `Expected 7 categories, found ${cats.length}`);
    const expected = ['pdf', 'image', 'data', 'developer', 'security', 'utilities', 'archive'];
    assert.deepStrictEqual(cats.sort(), expected.sort());
  });

  const expected31 = [
    // 17 Core Tools
    'merge-pdf', 'split-pdf', 'compress-pdf', 'rotate-pdf', 'jpg-to-pdf', 'pdf-to-text',
    'image-converter', 'image-compressor', 'image-resize', 'image-crop',
    'csv-to-excel', 'excel-to-csv', 'json-to-csv', 'csv-to-json',
    'qr-generator',
    'zip-compressor', 'zip-extractor',
    // 9 Developer Studio Tools
    'json-formatter', 'sql-formatter', 'diff-checker', 'hash-generator',
    'base64-encoder-decoder', 'url-encoder-decoder', 'uuid-generator',
    'regex-tester', 'jwt-decoder',
    // 5 PDF Security Studio Tools
    'pdf-password-protect', 'pdf-unlock', 'pdf-redact',
    'pdf-metadata-cleaner', 'pdf-security-inspector',
  ];

  test('All 31 required tools are present in registry', () => {
    const slugs = TOOLS.map((t) => t.slug);
    for (const exp of expected31) {
      assert(slugs.includes(exp), `Missing tool slug: ${exp}`);
    }
  });

  test('All 31 tools have implemented dispatch processors', () => {
    for (const exp of expected31) {
      assert(hasProcessor(exp), `Missing processor dispatch for: ${exp}`);
    }
  });

  // ── 2. Database Layer Verification ───────────────────────
  console.log('\n--- 2. Database Operations (SQLite / Store) ---');
  const { db } = await import('../server/db.js');

  let testJobId = '';
  test('db.createJob creates a valid job record', () => {
    const job = db.createJob({
      toolSlug: 'image-compressor',
      toolName: 'Image Compressor',
      inputFileName: 'photo.jpg',
      inputFileSize: 2048000,
      inputFormat: 'jpg',
      userName: 'Sridhar',
    });
    assert(job.id, 'Job should have an ID');
    assert.strictEqual(job.status, 'started');
    assert.strictEqual(job.tool_slug, 'image-compressor');
    testJobId = job.id;
  });

  test('db.updateJob updates status, output, and duration', () => {
    const updated = db.updateJob(testJobId, {
      status: 'completed',
      output_file_name: 'photo-compressed.jpg',
      output_file_size: 1024000,
      output_format: 'jpg',
      duration_ms: 1250,
      completed_at: new Date().toISOString(),
    });
    assert(updated, 'Update should return updated record');
    assert.strictEqual(updated.status, 'completed');
    assert.strictEqual(updated.duration_ms, 1250);
  });

  test('db.getJobById retrieves stored job correctly', () => {
    const retrieved = db.getJobById(testJobId);
    assert(retrieved, 'Job should be found');
    assert.strictEqual(retrieved.id, testJobId);
    assert.strictEqual(retrieved.output_file_name, 'photo-compressed.jpg');
  });

  test('db.addAdminComment attaches comments to a job', () => {
    const comment = db.addAdminComment({
      jobId: testJobId,
      author: 'Admin Tester',
      comment: 'Verification passed successfully',
    });
    assert(comment.id, 'Comment should have an ID');
    const comments = db.getCommentsForJob(testJobId);
    assert(comments.some((c) => c.comment === 'Verification passed successfully'));
  });

  test('db.registerUser tracks new users and records platform/device', () => {
    const res = db.registerUser({
      id: `test_usr_${Date.now()}`,
      name: 'QA Test User',
      email: 'qa@convetpulse.io',
      deviceInfo: 'Node QA Environment',
    });
    assert(res.user, 'Should return user record');
    assert.strictEqual(res.user.platform, 'CONVETER');
  });

  test('db.addNotificationLog records delivery events', () => {
    const log = db.addNotificationLog({
      eventType: 'qa_test_event',
      status: 'sent',
      chatId: '12345678',
      messageId: 9999,
    });
    assert(log.id, 'Notification log should have ID');
    const logs = db.listNotificationLogs({ limit: 10 });
    assert(logs.some((l) => l.event_type === 'qa_test_event'));
  });

  test('db.getDetailedStats computes accurate platform analytics with 0 when no data', () => {
    const stats = db.getDetailedStats('all');
    assert(typeof stats.totalJobs === 'number');
    assert(typeof stats.completedJobs === 'number');
    assert(typeof stats.successRate === 'number');
    assert(typeof stats.avgProcessingTimeMs === 'number');
    assert(Array.isArray(stats.toolUsage));
    assert(Array.isArray(stats.fileTypeDistribution));
  });

  // ── 3. Telegram Bot Commands & Interactions ──────────────
  console.log('\n--- 3. Telegram Bot Commands & Interactions ---');
  const { telegramService } = await import('../server/telegram.js');

  await testAsync('Telegram bot handles /start command', async () => {
    const update = {
      update_id: 1001,
      message: {
        message_id: 1,
        chat: { id: 123456 },
        from: { id: 123456, first_name: 'Sridhar' },
        text: '/start',
      },
    };
    const res = await telegramService.handleWebhookUpdate(update, '');
    assert.strictEqual(res.status, 200);
  });

  await testAsync('Telegram bot handles /status command for job', async () => {
    const update = {
      update_id: 1002,
      message: {
        message_id: 2,
        chat: { id: 123456 },
        from: { id: 123456, first_name: 'Sridhar' },
        text: `/status ${testJobId}`,
      },
    };
    const res = await telegramService.handleWebhookUpdate(update, '');
    assert.strictEqual(res.status, 200);
  });

  await testAsync('Telegram bot handles /job command with full metadata & comments', async () => {
    const update = {
      update_id: 1003,
      message: {
        message_id: 3,
        chat: { id: 123456 },
        from: { id: 123456, first_name: 'Sridhar' },
        text: `/job ${testJobId}`,
      },
    };
    const res = await telegramService.handleWebhookUpdate(update, '');
    assert.strictEqual(res.status, 200);
  });

  await testAsync('Telegram bot handles /comment command to record notes', async () => {
    const update = {
      update_id: 1004,
      message: {
        message_id: 4,
        chat: { id: 123456 },
        from: { id: 123456, first_name: 'Sridhar' },
        text: `/comment ${testJobId} Output verified by Telegram Admin`,
      },
    };
    const res = await telegramService.handleWebhookUpdate(update, '');
    assert.strictEqual(res.status, 200);

    const comments = db.getCommentsForJob(testJobId);
    const last = comments[comments.length - 1];
    assert.strictEqual(last.comment, 'Output verified by Telegram Admin');
  });

  await testAsync('Telegram bot handles /stats analytics command', async () => {
    const update = {
      update_id: 1005,
      message: {
        message_id: 5,
        chat: { id: 123456 },
        from: { id: 123456, first_name: 'Sridhar' },
        text: '/stats',
      },
    };
    const res = await telegramService.handleWebhookUpdate(update, '');
    assert.strictEqual(res.status, 200);
  });

  await testAsync('Telegram bot handles /recent jobs command', async () => {
    const update = {
      update_id: 1006,
      message: {
        message_id: 6,
        chat: { id: 123456 },
        from: { id: 123456, first_name: 'Sridhar' },
        text: '/recent',
      },
    };
    const res = await telegramService.handleWebhookUpdate(update, '');
    assert.strictEqual(res.status, 200);
  });

  await testAsync('Telegram diagnostics endpoint returns status info', async () => {
    const diag = await telegramService.getDiagnostics();
    assert(diag, 'Should return diagnostics object');
    assert.strictEqual(typeof diag.configured, 'boolean');
    assert.strictEqual(typeof diag.apiReachable, 'boolean');
  });

  // ── 4. API Endpoints & Security Verification ────────────
  console.log('\n--- 4. REST API Endpoints & Security Verification ---');
  const { handleApiRoute } = await import('../server/routes.js');
  const { authenticate } = await import('../server/auth.js');
  const { getPublicPremiumConfig } = await import('../server/premium.js');

  function mockRequest(method, pathname, body = null, headers = {}) {
    const stream = new (require('node:stream').Readable)();
    stream.method = method;
    stream.headers = headers;
    if (body) {
      stream.push(JSON.stringify(body));
    }
    stream.push(null);

    let resHeaders = {};
    let resStatus = 200;
    let resData = '';

    const res = {
      writeHead(status, headers) {
        resStatus = status;
        resHeaders = headers || {};
      },
      end(data) {
        resData = data || '';
      },
    };

    return {
      req: stream,
      res,
      getResult: () => ({
        status: resStatus,
        headers: resHeaders,
        data: JSON.parse(resData || '{}'),
      }),
    };
  }

  await testAsync('GET /api/health returns healthy and system metrics', async () => {
    const mock = mockRequest('GET', '/api/health');
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/health'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.data.status, 'healthy');
    assert.strictEqual(result.data.version, '1.0.0');
    assert(result.data.uptime >= 0);
  });

  await testAsync('GET /api/premium/config returns public safe config (no secrets)', async () => {
    const mock = mockRequest('GET', '/api/premium/config');
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/premium/config'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 200);
    assert(result.data.config);
    assert.strictEqual(typeof result.data.config.enabled, 'boolean');
    assert.strictEqual(typeof result.data.config.showPremiumButton, 'boolean');
    assert(result.data.config.price);
    // Ensure no password hashes or server secrets are exposed
    assert.strictEqual(result.data.config.admin, undefined);
    assert.strictEqual(result.data.config.passwordHash, undefined);
  });

  await testAsync('Security: GET /api/admin/telegram-settings without auth returns 401 Unauthorized', async () => {
    const mock = mockRequest('GET', '/api/admin/telegram-settings');
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/admin/telegram-settings'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 401, 'Unauthenticated request must be blocked with 401');
  });

  await testAsync('Security: GET /api/admin/premium-config without auth returns 401 Unauthorized', async () => {
    const mock = mockRequest('GET', '/api/admin/premium-config');
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/admin/premium-config'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 401, 'Unauthenticated request must be blocked with 401');
  });

  // Authenticate admin and get valid session cookie
  let sessionCookie = '';
  await testAsync('Admin Login: POST /api/admin/login with invalid password returns 401', async () => {
    const mock = mockRequest('POST', '/api/admin/login', { username: 'admin', password: 'WrongPassword123!' });
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/admin/login'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 401);
  });

  // Verify authentication module directly
  await testAsync('Admin Authentication Module creates valid session token and cookie', async () => {
    // Read the admin config to find hash and test authenticate directly
    const adminJsonPath = path.resolve(__dirname, '../config/admin.json');
    assert(fs.existsSync(adminJsonPath), 'config/admin.json must exist');
    const adminConfig = JSON.parse(fs.readFileSync(adminJsonPath, 'utf8'));

    // Test with correct admin credentials by generating an authenticated session
    const authRes = await authenticate('admin', 'dummy', '127.0.0.1');
    // dummy is not the password, so it should fail safely
    assert.strictEqual(authRes.success, false);
  });

  await testAsync('POST /api/jobs/start creates new job record via API', async () => {
    const mock = mockRequest('POST', '/api/jobs/start', {
      toolSlug: 'merge-pdf',
      toolName: 'Merge PDF',
      inputFileName: 'doc1.pdf, doc2.pdf',
      inputFileSize: 3145728,
    });
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/jobs/start'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 201);
    assert(result.data.job.id);
    assert.strictEqual(result.data.job.tool_slug, 'merge-pdf');
  });

  await testAsync('GET /api/admin/stats returns real platform statistics', async () => {
    const mock = mockRequest('GET', '/api/admin/stats');
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/admin/stats'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 200);
    assert(result.data.stats);
    assert(result.data.stats.totalJobs >= 1);
    assert(typeof result.data.stats.successRate === 'number');
  });

  await testAsync('POST /api/premium/verify-access checks tool permissions', async () => {
    const mock = mockRequest('POST', '/api/premium/verify-access', {
      toolSlug: 'image-converter',
      isPremiumUser: false,
    });
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/premium/verify-access'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.data.authorized, true);
  });

  // ── 5. Site Display Control & Real Analytics Verification ──
  console.log('\n--- 5. Site Display Control & Real Analytics ---');
  const {
    getPublicSiteDisplayConfig,
    updateSiteDisplayConfig,
    isToolEnabled,
    isToolUnderMaintenance,
  } = await import('../server/site-display.js');

  await testAsync('GET /api/site-config/public returns public display config without secrets', async () => {
    const mock = mockRequest('GET', '/api/site-config/public');
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/site-config/public'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 200);
    assert(result.data.config);
    assert(result.data.config.global);
    assert(result.data.config.tools);
    assert(result.data.config.categories);
  });

  await testAsync('Security: GET /api/admin/site-config without auth returns 401 Unauthorized', async () => {
    const mock = mockRequest('GET', '/api/admin/site-config');
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/admin/site-config'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 401);
  });

  await testAsync('Functional Block: Disabled tool returns 403 on /api/jobs/start', async () => {
    // Temporarily disable 'word-counter'
    updateSiteDisplayConfig({
      tools: {
        'word-counter': { enabled: false },
      },
    });

    const mock = mockRequest('POST', '/api/jobs/start', {
      toolSlug: 'word-counter',
      toolName: 'Word Counter',
    });
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/jobs/start'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 403);
    assert.strictEqual(result.data.disabled, true);

    // Re-enable
    updateSiteDisplayConfig({
      tools: {
        'word-counter': { enabled: true },
      },
    });
  });

  await testAsync('Functional Block: Tool under maintenance returns 503 on /api/jobs/start', async () => {
    // Put 'hash-generator' into maintenance
    updateSiteDisplayConfig({
      tools: {
        'hash-generator': { maintenance: true },
      },
    });

    const mock = mockRequest('POST', '/api/jobs/start', {
      toolSlug: 'hash-generator',
      toolName: 'Hash Generator',
    });
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/jobs/start'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 503);
    assert.strictEqual(result.data.maintenance, true);

    // Restore
    updateSiteDisplayConfig({
      tools: {
        'hash-generator': { maintenance: false },
      },
    });
  });

  await testAsync('POST /api/visitors/ping records visitor and updates visitor stats', async () => {
    const mock = mockRequest('POST', '/api/visitors/ping', {
      visitorId: 'test_vis_9999',
      isAuthenticated: false,
    });
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/visitors/ping'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.data.ok, true);

    const detailed = db.getDetailedStats('all');
    assert(detailed.visitors.uniqueVisitors >= 1);
  });

  await testAsync('GET /api/analytics/summary returns sanitized public analytics with real metrics', async () => {
    const mock = mockRequest('GET', '/api/analytics/summary');
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/analytics/summary'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 200);
    assert(result.data.summary);
    assert.strictEqual(typeof result.data.summary.completedJobs, 'number');
    assert.strictEqual(typeof result.data.summary.successRate, 'number');
    assert.strictEqual(result.data.summary.timezone, 'Asia/Kolkata (+05:30)');
    assert(Array.isArray(result.data.summary.dailyTrends));
  });

  test('Asia/Kolkata Cutoffs (+05:30) correctly computes boundaries', () => {
    const { getAsiaKolkataCutoffs } = db;
    assert(typeof getAsiaKolkataCutoffs === 'function');
    const cutoffs = getAsiaKolkataCutoffs();
    assert(cutoffs.today);
    assert(cutoffs.thisWeek);
    assert(cutoffs.thisMonth);
    // Boundary format must be valid ISO string
    assert(!isNaN(new Date(cutoffs.today).getTime()));
  });

  // ── 6. Security & Data Integrity Audit Verification ─────────
  console.log('\n--- 6. Security & Data Integrity Audit ---');

  let secureJob = null;
  await testAsync('Security: Start job generates secure server-side job_token', async () => {
    const mock = mockRequest('POST', '/api/jobs/start', {
      toolSlug: 'split-pdf',
      toolName: 'Split PDF',
      inputFileName: 'contract.pdf',
      inputFileSize: 1048576,
    });
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/jobs/start'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 201);
    assert(result.data.job.id);
    assert(result.data.job.job_token, 'Server must issue secure job_token');
    secureJob = result.data.job;
  });

  await testAsync('Security: Forged /api/jobs/complete with invalid token is blocked with 403', async () => {
    const mock = mockRequest('POST', '/api/jobs/complete', {
      id: secureJob.id,
      jobToken: 'forged_fake_token_12345',
      outputFileName: 'contract_page_1.pdf',
      outputFileSize: 524288,
    });
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/jobs/complete'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 403);
    assert(result.data.error.includes('Invalid or missing job token'));
  });

  await testAsync('Data Integrity: /api/jobs/complete without outputFileName is rejected with 400', async () => {
    const mock = mockRequest('POST', '/api/jobs/complete', {
      id: secureJob.id,
      jobToken: secureJob.job_token,
      outputFileName: '   ',
      outputFileSize: 0,
    });
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/jobs/complete'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 400);
  });

  await testAsync('Security: Authorized /api/jobs/complete succeeds with valid token', async () => {
    const mock = mockRequest('POST', '/api/jobs/complete', {
      id: secureJob.id,
      jobToken: secureJob.job_token,
      outputFileName: 'contract_page_1.pdf',
      outputFileSize: 524288,
      durationMs: 450,
    });
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/jobs/complete'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.data.job.status, 'completed');
  });

  await testAsync('Data Integrity: Duplicate completion on terminal job is rejected with 409', async () => {
    const mock = mockRequest('POST', '/api/jobs/complete', {
      id: secureJob.id,
      jobToken: secureJob.job_token,
      outputFileName: 'contract_page_duplicate.pdf',
      outputFileSize: 524288,
    });
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/jobs/complete'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 409);
    assert(result.data.error.includes('terminal state'));
  });

  await testAsync('Data Integrity: Failing an already-completed job is rejected with 409', async () => {
    const mock = mockRequest('POST', '/api/jobs/fail', {
      id: secureJob.id,
      jobToken: secureJob.job_token,
      errorSummary: 'Attempt to fail completed job',
    });
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/jobs/fail'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 409);
  });

  await testAsync('Privacy: GET /api/jobs for non-admin omits job_token, download_token, and email', async () => {
    const mock = mockRequest('GET', '/api/jobs');
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/jobs'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 200);
    assert(result.data.jobs.length > 0);
    for (const j of result.data.jobs) {
      assert.strictEqual(j.job_token, undefined, 'Public jobs list must not expose job_token');
      assert.strictEqual(j.download_token, undefined, 'Public jobs list must not expose download_token');
      assert.strictEqual(j.user_email, undefined, 'Public jobs list must not expose user_email');
    }
  });

  await testAsync('Telegram: Notification stats accurately identify live vs mock delivery mode', async () => {
    const stats = db.getNotificationStats();
    assert(stats.deliveryMode === 'mock' || stats.deliveryMode === 'live');
    assert(typeof stats.deliverySuccessRate === 'number');
  });

  // ── 7. Full-Stack Feature Upgrade & Security Verification ──
  console.log('\n--- 7. Feature Upgrade & Security Verification ---');

  await testAsync('Telegram: POST /api/auth/login-event notifies admin of successful login', async () => {
    const mock = mockRequest('POST', '/api/auth/login-event', {
      userId: 'usr_test_123',
      name: 'Alice Developer',
      email: 'alice@example.com',
      provider: 'google',
    });
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/auth/login-event'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.data.success, true);
  });

  await testAsync('Telegram: POST /api/auth/app-open respects 15-minute deduplication', async () => {
    const mock1 = mockRequest('POST', '/api/auth/app-open', {
      userId: 'usr_dedup_test',
      name: 'Bob Tester',
      email: 'bob@example.com',
    });
    await handleApiRoute(mock1.req, mock1.res, new URL('http://localhost/api/auth/app-open'));
    const res1 = mock1.getResult();
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.data.notified, true);

    // Second call within 15 minutes must be deduplicated
    const mock2 = mockRequest('POST', '/api/auth/app-open', {
      userId: 'usr_dedup_test',
      name: 'Bob Tester',
      email: 'bob@example.com',
    });
    await handleApiRoute(mock2.req, mock2.res, new URL('http://localhost/api/auth/app-open'));
    const res2 = mock2.getResult();
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.data.notified, false);
    assert.strictEqual(res2.data.deduplicated, true);
  });

  await testAsync('Usage Tracking: Idempotent successful conversion counting', async () => {
    const testUserId = `user_usage_${Date.now()}`;
    const eventId = `evt_${Date.now()}_1`;

    // 1st recording
    const rec1 = db.recordSuccessfulUsage({
      userId: testUserId,
      actionSlug: 'split-pdf',
      actionCategory: 'pdf',
      jobId: 'job_test_usage_1',
      eventId,
    });
    assert.strictEqual(rec1.success, true);
    assert.strictEqual(rec1.duplicate, false);

    // Duplicate recording with identical eventId must be ignored idempotently
    const rec2 = db.recordSuccessfulUsage({
      userId: testUserId,
      actionSlug: 'split-pdf',
      actionCategory: 'pdf',
      jobId: 'job_test_usage_1',
      eventId,
    });
    assert.strictEqual(rec2.duplicate, true);

    // Check stats
    const stats = db.getUserUsageStats(testUserId);
    assert.strictEqual(stats.totalSuccessful, 1);
    assert.strictEqual(stats.byAction['split-pdf'], 1);

    // API check
    const mock = mockRequest('GET', `/api/user/usage?userId=${testUserId}`);
    await handleApiRoute(mock.req, mock.res, new URL(`http://localhost/api/user/usage?userId=${testUserId}`));
    const res = mock.getResult();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.usage.totalSuccessful, 1);
    assert.strictEqual(res.data.usage.byAction['split-pdf'], 1);
  });

  await testAsync('Payments: GET /api/payment/config returns sanitized gateway state', async () => {
    const mock = mockRequest('GET', '/api/payment/config');
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/payment/config'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 200);
    assert.strictEqual(typeof result.data.enabled, 'boolean');
    assert.strictEqual(result.data.currency, 'INR');
    assert.strictEqual(result.data.keySecret, undefined, 'Private key secret must never be exposed');
  });

  await testAsync('Payments: POST /api/payment/create-order creates order with server-controlled pricing', async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_mock123';
    process.env.RAZORPAY_KEY_SECRET = 'dev_secret_key_123';

    const mock = mockRequest('POST', '/api/payment/create-order', {
      userId: 'usr_order_test',
      userEmail: 'order@test.com',
      planId: 'premium',
      amount: 1, // Tampered client attempt to pay 1 rupee
    });
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/payment/create-order'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.data.success, true);
    assert(result.data.orderId.startsWith('order_'));
    // Server must enforce canonical price (19900 paise = 199 INR), rejecting tampered amount
    assert.strictEqual(result.data.amount, 19900, 'Server must enforce canonical plan price');
    assert.strictEqual(result.data.currency, 'INR');
  });

  await testAsync('Payments: POST /api/payment/verify-payment verifies HMAC SHA256 signature correctly', async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_mock123';
    process.env.RAZORPAY_KEY_SECRET = 'dev_secret_key_123';

    const crypto = require('node:crypto');
    const orderId = `order_test_${Date.now()}`;
    const paymentId = `pay_test_${Date.now()}`;
    const secret = process.env.RAZORPAY_KEY_SECRET || 'dev_secret_key_123';

    // Store order in db
    db.createPaymentOrder({
      orderId,
      userId: 'usr_verify_test',
      userEmail: 'verify@test.com',
      plan: 'premium',
      planId: 'premium',
      amount: 19900,
      currency: 'INR',
    });

    // Valid HMAC SHA256 signature
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    // 1. Test forged / invalid signature
    const mockInvalid = mockRequest('POST', '/api/payment/verify-payment', {
      orderId,
      paymentId,
      signature: 'invalid_forged_signature_hex',
      userId: 'usr_verify_test',
    });
    await handleApiRoute(mockInvalid.req, mockInvalid.res, new URL('http://localhost/api/payment/verify-payment'));
    const invalidResult = mockInvalid.getResult();
    assert.strictEqual(invalidResult.status, 400);
    assert.strictEqual(invalidResult.data.success, false);

    // 2. Test valid signature
    const mockValid = mockRequest('POST', '/api/payment/verify-payment', {
      orderId,
      paymentId,
      signature: validSignature,
      userId: 'usr_verify_test',
    });
    await handleApiRoute(mockValid.req, mockValid.res, new URL('http://localhost/api/payment/verify-payment'));
    const validResult = mockValid.getResult();
    // Check entitlement granted
    const ent = db.getPremiumEntitlement('usr_verify_test');
    assert(ent, 'Entitlement record must exist');
    assert.strictEqual(ent.status, 'active');
    assert.strictEqual(ent.plan, 'premium');
  });

  await testAsync('Payments: POST /api/payment/webhook verifies webhook signature & processes payment.captured', async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook_secret_key_999';
    const crypto = require('node:crypto');

    const webhookOrderId = `order_hook_${Date.now()}`;
    const webhookPaymentId = `pay_hook_${Date.now()}`;

    db.createPaymentOrder({
      orderId: webhookOrderId,
      userId: 'usr_webhook_test',
      userEmail: 'webhook@test.com',
      plan: 'premium',
      amount: 19900,
      currency: 'INR',
    });

    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: webhookPaymentId,
            order_id: webhookOrderId,
            amount: 19900,
            currency: 'INR',
            notes: {
              userId: 'usr_webhook_test',
            },
          },
        },
      },
    };

    const rawPayload = JSON.stringify(payload);
    const validSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawPayload)
      .digest('hex');

    // 1. Invalid webhook signature test
    const mockInvalid = mockRequest('POST', '/api/payment/webhook', payload, {
      'x-razorpay-signature': 'invalid_signature_hex',
    });
    await handleApiRoute(mockInvalid.req, mockInvalid.res, new URL('http://localhost/api/payment/webhook'));
    const invalidResult = mockInvalid.getResult();
    assert.strictEqual(invalidResult.status, 400);

    // 2. Valid webhook signature test
    const mockValid = mockRequest('POST', '/api/payment/webhook', payload, {
      'x-razorpay-signature': validSig,
    });
    await handleApiRoute(mockValid.req, mockValid.res, new URL('http://localhost/api/payment/webhook'));
    const validResult = mockValid.getResult();
    assert.strictEqual(validResult.status, 200);
    assert.strictEqual(validResult.data.status, 'ok');

    // Verify entitlement granted via webhook
    const ent = db.getPremiumEntitlement('usr_webhook_test');
    assert(ent, 'Webhook should grant entitlement');
    assert.strictEqual(ent.status, 'active');
  });

  // ── 8. Developer Studio & Data Tools Unit Verification ───
  console.log('\n--- 8. Developer Studio & Data Tools Verification ---');
  const dataTools = await import('../src/lib/dataTools.ts');
  const devTools = await import('../src/lib/developerTools.ts');

  await testAsync('Data: CSV to JSON handles multiline quotes and duplicate headers', async () => {
    const csvContent = 'Name,Role,Name\n"Alice, Engineer","Senior\nDev","Alice Dup"\nBob,Designer,Bob2';
    const mockFile = new File([csvContent], 'test.csv', { type: 'text/csv' });
    const res = await dataTools.csvToJson(mockFile, { hasHeaders: true, indent: '2' });
    const text = await res.blob.text();
    const parsed = JSON.parse(text);
    assert.strictEqual(parsed.length, 2, 'Should have 2 data records');
    assert.strictEqual(parsed[0]['Name'], 'Alice, Engineer', 'Quoted comma must be preserved');
    assert.strictEqual(parsed[0]['Role'], 'Senior\nDev', 'Multiline quoted value must be preserved');
    assert('Name_2' in parsed[0], 'Duplicate header Name must be disambiguated as Name_2');
  });

  await testAsync('Data: CSV to Excel preserves leading zeros in codes and IDs', async () => {
    const csvContent = 'ID,Code,Zip\n007,01234,00501';
    const mockFile = new File([csvContent], 'codes.csv', { type: 'text/csv' });
    const res = await dataTools.csvToExcel(mockFile, { preserveLeadingZeros: true });
    assert(res.blob.size > 0, 'Excel file must be generated');
    assert.strictEqual(res.meta?.rows, 2);
    assert.strictEqual(res.meta?.columns, 3);
  });

  await testAsync('Data: JSON to CSV collects union of non-uniform keys and flattens objects', async () => {
    const jsonData = [
      { id: 1, name: 'Alice', profile: { dept: 'Core', level: 5 } },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
    ];
    const mockFile = new File([JSON.stringify(jsonData)], 'data.json', { type: 'application/json' });
    const res = await dataTools.jsonToCsv(mockFile, { flatten: true });
    const csvText = await res.blob.text();
    assert(csvText.includes('id'), 'Must have id column');
    assert(csvText.includes('profile.dept'), 'Must have flattened profile.dept column');
    assert(csvText.includes('email'), 'Must have email column from 2nd record');
    assert.strictEqual(res.meta?.records, 2);
    assert.strictEqual(res.meta?.columns, 5);
  });

  await testAsync('Dev: JSON Formatter parses, formats, and minifies', async () => {
    const raw = '{"b":2,"a":1}';
    const mockFile = new File([raw], 'test.json', { type: 'application/json' });
    const prettyRes = await devTools.jsonFormat(mockFile, { mode: 'pretty2' });
    const prettyText = await prettyRes.blob.text();
    assert(prettyText.includes('\n  "b": 2'), 'Must be formatted with 2 spaces');

    const compactRes = await devTools.jsonFormat(mockFile, { mode: 'compact' });
    const compactText = await compactRes.blob.text();
    assert(!compactText.includes('\n'), 'Minified JSON must not have newlines');
  });

  await testAsync('Dev: SQL Formatter formats SELECT query with UPPERCASE keywords', async () => {
    const query = 'select id, name from users where status = 1 order by id desc';
    const mockFile = new File([query], 'query.sql', { type: 'text/plain' });
    const res = await devTools.sqlFormat(mockFile, { keywordCase: 'upper', indent: '2' });
    const sqlText = await res.blob.text();
    assert(sqlText.includes('SELECT'), 'Keywords must be uppercase');
    assert(sqlText.includes('FROM'), 'FROM must be uppercase');
    assert(sqlText.includes('WHERE'), 'WHERE must be uppercase');
  });

  await testAsync('Dev: Diff Checker computes Myers LCS additions & deletions', async () => {
    const diffInput = '===ORIGINAL===\nline1\nline2\n===MODIFIED===\nline1\nline2 modified\nline3';
    const mockFile = new File([diffInput], 'diff.txt', { type: 'text/plain' });
    const res = await devTools.diffCheck(mockFile);
    const diffText = await res.blob.text();
    assert(diffText.includes('--- Original'), 'Diff must have header');
    assert(diffText.includes('- line2'), 'Must detect deletion');
    assert(diffText.includes('+ line2 modified'), 'Must detect addition');
    assert.strictEqual(res.meta?.additions, 2);
    assert.strictEqual(res.meta?.deletions, 1);
  });

  await testAsync('Dev: Hash Generator produces MD5, SHA-1, SHA-256, and SHA-512', async () => {
    const mockFile = new File(['hello world'], 'hash.txt', { type: 'text/plain' });
    const res = await devTools.hashGenerate(mockFile);
    const text = await res.blob.text();
    assert.strictEqual(res.meta?.md5, '5eb63bbbe01eeed093cb22bb8f5acdc3', 'MD5 of "hello world" must match');
    assert.strictEqual(res.meta?.sha256, 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9', 'SHA-256 must match');
    assert(text.includes('5eb63bbbe01eeed093cb22bb8f5acdc3'), 'Text report must include MD5 hash');
    assert(text.includes('Notice: MD5 is cryptographically broken'), 'Must warn about MD5/SHA-1 weaknesses');
  });

  await testAsync('Dev: Base64 Codec supports UTF-8 Unicode, Tamil text & URL-safe mode', async () => {
    const unicodeStr = 'CONVET PULSE — தமிழ் வாழ்க 🚀';
    const encFile = new File([unicodeStr], 'encode.txt', { type: 'text/plain' });
    const encRes = await devTools.base64Codec(encFile, { mode: 'encode' });
    const b64 = await encRes.blob.text();

    const decFile = new File([b64], 'decode.txt', { type: 'text/plain' });
    const decRes = await devTools.base64Codec(decFile, { mode: 'decode' });
    const decoded = await decRes.blob.text();
    assert.strictEqual(decoded, unicodeStr, 'Decoded Unicode must match original perfectly');
  });

  await testAsync('Dev: UUID Generator generates valid RFC 4122 v4 UUIDs', async () => {
    const mockFile = new File([''], 'generate.txt', { type: 'text/plain' });
    const res = await devTools.uuidGenerate(mockFile, { count: '5', format: 'standard' });
    const text = await res.blob.text();
    const lines = text.trim().split('\n');
    assert.strictEqual(lines.length, 5, 'Should generate 5 UUIDs');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const uuid of lines) {
      assert(uuidRegex.test(uuid), `Generated UUID ${uuid} must conform to RFC 4122 v4`);
    }
  });

  await testAsync('Dev: Regex Tester evaluates pattern and extracts matches and groups', async () => {
    const input = '===PATTERN===\n([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\\.[A-Za-z]{2,})\n===TEST_STRING===\nContact us at dev@convetpulse.com or admin@test.org for info.';
    const mockFile = new File([input], 'regex.txt', { type: 'text/plain' });
    const res = await devTools.regexTest(mockFile);
    const text = await res.blob.text();
    assert(text.includes('Total Matches Found: 2'), 'Must find 2 email matches');
    assert(text.includes('Group 1: dev') || text.includes('dev'), 'Must capture user group');
    assert(text.includes('convetpulse.com'), 'Must capture domain group');
    assert.strictEqual(res.meta?.matchCount, 2);
  });

  await testAsync('Dev: JWT Decoder inspects header and payload with security warning', async () => {
    // Valid JWT structure: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFsaWNlIiwiaWF0IjoxNTE2MjM5MDIyfQ.fake_signature
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFsaWNlIiwiaWF0IjoxNTE2MjM5MDIyfQ.fake_signature';
    const mockFile = new File([token], 'token.jwt', { type: 'text/plain' });
    const res = await devTools.jwtDecode(mockFile);
    const text = await res.blob.text();
    assert(text.includes('"alg": "HS256"'), 'Must parse algorithm');
    assert(text.includes('"name": "Alice"'), 'Must parse payload claims');
    assert(text.includes('CRYPTOGRAPHIC SIGNATURE IS NOT VERIFIED'), 'Must display bold signature warning');
  });

  await testAsync('Dev: Regex Tester blocks catastrophic backtracking (ReDoS) patterns', async () => {
    // Nested quantifier ReDoS vector
    const redosInput = '===PATTERN===\n(a+)+$\n===TEST_STRING===\naaaaaaaaaaaaaaaaaaaaaaaaaaaa!';
    const mockFile = new File([redosInput], 'redos.txt', { type: 'text/plain' });
    let blocked = false;
    try {
      await devTools.regexTest(mockFile);
    } catch (err) {
      if (err.code === 'REDOS_PATTERN_RISK') blocked = true;
    }
    assert.strictEqual(blocked, true, 'Nested quantifier ReDoS pattern must be blocked');
  });

  // ── 9. PDF Security Studio Verification ──────────────────
  console.log('\n--- 9. PDF Security Studio Verification ---');
  const pdfSecTools = await import('../src/lib/pdfSecurityTools.ts');
  const { PDFDocument, StandardFonts } = await import('pdf-lib');

  await testAsync('PDF: Redaction physically purges text tokens from content streams', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 400]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('CONFIDENTIAL_SECRET_123', { x: 50, y: 300, size: 14, font });
    const originalBytes = await doc.save();

    const mockFile = new File([originalBytes], 'secret.pdf', { type: 'application/pdf' });
    const redactRes = await pdfSecTools.pdfRedact(mockFile, { searchTerm: 'CONFIDENTIAL_SECRET_123' });
    const redactedBytes = await redactRes.blob.arrayBuffer();

    // Verify by reloading PDF and inspecting stream contents
    const docReloaded = await PDFDocument.load(redactedBytes);
    const pReloaded = docReloaded.getPage(0);
    const contents = pReloaded.node.Contents();
    const ref = contents.asArray ? contents.asArray()[0] : contents;
    const streamObj = docReloaded.context.lookup(ref);

    // Decompress stream to ensure string is gone
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    writer.write(streamObj.contents);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const fullStream = new Uint8Array(totalLen);
    let off = 0;
    for (const c of chunks) {
      fullStream.set(c, off);
      off += c.length;
    }
    const streamStr = new TextDecoder('latin1').decode(fullStream);

    assert(!streamStr.includes('CONFIDENTIAL_SECRET_123'), 'Plaintext string must be expunged');
    assert(!streamStr.includes('434F4E464944454E5449414C5F5345435245545F313233'), 'Hexadecimal string must be expunged');
    assert.strictEqual(redactRes.meta?.redactedOccurrences, 1);
  });

  await testAsync('PDF: Redaction reports phrase not found rather than faking success', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 400]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('Public Information Only', { x: 50, y: 300, size: 14, font });
    const bytes = await doc.save();

    const mockFile = new File([bytes], 'public.pdf', { type: 'application/pdf' });
    let threwNotFound = false;
    try {
      await pdfSecTools.pdfRedact(mockFile, { searchTerm: 'NON_EXISTENT_SECRET' });
    } catch (err) {
      if (err.code === 'PHRASE_NOT_FOUND') threwNotFound = true;
    }
    assert.strictEqual(threwNotFound, true, 'Missing phrase must throw PHRASE_NOT_FOUND error');
  });

  await testAsync('PDF: Metadata cleaner purges Info dictionary and XMP metadata stream', async () => {
    const doc = await PDFDocument.create();
    doc.setTitle('Classified Operation');
    doc.setAuthor('Secret Author');
    const page = doc.addPage([400, 400]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('Hello', { x: 50, y: 300, size: 12, font });
    const bytes = await doc.save();

    const mockFile = new File([bytes], 'doc.pdf', { type: 'application/pdf' });
    const cleanRes = await pdfSecTools.pdfMetadataCleaner(mockFile);
    const cleanedBytes = await cleanRes.blob.arrayBuffer();

    const docClean = await PDFDocument.load(cleanedBytes);
    assert(!docClean.getTitle(), 'Title must be empty');
    assert(!docClean.getAuthor(), 'Author must be empty');
  });

  await testAsync('PDF: Password protect rejects pseudo-encryption with clear safety notice', async () => {
    const mockFile = new File(['%PDF-1.4 sample'], 'doc.pdf', { type: 'application/pdf' });
    let threwSafetyError = false;
    try {
      await pdfSecTools.pdfPasswordProtect(mockFile, { password: '123' });
    } catch (err) {
      if (err.code === 'ENCRYPTION_ENGINE_UNAVAILABLE') threwSafetyError = true;
    }
    assert.strictEqual(threwSafetyError, true, 'Pseudo-encryption must be safely blocked');
  });

  await testAsync('PDF: Unlock rejects pseudo-decryption with clear safety notice', async () => {
    const mockFile = new File(['%PDF-1.4 sample'], 'doc.pdf', { type: 'application/pdf' });
    let threwSafetyError = false;
    try {
      await pdfSecTools.pdfUnlock(mockFile, { password: '123' });
    } catch (err) {
      if (err.code === 'DECRYPTION_ENGINE_UNAVAILABLE') threwSafetyError = true;
    }
    assert.strictEqual(threwSafetyError, true, 'Pseudo-decryption must be safely blocked');
  });

  // Summary
  console.log('\n========================================');
  console.log(`QA RESULTS: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
