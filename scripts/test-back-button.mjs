// ============================================================
// CONVET PULSE — Global Back Button Verification Test Suite
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

console.log('\n--- 1. Component File & Export Integrity ---');
const backButtonPath = resolve(projectRoot, 'src/components/navigation/GlobalBackButton.tsx');
assert(existsSync(backButtonPath), 'GlobalBackButton.tsx exists');

const backButtonSrc = readFileSync(backButtonPath, 'utf8');
assert(backButtonSrc.includes('export const GlobalBackButton'), 'GlobalBackButton is exported');
assert(backButtonSrc.includes('export interface GlobalBackButtonProps'), 'GlobalBackButtonProps interface is exported');
assert(backButtonSrc.includes('ArrowLeft'), 'ArrowLeft icon is utilized');
assert(backButtonSrc.includes("label = 'Back'"), "Default label is 'Back'");
assert(backButtonSrc.includes("fallbackPath = '/'"), "Default fallback path is '/'");

console.log('\n--- 2. Navigation Behavior & Safety Logic ---');
assert(backButtonSrc.includes('isNavigatingRef'), 'Deduplication lock ref is implemented');
assert(backButtonSrc.includes('window.history.state'), 'React Router v6 history state index is checked');
assert(backButtonSrc.includes('navigate(-1)'), 'navigate(-1) called when internal history exists');
assert(backButtonSrc.includes('navigate(fallbackPath'), 'Graceful fallback to Home/fallbackPath when no history exists');
assert(backButtonSrc.includes("location.pathname === '/'"), "Home page check ('/') implemented to avoid redundant back button");
assert(backButtonSrc.includes("aria-label="), 'Accessible aria-label is present');
assert(backButtonSrc.includes("onKeyDown="), 'Keyboard interaction (Enter/Space) is supported');

console.log('\n--- 3. Header Integration ---');
const headerPath = resolve(projectRoot, 'src/components/navigation/Header.tsx');
const headerSrc = readFileSync(headerPath, 'utf8');
assert(headerSrc.includes("from '@/components/navigation/GlobalBackButton'"), 'GlobalBackButton is imported in Header.tsx');
assert(headerSrc.includes('<GlobalBackButton'), 'GlobalBackButton is rendered in Header.tsx');
assert(headerSrc.includes('<ConveterLogo'), 'GlobalBackButton is placed adjacent to Logo at top-left');

console.log('\n--- 4. App Shared PageWrapper Integration ---');
const appPath = resolve(projectRoot, 'src/App.tsx');
const appSrc = readFileSync(appPath, 'utf8');
assert(appSrc.includes("from '@/components/navigation/GlobalBackButton'"), 'GlobalBackButton is imported in App.tsx');
assert(appSrc.includes('<GlobalBackButton />'), 'GlobalBackButton is rendered in PageWrapper for noHeader pages');
assert(appSrc.includes('noHeader &&'), 'GlobalBackButton is conditionally rendered when noHeader is true');

console.log('\n--- 5. Auth Pages & Clearance Integration ---');
const authPagePath = resolve(projectRoot, 'src/pages/AuthPage.tsx');
const authPageSrc = readFileSync(authPagePath, 'utf8');
assert(authPageSrc.includes('pt-20'), 'Desktop branding panel includes top clearance for GlobalBackButton');
assert(authPageSrc.includes('pt-16'), 'Mobile auth panel includes top clearance for GlobalBackButton');

const callbackPagePath = resolve(projectRoot, 'src/pages/DesktopAuthCallbackPage.tsx');
const callbackPageSrc = readFileSync(callbackPagePath, 'utf8');
assert(callbackPageSrc.includes('pt-16'), 'DesktopAuthCallbackPage includes top clearance for GlobalBackButton');

console.log(`\n============================================================`);
console.log(`Back Button Test Suite Summary: ${passed} passed, ${failed} failed`);
console.log(`============================================================\n`);

if (failed > 0) {
  process.exit(1);
}
