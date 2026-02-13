"""
IMS Adapter Interface
Abstract base class for all IMS adapters (Internal, Zoho, SAP, etc.)
"""
from abc import ABC, abstractmethod
from typing import Optional, List
from dataclasses import dataclass


@dataclass
class InventoryResult:
    """Result of inventory query."""
    sku_code: str
    available_qty: float
    on_hand_qty: float
    reserved_qty: float
    warehouse_id: Optional[int] = None
    warehouse_code: Optional[str] = None


@dataclass
class ReservationResult:
    """Result of stock reservation."""
    success: bool
    reservation_id: Optional[int] = None
    message: Optional[str] = None


@dataclass
class SalesOrderItem:
    """Line item for sales order."""
    sku_code: str
    quantity: float
    unit_price: Optional[float] = None
    line_status: Optional[str] = None  # FULFILLED, PARTIAL, NONE


@dataclass
class SalesOrderResult:
    """Result of sales order creation."""
    success: bool
    sales_order_id: Optional[int] = None
    order_number: Optional[str] = None
    message: Optional[str] = None


class IMSAdapterInterface(ABC):
    """
    Abstract base class for IMS adapters.
    
    Implementations:
    - InternalAdapter: Uses AMS's own database
    - NourishIMSAdapter: Calls our IMS API
    - ZohoAdapter: Calls Zoho API (future)
    """
    
    @abstractmethod
    def get_inventory(self, sku_code: str, warehouse_id: Optional[int] = None) -> Optional[InventoryResult]:
        """
        Get inventory for a SKU.
        
        Args:
            sku_code: The SKU code to look up
            warehouse_id: Optional specific warehouse
            
        Returns:
            InventoryResult with availability info, or None if not found
        """
        pass
    
    @abstractmethod
    def reserve_stock(
        self, 
        sku_code: str, 
        quantity: float, 
        reference_type: str,
        reference_id: int,
        warehouse_id: Optional[int] = None
    ) -> ReservationResult:
        """
        Reserve stock for an order.
        
        Args:
            sku_code: The SKU to reserve
            quantity: Quantity to reserve
            reference_type: e.g., "PURCHASE_ORDER"
            reference_id: ID of the referencing document
            warehouse_id: Optional specific warehouse
            
        Returns:
            ReservationResult with success status
        """
        pass
    
    @abstractmethod
    def release_reservation(
        self,
        sku_code: str,
        quantity: float,
        reference_type: str,
        reference_id: int,
        warehouse_id: Optional[int] = None
    ) -> ReservationResult:
        """
        Release a stock reservation (e.g., on order cancellation).
        """
        pass
    
    @abstractmethod
    def create_sales_order(
        self,
        order_number: str,
        platform: str,
        items: List[SalesOrderItem],
        customer_id: Optional[int] = None,
        fc_code: Optional[str] = None,
        notes: Optional[str] = None
    ) -> SalesOrderResult:
        """
        Create a sales order in IMS.
        
        Args:
            order_number: PO/Order number from channel
            platform: e.g., "amazon", "zepto"
            items: List of line items
            customer_id: Optional customer ID
            fc_code: Fulfillment center code
            notes: Optional notes
            
        Returns:
            SalesOrderResult with order ID
        """
        pass
    
    @abstractmethod
    def update_sales_order_status(
        self,
        order_id: int,
        status: str
    ) -> SalesOrderResult:
        """
        Update sales order status in IMS.
        """
        pass


