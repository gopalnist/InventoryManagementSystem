"""
Product Bundles API Routes
==========================
CRUD operations for product bundles (composite products) and their components.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional, List
from uuid import UUID, uuid4
import math
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, Header

# Add shared to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent.parent))

from shared.db import get_db_cursor

from ..models.bundle import (
    ProductBundleCreate,
    ProductBundleUpdate,
    ProductBundleResponse,
    ProductBundleListResponse,
    ProductBundleSummary,
    BundleComponentCreate,
    BundleComponentUpdate,
    BundleComponentResponse,
    BundleCostBreakdown,
)

router = APIRouter()


# --- Helper Functions ---

def get_tenant_id(x_tenant_id: str = Header(...)) -> UUID:
    """Extract tenant ID from header."""
    try:
        return UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant ID")


def recalculate_bundle_cost(cur, bundle_id: UUID):
    """Recalculate total cost for a bundle based on its components."""
    # Get all components
    cur.execute(
        """
        SELECT bc.quantity, bc.unit_cost, p.cost_price
        FROM bundle_components bc
        LEFT JOIN products p ON bc.product_id = p.id
        WHERE bc.bundle_id = %s
        """,
        (str(bundle_id),)
    )
    rows = cur.fetchall()
    
    total_component_cost = Decimal(0)
    for row in rows:
        unit_cost = row["unit_cost"] or row["cost_price"] or Decimal(0)
        quantity = row["quantity"] or Decimal(1)
        total_component_cost += unit_cost * quantity
    
    # Get additional cost
    cur.execute(
        "SELECT additional_cost, auto_calculate_cost FROM product_bundles WHERE id = %s",
        (str(bundle_id),)
    )
    bundle = cur.fetchone()
    
    additional_cost = bundle["additional_cost"] or Decimal(0)
    total_cost = total_component_cost + additional_cost
    
    # Update bundle
    cur.execute(
        """
        UPDATE product_bundles 
        SET total_component_cost = %s, total_cost = %s, updated_at = NOW()
        WHERE id = %s
        """,
        (total_component_cost, total_cost, str(bundle_id))
    )


# ============================================================================
# PRODUCT BUNDLES ENDPOINTS
# ============================================================================

@router.get("", response_model=ProductBundleListResponse)
async def list_bundles(
    x_tenant_id: str = Header(...),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by SKU or name"),
    category_id: Optional[UUID] = Query(None),
    is_active: Optional[bool] = Query(None),
    sort_by: str = Query("created_at", description="Field to sort by"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
):
    """List product bundles with pagination and filtering."""
    tenant_id = get_tenant_id(x_tenant_id)
    offset = (page - 1) * limit
    
    with get_db_cursor() as cur:
        # Base query
        base_query = """
            FROM product_bundles pb
            LEFT JOIN categories c ON pb.category_id = c.id
            LEFT JOIN brands b ON pb.brand_id = b.id
            LEFT JOIN units u ON pb.unit_id = u.id
            WHERE pb.tenant_id = %s
        """
        params = [str(tenant_id)]
        
        # Filters
        if search:
            base_query += " AND (pb.sku ILIKE %s OR pb.name ILIKE %s)"
            params.extend([f"%{search}%", f"%{search}%"])
        
        if category_id:
            base_query += " AND pb.category_id = %s"
            params.append(str(category_id))
        
        if is_active is not None:
            base_query += " AND pb.is_active = %s"
            params.append(is_active)
        
        # Count total
        cur.execute(f"SELECT COUNT(*) {base_query}", params)
        total = cur.fetchone()["count"]
        
        # Get paginated results
        allowed_sort_fields = ["sku", "name", "created_at", "updated_at", "selling_price", "total_cost"]
        if sort_by not in allowed_sort_fields:
            sort_by = "created_at"
        
        select_query = f"""
            SELECT 
                pb.*,
                c.name as category_name,
                b.name as brand_name,
                u.name as unit_name,
                u.symbol as unit_symbol,
                (SELECT COUNT(*) FROM bundle_components bc WHERE bc.bundle_id = pb.id) as component_count
            {base_query}
            ORDER BY pb.{sort_by} {sort_order}
            LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])
        
        cur.execute(select_query, params)
        rows = cur.fetchall()
        
        bundles = [ProductBundleResponse(**dict(row)) for row in rows]
        total_pages = math.ceil(total / limit) if total > 0 else 0
        
        return ProductBundleListResponse(
            bundles=bundles,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages
        )


@router.get("/summary", response_model=ProductBundleSummary)
async def get_bundle_summary(
    x_tenant_id: str = Header(...),
):
    """Get summary statistics for bundles."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT 
                COUNT(*) as total_bundles,
                COUNT(*) FILTER (WHERE is_active = true) as active_bundles,
                COALESCE(SUM(total_cost), 0) as total_component_value
            FROM product_bundles
            WHERE tenant_id = %s
            """,
            (str(tenant_id),)
        )
        row = cur.fetchone()
        
        # TODO: Get low stock count from inventory service
        low_stock_bundles = 0
        
        return ProductBundleSummary(
            total_bundles=row["total_bundles"],
            active_bundles=row["active_bundles"],
            low_stock_bundles=low_stock_bundles,
            total_component_value=row["total_component_value"]
        )


@router.get("/{bundle_id}", response_model=ProductBundleResponse)
async def get_bundle(
    bundle_id: UUID,
    x_tenant_id: str = Header(...),
    include_components: bool = Query(True, description="Include component details"),
):
    """Get a single bundle by ID."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT 
                pb.*,
                c.name as category_name,
                b.name as brand_name,
                u.name as unit_name,
                u.symbol as unit_symbol
            FROM product_bundles pb
            LEFT JOIN categories c ON pb.category_id = c.id
            LEFT JOIN brands b ON pb.brand_id = b.id
            LEFT JOIN units u ON pb.unit_id = u.id
            WHERE pb.id = %s AND pb.tenant_id = %s
            """,
            (str(bundle_id), str(tenant_id))
        )
        row = cur.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Bundle not found")
        
        bundle = ProductBundleResponse(**dict(row))
        
        # Get components if requested
        if include_components:
            cur.execute(
                """
                SELECT 
                    bc.*,
                    p.name as product_name,
                    p.sku as product_sku,
                    pu.name as product_unit_name,
                    cb.name as component_bundle_name,
                    cb.sku as component_bundle_sku
                FROM bundle_components bc
                LEFT JOIN products p ON bc.product_id = p.id
                LEFT JOIN units pu ON p.primary_unit_id = pu.id
                LEFT JOIN product_bundles cb ON bc.component_bundle_id = cb.id
                WHERE bc.bundle_id = %s
                ORDER BY bc.sort_order, bc.created_at
                """,
                (str(bundle_id),)
            )
            components = [BundleComponentResponse(**dict(c)) for c in cur.fetchall()]
            bundle.components = components
            bundle.component_count = len(components)
        
        return bundle


@router.post("", response_model=ProductBundleResponse, status_code=201)
async def create_bundle(
    data: ProductBundleCreate,
    x_tenant_id: str = Header(...),
):
    """Create a new product bundle."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Check for duplicate SKU
        cur.execute(
            "SELECT id FROM product_bundles WHERE tenant_id = %s AND sku = %s",
            (str(tenant_id), data.sku)
        )
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Bundle with this SKU already exists")
        
        # Also check products table for SKU conflict
        cur.execute(
            "SELECT id FROM products WHERE tenant_id = %s AND sku = %s",
            (str(tenant_id), data.sku)
        )
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="A product with this SKU already exists")
        
        # Insert bundle
        bundle_id = uuid4()
        cur.execute(
            """
            INSERT INTO product_bundles (
                id, tenant_id, sku, name, description,
                category_id, brand_id, unit_id,
                auto_calculate_cost, additional_cost,
                selling_price, mrp, hsn_code, tax_rate,
                reorder_level, image_url,
                is_active, created_at
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s, %s, %s,
                %s, %s,
                true, NOW()
            )
            RETURNING *
            """,
            (
                str(bundle_id), str(tenant_id), data.sku, data.name, data.description,
                str(data.category_id) if data.category_id else None,
                str(data.brand_id) if data.brand_id else None,
                str(data.unit_id) if data.unit_id else None,
                data.auto_calculate_cost, data.additional_cost,
                data.selling_price, data.mrp, data.hsn_code, data.tax_rate,
                data.reorder_level, data.image_url,
            )
        )
        bundle_row = cur.fetchone()
        
        # Add components if provided
        if data.components:
            for idx, comp in enumerate(data.components):
                if not comp.product_id and not comp.component_bundle_id:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Component {idx} must have either product_id or component_bundle_id"
                    )
                
                # Get unit cost from product if not provided
                unit_cost = comp.unit_cost
                if not unit_cost and comp.product_id:
                    cur.execute(
                        "SELECT cost_price FROM products WHERE id = %s",
                        (str(comp.product_id),)
                    )
                    product = cur.fetchone()
                    if product:
                        unit_cost = product["cost_price"]
                
                line_cost = (unit_cost or Decimal(0)) * comp.quantity
                
                cur.execute(
                    """
                    INSERT INTO bundle_components (
                        id, tenant_id, bundle_id, product_id, component_bundle_id,
                        quantity, unit_cost, line_cost, sort_order, notes, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    """,
                    (
                        str(uuid4()), str(tenant_id), str(bundle_id),
                        str(comp.product_id) if comp.product_id else None,
                        str(comp.component_bundle_id) if comp.component_bundle_id else None,
                        comp.quantity, unit_cost, line_cost, idx, comp.notes,
                    )
                )
            
            # Recalculate bundle cost
            recalculate_bundle_cost(cur, bundle_id)
        
        # Fetch final bundle
        return await get_bundle(bundle_id, x_tenant_id)


@router.put("/{bundle_id}", response_model=ProductBundleResponse)
async def update_bundle(
    bundle_id: UUID,
    data: ProductBundleUpdate,
    x_tenant_id: str = Header(...),
):
    """Update an existing bundle."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Check exists
        cur.execute(
            "SELECT id FROM product_bundles WHERE id = %s AND tenant_id = %s",
            (str(bundle_id), str(tenant_id))
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Bundle not found")
        
        # Build update query
        updates = []
        params = []
        
        uuid_fields = {"category_id", "brand_id", "unit_id"}
        
        for field, value in data.model_dump(exclude_unset=True).items():
            if value is not None:
                if field in uuid_fields:
                    updates.append(f"{field} = %s")
                    params.append(str(value) if value else None)
                else:
                    updates.append(f"{field} = %s")
                    params.append(value)
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        updates.append("updated_at = NOW()")
        params.extend([str(bundle_id), str(tenant_id)])
        
        cur.execute(
            f"""
            UPDATE product_bundles 
            SET {', '.join(updates)}
            WHERE id = %s AND tenant_id = %s
            RETURNING *
            """,
            params
        )
        
        return await get_bundle(bundle_id, x_tenant_id)


@router.delete("/{bundle_id}", status_code=204)
async def delete_bundle(
    bundle_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Delete a bundle."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Check if bundle is used in production orders
        cur.execute(
            """
            SELECT id FROM production_orders 
            WHERE bundle_id = %s AND status NOT IN ('completed', 'cancelled')
            LIMIT 1
            """,
            (str(bundle_id),)
        )
        if cur.fetchone():
            raise HTTPException(
                status_code=409,
                detail="Cannot delete bundle - it has active production orders"
            )
        
        # Delete bundle (components cascade)
        cur.execute(
            "DELETE FROM product_bundles WHERE id = %s AND tenant_id = %s",
            (str(bundle_id), str(tenant_id))
        )
        
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Bundle not found")


# ============================================================================
# BUNDLE COMPONENTS ENDPOINTS
# ============================================================================

@router.get("/{bundle_id}/components", response_model=List[BundleComponentResponse])
async def list_bundle_components(
    bundle_id: UUID,
    x_tenant_id: str = Header(...),
):
    """List all components of a bundle."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Verify bundle exists
        cur.execute(
            "SELECT id FROM product_bundles WHERE id = %s AND tenant_id = %s",
            (str(bundle_id), str(tenant_id))
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Bundle not found")
        
        cur.execute(
            """
            SELECT 
                bc.*,
                p.name as product_name,
                p.sku as product_sku,
                pu.name as product_unit_name,
                cb.name as component_bundle_name,
                cb.sku as component_bundle_sku
            FROM bundle_components bc
            LEFT JOIN products p ON bc.product_id = p.id
            LEFT JOIN units pu ON p.primary_unit_id = pu.id
            LEFT JOIN product_bundles cb ON bc.component_bundle_id = cb.id
            WHERE bc.bundle_id = %s
            ORDER BY bc.sort_order, bc.created_at
            """,
            (str(bundle_id),)
        )
        
        return [BundleComponentResponse(**dict(row)) for row in cur.fetchall()]


@router.post("/{bundle_id}/components", response_model=BundleComponentResponse, status_code=201)
async def add_bundle_component(
    bundle_id: UUID,
    data: BundleComponentCreate,
    x_tenant_id: str = Header(...),
):
    """Add a component to a bundle."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    if not data.product_id and not data.component_bundle_id:
        raise HTTPException(
            status_code=400,
            detail="Either product_id or component_bundle_id is required"
        )
    
    with get_db_cursor() as cur:
        # Verify bundle exists
        cur.execute(
            "SELECT id FROM product_bundles WHERE id = %s AND tenant_id = %s",
            (str(bundle_id), str(tenant_id))
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Bundle not found")
        
        # Verify product/bundle exists
        if data.product_id:
            cur.execute(
                "SELECT cost_price FROM products WHERE id = %s AND tenant_id = %s",
                (str(data.product_id), str(tenant_id))
            )
            product = cur.fetchone()
            if not product:
                raise HTTPException(status_code=400, detail="Product not found")
            unit_cost = data.unit_cost or product["cost_price"]
        else:
            cur.execute(
                "SELECT total_cost FROM product_bundles WHERE id = %s AND tenant_id = %s",
                (str(data.component_bundle_id), str(tenant_id))
            )
            nested_bundle = cur.fetchone()
            if not nested_bundle:
                raise HTTPException(status_code=400, detail="Nested bundle not found")
            unit_cost = data.unit_cost or nested_bundle["total_cost"]
        
        # Get next sort order
        cur.execute(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM bundle_components WHERE bundle_id = %s",
            (str(bundle_id),)
        )
        next_order = cur.fetchone()["next_order"]
        
        line_cost = (unit_cost or Decimal(0)) * data.quantity
        
        component_id = uuid4()
        cur.execute(
            """
            INSERT INTO bundle_components (
                id, tenant_id, bundle_id, product_id, component_bundle_id,
                quantity, unit_cost, line_cost, sort_order, notes, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            RETURNING *
            """,
            (
                str(component_id), str(tenant_id), str(bundle_id),
                str(data.product_id) if data.product_id else None,
                str(data.component_bundle_id) if data.component_bundle_id else None,
                data.quantity, unit_cost, line_cost, 
                data.sort_order if data.sort_order else next_order, 
                data.notes,
            )
        )
        row = cur.fetchone()
        
        # Recalculate bundle cost
        recalculate_bundle_cost(cur, bundle_id)
        
        return BundleComponentResponse(**dict(row))


@router.put("/{bundle_id}/components/{component_id}", response_model=BundleComponentResponse)
async def update_bundle_component(
    bundle_id: UUID,
    component_id: UUID,
    data: BundleComponentUpdate,
    x_tenant_id: str = Header(...),
):
    """Update a bundle component."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Verify component exists
        cur.execute(
            """
            SELECT bc.*, p.cost_price 
            FROM bundle_components bc
            LEFT JOIN products p ON bc.product_id = p.id
            WHERE bc.id = %s AND bc.bundle_id = %s
            """,
            (str(component_id), str(bundle_id))
        )
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Component not found")
        
        # Build update
        updates = []
        params = []
        
        for field, value in data.model_dump(exclude_unset=True).items():
            if value is not None:
                updates.append(f"{field} = %s")
                params.append(value)
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Recalculate line cost
        new_quantity = data.quantity if data.quantity is not None else existing["quantity"]
        new_unit_cost = data.unit_cost if data.unit_cost is not None else existing["unit_cost"]
        line_cost = (new_unit_cost or Decimal(0)) * new_quantity
        
        updates.append("line_cost = %s")
        params.append(line_cost)
        updates.append("updated_at = NOW()")
        params.extend([str(component_id), str(bundle_id)])
        
        cur.execute(
            f"""
            UPDATE bundle_components 
            SET {', '.join(updates)}
            WHERE id = %s AND bundle_id = %s
            RETURNING *
            """,
            params
        )
        row = cur.fetchone()
        
        # Recalculate bundle cost
        recalculate_bundle_cost(cur, bundle_id)
        
        return BundleComponentResponse(**dict(row))


@router.delete("/{bundle_id}/components/{component_id}", status_code=204)
async def remove_bundle_component(
    bundle_id: UUID,
    component_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Remove a component from a bundle."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute(
            "DELETE FROM bundle_components WHERE id = %s AND bundle_id = %s",
            (str(component_id), str(bundle_id))
        )
        
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Component not found")
        
        # Recalculate bundle cost
        recalculate_bundle_cost(cur, bundle_id)


@router.get("/{bundle_id}/cost-breakdown", response_model=BundleCostBreakdown)
async def get_bundle_cost_breakdown(
    bundle_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Get detailed cost breakdown for a bundle."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Get bundle
        cur.execute(
            "SELECT * FROM product_bundles WHERE id = %s AND tenant_id = %s",
            (str(bundle_id), str(tenant_id))
        )
        bundle = cur.fetchone()
        if not bundle:
            raise HTTPException(status_code=404, detail="Bundle not found")
        
        # Get components
        cur.execute(
            """
            SELECT 
                COALESCE(p.name, cb.name) as component_name,
                bc.quantity,
                COALESCE(bc.unit_cost, p.cost_price, cb.total_cost) as unit_cost,
                bc.line_cost
            FROM bundle_components bc
            LEFT JOIN products p ON bc.product_id = p.id
            LEFT JOIN product_bundles cb ON bc.component_bundle_id = cb.id
            WHERE bc.bundle_id = %s
            ORDER BY bc.sort_order
            """,
            (str(bundle_id),)
        )
        
        components = []
        total_component_cost = Decimal(0)
        
        for row in cur.fetchall():
            line_cost = row["line_cost"] or Decimal(0)
            total_component_cost += line_cost
            components.append({
                "component_name": row["component_name"],
                "quantity": float(row["quantity"]),
                "unit_cost": float(row["unit_cost"] or 0),
                "line_cost": float(line_cost),
            })
        
        additional_cost = bundle["additional_cost"] or Decimal(0)
        total_cost = total_component_cost + additional_cost
        
        # Suggest 30% margin
        suggested_price = total_cost * Decimal("1.30")
        
        return BundleCostBreakdown(
            bundle_id=bundle_id,
            components=components,
            total_component_cost=total_component_cost,
            additional_cost=additional_cost,
            total_cost=total_cost,
            suggested_selling_price=suggested_price.quantize(Decimal("0.01"))
        )


# ============================================================================
# AVAILABLE TO BUILD CALCULATION
# ============================================================================

@router.get("/{bundle_id}/available-to-build")
async def get_available_to_build(
    bundle_id: UUID,
    x_tenant_id: str = Header(...),
    warehouse_id: Optional[UUID] = Query(None, description="Specific warehouse, or all if not provided"),
):
    """
    Calculate how many units of a bundle can be built based on available component inventory.
    
    Returns the minimum buildable quantity limited by the component with the least available stock.
    """
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Verify bundle exists
        cur.execute(
            "SELECT id, name, sku FROM product_bundles WHERE id = %s AND tenant_id = %s",
            (str(bundle_id), str(tenant_id))
        )
        bundle = cur.fetchone()
        if not bundle:
            raise HTTPException(status_code=404, detail="Bundle not found")
        
        # Get bundle components with their inventory
        warehouse_filter = ""
        params = [str(bundle_id), str(tenant_id)]
        
        if warehouse_id:
            warehouse_filter = "AND i.warehouse_id = %s"
            params.append(str(warehouse_id))
        
        cur.execute(f"""
            SELECT 
                bc.id as component_id,
                bc.product_id,
                p.name as product_name,
                p.sku as product_sku,
                bc.quantity as required_qty,
                COALESCE(SUM(i.available_qty), 0) as available_qty,
                w.name as warehouse_name
            FROM bundle_components bc
            JOIN products p ON bc.product_id = p.id
            LEFT JOIN inventory i ON i.product_id = bc.product_id AND i.tenant_id = %s {warehouse_filter}
            LEFT JOIN warehouses w ON i.warehouse_id = w.id
            WHERE bc.bundle_id = %s
            GROUP BY bc.id, bc.product_id, p.name, p.sku, bc.quantity, w.name
            ORDER BY (COALESCE(SUM(i.available_qty), 0) / NULLIF(bc.quantity, 0)) ASC
        """, params + [str(bundle_id)])
        
        components = cur.fetchall()
        
        if not components:
            return {
                "bundle_id": str(bundle_id),
                "bundle_name": bundle["name"],
                "bundle_sku": bundle["sku"],
                "available_to_build": 0,
                "limiting_factor": None,
                "components": [],
                "message": "No components defined for this bundle"
            }
        
        # Calculate buildable quantity for each component
        component_details = []
        min_buildable = float('inf')
        limiting_component = None
        
        for comp in components:
            required_qty = float(comp["required_qty"])
            available_qty = float(comp["available_qty"])
            
            if required_qty > 0:
                buildable = int(available_qty // required_qty)
            else:
                buildable = 0
            
            component_info = {
                "component_id": str(comp["component_id"]),
                "product_id": str(comp["product_id"]),
                "product_name": comp["product_name"],
                "product_sku": comp["product_sku"],
                "required_per_bundle": required_qty,
                "available_qty": available_qty,
                "can_build": buildable,
                "is_limiting": False
            }
            
            if buildable < min_buildable:
                min_buildable = buildable
                limiting_component = component_info
            
            component_details.append(component_info)
        
        # Mark limiting component
        if limiting_component:
            for comp in component_details:
                if comp["product_id"] == limiting_component["product_id"]:
                    comp["is_limiting"] = True
                    break
        
        available_to_build = int(min_buildable) if min_buildable != float('inf') else 0
        
        return {
            "bundle_id": str(bundle_id),
            "bundle_name": bundle["name"],
            "bundle_sku": bundle["sku"],
            "available_to_build": available_to_build,
            "limiting_factor": limiting_component["product_name"] if limiting_component else None,
            "components": component_details,
            "warehouse_id": str(warehouse_id) if warehouse_id else None,
            "message": f"Can build {available_to_build} units" if available_to_build > 0 else "Cannot build any units - insufficient component stock"
        }


@router.get("/buildable-summary")
async def get_buildable_summary(
    x_tenant_id: str = Header(...),
    warehouse_id: Optional[UUID] = Query(None, description="Specific warehouse, or all if not provided"),
    limit: int = Query(50, ge=1, le=200),
):
    """
    Get a summary of all bundles with their available-to-build quantities.
    
    Useful for production planning and identifying which bundles can be assembled.
    """
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Get all active bundles
        cur.execute("""
            SELECT id, name, sku, selling_price
            FROM product_bundles
            WHERE tenant_id = %s AND is_active = true
            ORDER BY name
            LIMIT %s
        """, (str(tenant_id), limit))
        
        bundles = cur.fetchall()
        
        results = []
        for bundle in bundles:
            bundle_id = bundle["id"]
            
            # Get components with inventory
            warehouse_filter = ""
            params = [str(tenant_id), str(bundle_id)]
            
            if warehouse_id:
                warehouse_filter = "AND i.warehouse_id = %s"
                params.append(str(warehouse_id))
            
            cur.execute(f"""
                SELECT 
                    bc.quantity as required_qty,
                    COALESCE(SUM(i.available_qty), 0) as available_qty
                FROM bundle_components bc
                LEFT JOIN inventory i ON i.product_id = bc.product_id AND i.tenant_id = %s {warehouse_filter}
                WHERE bc.bundle_id = %s
                GROUP BY bc.id, bc.quantity
            """, params)
            
            components = cur.fetchall()
            
            if not components:
                available = 0
            else:
                min_buildable = float('inf')
                for comp in components:
                    required = float(comp["required_qty"])
                    available_stock = float(comp["available_qty"])
                    if required > 0:
                        buildable = int(available_stock // required)
                        min_buildable = min(min_buildable, buildable)
                
                available = int(min_buildable) if min_buildable != float('inf') else 0
            
            results.append({
                "bundle_id": str(bundle_id),
                "bundle_name": bundle["name"],
                "bundle_sku": bundle["sku"],
                "selling_price": float(bundle["selling_price"] or 0),
                "available_to_build": available,
                "status": "ready" if available > 0 else "insufficient_stock"
            })
        
        # Sort by available_to_build descending
        results.sort(key=lambda x: x["available_to_build"], reverse=True)
        
        ready_count = sum(1 for r in results if r["status"] == "ready")
        
        return {
            "bundles": results,
            "total": len(results),
            "ready_to_build": ready_count,
            "insufficient_stock": len(results) - ready_count,
            "warehouse_id": str(warehouse_id) if warehouse_id else "all"
        }

