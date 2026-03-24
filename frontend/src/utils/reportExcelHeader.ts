/**
 * Main Dashboard–style Excel header (purple title E:I, DATE / MARKETPLACE / VERIFIED in K:L).
 * Shared by Ads Analytics, Sales, PO, Inventory styled exports.
 */
import ExcelJS from 'exceljs';

export const MAIN_DASHBOARD_EXCEL = {
  purpleTitle: 'FF9381C1',
  peach: 'FFFCE4D6',
  white: 'FFFFFFFF',
  black: 'FF000000',
} as const;

export const REPORT_EXCEL_THIN_BORDER: ExcelJS.Borders = {
  top: { style: 'thin', color: { argb: MAIN_DASHBOARD_EXCEL.black } },
  left: { style: 'thin', color: { argb: MAIN_DASHBOARD_EXCEL.black } },
  bottom: { style: 'thin', color: { argb: MAIN_DASHBOARD_EXCEL.black } },
  right: { style: 'thin', color: { argb: MAIN_DASHBOARD_EXCEL.black } },
};

/** 1-based column index → Excel letters (1=A) */
export function reportExcelColName(col: number): string {
  let n = col;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

export function fillReportExcelCell(
  cell: ExcelJS.Cell,
  bg: string,
  opts?: { font?: Partial<ExcelJS.Font>; alignment?: Partial<ExcelJS.Alignment>; border?: boolean }
) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  if (opts?.font) cell.font = { ...cell.font, ...opts.font };
  if (opts?.alignment) cell.alignment = { vertical: 'middle', ...opts.alignment };
  if (opts?.border) cell.border = REPORT_EXCEL_THIN_BORDER;
}

export type BuildReportBrandLineInput = {
  titleBrand?: string;
  tenantDisplayName?: string | null;
  marketplaceUpper: string;
  /** When no tenant name: e.g. SALES REPORT, PO REPORT, ADS REPORT */
  fallbackPrefix: string;
};

export function buildReportBrandLine(input: BuildReportBrandLineInput): string {
  const custom = input.titleBrand?.trim();
  if (custom) return custom;
  const tenant = (input.tenantDisplayName || '').trim();
  const mp = input.marketplaceUpper || 'ALL CHANNELS';
  return `${(tenant ? tenant.toUpperCase() : input.fallbackPrefix)} :- ${mp}`;
}

export type MainDashboardExcelHeaderPayload = {
  brandLine: string;
  periodLabel: string;
  marketplaceUpper: string;
};

/**
 * Rows titleRow..titleRow+2: merged title, DATE, MARKETPLACE, VERIFIED (same layout as MAIN-1).
 */
export function applyMainDashboardExcelHeader(
  sheet: ExcelJS.Worksheet,
  titleRow: number,
  payload: MainDashboardExcelHeaderPayload
) {
  const { purpleTitle, peach, white } = MAIN_DASHBOARD_EXCEL;
  const { brandLine, periodLabel, marketplaceUpper } = payload;

  try {
    sheet.mergeCells(`${reportExcelColName(5)}${titleRow}:${reportExcelColName(9)}${titleRow}`);
  } catch {
    /* ignore */
  }
  const titleCell = sheet.getCell(titleRow, 5);
  titleCell.value = brandLine;
  fillReportExcelCell(titleCell, purpleTitle, {
    font: { bold: true, color: { argb: white }, size: 12 },
    alignment: { horizontal: 'center' },
  });

  const r1 = titleRow;
  const r2 = titleRow + 1;
  const r3 = titleRow + 2;
  for (const rowNum of [r1, r2, r3]) {
    fillReportExcelCell(sheet.getCell(rowNum, 11), peach, {
      font: { bold: true },
      border: true,
    });
    fillReportExcelCell(sheet.getCell(rowNum, 12), white, { border: true });
  }
  sheet.getCell(r1, 11).value = 'DATE';
  sheet.getCell(r1, 12).value = periodLabel;
  sheet.getCell(r2, 11).value = 'MARKETPLACE';
  sheet.getCell(r2, 12).value = marketplaceUpper;
  sheet.getCell(r3, 11).value = 'VERIFIED';
  sheet.getCell(r3, 12).value = '';
}
