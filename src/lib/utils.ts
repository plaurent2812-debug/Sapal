import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Formatte un délai de livraison pour affichage.
 *
 * Convention Procity (fournisseur principal) : un nombre brut = semaines.
 * Les anciennes données ont été migrées en DB pour inclure l'unité ("4 semaines",
 * "En stock (2 à 5 jours)", etc.) mais on garde ce helper pour les imports
 * futurs et les données héritées.
 *
 * Retourne une chaîne vide si le délai est vide ou "-".
 */
export function formatDelai(raw: string | null | undefined): string {
  if (!raw || raw === '-') return ''
  const trimmed = raw.trim()
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed)
    return n === 1 ? '1 semaine' : `${trimmed} semaines`
  }
  return trimmed
}
