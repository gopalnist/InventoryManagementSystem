"""
Sales Service - Main Application
================================
Manages Sales Orders, Invoices, and Fulfillment
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .api import sales_orders, sales_order_import

settings = get_settings()

# Create FastAPI app
app = FastAPI(
    title="IMS Sales Service",
    description="Sales order management for Inventory Management System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.SERVICE_NAME,
        "version": "1.0.0"
    }


# =============================================================================
# SALES ORDER ROUTES
# =============================================================================

app.include_router(
    sales_orders.router,
    prefix="/api/v1/sales-orders",
    tags=["Sales Orders"]
)

app.include_router(
    sales_order_import.router,
    prefix="/api/v1/sales-orders/import",
    tags=["Sales Order Import"]
)


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "service": "Sales Service",
        "version": "1.0.0",
        "endpoints": {
            "sales_orders": "/api/v1/sales-orders",
            "import": "/api/v1/sales-orders/import",
            "docs": "/docs"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.SERVICE_PORT,
        reload=settings.DEBUG
    )
