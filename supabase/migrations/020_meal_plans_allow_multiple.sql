-- Allow multiple meal plans per (plan_date, meal_type)
-- e.g. to plan one recipe for adults and a different one for kids
-- in the same lunch slot.

DO $$
DECLARE
  c text;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.meal_plans'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%(plan_date, meal_type)%'
  LOOP
    EXECUTE format('ALTER TABLE public.meal_plans DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

DO $$
DECLARE
  i text;
BEGIN
  FOR i IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'meal_plans'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%plan_date%'
      AND indexdef ILIKE '%meal_type%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', i);
  END LOOP;
END $$;

COMMENT ON TABLE meal_plans IS
  'Meal plans. (plan_date, meal_type) is intentionally NOT unique: a single meal can have several recipes (e.g. adults + kids).';
