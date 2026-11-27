// ============================================================
// CONVET PULSE — Build-Time Firebase Environment Verification
// ============================================================
// Validates presence and structure of required Firebase environment
// variables for release builds without exposing secret values.
// Supports Windows Desktop and Android release targets.
// ============================================================

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// If running in local environment without shell env vars, load .env.local safely
function loadLocalEnvIfPresent() {
  const localEnvPath = resolve('.', '.env.local');
  if (existsSync(localEnvPath)) {
    try {
      const content = readFileSync(localEnvPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[key] && val) {
            process.env[key] = val;
          }
        }
      }
    } catch {
      // Ignore reading error; continue with existing process.env
    }
  }
}

loadLocalEnvIfPresent();

// Parse platform argument
const args = process.argv.slice(2);
const platformArg = args.find((a) => a.startsWith('--platform='));
const targetPlatform = platformArg
  ? platformArg.split('=')[1].toLowerCase()
  : (process.env.TARGET_PLATFORM || (process.platform === 'win32' ? 'windows' : 'all'));

console.log(`\n============================================================`);
console.log(`CONVET PULSE — Build-Time Firebase Environment Verification`);
console.log(`Target Platform: ${targetPlatform.toUpperCase()}`);
console.log(`============================================================\n`);

const COMMON_RULES = [
  {
    name: 'VITE_FIREBASE_API_KEY',
    required: true,
    description: 'Firebase Web API Key for Identity Toolkit',
    validator: (val) => ({
      valid: val.length >= 20 && !val.includes('your_') && !val.includes('placeholder'),
      reason: 'Value appears to be a placeholder or invalid format',
    }),
  },
  {
    name: 'VITE_FIREBASE_AUTH_DOMAIN',
    required: true,
    description: 'Firebase Authentication Domain (e.g. conveter-89200.firebaseapp.com)',
    validator: (val) => ({
      valid: val.includes('.firebaseapp.com') || val.includes('.web.app'),
      reason: 'Domain must end with .firebaseapp.com or .web.app',
    }),
  },
  {
    name: 'VITE_FIREBASE_PROJECT_ID',
    required: true,
    description: 'Firebase Project ID (e.g. conveter-89200)',
    validator: (val) => ({
      valid: val.length > 3 && !val.includes('placeholder'),
      reason: 'Project ID is empty or invalid',
    }),
  },
  {
    name: 'VITE_FIREBASE_APP_ID',
    required: true,
    description: 'Firebase Web Application ID',
    validator: (val) => ({
      valid: val.length >= 10 && val.includes(':') && !val.includes('placeholder'),
      reason: 'Application ID format should resemble 1:xxx:web:xxx',
    }),
  },
];

const WINDOWS_SPECIFIC_RULES = [
  {
    name: 'VITE_GOOGLE_DESKTOP_CLIENT_ID',
    required: targetPlatform === 'windows' || targetPlatform === 'all',
    description: 'Google OAuth 2.0 Desktop Client ID (required for Windows PKCE flow)',
    validator: (val) => ({
      valid: val.includes('.apps.googleusercontent.com') && !val.includes('placeholder'),
      reason: 'Client ID must end with .apps.googleusercontent.com',
    }),
  },
];

const rules = [
  ...COMMON_RULES,
  ...(targetPlatform === 'windows' || targetPlatform === 'all'
    ? WINDOWS_SPECIFIC_RULES
    : [
        {
          name: 'VITE_GOOGLE_DESKTOP_CLIENT_ID',
          required: false,
          description: 'Google OAuth Client ID (optional on Android)',
        },
      ]),
];

let hasErrors = false;
const missingVars = [];
const invalidVars = [];

for (const rule of rules) {
  const value = process.env[rule.name];
  const isPresent = Boolean(value && value.trim().length > 0);

  if (!isPresent) {
    if (rule.required) {
      hasErrors = true;
      missingVars.push(rule.name);
      console.error(`  ❌ MISSING (REQUIRED): ${rule.name} — ${rule.description}`);
    } else {
      console.log(`  ⚪ OMITTED (OPTIONAL): ${rule.name} — ${rule.description}`);
    }
    continue;
  }

  if (rule.validator && value) {
    const check = rule.validator(value.trim());
    if (!check.valid) {
      if (rule.required) {
        hasErrors = true;
        invalidVars.push(`${rule.name} (${check.reason})`);
        console.error(`  ❌ INVALID (REQUIRED): ${rule.name} — ${check.reason}`);
      } else {
        console.warn(`  ⚠️  INVALID (OPTIONAL): ${rule.name} — ${check.reason}`);
      }
      continue;
    }
  }

  console.log(`  ✅ CONFIGURED: ${rule.name} — ${rule.description}`);
}

console.log(`\n------------------------------------------------------------`);

if (hasErrors) {
  console.error(`\n::error::Build-time Firebase environment validation FAILED for ${targetPlatform.toUpperCase()}.`);
  if (missingVars.length > 0) {
    console.error(`::error::Missing required environment variable(s): ${missingVars.join(', ')}`);
  }
  if (invalidVars.length > 0) {
    console.error(`::error::Invalid environment variable(s): ${invalidVars.join(', ')}`);
  }
  console.error(`\nAction Required:`);
  console.error(`Configure the above variables in GitHub Repository Settings -> Secrets and variables -> Actions.`);
  console.error(`Refer to .env.example for variable naming and setup details.\n`);
  process.exit(1);
}

console.log(`\n🎉 Firebase build environment verified successfully for ${targetPlatform.toUpperCase()}!`);
console.log(`All required client-side environment variables are present and well-formed.`);
console.log(`Vite will correctly embed Firebase credentials into release bundles.\n`);
process.exit(0);
