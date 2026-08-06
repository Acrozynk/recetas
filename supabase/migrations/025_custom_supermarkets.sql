-- Custom supermarket lists: drop enum/check limits so any store id (TEXT) works.
-- Disabling a store in app_settings only hides it; data stays keyed by id.

ALTER TABLE shopping_items DROP CONSTRAINT IF EXISTS shopping_items_supermarket_check;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'supermarket_category_order'
      AND udt_name = 'supermarket_name'
  ) THEN
    ALTER TABLE supermarket_category_order
      ALTER COLUMN supermarket TYPE TEXT USING supermarket::TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'item_supermarket_history'
      AND udt_name = 'supermarket_name'
  ) THEN
    ALTER TABLE item_supermarket_history
      ALTER COLUMN supermarket TYPE TEXT USING supermarket::TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shopping_lists'
      AND udt_name = 'supermarket_name'
  ) THEN
    ALTER TABLE shopping_lists
      ALTER COLUMN supermarket TYPE TEXT USING supermarket::TEXT;
  END IF;
END $$;

-- learn_from_shopping_items: stop casting to enum
CREATE OR REPLACE FUNCTION learn_from_shopping_items()
RETURNS TRIGGER AS $$
DECLARE
  v_normalized TEXT;
BEGIN
  v_normalized := lower(trim(NEW.name));

  INSERT INTO item_supermarket_history (item_name, item_name_normalized, supermarket, frequency, last_used_at)
  VALUES (NEW.name, v_normalized, NEW.supermarket, 1, NOW())
  ON CONFLICT (item_name_normalized, supermarket)
  DO UPDATE SET
    frequency = item_supermarket_history.frequency + 1,
    last_used_at = NOW(),
    item_name = EXCLUDED.item_name;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Default supermarkets config (enable/disable + colors in settings UI)
INSERT INTO app_settings (key, value) VALUES (
  'supermarkets',
  '[
    {"id":"DIA","name":"DIA","enabled":true,"color":"#b91c1c","sortOrder":0,"builtin":true},
    {"id":"Consum","name":"Consum","enabled":true,"color":"#c2410c","sortOrder":1,"builtin":true},
    {"id":"Mercadona","name":"Mercadona","enabled":true,"color":"#15803d","sortOrder":2,"builtin":true}
  ]'::jsonb
)
ON CONFLICT (key) DO NOTHING;
