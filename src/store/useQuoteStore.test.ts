import { describe, it, expect, beforeEach } from 'vitest'
import { useQuoteStore } from './useQuoteStore'
import type { ClientProduct } from '@/lib/data'

const mockProduct: ClientProduct = {
  id: 'prod-1',
  categoryId: 'cat-1',
  categorySlug: 'signalisation',
  name: 'Panneau Stop',
  slug: 'panneau-stop',
  description: 'Panneau de signalisation',
  descriptionSapal: null,
  specifications: {},
  imageUrl: 'https://example.com/stop.webp',
  galleryImageUrls: [],
  techSheetUrl: null,
  procityUrl: null,
  price: 120,
  reference: 'REF-001',
}

describe('useQuoteStore', () => {
  beforeEach(() => {
    useQuoteStore.getState().clearCart()
  })

  it('starts with an empty cart', () => {
    expect(useQuoteStore.getState().items).toEqual([])
  })

  it('adds a new item to the cart', () => {
    useQuoteStore.getState().addItem(mockProduct, 2)
    const items = useQuoteStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].product.id).toBe('prod-1')
    expect(items[0].quantity).toBe(2)
  })

  it('merges quantities when adding the same product+variant twice', () => {
    useQuoteStore.getState().addItem(mockProduct, 2)
    useQuoteStore.getState().addItem(mockProduct, 3)
    const items = useQuoteStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].quantity).toBe(5)
  })

  it('keeps separate entries for different variants', () => {
    useQuoteStore.getState().addItem(mockProduct, 1, 'var-a', 'Variant A', '5j', 150)
    useQuoteStore.getState().addItem(mockProduct, 1, 'var-b', 'Variant B', '10j', 180)
    expect(useQuoteStore.getState().items).toHaveLength(2)
  })

  it('updates quantity for an existing item', () => {
    useQuoteStore.getState().addItem(mockProduct, 1)
    useQuoteStore.getState().updateQuantity('prod-1', 7)
    expect(useQuoteStore.getState().items[0].quantity).toBe(7)
  })

  it('removes an item by productId', () => {
    useQuoteStore.getState().addItem(mockProduct, 1)
    useQuoteStore.getState().removeItem('prod-1')
    expect(useQuoteStore.getState().items).toHaveLength(0)
  })

  it('clears the cart', () => {
    useQuoteStore.getState().addItem(mockProduct, 5)
    useQuoteStore.getState().clearCart()
    expect(useQuoteStore.getState().items).toEqual([])
  })
})
