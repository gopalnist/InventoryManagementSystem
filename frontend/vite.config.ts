import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Proxy targets: use env vars when running in Docker (e.g. VITE_PROXY_REPORTS_TARGET=http://report-service:8005)
const reportTarget = process.env.VITE_PROXY_REPORTS_TARGET || 'http://localhost:8005'
const masterTarget = process.env.VITE_PROXY_MASTER_TARGET || 'http://localhost:8001'
const inventoryTarget = process.env.VITE_PROXY_INVENTORY_TARGET || 'http://localhost:8004'
const amsTarget = process.env.VITE_PROXY_AMS_TARGET || 'http://localhost:8003'
const salesTarget = process.env.VITE_PROXY_SALES_TARGET || 'http://localhost:8002'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3001,
    host: true,
    proxy: {
      '/api/v1/warehouses': { target: inventoryTarget, changeOrigin: true },
      '/api/v1/inventory': { target: inventoryTarget, changeOrigin: true },
      '/api/v1/stock-movements': { target: inventoryTarget, changeOrigin: true },
      '/api/v1/inventory-reports': { target: inventoryTarget, changeOrigin: true },
      '/api/v1/ams': { target: amsTarget, changeOrigin: true },
      '/api/v1/purchase-orders': { target: amsTarget, changeOrigin: true },
      '/api/v1/sales-orders': { target: salesTarget, changeOrigin: true },
      '/api/v1/reports': { target: reportTarget, changeOrigin: true },
      '/api': { target: masterTarget, changeOrigin: true },
    }
  }
})
