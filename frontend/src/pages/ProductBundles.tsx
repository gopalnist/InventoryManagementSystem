import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Search,
  Filter,
  Download,
  Edit2,
  Trash2,
  Eye,
  Layers,
  X,
  Package,
  ChevronDown,
  ChevronUp,
  Factory,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Table, Pagination } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Drawer } from '../components/ui/Drawer';
import { useAppStore } from '../store/appStore';
import { useThemeStore } from '../store/themeStore';

// Types
interface BundleComponent {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitCost: number;
}

interface ProductBundle {
  id: string;
  sku: string;
  name: string;
  description?: string;
  type: 'bundle';
  components: BundleComponent[];
  totalCost: number;
  sellingPrice: number;
  stockOnHand: number;
  reorderPoint: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Sample product bundles based on Nourish You
const sampleBundles: ProductBundle[] = [
  {
    id: 'bundle-1',
    sku: 'NY-BDL-001',
    name: 'Black Quinoa - 500g (Pack of 3)',
    description: 'Value pack of 3 Black Quinoa 500g pouches',
    type: 'bundle',
    components: [
      { productId: '5', productName: 'White Quinoa - 500g', productSku: 'NY-QNA-001', quantity: 3, unitCost: 220 },
      { productId: 'pkg-1', productName: 'Outer Box - Medium', productSku: 'PKG-BOX-M', quantity: 1, unitCost: 15 },
    ],
    totalCost: 675,
    sellingPrice: 799,
    stockOnHand: 0,
    reorderPoint: 10,
    isActive: true,
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-10T10:00:00Z',
  },
  {
    id: 'bundle-2',
    sku: 'NY-BDL-002',
    name: 'Black Quinoa - 500g (Pack of 5)',
    description: 'Bulk pack of 5 Black Quinoa 500g pouches',
    type: 'bundle',
    components: [
      { productId: '5', productName: 'White Quinoa - 500g', productSku: 'NY-QNA-001', quantity: 5, unitCost: 220 },
      { productId: 'pkg-2', productName: 'Outer Box - Large', productSku: 'PKG-BOX-L', quantity: 1, unitCost: 25 },
    ],
    totalCost: 1125,
    sellingPrice: 1299,
    stockOnHand: 12,
    reorderPoint: 10,
    isActive: true,
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-10T10:00:00Z',
  },
  {
    id: 'bundle-3',
    sku: 'NY-BDL-003',
    name: 'Chocolate Millet Milk - 200ml (Pack of 6)',
    description: '6-pack of Chocolate Millet Milk bottles',
    type: 'bundle',
    components: [
      { productId: '2', productName: 'Millet Mlk Chocolate - 200ml', productSku: 'NY-MLK-002', quantity: 6, unitCost: 260 },
      { productId: 'pkg-3', productName: 'Carrier Pack - 6 Unit', productSku: 'PKG-CAR-6', quantity: 1, unitCost: 20 },
    ],
    totalCost: 1580,
    sellingPrice: 1899,
    stockOnHand: -1,
    reorderPoint: 15,
    isActive: true,
    createdAt: '2024-01-09T10:00:00Z',
    updatedAt: '2024-01-09T10:00:00Z',
  },
  {
    id: 'bundle-4',
    sku: 'NY-BDL-004',
    name: 'Chocolate Millet Milk - 200ml (Pack of 12)',
    description: '12-pack of Chocolate Millet Milk bottles',
    type: 'bundle',
    components: [
      { productId: '2', productName: 'Millet Mlk Chocolate - 200ml', productSku: 'NY-MLK-002', quantity: 12, unitCost: 260 },
      { productId: 'pkg-4', productName: 'Carrier Pack - 12 Unit', productSku: 'PKG-CAR-12', quantity: 1, unitCost: 35 },
    ],
    totalCost: 3155,
    sellingPrice: 3599,
    stockOnHand: 8,
    reorderPoint: 10,
    isActive: true,
    createdAt: '2024-01-09T10:00:00Z',
    updatedAt: '2024-01-09T10:00:00Z',
  },
  {
    id: 'bundle-5',
    sku: 'NY-BDL-005',
    name: 'Healthy Breakfast Starter Kit',
    description: 'Complete breakfast kit with quinoa, chia seeds, and muesli',
    type: 'bundle',
    components: [
      { productId: '5', productName: 'White Quinoa - 500g', productSku: 'NY-QNA-001', quantity: 1, unitCost: 220 },
      { productId: '7', productName: 'Black Chia Seeds - 250g', productSku: 'NY-SED-001', quantity: 1, unitCost: 170 },
      { productId: '9', productName: 'Super Muesli - Belgium Dark Chocolate - 400g', productSku: 'NY-BRK-001', quantity: 1, unitCost: 420 },
      { productId: 'pkg-5', productName: 'Gift Box - Premium', productSku: 'PKG-GIFT-P', quantity: 1, unitCost: 50 },
    ],
    totalCost: 860,
    sellingPrice: 999,
    stockOnHand: 5,
    reorderPoint: 8,
    isActive: true,
    createdAt: '2024-01-08T10:00:00Z',
    updatedAt: '2024-01-08T10:00:00Z',
  },
  {
    id: 'bundle-6',
    sku: 'NY-BDL-006',
    name: 'Plant-Based Essentials Combo',
    description: 'Essential dairy-free products bundle',
    type: 'bundle',
    components: [
      { productId: '3', productName: 'Peanut Kurd - 450g', productSku: 'NY-KRD-001', quantity: 2, unitCost: 140 },
      { productId: '4', productName: 'Plant-based Prodigee - 500ml', productSku: 'NY-PRD-001', quantity: 1, unitCost: 380 },
      { productId: '1', productName: 'Millet Mlk Original - 200ml', productSku: 'NY-MLK-001', quantity: 6, unitCost: 250 },
      { productId: 'pkg-6', productName: 'Combo Box', productSku: 'PKG-COMBO', quantity: 1, unitCost: 40 },
    ],
    totalCost: 2200,
    sellingPrice: 2499,
    stockOnHand: -63,
    reorderPoint: 5,
    isActive: true,
    createdAt: '2024-01-07T10:00:00Z',
    updatedAt: '2024-01-07T10:00:00Z',
  },
  {
    id: 'bundle-7',
    sku: 'NY-BDL-007',
    name: 'Seeds Power Pack',
    description: 'Complete seeds collection for healthy snacking',
    type: 'bundle',
    components: [
      { productId: '7', productName: 'Black Chia Seeds - 250g', productSku: 'NY-SED-001', quantity: 1, unitCost: 170 },
      { productId: '11', productName: 'Roasted Pumpkin Seeds - 150g', productSku: 'NY-SED-003', quantity: 1, unitCost: 180 },
      { productId: '12', productName: 'Roasted Sunflower Seeds - 150g', productSku: 'NY-SED-004', quantity: 1, unitCost: 140 },
      { productId: 'pkg-7', productName: 'Seeds Jar Set', productSku: 'PKG-JAR-SET', quantity: 1, unitCost: 60 },
    ],
    totalCost: 550,
    sellingPrice: 699,
    stockOnHand: 20,
    reorderPoint: 10,
    isActive: true,
    createdAt: '2024-01-06T10:00:00Z',
    updatedAt: '2024-01-06T10:00:00Z',
  },
  {
    id: 'bundle-8',
    sku: 'NY-BDL-008',
    name: 'Millet Flour Combo',
    description: 'Healthy flour alternatives pack',
    type: 'bundle',
    components: [
      { productId: '13', productName: 'Ragi Flour - 500g', productSku: 'NY-FLR-001', quantity: 2, unitCost: 85 },
      { productId: '14', productName: 'Jowar Flour - 500g', productSku: 'NY-FLR-002', quantity: 2, unitCost: 75 },
      { productId: 'pkg-8', productName: 'Flour Pack Box', productSku: 'PKG-FLR', quantity: 1, unitCost: 20 },
    ],
    totalCost: 340,
    sellingPrice: 449,
    stockOnHand: 15,
    reorderPoint: 12,
    isActive: true,
    createdAt: '2024-01-05T10:00:00Z',
    updatedAt: '2024-01-05T10:00:00Z',
  },
];

export function ProductBundles() {
  const { addNotification } = useAppStore();
  const { currentTheme } = useThemeStore();
  
  // State
  const [bundles, setBundles] = useState<ProductBundle[]>(sampleBundles);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  
  // Drawer state
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingBundle, setEditingBundle] = useState<ProductBundle | null>(null);
  
  // Detail view
  const [selectedBundle, setSelectedBundle] = useState<ProductBundle | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  
  // Delete confirmation
  const [deleteBundle, setDeleteBundle] = useState<ProductBundle | null>(null);

  // Filter bundles
  const filteredBundles = bundles.filter(bundle => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      bundle.name.toLowerCase().includes(searchLower) ||
      bundle.sku.toLowerCase().includes(searchLower) ||
      bundle.description?.toLowerCase().includes(searchLower)
    );
  });

  // Pagination
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredBundles.length / itemsPerPage);
  const paginatedBundles = filteredBundles.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  // Stats
  const totalBundles = bundles.length;
  const activeBundles = bundles.filter(b => b.isActive).length;
  const lowStockBundles = bundles.filter(b => b.stockOnHand <= b.reorderPoint).length;
  const negativeStockBundles = bundles.filter(b => b.stockOnHand < 0).length;

  const handleDelete = () => {
    if (!deleteBundle) return;
    setBundles(bundles.filter(b => b.id !== deleteBundle.id));
    addNotification('success', `Bundle "${deleteBundle.name}" deleted`);
    setDeleteBundle(null);
  };

  // Table columns
  const columns = [
    {
      key: 'name',
      header: 'BUNDLE NAME',
      render: (bundle: ProductBundle) => (
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${currentTheme.sidebar.logoAccent} text-white shadow-sm`}>
            <Layers className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate">{bundle.name}</p>
            <p className="text-xs text-slate-500">{bundle.components.length} components</p>
          </div>
        </div>
      ),
    },
    {
      key: 'sku',
      header: 'SKU',
      render: (bundle: ProductBundle) => (
        <span className="font-mono text-sm text-slate-600">{bundle.sku}</span>
      ),
    },
    {
      key: 'components',
      header: 'COMPONENTS',
      render: (bundle: ProductBundle) => (
        <div className="text-sm">
          {bundle.components.slice(0, 2).map((comp, idx) => (
            <p key={idx} className="text-slate-600 truncate max-w-[200px]">
              {comp.quantity}× {comp.productName}
            </p>
          ))}
          {bundle.components.length > 2 && (
            <p className="text-slate-400 text-xs">+{bundle.components.length - 2} more</p>
          )}
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'STOCK',
      render: (bundle: ProductBundle) => {
        const isNegative = bundle.stockOnHand < 0;
        const isLow = bundle.stockOnHand <= bundle.reorderPoint && bundle.stockOnHand >= 0;
        return (
          <div className="text-right">
            <p className={`font-semibold ${isNegative ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-800'}`}>
              {bundle.stockOnHand}
            </p>
            {isNegative && (
              <p className="text-xs text-red-500 flex items-center justify-end gap-1">
                <AlertTriangle className="h-3 w-3" />
                Oversold
              </p>
            )}
            {isLow && !isNegative && (
              <p className="text-xs text-amber-500">Low Stock</p>
            )}
          </div>
        );
      },
    },
    {
      key: 'cost',
      header: 'COST',
      render: (bundle: ProductBundle) => (
        <p className="text-right text-slate-600">₹{bundle.totalCost.toLocaleString('en-IN')}</p>
      ),
    },
    {
      key: 'price',
      header: 'PRICE',
      render: (bundle: ProductBundle) => (
        <div className="text-right">
          <p className="font-semibold text-slate-800">₹{bundle.sellingPrice.toLocaleString('en-IN')}</p>
          <p className="text-xs text-emerald-600">
            Margin: ₹{(bundle.sellingPrice - bundle.totalCost).toLocaleString('en-IN')}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'STATUS',
      render: (bundle: ProductBundle) => (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
          bundle.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${bundle.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
          {bundle.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '120px',
      render: (bundle: ProductBundle) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedBundle(bundle); setShowDetail(true); }}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setEditingBundle(bundle); setShowDrawer(true); }}
            className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
            title="Edit Bundle"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteBundle(bundle); }}
            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
            title="Delete Bundle"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${currentTheme.sidebar.logoAccent}`}>
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{totalBundles}</p>
              <p className="text-sm text-slate-500">Total Bundles</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
              <Layers className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{activeBundles}</p>
              <p className="text-sm text-slate-500">Active</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <Layers className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{lowStockBundles}</p>
              <p className="text-sm text-slate-500">Low Stock</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{negativeStockBundles}</p>
              <p className="text-sm text-slate-500">Oversold</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Showing {paginatedBundles.length} of {filteredBundles.length} bundles
        </p>
        <div className="flex items-center gap-3">
          <Button variant="secondary" icon={<Download className="h-4 w-4" />}>
            Export
          </Button>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowDrawer(true)}>
            Create Bundle
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search bundles by name or SKU..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <Table
          columns={columns}
          data={paginatedBundles}
          loading={loading}
          keyExtractor={(bundle) => bundle.id}
          onRowClick={(bundle) => { setSelectedBundle(bundle); setShowDetail(true); }}
          emptyMessage="No product bundles found. Create your first bundle to get started."
        />
        {totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={filteredBundles.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Detail Slide-over */}
      {showDetail && selectedBundle && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDetail(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl animate-slide-in-right bg-white shadow-2xl">
            <div className="flex h-full flex-col">
              <div className={`flex items-center justify-between border-b border-slate-100 bg-gradient-to-r ${currentTheme.sidebar.bg} px-6 py-4`}>
                <h2 className="text-lg font-semibold text-white">Bundle Details</h2>
                <button
                  onClick={() => setShowDetail(false)}
                  className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-6 flex items-center gap-4">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${currentTheme.sidebar.logoAccent} text-white`}>
                    <Layers className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-800">{selectedBundle.name}</h3>
                    <p className="text-slate-500">SKU: {selectedBundle.sku}</p>
                  </div>
                </div>
                
                <div className="space-y-6">
                  {/* Pricing */}
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Pricing</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Total Cost</p>
                        <p className="text-lg font-semibold text-slate-800">
                          ₹{selectedBundle.totalCost.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div className={`rounded-lg ${currentTheme.accentLight} p-3`}>
                        <p className="text-xs">Selling Price</p>
                        <p className="text-lg font-semibold">
                          ₹{selectedBundle.sellingPrice.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 p-3">
                        <p className="text-xs text-emerald-600">Profit Margin</p>
                        <p className="text-lg font-semibold text-emerald-700">
                          ₹{(selectedBundle.sellingPrice - selectedBundle.totalCost).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Components */}
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
                      Bill of Materials ({selectedBundle.components.length} items)
                    </h4>
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">COMPONENT</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">QTY</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">COST</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBundle.components.map((comp, idx) => (
                            <tr key={idx} className="border-t border-slate-100">
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-800">{comp.productName}</p>
                                <p className="text-xs text-slate-500">{comp.productSku}</p>
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-slate-700">
                                {comp.quantity}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-600">
                                ₹{(comp.unitCost * comp.quantity).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-slate-200 bg-slate-50">
                            <td className="px-4 py-3 font-semibold text-slate-700" colSpan={2}>
                              Total Component Cost
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-800">
                              ₹{selectedBundle.totalCost.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Stock Info */}
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Inventory</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className={`rounded-lg p-3 ${selectedBundle.stockOnHand < 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                        <p className={`text-xs ${selectedBundle.stockOnHand < 0 ? 'text-red-500' : 'text-slate-500'}`}>Stock on Hand</p>
                        <p className={`text-lg font-semibold ${selectedBundle.stockOnHand < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                          {selectedBundle.stockOnHand}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Reorder Point</p>
                        <p className="text-lg font-semibold text-slate-800">{selectedBundle.reorderPoint}</p>
                      </div>
                    </div>
                  </div>

                  {selectedBundle.description && (
                    <div>
                      <h4 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Description</h4>
                      <p className="text-slate-700">{selectedBundle.description}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 border-t border-slate-100 p-6">
                <Button 
                  variant="secondary" 
                  className="flex-1" 
                  icon={<Factory className="h-4 w-4" />}
                  onClick={() => addNotification('info', 'Production feature coming soon!')}
                >
                  Create Production Order
                </Button>
                <Button variant="secondary" onClick={() => { setEditingBundle(selectedBundle); setShowDrawer(true); setShowDetail(false); }}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button variant="danger" onClick={() => { setDeleteBundle(selectedBundle); setShowDetail(false); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteBundle}
        onClose={() => setDeleteBundle(null)}
        title="Delete Bundle"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteBundle(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-slate-600">
          Are you sure you want to delete <strong>{deleteBundle?.name}</strong>? This action cannot be undone.
        </p>
      </Modal>

      {/* Create/Edit Drawer - Placeholder */}
      <Drawer
        isOpen={showDrawer}
        onClose={() => { setShowDrawer(false); setEditingBundle(null); }}
        title={editingBundle ? 'Edit Bundle' : 'Create Product Bundle'}
        subtitle={editingBundle ? `Editing ${editingBundle.name}` : 'Define components for your bundle'}
        size="xl"
      >
        <div className="p-6">
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Layers className="h-16 w-16 text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700">Bundle Builder</h3>
            <p className="text-slate-500 mt-2 max-w-md">
              The bundle builder interface will be implemented here. You'll be able to:
            </p>
            <ul className="text-sm text-slate-500 mt-4 space-y-1">
              <li>• Add products as components</li>
              <li>• Set quantities for each component</li>
              <li>• Auto-calculate total cost</li>
              <li>• Set bundle selling price</li>
            </ul>
            <Button className="mt-6" onClick={() => { setShowDrawer(false); addNotification('info', 'Bundle builder coming soon!'); }}>
              Coming Soon
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}

