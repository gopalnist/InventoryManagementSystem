"""
Products API Routes
===================
CRUD operations for products (formerly items).
Includes brands and manufacturers sub-resources.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional
from uuid import UUID, uuid4
import math

from fastapi import APIRouter, HTTPException, Query, Header, UploadFile, File

# Add shared to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent.parent))

from shared.db import get_db_cursor

from ..models.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
    ProductImportResult,
    BrandCreate,
    BrandUpdate,
    BrandResponse,
    BrandListResponse,
    ManufacturerCreate,
    ManufacturerUpdate,
    ManufacturerResponse,
    ManufacturerListResponse,
)

router = APIRouter()


# --- Helper Functions ---

def get_tenant_id(x_tenant_id: str = Header(...)) -> UUID:
    """Extract tenant ID from header."""
    try:
        return UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant ID")


# ============================================================================
# PRODUCTS ENDPOINTS
# ============================================================================

@router.get("", response_model=ProductListResponse)
async def list_products(
    x_tenant_id: str = Header(...),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by SKU, name, or identifiers"),
    category_id: Optional[UUID] = Query(None),
    brand_id: Optional[UUID] = Query(None),
    product_type: Optional[str] = Query(None, description="goods, service, raw_material"),
    is_active: Optional[bool] = Query(None),
    sort_by: str = Query("created_at", description="Field to sort by"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
):
    """
    List products with pagination and filtering.
    """
    tenant_id = get_tenant_id(x_tenant_id)
    offset = (page - 1) * limit
    
    with get_db_cursor() as cur:
        # Base query
        base_query = """
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN brands b ON p.brand_id = b.id
            LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
            LEFT JOIN units pu ON p.primary_unit_id = pu.id
            LEFT JOIN units su ON p.secondary_unit_id = su.id
            LEFT JOIN parties v ON p.preferred_vendor_id = v.id
            WHERE p.tenant_id = %s
        """
        params = [str(tenant_id)]
        
        # Filters
        if search:
            base_query += """ AND (
                p.sku ILIKE %s OR 
                p.name ILIKE %s OR 
                p.upc ILIKE %s OR 
                p.ean ILIKE %s OR
                p.mpn ILIKE %s
            )"""
            search_pattern = f"%{search}%"
            params.extend([search_pattern] * 5)
        
        if category_id:
            base_query += " AND p.category_id = %s"
            params.append(str(category_id))
        
        if brand_id:
            base_query += " AND p.brand_id = %s"
            params.append(str(brand_id))
        
        if product_type:
            base_query += " AND p.product_type = %s"
            params.append(product_type)
        
        if is_active is not None:
            base_query += " AND p.is_active = %s"
            params.append(is_active)
        
        # Count total
        cur.execute(f"SELECT COUNT(*) {base_query}", params)
        total = cur.fetchone()["count"]
        
        # Get paginated results
        allowed_sort_fields = ["sku", "name", "created_at", "updated_at", "selling_price", "cost_price"]
        if sort_by not in allowed_sort_fields:
            sort_by = "created_at"
        
        select_query = f"""
            SELECT 
                p.id, p.tenant_id, p.sku, p.name, p.description, p.product_type,
                p.category_id, p.brand_id, p.manufacturer_id,
                p.upc, p.ean, p.mpn, p.isbn,
                p.primary_unit_id, p.secondary_unit_id, p.conversion_rate,
                p.length, p.width, p.height, p.dimension_unit_id,
                p.weight, p.weight_unit_id,
                p.selling_price, p.mrp, p.sales_description, p.sales_tax_rate, p.is_taxable,
                p.cost_price, p.purchase_description, p.purchase_tax_rate, p.preferred_vendor_id,
                p.hsn_code,
                p.track_batches, p.track_serials, p.track_expiry, p.has_variants,
                p.reorder_level, p.reorder_qty, p.min_stock, p.max_stock, p.lead_time_days,
                p.opening_stock, p.opening_stock_value,
                p.image_url, p.image_urls,
                p.is_active, p.created_at, p.updated_at,
                c.name as category_name,
                b.name as brand_name,
                m.name as manufacturer_name,
                pu.name as primary_unit_name,
                pu.symbol as primary_unit_symbol,
                su.name as secondary_unit_name,
                v.party_name as preferred_vendor_name
            {base_query}
            ORDER BY p.{sort_by} {sort_order}
            LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])
        
        cur.execute(select_query, params)
        rows = cur.fetchall()
        
        products = [ProductResponse(**dict(row)) for row in rows]
        total_pages = math.ceil(total / limit) if total > 0 else 0
        
        return ProductListResponse(
            products=products,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages
        )


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Get a single product by ID."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT 
                p.id, p.tenant_id, p.sku, p.name, p.description, p.product_type,
                p.category_id, p.brand_id, p.manufacturer_id,
                p.upc, p.ean, p.mpn, p.isbn,
                p.primary_unit_id, p.secondary_unit_id, p.conversion_rate,
                p.length, p.width, p.height, p.dimension_unit_id,
                p.weight, p.weight_unit_id,
                p.selling_price, p.mrp, p.sales_description, p.sales_tax_rate, p.is_taxable,
                p.cost_price, p.purchase_description, p.purchase_tax_rate, p.preferred_vendor_id,
                p.hsn_code,
                p.track_batches, p.track_serials, p.track_expiry, p.has_variants,
                p.reorder_level, p.reorder_qty, p.min_stock, p.max_stock, p.lead_time_days,
                p.opening_stock, p.opening_stock_value,
                p.image_url, p.image_urls,
                p.is_active, p.created_at, p.updated_at,
                c.name as category_name,
                b.name as brand_name,
                m.name as manufacturer_name,
                pu.name as primary_unit_name,
                pu.symbol as primary_unit_symbol,
                su.name as secondary_unit_name,
                v.party_name as preferred_vendor_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN brands b ON p.brand_id = b.id
            LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
            LEFT JOIN units pu ON p.primary_unit_id = pu.id
            LEFT JOIN units su ON p.secondary_unit_id = su.id
            LEFT JOIN parties v ON p.preferred_vendor_id = v.id
            WHERE p.id = %s AND p.tenant_id = %s
            """,
            (str(product_id), str(tenant_id))
        )
        row = cur.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Product not found")
        
        return ProductResponse(**dict(row))


@router.post("", response_model=ProductResponse, status_code=201)
async def create_product(
    data: ProductCreate,
    x_tenant_id: str = Header(...),
):
    """Create a new product."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Check for duplicate SKU
        cur.execute(
            "SELECT id FROM products WHERE tenant_id = %s AND sku = %s",
            (str(tenant_id), data.sku)
        )
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Product with this SKU already exists")
        
        # Validate category if provided
        if data.category_id:
            cur.execute(
                "SELECT id FROM categories WHERE id = %s AND tenant_id = %s",
                (str(data.category_id), str(tenant_id))
            )
            if not cur.fetchone():
                raise HTTPException(status_code=400, detail="Category not found")
        
        # Insert
        product_id = uuid4()
        cur.execute(
            """
            INSERT INTO products (
                id, tenant_id, sku, name, description, product_type,
                category_id, brand_id, manufacturer_id,
                upc, ean, mpn, isbn,
                primary_unit_id, secondary_unit_id, conversion_rate,
                length, width, height, dimension_unit_id,
                weight, weight_unit_id,
                selling_price, mrp, sales_description, sales_tax_rate, is_taxable,
                cost_price, purchase_description, purchase_tax_rate, preferred_vendor_id,
                hsn_code,
                track_batches, track_serials, track_expiry, has_variants,
                reorder_level, reorder_qty, min_stock, max_stock, lead_time_days,
                opening_stock, opening_stock_value,
                image_url, image_urls,
                is_active, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s,
                %s, %s,
                true, NOW()
            )
            RETURNING *
            """,
            (
                str(product_id), str(tenant_id), data.sku, data.name, data.description, data.product_type,
                str(data.category_id) if data.category_id else None,
                str(data.brand_id) if data.brand_id else None,
                str(data.manufacturer_id) if data.manufacturer_id else None,
                data.upc, data.ean, data.mpn, data.isbn,
                str(data.primary_unit_id) if data.primary_unit_id else None,
                str(data.secondary_unit_id) if data.secondary_unit_id else None,
                data.conversion_rate,
                data.length, data.width, data.height,
                str(data.dimension_unit_id) if data.dimension_unit_id else None,
                data.weight,
                str(data.weight_unit_id) if data.weight_unit_id else None,
                data.selling_price, data.mrp, data.sales_description, data.sales_tax_rate, data.is_taxable,
                data.cost_price, data.purchase_description, data.purchase_tax_rate,
                str(data.preferred_vendor_id) if data.preferred_vendor_id else None,
                data.hsn_code,
                data.track_batches, data.track_serials, data.track_expiry, data.has_variants,
                data.reorder_level, data.reorder_qty, data.min_stock, data.max_stock, data.lead_time_days,
                data.opening_stock, data.opening_stock_value,
                data.image_url, data.image_urls,
            )
        )
        row = cur.fetchone()
        
        return ProductResponse(**dict(row))


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: UUID,
    data: ProductUpdate,
    x_tenant_id: str = Header(...),
):
    """Update an existing product."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Check exists
        cur.execute(
            "SELECT id FROM products WHERE id = %s AND tenant_id = %s",
            (str(product_id), str(tenant_id))
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Build update query dynamically
        updates = []
        params = []
        
        update_fields = data.model_dump(exclude_unset=True)
        
        uuid_fields = {
            "category_id", "brand_id", "manufacturer_id",
            "primary_unit_id", "secondary_unit_id",
            "dimension_unit_id", "weight_unit_id", "preferred_vendor_id"
        }
        
        for field, value in update_fields.items():
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
        params.extend([str(product_id), str(tenant_id)])
        
        cur.execute(
            f"""
            UPDATE products 
            SET {', '.join(updates)}
            WHERE id = %s AND tenant_id = %s
            RETURNING *
            """,
            params
        )
        row = cur.fetchone()
        
        return ProductResponse(**dict(row))


@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Delete a product."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Check if product is used in bundles
        cur.execute(
            "SELECT id FROM bundle_components WHERE product_id = %s LIMIT 1",
            (str(product_id),)
        )
        if cur.fetchone():
            raise HTTPException(
                status_code=409, 
                detail="Cannot delete product - it is used in product bundles"
            )
        
        cur.execute(
            "DELETE FROM products WHERE id = %s AND tenant_id = %s",
            (str(product_id), str(tenant_id))
        )
        
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Product not found")


# ============================================================================
# BRANDS ENDPOINTS
# ============================================================================

@router.get("/brands/", response_model=BrandListResponse)
async def list_brands(
    x_tenant_id: str = Header(...),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
):
    """List all brands."""
    tenant_id = get_tenant_id(x_tenant_id)
    offset = (page - 1) * limit
    
    with get_db_cursor() as cur:
        base_conditions = "WHERE tenant_id = %s"
        params = [str(tenant_id)]
        
        if search:
            base_conditions += " AND name ILIKE %s"
            params.append(f"%{search}%")
        
        if is_active is not None:
            base_conditions += " AND is_active = %s"
            params.append(is_active)
        
        cur.execute(f"SELECT COUNT(*) FROM brands {base_conditions}", params)
        total = cur.fetchone()["count"]
        
        cur.execute(
            f"""
            SELECT b.*, 
                (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) as product_count
            FROM brands b
            {base_conditions.replace('tenant_id', 'b.tenant_id').replace('name', 'b.name').replace('is_active', 'b.is_active')}
            ORDER BY b.name
            LIMIT %s OFFSET %s
            """,
            params + [limit, offset]
        )
        rows = cur.fetchall()
        
        return BrandListResponse(
            brands=[BrandResponse(**dict(row)) for row in rows],
            total=total,
            page=page,
            limit=limit
        )


@router.post("/brands/", response_model=BrandResponse, status_code=201)
async def create_brand(
    data: BrandCreate,
    x_tenant_id: str = Header(...),
):
    """Create a new brand."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Check duplicate
        cur.execute(
            "SELECT id FROM brands WHERE tenant_id = %s AND name = %s",
            (str(tenant_id), data.name)
        )
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Brand already exists")
        
        brand_id = uuid4()
        cur.execute(
            """
            INSERT INTO brands (id, tenant_id, name, description, logo_url, website, is_active, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, true, NOW())
            RETURNING *
            """,
            (str(brand_id), str(tenant_id), data.name, data.description, data.logo_url, data.website)
        )
        row = cur.fetchone()
        
        return BrandResponse(**dict(row))


@router.put("/brands/{brand_id}", response_model=BrandResponse)
async def update_brand(
    brand_id: UUID,
    data: BrandUpdate,
    x_tenant_id: str = Header(...),
):
    """Update a brand."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        updates = []
        params = []
        
        for field, value in data.model_dump(exclude_unset=True).items():
            if value is not None:
                updates.append(f"{field} = %s")
                params.append(value)
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        updates.append("updated_at = NOW()")
        params.extend([str(brand_id), str(tenant_id)])
        
        cur.execute(
            f"""
            UPDATE brands SET {', '.join(updates)}
            WHERE id = %s AND tenant_id = %s
            RETURNING *
            """,
            params
        )
        row = cur.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Brand not found")
        
        return BrandResponse(**dict(row))


@router.delete("/brands/{brand_id}", status_code=204)
async def delete_brand(
    brand_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Delete a brand."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute(
            "DELETE FROM brands WHERE id = %s AND tenant_id = %s",
            (str(brand_id), str(tenant_id))
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Brand not found")


# ============================================================================
# MANUFACTURERS ENDPOINTS
# ============================================================================

@router.get("/manufacturers/", response_model=ManufacturerListResponse)
async def list_manufacturers(
    x_tenant_id: str = Header(...),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
):
    """List all manufacturers."""
    tenant_id = get_tenant_id(x_tenant_id)
    offset = (page - 1) * limit
    
    with get_db_cursor() as cur:
        base_query = "FROM manufacturers WHERE tenant_id = %s"
        params = [str(tenant_id)]
        
        if search:
            base_query += " AND name ILIKE %s"
            params.append(f"%{search}%")
        
        if is_active is not None:
            base_query += " AND is_active = %s"
            params.append(is_active)
        
        cur.execute(f"SELECT COUNT(*) {base_query}", params)
        total = cur.fetchone()["count"]
        
        cur.execute(
            f"SELECT * {base_query} ORDER BY name LIMIT %s OFFSET %s",
            params + [limit, offset]
        )
        rows = cur.fetchall()
        
        return ManufacturerListResponse(
            manufacturers=[ManufacturerResponse(**dict(row)) for row in rows],
            total=total,
            page=page,
            limit=limit
        )


@router.post("/manufacturers/", response_model=ManufacturerResponse, status_code=201)
async def create_manufacturer(
    data: ManufacturerCreate,
    x_tenant_id: str = Header(...),
):
    """Create a new manufacturer."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Check duplicate
        cur.execute(
            "SELECT id FROM manufacturers WHERE tenant_id = %s AND name = %s",
            (str(tenant_id), data.name)
        )
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Manufacturer already exists")
        
        mfr_id = uuid4()
        cur.execute(
            """
            INSERT INTO manufacturers (id, tenant_id, name, description, contact_info, website, country, is_active, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, true, NOW())
            RETURNING *
            """,
            (str(mfr_id), str(tenant_id), data.name, data.description, data.contact_info, data.website, data.country)
        )
        row = cur.fetchone()
        
        return ManufacturerResponse(**dict(row))


@router.put("/manufacturers/{manufacturer_id}", response_model=ManufacturerResponse)
async def update_manufacturer(
    manufacturer_id: UUID,
    data: ManufacturerUpdate,
    x_tenant_id: str = Header(...),
):
    """Update a manufacturer."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        updates = []
        params = []
        
        for field, value in data.model_dump(exclude_unset=True).items():
            if value is not None:
                updates.append(f"{field} = %s")
                params.append(value)
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        updates.append("updated_at = NOW()")
        params.extend([str(manufacturer_id), str(tenant_id)])
        
        cur.execute(
            f"""
            UPDATE manufacturers SET {', '.join(updates)}
            WHERE id = %s AND tenant_id = %s
            RETURNING *
            """,
            params
        )
        row = cur.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Manufacturer not found")
        
        return ManufacturerResponse(**dict(row))


@router.delete("/manufacturers/{manufacturer_id}", status_code=204)
async def delete_manufacturer(
    manufacturer_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Delete a manufacturer."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute(
            "DELETE FROM manufacturers WHERE id = %s AND tenant_id = %s",
            (str(manufacturer_id), str(tenant_id))
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Manufacturer not found")

