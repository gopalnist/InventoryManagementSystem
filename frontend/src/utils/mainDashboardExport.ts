import type { MainDashboardData } from '../services/api';
import { exportAlignedTable } from './reportExport';
import type { MainDashboardWorkbookExtras } from './mainDashboardWorkbookSheets';

type ProductRow = MainDashboardData['product_performance'][number];

/** e.g. "1st feb - 28th feb" to match WEEKLY REPORT MAIN-1 */
export function formatMain1Period(start: string, end: string): string {
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  const s = parse(start);
  const e = parse(end);
  const mon = (d: Date) =>
    d
      .toLocaleString('en-GB', { month: 'short' })
      .toLowerCase();
  const dayPart = (d: Date) => {
    const n = d.getDate();
    const ord =
      n === 11 || n === 12 || n === 13
        ? 'th'
        : n % 10 === 1
          ? 'st'
          : n % 10 === 2
            ? 'nd'
            : n % 10 === 3
              ? 'rd'
              : 'th';
    return `${n}${ord}`;
  };
  return `${dayPart(s)} ${mon(s)} - ${dayPart(e)} ${mon(e)}`;
}

function emptyRow(len: number): (string | number)[] {
  return Array(len).fill('');
}

/** Product block: same headers & numeric style as MAIN-1 */
export function buildProductTableMain1(rows: ProductRow[]): (string | number)[][] {
  const header = [
    'Product Name',
    'Category',
    'Subcategory',
    'Sales Contribution',
    'Available Stores',
    'GMV',
    'Stock on Hand',
    'Quantity Sold',
    'Week on Week Growth',
    'Month on Month Growth',
    'View to Order',
  ];
  const body = rows.map((row) => [
    row.product_name || row.product_identifier || '-',
    row.category ?? '',
    row.subcategory ?? '',
    row.sales_contribution_pct,
    row.available_stores ?? '',
    row.gmv,
    row.stock_on_hand ?? '',
    row.quantity_sold,
    row.week_on_week_pct ?? '',
    row.month_on_month_pct ?? '',
    row.view_to_order ?? '',
  ]);
  return [header, ...body];
}

/** Row indices (1-based Excel rows) for applying MAIN-1 styles */
export type Main1ExportMeta = {
  titleRow: number;
  marketplaceRow: number;
  verifiedRow: number;
  kpiGroupRow: number;
  kpiMetricHeaderRow: number;
  kpiDataRow: number;
  kpiTotalsRow: number;
  campaignHeaderRow: number;
  campaignFirstDataRow: number;
  campaignLastDataRow: number;
  productTitleRow: number;
  productHeaderRow: number;
  productFirstDataRow: number;
  productLastDataRow: number;
  productLastCol: number;
  cityTitleRow?: number;
  citySubRow?: number;
  cityHeaderRow?: number;
  cityFirstDataRow?: number;
  cityLastDataRow?: number;
  cityLastCol?: number;
  grandTotalRow?: number;
};

export function buildMain1ExportModel(
  data: MainDashboardData,
  filteredProducts: ProductRow[],
  meta: { startDate: string; endDate: string; channelLabel: string; titleBrand?: string }
): { aoa: (string | number)[][]; meta: Main1ExportMeta } {
  const { ads, organic, overall } = data;
  const periodLabel = formatMain1Period(meta.startDate, meta.endDate);
  const marketplace = (meta.channelLabel || 'ALL').toUpperCase();
  const brandLine =
    meta.titleBrand?.trim() ||
    `WEEKLY REPORT :- ${marketplace}`;

  const W = 25;
  const aoa: (string | number)[][] = [];
  let excelRow = 1;
  const push = (row: (string | number)[]) => {
    aoa.push(row);
    return excelRow++;
  };

  const m = {} as Main1ExportMeta;

  const r1 = emptyRow(W);
  r1[4] = brandLine;
  r1[10] = 'DATE';
  r1[11] = periodLabel;
  m.titleRow = push(r1);

  const r2 = emptyRow(W);
  r2[10] = 'MARKETPLACE';
  r2[11] = marketplace;
  m.marketplaceRow = push(r2);

  const r3 = emptyRow(W);
  r3[10] = 'VERIFIED';
  m.verifiedRow = push(r3);

  push(emptyRow(W));
  push(emptyRow(W));

  const r6 = emptyRow(W);
  r6[2] = 'ADS';
  r6[8] = 'ORGANIC';
  r6[10] = 'OVERALL';
  m.kpiGroupRow = push(r6);

  const h7 = emptyRow(W);
  h7[1] = 'Weeks';
  h7[2] = 'Ad Spend';
  h7[3] = 'Ad Order';
  h7[4] = 'Ads Order Value';
  h7[5] = 'ROAS (Ads)';
  h7[6] = 'Avg Order Value (Ads)';
  h7[7] = 'CPS';
  h7[8] = 'Total Organic Order';
  h7[9] = 'Organic Sale Value';
  h7[10] = 'Total Order';
  h7[11] = 'Total Sale Value';
  h7[12] = 'Avg Order Value (Total)';
  h7[13] = 'ROI (Total)';
  h7[14] = 'CPS (Total)';
  m.kpiMetricHeaderRow = push(h7);

  const v8 = emptyRow(W);
  v8[1] = periodLabel;
  v8[2] = ads.ad_spend;
  v8[3] = ads.ad_order;
  v8[4] = ads.ads_order_value;
  v8[5] = ads.roas;
  v8[6] = ads.avg_order_value;
  v8[7] = ads.cps;
  v8[8] = organic.organic_order;
  v8[9] = organic.organic_sale_value;
  v8[10] = overall.total_order ?? overall.total_units ?? 0;
  v8[11] = overall.total_sale_value;
  v8[12] = overall.avg_order_value;
  v8[13] = overall.roi;
  v8[14] = overall.cps;
  m.kpiDataRow = push(v8);

  for (let i = 0; i < 5; i++) push(emptyRow(W));

  const v14 = emptyRow(W);
  v14[1] = periodLabel;
  v14[2] = ads.ad_spend;
  v14[3] = ads.ad_order;
  v14[4] = ads.ads_order_value;
  v14[5] = ads.roas;
  v14[6] = ads.avg_order_value;
  v14[7] = ads.cps;
  v14[8] = organic.organic_order;
  v14[9] = organic.organic_sale_value;
  v14[10] = overall.total_order ?? overall.total_units ?? 0;
  v14[11] = overall.total_sale_value;
  v14[12] = overall.avg_order_value;
  v14[13] = overall.roi;
  v14[14] = overall.cps;
  m.kpiTotalsRow = push(v14);

  push(emptyRow(W));

  const cHead = emptyRow(W);
  cHead[1] = 'CAMPAIGN TYPE';
  cHead[2] = 'Ad Spend';
  cHead[3] = 'Ad Order';
  cHead[4] = 'Ads Order Value';
  cHead[5] = 'ROAS (Ads)';
  cHead[6] = 'Avg Order Value (Ads)';
  cHead[7] = 'CPS';
  m.campaignHeaderRow = push(cHead);

  m.campaignFirstDataRow = excelRow;
  const defaultTypes = ['SD', 'SP', 'SB'];
  const byType = new Map(
    data.campaign_type_breakdown.map((x) => [String(x.campaign_type).toUpperCase(), x])
  );
  for (const t of defaultTypes) {
    const ct = byType.get(t);
    const cr = emptyRow(W);
    cr[1] = t;
    if (ct) {
      cr[2] = ct.ad_spend;
      cr[3] = ct.ad_order;
      cr[4] = ct.ads_order_value;
      cr[5] = ct.ad_spend === 0 ? '#DIV/0!' : ct.roas;
      cr[6] = ct.ad_order === 0 ? '#DIV/0!' : ct.avg_order_value;
      cr[7] = ct.ad_order === 0 ? '#DIV/0!' : ct.cps;
    } else {
      cr[2] = 0;
      cr[3] = 0;
      cr[4] = 0;
      cr[5] = '#DIV/0!';
      cr[6] = '#DIV/0!';
      cr[7] = '#DIV/0!';
    }
    push(cr);
  }

  for (const ct of data.campaign_type_breakdown) {
    const key = String(ct.campaign_type).toUpperCase();
    if (defaultTypes.includes(key)) continue;
    const cr = emptyRow(W);
    cr[1] = ct.campaign_type;
    cr[2] = ct.ad_spend;
    cr[3] = ct.ad_order;
    cr[4] = ct.ads_order_value;
    cr[5] = ct.ad_spend === 0 ? '#DIV/0!' : ct.roas;
    cr[6] = ct.ad_order === 0 ? '#DIV/0!' : ct.avg_order_value;
    cr[7] = ct.ad_order === 0 ? '#DIV/0!' : ct.cps;
    push(cr);
  }
  m.campaignLastDataRow = excelRow - 1;

  push(emptyRow(W));
  push(emptyRow(W));
  push(emptyRow(W));
  push(emptyRow(W));

  const perfTitle = emptyRow(W);
  perfTitle[1] = 'OVERALL PRODUCT PERFORMANCE ';
  m.productTitleRow = push(perfTitle);

  const prodTable = buildProductTableMain1(filteredProducts);
  m.productLastCol = 12;
  m.productHeaderRow = excelRow;
  {
    const headerRow = emptyRow(Math.max(W, 14));
    prodTable[0].forEach((cell, i) => {
      headerRow[1 + i] = cell;
    });
    push(headerRow);
  }
  m.productFirstDataRow = excelRow;
  for (let pi = 1; pi < prodTable.length; pi++) {
    const line = prodTable[pi];
    const pr = emptyRow(Math.max(W, line.length + 2));
    line.forEach((cell, i) => {
      pr[1 + i] = cell;
    });
    push(pr);
  }
  m.productLastDataRow =
    prodTable.length <= 1 ? m.productHeaderRow : excelRow - 1;

  const { cities, rows: cityRows } = data.city_wise_sale;
  if (cities.length && cityRows.length) {
    const Cw = Math.max(W, 2 + cities.length);
    push(emptyRow(Cw), emptyRow(Cw), emptyRow(Cw));

    const ct = emptyRow(Cw);
    ct[1] = 'TOTAL-CITY-WISE SALE';
    m.cityTitleRow = push(ct);

    const sumRow = emptyRow(Cw);
    sumRow[1] = 'SUM of Sales (Qty) - Units';
    sumRow[2] = 'City';
    m.citySubRow = push(sumRow);

    const skuHead = emptyRow(Cw);
    skuHead[1] = 'SKU Name';
    cities.forEach((city, i) => {
      skuHead[2 + i] = city;
    });
    m.cityHeaderRow = push(skuHead);
    m.cityLastCol = 2 + cities.length;

    m.cityFirstDataRow = excelRow;
    for (const r of cityRows) {
      const dr = emptyRow(Cw);
      dr[1] = (r.product_name as string) || (r.product_identifier as string) || '-';
      cities.forEach((city, i) => {
        const v = r[city];
        dr[2 + i] = typeof v === 'number' ? v : Number(v) || '';
      });
      push(dr);
    }
    m.cityLastDataRow = excelRow - 1;

    const totals = cities.map((city) =>
      cityRows.reduce((sum, r) => sum + (Number(r[city]) || 0), 0)
    );
    const gt = emptyRow(Cw);
    gt[1] = 'Grand Total';
    totals.forEach((t, i) => {
      gt[2 + i] = t;
    });
    m.grandTotalRow = push(gt);
  }

  return { aoa, meta: m };
}

/** @deprecated use buildMain1ExportModel().aoa */
export function buildWeeklyReportMain1Aoa(
  data: MainDashboardData,
  filteredProducts: ProductRow[],
  meta: { startDate: string; endDate: string; channelLabel: string; titleBrand?: string }
): (string | number)[][] {
  return buildMain1ExportModel(data, filteredProducts, meta).aoa;
}

export async function downloadMainDashboardExcel(
  data: MainDashboardData,
  filteredProducts: ProductRow[],
  meta: { startDate: string; endDate: string; channelLabel: string; titleBrand?: string },
  filenameBase: string,
  workbookExtras?: MainDashboardWorkbookExtras
): Promise<void> {
  const { aoa, meta: exportMeta } = buildMain1ExportModel(data, filteredProducts, meta);
  const { downloadMainDashboardExcelStyled } = await import('./mainDashboardExcelStyled');
  const { buildAllWeeklyExtraSheets } = await import('./mainDashboardWorkbookSheets');
  const extraSheets = buildAllWeeklyExtraSheets(workbookExtras);
  await downloadMainDashboardExcelStyled(aoa, exportMeta, filenameBase, extraSheets);
}

/** CSV = Overall Product Performance only, MAIN-1 column names & numeric style */
export function downloadMainDashboardProductCsv(
  filteredProducts: ProductRow[],
  filenameBase: string
): void {
  const aoa = buildProductTableMain1(filteredProducts);
  const headers = aoa[0] as string[];
  const dataRows = aoa.slice(1) as (string | number)[][];
  exportAlignedTable(headers, dataRows, filenameBase, 'csv', 'MAIN-1 Products');
}
