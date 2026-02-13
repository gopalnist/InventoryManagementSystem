import { useState, useEffect } from 'react';
import { 
  BarChart3, Package, AlertTriangle, TrendingDown, IndianRupee,
  Building2, Clock, ShoppingCart, Truck, RefreshCw
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAppStore } from '../store/appStore';
import { inventoryReportsApi, type DashboardStats, type LowStockReport } from '../services/api';

type ReportTab = 'dashboard' | 'low-stock' | 'aging' | 'valuation';

export function InventoryReports() {
  const { addNotification } = useAppStore();
  
  // State
  const [activeTab, setActiveTab] = useState<ReportTab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardStats | null>(null);
  const [lowStockData, setLowStockData] = useState<LowStockReport | null>(null);

  // Load data
  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await inventoryReportsApi.getDashboard();
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      addNotification('error', 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadLowStock = async () => {
    setLoading(true);
    try {
      const data = await inventoryReportsApi.getLowStock();
      setLowStockData(data);
    } catch (error) {
      console.error('Failed to load low stock report:', error);
      addNotification('error', 'Failed to load low stock report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboard();
    } else if (activeTab === 'low-stock') {
      loadLowStock();
    }
  }, [activeTab]);

  // Tabs
  const tabs = [
    { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { key: 'low-stock', label: 'Low Stock', icon: AlertTriangle },
    { key: 'aging', label: 'Stock Aging', icon: Clock },
    { key: 'valuation', label: 'Valuation', icon: IndianRupee },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as ReportTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : dashboardData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Total Products</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {dashboardData.total_products.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <IndianRupee className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Stock Value</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        ₹{dashboardData.total_stock_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Low Stock Items</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {dashboardData.low_stock_count}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Out of Stock</p>
                      <p className="text-2xl font-bold text-red-600">
                        {dashboardData.out_of_stock_count}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Stock by Warehouse */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-gray-400" />
                    Stock by Warehouse
                  </h3>
                  <div className="space-y-3">
                    {dashboardData.stock_by_warehouse.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No warehouse data</p>
                    ) : (
                      dashboardData.stock_by_warehouse.map((wh, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{wh.name}</div>
                            <div className="text-xs text-gray-500">{wh.code} • {wh.product_count} products</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900 dark:text-white">
                              ₹{wh.total_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Stock by Category */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-gray-400" />
                    Stock by Category
                  </h3>
                  <div className="space-y-3">
                    {dashboardData.stock_by_category.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No category data</p>
                    ) : (
                      dashboardData.stock_by_category.map((cat, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{cat.name}</div>
                            <div className="text-xs text-gray-500">{cat.product_count} products</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900 dark:text-white">
                              ₹{cat.total_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Top Products */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Top Products by Value
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3 text-right">Quantity</th>
                        <th className="px-4 py-3 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {dashboardData.top_products.map((product, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 dark:text-white">{product.name}</div>
                            <div className="text-xs text-gray-500">{product.sku}</div>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                            {product.total_qty.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                            ₹{product.total_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Movements */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-gray-400" />
                  Recent Movements
                </h3>
                {dashboardData.recent_movements.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No recent movements</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <th className="px-4 py-3">Product</th>
                          <th className="px-4 py-3">Warehouse</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3 text-right">Quantity</th>
                          <th className="px-4 py-3">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {dashboardData.recent_movements.map((movement, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900 dark:text-white">{movement.product_name}</div>
                              <div className="text-xs text-gray-500">{movement.product_sku}</div>
                            </td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                              {movement.warehouse_name}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                movement.type === 'in' ? 'bg-green-100 text-green-700' :
                                movement.type === 'out' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {movement.type.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                              {movement.quantity.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {new Date(movement.created_at).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Low Stock Tab */}
      {activeTab === 'low-stock' && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : lowStockData ? (
            <>
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Total Low Stock</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {lowStockData.total}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Critical</p>
                      <p className="text-2xl font-bold text-red-600">
                        {lowStockData.critical_count}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Warning</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {lowStockData.warning_count}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Low Stock Items */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Warehouse</th>
                        <th className="px-4 py-3 text-right">On Hand</th>
                        <th className="px-4 py-3 text-right">Available</th>
                        <th className="px-4 py-3 text-right">Reorder At</th>
                        <th className="px-4 py-3 text-right">Shortage</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {lowStockData.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 dark:text-white">{item.product_name}</div>
                            <div className="text-xs text-gray-500">{item.product_sku}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                            {item.warehouse_name}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                            {item.on_hand_qty.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                            {item.available_qty.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500">
                            {item.reorder_level.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-red-600 font-medium">
                            -{item.shortage.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              item.severity === 'critical' 
                                ? 'bg-red-100 text-red-700' 
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {item.severity.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Aging Tab Placeholder */}
      {activeTab === 'aging' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Stock Aging Report
          </h3>
          <p className="text-gray-500">
            Coming soon - Identify slow-moving and dead stock
          </p>
        </div>
      )}

      {/* Valuation Tab Placeholder */}
      {activeTab === 'valuation' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <IndianRupee className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Inventory Valuation Report
          </h3>
          <p className="text-gray-500">
            Coming soon - Detailed stock valuation by category and warehouse
          </p>
        </div>
      )}
    </div>
  );
}


