import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, CheckCircle, XCircle, AlertTriangle, 
  Clock, Package, FileText, Send, ExternalLink
} from 'lucide-react';
import axios from 'axios';

interface POLine {
  id: number;
  line_number: number;
  channel_identifier_type: string | null;
  channel_identifier_value: string | null;
  item_name: string | null;
  ordered_qty: number;
  unit_price: number | null;
  sku_id: number | null;
  sku_code: string | null;
  sku_name: string | null;
  available_qty: number | null;
  allocated_qty: number | null;
  unallocated_qty: number | null;
  line_status: string | null;
  status_reason: string | null;
}

interface PurchaseOrder {
  id: number;
  channel: string;
  po_number: string;
  fc_code: string | null;
  po_date: string | null;
  status: string;
  fulfillment_status: string | null;
  is_cancelled: boolean;
  cancelled_at: string | null;
  cancel_reason: string | null;
  source_filename: string | null;
  validated_at: string | null;
  created_at: string;
  vendor_name: string;
  vendor_code: string;
  lines: POLine[];
  // IMS integration fields
  ims_order_id: string | null;
  ims_order_number: string | null;
  pushed_to_ims_at: string | null;
}

export function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    async function fetchOrder() {
      try {
        const response = await axios.get(`/api/v1/purchase-orders/${id}`);
        setOrder(response.data);
      } catch (error) {
        console.error('Error fetching order:', error);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchOrder();
  }, [id]);

  const handleValidate = async () => {
    if (!order) return;
    setValidating(true);
    try {
      await axios.post(`/api/v1/purchase-orders/${order.id}/validate`);
      const response = await axios.get(`/api/v1/purchase-orders/${id}`);
      setOrder(response.data);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handleCancel = async () => {
    if (!order || !confirm('Are you sure you want to cancel this order?')) return;
    setCancelling(true);
    try {
      await axios.post(`/api/v1/purchase-orders/${order.id}/cancel`, null, {
        params: { reason: 'Cancelled by user' }
      });
      navigate('/ams/orders');
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Cancellation failed');
    } finally {
      setCancelling(false);
    }
  };

  const handleReserveStock = async () => {
    if (!order) return;
    setReserving(true);
    try {
      const result = await axios.post(`/api/v1/purchase-orders/${order.id}/reserve`);
      if (result.data.success) {
        const status = result.data.status;
        const method = result.data.notification_method;
        
        if (status === 'CONFIRMED') {
          alert(`✅ Stock Reserved & Order Confirmed!\n\nMethod: ${method}\nIMS Order: ${result.data.ims_order_id || 'N/A'}`);
        } else {
          alert(`✅ Stock Reserved!\n\nStatus: ${status}\nNotification: ${method}\n\n${result.data.message}`);
        }
        // Refresh the order
        const response = await axios.get(`/api/v1/purchase-orders/${id}`);
        setOrder(response.data);
      } else {
        alert(`❌ Reservation failed:\n${result.data.message}`);
      }
    } catch (error: any) {
      alert(error.response?.data?.detail || error.response?.data?.message || 'Reservation failed');
    } finally {
      setReserving(false);
    }
  };

  const handleConfirmOrder = async () => {
    if (!order) return;
    setConfirming(true);
    try {
      const result = await axios.post(`/api/v1/purchase-orders/${order.id}/confirm`);
      if (result.data.success) {
        alert('✅ Order Confirmed!');
        const response = await axios.get(`/api/v1/purchase-orders/${id}`);
        setOrder(response.data);
      } else {
        alert(`❌ Confirmation failed:\n${result.data.message}`);
      }
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Confirmation failed');
    } finally {
      setConfirming(false);
    }
  };

  const getStatusBadge = (status: string, fulfillmentStatus: string | null) => {
    if (status === 'CONFIRMED' || status === 'PUSHED_TO_IMS') {
      return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"><CheckCircle className="w-4 h-4 mr-1.5" />Confirmed</span>;
    }
    if (status === 'RESERVED') {
      if (fulfillmentStatus === 'FULFILLED') {
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"><Package className="w-4 h-4 mr-1.5" />Reserved - Full</span>;
      } else if (fulfillmentStatus === 'PARTIAL') {
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800"><Package className="w-4 h-4 mr-1.5" />Reserved - Partial</span>;
      } else {
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800"><Package className="w-4 h-4 mr-1.5" />Reserved - None</span>;
      }
    }
    if (status === 'VALIDATED') {
      return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800"><CheckCircle className="w-4 h-4 mr-1.5" />Validated</span>;
    }
    return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"><Clock className="w-4 h-4 mr-1.5" />Pending</span>;
  };

  const getLineStatusBadge = (status: string | null) => {
    switch (status) {
      case 'FULFILLED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Fulfilled</span>;
      case 'PARTIAL':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">Partial</span>;
      case 'NONE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">None</span>;
      case 'SKU_NOT_FOUND':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">SKU Not Found</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Pending</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Order not found</p>
        <Link to="/ams/orders" className="text-indigo-600 hover:text-indigo-800 mt-2 inline-block">
          Back to Orders
        </Link>
      </div>
    );
  }

  const totalOrdered = order.lines.reduce((sum, line) => sum + line.ordered_qty, 0);
  const totalAllocated = order.lines.reduce((sum, line) => sum + (line.allocated_qty || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/ams/orders')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{order.po_number}</h1>
            <p className="text-gray-500">
              {order.channel.toUpperCase()} • {order.vendor_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* For RECEIVED orders: Reserve Stock button */}
          {order.status === 'RECEIVED' && !order.is_cancelled && (
            <>
              <button
                onClick={handleReserveStock}
                disabled={reserving}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                <Package className="w-4 h-4 mr-2" />
                {reserving ? 'Reserving...' : 'Reserve Stock'}
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel Order
              </button>
            </>
          )}
          
          {/* For RESERVED orders: Manual Confirm or View */}
          {order.status === 'RESERVED' && !order.is_cancelled && (
            <>
              <button
                onClick={handleConfirmOrder}
                disabled={confirming}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {confirming ? 'Confirming...' : 'Mark as Confirmed'}
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel Order
              </button>
            </>
          )}
          
          {/* For CONFIRMED orders: View in IMS link */}
          {(order.status === 'CONFIRMED' || order.status === 'PUSHED_TO_IMS') && order.ims_order_id && (
            <a
              href={`/ims/sales/orders/${order.ims_order_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 border border-green-300 rounded-md shadow-sm text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View in IMS
            </a>
          )}
        </div>
      </div>

      {/* Order Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Status</h3>
          {getStatusBadge(order.status, order.fulfillment_status)}
          {order.validated_at && (
            <p className="text-xs text-gray-500 mt-2">
              Validated: {new Date(order.validated_at).toLocaleString()}
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Order Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">FC Code:</span>
              <span className="font-medium">{order.fc_code || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Created:</span>
              <span className="font-medium">{new Date(order.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Source File:</span>
              <span className="font-medium truncate max-w-[150px]">{order.source_filename || '-'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Allocation Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Lines:</span>
              <span className="font-medium">{order.lines.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Ordered:</span>
              <span className="font-medium">{totalOrdered.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Allocated:</span>
              <span className="font-medium text-green-600">{totalAllocated.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Order Status Info */}
      {order.status === 'RESERVED' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-start">
            <Clock className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-yellow-900 font-semibold">Awaiting Confirmation</h3>
              <p className="mt-1 text-sm text-yellow-800">
                Stock has been reserved. Waiting for IMS confirmation.
              </p>
              <p className="mt-2 text-sm text-yellow-700">
                Click "Mark as Confirmed" after the order is confirmed in your IMS.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* IMS Integration Info */}
      {order.ims_order_id && (order.status === 'CONFIRMED' || order.status === 'PUSHED_TO_IMS') && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-start">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-green-900 font-semibold">Order Confirmed in IMS</h3>
              <div className="mt-2 space-y-1 text-sm text-green-800">
                <p><span className="font-medium">IMS Order:</span> {order.ims_order_number}</p>
                <p><span className="font-medium">IMS Order ID:</span> <span className="font-mono text-xs">{order.ims_order_id}</span></p>
                {order.pushed_to_ims_at && (
                  <p><span className="font-medium">Confirmed at:</span> {new Date(order.pushed_to_ims_at).toLocaleString()}</p>
                )}
              </div>
              <a
                href={`/ims/sales/orders/${order.ims_order_id}`}
                className="mt-3 inline-flex items-center text-sm font-medium text-green-700 hover:text-green-900"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                View Sales Order in IMS
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Cancelled Banner */}
      {order.is_cancelled && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <XCircle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-800 font-medium">This order has been cancelled</span>
          </div>
          {order.cancel_reason && (
            <p className="text-red-600 text-sm mt-1">Reason: {order.cancel_reason}</p>
          )}
        </div>
      )}

      {/* Line Items */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Line Items</h3>
          <span className="text-sm text-gray-500">{order.lines.length} items</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Identifier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ordered</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Available</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Allocated</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {order.lines.map((line) => (
                <tr key={line.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {line.line_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <span className="text-gray-500">{line.channel_identifier_type}:</span>
                      <span className="ml-1 font-mono text-gray-900">{line.channel_identifier_value || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-[250px] truncate">
                      {line.item_name || line.sku_name || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {line.sku_code ? (
                      <span className="font-mono text-sm text-indigo-600">{line.sku_code}</span>
                    ) : (
                      <span className="text-sm text-gray-400">Not mapped</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {line.ordered_qty.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                    {line.available_qty !== null ? line.available_qty.toLocaleString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">
                    {line.allocated_qty !== null ? line.allocated_qty.toLocaleString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getLineStatusBadge(line.line_status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
