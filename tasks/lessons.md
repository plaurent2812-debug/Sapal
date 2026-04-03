# SAPAL — Lessons Learned

## 03/04/2026

| Problème | Cause | Règle |
|----------|-------|-------|
| Buffer non assignable à BlobPart (TS strict + Node 22) | SharedArrayBuffer incompatible avec ArrayBuffer | Wrapper `new Uint8Array(buffer)` avant `new Blob()` |
| Webhooks inutilisables en dev local | Nécessitent URL publique | Préférer logique côté application (API routes). Webhooks = optionnel post-déploiement |
| RLS confuses quand beaucoup de rôles | Policies empilées sans vision globale | Toujours faire un tableau rôle × table × permission AVANT d'écrire les policies |
| user_metadata vs app_metadata pour le rôle | Supabase stocke dans app_metadata via admin API, user_metadata via signup | Vérifier les deux dans le middleware avec fallback chain |
| Login mouline indéfiniment après déploiement Vercel | Client navigateur utilisait `createClient` de `@supabase/supabase-js` (localStorage) alors que le middleware utilise `@supabase/ssr` (cookies) → session invisible pour le middleware → boucle de redirection | **TOUJOURS** utiliser `createBrowserClient` de `@supabase/ssr` côté navigateur quand le middleware utilise `@supabase/ssr`. Ne jamais mixer les deux systèmes de stockage de session |
| RLS policies retournent 0 résultats au lieu de données | Les policies utilisant `EXISTS (SELECT FROM auth.users WHERE raw_user_meta_data->>'role'...)` échouent silencieusement avec le client SSR | **TOUJOURS** utiliser `auth.jwt() -> 'user_metadata' ->> 'role'` dans les policies RLS, jamais de subquery sur `auth.users`. La lecture directe du JWT est plus fiable et plus performante |
| Montants PDF affichent des `/` au lieu d'espaces (ex: `12 /730,90 €`) | `toLocaleString('fr-FR')` utilise U+202F (espace fine insécable) comme séparateur milliers, jsPDF ne le supporte pas | Toujours `.replace(/\u202f/g, ' ').replace(/\u00a0/g, ' ')` après `toLocaleString` dans les générateurs PDF |

## 28/03/2026

| Problème | Cause | Règle |
|----------|-------|-------|
| Site mouline en dev, "compiling" infini | `turbopack.root` pas configuré → Turbopack scannait tout le home directory | Toujours configurer `turbopack.root: __dirname` dans next.config.ts quand il y a des lockfiles multiples |
| Pages catégorie timeout en dev | 50+ ProductCard avec framer-motion `motion.div` chacun → compilation lente | Ne jamais wrapper des dizaines de composants individuels dans `motion.div`. Utiliser du CSS pur pour les hover sur les listes longues |
| AnimatedItem x60 sur une page bloquait Turbopack | Chaque AnimatedItem crée un `useInView` observer → trop d'observers | Limiter les `AnimatedItem` aux petites listes (<15 items). Pour les grilles produits, pas d'animation individuelle |
| Serveur dev bloqué après requêtes concurrentes | Turbopack ne gère qu'une compilation à la fois → les requêtes suivantes s'empilent | En dev, charger les pages une par une. En prod (`next build && next start`), pas de problème |
| Header/Footer du site visible dans le panel admin | Le layout admin est un enfant du root layout qui inclut Header/Footer | Utiliser `fixed inset-0 z-[100] bg-background` sur le wrapper admin pour couvrir le site public |
| Next.js 16 Image : `priority` deprecated | `priority` prop supprimé en faveur de `preload` | Utiliser `preload` au lieu de `priority` pour les images above-the-fold |
| Images produits dynamiques (URLs Supabase) | Les URLs viennent de la DB, domaines inconnus à l'avance | Utiliser `unoptimized` pour les images dynamiques dont le domaine n'est pas prévisible, `remotePatterns` uniquement pour les domaines connus (Unsplash) |
