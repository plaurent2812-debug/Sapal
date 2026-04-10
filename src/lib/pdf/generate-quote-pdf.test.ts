import { describe, it, expect } from 'vitest'
import { generateQuotePDF, type QuotePDFData } from './generate-quote-pdf'

const fakeQuote: QuotePDFData = {
  quoteId: '550e8400-e29b-41d4-a716-446655440000',
  date: '10/04/2026',
  entity: 'Societe Test SA',
  contactName: 'Jean Dupont',
  email: 'contact@test.fr',
  phone: '01 23 45 67 89',
  items: [
    {
      reference: 'STOP-001',
      productName: 'Panneau Stop',
      quantity: 2,
      unitPriceHT: 120,
    },
    {
      reference: 'POT-042',
      productName: 'Potelet urbain',
      quantity: 5,
      unitPriceHT: 45.5,
      delai: '14',
    },
  ],
}

describe('generateQuotePDF', () => {
  it('returns a non-empty byte output for a valid quote', () => {
    const doc = generateQuotePDF(fakeQuote)
    expect(doc).toBeDefined()

    // generateQuotePDF returns a jsPDF instance; serialise it to bytes.
    const bytes = doc.output('arraybuffer')
    expect(bytes).toBeInstanceOf(ArrayBuffer)
    expect(bytes.byteLength).toBeGreaterThan(500)
  })
})
