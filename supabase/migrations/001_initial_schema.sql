-- ============================================
-- SAPAL Signalisation — Schéma initial
-- ============================================

-- Catégories de produits
create table if not exists categories (
  id text primary key,
  name text not null,
  slug text not null unique,
  description text not null default '',
  image_url text not null default '',
  created_at timestamptz not null default now()
);

-- Produits
create table if not exists products (
  id text primary key,
  category_id text not null references categories(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text not null default '',
  specifications jsonb not null default '{}',
  image_url text not null default '',
  created_at timestamptz not null default now()
);

create index idx_products_category on products(category_id);
create index idx_products_slug on products(slug);

-- Demandes de devis
create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  entity text not null,
  contact_name text not null,
  email text not null,
  phone text not null,
  message text,
  items jsonb not null default '[]',
  status text not null default 'pending' check (status in ('pending', 'sent', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

-- Messages de contact
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  subject text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- ============================================
-- Row Level Security
-- ============================================

alter table categories enable row level security;
alter table products enable row level security;
alter table quotes enable row level security;
alter table contacts enable row level security;

-- Lecture publique pour le catalogue
create policy "Lecture publique catégories" on categories for select using (true);
create policy "Lecture publique produits" on products for select using (true);

-- Les devis et contacts sont insérables par tous (anonymes) mais lisibles uniquement côté serveur
create policy "Insertion anonyme devis" on quotes for insert with check (true);
create policy "Insertion anonyme contacts" on contacts for insert with check (true);

-- ============================================
-- Données initiales (seed)
-- ============================================

insert into categories (id, name, slug, description, image_url) values
  ('1', 'Mobilier Urbain', 'mobilier-urbain', 'Bancs, corbeilles, jardinières et grilles d''arbres pour aménager vos espaces publics.', 'https://images.unsplash.com/photo-1594917398188-f94dddf1586a?w=800&q=80'),
  ('2', 'Signalisation', 'signalisation', 'Panneaux de police, directionnels et miroirs de sécurité.', 'https://images.unsplash.com/photo-1528690186981-a832ca87ba05?w=800&q=80'),
  ('3', 'Abris et Cycles', 'abris-et-cycles', 'Abris voyageurs, abris vélos et supports cycles intelligents.', 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?w=800&q=80'),
  ('4', 'Aménagement Sécurité', 'amenagement-securite', 'Barrières, portiques et plots pour sécuriser vos accès.', 'https://images.unsplash.com/photo-1579895083984-63c63390cc38?w=800&q=80')
on conflict (id) do nothing;

insert into products (id, category_id, name, slug, description, specifications, image_url) values
  ('101', '1', 'Banc Public Silaos', 'banc-public-silaos', 'Banc contemporain alliant bois certifié et acier finition peinture sur zinc. Idéal pour les parcs et jardins.', '{"Longueur": "1800 mm", "Matériaux": "Acier et Chêne PEFC", "Garantie": "5 ans"}', 'https://images.unsplash.com/photo-1551694380-60b6d27ca543?w=800&q=80'),
  ('102', '2', 'Panneau de signalisation A14', 'panneau-a14', 'Panneau danger autres dangers. Classe 1 ou 2, profil aluminium.', '{"Classe": "1 ou 2", "Dimension": "700mm / 1000mm", "Norme": "NF"}', 'https://images.unsplash.com/photo-1615598858380-452f4dc40ce7?w=800&q=80'),
  ('103', '1', 'Corbeille Vigipirate 100L', 'corbeille-vigipirate-100l', 'Corbeille de propreté transparente conforme au plan Vigipirate. Structure acier galvanisé, sac transparent.', '{"Capacité": "100 L", "Matériaux": "Acier galvanisé", "Norme": "Vigipirate"}', 'https://images.unsplash.com/photo-1604187351574-c75ca79f5807?w=800&q=80'),
  ('104', '1', 'Jardinière Acier Corten', 'jardiniere-acier-corten', 'Jardinière rectangulaire en acier Corten auto-patinable. Finition rouille naturelle, sans entretien.', '{"Dimensions": "1200x400x500 mm", "Matériaux": "Acier Corten 3mm", "Poids": "65 kg"}', 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&q=80'),
  ('105', '2', 'Panneau Directionnel D21', 'panneau-directionnel-d21', 'Panneau de direction type D21. Fond bleu, texte blanc. Aluminium classe 1 ou 2.', '{"Type": "D21", "Dimension": "350x1050 mm", "Rétroréflexion": "Classe 1 ou 2"}', 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=800&q=80'),
  ('106', '2', 'Miroir de Sécurité Routier', 'miroir-securite-routier', 'Miroir convexe pour visibilité aux intersections. Fixation poteau ou murale. Résistant aux intempéries.', '{"Diamètre": "600 mm", "Matériaux": "Polycarbonate", "Garantie": "10 ans"}', 'https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=800&q=80'),
  ('107', '3', 'Abri Voyageurs Abribus Standard', 'abri-voyageurs-standard', 'Abri bus structure aluminium avec toiture polycarbonate. Capacité 6 à 10 personnes.', '{"Longueur": "4000 mm", "Matériaux": "Aluminium + Polycarbonate", "Places": "6 à 10"}', 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800&q=80'),
  ('108', '3', 'Rack Vélos 5 Places', 'rack-velos-5-places', 'Support vélos en acier galvanisé à chaud. Fixation au sol par chevilles. Design épuré.', '{"Places": "5", "Matériaux": "Acier galvanisé", "Fixation": "Au sol"}', 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&q=80'),
  ('109', '3', 'Abri Vélos Fermé 10 Places', 'abri-velos-ferme-10', 'Abri vélos sécurisé avec parois latérales et porte à badge. Toiture cintrée polycarbonate.', '{"Places": "10", "Dimensions": "5000x2000x2200 mm", "Sécurité": "Badge / clé"}', 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=800&q=80'),
  ('110', '4', 'Barrière Ville Croix de Saint-André', 'barriere-croix-saint-andre', 'Barrière de ville modèle croix de Saint-André en acier. Finition thermolaquée RAL au choix.', '{"Longueur": "1500 mm", "Hauteur": "1100 mm", "Finition": "RAL au choix"}', 'https://images.unsplash.com/photo-1586348943529-beaae6c28db9?w=800&q=80'),
  ('111', '4', 'Borne Anti-Bélier Fixe', 'borne-anti-belier-fixe', 'Borne de protection anti-véhicule en acier rempli béton. Haute résistance aux impacts.', '{"Diamètre": "220 mm", "Hauteur": "600 mm", "Résistance": "Haute (rempli béton)"}', 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800&q=80'),
  ('112', '4', 'Portique Limitation Hauteur 2m', 'portique-limitation-hauteur', 'Portique de limitation de hauteur réglable. Structure acier galvanisé avec bandes réfléchissantes.', '{"Hauteur limite": "2000 mm", "Largeur passage": "3500 mm", "Signalétique": "Bandes rouges/blanches"}', 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&q=80')
on conflict (id) do nothing;
