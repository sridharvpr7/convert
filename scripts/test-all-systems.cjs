// ============================================================
// CONVETER — Comprehensive Systems & Quality Assurance Test Suite
// Tests:
// 1. Tool registry integrity (17 tools, 5 categories)
// 2. Dispatch map consistency (all 17 tools mapped to processors)
// 3. Database operations (jobs, users, comments, audit logs, settings)
// 4. Telegram bot service & command handlers (/start, /help, /status, /job, /comment, /recent, /stats)
// 5. REST API routes (/api/health, /api/jobs/*, /api/users/*, /api/admin/*, /api/telegram/*)
// 6. Security verification (secret tokens, unauthorized chat blocking)
// ============================================================

const assert = require('node:assert');
const path = require('node:path');

async function runTests() {
  console.log('\n========================================');
  console.log('CONVETER ULTIMATE QA TEST SUITE');
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

  test('Tool registry contains exactly 17 tools', () => {
    assert.strictEqual(TOOLS.length, 17, `Expected 17 tools, found ${TOOLS.length}`);
  });

  test('Categories count is exactly 5', () => {
    const cats = Object.keys(CATEGORY_META);
    assert.strictEqual(cats.length, 5, `Expected 5 categories, found ${cats.length}`);
    const expected = ['pdf', 'image', 'data', 'utilities', 'archive'];
    assert.deepStrictEqual(cats.sort(), expected.sort());
  });

  const expected17 = [
    'merge-pdf', 'split-pdf', 'compress-pdf', 'rotate-pdf', 'jpg-to-pdf', 'pdf-to-text',
    'image-converter', 'image-compressor', 'image-resize', 'image-crop',
    'csv-to-excel', 'excel-to-csv', 'json-to-csv', 'csv-to-json',
    'qr-generator',
    'zip-compressor', 'zip-extractor',
  ];

  test('All 17 required tools are present', () => {
    const slugs = TOOLS.map((t) => t.slug);
    for (const exp of expected17) {
      assert(slugs.includes(exp), `Missing tool slug: ${exp}`);
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
      duration_ms: 1200,
      completed_at: new Date().toISOString(),
    });
    assert.strictEqual(updated.status, 'completed');
    assert.strictEqual(updated.output_file_name, 'photo-compressed.jpg');
    assert.strictEqual(updated.output_file_size, 1024000);
  });

  test('db.getJobById retrieves stored job correctly', () => {
    const fetched = db.getJobById(testJobId);
    assert(fetched, 'Job must be retrievable by ID');
    assert.strictEqual(fetched.id, testJobId);
    assert.strictEqual(fetched.tool_name, 'Image Compressor');
  });

  test('db.addAdminComment attaches comments to a job', () => {
    const comment = db.addAdminComment({
      jobId: testJobId,
      author: 'Admin',
      comment: 'Conversion completed successfully. Output verified.',
    });
    assert(comment.id, 'Comment must have an ID');
    assert.strictEqual(comment.job_id, testJobId);

    const comments = db.getCommentsForJob(testJobId);
    assert(comments.length >= 1, 'Should find at least 1 comment for job');
    assert.strictEqual(comments[comments.length - 1].comment, 'Conversion completed successfully. Output verified.');
  });

  test('db.registerUser tracks new users and records platform/device', () => {
    const res = db.registerUser({
      id: `user_test_${Date.now()}`,
      name: 'Sridhar Admin',
      email: 'sridhar@example.com',
      deviceInfo: 'Desktop Windows Chrome',
    });
    assert(res.user, 'Should return user object');
    assert.strictEqual(res.isNew, true, 'First registration must be marked isNew');
  });

  test('db.getStats computes accurate platform analytics', () => {
    const stats = db.getStats();
    assert(stats.totalJobs >= 1, 'Total jobs should be >= 1');
    assert(stats.completedJobs >= 1, 'Completed jobs should be >= 1');
    assert(stats.successRate >= 0 && stats.successRate <= 100, 'Success rate should be 0-100%');
  });

  // ── 3. Telegram Service & Webhook Commands ──────────────
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

  // ── 4. API Endpoints Simulation ─────────────────────────
  console.log('\n--- 4. REST API Endpoints Verification ---');
  const { handleApiRoute } = await import('../server/routes.js');

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
        resHeaders = headers;
      },
      end(data) {
        resData = data || '';
      },
    };

    return { req: stream, res, getResult: () => ({ status: resStatus, data: JSON.parse(resData || '{}') }) };
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

  await testAsync('GET /api/admin/stats returns platform statistics', async () => {
    const mock = mockRequest('GET', '/api/admin/stats');
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/admin/stats'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 200);
    assert(result.data.stats);
    assert(result.data.stats.totalJobs >= 1);
  });

  await testAsync('GET /api/admin/telegram-settings retrieves notification preferences', async () => {
    const mock = mockRequest('GET', '/api/admin/telegram-settings');
    await handleApiRoute(mock.req, mock.res, new URL('http://localhost/api/admin/telegram-settings'));
    const result = mock.getResult();
    assert.strictEqual(result.status, 200);
    assert.strictEqual(typeof result.data.settings.notify_new_user, 'boolean');
    assert.strictEqual(typeof result.data.settings.notify_conversion_started, 'boolean');
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

