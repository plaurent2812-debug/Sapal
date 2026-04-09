-- 012: Ajout statuts ordered/shipped pour orders, proforma_sent/shipped pour supplier_orders

-- 1. Orders: ajouter ordered et shipped au CHECK constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'awaiting_bc', 'processing', 'ordered', 'shipped', 'delivered', 'invoiced', 'cancelled'
));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;

-- 2. Supplier orders: ajouter proforma_sent et shipped au CHECK constraint
ALTER TABLE supplier_orders DROP CONSTRAINT IF EXISTS supplier_orders_status_check;
ALTER TABLE supplier_orders ADD CONSTRAINT supplier_orders_status_check CHECK (status IN (
  'pending', 'proforma_sent', 'awaiting_payment', 'paid', 'sent', 'shipped', 'delivered', 'cancelled'
));
ALTER TABLE supplier_orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
ALTER TABLE supplier_orders ADD COLUMN IF NOT EXISTS proforma_sent_at TIMESTAMPTZ;
