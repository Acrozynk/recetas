-- Containers table for baking recipes
-- Allows recipes to use containers (molds, pans) as portion units instead of servings

CREATE TABLE IF NOT EXISTS containers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add container support to recipes
-- container_id: which container this recipe uses (null = uses servings instead)
-- container_quantity: how many containers the original recipe makes (default 1)
ALTER TABLE recipes 
  ADD COLUMN IF NOT EXISTS container_id UUID REFERENCES containers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS container_quantity NUMERIC DEFAULT 1;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_recipes_container ON recipes(container_id);

-- RLS for containers
ALTER TABLE containers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for containers" ON containers FOR ALL USING (true) WITH CHECK (true);

-- Insert some common containers to get started
INSERT INTO containers (name) VALUES 
  ('molde pequeño'),
  ('molde grande'),
  ('molde rectangular'),
  ('bandeja de horno')
ON CONFLICT (name) DO NOTHING;

