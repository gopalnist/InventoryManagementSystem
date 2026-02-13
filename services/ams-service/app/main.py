"""
AMS - Allocation Management System
Main application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .api import dashboard, purchase_orders, inventory, warehouses, skus

settings = get_settings()

app = FastAPI(
    title="AMS - Allocation Management System",
    description="Manage inventory allocation for purchase orders from multiple channels",
    version=settings.SERVICE_VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(purchase_orders.router, prefix="/api/v1")
app.include_router(inventory.router, prefix="/api/v1")
app.include_router(warehouses.router, prefix="/api/v1")
app.include_router(skus.router, prefix="/api/v1")


@app.get("/")
def root():
    """Root endpoint - service info."""
    return {
        "service": settings.SERVICE_NAME,
        "version": settings.SERVICE_VERSION,
        "status": "running",
        "endpoints": {
            "dashboard": "/api/v1/dashboard/stats",
            "purchase_orders": "/api/v1/purchase-orders",
            "inventory": "/api/v1/inventory",
            "warehouses": "/api/v1/warehouses",
            "skus": "/api/v1/skus"
        }
    }


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": settings.SERVICE_NAME}
