import { useState } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { reportsApi } from '../../services/api';
import type { ReportUploadResponse } from '../../services/api';
import { useAppStore } from '../../store/appStore';

interface ReportUploadProps {
  reportType: 'sales' | 'inventory' | 'po' | 'profit_loss' | 'ads';
  onUploadComplete?: (response: ReportUploadResponse) => void;
}

const CHANNELS = [
  { value: 'zepto', label: 'Zepto' },
  { value: 'flipkart', label: 'Flipkart' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'blinkit', label: 'Blinkit' },
  { value: 'bigbasket', label: 'BigBasket' },
  { value: 'swiggy', label: 'Swiggy' },
];

const ADS_SOURCES = [
  { value: 'google_ads', label: 'Google Ads (Product Level)' },
  { value: 'google_pla', label: 'Google PLA (Campaign Level)' },
  { value: 'facebook_ads', label: 'Facebook Ads' },
  { value: 'amazon_ads', label: 'Amazon Advertising' },
];

export function ReportUpload({ reportType, onUploadComplete }: ReportUploadProps) {
  const { currentTheme } = useAppStore();
  const [file, setFile] = useState<File | null>(null);
  const [channel, setChannel] = useState<string>(reportType === 'ads' ? 'google_ads' : 'zepto');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ReportUploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  // Determine which options to show based on report type
  const sourceOptions = reportType === 'ads' ? ADS_SOURCES : CHANNELS;
  const sourceLabel = reportType === 'ads' ? 'Ad Source' : 'Channel';

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError('Please select a valid Excel or CSV file');
      return;
    }
    setFile(selectedFile);
    setError(null);
    setUploadResult(null);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadResult(null);

    try {
      // Get tenant ID from store or use default
      const tenantId = '00000000-0000-0000-0000-000000000001'; // Default tenant
      
      const response = await reportsApi.upload(file, channel, reportType, tenantId);
      setUploadResult(response);
      
      if (onUploadComplete) {
        onUploadComplete(response);
      }
      
      // Reset file after successful upload
      setFile(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Upload {reportType.charAt(0).toUpperCase() + reportType.slice(1).replace('_', ' & ')} Report
      </h3>

      {/* Channel/Ad Source Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {sourceLabel}
        </label>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {sourceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* File Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {!file ? (
          <div>
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Drag and drop your file here, or
            </p>
            <label className="cursor-pointer">
              <span className="text-blue-600 dark:text-blue-400 hover:underline">
                browse to upload
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              Supports .xlsx, .xls, and .csv files
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatFileSize(file.size)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Upload Result */}
      {uploadResult && (
        <div
          className={`mt-4 p-3 rounded-lg flex items-center space-x-2 ${
            uploadResult.status === 'completed'
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : uploadResult.status === 'partial'
              ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}
        >
          {uploadResult.status === 'completed' ? (
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
          )}
          <div className="flex-1">
            <p
              className={`text-sm font-medium ${
                uploadResult.status === 'completed'
                  ? 'text-green-700 dark:text-green-400'
                  : 'text-yellow-700 dark:text-yellow-400'
              }`}
            >
              {uploadResult.message}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Processed: {uploadResult.processed_rows} / {uploadResult.total_rows}
              {uploadResult.failed_rows > 0 && ` (${uploadResult.failed_rows} failed)`}
            </p>
          </div>
        </div>
      )}

      {/* Upload Button */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              <span>Upload Report</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

