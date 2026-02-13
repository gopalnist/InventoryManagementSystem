"""
Master Service - Main Application
==================================
Manages master data: Products, Categories, Units, Parties, Bundles, Production
Note: Sales Orders moved to separate sales-service (port 8002)
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .api import categories, items, units, parties, products, bundles, production, outbox, dashboard, purchase_orders

settings = get_settings()

# Create FastAPI app
app = FastAPI(
    title="IMS Master Service",
    description="Master data management for Inventory Management System",
    version="2.0.0",
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
        "version": "2.0.0"
    }


# =============================================================================
# DASHBOARD ROUTES (Optimized for performance)
# =============================================================================

app.include_router(
    dashboard.router,
    prefix="/api/v1/dashboard",
    tags=["Dashboard"]
)


# =============================================================================
# PRODUCTS & CATALOG ROUTES
# =============================================================================

app.include_router(
    products.router,
    prefix="/api/v1/products",
    tags=["Products"]
)

app.include_router(
    bundles.router,
    prefix="/api/v1/bundles",
    tags=["Product Bundles"]
)

app.include_router(
    categories.router,
    prefix="/api/v1/categories",
    tags=["Categories"]
)

app.include_router(
    units.router,
    prefix="/api/v1/units",
    tags=["Units"]
)

# Legacy items route (backward compatibility - points to products)
app.include_router(
    items.router,
    prefix="/api/v1/items",
    tags=["Items (Legacy)"],
    deprecated=True
)


# =============================================================================
# PRODUCTION ROUTES
# =============================================================================

app.include_router(
    production.router,
    prefix="/api/v1/production",
    tags=["Production Orders"]
)


# =============================================================================
# PURCHASE ORDERS ROUTES
# =============================================================================

app.include_router(
    purchase_orders.router,
    prefix="/api/v1/purchase-orders",
    tags=["Purchase Orders"]
)


# =============================================================================
# CONTACTS ROUTES
# =============================================================================

app.include_router(
    parties.router,
    prefix="/api/v1/parties",
    tags=["Parties"]
)


# =============================================================================
# OUTBOX ROUTES (Event Sourcing for AI/Analytics)
# =============================================================================

app.include_router(
    outbox.router,
    prefix="/api/v1/outbox",
    tags=["Outbox (Events)"]
)


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "service": "Master Service",
        "version": "2.0.0",
        "note": "Sales Orders moved to sales-service (port 8002)",
        "endpoints": {
            "dashboard": "/api/v1/dashboard",
            "products": "/api/v1/products",
            "bundles": "/api/v1/bundles",
            "categories": "/api/v1/categories",
            "units": "/api/v1/units",
            "production": "/api/v1/production",
            "purchase_orders": "/api/v1/purchase-orders",
            "parties": "/api/v1/parties",
            "outbox": "/api/v1/outbox",
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


