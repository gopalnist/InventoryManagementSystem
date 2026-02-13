"""
Common Pydantic Models
======================
Shared models used across all microservices.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, Field


# Generic type for data payload
T = TypeVar("T")


class TenantMixin(BaseModel):
    """Mixin for tenant-scoped entities."""
    tenant_id: UUID


class TimestampMixin(BaseModel):
    """Mixin for entities with timestamps."""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class PaginationMeta(BaseModel):
    """Pagination metadata."""
    page: int = 1
    limit: int = 20
    total: int = 0
    total_pages: int = 0


class BaseResponse(BaseModel, Generic[T]):
    """Standard success response."""
    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated list response."""
    success: bool = True
    data: list[T] = []
    meta: PaginationMeta = Field(default_factory=PaginationMeta)


class ErrorDetail(BaseModel):
    """Error detail structure."""
    code: str
    message: str
    details: Optional[dict[str, Any]] = None


class ErrorResponse(BaseModel):
    """Standard error response."""
    success: bool = False
    error: ErrorDetail


# Common query parameters
class PaginationParams(BaseModel):
    """Common pagination parameters."""
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)
    
    @property
    def offset(self) -> int:
        return (self.page - 1) * self.limit


class SortParams(BaseModel):
    """Common sorting parameters."""
    sort_by: str = "created_at"
    sort_order: str = Field(default="desc", pattern="^(asc|desc)$")




