const fs = require('fs');
const assert = require('assert');

console.log('--- RUNNING FULL CONVETER VERIFICATION ---');

// 1. Tool registry verification
const toolsFile = fs.readFileSync('src/registry/tools.ts', 'utf8');
const catalogSlugs = [...toolsFile.matchAll(/slug:\s*'([^']+)'/g)].map(m => m[1]);
console.log(`Tool count in registry: ${catalogSlugs.length}`);
assert.strictEqual(catalogSlugs.length, 17, `Expected 17 tools, found ${catalogSlugs.length}`);

// 2. Dispatch map verification
const dispatchFile = fs.readFileSync('src/lib/toolDispatch.ts', 'utf8');
const mapKeys = [...dispatchFile.matchAll(/'([a-z0-9-]+)'\s*:\s*\{/g)].map(m => m[1]);
console.log(`Dispatch map registered keys: ${mapKeys.length}`);
assert.strictEqual(mapKeys.length, 17, `Expected 17 dispatch keys, found ${mapKeys.length}`);

// Registry-to-dispatch consistency
const missingInDispatch = catalogSlugs.filter(slug => !mapKeys.includes(slug));
const extraInDispatch = mapKeys.filter(slug => !catalogSlugs.includes(slug));
assert.strictEqual(missingInDispatch.length, 0, `Missing in dispatch: ${missingInDispatch.join(', ')}`);
assert.strictEqual(extraInDispatch.length, 0, `Extra in dispatch: ${extraInDispatch.join(', ')}`);
console.log('✓ 100% Registry-to-Dispatch consistency verified.');

// 3. Expected tools check
const EXPECTED_TOOLS = {
  pdf: ['merge-pdf', 'split-pdf', 'compress-pdf', 'rotate-pdf', 'jpg-to-pdf', 'pdf-to-text'],
  image: ['image-converter', 'image-compressor', 'image-resize', 'image-crop'],
  data: ['csv-to-excel', 'excel-to-csv', 'json-to-csv', 'csv-to-json'],
  utilities: ['qr-generator'],
  archive: ['zip-compressor', 'zip-extractor']
};

for (const [category, slugs] of Object.entries(EXPECTED_TOOLS)) {
  for (const slug of slugs) {
    assert(catalogSlugs.includes(slug), `Expected tool ${slug} in category ${category}`);
  }
}
console.log('✓ All 17 required tools are present and mapped.');

// 4. Check that no deleted tools exist in registry
const DELETED_SAMPLE_SLUGS = [
  'pdf-to-word', 'pdf-to-excel', 'pdf-to-powerpoint', 'ocr-pdf', 'protect-pdf', 'unlock-pdf',
  'background-remover', 'image-upscaler', 'exif-viewer', 'word-to-pdf', 'diff-checker',
  'jwt-decoder', 'uuid-generator', 'emi-calculator', 'ai-document-summarizer', 'video-converter',
  'audio-converter', 'invoice-generator', 'document-scanner'
];

for (const slug of DELETED_SAMPLE_SLUGS) {
  assert(!catalogSlugs.includes(slug), `Deleted tool ${slug} still found in registry!`);
  assert(!mapKeys.includes(slug), `Deleted tool ${slug} still found in dispatch map!`);
}
console.log('✓ All sample deleted tools are completely removed from registry and dispatch.');

// 5. Check related tools consistency
const relatedMatches = [...toolsFile.matchAll(/relatedTools:\s*\[([^\]]+)\]/g)];
for (const match of relatedMatches) {
  const slugs = match[1].replace(/['\s]/g, '').split(',').filter(Boolean);
  for (const s of slugs) {
    assert(catalogSlugs.includes(s), `Related tool slug '${s}' is not among retained tools!`);
  }
}
console.log('✓ All relatedTools reference only retained tools.');

console.log('--- ALL VERIFICATIONS PASSED SUCCESSFULLY ---');

