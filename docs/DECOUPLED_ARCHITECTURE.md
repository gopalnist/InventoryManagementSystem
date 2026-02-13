# Decoupled Architecture: IMS + AMS + VMS

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                               EXTERNAL SYSTEMS                                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  Amazon       Zepto      Instamart    BigBasket    Blinkit                          │
│    │            │            │            │           │                              │
│    └────────────┴────────────┴────────────┴───────────┘                              │
│                              │                                                       │
│                              ▼                                                       │
│                      [ Purchase Orders ]                                             │
└─────────────────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        VMS (Vendor Order System)                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  Responsibilities:                                                            │    │
│  │  - Receive & parse POs from all platforms                                     │    │
│  │  - Normalize PO data to internal format                                       │    │
│  │  - Manage order lifecycle (DRAFT → CONFIRMED → SHIPPED → DELIVERED)          │    │
│  │  - Track order status, generate invoices                                      │    │
│  │  - Communicate with platforms (accept/reject/ship notifications)              │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                       │
│  Port: 8002 (sales-service)                                                          │
│  Database: vms_db (or shared)                                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘
            │                                    ▲
            │ 1. Request allocation              │ 4. Allocation result
            ▼                                    │
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                     AMS (Allocation Management System)                               │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  Responsibilities:                                                            │    │
│  │  - Validate stock availability for incoming orders                            │    │
│  │  - Determine allocation: FULFILLED / PARTIAL / NONE                           │    │
│  │  - Reserve inventory (decrement available, increment reserved)                │    │
│  │  - Release reservations on order cancellation                                 │    │
│  │  - SKU mapping: EAN/ASIN → Internal SKU                                       │    │
│  │  - Warehouse → Fulfillment Center mapping                                      │    │
│  │  - Multi-warehouse allocation strategy                                        │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                       │
│  Port: 8003 (allocation-service)                                                     │
│  Database: ams_db (or shared)                                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘
            │                                    ▲
            │ 2. Query/Reserve inventory         │ 3. Inventory data
            ▼                                    │
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    IMS (Inventory Management System)                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  Responsibilities:                                                            │    │
│  │  - Master data: Products, SKUs, Categories, Units                             │    │
│  │  - Inventory levels: on_hand_qty, reserved_qty, available_qty                 │    │
│  │  - Warehouses & Locations                                                     │    │
│  │  - Stock transactions (receipt, adjustment, transfer)                         │    │
│  │  - Production/BOM management                                                  │    │
│  │  - Inventory valuation                                                        │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                       │
│  Port: 8001 (master-service) OR External (Zoho, etc.)                                │
│  Database: ims_db (or Zoho API)                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## API Contracts Between Systems

### 1. AMS ↔ IMS Interface (Inventory Service Interface)

The AMS should communicate with IMS through a **well-defined interface** that can be implemented by:
- **InternalInventoryAdapter**: Talks to your own IMS database
- **ZohoInventoryAdapter**: Talks to Zoho Inventory API
- **OtherThirdPartyAdapter**: Any other system

```python
# allocation-service/app/adapters/inventory_interface.py

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class InventoryLevel:
    """Inventory level for a SKU at a location."""
    sku_code: str
    warehouse_code: str
    on_hand_qty: float
    reserved_qty: float
    available_qty: float  # on_hand - reserved


@dataclass
class ReservationRequest:
    """Request to reserve inventory."""
    reference_type: str  # 'SALES_ORDER', 'PURCHASE_ORDER'
    reference_id: str
    sku_code: str
    warehouse_code: str
    quantity: float


@dataclass
class ReservationResult:
    """Result of a reservation attempt."""
    success: bool
    reservation_id: Optional[str]
    reserved_qty: float
    shortfall_qty: float
    error_message: Optional[str]


class InventoryServiceInterface(ABC):
    """
    Abstract interface for inventory operations.
    Implement this for different inventory backends:
    - InternalInventoryAdapter (your own PostgreSQL)
    - ZohoInventoryAdapter (Zoho API)
    - ExternalInventoryAdapter (any third-party)
    """

    @abstractmethod
    async def get_inventory_levels(
        self,
        sku_codes: List[str],
        warehouse_codes: Optional[List[str]] = None
    ) -> List[InventoryLevel]:
        """Get current inventory levels for SKUs."""
        pass

    @abstractmethod
    async def check_availability(
        self,
        sku_code: str,
        required_qty: float,
        warehouse_codes: Optional[List[str]] = None
    ) -> tuple[bool, float]:  # (is_available, available_qty)
        """Check if required quantity is available."""
        pass

    @abstractmethod
    async def reserve_inventory(
        self,
        request: ReservationRequest
    ) -> ReservationResult:
        """Reserve inventory for an order."""
        pass

    @abstractmethod
    async def release_reservation(
        self,
        reservation_id: str
    ) -> bool:
        """Release a previously made reservation."""
        pass

    @abstractmethod
    async def commit_reservation(
        self,
        reservation_id: str
    ) -> bool:
        """Convert reservation to actual stock deduction (on shipment)."""
        pass
```

### 2. VMS → AMS Interface (Allocation Request/Response)

```python
# VMS sends allocation request to AMS

@dataclass
class AllocationRequest:
    """Request from VMS to AMS for order allocation."""
    vendor_code: str
    order_type: str  # 'SALES_ORDER', 'PURCHASE_ORDER'
    order_id: str
    order_number: str
    platform: str  # 'amazon', 'zepto', 'instamart', etc.
    fulfillment_center_code: Optional[str]
    line_items: List[AllocationLineItem]


@dataclass
class AllocationLineItem:
    line_number: str
    channel_item_id_type: str  # 'EAN', 'ASIN', 'FSN', 'SKU'
    channel_item_id: str
    item_name: str
    requested_qty: float


@dataclass
class AllocationResponse:
    """Response from AMS to VMS."""
    order_id: str
    allocation_status: str  # 'FULFILLED', 'PARTIAL_FULFILLED', 'NONE', 'FAILED'
    allocation_id: Optional[str]  # For tracking/releasing later
    line_results: List[AllocationLineResult]
    error_message: Optional[str]


@dataclass
class AllocationLineResult:
    line_number: str
    internal_sku_code: Optional[str]  # Resolved SKU
    matched_by: Optional[str]  # 'ean', 'asin', 'sku_alias', 'direct_sku'
    requested_qty: float
    available_qty: float
    allocated_qty: float
    unallocated_qty: float
    line_status: str  # 'FULFILLED', 'PARTIAL_FULFILLED', 'NONE', 'SKU_NOT_FOUND'
    reason: Optional[str]
    warehouse_code: Optional[str]
```

---

## Sequence Diagrams

### Order Confirmation Flow

```
┌─────────┐          ┌─────────┐          ┌─────────┐
│   VMS   │          │   AMS   │          │   IMS   │
└────┬────┘          └────┬────┘          └────┬────┘
     │                    │                    │
     │  1. Order Imported │                    │
     │  (status: DRAFT)   │                    │
     │                    │                    │
     │  2. User clicks    │                    │
     │     "Confirm"      │                    │
     │                    │                    │
     │ ──────────────────►│                    │
     │  3. POST /allocate │                    │
     │  {order_id, items} │                    │
     │                    │                    │
     │                    │ ──────────────────►│
     │                    │ 4. Resolve SKUs    │
     │                    │    (EAN→SKU)       │
     │                    │                    │
     │                    │ ◄──────────────────│
     │                    │ 5. SKU mappings    │
     │                    │                    │
     │                    │ ──────────────────►│
     │                    │ 6. Check inventory │
     │                    │    GET /inventory  │
     │                    │                    │
     │                    │ ◄──────────────────│
     │                    │ 7. Inventory levels│
     │                    │                    │
     │                    │ ──────────────────►│
     │                    │ 8. Reserve stock   │
     │                    │    POST /reserve   │
     │                    │                    │
     │                    │ ◄──────────────────│
     │                    │ 9. Reservation OK  │
     │                    │                    │
     │ ◄──────────────────│                    │
     │ 10. AllocationResp │                    │
     │  {status: FULFILLED│                    │
     │   allocation_id}   │                    │
     │                    │                    │
     │ 11. Update order   │                    │
     │  status: CONFIRMED │                    │
     │  allocation_id: X  │                    │
     │                    │                    │
```

### Order Cancellation Flow

```
┌─────────┐          ┌─────────┐          ┌─────────┐
│   VMS   │          │   AMS   │          │   IMS   │
└────┬────┘          └────┬────┘          └────┬────┘
     │                    │                    │
     │ 1. User cancels    │                    │
     │    order           │                    │
     │                    │                    │
     │ ──────────────────►│                    │
     │ 2. POST /release   │                    │
     │ {allocation_id}    │                    │
     │                    │                    │
     │                    │ ──────────────────►│
     │                    │ 3. Release stock   │
     │                    │ DELETE /reserve/X  │
     │                    │                    │
     │                    │ ◄──────────────────│
     │                    │ 4. Stock released  │
     │                    │                    │
     │ ◄──────────────────│                    │
     │ 5. Release OK      │                    │
     │                    │                    │
     │ 6. Update order    │                    │
     │ status: CANCELLED  │                    │
     │                    │                    │
```

---

## Directory Structure

```
/VendorManagmentSystem/                    # Rename to AllocationManagementSystem
├── allocation_service/                    # New: Microservice wrapper
│   ├── app/
│   │   ├── main.py                       # FastAPI app
│   │   ├── config.py
│   │   ├── api/
│   │   │   ├── allocation.py             # POST /allocate, POST /release
│   │   │   └── health.py
│   │   ├── adapters/
│   │   │   ├── inventory_interface.py    # Abstract interface
│   │   │   ├── internal_adapter.py       # Your PostgreSQL IMS
│   │   │   └── zoho_adapter.py           # Zoho API (future)
│   │   └── models/
│   │       └── allocation.py
│   └── requirements.txt
│
├── vms_core/                              # Existing: Core allocation logic
│   ├── po_validate.py                    # validate_and_reserve_po()
│   ├── po_cancel.py                      # release allocations
│   ├── adapters/                         # PO parsers
│   └── types.py
│
├── vms_web/                               # Existing: Web UI
│   └── app.py
│
└── db/
    └── schema.sql


/InventoryManagementSystem/
├── services/
│   ├── master-service/                   # IMS (port 8001)
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── inventory.py          # Inventory CRUD + reservation API
│   │   │   │   └── ...
│   │   │   └── main.py
│   │   └── ...
│   │
│   └── sales-service/                    # VMS (port 8002)
│       ├── app/
│       │   ├── api/
│       │   │   ├── sales_orders.py
│       │   │   └── sales_order_import.py
│       │   └── main.py
│       └── ...
│
└── frontend/                              # React UI
```

---

## Implementation Plan

### Phase 1: Create Inventory Interface in AMS (Week 1)

1. **Create abstract interface** (`InventoryServiceInterface`)
2. **Implement InternalInventoryAdapter** (uses existing VMS database tables)
3. **Expose AMS as microservice** (`allocation_service/app/main.py`)
   - `POST /api/v1/allocation/allocate` - Request allocation
   - `POST /api/v1/allocation/release` - Release allocation
   - `GET /api/v1/allocation/{allocation_id}` - Get allocation status

### Phase 2: Integrate VMS with AMS (Week 2)

1. **Update VMS (sales-service)**:
   - On "Confirm Order": Call AMS `/allocate` endpoint
   - Store `allocation_id` on sales order
   - On "Cancel Order": Call AMS `/release` endpoint

2. **Add allocation status to Sales Order UI**:
   - Show allocation result (FULFILLED/PARTIAL/NONE)
   - Show allocated vs unallocated quantities per line

### Phase 3: Create Zoho Adapter (When needed)

1. **Implement ZohoInventoryAdapter**:
   ```python
   class ZohoInventoryAdapter(InventoryServiceInterface):
       async def get_inventory_levels(self, sku_codes, warehouse_codes):
           # Call Zoho API: GET /inventory/items
           pass

       async def reserve_inventory(self, request):
           # Option 1: Zoho Inventory Adjustments API
           # Option 2: Zoho Sales Orders API
           pass
   ```

2. **Configuration-based adapter selection**:
   ```python
   # config.py
   INVENTORY_BACKEND = os.getenv("INVENTORY_BACKEND", "internal")  # or "zoho"

   # factory.py
   def get_inventory_adapter():
       if INVENTORY_BACKEND == "zoho":
           return ZohoInventoryAdapter(api_key=ZOHO_API_KEY)
       return InternalInventoryAdapter(db_config=get_db_config())
   ```

---

## API Endpoints Summary

### AMS (Allocation Management System) - Port 8003

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/allocation/allocate` | Request allocation for an order |
| POST | `/api/v1/allocation/release/{allocation_id}` | Release allocation |
| GET | `/api/v1/allocation/{allocation_id}` | Get allocation details |
| POST | `/api/v1/allocation/commit/{allocation_id}` | Commit (on shipment) |

### IMS (Inventory Management System) - Port 8001

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/inventory` | Get inventory levels |
| GET | `/api/v1/inventory/{sku_code}` | Get inventory for SKU |
| POST | `/api/v1/inventory/reserve` | Reserve inventory |
| DELETE | `/api/v1/inventory/reserve/{reservation_id}` | Release reservation |
| POST | `/api/v1/inventory/commit/{reservation_id}` | Commit reservation |

### VMS (Vendor Order System) - Port 8002

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/sales-orders` | Create order |
| GET | `/api/v1/sales-orders/{id}` | Get order details |
| POST | `/api/v1/sales-orders/{id}/confirm` | Confirm order (calls AMS) |
| POST | `/api/v1/sales-orders/{id}/cancel` | Cancel order (calls AMS) |
| POST | `/api/v1/sales-orders/{id}/ship` | Ship order (commits allocation) |

---

## Benefits of This Architecture

1. **Loose Coupling**: Each system has a single responsibility
2. **Easy Third-Party Integration**: Just implement a new adapter
3. **Testability**: Mock the inventory interface for testing
4. **Scalability**: Each service can scale independently
5. **Flexibility**: Switch from internal IMS to Zoho without changing AMS/VMS

---

## Next Steps

1. **Rename VendorManagmentSystem → AllocationManagementSystem**
2. **Create `allocation_service/` microservice wrapper**
3. **Implement `InventoryServiceInterface` + `InternalInventoryAdapter`**
4. **Update VMS (sales-service) to call AMS on confirm/cancel**
5. **Test end-to-end flow**

Would you like me to start implementing this?


