import { useState, useEffect, useCallback } from 'react';
import { 
  Search, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight,
  RefreshCw, Package, Building2, Calendar, Filter, Plus
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, type Column } from '../components/ui/Table';
import { Drawer } from '../components/ui/Drawer';
import { useAppStore } from '../store/appStore';
import { 
  stockMovementsApi, warehousesApi, productsApi,
  type StockMovement, type Warehouse, type Product
} from '../services/api';

type MovementTab = 'all' | 'receive' | 'issue' | 'adjust' | 'transfer';

export function StockMovements() {
  const { addNotification } = useAppStore();
  
  // State
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedTab, setSelectedTab] = useState<MovementTab>('all');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // Action drawer
  const [showDrawer, setShowDrawer] = useState(false);
  const [actionType, setActionType] = useState<'receive' | 'issue' | 'adjust' | 'transfer'>('receive');
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [form, setForm] = useState({
    product_id: '',
    warehouse_id: '',
    destination_warehouse_id: '',
    quantity: 0,
    unit_cost: 0,
    reason: 'cycle_count',
    notes: '',
    reference_number: '',
  });

  // Load movements
  const loadMovements = useCallback(async () => {
    setLoading(true);
    try {
      const typeMap: Record<string, string | undefined> = {
        all: undefined,
        receive: 'in',
        issue: 'out',
        adjust: 'adjust_in',
        transfer: 'transfer_out',
      };
      
      const res = await stockMovementsApi.list({
        page,
        limit: 50,
        warehouse_id: selectedWarehouse || undefined,
        movement_type: typeMap[selectedTab],
      });
      setMovements(res.movements);
      setTotal(res.total);
    } catch (error) {
      console.error('Failed to load movements:', error);
      addNotification('error', 'Failed to load stock movements');
    } finally {
      setLoading(false);
    }
  }, [page, selectedTab, selectedWarehouse, addNotification]);

  const loadSupportingData = async () => {
    try {
      const [whRes, prodRes] = await Promise.all([
        warehousesApi.list({ limit: 100 }),
        productsApi.list({ limit: 500 }),
      ]);
      setWarehouses(whRes.warehouses);
      setProducts(prodRes.products);
    } catch (error) {
      console.error('Failed to load supporting data:', error);
    }
  };

  useEffect(() => {
    loadSupportingData();
  }, []);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  // Handle action
  const handleOpenAction = (type: 'receive' | 'issue' | 'adjust' | 'transfer') => {
    setActionType(type);
    setForm({
      product_id: '',
      warehouse_id: '',
      destination_warehouse_id: '',
      quantity: 0,
      unit_cost: 0,
      reason: 'cycle_count',
      notes: '',
      reference_number: '',
    });
    setShowDrawer(true);
  };

  const handleSaveAction = async () => {
    if (!form.product_id || !form.warehouse_id || form.quantity <= 0) {
      addNotification('error', 'Please fill all required fields');
      return;
    }
    
    setSaving(true);
    try {
      switch (actionType) {
        case 'receive':
          await stockMovementsApi.receive({
            product_id: form.product_id,
            warehouse_id: form.warehouse_id,
            quantity: form.quantity,
            unit_cost: form.unit_cost || undefined,
            reference_number: form.reference_number || undefined,
            notes: form.notes || undefined,
          });
          addNotification('success', `Received ${form.quantity} units`);
          break;
          
        case 'issue':
          await stockMovementsApi.issue({
            product_id: form.product_id,
            warehouse_id: form.warehouse_id,
            quantity: form.quantity,
            reference_number: form.reference_number || undefined,
            notes: form.notes || undefined,
          });
          addNotification('success', `Issued ${form.quantity} units`);
          break;
          
        case 'adjust':
          await stockMovementsApi.adjust({
            product_id: form.product_id,
            warehouse_id: form.warehouse_id,
            quantity: form.quantity,
            reason: form.reason as any,
            notes: form.notes || undefined,
            reference_number: form.reference_number || undefined,
          });
          addNotification('success', `Adjusted stock by ${form.quantity} units`);
          break;
          
        case 'transfer':
          if (!form.destination_warehouse_id) {
            addNotification('error', 'Please select destination warehouse');
            return;
          }
          await stockMovementsApi.transfer({
            product_id: form.product_id,
            source_warehouse_id: form.warehouse_id,
            destination_warehouse_id: form.destination_warehouse_id,
            quantity: form.quantity,
            notes: form.notes || undefined,
          });
          addNotification('success', `Transferred ${form.quantity} units`);
          break;
      }
      
      setShowDrawer(false);
      loadMovements();
    } catch (error: any) {
      addNotification('error', error.response?.data?.detail || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  // Get movement icon
  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'in':
      case 'transfer_in':
      case 'adjust_in':
        return <ArrowDownCircle className="w-5 h-5 text-green-500" />;
      case 'out':
      case 'transfer_out':
      case 'adjust_out':
        return <ArrowUpCircle className="w-5 h-5 text-red-500" />;
      default:
        return <RefreshCw className="w-5 h-5 text-gray-500" />;
    }
  };

  // Get movement badge
  const getMovementBadge = (type: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      in: { label: 'Received', color: 'bg-green-100 text-green-700' },
      out: { label: 'Issued', color: 'bg-red-100 text-red-700' },
      adjust_in: { label: 'Adjust +', color: 'bg-blue-100 text-blue-700' },
      adjust_out: { label: 'Adjust -', color: 'bg-orange-100 text-orange-700' },
      transfer_in: { label: 'Transfer In', color: 'bg-purple-100 text-purple-700' },
      transfer_out: { label: 'Transfer Out', color: 'bg-indigo-100 text-indigo-700' },
    };
    
    const badge = badges[type] || { label: type, color: 'bg-gray-100 text-gray-700' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  // Table columns
  const columns: Column<StockMovement>[] = [
    {
      key: 'type',
      header: '',
      render: (m) => getMovementIcon(m.movement_type),
      className: 'w-12',
    },
    {
      key: 'product',
      header: 'Product',
      render: (m) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{m.product_name}</div>
          <div className="text-xs text-gray-500">{m.product_sku}</div>
        </div>
      ),
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (m) => (
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <Building2 className="w-4 h-4 text-gray-400" />
          {m.warehouse_name}
        </div>
      ),
    },
    {
      key: 'movement_type',
      header: 'Type',
      render: (m) => getMovementBadge(m.movement_type),
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (m) => {
        const isPositive = ['in', 'transfer_in', 'adjust_in'].includes(m.movement_type);
        return (
          <span className={`font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? '+' : '-'}{m.quantity.toLocaleString()}
          </span>
        );
      },
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (m) => (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {m.reference_number || m.reference_type || '-'}
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Date',
      render: (m) => (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {new Date(m.created_at).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      ),
    },
  ];

  // Tabs
  const tabs: { key: MovementTab; label: string; icon: any }[] = [
    { key: 'all', label: 'All', icon: RefreshCw },
    { key: 'receive', label: 'Received', icon: ArrowDownCircle },
    { key: 'issue', label: 'Issued', icon: ArrowUpCircle },
    { key: 'adjust', label: 'Adjustments', icon: RefreshCw },
    { key: 'transfer', label: 'Transfers', icon: ArrowLeftRight },
  ];

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => handleOpenAction('receive')} className="bg-green-600 hover:bg-green-700">
          <ArrowDownCircle className="w-4 h-4 mr-2" />
          Receive Stock
        </Button>
        <Button onClick={() => handleOpenAction('issue')} className="bg-red-600 hover:bg-red-700">
          <ArrowUpCircle className="w-4 h-4 mr-2" />
          Issue Stock
        </Button>
        <Button onClick={() => handleOpenAction('adjust')} variant="secondary">
          <RefreshCw className="w-4 h-4 mr-2" />
          Adjust Stock
        </Button>
        <Button onClick={() => handleOpenAction('transfer')} variant="secondary">
          <ArrowLeftRight className="w-4 h-4 mr-2" />
          Transfer Stock
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setSelectedTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedTab === tab.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
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
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <Table
          columns={columns}
          data={movements}
          loading={loading}
          emptyMessage="No stock movements found"
          keyExtractor={(movement) => movement.id}
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

      {/* Action Drawer */}
      <Drawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        title={
          actionType === 'receive' ? 'Receive Stock' :
          actionType === 'issue' ? 'Issue Stock' :
          actionType === 'adjust' ? 'Adjust Stock' :
          'Transfer Stock'
        }
      >
        <div className="space-y-4">
          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Product *
            </label>
            <select
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">Select product...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>
          
          {/* Warehouse */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {actionType === 'transfer' ? 'Source Warehouse *' : 'Warehouse *'}
            </label>
            <select
              value={form.warehouse_id}
              onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">Select warehouse...</option>
              {warehouses.map(wh => (
                <option key={wh.id} value={wh.id}>{wh.name} ({wh.code})</option>
              ))}
            </select>
          </div>
          
          {/* Destination Warehouse (for transfer) */}
          {actionType === 'transfer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Destination Warehouse *
              </label>
              <select
                value={form.destination_warehouse_id}
                onChange={(e) => setForm({ ...form, destination_warehouse_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">Select warehouse...</option>
                {warehouses.filter(wh => wh.id !== form.warehouse_id).map(wh => (
                  <option key={wh.id} value={wh.id}>{wh.name} ({wh.code})</option>
                ))}
              </select>
            </div>
          )}
          
          {/* Quantity */}
          <Input
            label={actionType === 'adjust' ? 'Quantity (+ or -)' : 'Quantity *'}
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })}
            placeholder="Enter quantity"
          />
          
          {/* Unit Cost (for receive) */}
          {actionType === 'receive' && (
            <Input
              label="Unit Cost"
              type="number"
              value={form.unit_cost}
              onChange={(e) => setForm({ ...form, unit_cost: parseFloat(e.target.value) || 0 })}
              placeholder="Optional"
            />
          )}
          
          {/* Reason (for adjust) */}
          {actionType === 'adjust' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reason *
              </label>
              <select
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="cycle_count">Cycle Count</option>
                <option value="damaged">Damaged</option>
                <option value="expired">Expired</option>
                <option value="theft">Theft/Loss</option>
                <option value="found">Found</option>
                <option value="correction">Correction</option>
                <option value="opening_balance">Opening Balance</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}
          
          {/* Reference Number */}
          <Input
            label="Reference Number"
            value={form.reference_number}
            onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
            placeholder="e.g., PO-12345"
          />
          
          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              rows={3}
              placeholder="Optional notes..."
            />
          </div>
          
          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowDrawer(false)} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveAction} 
              loading={saving} 
              className={`flex-1 ${
                actionType === 'receive' ? 'bg-green-600 hover:bg-green-700' :
                actionType === 'issue' ? 'bg-red-600 hover:bg-red-700' :
                ''
              }`}
            >
              {actionType === 'receive' ? 'Receive' :
               actionType === 'issue' ? 'Issue' :
               actionType === 'adjust' ? 'Adjust' :
               'Transfer'}
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}

