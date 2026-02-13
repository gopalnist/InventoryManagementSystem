import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  Hourglass,
  Box,
  DollarSign,
  Calendar,
  MapPin,
  User,
  FileText,
  RefreshCcw,
  ChevronRight,
  AlertCircle,
  Printer,
} from 'lucide-react';
import { salesOrdersApi, productsApi } from '../services/api';
import type {
  SalesOrder,
  SalesOrderItem,
  SalesOrderItemCreate,
  SalesOrderStatus,
  Product,
} from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Drawer } from '../components/ui/Drawer';
import { Table } from '../components/ui/Table';
import { useThemeStore } from '../store/themeStore';
import { format } from 'date-fns';

export function SalesOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTheme } = useThemeStore();

  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddItemDrawerOpen, setIsAddItemDrawerOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [newItemForm, setNewItemForm] = useState<SalesOrderItemCreate>({
    product_id: '',
    item_type: 'product',
    sku: '',
    name: '',
    quantity_ordered: 1,
    unit_price: 0,
    tax_rate: 0,
    discount_percentage: 0,
  });

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const orderData = await salesOrdersApi.get(id);
      setOrder(orderData);
    } catch (error) {
      console.error('Failed to fetch order:', error);
      alert('Failed to load order details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchProducts = useCallback(async () => {
    try {
      const productsRes = await productsApi.list({ limit: 500 });
      setProducts(productsRes.products);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  }, []);

  useEffect(() => {
    fetchOrder();
    fetchProducts();
  }, [fetchOrder, fetchProducts]);

  const handleStatusChange = async (newStatus: SalesOrderStatus) => {
    if (!order) return;
    try {
      await salesOrdersApi.updateStatus(order.id, newStatus);
      fetchOrder();
    } catch (error: any) {
      console.error('Failed to update status:', error);
      alert(`Failed to update status: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleDeleteOrder = async () => {
    if (!order || !window.confirm('Are you sure you want to delete this order?')) return;
    try {
      await salesOrdersApi.delete(order.id);
      navigate('/ims/sales/orders');
    } catch (error: any) {
      console.error('Failed to delete:', error);
      alert(`Failed to delete: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setSelectedProduct(product);
      setNewItemForm({
        ...newItemForm,
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        unit_price: product.selling_price || 0,
      });
    }
  };

  const handleAddLineItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    try {
      await salesOrdersApi.addLineItem(order.id, newItemForm);
      setIsAddItemDrawerOpen(false);
      setNewItemForm({
        product_id: '',
        item_type: 'product',
        sku: '',
        name: '',
        quantity_ordered: 1,
        unit_price: 0,
        tax_rate: 0,
        discount_percentage: 0,
      });
      setSelectedProduct(null);
      fetchOrder();
    } catch (error: any) {
      console.error('Failed to add item:', error);
      alert(`Failed to add item: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleDeleteLineItem = async (itemId: string) => {
    if (!order || !window.confirm('Remove this item from the order?')) return;
    try {
      await salesOrdersApi.deleteLineItem(order.id, itemId);
      fetchOrder();
    } catch (error: any) {
      console.error('Failed to remove item:', error);
      alert(`Failed to remove item: ${error.response?.data?.detail || error.message}`);
    }
  };

  const getStatusIcon = (status: SalesOrderStatus) => {
    const icons: Record<SalesOrderStatus, JSX.Element> = {
      draft: <FileText className="h-5 w-5" />,
      pending: <Hourglass className="h-5 w-5" />,
      confirmed: <CheckCircle className="h-5 w-5" />,
      processing: <Box className="h-5 w-5" />,
      packed: <Package className="h-5 w-5" />,
      shipped: <Truck className="h-5 w-5" />,
      delivered: <CheckCircle className="h-5 w-5" />,
      invoiced: <DollarSign className="h-5 w-5" />,
      cancelled: <XCircle className="h-5 w-5" />,
      on_hold: <Clock className="h-5 w-5" />,
    };
    return icons[status] || <AlertCircle className="h-5 w-5" />;
  };

  const getStatusColor = (status: SalesOrderStatus) => {
    const colors: Record<SalesOrderStatus, string> = {
      draft: 'bg-slate-100 text-slate-700 border-slate-300',
      pending: 'bg-amber-100 text-amber-700 border-amber-300',
      confirmed: 'bg-blue-100 text-blue-700 border-blue-300',
      processing: 'bg-purple-100 text-purple-700 border-purple-300',
      packed: 'bg-indigo-100 text-indigo-700 border-indigo-300',
      shipped: 'bg-emerald-100 text-emerald-700 border-emerald-300',
      delivered: 'bg-green-100 text-green-700 border-green-300',
      invoiced: 'bg-teal-100 text-teal-700 border-teal-300',
      cancelled: 'bg-red-100 text-red-700 border-red-300',
      on_hold: 'bg-orange-100 text-orange-700 border-orange-300',
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  const nextStatusOptions: Record<SalesOrderStatus, SalesOrderStatus[]> = {
    draft: ['confirmed', 'cancelled'],
    pending_confirmation: ['confirmed', 'cancelled', 'on_hold'],
    confirmed: ['processing', 'cancelled', 'on_hold'],
    processing: ['packed', 'cancelled', 'on_hold'],
    packed: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: ['invoiced'],
    invoiced: [],
    cancelled: [],
    on_hold: ['pending_confirmation', 'confirmed', 'processing'],
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <AlertCircle className="h-16 w-16 text-slate-300" />
        <p className="text-lg text-slate-500">Order not found</p>
        <Button onClick={() => navigate('/ims/sales/orders')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Orders
        </Button>
      </div>
    );
  }

  const availableTransitions = nextStatusOptions[order.status] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/ims/sales/orders')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-800">{order.order_number}</h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${getStatusColor(order.status)}`}
              >
                {getStatusIcon(order.status)}
                {order.status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </span>
            </div>
            {order.reference_number && (
              <p className="text-sm text-slate-500">Ref: {order.reference_number}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Secondary actions */}
          <Button variant="secondary" size="md" icon={<RefreshCcw className="h-4 w-4" />} onClick={fetchOrder}>
            Refresh
          </Button>
          <Button variant="secondary" size="md" icon={<Printer className="h-4 w-4" />}>
            Print
          </Button>
          
          {/* Divider */}
          {availableTransitions.length > 0 && (
            <div className="h-8 w-px bg-slate-200 mx-1" />
          )}
          
          {/* Status transition buttons */}
          {availableTransitions.map((nextStatus) => {
            const buttonConfig: Record<string, { label: string; variant: 'primary' | 'success' | 'warning' | 'danger' | 'secondary'; icon: React.ReactNode }> = {
              confirmed: { 
                label: 'Confirm Order', 
                variant: 'success', 
                icon: <CheckCircle className="h-4 w-4" /> 
              },
              processing: { 
                label: 'Start Processing', 
                variant: 'primary', 
                icon: <Package className="h-4 w-4" /> 
              },
              packed: { 
                label: 'Mark Packed', 
                variant: 'primary', 
                icon: <Package className="h-4 w-4" /> 
              },
              shipped: { 
                label: 'Ship Order', 
                variant: 'primary', 
                icon: <Truck className="h-4 w-4" /> 
              },
              delivered: { 
                label: 'Mark Delivered', 
                variant: 'success', 
                icon: <CheckCircle className="h-4 w-4" /> 
              },
              invoiced: { 
                label: 'Generate Invoice', 
                variant: 'primary', 
                icon: <FileText className="h-4 w-4" /> 
              },
              cancelled: { 
                label: 'Cancel Order', 
                variant: 'danger', 
                icon: <XCircle className="h-4 w-4" /> 
              },
              on_hold: { 
                label: 'Put on Hold', 
                variant: 'warning', 
                icon: <AlertCircle className="h-4 w-4" /> 
              },
              pending_confirmation: { 
                label: 'Revert to Pending', 
                variant: 'secondary', 
                icon: <Clock className="h-4 w-4" /> 
              },
            };
            
            const config = buttonConfig[nextStatus] || { 
              label: nextStatus.replace(/_/g, ' '), 
              variant: 'secondary' as const, 
              icon: null 
            };
            
            return (
              <Button
                key={nextStatus}
                variant={config.variant}
                size="md"
                icon={config.icon}
                onClick={() => handleStatusChange(nextStatus)}
              >
                {config.label}
              </Button>
            );
          })}
          
          {/* Delete button for draft orders */}
          {order.status === 'draft' && (
            <>
              <div className="h-8 w-px bg-slate-200 mx-1" />
              <Button variant="danger" size="md" icon={<Trash2 className="h-4 w-4" />} onClick={handleDeleteOrder}>
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Order Info Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Order Details */}
        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
            <FileText className="h-5 w-5 text-primary" /> Order Details
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Platform</dt>
              <dd className="font-medium capitalize">{order.platform}</dd>
            </div>
            {order.platform_order_id && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Platform Order ID</dt>
                <dd className="font-medium">{order.platform_order_id}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-500">Order Date</dt>
              <dd className="font-medium">{format(new Date(order.order_date), 'MMM dd, yyyy')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Priority</dt>
              <dd className="font-medium capitalize">{order.priority}</dd>
            </div>
          </dl>
        </div>

        {/* Customer Info */}
        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
            <User className="h-5 w-5 text-primary" /> Customer
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Name</dt>
              <dd className="font-medium">{order.customer_name || 'Walk-in'}</dd>
            </div>
          </dl>
        </div>

        {/* Fulfillment Info */}
        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
            <MapPin className="h-5 w-5 text-primary" /> Fulfillment
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Center</dt>
              <dd className="font-medium">{order.fulfillment_center_name || 'Not assigned'}</dd>
            </div>
            {order.expected_shipment_date && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Expected Ship</dt>
                <dd className="font-medium">
                  {format(new Date(order.expected_shipment_date), 'MMM dd, yyyy')}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Totals */}
        <div className="card bg-primary/5 p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
            <DollarSign className="h-5 w-5 text-primary" /> Order Total
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="font-medium">₹{(order.subtotal || 0).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Tax</dt>
              <dd className="font-medium">₹{(order.tax_amount || 0).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Discount</dt>
              <dd className="font-medium text-red-600">-₹{(order.discount_amount || 0).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Shipping</dt>
              <dd className="font-medium">₹{(order.shipping_charges || 0).toLocaleString()}</dd>
            </div>
            <hr className="my-2" />
            <div className="flex justify-between text-lg">
              <dt className="font-semibold">Grand Total</dt>
              <dd className="font-bold text-primary">₹{(order.total_amount || 0).toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Line Items */}
      <div className="card">
        <div className="flex items-center justify-between border-b p-5">
          <h3 className="text-lg font-semibold text-slate-800">
            Line Items ({order.items?.length || 0})
          </h3>
          {(order.status === 'draft' || order.status === 'pending') && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setIsAddItemDrawerOpen(true)}>
              Add Item
            </Button>
          )}
        </div>

        {order.items && order.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right">Qty Ordered</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Line Total</th>
                  <th className="px-4 py-3">Status</th>
                  {(order.status === 'draft' || order.status === 'pending_confirmation') && (
                    <th className="px-4 py-3 text-center">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm">{item.sku || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{item.product_name}</p>
                      {item.asin && (
                        <p className="text-xs text-slate-500">ASIN: {item.asin}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{item.quantity_ordered}</td>
                    <td className="px-4 py-3 text-right">₹{(Number(item.unit_price) || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold">₹{(Number(item.line_total) || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : item.status === 'shipped'
                              ? 'bg-emerald-100 text-emerald-700'
                              : item.status === 'delivered'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    {(order.status === 'draft' || order.status === 'pending_confirmation') && (
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteLineItem(item.id)}
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Package className="mb-4 h-16 w-16" />
            <p className="mb-2 text-lg">No items in this order</p>
            {(order.status === 'draft' || order.status === 'pending') && (
              <Button onClick={() => setIsAddItemDrawerOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add First Item
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Status History */}
      {order.status_history && order.status_history.length > 0 && (
        <div className="card p-5">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">Status History</h3>
          <div className="space-y-3">
            {order.status_history.map((history, idx) => (
              <div key={history.id} className="flex items-center gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm">
                    {history.old_status ? (
                      <>
                        <span className="capitalize">{history.old_status}</span>
                        <span className="mx-2">→</span>
                      </>
                    ) : (
                      'Created as '
                    )}
                    <span className="font-semibold capitalize">{history.new_status}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {format(new Date(history.change_date), 'MMM dd, yyyy HH:mm')}
                  </p>
                  {history.notes && <p className="mt-1 text-sm text-slate-600">{history.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {order.notes && (
        <div className="card p-5">
          <h3 className="mb-2 font-semibold text-slate-700">Notes</h3>
          <p className="text-slate-600">{order.notes}</p>
        </div>
      )}

      {/* Add Item Drawer */}
      <Drawer
        isOpen={isAddItemDrawerOpen}
        onClose={() => setIsAddItemDrawerOpen(false)}
        title="Add Line Item"
      >
        <form onSubmit={handleAddLineItem} className="space-y-4 p-6">
          <Select
            label="Select Product"
            options={[
              { value: '', label: 'Select a product...' },
              ...products.map((p) => ({ value: p.id, label: `${p.sku} - ${p.name}` })),
            ]}
            value={newItemForm.product_id || ''}
            onChange={handleProductSelect}
          />

          {selectedProduct && (
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="font-medium">{selectedProduct.name}</p>
              <p className="text-sm text-slate-500">SKU: {selectedProduct.sku}</p>
              <p className="text-sm text-slate-500">
                Price: ₹{selectedProduct.selling_price?.toLocaleString() || 0}
              </p>
            </div>
          )}

          <Input
            label="SKU"
            value={newItemForm.sku}
            onChange={(e) => setNewItemForm({ ...newItemForm, sku: e.target.value })}
            required
          />

          <Input
            label="Product Name"
            value={newItemForm.name}
            onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantity"
              type="number"
              min={1}
              value={newItemForm.quantity_ordered}
              onChange={(e) =>
                setNewItemForm({ ...newItemForm, quantity_ordered: parseInt(e.target.value) || 1 })
              }
              required
            />

            <Input
              label="Unit Price"
              type="number"
              min={0}
              step={0.01}
              value={newItemForm.unit_price}
              onChange={(e) =>
                setNewItemForm({ ...newItemForm, unit_price: parseFloat(e.target.value) || 0 })
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Tax Rate (%)"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={newItemForm.tax_rate}
              onChange={(e) =>
                setNewItemForm({ ...newItemForm, tax_rate: parseFloat(e.target.value) || 0 })
              }
            />

            <Input
              label="Discount (%)"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={newItemForm.discount_percentage}
              onChange={(e) =>
                setNewItemForm({ ...newItemForm, discount_percentage: parseFloat(e.target.value) || 0 })
              }
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsAddItemDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Item</Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}

