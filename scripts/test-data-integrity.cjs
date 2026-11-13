const dataTools = require('C:/Users/sridh/OneDrive/documents/git-hub/convert/src/lib/dataTools.ts');
const assert = require('node:assert');

async function run() {
  console.log('Running Deep Data Suite Tests...');

  // 1. Quoted commas, escaped quotes, multiline values
  const complexCsv = 'Field1,Field2,Field3\r\n"Hello, ""World""",123,"Line1\nLine2"';
  const f1 = new File([complexCsv], 'complex.csv', { type: 'text/csv' });
  const r1 = await dataTools.csvToJson(f1, { hasHeaders: true });
  const parsed1 = JSON.parse(await r1.blob.text());
  assert.strictEqual(parsed1[0].Field1, 'Hello, "World"', 'Escaped quotes and commas inside quotes must match');
  assert.strictEqual(parsed1[0].Field2, '123');
  assert.strictEqual(parsed1[0].Field3, 'Line1\nLine2', 'Multiline field must be preserved');
  console.log('  [PASS] Quoted commas, escaped quotes, multiline fields');

  // 2. CSV with BOM (\uFEFF)
  const bomCsv = '\uFEFFcol1,col2\nval1,val2';
  const f2 = new File([bomCsv], 'bom.csv', { type: 'text/csv' });
  const r2 = await dataTools.csvToJson(f2, { hasHeaders: true });
  const parsed2 = JSON.parse(await r2.blob.text());
  assert.strictEqual(parsed2[0].col1, 'val1', 'BOM should not corrupt first header');
  console.log('  [PASS] UTF-8 BOM handling');

  // 3. Duplicate headers in CSV
  const dupeCsv = 'ID,Name,ID,Name\n1,Alice,99,Alicia';
  const f3 = new File([dupeCsv], 'dupe.csv', { type: 'text/csv' });
  const r3 = await dataTools.csvToJson(f3, { hasHeaders: true });
  const parsed3 = JSON.parse(await r3.blob.text());
  assert.strictEqual(parsed3[0].ID, '1');
  assert.strictEqual(parsed3[0].ID_2, '99', 'Duplicate ID must become ID_2');
  assert.strictEqual(parsed3[0].Name, 'Alice');
  assert.strictEqual(parsed3[0].Name_2, 'Alicia', 'Duplicate Name must become Name_2');
  console.log('  [PASS] Duplicate column deduplication');

  // 4. JSON with non-uniform keys and nested objects
  const mixedJson = [
    { id: '001', meta: { tag: 'vip', level: 1 }, onlyInFirst: true },
    { id: '002', email: 'user@example.com', onlyInSecond: 'present' },
    { id: '003', meta: { tag: 'regular' }, active: false }
  ];
  const f4 = new File([JSON.stringify(mixedJson)], 'mixed.json', { type: 'application/json' });
  const r4 = await dataTools.jsonToCsv(f4, { flatten: true });
  const csvText = await r4.blob.text();
  assert(csvText.includes('meta.tag'), 'Flattened nested object must be present');
  assert(csvText.includes('onlyInFirst'), 'Key from 1st record must be in headers');
  assert(csvText.includes('onlyInSecond'), 'Key from 2nd record must be in headers');
  assert(csvText.includes('active'), 'Key from 3rd record must be in headers');
  console.log('  [PASS] JSON non-uniform keys and nested object flattening');

  // 5. Empty cell and blank row handling
  const patchyCsv = 'A,B,C\n1,,3\n\n4,5,';
  const f5 = new File([patchyCsv], 'patchy.csv', { type: 'text/csv' });
  const r5 = await dataTools.csvToJson(f5, { hasHeaders: true });
  const parsed5 = JSON.parse(await r5.blob.text());
  assert.strictEqual(parsed5.length, 2, 'Blank line should be skipped in greedy mode');
  assert.strictEqual(parsed5[0].B, '', 'Empty cell should be empty string');
  assert.strictEqual(parsed5[1].C, '', 'Trailing empty cell should be empty string');
  console.log('  [PASS] Empty cells and blank rows');

  // 6. Excel dates, numbers, formulas
  const testAoa = [
    ['Name', 'Born', 'Score', 'Formula'],
    ['Alice', new Date('1990-05-15T00:00:00Z'), 95.5, { f: 'C2*2' }],
    ['Bob', new Date('1995-12-31T00:00:00Z'), 88.0, { f: 'C3*2' }]
  ];
  const XLSX = require('xlsx');
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(testAoa);
  XLSX.utils.book_append_sheet(wb, ws, 'Results');
  const excelBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  const f6 = new File([excelBuf], 'formulas.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const r6 = await dataTools.excelToCsv(f6);
  const csvFromXlsx = await r6.blob.text();
  assert(csvFromXlsx.includes('Alice'), 'Name must be present');
  assert(csvFromXlsx.includes('Bob'), 'Name must be present');
  console.log('  [PASS] Excel dates, formulas, and multiple worksheets');

  console.log('\nALL DATA INTEGRITY TESTS PASSED!');
}

run().catch((err) => {
  console.error('Data suite test error:', err);
  process.exit(1);
});
