# Design Spec — Éditeur de taxonomie (panneau latéral)

**Date :** 2026-04-22  
**Statut :** Approuvé  

---

## Contexte

Le site SAPAL dispose d'un mode éditeur inline pour les fiches produits (via `AdminEditButton`). Cette spec étend ce pattern aux pages de taxonomie du catalogue (`/catalogue/[slug]`), permettant aux admins de modifier nom, description, image, slug et sort_order directement depuis la page publique.

---

## Objectif

Ajouter un panneau latéral coulissant sur chaque page de catégorie, accessible uniquement aux admins, pour modifier les métadonnées d'une catégorie sans quitter la page.

---

## Architecture

### Nouveau composant

**`/src/components/catalogue/category-edit-panel.tsx`**  
- Client component (`'use client'`)
- Panneau fixed depuis la droite (slide-in), overlay sombre derrière
- Props : `category: ClientCategory`, `isOpen: boolean`, `onClose: () => void`, `onSaved: (updated: ClientCategory) => void`
- Gère l'état local des champs, l'upload image, et la soumission

### Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `/src/app/catalogue/[slug]/page.tsx` | Convertir en client component, ajouter state `isEditing`, intégrer `CategoryEditPanel` |
| `/src/components/catalogue/admin-edit-button.tsx` | Ajouter support mode "category" (callback `onEdit` au lieu de navigation) |
| `/src/app/actions/categories.ts` | Nouvelle Server Action `updateCategory` avec vérification session + revalidatePath |

---

## Champs du formulaire

| Champ | Type UI | Validation | Condition |
|-------|---------|------------|-----------|
| `name` | text input | Requis | Toujours |
| `slug` | text input | Requis, unique | Toujours, auto-généré depuis name |
| `description` | textarea | Optionnel | Toujours |
| `image_url` | upload + URL | Optionnel | Toujours |
| `sort_order` | number input | Entier ≥ 0 | Toujours |
| `universe` | text input | Optionnel | Seulement si `level === 1` |

---

## Gestion des images

Deux modes coexistent dans le même champ :

1. **Upload fichier** : bouton "Choisir un fichier" → upload vers `supabase.storage.from('categories')` → chemin : `{category_id}/{timestamp}.{ext}` → URL publique récupérée via `getPublicUrl`
2. **URL manuelle** : input texte, prend priorité si renseigné manuellement après un upload

Pendant l'upload : indicateur de chargement sur le bouton, champ URL mis à jour automatiquement.

---

## Flux de sauvegarde

```
Admin clique "Modifier"
  → isEditing = true → panneau s'ouvre (slide-in)
  → Champs pré-remplis avec données catégorie courante

Admin modifie les champs
  → (optionnel) upload image → URL mise à jour automatiquement

Admin clique "Enregistrer"
  → Appel Server Action updateCategory(id, payload)
    → Vérifie session admin côté serveur
    → supabase.from('categories').update({...}).eq('id', id)
    → revalidatePath('/catalogue/[slug]')
  → onSaved(updatedCategory) → ferme panneau
  → Page reflète les nouvelles données (state local mis à jour)
```

---

## Server Action

**`/src/app/actions/categories.ts`**

```typescript
'use server'

export async function updateCategory(id: string, payload: {
  name: string
  slug: string
  description: string
  image_url: string
  sort_order: number
  universe?: string
}): Promise<{ error?: string }>
```

- Vérifie session via `createServerClient` (SSR Supabase)
- Vérifie que l'utilisateur a le rôle admin
- Met à jour la table `categories`
- Appelle `revalidatePath` sur le slug concerné ET sur `/catalogue`

---

## Sécurité

- Le bouton "Modifier" est conditionné à la session admin (pattern existant `AdminEditButton`)
- La Server Action re-vérifie la session côté serveur (défense en profondeur)
- Pas d'exposition de clés Supabase côté client au-delà de la clé publique existante

---

## Non inclus dans cette spec

- Suppression de catégories (déjà gérée dans `/admin/categories`)
- Création de nouvelles catégories (idem)
- Réorganisation de l'arborescence (drag & drop)
- Modification des catégories enfants depuis la page parente
