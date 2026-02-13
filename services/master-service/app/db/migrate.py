#!/usr/bin/env python3
"""
Database Migration Runner
=========================
Runs SQL schema files in order to set up the database.
"""

import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(project_root))

import psycopg2
from psycopg2.extras import RealDictCursor


def get_db_config():
    """Get database configuration from environment variables."""
    return {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "5432")),
        "dbname": os.getenv("DB_NAME", "ims_db"),
        "user": os.getenv("DB_USER", "ims_user"),
        "password": os.getenv("DB_PASSWORD", "ims_password"),
    }


def get_connection(dbname=None):
    """Create database connection."""
    config = get_db_config()
    if dbname:
        config["dbname"] = dbname
    return psycopg2.connect(**config)


def get_schema_files():
    """Get all schema files in order."""
    schema_dir = Path(__file__).parent / "schemas"
    if not schema_dir.exists():
        print(f"Schema directory not found: {schema_dir}")
        return []
    
    files = sorted(schema_dir.glob("*.sql"))
    return files


def create_database_if_not_exists():
    """Create the database if it doesn't exist."""
    config = get_db_config()
    db_name = config["dbname"]
    
    # Connect to default postgres database
    try:
        conn = psycopg2.connect(
            host=config["host"],
            port=config["port"],
            dbname="postgres",
            user=config["user"],
            password=config["password"],
        )
        conn.autocommit = True
        
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
            exists = cur.fetchone()
            
            if not exists:
                print(f"Creating database: {db_name}")
                cur.execute(f'CREATE DATABASE "{db_name}"')
                print(f"  ✓ Database created")
            else:
                print(f"Database already exists: {db_name}")
        
        conn.close()
        return True
        
    except psycopg2.OperationalError as e:
        print(f"\n❌ Could not connect to PostgreSQL!")
        print(f"   Error: {e}")
        print(f"\n   Make sure PostgreSQL is running and the credentials are correct:")
        print(f"   - Host: {config['host']}")
        print(f"   - Port: {config['port']}")
        print(f"   - User: {config['user']}")
        print(f"\n   You can set these via environment variables:")
        print(f"   export DB_HOST=localhost")
        print(f"   export DB_PORT=5432")
        print(f"   export DB_NAME=ims_db")
        print(f"   export DB_USER=postgres")
        print(f"   export DB_PASSWORD=your_password")
        return False


def run_migrations(verbose=True):
    """Run all migration files."""
    schema_files = get_schema_files()
    
    if not schema_files:
        print("No schema files found!")
        return False
    
    print(f"\n{'='*60}")
    print("DATABASE MIGRATION")
    print(f"{'='*60}\n")
    print(f"Found {len(schema_files)} schema file(s) to process:\n")
    
    for f in schema_files:
        print(f"  - {f.name}")
    
    print()
    
    try:
        conn = get_connection()
    except psycopg2.OperationalError as e:
        print(f"\n❌ Could not connect to database!")
        print(f"   Error: {e}")
        return False
    
    success_count = 0
    error_count = 0
    
    with conn.cursor() as cur:
        for schema_file in schema_files:
            print(f"Running: {schema_file.name}...", end=" ")
            
            try:
                sql = schema_file.read_text()
                cur.execute(sql)
                conn.commit()
                print("✓")
                success_count += 1
            except Exception as e:
                conn.rollback()
                print(f"✗")
                print(f"         Error: {e}")
                error_count += 1
                if verbose:
                    import traceback
                    traceback.print_exc()
    
    conn.close()
    
    print(f"\n{'='*60}")
    if error_count == 0:
        print(f"✓ Migration completed successfully! ({success_count} files)")
    else:
        print(f"⚠ Migration completed with errors: {success_count} success, {error_count} failed")
    print(f"{'='*60}\n")
    
    return error_count == 0


def show_status():
    """Show current database status."""
    config = get_db_config()
    
    print(f"\n{'='*60}")
    print("DATABASE STATUS")
    print(f"{'='*60}\n")
    
    print(f"Configuration:")
    print(f"  Host: {config['host']}")
    print(f"  Port: {config['port']}")
    print(f"  Database: {config['dbname']}")
    print(f"  User: {config['user']}")
    
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        # Check tables
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        """)
        tables = [row[0] for row in cur.fetchall()]
        
        print(f"\n  Tables ({len(tables)}):")
        for t in tables:
            cur.execute(f"SELECT COUNT(*) FROM {t}")
            count = cur.fetchone()[0]
            print(f"    - {t}: {count} rows")
        
        conn.close()
        print(f"\n  Status: ✓ Connected")
        
    except Exception as e:
        print(f"\n  Status: ✗ Cannot connect")
        print(f"  Error: {e}")


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Run database migrations")
    parser.add_argument("--create-db", action="store_true", help="Create database if not exists")
    parser.add_argument("--status", action="store_true", help="Show database status")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    args = parser.parse_args()
    
    if args.status:
        show_status()
        return
    
    print("\n🚀 Starting database migration...\n")
    
    if args.create_db:
        if not create_database_if_not_exists():
            sys.exit(1)
    
    if not run_migrations(verbose=args.verbose):
        sys.exit(1)


if __name__ == "__main__":
    main()
