-- Mise à jour des images de couverture pour les catégories (Esthétique)
UPDATE categories SET image_url = 'https://images.unsplash.com/photo-1594917398188-f94dddf1586a?w=800&q=80' WHERE id = '1';  -- Mobilier Urbain
UPDATE categories SET image_url = 'https://images.unsplash.com/photo-1528690186981-a832ca87ba05?w=800&q=80' WHERE id = '2';  -- Signalisation
UPDATE categories SET image_url = 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?w=800&q=80' WHERE id = '3';  -- Abris et Cycles
UPDATE categories SET image_url = 'https://images.unsplash.com/photo-1579895083984-63c63390cc38?w=800&q=80' WHERE id = '4';  -- Aménagement Sécurité

-- Nouvelles catégories importées via le fichier 002
UPDATE categories SET image_url = 'https://images.unsplash.com/photo-1517596041696-6f345c22df67?w=800&q=80' WHERE id = '10'; -- Aménagement de la Rue
UPDATE categories SET image_url = 'https://images.unsplash.com/photo-1584479898061-158583fd0614?w=800&q=80' WHERE id = '11'; -- Espaces Verts
UPDATE categories SET image_url = 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=800&q=80' WHERE id = '12'; -- Aires de Jeux
UPDATE categories SET image_url = 'https://images.unsplash.com/photo-1526466336340-2c7009476100?w=800&q=80' WHERE id = '13'; -- Équipements Sportifs
UPDATE categories SET image_url = 'https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=800&q=80' WHERE id = '14'; -- Miroirs de Sécurité
