import { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardList, Truck, Building2, DollarSign, Upload, Package, CheckCircle, Clock, MapPin, Download, FileSpreadsheet } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { ReportUpload } from '../../components/reports/ReportUpload';
import { Table, type Column } from '../../components/ui/Table';
import { Drawer } from '../../components/ui/Drawer';
import { reportsApi, type POReportRow, type POSummary } from '../../services/api';
import {
  PieChart, Pie, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { exportAlignedTable, formatReportDate, formatChannelLabel } from '../../utils/reportExport';

export function POReports() {
  const { currentTheme, addNotification } = useAppStore();
  const tenantId = useAuthStore((s) => s.tenantId)!;
  const [dateRange, setDateRange] = useState('30d');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);
  const [poData, setPOData] = useState<POReportRow[]>([]); // Paginated data for table
  const [allPOData, setAllPOData] = useState<POReportRow[]>([]); // All data for analytics
  const [summary, setSummary] = useState<POSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [isUploadDrawerOpen, setIsUploadDrawerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const recordsPerPage = 50;

  // Calculate date range - Use local date format to avoid timezone issues
  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDateRange = useCallback(() => {
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      return { start: customStartDate, end: customEndDate };
    }

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

  // Load PO data
  const loadPOData = useCallback(async () => {
    setLoading(true);
    try {
      if (dateRange === 'custom' && (!customStartDate || !customEndDate)) {
        setLoading(false);
        return;
      }

      const { start, end } = getDateRange();
      const offset = (currentPage - 1) * recordsPerPage;
      
      const [paginatedData, allData, summaryData] = await Promise.all([
        // Fetch paginated data for table
        reportsApi.getPOReports(
          tenantId,
          selectedChannel || undefined,
          start,
          end,
          recordsPerPage,
          offset
        ),
        // Fetch all data for analytics (max 10000 records)
        reportsApi.getPOReports(
          tenantId,
          selectedChannel || undefined,
          start,
          end,
          10000,
          0
        ),
        // Fetch summary
        reportsApi.getPOSummary(
          tenantId,
          selectedChannel || undefined,
          start,
          end
        ),
      ]);
      setPOData(paginatedData);
      setAllPOData(allData);
      setSummary(summaryData);
      setTotalRecords(summaryData?.total_records || paginatedData.length);
    } catch (error: any) {
      console.error('Failed to load PO data:', error);
      addNotification('error', error.response?.data?.detail || 'Failed to load PO data');
    } finally {
      setLoading(false);
    }
  }, [dateRange, customStartDate, customEndDate, selectedChannel, currentPage, getDateRange, addNotification]);

  useEffect(() => {
    loadPOData();
  }, [loadPOData]);

  const handleUploadComplete = () => {
    // Reload data after upload (drawer stays open so user can see success/error and failed rows)
    setCurrentPage(1);
    loadPOData();
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange, selectedChannel, customStartDate, customEndDate]);

  // Get status badge color
  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('done') || statusLower.includes('completed')) {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    } else if (statusLower.includes('pending') || statusLower.includes('asn')) {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    } else {
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  // Chart colors
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
  const STATUS_COLORS: Record<string, string> = {
    'ASN_CREATED': '#F59E0B',
    'GRN_DONE': '#10B981',
    'PENDING': '#EF4444',
    'COMPLETED': '#3B82F6',
    'CANCELLED': '#6B7280',
  };

  // ============================================================================
  // ANALYTICS CALCULATIONS
  // ============================================================================

  // 1. PO Value by Channel
  const poValueByChannel = useMemo(() => {
    const channelMap = new Map<string, number>();
    allPOData.forEach(item => {
      const channel = item.channel || 'Unknown';
      const value = item.value || 0;
      channelMap.set(channel, (channelMap.get(channel) || 0) + value);
    });
    return Array.from(channelMap.entries())
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
      .sort((a, b) => b.value - a.value);
  }, [allPOData]);

  // 2. PO Status Distribution
  const poStatusDistribution = useMemo(() => {
    const statusMap = new Map<string, { count: number; value: number }>();
    allPOData.forEach(item => {
      const status = item.status || 'Unknown';
      const existing = statusMap.get(status) || { count: 0, value: 0 };
      existing.count += 1;
      existing.value += item.value || 0;
      statusMap.set(status, existing);
    });
    return Array.from(statusMap.entries())
      .map(([name, data]) => ({ name, count: data.count, value: data.value }))
      .sort((a, b) => b.count - a.count);
  }, [allPOData]);

  // 3. Top Locations by PO Value
  const topLocationsByValue = useMemo(() => {
    const locationMap = new Map<string, { value: number; units: number; count: number }>();
    allPOData.forEach(item => {
      const location = item.location || 'Unknown';
      const existing = locationMap.get(location) || { value: 0, units: 0, count: 0 };
      existing.value += item.value || 0;
      existing.units += item.units || 0;
      existing.count += 1;
      locationMap.set(location, existing);
    });
    return Array.from(locationMap.entries())
      .map(([name, data]) => ({ 
        name: name.length > 20 ? name.substring(0, 20) + '...' : name, 
        fullName: name,
        value: data.value, 
        units: data.units,
        count: data.count
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [allPOData]);

  // 4. Top Products by PO Value
  const topProductsByValue = useMemo(() => {
    const productMap = new Map<string, { name: string; value: number; units: number }>();
    allPOData.forEach(item => {
      const skuId = item.sku_id || 'Unknown';
      const name = item.product_name || skuId;
      const existing = productMap.get(skuId) || { name, value: 0, units: 0 };
      existing.value += item.value || 0;
      existing.units += item.units || 0;
      productMap.set(skuId, existing);
    });
    return Array.from(productMap.entries())
      .map(([sku, data]) => ({ sku, name: data.name, value: data.value, units: data.units }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [allPOData]);

  // 5. PO Fulfillment Rate (ASN vs GRN)
  const fulfillmentMetrics = useMemo(() => {
    let totalASN = 0;
    let totalGRN = 0;
    let totalUnits = 0;
    
    allPOData.forEach(item => {
      totalASN += item.asn_quantity || 0;
      totalGRN += item.grn_quantity || 0;
      totalUnits += item.units || 0;
    });
    
    const fulfillmentRate = totalASN > 0 ? ((totalGRN / totalASN) * 100) : 0;
    const asnRate = totalUnits > 0 ? ((totalASN / totalUnits) * 100) : 0;
    
    return {
      totalASN,
      totalGRN,
      totalUnits,
      fulfillmentRate,
      asnRate,
      pendingGRN: totalASN - totalGRN
    };
  }, [allPOData]);

  // 6. PO Trend (by PO number since dates might be null)
  const poTrend = useMemo(() => {
    const poMap = new Map<string, { value: number; units: number }>();
    allPOData.forEach(item => {
      const poNumber = item.po_number || 'Unknown';
      const existing = poMap.get(poNumber) || { value: 0, units: 0 };
      existing.value += item.value || 0;
      existing.units += item.units || 0;
      poMap.set(poNumber, existing);
    });
    return Array.from(poMap.entries())
      .map(([po_number, data]) => ({ po_number, value: data.value, units: data.units }))
      .slice(0, 15); // Show last 15 POs
  }, [allPOData]);

  // 7. Units vs Value by Channel
  const channelComparison = useMemo(() => {
    const channelMap = new Map<string, { units: number; value: number }>();
    allPOData.forEach(item => {
      const channel = item.channel || 'Unknown';
      const existing = channelMap.get(channel) || { units: 0, value: 0 };
      existing.units += item.units || 0;
      existing.value += item.value || 0;
      channelMap.set(channel, existing);
    });
    return Array.from(channelMap.entries())
      .map(([name, data]) => ({ 
        name: name.charAt(0).toUpperCase() + name.slice(1), 
        units: data.units, 
        value: Math.round(data.value / 1000) // Convert to thousands for better visualization
      }))
      .sort((a, b) => b.value - a.value);
  }, [allPOData]);

  // 8. PO Health Metrics
  const poHealthMetrics = useMemo(() => {
    const totalValue = allPOData.reduce((sum, item) => sum + (item.value || 0), 0);
    const totalUnits = allPOData.reduce((sum, item) => sum + (item.units || 0), 0);
    const uniquePOs = new Set(poData.map(item => item.po_number)).size;
    const uniqueLocations = new Set(poData.map(item => item.location)).size;
    const uniqueChannels = new Set(poData.map(item => item.channel)).size;
    const uniqueSKUs = new Set(poData.map(item => item.sku_id)).size;
    const avgPOValue = uniquePOs > 0 ? totalValue / uniquePOs : 0;
    const completedPOs = poStatusDistribution.find(s => s.name.toLowerCase().includes('done') || s.name.toLowerCase().includes('completed'))?.count || 0;
    const pendingPOs = uniquePOs - completedPOs;
    
    return {
      totalValue,
      totalUnits,
      uniquePOs,
      uniqueLocations,
      uniqueChannels,
      uniqueSKUs,
      avgPOValue,
      completedPOs,
      pendingPOs
    };
  }, [poData, poStatusDistribution]);

  // Table columns
  const columns: Column<POReportRow>[] = [
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
      header: 'Channel',
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 capitalize">
          {row.channel || '-'}
        </span>
      ),
    },
    {
      key: 'po_number',
      header: 'PO Number',
      render: (row) => (
        <div className="font-mono text-sm font-medium text-gray-900 dark:text-white">
          {row.po_number || '-'}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(row.status)}`}>
          {row.status || '-'}
        </span>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (row) => (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {row.location || '-'}
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      render: (row) => (
        <div className="text-right font-semibold text-gray-900 dark:text-white">
          ₹{row.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      key: 'sku_id',
      header: 'SKU ID',
      render: (row) => (
        <div className="font-mono text-xs text-gray-700 dark:text-gray-300">
          {row.sku_id || '-'}
        </div>
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
  ];

  const handleExportPO = (format: 'csv' | 'xlsx') => {
    if (!allPOData.length) {
      addNotification('error', 'No data to export for the current filters');
      return;
    }
    const { start, end } = getDateRange();
    const ch = selectedChannel ? `_${selectedChannel}` : '';
    const base = `po-report_${start}_${end}${ch}`;
    const headers = [
      'Date',
      'Channel',
      'PO Number',
      'Status',
      'Location',
      'Value',
      'SKU ID',
      'Units',
    ];
    const dataRows = allPOData.map((row) => [
      formatReportDate(row.date),
      formatChannelLabel(row.channel),
      row.po_number || '-',
      row.status || '-',
      row.location || '-',
      `₹${row.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
      row.sku_id || '-',
      row.units,
    ]);
    exportAlignedTable(headers, dataRows, base, format, 'PO');
    addNotification('success', format === 'csv' ? 'CSV download started' : 'Excel download started');
  };

  return (
    <>
      <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Purchase Order Reports</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track purchase orders, status, locations, and values
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleExportPO('csv')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => handleExportPO('xlsx')}
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
            Upload PO Report
          </button>
        </div>
      </div>

      {/* Filters */}
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
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {showCustomDateRange && (
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">From:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">To:</label>
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
              type="button"
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Total POs</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {summary?.total_pos.toLocaleString() || '0'}
              </p>
            </div>
            <ClipboardList className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {summary?.pending_pos.toLocaleString() || '0'}
              </p>
            </div>
            <Truck className="h-8 w-8 text-orange-500" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Value</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                ₹{summary?.total_value.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Locations</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {summary?.total_locations.toLocaleString() || '0'}
              </p>
            </div>
            <Building2 className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* ============================================================================ */}
      {/* ANALYTICS SECTION */}
      {/* ============================================================================ */}

      {poData.length > 0 && (
        <>
          {/* Row 1: PO Value by Channel (Pie) + PO Status Distribution (Donut) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PO Value by Channel */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                PO Value by Channel
              </h3>
              <div className="flex items-center gap-6">
                <div className="w-1/2 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={poValueByChannel}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {poValueByChannel.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-2">
                  {poValueByChannel.map((channel, index) => (
                    <div key={channel.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">{channel.name}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        ₹{(channel.value / 1000).toFixed(1)}K
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* PO Status Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                PO Status Distribution
              </h3>
              <div className="flex items-center gap-6">
                <div className="w-1/2 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={poStatusDistribution}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="count"
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {poStatusDistribution.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} 
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number, name: string) => [value, name === 'count' ? 'POs' : name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-2">
                  {poStatusDistribution.map((status, index) => (
                    <div key={status.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: STATUS_COLORS[status.name] || COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">{status.name}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {status.count} POs
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Top Locations + Top Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Locations by PO Value */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Top Locations by PO Value
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topLocationsByValue} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 12 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      tick={{ fill: '#9CA3AF', fontSize: 10 }} 
                      width={100}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Value']}
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#F9FAFB' }}
                    />
                    <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Products by PO Value */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Top Products by PO Value
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProductsByValue} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 12 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      tick={{ fill: '#9CA3AF', fontSize: 10 }} 
                      width={120}
                      tickFormatter={(value) => value.length > 18 ? value.substring(0, 18) + '...' : value}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Value']}
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#F9FAFB' }}
                    />
                    <Bar dataKey="value" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 3: Fulfillment Rate + PO Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PO Fulfillment Rate */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                PO Fulfillment Status
              </h3>
              <div className="space-y-6">
                {/* ASN Rate */}
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">ASN Created Rate</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {fulfillmentMetrics.asnRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-yellow-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(fulfillmentMetrics.asnRate, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {fulfillmentMetrics.totalASN.toLocaleString()} / {fulfillmentMetrics.totalUnits.toLocaleString()} units
                  </p>
                </div>

                {/* GRN Rate */}
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">GRN Completion Rate</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {fulfillmentMetrics.fulfillmentRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-green-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(fulfillmentMetrics.fulfillmentRate, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {fulfillmentMetrics.totalGRN.toLocaleString()} / {fulfillmentMetrics.totalASN.toLocaleString()} ASN units
                  </p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-600">{fulfillmentMetrics.totalASN.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">ASN Units</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{fulfillmentMetrics.totalGRN.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">GRN Units</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{fulfillmentMetrics.pendingGRN.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Pending GRN</p>
                  </div>
                </div>
              </div>
            </div>

            {/* PO Value Trend */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                PO Value by Order
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={poTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis 
                      dataKey="po_number" 
                      tick={{ fill: '#9CA3AF', fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name === 'value' ? `₹${value.toLocaleString('en-IN')}` : value.toLocaleString(),
                        name === 'value' ? 'Value' : 'Units'
                      ]}
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#F9FAFB' }}
                    />
                    <Bar dataKey="value" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 4: Channel Comparison */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Units vs Value by Channel
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelComparison} margin={{ bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === 'value' ? `₹${(value * 1000).toLocaleString('en-IN')}` : value.toLocaleString(),
                      name === 'value' ? 'Value' : 'Units'
                    ]}
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#F9FAFB' }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="units" fill="#3B82F6" name="Units" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="value" fill="#10B981" name="Value (₹K)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 5: PO Health Overview */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              PO Health Overview
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  ₹{(poHealthMetrics.totalValue / 100000).toFixed(1)}L
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Value</p>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {poHealthMetrics.totalUnits.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Units</p>
              </div>
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {poHealthMetrics.uniquePOs}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Unique POs</p>
              </div>
              <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {poHealthMetrics.uniqueLocations}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Locations</p>
              </div>
              <div className="text-center p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
                <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                  ₹{(poHealthMetrics.avgPOValue / 1000).toFixed(1)}K
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg PO Value</p>
              </div>
              <div className={`text-center p-4 rounded-lg ${
                poHealthMetrics.pendingPOs > 0 
                  ? 'bg-yellow-50 dark:bg-yellow-900/20' 
                  : 'bg-green-50 dark:bg-green-900/20'
              }`}>
                <p className={`text-2xl font-bold ${
                  poHealthMetrics.pendingPOs > 0 
                    ? 'text-yellow-600 dark:text-yellow-400' 
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  {poHealthMetrics.pendingPOs}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Pending POs</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* PO Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Purchase Order Data Report
          </h2>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Showing {((currentPage - 1) * recordsPerPage) + 1} - {Math.min(currentPage * recordsPerPage, totalRecords)} of {totalRecords} records
          </div>
        </div>
        <Table
          columns={columns}
          data={poData}
          loading={loading}
          keyExtractor={(row, index) => `${row.date}-${row.po_number}-${row.sku_id}-${index}`}
          emptyMessage="No PO data found. Upload a PO report to get started."
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
        title="Upload PO Report"
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
        <ReportUpload reportType="po" onUploadComplete={handleUploadComplete} />
      </Drawer>
    </>
  );
}

