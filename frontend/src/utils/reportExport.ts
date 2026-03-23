import * as XLSX from 'xlsx';

/** Match table date display (en-IN, same as report pages) */
export function formatReportDate(d: string | undefined | null): string {
  if (!d) return '-';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '-';
  return x.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Match Tailwind `capitalize` + underscore → space for channel / ad source */
export function formatChannelLabel(channel: string | undefined): string {
  if (!channel) return '-';
  return channel
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function escapeCsvCell(val: unknown): string {
  if (val == null || val === '') return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Export data in the same column order and human-readable values as the UI table.
 * First row = headers; following rows = cell values (strings/numbers as shown on screen).
 */
export function exportAlignedTable(
  headers: string[],
  dataRows: (string | number)[][],
  filenameBase: string,
  format: 'csv' | 'xlsx',
  sheetName: string
): void {
  if (!headers.length) return;
  const aoa: (string | number)[][] = [headers, ...dataRows];

  if (format === 'csv') {
    const lines = aoa.map((row) => row.map((cell) => escapeCsvCell(cell)).join(','));
    const csv = '\ufeff' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameBase}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map((h) => ({ wch: Math.min(Math.max(String(h).length, 12), 40) }));
  const wb = XLSX.utils.book_new();
  const safeSheet = sheetName.replace(/[\\/?*[\]]/g, '_').slice(0, 31) || 'Sheet1';
  XLSX.utils.book_append_sheet(wb, ws, safeSheet);
  XLSX.writeFile(wb, `${filenameBase}.xlsx`);
}

/** Legacy: raw object keys (order not guaranteed to match UI) */
export function downloadReportCsv(rows: Record<string, unknown>[], filenameBase: string): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escapeCsvCell(row[h])).join(',')),
  ];
  const csv = '\ufeff' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameBase}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadReportXlsx(
  rows: Record<string, unknown>[],
  sheetName: string,
  filenameBase: string
): void {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  const safeSheet = sheetName.replace(/[\\/?*[\]]/g, '_').slice(0, 31) || 'Sheet1';
  XLSX.utils.book_append_sheet(wb, ws, safeSheet);
  XLSX.writeFile(wb, `${filenameBase}.xlsx`);
}

export function rowsAsRecords<T extends object>(rows: T[]): Record<string, unknown>[] {
  return rows.map((r) => ({ ...r })) as Record<string, unknown>[];
}

export type MultiSheetAoa = { name: string; aoa: (string | number)[][] };

/** One .xlsx file with multiple worksheets (e.g. Main Dashboard sections). */
export function exportMultiSheetWorkbook(sheets: MultiSheetAoa[], filenameBase: string): void {
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  for (const { name, aoa } of sheets) {
    if (!aoa.length) continue;
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const maxCols = Math.max(...aoa.map((r) => r.length), 1);
    ws['!cols'] = Array.from({ length: maxCols }, (_, i) => {
      let maxLen = 10;
      for (const r of aoa) {
        const len = String(r[i] ?? '').length;
        if (len > maxLen) maxLen = len;
      }
      return { wch: Math.min(48, maxLen) };
    });
    let safe = name.replace(/[\\/?*[\]]/g, '_').slice(0, 31) || 'Sheet';
    let n = 0;
    while (usedNames.has(safe)) {
      n += 1;
      safe = `${name.slice(0, 28)}_${n}`.replace(/[\\/?*[\]]/g, '_');
    }
    usedNames.add(safe);
    XLSX.utils.book_append_sheet(wb, ws, safe);
  }
  if (!wb.SheetNames.length) return;
  XLSX.writeFile(wb, `${filenameBase}.xlsx`);
}
