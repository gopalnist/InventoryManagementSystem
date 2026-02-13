import { useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Calculator } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { ReportUpload } from '../../components/reports/ReportUpload';

export function ProfitLossReports() {
  const { currentTheme } = useAppStore();
  const [dateRange, setDateRange] = useState('30d');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profit & Loss Reports</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Analyze profitability, costs, and financial performance
          </p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="1y">Last year</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">₹0</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Cost of Purchase</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">₹0</p>
            </div>
            <Calculator className="h-8 w-8 text-red-500" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Ad Spend</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">₹0</p>
            </div>
            <DollarSign className="h-8 w-8 text-orange-500" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Net Profit</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">₹0</p>
            </div>
            <TrendingDown className="h-8 w-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <ReportUpload reportType="profit_loss" />

      {/* Reports Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Profit & Loss Data Report
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          P&L reports will display: Date, Channel, SKUID, Units, COP (Cost of Purchase), Macro Ad Spend, P&L
        </p>
        <div className="mt-4 text-sm text-gray-400 dark:text-gray-500">
          Report implementation coming soon...
        </div>
      </div>
    </div>
  );
}

