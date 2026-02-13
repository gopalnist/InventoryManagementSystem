import { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Layers,
  Factory,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Table, Pagination } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { useAppStore } from '../store/appStore';
import { useThemeStore } from '../store/themeStore';

// Types
type OrderStatus = 'draft' | 'pending' | 'in_progress' | 'completed' | 'cancelled';

interface ProductionOrder {
  id: string;
  orderNumber: string;
  bundleName: string;
  bundleSku: string;
  quantity: number;
  status: OrderStatus;
  expectedDate: string;
  completedDate?: string;
  createdAt: string;
  notes?: string;
}

// Sample production orders
const sampleOrders: ProductionOrder[] = [
  {
    id: 'po-1',
    orderNumber: 'PO-2024-001',
    bundleName: 'Black Quinoa - 500g (Pack of 3)',
    bundleSku: 'NY-BDL-001',
    quantity: 50,
    status: 'in_progress',
    expectedDate: '2024-01-20',
    createdAt: '2024-01-15T10:00:00Z',
    notes: 'Urgent order for Amazon fulfillment',
  },
  {
    id: 'po-2',
    orderNumber: 'PO-2024-002',
    bundleName: 'Chocolate Millet Milk - 200ml (Pack of 6)',
    bundleSku: 'NY-BDL-003',
    quantity: 100,
    status: 'pending',
    expectedDate: '2024-01-22',
    createdAt: '2024-01-16T10:00:00Z',
  },
  {
    id: 'po-3',
    orderNumber: 'PO-2024-003',
    bundleName: 'Healthy Breakfast Starter Kit',
    bundleSku: 'NY-BDL-005',
    quantity: 25,
    status: 'completed',
    expectedDate: '2024-01-18',
    completedDate: '2024-01-17',
    createdAt: '2024-01-14T10:00:00Z',
  },
  {
    id: 'po-4',
    orderNumber: 'PO-2024-004',
    bundleName: 'Plant-Based Essentials Combo',
    bundleSku: 'NY-BDL-006',
    quantity: 75,
    status: 'in_progress',
    expectedDate: '2024-01-25',
    createdAt: '2024-01-17T10:00:00Z',
    notes: 'Priority for retail store restocking',
  },
  {
    id: 'po-5',
    orderNumber: 'PO-2024-005',
    bundleName: 'Seeds Power Pack',
    bundleSku: 'NY-BDL-007',
    quantity: 40,
    status: 'draft',
    expectedDate: '2024-01-28',
    createdAt: '2024-01-18T10:00:00Z',
  },
  {
    id: 'po-6',
    orderNumber: 'PO-2024-006',
    bundleName: 'Chocolate Millet Milk - 200ml (Pack of 12)',
    bundleSku: 'NY-BDL-004',
    quantity: 30,
    status: 'cancelled',
    expectedDate: '2024-01-20',
    createdAt: '2024-01-12T10:00:00Z',
    notes: 'Cancelled - Out of stock for bottles',
  },
];

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600', icon: Clock },
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: Play },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-600', icon: XCircle },
};

export function ProductionOrders() {
  const { addNotification } = useAppStore();
  const { currentTheme } = useThemeStore();
  
  const [orders, setOrders] = useState<ProductionOrder[]>(sampleOrders);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = !search || 
      order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      order.bundleName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  // Stats
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    inProgress: orders.filter(o => o.status === 'in_progress').length,
    completed: orders.filter(o => o.status === 'completed').length,
  };

  const updateStatus = (orderId: string, newStatus: OrderStatus) => {
    setOrders(orders.map(o => 
      o.id === orderId 
        ? { ...o, status: newStatus, completedDate: newStatus === 'completed' ? new Date().toISOString() : o.completedDate }
        : o
    ));
    addNotification('success', `Order status updated to ${statusConfig[newStatus].label}`);
  };

  const columns = [
    {
      key: 'orderNumber',
      header: 'ORDER #',
      render: (order: ProductionOrder) => (
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            order.status === 'in_progress' ? 'bg-blue-100' :
            order.status === 'completed' ? 'bg-emerald-100' :
            order.status === 'pending' ? 'bg-amber-100' : 'bg-slate-100'
          }`}>
            <Factory className={`h-5 w-5 ${
              order.status === 'in_progress' ? 'text-blue-600' :
              order.status === 'completed' ? 'text-emerald-600' :
              order.status === 'pending' ? 'text-amber-600' : 'text-slate-500'
            }`} />
          </div>
          <div>
            <p className="font-semibold text-slate-800">{order.orderNumber}</p>
            <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'bundle',
      header: 'BUNDLE',
      render: (order: ProductionOrder) => (
        <div>
          <p className="font-medium text-slate-800">{order.bundleName}</p>
          <p className="text-xs text-slate-500">{order.bundleSku}</p>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'QTY',
      render: (order: ProductionOrder) => (
        <p className="font-semibold text-slate-800">{order.quantity}</p>
      ),
    },
    {
      key: 'expectedDate',
      header: 'EXPECTED DATE',
      render: (order: ProductionOrder) => (
        <div>
          <p className="text-slate-700">{new Date(order.expectedDate).toLocaleDateString()}</p>
          {order.completedDate && (
            <p className="text-xs text-emerald-600">
              Completed: {new Date(order.completedDate).toLocaleDateString()}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'STATUS',
      render: (order: ProductionOrder) => {
        const config = statusConfig[order.status];
        const Icon = config.icon;
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${config.color}`}>
            <Icon className="h-3.5 w-3.5" />
            {config.label}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      width: '150px',
      render: (order: ProductionOrder) => (
        <div className="flex items-center justify-end gap-1">
          {order.status === 'draft' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'pending'); }}
            >
              Submit
            </Button>
          )}
          {order.status === 'pending' && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Play className="h-3 w-3" />}
              onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'in_progress'); }}
            >
              Start
            </Button>
          )}
          {order.status === 'in_progress' && (
            <Button
              size="sm"
              variant="ghost"
              icon={<CheckCircle className="h-3 w-3" />}
              onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'completed'); }}
            >
              Complete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${currentTheme.sidebar.logoAccent}`}>
              <Factory className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
              <p className="text-sm text-slate-500">Total Orders</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.pending}</p>
              <p className="text-sm text-slate-500">Pending</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
              <Play className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.inProgress}</p>
              <p className="text-sm text-slate-500">In Progress</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.completed}</p>
              <p className="text-sm text-slate-500">Completed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Showing {paginatedOrders.length} of {filteredOrders.length} orders
        </p>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreateModal(true)}>
          New Production Order
        </Button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by order number or bundle name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as OrderStatus | ''); setPage(1); }}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <Table
          columns={columns}
          data={paginatedOrders}
          loading={false}
          keyExtractor={(order) => order.id}
          emptyMessage="No production orders found."
        />
        {totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={filteredOrders.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Create Modal Placeholder */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Production Order"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => { setShowCreateModal(false); addNotification('info', 'Production order creation coming soon!'); }}>
              Create Order
            </Button>
          </>
        }
      >
        <div className="text-center py-8">
          <Factory className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700">Production Order Builder</h3>
          <p className="text-slate-500 mt-2">
            Select a product bundle and specify the quantity to produce.
          </p>
          <div className="mt-6 p-4 bg-slate-50 rounded-lg text-left">
            <p className="text-sm font-medium text-slate-700 mb-2">This will:</p>
            <ul className="text-sm text-slate-600 space-y-1">
              <li className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-slate-400" />
                Check component availability
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-slate-400" />
                Reserve components from inventory
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-slate-400" />
                Add finished bundles to stock on completion
              </li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
}

