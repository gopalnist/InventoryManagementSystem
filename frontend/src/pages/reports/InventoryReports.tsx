import { useState, useEffect, useCallback, useMemo } from 'react';
import { Warehouse, Package, TrendingDown, DollarSign, Box, Upload, MapPin, BarChart3, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { ReportUpload } from '../../components/reports/ReportUpload';
import { Table, type Column } from '../../components/ui/Table';
import { Drawer } from '../../components/ui/Drawer';
import { reportsApi, type InventoryReportRow, type InventorySummary } from '../../services/api';
import {
  PieChart, Pie, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

export function InventoryReports() {
  const { currentTheme, addNotification } = useAppStore();
  const tenantId = useAuthStore((s) => s.tenantId)!;
  const [dateRange, setDateRange] = useState('30d');
  const [inventoryData, setInventoryData] = useState<InventoryReportRow[]>([]); // Paginated data for table
  const [allInventoryData, setAllInventoryData] = useState<InventoryReportRow[]>([]); // All data for analytics
  const [summary, setSummary] = useState<InventorySummary | null>(null);
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
  }, [dateRange]);

  // Load inventory data
  const loadInventoryData = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      const offset = (currentPage - 1) * recordsPerPage;
      
      const [paginatedData, allData, summaryData] = await Promise.all([
        // Fetch paginated data for table
        reportsApi.getInventoryReports(
          tenantId,
          selectedChannel || undefined,
          start,
          end,
          recordsPerPage,
          offset
        ),
        // Fetch all data for analytics (max 10000 records)
        reportsApi.getInventoryReports(
          tenantId,
          selectedChannel || undefined,
          start,
          end,
          10000,
          0
        ),
        // Fetch summary
        reportsApi.getInventorySummary(
          tenantId,
          selectedChannel || undefined,
          start,
          end
        ),
      ]);
      setInventoryData(paginatedData);
      setAllInventoryData(allData);
      setSummary(summaryData);
      setTotalRecords(summaryData?.total_records || paginatedData.length);
    } catch (error: any) {
      console.error('Failed to load inventory data:', error);
      addNotification('error', error.response?.data?.detail || 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedChannel, currentPage, getDateRange, addNotification]);

  useEffect(() => {
    loadInventoryData();
  }, [loadInventoryData]);

  const handleUploadComplete = () => {
    // Reload data after upload (drawer stays open so user can see success/error and failed rows)
    setCurrentPage(1);
    loadInventoryData();
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange, selectedChannel]);

  // Chart colors
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

  // ============================================================================
  // ANALYTICS CALCULATIONS
  // ============================================================================

  // 1. Stock Distribution by Channel
  const stockByChannel = useMemo(() => {
    const channelMap = new Map<string, number>();
    allInventoryData.forEach(item => {
      const channel = item.channel || 'Unknown';
      const qty = item.inventory || 0;
      channelMap.set(channel, (channelMap.get(channel) || 0) + qty);
    });
    return Array.from(channelMap.entries())
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
      .sort((a, b) => b.value - a.value);
  }, [allInventoryData]);

  // 2. Stock by City (Top 10)
  const stockByCity = useMemo(() => {
    const cityMap = new Map<string, number>();
    allInventoryData.forEach(item => {
      const city = item.city || 'Unknown';
      const qty = item.inventory || 0;
      cityMap.set(city, (cityMap.get(city) || 0) + qty);
    });
    return Array.from(cityMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [allInventoryData]);

  // 3. Inventory Trend (by date)
  const inventoryTrend = useMemo(() => {
    const dateMap = new Map<string, number>();
    allInventoryData.forEach(item => {
      if (item.date) {
        const dateKey = item.date.split('T')[0];
        const qty = item.inventory || 0;
        dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + qty);
      }
    });
    return Array.from(dateMap.entries())
      .map(([date, inventory]) => ({ date, inventory }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [allInventoryData]);

  // 4. Top Products by Stock
  const topProductsByStock = useMemo(() => {
    const productMap = new Map<string, { name: string; stock: number }>();
    allInventoryData.forEach(item => {
      const sku = item.sku || 'Unknown';
      const name = item.product_name || sku;
      const qty = item.inventory || 0;
      const existing = productMap.get(sku);
      if (existing) {
        existing.stock += qty;
      } else {
        productMap.set(sku, { name, stock: qty });
      }
    });
    return Array.from(productMap.entries())
      .map(([sku, data]) => ({ sku, name: data.name, stock: data.stock }))
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 10);
  }, [allInventoryData]);

  // 5. Low Stock Products (bottom 10)
  const lowStockProducts = useMemo(() => {
    const productMap = new Map<string, { name: string; stock: number; city: string }>();
    allInventoryData.forEach(item => {
      const key = `${item.sku}-${item.city}`;
      const qty = item.inventory || 0;
      if (!productMap.has(key) || qty < (productMap.get(key)?.stock || Infinity)) {
        productMap.set(key, { 
          name: item.product_name || item.sku || 'Unknown', 
          stock: qty,
          city: item.city || 'Unknown'
        });
      }
    });
    return Array.from(productMap.values())
      .filter(p => p.stock <= 10) // Low stock threshold
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10);
  }, [allInventoryData]);

  // 6. Stock Concentration (top 5 cities percentage)
  const stockConcentration = useMemo(() => {
    const totalStock = allInventoryData.reduce((sum, item) => sum + (item.inventory || 0), 0);
    const top5Stock = stockByCity.slice(0, 5).reduce((sum, city) => sum + city.value, 0);
    const otherStock = totalStock - top5Stock;
    
    const result = stockByCity.slice(0, 5).map(city => ({
      name: city.name,
      value: city.value,
      percentage: totalStock > 0 ? ((city.value / totalStock) * 100).toFixed(1) : '0'
    }));
    
    if (otherStock > 0) {
      result.push({
        name: 'Other Cities',
        value: otherStock,
        percentage: totalStock > 0 ? ((otherStock / totalStock) * 100).toFixed(1) : '0'
      });
    }
    
    return result;
  }, [stockByCity, inventoryData]);

  // 7. City-Channel Matrix
  const cityChannelMatrix = useMemo(() => {
    const matrix = new Map<string, Map<string, number>>();
    const channels = new Set<string>();
    
    allInventoryData.forEach(item => {
      const city = item.city || 'Unknown';
      const channel = item.channel || 'Unknown';
      const qty = item.inventory || 0;
      
      channels.add(channel);
      
      if (!matrix.has(city)) {
        matrix.set(city, new Map());
      }
      const cityMap = matrix.get(city)!;
      cityMap.set(channel, (cityMap.get(channel) || 0) + qty);
    });
    
    // Get top 8 cities by total stock
    const cityTotals = Array.from(matrix.entries())
      .map(([city, channelMap]) => ({
        city,
        total: Array.from(channelMap.values()).reduce((a, b) => a + b, 0)
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
    
    return cityTotals.map(({ city }) => {
      const channelMap = matrix.get(city)!;
      const row: any = { city };
      channels.forEach(channel => {
        row[channel] = channelMap.get(channel) || 0;
      });
      return row;
    });
  }, [allInventoryData]);

  // 8. Stock Health Metrics
  const stockHealthMetrics = useMemo(() => {
    const totalStock = allInventoryData.reduce((sum, item) => sum + (item.inventory || 0), 0);
    const uniqueSKUs = new Set(inventoryData.map(item => item.sku)).size;
    const uniqueCities = new Set(inventoryData.map(item => item.city)).size;
    const uniqueChannels = new Set(inventoryData.map(item => item.channel)).size;
    const avgStockPerSKU = uniqueSKUs > 0 ? totalStock / uniqueSKUs : 0;
    const lowStockCount = lowStockProducts.length;
    
    return {
      totalStock,
      uniqueSKUs,
      uniqueCities,
      uniqueChannels,
      avgStockPerSKU,
      lowStockCount
    };
  }, [inventoryData, lowStockProducts]);

  // Table columns - Based on image: Date, SKU, Inventory, Sellable, Unsellable, Units, Value
  // Since sellable/unsellable not in DB, using: Date, SKU, Product Name, Channel, Quantity (Units), City, Location
  const columns: Column<InventoryReportRow>[] = [
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
    //   key: 'sku',
    //   header: 'SKU',
    //   render: (row) => (
    //     <div className="font-mono text-sm text-gray-700 dark:text-gray-300">
    //       {row.sku || '-'}
    //     </div>
    //   ),
    // },
    {
      key: 'product_name',
      header: 'Product Name',
      render: (row) => (
        <div className="text-sm text-gray-900 dark:text-white max-w-xs truncate" title={row.product_name}>
          {row.product_name || '-'}
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
      key: 'inventory',
      header: 'Inventory',
      render: (row) => {
        const qty = row.inventory || (row as any).quantity || 0;
        return (
          <div className="text-right font-medium text-gray-900 dark:text-white">
            {qty.toLocaleString()}
          </div>
        );
      },
    },
    {
      key: 'units',
      header: 'Units',
      render: (row) => {
        const qty = row.inventory || (row as any).quantity || 0;
        return (
          <div className="text-right font-medium text-gray-900 dark:text-white">
            {qty.toLocaleString()}
          </div>
        );
      },
    },
    {
      key: 'city',
      header: 'City',
      render: (row) => (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {row.city || '-'}
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (row) => (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {row.location || row.warehouse_code || '-'}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory Reports</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Analyze inventory levels, stock status, and warehouse metrics
          </p>
        </div>
        <button
          onClick={() => setIsUploadDrawerOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Inventory Report
        </button>
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
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[150px]"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
          </div>

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
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400" title="Sum of quantity (units) across all inventory rows">Total Inventory</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {summary?.total_inventory.toLocaleString() || '0'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Sum of units across all rows</p>
            </div>
            <Warehouse className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Products</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {summary?.total_products.toLocaleString() || '0'}
              </p>
            </div>
            <Package className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Cities Covered</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stockHealthMetrics.uniqueCities || '0'}
              </p>
            </div>
            <MapPin className="h-8 w-8 text-orange-500" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Stock/SKU</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stockHealthMetrics.avgStockPerSKU.toFixed(0)}
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* ============================================================================ */}
      {/* ANALYTICS SECTION */}
      {/* ============================================================================ */}

      {inventoryData.length > 0 && (
        <>
          {/* Row 1: Stock by Channel (Pie) + Stock by City (Bar) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stock Distribution by Channel */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Stock Distribution by Channel
              </h3>
              <div className="flex items-center gap-6">
                <div className="w-1/2 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stockByChannel}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {stockByChannel.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-2">
                  {stockByChannel.map((channel, index) => (
                    <div key={channel.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">{channel.name}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {channel.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Stock by City (Top 10) */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Top 10 Cities by Stock
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stockByCity} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      tick={{ fill: '#9CA3AF', fontSize: 11 }} 
                      width={55}
                    />
                    <Tooltip 
                      formatter={(value: number) => [value.toLocaleString(), 'Stock']}
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#F9FAFB' }}
                    />
                    <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 2: Inventory Trend + Top Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Inventory Trend */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Inventory Trend
              </h3>
              {inventoryTrend.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={inventoryTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fill: '#9CA3AF', fontSize: 11 }}
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                      <Tooltip 
                        formatter={(value: number) => [value.toLocaleString(), 'Inventory']}
                        labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                        labelStyle={{ color: '#F9FAFB' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="inventory" 
                        stroke="#10B981" 
                        strokeWidth={2}
                        dot={{ fill: '#10B981', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  No trend data available
                </div>
              )}
            </div>

            {/* Top Products by Stock */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Top Products by Stock
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProductsByStock} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      tick={{ fill: '#9CA3AF', fontSize: 10 }} 
                      width={120}
                      tickFormatter={(value) => value.length > 18 ? value.substring(0, 18) + '...' : value}
                    />
                    <Tooltip 
                      formatter={(value: number) => [value.toLocaleString(), 'Stock']}
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#F9FAFB' }}
                    />
                    <Bar dataKey="stock" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 3: Stock Concentration + Low Stock Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stock Concentration */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Stock Concentration by City
              </h3>
              <div className="flex items-center gap-6">
                <div className="w-1/2 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stockConcentration}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percentage }) => `${percentage}%`}
                        labelLine={false}
                      >
                        {stockConcentration.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-2">
                  {stockConcentration.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">{item.name}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Low Stock Alerts */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Low Stock Alerts (≤10 units)
                </h3>
              </div>
              {lowStockProducts.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {lowStockProducts.map((product, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {product.city}
                        </p>
                      </div>
                      <div className={`ml-4 px-3 py-1 rounded-full text-sm font-bold ${
                        product.stock === 0 
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                        {product.stock} units
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-green-500">
                  <div className="text-center">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>All products have healthy stock levels!</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 4: City-Channel Matrix */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              City-Channel Stock Matrix (Top 8 Cities)
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cityChannelMatrix} margin={{ bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis 
                    dataKey="city" 
                    tick={{ fill: '#9CA3AF', fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number) => value.toLocaleString()}
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#F9FAFB' }}
                  />
                  <Legend />
                  {stockByChannel.map((channel, index) => (
                    <Bar 
                      key={channel.name.toLowerCase()}
                      dataKey={channel.name.toLowerCase()} 
                      stackId="a"
                      fill={COLORS[index % COLORS.length]} 
                      name={channel.name}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 5: Stock Health Metrics */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Stock Health Overview
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stockHealthMetrics.totalStock.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Stock</p>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stockHealthMetrics.uniqueSKUs}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Unique SKUs</p>
              </div>
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {stockHealthMetrics.uniqueCities}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Cities</p>
              </div>
              <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {stockHealthMetrics.uniqueChannels}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Channels</p>
              </div>
              <div className="text-center p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
                <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                  {stockHealthMetrics.avgStockPerSKU.toFixed(0)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Stock/SKU</p>
              </div>
              <div className={`text-center p-4 rounded-lg ${
                stockHealthMetrics.lowStockCount > 0 
                  ? 'bg-red-50 dark:bg-red-900/20' 
                  : 'bg-green-50 dark:bg-green-900/20'
              }`}>
                <p className={`text-2xl font-bold ${
                  stockHealthMetrics.lowStockCount > 0 
                    ? 'text-red-600 dark:text-red-400' 
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  {stockHealthMetrics.lowStockCount}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Low Stock Items</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Inventory Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Inventory Data Report
          </h2>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Showing {((currentPage - 1) * recordsPerPage) + 1} - {Math.min(currentPage * recordsPerPage, totalRecords)} of {totalRecords} records
          </div>
        </div>
        <Table
          columns={columns}
          data={inventoryData}
          loading={loading}
          keyExtractor={(row, index) => `${row.date}-${row.sku}-${index}`}
          emptyMessage="No inventory data found. Upload an inventory report to get started."
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
        title="Upload Inventory Report"
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
        <ReportUpload reportType="inventory" onUploadComplete={handleUploadComplete} />
      </Drawer>
    </>
  );
}

