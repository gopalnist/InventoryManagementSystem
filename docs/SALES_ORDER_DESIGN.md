# Sales Order Module Design Document

## 📋 Document Overview

This document outlines the design for the Sales Order module of the Inventory Management System. The design is based on analysis of:
1. **Zoho Inventory** - Sales Order structure and workflow
2. **Amazon Vendor Central PO** - E-commerce platform order structure
3. **Industry-generic requirements** - Support for Food, Electronics, Medical, and other industries

---

## 🎯 Module Scope

### What Sales Order Covers:
- ✅ Receiving orders from customers/platforms (Amazon, Zepto, Blinkit, etc.)
- ✅ Order tracking and status management
- ✅ Line items with products, quantities, prices
- ✅ Shipping and delivery information
- ✅ Invoice generation triggers
- ✅ Platform-specific metadata (ASIN, External IDs)

### What Sales Order Does NOT Cover (handled by other modules):
- ❌ Inventory deduction → **Inventory Module** (triggered by SO)
- ❌ Payment collection → **Payments Module**
- ❌ Actual shipping → **Shipment/Logistics Module**
- ❌ Product returns → **Sales Returns Module**

---

## 📊 Data Analysis Summary

### Amazon PO/SO Fields (from VendorDownload.xlsx & PurchaseOrderItems.xlsx)

| Field | Description | Example |
|-------|-------------|---------|
| Order/PO Number | Unique order identifier | `1G7J6LEU`, `8R8V9R8L` |
| Vendor Code | Seller identifier | `NU8FU` |
| External ID | Product barcode (EAN) | `8908005459804` |
| External ID Type | Barcode type | `EAN`, `SKU` |
| Model Number | Internal SKU | `NOURY02`, `BL_Chia_1` |
| ASIN | Amazon product ID | `B09NDCMZ1V` |
| Title | Product name/description | Full product title |
| Ship to Location | Fulfillment center | `BLR4 - BENGALURU, KARNATAKA` |
| List Price | MRP | `196.49` |
| Discount | Discount amount | `0` |
| Cost | Unit price after discount | `196.49` |
| Quantity Ordered | Requested qty | `84` |
| Quantity Confirmed | Accepted qty | `84` |
| Quantity Received | Delivered qty | `84` |
| Quantity Canceled | Cancelled qty | `0` |
| Hand Off Start | Delivery window start | `2025-12-02` |
| Hand Off End | Delivery window end | `2025-12-26` |
| Expected Hand Off Date | Target delivery date | `2025-12-02` |
| Availability Status | Stock status | `AC - Accepted: In stock` |
| Condition | Order status | `Confirmed` |
| Freight Terms | Shipping payment | `Prepaid` |
| Payment Method | Payment type | `Invoice` |
| Is Back Order | Backorder flag | `NO` |
| Currency Code | Currency | `INR` |
| Item Package Quantity | Units per package | `1` |
| Priority | Order priority | `No` |

### Zoho Inventory Sales Order Fields

| Section | Fields |
|---------|--------|
| **Header** | SO Number, Reference#, Order Date, Expected Shipment Date, Status |
| **Customer** | Customer Name, Billing Address, Shipping Address |
| **Line Items** | Item Name, SKU, Description, Quantity, Unit, Rate, Amount, Status |
| **Totals** | Sub Total, Shipping Charges, Discount, Adjustment, Total |
| **Additional** | Salesperson, Notes, Terms & Conditions, E-Commerce Operator |
| **Workflow** | Convert to Invoice, Create Package, Create Shipment |

---

## 🗂️ Database Schema Design

### 1. Sales Orders Table

```sql
CREATE TABLE sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Order Identification
    order_number VARCHAR(50) NOT NULL,           -- SO-00001, auto-generated
    reference_number VARCHAR(100),               -- External reference (Amazon PO#)
    platform_order_id VARCHAR(100),              -- Platform's order ID
    
    -- Customer/Platform Information
    customer_id UUID REFERENCES parties(id),     -- Link to customer/platform
    platform VARCHAR(50),                        -- 'amazon', 'zepto', 'blinkit', 'manual'
    platform_vendor_code VARCHAR(50),            -- e.g., 'NU8FU' for Amazon
    
    -- Dates
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_shipment_date DATE,
    delivery_window_start DATE,
    delivery_window_end DATE,
    
    -- Addresses (can be different from customer master)
    billing_address JSONB,
    shipping_address JSONB,
    fulfillment_center VARCHAR(200),             -- e.g., 'BLR4 - BENGALURU, KARNATAKA'
    
    -- Status & Workflow
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    -- Values: draft, pending_confirmation, confirmed, processing, 
    --         packed, shipped, delivered, invoiced, cancelled, on_hold
    
    availability_status VARCHAR(50),             -- Platform-specific status
    
    -- Financial
    currency_code VARCHAR(3) NOT NULL DEFAULT 'INR',
    subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    discount_type VARCHAR(20),                   -- 'percentage', 'fixed'
    discount_percentage DECIMAL(5, 2),
    shipping_charges DECIMAL(15, 2) DEFAULT 0,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    adjustment DECIMAL(15, 2) DEFAULT 0,
    adjustment_description VARCHAR(200),
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    
    -- Payment & Terms
    payment_terms VARCHAR(50),                   -- 'net30', 'prepaid', etc.
    payment_method VARCHAR(50),                  -- 'invoice', 'cod', 'prepaid'
    freight_terms VARCHAR(50),                   -- 'prepaid', 'collect'
    
    -- Assignment
    salesperson_id UUID REFERENCES users(id),
    
    -- Notes
    notes TEXT,
    terms_conditions TEXT,
    internal_notes TEXT,                         -- Not visible to customer
    
    -- Platform-specific metadata
    platform_metadata JSONB,                     -- Store any platform-specific data
    
    -- Priority & Flags
    priority VARCHAR(20) DEFAULT 'normal',       -- 'low', 'normal', 'high', 'urgent'
    is_back_order BOOLEAN DEFAULT FALSE,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    -- Constraints
    UNIQUE(tenant_id, order_number),
    CONSTRAINT valid_status CHECK (status IN (
        'draft', 'pending_confirmation', 'confirmed', 'processing',
        'packed', 'shipped', 'delivered', 'invoiced', 'cancelled', 'on_hold'
    ))
);

-- Indexes
CREATE INDEX idx_so_tenant_status ON sales_orders(tenant_id, status);
CREATE INDEX idx_so_customer ON sales_orders(tenant_id, customer_id);
CREATE INDEX idx_so_order_date ON sales_orders(tenant_id, order_date DESC);
CREATE INDEX idx_so_platform ON sales_orders(tenant_id, platform);
CREATE INDEX idx_so_reference ON sales_orders(tenant_id, reference_number);
CREATE INDEX idx_so_platform_order ON sales_orders(tenant_id, platform_order_id);
```

### 2. Sales Order Line Items Table

```sql
CREATE TABLE sales_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    
    -- Product Identification
    product_id UUID REFERENCES products(id),
    
    -- Product identifiers at time of order (denormalized for history)
    sku VARCHAR(100),
    product_name VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- Platform-specific identifiers
    asin VARCHAR(20),                            -- Amazon ASIN
    external_id VARCHAR(100),                    -- EAN/UPC barcode
    external_id_type VARCHAR(20),                -- 'EAN', 'UPC', 'SKU'
    
    -- Quantities
    quantity_ordered DECIMAL(15, 3) NOT NULL,
    quantity_confirmed DECIMAL(15, 3),
    quantity_shipped DECIMAL(15, 3) DEFAULT 0,
    quantity_delivered DECIMAL(15, 3) DEFAULT 0,
    quantity_cancelled DECIMAL(15, 3) DEFAULT 0,
    quantity_returned DECIMAL(15, 3) DEFAULT 0,
    quantity_invoiced DECIMAL(15, 3) DEFAULT 0,
    
    -- Unit of Measure
    unit_id UUID REFERENCES units(id),
    unit_symbol VARCHAR(20),
    item_package_quantity INTEGER DEFAULT 1,     -- Units per package
    
    -- Pricing
    list_price DECIMAL(15, 2),                   -- MRP
    unit_price DECIMAL(15, 2) NOT NULL,          -- Selling price
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    discount_percentage DECIMAL(5, 2),
    tax_percentage DECIMAL(5, 2),
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    line_total DECIMAL(15, 2) NOT NULL,
    
    -- Line Item Status
    status VARCHAR(30) DEFAULT 'pending',
    -- Values: pending, confirmed, picking, packed, shipped, delivered, 
    --         invoiced, cancelled, backordered, dropshipped
    
    -- Warehouse & Inventory (to be set during processing)
    warehouse_id UUID,
    bin_location VARCHAR(50),
    lot_number VARCHAR(100),
    serial_numbers TEXT[],                       -- Array of serial numbers
    expiry_date DATE,
    
    -- Fulfillment Details
    is_dropship BOOLEAN DEFAULT FALSE,
    dropship_vendor_id UUID REFERENCES parties(id),
    
    -- Sequence
    line_number INTEGER NOT NULL,
    
    -- Notes
    notes TEXT,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_soi_order ON sales_order_items(sales_order_id);
CREATE INDEX idx_soi_product ON sales_order_items(product_id);
CREATE INDEX idx_soi_sku ON sales_order_items(sku);
CREATE INDEX idx_soi_asin ON sales_order_items(asin);
CREATE INDEX idx_soi_external_id ON sales_order_items(external_id);
```

### 3. Sales Order Status History Table

```sql
CREATE TABLE sales_order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    
    previous_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    
    -- Platform sync info
    synced_to_platform BOOLEAN DEFAULT FALSE,
    platform_sync_time TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_sosh_order ON sales_order_status_history(sales_order_id);
CREATE INDEX idx_sosh_changed_at ON sales_order_status_history(changed_at DESC);
```

### 4. Fulfillment Centers Master Table

```sql
CREATE TABLE fulfillment_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    code VARCHAR(20) NOT NULL,                   -- 'BLR4', 'HKA2'
    name VARCHAR(200) NOT NULL,                  -- 'BENGALURU, KARNATAKA'
    full_name VARCHAR(500),                      -- 'BLR4 - BENGALURU, KARNATAKA'
    
    platform VARCHAR(50),                        -- 'amazon', 'zepto', etc.
    
    address JSONB,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    pincode VARCHAR(20),
    
    contact_name VARCHAR(200),
    contact_phone VARCHAR(50),
    contact_email VARCHAR(200),
    
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id, code, platform)
);

CREATE INDEX idx_fc_tenant ON fulfillment_centers(tenant_id);
CREATE INDEX idx_fc_platform ON fulfillment_centers(tenant_id, platform);
```

---

## 🔄 Status Workflow

```
                              ┌─────────────┐
                              │   DRAFT     │
                              └──────┬──────┘
                                     │ Submit
                                     ▼
                        ┌────────────────────────┐
                        │ PENDING_CONFIRMATION   │◄─── Auto-import from platform
                        └───────────┬────────────┘
                                    │ Confirm
                ┌───────────────────┼───────────────────┐
                │                   ▼                   │
                │           ┌─────────────┐             │
                │           │  CONFIRMED  │             │
                │           └──────┬──────┘             │
                │                  │ Start Processing   │ On Hold
                │                  ▼                    ▼
                │         ┌─────────────────┐    ┌───────────┐
                │         │   PROCESSING    │    │  ON_HOLD  │
                │         └────────┬────────┘    └───────────┘
                │                  │ Pack
                │                  ▼
                │          ┌─────────────┐
                │          │   PACKED    │
                │          └──────┬──────┘
                │                 │ Ship
                │                 ▼
                │          ┌─────────────┐
                │          │   SHIPPED   │
                │          └──────┬──────┘
                │                 │ Deliver
                │                 ▼
                │          ┌─────────────┐
                │          │  DELIVERED  │
                │          └──────┬──────┘
                │                 │ Generate Invoice
                │                 ▼
                │          ┌─────────────┐
                └─────────►│  INVOICED   │
                           └─────────────┘
                                  │
                Cancel (from any state except Invoiced/Delivered)
                                  ▼
                           ┌─────────────┐
                           │  CANCELLED  │
                           └─────────────┘
```

---

## 📦 Missing Product Fields Identified

Based on the Amazon data analysis, the following fields should be added to the Products table:

| Field | Purpose | Example |
|-------|---------|---------|
| `asin` | Amazon Standard Identification Number | `B09NDCMZ1V` |
| `external_id_type` | Type of external barcode | `EAN`, `UPC`, `SKU` |
| `item_package_quantity` | Units per retail package | `1`, `6`, `12` |
| `aggregate_quantity` | Total units in multi-pack | `1`, `5`, `10` |

**Note:** The current Products table already has `ean`, `upc`, `mpn`, `isbn` fields which cover most external ID requirements.

---

## 🖥️ UI Components Design

### 1. Sales Orders List View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Sales Orders                                      [+ New Order] [⋮ Actions]│
├─────────────────────────────────────────────────────────────────────────────┤
│  All Orders ▼   │ Search orders...            │ 📅 Date Range │ 🔍 Advanced │
├─────────────────────────────────────────────────────────────────────────────┤
│  📊 Draft: 5  │  ⏳ Confirmed: 12  │  📦 Shipped: 8  │  ✅ Delivered: 45    │
├─────────────────────────────────────────────────────────────────────────────┤
│ □ │ Date       │ Order#    │ Reference# │ Customer        │ Status    │ Amount│
├───┼────────────┼───────────┼────────────┼─────────────────┼───────────┼───────┤
│ □ │ 11 Jan 26  │ SO-00125  │ 4A57AMNU   │ Amazon BLR4     │ Confirmed │₹45,678│
│ □ │ 11 Jan 26  │ SO-00124  │ 468LHNYD   │ Amazon HBL4     │ Processing│₹23,456│
│ □ │ 10 Jan 26  │ SO-00123  │ 43SN3Y3E   │ Amazon HHR7     │ Packed    │₹12,345│
│ □ │ 10 Jan 26  │ SO-00122  │ Z-12345    │ Zepto Mumbai    │ Shipped   │₹8,999 │
│ □ │ 09 Jan 26  │ SO-00121  │ B-98765    │ Blinkit Delhi   │ Delivered │₹15,678│
└───┴────────────┴───────────┴────────────┴─────────────────┴───────────┴───────┘
                         ◀ 1  2  3  4  5 ▶  │  Showing 1-50 of 234
```

### 2. Sales Order Detail View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ◀ Back │ SO-00125                               [Edit] [📧 Email] [🖨️ Print]│
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─ Status ──────────────────────────────────────────────────────────────┐  │
│  │  [Draft] → [Confirmed ✓] → [Processing] → [Packed] → [Shipped] → [✓] │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ORDER DETAILS                          │  CUSTOMER                         │
│  ─────────────────                      │  ─────────────                     │
│  Order#: SO-00125                       │  Amazon - BLR4                     │
│  Reference#: 4A57AMNU                   │  BLR4 - BENGALURU, KARNATAKA       │
│  Order Date: 11 Jan 2026                │                                    │
│  Expected Shipment: 19 Jan 2026         │  SHIPPING ADDRESS                  │
│  Platform: Amazon                       │  BLR4 Warehouse                    │
│  Vendor Code: NU8FU                     │  Bengaluru, Karnataka              │
│                                         │  India - 560001                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  LINE ITEMS                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Product           │ ASIN/SKU      │ Ordered │ Confirmed │ Rate  │ Amount │
│  ├───────────────────┼───────────────┼─────────┼───────────┼───────┼────────┤
│  │ White Quinoa 1Kg  │ B09NDCMZ1V    │ 3695    │ 3695      │₹196.49│₹7,26,030│
│  │ SKU: NOURY02      │ 8908005459804 │         │           │       │        │
│  ├───────────────────┼───────────────┼─────────┼───────────┼───────┼────────┤
│  │ Chia Seeds 1Kg    │ B0C7HF4696    │ 113     │ 113       │₹380.49│₹43,000 │
│  │ SKU: BL_Chia_1    │ 8908022410017 │         │           │       │        │
│  └───────────────────┴───────────────┴─────────┴───────────┴───────┴────────┘
├─────────────────────────────────────────────────────────────────────────────┤
│                                                    Sub Total:    ₹7,69,030  │
│                                                    Discount:         -₹0.00 │
│                                                    Shipping:         ₹0.00  │
│                                                    ──────────────────────── │
│                                                    TOTAL:        ₹7,69,030  │
├─────────────────────────────────────────────────────────────────────────────┤
│  WHAT'S NEXT?                                                               │
│  [▶ Start Processing] [📦 Create Package] [🚚 Create Shipment] [📄 Invoice] │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3. Create/Edit Sales Order Form (Drawer)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ✕  New Sales Order                                              [Save] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ORDER SOURCE                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ○ Manual Entry   ○ Import from Platform                              │   │
│  │ Platform: [Amazon ▼]   Reference#: [4A57AMNU        ]                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  CUSTOMER / PLATFORM                                                        │
│  [Search or select customer...                              ▼] [+ Add New] │
│                                                                             │
│  ┌─ DATES ────────────────────────────────────────────────────────────┐    │
│  │ Order Date: [11/01/2026]  Expected Ship: [19/01/2026]              │    │
│  │ Delivery Window: [12/01/2026] to [25/01/2026]                      │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  SHIPPING DETAILS                                                           │
│  Fulfillment Center: [BLR4 - BENGALURU, KARNATAKA     ▼]                   │
│  Freight Terms: [Prepaid ▼]   Payment Method: [Invoice ▼]                  │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  LINE ITEMS                                              [+ Add Product]    │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ # │ Product                    │ Qty    │ Rate     │ Discount │ Total  │ │
│  ├───┼────────────────────────────┼────────┼──────────┼──────────┼────────┤ │
│  │ 1 │ White Quinoa Seeds 1Kg     │ [3695] │ [196.49] │ [0%   ]  │726,030 │ │
│  │   │ ASIN: B09NDCMZ1V           │        │          │          │  [🗑️]  │ │
│  ├───┼────────────────────────────┼────────┼──────────┼──────────┼────────┤ │
│  │ 2 │ [Search product...      ▼] │ [   ]  │ [      ] │ [     ]  │        │ │
│  └───┴────────────────────────────┴────────┴──────────┴──────────┴────────┘ │
│                                                                             │
│  ┌─ TOTALS ───────────────────────────────────────────────────────────┐    │
│  │                                           Sub Total:    ₹7,26,030   │    │
│  │ Discount: [0.00        ] [Fixed ▼]        Discount:         -₹0.00  │    │
│  │ Shipping: [0.00        ]                  Shipping:         ₹0.00   │    │
│  │ Adjustment: [0.00      ] [__________]     Adjustment:       ₹0.00   │    │
│  │                                           ═══════════════════════   │    │
│  │                                           TOTAL:        ₹7,26,030   │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  NOTES                                                                      │
│  [                                                                    ]     │
│                                                                             │
│  TERMS & CONDITIONS                                                         │
│  [                                                                    ]     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔗 API Endpoints Design

### Sales Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/sales-orders/` | List all sales orders with filters |
| `GET` | `/api/v1/sales-orders/{id}` | Get sales order by ID |
| `POST` | `/api/v1/sales-orders/` | Create new sales order |
| `PUT` | `/api/v1/sales-orders/{id}` | Update sales order |
| `DELETE` | `/api/v1/sales-orders/{id}` | Delete/void sales order |
| `GET` | `/api/v1/sales-orders/{id}/items` | Get line items |
| `POST` | `/api/v1/sales-orders/{id}/items` | Add line item |
| `PUT` | `/api/v1/sales-orders/{id}/items/{item_id}` | Update line item |
| `DELETE` | `/api/v1/sales-orders/{id}/items/{item_id}` | Remove line item |

### Status Transitions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/sales-orders/{id}/confirm` | Confirm order |
| `POST` | `/api/v1/sales-orders/{id}/process` | Start processing |
| `POST` | `/api/v1/sales-orders/{id}/pack` | Mark as packed |
| `POST` | `/api/v1/sales-orders/{id}/ship` | Mark as shipped |
| `POST` | `/api/v1/sales-orders/{id}/deliver` | Mark as delivered |
| `POST` | `/api/v1/sales-orders/{id}/cancel` | Cancel order |
| `POST` | `/api/v1/sales-orders/{id}/hold` | Put on hold |
| `POST` | `/api/v1/sales-orders/{id}/resume` | Resume from hold |

### Reports & Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/sales-orders/stats/summary` | Dashboard stats |
| `GET` | `/api/v1/sales-orders/stats/by-platform` | Orders by platform |
| `GET` | `/api/v1/sales-orders/stats/by-status` | Orders by status |
| `GET` | `/api/v1/sales-orders/export/csv` | Export to CSV |

### Platform Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/sales-orders/import/amazon` | Import Amazon PO |
| `POST` | `/api/v1/sales-orders/import/file` | Import from Excel/CSV |
| `POST` | `/api/v1/sales-orders/{id}/sync` | Sync status to platform |

---

## 🔄 Integration with Other Modules

### 1. Inventory Module Integration

When a Sales Order is **confirmed**:
```
Sales Order Confirmed
        │
        ▼
    ┌───────────────────────────────────┐
    │ Inventory Service                  │
    │ - Reserve stock for order          │
    │ - Check availability               │
    │ - Update "committed" quantity      │
    └───────────────────────────────────┘
        │
        ▼
When order is **shipped/delivered**:
    ┌───────────────────────────────────┐
    │ Inventory Service                  │
    │ - Deduct actual stock              │
    │ - Create inventory movement        │
    │ - Update stock levels              │
    └───────────────────────────────────┘
```

### 2. Outbox Pattern for Events

Every status change triggers an outbox event:

```sql
-- Sample outbox event for sales order
{
    "aggregate_type": "sales_order",
    "aggregate_id": "uuid-of-order",
    "event_type": "SalesOrderConfirmed",
    "operation": "status_change",
    "payload": {
        "order_number": "SO-00125",
        "previous_status": "draft",
        "new_status": "confirmed",
        "line_items": [...],
        "total_amount": 769030.00
    }
}
```

---

## 📋 Implementation Phases

### Phase 1: Core Sales Order (Week 1)
- [ ] Database schema creation
- [ ] Basic CRUD API endpoints
- [ ] Sales order list UI
- [ ] Create/Edit drawer form

### Phase 2: Status Workflow (Week 1-2)
- [ ] Status transition API
- [ ] Status history tracking
- [ ] Outbox events for status changes
- [ ] UI status workflow visualization

### Phase 3: Line Items & Pricing (Week 2)
- [ ] Line items management
- [ ] Product search in order form
- [ ] Price calculations
- [ ] Discounts and adjustments

### Phase 4: Platform Integration (Week 3)
- [ ] Excel/CSV import functionality
- [ ] Platform-specific field mapping
- [ ] Fulfillment centers master
- [ ] Amazon PO import

### Phase 5: Reports & Dashboard (Week 3-4)
- [ ] Sales order statistics
- [ ] Dashboard widgets
- [ ] Export functionality
- [ ] Advanced search and filters

---

## ✅ Approval Checklist

Please confirm the following before implementation:

1. **Database Schema** - Is the schema design appropriate?
2. **Status Workflow** - Are all statuses needed? Any missing?
3. **UI Design** - Does the UI layout meet expectations?
4. **API Design** - Are all endpoints covered?
5. **Platform Fields** - Any platform-specific fields missing?
6. **Priority** - Which phase should we start with?

---

## 📝 Notes

- This design supports multi-platform orders (Amazon, Zepto, Blinkit, manual)
- All amounts are stored in the smallest currency unit (paisa) or as DECIMAL
- Platform-specific metadata is stored in JSONB for flexibility
- The outbox pattern ensures all changes are captured for analytics/AI
- Inventory integration will be a separate service with event-driven updates




