import * as XLSX from 'xlsx';
import type { ProcessorResult } from './processors';
import { ProcessorError, toBlobPart } from './processors';

function excelResult(workbook: XLSX.WorkBook, filename: string): ProcessorResult {
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blobPart = bytes instanceof Uint8Array ? toBlobPart(bytes) : bytes;
  return {
    blob: new Blob([blobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

export async function csvToExcel(file: File): Promise<ProcessorResult> {
  const workbook = XLSX.read(await file.text(), { type: 'string' });
  return excelResult(workbook, file.name.replace(/\.csv$/i, '') + '.xlsx');
}

export async function excelToCsv(file: File): Promise<ProcessorResult> {
  const workbook = XLSX.read(await file.arrayBuffer());
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new ProcessorError('The workbook has no worksheets.');
  const csv = XLSX.utils.sheet_to_csv(sheet);
  return {
    blob: new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    filename: file.name.replace(/\.(xlsx?|xlsm)$/i, '') + '.csv',
    mimeType: 'text/csv',
  };
}
