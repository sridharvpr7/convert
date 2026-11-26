// ============================================================
// CONVET PULSE — Desktop Auth Bridge Integration Test Suite
// In-process verification of session initialization, polling,
// token security, and single-use consumption.
// ============================================================

import assert from 'node:assert';
import { EventEmitter } from 'node:events';
import { handleApiRoute } from '../server/routes.js';

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
    writeHead(code, h = {}) {
      statusCode = code;
      headersSent = { ...headersSent, ...h };
    },
    setHeader(k, v) {
      headersSent[k] = v;
    },
    end(chunk = '') {
      resData += chunk;
    },
  };

  const parsedUrl = new URL(path, 'http://localhost');

  process.nextTick(() => {
    if (body !== null && body !== undefined) {
      req.emit('data', Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)));
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

async function runTests() {
  console.log('=== Testing Desktop Google OAuth Bridge Endpoints ===\n');

  // Test 1: Session Initialization
  const initRes = await dispatchApi('POST', '/api/auth/desktop/init');
  assert.strictEqual(initRes.status, 200, 'Init should return HTTP 200');
  assert.strictEqual(initRes.body.success, true, 'Init should succeed');
  assert.ok(initRes.body.sessionId, 'Init should generate sessionId');
  assert.ok(initRes.body.pollToken, 'Init should generate pollToken');
  assert.ok(initRes.body.authUrl.includes('/auth/desktop?session='), 'Init should provide authUrl with session parameter');
  console.log('  ✔ POST /api/auth/desktop/init generates valid session & pollToken');

  const { sessionId, pollToken } = initRes.body;

  // Test 2: Polling pending session
  const pollPending = await dispatchApi('POST', '/api/auth/desktop/poll', { sessionId, pollToken });
  assert.strictEqual(pollPending.status, 200);
  assert.strictEqual(pollPending.body.status, 'pending', 'Active session should be pending');
  console.log('  ✔ POST /api/auth/desktop/poll reports pending status');

  // Test 3: Polling with invalid pollToken returns 403 Forbidden
  const pollForbidden = await dispatchApi('POST', '/api/auth/desktop/poll', {
    sessionId,
    pollToken: 'invalid-token-1234',
  });
  assert.strictEqual(pollForbidden.status, 403, 'Mismatched poll token should be rejected with 403');
  console.log('  ✔ POST /api/auth/desktop/poll rejects invalid pollToken with 403 Forbidden');

  // Test 4: Polling without parameters returns 400 Bad Request
  const pollMissing = await dispatchApi('POST', '/api/auth/desktop/poll', {});
  assert.strictEqual(pollMissing.status, 400, 'Missing params should be rejected with 400');
  console.log('  ✔ POST /api/auth/desktop/poll rejects missing parameters with 400');

  // Test 5: Complete session with ID token
  const testIdToken = 'test-mock-token-xyz';
  const testAccessToken = 'ya29.test-access-token';
  const completeRes = await dispatchApi('POST', '/api/auth/desktop/complete', {
    sessionId,
    idToken: testIdToken,
    accessToken: testAccessToken,
  });
  assert.strictEqual(completeRes.status, 200, 'Complete should return 200');
  assert.strictEqual(completeRes.body.success, true, 'Complete should succeed');
  console.log('  ✔ POST /api/auth/desktop/complete accepts credentials and completes session');

  // Test 6: Polling completed session retrieves tokens
  const pollCompleted = await dispatchApi('POST', '/api/auth/desktop/poll', { sessionId, pollToken });
  assert.strictEqual(pollCompleted.status, 200);
  assert.strictEqual(pollCompleted.body.status, 'completed');
  assert.strictEqual(pollCompleted.body.idToken, testIdToken);
  assert.strictEqual(pollCompleted.body.accessToken, testAccessToken);
  console.log('  ✔ POST /api/auth/desktop/poll successfully delivers tokens on completion');

  // Test 7: Single-use token consumption (replay protection)
  const pollReplay = await dispatchApi('POST', '/api/auth/desktop/poll', { sessionId, pollToken });
  assert.strictEqual(pollReplay.status, 200);
  assert.strictEqual(pollReplay.body.status, 'expired', 'Session must be destroyed immediately after first poll retrieval');
  console.log('  ✔ Replay protection: session is immediately purged after retrieval (single-use)');

  // Test 8: Session cancellation
  const cancelInit = await dispatchApi('POST', '/api/auth/desktop/init');
  const cancelSessionId = cancelInit.body.sessionId;
  const cancelPollToken = cancelInit.body.pollToken;

  const cancelRes = await dispatchApi('POST', '/api/auth/desktop/cancel', {
    sessionId: cancelSessionId,
    pollToken: cancelPollToken,
  });
  assert.strictEqual(cancelRes.status, 200);

  const pollCancelled = await dispatchApi('POST', '/api/auth/desktop/poll', {
    sessionId: cancelSessionId,
    pollToken: cancelPollToken,
  });
  assert.strictEqual(pollCancelled.body.status, 'expired');
  console.log('  ✔ POST /api/auth/desktop/cancel safely terminates active session');

  console.log('\nResults: 8 passed, 0 failed');
  console.log('All Desktop Google OAuth Bridge integration tests passed cleanly!\n');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
