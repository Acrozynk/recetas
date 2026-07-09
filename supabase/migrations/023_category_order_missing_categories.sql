-- Add Comida Preparada and Droguería to supermarket category order (missing from 005 seed)
INSERT INTO supermarket_category_order (supermarket, category, sort_order) VALUES
  ('DIA', 'Comida Preparada', 9),
  ('DIA', 'Droguería', 10),
  ('Consum', 'Comida Preparada', 9),
  ('Consum', 'Droguería', 10),
  ('Mercadona', 'Comida Preparada', 8),
  ('Mercadona', 'Droguería', 9)
ON CONFLICT (supermarket, category) DO NOTHING;

-- Keep Otros last after the new categories
UPDATE supermarket_category_order SET sort_order = 11 WHERE supermarket = 'DIA' AND category = 'Otros';
UPDATE supermarket_category_order SET sort_order = 11 WHERE supermarket = 'Consum' AND category = 'Otros';
UPDATE supermarket_category_order SET sort_order = 10 WHERE supermarket = 'Mercadona' AND category = 'Otros';
