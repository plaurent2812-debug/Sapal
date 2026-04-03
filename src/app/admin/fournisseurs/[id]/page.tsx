'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Loader2, Save } from 'lucide-react'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function EditFournisseurPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [siret, setSiret] = useState('')
  const [contactName, setContactName] = useState('')
  const [paymentTerms, setPaymentTerms] = useState<'30j' | 'prepayment'>('30j')
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/suppliers/${id}`)
        if (res.status === 404) {
          setNotFound(true)
          setLoading(false)
          return
        }
        if (!res.ok) throw new Error('Erreur lors du chargement')
        const json = await res.json()
        const s = json.supplier

        setName(s.name ?? '')
        setSlug(s.slug ?? '')
        setEmail(s.email ?? '')
        setPhone(s.phone ?? '')
        setSiret(s.siret ?? '')
        setContactName(s.contact_name ?? '')
        setPaymentTerms(s.payment_terms ?? '30j')
        setAddress(s.address ?? '')
        setPostalCode(s.postal_code ?? '')
        setCity(s.city ?? '')
        setNotes(s.notes ?? '')
      } catch (err) {
        console.error(err)
        setError('Erreur lors du chargement du fournisseur')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  function handleNameChange(newName: string) {
    setName(newName)
    setSlug(generateSlug(newName))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          email: email.trim(),
          phone: phone.trim(),
          siret: siret.trim(),
          contact_name: contactName.trim(),
          payment_terms: paymentTerms,
          address: address.trim(),
          postal_code: postalCode.trim(),
          city: city.trim(),
          notes: notes.trim(),
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Erreur lors de la mise a jour')
        setSaving(false)
        return
      }

      router.push('/admin/fournisseurs')
    } catch {
      setError('Erreur lors de la mise a jour')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 size={24} className="animate-spin mr-2" />
        Chargement...
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="text-center py-20">
        <h1 className="font-heading text-2xl mb-4">Fournisseur introuvable</h1>
        <Link href="/admin/fournisseurs">
          <Button variant="outline">Retour aux fournisseurs</Button>
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link
        href="/admin/fournisseurs"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft size={16} className="mr-1" /> Retour aux fournisseurs
      </Link>

      <h1 className="font-heading text-3xl tracking-tight mb-8">Modifier le fournisseur</h1>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">
            Nom <span className="text-destructive">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
            placeholder="Ex: Signaux Girod"
          />
        </div>

        {/* Email + Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@fournisseur.fr"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Telephone</label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="04 93 00 00 00"
            />
          </div>
        </div>

        {/* SIRET + Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">SIRET</label>
            <Input
              value={siret}
              onChange={(e) => setSiret(e.target.value)}
              placeholder="12345678901234"
              maxLength={14}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Nom du contact</label>
            <Input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Jean Dupont"
            />
          </div>
        </div>

        {/* Payment terms */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">
            Conditions de reglement <span className="text-destructive">*</span>
          </label>
          <select
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value as '30j' | 'prepayment')}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            required
          >
            <option value="30j">30 jours fin de mois</option>
            <option value="prepayment">Prepaiement</option>
          </select>
        </div>

        {/* Address */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Adresse</label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="12 rue de la Paix"
          />
        </div>

        {/* Postal code + City */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Code postal</label>
            <Input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="06400"
              maxLength={10}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Ville</label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Cannes"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            placeholder="Informations complementaires..."
          />
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-4">
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" /> Enregistrement...
              </>
            ) : (
              <>
                <Save size={16} className="mr-2" /> Enregistrer
              </>
            )}
          </Button>
          <Link href="/admin/fournisseurs">
            <Button type="button" variant="outline">
              Annuler
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
