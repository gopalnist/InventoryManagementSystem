import { useState, useCallback, useEffect, useMemo } from 'react';
import { LayoutDashboard, Upload, DollarSign, TrendingUp, BarChart3, MapPin, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { reportsApi, type MainDashboardData, type ReportUploadResponse } from '../../services/api';
import { Drawer } from '../../components/ui/Drawer';
import { Select } from '../../components/ui/Select';
import { useAuthStore } from '../../store/authStore';

const WEEKLY_UPLOAD_SOURCES = [
  { id: 'city_wise_sale', label: 'TOTAL-CITY-WISE SALE', reportType: 'sales' as const, dataType: undefined, description: 'Sales by Date, SKU, City (Excel/CSV)' },
  { id: 'ad_city', label: 'AD-CITY LEVEL DATA', reportType: 'ads' as const, dataType: 'ad_city', description: 'City-wise ad metrics (Spend, Orders, Revenue)' },
  { id: 'ad_category', label: 'AD-CATEGORY PERFORMANCE', reportType: 'ads' as const, dataType: 'ad_category', description: 'Category/Campaign (SB) performance' },
  { id: 'ad_sp_product', label: 'SP-AD PRODUCT PERFORMANCE', reportType: 'ads' as const, dataType: 'ad_sp_product', description: 'Sponsored Products by product' },
  { id: 'ad_sb_product', label: 'SB-AD PRODUCT PERFORMANCE', reportType: 'ads' as const, dataType: 'ad_sb_product', description: 'Sponsored Brand by product' },
];

/** For Zepto: Sales, Inventory, PO, then 9 separate Ads report types (each uploaded as its own file). */
const ZEPTO_NON_ADS_SOURCES = [
  { id: 'sales', label: 'Sales', reportType: 'sales' as const, description: 'Sales report (Excel/CSV)' },
  { id: 'inventory', label: 'Inventory', reportType: 'inventory' as const, description: 'Inventory report (Excel/CSV)' },
  { id: 'po', label: 'PO', reportType: 'po' as const, description: 'Purchase order report (Excel/CSV)' },
] as const;

/** Zepto Ads: 9 report types — upload one file per type (daily, weekly, or monthly). */
const ZEPTO_ADS_UPLOAD_SOURCES = [
  { id: 'zepto_ads_campaign', label: 'Campaign Level Performance', reportType: 'ads' as const, description: 'Campaign Level Performance.xlsx' },
  { id: 'zepto_ads_category', label: 'Category Performance', reportType: 'ads' as const, description: 'Category Performance.xlsx' },
  { id: 'zepto_ads_city', label: 'City Level Performance', reportType: 'ads' as const, description: 'City_Level Performance.xlsx' },
  { id: 'zepto_ads_keyword', label: 'Keyword Performance', reportType: 'ads' as const, description: 'Keyword Performance.xlsx' },
  { id: 'zepto_ads_overview', label: 'Overview', reportType: 'ads' as const, description: 'Overview.xlsx' },
  { id: 'zepto_ads_page', label: 'Page Level Performance', reportType: 'ads' as const, description: 'Page Level Performance.xlsx' },
  { id: 'zepto_ads_performance', label: 'Performance', reportType: 'ads' as const, description: 'Performance.xlsx' },
  { id: 'zepto_ads_product', label: 'Product Level Performance', reportType: 'ads' as const, description: 'Product Level Performance.xlsx' },
  { id: 'zepto_ads_traffic', label: 'Traffic', reportType: 'ads' as const, description: 'Traffic.xlsx' },
] as const;

/** For Amazon: Sales, Inventory, PO, Ads (single CSV). */
const AMAZON_UPLOAD_SOURCES = [
  { id: 'sales', label: 'Sales', reportType: 'sales' as const, description: 'Sales report (Excel/CSV)' },
  { id: 'inventory', label: 'Inventory', reportType: 'inventory' as const, description: 'Inventory report (Excel/CSV)' },
  { id: 'po', label: 'PO', reportType: 'po' as const, description: 'Purchase order report (Excel/CSV)' },
  { id: 'ads', label: 'Ads', reportType: 'ads' as const, description: 'Ads report (one CSV; period can be daily, weekly, or monthly).' },
  { id: 'traffic', label: 'Traffic', reportType: 'traffic' as const, description: 'Traffic report (Excel). Viewing Range in row 0 = report date (single day).' },
] as const;

const UPLOAD_CHANNEL_OPTIONS = [
  { value: 'zepto', label: 'Zepto' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'blinkit', label: 'Blinkit' },
  { value: 'flipkart', label: 'Flipkart' },
  { value: 'swiggy', label: 'Swiggy' },
  { value: 'bigbasket', label: 'BigBasket' },
];

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function MainDashboard() {
  const { addNotification } = useAppStore();
  const tenantId = useAuthStore((s) => s.tenantId)!;
  const [data, setData] = useState<MainDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatLocalDate(d);
  });
  const [endDate, setEndDate] = useState<string>(() => formatLocalDate(new Date()));
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [expandedUpload, setExpandedUpload] = useState<string | null>(null);
  const [uploadChannel, setUploadChannel] = useState<string>('zepto');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);
  const [uploadBatchTag, setUploadBatchTag] = useState<string>('');
  const [uploadReportForDate, setUploadReportForDate] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterSubcategory, setFilterSubcategory] = useState<string>('');
  const [filterProductName, setFilterProductName] = useState<string>('');
  const [filterAvailableStores, setFilterAvailableStores] = useState<string>('all');

  const loadDashboard = useCallback(async () => {
    if (startDate && endDate && startDate > endDate) {
      setDateRangeError('From date must not be greater than To date.');
      return;
    }
    setDateRangeError(null);
    setLoading(true);
    setLoadError(null);
    try {
      const res = await reportsApi.getMainDashboard(
        tenantId,
        channel || undefined,
        startDate,
        endDate
      );
      setData(res);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err && (err as any).response?.data?.detail != null
        ? String((err as any).response.data.detail)
        : err instanceof Error
          ? err.message
          : 'Failed to load Main Dashboard';
      setLoadError(msg);
      addNotification('error', msg);
    } finally {
      setLoading(false);
    }
  }, [tenantId, channel, startDate, endDate, addNotification]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const productPerformanceList = data?.product_performance ?? [];
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    productPerformanceList.forEach((r) => {
      const c = (r.category || '').trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [productPerformanceList]);
  const uniqueSubcategories = useMemo(() => {
    const set = new Set<string>();
    productPerformanceList.forEach((r) => {
      const s = (r.subcategory || '').trim();
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [productPerformanceList]);
  const filteredProductPerformance = useMemo(() => {
    let list = productPerformanceList;
    if (filterCategory) {
      list = list.filter((r) => (r.category || '').trim() === filterCategory);
    }
    if (filterSubcategory) {
      list = list.filter((r) => (r.subcategory || '').trim() === filterSubcategory);
    }
    if (filterProductName.trim()) {
      const q = filterProductName.trim().toLowerCase();
      list = list.filter(
        (r) =>
          (r.product_name || '').toLowerCase().includes(q) ||
          (r.product_identifier || '').toLowerCase().includes(q)
      );
    }
    if (filterAvailableStores === 'has_value') {
      list = list.filter((r) => r.available_stores != null && r.available_stores !== '');
    }
    return list;
  }, [productPerformanceList, filterCategory, filterSubcategory, filterProductName, filterAvailableStores]);

  return (
    <div className="min-h-screen overflow-visible bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl overflow-visible px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Main Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Report view (MAIN-1). Upload data from each tab to build the dashboard. Data can be daily, weekly, or monthly.
            </p>
          </div>
            <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-600 dark:text-slate-400">Date range</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDateRangeError(null);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
            <span className="text-slate-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDateRangeError(null);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
            {dateRangeError && (
              <span className="text-sm text-red-600 dark:text-red-400" role="alert">{dateRangeError}</span>
            )}
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="min-w-[140px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              <option value="">All channels</option>
              <option value="zepto">Zepto</option>
              <option value="amazon">Amazon</option>
              <option value="blinkit">Blinkit</option>
              <option value="flipkart">Flipkart</option>
              <option value="swiggy">Swiggy</option>
              <option value="bigbasket">BigBasket</option>
            </select>
            <button
              onClick={() => loadDashboard()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Apply
            </button>
            <button
              onClick={() => setUploadDrawerOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Upload className="h-4 w-4" />
              Upload data
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="font-medium text-amber-800 dark:text-amber-200">Could not load dashboard</p>
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{loadError}</p>
            <button
              onClick={() => loadDashboard()}
              className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700"
            >
              Retry
            </button>
          </div>
        ) : !data ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
            <p className="text-slate-500 dark:text-slate-400">No data. Upload City-Wise Sale and Ad data to see the dashboard.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI: ADS | ORGANIC | OVERALL (matches Excel MAIN-1 rows 5–7) */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">ADS</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="text-slate-500">Ad Spend:</span> <span className="font-medium">₹{data.ads.ad_spend.toLocaleString('en-IN')}</span></p>
                  <p><span className="text-slate-500">Ad Order:</span> <span className="font-medium">{data.ads.ad_order}</span></p>
                  <p><span className="text-slate-500">Ads Order Value:</span> <span className="font-medium">₹{data.ads.ads_order_value.toLocaleString('en-IN')}</span></p>
                  <p><span className="text-slate-500">ROAS (Ads):</span> <span className="font-medium">{typeof data.ads.roas === 'number' ? Number(data.ads.roas).toFixed(6) : data.ads.roas}</span></p>
                  <p><span className="text-slate-500">Avg Order Value (Ads):</span> <span className="font-medium">₹{typeof data.ads.avg_order_value === 'number' ? Number(data.ads.avg_order_value).toFixed(6) : (data.ads.avg_order_value ?? 0)}</span></p>
                  <p><span className="text-slate-500">CPS:</span> <span className="font-medium">₹{typeof data.ads.cps === 'number' ? Number(data.ads.cps).toFixed(6) : data.ads.cps}</span></p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">ORGANIC</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="text-slate-500">Total Organic Order:</span> <span className="font-medium">{data.organic.organic_order}</span></p>
                  <p><span className="text-slate-500">Organic Sale Value:</span> <span className="font-medium">₹{data.organic.organic_sale_value.toLocaleString('en-IN')}</span></p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">OVERALL</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="text-slate-500">Total Order:</span> <span className="font-medium">{data.overall.total_order ?? data.overall.total_units ?? 0}</span></p>
                  <p><span className="text-slate-500">Total Sale Value:</span> <span className="font-medium">₹{data.overall.total_sale_value.toLocaleString('en-IN')}</span></p>
                  <p><span className="text-slate-500">Total Units:</span> <span className="font-medium">{data.overall.total_units}</span></p>
                  <p><span className="text-slate-500">Avg Order Value (Total):</span> <span className="font-medium">₹{typeof data.overall.avg_order_value === 'number' ? Number(data.overall.avg_order_value).toFixed(6) : (data.overall.avg_order_value ?? 0)}</span></p>
                  <p><span className="text-slate-500">ROI (Total):</span> <span className="font-medium">{typeof data.overall.roi === 'number' ? Number(data.overall.roi).toFixed(6) : data.overall.roi}</span></p>
                  <p><span className="text-slate-500">CPS (Total):</span> <span className="font-medium">₹{typeof data.overall.cps === 'number' ? Number(data.overall.cps).toFixed(6) : data.overall.cps}</span></p>
                </div>
              </div>
            </div>

            {/* Campaign Type Breakdown */}
            {data.campaign_type_breakdown.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <h2 className="border-b border-slate-200 px-4 py-3 text-base font-semibold dark:border-slate-700">Campaign Type</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-700/50">
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Type</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Ad Spend</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Ad Order</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Ads Order Value</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">ROAS</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">CPS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {data.campaign_type_breakdown.map((row) => (
                        <tr key={row.campaign_type}>
                          <td className="px-4 py-2 text-sm font-medium">{row.campaign_type}</td>
                          <td className="px-4 py-2 text-right text-sm">₹{row.ad_spend.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-2 text-right text-sm">{row.ad_order}</td>
                          <td className="px-4 py-2 text-right text-sm">₹{row.ads_order_value.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-2 text-right text-sm">{row.roas.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right text-sm">₹{row.cps.toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Overall Product Performance – 11 columns matching Excel MAIN-1 */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-visible">
              <h2 className="border-b border-slate-200 px-4 py-3 text-base font-semibold dark:border-slate-700">Overall Product Performance</h2>
              <p className="border-b border-slate-200 px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                Data: Product Name, Category, Subcategory, Sales Contribution, GMV, Quantity Sold come from sales (city-wise). View to Order from ads product performance when product IDs match.
              </p>
              <div className="relative z-20 border-b border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/80">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="min-w-0">
                    <Select
                      label="Category"
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="w-full min-w-[140px] dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">All</option>
                      {uniqueCategories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="min-w-0">
                    <Select
                      label="Subcategory"
                      value={filterSubcategory}
                      onChange={(e) => setFilterSubcategory(e.target.value)}
                      className="w-full min-w-[140px] dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">All</option>
                      {uniqueSubcategories.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="min-w-0">
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-400">Product name</label>
                    <input
                      type="text"
                      value={filterProductName}
                      onChange={(e) => setFilterProductName(e.target.value)}
                      placeholder="Search..."
                      className="w-full min-w-[140px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="min-w-0">
                    <Select
                      label="Available Stores"
                      value={filterAvailableStores}
                      onChange={(e) => setFilterAvailableStores(e.target.value)}
                      className="w-full min-w-[120px] dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="all">All</option>
                      <option value="has_value">Has value</option>
                    </Select>
                  </div>
                  <div className="flex items-end pb-2">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Showing {filteredProductPerformance.length} of {data.product_performance?.length ?? 0}
                    </span>
                  </div>
                </div>
              </div>
              <div className="max-h-96 overflow-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-700/50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Product Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Category</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Subcategory</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Sales Contribution</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Available Stores</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">GMV</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Stock on Hand</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Quantity Sold</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Week on Week</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Month on Month Gro</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">View to Order</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {filteredProductPerformance.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                            {(data.product_performance?.length ?? 0) === 0
                              ? 'No product data. Upload sales (e.g. city-wise) and ads data to see performance here.'
                              : 'No rows match the current filters.'}
                          </td>
                        </tr>
                      ) : (
                        filteredProductPerformance.slice(0, 100).map((row, i) => (
                          <tr key={row.product_identifier || i}>
                            <td className="px-3 py-2 text-sm">{row.product_name || row.product_identifier || '-'}</td>
                            <td className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">{row.category ?? '–'}</td>
                            <td className="px-3 py-2 text-sm text-slate-500">{row.subcategory ?? '–'}</td>
                            <td className="px-3 py-2 text-right text-sm">{row.sales_contribution_pct}%</td>
                            <td className="px-3 py-2 text-right text-sm">{row.available_stores != null ? row.available_stores : '–'}</td>
                            <td className="px-3 py-2 text-right text-sm">₹{row.gmv.toLocaleString('en-IN')}</td>
                            <td className="px-3 py-2 text-right text-sm">{row.stock_on_hand != null ? row.stock_on_hand : '–'}</td>
                            <td className="px-3 py-2 text-right text-sm">{row.quantity_sold}</td>
                            <td className="px-3 py-2 text-right text-sm">{row.week_on_week_pct != null ? `${row.week_on_week_pct}%` : '–'}</td>
                            <td className="px-3 py-2 text-right text-sm">{row.month_on_month_pct != null ? `${row.month_on_month_pct}%` : '–'}</td>
                            <td className="px-3 py-2 text-right text-sm">{row.view_to_order != null ? Number(row.view_to_order).toFixed(2) : '–'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            {/* City-Wise Sale (compact) */}
            {data.city_wise_sale.rows.length > 0 && data.city_wise_sale.cities.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <h2 className="border-b border-slate-200 px-4 py-3 text-base font-semibold dark:border-slate-700">City-Wise Sale (Units)</h2>
                <div className="max-h-80 overflow-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-700/50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Product</th>
                        {data.city_wise_sale.cities.slice(0, 15).map((c) => (
                          <th key={c} className="px-2 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">{c}</th>
                        ))}
                        {data.city_wise_sale.cities.length > 15 && <th className="px-2 py-2 text-right text-xs">...</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {data.city_wise_sale.rows.slice(0, 50).map((row, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 font-medium">{(row.product_name as string) || (row.product_identifier as string) || '-'}</td>
                          {data.city_wise_sale.cities.slice(0, 15).map((city) => (
                            <td key={city} className="px-2 py-1.5 text-right">{(row[city] as number) ?? 0}</td>
                          ))}
                          {data.city_wise_sale.cities.length > 15 && <td className="px-2 py-1.5 text-right">...</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload drawer: 5 places to upload — does not auto-close so you can see success/error */}
      <Drawer
        isOpen={uploadDrawerOpen}
        onClose={() => setUploadDrawerOpen(false)}
        title="Upload data for Main Dashboard"
        closeOnBackdropClick={false}
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setUploadDrawerOpen(false)}
              className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-white dark:hover:bg-slate-500"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="space-y-4 px-1">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Channel</label>
            <select
              value={uploadChannel}
              onChange={(e) => { setUploadChannel(e.target.value); setExpandedUpload(null); }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              {UPLOAD_CHANNEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {uploadChannel === 'zepto' && (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Upload <strong>Zepto</strong> reports. Sales, Inventory, PO first; then <strong>9 Ads report types</strong> (Campaign, Category, City, Keyword, Overview, Page Level, Performance, Product Level, Traffic). One file per block; period can be daily, weekly, or monthly.
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Batch tag (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Zepto Mar 2026"
                  value={uploadBatchTag}
                  onChange={(e) => setUploadBatchTag(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
                <p className="mt-1 text-xs text-slate-500">Use same tag to group uploads; filter by batch above.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Report for date (optional)</label>
                <input
                  type="date"
                  value={uploadReportForDate}
                  onChange={(e) => setUploadReportForDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
                <p className="mt-1 text-xs text-slate-500">For which date this report is. Leave empty to use dates from file or today.</p>
              </div>
              {ZEPTO_NON_ADS_SOURCES.map((src) => (
                <UploadBlock
                  key={src.id}
                  label={src.label}
                  description={src.description}
                  reportType={src.reportType}
                  channel="zepto"
                  tenantId={tenantId}
                  batchTag={uploadBatchTag || undefined}
                  reportForDate={uploadReportForDate || undefined}
                  expanded={expandedUpload === src.id}
                  onToggle={() => setExpandedUpload(expandedUpload === src.id ? null : src.id)}
                  onUploadComplete={() => loadDashboard()}
                />
              ))}
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-2">Zepto Ads (upload one file per type)</p>
              {ZEPTO_ADS_UPLOAD_SOURCES.map((src) => (
                <UploadBlock
                  key={src.id}
                  label={src.label}
                  description={src.description}
                  reportType={src.reportType}
                  channel="zepto"
                  tenantId={tenantId}
                  batchTag={uploadBatchTag || undefined}
                  reportForDate={uploadReportForDate || undefined}
                  expanded={expandedUpload === src.id}
                  onToggle={() => setExpandedUpload(expandedUpload === src.id ? null : src.id)}
                  onUploadComplete={() => loadDashboard()}
                />
              ))}
            </>
          )}
          {(uploadChannel === 'amazon' || ['blinkit', 'flipkart', 'swiggy', 'bigbasket'].includes(uploadChannel)) && (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Upload <strong>{uploadChannel.charAt(0).toUpperCase() + uploadChannel.slice(1)}</strong> reports. Sales, Inventory, PO, then Ads. Period can be daily, weekly, or monthly.
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Batch tag (optional)</label>
                <input
                  type="text"
                  placeholder={`e.g. ${uploadChannel.charAt(0).toUpperCase() + uploadChannel.slice(1)} Mar 2026`}
                  value={uploadBatchTag}
                  onChange={(e) => setUploadBatchTag(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
                <p className="mt-1 text-xs text-slate-500">Use same tag to group uploads; filter by batch above.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Report for date (optional)</label>
                <input
                  type="date"
                  value={uploadReportForDate}
                  onChange={(e) => setUploadReportForDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
                <p className="mt-1 text-xs text-slate-500">For which date this report is. Leave empty to use dates from file or today.</p>
              </div>
              {AMAZON_UPLOAD_SOURCES.map((src) => (
                <UploadBlock
                  key={src.id}
                  label={src.label}
                  description={src.description}
                  reportType={src.reportType}
                  channel={uploadChannel}
                  tenantId={tenantId}
                  batchTag={uploadBatchTag || undefined}
                  reportForDate={uploadReportForDate || undefined}
                  expanded={expandedUpload === src.id}
                  onToggle={() => setExpandedUpload(expandedUpload === src.id ? null : src.id)}
                  onUploadComplete={() => loadDashboard()}
                />
              ))}
            </>
          )}
        </div>
      </Drawer>
    </div>
  );
}

interface UploadBlockProps {
  label: string;
  description: string;
  reportType: 'sales' | 'ads' | 'inventory' | 'po' | 'traffic';
  channel: string;
  tenantId: string;
  dataType?: string;
  batchTag?: string;
  reportForDate?: string;
  expanded: boolean;
  onToggle: () => void;
  onUploadComplete: () => void;
}

function UploadBlock({ label, description, reportType, channel, tenantId, dataType, batchTag, reportForDate, expanded, onToggle, onUploadComplete }: UploadBlockProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<ReportUploadResponse | null>(null);

  const handleUpload = async () => {
    if (!file) {
      setError('Select a file');
      return;
    }
    setUploading(true);
    setError(null);
    setUploadResult(null);
    try {
      const apiChannel = channel === 'amazon' && reportType === 'ads' ? 'amazon_ads' : channel;
      const res = await reportsApi.upload(file, apiChannel, reportType, tenantId, dataType, batchTag, reportForDate);
      setUploadResult(res);
      setFile(null);
      onUploadComplete();
    } catch (err: unknown) {
      const detail = (err as any)?.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((d: any) => d?.msg ?? d).join(' ') : detail ?? 'Upload failed';
      setError(typeof msg === 'string' ? msg : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-medium">{label}</span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {expanded && (
        <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
          <div className="flex flex-wrap items-end gap-2">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
              }}
              className="text-sm"
            />
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
          {uploadResult && (
            <div className="mt-3 space-y-2">
              <div
                className={`rounded-lg border p-2 text-sm ${
                  uploadResult.status === 'completed'
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                    : uploadResult.status === 'partial'
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200'
                    : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                }`}
              >
                <p className="font-medium">{uploadResult.message}</p>
                <p className="text-xs opacity-90 mt-0.5">
                  Processed: {uploadResult.processed_rows} / {uploadResult.total_rows}
                  {uploadResult.failed_rows > 0 && ` (${uploadResult.failed_rows} failed)`}
                </p>
              </div>
              {uploadResult.failed_rows > 0 && uploadResult.errors && uploadResult.errors.length > 0 && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-2">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1.5">
                    Failed rows ({uploadResult.errors.length} shown):
                  </p>
                  <ul className="max-h-40 overflow-y-auto text-xs font-mono text-amber-900 dark:text-amber-100 space-y-0.5 list-disc list-inside">
                    {uploadResult.errors.map((err, i) => (
                      <li key={i} className="break-all">{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
