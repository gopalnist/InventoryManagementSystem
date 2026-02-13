import { useState } from 'react';
import {
  Search,
  Download,
  CheckCircle,
  XCircle,
  Calendar,
  Package,
  Factory,
  TrendingUp,
  Clock,
  BarChart3,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Table, Pagination } from '../components/ui/Table';
import { useThemeStore } from '../store/themeStore';

// Types
interface ProductionHistoryItem {
  id: string;
  orderNumber: string;
  bundleName: string;
  bundleSku: string;
  quantityProduced: number;
  quantityOrdered: number;
  status: 'completed' | 'cancelled' | 'partial';
  completedDate: string;
  duration: string;
  producedBy: string;
  notes?: string;
}

// Sample production history
const sampleHistory: ProductionHistoryItem[] = [
  {
    id: 'ph-1',
    orderNumber: 'PO-2024-003',
    bundleName: 'Healthy Breakfast Starter Kit',
    bundleSku: 'NY-BDL-005',
    quantityProduced: 25,
    quantityOrdered: 25,
    status: 'completed',
    completedDate: '2024-01-17',
    duration: '3 days',
    producedBy: 'Warehouse Team A',
  },
  {
    id: 'ph-2',
    orderNumber: 'PO-2023-125',
    bundleName: 'Black Quinoa - 500g (Pack of 5)',
    bundleSku: 'NY-BDL-002',
    quantityProduced: 100,
    quantityOrdered: 100,
    status: 'completed',
    completedDate: '2024-01-15',
    duration: '2 days',
    producedBy: 'Warehouse Team B',
  },
  {
    id: 'ph-3',
    orderNumber: 'PO-2024-006',
    bundleName: 'Chocolate Millet Milk - 200ml (Pack of 12)',
    bundleSku: 'NY-BDL-004',
    quantityProduced: 0,
    quantityOrdered: 30,
    status: 'cancelled',
    completedDate: '2024-01-14',
    duration: '-',
    producedBy: 'System',
    notes: 'Cancelled - Out of stock for bottles',
  },
  {
    id: 'ph-4',
    orderNumber: 'PO-2023-120',
    bundleName: 'Seeds Power Pack',
    bundleSku: 'NY-BDL-007',
    quantityProduced: 50,
    quantityOrdered: 50,
    status: 'completed',
    completedDate: '2024-01-12',
    duration: '1 day',
    producedBy: 'Warehouse Team A',
  },
  {
    id: 'ph-5',
    orderNumber: 'PO-2023-118',
    bundleName: 'Plant-Based Essentials Combo',
    bundleSku: 'NY-BDL-006',
    quantityProduced: 45,
    quantityOrdered: 60,
    status: 'partial',
    completedDate: '2024-01-10',
    duration: '4 days',
    producedBy: 'Warehouse Team B',
    notes: 'Partial completion - Peanut Kurd stock insufficient',
  },
  {
    id: 'ph-6',
    orderNumber: 'PO-2023-115',
    bundleName: 'Millet Flour Combo',
    bundleSku: 'NY-BDL-008',
    quantityProduced: 80,
    quantityOrdered: 80,
    status: 'completed',
    completedDate: '2024-01-08',
    duration: '2 days',
    producedBy: 'Warehouse Team A',
  },
  {
    id: 'ph-7',
    orderNumber: 'PO-2023-110',
    bundleName: 'Black Quinoa - 500g (Pack of 3)',
    bundleSku: 'NY-BDL-001',
    quantityProduced: 150,
    quantityOrdered: 150,
    status: 'completed',
    completedDate: '2024-01-05',
    duration: '3 days',
    producedBy: 'Warehouse Team B',
  },
  {
    id: 'ph-8',
    orderNumber: 'PO-2023-105',
    bundleName: 'Chocolate Millet Milk - 200ml (Pack of 6)',
    bundleSku: 'NY-BDL-003',
    quantityProduced: 200,
    quantityOrdered: 200,
    status: 'completed',
    completedDate: '2024-01-02',
    duration: '4 days',
    producedBy: 'Warehouse Team A',
  },
];

const statusConfig = {
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-600', icon: XCircle },
  partial: { label: 'Partial', color: 'bg-amber-100 text-amber-700', icon: Clock },
};

export function ProductionHistory() {
  const { currentTheme } = useThemeStore();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'completed' | 'cancelled' | 'partial' | ''>('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [page, setPage] = useState(1);

  // Filter history
  const filteredHistory = sampleHistory.filter(item => {
    const matchesSearch = !search || 
      item.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      item.bundleName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const paginatedHistory = filteredHistory.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  // Stats
  const totalProduced = sampleHistory.filter(h => h.status === 'completed').reduce((sum, h) => sum + h.quantityProduced, 0);
  const completedOrders = sampleHistory.filter(h => h.status === 'completed').length;
  const cancelledOrders = sampleHistory.filter(h => h.status === 'cancelled').length;
  const partialOrders = sampleHistory.filter(h => h.status === 'partial').length;

  const columns = [
    {
      key: 'orderNumber',
      header: 'ORDER',
      render: (item: ProductionHistoryItem) => (
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            item.status === 'completed' ? 'bg-emerald-100' :
            item.status === 'partial' ? 'bg-amber-100' : 'bg-red-100'
          }`}>
            <Factory className={`h-5 w-5 ${
              item.status === 'completed' ? 'text-emerald-600' :
              item.status === 'partial' ? 'text-amber-600' : 'text-red-500'
            }`} />
          </div>
          <div>
            <p className="font-semibold text-slate-800">{item.orderNumber}</p>
            <p className="text-xs text-slate-500">{item.completedDate}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'bundle',
      header: 'BUNDLE',
      render: (item: ProductionHistoryItem) => (
        <div>
          <p className="font-medium text-slate-800">{item.bundleName}</p>
          <p className="text-xs text-slate-500">{item.bundleSku}</p>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'QTY PRODUCED',
      render: (item: ProductionHistoryItem) => (
        <div className="text-right">
          <p className={`font-semibold ${
            item.quantityProduced === item.quantityOrdered ? 'text-emerald-600' :
            item.quantityProduced === 0 ? 'text-red-600' : 'text-amber-600'
          }`}>
            {item.quantityProduced}
          </p>
          {item.quantityProduced !== item.quantityOrdered && item.quantityProduced > 0 && (
            <p className="text-xs text-slate-500">of {item.quantityOrdered} ordered</p>
          )}
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'DURATION',
      render: (item: ProductionHistoryItem) => (
        <p className="text-slate-600">{item.duration}</p>
      ),
    },
    {
      key: 'producedBy',
      header: 'PRODUCED BY',
      render: (item: ProductionHistoryItem) => (
        <p className="text-slate-600">{item.producedBy}</p>
      ),
    },
    {
      key: 'status',
      header: 'STATUS',
      render: (item: ProductionHistoryItem) => {
        const config = statusConfig[item.status];
        const Icon = config.icon;
        return (
          <div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${config.color}`}>
              <Icon className="h-3.5 w-3.5" />
              {config.label}
            </span>
            {item.notes && (
              <p className="text-xs text-slate-500 mt-1 max-w-[200px] truncate" title={item.notes}>
                {item.notes}
              </p>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${currentTheme.sidebar.logoAccent}`}>
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{totalProduced}</p>
              <p className="text-sm text-slate-500">Units Produced</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{completedOrders}</p>
              <p className="text-sm text-slate-500">Completed</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{partialOrders}</p>
              <p className="text-sm text-slate-500">Partial</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{cancelledOrders}</p>
              <p className="text-sm text-slate-500">Cancelled</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Showing {paginatedHistory.length} of {filteredHistory.length} records
        </p>
        <Button variant="secondary" icon={<Download className="h-4 w-4" />}>
          Export History
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
            onChange={(e) => { setStatusFilter(e.target.value as '' | 'completed' | 'cancelled' | 'partial'); setPage(1); }}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="partial">Partial</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="From"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="To"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <Table
          columns={columns}
          data={paginatedHistory}
          loading={false}
          keyExtractor={(item) => item.id}
          emptyMessage="No production history found."
        />
        {totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={filteredHistory.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Summary Chart Placeholder */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="h-5 w-5 text-slate-500" />
          <h3 className="text-lg font-semibold text-slate-800">Production Analytics</h3>
        </div>
        <div className="flex items-center justify-center h-48 bg-slate-50 rounded-lg">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500">Production analytics chart coming soon</p>
            <p className="text-xs text-slate-400 mt-1">Track production trends, efficiency, and throughput</p>
          </div>
        </div>
      </div>
    </div>
  );
}

