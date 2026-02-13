import { NavLink, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Users,
  Building2,
  ShoppingCart,
  Truck,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Box,
  Palette,
  Warehouse,
  FileText,
  Layers,
  Factory,
  ClipboardList,
  History,
  Boxes,
  Home,
  DollarSign,
  Megaphone,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useThemeStore, themes } from '../../store/themeStore';
import { useState } from 'react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  children?: NavItem[];
}

interface NavGroup {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  children: NavItem[];
  defaultOpen?: boolean;
}

interface SidebarProps {
  module?: 'ims' | 'ams';
}

// =============================================================================
// IMS Navigation
// =============================================================================
const imsNavigation = {
  dashboard: { name: 'Dashboard', href: '/ims', icon: LayoutDashboard },
  groups: [
    // Temporarily commented out - showing only Reports
    // {
    //   section: 'Catalog',
    //   items: [
    //     {
    //       name: 'Products',
    //       icon: Package,
    //       defaultOpen: true,
    //       children: [
    //         { name: 'All Products', href: '/ims/products', icon: Box },
    //         { name: 'Product Bundles', href: '/ims/products/bundles', icon: Layers },
    //       ],
    //     },
    //     {
    //       name: 'Production',
    //       icon: Factory,
    //       defaultOpen: false,
    //       children: [
    //         { name: 'Bundle Orders', href: '/ims/production/orders', icon: ClipboardList },
    //         { name: 'History', href: '/ims/production/history', icon: History },
    //       ],
    //     },
    //   ],
    // },
    // {
    //   section: 'Sales',
    //   items: [
    //     {
    //       name: 'Sales',
    //       icon: ShoppingCart,
    //       defaultOpen: true,
    //       children: [
    //         { name: 'Sales Orders', href: '/ims/sales/orders', icon: ClipboardList },
    //       ],
    //     },
    //   ],
    // },
    // {
    //   section: 'Inventory',
    //   items: [
    //     {
    //       name: 'Stock',
    //       icon: Warehouse,
    //       defaultOpen: true,
    //       children: [
    //         { name: 'Stock Levels', href: '/ims/inventory', icon: Box },
    //         { name: 'Stock Movements', href: '/ims/inventory/movements', icon: History },
    //         { name: 'Warehouses', href: '/ims/warehouses', icon: Building2 },
    //         { name: 'Reports', href: '/ims/inventory/reports', icon: BarChart3 },
    //       ],
    //     },
    //   ],
    // },
    // {
    //   section: 'Contacts',
    //   single: { name: 'Parties', href: '/ims/parties', icon: Users },
    // },
    // {
    //   section: 'Purchases',
    //   items: [
    //     {
    //       name: 'Purchases',
    //       icon: Truck,
    //       defaultOpen: true,
    //       children: [
    //         { name: 'Purchase Orders', href: '/ims/purchases/orders', icon: ClipboardList },
    //       ],
    //     },
    //   ],
    // },
    {
      section: 'Reports',
      items: [
        {
          name: 'Reports',
          icon: BarChart3,
          defaultOpen: true,
          children: [
            { name: 'Sales Reports', href: '/ims/reports/sales', icon: ShoppingCart },
            { name: 'Inventory Reports', href: '/ims/reports/inventory', icon: Warehouse },
            { name: 'PO Reports', href: '/ims/reports/purchase-orders', icon: ClipboardList },
            { name: 'Profit & Loss', href: '/ims/reports/profit-loss', icon: DollarSign },
            { name: 'Ads Reports', href: '/ims/reports/ads', icon: Megaphone },
          ],
        },
      ],
    },
  ],
};

// =============================================================================
// AMS Navigation
// =============================================================================
const amsNavigation = {
  dashboard: { name: 'Dashboard', href: '/ams', icon: LayoutDashboard },
  groups: [
    {
      section: 'Orders',
      items: [
        {
          name: 'Purchase Orders',
          icon: ClipboardList,
          defaultOpen: true,
          children: [
            { name: 'All Orders', href: '/ams/orders', icon: FileText },
          ],
        },
      ],
    },
    {
      section: 'Inventory',
      items: [
        {
          name: 'Stock',
          icon: Warehouse,
          defaultOpen: true,
          children: [
            { name: 'Current Inventory', href: '/ams/inventory', icon: Box },
            { name: 'Warehouses', href: '/ams/warehouses', icon: Building2 },
            { name: 'SKUs', href: '/ams/skus', icon: Package },
          ],
        },
      ],
    },
  ],
};

export function Sidebar({ module = 'ims' }: SidebarProps) {
  const location = useLocation();
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore();
  const { currentTheme, setTheme } = useThemeStore();
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Products': true,
    'Production': false,
    'Sales': true,
    'Purchase Orders': true,
    'Stock': true,
    'Mappings': false,
    'Reports': true,
  });

  const navigation = module === 'ims' ? imsNavigation : amsNavigation;
  
  const theme = currentTheme.sidebar;
  const isLightTheme = currentTheme.id === 'minimal';

  // Module-specific accent colors
  const moduleAccent = module === 'ims' 
    ? 'from-blue-500 to-cyan-600' 
    : 'from-orange-500 to-amber-600';
  const moduleName = module === 'ims' ? 'Inventory' : 'Allocation';
  const moduleSubtitle = module === 'ims' ? 'Management System' : 'Management System';

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const isGroupActive = (group: NavGroup) => {
    return group.children.some((item) => location.pathname === item.href);
  };

  const renderNavItem = (item: NavItem, isChild = false, animationDelay = 0) => {
    const isActive = location.pathname === item.href;
    const isDisabled = item.href === '#';

    if (isDisabled) {
      return (
        <div
          key={item.name}
          className={`group flex cursor-not-allowed items-center gap-3 rounded-xl ${isChild && !sidebarCollapsed ? 'pl-10' : ''} px-3 py-2 text-sm font-medium ${theme.textMuted} opacity-50`}
        >
          <item.icon className="h-4 w-4 flex-shrink-0" />
          {!sidebarCollapsed && (
            <>
              <span>{item.name}</span>
              {item.badge && (
                <span className={`ml-auto rounded-full ${isLightTheme ? 'bg-slate-200 text-slate-600' : 'bg-white/10 text-white/60'} px-2 py-0.5 text-xs`}>
                  {item.badge}
                </span>
              )}
            </>
          )}
        </div>
      );
    }

    return (
      <NavLink
        key={item.name}
        to={item.href}
        className={`group flex items-center gap-3 rounded-xl ${isChild && !sidebarCollapsed ? 'pl-10' : ''} px-3 py-2 text-sm font-medium transition-all duration-200 animate-slide-in ${
          isActive
            ? `${theme.activeItem} text-white`
            : `${theme.text} ${theme.hoverBg}`
        }`}
        style={{ animationDelay: `${animationDelay}s` }}
      >
        <item.icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : theme.textMuted}`} />
        {!sidebarCollapsed && (
          <>
            <span>{item.name}</span>
            {item.badge && (
              <span className={`ml-auto rounded-full ${
                item.badge === 'New' 
                  ? 'bg-emerald-500 text-white' 
                  : isLightTheme ? 'bg-slate-200 text-slate-600' : 'bg-white/10 text-white/60'
              } px-2 py-0.5 text-xs`}>
                {item.badge}
              </span>
            )}
          </>
        )}
      </NavLink>
    );
  };

  const renderNavGroup = (group: NavGroup, isComing = false) => {
    const isExpanded = expandedGroups[group.name] ?? group.defaultOpen ?? false;
    const isActive = isGroupActive(group);

    return (
      <div key={group.name} className="mb-1">
        <button
          onClick={() => !sidebarCollapsed && toggleGroup(group.name)}
          className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
            isActive && !isExpanded
              ? `${theme.activeItem} text-white`
              : `${theme.text} ${theme.hoverBg}`
          }`}
        >
          <group.icon className={`h-5 w-5 flex-shrink-0 ${isActive ? (isExpanded ? theme.textMuted : 'text-white') : theme.textMuted}`} />
          {!sidebarCollapsed && (
            <>
              <span className="flex-1 text-left">{group.name}</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${theme.textMuted} ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            </>
          )}
        </button>
        
        {!sidebarCollapsed && isExpanded && (
          <div className={`mt-1 space-y-0.5 animate-fade-in ${isComing ? 'opacity-60' : ''}`}>
            {group.children.map((item, index) => renderNavItem(item, true, index * 0.03))}
          </div>
        )}

        {sidebarCollapsed && (
          <div className="space-y-0.5 mt-1">
            {group.children.slice(0, 2).map((item) => (
              item.href !== '#' ? (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={`flex items-center justify-center rounded-xl p-2 transition-all ${
                    location.pathname === item.href
                      ? `${theme.activeItem} text-white`
                      : `${theme.textMuted} ${theme.hoverBg}`
                  }`}
                  title={item.name}
                >
                  <item.icon className="h-4 w-4" />
                </NavLink>
              ) : null
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out ${
        sidebarCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className={`absolute inset-0 ${theme.bgGradient} ${theme.bg}`} />
      
      <div 
        className={`absolute inset-0 ${isLightTheme ? 'opacity-[0.02]' : 'opacity-5'}`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='${isLightTheme ? '%23000000' : '%23ffffff'}' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative flex h-full flex-col">
        {/* Logo section */}
        <div className={`flex h-16 items-center border-b ${theme.border} ${sidebarCollapsed ? 'justify-center px-2' : 'px-6'}`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${moduleAccent} shadow-lg`}>
              {module === 'ims' ? (
                <Warehouse className="h-6 w-6 text-white" />
              ) : (
                <Boxes className="h-6 w-6 text-white" />
              )}
            </div>
            {!sidebarCollapsed && (
              <div className="animate-fade-in">
                <h1 className={`text-lg font-bold ${theme.text}`}>{moduleName}</h1>
                <p className={`text-xs ${theme.textMuted}`}>{moduleSubtitle}</p>
              </div>
            )}
          </div>
        </div>

        {/* Back to Platform */}
        <div className={`border-b ${theme.border} ${sidebarCollapsed ? 'px-2' : 'px-3'} py-2`}>
          <Link
            to="/"
            className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${theme.text} ${theme.hoverBg} transition-all`}
          >
            <Home className={`h-4 w-4 flex-shrink-0 ${theme.textMuted}`} />
            {!sidebarCollapsed && <span>Back to Platform</span>}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {/* Dashboard */}
          <div className={`space-y-1 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
            {renderNavItem(navigation.dashboard)}
          </div>

          {/* Sections */}
          {navigation.groups.map((section: any) => (
            <div key={section.section} className={`mt-4 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
              <p className={`mb-2 text-xs font-semibold uppercase tracking-wider ${theme.textMuted} ${section.comingSoon ? 'opacity-60' : ''} ${sidebarCollapsed ? 'text-center' : 'px-3'}`}>
                {sidebarCollapsed ? '•' : section.section}
              </p>
              
              {section.items?.map((group: NavGroup) => renderNavGroup(group, section.comingSoon))}
              
              {section.single && renderNavItem(section.single)}
              
              {section.singles && (
                <div className="mt-2 space-y-0.5 opacity-50">
                  {section.singles.map((item: NavItem) => renderNavItem(item))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Theme Picker & Settings */}
        <div className={`border-t ${theme.border} p-4 ${sidebarCollapsed ? 'px-2' : ''}`}>
          <button
            onClick={() => setShowThemePicker(!showThemePicker)}
            className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${theme.text} ${theme.hoverBg} transition-all`}
          >
            <Palette className={`h-5 w-5 flex-shrink-0 ${theme.textMuted}`} />
            {!sidebarCollapsed && <span>Theme</span>}
            {!sidebarCollapsed && (
              <div className={`ml-auto h-4 w-4 rounded-full bg-gradient-to-br ${theme.logoAccent}`} />
            )}
          </button>

          {showThemePicker && !sidebarCollapsed && (
            <div className={`mt-2 rounded-xl ${isLightTheme ? 'bg-white border border-slate-200' : 'bg-black/30 backdrop-blur-sm'} p-3 animate-scale-in`}>
              <p className={`mb-2 text-xs font-semibold uppercase tracking-wider ${theme.textMuted}`}>
                Select Theme
              </p>
              <div className="grid grid-cols-3 gap-2">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTheme(t.id); setShowThemePicker(false); }}
                    className={`group relative flex h-10 w-full items-center justify-center rounded-lg bg-gradient-to-br ${t.sidebar.bg} transition-transform hover:scale-105 ${
                      currentTheme.id === t.id ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent' : ''
                    }`}
                    title={t.name}
                  >
                    <span className="text-sm">{t.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <NavLink
            to="/settings"
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${theme.text} ${theme.hoverBg} transition-all mt-2`}
          >
            <Settings className={`h-5 w-5 flex-shrink-0 ${theme.textMuted}`} />
            {!sidebarCollapsed && <span>Settings</span>}
          </NavLink>
          
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl ${isLightTheme ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-white/10 hover:bg-white/20 text-white/80'} px-3 py-2 text-sm font-medium transition-all`}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
