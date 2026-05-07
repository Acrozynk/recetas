-- Allow free-text notes in meal_plans (e.g. "Cumpleaños", "Fuera de casa")
-- Each row must have either a recipe or a note (or both).

ALTER TABLE meal_plans
  ADD COLUMN IF NOT EXISTS note TEXT;

ALTER TABLE meal_plans
  ALTER COLUMN recipe_id DROP NOT NULL;

ALTER TABLE meal_plans
  DROP CONSTRAINT IF EXISTS meal_plans_recipe_or_note_present;

ALTER TABLE meal_plans
  ADD CONSTRAINT meal_plans_recipe_or_note_present
  CHECK (recipe_id IS NOT NULL OR note IS NOT NULL);

COMMENT ON COLUMN meal_plans.note IS
  'Optional free-text note (e.g. "Cumpleaños"). When set without a recipe, the slot is just a reminder and does not contribute to the shopping list.';
