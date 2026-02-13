import { useState, useEffect, useCallback } from 'react';
import { 
  Search, Package, AlertTriangle, TrendingDown, IndianRupee,
  Building2, Filter, Download, ArrowUpDown, Eye
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, type Column } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { useAppStore } from '../store/appStore';
import { 
  inventoryApi, warehousesApi,
  type InventoryItem, type InventorySummary, type Warehouse, type ProductStockSummary
} from '../services/api';

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

export function Inventory() {
  const { addNotification } = useAppStore();
  
  // State
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortBy, setSortBy] = useState<string>('product_name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Detail modal
  const [selectedProduct, setSelectedProduct] = useState<ProductStockSummary | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load data
  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const [inventoryRes, summaryRes] = await Promise.all([
        inventoryApi.list({ 
          page, 
          limit: 50, 
          search: search || undefined,
          warehouse_id: selectedWarehouse || undefined,
          stock_status: stockFilter !== 'all' ? stockFilter : undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
        }),
        inventoryApi.getSummary(),
      ]);
      setItems(inventoryRes.items);
      setTotal(inventoryRes.total);
      setSummary(summaryRes);
    } catch (error) {
      console.error('Failed to load inventory:', error);
      addNotification('error', 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedWarehouse, stockFilter, sortBy, sortOrder, addNotification]);

  const loadWarehouses = async () => {
    try {
      const res = await warehousesApi.list({ limit: 100 });
      setWarehouses(res.warehouses);
    } catch (error) {
      console.error('Failed to load warehouses:', error);
    }
  };

  useEffect(() => {
    loadWarehouses();
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // View product stock details
  const handleViewProduct = async (item: InventoryItem) => {
    setLoadingDetail(true);
    setShowDetailModal(true);
    try {
      const productStock = await inventoryApi.getProductStock(item.product_id);
      setSelectedProduct(productStock);
    } catch (error) {
      addNotification('error', 'Failed to load product stock details');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Get stock status badge
  const getStockStatusBadge = (status: string) => {
    switch (status) {
      case 'in_stock':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            In Stock
          </span>
        );
      case 'low_stock':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Low Stock
          </span>
        );
      case 'out_of_stock':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            Out of Stock
          </span>
        );
      default:
        return null;
    }
  };

  // Table columns
  const columns: Column<InventoryItem>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (item) => (
        <div className="flex items-center gap-3">
          {item.product_image ? (
            <img 
              src={item.product_image} 
              alt={item.product_name}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <Package className="w-5 h-5 text-gray-400" />
            </div>
          )}
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{item.product_name}</div>
            <div className="text-xs text-gray-500">{item.product_sku}</div>
          </div>
        </div>
      ),
      className: 'min-w-[250px]',
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (item) => (
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <Building2 className="w-4 h-4 text-gray-400" />
          <div>
            <div className="font-medium">{item.warehouse_code}</div>
            <div className="text-xs text-gray-500">{item.warehouse_name}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'on_hand',
      header: 'On Hand',
      render: (item) => (
        <div className="text-right font-medium text-gray-900 dark:text-white">
          {item.on_hand_qty.toLocaleString()}
        </div>
      ),
    },
    {
      key: 'reserved',
      header: 'Reserved',
      render: (item) => (
        <div className="text-right text-gray-600 dark:text-gray-400">
          {item.reserved_qty.toLocaleString()}
        </div>
      ),
    },
    {
      key: 'available',
      header: 'Available',
      render: (item) => (
        <div className={`text-right font-semibold ${
          item.available_qty <= 0 
            ? 'text-red-600' 
            : item.available_qty <= item.reorder_level 
              ? 'text-yellow-600' 
              : 'text-green-600'
        }`}>
          {item.available_qty.toLocaleString()}
        </div>
      ),
    },
    {
      key: 'reorder_level',
      header: 'Reorder At',
      render: (item) => (
        <div className="text-right text-gray-500">
          {item.reorder_level.toLocaleString()}
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      render: (item) => (
        <div className="text-right text-gray-700 dark:text-gray-300">
          ₹{item.total_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => getStockStatusBadge(item.stock_status),
    },
    {
      key: 'actions',
      header: '',
      render: (item) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleViewProduct(item)}
        >
          <Eye className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Products</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary?.total_products || 0}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <IndianRupee className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Value</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ₹{(summary?.total_stock_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Low Stock</p>
              <p className="text-2xl font-bold text-yellow-600">
                {summary?.low_stock_count || 0}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600">
                {summary?.out_of_stock_count || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            <option value="">All Warehouses</option>
            {warehouses.map(wh => (
              <option key={wh.id} value={wh.id}>{wh.name} ({wh.code})</option>
            ))}
          </select>
          
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as StockFilter)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            <option value="all">All Stock Levels</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <Table
          columns={columns}
          data={items}
          loading={loading}
          emptyMessage="No inventory records found"
          keyExtractor={(item) => item.id}
        />
        
        {/* Pagination */}
        {total > 50 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * 50 >= total}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Product Stock Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedProduct(null); }}
        title={selectedProduct ? `Stock: ${selectedProduct.product_name}` : 'Loading...'}
        size="lg"
      >
        {loadingDetail ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : selectedProduct ? (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total On Hand</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {selectedProduct.total_on_hand.toLocaleString()}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Reserved</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {selectedProduct.total_reserved.toLocaleString()}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Available</p>
                <p className="text-xl font-bold text-green-600">
                  {selectedProduct.total_available.toLocaleString()}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Value</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  ₹{selectedProduct.total_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
            
            {/* Warehouse Breakdown */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Stock by Warehouse ({selectedProduct.warehouse_count} locations)
              </h4>
              <div className="space-y-2">
                {selectedProduct.warehouses.map((wh, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {wh.warehouse_name}
                        </div>
                        <div className="text-xs text-gray-500">{wh.warehouse_code}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {wh.available_qty.toLocaleString()} available
                      </div>
                      <div className="text-xs text-gray-500">
                        {wh.on_hand_qty} on hand, {wh.reserved_qty} reserved
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

