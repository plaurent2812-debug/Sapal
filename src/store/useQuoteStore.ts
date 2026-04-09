import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ClientProduct } from '@/lib/data'

export interface QuoteItem {
  product: ClientProduct;
  quantity: number;
  variantId?: string;
  variantLabel?: string;
  variantDelai?: string;
  variantPrice?: number;
  categorySlug?: string;
}

interface QuoteStore {
  items: QuoteItem[];
  addItem: (product: ClientProduct, quantity?: number, variantId?: string, variantLabel?: string, variantDelai?: string, variantPrice?: number, categorySlug?: string) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
}

export const useQuoteStore = create<QuoteStore>()(
  persist(
    (set) => ({
      items: [],
      addItem: (product, quantity = 1, variantId?, variantLabel?, variantDelai?, variantPrice?, categorySlug?) => set((state) => {
        const existingItem = state.items.find(
          item => item.product.id === product.id && item.variantId === variantId
        )
        if (existingItem) {
          return {
            items: state.items.map(item =>
              (item.product.id === product.id && item.variantId === variantId)
                ? { ...item, quantity: item.quantity + quantity }
                : item
            )
          }
        }
        return { items: [...state.items, { product, quantity, variantId, variantLabel, variantDelai, variantPrice, categorySlug }] }
      }),
      removeItem: (productId) => set((state) => ({
        items: state.items.filter(item => item.product.id !== productId)
      })),
      updateQuantity: (productId, quantity) => set((state) => ({
        items: state.items.map(item =>
          item.product.id === productId
            ? { ...item, quantity }
            : item
        )
      })),
      clearCart: () => set({ items: [] })
    }),
    {
      name: 'sapal-quote-storage',
    }
  )
)
