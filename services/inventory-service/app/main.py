"""
Inventory Service - Main Application
=====================================
Manages warehouses, inventory levels, stock movements, and adjustments
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .api import warehouses, inventory, stock_movements, reports

settings = get_settings()

# Create FastAPI app
app = FastAPI(
    title="IMS Inventory Service",
    description="Warehouse and inventory management for Inventory Management System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
# WAREHOUSE ROUTES
# =============================================================================

app.include_router(
    warehouses.router,
    prefix="/api/v1/warehouses",
    tags=["Warehouses"]
)


# =============================================================================
# INVENTORY ROUTES
# =============================================================================

app.include_router(
    inventory.router,
    prefix="/api/v1/inventory",
    tags=["Inventory"]
)


# =============================================================================
# STOCK MOVEMENTS ROUTES
# =============================================================================

app.include_router(
    stock_movements.router,
    prefix="/api/v1/stock-movements",
    tags=["Stock Movements"]
)


# =============================================================================
# REPORTS ROUTES
# =============================================================================

app.include_router(
    reports.router,
    prefix="/api/v1/inventory-reports",
    tags=["Inventory Reports"]
)


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "service": "Inventory Service",
        "version": "1.0.0",
        "endpoints": {
            "warehouses": "/api/v1/warehouses",
            "inventory": "/api/v1/inventory",
            "stock_movements": "/api/v1/stock-movements",
            "reports": "/api/v1/inventory-reports",
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


