"""
Report Service - Main Application
==================================
Multi-channel report upload and management service
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .api import reports

# Initialize settings to set environment variables for shared.db
settings = get_settings()

# Create FastAPI app
app = FastAPI(
    title="IMS Report Service",
    description="Multi-channel report upload and management for Inventory Management System",
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
# REPORTS ROUTES
# =============================================================================

app.include_router(
    reports.router,
    prefix="/api/v1/reports",
    tags=["Reports"]
)


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "service": "Report Service",
        "version": "1.0.0",
        "endpoints": {
            "reports": "/api/v1/reports",
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

