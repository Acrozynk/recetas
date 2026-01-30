-- Custom products: productos añadidos manualmente por el usuario
-- que se guardan para futuras búsquedas

CREATE TABLE IF NOT EXISTS custom_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Otros',
  subcategory TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Evitar duplicados por nombre (case insensitive)
  CONSTRAINT unique_custom_product_name UNIQUE (name)
);

-- Índice para búsquedas rápidas por nombre
CREATE INDEX IF NOT EXISTS idx_custom_products_name 
ON custom_products USING gin(to_tsvector('spanish', name));

-- Índice para búsquedas por categoría
CREATE INDEX IF NOT EXISTS idx_custom_products_category 
ON custom_products(category);

-- RLS: Por ahora sin autenticación, todos pueden leer/escribir
ALTER TABLE custom_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read custom products"
ON custom_products FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert custom products"
ON custom_products FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update custom products"
ON custom_products FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete custom products"
ON custom_products FOR DELETE
USING (true);

