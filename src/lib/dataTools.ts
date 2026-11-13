import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { ProcessorResult } from './processors.ts';
import { ProcessorError, toBlobPart } from './processors.ts';

/**
 * Flatten nested objects into dot-notated key-value pairs
 * e.g. { user: { name: "Alice" } } -> { "user.name": "Alice" }
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else if (Array.isArray(value)) {
      result[newKey] = JSON.stringify(value);
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * Deduplicate CSV headers to ensure no columns are overwritten
 * e.g. ["ID", "Name", "ID"] -> ["ID", "Name", "ID_2"]
 */
function deduplicateHeaders(headers: string[]): string[] {
  const counts: Record<string, number> = {};
  return headers.map((h, idx) => {
    const raw = (h ?? '').trim() || `column_${idx + 1}`;
    counts[raw] = (counts[raw] || 0) + 1;
    if (counts[raw] > 1) {
      return `${raw}_${counts[raw]}`;
    }
    return raw;
  });
}

function excelResult(workbook: XLSX.WorkBook, filename: string, meta?: Record<string, string | number>): ProcessorResult {
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blobPart = bytes instanceof Uint8Array ? toBlobPart(bytes) : bytes;
  const blob = new Blob([blobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  return {
    blob,
    filename,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    meta: {
      outputSize: blob.size,
      ...(meta || {}),
    },
  };
}

// ─────────────────────────────────────────────────────────
// 1. CSV to Excel (High-Integrity, Preserves Leading Zeros)
// ─────────────────────────────────────────────────────────
export async function csvToExcel(
  file: File,
  options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  const rawText = await file.text();
  const text = rawText.replace(/^\uFEFF/, '');
  if (!text.trim()) {
    throw new ProcessorError('The CSV file is empty.', 'EMPTY_DATA');
  }

  const parseResult = Papa.parse<string[]>(text, {
    skipEmptyLines: false,
    dynamicTyping: false,
  });

  if (parseResult.errors && parseResult.errors.length > 0) {
    const critical = parseResult.errors.find((e: any) => e.type === 'Quotes' || e.code === 'UndetectableDelimiter');
    if (critical) {
      throw new ProcessorError(`CSV parsing error on row ${critical.row || 1}: ${critical.message}`, 'CSV_PARSE_ERROR');
    }
  }

  const rawRows = parseResult.data;
  if (!rawRows || rawRows.length === 0) {
    throw new ProcessorError('No tabular data rows could be extracted from the CSV.', 'EMPTY_DATA');
  }

  const preserveLeadingZeros = options.preserveLeadingZeros !== false;
  const aoa: unknown[][] = rawRows.map((row: any[]) => {
    return (row || []).map((cell: any) => {
      if (cell === null || cell === undefined || cell === '') {
        return '';
      }
      const str = String(cell);
      // If string has a leading zero and length > 1 (e.g. "007", "01234"), preserve strictly as string!
      if (preserveLeadingZeros && /^0\d+$/.test(str)) {
        return str;
      }
      // If clean decimal integer or float without leading zero, convert to number
      if (/^-?\d+(\.\d+)?$/.test(str) && !/^0\d+$/.test(str)) {
        const num = Number(str);
        if (!isNaN(num) && isFinite(num)) {
          return num;
        }
      }
      return str;
    });
  });

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const sheetName = (options.sheetName as string) || 'Sheet1';
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const baseName = file.name.replace(/\.(csv|tsv|txt)$/i, '');
  return excelResult(workbook, `${baseName}.xlsx`, {
    rows: aoa.length,
    columns: aoa[0]?.length || 0,
    originalSize: file.size,
  });
}

// ─────────────────────────────────────────────────────────
// 2. Excel to CSV (Multi-sheet aware, UTF-8 BOM for Excel)
// ─────────────────────────────────────────────────────────
export async function excelToCsv(
  file: File,
  options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new ProcessorError('The Excel file is empty.', 'EMPTY_DATA');
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  } catch (err) {
    throw new ProcessorError(`Could not read spreadsheet: ${(err as Error)?.message || 'Unsupported format'}`, 'INVALID_EXCEL');
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new ProcessorError('The Excel workbook contains no worksheets.', 'EMPTY_SHEETS');
  }

  const requestedSheet = options.sheetName as string | undefined;
  const targetSheetName = requestedSheet && workbook.SheetNames.includes(requestedSheet)
    ? requestedSheet
    : workbook.SheetNames[0];

  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet) {
    throw new ProcessorError(`Worksheet "${targetSheetName}" could not be found.`, 'SHEET_NOT_FOUND');
  }

  const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  if (!rawRows || rawRows.length === 0) {
    throw new ProcessorError(`Worksheet "${targetSheetName}" is empty.`, 'EMPTY_DATA');
  }

  // Use Papa.unparse for standard RFC 4180 CSV generation
  const csvContent = Papa.unparse(rawRows, {
    quotes: false,
    quoteChar: '"',
    escapeChar: '"',
    delimiter: ',',
    newline: '\r\n',
  });

  // Prepend UTF-8 Byte Order Mark (\uFEFF) so Excel opens UTF-8/Tamil/international characters without corruption
  const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8' });
  const baseName = file.name.replace(/\.(xlsx?|xlsm|xlsb)$/i, '');

  return {
    blob,
    filename: `${baseName}.csv`,
    mimeType: 'text/csv;charset=utf-8',
    meta: {
      sheetName: targetSheetName,
      availableSheets: workbook.SheetNames.length,
      rows: rawRows.length,
      columns: rawRows[0]?.length || 0,
      originalSize: file.size,
      outputSize: blob.size,
    },
  };
}

// ─────────────────────────────────────────────────────────
// 3. JSON to CSV (Unions all keys, handles nested objects)
// ─────────────────────────────────────────────────────────
export async function jsonToCsv(
  file: File,
  options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  const text = await file.text();
  if (!text.trim()) {
    throw new ProcessorError('The JSON input is empty.', 'EMPTY_DATA');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new ProcessorError(`Invalid JSON syntax: ${(err as Error)?.message || 'Malformed JSON'}`, 'INVALID_JSON');
  }

  let dataArray: Record<string, unknown>[];
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      throw new ProcessorError('JSON array contains zero records.', 'EMPTY_DATA');
    }
    // Check if array of primitives
    if (typeof parsed[0] !== 'object' || parsed[0] === null) {
      dataArray = parsed.map((item, idx) => ({ index: idx + 1, value: item }));
    } else {
      dataArray = parsed as Record<string, unknown>[];
    }
  } else if (typeof parsed === 'object' && parsed !== null) {
    dataArray = [parsed as Record<string, unknown>];
  } else {
    throw new ProcessorError('JSON must be an array of objects or an object.', 'INVALID_JSON_STRUCTURE');
  }

  const shouldFlatten = options.flatten !== false;
  const processedRecords = dataArray.map((row) => {
    return shouldFlatten ? flattenObject(row) : row;
  });

  // Collect the complete union of keys across ALL records so no columns are silently discarded
  const allKeysSet = new Set<string>();
  processedRecords.forEach((row) => {
    Object.keys(row).forEach((k) => allKeysSet.add(k));
  });

  const allHeaders = Array.from(allKeysSet);
  if (allHeaders.length === 0) {
    throw new ProcessorError('No tabular fields or properties found in the JSON records.', 'EMPTY_DATA');
  }

  // Ensure every row contains all headers with clean defaults
  const normalizedRows = processedRecords.map((row) => {
    const fullRow: Record<string, unknown> = {};
    for (const header of allHeaders) {
      const val = row[header];
      if (val === null || val === undefined) {
        fullRow[header] = '';
      } else if (typeof val === 'object') {
        fullRow[header] = JSON.stringify(val);
      } else {
        fullRow[header] = val;
      }
    }
    return fullRow;
  });

  const csvContent = Papa.unparse(normalizedRows, {
    columns: allHeaders,
    quotes: false,
    quoteChar: '"',
    escapeChar: '"',
    delimiter: ',',
    newline: '\r\n',
  });

  const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8' });
  const baseName = file.name.replace(/\.json$/i, '');

  return {
    blob,
    filename: `${baseName}.csv`,
    mimeType: 'text/csv;charset=utf-8',
    meta: {
      rows: normalizedRows.length,
      records: normalizedRows.length,
      columns: allHeaders.length,
      originalSize: file.size,
      outputSize: blob.size,
    },
  };
}

// ─────────────────────────────────────────────────────────
// 4. CSV to JSON (RFC 4180 Compliant, Duplicate Header Protection)
// ─────────────────────────────────────────────────────────
export async function csvToJson(
  file: File,
  options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  const rawText = await file.text();
  const text = rawText.replace(/^\uFEFF/, '');
  if (!text.trim()) {
    throw new ProcessorError('The CSV input is empty.', 'EMPTY_DATA');
  }

  const hasHeaders = options.hasHeaders !== false;
  const parseResult = Papa.parse<string[]>(text, {
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
  });

  if (parseResult.errors && parseResult.errors.length > 0) {
    const critical = parseResult.errors.find((e: any) => e.type === 'Quotes');
    if (critical) {
      throw new ProcessorError(`CSV parsing error on row ${critical.row || 1}: ${critical.message}`, 'CSV_PARSE_ERROR');
    }
  }

  const rows = parseResult.data;
  if (!rows || rows.length === 0) {
    throw new ProcessorError('No rows could be extracted from the CSV.', 'EMPTY_DATA');
  }

  let jsonResult: unknown;
  let finalHeaders: string[] = [];

  if (hasHeaders) {
    if (rows.length < 1) {
      throw new ProcessorError('CSV has header configuration but contains no data lines.', 'EMPTY_DATA');
    }
    finalHeaders = deduplicateHeaders(rows[0]);
    const parseValues = Boolean(options.parseValues);
    const dataRows = rows.slice(1);

    jsonResult = dataRows.map((row: any[]) => {
      const record: Record<string, unknown> = {};
      finalHeaders.forEach((header, idx) => {
        const val = row[idx] ?? '';
        if (parseValues) {
          if (val === 'true') record[header] = true;
          else if (val === 'false') record[header] = false;
          else if (val === 'null') record[header] = null;
          else if (/^-?\d+(\.\d+)?$/.test(val) && !/^0\d+$/.test(val)) {
            const num = Number(val);
            record[header] = isNaN(num) ? val : num;
          } else {
            record[header] = val;
          }
        } else {
          record[header] = val;
        }
      });
      return record;
    });
  } else {
    jsonResult = rows;
  }

  const indent = options.indent === 'compact' ? 0 : Number(options.indent || 2);
  const jsonString = indent > 0
    ? JSON.stringify(jsonResult, null, indent)
    : JSON.stringify(jsonResult);

  const blob = new Blob([jsonString], { type: 'application/json' });
  const baseName = file.name.replace(/\.(csv|tsv|txt)$/i, '');

  return {
    blob,
    filename: `${baseName}.json`,
    mimeType: 'application/json',
    meta: {
      rows: Array.isArray(jsonResult) ? jsonResult.length : 1,
      columns: finalHeaders.length || (rows[0] ? rows[0].length : 0),
      originalSize: file.size,
      outputSize: blob.size,
    },
  };
}
