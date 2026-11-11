const fs = require('fs');

// 1. Extract slugs from src/registry/tools.ts
const toolsFile = fs.readFileSync('src/registry/tools.ts', 'utf8');
const catalogSlugs = [...toolsFile.matchAll(/slug:\s*'([^']+)'/g)].map(m => m[1]);

// 2. Extract keys defined in dispatchMap in src/lib/toolDispatch.ts
const dispatchFile = fs.readFileSync('src/lib/toolDispatch.ts', 'utf8');
// Keys are formatted as 'some-tool-slug': {
const mapKeys = [...dispatchFile.matchAll(/'([a-z0-9-]+)'\s*:\s*\{/g)].map(m => m[1]);

console.log(`Catalog tools count: ${catalogSlugs.length}`);
console.log(`Dispatch map registered keys count: ${mapKeys.length}`);

const missingInDispatch = catalogSlugs.filter(slug => !mapKeys.includes(slug));
const extraInDispatch = mapKeys.filter(slug => !catalogSlugs.includes(slug));

if (missingInDispatch.length > 0) {
  console.error('ERROR: Slugs missing in dispatchMap:', missingInDispatch);
  process.exit(1);
} else {
  console.log(`SUCCESS: All ${catalogSlugs.length} catalog tools have a registered processor in dispatchMap!`);
}

if (extraInDispatch.length > 0) {
  console.log('Extra keys in dispatchMap:', extraInDispatch);
}
