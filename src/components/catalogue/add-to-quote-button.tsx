"use client"
import { Button } from "@/components/ui/button"
import { useQuoteStore } from "@/store/useQuoteStore"
import { ClientProduct } from "@/lib/data"
import { useState } from "react"
import { Check } from "lucide-react"

export function AddToQuoteButton({ product }: { product: ClientProduct }) {
  const addItem = useQuoteStore(state => state.addItem)
  const [added, setAdded] = useState(false)

  const handleAdd = () => {
    addItem(product, 1)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <Button size="lg" className="w-full sm:w-auto font-bold cursor-pointer transition-all" onClick={handleAdd} variant={added ? "secondary" : "default"}>
      {added ? <><Check className="mr-2 h-4 w-4" /> Ajouté !</> : "Ajouter au devis"}
    </Button>
  )
}
