# Database Schema

This directory contains the database schema for the Master Service.

## Schema Files

The schema is organized into separate files for better maintainability:

| File | Description |
|------|-------------|
| `001_init.sql` | Extensions, tenants table, demo tenant |
| `002_categories.sql` | Product categories (hierarchical) |
| `003_units.sql` | Units of measurement with defaults |
| `004_brands_manufacturers.sql` | Brands and manufacturers |
| `005_parties.sql` | Suppliers and customers |
| `006_products.sql` | Products with variants |
| `007_bundles.sql` | Product bundles (Bill of Materials) |
| `008_production.sql` | Production orders |
| `009_custom_fields.sql` | Custom field definitions |

## Running Migrations

### Option 1: Using the Migration Script

```bash
# Set environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=ims_db
export DB_USER=ims_user
export DB_PASSWORD=ims_password

# Create database and run migrations
cd services/master-service
python -m app.db.migrate --create-db

# Check status
python -m app.db.migrate --status
```

### Option 2: Using Docker Compose

```bash
# Start PostgreSQL with auto-migration
docker compose up postgres

# Check if tables are created
docker compose exec postgres psql -U ims_user -d ims_db -c "\dt"
```

### Option 3: Manual with psql

```bash
# Create database
createdb ims_db -U postgres

# Run each schema file in order
cd services/master-service/app/db/schemas
for f in *.sql; do psql -U postgres -d ims_db -f "$f"; done
```

## Database Credentials

Default credentials (for development):

| Setting | Value |
|---------|-------|
| Host | localhost |
| Port | 5432 |
| Database | ims_db |
| User | ims_user |
| Password | ims_password |

## Entity Relationship

```
tenants
    │
    ├── categories (hierarchical)
    ├── units
    ├── brands
    ├── manufacturers
    ├── parties (suppliers/customers)
    │
    ├── products ────────────────────┐
    │      └── product_variants      │
    │                                │
    ├── product_bundles ─────────────┤
    │      └── bundle_components ────┘ (references products/bundles)
    │
    └── production_orders
           ├── production_order_components
           └── production_history
```

## Demo Tenant

A demo tenant is created automatically:
- **ID**: `00000000-0000-0000-0000-000000000001`
- **Name**: Demo Company
- **Slug**: demo

All API requests should include `X-Tenant-ID: 00000000-0000-0000-0000-000000000001` header.

