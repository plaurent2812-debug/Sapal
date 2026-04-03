/**
 * Client Pennylane API
 *
 * Documentation : https://pennylane.readme.io/reference
 *
 * Pour activer : ajouter PENNYLANE_API_KEY dans .env.local
 */

const PENNYLANE_API_URL = 'https://app.pennylane.com/api/external/v1'

function getHeaders() {
  const apiKey = process.env.PENNYLANE_API_KEY
  if (!apiKey) throw new Error('PENNYLANE_API_KEY non configurée')
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
}

export function isPennylaneConfigured(): boolean {
  return !!process.env.PENNYLANE_API_KEY
}

// ---------- Clients ----------

export async function createCustomer(data: {
  name: string
  email: string
  phone?: string
  address?: string
  postalCode?: string
  city?: string
  siret?: string
}) {
  const res = await fetch(`${PENNYLANE_API_URL}/customers`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      customer: {
        name: data.name,
        emails: [data.email],
        phone: data.phone,
        address: data.address,
        postal_code: data.postalCode,
        city: data.city,
        reg_no: data.siret,
        country_alpha2: 'FR',
      },
    }),
  })
  if (!res.ok) throw new Error(`Pennylane createCustomer failed: ${res.status}`)
  return res.json()
}

export async function getCustomerByEmail(email: string) {
  const res = await fetch(`${PENNYLANE_API_URL}/customers?filter[email]=${encodeURIComponent(email)}`, {
    headers: getHeaders(),
  })
  if (!res.ok) throw new Error(`Pennylane getCustomer failed: ${res.status}`)
  const data = await res.json()
  return data.customers?.[0] ?? null
}

// ---------- Devis ----------

export async function createEstimate(data: {
  customerSourceId: string
  date: string
  items: {
    label: string
    quantity: number
    unitPrice: number
    vatRate: number
  }[]
}) {
  const res = await fetch(`${PENNYLANE_API_URL}/customer_estimates`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      customer_estimate: {
        date: data.date,
        customer_source_id: data.customerSourceId,
        line_items: data.items.map(item => ({
          label: item.label,
          quantity: item.quantity,
          unit: 'piece',
          vat_rate: item.vatRate,
          currency_amount: item.unitPrice,
        })),
      },
    }),
  })
  if (!res.ok) throw new Error(`Pennylane createEstimate failed: ${res.status}`)
  return res.json()
}

export async function getEstimate(id: string) {
  const res = await fetch(`${PENNYLANE_API_URL}/customer_estimates/${id}`, {
    headers: getHeaders(),
  })
  if (!res.ok) throw new Error(`Pennylane getEstimate failed: ${res.status}`)
  return res.json()
}

// ---------- Factures ----------

export async function createInvoice(data: {
  customerSourceId: string
  date: string
  deadline: string
  items: {
    label: string
    quantity: number
    unitPrice: number
    vatRate: number
  }[]
}) {
  const res = await fetch(`${PENNYLANE_API_URL}/customer_invoices`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      customer_invoice: {
        date: data.date,
        deadline: data.deadline,
        customer_source_id: data.customerSourceId,
        line_items: data.items.map(item => ({
          label: item.label,
          quantity: item.quantity,
          unit: 'piece',
          vat_rate: item.vatRate,
          currency_amount: item.unitPrice,
        })),
      },
    }),
  })
  if (!res.ok) throw new Error(`Pennylane createInvoice failed: ${res.status}`)
  return res.json()
}

export async function getInvoicePDF(invoiceId: string): Promise<string | null> {
  const res = await fetch(`${PENNYLANE_API_URL}/customer_invoices/${invoiceId}`, {
    headers: getHeaders(),
  })
  if (!res.ok) throw new Error(`Pennylane getInvoicePDF failed: ${res.status}`)
  const data = await res.json()
  return data.customer_invoice?.file_url ?? null
}
