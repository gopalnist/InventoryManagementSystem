import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, Warehouse, ShoppingCart, AlertTriangle,
  CheckCircle, Clock, XCircle, TrendingUp
} from 'lucide-react';
import axios from 'axios';

interface DashboardStats {
  vendor: { id: number; vendor_code: string; vendor_name: string } | null;
  total_skus: number;
  total_warehouses: number;
  total_orders: number;
  pending_orders: number;
  fulfilled_orders: number;
  partial_orders: number;
  total_inventory_qty: number;
}

interface RecentOrder {
  id: number;
  channel: string;
  po_number: string;
  fc_code: string | null;
  status: string;
  fulfillment_status: string | null;
  created_at: string;
  line_count: number;
}

export function AMSDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, ordersRes] = await Promise.all([
          axios.get('/api/v1/dashboard/stats'),
          axios.get('/api/v1/dashboard/recent-orders')
        ]);
        setStats(statsRes.data);
        setRecentOrders(ordersRes.data);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total SKUs',
      value: stats?.total_skus || 0,
      icon: Package,
      color: 'bg-blue-500',
      link: '/ams/skus'
    },
    {
      title: 'Warehouses',
      value: stats?.total_warehouses || 0,
      icon: Warehouse,
      color: 'bg-green-500',
      link: '/ams/warehouses'
    },
    {
      title: 'Total Orders',
      value: stats?.total_orders || 0,
      icon: ShoppingCart,
      color: 'bg-purple-500',
      link: '/ams/orders'
    },
    {
      title: 'Pending Orders',
      value: stats?.pending_orders || 0,
      icon: Clock,
      color: 'bg-yellow-500',
      link: '/ams/orders?status=RECEIVED'
    },
  ];

  const getStatusBadge = (status: string, fulfillmentStatus: string | null) => {
    if (status === 'VALIDATED') {
      if (fulfillmentStatus === 'FULFILLED') {
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Fulfilled</span>;
      } else if (fulfillmentStatus === 'PARTIAL') {
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><AlertTriangle className="w-3 h-3 mr-1" />Partial</span>;
      } else {
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />None</span>;
      }
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"><Clock className="w-3 h-3 mr-1" />Pending</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AMS Dashboard</h1>
          <p className="text-gray-500 mt-1">
            {stats?.vendor ? `Vendor: ${stats.vendor.vendor_name} (${stats.vendor.vendor_code})` : 'No vendor configured'}
          </p>
        </div>
        <Link
          to="/ams/orders"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          View All Orders
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <Link
            key={card.title}
            to={card.link}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center">
              <div className={`${card.color} rounded-lg p-3 text-white`}>
                <card.icon className="w-6 h-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Order Status Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Order Status</h3>
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Fulfilled</span>
              <span className="text-sm font-medium text-green-600">{stats?.fulfilled_orders || 0}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full" 
                style={{ width: `${stats?.total_orders ? (stats.fulfilled_orders / stats.total_orders * 100) : 0}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Partial</span>
              <span className="text-sm font-medium text-yellow-600">{stats?.partial_orders || 0}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-yellow-500 h-2 rounded-full" 
                style={{ width: `${stats?.total_orders ? (stats.partial_orders / stats.total_orders * 100) : 0}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Pending</span>
              <span className="text-sm font-medium text-gray-600">{stats?.pending_orders || 0}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gray-500 h-2 rounded-full" 
                style={{ width: `${stats?.total_orders ? (stats.pending_orders / stats.total_orders * 100) : 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Inventory Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Inventory</h3>
            <Package className="w-5 h-5 text-gray-400" />
          </div>
          <div className="text-center py-8">
            <p className="text-4xl font-bold text-indigo-600">
              {(stats?.total_inventory_qty || 0).toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-2">Total Units in Stock</p>
          </div>
          <Link
            to="/ams/inventory"
            className="block w-full text-center text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            View Inventory →
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Link
              to="/ams/orders"
              className="block w-full text-left px-4 py-3 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              <span className="font-medium">Upload PO</span>
              <p className="text-xs text-indigo-500 mt-0.5">Import Amazon/Zepto PO file</p>
            </Link>
            <Link
              to="/ams/inventory"
              className="block w-full text-left px-4 py-3 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
            >
              <span className="font-medium">Upload Inventory</span>
              <p className="text-xs text-green-500 mt-0.5">Update stock levels from CSV</p>
            </Link>
            <Link
              to="/ams/skus"
              className="block w-full text-left px-4 py-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <span className="font-medium">Manage SKUs</span>
              <p className="text-xs text-blue-500 mt-0.5">Add or update product SKUs</p>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Orders</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FC Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lines</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No orders yet. Upload a PO file to get started.
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link to={`/ams/orders/${order.id}`} className="text-indigo-600 hover:text-indigo-800 font-medium">
                        {order.po_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="capitalize">{order.channel}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {order.fc_code || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {order.line_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(order.status, order.fulfillment_status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-sm">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
