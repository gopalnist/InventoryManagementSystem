# Master Service

Master data management for the Inventory Management System.

## Overview

The Master Service manages core master data entities:
- **Categories** - Hierarchical product categories
- **Units** - Units of measurement (kg, pcs, liters, etc.)
- **Items** - Products/SKUs with pricing and tracking options
- **Parties** - Suppliers and Customers

## API Endpoints

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/categories` | List categories |
| GET | `/api/v1/categories/tree` | Get category tree |
| GET | `/api/v1/categories/{id}` | Get category |
| POST | `/api/v1/categories` | Create category |
| PUT | `/api/v1/categories/{id}` | Update category |
| DELETE | `/api/v1/categories/{id}` | Delete category |

### Units
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/units` | List units |
| GET | `/api/v1/units/predefined` | Get predefined units |
| POST | `/api/v1/units/setup-defaults` | Create default units |
| GET | `/api/v1/units/{id}` | Get unit |
| POST | `/api/v1/units` | Create unit |
| PUT | `/api/v1/units/{id}` | Update unit |
| DELETE | `/api/v1/units/{id}` | Delete unit |

### Items
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/items` | List items (paginated) |
| GET | `/api/v1/items/{id}` | Get item |
| POST | `/api/v1/items` | Create item |
| PUT | `/api/v1/items/{id}` | Update item |
| DELETE | `/api/v1/items/{id}` | Delete item |
| POST | `/api/v1/items/import` | Bulk import from Excel |

### Parties (Suppliers & Customers)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/parties` | List all parties |
| GET | `/api/v1/parties/suppliers` | List suppliers only |
| GET | `/api/v1/parties/customers` | List customers only |
| GET | `/api/v1/parties/{id}` | Get party |
| POST | `/api/v1/parties` | Create party |
| PUT | `/api/v1/parties/{id}` | Update party |
| DELETE | `/api/v1/parties/{id}` | Delete party |

## Running the Service

### Prerequisites
- Python 3.11+
- PostgreSQL 15+
- Redis (optional, for caching)

### Setup

1. Create virtual environment:
```bash
cd services/master-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set environment variables:
```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=ims_db
export DB_USER=ims_user
export DB_PASSWORD=ims_password
```

4. Create database tables:
```bash
psql -h localhost -U ims_user -d ims_db -f app/db/schema.sql
```

5. Run the service:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
```

### Docker

```bash
docker build -t ims-master-service .
docker run -p 8002:8002 ims-master-service
```

## API Documentation

Once running, access:
- Swagger UI: http://localhost:8002/docs
- ReDoc: http://localhost:8002/redoc

## Headers

All requests must include:
- `X-Tenant-ID`: UUID of the tenant (organization)

Example:
```bash
curl -X GET "http://localhost:8002/api/v1/items" \
  -H "X-Tenant-ID: 550e8400-e29b-41d4-a716-446655440000"
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| DB_HOST | localhost | Database host |
| DB_PORT | 5432 | Database port |
| DB_NAME | ims_db | Database name |
| DB_USER | ims_user | Database user |
| DB_PASSWORD | ims_password | Database password |
| SERVICE_PORT | 8002 | Service port |
| DEBUG | true | Enable debug mode |

## Testing

```bash
pytest tests/ -v
```




