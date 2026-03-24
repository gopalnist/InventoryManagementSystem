import { useState, useEffect, useCallback, useMemo } from 'react';
import { ShoppingCart, TrendingUp, DollarSign, Package, Upload, PieChart, LineChart as LineChartIcon, BarChart3, Layers, MapPin, Activity, Download, FileSpreadsheet } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { ReportUpload } from '../../components/reports/ReportUpload';
import { Table, type Column } from '../../components/ui/Table';
import { Drawer } from '../../components/ui/Drawer';
import { reportsApi, type SalesReportRow, type SalesSummary } from '../../services/api';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, ComposedChart, Area } from 'recharts';
import { exportAlignedTable, formatReportDate, formatChannelLabel } from '../../utils/reportExport';
import { downloadStyledAlignedReportExcel } from '../../utils/reportStyledExcelExport';

export function SalesReports() {
  const { currentTheme, addNotification } = useAppStore();
  const tenantId = useAuthStore((s) => s.tenantId)!;
  const tenantName = useAuthStore((s) => s.tenantName);
  const [dateRange, setDateRange] = useState('30d');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);
  const [salesData, setSalesData] = useState<SalesReportRow[]>([]); // Paginated data for table
  const [allSalesData, setAllSalesData] = useState<SalesReportRow[]>([]); // All data for analytics
  const [allChannelsData, setAllChannelsData] = useState<SalesReportRow[]>([]); // All channels data for channel comparison
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [salesExportTitle, setSalesExportTitle] = useState<string>('');
  const [isUploadDrawerOpen, setIsUploadDrawerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const recordsPerPage = 50;

  // Format date as YYYY-MM-DD in local timezone (avoid UTC so "today" matches backend)
  const toLocalDateString = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Calculate date range
  const getDateRange = useCallback((): { start?: string; end?: string } => {
    // All time: no date filter so uploaded data (e.g. default report_date = today) always shows
    if (dateRange === 'all') {
      return {};
    }
    // If custom date range is selected
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      return {
        start: customStartDate,
        end: customEndDate,
      };
    }

    // Otherwise use predefined ranges (local dates so "today" matches backend)
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
      start: toLocalDateString(startDate),
      end: toLocalDateString(today),
    };
  }, [dateRange, customStartDate, customEndDate]);

  // Load sales data
  const loadSalesData = useCallback(async () => {
    setLoading(true);
    try {
      const range = getDateRange();
      
      // Don't load if custom date range is selected but dates are not set
      if (dateRange === 'custom' && (!customStartDate || !customEndDate)) {
        setLoading(false);
        return;
      }
      
      const offset = (currentPage - 1) * recordsPerPage;
      const start = range.start;
      const end = range.end;
      
      const [paginatedData, allData, allChannelsUnfilteredData, summaryData] = await Promise.all([
        // Fetch paginated data for table
        reportsApi.getSalesReports(
          tenantId,
          selectedChannel || undefined,
          start,
          end,
          recordsPerPage,
          offset
        ),
        // Fetch all data for analytics (max 10000 records)
        reportsApi.getSalesReports(
          tenantId,
          selectedChannel || undefined,
          start,
          end,
          10000,
          0
        ),
        // Fetch all channels data for channel comparison (no channel filter)
        reportsApi.getSalesReports(
          tenantId,
          undefined, // No channel filter - get all channels
          start,
          end,
          10000,
          0
        ),
        // Fetch summary
        reportsApi.getSalesSummary(
          tenantId,
          selectedChannel || undefined,
          start,
          end
        ),
      ]);
      setSalesData(paginatedData);
      setAllSalesData(allData);
      setAllChannelsData(allChannelsUnfilteredData);
      setSummary(summaryData);
      setTotalRecords(summaryData?.total_records || paginatedData.length);
    } catch (error: any) {
      console.error('Failed to load sales data:', error);
      addNotification('error', error.response?.data?.detail || 'Failed to load sales data');
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedChannel, customStartDate, customEndDate, currentPage, getDateRange, addNotification]);

  useEffect(() => {
    loadSalesData();
  }, [loadSalesData]);

  const handleUploadComplete = () => {
    // Reload data after upload (drawer stays open so user can see success/error and failed rows)
    setCurrentPage(1); // Reset to first page
    loadSalesData();
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange, selectedChannel, customStartDate, customEndDate]);

  // Calculate Revenue by Channel
  const revenueByChannel = useMemo(() => {
    const channelMap = new Map<string, { revenue: number; units: number; orders: number }>();
    
    allSalesData.forEach((row) => {
      const channel = row.channel || 'Unknown';
      const current = channelMap.get(channel) || { revenue: 0, units: 0, orders: 0 };
      channelMap.set(channel, {
        revenue: current.revenue + (row.revenue || 0),
        units: current.units + (row.units || 0),
        orders: current.orders + 1,
      });
    });

    return Array.from(channelMap.entries())
      .map(([channel, data]) => ({
        name: channel.charAt(0).toUpperCase() + channel.slice(1),
        value: data.revenue,
        units: data.units,
        orders: data.orders,
      }))
      .sort((a, b) => b.value - a.value);
  }, [allSalesData]);

  // Calculate Revenue Trend (Daily)
  const revenueTrend = useMemo(() => {
    const dateMap = new Map<string, { revenue: number; units: number; orders: number }>();
    
    allSalesData.forEach((row) => {
      const date = row.date || '';
      if (!date) return;
      
      const current = dateMap.get(date) || { revenue: 0, units: 0, orders: 0 };
      dateMap.set(date, {
        revenue: current.revenue + (row.revenue || 0),
        units: current.units + (row.units || 0),
        orders: current.orders + 1,
      });
    });

    return Array.from(dateMap.entries())
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        revenue: data.revenue,
        units: data.units,
        orders: data.orders,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [allSalesData]);

  // Calculate Top Products by Revenue
  const topProductsByRevenue = useMemo(() => {
    const productMap = new Map<string, { revenue: number; units: number; orders: number; name: string }>();
    
    allSalesData.forEach((row) => {
      const productId = row.item_id || row.item_name || 'Unknown';
      const productName = row.item_name || row.item_id || 'Unknown';
      const current = productMap.get(productId) || { revenue: 0, units: 0, orders: 0, name: productName };
      productMap.set(productId, {
        revenue: current.revenue + (row.revenue || 0),
        units: current.units + (row.units || 0),
        orders: current.orders + 1,
        name: productName,
      });
    });

    return Array.from(productMap.values())
      .map((product) => ({
        name: product.name.length > 30 ? product.name.substring(0, 30) + '...' : product.name,
        fullName: product.name,
        revenue: product.revenue,
        units: product.units,
        orders: product.orders,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10); // Top 10
  }, [allSalesData]);

  // Calculate Top Products by Units Sold
  const topProductsByUnits = useMemo(() => {
    const productMap = new Map<string, { revenue: number; units: number; orders: number; name: string }>();
    
    allSalesData.forEach((row) => {
      const productId = row.item_id || row.item_name || 'Unknown';
      const productName = row.item_name || row.item_id || 'Unknown';
      const current = productMap.get(productId) || { revenue: 0, units: 0, orders: 0, name: productName };
      productMap.set(productId, {
        revenue: current.revenue + (row.revenue || 0),
        units: current.units + (row.units || 0),
        orders: current.orders + 1,
        name: productName,
      });
    });

    return Array.from(productMap.values())
      .map((product) => ({
        name: product.name.length > 30 ? product.name.substring(0, 30) + '...' : product.name,
        fullName: product.name,
        revenue: product.revenue,
        units: product.units,
        orders: product.orders,
      }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 10); // Top 10
  }, [allSalesData]);

  // Calculate Channel Comparison (Daily breakdown by channel)
  const channelComparison = useMemo(() => {
    const dateChannelMap = new Map<string, Map<string, { revenue: number; units: number }>>();
    
    allChannelsData.forEach((row) => {
      const date = row.date || '';
      const channel = row.channel || 'Unknown';
      if (!date) return;
      
      if (!dateChannelMap.has(date)) {
        dateChannelMap.set(date, new Map());
      }
      
      const channelMap = dateChannelMap.get(date)!;
      const current = channelMap.get(channel) || { revenue: 0, units: 0 };
      channelMap.set(channel, {
        revenue: current.revenue + (row.revenue || 0),
        units: current.units + (row.units || 0),
      });
    });

    // Get all unique channels
    const allChannels = new Set<string>();
    dateChannelMap.forEach((channelMap) => {
      channelMap.forEach((_, channel) => allChannels.add(channel));
    });

    return Array.from(dateChannelMap.entries())
      .map(([date, channelMap]) => {
        const data: any = {
          date: new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          fullDate: date,
        };
        
        allChannels.forEach((channel) => {
          const channelData = channelMap.get(channel) || { revenue: 0, units: 0 };
          data[channel] = channelData.revenue;
        });
        
        return data;
      })
      .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
  }, [allChannelsData]);

  // Calculate Daily Run Rate (DRR)
  const dailyRunRate = useMemo(() => {
    if (revenueTrend.length === 0) return { drr: 0, avgUnits: 0, avgOrders: 0 };
    
    const totalRevenue = revenueTrend.reduce((sum, d) => sum + d.revenue, 0);
    const totalUnits = revenueTrend.reduce((sum, d) => sum + d.units, 0);
    const totalOrders = revenueTrend.reduce((sum, d) => sum + d.orders, 0);
    const days = revenueTrend.length;
    
    return {
      drr: days > 0 ? totalRevenue / days : 0,
      avgUnits: days > 0 ? totalUnits / days : 0,
      avgOrders: days > 0 ? totalOrders / days : 0,
    };
  }, [revenueTrend]);

  // Calculate Growth Metrics
  const growthMetrics = useMemo(() => {
    if (revenueTrend.length < 2) return null;
    
    const sorted = [...revenueTrend].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
    
    const firstHalfRevenue = firstHalf.reduce((sum, d) => sum + d.revenue, 0);
    const secondHalfRevenue = secondHalf.reduce((sum, d) => sum + d.revenue, 0);
    const firstHalfUnits = firstHalf.reduce((sum, d) => sum + d.units, 0);
    const secondHalfUnits = secondHalf.reduce((sum, d) => sum + d.units, 0);
    
    const revenueGrowth = firstHalfRevenue > 0 
      ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100 
      : 0;
    const unitsGrowth = firstHalfUnits > 0 
      ? ((secondHalfUnits - firstHalfUnits) / firstHalfUnits) * 100 
      : 0;
    
    return {
      revenueGrowth,
      unitsGrowth,
      firstHalfRevenue,
      secondHalfRevenue,
      firstHalfUnits,
      secondHalfUnits,
    };
  }, [revenueTrend]);

  // Calculate Geographic Analysis (if city data available)
  const geographicAnalysis = useMemo(() => {
    const cityMap = new Map<string, { revenue: number; units: number; orders: number }>();
    
    allSalesData.forEach((row) => {
      // Try to get city from raw_data or brand field
      const city = (row as any).city || (row as any).location || 'Unknown';
      const current = cityMap.get(city) || { revenue: 0, units: 0, orders: 0 };
      cityMap.set(city, {
        revenue: current.revenue + (row.revenue || 0),
        units: current.units + (row.units || 0),
        orders: current.orders + 1,
      });
    });

    return Array.from(cityMap.entries())
      .map(([city, data]) => ({
        city,
        revenue: data.revenue,
        units: data.units,
        orders: data.orders,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10); // Top 10 cities
  }, [allSalesData]);

  // Chart colors
  const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // Table columns
  const columns: Column<SalesReportRow>[] = [
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
    // {
    //   key: 'item_id',
    //   header: 'ITEMID',
    //   render: (row) => (
    //     <div className="font-mono text-sm text-gray-700 dark:text-gray-300">
    //       {row.item_id || '-'}
    //     </div>
    //   ),
    // },
    {
      key: 'item_name',
      header: 'ITEMNAME',
      render: (row) => (
        <div className="text-sm text-gray-900 dark:text-white max-w-xs truncate" title={row.item_name}>
          {row.item_name || '-'}
        </div>
      ),
      className: 'min-w-[200px]',
    },
    {
      key: 'channel',
      header: 'Channel',
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 capitalize">
          {row.channel || '-'}
        </span>
      ),
    },
    {
      key: 'units',
      header: 'Units',
      render: (row) => (
        <div className="text-right font-medium text-gray-900 dark:text-white">
          {row.units.toLocaleString()}
        </div>
      ),
    },
    {
      key: 'revenue',
      header: 'Revenue',
      render: (row) => (
        <div className="text-right font-semibold text-gray-900 dark:text-white">
          ₹{row.revenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      key: 'drr',
      header: 'DRR',
      render: (row) => (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {row.drr || '-'}
        </div>
      ),
    },
    {
      key: 'brand',
      header: 'Brand',
      render: (row) => (
        <div className="text-sm text-gray-700 dark:text-gray-300">
          {row.brand || '-'}
        </div>
      ),
    },
  ];

  const buildSalesExportPayload = () => {
    const range = getDateRange();
    const start = range.start ?? 'all';
    const end = range.end ?? 'all';
    const ch = selectedChannel ? `_${selectedChannel}` : '';
    const base = `sales-report_${start}_${end}${ch}`;
    const headers = ['Date', 'ITEMNAME', 'Channel', 'Units', 'Revenue', 'DRR', 'Brand'];
    const dataRows = allSalesData.map((row) => [
      formatReportDate(row.date),
      row.item_name || '-',
      formatChannelLabel(row.channel),
      row.units,
      `₹${row.revenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
      row.drr || '-',
      row.brand || '-',
    ]);
    const periodLabel =
      range.start && range.end ? `${range.start} → ${range.end}` : 'All time (no date filter)';
    const marketplaceUpper = selectedChannel
      ? formatChannelLabel(selectedChannel).toUpperCase()
      : 'ALL CHANNELS';
    return { base, headers, dataRows, periodLabel, marketplaceUpper };
  };

  const handleExportSalesCsv = () => {
    if (!allSalesData.length) {
      addNotification('error', 'No data to export for the current filters');
      return;
    }
    const { base, headers, dataRows } = buildSalesExportPayload();
    exportAlignedTable(headers, dataRows, base, 'csv', 'Sales');
    addNotification('success', 'CSV download started');
  };

  const handleExportSalesExcel = async () => {
    if (!allSalesData.length) {
      addNotification('error', 'No data to export for the current filters');
      return;
    }
    const { base, headers, dataRows, periodLabel, marketplaceUpper } = buildSalesExportPayload();
    try {
      await downloadStyledAlignedReportExcel({
        headers,
        dataRows,
        filenameBase: base,
        sheetName: 'Sales',
        periodLabel,
        marketplaceUpper,
        titleBrand: salesExportTitle.trim() || undefined,
        tenantDisplayName: tenantName,
        fallbackPrefix: 'SALES REPORT',
      });
      addNotification('success', 'Excel downloaded (Main Dashboard–style header)');
    } catch (e) {
      console.error(e);
      addNotification('error', 'Excel export failed. Try again.');
    }
  };

  return (
    <>
      <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Reports</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Analyze sales performance, revenue, and channel metrics
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={salesExportTitle}
            onChange={(e) => setSalesExportTitle(e.target.value)}
            placeholder="Excel title (e.g. NOURISHYOU :- BIGBASKET)"
            title="Optional purple header. Empty = {Tenant} :- {Channel}"
            className="min-w-[200px] max-w-xs rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
          />
          <button
            type="button"
            onClick={() => handleExportSalesCsv()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => void handleExportSalesExcel()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Download Excel
          </button>
          <button
            onClick={() => setIsUploadDrawerOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Sales Report
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Date Range:
            </label>
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                if (e.target.value !== 'custom') {
                  setShowCustomDateRange(false);
                  setCustomStartDate('');
                  setCustomEndDate('');
                } else {
                  setShowCustomDateRange(true);
                }
              }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[150px]"
            >
              <option value="all">All time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Custom Date Range Picker */}
          {showCustomDateRange && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                From:
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                To:
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                min={customStartDate}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Channel:
            </label>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[150px]"
            >
              <option value="">All Channels</option>
              <option value="zepto">Zepto</option>
              <option value="flipkart">Flipkart</option>
              <option value="amazon">Amazon</option>
              <option value="blinkit">Blinkit</option>
              <option value="bigbasket">BigBasket</option>
              <option value="swiggy">Swiggy</option>
            </select>
          </div>

          {(selectedChannel || dateRange !== '30d' || (dateRange === 'custom' && (customStartDate || customEndDate))) && (
            <button
              onClick={() => {
                setSelectedChannel('');
                setDateRange('30d');
                setCustomStartDate('');
                setCustomEndDate('');
                setShowCustomDateRange(false);
              }}
              className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white underline"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                ₹{summary?.total_revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Units</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {summary?.total_units.toLocaleString() || '0'}
              </p>
            </div>
            <Package className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Orders</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {summary?.total_orders.toLocaleString() || '0'}
              </p>
            </div>
            <ShoppingCart className="h-8 w-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Products</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {summary?.total_products.toLocaleString() || '0'}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Analytics Section - Revenue by Channel */}
      {salesData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Revenue by Channel
            </h2>
          </div>
          
          {revenueByChannel.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie Chart */}
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={revenueByChannel}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {revenueByChannel.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                    />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>

              {/* Channel Details Table */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Channel Performance
                </h3>
                {revenueByChannel.map((channel, index) => {
                  const percentage = (channel.value / revenueByChannel.reduce((sum, c) => sum + c.value, 0)) * 100;
                  return (
                    <div key={channel.name} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                          />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {channel.name}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          ₹{channel.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>{percentage.toFixed(1)}% of total</span>
                        <span>•</span>
                        <span>{channel.units.toLocaleString()} units</span>
                        <span>•</span>
                        <span>{channel.orders} orders</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No channel data available
            </div>
          )}
        </div>
      )}

      {/* Analytics Section - Revenue Trend */}
      {salesData.length > 0 && revenueTrend.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <LineChartIcon className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Revenue Trend
            </h2>
          </div>
          
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs"
                  stroke="#6b7280"
                />
                <YAxis 
                  className="text-xs"
                  stroke="#6b7280"
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => [`₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 'Revenue']}
                  labelStyle={{ color: '#374151' }}
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Trend Summary */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Daily Revenue</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                ₹{revenueTrend.length > 0 
                  ? (revenueTrend.reduce((sum, d) => sum + d.revenue, 0) / revenueTrend.length).toLocaleString('en-IN', { maximumFractionDigits: 0 })
                  : '0'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Peak Day</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {revenueTrend.length > 0 
                  ? revenueTrend.reduce((max, d) => d.revenue > max.revenue ? d : max, revenueTrend[0]).date
                  : '-'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Peak Revenue</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                ₹{revenueTrend.length > 0 
                  ? revenueTrend.reduce((max, d) => d.revenue > max.revenue ? d : max, revenueTrend[0]).revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })
                  : '0'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Section - Top Products by Revenue */}
      {salesData.length > 0 && topProductsByRevenue.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Top Products by Revenue
            </h2>
          </div>
          
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart 
                data={topProductsByRevenue} 
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis 
                  type="number"
                  className="text-xs"
                  stroke="#6b7280"
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                />
                <YAxis 
                  type="category" 
                  dataKey="name"
                  className="text-xs"
                  stroke="#6b7280"
                  width={150}
                />
                <Tooltip
                  formatter={(value: number, name: string, props: any) => [
                    `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
                    'Revenue'
                  ]}
                  labelFormatter={(label) => `Product: ${label}`}
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="revenue" 
                  fill="#3b82f6"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Products Table */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Product Details
            </h3>
            <div className="space-y-2">
              {topProductsByRevenue.map((product, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={product.fullName}>
                        {product.fullName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {product.units.toLocaleString()} units • {product.orders} orders
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      ₹{product.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {((product.revenue / topProductsByRevenue.reduce((sum, p) => sum + p.revenue, 0)) * 100).toFixed(1)}% of total
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Section - Top Products by Units Sold */}
      {salesData.length > 0 && topProductsByUnits.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Top Products by Units Sold
            </h2>
          </div>
          
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart 
                data={topProductsByUnits} 
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis 
                  type="number"
                  className="text-xs"
                  stroke="#6b7280"
                />
                <YAxis 
                  type="category" 
                  dataKey="name"
                  className="text-xs"
                  stroke="#6b7280"
                  width={150}
                />
                <Tooltip
                  formatter={(value: number) => [`${value.toLocaleString()} units`, 'Units Sold']}
                  labelFormatter={(label) => `Product: ${label}`}
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="units" 
                  fill="#10b981"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Products Table */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Product Details
            </h3>
            <div className="space-y-2">
              {topProductsByUnits.map((product, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={product.fullName}>
                        {product.fullName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        ₹{product.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })} revenue • {product.orders} orders
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {product.units.toLocaleString()} units
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {((product.units / topProductsByUnits.reduce((sum, p) => sum + p.units, 0)) * 100).toFixed(1)}% of total
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Section - Channel Comparison */}
      {allChannelsData.length > 0 && channelComparison.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Channel Comparison
            </h2>
          </div>
          
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={channelComparison}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis 
                  dataKey="date"
                  className="text-xs"
                  stroke="#6b7280"
                />
                <YAxis 
                  className="text-xs"
                  stroke="#6b7280"
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                {Array.from(new Set(allChannelsData.map(d => d.channel).filter(Boolean))).map((channel, index) => (
                  <Bar 
                    key={channel}
                    dataKey={channel} 
                    stackId="a"
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                    name={channel.charAt(0).toUpperCase() + channel.slice(1)}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Analytics Section - Daily Run Rate & Growth Metrics */}
      {(dailyRunRate.drr > 0 || growthMetrics) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Run Rate */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Daily Run Rate (DRR)
              </h2>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Average Daily Revenue</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  ₹{dailyRunRate.drr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Units/Day</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {dailyRunRate.avgUnits.toFixed(1)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Orders/Day</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {dailyRunRate.avgOrders.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Growth Metrics */}
          {growthMetrics && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Growth Metrics
                </h2>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Revenue Growth</p>
                  <p className={`text-2xl font-bold ${growthMetrics.revenueGrowth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {growthMetrics.revenueGrowth >= 0 ? '+' : ''}{growthMetrics.revenueGrowth.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    First Half: ₹{growthMetrics.firstHalfRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })} → 
                    Second Half: ₹{growthMetrics.secondHalfRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Units Growth</p>
                  <p className={`text-2xl font-bold ${growthMetrics.unitsGrowth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {growthMetrics.unitsGrowth >= 0 ? '+' : ''}{growthMetrics.unitsGrowth.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    First Half: {growthMetrics.firstHalfUnits.toLocaleString()} → 
                    Second Half: {growthMetrics.secondHalfUnits.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analytics Section - Geographic Analysis */}
      {salesData.length > 0 && geographicAnalysis.length > 0 && geographicAnalysis[0].city !== 'Unknown' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Top Cities by Revenue
            </h2>
          </div>
          
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart 
                data={geographicAnalysis}
                margin={{ top: 5, right: 30, left: 20, bottom: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis 
                  dataKey="city"
                  className="text-xs"
                  stroke="#6b7280"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  className="text-xs"
                  stroke="#6b7280"
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="revenue" 
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* City Details Table */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              City Performance
            </h3>
            <div className="space-y-2">
              {geographicAnalysis.map((city, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {city.city}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {city.units.toLocaleString()} units • {city.orders} orders
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      ₹{city.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {((city.revenue / geographicAnalysis.reduce((sum, c) => sum + c.revenue, 0)) * 100).toFixed(1)}% of total
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sales Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Sales Data Report
          </h2>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Showing {((currentPage - 1) * recordsPerPage) + 1} - {Math.min(currentPage * recordsPerPage, totalRecords)} of {totalRecords} records
          </div>
        </div>
        <Table
          columns={columns}
          data={salesData}
          loading={loading}
          keyExtractor={(row, index) => `${row.date}-${row.item_id}-${index}`}
          emptyMessage="No sales data found. Upload a sales report to get started."
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
      </div>

      {/* Upload Drawer — does not auto-close so you can see success/error and failed rows */}
      <Drawer
        isOpen={isUploadDrawerOpen}
        onClose={() => setIsUploadDrawerOpen(false)}
        title="Upload Sales Report"
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
        <ReportUpload reportType="sales" onUploadComplete={handleUploadComplete} />
      </Drawer>
    </>
  );
}

