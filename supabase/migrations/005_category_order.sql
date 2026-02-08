-- Category Order per Supermarket
-- This migration adds support for custom category ordering per supermarket
-- Each supermarket can have its own order for displaying categories in the shopping list

-- Table to store category order per supermarket
CREATE TABLE IF NOT EXISTS supermarket_category_order (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supermarket supermarket_name NOT NULL,
  category TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supermarket, category)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_supermarket_category_order_supermarket ON supermarket_category_order(supermarket);
CREATE INDEX IF NOT EXISTS idx_supermarket_category_order_sort ON supermarket_category_order(supermarket, sort_order);

-- Updated at trigger
DROP TRIGGER IF EXISTS update_supermarket_category_order_updated_at ON supermarket_category_order;
CREATE TRIGGER update_supermarket_category_order_updated_at
  BEFORE UPDATE ON supermarket_category_order
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE supermarket_category_order ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations
CREATE POLICY "Allow all for supermarket_category_order" ON supermarket_category_order 
  FOR ALL USING (true) WITH CHECK (true);

-- Insert default category orders for each supermarket
-- These are sensible defaults that can be customized by the user

-- DIA default order
INSERT INTO supermarket_category_order (supermarket, category, sort_order) VALUES
  ('DIA', 'Frutas y Verduras', 1),
  ('DIA', 'Panadería', 2),
  ('DIA', 'Lácteos', 3),
  ('DIA', 'Carnes y Mariscos', 4),
  ('DIA', 'Congelados', 5),
  ('DIA', 'Despensa', 6),
  ('DIA', 'Bebidas', 7),
  ('DIA', 'Otros', 8)
ON CONFLICT (supermarket, category) DO NOTHING;

-- Consum default order
INSERT INTO supermarket_category_order (supermarket, category, sort_order) VALUES
  ('Consum', 'Lácteos', 1),
  ('Consum', 'Frutas y Verduras', 2),
  ('Consum', 'Carnes y Mariscos', 3),
  ('Consum', 'Panadería', 4),
  ('Consum', 'Despensa', 5),
  ('Consum', 'Congelados', 6),
  ('Consum', 'Bebidas', 7),
  ('Consum', 'Otros', 8)
ON CONFLICT (supermarket, category) DO NOTHING;

-- Mercadona default order
INSERT INTO supermarket_category_order (supermarket, category, sort_order) VALUES
  ('Mercadona', 'Frutas y Verduras', 1),
  ('Mercadona', 'Carnes y Mariscos', 2),
  ('Mercadona', 'Lácteos', 3),
  ('Mercadona', 'Panadería', 4),
  ('Mercadona', 'Despensa', 5),
  ('Mercadona', 'Bebidas', 6),
  ('Mercadona', 'Congelados', 7),
  ('Mercadona', 'Otros', 8)
ON CONFLICT (supermarket, category) DO NOTHING;






















