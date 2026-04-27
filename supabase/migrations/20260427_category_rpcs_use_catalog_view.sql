-- Aligne les RPC catégorie sur la vue `catalog_products` (qui exclut les options
-- Procity masquées du catalogue public, cf. leçon 7.10 du 24 avril 2026).
-- Sans ce fix, `category_product_counts` compte 689 produits sur "Mobilier urbain"
-- alors que la vue n'en expose que 629 → incohérent avec ce que l'utilisateur voit.

CREATE OR REPLACE FUNCTION public.category_product_counts(
  root_ids text[],
  supplier_filter text DEFAULT NULL
)
RETURNS TABLE(category_id text, product_count bigint)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE tree AS (
    SELECT c.id AS root_id, c.id AS descendant_id
    FROM categories c
    WHERE c.id = ANY(root_ids)
    UNION ALL
    SELECT t.root_id, c.id
    FROM categories c
    JOIN tree t ON c.parent_id = t.descendant_id
  )
  SELECT
    t.root_id AS category_id,
    COUNT(p.id) AS product_count
  FROM tree t
  LEFT JOIN catalog_products p
    ON p.category_id = t.descendant_id
    AND (supplier_filter IS NULL OR p.supplier = supplier_filter)
  GROUP BY t.root_id;
$$;

CREATE OR REPLACE FUNCTION public.category_thumbnails(
  root_ids text[],
  supplier_filter text DEFAULT NULL
)
RETURNS TABLE(category_id text, image_url text)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE tree AS (
    SELECT c.id AS root_id, c.id AS descendant_id
    FROM categories c
    WHERE c.id = ANY(root_ids)
    UNION ALL
    SELECT t.root_id, c.id
    FROM categories c
    JOIN tree t ON c.parent_id = t.descendant_id
  ),
  ranked AS (
    SELECT
      t.root_id,
      p.image_url,
      ROW_NUMBER() OVER (PARTITION BY t.root_id ORDER BY p.id) AS rn
    FROM tree t
    JOIN catalog_products p
      ON p.category_id = t.descendant_id
      AND p.image_url IS NOT NULL
      AND p.image_url <> ''
      AND (supplier_filter IS NULL OR p.supplier = supplier_filter)
  )
  SELECT root_id AS category_id, image_url
  FROM ranked
  WHERE rn = 1;
$$;
