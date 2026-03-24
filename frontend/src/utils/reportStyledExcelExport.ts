/**
 * Single-sheet aligned table export with Main Dashboard–style header (ExcelJS).
 */
import ExcelJS from 'exceljs';
import {
  applyMainDashboardExcelHeader,
  buildReportBrandLine,
  REPORT_EXCEL_THIN_BORDER,
} from './reportExcelHeader';

const SECTION_HEADER_BG = 'FFD9E1F2';

export type StyledAlignedReportExcelOptions = {
  headers: string[];
  dataRows: (string | number)[][];
  filenameBase: string;
  sheetName: string;
  periodLabel: string;
  marketplaceUpper: string;
  titleBrand?: string;
  tenantDisplayName?: string | null;
  fallbackPrefix: string;
};

const TABLE_START_ROW = 6;

export async function downloadStyledAlignedReportExcel(
  opts: StyledAlignedReportExcelOptions
): Promise<void> {
  const {
    headers,
    dataRows,
    filenameBase,
    sheetName,
    periodLabel,
    marketplaceUpper,
    titleBrand,
    tenantDisplayName,
    fallbackPrefix,
  } = opts;

  if (!headers.length) return;

  const brandLine = buildReportBrandLine({
    titleBrand,
    tenantDisplayName,
    marketplaceUpper,
    fallbackPrefix,
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Inventory Management System';
  const safeName = sheetName.replace(/[\\/?*[\]]/g, '_').slice(0, 31) || 'Report';
  const ws = wb.addWorksheet(safeName, { views: [{ showGridLines: true }] });

  applyMainDashboardExcelHeader(ws, 1, {
    brandLine,
    periodLabel,
    marketplaceUpper,
  });

  const maxCols = Math.max(headers.length, 12);
  const hr = TABLE_START_ROW;
  headers.forEach((h, i) => {
    const c = ws.getCell(hr, i + 1);
    c.value = h;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SECTION_HEADER_BG } };
    c.font = { bold: true };
    c.border = REPORT_EXCEL_THIN_BORDER;
  });

  dataRows.forEach((row, ri) => {
    const r = hr + 1 + ri;
    for (let ci = 0; ci < Math.max(row.length, headers.length); ci++) {
      const cell = ws.getCell(r, ci + 1);
      const v = row[ci];
      cell.value = v === '' || v === undefined ? null : v;
      cell.border = REPORT_EXCEL_THIN_BORDER;
    }
  });

  ws.columns = Array.from({ length: maxCols }, (_, i) => {
    let w = 14;
    const label = String(headers[i] ?? '');
    if (label.length > 20 || /product|campaign|name|location/i.test(label)) w = 28;
    if (/date|sku|id/i.test(label)) w = 14;
    return { width: w };
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameBase}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export {
  MAIN_DASHBOARD_EXCEL,
  fillReportExcelCell,
  reportExcelColName,
  REPORT_EXCEL_THIN_BORDER,
} from './reportExcelHeader';
