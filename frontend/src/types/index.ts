// =============================================================================
// COMMON TYPES
// =============================================================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// =============================================================================
// CATEGORY TYPES
// =============================================================================

export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  parent_id?: string;
  level: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  children?: Category[];
}

export interface CategoryCreate {
  name: string;
  description?: string;
  parent_id?: string;
}

export interface CategoryUpdate {
  name?: string;
  description?: string;
  is_active?: boolean;
}

export interface CategoryListResponse {
  categories: Category[];
  total: number;
  page: number;
  limit: number;
}

// =============================================================================
// UNIT TYPES
// =============================================================================

export interface Unit {
  id: string;
  tenant_id: string;
  name: string;
  symbol: string;
  unit_type: string;  // quantity, weight, volume, length
  base_unit_id?: string;
  conversion_factor?: number;
  is_active: boolean;
  created_at: string;
}

export interface UnitCreate {
  name: string;
  symbol: string;
  unit_type: string;
}

export interface UnitUpdate {
  name?: string;
  symbol?: string;
  unit_type?: string;
  is_active?: boolean;
}

export interface UnitListResponse {
  units: Unit[];
  total: number;
  page: number;
  limit: number;
}

// =============================================================================
// BRAND TYPES
// =============================================================================

export interface Brand {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  logo_url?: string;
  website?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  product_count?: number;
}

export interface BrandCreate {
  name: string;
  description?: string;
  logo_url?: string;
  website?: string;
}

export interface BrandUpdate {
  name?: string;
  description?: string;
  logo_url?: string;
  website?: string;
  is_active?: boolean;
}

export interface BrandListResponse {
  brands: Brand[];
  total: number;
  page: number;
  limit: number;
}

// =============================================================================
// MANUFACTURER TYPES
// =============================================================================

export interface Manufacturer {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  contact_info?: string;
  website?: string;
  country?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ManufacturerCreate {
  name: string;
  description?: string;
  contact_info?: string;
  website?: string;
  country?: string;
}

export interface ManufacturerUpdate {
  name?: string;
  description?: string;
  contact_info?: string;
  website?: string;
  country?: string;
  is_active?: boolean;
}

export interface ManufacturerListResponse {
  manufacturers: Manufacturer[];
  total: number;
  page: number;
  limit: number;
}

// =============================================================================
// PRODUCT TYPES (formerly Items)
// =============================================================================

export type ProductType = 'goods' | 'service' | 'raw_material';

export interface Product {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  description?: string;
  product_type: ProductType;
  
  // Classification
  category_id?: string;
  category_name?: string;
  brand_id?: string;
  brand_name?: string;
  manufacturer_id?: string;
  manufacturer_name?: string;
  
  // Product Identifiers
  upc?: string;
  ean?: string;
  mpn?: string;
  isbn?: string;
  
  // Units
  primary_unit_id?: string;
  primary_unit_name?: string;
  primary_unit_symbol?: string;
  secondary_unit_id?: string;
  secondary_unit_name?: string;
  conversion_rate?: number;
  
  // Dimensions
  length?: number;
  width?: number;
  height?: number;
  dimension_unit_id?: string;
  weight?: number;
  weight_unit_id?: string;
  
  // Sales Information
  selling_price?: number;
  mrp?: number;
  sales_description?: string;
  sales_tax_rate?: number;
  is_taxable: boolean;
  
  // Purchase Information
  cost_price?: number;
  purchase_description?: string;
  purchase_tax_rate?: number;
  preferred_vendor_id?: string;
  preferred_vendor_name?: string;
  
  // Tax & Compliance
  hsn_code?: string;
  
  // Tracking
  track_batches: boolean;
  track_serials: boolean;
  track_expiry: boolean;
  has_variants: boolean;
  
  // Inventory Settings
  reorder_level?: number;
  reorder_qty?: number;
  min_stock?: number;
  max_stock?: number;
  lead_time_days?: number;
  
  // Opening Stock
  opening_stock?: number;
  opening_stock_value?: number;
  
  // Images
  image_url?: string;
  image_urls?: string[];
  
  // Computed (from inventory)
  stock_on_hand?: number;
  stock_value?: number;
  
  // Status
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ProductCreate {
  sku: string;
  name: string;
  description?: string;
  product_type?: ProductType;
  category_id?: string;
  brand_id?: string;
  manufacturer_id?: string;
  upc?: string;
  ean?: string;
  mpn?: string;
  isbn?: string;
  primary_unit_id?: string;
  secondary_unit_id?: string;
  conversion_rate?: number;
  length?: number;
  width?: number;
  height?: number;
  dimension_unit_id?: string;
  weight?: number;
  weight_unit_id?: string;
  selling_price?: number;
  mrp?: number;
  sales_description?: string;
  sales_tax_rate?: number;
  is_taxable?: boolean;
  cost_price?: number;
  purchase_description?: string;
  purchase_tax_rate?: number;
  preferred_vendor_id?: string;
  hsn_code?: string;
  track_batches?: boolean;
  track_serials?: boolean;
  track_expiry?: boolean;
  has_variants?: boolean;
  reorder_level?: number;
  reorder_qty?: number;
  min_stock?: number;
  max_stock?: number;
  lead_time_days?: number;
  opening_stock?: number;
  opening_stock_value?: number;
  image_url?: string;
  image_urls?: string[];
}

export interface ProductUpdate extends Partial<ProductCreate> {
  is_active?: boolean;
}

export interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// Legacy Item types (for backward compatibility)
export interface Item {
  id: string;
  tenant_id?: string;
  sku_code: string;
  name: string;
  description?: string;
  category_id?: string;
  category_name?: string;
  primary_unit_id?: string;
  primary_unit_name?: string;
  secondary_unit_id?: string;
  secondary_unit_name?: string;
  conversion_rate?: number;
  purchase_rate?: number;
  selling_rate?: number;
  mrp?: number;
  tax_rate?: number;
  hsn_code?: string;
  track_batches?: boolean;
  track_serials?: boolean;
  track_expiry?: boolean;
  has_variants?: boolean;
  reorder_level?: number;
  reorder_qty?: number;
  min_stock?: number;
  max_stock?: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ItemCreate {
  sku_code: string;
  name: string;
  description?: string;
  category_id?: string;
  primary_unit_id?: string;
  secondary_unit_id?: string;
  conversion_rate?: number;
  purchase_rate?: number;
  selling_rate?: number;
  mrp?: number;
  tax_rate?: number;
  hsn_code?: string;
  track_batches?: boolean;
  track_serials?: boolean;
  track_expiry?: boolean;
  has_variants?: boolean;
  reorder_level?: number;
  reorder_qty?: number;
  min_stock?: number;
  max_stock?: number;
}

export interface ItemUpdate extends Partial<ItemCreate> {
  is_active?: boolean;
}

export interface ItemListResponse {
  items: Item[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// =============================================================================
// PRODUCT BUNDLE TYPES
// =============================================================================

export interface BundleComponent {
  id: string;
  bundle_id: string;
  product_id?: string;
  component_bundle_id?: string;
  quantity: number;
  unit_cost?: number;
  line_cost?: number;
  sort_order: number;
  notes?: string;
  
  // Joined fields
  product_name?: string;
  product_sku?: string;
  product_unit_name?: string;
  component_bundle_name?: string;
  component_bundle_sku?: string;
  
  created_at: string;
  updated_at?: string;
}

export interface BundleComponentCreate {
  product_id?: string;
  component_bundle_id?: string;
  quantity: number;
  unit_cost?: number;
  notes?: string;
  sort_order?: number;
}

export interface BundleComponentUpdate {
  quantity?: number;
  unit_cost?: number;
  notes?: string;
  sort_order?: number;
}

export interface ProductBundle {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  description?: string;
  
  // Classification
  category_id?: string;
  category_name?: string;
  brand_id?: string;
  brand_name?: string;
  
  // Unit
  unit_id?: string;
  unit_name?: string;
  unit_symbol?: string;
  
  // Pricing
  auto_calculate_cost: boolean;
  total_component_cost?: number;
  additional_cost?: number;
  total_cost?: number;
  selling_price?: number;
  mrp?: number;
  
  // Tax
  hsn_code?: string;
  tax_rate?: number;
  
  // Inventory
  reorder_level: number;
  stock_on_hand?: number;
  
  // Image
  image_url?: string;
  
  // Components
  components?: BundleComponent[];
  component_count?: number;
  
  // Status
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ProductBundleCreate {
  sku: string;
  name: string;
  description?: string;
  category_id?: string;
  brand_id?: string;
  unit_id?: string;
  auto_calculate_cost?: boolean;
  additional_cost?: number;
  selling_price?: number;
  mrp?: number;
  hsn_code?: string;
  tax_rate?: number;
  reorder_level?: number;
  image_url?: string;
  components?: BundleComponentCreate[];
}

export interface ProductBundleUpdate {
  sku?: string;
  name?: string;
  description?: string;
  category_id?: string;
  brand_id?: string;
  unit_id?: string;
  auto_calculate_cost?: boolean;
  additional_cost?: number;
  total_cost?: number;
  selling_price?: number;
  mrp?: number;
  hsn_code?: string;
  tax_rate?: number;
  reorder_level?: number;
  image_url?: string;
  is_active?: boolean;
}

export interface ProductBundleListResponse {
  bundles: ProductBundle[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ProductBundleSummary {
  total_bundles: number;
  active_bundles: number;
  low_stock_bundles: number;
  total_component_value: number;
}

export interface BundleCostBreakdown {
  bundle_id: string;
  components: Array<{
    component_name: string;
    quantity: number;
    unit_cost: number;
    line_cost: number;
  }>;
  total_component_cost: number;
  additional_cost: number;
  total_cost: number;
  suggested_selling_price?: number;
}

// =============================================================================
// PRODUCTION ORDER TYPES
// =============================================================================

export type ProductionStatus = 'draft' | 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface ProductionComponent {
  id: string;
  production_order_id: string;
  product_id: string;
  quantity_required: number;
  quantity_consumed: number;
  unit_cost?: number;
  total_cost?: number;
  is_fulfilled: boolean;
  
  // Joined fields
  product_name?: string;
  product_sku?: string;
  product_unit_name?: string;
  available_stock?: number;
  
  created_at: string;
}

export interface ProductionOrder {
  id: string;
  tenant_id: string;
  order_number: string;
  bundle_id: string;
  
  // Quantities
  quantity_ordered: number;
  quantity_produced: number;
  
  // Status
  status: ProductionStatus;
  
  // Dates
  expected_date?: string;
  started_at?: string;
  completed_at?: string;
  
  // Assignment
  assigned_to?: string;
  
  // Cost
  estimated_cost?: number;
  actual_cost?: number;
  
  // Notes
  notes?: string;
  cancellation_reason?: string;
  
  // Audit
  created_by?: string;
  created_at: string;
  updated_at?: string;
  
  // Joined fields
  bundle_name?: string;
  bundle_sku?: string;
  
  // Components
  components?: ProductionComponent[];
}

export interface ProductionOrderCreate {
  bundle_id: string;
  quantity_ordered: number;
  expected_date?: string;
  assigned_to?: string;
  notes?: string;
  status?: ProductionStatus;
}

export interface ProductionOrderUpdate {
  quantity_ordered?: number;
  expected_date?: string;
  assigned_to?: string;
  notes?: string;
}

export interface ProductionOrderListResponse {
  orders: ProductionOrder[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ProductionOrderSummary {
  total_orders: number;
  draft_orders: number;
  pending_orders: number;
  in_progress_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_units_produced: number;
}

export interface ProductionHistoryEntry {
  id: string;
  production_order_id: string;
  action: string;
  previous_status?: string;
  new_status?: string;
  quantity_change?: number;
  notes?: string;
  performed_by?: string;
  performed_by_name?: string;
  performed_at: string;
}

// =============================================================================
// PARTY TYPES
// =============================================================================

export type PartyType = 'supplier' | 'customer' | 'both';

export interface Party {
  id: string;
  tenant_id: string;
  party_code: string;
  party_name: string;
  party_type: PartyType;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  gstin?: string;
  pan?: string;
  payment_terms?: string;
  credit_limit?: number;
  credit_days?: number;
  lead_time_days?: number;
  customer_group?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface PartyCreate {
  party_code?: string;
  party_name: string;
  party_type: PartyType;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  gstin?: string;
  pan?: string;
  payment_terms?: string;
  credit_limit?: number;
  credit_days?: number;
  lead_time_days?: number;
  customer_group?: string;
}

export interface PartyUpdate extends Partial<PartyCreate> {
  is_active?: boolean;
}

export interface PartyListResponse {
  parties: Party[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// =============================================================================
// OUTBOX TYPES (Event Sourcing for AI/Analytics)
// =============================================================================

export type EventStatus = 'pending' | 'processing' | 'processed' | 'failed';
export type EventOperation = 'INSERT' | 'UPDATE' | 'DELETE';
export type EventSource = 'api' | 'import' | 'system' | 'trigger';

export interface OutboxEvent {
  id: string;
  event_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  tenant_id: string;
  payload: Record<string, unknown>;
  old_payload?: Record<string, unknown>;
  changes?: Record<string, unknown>;
  operation: EventOperation;
  version: number;
  user_id?: string;
  user_name?: string;
  source: EventSource;
  correlation_id?: string;
  status: EventStatus;
  processed_at?: string;
  error_message?: string;
  retry_count: number;
  created_at: string;
  sequence_number: number;
}

export interface OutboxEventListResponse {
  items: OutboxEvent[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface EventSummary {
  aggregate_type: string;
  event_type: string;
  operation: string;
  event_count: number;
  hour: string;
}

export interface EventSummaryResponse {
  summaries: EventSummary[];
  period: string;
}

export interface EventStatistics {
  total_events: number;
  events_by_type: Record<string, number>;
  events_by_operation: Record<string, number>;
  events_by_status: Record<string, number>;
  events_last_hour: number;
  events_last_24h: number;
  events_last_7d: number;
}

export interface EntityTimeline {
  aggregate_type: string;
  aggregate_id: string;
  events: OutboxEvent[];
  first_event: string;
  last_event: string;
  total_changes: number;
}

// =============================================================================
// SALES ORDER TYPES
// =============================================================================

export type SalesOrderStatus = 
  | 'draft' 
  | 'pending_confirmation' 
  | 'confirmed' 
  | 'processing' 
  | 'packed' 
  | 'shipped' 
  | 'delivered' 
  | 'invoiced' 
  | 'cancelled' 
  | 'on_hold';

export type LineItemStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'picking' 
  | 'packed' 
  | 'shipped' 
  | 'delivered' 
  | 'invoiced' 
  | 'cancelled' 
  | 'backordered' 
  | 'dropshipped';

export type Platform = 'manual' | 'amazon' | 'zepto' | 'blinkit' | 'instamart' | 'bigbasket';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type DiscountType = 'percentage' | 'fixed';

export interface Address {
  name?: string;
  company?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  phone?: string;
  email?: string;
}

export interface FulfillmentCenter {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  full_name?: string;
  platform: Platform;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface FulfillmentCenterCreate {
  code: string;
  name: string;
  full_name?: string;
  platform?: Platform;
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
  notes?: string;
}

export interface FulfillmentCenterListResponse {
  fulfillment_centers: FulfillmentCenter[];
  total: number;
  page: number;
  limit: number;
}

export interface SalesOrderItem {
  id: string;
  sales_order_id: string;
  product_id?: string;
  sku?: string;
  product_name: string;
  description?: string;
  asin?: string;
  external_id?: string;
  external_id_type?: string;
  quantity_ordered: number;
  quantity_confirmed?: number;
  quantity_shipped?: number;
  quantity_delivered?: number;
  quantity_cancelled?: number;
  quantity_returned?: number;
  quantity_invoiced?: number;
  unit_id?: string;
  unit_symbol?: string;
  item_package_quantity?: number;
  list_price?: number;
  unit_price: number;
  discount_amount?: number;
  discount_percentage?: number;
  tax_percentage?: number;
  tax_amount?: number;
  line_total: number;
  status: LineItemStatus;
  warehouse_id?: string;
  warehouse_name?: string;
  bin_location?: string;
  lot_number?: string;
  serial_numbers?: string[];
  expiry_date?: string;
  is_dropship?: boolean;
  dropship_vendor_id?: string;
  line_number: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface SalesOrderItemCreate {
  product_id?: string;
  sku?: string;
  product_name: string;
  description?: string;
  asin?: string;
  external_id?: string;
  external_id_type?: string;
  quantity_ordered: number;
  quantity_confirmed?: number;
  unit_id?: string;
  unit_symbol?: string;
  item_package_quantity?: number;
  list_price?: number;
  unit_price: number;
  discount_amount?: number;
  discount_percentage?: number;
  tax_percentage?: number;
  tax_amount?: number;
  line_total: number;
  status?: LineItemStatus;
  line_number: number;
  notes?: string;
}

export interface SalesOrder {
  id: string;
  tenant_id: string;
  order_number: string;
  reference_number?: string;
  platform_order_id?: string;
  customer_id?: string;
  customer_name?: string;
  platform: Platform;
  platform_vendor_code?: string;
  fulfillment_center_id?: string;
  fulfillment_center_code?: string;
  fulfillment_center_name?: string;
  order_date: string;
  expected_shipment_date?: string;
  delivery_window_start?: string;
  delivery_window_end?: string;
  actual_shipment_date?: string;
  actual_delivery_date?: string;
  billing_address?: Address;
  shipping_address?: Address;
  status: SalesOrderStatus;
  availability_status?: string;
  currency_code: string;
  subtotal: number;
  discount_amount?: number;
  discount_type?: DiscountType;
  discount_percentage?: number;
  shipping_charges?: number;
  tax_amount: number;
  adjustment?: number;
  adjustment_description?: string;
  total_amount: number;
  payment_terms?: string;
  payment_method?: string;
  freight_terms?: string;
  salesperson_id?: string;
  salesperson_name?: string;
  notes?: string;
  terms_conditions?: string;
  internal_notes?: string;
  platform_metadata?: Record<string, unknown>;
  priority: Priority;
  is_back_order?: boolean;
  is_dropship?: boolean;
  total_items: number;
  total_quantity: number;
  items?: SalesOrderItem[];
  created_at: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

export interface SalesOrderCreate {
  reference_number?: string;
  platform_order_id?: string;
  customer_id?: string;
  platform?: Platform;
  platform_vendor_code?: string;
  fulfillment_center_id?: string;
  fulfillment_center_code?: string;
  fulfillment_center_name?: string;
  order_date?: string;
  expected_shipment_date?: string;
  delivery_window_start?: string;
  delivery_window_end?: string;
  billing_address?: Address;
  shipping_address?: Address;
  status?: SalesOrderStatus;
  availability_status?: string;
  currency_code?: string;
  discount_amount?: number;
  discount_type?: DiscountType;
  discount_percentage?: number;
  shipping_charges?: number;
  adjustment?: number;
  adjustment_description?: string;
  payment_terms?: string;
  payment_method?: string;
  freight_terms?: string;
  salesperson_id?: string;
  salesperson_name?: string;
  notes?: string;
  terms_conditions?: string;
  internal_notes?: string;
  platform_metadata?: Record<string, unknown>;
  priority?: Priority;
  is_back_order?: boolean;
  is_dropship?: boolean;
  items?: SalesOrderItemCreate[];
}

export interface SalesOrderUpdate extends Partial<SalesOrderCreate> {}

export interface SalesOrderListResponse {
  sales_orders: SalesOrder[];
  total: number;
  page: number;
  limit: number;
}

export interface SalesOrderStats {
  total_orders: number;
  draft_count: number;
  confirmed_count: number;
  processing_count: number;
  shipped_count: number;
  delivered_count: number;
  cancelled_count: number;
  total_revenue: number;
  orders_today: number;
  orders_this_week: number;
  orders_this_month: number;
}

export interface SalesOrderStatusHistory {
  id: string;
  sales_order_id: string;
  previous_status?: string;
  new_status: string;
  changed_by?: string;
  changed_by_name?: string;
  changed_at: string;
  notes?: string;
  synced_to_platform?: boolean;
  platform_sync_time?: string;
}

// =============================================================================
// DASHBOARD TYPES
// =============================================================================

export interface DashboardStats {
  total_products: number;
  total_bundles: number;
  total_categories: number;
  total_suppliers: number;
  total_customers: number;
  low_stock_items: number;
  active_production_orders: number;
  recent_products: Product[];
  recent_bundles: ProductBundle[];
}
