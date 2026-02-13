"""
Utility Helpers
===============
Common utility functions used across services.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime


def generate_code(prefix: str, length: int = 6) -> str:
    """
    Generate a unique code with prefix.
    
    Example: generate_code("ITM") -> "ITM-A1B2C3"
    """
    unique_part = uuid.uuid4().hex[:length].upper()
    return f"{prefix}-{unique_part}"


def slugify(text: str) -> str:
    """
    Convert text to URL-friendly slug.
    
    Example: slugify("Hello World!") -> "hello-world"
    """
    # Convert to lowercase
    text = text.lower()
    # Replace spaces with hyphens
    text = re.sub(r"\s+", "-", text)
    # Remove non-alphanumeric characters (except hyphens)
    text = re.sub(r"[^a-z0-9\-]", "", text)
    # Remove multiple consecutive hyphens
    text = re.sub(r"-+", "-", text)
    # Remove leading/trailing hyphens
    text = text.strip("-")
    return text


def generate_sku_code(
    prefix: str,
    item_name: str,
    variant: str | None = None
) -> str:
    """
    Generate SKU code from item name.
    
    Example: generate_sku_code("NY", "Millet Mlk 200ml") -> "NY-MLTMLK200ML"
    """
    # Clean and uppercase
    name_part = slugify(item_name).upper().replace("-", "")[:15]
    
    if variant:
        variant_part = slugify(variant).upper().replace("-", "")[:5]
        return f"{prefix}-{name_part}-{variant_part}"
    
    return f"{prefix}-{name_part}"


def current_timestamp() -> datetime:
    """Get current UTC timestamp."""
    return datetime.utcnow()




