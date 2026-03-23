/**
 * Styled MAIN-1 export using ExcelJS (fills, fonts, borders, merges).
 * Matches Weekly Report reference: purple title, peach metadata, KPI band colors, blue section headers.
 */
import ExcelJS from 'exceljs';
import type { Main1ExportMeta } from './mainDashboardExport';
import type { WeeklyExtraSheetDef } from './mainDashboardWorkbookSheets';

/** 1-based column index → Excel letters (1=A, 27=AA) */
function excelColName(col: number): string {
  let n = col;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

const C = {
  purpleTitle: 'FF9381C1',
  white: 'FFFFFFFF',
  black: 'FF000000',
  peach: 'FFFCE4D6',
  mediumBlue: 'FF4472C4',
  lightBlue: 'FFD9E1F2',
  lightGreen: 'FFE2EFDA',
  lightGrey: 'FFF2F2F2',
};

const thinBorder: ExcelJS.Borders = {
  top: { style: 'thin', color: { argb: C.black } },
  left: { style: 'thin', color: { argb: C.black } },
  bottom: { style: 'thin', color: { argb: C.black } },
  right: { style: 'thin', color: { argb: C.black } },
};

function fillCell(
  cell: ExcelJS.Cell,
  bg: string,
  opts?: { font?: Partial<ExcelJS.Font>; alignment?: Partial<ExcelJS.Alignment>; border?: boolean }
) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  if (opts?.font) cell.font = { ...cell.font, ...opts.font };
  if (opts?.alignment) cell.alignment = { vertical: 'middle', ...opts.alignment };
  if (opts?.border) cell.border = thinBorder;
}

function borderRange(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      ws.getCell(r, c).border = thinBorder;
    }
  }
}

export async function downloadMainDashboardExcelStyled(
  aoa: (string | number)[][],
  meta: Main1ExportMeta,
  filenameBase: string,
  extraSheets: WeeklyExtraSheetDef[] = []
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Inventory Management System';
  const ws = wb.addWorksheet('MAIN-1', {
    views: [{ showGridLines: true }],
  });

  const maxR = aoa.length;
  const maxC = Math.max(...aoa.map((row) => row.length), 20);

  for (let ri = 0; ri < maxR; ri++) {
    const row = aoa[ri] ?? [];
    for (let ci = 0; ci < Math.max(row.length, maxC); ci++) {
      const v = row[ci];
      const cell = ws.getCell(ri + 1, ci + 1);
      cell.value = v === '' || v === undefined ? null : v;
    }
  }

  const m = meta;

  // Row 1: brand merge E:I, purple + white bold centered
  try {
    ws.mergeCells(`E${m.titleRow}:I${m.titleRow}`);
  } catch {
    /* ignore if invalid */
  }
  const titleCell = ws.getCell(m.titleRow, 5);
  fillCell(titleCell, C.purpleTitle, {
    font: { bold: true, color: { argb: C.white }, size: 12 },
    alignment: { horizontal: 'center' },
  });

  // DATE / MARKETPLACE / VERIFIED: label col K (11) peach, value L (12) white + border
  for (const rowNum of [m.titleRow, m.marketplaceRow, m.verifiedRow]) {
    fillCell(ws.getCell(rowNum, 11), C.peach, {
      font: { bold: true },
      border: true,
    });
    fillCell(ws.getCell(rowNum, 12), C.white, { border: true });
  }

  // KPI group row: D-H blue, I-J green, K-N grey
  const g = m.kpiGroupRow;
  for (let c = 4; c <= 8; c++) {
    fillCell(ws.getCell(g, c), C.lightBlue, { font: { bold: true }, alignment: { horizontal: 'center' } });
  }
  for (let c = 9; c <= 10; c++) {
    fillCell(ws.getCell(g, c), C.lightGreen, { font: { bold: true }, alignment: { horizontal: 'center' } });
  }
  for (let c = 11; c <= 14; c++) {
    fillCell(ws.getCell(g, c), C.lightGrey, { font: { bold: true }, alignment: { horizontal: 'center' } });
  }

  // KPI metric headers row: B–N light grey
  const h = m.kpiMetricHeaderRow;
  for (let c = 2; c <= 14; c++) {
    fillCell(ws.getCell(h, c), C.lightGrey, { font: { bold: true } });
  }
  borderRange(ws, h, 2, h, 14);

  // KPI data rows: white + borders
  borderRange(ws, m.kpiDataRow, 2, m.kpiDataRow, 14);
  for (let c = 2; c <= 14; c++) {
    fillCell(ws.getCell(m.kpiDataRow, c), C.white, {});
  }

  // KPI totals row: light grey
  for (let c = 2; c <= 14; c++) {
    fillCell(ws.getCell(m.kpiTotalsRow, c), C.lightGrey, {});
  }
  borderRange(ws, m.kpiTotalsRow, 2, m.kpiTotalsRow, 14);

  // Campaign: header row B–H light blue
  const ch = m.campaignHeaderRow;
  for (let c = 2; c <= 8; c++) {
    fillCell(ws.getCell(ch, c), C.lightBlue, { font: { bold: true } });
  }
  borderRange(ws, ch, 2, ch, 8);

  // Campaign data rows
  if (m.campaignFirstDataRow <= m.campaignLastDataRow) {
    for (let r = m.campaignFirstDataRow; r <= m.campaignLastDataRow; r++) {
      for (let c = 2; c <= 8; c++) {
        fillCell(ws.getCell(r, c), C.white, {});
      }
      borderRange(ws, r, 2, r, 8);
    }
  }

  // Product performance title: merge B..last product col, medium blue
  const pLast = m.productLastCol;
  try {
    ws.mergeCells(`B${m.productTitleRow}:${excelColName(pLast)}${m.productTitleRow}`);
  } catch {
    /* ignore */
  }
  {
    const cell = ws.getCell(m.productTitleRow, 2);
    fillCell(cell, C.mediumBlue, {
      font: { bold: true, color: { argb: C.white } },
      alignment: { horizontal: 'center' },
    });
  }

  // Product header row
  for (let c = 2; c <= pLast; c++) {
    fillCell(ws.getCell(m.productHeaderRow, c), C.lightBlue, { font: { bold: true } });
  }
  borderRange(ws, m.productHeaderRow, 2, m.productHeaderRow, pLast);

  // Product data
  if (m.productFirstDataRow <= m.productLastDataRow) {
    for (let r = m.productFirstDataRow; r <= m.productLastDataRow; r++) {
      for (let c = 2; c <= pLast; c++) {
        fillCell(ws.getCell(r, c), C.white, {});
      }
      borderRange(ws, r, 2, r, pLast);
    }
  }

  // City-wise section
  if (
    m.cityTitleRow != null &&
    m.cityHeaderRow != null &&
    m.cityFirstDataRow != null &&
    m.cityLastDataRow != null &&
    m.cityLastCol != null
  ) {
    const cLast = m.cityLastCol;
    try {
      ws.mergeCells(`B${m.cityTitleRow}:${excelColName(cLast)}${m.cityTitleRow}`);
    } catch {
      /* ignore */
    }
    {
      const cell = ws.getCell(m.cityTitleRow, 2);
      fillCell(cell, C.mediumBlue, {
        font: { bold: true, color: { argb: C.white } },
        alignment: { horizontal: 'center' },
      });
    }

    if (m.citySubRow != null) {
      for (let c = 2; c <= cLast; c++) {
        fillCell(ws.getCell(m.citySubRow, c), C.lightGrey, { font: { bold: true } });
      }
      borderRange(ws, m.citySubRow, 2, m.citySubRow, cLast);
    }

    for (let c = 2; c <= cLast; c++) {
      fillCell(ws.getCell(m.cityHeaderRow, c), C.lightBlue, { font: { bold: true } });
    }
    borderRange(ws, m.cityHeaderRow, 2, m.cityHeaderRow, cLast);

    if (m.cityFirstDataRow <= m.cityLastDataRow) {
      for (let r = m.cityFirstDataRow; r <= m.cityLastDataRow; r++) {
        for (let c = 2; c <= cLast; c++) {
          fillCell(ws.getCell(r, c), C.white, {});
        }
        borderRange(ws, r, 2, r, cLast);
      }
    }

    if (m.grandTotalRow != null) {
      for (let c = 2; c <= cLast; c++) {
        fillCell(ws.getCell(m.grandTotalRow, c), C.lightGrey, { font: { bold: true } });
      }
      borderRange(ws, m.grandTotalRow, 2, m.grandTotalRow, cLast);
    }
  }

  // Column widths (rough)
  ws.columns = Array.from({ length: maxC + 2 }, (_, i) => ({
    width: i === 1 ? 42 : i >= 2 && i <= 14 ? 14 : 12,
  }));

  // --- Additional Weekly Report tabs ---
  for (const sheet of extraSheets) {
    const safeName = sheet.name.substring(0, 31);
    const xws = wb.addWorksheet(safeName, { views: [{ showGridLines: true }] });
    const xr = sheet.aoa.length;
    const xc = Math.max(...sheet.aoa.map((row) => row.length), 1);
    for (let ri = 0; ri < xr; ri++) {
      const row = sheet.aoa[ri] ?? [];
      for (let ci = 0; ci < Math.max(row.length, xc); ci++) {
        const v = row[ci];
        const cell = xws.getCell(ri + 1, ci + 1);
        cell.value = v === '' || v === undefined || v === null ? null : v;
      }
    }
    if (sheet.titleRow != null && sheet.titleText && sheet.titleColStart != null && sheet.titleColEnd != null) {
      const tr = sheet.titleRow;
      const c1 = sheet.titleColStart;
      const c2 = sheet.titleColEnd;
      try {
        if (c2 > c1) {
          xws.mergeCells(`${excelColName(c1)}${tr}:${excelColName(c2)}${tr}`);
        }
      } catch {
        /* ignore */
      }
      const tc = xws.getCell(tr, c1);
      tc.value = sheet.titleText;
      fillCell(tc, C.mediumBlue, {
        font: { bold: true, color: { argb: C.white }, size: 11 },
        alignment: { horizontal: 'center' },
      });
    }
    if (
      sheet.headerRow != null &&
      sheet.headerColStart != null &&
      sheet.headerColEnd != null &&
      sheet.headerColEnd >= sheet.headerColStart
    ) {
      const hr = sheet.headerRow;
      for (let c = sheet.headerColStart; c <= sheet.headerColEnd; c++) {
        fillCell(xws.getCell(hr, c), C.lightBlue, { font: { bold: true } });
      }
      borderRange(xws, hr, sheet.headerColStart, hr, sheet.headerColEnd);
    }
    xws.columns = Array.from({ length: xc + 2 }, () => ({ width: 14 }));
  }

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
