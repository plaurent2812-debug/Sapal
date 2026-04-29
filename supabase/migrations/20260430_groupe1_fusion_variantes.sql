-- Groupe 1 — Fusion variantes pour 18 familles Procity simples (1 axe, 2-4 déclinaisons)
-- Pattern Vitrine 2000 : 1 produit principal + N variantes, pas de duplication dans products.
-- Données extraites du PIM Procity du 22 avril 2026.
-- Specs scindées par variante quand le PIM mentionnait des "ou" différenciants.
-- Migration appliquée en prod le 30 avril 2026.

-- 18 familles : 111523, 111533, 204415, 204506, 204560, 204562,
--              204734, 204790, 205000, 205012, 206553, 206778,
--              207002, 208063, 208067, 208082, 302000, 407509
-- Total : 45 variantes créées.

-- Note : ce fichier est un SNAPSHOT de la migration appliquée via le MCP Supabase.
-- Le SQL exact (multi-statements avec INSERT + UPDATE) a été exécuté en plusieurs
-- batches dans la session du 30 avril 2026. Voir le commit Git associé pour la
-- traçabilité, et `tasks/lessons.md` pour les pièges identifiés.

-- Vérification post-migration :
-- SELECT p.id, p.name, COUNT(pv.id) AS nb_variants
-- FROM products p JOIN product_variants pv ON pv.product_id = p.id
-- WHERE p.id IN ('111523','111533','204415','204506','204560','204562',
--                '204734','204790','205000','205012','206553','206778',
--                '207002','208063','208067','208082','302000','407509')
-- GROUP BY p.id ORDER BY p.id;
-- Résultat attendu : 18 lignes, total 45 variantes.

SELECT 'Migration Groupe 1 — voir docs/superpowers/specs pour le détail' AS info;
