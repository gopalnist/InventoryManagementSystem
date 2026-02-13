"""
Categories API Routes
=====================
CRUD operations for product categories.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Query, Header

# Add shared to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent.parent))

from shared.db import get_db_cursor

from ..models.category import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    CategoryTreeResponse,
)

router = APIRouter()


# --- Helper Functions ---

def get_tenant_id(x_tenant_id: str = Header(...)) -> UUID:
    """Extract tenant ID from header."""
    try:
        return UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant ID")


# --- API Endpoints ---

@router.get("", response_model=CategoryTreeResponse)
async def list_categories(
    x_tenant_id: str = Header(...),
    parent_id: Optional[UUID] = Query(None, description="Filter by parent category"),
    include_inactive: bool = Query(False, description="Include inactive categories"),
):
    """
    List all categories for the tenant.
    
    Returns a flat list. Use parent_id to filter by parent.
    """
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        query = """
            SELECT id, tenant_id, name, description, parent_id, level, 
                   is_active, created_at, updated_at
            FROM categories
            WHERE tenant_id = %s
        """
        params = [str(tenant_id)]
        
        if parent_id:
            query += " AND parent_id = %s"
            params.append(str(parent_id))
        else:
            query += " AND parent_id IS NULL"
        
        if not include_inactive:
            query += " AND is_active = true"
        
        query += " ORDER BY name"
        
        cur.execute(query, params)
        rows = cur.fetchall()
        
        categories = [CategoryResponse(**dict(row)) for row in rows]
        
        return CategoryTreeResponse(categories=categories, total=len(categories))


@router.get("/tree", response_model=CategoryTreeResponse)
async def get_category_tree(
    x_tenant_id: str = Header(...),
    include_inactive: bool = Query(False),
):
    """
    Get categories as a nested tree structure.
    """
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        query = """
            SELECT id, tenant_id, name, description, parent_id, level,
                   is_active, created_at, updated_at
            FROM categories
            WHERE tenant_id = %s
        """
        params = [str(tenant_id)]
        
        if not include_inactive:
            query += " AND is_active = true"
        
        query += " ORDER BY level, name"
        
        cur.execute(query, params)
        rows = cur.fetchall()
        
        # Build tree
        categories_map = {}
        root_categories = []
        
        for row in rows:
            cat = CategoryResponse(**dict(row), children=[])
            categories_map[str(cat.id)] = cat
            
            if cat.parent_id is None:
                root_categories.append(cat)
            else:
                parent = categories_map.get(str(cat.parent_id))
                if parent:
                    parent.children.append(cat)
        
        return CategoryTreeResponse(categories=root_categories, total=len(rows))


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Get a single category by ID."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT id, tenant_id, name, description, parent_id, level,
                   is_active, created_at, updated_at
            FROM categories
            WHERE id = %s AND tenant_id = %s
            """,
            (str(category_id), str(tenant_id))
        )
        row = cur.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Category not found")
        
        return CategoryResponse(**dict(row))


@router.post("", response_model=CategoryResponse, status_code=201)
async def create_category(
    data: CategoryCreate,
    x_tenant_id: str = Header(...),
):
    """Create a new category."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Determine level
        level = 0
        if data.parent_id:
            cur.execute(
                "SELECT level FROM categories WHERE id = %s AND tenant_id = %s",
                (str(data.parent_id), str(tenant_id))
            )
            parent = cur.fetchone()
            if not parent:
                raise HTTPException(status_code=400, detail="Parent category not found")
            level = parent["level"] + 1
        
        # Check for duplicate name at same level
        cur.execute(
            """
            SELECT id FROM categories 
            WHERE tenant_id = %s AND name = %s AND parent_id IS NOT DISTINCT FROM %s
            """,
            (str(tenant_id), data.name, str(data.parent_id) if data.parent_id else None)
        )
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Category with this name already exists")
        
        # Insert
        category_id = uuid4()
        cur.execute(
            """
            INSERT INTO categories (id, tenant_id, name, description, parent_id, level, is_active, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, true, NOW())
            RETURNING id, tenant_id, name, description, parent_id, level, is_active, created_at, updated_at
            """,
            (
                str(category_id),
                str(tenant_id),
                data.name,
                data.description,
                str(data.parent_id) if data.parent_id else None,
                level
            )
        )
        row = cur.fetchone()
        
        return CategoryResponse(**dict(row))


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: UUID,
    data: CategoryUpdate,
    x_tenant_id: str = Header(...),
):
    """Update an existing category."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Check exists
        cur.execute(
            "SELECT id FROM categories WHERE id = %s AND tenant_id = %s",
            (str(category_id), str(tenant_id))
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Category not found")
        
        # Build update query
        updates = []
        params = []
        
        if data.name is not None:
            updates.append("name = %s")
            params.append(data.name)
        if data.description is not None:
            updates.append("description = %s")
            params.append(data.description)
        if data.is_active is not None:
            updates.append("is_active = %s")
            params.append(data.is_active)
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        updates.append("updated_at = NOW()")
        params.extend([str(category_id), str(tenant_id)])
        
        cur.execute(
            f"""
            UPDATE categories 
            SET {', '.join(updates)}
            WHERE id = %s AND tenant_id = %s
            RETURNING id, tenant_id, name, description, parent_id, level, is_active, created_at, updated_at
            """,
            params
        )
        row = cur.fetchone()
        
        return CategoryResponse(**dict(row))


@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: UUID,
    x_tenant_id: str = Header(...),
):
    """
    Delete a category.
    
    Note: Will fail if category has child categories or items.
    """
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Check for children
        cur.execute(
            "SELECT id FROM categories WHERE parent_id = %s AND tenant_id = %s LIMIT 1",
            (str(category_id), str(tenant_id))
        )
        if cur.fetchone():
            raise HTTPException(
                status_code=409,
                detail="Cannot delete category with child categories"
            )
        
        # Check for items
        cur.execute(
            "SELECT id FROM items WHERE category_id = %s AND tenant_id = %s LIMIT 1",
            (str(category_id), str(tenant_id))
        )
        if cur.fetchone():
            raise HTTPException(
                status_code=409,
                detail="Cannot delete category with items. Reassign items first."
            )
        
        # Delete
        cur.execute(
            "DELETE FROM categories WHERE id = %s AND tenant_id = %s",
            (str(category_id), str(tenant_id))
        )
        
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Category not found")




