# Pydantic Models for Master Service

# Category models
from .category import CategoryCreate, CategoryUpdate, CategoryResponse, CategoryListResponse, CategoryTreeResponse

# Unit models
from .unit import UnitCreate, UnitUpdate, UnitResponse, UnitListResponse, PREDEFINED_UNITS

# Legacy Item models (for backward compatibility)
from .item import ItemCreate, ItemUpdate, ItemResponse, ItemListResponse, ItemImportResult

# Product models (new - replaces items)
from .product import (
    ProductCreate, ProductUpdate, ProductResponse, ProductListResponse, ProductImportResult,
    BrandCreate, BrandUpdate, BrandResponse, BrandListResponse,
    ManufacturerCreate, ManufacturerUpdate, ManufacturerResponse, ManufacturerListResponse,
)

# Bundle models
from .bundle import (
    ProductBundleCreate, ProductBundleUpdate, ProductBundleResponse, ProductBundleListResponse,
    BundleComponentCreate, BundleComponentUpdate, BundleComponentResponse,
    ProductBundleSummary, BundleCostBreakdown,
)

# Production models
from .production import (
    ProductionOrderCreate, ProductionOrderUpdate, ProductionOrderResponse, ProductionOrderListResponse,
    ProductionOrderStatusUpdate, ProductionOrderSummary,
    ProductionComponentCreate, ProductionComponentResponse,
    ProductionHistoryEntry, ProductionHistoryResponse,
    StartProductionRequest, CompleteProductionRequest, CancelProductionRequest, ConsumeComponentRequest,
)

# Party models
from .party import PartyCreate, PartyUpdate, PartyResponse, PartyListResponse, PartyType

# Outbox models (Event Sourcing)
from .outbox import (
    OutboxEventResponse, OutboxEventListResponse, OutboxEventCreate,
    EventSummary, EventSummaryResponse, EventStatistics,
    MarkEventsProcessedRequest, MarkEventsProcessedResponse,
    ArchiveEventsRequest, ArchiveEventsResponse, EntityTimeline,
    EventStatus, EventOperation, EventSource, EventQueryParams,
)

# Sales Order models
from .sales_order import (
    SalesOrderStatus, LineItemStatus, Platform, Priority, DiscountType,
    Address,
    FulfillmentCenterCreate, FulfillmentCenterUpdate, FulfillmentCenter, FulfillmentCenterListResponse,
    SalesOrderItemCreate, SalesOrderItemUpdate, SalesOrderItem,
    SalesOrderCreate, SalesOrderUpdate, SalesOrder, SalesOrderListResponse, SalesOrderSummary,
    SalesOrderStatusHistory, SalesOrderStats, SalesOrderStatsByPlatform, SalesOrderStatsByStatus,
)

__all__ = [
    # Categories
    "CategoryCreate", "CategoryUpdate", "CategoryResponse", "CategoryListResponse", "CategoryTreeResponse",
    # Units
    "UnitCreate", "UnitUpdate", "UnitResponse", "UnitListResponse", "PREDEFINED_UNITS",
    # Legacy Items
    "ItemCreate", "ItemUpdate", "ItemResponse", "ItemListResponse", "ItemImportResult",
    # Products
    "ProductCreate", "ProductUpdate", "ProductResponse", "ProductListResponse", "ProductImportResult",
    "BrandCreate", "BrandUpdate", "BrandResponse", "BrandListResponse",
    "ManufacturerCreate", "ManufacturerUpdate", "ManufacturerResponse", "ManufacturerListResponse",
    # Bundles
    "ProductBundleCreate", "ProductBundleUpdate", "ProductBundleResponse", "ProductBundleListResponse",
    "BundleComponentCreate", "BundleComponentUpdate", "BundleComponentResponse",
    "ProductBundleSummary", "BundleCostBreakdown",
    # Production
    "ProductionOrderCreate", "ProductionOrderUpdate", "ProductionOrderResponse", "ProductionOrderListResponse",
    "ProductionOrderStatusUpdate", "ProductionOrderSummary",
    "ProductionComponentCreate", "ProductionComponentResponse",
    "ProductionHistoryEntry", "ProductionHistoryResponse",
    "StartProductionRequest", "CompleteProductionRequest", "CancelProductionRequest", "ConsumeComponentRequest",
    # Parties
    "PartyCreate", "PartyUpdate", "PartyResponse", "PartyListResponse", "PartyType",
    # Outbox (Event Sourcing)
    "OutboxEventResponse", "OutboxEventListResponse", "OutboxEventCreate",
    "EventSummary", "EventSummaryResponse", "EventStatistics",
    "MarkEventsProcessedRequest", "MarkEventsProcessedResponse",
    "ArchiveEventsRequest", "ArchiveEventsResponse", "EntityTimeline",
    "EventStatus", "EventOperation", "EventSource", "EventQueryParams",
    # Sales Orders
    "SalesOrderStatus", "LineItemStatus", "Platform", "Priority", "DiscountType",
    "Address",
    "FulfillmentCenterCreate", "FulfillmentCenterUpdate", "FulfillmentCenter", "FulfillmentCenterListResponse",
    "SalesOrderItemCreate", "SalesOrderItemUpdate", "SalesOrderItem",
    "SalesOrderCreate", "SalesOrderUpdate", "SalesOrder", "SalesOrderListResponse", "SalesOrderSummary",
    "SalesOrderStatusHistory", "SalesOrderStats", "SalesOrderStatsByPlatform", "SalesOrderStatsByStatus",
]


