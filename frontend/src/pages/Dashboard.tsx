import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  FolderTree,
  Users,
  Truck,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ShoppingCart,
  AlertTriangle,
  Clock,
  Plus,
  RefreshCcw,
} from 'lucide-react';
import { dashboardApi, categoriesApi } from '../services/api';
import type { RecentProduct, DashboardStats } from '../services/api';
import type { Category } from '../types';
import { Button } from '../components/ui/Button';
import { useThemeStore } from '../store/themeStore';

interface StatCard {
  title: string;
  value: number;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  href: string;
}

export function Dashboard() {
  const { currentTheme } = useThemeStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    products_count: 0,
    categories_count: 0,
    suppliers_count: 0,
    customers_count: 0,
    units_count: 0,
  });
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);
  const [topCategories, setTopCategories] = useState<Category[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Single optimized API call for all dashboard data (replaces 5 calls!)
      const [dashboardRes, categoriesRes] = await Promise.all([
        dashboardApi.getAll(5).catch(() => ({
          stats: { products_count: 0, categories_count: 0, suppliers_count: 0, customers_count: 0, units_count: 0 },
          recent_products: [],
        })),
        categoriesApi.getTree().catch(() => ({ categories: [], total: 0 })),
      ]);

      setStats(dashboardRes.stats);
      setRecentProducts(dashboardRes.recent_products);
      setTopCategories(categoriesRes.categories.slice(0, 5));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards: StatCard[] = [
    {
      title: 'Total Products',
      value: stats.products_count,
      change: 12,
      icon: Package,
      color: currentTheme.sidebar.logoAccent, // Use theme accent
      href: '/products',
    },
    {
      title: 'Categories',
      value: stats.categories_count,
      icon: FolderTree,
      color: 'from-emerald-500 to-emerald-600',
      href: '/products',
    },
    {
      title: 'Suppliers',
      value: stats.suppliers_count,
      change: 5,
      icon: Truck,
      color: 'from-amber-500 to-orange-600',
      href: '/parties?type=supplier',
    },
    {
      title: 'Customers',
      value: stats.customers_count,
      change: 8,
      icon: Users,
      color: 'from-violet-500 to-purple-600',
      href: '/parties?type=customer',
    },
  ];

  const quickActions = [
    { label: 'Add Product', icon: Package, href: '/products?action=new', color: currentTheme.accent },
    { label: 'Add Supplier', icon: Truck, href: '/parties?action=new&type=supplier', color: 'bg-amber-600' },
    { label: 'Add Customer', icon: Users, href: '/parties?action=new&type=customer', color: 'bg-violet-600' },
    { label: 'Product Bundles', icon: FolderTree, href: '/products/bundles', color: 'bg-emerald-600' },
  ];

  // Get theme accent for loading spinner
  const spinnerColor = currentTheme.accent.replace('bg-', 'border-');

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className={`h-12 w-12 animate-spin rounded-full border-4 ${spinnerColor} border-t-transparent`} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className={`rounded-2xl bg-gradient-to-r ${currentTheme.sidebar.bg} p-6 text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Welcome back, Demo User! 👋</h2>
            <p className="mt-1 text-white/70">Here's what's happening with your inventory today.</p>
          </div>
          <Button
            variant="secondary"
            icon={<RefreshCcw className="h-4 w-4" />}
            onClick={loadDashboardData}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <Link
            key={stat.title}
            to={stat.href}
            className="card group relative overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg animate-fade-in"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {/* Background gradient */}
            <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br ${stat.color} opacity-10 transition-transform group-hover:scale-150`} />
            
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${stat.color} shadow-lg`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                {stat.change && (
                  <div className={`flex items-center gap-1 text-sm font-medium ${stat.change > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {stat.change > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    <span>{Math.abs(stat.change)}%</span>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-bold text-slate-800">{stat.value.toLocaleString()}</h3>
                <p className="mt-1 text-sm text-slate-500">{stat.title}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              to={action.href}
              className="group flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all hover:border-slate-300 hover:bg-white hover:shadow-md"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${action.color} text-white shadow-lg transition-transform group-hover:scale-110`}>
                <Plus className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-slate-700">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Products */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-800">Recent Products</h2>
            <Link
              to="/products"
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <Package className="mb-3 h-12 w-12 text-slate-300" />
                <p className="text-sm">No products yet</p>
                <Link to="/products?action=new" className="mt-2 text-sm font-medium text-blue-600">
                  Add your first product
                </Link>
              </div>
            ) : (
              recentProducts.map((product, index) => (
                <Link
                  key={product.id}
                  to={`/products/${product.id}`}
                  className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-slate-50 animate-slide-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                    <Package className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{product.name}</p>
                    <p className="text-xs text-slate-500">SKU: {product.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800">
                      ₹{product.selling_price?.toLocaleString() || '-'}
                    </p>
                    <p className="text-xs text-slate-500">{product.category_name || 'No category'}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Categories */}
          <div className="card">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-800">Categories</h2>
              <Link
                to="/products"
                className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                View Products
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="p-4">
              {topCategories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                  <FolderTree className="mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm">No categories yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {topCategories.map((category, index) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 animate-slide-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                          <FolderTree className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">{category.name}</span>
                      </div>
                      {category.children && category.children.length > 0 && (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                          {category.children.length} sub
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Alerts/Pending Actions */}
          <div className="card">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-800">Pending Actions</h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-amber-50 px-4 py-3 text-amber-800">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Low Stock Alert</p>
                  <p className="text-xs text-amber-600">0 items below reorder level</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-3 text-blue-800">
                <Clock className="h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Setup Pending</p>
                  <p className="text-xs text-blue-600">Complete your inventory setup</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3 text-slate-600">
                <ShoppingCart className="h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">No Orders Yet</p>
                  <p className="text-xs text-slate-500">Sales module coming soon</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Units Summary */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">System Overview</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 p-4">
            <p className="text-2xl font-bold text-slate-800">{stats.products_count}</p>
            <p className="text-sm text-slate-500">Products in catalog</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 p-4">
            <p className="text-2xl font-bold text-slate-800">{stats.categories_count}</p>
            <p className="text-sm text-slate-500">Categories</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 p-4">
            <p className="text-2xl font-bold text-slate-800">{stats.units_count}</p>
            <p className="text-sm text-slate-500">Units of measure</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 p-4">
            <p className="text-2xl font-bold text-slate-800">{stats.suppliers_count}</p>
            <p className="text-sm text-slate-500">Suppliers</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 p-4">
            <p className="text-2xl font-bold text-slate-800">{stats.customers_count}</p>
            <p className="text-sm text-slate-500">Customers</p>
          </div>
        </div>
      </div>
    </div>
  );
}

