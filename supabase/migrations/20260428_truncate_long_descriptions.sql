-- Tronque les descriptions Procity encore > 500 caractères après l'application
-- de 20260427c (qui n'a couvert que les 580 produits présents dans le PIM
-- mobilier urbain 22-04-2026). Les 86 produits restants ne sont pas dans ce
-- PIM (autres familles : aires de jeux, miroirs, balisage, gammes anciennes…).
--
-- Heuristique : on garde la première phrase complète si elle est ≥ 80 char et
-- ≤ 350 char ; sinon on coupe à 250 char au dernier espace + ellipse.

DROP TABLE IF EXISTS _backup_descriptions_truncate_20260428;
CREATE TABLE _backup_descriptions_truncate_20260428 AS
SELECT id, description, NOW() AS backed_up_at
FROM products
WHERE supplier='procity' AND LENGTH(description) > 500;

UPDATE products
SET description = (
  WITH parts AS (
    SELECT
      description AS full_text,
      regexp_instr(description, '\.[\s\r\n]', 1) AS first_period_pos
  )
  SELECT
    CASE
      WHEN first_period_pos > 80 AND first_period_pos <= 350
        THEN substring(full_text FROM 1 FOR first_period_pos)
      ELSE
        rtrim(substring(full_text FROM 1 FOR
          GREATEST(
            COALESCE(NULLIF(regexp_instr(substring(full_text FROM 1 FOR 250), '[\s][^\s]*$'), 0), 250) - 1,
            150
          )
        ), ' .,;:') || '…'
    END
  FROM parts
)
WHERE supplier='procity' AND LENGTH(description) > 500;
