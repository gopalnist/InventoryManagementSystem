#!/bin/bash
# Backup report-related tables before cleaning or for restore.
# Uses same DB as report-service by default (override with env vars).

set -e
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5441}"
DB_NAME="${DB_NAME:-ams_db}"
DB_USER="${DB_USER:-postgres}"
export PGPASSWORD="${DB_PASSWORD:-mypassword}"

BACKUP_DIR="${BACKUP_DIR:-./scripts/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/report_data_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

echo "Backing up report tables to $BACKUP_FILE ..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -t tenants \
  -t report_uploads \
  -t sales_reports \
  -t inventory_reports \
  -t po_reports \
  -t profit_loss_reports \
  -t ads_reports \
  --data-only \
  --column-inserts \
  -f "$BACKUP_FILE"

echo "Done. Backup saved: $BACKUP_FILE"
unset PGPASSWORD
