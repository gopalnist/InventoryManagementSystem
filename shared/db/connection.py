"""
Database Connection Utilities
=============================
Shared database connection for all microservices.
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Any, Generator

import psycopg2
from psycopg2.extras import RealDictCursor


def get_db_config() -> dict[str, Any]:
    """Get database configuration from environment variables."""
    return {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "5441")),
        "dbname": os.getenv("DB_NAME", "ims_db"),
        "user": os.getenv("DB_USER", "postgres"),
        "password": os.getenv("DB_PASSWORD", "mypassword"),
    }


def get_connection():
    """Get a new database connection."""
    config = get_db_config()
    return psycopg2.connect(**config)


@contextmanager
def get_db_cursor(
    dict_cursor: bool = True,
    autocommit: bool = False
) -> Generator[Any, None, None]:
    """
    Context manager for database cursor.
    
    Args:
        dict_cursor: If True, returns results as dictionaries
        autocommit: If True, autocommit is enabled
    
    Usage:
        with get_db_cursor() as cur:
            cur.execute("SELECT * FROM items")
            rows = cur.fetchall()
    """
    conn = get_connection()
    conn.autocommit = autocommit
    
    cursor_factory = RealDictCursor if dict_cursor else None
    cur = conn.cursor(cursor_factory=cursor_factory)
    
    try:
        yield cur
        if not autocommit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()




