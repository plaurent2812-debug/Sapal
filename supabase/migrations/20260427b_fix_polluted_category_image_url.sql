-- Restaure l'URL Supabase d'origine de `categories.image_url` pour la sous-catégorie
-- "Solutions fumeurs" : un copier-coller depuis DevTools Network avait stocké
-- l'URL d'optimisation Vercel `https://sapal-site.vercel.app/_next/image?url=…`
-- comme src d'image, ce qui faisait crasher le rendu de la page parente
-- (`/catalogue/mobilier-urbain`) avec :
--   "Invalid src prop, hostname sapal-site.vercel.app is not configured"
-- L'URL réelle est extraite du paramètre `url=` encodé.

UPDATE categories
SET image_url = 'https://dpycswobcixsowvxnvdc.supabase.co/storage/v1/object/public/supplier-media/procity/products/529405/gallery/204%20-%20529405%2B529407%2B529408%2B209147.jpg'
WHERE id = 'proc-mobilier-urbain-solutions-fumeurs'
  AND image_url LIKE '%vercel.app/_next/image%';
