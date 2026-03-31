'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Trash2,
  Loader2,
  Save,
  Building2,
  User,
  Mail,
  Phone,
  FileText,
} from 'lucide-react'

interface Product {
  id: string
  name: string
  reference: string
  price: number
}

interface QuoteLineItem {
  product: Product
  quantity: number
}

export default function NouveauDevisPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Client info
  const [entity, setEntity] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')

  // Products
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced product search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true)
      const supabase = createBrowserClient()
      const q = searchQuery.trim()
      const { data } = await supabase
        .from('products')
        .select('id, name, reference, price')
        .or(`name.ilike.%${q}%,reference.ilike.%${q}%`)
        .limit(10)

      if (data) {
        setSearchResults(data as Product[])
        setShowDropdown(true)
      }
      setSearching(false)
    }, 300)

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [searchQuery])

  function addProduct(product: Product) {
    setLineItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
    setSearchQuery('')
    setShowDropdown(false)
  }

  function removeProduct(productId: string) {
    setLineItems((prev) => prev.filter((item) => item.product.id !== productId))
  }

  function updateQuantity(productId: string, newQuantity: number) {
    if (newQuantity < 1) return
    setLineItems((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    )
  }

  const totalHT = lineItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (lineItems.length === 0) {
      setError('Veuillez ajouter au moins un produit au devis.')
      return
    }

    setSaving(true)

    const quoteId = crypto.randomUUID()
    const supabase = createBrowserClient()

    const { error: quoteError } = await supabase.from('quotes').insert({
      id: quoteId,
      entity: entity.trim(),
      contact_name: contactName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      message: message.trim() || null,
      status: 'pending',
    })

    if (quoteError) {
      setError(quoteError.message)
      setSaving(false)
      return
    }

    const { error: itemsError } = await supabase.from('quote_items').insert(
      lineItems.map((item) => ({
        quote_id: quoteId,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
      }))
    )

    if (itemsError) {
      setError(itemsError.message)
      setSaving(false)
      return
    }

    router.push('/admin/devis')
  }

  return (
    <div>
      <Link
        href="/admin/devis"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft size={16} className="mr-1" /> Retour aux devis
      </Link>

      <h1 className="font-heading text-3xl tracking-tight mb-8">
        Nouveau devis
      </h1>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left column: Client info */}
          <div className="space-y-6">
            <div className="border border-border rounded-lg p-6">
              <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
                <Building2 size={18} className="text-muted-foreground" />
                Informations client
              </h2>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <Building2 size={14} />
                    Entite / Collectivite{' '}
                    <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={entity}
                    onChange={(e) => setEntity(e.target.value)}
                    required
                    placeholder="Ex: Mairie de Perpignan"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <User size={14} />
                    Nom du contact{' '}
                    <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    required
                    placeholder="Jean Dupont"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <Mail size={14} />
                      Email <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="contact@mairie.fr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <Phone size={14} />
                      Telephone <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      placeholder="04 68 00 00 00"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <FileText size={14} />
                    Message / Notes
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                    placeholder="Contraintes de livraison, delais..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right column: Products */}
          <div className="space-y-6">
            <div className="border border-border rounded-lg p-6">
              <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
                <FileText size={18} className="text-muted-foreground" />
                Produits
              </h2>

              {/* Product search */}
              <div ref={searchRef} className="relative mb-5">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un produit par nom ou reference..."
                    className="pl-9"
                    onFocus={() => {
                      if (searchResults.length > 0) setShowDropdown(true)
                    }}
                  />
                  {searching && (
                    <Loader2
                      size={16}
                      className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground"
                    />
                  )}
                </div>

                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-background border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {searchResults.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addProduct(product)}
                        className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0 cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{product.name}</p>
                            {product.reference && (
                              <p className="text-xs text-muted-foreground font-mono">
                                Ref. {product.reference}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {product.price > 0 && (
                              <span className="text-sm font-semibold text-muted-foreground">
                                {product.price.toLocaleString('fr-FR', {
                                  minimumFractionDigits: 2,
                                })}{' '}
                                € HT
                              </span>
                            )}
                            <Plus
                              size={16}
                              className="text-primary flex-shrink-0"
                            />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {showDropdown &&
                  searchQuery.trim().length >= 2 &&
                  !searching &&
                  searchResults.length === 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-background border border-border rounded-lg shadow-lg p-4 text-sm text-muted-foreground text-center">
                      Aucun produit trouve.
                    </div>
                  )}
              </div>

              {/* Line items */}
              {lineItems.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground border-2 border-dashed border-border/60 rounded-lg">
                  <FileText
                    size={28}
                    className="mx-auto mb-2 opacity-40"
                  />
                  <p className="text-sm">
                    Aucun produit ajoute. Utilisez la recherche ci-dessus.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lineItems.map((item) => (
                    <div
                      key={item.product.id}
                      className="border border-border/60 rounded-lg p-4 bg-muted/5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">
                            {item.product.name}
                          </p>
                          {item.product.reference && (
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">
                              Ref. {item.product.reference}
                            </p>
                          )}
                          {item.product.price > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.product.price.toLocaleString('fr-FR', {
                                minimumFractionDigits: 2,
                              })}{' '}
                              € HT / unite
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeProduct(item.product.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0 h-8 w-8"
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-0 bg-background rounded-md ring-1 ring-border">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.product.id,
                                item.quantity - 1
                              )
                            }
                            disabled={item.quantity <= 1}
                            className="w-8 h-8 rounded-l-md flex items-center justify-center text-foreground hover:bg-muted transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-10 h-8 text-center font-semibold text-sm flex items-center justify-center border-x border-border">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.product.id,
                                item.quantity + 1
                              )
                            }
                            className="w-8 h-8 rounded-r-md flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        {item.product.price > 0 && (
                          <p className="font-semibold text-sm">
                            {(
                              item.product.price * item.quantity
                            ).toLocaleString('fr-FR', {
                              minimumFractionDigits: 2,
                            })}{' '}
                            €
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Total */}
                  <div className="border border-border rounded-lg p-4 bg-muted/10">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">
                        Total estime HT
                      </span>
                      <span className="font-bold text-lg">
                        {totalHT > 0
                          ? `${totalHT.toLocaleString('fr-FR', {
                              minimumFractionDigits: 2,
                            })} €`
                          : 'Sur devis'}
                      </span>
                    </div>
                    {totalHT > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        * Prix indicatif. Le devis definitif pourra varier.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-6 mt-2">
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />{' '}
                Enregistrement...
              </>
            ) : (
              <>
                <Save size={16} className="mr-2" /> Creer le devis
              </>
            )}
          </Button>
          <Link href="/admin/devis">
            <Button type="button" variant="outline">
              Annuler
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
