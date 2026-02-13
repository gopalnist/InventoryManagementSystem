#!/bin/bash
# Run Reports Service Schema
# ==========================
# This script creates all report tables in the ims_db database

set -e

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-ims_db}"
DB_USER="${DB_USER:-ims_user}"
DB_PASSWORD="${DB_PASSWORD:-ims_password}"

SCHEMA_FILE="services/report-service/app/db/schemas/001_reports_init.sql"

echo "=========================================="
echo "Running Reports Service Schema"
echo "=========================================="
echo ""
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo "Schema File: $SCHEMA_FILE"
echo ""

# Check if PostgreSQL is running
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" > /dev/null 2>&1; then
    echo "❌ ERROR: PostgreSQL is not running!"
    echo "   Please start PostgreSQL first."
    exit 1
fi

# Check if schema file exists
if [ ! -f "$SCHEMA_FILE" ]; then
    echo "❌ ERROR: Schema file not found: $SCHEMA_FILE"
    exit 1
fi

# Run the schema
echo "Running schema..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCHEMA_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Schema executed successfully!"
    echo ""
    echo "Created tables:"
    echo "  - report_channel_configs"
    echo "  - report_uploads"
    echo "  - sales_reports"
    echo "  - inventory_reports"
    echo "  - po_reports"
    echo "  - profit_loss_reports"
    echo "  - ads_reports"
else
    echo ""
    echo "❌ ERROR: Schema execution failed!"
    exit 1
fi

