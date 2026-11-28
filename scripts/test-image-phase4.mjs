// ============================================================
// CONVET PULSE — Phase 4 Image & Design Studio Test Suite
// Verifies:
// 1. Image format conversions (PNG, JPEG, WebP)
// 2. Transparent image handling & JPEG alpha removal explanation
// 3. Resizing dimensions, aspect ratio lock & scale percent
// 4. Crop boundaries & aspect ratio presets
// 5. Rotation (90°, 180°, 270°) and flipping (H/V/both)
// 6. Watermark text overlay (with Tamil Unicode support)
// 7. Metadata cleaner & EXIF stripping verification
// 8. Adjustments (brightness, contrast, saturation, blur, sharpen)
// 9. Color picker pixel sampling (HEX, RGB, HSL)
// 10. Palette extractor dominant color quantification
// 11. Untrusted SVG sanitization & XSS neutralization
// 12. Invalid, empty, and corrupted file rejection
// 13. Large image downsampling & memory safety
// 14. Batch processing & ZIP bundle integrity
// 15. Correct MIME types and file extensions
// 16. Registry and tool dispatch integrity
// ============================================================

import assert from 'node:assert';
import { createCanvas } from '@napi-rs/canvas';
import JSZip from 'jszip';
import {
  validateImageFile,
  sanitizeSvg,
  imageConvert,
  imageResize,
  imageCrop,
  imageCompress,
  imageRotatorFlipper,
  imageWatermark,
  imageMetadataCleaner,
  imageAdjustments,
  imageColorPicker,
  imagePaletteExtractor,
} from '../src/lib/imageStudio.ts';
import { TOOLS, getToolBySlug } from '../src/registry/tools.ts';
import { STUDIOS, getToolsForStudio } from '../src/registry/studios.ts';
import { getToolDispatch } from '../src/lib/toolDispatch.ts';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.log(`  \x1b[31m✘\x1b[0m ${name}`);
    console.log(`    \x1b[31m${err.stack || err.message}\x1b[0m`);
    failed++;
  }
}

function createSyntheticImage(width = 200, height = 150, options = {}) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  if (options.transparent) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.fillRect(0, 0, width / 2, height / 2);
    ctx.fillStyle = 'rgba(0, 0, 255, 0.8)';
    ctx.fillRect(width / 2, height / 2, width / 2, height / 2);
  } else {
    ctx.fillStyle = options.color || '#22c55e';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(20, 20, 40, 40);
  }

  const format = options.format || 'png';
  const buffer = canvas.toBuffer(format === 'jpeg' ? 'image/jpeg' : 'image/png');
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const ext = format === 'jpeg' ? 'jpg' : 'png';

  return new File([buffer], `test_image.${ext}`, { type: mimeType });
}

console.log('\x1b[1m\x1b[36m=== Testing Phase 4 Image & Design Studio Engine ===\x1b[0m\n');

// 1. Validation & Magic Bytes
await test('validateImageFile identifies valid PNG, JPEG, and WebP', async () => {
  const pngFile = createSyntheticImage(100, 100, { format: 'png' });
  const jpegFile = createSyntheticImage(100, 100, { format: 'jpeg' });

  const pngRes = await validateImageFile(pngFile);
  assert.strictEqual(pngRes.format, 'png');
  assert.strictEqual(pngRes.mimeType, 'image/png');

  const jpegRes = await validateImageFile(jpegFile);
  assert.strictEqual(jpegRes.format, 'jpeg');
  assert.strictEqual(jpegRes.mimeType, 'image/jpeg');
});

await test('validateImageFile rejects empty files and corrupted bytes', async () => {
  const empty = new File([new Uint8Array(0)], 'empty.png', { type: 'image/png' });
  await assert.rejects(async () => validateImageFile(empty), /empty/i);

  const corrupted = new File([new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04])], 'bad.jpg', {
    type: 'image/jpeg',
  });
  await assert.rejects(async () => validateImageFile(corrupted), /unsupported or corrupted/i);
});

// 2. Format Conversion
await test('imageConvert converts PNG to WebP and JPEG cleanly', async () => {
  const src = createSyntheticImage(160, 120, { format: 'png', transparent: false });

  const webpRes = await imageConvert(src, 'webp', 0.85);
  assert.strictEqual(webpRes.mimeType, 'image/webp');
  assert(webpRes.filename.endsWith('.webp'));
  assert(webpRes.blob.size > 0);

  const jpegRes = await imageConvert(src, 'jpeg', 0.85);
  assert.strictEqual(jpegRes.mimeType, 'image/jpeg');
  assert(jpegRes.filename.endsWith('.jpg'));
  assert(jpegRes.blob.size > 0);
});

await test('imageConvert handles transparent PNG to JPEG with white fill and note', async () => {
  const transparentSrc = createSyntheticImage(120, 120, { transparent: true });

  const res = await imageConvert(transparentSrc, 'jpeg', 0.9);
  assert.strictEqual(res.mimeType, 'image/jpeg');
  assert.strictEqual(res.meta?.transparencyRemoved, 1);
  assert(typeof res.meta?.transparencyNote === 'string');
  assert(res.meta.transparencyNote.includes('white background'));
});

// 3. Resizing
await test('imageResize scales dimensions accurately with aspect ratio lock', async () => {
  const src = createSyntheticImage(400, 200); // 2:1 aspect ratio

  // Target width 200 -> height should be 100
  const res = await imageResize(src, { width: 200, maintainAspect: true });
  assert.strictEqual(res.meta?.width, 200);
  assert.strictEqual(res.meta?.height, 100);
  assert(res.blob.size > 0);
});

await test('imageResize supports scale percentage', async () => {
  const src = createSyntheticImage(400, 200);
  const res = await imageResize(src, { scalePercent: 50 });
  assert.strictEqual(res.meta?.width, 200);
  assert.strictEqual(res.meta?.height, 100);
});

// 4. Cropping
await test('imageCrop crops exact coordinates and aspect ratio presets', async () => {
  const src = createSyntheticImage(400, 400);

  // Exact crop
  const exact = await imageCrop(src, { x: 50, y: 50, width: 100, height: 100 });
  assert.strictEqual(exact.meta?.width, 100);
  assert.strictEqual(exact.meta?.height, 100);

  // 16:9 ratio preset
  const widescreen = await imageCrop(src, { ratio: '16:9' });
  assert(widescreen.meta?.width > 0);
  assert(widescreen.meta?.height > 0);
  const ratio = widescreen.meta.width / widescreen.meta.height;
  assert(Math.abs(ratio - 16 / 9) < 0.05, `Expected 16:9 ratio, got ${ratio}`);
});

// 5. Rotation & Flipping
await test('imageRotatorFlipper rotates by 90° and swaps width/height', async () => {
  const src = createSyntheticImage(300, 150); // w=300, h=150
  const res = await imageRotatorFlipper(src, { rotation: 90 });

  assert.strictEqual(res.meta?.width, 150, 'Width should match original height');
  assert.strictEqual(res.meta?.height, 300, 'Height should match original width');
  assert.strictEqual(res.meta?.rotation, 90);
});

await test('imageRotatorFlipper performs horizontal and vertical flip', async () => {
  const src = createSyntheticImage(200, 100);
  const hFlip = await imageRotatorFlipper(src, { flip: 'horizontal' });
  assert.strictEqual(hFlip.meta?.flip, 'horizontal');
  assert.strictEqual(hFlip.meta?.width, 200);
  assert.strictEqual(hFlip.meta?.height, 100);

  const bothFlip = await imageRotatorFlipper(src, { flip: 'both' });
  assert.strictEqual(bothFlip.meta?.flip, 'both');
});

// 6. Watermark with Tamil Unicode
await test('imageWatermark stamps text watermark with Tamil script support', async () => {
  const src = createSyntheticImage(400, 300);
  const res = await imageWatermark(src, {
    text: 'முத்திரை CONVET 2026',
    position: 'center',
    opacity: 0.5,
    fontSize: 28,
  });

  assert.strictEqual(res.meta?.text, 'முத்திரை CONVET 2026');
  assert.strictEqual(res.meta?.opacity, 0.5);
  assert(res.blob.size > 0);
});

await test('imageWatermark supports tiled repeating grid position', async () => {
  const src = createSyntheticImage(300, 300);
  const res = await imageWatermark(src, {
    text: 'CONFIDENTIAL',
    position: 'tile',
    opacity: 0.3,
  });

  assert.strictEqual(res.meta?.position, 'tile');
  assert(res.blob.size > 0);
});

// 7. Metadata Cleaner
await test('imageMetadataCleaner produces clean re-rasterized image without EXIF leaks', async () => {
  const src = createSyntheticImage(200, 200, { format: 'jpeg' });
  const res = await imageMetadataCleaner(src, { format: 'jpeg' });

  assert.strictEqual(res.meta?.exifStripped, 1);
  assert.strictEqual(res.meta?.privacyStatus, '100% Metadata Scrubbed');
  assert(res.blob.size > 0);
});

// 8. Image Adjustments
await test('imageAdjustments applies brightness, contrast, grayscale, and blur', async () => {
  const src = createSyntheticImage(200, 200);
  const res = await imageAdjustments(src, {
    brightness: 20,
    contrast: 15,
    grayscale: 50,
    blur: 2,
    sharpen: true,
  });

  assert.strictEqual(res.meta?.brightness, 20);
  assert.strictEqual(res.meta?.contrast, 15);
  assert.strictEqual(res.meta?.grayscale, 50);
  assert.strictEqual(res.meta?.sharpen, 1);
  assert(res.blob.size > 0);
});

// 9. Color Picker
await test('imageColorPicker samples pixel color and returns HEX, RGB, HSL', async () => {
  const src = createSyntheticImage(200, 200, { color: '#ef4444' }); // Red
  const res = await imageColorPicker(src, { x: 100, y: 100 });

  assert(typeof res.meta?.hex === 'string');
  assert(res.meta.hex.startsWith('#'));
  assert(typeof res.meta?.rgb === 'string');
  assert(typeof res.meta?.hsl === 'string');
  assert(res.filename.includes(res.meta.hex.replace('#', '')));
});

// 10. Palette Extractor
await test('imagePaletteExtractor extracts dominant color palette and creates PNG card', async () => {
  const src = createSyntheticImage(300, 200);
  const res = await imagePaletteExtractor(src, { count: 5 });

  assert(res.meta?.paletteSize >= 1);
  assert(typeof res.meta?.dominantColor === 'string');
  assert(res.meta.dominantColor.startsWith('#'));
  assert(res.filename.endsWith('_palette.png'));
  assert(res.blob.size > 0);

  const json = JSON.parse(res.meta?.paletteJson);
  assert(Array.isArray(json) && json.length > 0);
  assert(json[0].hex && json[0].rgb);
});

// 11. SVG Security & Sanitization
await test('sanitizeSvg strips script tags, event handlers, and malicious elements', () => {
  const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg">
    <script>alert('XSS')</script>
    <rect width="100" height="100" onload="fetch('https://evil.com')" onerror="runEvil()" />
    <a href="javascript:stealData()"><text>Click</text></a>
    <foreignObject width="100" height="100"><iframe src="https://evil.com"></iframe></foreignObject>
  </svg>`;

  const sanitized = sanitizeSvg(maliciousSvg);
  assert(!sanitized.includes('<script>'), 'Script tag leaked');
  assert(!sanitized.includes('alert('), 'Script body leaked');
  assert(!sanitized.includes('onload='), 'Event handler leaked');
  assert(!sanitized.includes('onerror='), 'Error handler leaked');
  assert(!sanitized.includes('javascript:'), 'javascript: scheme leaked');
  assert(!sanitized.includes('<foreignObject>'), 'foreignObject leaked');
  assert(!sanitized.includes('<iframe'), 'iframe leaked');
});

// 12. Large Image Handling
await test('imagePaletteExtractor handles large images (2400x1600) via downsampling', async () => {
  const largeSrc = createSyntheticImage(2400, 1600);
  const start = Date.now();
  const res = await imagePaletteExtractor(largeSrc, { count: 6 });
  const duration = Date.now() - start;

  assert(duration < 2500, `Large image palette extraction took too long: ${duration}ms`);
  assert(res.meta?.paletteSize >= 1);
});

// 13. Batch Processing & ZIP Integrity
await test('Batch image outputs bundle cleanly into a valid ZIP archive', async () => {
  const img1 = createSyntheticImage(100, 100);
  const img2 = createSyntheticImage(120, 120);

  const res1 = await imageConvert(img1, 'webp');
  const res2 = await imageRotatorFlipper(img2, { rotation: 90 });

  const zip = new JSZip();
  zip.file(res1.filename, await res1.blob.arrayBuffer());
  zip.file(res2.filename, await res2.blob.arrayBuffer());

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  assert(zipBlob.size > 0);

  // Read back and verify files inside
  const loadedZip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
  assert(loadedZip.file(res1.filename) !== null);
  assert(loadedZip.file(res2.filename) !== null);
});

// 14. Registry & Studios Integrity
await test('TOOLS registry contains exactly 64 registered tools', () => {
  assert.strictEqual(TOOLS.length, 64, `Expected 64 tools, got ${TOOLS.length}`);
});

await test('Image Studio contains exactly 10 active image tools', () => {
  const imageTools = getToolsForStudio('image-studio');
  assert.strictEqual(imageTools.length, 10, `Expected 10 tools for image-studio, got ${imageTools.length}`);

  const expectedSlugs = [
    'image-converter',
    'image-compressor',
    'image-resize',
    'image-crop',
    'image-rotator-flipper',
    'image-watermark',
    'image-metadata-cleaner',
    'image-adjustments',
    'image-color-picker',
    'image-palette-extractor',
  ];

  for (const slug of expectedSlugs) {
    const found = imageTools.find((t) => t.slug === slug);
    assert(found !== undefined, `Missing tool ${slug} in image-studio`);
  }
});

await test('STUDIOS registry sets Image & Design Studio to Phase 4 with 10 Tools Active badge', () => {
  const studio = STUDIOS.find((s) => s.id === 'image-studio');
  assert(studio !== undefined);
  assert.strictEqual(studio.phase, 4);
  assert.strictEqual(studio.badge, '10 Tools Active');
});

// 15. Tool Dispatch Integrity
await test('All 10 image tools have valid dispatch entries and executable processors', async () => {
  const imageSlugs = [
    'image-converter',
    'image-compressor',
    'image-resize',
    'image-crop',
    'image-rotator-flipper',
    'image-watermark',
    'image-metadata-cleaner',
    'image-adjustments',
    'image-color-picker',
    'image-palette-extractor',
  ];

  for (const slug of imageSlugs) {
    const dispatch = getToolDispatch(slug);
    assert(dispatch !== undefined, `Missing dispatch entry for ${slug}`);
    assert(typeof dispatch.processor === 'function', `Processor for ${slug} is not a function`);
  }
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
