/**
 * Build extra worksheets (Weekly Report tabs) from GET /main-dashboard/workbook-data.
 */

export interface MainDashboardWorkbookExtras {
  header?: { channel: string; start_date: string | null; end_date: string | null; batch_tag?: string | null };
  ad_city_level: AdCityRow[];
  ad_category_performance: AdCategoryRow[];
  ad_sp_product: AdProductRow[];
  ad_sb_product: AdProductRow[];
  ad_sd_product: AdProductRow[];
  total_city_wise_sale_detail: TotalCitySaleRow[];
}

export interface AdCityRow {
  campaign_type: string;
  city_name: string;
  brand_id: string;
  brand_name: string;
  atc: number;
  clicks: number;
  cpc: number;
  cpm: number;
  impressions: number;
  orders: number;
  other_skus: number;
  revenue: number;
  roas: number;
  robas: number;
  same_skus: number;
  spend: number;
}

export interface AdCategoryRow {
  campaign_type: string;
  brand_id: string;
  brand_name: string;
  atc: number;
  campaign_id: string | number;
  campaign_name: string;
  category: string;
  clicks: number;
  cpm: number;
  impressions: number;
  orders: number;
  other_skus: number;
  revenue: number;
  roas: number;
  robas: number;
  same_skus: number;
}

export interface AdProductRow {
  product_identifier: string;
  product_name: string;
  brand_id: string;
  brand_name: string;
  atc: number;
  campaign_id: string | number;
  campaign_name: string;
  category: string;
  clicks: number;
  cpc: number;
  cpm: number;
  ctr: number;
  impressions: number;
  orders: number;
  other_skus: number;
  revenue: number;
  roas: number;
  robas?: number;
  spend: number;
}

export interface TotalCitySaleRow {
  report_date: string;
  sku_number: string;
  sku_name: string;
  ean: string;
  sku_category: string;
  sku_sub_category: string;
  brand_name: string;
  manufacturer_name: string;
  manufacturer_id: string;
  city: string;
  quantity: number;
  mrp: number | null;
  gmv: number | null;
}

export type WeeklyExtraSheetDef = {
  name: string;
  aoa: (string | number | null)[][];
  /** 1-based Excel row of column headers */
  headerRow?: number;
  /** 1-based first column for header fill (inclusive) */
  headerColStart?: number;
  /** 1-based last column for header fill (inclusive) */
  headerColEnd?: number;
  /** Optional title row (merged blue bar) */
  titleRow?: number;
  titleColStart?: number;
  titleColEnd?: number;
  titleText?: string;
};

function padRow(row: (string | number | null)[], len: number): (string | number | null)[] {
  const out = row.slice();
  while (out.length < len) out.push('');
  return out;
}

const EMPTY = (n: number) => Array(n).fill('') as (string | number | null)[];

/** AD-CITY LEVEL DATA — row1 matches reference (type in A, headers from C). */
export function buildAdCitySheet(rows: AdCityRow[]): { name: string; def: WeeklyExtraSheetDef } {
  const headers = [
    'SP',
    '',
    'CityName',
    'BrandID',
    'BrandName',
    'Atc',
    'Clicks',
    'Cpc',
    'Cpm',
    'Impressions',
    'Orders',
    'Other_skus',
    'Revenue',
    'Roas',
    'Robas',
    'Same_skus',
    'Spend',
  ];
  const W = headers.length;
  const aoa: (string | number | null)[][] = [padRow(headers, W)];
  for (const r of rows || []) {
    aoa.push(
      padRow(
        [
          '',
          '',
          r.city_name,
          r.brand_id,
          r.brand_name,
          r.atc,
          r.clicks,
          r.cpc,
          r.cpm,
          r.impressions,
          r.orders,
          r.other_skus,
          r.revenue,
          r.roas,
          r.robas,
          r.same_skus,
          r.spend,
        ],
        W
      )
    );
  }
  return {
    name: 'AD-CITY LEVEL DATA',
    def: {
      name: 'AD-CITY LEVEL DATA',
      aoa,
      headerRow: 1,
      headerColStart: 3,
      headerColEnd: W,
    },
  };
}

/** AD-CATEGORY PERFORMANCE */
export function buildAdCategorySheet(rows: AdCategoryRow[]): { name: string; def: WeeklyExtraSheetDef } {
  const headers = [
    'SB',
    '',
    'BrandID',
    'BrandName',
    'Atc',
    'Campaign_id',
    'Campaign_name',
    'Category',
    'Clicks',
    'Cpm',
    'Impressions',
    'Orders',
    'Other_skus',
    'Revenue',
    'Roas',
    'Robas',
    'Same_skus',
  ];
  const W = headers.length;
  const aoa: (string | number | null)[][] = [padRow(headers, W)];
  for (const r of rows || []) {
    aoa.push(
      padRow(
        [
          '',
          '',
          r.brand_id,
          r.brand_name,
          r.atc,
          r.campaign_id,
          r.campaign_name,
          r.category,
          r.clicks,
          r.cpm,
          r.impressions,
          r.orders,
          r.other_skus,
          r.revenue,
          r.roas,
          r.robas,
          r.same_skus,
        ],
        W
      )
    );
  }
  return {
    name: 'AD-CATEGORY PERFORMANCE',
    def: {
      name: 'AD-CATEGORY PERFORMANCE',
      aoa,
      headerRow: 1,
      headerColStart: 3,
      headerColEnd: W,
    },
  };
}

const SP_HEAD = [
  'ProductID',
  'ProductName',
  'BrandID',
  'BrandName',
  'Atc',
  'Campaign_id',
  'Campaign_name',
  'Category',
  'Clicks',
  'Cpc',
  'Cpm',
  'Ctr',
  'Impressions',
  'Orders',
  'Other_skus',
  'Revenue',
];

const SB_HEAD = [
  'ProductID',
  'ProductName',
  'BrandID',
  'BrandName',
  'Atc',
  'Campaign_id',
  'Campaign_name',
  'Category',
  'Clicks',
  'Cpm',
  'Ctr',
  'Impressions',
  'Orders',
  'Other_skus',
  'Revenue',
  'Roas',
  'Robas',
];

function buildSpProductAoa(rows: AdProductRow[]): (string | number | null)[][] {
  const W = 18;
  const aoa: (string | number | null)[][] = [EMPTY(W), EMPTY(W)];
  const title = EMPTY(W);
  title[8] = 'PRODUCT PERFORMANCE';
  aoa.push(title);
  const hdr = EMPTY(W);
  SP_HEAD.forEach((h, i) => {
    hdr[1 + i] = h;
  });
  aoa.push(hdr);
  for (const r of rows || []) {
    const line = EMPTY(W);
    const vals = [
      r.product_identifier,
      r.product_name,
      r.brand_id,
      r.brand_name,
      r.atc,
      r.campaign_id,
      r.campaign_name,
      r.category,
      r.clicks,
      r.cpc,
      r.cpm,
      r.ctr,
      r.impressions,
      r.orders,
      r.other_skus,
      r.revenue,
    ];
    vals.forEach((v, i) => {
      line[1 + i] = v;
    });
    aoa.push(line);
  }
  return aoa;
}

function buildSbSdProductAoa(rows: AdProductRow[]): (string | number | null)[][] {
  const W = 19;
  const aoa: (string | number | null)[][] = [EMPTY(W), EMPTY(W), EMPTY(W), EMPTY(W)];
  const hdr = EMPTY(W);
  SB_HEAD.forEach((h, i) => {
    hdr[1 + i] = h;
  });
  aoa.push(hdr);
  for (const r of rows || []) {
    const line = EMPTY(W);
    const vals = [
      r.product_identifier,
      r.product_name,
      r.brand_id,
      r.brand_name,
      r.atc,
      r.campaign_id,
      r.campaign_name,
      r.category,
      r.clicks,
      r.cpm,
      r.ctr,
      r.impressions,
      r.orders,
      r.other_skus,
      r.revenue,
      r.roas,
      r.robas ?? 0,
    ];
    vals.forEach((v, i) => {
      line[1 + i] = v;
    });
    aoa.push(line);
  }
  return aoa;
}

export function buildSpProductSheet(rows: AdProductRow[]): { name: string; def: WeeklyExtraSheetDef } {
  const aoa = buildSpProductAoa(rows);
  const W = 18;
  const lastCol = 1 + SP_HEAD.length;
  return {
    name: 'SP-AD-PRODUCT PERFORMANCE',
    def: {
      name: 'SP-AD-PRODUCT PERFORMANCE',
      aoa,
      titleRow: 3,
      titleColStart: 9,
      titleColEnd: 9,
      titleText: 'PRODUCT PERFORMANCE',
      headerRow: 4,
      headerColStart: 2,
      headerColEnd: lastCol,
    },
  };
}

export function buildSbProductSheet(rows: AdProductRow[]): { name: string; def: WeeklyExtraSheetDef } {
  const aoa = buildSbSdProductAoa(rows);
  const lastCol = 1 + SB_HEAD.length;
  return {
    name: 'SB-AD-PRODUCT PERFORMANCE',
    def: {
      name: 'SB-AD-PRODUCT PERFORMANCE',
      aoa,
      headerRow: 5,
      headerColStart: 2,
      headerColEnd: lastCol,
    },
  };
}

export function buildSdProductSheet(rows: AdProductRow[]): { name: string; def: WeeklyExtraSheetDef } {
  const aoa = buildSbSdProductAoa(rows);
  const lastCol = 1 + SB_HEAD.length;
  return {
    name: 'SD-AD-PRODUCT PERFORMANCE',
    def: {
      name: 'SD-AD-PRODUCT PERFORMANCE',
      aoa,
      headerRow: 5,
      headerColStart: 2,
      headerColEnd: lastCol,
    },
  };
}

export function buildTotalCityWiseSheet(rows: TotalCitySaleRow[]): { name: string; def: WeeklyExtraSheetDef } {
  const headers = [
    'Date',
    'SKU Number',
    'SKU Name',
    'EAN',
    'SKU Category',
    'SKU Sub Category',
    'Brand Name',
    'Manufacturer Name',
    'Manufacturer ID',
    'City',
    'Sales (Qty) - Units',
    'MRP',
    'Gross Merchandise Value',
  ];
  const aoa: (string | number | null)[][] = [headers];
  for (const r of rows || []) {
    aoa.push([
      r.report_date,
      r.sku_number,
      r.sku_name,
      r.ean ?? '',
      r.sku_category,
      r.sku_sub_category,
      r.brand_name,
      r.manufacturer_name,
      r.manufacturer_id,
      r.city,
      r.quantity,
      r.mrp ?? '',
      r.gmv ?? '',
    ]);
  }
  return {
    name: 'TOTAL-CITY-WISE SALE',
    def: {
      name: 'TOTAL-CITY-WISE SALE',
      aoa,
      headerRow: 1,
      headerColStart: 1,
      headerColEnd: headers.length,
    },
  };
}

/** NEXT WEEK PLAN — template shell (fill manually in Excel). */
export function buildNextWeekPlanSheet(): { name: string; def: WeeklyExtraSheetDef } {
  const W = 14;
  const line = () => Array(W).fill('') as (string | number | null)[];
  const r = (patch: Record<number, string | number | null>) => {
    const row = line();
    Object.entries(patch).forEach(([k, v]) => {
      row[Number(k)] = v;
    });
    return row;
  };
  const aoa: (string | number | null)[][] = [
    line(),
    r({ 4: 'PLAN ' }),
    r({ 4: 'MONTH', 5: 'TOTAL BUDGET', 6: 'CAMPAIGN TYPE', 7: 'BUDGET', 8: 'ROAS', 9: 'SALE' }),
    r({ 4: 'MARCH', 5: 1200000, 6: 'Sponsred Brand', 7: 30000, 8: 2.2, 9: 66000 }),
    r({ 6: 'Sponsred Display', 7: 200000, 8: 2.5, 9: 500000 }),
    r({ 6: 'Sponsred Product', 7: 700000, 8: 2.5, 9: 1750000 }),
    line(),
    line(),
    r({ 4: 'Projections may vary due to product availability.' }),
    r({ 4: 'Projections may vary slightly.' }),
    line(),
    line(),
    line(),
    line(),
    r({ 4: 'MOM ' }),
  ];
  return {
    name: 'NEXT WEEK PLAN',
    def: { name: 'NEXT WEEK PLAN', aoa },
  };
}

export function buildAllWeeklyExtraSheets(extras: MainDashboardWorkbookExtras | undefined): WeeklyExtraSheetDef[] {
  if (!extras) return [];
  const sheets: WeeklyExtraSheetDef[] = [];
  sheets.push(buildAdCitySheet(extras.ad_city_level ?? []).def);
  sheets.push(buildAdCategorySheet(extras.ad_category_performance ?? []).def);
  sheets.push(buildSpProductSheet(extras.ad_sp_product ?? []).def);
  sheets.push(buildSbProductSheet(extras.ad_sb_product ?? []).def);
  sheets.push(buildSdProductSheet(extras.ad_sd_product ?? []).def);
  sheets.push(buildTotalCityWiseSheet(extras.total_city_wise_sale_detail ?? []).def);
  sheets.push(buildNextWeekPlanSheet().def);
  return sheets;
}
