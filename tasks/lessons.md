# SAPAL — Lessons Learned

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
