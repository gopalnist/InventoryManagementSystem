#!/usr/bin/env python3
"""
Script to:
1. Generate consistent SKUs for all products
2. Populate product_identifiers table with EAN, ASIN mappings
3. Initialize inventory records
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import re
from collections import defaultdict

# Database connection
DB_CONFIG = {
    "host": "localhost",
    "port": 5441,
    "dbname": "ims_db",
    "user": "postgres",
    "password": "mypassword"
}

TENANT_ID = "00000000-0000-0000-0000-000000000001"

# Category detection patterns
CATEGORY_PATTERNS = {
    "QUI": ["quinoa", "quinoa seeds"],
    "OAT": ["oats", "oatmeal", "rolled oats"],
    "CHI": ["chia", "chia seeds"],
    "FLX": ["flax", "flaxseed", "linseed", "alsi"],
    "MLK": ["millet milk", "millet mlk", "plant based milk", "plant milk"],
    "MUS": ["muesli", "granola"],
    "FLR": ["flour", "atta"],
    "SED": ["seed mix", "seeds mix", "superfood mix", "nut mix"],
    "SNK": ["puffs", "clusters", "sticks", "bites", "snack"],
    "PMK": ["pumpkin", "pumpkin seeds"],
    "SFL": ["sunflower", "sunflower seeds"],
    "TFF": ["teff"],
    "KRD": ["kurd", "curd"],
    "PNB": ["peanut butter"],
    "MIX": ["combo", "mix pack"],
}


def detect_category(product_name: str) -> str:
    """Detect product category from name."""
    name_lower = product_name.lower()
    
    for cat_code, patterns in CATEGORY_PATTERNS.items():
        for pattern in patterns:
            if pattern in name_lower:
                return cat_code
    
    return "OTH"  # Other


def generate_sku(category: str, sequence: int) -> str:
    """Generate SKU in format NY-CAT-SEQ."""
    return f"NY-{category}-{sequence:03d}"


def is_ean(value: str) -> bool:
    """Check if value looks like an EAN barcode."""
    return bool(value and re.match(r"^\d{8,14}$", str(value)))


def main():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    print("=" * 60)
    print("PRODUCT SKU MIGRATION & IDENTIFIER SETUP")
    print("=" * 60)
    
    # Step 1: Run migrations
    print("\n[1/5] Running database migrations...")
    
    migration_files = [
        "services/master-service/app/db/schemas/015_product_identifiers.sql",
        "services/master-service/app/db/schemas/016_inventory.sql"
    ]
    
    for migration_file in migration_files:
        try:
            with open(migration_file, "r") as f:
                sql = f.read()
                cur.execute(sql)
                print(f"  ✓ Applied: {migration_file.split('/')[-1]}")
        except Exception as e:
            print(f"  ✗ Error in {migration_file}: {e}")
            conn.rollback()
    
    conn.commit()
    
    # Step 2: Get all products
    print("\n[2/5] Loading products...")
    cur.execute("""
        SELECT id, sku, name, ean, upc
        FROM products
        WHERE tenant_id = %s
        ORDER BY name
    """, (TENANT_ID,))
    
    products = cur.fetchall()
    print(f"  Found {len(products)} products")
    
    # Step 3: Generate new SKUs
    print("\n[3/5] Generating consistent SKUs...")
    
    # Get existing NY- SKUs to avoid conflicts
    cur.execute("""
        SELECT sku FROM products 
        WHERE tenant_id = %s AND sku LIKE 'NY-%%'
    """, (TENANT_ID,))
    existing_ny_skus = set(row["sku"] for row in cur.fetchall())
    
    # Track which categories already have NY- SKUs
    category_counters = defaultdict(int)
    for sku in existing_ny_skus:
        parts = sku.split("-")
        if len(parts) == 3:
            cat = parts[1]
            try:
                seq = int(parts[2])
                if seq > category_counters[cat]:
                    category_counters[cat] = seq
            except ValueError:
                pass
    
    sku_updates = []
    old_sku_mappings = []
    
    for product in products:
        old_sku = product["sku"]
        
        # Skip if already has proper NY- format
        if old_sku and old_sku.startswith("NY-") and re.match(r"^NY-[A-Z]{3}-\d{3}$", old_sku):
            continue
        
        category = detect_category(product["name"])
        category_counters[category] += 1
        new_sku = generate_sku(category, category_counters[category])
        
        # Make sure it's unique
        while new_sku in existing_ny_skus:
            category_counters[category] += 1
            new_sku = generate_sku(category, category_counters[category])
        
        existing_ny_skus.add(new_sku)
        
        sku_updates.append({
            "id": product["id"],
            "old_sku": old_sku,
            "new_sku": new_sku,
            "category": category
        })
        
        # Keep old SKU as alias if different
        if old_sku and old_sku != new_sku:
            old_sku_mappings.append({
                "product_id": product["id"],
                "old_sku": old_sku,
                "is_ean": is_ean(old_sku)
            })
    
    # Print category distribution
    print("\n  Category distribution:")
    for cat, count in sorted(category_counters.items()):
        print(f"    {cat}: {count} products")
    
    # Step 4: Update SKUs and create identifiers
    print("\n[4/5] Updating SKUs and creating identifiers...")
    
    updated_count = 0
    identifier_count = 0
    
    for update in sku_updates:
        # Update product SKU
        cur.execute("""
            UPDATE products
            SET sku = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (update["new_sku"], update["id"]))
        updated_count += 1
    
    # Create identifier mappings for old SKUs
    for mapping in old_sku_mappings:
        identifier_type = "ean" if mapping["is_ean"] else "sku_alias"
        
        cur.execute("""
            INSERT INTO product_identifiers (tenant_id, product_id, identifier_type, identifier_value, is_primary)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (tenant_id, identifier_type, identifier_value, platform) DO NOTHING
        """, (TENANT_ID, mapping["product_id"], identifier_type, mapping["old_sku"], identifier_type == "ean"))
        identifier_count += 1
    
    print(f"  ✓ Updated {updated_count} product SKUs")
    print(f"  ✓ Created {identifier_count} identifier mappings")
    
    # Step 5: Extract and add identifiers from sales_order_items
    print("\n[5/5] Extracting identifiers from imported orders...")
    
    cur.execute("""
        SELECT DISTINCT 
            soi.product_id,
            soi.sku,
            soi.asin,
            soi.external_id
        FROM sales_order_items soi
        WHERE soi.product_id IS NOT NULL
        AND (soi.asin IS NOT NULL OR soi.external_id IS NOT NULL)
    """)
    
    order_identifiers = cur.fetchall()
    asin_count = 0
    ean_count = 0
    
    for item in order_identifiers:
        # Add ASIN
        if item["asin"]:
            cur.execute("""
                INSERT INTO product_identifiers (tenant_id, product_id, identifier_type, identifier_value, platform, is_primary)
                VALUES (%s, %s, 'asin', %s, 'amazon', true)
                ON CONFLICT (tenant_id, identifier_type, identifier_value, platform) DO NOTHING
            """, (TENANT_ID, item["product_id"], item["asin"]))
            asin_count += 1
        
        # Add EAN from external_id
        if item["external_id"] and is_ean(item["external_id"]):
            cur.execute("""
                INSERT INTO product_identifiers (tenant_id, product_id, identifier_type, identifier_value, is_primary)
                VALUES (%s, %s, 'ean', %s, true)
                ON CONFLICT (tenant_id, identifier_type, identifier_value, platform) DO NOTHING
            """, (TENANT_ID, item["product_id"], item["external_id"]))
            ean_count += 1
    
    print(f"  ✓ Added {asin_count} ASIN identifiers (Amazon)")
    print(f"  ✓ Added {ean_count} EAN identifiers")
    
    # Step 6: Initialize inventory records
    print("\n[6/6] Initializing inventory records...")
    
    cur.execute("""
        SELECT id FROM warehouses WHERE tenant_id = %s AND is_default = true LIMIT 1
    """, (TENANT_ID,))
    warehouse = cur.fetchone()
    
    if warehouse:
        cur.execute("""
            INSERT INTO inventory (tenant_id, product_id, warehouse_id, on_hand_qty, reorder_level)
            SELECT %s, p.id, %s, COALESCE(p.opening_stock, 100), COALESCE(p.reorder_level, 10)
            FROM products p
            WHERE p.tenant_id = %s
            ON CONFLICT (tenant_id, product_id, warehouse_id) DO NOTHING
        """, (TENANT_ID, warehouse["id"], TENANT_ID))
        
        cur.execute("SELECT COUNT(*) as cnt FROM inventory WHERE tenant_id = %s", (TENANT_ID,))
        inv_count = cur.fetchone()["cnt"]
        print(f"  ✓ Created {inv_count} inventory records")
    else:
        print("  ✗ No default warehouse found")
    
    conn.commit()
    
    # Summary
    print("\n" + "=" * 60)
    print("MIGRATION COMPLETE")
    print("=" * 60)
    
    # Show sample of new SKUs
    print("\nSample of new SKUs:")
    cur.execute("""
        SELECT sku, LEFT(name, 50) as product_name
        FROM products
        WHERE tenant_id = %s
        ORDER BY sku
        LIMIT 15
    """, (TENANT_ID,))
    
    for row in cur.fetchall():
        print(f"  {row['sku']:12} → {row['product_name']}")
    
    # Show identifier stats
    print("\nIdentifier statistics:")
    cur.execute("""
        SELECT identifier_type, COUNT(*) as count
        FROM product_identifiers
        WHERE tenant_id = %s
        GROUP BY identifier_type
        ORDER BY count DESC
    """, (TENANT_ID,))
    
    for row in cur.fetchall():
        print(f"  {row['identifier_type']:12}: {row['count']} identifiers")
    
    cur.close()
    conn.close()
    
    print("\n✅ Done!")


if __name__ == "__main__":
    main()

