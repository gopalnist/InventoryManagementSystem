"""
Nourish IMS Adapter
Connects AMS to our internal IMS (master-service)
"""
import httpx
from typing import Optional, List
from .ims_interface import (
    IMSAdapterInterface, 
    InventoryResult, 
    ReservationResult, 
    SalesOrderItem, 
    SalesOrderResult
)


class NourishIMSAdapter(IMSAdapterInterface):
    """
    Adapter for Nourish IMS (our internal inventory management system).
    Calls the master-service API for products/inventory and 
    sales-service API for sales orders.
    """
    
    def __init__(
        self, 
        base_url: str = "http://localhost:8001",  # Master service for products/inventory
        sales_url: str = "http://localhost:8002",  # Sales service for orders
        tenant_id: str = None
    ):
        self.base_url = base_url
        self.sales_url = sales_url
        self.tenant_id = tenant_id or "00000000-0000-0000-0000-000000000001"
        self.headers = {
            "Content-Type": "application/json",
            "X-Tenant-ID": self.tenant_id
        }
    
    def get_inventory(self, sku_code: str, warehouse_id: Optional[int] = None) -> Optional[InventoryResult]:
        """Query inventory from IMS."""
        try:
            # For now, we'll query products and assume inventory tracking
            # In a real implementation, IMS would have an inventory endpoint
            with httpx.Client(timeout=10.0) as client:
                response = client.get(
                    f"{self.base_url}/api/v1/products",
                    params={"search": sku_code, "limit": 1},
                    headers=self.headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    products = data.get("products", [])
                    if products:
                        product = products[0]
                        # Return inventory info from product
                        return InventoryResult(
                            sku_code=product.get("sku", sku_code),
                            available_qty=float(product.get("opening_stock", 0)),
                            on_hand_qty=float(product.get("opening_stock", 0)),
                            reserved_qty=0,
                            warehouse_id=None,
                            warehouse_code=None
                        )
                return None
        except Exception as e:
            print(f"Error querying IMS inventory: {e}")
            return None
    
    def reserve_stock(
        self, 
        sku_code: str, 
        quantity: float, 
        reference_type: str,
        reference_id: int,
        warehouse_id: Optional[int] = None
    ) -> ReservationResult:
        """Reserve stock in IMS."""
        # Note: For full implementation, IMS would need a /inventory/reserve endpoint
        # For now, we'll just return success and rely on sales order creation
        return ReservationResult(
            success=True,
            message="Reservation tracked in AMS, will be reflected in Sales Order"
        )
    
    def release_reservation(
        self,
        sku_code: str,
        quantity: float,
        reference_type: str,
        reference_id: int,
        warehouse_id: Optional[int] = None
    ) -> ReservationResult:
        """Release reservation in IMS."""
        return ReservationResult(
            success=True,
            message="Reservation released"
        )
    
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
        Create a sales order in Nourish IMS.
        Calls POST /api/v1/sales-orders
        """
        try:
            # Build the sales order payload
            payload = {
                "order_number": order_number,
                "reference_number": order_number,
                "platform": platform,
                "status": "confirmed",  # Already validated by AMS
                "customer_id": customer_id,
                "notes": f"Created from AMS. FC: {fc_code or 'N/A'}. {notes or ''}",
                "items": [
                    {
                        "sku": item.sku_code,
                        "quantity": item.quantity,
                        "unit_price": item.unit_price or 0
                    }
                    for item in items
                    if item.line_status in ('FULFILLED', 'PARTIAL')  # Only fulfilled items
                ]
            }
            
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    f"{self.sales_url}/api/v1/sales-orders/from-ams",
                    json=payload,
                    headers=self.headers
                )
                
                if response.status_code in (200, 201):
                    data = response.json()
                    return SalesOrderResult(
                        success=True,
                        sales_order_id=data.get("id"),
                        order_number=data.get("order_number"),
                        message="Sales order created in IMS"
                    )
                else:
                    return SalesOrderResult(
                        success=False,
                        message=f"IMS returned {response.status_code}: {response.text}"
                    )
                    
        except Exception as e:
            return SalesOrderResult(
                success=False,
                message=f"Error creating sales order in IMS: {str(e)}"
            )
    
    def update_sales_order_status(
        self,
        order_id: int,
        status: str
    ) -> SalesOrderResult:
        """Update sales order status in IMS."""
        try:
            with httpx.Client(timeout=10.0) as client:
                response = client.post(
                    f"{self.sales_url}/api/v1/sales-orders/{order_id}/status",
                    json={"status": status},
                    headers=self.headers
                )
                
                if response.status_code == 200:
                    return SalesOrderResult(success=True, sales_order_id=order_id)
                else:
                    return SalesOrderResult(
                        success=False,
                        message=f"Failed to update status: {response.text}"
                    )
        except Exception as e:
            return SalesOrderResult(
                success=False,
                message=f"Error updating status: {str(e)}"
            )

