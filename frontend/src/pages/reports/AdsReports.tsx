import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, DollarSign, Eye, MousePointer, Upload, Target, Zap, Award } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { ReportUpload } from '../../components/reports/ReportUpload';
import { Table, type Column } from '../../components/ui/Table';
import { Drawer } from '../../components/ui/Drawer';
import { reportsApi, type AdsReportRow, type AdsSummary } from '../../services/api';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function AdsReports() {
  const { currentTheme, addNotification } = useAppStore();
  const tenantId = useAuthStore((s) => s.tenantId)!;
  const [dateRange, setDateRange] = useState('30d');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);
  const [adsData, setAdsData] = useState<AdsReportRow[]>([]); // Paginated data for table
  const [allAdsData, setAllAdsData] = useState<AdsReportRow[]>([]); // All data for analytics
  const [summary, setSummary] = useState<AdsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [isUploadDrawerOpen, setIsUploadDrawerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const recordsPerPage = 50;

  // Format local date without timezone conversion
  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Calculate date range
  const getDateRange = useCallback(() => {
    // If custom date range is selected
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      return {
        start: customStartDate,
        end: customEndDate,
      };
    }

    // Otherwise use predefined ranges
    const today = new Date();
    const startDate = new Date();
    
    switch (dateRange) {
      case '7d':
        startDate.setDate(today.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(today.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(today.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(today.getFullYear() - 1);
        break;
      default:
        startDate.setDate(today.getDate() - 30);
    }
    
    return {
      start: formatLocalDate(startDate),
      end: formatLocalDate(today),
    };
  }, [dateRange, customStartDate, customEndDate]);

  // Load ads data
  const loadAdsData = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      
      // Don't load if custom date range is selected but dates are not set
      if (dateRange === 'custom' && (!customStartDate || !customEndDate)) {
        setLoading(false);
        return;
      }
      
      const offset = (currentPage - 1) * recordsPerPage;
      
      const [paginatedData, allData, summaryData] = await Promise.all([
        // Fetch paginated data for table
        reportsApi.getAdsReports(
          tenantId,
          selectedChannel || undefined,
          start,
          end,
          recordsPerPage,
          offset
        ),
        // Fetch all data for analytics (max 10000 records)
        reportsApi.getAdsReports(
          tenantId,
          selectedChannel || undefined,
          start,
          end,
          10000,
          0
        ),
        // Fetch summary
        reportsApi.getAdsSummary(
          tenantId,
          selectedChannel || undefined,
          start,
          end
        ),
      ]);
      setAdsData(paginatedData);
      setAllAdsData(allData);
      setSummary(summaryData);
      setTotalRecords(summaryData?.total_records || paginatedData.length);
    } catch (error: any) {
      console.error('Failed to load ads data:', error);
      addNotification('error', error.response?.data?.detail || 'Failed to load ads data');
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedChannel, customStartDate, customEndDate, currentPage, getDateRange, addNotification]);

  useEffect(() => {
    loadAdsData();
  }, [loadAdsData]);

  const handleUploadComplete = () => {
    // Reload data after upload (drawer stays open so user can see success/error and failed rows)
    setCurrentPage(1);
    loadAdsData();
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange, selectedChannel, customStartDate, customEndDate]);

  // Table columns
  const columns: Column<AdsReportRow>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (row) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {row.date ? new Date(row.date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }) : '-'}
        </div>
      ),
    },
    {
      key: 'channel',
      header: 'Ad Source',
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 capitalize">
          {row.channel.replace('_', ' ') || '-'}
        </span>
      ),
    },
    {
      key: 'campaign_name',
      header: 'Campaign',
      render: (row) => (
        <div className="text-sm text-gray-900 dark:text-white max-w-xs truncate" title={row.campaign_name}>
          {row.campaign_name || '-'}
        </div>
      ),
      className: 'min-w-[200px]',
    },
    {
      key: 'product_identifier',
      header: 'Product ID',
      render: (row) => (
        <div className="font-mono text-sm text-gray-700 dark:text-gray-300">
          {row.product_identifier || '-'}
        </div>
      ),
    },
    {
      key: 'impressions',
      header: 'Impressions',
      render: (row) => (
        <div className="text-right font-medium text-gray-900 dark:text-white">
          {row.impressions.toLocaleString()}
        </div>
      ),
    },
    {
      key: 'clicks',
      header: 'Clicks',
      render: (row) => (
        <div className="text-right font-medium text-gray-900 dark:text-white">
          {row.clicks.toLocaleString()}
        </div>
      ),
    },
    {
      key: 'spend',
      header: 'Spend',
      render: (row) => (
        <div className="text-right font-medium text-gray-900 dark:text-white">
          ₹{row.spend.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      key: 'sales',
      header: 'Sales',
      render: (row) => (
        <div className="text-right font-medium text-green-600 dark:text-green-400">
          ₹{row.sales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      key: 'roas',
      header: 'ROAS',
      render: (row) => (
        <div className={`text-right font-medium ${row.roas >= 3 ? 'text-green-600 dark:text-green-400' : row.roas >= 2 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
          {row.roas.toFixed(2)}x
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Upload Button */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ads Reports</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Track advertising performance across channels
          </p>
        </div>
        <button
          onClick={() => setIsUploadDrawerOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Ads Report
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date Range
            </label>
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                setShowCustomDateRange(e.target.value === 'custom');
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="1y">Last Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Custom Date Range */}
          {showCustomDateRange && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  From Date
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  To Date
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </>
          )}

          {/* Ad Source Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ad Source
            </label>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Sources</option>
              <option value="google_ads">Google Ads</option>
              <option value="google_pla">Google PLA</option>
              <option value="facebook_ads">Facebook Ads</option>
              <option value="amazon_ads">Amazon Advertising</option>
            </select>
          </div>

          {/* Clear Filters */}
          {(selectedChannel || dateRange !== '30d') && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSelectedChannel('');
                  setDateRange('30d');
                  setShowCustomDateRange(false);
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Impressions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {summary.total_impressions.toLocaleString()}
                </p>
              </div>
              <Eye className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Clicks</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {summary.total_clicks.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  CTR: {summary.overall_ctr.toFixed(2)}%
                </p>
              </div>
              <MousePointer className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Spend</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  ₹{summary.total_spend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-red-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Sales</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
                  ₹{summary.total_sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Overall ROAS</p>
                <p className={`text-2xl font-bold mt-2 ${summary.overall_roas >= 3 ? 'text-green-600 dark:text-green-400' : summary.overall_roas >= 2 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                  {summary.overall_roas.toFixed(2)}x
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {summary.total_campaigns} campaigns
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </div>
        </div>
      )}

      {/* Analytics Section */}
      {!loading && adsData.length > 0 && (
        <div className="space-y-6">
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">📊 Ads Analytics</h2>
          </div>

          {/* Row 1: Channel Performance & ROAS Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Spend by Channel (Pie Chart) */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Ad Spend by Channel</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={(() => {
                      const channelSpend = allAdsData.reduce((acc: any, row) => {
                        acc[row.channel] = (acc[row.channel] || 0) + row.spend;
                        return acc;
                      }, {});
                      return Object.entries(channelSpend).map(([name, value]) => ({ name, value }));
                    })()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ₹${(entry.value as number).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* ROAS Distribution (Bar Chart) */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">ROAS Distribution by Channel</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={(() => {
                    const channelData = allAdsData.reduce((acc: any, row) => {
                      if (!acc[row.channel]) {
                        acc[row.channel] = { channel: row.channel, spend: 0, sales: 0 };
                      }
                      acc[row.channel].spend += row.spend;
                      acc[row.channel].sales += row.sales;
                      return acc;
                    }, {});
                    return Object.values(channelData).map((ch: any) => ({
                      channel: ch.channel,
                      roas: ch.spend > 0 ? ch.sales / ch.spend : 0
                    }));
                  })()}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="channel" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => `${value.toFixed(2)}x`} />
                  <Bar dataKey="roas" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 2: Top Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 10 Products by ROAS */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top 10 Products by ROAS</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={(() => {
                    const productData = allAdsData.reduce((acc: any, row) => {
                      if (!row.product_identifier) return acc;
                      if (!acc[row.product_identifier]) {
                        acc[row.product_identifier] = { product: row.product_identifier.substring(0, 15), spend: 0, sales: 0 };
                      }
                      acc[row.product_identifier].spend += row.spend;
                      acc[row.product_identifier].sales += row.sales;
                      return acc;
                    }, {});
                    return Object.values(productData)
                      .map((p: any) => ({ ...p, roas: p.spend > 0 ? p.sales / p.spend : 0 }))
                      .sort((a: any, b: any) => b.roas - a.roas)
                      .slice(0, 10);
                  })()}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="product" type="category" />
                  <Tooltip formatter={(value: any) => `${value.toFixed(2)}x`} />
                  <Bar dataKey="roas" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top 10 Products by Sales */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top 10 Products by Sales</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={(() => {
                    const productData = allAdsData.reduce((acc: any, row) => {
                      if (!row.product_identifier) return acc;
                      if (!acc[row.product_identifier]) {
                        acc[row.product_identifier] = { product: row.product_identifier.substring(0, 15), sales: 0 };
                      }
                      acc[row.product_identifier].sales += row.sales;
                      return acc;
                    }, {});
                    return Object.values(productData)
                      .sort((a: any, b: any) => b.sales - a.sales)
                      .slice(0, 10);
                  })()}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="product" type="category" />
                  <Tooltip formatter={(value: any) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
                  <Bar dataKey="sales" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 3: Performance Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CTR by Channel */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Target className="h-5 w-5 mr-2 text-blue-500" />
                CTR by Channel
              </h3>
              <div className="space-y-3">
                {(() => {
                  const channelData = allAdsData.reduce((acc: any, row) => {
                    if (!acc[row.channel]) {
                      acc[row.channel] = { impressions: 0, clicks: 0 };
                    }
                    acc[row.channel].impressions += row.impressions;
                    acc[row.channel].clicks += row.clicks;
                    return acc;
                  }, {});
                  return Object.entries(channelData)
                    .map(([channel, data]: [string, any]) => ({
                      channel,
                      ctr: data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0
                    }))
                    .sort((a, b) => b.ctr - a.ctr)
                    .map((item) => (
                      <div key={item.channel} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{item.channel}</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.ctr.toFixed(2)}%</span>
                      </div>
                    ));
                })()}
              </div>
            </div>

            {/* Cost per Click by Channel */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-green-500" />
                Cost per Click (CPC)
              </h3>
              <div className="space-y-3">
                {(() => {
                  const channelData = allAdsData.reduce((acc: any, row) => {
                    if (!acc[row.channel]) {
                      acc[row.channel] = { spend: 0, clicks: 0 };
                    }
                    acc[row.channel].spend += row.spend;
                    acc[row.channel].clicks += row.clicks;
                    return acc;
                  }, {});
                  return Object.entries(channelData)
                    .map(([channel, data]: [string, any]) => ({
                      channel,
                      cpc: data.clicks > 0 ? data.spend / data.clicks : 0
                    }))
                    .sort((a, b) => a.cpc - b.cpc)
                    .map((item) => (
                      <div key={item.channel} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{item.channel}</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">₹{item.cpc.toFixed(2)}</span>
                      </div>
                    ));
                })()}
              </div>
            </div>

            {/* Performance Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Award className="h-5 w-5 mr-2 text-yellow-500" />
                Performance Summary
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Avg Revenue/Click</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    ₹{summary ? summary.avg_revenue_per_click.toFixed(2) : '0.00'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Products</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {summary ? summary.total_products : 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Campaigns</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {summary ? summary.total_campaigns : 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Conversion Rate</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {summary && summary.total_clicks > 0 ? ((summary.total_sales / summary.total_clicks) * 100).toFixed(2) : '0.00'}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 4: Campaign Performance (if campaigns exist) */}
          {(() => {
            const campaignData = allAdsData.filter(row => row.campaign_name).reduce((acc: any, row) => {
              if (!acc[row.campaign_name]) {
                acc[row.campaign_name] = { campaign: row.campaign_name, spend: 0, sales: 0, impressions: 0, clicks: 0 };
              }
              acc[row.campaign_name].spend += row.spend;
              acc[row.campaign_name].sales += row.sales;
              acc[row.campaign_name].impressions += row.impressions;
              acc[row.campaign_name].clicks += row.clicks;
              return acc;
            }, {});
            const campaigns = Object.values(campaignData).map((c: any) => ({
              ...c,
              roas: c.spend > 0 ? c.sales / c.spend : 0,
              ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0
            })).sort((a: any, b: any) => b.sales - a.sales).slice(0, 10);

            return campaigns.length > 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top 10 Campaigns by Sales</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={campaigns}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="campaign" type="category" width={140} />
                    <Tooltip formatter={(value: any) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
                    <Bar dataKey="sales" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Ads Performance Data
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Showing {((currentPage - 1) * recordsPerPage) + 1} - {Math.min(currentPage * recordsPerPage, totalRecords)} of {totalRecords} records
              </p>
            </div>
          </div>
        </div>
        <Table
          data={adsData}
          columns={columns}
          loading={loading}
          keyExtractor={(row, index) => `${row.channel}-${row.date}-${index}`}
        />
        
        {/* Pagination Controls */}
        {totalRecords > recordsPerPage && (
          <div className="flex items-center justify-between mt-4 px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
            </div>
            
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Page {currentPage} of {Math.ceil(totalRecords / recordsPerPage)}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={currentPage >= Math.ceil(totalRecords / recordsPerPage)}
                className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
              <button
                onClick={() => setCurrentPage(Math.ceil(totalRecords / recordsPerPage))}
                disabled={currentPage >= Math.ceil(totalRecords / recordsPerPage)}
                className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Drawer — does not auto-close so you can see success/error and failed rows */}
      <Drawer
        isOpen={isUploadDrawerOpen}
        onClose={() => setIsUploadDrawerOpen(false)}
        title="Upload Ads Report"
        closeOnBackdropClick={false}
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsUploadDrawerOpen(false)}
              className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-white dark:hover:bg-slate-500"
            >
              Close
            </button>
          </div>
        }
      >
        <ReportUpload reportType="ads" onUploadComplete={handleUploadComplete} />
      </Drawer>
    </div>
  );
}
