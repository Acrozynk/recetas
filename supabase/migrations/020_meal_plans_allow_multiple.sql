-- Allow multiple meal plans per (plan_date, meal_type)
-- e.g. to plan one recipe for adults and a different one for kids
-- in the same lunch slot.

ALTER TABLE meal_plans
  DROP CONSTRAINT IF EXISTS meal_plans_plan_date_meal_type_key;

COMMENT ON TABLE meal_plans IS
  'Meal plans. (plan_date, meal_type) is intentionally NOT unique: a single meal can have several recipes (e.g. adults + kids).';
