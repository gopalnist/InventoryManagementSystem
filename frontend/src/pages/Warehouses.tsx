import { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Search, Building2, MapPin, Package, IndianRupee,
  Edit2, Trash2, MoreVertical, CheckCircle, XCircle, Star
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, type Column } from '../components/ui/Table';
import { Drawer } from '../components/ui/Drawer';
import { Modal } from '../components/ui/Modal';
import { useAppStore } from '../store/appStore';
import { warehousesApi, type Warehouse, type WarehouseCreate } from '../services/api';

export function Warehouses() {
  const { addNotification } = useAppStore();
  
  // State
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<{
    total_warehouses: number;
    active_warehouses: number;
    total_stock_value: number;
  } | null>(null);
  
  // Drawer state
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [deleteWarehouse, setDeleteWarehouse] = useState<Warehouse | null>(null);
  
  // Form state
  const [form, setForm] = useState<WarehouseCreate>({
    code: '',
    name: '',
    warehouse_type: 'internal',
    city: '',
    state: '',
    country: 'India',
    pincode: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    is_active: true,
    is_default: false,
  });
  const [saving, setSaving] = useState(false);

  // Load data
  const loadWarehouses = useCallback(async () => {
    setLoading(true);
    try {
      const [warehousesRes, summaryRes] = await Promise.all([
        warehousesApi.list({ page, limit: 20, search: search || undefined }),
        warehousesApi.getSummary(),
      ]);
      setWarehouses(warehousesRes.warehouses);
      setTotal(warehousesRes.total);
      setSummary(summaryRes);
    } catch (error) {
      console.error('Failed to load warehouses:', error);
      addNotification('error', 'Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  }, [page, search, addNotification]);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  // Handle form
  const handleOpenDrawer = (warehouse?: Warehouse) => {
    if (warehouse) {
      setEditingWarehouse(warehouse);
      setForm({
        code: warehouse.code,
        name: warehouse.name,
        warehouse_type: warehouse.warehouse_type,
        address_line1: warehouse.address_line1,
        address_line2: warehouse.address_line2,
        city: warehouse.city,
        state: warehouse.state,
        country: warehouse.country,
        pincode: warehouse.pincode,
        contact_name: warehouse.contact_name,
        contact_phone: warehouse.contact_phone,
        contact_email: warehouse.contact_email,
        is_active: warehouse.is_active,
        is_default: warehouse.is_default,
      });
    } else {
      setEditingWarehouse(null);
      setForm({
        code: '',
        name: '',
        warehouse_type: 'internal',
        city: '',
        state: '',
        country: 'India',
        pincode: '',
        contact_name: '',
        contact_phone: '',
        contact_email: '',
        is_active: true,
        is_default: false,
      });
    }
    setShowDrawer(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) {
      addNotification('error', 'Code and Name are required');
      return;
    }
    
    setSaving(true);
    try {
      if (editingWarehouse) {
        await warehousesApi.update(editingWarehouse.id, form);
        addNotification('success', 'Warehouse updated successfully');
      } else {
        await warehousesApi.create(form);
        addNotification('success', 'Warehouse created successfully');
      }
      setShowDrawer(false);
      loadWarehouses();
    } catch (error: any) {
      addNotification('error', error.response?.data?.detail || 'Failed to save warehouse');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteWarehouse) return;
    
    try {
      await warehousesApi.delete(deleteWarehouse.id);
      addNotification('success', 'Warehouse deleted successfully');
      setDeleteWarehouse(null);
      loadWarehouses();
    } catch (error: any) {
      addNotification('error', error.response?.data?.detail || 'Failed to delete warehouse');
    }
  };

  // Table columns
  const columns: Column<Warehouse>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (warehouse) => (
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
            {warehouse.code.slice(0, 2)}
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white flex items-center gap-1">
              {warehouse.code}
              {warehouse.is_default && (
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              )}
            </div>
            <div className="text-xs text-gray-500">{warehouse.warehouse_type}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (warehouse) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{warehouse.name}</div>
          {warehouse.city && (
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {warehouse.city}, {warehouse.state}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'total_products',
      header: 'Products',
      render: (warehouse) => (
        <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
          <Package className="w-4 h-4 text-gray-400" />
          {warehouse.total_products}
        </div>
      ),
    },
    {
      key: 'total_stock_value',
      header: 'Stock Value',
      render: (warehouse) => (
        <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
          <IndianRupee className="w-4 h-4 text-gray-400" />
          {warehouse.total_stock_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (warehouse) => (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
          warehouse.is_active 
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
        }`}>
          {warehouse.is_active ? (
            <><CheckCircle className="w-3 h-3" /> Active</>
          ) : (
            <><XCircle className="w-3 h-3" /> Inactive</>
          )}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (warehouse) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); handleOpenDrawer(warehouse); }}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); setDeleteWarehouse(warehouse); }}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Warehouses</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary?.total_warehouses || 0}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Warehouses</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary?.active_warehouses || 0}
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Stock Value</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ₹{(summary?.total_stock_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search warehouses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => handleOpenDrawer()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Warehouse
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <Table
          columns={columns}
          data={warehouses}
          loading={loading}
          emptyMessage="No warehouses found"
          keyExtractor={(warehouse) => warehouse.id}
        />
        
        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total}
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
                disabled={page * 20 >= total}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Drawer */}
      <Drawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        title={editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Code *"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="e.g., BLR-01"
              disabled={!!editingWarehouse}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <select
                value={form.warehouse_type}
                onChange={(e) => setForm({ ...form, warehouse_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="internal">Internal</option>
                <option value="3pl">3PL</option>
                <option value="virtual">Virtual</option>
                <option value="dropship">Dropship</option>
              </select>
            </div>
          </div>
          
          <Input
            label="Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Bengaluru Warehouse"
          />
          
          <Input
            label="Address Line 1"
            value={form.address_line1 || ''}
            onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
            placeholder="Street address"
          />
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="City"
              value={form.city || ''}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="e.g., Bengaluru"
            />
            <Input
              label="State"
              value={form.state || ''}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              placeholder="e.g., Karnataka"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Pincode"
              value={form.pincode || ''}
              onChange={(e) => setForm({ ...form, pincode: e.target.value })}
              placeholder="e.g., 560001"
            />
            <Input
              label="Country"
              value={form.country || 'India'}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            />
          </div>
          
          <hr className="border-gray-200 dark:border-gray-700" />
          
          <Input
            label="Contact Name"
            value={form.contact_name || ''}
            onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
            placeholder="Warehouse manager name"
          />
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Contact Phone"
              value={form.contact_phone || ''}
              onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
              placeholder="+91 98765 43210"
            />
            <Input
              label="Contact Email"
              value={form.contact_email || ''}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              placeholder="email@example.com"
            />
          </div>
          
          <hr className="border-gray-200 dark:border-gray-700" />
          
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Default Warehouse</span>
            </label>
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowDrawer(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving} className="flex-1">
              {editingWarehouse ? 'Update' : 'Create'} Warehouse
            </Button>
          </div>
        </div>
      </Drawer>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteWarehouse}
        onClose={() => setDeleteWarehouse(null)}
        title="Delete Warehouse"
      >
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to delete <strong>{deleteWarehouse?.name}</strong>? 
          This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setDeleteWarehouse(null)} className="flex-1">
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} className="flex-1">
            Delete Warehouse
          </Button>
        </div>
      </Modal>
    </div>
  );
}

