"""
Outbox Event Models
====================
Pydantic models for the Outbox Pattern - Event Sourcing & Analytics
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class EventStatus(str, Enum):
    """Status of outbox events."""
    PENDING = "pending"
    PROCESSING = "processing"
    PROCESSED = "processed"
    FAILED = "failed"


class EventOperation(str, Enum):
    """Type of operation that triggered the event."""
    INSERT = "INSERT"
    UPDATE = "UPDATE"
    DELETE = "DELETE"


class EventSource(str, Enum):
    """Source of the event."""
    API = "api"
    IMPORT = "import"
    SYSTEM = "system"
    TRIGGER = "trigger"


# ============================================================================
# Outbox Event Models
# ============================================================================

class OutboxEventBase(BaseModel):
    """Base model for outbox events."""
    event_type: str
    aggregate_type: str
    aggregate_id: UUID
    tenant_id: UUID
    payload: dict[str, Any]
    old_payload: Optional[dict[str, Any]] = None
    changes: Optional[dict[str, Any]] = None
    operation: EventOperation
    user_id: Optional[UUID] = None
    user_name: Optional[str] = None
    source: EventSource = EventSource.API
    correlation_id: Optional[UUID] = None


class OutboxEventCreate(OutboxEventBase):
    """Model for creating outbox events manually."""
    pass


class OutboxEventResponse(OutboxEventBase):
    """Response model for outbox events."""
    id: UUID
    event_id: UUID
    version: int = 1
    status: EventStatus = EventStatus.PENDING
    processed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    created_at: datetime
    sequence_number: int

    class Config:
        from_attributes = True


class OutboxEventListResponse(BaseModel):
    """Paginated list of outbox events."""
    items: list[OutboxEventResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ============================================================================
# Event Summary for Analytics
# ============================================================================

class EventSummary(BaseModel):
    """Summary of events by type for analytics dashboards."""
    aggregate_type: str
    event_type: str
    operation: str
    event_count: int
    hour: datetime


class EventSummaryResponse(BaseModel):
    """Response with event summaries."""
    summaries: list[EventSummary]
    period: str  # e.g., "24h", "7d"


# ============================================================================
# Analytics Query Models
# ============================================================================

class EventQueryParams(BaseModel):
    """Query parameters for fetching events."""
    aggregate_type: Optional[str] = None
    aggregate_id: Optional[UUID] = None
    event_type: Optional[str] = None
    operation: Optional[EventOperation] = None
    status: Optional[EventStatus] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=100)


class EventStatistics(BaseModel):
    """Statistics about events for AI/Analytics."""
    total_events: int
    events_by_type: dict[str, int]
    events_by_operation: dict[str, int]
    events_by_status: dict[str, int]
    events_last_hour: int
    events_last_24h: int
    events_last_7d: int


# ============================================================================
# Batch Processing Models
# ============================================================================

class MarkEventsProcessedRequest(BaseModel):
    """Request to mark events as processed."""
    event_ids: list[UUID]


class MarkEventsProcessedResponse(BaseModel):
    """Response after marking events as processed."""
    processed_count: int


class ArchiveEventsRequest(BaseModel):
    """Request to archive old processed events."""
    days_old: int = Field(default=7, ge=1, description="Archive events older than N days")


class ArchiveEventsResponse(BaseModel):
    """Response after archiving events."""
    archived_count: int


# ============================================================================
# AI/Analytics Export Models
# ============================================================================

class EventExportFormat(str, Enum):
    """Export formats for analytics."""
    JSON = "json"
    CSV = "csv"
    PARQUET = "parquet"


class EventExportRequest(BaseModel):
    """Request to export events for analytics."""
    aggregate_types: Optional[list[str]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    format: EventExportFormat = EventExportFormat.JSON
    include_payload: bool = True
    include_changes: bool = True


class EntityTimeline(BaseModel):
    """Timeline of all changes for a specific entity."""
    aggregate_type: str
    aggregate_id: UUID
    events: list[OutboxEventResponse]
    first_event: datetime
    last_event: datetime
    total_changes: int

