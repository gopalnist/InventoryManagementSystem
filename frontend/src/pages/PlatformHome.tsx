import { Link, useNavigate } from 'react-router-dom';
import {
  Package,
  Boxes,
  Warehouse,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Zap,
  Shield,
  Globe,
  RefreshCw,
  FileSpreadsheet,
  Link2,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface ModuleCardProps {
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  features: string[];
  href: string;
  gradient: string;
  iconBg: string;
  buttonColor: string;
  available: boolean;
}

function ModuleCard({
  title,
  subtitle,
  description,
  icon: Icon,
  features,
  href,
  gradient,
  iconBg,
  buttonColor,
  available,
}: ModuleCardProps) {
  return (
    <div
      className={`group relative overflow-hidden rounded-3xl bg-white shadow-xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 ${
        !available ? 'opacity-75' : ''
      }`}
    >
      {/* Gradient header */}
      <div className={`h-3 w-full bg-gradient-to-r ${gradient}`} />

      {/* Content */}
      <div className="p-8">
        {/* Icon */}
        <div
          className={`mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${iconBg} shadow-lg transition-transform duration-300 group-hover:scale-110`}
        >
          <Icon className="h-8 w-8 text-white" />
        </div>

        {/* Title */}
        <div className="mb-4">
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            {subtitle}
          </p>
          <h3 className="mt-1 text-2xl font-bold text-slate-900">{title}</h3>
        </div>

        {/* Description */}
        <p className="mb-6 text-slate-600 leading-relaxed">{description}</p>

        {/* Features */}
        <ul className="mb-8 space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500" />
              <span className="text-sm text-slate-700">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA Button */}
        {available ? (
          <Link
            to={href}
            className={`group/btn inline-flex items-center gap-2 rounded-xl ${buttonColor} px-6 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:gap-4`}
          >
            Launch Module
            <ArrowRight className="h-5 w-5 transition-transform group-hover/btn:translate-x-1" />
          </Link>
        ) : (
          <button
            disabled
            className="inline-flex items-center gap-2 rounded-xl bg-slate-200 px-6 py-3 font-semibold text-slate-500 cursor-not-allowed"
          >
            Coming Soon
          </button>
        )}
      </div>

      {/* Decorative elements */}
      <div
        className={`absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-2xl transition-opacity group-hover:opacity-20`}
      />
    </div>
  );
}

function FeatureHighlight({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h4 className="font-semibold text-slate-900">{title}</h4>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
    </div>
  );
}

export function PlatformHome() {
  const navigate = useNavigate();
  const { tenantName, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const modules: ModuleCardProps[] = [
    {
      title: 'Inventory Management',
      subtitle: 'IMS Module',
      description:
        'Complete inventory tracking solution for managing products, stock levels, warehouses, and production workflows.',
      icon: Warehouse,
      features: [
        'Products, SKUs & Categories management',
        'Multi-warehouse stock tracking',
        'Production & BOM management',
        'Stock transactions & adjustments',
        'Real-time inventory levels',
      ],
      href: '/ims',
      gradient: 'from-blue-500 to-cyan-500',
      iconBg: 'from-blue-500 to-cyan-600',
      buttonColor: 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600',
      available: true,
    },
    {
      title: 'Allocation Management',
      subtitle: 'AMS Module',
      description:
        'Smart order allocation system for validating POs, checking stock availability, and managing reservations across channels.',
      icon: Boxes,
      features: [
        'Multi-channel PO import (Amazon, Zepto, etc.)',
        'SKU mapping (EAN/ASIN → Internal)',
        'Stock availability validation',
        'Inventory reservation & release',
        'Fulfillment center mapping',
      ],
      href: '/ams',
      gradient: 'from-orange-500 to-amber-500',
      iconBg: 'from-orange-500 to-amber-600',
      buttonColor: 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600',
      available: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -right-40 -top-20 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="absolute -bottom-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" />
        </div>

        {/* Header */}
        <header className="border-b border-slate-200/60 bg-white/60 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">IMS</h1>
                <p className="text-xs text-slate-500">Inventory Management System</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">
                Logged in as <strong>{tenantName ?? 'Customer'}</strong>
              </span>
              <Link
                to="/settings"
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </header>

        {/* Hero content */}
        <div className="mx-auto max-w-7xl px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700 mb-6">
            <Zap className="h-4 w-4" />
            Modular Business Platform
          </div>
          <h2 className="text-4xl font-bold text-slate-900 sm:text-5xl lg:text-6xl">
            Choose Your{' '}
            <span className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
              Module
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Use Inventory Management for stock tracking, or Allocation Management for order
            validation. Use both together, or integrate with your existing systems.
          </p>
        </div>
      </div>

      {/* Module Cards */}
      <div className="mx-auto max-w-7xl px-6 pb-16">
        <div className="grid gap-8 md:grid-cols-2">
          {modules.map((module) => (
            <ModuleCard key={module.title} {...module} />
          ))}
        </div>
      </div>

      {/* Integration Section */}
      <div className="border-t border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-slate-900">Flexible Integration</h3>
            <p className="mt-2 text-slate-600">
              Use modules independently or together. Integrate with external systems.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <FeatureHighlight
              icon={Link2}
              title="Use Both Together"
              description="AMS automatically calls IMS for inventory checks when both modules are active."
            />
            <FeatureHighlight
              icon={Globe}
              title="External Inventory"
              description="AMS can connect to Zoho, SAP, or any third-party inventory system via API."
            />
            <FeatureHighlight
              icon={FileSpreadsheet}
              title="Multi-Channel Support"
              description="Import POs from Amazon, Zepto, Instamart, BigBasket, and more."
            />
          </div>
        </div>
      </div>

      {/* Architecture Preview */}
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 p-8 text-white shadow-2xl">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold">How It Works</h3>
            <p className="mt-2 text-slate-400">Modular architecture for maximum flexibility</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* External Systems */}
            <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6">
              <div className="mb-4 text-center">
                <Globe className="mx-auto h-8 w-8 text-purple-400" />
                <h4 className="mt-2 font-semibold">E-Commerce Platforms</h4>
              </div>
              <div className="space-y-2">
                {['Amazon', 'Zepto', 'Instamart', 'BigBasket', 'Blinkit'].map((platform) => (
                  <div
                    key={platform}
                    className="rounded-lg bg-slate-700/50 px-3 py-2 text-center text-sm"
                  >
                    {platform}
                  </div>
                ))}
              </div>
            </div>

            {/* AMS */}
            <div className="rounded-2xl border-2 border-orange-500/50 bg-gradient-to-b from-orange-500/10 to-transparent p-6">
              <div className="mb-4 text-center">
                <Boxes className="mx-auto h-8 w-8 text-orange-400" />
                <h4 className="mt-2 font-semibold">AMS</h4>
                <p className="text-xs text-slate-400">Allocation Management</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="rounded-lg bg-orange-500/20 px-3 py-2">PO Import & Parse</div>
                <div className="rounded-lg bg-orange-500/20 px-3 py-2">SKU Resolution</div>
                <div className="rounded-lg bg-orange-500/20 px-3 py-2">Stock Validation</div>
                <div className="rounded-lg bg-orange-500/20 px-3 py-2">Reserve/Release</div>
              </div>
            </div>

            {/* IMS */}
            <div className="rounded-2xl border-2 border-blue-500/50 bg-gradient-to-b from-blue-500/10 to-transparent p-6">
              <div className="mb-4 text-center">
                <Warehouse className="mx-auto h-8 w-8 text-blue-400" />
                <h4 className="mt-2 font-semibold">IMS</h4>
                <p className="text-xs text-slate-400">Inventory Management</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="rounded-lg bg-blue-500/20 px-3 py-2">Products & SKUs</div>
                <div className="rounded-lg bg-blue-500/20 px-3 py-2">Stock Levels</div>
                <div className="rounded-lg bg-blue-500/20 px-3 py-2">Warehouses</div>
                <div className="rounded-lg bg-blue-500/20 px-3 py-2">Production</div>
              </div>
              <div className="mt-4 rounded-lg border border-dashed border-slate-600 p-3 text-center text-xs text-slate-400">
                OR connect to Zoho, SAP, etc.
              </div>
            </div>
          </div>

          {/* Connection arrows */}
          <div className="mt-6 flex items-center justify-center gap-4 text-slate-400">
            <RefreshCw className="h-5 w-5" />
            <span className="text-sm">Real-time sync between modules</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                <Package className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm text-slate-500">IMS © 2026</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-slate-500">Enterprise Ready</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}


