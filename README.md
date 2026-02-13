# Inventory Management System (IMS)

A multi-tenant, microservices-based Inventory Management System built with Python and FastAPI.

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    INVENTORY MANAGEMENT SYSTEM                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│   │    AUTH     │  │   MASTER    │  │  WAREHOUSE  │                 │
│   │   SERVICE   │  │   SERVICE   │  │   SERVICE   │                 │
│   │   :8001     │  │   :8002     │  │   :8003     │                 │
│   └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                      │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│   │  INVENTORY  │  │  PURCHASE   │  │    SALES    │                 │
│   │   SERVICE   │  │   SERVICE   │  │   SERVICE   │                 │
│   │   :8004     │  │   :8005     │  │   :8006     │                 │
│   └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                      │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│   │   REPORTS   │  │ INTEGRATION │  │ PRODUCTION  │                 │
│   │   SERVICE   │  │   SERVICE   │  │   SERVICE   │                 │
│   │   :8007     │  │   :8008     │  │   :8009     │                 │
│   └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## 📦 Services

| Service | Port | Description | Status |
|---------|------|-------------|--------|
| Auth Service | 8001 | Authentication, Users, Tenants | 🔴 Planned |
| **Master Service** | 8002 | Items, Categories, Parties | 🟢 Ready |
| Warehouse Service | 8003 | Warehouses, Locations | 🔴 Planned |
| Inventory Service | 8004 | Stock, Transactions | 🔴 Planned |
| Purchase Service | 8005 | Purchase Orders, GRN | 🔴 Planned |
| Sales Service | 8006 | Sales Orders, Fulfillment | 🔴 Planned |
| Reports Service | 8007 | Dashboards, Reports | 🔴 Planned |
| Integration Service | 8008 | Amazon, Zepto sync | 🔴 Planned |
| Production Service | 8009 | BOM, Work Orders | 🔴 Planned |

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- PostgreSQL 15+
- Redis 7+

### Setup Database

```bash
# Create database
psql -U postgres -c "CREATE DATABASE ims_db;"
psql -U postgres -c "CREATE USER ims_user WITH PASSWORD 'ims_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE ims_db TO ims_user;"

# Create tables for Master Service
psql -U ims_user -d ims_db -f services/master-service/app/db/schema.sql
```

### Run Master Service

```bash
cd services/master-service
python -m venv venv
source venv/bin/activate
pip install -r ../../requirements.txt

# Set environment variables
export DB_HOST=localhost
export DB_NAME=ims_db
export DB_USER=ims_user
export DB_PASSWORD=ims_password

# Run
uvicorn app.main:app --port 8002 --reload
```

### Test API

```bash
# Health check
curl http://localhost:8002/health

# Create a category (replace tenant-id with valid UUID)
curl -X POST "http://localhost:8002/api/v1/categories" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{"name": "Beverages", "description": "Drinks and beverages"}'
```

## 📁 Project Structure

```
InventoryManagementSystem/
├── docs/
│   └── SYSTEM_DESIGN.md       # Full system design document
├── shared/                     # Shared utilities
│   ├── db/                     # Database connection
│   ├── models/                 # Common Pydantic models
│   └── utils/                  # Helper functions
├── services/
│   ├── master-service/         # Master data (Items, Categories)
│   ├── auth-service/           # Authentication (Planned)
│   ├── warehouse-service/      # Warehouses (Planned)
│   ├── inventory-service/      # Stock tracking (Planned)
│   └── ...
├── requirements.txt
└── README.md
```

## 📖 Documentation

- [System Design Document](docs/SYSTEM_DESIGN.md) - Complete HLD/LLD
- [Master Service README](services/master-service/README.md) - API docs

## 🛠️ Technology Stack

- **Language:** Python 3.11+
- **Framework:** FastAPI
- **Database:** PostgreSQL 15
- **Cache:** Redis
- **Validation:** Pydantic
- **Task Queue:** Celery (planned)

## 📝 License

MIT License




