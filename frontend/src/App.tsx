import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/layout/Layout';
import { PlatformHome } from './pages/PlatformHome';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { ProductBundles } from './pages/ProductBundles';
import { ProductionOrders } from './pages/ProductionOrders';
import { ProductionHistory } from './pages/ProductionHistory';
import { Parties } from './pages/Parties';
import { SalesOrders } from './pages/SalesOrders';
import { SalesOrderDetail } from './pages/SalesOrderDetail';

// IMS Inventory pages
import { Inventory as IMSInventory } from './pages/Inventory';
import { Warehouses as IMSWarehouses } from './pages/Warehouses';
import { StockMovements } from './pages/StockMovements';
import { InventoryReports } from './pages/InventoryReports';
import { PurchaseOrders as IMSPurchaseOrders } from './pages/PurchaseOrders';

// IMS Reports pages
import { SalesReports } from './pages/reports/SalesReports';
import { InventoryReports as ReportsInventoryReports } from './pages/reports/InventoryReports';
import { POReports } from './pages/reports/POReports';
import { ProfitLossReports } from './pages/reports/ProfitLossReports';
import { AdsReports } from './pages/reports/AdsReports';

// AMS Module imports
import { AMSLayout } from './components/layout/AMSLayout';
import {
  AMSDashboard,
  PurchaseOrders as AMSPurchaseOrders,
  PurchaseOrderDetail,
  Inventory as AMSInventory,
  Warehouses as AMSWarehouses,
  SKUs,
} from './pages/ams';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Platform Home (Module Selector) */}
          <Route path="/" element={<PlatformHome />} />

          {/* IMS Module - Inventory Management System */}
          <Route path="/ims" element={<Layout module="ims" />}>
            <Route index element={<Dashboard />} />
            {/* Products */}
            <Route path="products" element={<Products />} />
            <Route path="products/bundles" element={<ProductBundles />} />
            {/* Production */}
            <Route path="production/orders" element={<ProductionOrders />} />
            <Route path="production/history" element={<ProductionHistory />} />
            {/* Sales */}
            <Route path="sales/orders" element={<SalesOrders />} />
            <Route path="sales/orders/:id" element={<SalesOrderDetail />} />
            {/* Inventory */}
            <Route path="inventory" element={<IMSInventory />} />
            <Route path="inventory/movements" element={<StockMovements />} />
            <Route path="inventory/reports" element={<InventoryReports />} />
            <Route path="warehouses" element={<IMSWarehouses />} />
            {/* Purchases */}
            <Route path="purchases/orders" element={<IMSPurchaseOrders />} />
            {/* Contacts */}
            <Route path="parties" element={<Parties />} />
            {/* Reports */}
            <Route path="reports/sales" element={<SalesReports />} />
            <Route path="reports/inventory" element={<ReportsInventoryReports />} />
            <Route path="reports/purchase-orders" element={<POReports />} />
            <Route path="reports/profit-loss" element={<ProfitLossReports />} />
            <Route path="reports/ads" element={<AdsReports />} />
          </Route>

          {/* AMS Module - Allocation Management System */}
          <Route path="/ams" element={<AMSLayout />}>
            <Route index element={<AMSDashboard />} />
            {/* Purchase Orders */}
            <Route path="orders" element={<AMSPurchaseOrders />} />
            <Route path="orders/:id" element={<PurchaseOrderDetail />} />
            {/* Inventory */}
            <Route path="inventory" element={<AMSInventory />} />
            <Route path="warehouses" element={<AMSWarehouses />} />
            {/* SKUs */}
            <Route path="skus" element={<SKUs />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
