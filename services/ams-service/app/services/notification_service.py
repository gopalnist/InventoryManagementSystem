"""
Notification Service for AMS
Handles sending notifications to IMS (API, Email, Manual)
"""
import httpx
from typing import Optional, List
from dataclasses import dataclass
from enum import Enum
import json


class NotificationMethod(str, Enum):
    API = "API"
    EMAIL = "EMAIL"
    MANUAL = "MANUAL"


@dataclass
class OrderItem:
    """Item in a reservation notification."""
    sku_code: str
    quantity: float
    unit_price: Optional[float] = None
    line_status: Optional[str] = None


@dataclass
class NotificationResult:
    """Result of notification attempt."""
    success: bool
    method: str
    message: Optional[str] = None
    ims_order_id: Optional[str] = None
    ims_order_number: Optional[str] = None


class NotificationService:
    """
    Service to notify IMS about reserved orders.
    Supports multiple notification methods:
    - API: Direct API call to IMS
    - EMAIL: Send email notification (to be implemented)
    - MANUAL: No notification, just mark for manual confirmation
    """
    
    def __init__(self, tenant_id: str, notification_method: str, ims_config: dict):
        self.tenant_id = tenant_id
        self.method = NotificationMethod(notification_method)
        self.config = ims_config
    
    def notify_reservation(
        self,
        po_number: str,
        channel: str,
        items: List[OrderItem],
        fulfillment_status: str,
        fc_code: Optional[str] = None,
        notes: Optional[str] = None
    ) -> NotificationResult:
        """
        Send notification to IMS about a reserved order.
        
        Args:
            po_number: The PO number
            channel: Channel (amazon, zepto, etc.)
            items: List of order items with SKU and quantity
            fulfillment_status: FULFILLED, PARTIAL, or NONE
            fc_code: Fulfillment center code
            notes: Additional notes
            
        Returns:
            NotificationResult with success status
        """
        if self.method == NotificationMethod.API:
            return self._notify_via_api(po_number, channel, items, fulfillment_status, fc_code, notes)
        elif self.method == NotificationMethod.EMAIL:
            return self._notify_via_email(po_number, channel, items, fulfillment_status, fc_code, notes)
        else:  # MANUAL
            return self._notify_manual(po_number, channel, items, fulfillment_status)
    
    def _notify_via_api(
        self,
        po_number: str,
        channel: str,
        items: List[OrderItem],
        fulfillment_status: str,
        fc_code: Optional[str],
        notes: Optional[str]
    ) -> NotificationResult:
        """Send notification via API call to IMS."""
        api_config = self.config.get("api", {})
        base_url = api_config.get("base_url", "http://localhost:8002")
        endpoint = api_config.get("create_order_endpoint", "/api/v1/sales-orders/from-ams")
        api_key = api_config.get("api_key", "")
        
        # Build payload
        payload = {
            "order_number": po_number,
            "reference_number": po_number,
            "platform": channel,
            "status": "confirmed",  # Order is confirmed since we reserved stock
            "notes": f"Reserved via AMS. Fulfillment: {fulfillment_status}. {notes or ''}",
            "items": [
                {
                    "sku": item.sku_code,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price or 0
                }
                for item in items
                if item.line_status in ('FULFILLED', 'PARTIAL')
            ]
        }
        
        if not payload["items"]:
            return NotificationResult(
                success=False,
                method="API",
                message="No fulfilled items to send to IMS"
            )
        
        try:
            headers = {
                "Content-Type": "application/json",
                "X-Tenant-ID": self.tenant_id
            }
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    f"{base_url}{endpoint}",
                    json=payload,
                    headers=headers
                )
                
                if response.status_code in (200, 201):
                    data = response.json()
                    return NotificationResult(
                        success=True,
                        method="API",
                        message="Order created in IMS",
                        ims_order_id=data.get("id"),
                        ims_order_number=data.get("order_number")
                    )
                else:
                    return NotificationResult(
                        success=False,
                        method="API",
                        message=f"IMS returned {response.status_code}: {response.text[:200]}"
                    )
                    
        except Exception as e:
            return NotificationResult(
                success=False,
                method="API",
                message=f"API call failed: {str(e)}"
            )
    
    def _notify_via_email(
        self,
        po_number: str,
        channel: str,
        items: List[OrderItem],
        fulfillment_status: str,
        fc_code: Optional[str],
        notes: Optional[str]
    ) -> NotificationResult:
        """Send notification via email."""
        email_config = self.config.get("email", {})
        to_email = email_config.get("to", "")
        cc_email = email_config.get("cc", "")
        
        if not to_email:
            return NotificationResult(
                success=False,
                method="EMAIL",
                message="No email address configured"
            )
        
        # Build email content
        subject = f"[AMS] Order Reserved - {po_number} ({channel.upper()})"
        
        items_html = ""
        for item in items:
            status_emoji = "✅" if item.line_status == "FULFILLED" else "⚠️" if item.line_status == "PARTIAL" else "❌"
            items_html += f"<tr><td>{item.sku_code}</td><td>{item.quantity}</td><td>{status_emoji} {item.line_status or 'PENDING'}</td></tr>"
        
        body = f"""
        <html>
        <body>
        <h2>Order Reserved in AMS</h2>
        <p><strong>PO Number:</strong> {po_number}</p>
        <p><strong>Channel:</strong> {channel.upper()}</p>
        <p><strong>Fulfillment Status:</strong> {fulfillment_status}</p>
        <p><strong>FC Code:</strong> {fc_code or 'N/A'}</p>
        
        <h3>Items</h3>
        <table border="1" cellpadding="5">
        <tr><th>SKU</th><th>Quantity</th><th>Status</th></tr>
        {items_html}
        </table>
        
        <h3>Action Required</h3>
        <p>Please confirm this order in your inventory system.</p>
        <p>After confirmation, update the order status in AMS or reply to this email with "CONFIRMED".</p>
        
        <p><a href="http://localhost:3000/ams/orders/{po_number}">View Order in AMS</a></p>
        </body>
        </html>
        """
        
        # TODO: Implement actual email sending
        # For now, just log and return success
        print(f"EMAIL NOTIFICATION (simulated):")
        print(f"  To: {to_email}")
        print(f"  Subject: {subject}")
        print(f"  PO: {po_number}, Items: {len(items)}")
        
        return NotificationResult(
            success=True,
            method="EMAIL",
            message=f"Email notification sent to {to_email} (simulated)"
        )
    
    def _notify_manual(
        self,
        po_number: str,
        channel: str,
        items: List[OrderItem],
        fulfillment_status: str
    ) -> NotificationResult:
        """No notification - mark for manual confirmation."""
        return NotificationResult(
            success=True,
            method="MANUAL",
            message="Order reserved. Manual confirmation required."
        )


