"""
Party Models (Suppliers & Customers)
====================================
Pydantic models for party management.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, EmailStr


class PartyType(str, Enum):
    """Type of party."""
    SUPPLIER = "supplier"
    CUSTOMER = "customer"
    BOTH = "both"


class PartyBase(BaseModel):
    """Base party fields."""
    party_code: Optional[str] = Field(None, max_length=50)
    party_name: str = Field(..., min_length=1, max_length=255)
    party_type: PartyType = PartyType.SUPPLIER
    
    # Contact
    contact_person: Optional[str] = Field(None, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    
    # Address
    address: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=50)
    pincode: Optional[str] = Field(None, max_length=10)
    country: str = "India"
    
    # Tax info
    gstin: Optional[str] = Field(None, max_length=20)
    pan: Optional[str] = Field(None, max_length=15)
    
    # Payment
    payment_terms: Optional[str] = Field(None, max_length=50)
    credit_limit: Optional[Decimal] = Field(None)
    credit_days: Optional[int] = None
    
    # Supplier specific
    lead_time_days: Optional[int] = None
    
    # Customer specific
    customer_group: Optional[str] = Field(None, max_length=50)


class PartyCreate(PartyBase):
    """Create party request."""
    pass


class PartyUpdate(BaseModel):
    """Update party request - all fields optional."""
    party_code: Optional[str] = Field(None, max_length=50)
    party_name: Optional[str] = Field(None, min_length=1, max_length=255)
    party_type: Optional[PartyType] = None
    contact_person: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    payment_terms: Optional[str] = None
    credit_limit: Optional[Decimal] = None
    credit_days: Optional[int] = None
    lead_time_days: Optional[int] = None
    customer_group: Optional[str] = None
    is_active: Optional[bool] = None


class PartyResponse(PartyBase):
    """Party response with all fields."""
    id: UUID
    tenant_id: UUID
    is_active: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class PartyListResponse(BaseModel):
    """Paginated party list response."""
    parties: list[PartyResponse]
    total: int
    page: int
    limit: int
    total_pages: int




