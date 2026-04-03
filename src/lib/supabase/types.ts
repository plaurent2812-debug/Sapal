export interface QuoteItemPayload {
  product_id: string
  product_name: string
  quantity: number
  variant_id?: string
  variant_label?: string
  unit_price?: number
}

export interface ProductVariantRow {
  id: string
  product_id: string
  reference: string
  label: string
  dimensions: string
  finition: string
  coloris: string
  poids: string
  price: number
  delai: string
  specifications: Record<string, string>
  created_at: string
}

export type ProductVariant = ProductVariantRow

export interface ProductOptionRow {
  id: string
  product_id: string
  option_product_id: string
}

export interface CategoryRow {
  id: string
  name: string
  slug: string
  description: string
  image_url: string
  created_at: string
}

export interface ProductRow {
  id: string
  category_id: string
  name: string
  slug: string
  description: string
  specifications: Record<string, string>
  image_url: string
  price: number
  reference: string
  supplier_url: string
  supplier: string | null
  supplier_id: string | null
  procity_sheet: string | null
  procity_family: string | null
  procity_type: string | null
  created_at: string
}

export interface QuoteRow {
  id: string
  entity: string
  contact_name: string
  email: string
  phone: string
  message: string | null
  items: QuoteItemPayload[]
  status: 'pending' | 'sent' | 'accepted' | 'rejected'
  source: 'site' | 'admin' | 'telephone'
  user_id: string | null
  created_at: string
}

export interface ContactRow {
  id: string
  name: string
  email: string
  phone: string | null
  subject: string
  message: string
  created_at: string
}

export interface ClientProfileRow {
  id: string
  user_id: string
  company_name: string | null
  siret: string | null
  tva_intracom: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  phone: string | null
  client_type: 'B2B' | 'B2C' | 'collectivite'
  account_status: 'pending' | 'active' | 'suspended'
  created_at: string
  updated_at: string
}

export type Category = CategoryRow
export type Product = ProductRow
export type Quote = QuoteRow
export type Contact = ContactRow
export type ClientProfile = ClientProfileRow

// --- Fournisseurs ---

export interface SupplierRow {
  id: string
  name: string
  slug: string
  email: string | null
  phone: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  siret: string | null
  contact_name: string | null
  payment_terms: '30j' | 'prepayment'
  notes: string | null
  created_at: string
  updated_at: string
}

export type Supplier = SupplierRow

// --- Commandes ---

export type OrderStatus = 'processing' | 'partially_delivered' | 'delivered' | 'invoiced' | 'cancelled'

export interface OrderRow {
  id: string
  quote_id: string
  user_id: string
  order_number: string
  status: OrderStatus
  source: 'site' | 'admin' | 'telephone'
  total_ht: number
  total_ttc: number
  pennylane_invoice_id: string | null
  invoice_url: string | null
  delivered_at: string | null
  invoiced_at: string | null
  created_at: string
  updated_at: string
}

export type Order = OrderRow

export interface OrderItemRow {
  id: string
  order_id: string
  product_id: string
  product_name: string
  variant_id: string | null
  variant_label: string | null
  quantity: number
  unit_price: number
  supplier_id: string | null
  created_at: string
}

export type OrderItem = OrderItemRow

// --- Commandes Fournisseur ---

export type SupplierOrderStatus = 'pending' | 'awaiting_payment' | 'paid' | 'sent' | 'delivered' | 'cancelled'

export interface SupplierOrderRow {
  id: string
  order_id: string
  supplier_id: string
  bdc_number: string
  status: SupplierOrderStatus
  total_ht: number
  bdc_pdf_url: string | null
  payment_terms: '30j' | 'prepayment'
  paid_at: string | null
  sent_at: string | null
  delivered_at: string | null
  created_at: string
  updated_at: string
}

export type SupplierOrder = SupplierOrderRow

export interface SupplierOrderItemRow {
  id: string
  supplier_order_id: string
  order_item_id: string
  product_id: string
  product_name: string
  variant_label: string | null
  quantity: number
  unit_price: number
  created_at: string
}

export type SupplierOrderItem = SupplierOrderItemRow
