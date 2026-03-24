/**
 * Shared aggregations for Ads Reports UI and Excel export (must stay in sync with charts).
 */
import type { AdsReportRow, AdsSummary } from '../services/api';

export type ChannelSpendRow = { channel: string; spend: number };
export type ChannelRoasRow = { channel: string; spend: number; sales: number; roas: number };
export type ProductAggRow = {
  key: string;
  product: string;
  spend: number;
  sales: number;
  roas: number;
};
export type ProductSalesRow = { key: string; product: string; sales: number };
export type ChannelCtrRow = { channel: string; ctr: number };
export type ChannelCpcRow = { channel: string; cpc: number };
export type CampaignAggRow = {
  campaign: string;
  spend: number;
  sales: number;
  impressions: number;
  clicks: number;
  roas: number;
  ctr: number;
};

/** Pie chart: spend by channel */
export function aggregateChannelSpend(rows: AdsReportRow[]): ChannelSpendRow[] {
  const acc: Record<string, number> = {};
  for (const row of rows) {
    acc[row.channel] = (acc[row.channel] || 0) + row.spend;
  }
  return Object.entries(acc).map(([channel, spend]) => ({ channel, spend }));
}

/** Bar chart: ROAS per channel */
export function aggregateChannelRoas(rows: AdsReportRow[]): ChannelRoasRow[] {
  const acc: Record<string, { spend: number; sales: number }> = {};
  for (const row of rows) {
    if (!acc[row.channel]) acc[row.channel] = { spend: 0, sales: 0 };
    acc[row.channel].spend += row.spend;
    acc[row.channel].sales += row.sales;
  }
  return Object.entries(acc).map(([channel, v]) => ({
    channel,
    spend: v.spend,
    sales: v.sales,
    roas: v.spend > 0 ? v.sales / v.spend : 0,
  }));
}

/** Top N products by ROAS (same keying/sort as UI) */
export function topProductsByRoas(rows: AdsReportRow[], limit = 10): ProductAggRow[] {
  const acc: Record<string, { product: string; spend: number; sales: number }> = {};
  for (const row of rows) {
    const key = row.product_identifier || row.product_name;
    if (!key) continue;
    if (!acc[key]) {
      const label = (row.product_name || row.product_identifier || '').substring(0, 20);
      acc[key] = { product: label, spend: 0, sales: 0 };
    }
    acc[key].spend += row.spend;
    acc[key].sales += row.sales;
  }
  return Object.entries(acc)
    .map(([k, v]) => ({
      key: k,
      product: v.product,
      spend: v.spend,
      sales: v.sales,
      roas: v.spend > 0 ? v.sales / v.spend : 0,
    }))
    .sort((a, b) => b.roas - a.roas)
    .slice(0, limit);
}

/** Top N products by sales */
export function topProductsBySales(rows: AdsReportRow[], limit = 10): ProductSalesRow[] {
  const acc: Record<string, { product: string; sales: number }> = {};
  for (const row of rows) {
    const key = row.product_identifier || row.product_name;
    if (!key) continue;
    if (!acc[key]) {
      const label = (row.product_name || row.product_identifier || '').substring(0, 20);
      acc[key] = { product: label, sales: 0 };
    }
    acc[key].sales += row.sales;
  }
  return Object.entries(acc)
    .map(([k, v]) => ({ key: k, product: v.product, sales: v.sales }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, limit);
}

export function ctrByChannel(rows: AdsReportRow[]): ChannelCtrRow[] {
  const acc: Record<string, { impressions: number; clicks: number }> = {};
  for (const row of rows) {
    if (!acc[row.channel]) acc[row.channel] = { impressions: 0, clicks: 0 };
    acc[row.channel].impressions += row.impressions;
    acc[row.channel].clicks += row.clicks;
  }
  return Object.entries(acc)
    .map(([channel, d]) => ({
      channel,
      ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
    }))
    .sort((a, b) => b.ctr - a.ctr);
}

export function cpcByChannel(rows: AdsReportRow[]): ChannelCpcRow[] {
  const acc: Record<string, { spend: number; clicks: number }> = {};
  for (const row of rows) {
    if (!acc[row.channel]) acc[row.channel] = { spend: 0, clicks: 0 };
    acc[row.channel].spend += row.spend;
    acc[row.channel].clicks += row.clicks;
  }
  return Object.entries(acc)
    .map(([channel, d]) => ({
      channel,
      cpc: d.clicks > 0 ? d.spend / d.clicks : 0,
    }))
    .sort((a, b) => a.cpc - b.cpc);
}

export function topCampaignsBySales(rows: AdsReportRow[], limit = 10): CampaignAggRow[] {
  const acc: Record<string, { spend: number; sales: number; impressions: number; clicks: number }> = {};
  for (const row of rows.filter((r) => r.campaign_name)) {
    const c = row.campaign_name;
    if (!acc[c]) acc[c] = { spend: 0, sales: 0, impressions: 0, clicks: 0 };
    acc[c].spend += row.spend;
    acc[c].sales += row.sales;
    acc[c].impressions += row.impressions;
    acc[c].clicks += row.clicks;
  }
  return Object.entries(acc)
    .map(([campaign, v]) => ({
      campaign,
      spend: v.spend,
      sales: v.sales,
      impressions: v.impressions,
      clicks: v.clicks,
      roas: v.spend > 0 ? v.sales / v.spend : 0,
      ctr: v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0,
    }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, limit);
}

/** Conversion rate shown in Performance Summary card */
export function conversionRateFromSummary(summary: AdsSummary | null): number {
  if (!summary || summary.total_clicks <= 0) return 0;
  return (summary.total_sales / summary.total_clicks) * 100;
}

export function totalSpendForPct(channelSpend: ChannelSpendRow[]): number {
  return channelSpend.reduce((s, r) => s + r.spend, 0);
}
