"""
Category Models
===============
Pydantic models for category management.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CategoryBase(BaseModel):
    """Base category fields."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    parent_id: Optional[UUID] = None


class CategoryCreate(CategoryBase):
    """Create category request."""
    pass


class CategoryUpdate(BaseModel):
    """Update category request."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    parent_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class CategoryResponse(CategoryBase):
    """Category response with all fields."""
    id: UUID
    tenant_id: UUID
    level: int = 0
    is_active: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Nested children (for tree view)
    children: list["CategoryResponse"] = []
    
    class Config:
        from_attributes = True


class CategoryListResponse(BaseModel):
    """Paginated category list response."""
    categories: list[CategoryResponse]
    total: int
    page: int = 1
    limit: int = 50


class CategoryTreeResponse(BaseModel):
    """Response with category tree."""
    categories: list[CategoryResponse]
    total: int




