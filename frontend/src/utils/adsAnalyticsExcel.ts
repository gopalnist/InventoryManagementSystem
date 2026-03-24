/**
 * Styled Excel export mirroring Ads Reports / Ads Analytics UI (summary, channel, top products, campaigns).
 */
import ExcelJS from 'exceljs';
import type { AdsReportRow, AdsSummary } from '../services/api';
import { formatReportDate, formatChannelLabel } from './reportExport';
import {
  aggregateChannelSpend,
  aggregateChannelRoas,
  topProductsByRoas,
  topProductsBySales,
  ctrByChannel,
  cpcByChannel,
  topCampaignsBySales,
  conversionRateFromSummary,
  totalSpendForPct,
} from './adsAnalyticsAggregates';
import {
  applyMainDashboardExcelHeader,
  buildReportBrandLine,
  reportExcelColName,
  REPORT_EXCEL_THIN_BORDER,
} from './reportExcelHeader';

const C = {
  sectionBg: 'FFD9E1F2',
  sectionPurple: 'FFE9D5FF',
  sectionGreen: 'FFD1FAE5',
  sectionBlue: 'FFDBEAFE',
  white: 'FFFFFFFF',
};

function inrFmt(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type AdsAnalyticsExcelMeta = {
  /** Shown in DATE column (e.g. date range) */
  periodLabel: string;
  /** Display ad source filter label */
  adSourceLabel: string;
  /** Uppercase marketplace line (e.g. BIGBASKET, ZEPTO, ALL SOURCES) — same as MARKETPLACE row */
  marketplaceUpper: string;
  filenameBase: string;
  /** Optional full first-row title (e.g. NOURISHYOU :- BIGBASKET). Overrides auto title. */
  titleBrand?: string;
  /** Logged-in tenant name — used for default title `{TENANT} :- {marketplaceUpper}` */
  tenantDisplayName?: string | null;
};

export async function downloadAdsAnalyticsExcel(
  allAdsData: AdsReportRow[],
  summary: AdsSummary | null,
  meta: AdsAnalyticsExcelMeta
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Inventory Management System';

  const ws = wb.addWorksheet('Ads Analytics', { views: [{ showGridLines: true }] });

  const maxCol = 14;
  const marketplaceUpper = meta.marketplaceUpper || (meta.adSourceLabel || 'ALL SOURCES').toUpperCase();
  const brandLine = buildReportBrandLine({
    titleBrand: meta.titleBrand,
    tenantDisplayName: meta.tenantDisplayName,
    marketplaceUpper,
    fallbackPrefix: 'ADS REPORT',
  });

  const headerPayload = {
    brandLine,
    periodLabel: meta.periodLabel,
    marketplaceUpper,
  };
  applyMainDashboardExcelHeader(ws, 1, headerPayload);
  let row = 6;

  const sectionHeader = (r: number, text: string, bg = C.sectionBg) => {
    try {
      ws.mergeCells(`${reportExcelColName(1)}${r}:${reportExcelColName(maxCol)}${r}`);
    } catch {
      /* ignore */
    }
    const cell = ws.getCell(r, 1);
    cell.value = text;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    cell.font = { bold: true, size: 12, color: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cell.border = REPORT_EXCEL_THIN_BORDER;
  };

  const dataHeader = (r: number, labels: string[]) => {
    labels.forEach((lab, i) => {
      const c = ws.getCell(r, i + 1);
      c.value = lab;
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.sectionBg } };
      c.font = { bold: true };
      c.border = REPORT_EXCEL_THIN_BORDER;
    });
  };

  const dataRow = (r: number, values: (string | number)[], bold = false) => {
    values.forEach((v, i) => {
      const c = ws.getCell(r, i + 1);
      c.value = v;
      c.border = REPORT_EXCEL_THIN_BORDER;
      if (bold) c.font = { bold: true };
    });
  };

  // —— Summary KPIs (same numbers as dashboard cards) ——
  sectionHeader(row, 'Summary');
  row += 1;
  if (summary) {
    dataRow(row, ['Total Impressions', summary.total_impressions], true);
    row += 1;
    dataRow(row, ['Total Clicks', summary.total_clicks, `CTR: ${summary.overall_ctr.toFixed(2)}%`]);
    row += 1;
    dataRow(row, ['Total Spend', inrFmt(summary.total_spend)], true);
    row += 1;
    dataRow(row, ['Total Sales', inrFmt(summary.total_sales)], true);
    row += 1;
    dataRow(row, ['Overall ROAS', `${summary.overall_roas.toFixed(2)}x`, `${summary.total_campaigns} campaigns`]);
    row += 1;
  } else {
    dataRow(row, ['No summary available'], true);
    row += 1;
  }
  row += 1;

  const channelSpend = aggregateChannelSpend(allAdsData);
  const spendTotal = totalSpendForPct(channelSpend);

  sectionHeader(row, 'Ad Spend by Channel (same as pie chart data)');
  row += 1;
  dataHeader(row, ['Channel', 'Spend (₹)', 'Share %']);
  row += 1;
  for (const ch of channelSpend.sort((a, b) => b.spend - a.spend)) {
    const pct = spendTotal > 0 ? (ch.spend / spendTotal) * 100 : 0;
    dataRow(row, [formatChannelLabel(ch.channel), ch.spend, Number(pct.toFixed(2))]);
    ws.getCell(row, 2).numFmt = '#,##0.00';
    ws.getCell(row, 3).numFmt = '0.00';
    row += 1;
  }
  row += 1;

  sectionHeader(row, 'ROAS Distribution by Channel');
  row += 1;
  dataHeader(row, ['Channel', 'Spend (₹)', 'Sales (₹)', 'ROAS']);
  row += 1;
  for (const ch of aggregateChannelRoas(allAdsData).sort((a, b) => b.roas - a.roas)) {
    dataRow(row, [formatChannelLabel(ch.channel), ch.spend, ch.sales, Number(ch.roas.toFixed(4))]);
    ws.getCell(row, 2).numFmt = '#,##0.00';
    ws.getCell(row, 3).numFmt = '#,##0.00';
    ws.getCell(row, 4).numFmt = '0.00';
    row += 1;
  }
  row += 1;

  sectionHeader(row, 'Top 10 Products by ROAS', C.sectionPurple);
  row += 1;
  dataHeader(row, ['#', 'Product (label as in chart)', 'Spend (₹)', 'Sales (₹)', 'ROAS']);
  row += 1;
  topProductsByRoas(allAdsData, 10).forEach((p, i) => {
    dataRow(row, [i + 1, p.product, p.spend, p.sales, Number(p.roas.toFixed(4))]);
    ws.getCell(row, 3).numFmt = '#,##0.00';
    ws.getCell(row, 4).numFmt = '#,##0.00';
    ws.getCell(row, 5).numFmt = '0.00';
    row += 1;
  });
  row += 1;

  sectionHeader(row, 'Top 10 Products by Sales', C.sectionGreen);
  row += 1;
  dataHeader(row, ['#', 'Product (label as in chart)', 'Sales (₹)']);
  row += 1;
  topProductsBySales(allAdsData, 10).forEach((p, i) => {
    dataRow(row, [i + 1, p.product, p.sales]);
    ws.getCell(row, 3).numFmt = '#,##0.00';
    row += 1;
  });
  row += 1;

  sectionHeader(row, 'CTR by Channel', C.sectionBlue);
  row += 1;
  dataHeader(row, ['Channel', 'CTR %']);
  row += 1;
  for (const x of ctrByChannel(allAdsData)) {
    dataRow(row, [formatChannelLabel(x.channel), Number(x.ctr.toFixed(4))]);
    ws.getCell(row, 2).numFmt = '0.00';
    row += 1;
  }
  row += 1;

  sectionHeader(row, 'Cost per Click (CPC) by Channel', C.sectionBlue);
  row += 1;
  dataHeader(row, ['Channel', 'CPC (₹)']);
  row += 1;
  for (const x of cpcByChannel(allAdsData)) {
    dataRow(row, [formatChannelLabel(x.channel), Number(x.cpc.toFixed(4))]);
    ws.getCell(row, 2).numFmt = '#,##0.00';
    row += 1;
  }
  row += 1;

  sectionHeader(row, 'Performance Summary');
  row += 1;
  if (summary) {
    dataRow(row, ['Avg Revenue / Click', inrFmt(summary.avg_revenue_per_click)]);
    row += 1;
    dataRow(row, ['Total Products', summary.total_products]);
    row += 1;
    dataRow(row, ['Total Campaigns', summary.total_campaigns]);
    row += 1;
    dataRow(row, ['Conversion Rate (sales ÷ clicks)', `${conversionRateFromSummary(summary).toFixed(2)}%`]);
    row += 1;
  }
  row += 1;

  const campaigns = topCampaignsBySales(allAdsData, 10);
  if (campaigns.length > 0) {
    sectionHeader(row, 'Top 10 Campaigns by Sales');
    row += 1;
    dataHeader(row, ['Campaign', 'Spend (₹)', 'Sales (₹)', 'Impressions', 'Clicks', 'ROAS', 'CTR %']);
    row += 1;
    for (const c of campaigns) {
      dataRow(row, [
        c.campaign,
        c.spend,
        c.sales,
        c.impressions,
        c.clicks,
        Number(c.roas.toFixed(4)),
        Number(c.ctr.toFixed(4)),
      ]);
      ws.getCell(row, 2).numFmt = '#,##0.00';
      ws.getCell(row, 3).numFmt = '#,##0.00';
      ws.getCell(row, 6).numFmt = '0.00';
      ws.getCell(row, 7).numFmt = '0.00';
      row += 1;
    }
  }

  ws.columns = Array.from({ length: 14 }, (_, i) => ({
    width: i === 0 ? 36 : i < 4 ? 16 : i < 8 ? 14 : 12,
  }));

  // —— Detail sheet ——
  const detail = wb.addWorksheet('Detail data', { views: [{ showGridLines: true }] });
  const dh = [
    'Date',
    'Ad Source',
    'Campaign',
    'Product',
    'Impressions',
    'Clicks',
    'Spend',
    'Sales',
    'ROAS',
  ];
  applyMainDashboardExcelHeader(detail, 1, headerPayload);
  const detailTableStart = 6;
  dh.forEach((h, i) => {
    const c = detail.getCell(detailTableStart, i + 1);
    c.value = h;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.sectionBg } };
    c.font = { bold: true };
    c.border = REPORT_EXCEL_THIN_BORDER;
  });
  allAdsData.forEach((rec, ri) => {
    const r = detailTableStart + 1 + ri;
    detail.getCell(r, 1).value = rec.date ? formatReportDate(rec.date) : '';
    detail.getCell(r, 2).value = formatChannelLabel(rec.channel);
    detail.getCell(r, 3).value = rec.campaign_name || '';
    detail.getCell(r, 4).value = rec.product_name || rec.product_identifier || '';
    detail.getCell(r, 5).value = rec.impressions;
    detail.getCell(r, 6).value = rec.clicks;
    detail.getCell(r, 7).value = rec.spend;
    detail.getCell(r, 8).value = rec.sales;
    detail.getCell(r, 9).value = rec.roas;
    detail.getCell(r, 7).numFmt = '#,##0.00';
    detail.getCell(r, 8).numFmt = '#,##0.00';
    detail.getCell(r, 9).numFmt = '0.00';
    for (let c = 1; c <= 9; c++) detail.getCell(r, c).border = REPORT_EXCEL_THIN_BORDER;
  });
  detail.columns = [
    { width: 12 },
    { width: 18 },
    { width: 32 },
    { width: 36 },
    { width: 12 },
    { width: 10 },
    { width: 14 },
    { width: 14 },
    { width: 10 },
  ];

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${meta.filenameBase}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
