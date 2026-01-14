-- Add support for variant selection in meal plans
-- This allows tracking which ingredient variant and alternatives the user selected

-- selected_variant: 1 = primary amounts (amount/unit), 2 = secondary amounts (amount2/unit2)
-- Default is 1 for recipes without variants
ALTER TABLE meal_plans 
  ADD COLUMN IF NOT EXISTS selected_variant INTEGER DEFAULT 1 CHECK (selected_variant IN (1, 2));

-- alternative_selections: JSONB object mapping ingredient index to boolean
-- true = use the alternative ingredient, false/missing = use the primary ingredient
-- e.g., {"0": true, "3": true} means use alternatives for ingredients 0 and 3
ALTER TABLE meal_plans 
  ADD COLUMN IF NOT EXISTS alternative_selections JSONB DEFAULT '{}';

-- Comment for documentation
COMMENT ON COLUMN meal_plans.selected_variant IS 'Which ingredient variant to use: 1 = primary amounts, 2 = secondary amounts';
COMMENT ON COLUMN meal_plans.alternative_selections IS 'JSON object mapping ingredient indices to boolean (true = use alternative ingredient)';









