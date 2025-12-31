-- Add servings multiplier to meal plans
-- This allows users to adjust portions when adding recipes to the meal plan
-- A multiplier of 2 means double the ingredients, 0.5 means half, etc.
ALTER TABLE meal_plans 
  ADD COLUMN IF NOT EXISTS servings_multiplier NUMERIC DEFAULT 1 CHECK (servings_multiplier > 0);

COMMENT ON COLUMN meal_plans.servings_multiplier IS 'Multiplier for ingredient amounts (1 = recipe default, 2 = double, 0.5 = half)';

-- Add recipe sources to shopping items
-- This tracks which recipe(s) each ingredient comes from
-- Stored as an array of recipe titles for display purposes
ALTER TABLE shopping_items 
  ADD COLUMN IF NOT EXISTS recipe_sources TEXT[] DEFAULT '{}';

COMMENT ON COLUMN shopping_items.recipe_sources IS 'Array of recipe titles that contributed to this shopping item';

-- Index for searching items by recipe sources
CREATE INDEX IF NOT EXISTS idx_shopping_items_recipe_sources ON shopping_items USING GIN(recipe_sources);

