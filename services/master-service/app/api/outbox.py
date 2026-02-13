"""
Outbox API Routes
==================
Endpoints for querying and managing outbox events for analytics and AI.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from ..models.outbox import (
    OutboxEventResponse, OutboxEventListResponse,
    EventSummary, EventSummaryResponse,
    EventStatistics, MarkEventsProcessedRequest, MarkEventsProcessedResponse,
    ArchiveEventsRequest, ArchiveEventsResponse, EntityTimeline,
    EventStatus, EventOperation
)
from shared.db.connection import get_db_cursor

router = APIRouter()


# ============================================================================
# Query Events
# ============================================================================

@router.get("/", response_model=OutboxEventListResponse)
async def list_events(
    aggregate_type: Optional[str] = Query(None, description="Filter by entity type"),
    aggregate_id: Optional[UUID] = Query(None, description="Filter by entity ID"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    operation: Optional[EventOperation] = Query(None, description="Filter by operation"),
    status: Optional[EventStatus] = Query(None, description="Filter by status"),
    start_date: Optional[datetime] = Query(None, description="Events after this date"),
    end_date: Optional[datetime] = Query(None, description="Events before this date"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    tenant_id: UUID = Query(..., description="Tenant ID"),
):
    """
    List outbox events with filtering and pagination.
    Useful for analytics dashboards and AI processing.
    """
    try:
        with get_db_cursor() as cur:
            # Build WHERE clause
            conditions = ["tenant_id = %s"]
            params: list = [str(tenant_id)]
            
            if aggregate_type:
                conditions.append("aggregate_type = %s")
                params.append(aggregate_type)
            
            if aggregate_id:
                conditions.append("aggregate_id = %s")
                params.append(str(aggregate_id))
            
            if event_type:
                conditions.append("event_type = %s")
                params.append(event_type)
            
            if operation:
                conditions.append("operation = %s")
                params.append(operation.value)
            
            if status:
                conditions.append("status = %s")
                params.append(status.value)
            
            if start_date:
                conditions.append("created_at >= %s")
                params.append(start_date)
            
            if end_date:
                conditions.append("created_at <= %s")
                params.append(end_date)
            
            where_clause = " AND ".join(conditions)
            
            # Count total
            cur.execute(f"SELECT COUNT(*) as count FROM outbox WHERE {where_clause}", params)
            total = cur.fetchone()["count"]
            
            # Get paginated results
            offset = (page - 1) * per_page
            cur.execute(f"""
                SELECT * FROM outbox
                WHERE {where_clause}
                ORDER BY sequence_number DESC
                LIMIT %s OFFSET %s
            """, params + [per_page, offset])
            
            events = cur.fetchall()
            
            return OutboxEventListResponse(
                items=[OutboxEventResponse(**dict(e)) for e in events],
                total=total,
                page=page,
                per_page=per_page,
                pages=(total + per_page - 1) // per_page if total > 0 else 0
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pending", response_model=list[OutboxEventResponse])
async def get_pending_events(
    limit: int = Query(100, ge=1, le=1000),
    tenant_id: UUID = Query(..., description="Tenant ID"),
):
    """
    Get pending events for processing.
    Used by event processors/consumers.
    """
    try:
        with get_db_cursor() as cur:
            cur.execute("""
                SELECT * FROM outbox
                WHERE tenant_id = %s AND status = 'pending'
                ORDER BY sequence_number
                LIMIT %s
            """, [str(tenant_id), limit])
            
            events = cur.fetchall()
            return [OutboxEventResponse(**dict(e)) for e in events]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{event_id}", response_model=OutboxEventResponse)
async def get_event(event_id: UUID):
    """Get a specific event by ID."""
    try:
        with get_db_cursor() as cur:
            cur.execute("SELECT * FROM outbox WHERE event_id = %s", [str(event_id)])
            event = cur.fetchone()
            
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            
            return OutboxEventResponse(**dict(event))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Entity Timeline (for AI analysis)
# ============================================================================

@router.get("/timeline/{aggregate_type}/{aggregate_id}", response_model=EntityTimeline)
async def get_entity_timeline(
    aggregate_type: str,
    aggregate_id: UUID,
    tenant_id: UUID = Query(..., description="Tenant ID"),
):
    """
    Get the complete timeline of changes for a specific entity.
    Useful for AI to understand entity history and patterns.
    """
    try:
        with get_db_cursor() as cur:
            cur.execute("""
                SELECT * FROM outbox
                WHERE tenant_id = %s AND aggregate_type = %s AND aggregate_id = %s
                ORDER BY sequence_number
            """, [str(tenant_id), aggregate_type, str(aggregate_id)])
            
            events = cur.fetchall()
            
            if not events:
                raise HTTPException(status_code=404, detail="No events found for this entity")
            
            event_responses = [OutboxEventResponse(**dict(e)) for e in events]
            
            return EntityTimeline(
                aggregate_type=aggregate_type,
                aggregate_id=aggregate_id,
                events=event_responses,
                first_event=event_responses[0].created_at,
                last_event=event_responses[-1].created_at,
                total_changes=len(event_responses)
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Analytics & Statistics
# ============================================================================

@router.get("/stats/summary", response_model=EventSummaryResponse)
async def get_event_summary(
    tenant_id: UUID = Query(..., description="Tenant ID"),
    hours: int = Query(24, ge=1, le=168, description="Hours to look back"),
):
    """
    Get event summary grouped by type and operation.
    For analytics dashboards.
    """
    try:
        with get_db_cursor() as cur:
            cur.execute("""
                SELECT 
                    aggregate_type,
                    event_type,
                    operation,
                    COUNT(*) as event_count,
                    DATE_TRUNC('hour', created_at) as hour
                FROM outbox
                WHERE tenant_id = %s AND created_at > NOW() - INTERVAL '%s hours'
                GROUP BY aggregate_type, event_type, operation, DATE_TRUNC('hour', created_at)
                ORDER BY hour DESC
            """, [str(tenant_id), hours])
            
            summaries = [EventSummary(**dict(row)) for row in cur.fetchall()]
            
            return EventSummaryResponse(
                summaries=summaries,
                period=f"{hours}h"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/overview", response_model=EventStatistics)
async def get_event_statistics(
    tenant_id: UUID = Query(..., description="Tenant ID"),
):
    """
    Get comprehensive event statistics.
    For AI/ML analysis and monitoring.
    """
    try:
        with get_db_cursor() as cur:
            # Total events
            cur.execute("SELECT COUNT(*) as count FROM outbox WHERE tenant_id = %s", [str(tenant_id)])
            total_events = cur.fetchone()["count"]
            
            # Events by type
            cur.execute("""
                SELECT aggregate_type, COUNT(*) as count
                FROM outbox WHERE tenant_id = %s
                GROUP BY aggregate_type
            """, [str(tenant_id)])
            events_by_type = {row["aggregate_type"]: row["count"] for row in cur.fetchall()}
            
            # Events by operation
            cur.execute("""
                SELECT operation, COUNT(*) as count
                FROM outbox WHERE tenant_id = %s
                GROUP BY operation
            """, [str(tenant_id)])
            events_by_operation = {row["operation"]: row["count"] for row in cur.fetchall()}
            
            # Events by status
            cur.execute("""
                SELECT status, COUNT(*) as count
                FROM outbox WHERE tenant_id = %s
                GROUP BY status
            """, [str(tenant_id)])
            events_by_status = {row["status"]: row["count"] for row in cur.fetchall()}
            
            # Time-based stats
            cur.execute("""
                SELECT 
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as last_hour,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d
                FROM outbox WHERE tenant_id = %s
            """, [str(tenant_id)])
            time_stats = cur.fetchone()
            
            return EventStatistics(
                total_events=total_events,
                events_by_type=events_by_type,
                events_by_operation=events_by_operation,
                events_by_status=events_by_status,
                events_last_hour=time_stats["last_hour"],
                events_last_24h=time_stats["last_24h"],
                events_last_7d=time_stats["last_7d"]
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Event Processing
# ============================================================================

@router.post("/mark-processed", response_model=MarkEventsProcessedResponse)
async def mark_events_processed(request: MarkEventsProcessedRequest):
    """
    Mark events as processed.
    Called by event processors after successfully handling events.
    """
    try:
        with get_db_cursor() as cur:
            event_ids = [str(e) for e in request.event_ids]
            cur.execute("""
                UPDATE outbox
                SET status = 'processed', processed_at = NOW()
                WHERE event_id = ANY(%s) AND status = 'pending'
            """, [event_ids])
            
            # Get affected rows count
            cur.execute("SELECT COUNT(*) as count FROM outbox WHERE event_id = ANY(%s) AND status = 'processed'", [event_ids])
            processed_count = cur.fetchone()["count"]
            
            return MarkEventsProcessedResponse(processed_count=processed_count)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/archive", response_model=ArchiveEventsResponse)
async def archive_old_events(request: ArchiveEventsRequest):
    """
    Archive old processed events to the archive table.
    Keeps the main outbox table lean while preserving data for analytics.
    """
    try:
        with get_db_cursor() as cur:
            cur.execute("SELECT archive_processed_events(%s)", [request.days_old])
            archived_count = cur.fetchone()[0]
            
            return ArchiveEventsResponse(archived_count=archived_count)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# AI/Analytics Export
# ============================================================================

@router.get("/export/json")
async def export_events_json(
    tenant_id: UUID = Query(..., description="Tenant ID"),
    aggregate_types: Optional[str] = Query(None, description="Comma-separated list of types"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(1000, ge=1, le=10000),
):
    """
    Export events as JSON for AI/ML processing.
    Returns raw event data optimized for analysis.
    """
    try:
        with get_db_cursor() as cur:
            conditions = ["tenant_id = %s"]
            params: list = [str(tenant_id)]
            
            if aggregate_types:
                types_list = [t.strip() for t in aggregate_types.split(",")]
                conditions.append("aggregate_type = ANY(%s)")
                params.append(types_list)
            
            if start_date:
                conditions.append("created_at >= %s")
                params.append(start_date)
            
            if end_date:
                conditions.append("created_at <= %s")
                params.append(end_date)
            
            where_clause = " AND ".join(conditions)
            
            cur.execute(f"""
                SELECT 
                    event_id,
                    event_type,
                    aggregate_type,
                    aggregate_id,
                    operation,
                    payload,
                    changes,
                    created_at
                FROM outbox
                WHERE {where_clause}
                ORDER BY sequence_number
                LIMIT %s
            """, params + [limit])
            
            events = [dict(row) for row in cur.fetchall()]
            
            # Convert UUIDs and datetimes to strings for JSON
            for event in events:
                event["event_id"] = str(event["event_id"])
                event["aggregate_id"] = str(event["aggregate_id"])
                event["created_at"] = event["created_at"].isoformat()
            
            return {
                "export_date": datetime.now().isoformat(),
                "tenant_id": str(tenant_id),
                "event_count": len(events),
                "events": events
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_events(
    tenant_id: UUID = Query(..., description="Tenant ID"),
    query: str = Query(..., min_length=2, description="Search in payload"),
    limit: int = Query(50, ge=1, le=200),
):
    """
    Full-text search in event payloads.
    Useful for AI to find specific patterns or data.
    """
    try:
        with get_db_cursor() as cur:
            # Use PostgreSQL's JSONB containment operator for search
            cur.execute("""
                SELECT * FROM outbox
                WHERE tenant_id = %s 
                AND (
                    payload::text ILIKE %s
                    OR changes::text ILIKE %s
                )
                ORDER BY created_at DESC
                LIMIT %s
            """, [str(tenant_id), f"%{query}%", f"%{query}%", limit])
            
            events = cur.fetchall()
            return {
                "query": query,
                "results": [OutboxEventResponse(**dict(e)) for e in events],
                "count": len(events)
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

