/**
 * CONVET PULSE — Admin Password Recovery & Reset Utility
 *
 * Secure administrative CLI tool to reset the administrator password using scrypt hashing.
 * Compatible with both local development and Render production environments (supports DATA_DIR persistent disk).
 *
 * Usage:
 *   node scripts/reset-admin-password.cjs <new-password>
 *   node scripts/reset-admin-password.cjs --generate
 *
 * Security:
 *   - Uses crypto.scrypt with a 32-byte cryptographic salt and 64-byte key length.
 *   - Validates minimum 8-character password length.
 *   - Preserves username "admin".
 *   - Does not log password hashes or salts to the terminal.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function getConfigDirs() {
  const dirs = [];
  if (process.env.DATA_DIR) {
    dirs.push(path.join(process.env.DATA_DIR, 'config'));
  }
  dirs.push(path.resolve(__dirname, '../config'));
  return dirs;
}

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

async function run() {
  const arg = process.argv[2];

  if (!arg || arg === '--help' || arg === '-h') {
    console.log(`
CONVET PULSE — Admin Password Reset Utility
────────────────────────────────────────────
Usage:
  node scripts/reset-admin-password.cjs <new-password>
  node scripts/reset-admin-password.cjs --generate

Options:
  <new-password>    Set a custom administrator password (minimum 8 characters).
  --generate        Generate a secure, random 16-character password.
    `);
    process.exit(0);
  }

  let newPassword = arg;
  let isGenerated = false;

  if (arg === '--generate') {
    newPassword = crypto.randomBytes(12).toString('base64url');
    isGenerated = true;
  }

  if (newPassword.length < 8) {
    console.error('Error: Password must be at least 8 characters long.');
    process.exit(1);
  }

  const { hash, salt } = await hashPassword(newPassword);

  const configData = {
    admin: {
      username: 'admin',
      passwordHash: hash,
      salt: salt,
      mustChangePassword: isGenerated,
    },
  };

  const configDirs = getConfigDirs();
  let updatedAny = false;

  for (const dir of configDirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const adminPath = path.join(dir, 'admin.json');
      fs.writeFileSync(adminPath, JSON.stringify(configData, null, 2), 'utf8');
      console.log(`✓ Admin credentials updated at: ${adminPath}`);
      updatedAny = true;
    } catch (err) {
      console.warn(`Warning: Could not write to ${dir}: ${err.message}`);
    }
  }

  if (!updatedAny) {
    console.error('Failed to update admin credentials in any configuration directory.');
    process.exit(1);
  }

  console.log('─────────────────────────────────────────────────────────────');
  console.log('Admin Password Reset Successful!');
  console.log('Username: admin');
  if (isGenerated) {
    console.log(`Generated Password: ${newPassword}`);
    console.log('Note: Save this password. You will be prompted to update it upon login.');
  } else {
    console.log('Password has been updated to your specified value.');
  }
  console.log('─────────────────────────────────────────────────────────────');
}

run().catch((err) => {
  console.error('Fatal error during password reset:', err.message);
  process.exit(1);
});

