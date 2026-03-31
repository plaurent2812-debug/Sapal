-- Table de liaison produit → options
create table if not exists product_options (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references products(id) on delete cascade,
  option_product_id text not null references products(id) on delete cascade,
  unique(product_id, option_product_id)
);
create index idx_product_options_product on product_options(product_id);
alter table product_options enable row level security;
create policy "Lecture publique options" on product_options for select using (true);

-- Seed : Options Station Bus
INSERT INTO product_options (product_id, option_product_id) VALUES
  -- Options Station Bus Conviviale® (1204) → 2 parents
  ('1276', '1204'), ('1277', '1204'),
  -- Options Station Bus Kub. (1205)
  ('1278', '1205'),
  -- Options Station Bus Milan (1206)
  ('1279', '1206'),
  -- Options Station Bus Modulo (1207)
  ('1280', '1207'),
  -- Options Station Bus Turin (1208)
  ('1282', '1208'),
  -- Options Station Bus Venise (1209)
  ('1283', '1209'), ('1284', '1209'),
  -- Options Station Bus Voûte (1210)
  ('1285', '1210'),

  -- Option Abris Vélos Sécurisés (1198)
  ('1012', '1198'), ('1017', '1198'),

  -- Option Tables Pique-Nique Turin, Dublin, Rome & Lyon (1199)
  ('1296', '1199'), ('1297', '1199'), ('1298', '1199'),
  ('1299', '1199'), ('1302', '1199'), ('1303', '1199'),

  -- Option Écrase Cigarette (1200) → corbeilles principales
  ('1110', '1200'), ('1111', '1200'), ('1113', '1200'),
  ('1115', '1200'), ('1116', '1200'), ('1117', '1200'),
  ('1119', '1200'), ('1120', '1200'), ('1121', '1200'),
  ('1122', '1200'), ('1125', '1200'),

  -- Options Bacs À Palmier (1201)
  ('1038', '1201'), ('1039', '1201'), ('1040', '1201'),
  ('1041', '1201'), ('1042', '1201'),

  -- Options Corbeilles De Propreté (1202)
  ('1110', '1202'), ('1111', '1202'), ('1113', '1202'),
  ('1114', '1202'), ('1115', '1202'), ('1116', '1202'),
  ('1117', '1202'), ('1119', '1202'), ('1120', '1202'),
  ('1121', '1202'), ('1122', '1202'), ('1123', '1202'), ('1125', '1202'),

  -- Options Jeux Sur Ressort (1203)
  ('1145', '1203'), ('1146', '1203'), ('1147', '1203'),
  ('1148', '1203'), ('1149', '1203'), ('1150', '1203'),
  ('1151', '1203'), ('1152', '1203'), ('1153', '1203'),
  ('1154', '1203'), ('1155', '1203'), ('1156', '1203'),
  ('1157', '1203'), ('1158', '1203'), ('1159', '1203'),
  ('1160', '1203'), ('1161', '1203'), ('1162', '1203'),
  ('1163', '1203');
