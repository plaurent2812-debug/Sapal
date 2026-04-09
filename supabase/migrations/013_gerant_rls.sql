-- ============================================================
-- 013_gerant_rls.sql
-- RLS : acces lecture pour le role gerant sur quotes et quote_items
-- (orders, order_items, supplier_orders, supplier_order_items
--  sont deja couverts par la migration 011)
-- ============================================================

-- ---------- 1. quotes : lecture admin + gerant ----------

CREATE POLICY "quotes_admin_gerant_select" ON quotes
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'gerant')
  );

-- Admin full access (insert, update, delete) — already has insert via anonymous
CREATE POLICY "quotes_admin_all" ON quotes
  FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ---------- 2. quote_items : lecture admin + gerant ----------

CREATE POLICY "quote_items_admin_gerant_select" ON quote_items
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'gerant')
  );

-- Admin full access
CREATE POLICY "quote_items_admin_all" ON quote_items
  FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );
