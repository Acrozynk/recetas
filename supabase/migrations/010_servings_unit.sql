-- Add servings_unit field to recipes table
-- This allows specifying custom units for servings like "tortitas", "galletas", "unidades", etc.
-- When null, defaults to "personas" (people) in the UI

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS servings_unit TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN recipes.servings_unit IS 'Custom unit for servings (e.g., tortitas, galletas, unidades). When null, uses personas as default.';















