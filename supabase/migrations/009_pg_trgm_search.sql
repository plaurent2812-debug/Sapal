-- Recherche fuzzy avec pg_trgm
create extension if not exists pg_trgm;

-- Index trigram sur le nom produit
create index idx_products_name_trgm on products using gin (name gin_trgm_ops);

-- Fonction RPC de recherche fuzzy
create or replace function search_products_fuzzy(search_term text, max_results int default 10)
returns setof products
language sql stable
as $$
  select *
  from products
  where
    -- Match trigram (tolérant aux typos)
    similarity(name, search_term) > 0.1
    -- OU match substring classique (nom, description, référence)
    or name ilike '%' || search_term || '%'
    or description ilike '%' || search_term || '%'
    or reference ilike '%' || search_term || '%'
  order by
    -- Priorité : similarité trigram descendante
    similarity(name, search_term) desc,
    name asc
  limit max_results;
$$;
