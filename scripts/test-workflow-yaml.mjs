// ============================================================
// CONVET PULSE — Workflow YAML Structure & Integrity Validator
// ============================================================

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve('.');
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function validateBracketsAndQuotes(content, filename) {
  const lines = content.split('\n');
  let lineNum = 0;
  let hasSyntaxError = false;

  for (const line of lines) {
    lineNum++;
    // Check unmatched ${{ }}
    const openExpressions = (line.match(/\$\{\{/g) || []).length;
    const closeExpressions = (line.match(/\}\}/g) || []).length;
    if (openExpressions !== closeExpressions) {
      console.error(`  ✗ ${filename}:${lineNum} Unmatched expression brackets: ${line.trim()}`);
      hasSyntaxError = true;
    }
  }

  assert(!hasSyntaxError, `${filename} has balanced ${{ }} expressions across all lines`);
}

console.log('\n--- 1. Validating .github/workflows/release.yml ---');
const releaseYmlPath = resolve(projectRoot, '.github/workflows/release.yml');
assert(existsSync(releaseYmlPath), 'release.yml exists');
const releaseYml = readFileSync(releaseYmlPath, 'utf8');

validateBracketsAndQuotes(releaseYml, 'release.yml');
assert(releaseYml.includes('node scripts/verify-firebase-env.mjs --platform=windows'), 'Windows job runs verify-firebase-env.mjs');
assert(releaseYml.includes('node scripts/verify-firebase-env.mjs --platform=android'), 'Android job runs verify-firebase-env.mjs');
assert(releaseYml.includes('VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY'), 'release.yml maps VITE_FIREBASE_API_KEY');
assert(releaseYml.includes('VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN'), 'release.yml maps VITE_FIREBASE_AUTH_DOMAIN');
assert(releaseYml.includes('VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID'), 'release.yml maps VITE_FIREBASE_PROJECT_ID');
assert(releaseYml.includes('VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID'), 'release.yml maps VITE_FIREBASE_APP_ID');
assert(releaseYml.includes('VITE_GOOGLE_DESKTOP_CLIENT_ID: ${{ secrets.VITE_GOOGLE_DESKTOP_CLIENT_ID'), 'release.yml maps VITE_GOOGLE_DESKTOP_CLIENT_ID');

console.log('\n--- 2. Validating .github/workflows/android-release.yml ---');
const androidYmlPath = resolve(projectRoot, '.github/workflows/android-release.yml');
assert(existsSync(androidYmlPath), 'android-release.yml exists');
const androidYml = readFileSync(androidYmlPath, 'utf8');

validateBracketsAndQuotes(androidYml, 'android-release.yml');
assert(androidYml.includes('node scripts/verify-firebase-env.mjs --platform=android'), 'Android-only job runs verify-firebase-env.mjs');
assert(androidYml.includes('VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY'), 'android-release.yml maps VITE_FIREBASE_API_KEY');
assert(androidYml.includes('VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN'), 'android-release.yml maps VITE_FIREBASE_AUTH_DOMAIN');
assert(androidYml.includes('VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID'), 'android-release.yml maps VITE_FIREBASE_PROJECT_ID');
assert(androidYml.includes('VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID'), 'android-release.yml maps VITE_FIREBASE_APP_ID');

console.log('\n--- 3. Validating .github/workflows/ci-dry-run.yml ---');
const dryRunYmlPath = resolve(projectRoot, '.github/workflows/ci-dry-run.yml');
assert(existsSync(dryRunYmlPath), 'ci-dry-run.yml exists');
const dryRunYml = readFileSync(dryRunYmlPath, 'utf8');

validateBracketsAndQuotes(dryRunYml, 'ci-dry-run.yml');
assert(dryRunYml.includes('workflow_dispatch:'), 'ci-dry-run.yml has workflow_dispatch trigger');
assert(dryRunYml.includes('contents: read'), 'ci-dry-run.yml has read-only contents permission');
assert(!dryRunYml.includes('release'), 'ci-dry-run.yml does not contain release actions');
assert(!dryRunYml.includes('upload'), 'ci-dry-run.yml does not upload artifacts or assets');
assert(dryRunYml.includes('node scripts/verify-firebase-env.mjs --platform=windows'), 'ci-dry-run.yml validates Windows target');
assert(dryRunYml.includes('node scripts/verify-firebase-env.mjs --platform=android'), 'ci-dry-run.yml validates Android target');
assert(dryRunYml.includes('npx tsc --noEmit'), 'ci-dry-run.yml runs typecheck');
assert(dryRunYml.includes('npm run build'), 'ci-dry-run.yml runs production build');

console.log(`\n============================================================`);
console.log(`Workflow Validation Summary: ${passed} passed, ${failed} failed`);
console.log(`============================================================\n`);

if (failed > 0) process.exit(1);
