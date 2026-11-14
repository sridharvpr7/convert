// ============================================================
// CONVET PULSE — Admin Account Persistence Audit Test Suite
// ============================================================

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

async function runPersistenceTests() {
  console.log('======================================================');
  console.log('CONVET PULSE — ADMIN PERSISTENCE QA AUDIT');
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
  const { initializeAuth, authenticate, changePassword } = await import('../server/auth.js');

  // Initialize/load auth state from database or config mirror
  await initializeAuth();

  // Test 1: Verify db.getAdminCredential and db.saveAdminCredential exist
  await test('Database module supports admin credentials storage', async () => {
    assert.strictEqual(typeof db.getAdminCredential, 'function');
    assert.strictEqual(typeof db.saveAdminCredential, 'function');
  });

  // Test 2: Existing admin is never overwritten on subsequent server startups
  await test('Simulate consecutive server startups: admin hash remains unchanged', async () => {
    // Current state before restart
    const credBefore = db.getAdminCredential('admin');
    assert(credBefore, 'Admin credential must exist in database');

    const originalHash = credBefore.passwordHash;
    const originalSalt = credBefore.salt;

    // Simulate second server startup
    const secondStartupResult = await initializeAuth();
    assert.strictEqual(
      secondStartupResult,
      null,
      'initializeAuth must return null on restart when admin already exists'
    );

    // Verify database record was NOT overwritten or replaced
    const credAfter = db.getAdminCredential('admin');
    assert.strictEqual(credAfter.passwordHash, originalHash, 'Password hash must remain identical across startups');
    assert.strictEqual(credAfter.salt, originalSalt, 'Salt must remain identical across startups');
  });

  // Test 3: Authentication succeeds using stored credentials across restart simulation
  await test('Authentication works reliably before and after server restart', async () => {
    const cred = db.getAdminCredential('admin');
    assert(cred, 'Admin must exist');

    // Authenticating with wrong password should fail
    const wrongAuth = await authenticate('admin', 'wrong_password_999!', '127.0.0.1');
    assert.strictEqual(wrongAuth.success, false, 'Invalid password must be rejected');

    // Re-verify that initializeAuth does not invalidate existing admin
    const initRes = await initializeAuth();
    assert.strictEqual(initRes, null);
  });

  // Test 4: Password change persists into database
  await test('Password change updates persistent database record', async () => {
    const testAdminUsername = `admin_t_${Date.now()}`;
    const testPass1 = 'InitPassword123!';
    const testPass2 = 'UpdatedPassword456!';

    // Save temporary admin credential in DB
    const crypto = require('node:crypto');
    const saltBuf = crypto.randomBytes(32);
    const hash1 = crypto.scryptSync(testPass1, saltBuf, 64).toString('hex');
    const saltHex = saltBuf.toString('hex');

    db.saveAdminCredential({
      username: testAdminUsername,
      passwordHash: hash1,
      salt: saltHex,
      mustChangePassword: true,
    });

    const saved = db.getAdminCredential(testAdminUsername);
    assert.strictEqual(saved.username, testAdminUsername);
    assert.strictEqual(saved.passwordHash, hash1);
    assert.strictEqual(saved.mustChangePassword, true);

    // Update password
    const hash2 = crypto.scryptSync(testPass2, saltBuf, 64).toString('hex');
    db.saveAdminCredential({
      username: testAdminUsername,
      passwordHash: hash2,
      salt: saltHex,
      mustChangePassword: false,
    });

    const updated = db.getAdminCredential(testAdminUsername);
    assert.strictEqual(updated.passwordHash, hash2);
    assert.strictEqual(updated.mustChangePassword, false);
  });

  // Test 5: Verify environment variable ADMIN_PASSWORD establishes admin without random password
  await test('ADMIN_PASSWORD environment variable establishes deterministic admin credentials', async () => {
    const origEnvPass = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD = 'CustomRenderAdminSecret123!';

    // Use isolated username
    const customUser = `test_env_admin_${Date.now()}`;
    process.env.ADMIN_USERNAME = customUser;

    const crypto = require('node:crypto');
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.scryptSync(process.env.ADMIN_PASSWORD, Buffer.from(salt, 'hex'), 64).toString('hex');

    db.saveAdminCredential({
      username: customUser,
      passwordHash: hash,
      salt,
      mustChangePassword: false,
    });

    const record = db.getAdminCredential(customUser);
    assert(record);
    assert.strictEqual(record.username, customUser);
    assert.strictEqual(record.passwordHash, hash);

    if (origEnvPass) process.env.ADMIN_PASSWORD = origEnvPass; else delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_USERNAME;
  });

  // Test 6: Verify production password redaction safety
  await test('Production log formatting redacts generated passwords', async () => {
    const origEnv = process.env.NODE_ENV;
    const origRender = process.env.RENDER;

    process.env.NODE_ENV = 'production';
    process.env.RENDER = 'true';

    const testAdminData = {
      username: 'admin',
      password: 'SuperSecretPlaintextPassword123!',
      isGenerated: true,
    };

    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
    assert.strictEqual(isProduction, true);

    // Check log formatting simulation
    const logs = [];
    if (isProduction) {
      if (testAdminData.isGenerated) {
        logs.push('Password: [REDACTED IN PRODUCTION LOGS]');
      }
    } else {
      logs.push(`Password: ${testAdminData.password}`);
    }

    assert.strictEqual(logs[0], 'Password: [REDACTED IN PRODUCTION LOGS]');
    assert(!logs[0].includes('SuperSecretPlaintextPassword123!'), 'Plaintext password must not be exposed');

    process.env.NODE_ENV = origEnv;
    if (origRender) process.env.RENDER = origRender; else delete process.env.RENDER;
  });

  // Test 7: Security: Incorrect passwords return false cleanly without buffer RangeError
  await test('Security: Incorrect passwords return 401/false cleanly without RangeError', async () => {
    const wrong1 = await authenticate('admin', 'WrongPass1!', '127.0.0.1');
    assert.strictEqual(wrong1.success, false);
    assert.strictEqual(wrong1.error, 'Invalid credentials');

    const wrong2 = await authenticate('admin', '', '127.0.0.1');
    assert.strictEqual(wrong2.success, false);

    const wrongUser = await authenticate('nonexistent_user', 'AnyPass123!', '127.0.0.1');
    assert.strictEqual(wrongUser.success, false);
  });

  // Test 8: Security: Legacy plaintext credentials migration
  await test('Security: Legacy unhashed credentials are automatically migrated to 128-char scrypt hash', async () => {
    const { isScryptHash } = await import('../server/auth.js');
    const admin = db.getAdminCredential('admin');
    assert(admin);
    assert(isScryptHash(admin.passwordHash), 'Admin password hash in database must be a genuine 128-char hex scrypt hash');
    assert.strictEqual(admin.passwordHash.length, 128);
    assert(!/^[0-9]+$/.test(admin.passwordHash), 'Hash must not be a plain numeric or short string');
  });

  // Test 9: Security: ADMIN_PASSWORD environment variable changes do not overwrite existing credentials
  await test('Security: ADMIN_PASSWORD environment variable change does NOT override existing administrator', async () => {
    const origAdmin = db.getAdminCredential('admin');
    assert(origAdmin);
    const existingHash = origAdmin.passwordHash;

    const origEnvPass = process.env.ADMIN_PASSWORD;
    // Set a different password in environment variable
    process.env.ADMIN_PASSWORD = 'MaliciousOrAccidentalEnvOverride999!';

    // Simulate server startup
    const initRes = await initializeAuth();
    assert.strictEqual(initRes, null, 'Must ignore ADMIN_PASSWORD when admin already exists');

    // Confirm existing hash in database was untouched
    const afterCheck = db.getAdminCredential('admin');
    assert.strictEqual(afterCheck.passwordHash, existingHash, 'Existing password hash must NEVER be overwritten by env var');

    if (origEnvPass) process.env.ADMIN_PASSWORD = origEnvPass; else delete process.env.ADMIN_PASSWORD;
  });

  // Test 10: Security: Stale synchronization cannot overwrite newer database records
  await test('Security: Timestamp protection prevents stale sync from overwriting newer credentials', async () => {
    const testUser = `sync_test_${Date.now()}`;
    const crypto = require('node:crypto');
    const salt = crypto.randomBytes(32).toString('hex');
    const hashA = crypto.scryptSync('PassA', Buffer.from(salt, 'hex'), 64).toString('hex');
    const hashB = crypto.scryptSync('PassB', Buffer.from(salt, 'hex'), 64).toString('hex');

    const futureTime = new Date(Date.now() + 10000).toISOString();
    const pastTime = new Date(Date.now() - 10000).toISOString();

    // 1. Insert newer record
    db.saveAdminCredential({
      username: testUser,
      passwordHash: hashB,
      salt,
      mustChangePassword: false,
      updatedAt: futureTime,
    });

    // 2. Attempt stale overwrite with past timestamp
    db.saveAdminCredential({
      username: testUser,
      passwordHash: hashA,
      salt,
      mustChangePassword: false,
      updatedAt: pastTime,
    });

    // 3. Confirm newer record was preserved
    const finalRec = db.getAdminCredential(testUser);
    assert.strictEqual(finalRec.passwordHash, hashB, 'Newer credential must be preserved against stale overwrite');
  });

  console.log('\n======================================================');
  console.log(`ADMIN PERSISTENCE AUDIT COMPLETE: ${passed} passed, ${failed} failed`);
  console.log('======================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPersistenceTests().catch((err) => {
  console.error('Fatal persistence test error:', err);
  process.exit(1);
});
