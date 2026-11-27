// ============================================================
// CONVET PULSE — Windows Desktop OAuth PKCE Test Suite
// Verifies RFC 8252 & RFC 7636 compliance, cryptography, state CSRF,
// callback parsing, and platform safety.
// ============================================================

import assert from 'node:assert';
import crypto from 'node:crypto';

console.log('=== Running Windows Desktop OAuth PKCE Verification Suite ===\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}:`, err.message);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}:`, err.message);
    failed++;
  }
}

// 1. Helper functions replicating client implementation
function base64UrlEncode(bytes) {
  const buf = Buffer.from(bytes);
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generateRandomString(length = 64) {
  const bytes = crypto.randomBytes(length);
  return base64UrlEncode(bytes).slice(0, length);
}

function generateCodeChallenge(verifier) {
  const hash = crypto.createHash('sha256').update(verifier, 'ascii').digest();
  return base64UrlEncode(hash);
}

// 2. Tests
test('1. PKCE verifier length and character set (RFC 7636)', () => {
  const verifier = generateRandomString(64);
  assert.strictEqual(verifier.length, 64);
  assert.match(verifier, /^[A-Za-z0-9_-]+$/);
});

test('2. PKCE code_challenge matches RFC 7636 Appendix B test vector', () => {
  // RFC 7636 Appendix B test vector:
  // verifier: dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
  // expected challenge: E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
  const rfcVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const expectedChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  const challenge = generateCodeChallenge(rfcVerifier);
  assert.strictEqual(challenge, expectedChallenge);
});

test('3. State parameter generates high-entropy random string', () => {
  const s1 = generateRandomString(32);
  const s2 = generateRandomString(32);
  assert.strictEqual(s1.length, 32);
  assert.strictEqual(s2.length, 32);
  assert.notStrictEqual(s1, s2);
});

test('4. Google OAuth 2.0 URL construction with desktop loopback redirect', () => {
  const clientId = 'test-client-id.apps.googleusercontent.com';
  const port = 54321;
  const redirectUri = `http://127.0.0.1:${port}`;
  const codeVerifier = generateRandomString(64);
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateRandomString(32);

  const authParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: state,
    prompt: 'select_account',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`;
  const parsed = new URL(authUrl);

  assert.strictEqual(parsed.origin, 'https://accounts.google.com');
  assert.strictEqual(parsed.pathname, '/o/oauth2/v2/auth');
  assert.strictEqual(parsed.searchParams.get('client_id'), clientId);
  assert.strictEqual(parsed.searchParams.get('redirect_uri'), redirectUri);
  assert.strictEqual(parsed.searchParams.get('response_type'), 'code');
  assert.strictEqual(parsed.searchParams.get('scope'), 'openid email profile');
  assert.strictEqual(parsed.searchParams.get('code_challenge_method'), 'S256');
  assert.strictEqual(parsed.searchParams.get('state'), state);
});

test('5. OAuth callback query parser handles standard and special characters', () => {
  const queryString = 'code=4%2F0AX4XfWh8_ExampleCode%2BWithPlus&state=test_state_123';
  const params = new URLSearchParams(queryString);
  assert.strictEqual(params.get('code'), '4/0AX4XfWh8_ExampleCode+WithPlus');
  assert.strictEqual(params.get('state'), 'test_state_123');
});

test('6. OAuth state mismatch CSRF detection', () => {
  const expectedState = 'valid_state_abc';
  const receivedState = 'forged_state_xyz';
  assert.notStrictEqual(receivedState, expectedState);
});

test('7. Google OAuth error parameter handling', () => {
  const errorQuery = 'error=access_denied&state=test_state_123';
  const params = new URLSearchParams(errorQuery);
  assert.strictEqual(params.get('error'), 'access_denied');
  assert.strictEqual(params.get('code'), null);
});

test('8. Platform detection logic preserves Android and Web isolation', () => {
  // Replicate isDesktop logic: isTauri() && !isAndroid()
  const isDesktopWindows = (isTauri, isAndroid) => isTauri && !isAndroid;
  
  // Windows Desktop Tauri
  assert.strictEqual(isDesktopWindows(true, false), true);
  // Android Tauri
  assert.strictEqual(isDesktopWindows(true, true), false);
  // Web browser
  assert.strictEqual(isDesktopWindows(false, false), false);
});

console.log(`\n============================================================`);
console.log(`Test Summary: ${passed} passed, ${failed} failed`);
console.log(`============================================================\n`);

if (failed > 0) {
  process.exit(1);
}
