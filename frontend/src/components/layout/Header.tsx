import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Bell,
  User,
  ChevronDown,
  HelpCircle,
  LogOut,
  Settings,
  Menu,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useThemeStore } from '../../store/themeStore';

interface HeaderProps {
  module?: 'ims' | 'ams';
}

// IMS page titles
const imsPageTitles: Record<string, { title: string; subtitle?: string }> = {
  '/ims': { title: 'Dashboard', subtitle: 'Overview of your inventory' },
  '/ims/products': { title: 'Products', subtitle: 'Manage your product catalog' },
  '/ims/products/bundles': { title: 'Product Bundles', subtitle: 'Create and manage bundle products' },
  '/ims/production/orders': { title: 'Bundle Orders', subtitle: 'Manage production orders' },
  '/ims/production/history': { title: 'Production History', subtitle: 'View completed production records' },
  '/ims/sales/orders': { title: 'Sales Orders', subtitle: 'Manage customer orders and fulfillment' },
  '/ims/inventory': { title: 'Stock Levels', subtitle: 'View current inventory across all warehouses' },
  '/ims/inventory/movements': { title: 'Stock Movements', subtitle: 'Track stock receipts, issues, and adjustments' },
  '/ims/inventory/reports': { title: 'Inventory Reports', subtitle: 'Analytics and insights on stock performance' },
  '/ims/warehouses': { title: 'Warehouses', subtitle: 'Manage your warehouse locations' },
  '/ims/purchases/orders': { title: 'Purchase Orders', subtitle: 'Manage vendor purchase orders' },
  '/ims/parties': { title: 'Parties', subtitle: 'Manage suppliers & customers' },
  '/ims/reports/sales': { title: 'Sales Reports', subtitle: 'Analyze sales performance and revenue' },
  '/ims/reports/inventory': { title: 'Inventory Reports', subtitle: 'Analytics and insights on stock performance' },
  '/ims/reports/purchase-orders': { title: 'PO Reports', subtitle: 'Track purchase orders and status' },
  '/ims/reports/profit-loss': { title: 'Profit & Loss', subtitle: 'Analyze profitability and financial performance' },
  '/ims/reports/ads': { title: 'Ads Reports', subtitle: 'Track advertising performance and ROI' },
  '/settings': { title: 'Settings', subtitle: 'Configure your preferences' },
};

// AMS page titles
const amsPageTitles: Record<string, { title: string; subtitle?: string }> = {
  '/ams': { title: 'Dashboard', subtitle: 'Allocation overview and metrics' },
  '/ams/orders': { title: 'Purchase Orders', subtitle: 'View and validate POs from all channels' },
  '/ams/orders/upload': { title: 'Upload PO', subtitle: 'Import purchase orders from files' },
  '/ams/inventory': { title: 'Current Inventory', subtitle: 'Stock levels and availability' },
  '/ams/warehouses': { title: 'Warehouses', subtitle: 'Manage your warehouse locations' },
  '/ams/fulfillment-centers': { title: 'Fulfillment Centers', subtitle: 'Map channel FCs to warehouses' },
  '/ams/sku-mapping': { title: 'SKU Mapping', subtitle: 'Map external identifiers to internal SKUs' },
};

// Handle dynamic routes
const getPageInfo = (pathname: string, module: 'ims' | 'ams') => {
  const pageTitles = module === 'ims' ? imsPageTitles : amsPageTitles;
  
  // Check for exact match first
  if (pageTitles[pathname]) {
    return pageTitles[pathname];
  }
  
  // Check for pattern matches
  if (pathname.startsWith('/ims/sales/orders/')) {
    return { title: 'Order Details', subtitle: 'View and manage order' };
  }
  if (pathname.startsWith('/ams/orders/')) {
    return { title: 'PO Details', subtitle: 'View and validate purchase order' };
  }
  
  return { title: 'Page' };
};

export function Header({ module = 'ims' }: HeaderProps) {
  const location = useLocation();
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore();
  const { currentTheme } = useThemeStore();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const pageInfo = getPageInfo(location.pathname, module);

  return (
    <header
      className={`fixed right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-lg transition-all duration-300 ${
        sidebarCollapsed ? 'left-20' : 'left-64'
      }`}
    >
      <div className="flex flex-1 items-center justify-between px-6">
        {/* Left: Page title with breadcrumb */}
        <div className="flex items-center gap-4">
          {/* Mobile menu toggle */}
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="lg:hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold uppercase tracking-wider ${
                module === 'ims' ? 'text-blue-600' : 'text-orange-600'
              }`}>
                {module === 'ims' ? 'IMS' : 'AMS'}
              </span>
              <span className="text-slate-300">/</span>
              <h1 className="text-xl font-semibold text-slate-800">{pageInfo.title}</h1>
            </div>
            {pageInfo.subtitle && (
              <p className="text-sm text-slate-500">{pageInfo.subtitle}</p>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <button className="relative rounded-xl p-2.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
          </button>

          {/* Help */}
          <button className="rounded-xl p-2.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700">
            <HelpCircle className="h-5 w-5" />
          </button>

          {/* Divider */}
          <div className="mx-2 h-8 w-px bg-slate-200" />

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 rounded-xl p-1.5 transition-colors hover:bg-slate-100"
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${currentTheme.sidebar.logoAccent} text-sm font-semibold text-white`}>
                NY
              </div>
              <div className="hidden text-left lg:block">
                <p className="text-sm font-medium text-slate-700">Nourish You</p>
                <p className="text-xs text-slate-500">Vendor: NU8FU</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowUserMenu(false)} 
                />
                <div className="absolute right-0 top-full z-50 mt-2 w-56 animate-scale-in rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-medium text-slate-700">Nourish You</p>
                    <p className="text-xs text-slate-500">admin@nourishyou.com</p>
                  </div>
                  <div className="py-1">
                    <button className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <User className="h-4 w-4 text-slate-400" />
                      Your Profile
                    </button>
                    <button className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <Settings className="h-4 w-4 text-slate-400" />
                      Settings
                    </button>
                  </div>
                  <div className="border-t border-slate-100 py-1">
                    <button className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
