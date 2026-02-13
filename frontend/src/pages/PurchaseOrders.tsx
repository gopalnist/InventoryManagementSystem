import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Download, FileSpreadsheet, Truck,
  ClipboardList, Calendar, Building2, Check, X, Eye
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Table, Pagination } from '../components/ui/Table';
import { Input } from '../components/ui/Input';
import { useAppStore } from '../store/appStore';
import { purchaseOrdersApi, type PurchaseOrder } from '../services/api';

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  pending_approval: { label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-700' },
  ordered: { label: 'Ordered', color: 'bg-indigo-100 text-indigo-700' },
  partially_received: { label: 'Partial', color: 'bg-orange-100 text-orange-700' },
  received: { label: 'Received', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
  closed: { label: 'Closed', color: 'bg-slate-100 text-slate-700' },
};

export function PurchaseOrders() {
  const navigate = useNavigate();
  const { addNotification } = useAppStore();

  // State
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Stats
  const [stats, setStats] = useState({
    total_orders: 0,
    pending_orders: 0,
    orders_this_month: 0,
    total_value_pending: 0,
  });

  // Load orders
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, statsRes] = await Promise.all([
        purchaseOrdersApi.list({
          page,
          limit: 20,
          search: search || undefined,
          status: statusFilter || undefined,
        }),
        purchaseOrdersApi.getStats(),
      ]);

      setOrders(ordersRes.purchase_orders);
      setTotal(ordersRes.total);
      setTotalPages(Math.ceil(ordersRes.total / 20));
      setStats(statsRes);
    } catch (error) {
      console.error('Failed to load purchase orders:', error);
      addNotification('error', 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, addNotification]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Table columns
  const columns = [
    {
      key: 'order_number',
      header: 'PO NUMBER',
      render: (order: PurchaseOrder) => (
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">{order.order_number}</p>
          <p className="text-xs text-gray-500">{new Date(order.order_date).toLocaleDateString('en-IN')}</p>
        </div>
      ),
    },
    {
      key: 'vendor',
      header: 'VENDOR',
      render: (order: PurchaseOrder) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-gray-700 dark:text-gray-300">{order.vendor_name || 'N/A'}</span>
        </div>
      ),
    },
    {
      key: 'warehouse',
      header: 'WAREHOUSE',
      render: (order: PurchaseOrder) => (
        <span className="text-gray-600 dark:text-gray-400">{order.warehouse_name || 'N/A'}</span>
      ),
    },
    {
      key: 'expected_date',
      header: 'EXPECTED',
      render: (order: PurchaseOrder) => (
        order.expected_delivery_date ? (
          <span className="text-gray-600 dark:text-gray-400">
            {new Date(order.expected_delivery_date).toLocaleDateString('en-IN')}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      ),
    },
    {
      key: 'total',
      header: 'TOTAL',
      render: (order: PurchaseOrder) => (
        <span className="font-semibold text-gray-900 dark:text-white">
          ₹{order.total_amount.toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'STATUS',
      render: (order: PurchaseOrder) => {
        const config = statusConfig[order.status] || statusConfig.draft;
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
            {config.label}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (order: PurchaseOrder) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/ims/purchases/orders/${order.id}`);
          }}
          className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
          title="View Details"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_orders}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Truck className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pending Orders</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending_orders}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">This Month</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.orders_this_month}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pending Value</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ₹{stats.total_value_pending.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="flex flex-1 gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search PO number or vendor..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="ordered">Ordered</option>
              <option value="partially_received">Partially Received</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <Button icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/ims/purchases/orders/new')}>
            Create PO
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <Table
          columns={columns}
          data={orders}
          loading={loading}
          emptyMessage="No purchase orders found"
          keyExtractor={(order) => order.id}
          onRowClick={(order) => navigate(`/ims/purchases/orders/${order.id}`)}
        />

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={total}
              itemsPerPage={20}
            />
          </div>
        )}
      </div>
    </div>
  );
}

