# Inventory Management System (IMS)
## System Design Document

> **Version:** 1.0.0  
> **Created:** January 11, 2026  
> **Last Updated:** January 11, 2026  
> **Author:** Development Team  
> **Status:** Planning Phase

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [High-Level Design (HLD)](#2-high-level-design-hld)
3. [Low-Level Design (LLD)](#3-low-level-design-lld)
4. [Database Design](#4-database-design)
5. [API Specifications](#5-api-specifications)
6. [Implementation Roadmap](#6-implementation-roadmap)
7. [Technology Stack](#7-technology-stack)
8. [Security Design](#8-security-design)
9. [Deployment Architecture](#9-deployment-architecture)
10. [Change Log](#10-change-log)

---

# 1. Project Overview

## 1.1 Vision
A **multi-tenant, microservices-based Inventory Management System** that can be used by any vendor/business across different industries.

## 1.2 Objectives
- Provide a scalable inventory management solution
- Support multiple industries (Food, Electronics, Apparel, Pharma, FMCG, etc.)
- Enable multi-channel sales integration (Amazon, Zepto, Flipkart, etc.)
- Offer configurable features based on industry needs
- Ensure data isolation between tenants

## 1.3 Target Industries

| Industry | Key Features Required |
|----------|----------------------|
| Food & Beverage | Batch tracking, Expiry dates, FSSAI compliance |
| Electronics | Serial numbers, Warranty tracking, RMA |
| Apparel/Fashion | Size/Color variants, Season codes |
| Pharmaceuticals | Batch, Expiry, Drug license, Cold chain |
| FMCG | Fast turnover, Promotional packs |
| Auto Parts | Part numbers, Vehicle compatibility |
| General Trading | Basic stock tracking |

## 1.4 Key Stakeholders
- **Vendors/Businesses** - End users of the system
- **Warehouse Staff** - Daily operations
- **Sales Teams** - Order processing
- **Management** - Reports and analytics
- **System Admins** - Configuration and setup

---

# 2. High-Level Design (HLD)

## 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     INVENTORY MANAGEMENT SYSTEM                             │
│                      Microservices Architecture                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                              ┌──────────────┐                               │
│                              │   FRONTEND   │                               │
│                              │  (React/Vue) │                               │
│                              └──────┬───────┘                               │
│                                     │                                       │
│                              ┌──────▼───────┐                               │
│                              │ API GATEWAY  │                               │
│                              │  (Port 8000) │                               │
│                              └──────┬───────┘                               │
│                                     │                                       │
│     ┌───────────────────────────────┼───────────────────────────────┐       │
│     │                               │                               │       │
│     ▼                               ▼                               ▼       │
│ ┌─────────┐  ┌─────────┐  ┌─────────────┐  ┌─────────┐  ┌─────────────┐     │
│ │  AUTH   │  │ MASTER  │  │  INVENTORY  │  │ PURCHASE│  │   SALES     │     │
│ │ SERVICE │  │ SERVICE │  │   SERVICE   │  │ SERVICE │  │  SERVICE    │     │
│ │  :8001  │  │  :8002  │  │    :8004    │  │  :8005  │  │   :8006     │     │
│ └────┬────┘  └────┬────┘  └──────┬──────┘  └────┬────┘  └──────┬──────┘     │
│      │            │              │              │              │            │
│      └────────────┴──────────────┴──────────────┴──────────────┘            │
│                                  │                                          │
│                    ┌─────────────┴─────────────┐                            │
│                    ▼                           ▼                            │
│             ┌───────────┐               ┌───────────┐                       │
│             │ PostgreSQL│               │   Redis   │                       │
│             │  Database │               │   Cache   │                       │
│             └───────────┘               └───────────┘                       │
│                                                                             │
│     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│     │  WAREHOUSE  │  │   REPORTS   │  │ INTEGRATION │  │ PRODUCTION  │      │
│     │   SERVICE   │  │   SERVICE   │  │   SERVICE   │  │   SERVICE   │      │
│     │    :8003    │  │    :8007    │  │    :8008    │  │    :8009    │      │
│     └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2.2 Service Catalog

| # | Service Name | Port | Responsibility | Status |
|---|-------------|------|----------------|--------|
| 0 | **API Gateway** | 8000 | Request routing, Auth validation, Rate limiting | 🔴 Planned |
| 1 | **Auth Service** | 8001 | Authentication, Users, Tenants, Permissions | 🔴 Planned |
| 2 | **Master Service** | 8002 | Items, Categories, Units, Parties | 🟢 Completed |
| 3 | **Warehouse Service** | 8003 | Warehouses, Locations, Zones, Transfers | 🔴 Planned |
| 4 | **Inventory Service** | 8004 | Stock levels, Transactions, Adjustments | 🔴 Planned |
| 5 | **Purchase Service** | 8005 | Purchase Orders, Receiving (GRN), Vendor Bills | 🔴 Planned |
| 6 | **Sales Service** | 8006 | Sales Orders, Fulfillment, Invoices, Returns | 🔴 Planned |
| 7 | **Reports Service** | 8007 | Dashboards, Analytics, Report generation | 🔴 Planned |
| 8 | **Integration Service** | 8008 | Channel sync (Amazon, Zepto), Accounting sync | 🔴 Planned |
| 9 | **Production Service** | 8009 | BOM, Work Orders, Quality Control | 🔴 Planned |

**Status Legend:** 🔴 Planned | 🟡 In Progress | 🟢 Completed | ⚪ On Hold

## 2.3 Service Dependencies

```
                    ┌─────────────────────────────────────┐
                    │           AUTH SERVICE              │
                    │  (Core - No dependencies)           │
                    └──────────────┬──────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
      ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
      │    MASTER     │    │   WAREHOUSE   │    │   REPORTS     │
      │    SERVICE    │    │    SERVICE    │    │   SERVICE     │
      └───────┬───────┘    └───────┬───────┘    └───────────────┘
              │                    │                    ▲
              └────────────┬───────┘                    │
                           │                           │
                           ▼                           │
                   ┌───────────────┐                   │
                   │   INVENTORY   │───────────────────┘
                   │    SERVICE    │
                   └───────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
      ┌───────────────┐    │    ┌───────────────┐
      │   PURCHASE    │    │    │    SALES      │
      │    SERVICE    │    │    │   SERVICE     │
      └───────────────┘    │    └───────────────┘
                           │
                           ▼
                   ┌───────────────┐
                   │  INTEGRATION  │
                   │    SERVICE    │
                   └───────────────┘
                           │
                           ▼
                   ┌───────────────┐
                   │  PRODUCTION   │
                   │   SERVICE     │
                   │  (Optional)   │
                   └───────────────┘
```

## 2.4 Communication Patterns

### 2.4.1 Synchronous (REST API)
Used for: Real-time queries, CRUD operations

```
Example: Sales Service checking inventory
─────────────────────────────────────────

Sales Service                    Inventory Service
     │                                 │
     │  GET /api/v1/stock/check        │
     │  {"item_id": "123", "qty": 10}  │
     │ ──────────────────────────────► │
     │                                 │
     │  {"available": true, "qty": 50} │
     │ ◄────────────────────────────── │
     │                                 │
```

### 2.4.2 Asynchronous (Message Queue - Redis/RabbitMQ)
Used for: Event-driven updates, Background processing

```
Example: Purchase received → Inventory updated
──────────────────────────────────────────────

Purchase Service              Message Queue              Inventory Service
     │                             │                            │
     │  Event: po.received         │                            │
     │  {po_id, items[], qty[]}    │                            │
     │ ─────────────────────────►  │                            │
     │                             │  Consume: po.received      │
     │                             │ ─────────────────────────► │
     │                             │                            │
     │                             │                   Update stock levels
     │                             │                            │
     │                             │  Event: stock.updated      │
     │                             │ ◄───────────────────────── │
     │                             │                            │
```

### 2.4.3 Event Types

| Event | Publisher | Subscribers | Description |
|-------|-----------|-------------|-------------|
| `tenant.created` | Auth | All Services | New organization registered |
| `user.created` | Auth | Reports | New user added |
| `item.created` | Master | Inventory, Reports | New item added |
| `item.updated` | Master | Inventory, Reports | Item details changed |
| `stock.adjusted` | Inventory | Reports | Manual stock adjustment |
| `po.created` | Purchase | Reports | Purchase order created |
| `po.received` | Purchase | Inventory | Goods received |
| `so.created` | Sales | Inventory, Reports | Sales order created |
| `so.shipped` | Sales | Inventory | Order shipped |
| `so.returned` | Sales | Inventory | Order returned |

## 2.5 Multi-Tenancy Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MULTI-TENANCY MODEL                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Approach: SHARED DATABASE, TENANT COLUMN                               │
│  ─────────────────────────────────────────                              │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      PostgreSQL Database                        │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │                     ALL TABLES                          │    │    │
│  │  │                                                         │    │    │
│  │  │   tenant_id (UUID) ──► REQUIRED ON EVERY TABLE          │    │    │
│  │  │                                                         │    │    │
│  │  │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │    │    │
│  │  │   │Tenant A │  │Tenant A │  │Tenant B │  │Tenant B │    │    │    │
│  │  │   │ Items   │  │ Orders  │  │ Items   │  │ Orders  │    │    │    │
│  │  │   └─────────┘  └─────────┘  └─────────┘  └─────────┘    │    │    │
│  │  │                                                         │    │    │
│  │  │   Row Level Security (RLS) ensures isolation            │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  Benefits:                                                              │
│  ✓ Simple deployment                                                    │
│  ✓ Easy backup/restore                                                  │
│  ✓ Cost effective                                                       │
│  ✓ Easy cross-tenant queries (for admins)                               │
│                                                                         │
│  Considerations:                                                        │
│  • All queries MUST filter by tenant_id                                 │
│  • Use PostgreSQL RLS for additional security                           │
│  • Proper indexing on tenant_id columns                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# 3. Low-Level Design (LLD)

## 3.1 Service: Auth Service

### 3.1.1 Purpose
Handle all authentication, authorization, and tenant management.

### 3.1.2 Entities

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AUTH SERVICE ENTITIES                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────────┐         ┌──────────────┐         ┌──────────────┐   │
│   │   TENANTS    │ 1─────N │    USERS     │ N─────N │    ROLES     │   │
│   │              │         │              │         │              │   │
│   │ id           │         │ id           │         │ id           │   │
│   │ name         │         │ tenant_id    │         │ name         │   │
│   │ code         │         │ email        │         │ permissions  │   │
│   │ industry     │         │ password     │         │              │   │
│   │ settings     │         │ name         │         │              │   │
│   │ status       │         │ role_id      │         │              │   │
│   └──────────────┘         │ status       │         └──────────────┘   │
│                            └──────────────┘                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1.3 API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/auth/register` | Register new tenant | No |
| POST | `/api/v1/auth/login` | User login | No |
| POST | `/api/v1/auth/logout` | User logout | Yes |
| POST | `/api/v1/auth/refresh` | Refresh token | Yes |
| GET | `/api/v1/auth/me` | Get current user | Yes |
| PUT | `/api/v1/tenants/{id}` | Update tenant settings | Yes (Admin) |
| GET | `/api/v1/users` | List users | Yes (Admin) |
| POST | `/api/v1/users` | Create user | Yes (Admin) |
| PUT | `/api/v1/users/{id}` | Update user | Yes (Admin) |
| DELETE | `/api/v1/users/{id}` | Delete user | Yes (Admin) |
| GET | `/api/v1/roles` | List roles | Yes |
| POST | `/api/v1/roles` | Create role | Yes (Admin) |

### 3.1.4 Flows

```
LOGIN FLOW
──────────

  Client                    Gateway                 Auth Service              Redis
    │                          │                         │                      │
    │  POST /auth/login        │                         │                      │
    │  {email, password}       │                         │                      │
    │ ───────────────────────► │                         │                      │
    │                          │  Forward request        │                      │
    │                          │ ──────────────────────► │                      │
    │                          │                         │                      │
    │                          │                   Validate credentials         │
    │                          │                   Generate JWT tokens          │
    │                          │                         │                      │
    │                          │                         │  Store refresh token │
    │                          │                         │ ───────────────────► │
    │                          │                         │                      │
    │                          │  {access_token,         │                      │
    │                          │   refresh_token}        │                      │
    │                          │ ◄────────────────────── │                      │
    │  {access_token,          │                         │                      │
    │   refresh_token}         │                         │                      │
    │ ◄─────────────────────── │                         │                      │
    │                          │                         │                      │


TENANT REGISTRATION FLOW
────────────────────────

  Client                    Gateway                 Auth Service              Database
    │                          │                         │                      │
    │  POST /auth/register     │                         │                      │
    │  {company, email, ...}   │                         │                      │
    │ ───────────────────────► │                         │                      │
    │                          │  Forward request        │                      │
    │                          │ ──────────────────────► │                      │
    │                          │                         │                      │
    │                          │                   1. Create tenant             │
    │                          │                   2. Create admin user         │
    │                          │                   3. Apply industry presets    │
    │                          │                         │                      │
    │                          │                         │  INSERT tenant       │
    │                          │                         │  INSERT user         │
    │                          │                         │ ───────────────────► │
    │                          │                         │                      │
    │                          │  {tenant_id, user_id,   │                      │
    │                          │   access_token}         │                      │
    │                          │ ◄────────────────────── │                      │
    │  {tenant_id, ...}        │                         │                      │
    │ ◄─────────────────────── │                         │                      │
    │                          │                         │                      │
```

---

## 3.2 Service: Master Service

### 3.2.1 Purpose
Manage master data: Items, Categories, Units of Measurement, Parties (Suppliers/Customers).

### 3.2.2 Entities

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           MASTER SERVICE ENTITIES                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌──────────────┐                                                              │
│   │  CATEGORIES  │                                                              │
│   │              │                                                              │
│   │ id           │                                                              │
│   │ tenant_id    │                                                              │
│   │ name         │ ◄───────────────────┐                                        │
│   │ parent_id    │                     │                                        │
│   │ level        │                     │                                        │
│   └──────────────┘                     │                                        │
│                                        │                                        │
│   ┌──────────────┐         ┌───────────┴──────────┐        ┌──────────────┐     │
│   │    UNITS     │         │        ITEMS         │        │ ITEM_DETAILS │     │
│   │              │         │                      │        │  (Optional)  │     │
│   │ id           │         │ id                   │        │              │     │
│   │ tenant_id    │ ◄────── │ tenant_id            │ ─────► │ item_id      │     │
│   │ name         │         │ sku_code             │        │ food_*       │     │
│   │ symbol       │         │ name                 │        │ electronics_*│     │
│   │              │         │ category_id          │        │ apparel_*    │     │
│   └──────────────┘         │ primary_unit_id      │        │              │     │
│                            │ secondary_unit_id    │        └──────────────┘     │
│                            │ purchase_rate        │                             │
│                            │ selling_rate         │        ┌──────────────┐     │
│                            │ mrp                  │        │   VARIANTS   │     │
│                            │ tax_rate             │        │              │     │
│                            │ hsn_code             │ ─────► │ item_id      │     │
│                            │ track_batches        │        │ sku          │     │
│                            │ track_serials        │        │ attributes   │     │
│                            │ track_expiry         │        │ price        │     │
│                            │ has_variants         │        │              │     │
│                            │ reorder_level        │        └──────────────┘     │
│                            │ is_active            │                             │
│                            └──────────────────────┘                             │
│                                                                                 │
│   ┌──────────────────────────────────────────────────────────────────────┐      │
│   │                           PARTIES                                    │      │
│   │                                                                      │      │
│   │ id           │ tenant_id      │ party_type (supplier/customer/both) │      │
│   │ party_code   │ party_name     │ contact_person  │ email   │ phone   │      │
│   │ address      │ city           │ state           │ pincode │ gstin   │      │
│   │ payment_terms│ credit_limit   │ is_active                           │      │
│   │                                                                      │      │
│   └──────────────────────────────────────────────────────────────────────┘      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2.3 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Categories** |||
| GET | `/api/v1/categories` | List categories (tree) |
| POST | `/api/v1/categories` | Create category |
| PUT | `/api/v1/categories/{id}` | Update category |
| DELETE | `/api/v1/categories/{id}` | Delete category |
| **Units** |||
| GET | `/api/v1/units` | List units |
| POST | `/api/v1/units` | Create unit |
| **Items** |||
| GET | `/api/v1/items` | List items (paginated) |
| GET | `/api/v1/items/{id}` | Get item details |
| POST | `/api/v1/items` | Create item |
| PUT | `/api/v1/items/{id}` | Update item |
| DELETE | `/api/v1/items/{id}` | Delete item |
| POST | `/api/v1/items/import` | Bulk import from Excel |
| GET | `/api/v1/items/export` | Export to Excel |
| **Variants** |||
| GET | `/api/v1/items/{id}/variants` | List item variants |
| POST | `/api/v1/items/{id}/variants` | Create variant |
| **Parties** |||
| GET | `/api/v1/suppliers` | List suppliers |
| GET | `/api/v1/customers` | List customers |
| POST | `/api/v1/parties` | Create party |
| PUT | `/api/v1/parties/{id}` | Update party |

---

## 3.3 Service: Warehouse Service

### 3.3.1 Purpose
Manage warehouses, locations/bins, and inter-warehouse transfers.

### 3.3.2 Entities

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       WAREHOUSE SERVICE ENTITIES                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────────────┐         ┌──────────────────┐                     │
│   │    WAREHOUSES    │ 1─────N │      ZONES       │                     │
│   │                  │         │                  │                     │
│   │ id               │         │ id               │                     │
│   │ tenant_id        │         │ warehouse_id     │                     │
│   │ code             │         │ code             │                     │
│   │ name             │         │ name             │                     │
│   │ type             │         │ type (ambient/   │                     │
│   │ address          │         │       cold/      │                     │
│   │ city, state      │         │       frozen)    │                     │
│   │ is_temp_control  │         │ temp_min/max     │                     │
│   │ temp_min/max     │         │                  │                     │
│   └──────────────────┘         └────────┬─────────┘                     │
│                                         │                               │
│                                         │ 1                             │
│                                         │                               │
│                                         │ N                             │
│                                ┌────────▼─────────┐                     │
│                                │    LOCATIONS     │                     │
│                                │     (Bins)       │                     │
│                                │                  │                     │
│                                │ id               │                     │
│                                │ zone_id          │                     │
│                                │ code (A-01-01)   │                     │
│                                │ type (bulk/pick) │                     │
│                                │ max_weight       │                     │
│                                │ is_occupied      │                     │
│                                └──────────────────┘                     │
│                                                                         │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                    STOCK TRANSFERS                               │  │
│   │                                                                  │  │
│   │ id            │ tenant_id         │ transfer_number              │  │
│   │ from_warehouse│ to_warehouse      │ status (draft/in_transit/    │  │
│   │ transfer_date │ received_date     │         received/cancelled)  │  │
│   │ notes         │ created_by                                       │  │
│   │                                                                  │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.3.3 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Warehouses** |||
| GET | `/api/v1/warehouses` | List warehouses |
| POST | `/api/v1/warehouses` | Create warehouse |
| PUT | `/api/v1/warehouses/{id}` | Update warehouse |
| DELETE | `/api/v1/warehouses/{id}` | Delete warehouse |
| **Zones** |||
| GET | `/api/v1/warehouses/{id}/zones` | List zones |
| POST | `/api/v1/warehouses/{id}/zones` | Create zone |
| **Locations** |||
| GET | `/api/v1/zones/{id}/locations` | List locations |
| POST | `/api/v1/zones/{id}/locations` | Create location |
| **Transfers** |||
| GET | `/api/v1/transfers` | List transfers |
| POST | `/api/v1/transfers` | Create transfer |
| PUT | `/api/v1/transfers/{id}/ship` | Mark as shipped |
| PUT | `/api/v1/transfers/{id}/receive` | Mark as received |

---

## 3.4 Service: Inventory Service

### 3.4.1 Purpose
Track current stock levels, stock movements, and adjustments.

### 3.4.2 Entities

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          INVENTORY SERVICE ENTITIES                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌──────────────────────────────────────────────────────────────────────┐      │
│   │                     INVENTORY (Current Stock)                        │      │
│   │                                                                      │      │
│   │ id           │ tenant_id      │ item_id        │ warehouse_id        │      │
│   │ variant_id   │ batch_number   │ serial_number  │ location_id         │      │
│   │ quantity     │ unit_cost      │ mfg_date       │ expiry_date         │      │
│   │ last_updated                                                         │      │
│   │                                                                      │      │
│   │ UNIQUE(tenant_id, item_id, warehouse_id, batch, serial, variant)     │      │
│   │                                                                      │      │
│   └──────────────────────────────────────────────────────────────────────┘      │
│                                                                                 │
│   ┌──────────────────────────────────────────────────────────────────────┐      │
│   │                   INVENTORY_TRANSACTIONS (Ledger)                    │      │
│   │                                                                      │      │
│   │ id               │ tenant_id          │ transaction_type             │      │
│   │ item_id          │ warehouse_id       │ variant_id                   │      │
│   │ batch_number     │ serial_number      │ quantity (+/-)               │      │
│   │ unit_cost        │ reference_type     │ reference_id                 │      │
│   │ reference_number │ notes              │ created_by     │ created_at  │      │
│   │                                                                      │      │
│   │ Transaction Types:                                                   │      │
│   │ • opening_stock    • purchase_receipt   • sales_issue                │      │
│   │ • transfer_out     • transfer_in        • adjustment_in              │      │
│   │ • adjustment_out   • production_consume • production_output          │      │
│   │ • return_in        • return_out         • damage                     │      │
│   │                                                                      │      │
│   └──────────────────────────────────────────────────────────────────────┘      │
│                                                                                 │
│   ┌──────────────────────────────────────────────────────────────────────┐      │
│   │                    STOCK_ADJUSTMENTS                                 │      │
│   │                                                                      │      │
│   │ id              │ tenant_id       │ adjustment_number                │      │
│   │ warehouse_id    │ adjustment_date │ reason                           │      │
│   │ status (draft/approved/rejected) │ approved_by     │ notes           │      │
│   │                                                                      │      │
│   └──────────────────────────────────────────────────────────────────────┘      │
│                                                                                 │
│   ┌──────────────────────────────────────────────────────────────────────┐      │
│   │                    BATCH_MASTER (for batch tracking)                 │      │
│   │                                                                      │      │
│   │ id           │ tenant_id      │ item_id        │ batch_number        │      │
│   │ mfg_date     │ expiry_date    │ supplier_batch │ notes               │      │
│   │                                                                      │      │
│   └──────────────────────────────────────────────────────────────────────┘      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.4.3 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Stock** |||
| GET | `/api/v1/stock` | Current stock (all warehouses) |
| GET | `/api/v1/stock/warehouse/{id}` | Stock by warehouse |
| GET | `/api/v1/stock/item/{id}` | Stock for specific item |
| GET | `/api/v1/stock/low` | Low stock items |
| GET | `/api/v1/stock/expiring` | Items expiring soon |
| **Transactions** |||
| GET | `/api/v1/transactions` | Transaction history |
| GET | `/api/v1/transactions/item/{id}` | Item transaction history |
| **Adjustments** |||
| GET | `/api/v1/adjustments` | List adjustments |
| POST | `/api/v1/adjustments` | Create adjustment |
| PUT | `/api/v1/adjustments/{id}/approve` | Approve adjustment |
| **Batches** |||
| GET | `/api/v1/batches` | List batches |
| GET | `/api/v1/batches/{id}/trace` | Trace batch usage |

### 3.4.4 Stock Update Flow

```
STOCK UPDATE FLOW (Triggered by Purchase/Sales/Adjustment)
──────────────────────────────────────────────────────────

  Purchase Service              Message Queue            Inventory Service
        │                            │                         │
        │  Event: po.received        │                         │
        │  {                         │                         │
        │    po_id: "PO-001",        │                         │
        │    warehouse_id: "WH-1",   │                         │
        │    items: [                │                         │
        │      {item_id, qty,        │                         │
        │       batch, expiry}       │                         │
        │    ]                       │                         │
        │  }                         │                         │
        │ ─────────────────────────► │                         │
        │                            │  Consume event          │
        │                            │ ───────────────────────►│
        │                            │                         │
        │                            │          1. Find/Create inventory record
        │                            │          2. Update quantity (+)
        │                            │          3. Insert transaction log
        │                            │          4. Update batch master
        │                            │                         │
        │                            │  Event: stock.updated   │
        │                            │ ◄───────────────────────│
        │                            │                         │
        │                            │  Notify: Reports Service
        │                            │                         │
```

---

## 3.5 Service: Purchase Service

### 3.5.1 Purpose
Manage purchase orders, goods receiving, and vendor bills.

### 3.5.2 Entities

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          PURCHASE SERVICE ENTITIES                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌──────────────────────────────────────────────────────────────────────┐      │
│   │                      PURCHASE_ORDERS                                 │      │
│   │                                                                      │      │
│   │ id              │ tenant_id         │ po_number                      │      │
│   │ supplier_id     │ warehouse_id      │ order_date                     │      │
│   │ expected_date   │ status            │ subtotal                       │      │
│   │ tax_amount      │ discount          │ total                          │      │
│   │ payment_terms   │ notes             │ created_by    │ created_at     │      │
│   │                                                                      │      │
│   │ Status: draft → sent → confirmed → partial → received → billed       │      │
│   │                                                                      │      │
│   └──────────────────────────────────────────────────────────────────────┘      │
│                                          │                                      │
│                                          │ 1:N                                  │
│                                          ▼                                      │
│   ┌──────────────────────────────────────────────────────────────────────┐      │
│   │                      PURCHASE_ORDER_LINES                            │      │
│   │                                                                      │      │
│   │ id           │ po_id          │ item_id        │ variant_id          │      │
│   │ ordered_qty  │ received_qty   │ unit           │ rate                │      │
│   │ tax_percent  │ discount       │ amount                               │      │
│   │                                                                      │      │
│   └──────────────────────────────────────────────────────────────────────┘      │
│                                                                                 │
│   ┌──────────────────────────────────────────────────────────────────────┐      │
│   │                      GOODS_RECEIPTS (GRN)                            │      │
│   │                                                                      │      │
│   │ id           │ tenant_id      │ grn_number     │ po_id               │      │
│   │ receipt_date │ warehouse_id   │ received_by    │ notes               │      │
│   │                                                                      │      │
│   └──────────────────────────────────────────────────────────────────────┘      │
│                                          │                                      │
│                                          │ 1:N                                  │
│                                          ▼                                      │
│   ┌──────────────────────────────────────────────────────────────────────┐      │
│   │                      GOODS_RECEIPT_LINES                             │      │
│   │                                                                      │      │
│   │ id           │ grn_id         │ po_line_id     │ item_id             │      │
│   │ received_qty │ accepted_qty   │ rejected_qty   │ rejection_reason    │      │
│   │ batch_number │ mfg_date       │ expiry_date    │ location_id         │      │
│   │                                                                      │      │
│   └──────────────────────────────────────────────────────────────────────┘      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.5.3 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Purchase Orders** |||
| GET | `/api/v1/purchase-orders` | List POs |
| GET | `/api/v1/purchase-orders/{id}` | Get PO details |
| POST | `/api/v1/purchase-orders` | Create PO |
| PUT | `/api/v1/purchase-orders/{id}` | Update PO |
| PUT | `/api/v1/purchase-orders/{id}/send` | Mark as sent |
| PUT | `/api/v1/purchase-orders/{id}/cancel` | Cancel PO |
| **Goods Receipt** |||
| POST | `/api/v1/purchase-orders/{id}/receive` | Receive goods |
| GET | `/api/v1/goods-receipts` | List GRNs |
| GET | `/api/v1/goods-receipts/{id}` | Get GRN details |

### 3.5.4 Purchase Order Workflow

```
PURCHASE ORDER STATE MACHINE
────────────────────────────

                    ┌──────────────────────────────────────────────────────────┐
                    │                                                          │
                    ▼                                                          │
               ┌─────────┐        ┌─────────┐        ┌───────────┐            │
   Create ───► │  DRAFT  │ ─────► │  SENT   │ ─────► │ CONFIRMED │            │
               └─────────┘ Send   └─────────┘ Vendor └─────┬─────┘            │
                    │              confirms       │        │                   │
                    │                             │        │                   │
                    │                             │        ▼                   │
                    │                             │  ┌───────────┐            │
                    │                             │  │  PARTIAL  │            │
                    │                             │  │  RECEIVED │ ◄─┐        │
                    │                             │  └─────┬─────┘   │        │
                    │                             │        │         │        │
                    │                             │        │    Partial       │
                    │                             │        ▼    Receipt       │
                    │                             │  ┌───────────┐   │        │
                    │                             └─►│ RECEIVED  │───┘        │
                    │                                └─────┬─────┘            │
                    │                                      │                  │
                    │                                      ▼                  │
                    │                                ┌───────────┐            │
                    │                                │  BILLED   │            │
                    │                                └───────────┘            │
                    │                                                         │
                    │         ┌───────────┐                                   │
                    └────────►│ CANCELLED │◄──────────────────────────────────┘
                              └───────────┘       (Can cancel from any state)
```

---

## 3.6 Service: Sales Service

### 3.6.1 Purpose
Manage sales orders, fulfillment, invoicing, and returns.

### 3.6.2 Entities

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SALES SERVICE ENTITIES                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌──────────────────────────────────────────────────────────────────────┐      │
│   │                        SALES_ORDERS                                  │      │
│   │                                                                      │      │
│   │ id               │ tenant_id          │ order_number                 │      │
│   │ order_source     │ channel_order_id   │ customer_id                  │      │
│   │ warehouse_id     │ order_date         │ expected_ship_date           │      │
│   │ status           │ shipping_address   │ shipping_city                │      │
│   │ shipping_state   │ shipping_pincode   │ shipping_carrier             │      │
│   │ tracking_number  │ subtotal           │ tax_amount                   │      │
│   │ shipping_charge  │ discount           │ total                        │      │
│   │ notes            │ created_at                                        │      │
│   │                                                                      │      │
│   │ Order Sources: manual, amazon, flipkart, zepto, shopify, website     │      │
│   │ Status: new → confirmed → processing → packed → shipped → delivered  │      │
│   │                                                                      │      │
│   └──────────────────────────────────────────────────────────────────────┘      │
│                                          │                                      │
│                                          │ 1:N                                  │
│                                          ▼                                      │
│   ┌──────────────────────────────────────────────────────────────────────┐      │
│   │                       SALES_ORDER_LINES                              │      │
│   │                                                                      │      │
│   │ id            │ order_id       │ item_id        │ variant_id         │      │
│   │ ordered_qty   │ shipped_qty    │ unit           │ rate               │      │
│   │ tax_percent   │ discount       │ amount                              │      │
│   │ batch_number  │ serial_numbers (array)                               │      │
│   │                                                                      │      │
│   └──────────────────────────────────────────────────────────────────────┘      │
│                                                                                 │
│   ┌──────────────────────────────────────────────────────────────────────┐      │
│   │                         SHIPMENTS                                    │      │
│   │                                                                      │      │
│   │ id           │ tenant_id      │ shipment_number│ order_id            │      │
│   │ ship_date    │ carrier        │ tracking_number│ status              │      │
│   │ shipped_by   │ notes                                                 │      │
│   │                                                                      │      │
│   └──────────────────────────────────────────────────────────────────────┘      │
│                                                                                 │
│   ┌──────────────────────────────────────────────────────────────────────┐      │
│   │                          RETURNS                                     │      │
│   │                                                                      │      │
│   │ id           │ tenant_id      │ return_number  │ order_id            │      │
│   │ return_date  │ reason         │ status         │ refund_amount       │      │
│   │ received_by  │ notes                                                 │      │
│   │                                                                      │      │
│   └──────────────────────────────────────────────────────────────────────┘      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.6.3 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Sales Orders** |||
| GET | `/api/v1/sales-orders` | List orders |
| GET | `/api/v1/sales-orders/{id}` | Get order details |
| POST | `/api/v1/sales-orders` | Create order |
| PUT | `/api/v1/sales-orders/{id}` | Update order |
| PUT | `/api/v1/sales-orders/{id}/confirm` | Confirm order |
| PUT | `/api/v1/sales-orders/{id}/cancel` | Cancel order |
| **Fulfillment** |||
| PUT | `/api/v1/sales-orders/{id}/pack` | Mark as packed |
| POST | `/api/v1/sales-orders/{id}/ship` | Create shipment |
| PUT | `/api/v1/sales-orders/{id}/deliver` | Mark as delivered |
| **Returns** |||
| POST | `/api/v1/sales-orders/{id}/return` | Initiate return |
| PUT | `/api/v1/returns/{id}/receive` | Receive return |

---

## 3.7 Service: Reports Service

### 3.7.1 Purpose
Generate dashboards, reports, and analytics.

### 3.7.2 Report Types

| Category | Report | Description |
|----------|--------|-------------|
| **Dashboard** | Overview | Key metrics at a glance |
| **Inventory** | Stock Summary | Current stock by warehouse |
| | Stock Valuation | FIFO/LIFO valuation |
| | Low Stock | Items below reorder level |
| | Expiring Soon | Items expiring in 30/60/90 days |
| | Stock Movement | Period-wise in/out |
| | Aging Report | Stock age analysis |
| **Sales** | Sales Summary | Period-wise sales |
| | Sales by Item | Top selling items |
| | Sales by Channel | Channel-wise breakdown |
| | Order Status | Pending, shipped, delivered |
| **Purchase** | Purchase Summary | Period-wise purchases |
| | Pending POs | Orders not yet received |
| | Vendor Performance | Lead time, quality |
| **Transactions** | Transaction Log | All stock movements |
| | Audit Trail | User activity log |

### 3.7.3 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/dashboard` | Dashboard data |
| GET | `/api/v1/reports/stock-summary` | Stock summary |
| GET | `/api/v1/reports/stock-valuation` | Valuation report |
| GET | `/api/v1/reports/low-stock` | Low stock items |
| GET | `/api/v1/reports/expiring` | Expiring items |
| GET | `/api/v1/reports/sales` | Sales report |
| GET | `/api/v1/reports/purchases` | Purchase report |
| POST | `/api/v1/reports/custom` | Custom report |
| GET | `/api/v1/reports/{id}/export` | Export to Excel/PDF |

---

## 3.8 Service: Integration Service

### 3.8.1 Purpose
Sync with external channels (Amazon, Zepto, etc.) and accounting software.

### 3.8.2 Supported Integrations

| Integration | Type | Features |
|-------------|------|----------|
| **Amazon** | Marketplace | Order import, Inventory sync |
| **Flipkart** | Marketplace | Order import, Inventory sync |
| **Zepto** | Quick Commerce | PO import, Inventory update |
| **BigBasket** | Marketplace | Order import |
| **Shopify** | E-commerce | Order sync, Product sync |
| **Tally** | Accounting | Invoice export, Stock sync |
| **Zoho Books** | Accounting | Invoice export |

### 3.8.3 Integration Flow

```
AMAZON ORDER SYNC FLOW
──────────────────────

                    ┌─────────────────────────────────────────────────────────┐
                    │                                                         │
  ┌─────────┐       │        INTEGRATION SERVICE                              │
  │ Amazon  │       │                                                         │
  │   API   │ ◄─────┤  1. Poll for new orders (every 15 mins)                 │
  └────┬────┘       │  2. Parse order data                                    │
       │            │  3. Map to internal format                              │
       │            │  4. Create sales order in Sales Service                 │
       │            │  5. Update order status back to Amazon                  │
       │            │                                                         │
       │            └─────────────────────────────────────────────────────────┘
       │                              │
       ▼                              ▼
  ┌─────────┐                  ┌─────────────┐
  │ Orders  │                  │   Sales     │
  │  Data   │ ───────────────► │   Service   │
  └─────────┘                  └─────────────┘
```

---

# 4. Database Design

## 4.1 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ENTITY RELATIONSHIP DIAGRAM                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌──────────┐                                                                  │
│   │ TENANTS  │                                                                  │
│   └────┬─────┘                                                                  │
│        │                                                                        │
│        │ 1:N                                                                    │
│        │                                                                        │
│   ┌────┴────────────────────────────────────────────────────────────────┐       │
│   │                                                                     │       │
│   ▼                    ▼                    ▼                          ▼       │
│ ┌──────┐          ┌──────────┐        ┌───────────┐            ┌──────────┐    │
│ │USERS │          │  ITEMS   │        │WAREHOUSES │            │ PARTIES  │    │
│ └──────┘          └────┬─────┘        └─────┬─────┘            └────┬─────┘    │
│                        │                    │                       │          │
│                        │ 1:N                │ 1:N                   │ 1:N      │
│                        ▼                    ▼                       │          │
│                  ┌──────────┐         ┌──────────┐                  │          │
│                  │ VARIANTS │         │LOCATIONS │                  │          │
│                  └──────────┘         └──────────┘                  │          │
│                        │                    │                       │          │
│                        │                    │                       │          │
│                        └────────────┬───────┘                       │          │
│                                     │                               │          │
│                                     ▼                               │          │
│                              ┌─────────────┐                        │          │
│                              │  INVENTORY  │                        │          │
│                              └──────┬──────┘                        │          │
│                                     │                               │          │
│                                     │ 1:N                           │          │
│                                     ▼                               │          │
│                             ┌──────────────┐                        │          │
│                             │ TRANSACTIONS │                        │          │
│                             └──────────────┘                        │          │
│                                     ▲                               │          │
│                          ┌──────────┴──────────┐                    │          │
│                          │                     │                    │          │
│                ┌─────────┴────────┐  ┌─────────┴────────┐          │          │
│                │ PURCHASE_ORDERS  │  │   SALES_ORDERS   │          │          │
│                └─────────┬────────┘  └─────────┬────────┘          │          │
│                          │                     │                    │          │
│                          │ N:1                 │ N:1                │          │
│                          ▼                     ▼                    │          │
│                     ┌─────────┐           ┌──────────┐              │          │
│                     │SUPPLIERS│ ◄─────────┤CUSTOMERS │◄─────────────┘          │
│                     └─────────┘           └──────────┘                         │
│                          │                                                      │
│                          │ (Both from PARTIES table)                            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 4.2 Complete Database Schema

See separate file: `docs/DATABASE_SCHEMA.md`

---

# 5. API Specifications

## 5.1 API Standards

| Aspect | Standard |
|--------|----------|
| **Protocol** | REST over HTTPS |
| **Format** | JSON |
| **Versioning** | URI path (`/api/v1/...`) |
| **Authentication** | Bearer JWT Token |
| **Pagination** | `?page=1&limit=20` |
| **Filtering** | `?status=active&category=food` |
| **Sorting** | `?sort=created_at&order=desc` |
| **Date Format** | ISO 8601 (`2026-01-11T10:30:00Z`) |

## 5.2 Standard Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ITEM_NOT_FOUND",
    "message": "Item with ID 123 not found",
    "details": { ... }
  }
}
```

## 5.3 HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (Delete) |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Validation Error |
| 500 | Server Error |

---

# 6. Implementation Roadmap

## 6.1 Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          IMPLEMENTATION PHASES                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  PHASE 1: FOUNDATION                                           Week 1-2        │
│  ━━━━━━━━━━━━━━━━━━━━                                                           │
│  □ 1.1 Project structure & shared utilities                                     │
│  □ 1.2 Auth Service (Tenants, Users, Login)                                     │
│  □ 1.3 API Gateway setup                                                        │
│                                                                                 │
│  PHASE 2: MASTER DATA                                          Week 3-4        │
│  ━━━━━━━━━━━━━━━━━━━━                                                           │
│  □ 2.1 Master Service: Categories, Units                                        │
│  □ 2.2 Master Service: Items CRUD                                               │
│  □ 2.3 Master Service: Parties (Suppliers/Customers)                            │
│  □ 2.4 Excel import/export                                                      │
│                                                                                 │
│  PHASE 3: WAREHOUSING                                          Week 5          │
│  ━━━━━━━━━━━━━━━━━━━━━                                                          │
│  □ 3.1 Warehouse Service: Warehouses CRUD                                       │
│  □ 3.2 Warehouse Service: Locations/Bins                                        │
│                                                                                 │
│  PHASE 4: INVENTORY                                            Week 6-7        │
│  ━━━━━━━━━━━━━━━━━━━━                                                           │
│  □ 4.1 Inventory Service: Stock levels                                          │
│  □ 4.2 Inventory Service: Transactions                                          │
│  □ 4.3 Inventory Service: Adjustments                                           │
│  □ 4.4 Inventory Service: Batch/Expiry                                          │
│                                                                                 │
│  PHASE 5: PURCHASE                                             Week 8-9        │
│  ━━━━━━━━━━━━━━━━━━━                                                            │
│  □ 5.1 Purchase Service: PO CRUD                                                │
│  □ 5.2 Purchase Service: Goods Receipt                                          │
│  □ 5.3 Integration with Inventory                                               │
│                                                                                 │
│  PHASE 6: SALES                                                Week 10-11      │
│  ━━━━━━━━━━━━━━━━━                                                              │
│  □ 6.1 Sales Service: SO CRUD                                                   │
│  □ 6.2 Sales Service: Fulfillment                                               │
│  □ 6.3 Sales Service: Returns                                                   │
│                                                                                 │
│  PHASE 7: REPORTS                                              Week 12         │
│  ━━━━━━━━━━━━━━━━━                                                              │
│  □ 7.1 Reports Service: Dashboard                                               │
│  □ 7.2 Reports Service: Stock reports                                           │
│  □ 7.3 Reports Service: Order reports                                           │
│                                                                                 │
│  PHASE 8: INTEGRATIONS                                         Week 13-14      │
│  ━━━━━━━━━━━━━━━━━━━━━                                                          │
│  □ 8.1 Integration Service: Amazon                                              │
│  □ 8.2 Integration Service: Zepto                                               │
│  □ 8.3 Integration Service: Tally                                               │
│                                                                                 │
│  PHASE 9: PRODUCTION (Optional)                                Week 15-16      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                                  │
│  □ 9.1 Production Service: BOM                                                  │
│  □ 9.2 Production Service: Work Orders                                          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 6.2 Detailed Task Breakdown

### Phase 1: Foundation (Week 1-2)

| Task ID | Task | Est. Hours | Status |
|---------|------|------------|--------|
| 1.1.1 | Create project folder structure | 2 | 🔴 |
| 1.1.2 | Setup shared utilities (db, auth) | 4 | 🔴 |
| 1.1.3 | Create docker-compose.yml | 2 | 🔴 |
| 1.1.4 | Setup PostgreSQL & Redis | 2 | 🔴 |
| 1.2.1 | Create tenants table & model | 3 | 🔴 |
| 1.2.2 | Create users table & model | 3 | 🔴 |
| 1.2.3 | Implement registration API | 4 | 🔴 |
| 1.2.4 | Implement login/logout API | 4 | 🔴 |
| 1.2.5 | Implement JWT token handling | 4 | 🔴 |
| 1.2.6 | Create roles & permissions | 4 | 🔴 |
| 1.2.7 | Create login UI | 4 | 🔴 |
| 1.3.1 | Setup API Gateway | 4 | 🔴 |
| 1.3.2 | Configure routing | 2 | 🔴 |
| 1.3.3 | Add auth middleware | 3 | 🔴 |

### Phase 2-9: See detailed breakdown in separate tracking document

---

# 7. Technology Stack

## 7.1 Backend

| Component | Technology | Version | Notes |
|-----------|------------|---------|-------|
| **Language** | Python | 3.11+ | Type hints, async |
| **Framework** | FastAPI | 0.109+ | Async, OpenAPI |
| **Database** | PostgreSQL | 15+ | With RLS |
| **Cache** | Redis | 7+ | Sessions, queue |
| **ORM** | SQLAlchemy | 2.0+ | Async support |
| **Validation** | Pydantic | 2.0+ | Data validation |
| **Auth** | python-jose | - | JWT tokens |
| **Task Queue** | Celery | 5.3+ | Background jobs |
| **Testing** | pytest | - | Unit & integration |

## 7.2 Frontend (Future)

| Component | Technology | Version |
|-----------|------------|---------|
| **Framework** | React / Vue | 18+ / 3+ |
| **UI Library** | shadcn/ui / Vuetify | Latest |
| **State** | Zustand / Pinia | Latest |
| **HTTP** | Axios | Latest |

## 7.3 Infrastructure

| Component | Technology |
|-----------|------------|
| **Containerization** | Docker |
| **Orchestration** | Docker Compose (dev), Kubernetes (prod) |
| **Reverse Proxy** | Nginx |
| **CI/CD** | GitHub Actions |
| **Monitoring** | Prometheus + Grafana |
| **Logging** | ELK Stack |

---

# 8. Security Design

## 8.1 Authentication

- JWT tokens with short expiry (15 mins)
- Refresh tokens stored in Redis
- Password hashing with bcrypt

## 8.2 Authorization

- Role-based access control (RBAC)
- Permission-based actions
- Tenant isolation

## 8.3 Data Security

- All data filtered by tenant_id
- PostgreSQL Row Level Security (RLS)
- Encrypted at rest and in transit

## 8.4 API Security

- Rate limiting
- Input validation
- SQL injection prevention (parameterized queries)
- XSS prevention
- CORS configuration

---

# 9. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PRODUCTION DEPLOYMENT                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│                              ┌──────────────┐                                   │
│                              │   CLOUDFLARE │                                   │
│                              │     (CDN)    │                                   │
│                              └──────┬───────┘                                   │
│                                     │                                           │
│                              ┌──────▼───────┐                                   │
│                              │    NGINX     │                                   │
│                              │ Load Balancer│                                   │
│                              └──────┬───────┘                                   │
│                                     │                                           │
│              ┌──────────────────────┼──────────────────────┐                    │
│              │                      │                      │                    │
│              ▼                      ▼                      ▼                    │
│      ┌───────────────┐     ┌───────────────┐     ┌───────────────┐              │
│      │   Gateway-1   │     │   Gateway-2   │     │   Gateway-3   │              │
│      └───────────────┘     └───────────────┘     └───────────────┘              │
│              │                      │                      │                    │
│              └──────────────────────┼──────────────────────┘                    │
│                                     │                                           │
│         ┌───────────────────────────┼───────────────────────────┐               │
│         │                           │                           │               │
│         ▼                           ▼                           ▼               │
│   ┌───────────┐             ┌───────────┐             ┌───────────┐             │
│   │  Service  │             │  Service  │             │  Service  │             │
│   │  Pod 1    │             │  Pod 2    │             │  Pod 3    │             │
│   └───────────┘             └───────────┘             └───────────┘             │
│         │                           │                           │               │
│         └───────────────────────────┼───────────────────────────┘               │
│                                     │                                           │
│              ┌──────────────────────┼──────────────────────┐                    │
│              │                      │                      │                    │
│              ▼                      ▼                      ▼                    │
│      ┌───────────────┐     ┌───────────────┐     ┌───────────────┐              │
│      │  PostgreSQL   │     │    Redis      │     │  Blob Store   │              │
│      │  (Primary)    │     │   Cluster     │     │    (S3)       │              │
│      └───────────────┘     └───────────────┘     └───────────────┘              │
│              │                                                                  │
│              ▼                                                                  │
│      ┌───────────────┐                                                          │
│      │  PostgreSQL   │                                                          │
│      │  (Replica)    │                                                          │
│      └───────────────┘                                                          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

# 10. Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-11 | Dev Team | Initial document creation |
| | | | - Project overview defined |
| | | | - HLD architecture designed |
| | | | - LLD for all services |
| | | | - Database design completed |
| | | | - Implementation roadmap created |
| 1.1.0 | 2026-01-11 | Dev Team | Master Service Implementation |
| | | | - Master Service created with full CRUD APIs |
| | | | - Categories, Units, Items, Parties modules |
| | | | - Database schema for Master Service |
| | | | - Shared utilities (db, models, helpers) |

---

## Document Conventions

- 🔴 **Planned** - Not yet started
- 🟡 **In Progress** - Currently being worked on
- 🟢 **Completed** - Finished and tested
- ⚪ **On Hold** - Paused for some reason
- ❌ **Cancelled** - Will not be implemented

---

## Related Documents

| Document | Location | Description |
|----------|----------|-------------|
| Database Schema | `docs/DATABASE_SCHEMA.md` | Complete SQL schema |
| API Reference | `docs/API_REFERENCE.md` | Detailed API docs |
| Setup Guide | `docs/SETUP_GUIDE.md` | Development setup |
| Deployment Guide | `docs/DEPLOYMENT.md` | Production deployment |

---

*This is a living document. Update it as the project evolves.*

