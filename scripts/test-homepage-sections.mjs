// ============================================================
// CONVET PULSE — Test Suite for Homepage Latest Added & Coming Soon
// Verifies:
// 1. Dynamic sorting of latest added tools by timestamp
// 2. Exact limit of 8 tools
// 3. Rejection of un-timestamped tools from latest added
// 4. Roadmap registry filtering & exclusion of released tools
// 5. Zero duplicate IDs/slugs
// 6. Preservation of 58 tools and 12 studios
// ============================================================

import assert from 'node:assert';
import { TOOLS, getLatestAddedTools, getToolBySlug } from '../src/registry/tools.ts';
import { ROADMAP_TOOLS, getComingSoonTools } from '../src/registry/roadmap.ts';
import { STUDIOS } from '../src/registry/studios.ts';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.log(`  \x1b[31m✘\x1b[0m ${name}`);
    console.log(`    \x1b[31m${err.message}\x1b[0m`);
    failed++;
  }
}

console.log('\x1b[1m\x1b[36m=== Testing Latest Added Tools & Coming Soon Roadmap ===\x1b[0m\n');

// 1. Tool registry integrity
test('Total registered tools is exactly 64 (58 base + 6 Phase 4)', () => {
  assert.strictEqual(TOOLS.length, 64, `Expected 64 tools, got ${TOOLS.length}`);
});

test('Total registered studios is exactly 12', () => {
  assert.strictEqual(STUDIOS.length, 12, `Expected 12 studios, got ${STUDIOS.length}`);
});

// 2. Latest Added Tools
test('getLatestAddedTools(8) returns at most 8 tools', () => {
  const latest = getLatestAddedTools(8);
  assert(latest.length <= 8, `Expected <= 8 tools, got ${latest.length}`);
  assert(latest.length === 8, `Expected exactly 8 tools, got ${latest.length}`);
});

test('All returned latest tools possess valid createdAt timestamps', () => {
  const latest = getLatestAddedTools(8);
  for (const t of latest) {
    assert(typeof t.createdAt === 'string', `Tool ${t.slug} missing createdAt`);
    const date = new Date(t.createdAt);
    assert(!isNaN(date.getTime()), `Tool ${t.slug} has invalid createdAt date: ${t.createdAt}`);
  }
});

test('Latest added tools are sorted strictly by newest-first timestamp order', () => {
  const latest = getLatestAddedTools(8);
  for (let i = 0; i < latest.length - 1; i++) {
    const timeA = new Date(latest[i].createdAt).getTime();
    const timeB = new Date(latest[i + 1].createdAt).getTime();
    assert(timeA >= timeB, `Ordering violation: ${latest[i].slug} (${timeA}) is before ${latest[i + 1].slug} (${timeB})`);
  }
});

test('Un-timestamped tools are never included in latest added tools', () => {
  const latest = getLatestAddedTools(8);
  const untimestamped = TOOLS.filter((t) => !t.createdAt);
  assert(untimestamped.length > 0, 'Expected base tools to have no createdAt');
  for (const tool of untimestamped) {
    assert(!latest.some((l) => l.slug === tool.slug), `Untimestamped tool ${tool.slug} found in latest tools`);
  }
});

test('No duplicate tools exist in latest added tools list', () => {
  const latest = getLatestAddedTools(8);
  const slugs = latest.map((t) => t.slug);
  const uniqueSlugs = new Set(slugs);
  assert.strictEqual(slugs.length, uniqueSlugs.size, 'Duplicate tool found in latest added list');
});

// 3. Coming Soon Roadmap
test('Roadmap registry contains upcoming entries with valid stages', () => {
  assert(ROADMAP_TOOLS.length >= 8, `Expected at least 8 roadmap entries, got ${ROADMAP_TOOLS.length}`);
  for (const item of ROADMAP_TOOLS) {
    assert(['planned', 'in-development', 'testing'].includes(item.stage), `Invalid stage ${item.stage} on ${item.id}`);
    assert(item.id && item.name && item.description && item.plannedSlug, `Incomplete roadmap item: ${item.id}`);
  }
});

test('getComingSoonTools excludes any tool that has already been released', () => {
  const comingSoon = getComingSoonTools();
  const releasedSlugs = new Set(TOOLS.map((t) => t.slug));
  const releasedIds = new Set(TOOLS.map((t) => t.id));

  for (const item of comingSoon) {
    assert(!releasedSlugs.has(item.plannedSlug), `Released tool slug ${item.plannedSlug} leaked into Coming Soon`);
    assert(!releasedIds.has(item.id), `Released tool ID ${item.id} leaked into Coming Soon`);
  }
});

test('No duplicate slugs or IDs exist across roadmap items', () => {
  const ids = ROADMAP_TOOLS.map((t) => t.id);
  const slugs = ROADMAP_TOOLS.map((t) => t.plannedSlug);
  assert.strictEqual(ids.length, new Set(ids).size, 'Duplicate IDs in roadmap');
  assert.strictEqual(slugs.length, new Set(slugs).size, 'Duplicate slugs in roadmap');
});

test('All card routes in latest added tools map to existing valid tool slugs', () => {
  const latest = getLatestAddedTools(8);
  for (const tool of latest) {
    const found = getToolBySlug(tool.slug);
    assert(found !== undefined, `Latest tool slug ${tool.slug} does not exist in registry`);
  }
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32mAll Homepage Latest Added & Coming Soon tests passed cleanly!\x1b[0m\n');
}
