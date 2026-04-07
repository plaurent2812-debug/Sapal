-- ============================================================
-- 011_orders_system.sql
-- Système complet de commandes : fournisseurs, commandes,
-- commandes fournisseur, storage BC client
-- ============================================================

-- ---------- 1. Table suppliers ----------

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  address TEXT,
  postal_code VARCHAR(10),
  city TEXT,
  siret VARCHAR(14),
  contact_name TEXT,
  payment_terms TEXT NOT NULL DEFAULT '30j' CHECK (payment_terms IN ('30j', 'prepayment')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- 2. Products: add purchase_price + supplier FK ----------

ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12,2);

-- ---------- 3. Table orders ----------

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id),
  user_id UUID NOT NULL,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'awaiting_bc' CHECK (status IN (
    'awaiting_bc', 'processing', 'partially_delivered', 'delivered', 'invoiced', 'cancelled'
  )),
  source TEXT NOT NULL DEFAULT 'site' CHECK (source IN ('site', 'admin', 'telephone')),
  total_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_ttc NUMERIC(12,2) NOT NULL DEFAULT 0,
  bc_file_url TEXT,
  delivery_address TEXT,
  delivery_postal_code VARCHAR(10),
  delivery_city TEXT,
  pennylane_invoice_id TEXT,
  invoice_url TEXT,
  delivered_at TIMESTAMPTZ,
  invoiced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- 4. Table order_items ----------

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  variant_id TEXT,
  variant_label TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- 5. Table supplier_orders ----------

CREATE TABLE IF NOT EXISTS supplier_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  bdc_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'awaiting_payment', 'paid', 'sent', 'delivered', 'cancelled'
  )),
  total_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
  bdc_pdf_url TEXT,
  payment_terms TEXT NOT NULL DEFAULT '30j',
  paid_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- 6. Table supplier_order_items ----------

CREATE TABLE IF NOT EXISTS supplier_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_order_id UUID NOT NULL REFERENCES supplier_orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  variant_label TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- 7. RPC: generate_order_number ----------

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  prefix TEXT;
  max_seq INTEGER;
  new_number TEXT;
BEGIN
  prefix := 'CMD-' || to_char(now(), 'YYYYMM') || '-';

  SELECT COALESCE(
    MAX(
      CAST(
        REPLACE(order_number, prefix, '') AS INTEGER
      )
    ), 0
  ) INTO max_seq
  FROM orders
  WHERE order_number LIKE prefix || '%';

  new_number := prefix || LPAD((max_seq + 1)::text, 4, '0');
  RETURN new_number;
END;
$$;

-- ---------- 8. RPC: generate_bdc_number ----------

CREATE OR REPLACE FUNCTION generate_bdc_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  prefix TEXT;
  max_seq INTEGER;
  new_number TEXT;
BEGIN
  prefix := 'BDC-' || to_char(now(), 'YYYYMM') || '-';

  SELECT COALESCE(
    MAX(
      CAST(
        REPLACE(bdc_number, prefix, '') AS INTEGER
      )
    ), 0
  ) INTO max_seq
  FROM supplier_orders
  WHERE bdc_number LIKE prefix || '%';

  new_number := prefix || LPAD((max_seq + 1)::text, 4, '0');
  RETURN new_number;
END;
$$;

-- ---------- 9. Storage bucket for client BC uploads ----------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-bdc',
  'client-bdc',
  false,
  10485760,  -- 10 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- ---------- 10. RLS: Enable on all tables ----------

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_order_items ENABLE ROW LEVEL SECURITY;

-- ---------- 11. RLS Policies: suppliers ----------

-- Public read (products reference suppliers)
CREATE POLICY "suppliers_public_read" ON suppliers
  FOR SELECT USING (true);

-- Admin/gerant full access
CREATE POLICY "suppliers_admin_all" ON suppliers
  FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'gerant')
  );

-- ---------- 12. RLS Policies: orders ----------

-- Users read own orders
CREATE POLICY "orders_user_read_own" ON orders
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update own orders ONLY when awaiting_bc (for BC upload)
CREATE POLICY "orders_user_update_awaiting_bc" ON orders
  FOR UPDATE USING (
    auth.uid() = user_id AND status = 'awaiting_bc'
  );

-- Admin/gerant full access
CREATE POLICY "orders_admin_all" ON orders
  FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'gerant')
  );

-- Service role insert (from API routes)
CREATE POLICY "orders_service_insert" ON orders
  FOR INSERT WITH CHECK (true);

-- ---------- 13. RLS Policies: order_items ----------

-- Users read items for their own orders
CREATE POLICY "order_items_user_read_own" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
    )
  );

-- Admin/gerant full access
CREATE POLICY "order_items_admin_all" ON order_items
  FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'gerant')
  );

-- Service role insert
CREATE POLICY "order_items_service_insert" ON order_items
  FOR INSERT WITH CHECK (true);

-- ---------- 14. RLS Policies: supplier_orders ----------

-- Users read supplier orders for their own orders
CREATE POLICY "supplier_orders_user_read_own" ON supplier_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders WHERE orders.id = supplier_orders.order_id AND orders.user_id = auth.uid()
    )
  );

-- Admin/gerant full access
CREATE POLICY "supplier_orders_admin_all" ON supplier_orders
  FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'gerant')
  );

-- Service role insert
CREATE POLICY "supplier_orders_service_insert" ON supplier_orders
  FOR INSERT WITH CHECK (true);

-- ---------- 15. RLS Policies: supplier_order_items ----------

-- Admin/gerant only
CREATE POLICY "supplier_order_items_admin_all" ON supplier_order_items
  FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'gerant')
  );

-- Service role insert
CREATE POLICY "supplier_order_items_service_insert" ON supplier_order_items
  FOR INSERT WITH CHECK (true);

-- ---------- 16. Storage RLS: client-bdc bucket ----------

-- Users can upload their own BCs
CREATE POLICY "client_bdc_user_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'client-bdc'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own BCs
CREATE POLICY "client_bdc_user_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'client-bdc'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admin/gerant can read all BCs
CREATE POLICY "client_bdc_admin_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'client-bdc'
    AND (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'gerant')
  );

-- ---------- 17. Indexes ----------

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_quote_id ON orders(quote_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_supplier_id ON order_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_order_id ON supplier_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_supplier_id ON supplier_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_status ON supplier_orders(status);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
