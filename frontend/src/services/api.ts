import axios from 'axios';
import type {
  Category,
  CategoryCreate,
  CategoryUpdate,
  CategoryListResponse,
  Unit,
  UnitCreate,
  UnitUpdate,
  UnitListResponse,
  Brand,
  BrandCreate,
  BrandUpdate,
  BrandListResponse,
  Manufacturer,
  ManufacturerCreate,
  ManufacturerUpdate,
  ManufacturerListResponse,
  Product,
  ProductCreate,
  ProductUpdate,
  ProductListResponse,
  ProductBundle,
  ProductBundleCreate,
  ProductBundleUpdate,
  ProductBundleListResponse,
  ProductBundleSummary,
  BundleComponent,
  BundleComponentCreate,
  BundleComponentUpdate,
  BundleCostBreakdown,
  ProductionOrder,
  ProductionOrderCreate,
  ProductionOrderUpdate,
  ProductionOrderListResponse,
  ProductionOrderSummary,
  ProductionHistoryEntry,
  ProductionStatus,
  Item,
  ItemCreate,
  ItemUpdate,
  ItemListResponse,
  Party,
  PartyCreate,
  PartyUpdate,
  PartyListResponse,
  OutboxEvent,
  OutboxEventListResponse,
  EventSummaryResponse,
  EventStatistics,
  EntityTimeline,
  EventStatus,
  EventOperation,
  // Sales Order types
  SalesOrder,
  SalesOrderCreate,
  SalesOrderUpdate,
  SalesOrderListResponse,
  SalesOrderStats,
  SalesOrderItem,
  SalesOrderItemCreate,
  SalesOrderStatusHistory,
  FulfillmentCenter,
  FulfillmentCenterCreate,
  FulfillmentCenterListResponse,
  SalesOrderStatus,
  Platform,
} from '../types';

// Create axios instance
const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Demo tenant ID - In production, this would come from auth
const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// Add tenant header to all requests
api.interceptors.request.use((config) => {
  config.headers['X-Tenant-ID'] = DEMO_TENANT_ID;
  return config;
});

// =============================================================================
// CATEGORIES API
// =============================================================================

export const categoriesApi = {
  list: async (parentId?: string, includeInactive = false) => {
    const params = new URLSearchParams();
    if (parentId) params.append('parent_id', parentId);
    if (includeInactive) params.append('include_inactive', 'true');
    const response = await api.get<CategoryListResponse>(`/categories?${params}`);
    return response.data;
  },

  getTree: async (includeInactive = false) => {
    const params = includeInactive ? '?include_inactive=true' : '';
    const response = await api.get<CategoryListResponse>(`/categories/tree${params}`);
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get<Category>(`/categories/${id}`);
    return response.data;
  },

  create: async (data: CategoryCreate) => {
    const response = await api.post<Category>('/categories', data);
    return response.data;
  },

  update: async (id: string, data: CategoryUpdate) => {
    const response = await api.put<Category>(`/categories/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/categories/${id}`);
  },
};

// =============================================================================
// UNITS API
// =============================================================================

export const unitsApi = {
  list: async (unitType?: string, includeInactive = false) => {
    const params = new URLSearchParams();
    if (unitType) params.append('unit_type', unitType);
    if (includeInactive) params.append('include_inactive', 'true');
    const response = await api.get<UnitListResponse>(`/units?${params}`);
    return response.data;
  },

  getPredefined: async () => {
    const response = await api.get<{ units: Array<{ name: string; symbol: string; unit_type: string }> }>(
      '/units/predefined'
    );
    return response.data;
  },

  setupDefaults: async () => {
    const response = await api.post<{ created: number; skipped: number }>(
      '/units/setup-defaults'
    );
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get<Unit>(`/units/${id}`);
    return response.data;
  },

  create: async (data: UnitCreate) => {
    const response = await api.post<Unit>('/units', data);
    return response.data;
  },

  update: async (id: string, data: UnitUpdate) => {
    const response = await api.put<Unit>(`/units/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/units/${id}`);
  },
};

// =============================================================================
// BRANDS API
// =============================================================================

export const brandsApi = {
  list: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    is_active?: boolean;
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.search) searchParams.append('search', params.search);
    if (params.is_active !== undefined) searchParams.append('is_active', params.is_active.toString());
    
    const response = await api.get<BrandListResponse>(`/products/brands/?${searchParams}`);
    return response.data;
  },

  create: async (data: BrandCreate) => {
    const response = await api.post<Brand>('/products/brands/', data);
    return response.data;
  },

  update: async (id: string, data: BrandUpdate) => {
    const response = await api.put<Brand>(`/products/brands/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/products/brands/${id}`);
  },
};

// =============================================================================
// MANUFACTURERS API
// =============================================================================

export const manufacturersApi = {
  list: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    is_active?: boolean;
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.search) searchParams.append('search', params.search);
    if (params.is_active !== undefined) searchParams.append('is_active', params.is_active.toString());
    
    const response = await api.get<ManufacturerListResponse>(`/products/manufacturers/?${searchParams}`);
    return response.data;
  },

  create: async (data: ManufacturerCreate) => {
    const response = await api.post<Manufacturer>('/products/manufacturers/', data);
    return response.data;
  },

  update: async (id: string, data: ManufacturerUpdate) => {
    const response = await api.put<Manufacturer>(`/products/manufacturers/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/products/manufacturers/${id}`);
  },
};

// =============================================================================
// PRODUCTS API (NEW)
// =============================================================================

export const productsApi = {
  list: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    category_id?: string;
    brand_id?: string;
    product_type?: string;
    is_active?: boolean;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.search) searchParams.append('search', params.search);
    if (params.category_id) searchParams.append('category_id', params.category_id);
    if (params.brand_id) searchParams.append('brand_id', params.brand_id);
    if (params.product_type) searchParams.append('product_type', params.product_type);
    if (params.is_active !== undefined) searchParams.append('is_active', params.is_active.toString());
    if (params.sort_by) searchParams.append('sort_by', params.sort_by);
    if (params.sort_order) searchParams.append('sort_order', params.sort_order);
    
    const response = await api.get<ProductListResponse>(`/products?${searchParams}`);
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get<Product>(`/products/${id}`);
    return response.data;
  },

  create: async (data: ProductCreate) => {
    const response = await api.post<Product>('/products', data);
    return response.data;
  },

  update: async (id: string, data: ProductUpdate) => {
    const response = await api.put<Product>(`/products/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/products/${id}`);
  },

  import: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<{
      success_count: number;
      error_count: number;
      errors: Array<{ row: number; error: string }>;
    }>('/products/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

// =============================================================================
// PRODUCT BUNDLES API
// =============================================================================

export const bundlesApi = {
  list: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    category_id?: string;
    is_active?: boolean;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.search) searchParams.append('search', params.search);
    if (params.category_id) searchParams.append('category_id', params.category_id);
    if (params.is_active !== undefined) searchParams.append('is_active', params.is_active.toString());
    if (params.sort_by) searchParams.append('sort_by', params.sort_by);
    if (params.sort_order) searchParams.append('sort_order', params.sort_order);
    
    const response = await api.get<ProductBundleListResponse>(`/bundles?${searchParams}`);
    return response.data;
  },

  getSummary: async () => {
    const response = await api.get<ProductBundleSummary>('/bundles/summary');
    return response.data;
  },

  get: async (id: string, includeComponents = true) => {
    const params = includeComponents ? '?include_components=true' : '';
    const response = await api.get<ProductBundle>(`/bundles/${id}${params}`);
    return response.data;
  },

  create: async (data: ProductBundleCreate) => {
    const response = await api.post<ProductBundle>('/bundles', data);
    return response.data;
  },

  update: async (id: string, data: ProductBundleUpdate) => {
    const response = await api.put<ProductBundle>(`/bundles/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/bundles/${id}`);
  },

  getCostBreakdown: async (id: string) => {
    const response = await api.get<BundleCostBreakdown>(`/bundles/${id}/cost-breakdown`);
    return response.data;
  },

  // Component operations
  listComponents: async (bundleId: string) => {
    const response = await api.get<BundleComponent[]>(`/bundles/${bundleId}/components`);
    return response.data;
  },

  addComponent: async (bundleId: string, data: BundleComponentCreate) => {
    const response = await api.post<BundleComponent>(`/bundles/${bundleId}/components`, data);
    return response.data;
  },

  updateComponent: async (bundleId: string, componentId: string, data: BundleComponentUpdate) => {
    const response = await api.put<BundleComponent>(`/bundles/${bundleId}/components/${componentId}`, data);
    return response.data;
  },

  removeComponent: async (bundleId: string, componentId: string) => {
    await api.delete(`/bundles/${bundleId}/components/${componentId}`);
  },

  // Available to build calculation
  getAvailableToBuild: async (bundleId: string, warehouseId?: string) => {
    const params = warehouseId ? `?warehouse_id=${warehouseId}` : '';
    const response = await api.get<{
      bundle_id: string;
      bundle_name: string;
      bundle_sku: string;
      available_to_build: number;
      limiting_factor: string | null;
      components: Array<{
        component_id: string;
        product_id: string;
        product_name: string;
        product_sku: string;
        required_per_bundle: number;
        available_qty: number;
        can_build: number;
        is_limiting: boolean;
      }>;
      message: string;
    }>(`/bundles/${bundleId}/available-to-build${params}`);
    return response.data;
  },

  getBuildableSummary: async (warehouseId?: string, limit = 50) => {
    const params = new URLSearchParams();
    if (warehouseId) params.append('warehouse_id', warehouseId);
    params.append('limit', limit.toString());
    
    const response = await api.get<{
      bundles: Array<{
        bundle_id: string;
        bundle_name: string;
        bundle_sku: string;
        selling_price: number;
        available_to_build: number;
        status: 'ready' | 'insufficient_stock';
      }>;
      total: number;
      ready_to_build: number;
      insufficient_stock: number;
      warehouse_id: string;
    }>(`/bundles/buildable-summary?${params}`);
    return response.data;
  },
};

// =============================================================================
// PURCHASE ORDERS API (Vendor Purchases)
// =============================================================================

export interface PurchaseOrder {
  id: string;
  tenant_id: string;
  order_number: string;
  vendor_id?: string;
  vendor_name?: string;
  warehouse_id?: string;
  warehouse_name?: string;
  order_date: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  status: string;
  payment_terms?: string;
  payment_status: string;
  subtotal: number;
  tax_amount: number;
  shipping_charges: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  items?: PurchaseOrderItem[];
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id?: string;
  product_sku?: string;
  product_name: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  discount_percent: number;
  discount_amount: number;
  line_total: number;
  status: string;
}

export interface POStats {
  total_orders: number;
  pending_orders: number;
  orders_this_month: number;
  total_value_pending: number;
}

export const purchaseOrdersApi = {
  list: async (params: {
    page?: number;
    limit?: number;
    status?: string;
    vendor_id?: string;
    warehouse_id?: string;
    from_date?: string;
    to_date?: string;
    search?: string;
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.status) searchParams.append('status', params.status);
    if (params.vendor_id) searchParams.append('vendor_id', params.vendor_id);
    if (params.warehouse_id) searchParams.append('warehouse_id', params.warehouse_id);
    if (params.from_date) searchParams.append('from_date', params.from_date);
    if (params.to_date) searchParams.append('to_date', params.to_date);
    if (params.search) searchParams.append('search', params.search);
    
    const response = await api.get<{ purchase_orders: PurchaseOrder[]; total: number; page: number; limit: number }>(
      `/purchase-orders?${searchParams}`
    );
    return response.data;
  },

  getStats: async () => {
    const response = await api.get<POStats>('/purchase-orders/stats');
    return response.data;
  },

  get: async (id: string, includeItems = true) => {
    const params = includeItems ? '?include_items=true' : '';
    const response = await api.get<PurchaseOrder>(`/purchase-orders/${id}${params}`);
    return response.data;
  },

  create: async (data: {
    vendor_id?: string;
    vendor_name?: string;
    warehouse_id?: string;
    order_date?: string;
    expected_delivery_date?: string;
    payment_terms?: string;
    shipping_charges?: number;
    discount_amount?: number;
    notes?: string;
    items?: Array<{
      product_id?: string;
      product_sku?: string;
      product_name: string;
      quantity_ordered: number;
      unit_price: number;
      tax_rate?: number;
      discount_percent?: number;
    }>;
  }) => {
    const response = await api.post<PurchaseOrder>('/purchase-orders', data);
    return response.data;
  },

  update: async (id: string, data: Partial<PurchaseOrder>) => {
    const response = await api.put<PurchaseOrder>(`/purchase-orders/${id}`, data);
    return response.data;
  },

  // Status transitions
  submit: async (id: string) => {
    const response = await api.post<PurchaseOrder>(`/purchase-orders/${id}/submit`);
    return response.data;
  },

  approve: async (id: string) => {
    const response = await api.post<PurchaseOrder>(`/purchase-orders/${id}/approve`);
    return response.data;
  },

  placeOrder: async (id: string) => {
    const response = await api.post<PurchaseOrder>(`/purchase-orders/${id}/place-order`);
    return response.data;
  },

  cancel: async (id: string) => {
    const response = await api.post<PurchaseOrder>(`/purchase-orders/${id}/cancel`);
    return response.data;
  },

  close: async (id: string) => {
    const response = await api.post<PurchaseOrder>(`/purchase-orders/${id}/close`);
    return response.data;
  },
};

// =============================================================================
// PRODUCTION ORDERS API
// =============================================================================

export const productionApi = {
  list: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    bundle_id?: string;
    status?: ProductionStatus;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.search) searchParams.append('search', params.search);
    if (params.bundle_id) searchParams.append('bundle_id', params.bundle_id);
    if (params.status) searchParams.append('status', params.status);
    if (params.sort_by) searchParams.append('sort_by', params.sort_by);
    if (params.sort_order) searchParams.append('sort_order', params.sort_order);
    
    const response = await api.get<ProductionOrderListResponse>(`/production?${searchParams}`);
    return response.data;
  },

  getSummary: async () => {
    const response = await api.get<ProductionOrderSummary>('/production/summary');
    return response.data;
  },

  get: async (id: string, includeComponents = true) => {
    const params = includeComponents ? '?include_components=true' : '';
    const response = await api.get<ProductionOrder>(`/production/${id}${params}`);
    return response.data;
  },

  create: async (data: ProductionOrderCreate) => {
    const response = await api.post<ProductionOrder>('/production', data);
    return response.data;
  },

  update: async (id: string, data: ProductionOrderUpdate) => {
    const response = await api.put<ProductionOrder>(`/production/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/production/${id}`);
  },

  // Status actions
  start: async (id: string, notes?: string) => {
    const response = await api.post<ProductionOrder>(`/production/${id}/start`, { notes });
    return response.data;
  },

  complete: async (id: string, quantityProduced: number, notes?: string) => {
    const response = await api.post<ProductionOrder>(`/production/${id}/complete`, {
      quantity_produced: quantityProduced,
      notes,
    });
    return response.data;
  },

  cancel: async (id: string, reason: string) => {
    const response = await api.post<ProductionOrder>(`/production/${id}/cancel`, { reason });
    return response.data;
  },

  getHistory: async (id: string) => {
    const response = await api.get<{
      order_id: string;
      order_number: string;
      history: ProductionHistoryEntry[];
    }>(`/production/${id}/history`);
    return response.data;
  },
};

// =============================================================================
// LEGACY ITEMS API (for backward compatibility)
// =============================================================================

export const itemsApi = {
  list: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    category_id?: string;
    is_active?: boolean;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.search) searchParams.append('search', params.search);
    if (params.category_id) searchParams.append('category_id', params.category_id);
    if (params.is_active !== undefined) searchParams.append('is_active', params.is_active.toString());
    if (params.sort_by) searchParams.append('sort_by', params.sort_by);
    if (params.sort_order) searchParams.append('sort_order', params.sort_order);
    
    const response = await api.get<ItemListResponse>(`/items?${searchParams}`);
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get<Item>(`/items/${id}`);
    return response.data;
  },

  create: async (data: ItemCreate) => {
    const response = await api.post<Item>('/items', data);
    return response.data;
  },

  update: async (id: string, data: ItemUpdate) => {
    const response = await api.put<Item>(`/items/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/items/${id}`);
  },

  import: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<{
      success_count: number;
      error_count: number;
      errors: Array<{ row: number; error: string }>;
    }>('/items/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

// =============================================================================
// PARTIES API
// =============================================================================

export const partiesApi = {
  list: async (params: {
    page?: number;
    limit?: number;
    party_type?: string;
    search?: string;
    is_active?: boolean;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.party_type) searchParams.append('party_type', params.party_type);
    if (params.search) searchParams.append('search', params.search);
    if (params.is_active !== undefined) searchParams.append('is_active', params.is_active.toString());
    if (params.sort_by) searchParams.append('sort_by', params.sort_by);
    if (params.sort_order) searchParams.append('sort_order', params.sort_order);
    
    const response = await api.get<PartyListResponse>(`/parties?${searchParams}`);
    return response.data;
  },

  getSuppliers: async (page = 1, limit = 20, search?: string) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (search) params.append('search', search);
    const response = await api.get<PartyListResponse>(`/parties/suppliers?${params}`);
    return response.data;
  },

  getCustomers: async (page = 1, limit = 20, search?: string) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (search) params.append('search', search);
    const response = await api.get<PartyListResponse>(`/parties/customers?${params}`);
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get<Party>(`/parties/${id}`);
    return response.data;
  },

  create: async (data: PartyCreate) => {
    const response = await api.post<Party>('/parties', data);
    return response.data;
  },

  update: async (id: string, data: PartyUpdate) => {
    const response = await api.put<Party>(`/parties/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/parties/${id}`);
  },
};

// =============================================================================
// OUTBOX API (Event Sourcing for AI/Analytics)
// =============================================================================

export const outboxApi = {
  list: async (params: {
    page?: number;
    per_page?: number;
    aggregate_type?: string;
    aggregate_id?: string;
    event_type?: string;
    operation?: EventOperation;
    status?: EventStatus;
    start_date?: string;
    end_date?: string;
  } = {}) => {
    const searchParams = new URLSearchParams();
    searchParams.append('tenant_id', DEMO_TENANT_ID);
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.per_page) searchParams.append('per_page', params.per_page.toString());
    if (params.aggregate_type) searchParams.append('aggregate_type', params.aggregate_type);
    if (params.aggregate_id) searchParams.append('aggregate_id', params.aggregate_id);
    if (params.event_type) searchParams.append('event_type', params.event_type);
    if (params.operation) searchParams.append('operation', params.operation);
    if (params.status) searchParams.append('status', params.status);
    if (params.start_date) searchParams.append('start_date', params.start_date);
    if (params.end_date) searchParams.append('end_date', params.end_date);
    
    const response = await api.get<OutboxEventListResponse>(`/outbox?${searchParams}`);
    return response.data;
  },

  getPending: async (limit = 100) => {
    const response = await api.get<OutboxEvent[]>(
      `/outbox/pending?tenant_id=${DEMO_TENANT_ID}&limit=${limit}`
    );
    return response.data;
  },

  get: async (eventId: string) => {
    const response = await api.get<OutboxEvent>(`/outbox/${eventId}`);
    return response.data;
  },

  getTimeline: async (aggregateType: string, aggregateId: string) => {
    const response = await api.get<EntityTimeline>(
      `/outbox/timeline/${aggregateType}/${aggregateId}?tenant_id=${DEMO_TENANT_ID}`
    );
    return response.data;
  },

  getSummary: async (hours = 24) => {
    const response = await api.get<EventSummaryResponse>(
      `/outbox/stats/summary?tenant_id=${DEMO_TENANT_ID}&hours=${hours}`
    );
    return response.data;
  },

  getStatistics: async () => {
    const response = await api.get<EventStatistics>(
      `/outbox/stats/overview?tenant_id=${DEMO_TENANT_ID}`
    );
    return response.data;
  },

  markProcessed: async (eventIds: string[]) => {
    const response = await api.post<{ processed_count: number }>(
      '/outbox/mark-processed',
      { event_ids: eventIds }
    );
    return response.data;
  },

  archive: async (daysOld = 7) => {
    const response = await api.post<{ archived_count: number }>(
      '/outbox/archive',
      { days_old: daysOld }
    );
    return response.data;
  },

  exportJson: async (params: {
    aggregate_types?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  } = {}) => {
    const searchParams = new URLSearchParams();
    searchParams.append('tenant_id', DEMO_TENANT_ID);
    if (params.aggregate_types) searchParams.append('aggregate_types', params.aggregate_types);
    if (params.start_date) searchParams.append('start_date', params.start_date);
    if (params.end_date) searchParams.append('end_date', params.end_date);
    if (params.limit) searchParams.append('limit', params.limit.toString());
    
    const response = await api.get<{
      export_date: string;
      tenant_id: string;
      event_count: number;
      events: Array<Record<string, unknown>>;
    }>(`/outbox/export/json?${searchParams}`);
    return response.data;
  },

  search: async (query: string, limit = 50) => {
    const response = await api.get<{
      query: string;
      results: OutboxEvent[];
      count: number;
    }>(`/outbox/search?tenant_id=${DEMO_TENANT_ID}&query=${encodeURIComponent(query)}&limit=${limit}`);
    return response.data;
  },
};

// ============================================================================
// SALES ORDERS API
// ============================================================================

export const salesOrdersApi = {
  // List sales orders with filtering
  list: async (params: {
    page?: number;
    limit?: number;
    status?: SalesOrderStatus;
    platform?: Platform;
    customer_id?: string;
    search?: string;
    start_date?: string;
    end_date?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.status) searchParams.append('status', params.status);
    if (params.platform) searchParams.append('platform', params.platform);
    if (params.customer_id) searchParams.append('customer_id', params.customer_id);
    if (params.search) searchParams.append('search', params.search);
    if (params.start_date) searchParams.append('start_date', params.start_date);
    if (params.end_date) searchParams.append('end_date', params.end_date);
    if (params.sort_by) searchParams.append('sort_by', params.sort_by);
    if (params.sort_order) searchParams.append('sort_order', params.sort_order);

    const response = await api.get<SalesOrderListResponse>(`/sales-orders/?${searchParams}`);
    return response.data;
  },

  // Get sales order statistics
  getStats: async () => {
    const response = await api.get<SalesOrderStats>('/sales-orders/stats');
    return response.data;
  },

  // Get single sales order
  get: async (id: string) => {
    const response = await api.get<SalesOrder>(`/sales-orders/${id}`);
    return response.data;
  },

  // Create sales order
  create: async (data: SalesOrderCreate) => {
    const response = await api.post<SalesOrder>('/sales-orders/', data);
    return response.data;
  },

  // Update sales order
  update: async (id: string, data: SalesOrderUpdate) => {
    const response = await api.put<SalesOrder>(`/sales-orders/${id}`, data);
    return response.data;
  },

  // Delete sales order
  delete: async (id: string) => {
    await api.delete(`/sales-orders/${id}`);
  },

  // Get order items
  getItems: async (orderId: string) => {
    const response = await api.get<SalesOrderItem[]>(`/sales-orders/${orderId}/items`);
    return response.data;
  },

  // Add order item
  addItem: async (orderId: string, data: SalesOrderItemCreate) => {
    const response = await api.post<SalesOrderItem>(`/sales-orders/${orderId}/items`, data);
    return response.data;
  },

  // Delete order item
  deleteItem: async (orderId: string, itemId: string) => {
    await api.delete(`/sales-orders/${orderId}/items/${itemId}`);
  },

  // Status transition endpoints
  confirm: async (id: string) => {
    const response = await api.post<SalesOrder>(`/sales-orders/${id}/confirm`);
    return response.data;
  },

  process: async (id: string) => {
    const response = await api.post<SalesOrder>(`/sales-orders/${id}/process`);
    return response.data;
  },

  pack: async (id: string) => {
    const response = await api.post<SalesOrder>(`/sales-orders/${id}/pack`);
    return response.data;
  },

  ship: async (id: string) => {
    const response = await api.post<SalesOrder>(`/sales-orders/${id}/ship`);
    return response.data;
  },

  deliver: async (id: string) => {
    const response = await api.post<SalesOrder>(`/sales-orders/${id}/deliver`);
    return response.data;
  },

  invoice: async (id: string) => {
    const response = await api.post<SalesOrder>(`/sales-orders/${id}/invoice`);
    return response.data;
  },

  cancel: async (id: string) => {
    const response = await api.post<SalesOrder>(`/sales-orders/${id}/cancel`);
    return response.data;
  },

  hold: async (id: string) => {
    const response = await api.post<SalesOrder>(`/sales-orders/${id}/hold`);
    return response.data;
  },

  resume: async (id: string) => {
    const response = await api.post<SalesOrder>(`/sales-orders/${id}/resume`);
    return response.data;
  },

  // Get order history
  getHistory: async (id: string) => {
    const response = await api.get<SalesOrderStatusHistory[]>(`/sales-orders/${id}/history`);
    return response.data;
  },

  // Alias for consistency with SalesOrderDetail page
  addLineItem: async (orderId: string, data: SalesOrderItemCreate) => {
    const response = await api.post<SalesOrderItem>(`/sales-orders/${orderId}/items/`, data);
    return response.data;
  },

  deleteLineItem: async (orderId: string, itemId: string) => {
    await api.delete(`/sales-orders/${orderId}/items/${itemId}`);
  },

  // Update status with notes
  updateStatus: async (orderId: string, newStatus: SalesOrderStatus, notes?: string) => {
    const params = new URLSearchParams();
    if (notes) params.append('notes', notes);
    const response = await api.post<SalesOrder>(`/sales-orders/${orderId}/status/${newStatus}?${params}`);
    return response.data;
  },
};

// Sales Order Import API
export interface ImportPreviewOrder {
  platform_order_id: string;
  fulfillment_center_code: string;
  fulfillment_center_full: string;
  window_start: string | null;
  window_end: string | null;
  expected_date: string | null;
  line_items_count: number;
  total_quantity: number;
  total_amount: number;
  line_items: {
    sku: string;
    asin: string;
    external_id: string;
    name: string;
    quantity_ordered: number;
    unit_price: number;
    line_total: number;
    product_matched: boolean;
    product_id: string | null;
  }[];
  validation_status: string;
  validation_messages: string[];
}

export interface ImportPreviewResponse {
  filename: string;
  platform: string;
  total_rows: number;
  unique_orders: number;
  columns_detected: string[];
  column_mapping_used: Record<string, string>;
  orders: ImportPreviewOrder[];
}

export interface ImportExecuteResponse {
  success: boolean;
  orders_created: number;
  orders_failed: number;
  created_orders: {
    platform_order_id: string;
    order_number: string;
    order_id: string;
    items_created: number;
  }[];
  errors: {
    platform_order_id: string;
    error: string;
  }[];
}

export interface ImportTemplate {
  platform: string;
  name: string;
  description: string;
  required_columns: string[];
  optional_columns: string[];
  sample_file: string;
}

export const salesOrderImportApi = {
  // Preview import file
  preview: async (file: File, platform: string = 'amazon'): Promise<ImportPreviewResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('platform', platform);

    const response = await api.post<ImportPreviewResponse>('/sales-orders/import/preview', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Execute import
  execute: async (importData: ImportPreviewResponse): Promise<ImportExecuteResponse> => {
    const response = await api.post<ImportExecuteResponse>('/sales-orders/import/execute', importData);
    return response.data;
  },

  // Get available templates
  getTemplates: async (): Promise<{ templates: ImportTemplate[] }> => {
    const response = await api.get<{ templates: ImportTemplate[] }>('/sales-orders/import/templates');
    return response.data;
  },
}

// Fulfillment Centers API
export const fulfillmentCentersApi = {
  list: async (params: {
    page?: number;
    limit?: number;
    platform?: Platform;
    search?: string;
    is_active?: boolean;
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.platform) searchParams.append('platform', params.platform);
    if (params.search) searchParams.append('search', params.search);
    if (params.is_active !== undefined) searchParams.append('is_active', params.is_active.toString());

    const response = await api.get<FulfillmentCenterListResponse>(`/sales-orders/fulfillment-centers/?${searchParams}`);
    return response.data;
  },

  create: async (data: FulfillmentCenterCreate) => {
    const response = await api.post<FulfillmentCenter>('/sales-orders/fulfillment-centers/', data);
    return response.data;
  },
};

// ============================================================================
// DASHBOARD API (Optimized - single query for all stats)
// ============================================================================

export interface DashboardStats {
  products_count: number;
  categories_count: number;
  suppliers_count: number;
  customers_count: number;
  units_count: number;
}

export interface RecentProduct {
  id: string;
  name: string;
  sku: string;
  selling_price: number | null;
  category_name: string | null;
}

export interface DashboardResponse {
  stats: DashboardStats;
  recent_products: RecentProduct[];
}

export const dashboardApi = {
  /**
   * Get all dashboard data in a single optimized API call.
   * This replaces 5 separate API calls with 1 call.
   */
  getAll: async (recentLimit = 5): Promise<DashboardResponse> => {
    const response = await api.get<DashboardResponse>(`/dashboard/?recent_limit=${recentLimit}`);
    return response.data;
  },

  /**
   * Get only dashboard statistics (counts).
   */
  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get<DashboardStats>('/dashboard/stats');
    return response.data;
  },
};

// =============================================================================
// AMS API (Allocation Management System)
// =============================================================================

// Vendor code header for AMS requests
const AMS_VENDOR_CODE = 'NU8FU';

// Create axios instance for AMS service
const amsApi = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'X-Vendor-Code': AMS_VENDOR_CODE,
  },
});

// AMS Dashboard
export const amsDashboardApi = {
  getStats: async () => {
    const response = await amsApi.get('/ams/dashboard/stats');
    return response.data;
  },
};

// AMS Vendors
export const amsVendorsApi = {
  list: async () => {
    const response = await amsApi.get('/vendors/');
    return response.data;
  },

  get: async (vendorCode: string) => {
    const response = await amsApi.get(`/vendors/${vendorCode}`);
    return response.data;
  },

  create: async (data: { vendor_code: string; vendor_name: string }) => {
    const response = await amsApi.post('/vendors/', data);
    return response.data;
  },
};

// AMS Purchase Orders
export interface AMSPurchaseOrder {
  id: number;
  vendor_id: number;
  channel: string;
  po_number: string;
  status: string;
  po_status: string | null;
  fulfillment_center_code: string | null;
  is_cancelled: boolean;
  cancelled_at: string | null;
  created_at: string;
  validated_at: string | null;
  source_filename: string | null;
  validation_report_path: string | null;
  line_count: number;
  lines?: AMSPurchaseOrderLine[];
}

export interface AMSPurchaseOrderLine {
  id: number;
  line_number: string;
  ordered_qty: number;
  channel_item_id_type: string | null;
  channel_item_id: string | null;
  item_name: string | null;
  vendor_sku_id: number | null;
  vendor_sku_code: string | null;
  available_qty: number | null;
  allocatable_qty: number | null;
  unallocatable_qty: number | null;
  line_status: string | null;
  reason: string | null;
  inventory_scope: string | null;
  validated_warehouse_code: string | null;
}

export const amsPurchaseOrdersApi = {
  list: async (params: {
    status?: string;
    po_status?: string;
    channel?: string;
    limit?: number;
    offset?: number;
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.append('status', params.status);
    if (params.po_status) searchParams.append('po_status', params.po_status);
    if (params.channel) searchParams.append('channel', params.channel);
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.offset) searchParams.append('offset', params.offset.toString());
    
    const response = await amsApi.get<AMSPurchaseOrder[]>(`/purchase-orders/?${searchParams}`);
    return response.data;
  },

  get: async (poId: number) => {
    const response = await amsApi.get<AMSPurchaseOrder>(`/purchase-orders/${poId}`);
    return response.data;
  },

  upload: async (file: File, channel: string) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await amsApi.post(`/purchase-orders/upload?channel=${channel}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  validate: async (poId: number) => {
    const response = await amsApi.post(`/purchase-orders/${poId}/validate`);
    return response.data;
  },

  cancel: async (poId: number) => {
    const response = await amsApi.post(`/purchase-orders/${poId}/cancel`);
    return response.data;
  },

  downloadReport: async (poId: number) => {
    const response = await amsApi.get(`/purchase-orders/${poId}/report`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

// AMS Inventory
export interface AMSInventoryItem {
  id: number;
  vendor_id: number;
  warehouse_code: string;
  warehouse_name: string;
  sku_code: string;
  sku_name: string | null;
  on_hand_qty: number;
  reserved_qty: number;
  available_qty: number;
  updated_at: string;
}

export interface AMSInventoryStats {
  total_skus: number;
  total_warehouses: number;
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
}

export const amsInventoryApi = {
  list: async (params: {
    warehouse_code?: string;
    sku_code?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.warehouse_code) searchParams.append('warehouse_code', params.warehouse_code);
    if (params.sku_code) searchParams.append('sku_code', params.sku_code);
    if (params.search) searchParams.append('search', params.search);
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.offset) searchParams.append('offset', params.offset.toString());
    
    const response = await amsApi.get<AMSInventoryItem[]>(`/inventory/?${searchParams}`);
    return response.data;
  },

  getStats: async () => {
    const response = await amsApi.get<AMSInventoryStats>('/inventory/stats');
    return response.data;
  },

  getSku: async (skuCode: string) => {
    const response = await amsApi.get<AMSInventoryItem[]>(`/inventory/${skuCode}`);
    return response.data;
  },

  upload: async (file: File, expectedWarehouse?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    
    let url = '/inventory/upload';
    if (expectedWarehouse) {
      url += `?expected_warehouse=${expectedWarehouse}`;
    }
    
    const response = await amsApi.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

// AMS Warehouses
export interface AMSWarehouse {
  id: number;
  vendor_id: number;
  vendor_warehouse_code: string;
  warehouse_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  is_active: boolean;
  sku_count: number;
  total_stock: number;
  created_at: string;
  updated_at: string;
}

export const amsWarehousesApi = {
  list: async () => {
    const response = await amsApi.get<AMSWarehouse[]>('/warehouses/');
    return response.data;
  },

  get: async (warehouseCode: string) => {
    const response = await amsApi.get<AMSWarehouse>(`/warehouses/${warehouseCode}`);
    return response.data;
  },

  create: async (data: {
    vendor_warehouse_code: string;
    warehouse_name: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    is_active?: boolean;
  }) => {
    const response = await amsApi.post<AMSWarehouse>('/warehouses/', data);
    return response.data;
  },

  delete: async (warehouseCode: string) => {
    const response = await amsApi.delete(`/warehouses/${warehouseCode}`);
    return response.data;
  },

  // Locations
  listLocations: async (warehouseCode: string) => {
    const response = await amsApi.get(`/warehouses/${warehouseCode}/locations`);
    return response.data;
  },

  createLocation: async (warehouseCode: string, data: {
    location_code: string;
    location_name?: string;
  }) => {
    const response = await amsApi.post(`/warehouses/${warehouseCode}/locations`, data);
    return response.data;
  },
};

// AMS Fulfillment Centers
export interface AMSFulfillmentCenter {
  id: number;
  channel: string;
  fulfillment_center_code: string;
  fulfillment_center_name: string | null;
  fulfillment_center_type: string | null;
  is_active: boolean;
  mapped_warehouse_code: string | null;
  created_at: string;
}

export interface AMSFCMapping {
  id: number;
  vendor_id: number;
  channel: string;
  fulfillment_center_code: string;
  vendor_warehouse_id: number;
  warehouse_code: string;
  warehouse_name: string;
  created_at: string;
}

export const amsFulfillmentCentersApi = {
  list: async (channel?: string) => {
    const url = channel ? `/fulfillment-centers/?channel=${channel}` : '/fulfillment-centers/';
    const response = await amsApi.get<AMSFulfillmentCenter[]>(url);
    return response.data;
  },

  create: async (data: {
    channel: string;
    fulfillment_center_code: string;
    fulfillment_center_name?: string;
    fulfillment_center_type?: string;
    is_active?: boolean;
  }) => {
    const response = await amsApi.post<AMSFulfillmentCenter>('/fulfillment-centers/', data);
    return response.data;
  },

  // Mappings
  listMappings: async (channel?: string) => {
    const url = channel ? `/fulfillment-centers/mappings?channel=${channel}` : '/fulfillment-centers/mappings';
    const response = await amsApi.get<AMSFCMapping[]>(url);
    return response.data;
  },

  createMapping: async (data: {
    channel: string;
    fulfillment_center_code: string;
    vendor_warehouse_code: string;
  }) => {
    const response = await amsApi.post<AMSFCMapping>('/fulfillment-centers/mappings', data);
    return response.data;
  },

  deleteMapping: async (mappingId: number) => {
    const response = await amsApi.delete(`/fulfillment-centers/mappings/${mappingId}`);
    return response.data;
  },
};

// AMS SKU Mappings
export interface AMSVendorSKU {
  id: number;
  vendor_id: number;
  sku_code: string;
  sku_name: string | null;
  ean: string | null;
  is_active: boolean;
  mrp: number | null;
  selling_price: number | null;
  cost_price: number | null;
  currency: string | null;
  hsn_code: string | null;
  gst_rate: number | null;
  created_at: string;
  updated_at: string;
  mappings?: AMSChannelMapping[];
}

export interface AMSChannelMapping {
  id?: number;
  vendor_id?: number;
  vendor_sku_id?: number;
  channel: string;
  channel_item_id_type: string;
  channel_item_id: string;
  sku_code?: string;
  sku_name?: string;
  created_at?: string;
}

export const amsSKUMappingsApi = {
  listSKUs: async (params: {
    search?: string;
    limit?: number;
    offset?: number;
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.append('search', params.search);
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.offset) searchParams.append('offset', params.offset.toString());
    
    const response = await amsApi.get<AMSVendorSKU[]>(`/sku-mappings/skus?${searchParams}`);
    return response.data;
  },

  getSKU: async (skuCode: string) => {
    const response = await amsApi.get<AMSVendorSKU>(`/sku-mappings/skus/${skuCode}`);
    return response.data;
  },

  createSKU: async (data: {
    sku_code: string;
    sku_name?: string;
    ean?: string;
    is_active?: boolean;
  }) => {
    const response = await amsApi.post<AMSVendorSKU>('/sku-mappings/skus', data);
    return response.data;
  },

  listChannelMappings: async (params: {
    channel?: string;
    id_type?: string;
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.channel) searchParams.append('channel', params.channel);
    if (params.id_type) searchParams.append('id_type', params.id_type);
    
    const response = await amsApi.get<AMSChannelMapping[]>(`/sku-mappings/channel-mappings?${searchParams}`);
    return response.data;
  },

  createChannelMapping: async (data: {
    vendor_sku_id: number;
    channel: string;
    channel_item_id_type: string;
    channel_item_id: string;
  }) => {
    const response = await amsApi.post<AMSChannelMapping>('/sku-mappings/channel-mappings', data);
    return response.data;
  },

  deleteChannelMapping: async (mappingId: number) => {
    const response = await amsApi.delete(`/sku-mappings/channel-mappings/${mappingId}`);
    return response.data;
  },
};

// =============================================================================
// IMS INVENTORY SERVICE API (Port 8004)
// =============================================================================

// Warehouse Types
export interface Warehouse {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  warehouse_type: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country: string;
  pincode?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  is_active: boolean;
  is_default: boolean;
  accepts_returns: boolean;
  created_at: string;
  updated_at: string;
  total_products: number;
  total_stock_value: number;
}

export interface WarehouseCreate {
  code: string;
  name: string;
  warehouse_type?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  is_active?: boolean;
  is_default?: boolean;
  accepts_returns?: boolean;
}

export interface WarehouseUpdate extends Partial<WarehouseCreate> {}

export interface WarehouseListResponse {
  warehouses: Warehouse[];
  total: number;
  page: number;
  limit: number;
}

export interface WarehouseSummary {
  total_warehouses: number;
  active_warehouses: number;
  internal_warehouses: number;
  threepl_warehouses: number;
  total_stock_value: number;
}

// Inventory Types
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface InventoryItem {
  id: string;
  tenant_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  product_image?: string;
  category_id?: string;
  category_name?: string;
  warehouse_id: string;
  warehouse_name: string;
  warehouse_code: string;
  on_hand_qty: number;
  reserved_qty: number;
  available_qty: number;
  incoming_qty: number;
  committed_qty: number;
  reorder_level: number;
  reorder_qty: number;
  max_stock_level?: number;
  bin_location?: string;
  unit_cost: number;
  total_value: number;
  stock_status: StockStatus;
  last_count_date?: string;
  last_received_date?: string;
  last_sold_date?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryListResponse {
  items: InventoryItem[];
  total: number;
  page: number;
  limit: number;
}

export interface InventorySummary {
  total_products: number;
  total_stock_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_warehouses: number;
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
}

export interface ProductStockSummary {
  product_id: string;
  product_name: string;
  product_sku: string;
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  total_value: number;
  warehouse_count: number;
  stock_status: StockStatus;
  reorder_level: number;
  warehouses: Array<{
    warehouse_id: string;
    warehouse_name: string;
    warehouse_code: string;
    on_hand_qty: number;
    reserved_qty: number;
    available_qty: number;
    unit_cost: number;
    bin_location?: string;
  }>;
}

// Stock Movement Types
export type MovementType = 'receive' | 'issue' | 'adjust_in' | 'adjust_out' | 
  'transfer_out' | 'transfer_in' | 'production_in' | 'production_out' | 'in' | 'out';

export type AdjustmentReason = 'cycle_count' | 'damaged' | 'expired' | 'theft' | 
  'found' | 'correction' | 'opening_balance' | 'other';

export interface StockMovement {
  id: string;
  tenant_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  warehouse_id: string;
  warehouse_name: string;
  movement_type: MovementType;
  quantity: number;
  unit_cost?: number;
  total_value?: number;
  reference_type?: string;
  reference_id?: string;
  reference_number?: string;
  reason?: string;
  notes?: string;
  batch_number?: string;
  expiry_date?: string;
  created_by?: string;
  created_at: string;
}

export interface StockMovementListResponse {
  movements: StockMovement[];
  total: number;
  page: number;
  limit: number;
}

// Dashboard Types
export interface DashboardStats {
  total_products: number;
  total_stock_value: number;
  total_warehouses: number;
  low_stock_count: number;
  out_of_stock_count: number;
  expiring_soon_count: number;
  pending_receipts: number;
  top_products: Array<{
    id: string;
    name: string;
    sku: string;
    image_url?: string;
    total_qty: number;
    total_value: number;
  }>;
  recent_movements: Array<{
    id: string;
    type: string;
    quantity: number;
    product_name: string;
    product_sku: string;
    warehouse_name: string;
    created_at: string;
  }>;
  stock_by_warehouse: Array<{
    id: string;
    name: string;
    code: string;
    total_value: number;
    product_count: number;
  }>;
  stock_by_category: Array<{
    id: string;
    name: string;
    total_value: number;
    product_count: number;
  }>;
}

export interface LowStockReport {
  items: Array<{
    id: string;
    product_id: string;
    product_name: string;
    product_sku: string;
    image_url?: string;
    category_name?: string;
    warehouse_id: string;
    warehouse_name: string;
    on_hand_qty: number;
    available_qty: number;
    reorder_level: number;
    reorder_qty: number;
    shortage: number;
    severity: 'critical' | 'warning';
  }>;
  total: number;
  critical_count: number;
  warning_count: number;
}

export interface InventoryDashboardStats {
  total_products: number;
  total_stock_value: number;
  total_warehouses: number;
  low_stock_count: number;
  out_of_stock_count: number;
  expiring_soon_count: number;
  pending_receipts: number;
  top_products: Array<{
    id: string;
    name: string;
    sku: string;
    image_url?: string;
    total_qty: number;
    total_value: number;
  }>;
  recent_movements: Array<{
    id: string;
    type: string;
    quantity: number;
    product_name: string;
    product_sku: string;
    warehouse_name: string;
    created_at: string;
  }>;
  stock_by_warehouse: Array<{
    id: string;
    name: string;
    code: string;
    total_value: number;
    product_count: number;
  }>;
  stock_by_category: Array<{
    id: string;
    name: string;
    total_value: number;
    product_count: number;
  }>;
}

// Warehouses API
export const warehousesApi = {
  list: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    warehouse_type?: string;
    is_active?: boolean;
    city?: string;
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.search) searchParams.append('search', params.search);
    if (params.warehouse_type) searchParams.append('warehouse_type', params.warehouse_type);
    if (params.is_active !== undefined) searchParams.append('is_active', params.is_active.toString());
    if (params.city) searchParams.append('city', params.city);
    
    const response = await api.get<WarehouseListResponse>(`/warehouses/?${searchParams}`);
    return response.data;
  },

  getSummary: async () => {
    const response = await api.get<WarehouseSummary>('/warehouses/summary');
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get<Warehouse>(`/warehouses/${id}`);
    return response.data;
  },

  create: async (data: WarehouseCreate) => {
    const response = await api.post<Warehouse>('/warehouses/', data);
    return response.data;
  },

  update: async (id: string, data: WarehouseUpdate) => {
    const response = await api.put<Warehouse>(`/warehouses/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/warehouses/${id}`);
  },

  getInventory: async (warehouseId: string, params: {
    page?: number;
    limit?: number;
    search?: string;
    low_stock_only?: boolean;
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.search) searchParams.append('search', params.search);
    if (params.low_stock_only) searchParams.append('low_stock_only', 'true');
    
    const response = await api.get(`/warehouses/${warehouseId}/inventory?${searchParams}`);
    return response.data;
  },
};

// Inventory API
export const inventoryApi = {
  list: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    warehouse_id?: string;
    category_id?: string;
    stock_status?: StockStatus;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.search) searchParams.append('search', params.search);
    if (params.warehouse_id) searchParams.append('warehouse_id', params.warehouse_id);
    if (params.category_id) searchParams.append('category_id', params.category_id);
    if (params.stock_status) searchParams.append('stock_status', params.stock_status);
    if (params.sort_by) searchParams.append('sort_by', params.sort_by);
    if (params.sort_order) searchParams.append('sort_order', params.sort_order);
    
    const response = await api.get<InventoryListResponse>(`/inventory/?${searchParams}`);
    return response.data;
  },

  getSummary: async () => {
    const response = await api.get<InventorySummary>('/inventory/summary');
    return response.data;
  },

  getProductStock: async (productId: string) => {
    const response = await api.get<ProductStockSummary>(`/inventory/product/${productId}`);
    return response.data;
  },

  getLowStock: async (limit = 50) => {
    const response = await api.get<{ items: InventoryItem[]; total: number }>(`/inventory/low-stock?limit=${limit}`);
    return response.data;
  },

  getOutOfStock: async (limit = 50) => {
    const response = await api.get<{ items: InventoryItem[]; total: number }>(`/inventory/out-of-stock?limit=${limit}`);
    return response.data;
  },

  create: async (data: {
    product_id: string;
    warehouse_id: string;
    on_hand_qty?: number;
    unit_cost?: number;
    reorder_level?: number;
    reorder_qty?: number;
    max_stock_level?: number;
    bin_location?: string;
  }) => {
    const response = await api.post<InventoryItem>('/inventory/', data);
    return response.data;
  },

  update: async (id: string, data: {
    on_hand_qty?: number;
    reserved_qty?: number;
    incoming_qty?: number;
    reorder_level?: number;
    reorder_qty?: number;
    max_stock_level?: number;
    bin_location?: string;
    unit_cost?: number;
  }) => {
    const response = await api.put<InventoryItem>(`/inventory/${id}`, data);
    return response.data;
  },

  reserve: async (data: {
    product_id: string;
    warehouse_id: string;
    quantity: number;
    source_type: string;
    source_id: string;
    source_line_id?: string;
  }) => {
    const response = await api.post<{
      success: boolean;
      reservation_id?: string;
      message: string;
      available_qty: number;
      reserved_qty: number;
    }>('/inventory/reserve', data);
    return response.data;
  },

  releaseReservation: async (reservationId: string) => {
    const response = await api.post(`/inventory/release/${reservationId}`);
    return response.data;
  },

  fulfillReservation: async (reservationId: string) => {
    const response = await api.post(`/inventory/fulfill/${reservationId}`);
    return response.data;
  },
};

// Stock Movements API
export const stockMovementsApi = {
  list: async (params: {
    page?: number;
    limit?: number;
    product_id?: string;
    warehouse_id?: string;
    movement_type?: string;
    from_date?: string;
    to_date?: string;
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.product_id) searchParams.append('product_id', params.product_id);
    if (params.warehouse_id) searchParams.append('warehouse_id', params.warehouse_id);
    if (params.movement_type) searchParams.append('movement_type', params.movement_type);
    if (params.from_date) searchParams.append('from_date', params.from_date);
    if (params.to_date) searchParams.append('to_date', params.to_date);
    
    const response = await api.get<StockMovementListResponse>(`/stock-movements/?${searchParams}`);
    return response.data;
  },

  getProductMovements: async (productId: string, limit = 50) => {
    const response = await api.get(`/stock-movements/product/${productId}?limit=${limit}`);
    return response.data;
  },

  receive: async (data: {
    product_id: string;
    warehouse_id: string;
    quantity: number;
    unit_cost?: number;
    reference_type?: string;
    reference_id?: string;
    reference_number?: string;
    batch_number?: string;
    expiry_date?: string;
    notes?: string;
  }) => {
    const response = await api.post('/stock-movements/receive', data);
    return response.data;
  },

  bulkReceive: async (data: {
    warehouse_id: string;
    reference_type?: string;
    reference_id?: string;
    reference_number?: string;
    items: Array<{
      product_id: string;
      quantity: number;
      unit_cost?: number;
      batch_number?: string;
    }>;
    notes?: string;
  }) => {
    const response = await api.post('/stock-movements/receive/bulk', data);
    return response.data;
  },

  issue: async (data: {
    product_id: string;
    warehouse_id: string;
    quantity: number;
    reference_type?: string;
    reference_id?: string;
    reference_number?: string;
    notes?: string;
  }) => {
    const response = await api.post('/stock-movements/issue', data);
    return response.data;
  },

  adjust: async (data: {
    product_id: string;
    warehouse_id: string;
    quantity: number;
    reason: AdjustmentReason;
    notes?: string;
    reference_number?: string;
  }) => {
    const response = await api.post('/stock-movements/adjust', data);
    return response.data;
  },

  transfer: async (data: {
    product_id: string;
    source_warehouse_id: string;
    destination_warehouse_id: string;
    quantity: number;
    notes?: string;
  }) => {
    const response = await api.post('/stock-movements/transfer', data);
    return response.data;
  },
};

// Inventory Reports API
// ============================================================================
// REPORTS API - Multi-Channel Report Uploads
// ============================================================================

export interface ReportUploadResponse {
  upload_id: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  failed_rows: number;
  message: string;
}

export interface ReportUpload {
  id: string;
  channel: string;
  report_type: string;
  file_name: string;
  file_size: number;
  total_rows: number;
  processed_rows: number;
  failed_rows: number;
  status: string;
  uploaded_at: string;
  processed_at: string | null;
}

export interface SalesReportRow {
  date: string;
  item_id: string;
  item_name: string;
  channel: string;
  units: number;
  revenue: number;
  brand: string;
  drr: string;
}

export interface SalesSummary {
  total_revenue: number;
  total_units: number;
  total_orders: number;
  total_products: number;
}

export interface InventoryReportRow {
  date: string;
  sku: string;
  product_name: string;
  channel: string;
  inventory: number;
  sellable: number;
  unsellable: number;
  city: string;
  location: string;
  warehouse_code: string;
}

export interface InventorySummary {
  total_inventory: number;
  total_products: number;
  total_locations: number;
}

export interface POReportRow {
  date: string;
  po_number: string;
  channel: string;
  status: string;
  vendor_code: string;
  vendor_name: string;
  sku_id: string;
  product_name: string;
  units: number;
  value: number;
  location: string;
  asn_quantity: number;
  grn_quantity: number;
  expiry_date: string | null;
}

export interface POSummary {
  total_pos: number;
  pending_pos: number;
  total_value: number;
  total_locations: number;
}

export interface AdsReportRow {
  date: string;
  campaign_name: string;
  ad_group: string;
  product_identifier: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  roas: number;
  acos: number;
  channel: string;
}

export interface AdsSummary {
  total_records: number;
  total_campaigns: number;
  total_products: number;
  total_impressions: number;
  total_clicks: number;
  total_spend: number;
  total_sales: number;
  overall_roas: number;
  overall_ctr: number;
  avg_revenue_per_click: number;
}

export const reportsApi = {
  upload: async (
    file: File,
    channel: string,
    reportType: string,
    tenantId: string
  ): Promise<ReportUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('channel', channel);
    formData.append('report_type', reportType);

    const response = await axios.post<ReportUploadResponse>(
      '/api/v1/reports/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Tenant-ID': tenantId,
        },
      }
    );
    return response.data;
  },

  listUploads: async (
    tenantId: string,
    channel?: string,
    reportType?: string,
    limit: number = 50
  ): Promise<ReportUpload[]> => {
    const params: any = { limit };
    if (channel) params.channel = channel;
    if (reportType) params.report_type = reportType;

    const response = await axios.get<ReportUpload[]>('/api/v1/reports/uploads', {
      params,
      headers: {
        'X-Tenant-ID': tenantId,
      },
    });
    return response.data;
  },
  getSalesReports: async (
    tenantId: string,
    channel?: string,
    startDate?: string,
    endDate?: string,
    limit: number = 1000,
    offset: number = 0
  ): Promise<SalesReportRow[]> => {
    const params: any = { limit, offset };
    if (channel) params.channel = channel;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await axios.get<SalesReportRow[]>('/api/v1/reports/sales', {
      params,
      headers: {
        'X-Tenant-ID': tenantId,
      },
    });
    return response.data;
  },
  getSalesSummary: async (
    tenantId: string,
    channel?: string,
    startDate?: string,
    endDate?: string
  ): Promise<SalesSummary> => {
    const params: any = {};
    if (channel) params.channel = channel;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await axios.get<SalesSummary>('/api/v1/reports/sales/summary', {
      params,
      headers: {
        'X-Tenant-ID': tenantId,
      },
    });
    return response.data;
  },
  getInventoryReports: async (
    tenantId: string,
    channel?: string,
    startDate?: string,
    endDate?: string,
    limit: number = 1000,
    offset: number = 0
  ): Promise<InventoryReportRow[]> => {
    const params: any = { limit, offset };
    if (channel) params.channel = channel;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await axios.get<InventoryReportRow[]>('/api/v1/reports/inventory', {
      params,
      headers: {
        'X-Tenant-ID': tenantId,
      },
    });
    return response.data;
  },
  getInventorySummary: async (
    tenantId: string,
    channel?: string,
    startDate?: string,
    endDate?: string
  ): Promise<InventorySummary> => {
    const params: any = {};
    if (channel) params.channel = channel;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await axios.get<InventorySummary>('/api/v1/reports/inventory/summary', {
      params,
      headers: {
        'X-Tenant-ID': tenantId,
      },
    });
    return response.data;
  },
  getPOReports: async (
    tenantId: string,
    channel?: string,
    startDate?: string,
    endDate?: string,
    limit: number = 1000,
    offset: number = 0
  ): Promise<POReportRow[]> => {
    const params: any = { limit, offset };
    if (channel) params.channel = channel;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await axios.get<POReportRow[]>('/api/v1/reports/po', {
      params,
      headers: {
        'X-Tenant-ID': tenantId,
      },
    });
    return response.data;
  },
  getPOSummary: async (
    tenantId: string,
    channel?: string,
    startDate?: string,
    endDate?: string
  ): Promise<POSummary> => {
    const params: any = {};
    if (channel) params.channel = channel;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await axios.get<POSummary>('/api/v1/reports/po/summary', {
      params,
      headers: {
        'X-Tenant-ID': tenantId,
      },
    });
    return response.data;
  },
  getAdsReports: async (
    tenantId: string,
    channel?: string,
    startDate?: string,
    endDate?: string,
    limit: number = 1000,
    offset: number = 0
  ): Promise<AdsReportRow[]> => {
    const params: any = { limit, offset };
    if (channel) params.channel = channel;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await axios.get<AdsReportRow[]>('/api/v1/reports/ads', {
      params,
      headers: {
        'X-Tenant-ID': tenantId,
      },
    });
    return response.data;
  },
  getAdsSummary: async (
    tenantId: string,
    channel?: string,
    startDate?: string,
    endDate?: string
  ): Promise<AdsSummary> => {
    const params: any = {};
    if (channel) params.channel = channel;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await axios.get<AdsSummary>('/api/v1/reports/ads/summary', {
      params,
      headers: {
        'X-Tenant-ID': tenantId,
      },
    });
    return response.data;
  },
};

export const inventoryReportsApi = {
  getDashboard: async (): Promise<DashboardStats> => {
    const response = await api.get<DashboardStats>('/inventory-reports/dashboard');
    return response.data;
  },

  getValueReport: async (warehouseId?: string) => {
    const params = warehouseId ? `?warehouse_id=${warehouseId}` : '';
    const response = await api.get(`/inventory-reports/value${params}`);
    return response.data;
  },

  getLowStock: async (params: {
    warehouse_id?: string;
    category_id?: string;
    limit?: number;
  } = {}): Promise<LowStockReport> => {
    const searchParams = new URLSearchParams();
    if (params.warehouse_id) searchParams.append('warehouse_id', params.warehouse_id);
    if (params.category_id) searchParams.append('category_id', params.category_id);
    if (params.limit) searchParams.append('limit', params.limit.toString());
    
    const response = await api.get<LowStockReport>(`/inventory-reports/low-stock?${searchParams}`);
    return response.data;
  },

  getAgingReport: async (params: {
    days_threshold?: number;
    warehouse_id?: string;
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.days_threshold) searchParams.append('days_threshold', params.days_threshold.toString());
    if (params.warehouse_id) searchParams.append('warehouse_id', params.warehouse_id);
    
    const response = await api.get(`/inventory-reports/aging?${searchParams}`);
    return response.data;
  },

  getMovementSummary: async (params: {
    from_date?: string;
    to_date?: string;
    warehouse_id?: string;
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.from_date) searchParams.append('from_date', params.from_date);
    if (params.to_date) searchParams.append('to_date', params.to_date);
    if (params.warehouse_id) searchParams.append('warehouse_id', params.warehouse_id);
    
    const response = await api.get(`/inventory-reports/movement-summary?${searchParams}`);
    return response.data;
  },

  getReorderSuggestions: async (params: {
    warehouse_id?: string;
    limit?: number;
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.warehouse_id) searchParams.append('warehouse_id', params.warehouse_id);
    if (params.limit) searchParams.append('limit', params.limit.toString());
    
    const response = await api.get(`/inventory-reports/reorder-suggestions?${searchParams}`);
    return response.data;
  },
};

export default api;
