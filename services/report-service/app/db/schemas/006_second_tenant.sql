-- Add "Other Customer" tenant so login can switch between Nourishyou and Other Customer
INSERT INTO tenants (id)
SELECT '00000000-0000-0000-0000-000000000002'::uuid
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE id = '00000000-0000-0000-0000-000000000002'::uuid);
