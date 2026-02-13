import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3001,
    proxy: {
      // =================================================================
      // INVENTORY SERVICE - Port 8004 (IMS Inventory Management)
      // =================================================================
      '/api/v1/warehouses': {
        target: 'http://localhost:8004',
        changeOrigin: true,
      },
      '/api/v1/inventory': {
        target: 'http://localhost:8004',
        changeOrigin: true,
      },
      '/api/v1/stock-movements': {
        target: 'http://localhost:8004',
        changeOrigin: true,
      },
      '/api/v1/inventory-reports': {
        target: 'http://localhost:8004',
        changeOrigin: true,
      },
      
      // =================================================================
      // AMS SERVICE - Port 8003 (Allocation Management System)
      // =================================================================
      '/api/v1/ams': {
        target: 'http://localhost:8003',
        changeOrigin: true,
      },
      '/api/v1/purchase-orders': {
        target: 'http://localhost:8003',
        changeOrigin: true,
      },
      
      // =================================================================
      // SALES SERVICE - Port 8002
      // =================================================================
      '/api/v1/sales-orders': {
        target: 'http://localhost:8002',
        changeOrigin: true,
      },
      
          // =================================================================
          // REPORT SERVICE - Port 8005 (Multi-channel Reports)
          // =================================================================
          '/api/v1/reports': {
            target: 'http://localhost:8005',
            changeOrigin: true,
          },
          
          // =================================================================
          // MASTER SERVICE - Port 8001 (all other API routes)
          // =================================================================
          '/api': {
            target: 'http://localhost:8001',
            changeOrigin: true,
          }
    }
  }
})
