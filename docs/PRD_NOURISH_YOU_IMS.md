# Product Requirements Document (PRD)
## Nourish You - Inventory Management System (IMS)

**Version:** 1.0  
**Date:** January 14, 2026  
**Author:** Product Team  
**Status:** Draft  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Company Overview](#2-company-overview)
3. [Problem Statement](#3-problem-statement)
4. [Product Vision](#4-product-vision)
5. [User Personas](#5-user-personas)
6. [Product Catalog & Categories](#6-product-catalog--categories)
7. [Functional Requirements](#7-functional-requirements)
8. [Sales Channels & Multi-Channel Inventory](#8-sales-channels--multi-channel-inventory)
9. [Integration Requirements](#9-integration-requirements)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [User Interface Requirements](#11-user-interface-requirements)
12. [Success Metrics](#12-success-metrics)
13. [Appendix](#13-appendix)

---

## 1. Executive Summary

This PRD outlines the requirements for the Inventory Management System (IMS) designed specifically for **Nourish You**, a Bengaluru-based plant-based food company. The IMS will manage the complete lifecycle of inventory—from procurement to sales across multiple channels (D2C website, Amazon, Flipkart, BigBasket, Zepto, and retail stores).

### Key Objectives
- Centralized inventory tracking across all sales channels
- Real-time stock visibility with low-stock alerts
- Support for product bundles/combos (e.g., "Pack of 6", "Pack of 12")
- Multi-warehouse management
- Integration with Allocation Management System (AMS) for PO processing
- Batch/lot tracking for perishable products

---

## 2. Company Overview

### About Nourish You
**Website:** [https://nourishyou.in/](https://nourishyou.in/)

Nourish You is a plant-based food brand headquartered in Bengaluru, India, focused on providing healthy, sustainable, and delicious food alternatives. The company operates two brands:

| Brand | Focus | Products |
|-------|-------|----------|
| **Nourish You** | Quinoa, Seeds, Millets | Quinoa, Chia Seeds, Millet Milk, Specialty Flours |
| **One Good** | Dairy Alternatives | Peanut Kurd, Plant-based Prodigee (butter alternative) |

### Business Model
- **D2C (Direct to Consumer):** nourishyou.in
- **Marketplaces:** Amazon, Flipkart
- **Quick Commerce:** Zepto, BigBasket, Blinkit, Swiggy Instamart
- **Retail:** Offline stores and distributors

---

## 3. Problem Statement

### Current Challenges

| Challenge | Impact |
|-----------|--------|
| **Manual Inventory Tracking** | Stock discrepancies, overselling |
| **Multi-Channel Complexity** | Difficulty allocating stock across Amazon, Flipkart, D2C |
| **Bundle Management** | Hard to track component stock for "Pack of 6" bundles |
| **PO Processing** | Manual validation of Purchase Orders from Amazon/Flipkart |
| **Expiry Management** | Perishable items (Peanut Kurd, Millet Milk) need batch tracking |
| **No Real-time Visibility** | Delayed decisions on restocking |

### Opportunity
A unified IMS will provide real-time inventory visibility, automate stock allocation, and integrate seamlessly with the Allocation Management System (AMS) for efficient order processing.

---

## 4. Product Vision

> **"A single source of truth for Nourish You's inventory, enabling real-time visibility, intelligent allocation, and seamless multi-channel operations."**

### Goals

| Goal | Description |
|------|-------------|
| **Centralized Inventory** | Single view of all stock across warehouses |
| **Multi-Channel Sync** | Auto-sync inventory with Amazon, Flipkart, D2C |
| **Bundle Intelligence** | Automatic component stock deduction for bundles |
| **AMS Integration** | Seamless PO validation and reservation |
| **Batch Tracking** | FIFO-based picking for perishables |
| **Actionable Insights** | Dashboards for stock health and sales velocity |

---

## 5. User Personas

### 5.1 Inventory Manager (Primary User)
- **Name:** Priya S.
- **Role:** Inventory & Operations Manager
- **Goals:** 
  - Monitor stock levels across all warehouses
  - Set reorder points and receive low-stock alerts
  - Manage product bundles and kits
- **Pain Points:**
  - Currently uses Excel for tracking
  - No real-time visibility into channel-wise stock

### 5.2 Sales Operations Executive
- **Name:** Rahul M.
- **Role:** Sales Order Processing
- **Goals:**
  - Process incoming POs from Amazon, Flipkart
  - Validate stock availability before confirmation
  - Track order fulfillment status
- **Pain Points:**
  - Manual PO validation takes hours
  - No automated stock reservation

### 5.3 Warehouse Staff
- **Name:** Suresh K.
- **Role:** Warehouse Operations
- **Goals:**
  - Pick, pack, and ship orders
  - Receive and stock incoming goods
  - Perform cycle counts
- **Pain Points:**
  - No digital picking lists
  - Paper-based receiving process

### 5.4 Business Owner/Admin
- **Name:** Gopal (Founder)
- **Role:** Owner/Administrator
- **Goals:**
  - View inventory health dashboards
  - Make restocking decisions
  - Monitor sales performance by channel
- **Pain Points:**
  - Relies on team for inventory updates
  - No consolidated view of business metrics

---

## 6. Product Catalog & Categories

Based on the [Nourish You website](https://nourishyou.in/), the IMS must support the following product structure:

### 6.1 Product Categories

```
├── Quinoa
│   ├── White Quinoa - 500g
│   ├── White Quinoa - 1kg
│   ├── Red Quinoa - 500g
│   ├── Black Quinoa - 500g
│   └── Tricolour Quinoa - 500g
│
├── Breakfast
│   ├── Super Muesli - Belgium Dark Chocolate - 400g
│   ├── Super Muesli - Cranberry & Almond - 400g
│   └── Super Muesli - Nuts & Seeds - 400g
│
├── Plant-Based Mlk
│   ├── Millet Mlk Original - 200ml
│   └── Millet Mlk Chocolate - 200ml
│
├── Roasted Seeds
│   ├── Roasted Sunflower Seeds - 150g
│   ├── Roasted Pumpkin Seeds - 150g
│   └── Roasted Mixed Seeds - 150g
│
├── Healthy Snacks
│   ├── Quinoa Puffs - Peri Peri
│   ├── Quinoa Puffs - Cheese & Herbs
│   └── Quinoa Puffs - Thai Chilli
│
├── Edible Seeds
│   ├── Black Chia Seeds - 150g/250g/500g/1kg
│   ├── White Chia Seeds - 250g
│   ├── Flax Seeds - 250g
│   └── Sunflower Seeds - 250g
│
├── Speciality Flours
│   ├── Quinoa Flour - 500g
│   ├── Amaranth Flour - 500g
│   ├── Buckwheat Flour - 500g
│   ├── Ragi Flour - 500g
│   └── Jowar Flour - 500g
│
└── One Good Products (Sub-brand)
    ├── Peanut Kurd - 450g
    └── Plant-based Prodigee - 500ml
```

### 6.2 Product Bundles/Combos

Nourish You sells products in various pack sizes. The IMS must support:

| Bundle Type | Example | Component Logic |
|-------------|---------|-----------------|
| **Multi-Pack** | Millet Mlk - Pack of 6 | 6 × Millet Mlk 200ml |
| **Multi-Pack** | Millet Mlk - Pack of 12 | 12 × Millet Mlk 200ml |
| **Multi-Pack** | Millet Mlk - Pack of 20 | 20 × Millet Mlk 200ml |
| **Combo Pack** | Protein Combo | Mixed products |
| **Subscription** | Peanut Kurd - 3 months | 12 × Peanut Kurd 450g |
| **Subscription** | Peanut Kurd - 6 months | 24 × Peanut Kurd 450g |
| **Weight Variants** | Chia Seeds - 150g/250g/500g/1kg | Separate SKUs, shared base |

### 6.3 Product Attributes

| Attribute | Type | Example |
|-----------|------|---------|
| SKU | String | NY-QNA-001 |
| Name | String | White Quinoa - 500g |
| Description | Text | Pure white quinoa, gluten-free... |
| Category | Reference | Quinoa |
| Brand | Reference | Nourish You / One Good |
| Unit | Reference | grams / ml / pcs |
| Weight/Volume | Decimal | 500 |
| MRP | Decimal | ₹289 |
| Selling Price | Decimal | ₹249 |
| Cost Price | Decimal | ₹180 |
| HSN Code | String | 1008.50 |
| Tax Rate | Decimal | 5% / 12% / 18% |
| Barcode/EAN | String | 8906123456789 |
| ASIN (Amazon) | String | B0D1234567 |
| FSIN (Flipkart) | String | FLPXXX123 |
| Shelf Life (Days) | Integer | 365 |
| Storage Instructions | Text | Store in cool, dry place |
| Is Perishable | Boolean | true/false |
| Is Active | Boolean | true/false |
| Image URL | String | https://cdn.nourishyou.in/... |

---

## 7. Functional Requirements

### 7.1 Product Management

| ID | Requirement | Priority |
|----|-------------|----------|
| PM-001 | CRUD operations for products | P0 |
| PM-002 | Product categorization (hierarchical) | P0 |
| PM-003 | Multiple product identifiers (SKU, EAN, ASIN, FSIN) | P0 |
| PM-004 | Product variants (weight, flavor) | P1 |
| PM-005 | Product bundles/kits with component tracking | P0 |
| PM-006 | Bulk product import via CSV/Excel | P1 |
| PM-007 | Product image management | P2 |
| PM-008 | Product duplication feature | P2 |

### 7.2 Inventory Management

| ID | Requirement | Priority |
|----|-------------|----------|
| IM-001 | Real-time stock levels by warehouse | P0 |
| IM-002 | Stock movements (in/out/transfer) | P0 |
| IM-003 | Low stock alerts with configurable thresholds | P0 |
| IM-004 | Reorder point management | P1 |
| IM-005 | Batch/lot tracking with expiry dates | P0 |
| IM-006 | FIFO-based inventory consumption | P1 |
| IM-007 | Cycle count / Stock take | P1 |
| IM-008 | Stock adjustment with reasons | P0 |
| IM-009 | Inventory valuation (FIFO, Weighted Avg) | P2 |
| IM-010 | Safety stock configuration | P1 |

### 7.3 Bundle/Kit Management

| ID | Requirement | Priority |
|----|-------------|----------|
| BM-001 | Create bundles from existing products | P0 |
| BM-002 | Auto-calculate bundle cost from components | P0 |
| BM-003 | Deduct component stock on bundle sale | P0 |
| BM-004 | Show "available to build" quantity for bundles | P0 |
| BM-005 | Bundle variants (Pack of 6, Pack of 12) | P1 |
| BM-006 | Assembly/disassembly workflows | P2 |

### 7.4 Warehouse Management

| ID | Requirement | Priority |
|----|-------------|----------|
| WM-001 | Multi-warehouse support | P0 |
| WM-002 | Warehouse-wise stock visibility | P0 |
| WM-003 | Inter-warehouse stock transfer | P1 |
| WM-004 | Warehouse address and contact details | P1 |
| WM-005 | Default warehouse assignment | P1 |

### 7.5 Purchase & Receiving

| ID | Requirement | Priority |
|----|-------------|----------|
| PR-001 | Create purchase orders to suppliers | P1 |
| PR-002 | Receive goods against PO | P1 |
| PR-003 | Partial receiving support | P1 |
| PR-004 | Record batch/lot on receiving | P0 |
| PR-005 | Update inventory on GRN | P0 |
| PR-006 | Supplier management | P1 |

### 7.6 Sales Order Management

| ID | Requirement | Priority |
|----|-------------|----------|
| SO-001 | Create sales orders (manual) | P0 |
| SO-002 | Import sales orders from PO files | P0 |
| SO-003 | Status workflow (Draft → Confirmed → Shipped → Delivered) | P0 |
| SO-004 | Inventory reservation on confirmation | P0 |
| SO-005 | Integration with AMS for PO processing | P0 |
| SO-006 | Fulfillment center assignment | P1 |
| SO-007 | Partial fulfillment tracking | P1 |
| SO-008 | Order cancellation with stock release | P0 |

### 7.7 Reporting & Analytics

| ID | Requirement | Priority |
|----|-------------|----------|
| RP-001 | Inventory summary dashboard | P0 |
| RP-002 | Stock movement report | P1 |
| RP-003 | Low stock report | P0 |
| RP-004 | Expiry report (30/60/90 days) | P0 |
| RP-005 | Sales velocity report | P1 |
| RP-006 | Channel-wise sales report | P1 |
| RP-007 | Inventory valuation report | P2 |
| RP-008 | Dead stock report | P2 |

---

## 8. Sales Channels & Multi-Channel Inventory

### 8.1 Sales Channels

| Channel | Type | Integration Method |
|---------|------|-------------------|
| **nourishyou.in** | D2C Website | Shopify API |
| **Amazon India** | Marketplace | SP-API |
| **Flipkart** | Marketplace | Seller API |
| **BigBasket** | Quick Commerce | API/PO Upload |
| **Zepto** | Quick Commerce | PO Upload (Excel) |
| **Blinkit** | Quick Commerce | API/PO Upload |
| **Swiggy Instamart** | Quick Commerce | PO Upload |
| **Retail/Distributors** | Offline | Manual Entry |

### 8.2 Fulfillment Centers

Based on typical Amazon FBA operations in India:

| FC Code | Location | Primary Channels |
|---------|----------|-----------------|
| BLR4 | Bengaluru | Amazon, Flipkart |
| DEL3 | Delhi | Amazon, Flipkart |
| MUM1 | Mumbai | Amazon, Zepto |
| HYD2 | Hyderabad | Amazon |
| CHE1 | Chennai | Amazon |
| SELF-BLR | Nourish You Warehouse, Bengaluru | D2C, Retail |

### 8.3 Channel-Specific Inventory Allocation

```
┌─────────────────────────────────────────────────────────────────┐
│                    TOTAL INVENTORY: 1000 units                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Amazon    │  │  Flipkart   │  │    D2C      │             │
│  │   400 units │  │  300 units  │  │  200 units  │             │
│  │  (Reserved) │  │  (Reserved) │  │  (Available)│             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  ┌─────────────┐                                               │
│  │   Safety    │  100 units (Never allocate)                   │
│  │   Stock     │                                               │
│  └─────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

### 8.4 Product Identifier Mapping

| Internal SKU | EAN | Amazon ASIN | Flipkart FSIN |
|--------------|-----|-------------|---------------|
| NY-QNA-001 | 8906123456001 | B0D1234567 | FLPQ00001 |
| NY-MLK-001 | 8906123456002 | B0D2345678 | FLPM00001 |
| NY-CHI-001 | 8906123456003 | B0D3456789 | FLPC00001 |

---

## 9. Integration Requirements

### 9.1 Allocation Management System (AMS)

| Integration Point | Description |
|-------------------|-------------|
| **PO Validation** | AMS calls IMS to validate stock availability |
| **Stock Reservation** | AMS reserves stock in IMS for confirmed POs |
| **Stock Release** | AMS releases reservation on PO cancellation |
| **Webhook Callbacks** | IMS notifies AMS of stock changes |

**API Endpoints Required:**

```
POST /api/v1/inventory/validate
POST /api/v1/inventory/reserve
POST /api/v1/inventory/release
POST /api/v1/sales-orders/from-ams
GET  /api/v1/products/by-identifier?type=asin&value=B0D1234567
```

### 9.2 E-Commerce Platforms

| Platform | Integration Type | Sync Frequency |
|----------|-----------------|----------------|
| Shopify (D2C) | REST API | Real-time |
| Amazon SP-API | REST API | Every 15 min |
| Flipkart Seller API | REST API | Every 15 min |

### 9.3 Accounting Software

| System | Integration |
|--------|-------------|
| Zoho Books | API (Optional) |
| Tally | Export (CSV) |

---

## 10. Non-Functional Requirements

### 10.1 Performance

| Metric | Target |
|--------|--------|
| Page Load Time | < 2 seconds |
| API Response Time | < 500ms (p95) |
| Concurrent Users | 50+ |
| Database Records | 100K+ products |

### 10.2 Availability

| Metric | Target |
|--------|--------|
| Uptime | 99.5% |
| Planned Downtime | < 4 hours/month |
| Backup Frequency | Daily |

### 10.3 Security

| Requirement | Implementation |
|-------------|----------------|
| Authentication | JWT-based |
| Authorization | Role-based access control (RBAC) |
| Data Encryption | HTTPS (TLS 1.3) |
| Audit Logging | All data modifications logged |
| Multi-Tenancy | Tenant isolation at data level |

### 10.4 Scalability

- Microservices architecture (Master, Sales, AMS services)
- Database-per-service where needed
- Horizontal scaling support

---

## 11. User Interface Requirements

### 11.1 Dashboard

**Key Metrics:**
- Total Products / Active Products
- Total Inventory Value
- Low Stock Alerts (count)
- Expiring Soon (next 30 days)
- Orders Pending Fulfillment
- Top Selling Products (last 7 days)

### 11.2 Navigation Structure

```
IMS Sidebar
├── Dashboard
├── Products
│   ├── All Products
│   └── Product Bundles
├── Inventory
│   ├── Stock Levels
│   ├── Stock Movements
│   └── Stock Adjustments
├── Sales
│   ├── Sales Orders
│   └── Import Orders
├── Purchasing
│   ├── Purchase Orders
│   └── Suppliers
├── Warehouses
├── Reports
│   ├── Inventory Report
│   ├── Sales Report
│   └── Expiry Report
└── Settings
    ├── Categories
    ├── Units
    ├── Brands
    └── Users
```

### 11.3 Theme & Branding

| Element | Specification |
|---------|---------------|
| Primary Color | Nourish You Green (#4CAF50) |
| Secondary Color | Warm Orange (#FF9800) |
| Font | Modern Sans-Serif (DM Sans / Outfit) |
| Dark Mode | Supported |
| Responsive | Desktop, Tablet, Mobile |

---

## 12. Success Metrics

### 12.1 Operational KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Inventory Accuracy | > 98% | Cycle count variance |
| Stockout Rate | < 2% | Unfulfilled orders / Total orders |
| PO Processing Time | < 30 min | Time from PO receipt to confirmation |
| Order Fulfillment Rate | > 95% | Fulfilled lines / Total lines |

### 12.2 User Adoption

| Metric | Target | Timeline |
|--------|--------|----------|
| Daily Active Users | 5+ | Month 2 |
| Orders Processed via System | 100% | Month 3 |
| Excel Dependency | 0% | Month 4 |

---

## 13. Appendix

### 13.1 Glossary

| Term | Definition |
|------|------------|
| SKU | Stock Keeping Unit - Unique product identifier |
| EAN | European Article Number - Barcode standard |
| ASIN | Amazon Standard Identification Number |
| FSIN | Flipkart Standard Identification Number |
| FC | Fulfillment Center |
| GRN | Goods Receipt Note |
| PO | Purchase Order |
| AMS | Allocation Management System |
| D2C | Direct to Consumer |

### 13.2 Sample PO Format (Amazon)

```
| ASIN       | Product Title          | Qty Requested | Unit Cost | Ship To FC |
|------------|------------------------|---------------|-----------|------------|
| B0D1234567 | White Quinoa 500g      | 100           | 180       | BLR4       |
| B0D2345678 | Millet Mlk Original    | 200           | 55        | BLR4       |
| B0D3456789 | Black Chia Seeds 250g  | 150           | 120       | DEL3       |
```

### 13.3 Current Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Python / FastAPI |
| Frontend | React + TypeScript + Tailwind CSS |
| Database | PostgreSQL |
| API Design | REST |
| Deployment | Docker |

### 13.4 Related Documents

- [System Design](./SYSTEM_DESIGN.md)
- [Sales Order Design](./SALES_ORDER_DESIGN.md)
- [Decoupled Architecture (IMS + AMS)](./DECOUPLED_ARCHITECTURE.md)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-14 | Product Team | Initial draft |

---

*This PRD is based on analysis of [nourishyou.in](https://nourishyou.in/) and the existing codebase.*


