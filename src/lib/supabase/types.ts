export interface QuoteItemPayload {
  product_id: string
  product_name: string
  quantity: number
  variant_id?: string
  variant_label?: string
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
  created_at: string
  updated_at: string
}

export type Category = CategoryRow
export type Product = ProductRow
export type Quote = QuoteRow
export type Contact = ContactRow
export type ClientProfile = ClientProfileRow
