import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Package,
  ShoppingCart,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCcw,
  FileText,
  X,
  Upload,
  FileSpreadsheet,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { salesOrdersApi, partiesApi, fulfillmentCentersApi, salesOrderImportApi, type ImportPreviewResponse, type ImportPreviewOrder } from '../services/api';
import { Link } from 'react-router-dom';
import type {
  SalesOrder,
  SalesOrderCreate,
  SalesOrderStats,
  SalesOrderStatus,
  Platform,
  Party,
  FulfillmentCenter,
  Product,
} from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Drawer } from '../components/ui/Drawer';
import { useThemeStore } from '../store/themeStore';
import { productsApi } from '../services/api';

// Status badge colors and labels
const statusConfig: Record<SalesOrderStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700', icon: FileText },
  pending_confirmation: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  processing: { label: 'Processing', color: 'bg-indigo-100 text-indigo-700', icon: Package },
  packed: { label: 'Packed', color: 'bg-purple-100 text-purple-700', icon: Package },
  shipped: { label: 'Shipped', color: 'bg-cyan-100 text-cyan-700', icon: Truck },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  invoiced: { label: 'Invoiced', color: 'bg-emerald-100 text-emerald-700', icon: FileText },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: XCircle },
  on_hold: { label: 'On Hold', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
};

const platformLabels: Record<Platform, string> = {
  manual: 'Manual',
  amazon: 'Amazon',
  zepto: 'Zepto',
  blinkit: 'Blinkit',
  instamart: 'Instamart',
  bigbasket: 'BigBasket',
};

export function SalesOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentTheme } = useThemeStore();

  // State
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [stats, setStats] = useState<SalesOrderStats | null>(null);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [fulfillmentCenters, setFulfillmentCenters] = useState<FulfillmentCenter[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<string>('');

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [formData, setFormData] = useState<SalesOrderCreate>({});

  // Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPlatform, setImportPlatform] = useState<Platform>('amazon');
  const [importPreview, setImportPreview] = useState<ImportPreviewResponse | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<{ created: number; failed: number } | null>(null);

  // Check URL params for action
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'new') {
      openCreate();
    }
  }, [searchParams]);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, statsRes, customersRes, fcRes, productsRes] = await Promise.all([
        salesOrdersApi.list({
          page,
          limit,
          search: search || undefined,
          status: statusFilter as SalesOrderStatus || undefined,
          platform: platformFilter as Platform || undefined,
          sort_by: 'created_at',
          sort_order: 'desc',
        }),
        salesOrdersApi.getStats(),
        partiesApi.list({ party_type: 'customer', limit: 100 }),
        fulfillmentCentersApi.list({ limit: 100 }),
        productsApi.list({ limit: 100 }),
      ]);

      setOrders(ordersRes.sales_orders);
      setTotal(ordersRes.total);
      setStats(statsRes);
      setCustomers(customersRes.parties);
      setFulfillmentCenters(fcRes.fulfillment_centers);
      setProducts(productsRes.products);
    } catch (error) {
      console.error('Failed to load sales orders:', error);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter, platformFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open create drawer
  const openCreate = () => {
    setSelectedOrder(null);
    setFormData({
      order_date: new Date().toISOString().split('T')[0],
      platform: 'manual',
      status: 'draft',
      currency_code: 'INR',
      items: [],
    });
    setDrawerOpen(true);
  };

  // Open edit drawer
  const openEdit = async (order: SalesOrder) => {
    try {
      const fullOrder = await salesOrdersApi.get(order.id);
      setSelectedOrder(fullOrder);
      setFormData({
        reference_number: fullOrder.reference_number,
        platform_order_id: fullOrder.platform_order_id,
        customer_id: fullOrder.customer_id,
        platform: fullOrder.platform,
        fulfillment_center_id: fullOrder.fulfillment_center_id,
        order_date: fullOrder.order_date,
        expected_shipment_date: fullOrder.expected_shipment_date,
        notes: fullOrder.notes,
        internal_notes: fullOrder.internal_notes,
        priority: fullOrder.priority,
      });
      setDrawerOpen(true);
    } catch (error) {
      console.error('Failed to load order details:', error);
    }
  };

  // Handle save
  const handleSave = async () => {
    try {
      if (selectedOrder) {
        await salesOrdersApi.update(selectedOrder.id, formData);
      } else {
        await salesOrdersApi.create(formData);
      }
      setDrawerOpen(false);
      loadData();
    } catch (error) {
      console.error('Failed to save order:', error);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    try {
      await salesOrdersApi.delete(id);
      loadData();
    } catch (error) {
      console.error('Failed to delete order:', error);
    }
  };

  // Status transition handlers
  const handleStatusAction = async (orderId: string, action: string) => {
    try {
      switch (action) {
        case 'confirm':
          await salesOrdersApi.confirm(orderId);
          break;
        case 'process':
          await salesOrdersApi.process(orderId);
          break;
        case 'pack':
          await salesOrdersApi.pack(orderId);
          break;
        case 'ship':
          await salesOrdersApi.ship(orderId);
          break;
        case 'deliver':
          await salesOrdersApi.deliver(orderId);
          break;
        case 'cancel':
          await salesOrdersApi.cancel(orderId);
          break;
      }
      loadData();
    } catch (error) {
      console.error(`Failed to ${action} order:`, error);
    }
  };

  // Import handlers
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportPreview(null);
      setImportError(null);
      setImportSuccess(null);
    }
  };

  const handleImportPreview = async () => {
    if (!importFile) return;
    setImportLoading(true);
    setImportError(null);
    try {
      const preview = await salesOrderImportApi.preview(importFile, importPlatform);
      setImportPreview(preview);
    } catch (error: any) {
      setImportError(error.response?.data?.detail || 'Failed to preview import file');
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportExecute = async () => {
    if (!importPreview) return;
    setImportLoading(true);
    setImportError(null);
    try {
      const result = await salesOrderImportApi.execute(importPreview);
      setImportSuccess({ created: result.orders_created, failed: result.orders_failed });
      if (result.orders_created > 0) {
        loadData();
      }
      if (result.orders_failed > 0) {
        setImportError(`${result.orders_failed} orders failed to import. Check the details below.`);
      }
    } catch (error: any) {
      setImportError(error.response?.data?.detail || 'Failed to import orders');
    } finally {
      setImportLoading(false);
    }
  };

  const closeImportModal = () => {
    setImportModalOpen(false);
    setImportFile(null);
    setImportPreview(null);
    setImportError(null);
    setImportSuccess(null);
  };

  // Pagination
  const totalPages = Math.ceil(total / limit);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Stats cards
  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total Orders', value: stats.total_orders, color: 'from-slate-500 to-slate-600' },
      { label: 'Confirmed', value: stats.confirmed_count, color: 'from-blue-500 to-blue-600' },
      { label: 'Processing', value: stats.processing_count, color: 'from-indigo-500 to-indigo-600' },
      { label: 'Shipped', value: stats.shipped_count, color: 'from-cyan-500 to-cyan-600' },
      { label: 'Delivered', value: stats.delivered_count, color: 'from-green-500 to-green-600' },
      { label: 'Revenue', value: formatCurrency(stats.total_revenue), color: 'from-emerald-500 to-emerald-600', isLarge: true },
    ];
  }, [stats]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {statCards.map((stat, index) => (
          <div
            key={stat.label}
            className="card p-4 animate-fade-in"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <p className={`text-${stat.isLarge ? 'xl' : '2xl'} font-bold text-slate-800`}>{stat.value}</p>
            <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-40"
          >
            <option value="">All Statuses</option>
            {Object.entries(statusConfig).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>
          <Select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="w-40"
          >
            <option value="">All Platforms</option>
            {Object.entries(platformLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<RefreshCcw className="h-4 w-4" />}
            onClick={loadData}
          >
            Refresh
          </Button>
          <Button
            variant="secondary"
            icon={<Upload className="h-4 w-4" />}
            onClick={() => setImportModalOpen(true)}
          >
            Import
          </Button>
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={openCreate}
          >
            New Order
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Order #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Platform</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Items</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className={`h-8 w-8 animate-spin rounded-full border-4 ${currentTheme.accent.replace('bg-', 'border-')} border-t-transparent`} />
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <ShoppingCart className="mx-auto h-12 w-12 text-slate-300" />
                    <p className="mt-2 text-sm text-slate-500">No sales orders found</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-4"
                      onClick={openCreate}
                    >
                      Create your first order
                    </Button>
                  </td>
                </tr>
              ) : (
                orders.map((order, index) => {
                  const statusInfo = statusConfig[order.status] || { label: order.status, color: 'bg-slate-100 text-slate-700', icon: FileText };
                  const StatusIcon = statusInfo.icon;
                  return (
                    <tr
                      key={order.id}
                      className="group hover:bg-slate-50 animate-fade-in cursor-pointer"
                      style={{ animationDelay: `${index * 0.02}s` }}
                    >
                      <td className="px-4 py-3">
                        <Link to={`/ims/sales/orders/${order.id}`} className="block">
                          <p className="font-medium text-blue-600 hover:text-blue-800 hover:underline">{order.order_number}</p>
                          {order.reference_number && (
                            <p className="text-xs text-slate-500">Ref: {order.reference_number}</p>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {formatDate(order.order_date)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-800">{order.customer_name || 'Walk-in'}</p>
                        {order.fulfillment_center_name && (
                          <p className="text-xs text-slate-500">{order.fulfillment_center_name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          {platformLabels[order.platform]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-600">
                        {order.total_items}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-semibold text-slate-800">{formatCurrency(order.total_amount)}</p>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            to={`/ims/sales/orders/${order.id}`}
                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                            title="View/Edit"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          {(order.status === 'draft' || order.status === 'pending_confirmation') && (
                            <>
                              <button
                                className="p-1 text-slate-400 hover:text-green-600 transition-colors"
                                onClick={() => handleStatusAction(order.id, 'confirm')}
                                title="Confirm Order"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button
                                className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                onClick={() => handleDelete(order.id)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {order.status === 'confirmed' && (
                            <button
                              className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                              onClick={() => handleStatusAction(order.id, 'process')}
                              title="Start Processing"
                            >
                              <Package className="h-4 w-4" />
                            </button>
                          )}
                          {order.status === 'processing' && (
                            <button
                              className="p-1 text-slate-400 hover:text-purple-600 transition-colors"
                              onClick={() => handleStatusAction(order.id, 'pack')}
                              title="Pack"
                            >
                              <Package className="h-4 w-4" />
                            </button>
                          )}
                          {order.status === 'packed' && (
                            <button
                              className="p-1 text-slate-400 hover:text-cyan-600 transition-colors"
                              onClick={() => handleStatusAction(order.id, 'ship')}
                              title="Ship"
                            >
                              <Truck className="h-4 w-4" />
                            </button>
                          )}
                          {order.status === 'shipped' && (
                            <button
                              className="p-1 text-slate-400 hover:text-green-600 transition-colors"
                              onClick={() => handleStatusAction(order.id, 'deliver')}
                              title="Mark Delivered"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <p className="text-sm text-slate-500">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} orders
            </p>
            <div className="flex items-center gap-2">
              <button
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </span>
              <button
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedOrder ? `Edit Order ${selectedOrder.order_number}` : 'New Sales Order'}
        size="lg"
      >
        <div className="space-y-6">
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Platform</label>
              <Select
                value={formData.platform || 'manual'}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value as Platform })}
              >
                {Object.entries(platformLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Order Date</label>
              <Input
                type="date"
                value={formData.order_date || ''}
                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reference #</label>
              <Input
                value={formData.reference_number || ''}
                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                placeholder="External reference number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Platform Order ID</label>
              <Input
                value={formData.platform_order_id || ''}
                onChange={(e) => setFormData({ ...formData, platform_order_id: e.target.value })}
                placeholder="Platform's order ID"
              />
            </div>
          </div>

          {/* Customer */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
            <Select
              value={formData.customer_id || ''}
              onChange={(e) => setFormData({ ...formData, customer_id: e.target.value || undefined })}
            >
              <option value="">Select Customer (Optional)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.party_name}</option>
              ))}
            </Select>
          </div>

          {/* Fulfillment Center */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fulfillment Center</label>
            <Select
              value={formData.fulfillment_center_id || ''}
              onChange={(e) => {
                const fc = fulfillmentCenters.find(f => f.id === e.target.value);
                setFormData({
                  ...formData,
                  fulfillment_center_id: e.target.value || undefined,
                  fulfillment_center_code: fc?.code,
                  fulfillment_center_name: fc?.full_name || fc?.name,
                });
              }}
            >
              <option value="">Select Fulfillment Center (Optional)</option>
              {fulfillmentCenters.map((fc) => (
                <option key={fc.id} value={fc.id}>{fc.full_name || `${fc.code} - ${fc.name}`}</option>
              ))}
            </Select>
          </div>

          {/* Expected Shipment Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Expected Shipment Date</label>
            <Input
              type="date"
              value={formData.expected_shipment_date || ''}
              onChange={(e) => setFormData({ ...formData, expected_shipment_date: e.target.value })}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={3}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Order notes..."
            />
          </div>

          {/* Line Items */}
          {selectedOrder && selectedOrder.items && selectedOrder.items.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Line Items</label>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">Product</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">Qty</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">Price</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrder.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-slate-800">{item.product_name}</p>
                          {item.sku && <p className="text-xs text-slate-500">SKU: {item.sku}</p>}
                        </td>
                        <td className="px-3 py-2 text-right">{item.quantity_ordered}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.unit_price)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              {selectedOrder ? 'Update Order' : 'Create Order'}
            </Button>
          </div>
        </div>
      </Drawer>

      {/* Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-auto bg-white rounded-2xl shadow-2xl mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Import Sales Orders</h2>
                  <p className="text-sm text-slate-500">Import orders from Excel or CSV files</p>
                </div>
              </div>
              <button
                onClick={closeImportModal}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Step 1: File Upload */}
              {!importPreview && !importSuccess && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Platform</label>
                      <Select
                        value={importPlatform}
                        onChange={(e) => setImportPlatform(e.target.value as Platform)}
                      >
                        <option value="amazon">Amazon Vendor Central</option>
                        <option value="zepto">Zepto</option>
                        <option value="blinkit">Blinkit</option>
                        <option value="instamart">Instamart</option>
                        <option value="bigbasket">BigBasket</option>
                        <option value="manual">Generic CSV/Excel</option>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Upload File</label>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleImportFileChange}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </div>
                  </div>

                  {importFile && (
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                      <FileSpreadsheet className="h-8 w-8 text-green-600" />
                      <div className="flex-1">
                        <p className="font-medium text-slate-800">{importFile.name}</p>
                        <p className="text-sm text-slate-500">{(importFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <Button
                        variant="primary"
                        onClick={handleImportPreview}
                        disabled={importLoading}
                      >
                        {importLoading ? 'Processing...' : 'Preview Import'}
                      </Button>
                    </div>
                  )}

                  {!importFile && (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
                      <Upload className="mx-auto h-12 w-12 text-slate-300" />
                      <p className="mt-4 text-slate-600">Upload your order file</p>
                      <p className="text-sm text-slate-400">Supports .xlsx, .xls, .csv files</p>
                    </div>
                  )}
                </>
              )}

              {/* Step 2: Preview */}
              {importPreview && !importSuccess && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-800">Preview: {importPreview.filename}</h3>
                      <p className="text-sm text-slate-500">
                        {importPreview.total_rows} rows → {importPreview.unique_orders} orders detected
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => setImportPreview(null)}
                    >
                      Back
                    </Button>
                  </div>

                  {/* Orders Preview Table */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-slate-600">PO #</th>
                          <th className="px-4 py-2 text-left font-medium text-slate-600">Fulfillment Center</th>
                          <th className="px-4 py-2 text-right font-medium text-slate-600">Items</th>
                          <th className="px-4 py-2 text-right font-medium text-slate-600">Qty</th>
                          <th className="px-4 py-2 text-right font-medium text-slate-600">Amount</th>
                          <th className="px-4 py-2 text-center font-medium text-slate-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importPreview.orders.map((order, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-4 py-2 font-medium text-slate-800">{order.platform_order_id}</td>
                            <td className="px-4 py-2 text-slate-600">{order.fulfillment_center_code}</td>
                            <td className="px-4 py-2 text-right">{order.line_items_count}</td>
                            <td className="px-4 py-2 text-right">{order.total_quantity}</td>
                            <td className="px-4 py-2 text-right font-medium">₹{order.total_amount.toLocaleString()}</td>
                            <td className="px-4 py-2 text-center">
                              {order.validation_status === 'valid' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                  <Check className="h-3 w-3" /> Valid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                  <AlertTriangle className="h-3 w-3" /> Warning
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Sample Line Items */}
                  {importPreview.orders[0]?.line_items && (
                    <div>
                      <h4 className="font-medium text-slate-700 mb-2">
                        Sample Line Items (First Order: {importPreview.orders[0].platform_order_id})
                      </h4>
                      <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-slate-600">SKU</th>
                              <th className="px-3 py-2 text-left font-medium text-slate-600">Product</th>
                              <th className="px-3 py-2 text-right font-medium text-slate-600">Qty</th>
                              <th className="px-3 py-2 text-right font-medium text-slate-600">Price</th>
                              <th className="px-3 py-2 text-center font-medium text-slate-600">Matched</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {importPreview.orders[0].line_items.slice(0, 10).map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-3 py-2 font-mono text-xs">{item.sku}</td>
                                <td className="px-3 py-2 text-slate-800 truncate max-w-xs" title={item.name}>{item.name.substring(0, 50)}...</td>
                                <td className="px-3 py-2 text-right">{item.quantity_ordered}</td>
                                <td className="px-3 py-2 text-right">₹{item.unit_price.toLocaleString()}</td>
                                <td className="px-3 py-2 text-center">
                                  {item.product_matched ? (
                                    <Check className="h-4 w-4 text-green-600 mx-auto" />
                                  ) : (
                                    <X className="h-4 w-4 text-slate-300 mx-auto" />
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Step 3: Success */}
              {importSuccess && (
                <div className="text-center py-8">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-slate-800">Import Complete!</h3>
                  <p className="mt-2 text-slate-600">
                    Successfully created {importSuccess.created} order(s)
                    {importSuccess.failed > 0 && `, ${importSuccess.failed} failed`}
                  </p>
                </div>
              )}

              {/* Error Message */}
              {importError && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{importError}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <Button variant="secondary" onClick={closeImportModal}>
                {importSuccess ? 'Close' : 'Cancel'}
              </Button>
              {importPreview && !importSuccess && (
                <Button
                  variant="primary"
                  onClick={handleImportExecute}
                  disabled={importLoading}
                >
                  {importLoading ? 'Importing...' : `Import ${importPreview.unique_orders} Orders`}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

