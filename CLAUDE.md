# SAPAL Signalisation — Instructions projet

## Stack
- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS 4 (pas de CSS Modules — différent d'OptiPro)
- Supabase (PostgreSQL, Auth JWT, Storage)
- Zustand (state management client)
- PWA activée
- Déploiement : Vercel connecté au repo GitHub (auto-deploy)

## Périmètre métier
Site e-commerce B2B/B2C pour SAPAL Signalisation (Cannes) — mobilier urbain et signalisation routière
- Catalogue 1000+ produits avec variantes et recherche full-text
- Panier devis (pas panier achat classique)
- Admin : CRUD produits/catégories, gestion devis, profils clients
- Génération PDF devis compatibles Chorus Pro (jsPDF)

## Intégrations
- **Resend** : emails transactionnels
- **Telegram** : notifications
- **jsPDF** : génération devis + conformité Chorus Pro
- **Pennylane API v2** : stub présent — PAS encore actif (ne pas implémenter sans instruction explicite)

## Workflow Git
- Ne jamais pousser directement sur `main`
- Toujours créer une branche dédiée pour chaque modification
- Passer par une Pull Request pour merger vers `main`
- Vercel est connecté au repo GitHub — chaque push déclenche un déploiement automatique (preview sur branche, production sur `main`)

## Conventions
- Tailwind CSS 4 uniquement — pas de styles inlustand pour tout état global côté client
- Supabase service role uniquement côté serveur
- Ne jamais commiter de secrets — tout passe par `.env.local`

## Outils MCP
- **Context7** : consulter avant toute implémentation touchant une API ou librairie
- **Supabase MCP** : inspecter schéma, requêter DB, gérer auth/storage directement

## État actuel
- Développement avancé (~85%), pas encore déployé
- Dernier commit : 3 avril 2026
- Priorité : finalisation avant mise en prod

## Pièges à éviter
- Tailwind CSS 4 : syntaxe différente de v3 — toujours vérifier via Context7
- Next.js 16 + React 19 : éviter les patterns expérimentaux non stabilisés
- Pennylane : stub présent mais inactif — ne pas toucher sans instruction explicite
- Chorus Pro : format PDF réglementé — ne pas modifier la structure sans validation

## Note
Ce projet remplace AGENTS.md — la règle de consulter node_modules/next/dist/docs/ reste valide.
