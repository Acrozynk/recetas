-- Add learning trigger to shopping_items table
-- This allows the system to learn which items are typically bought at each supermarket
-- Similar to the existing trigger on shopping_list_items

-- Function to learn from shopping_items (uses supermarket column directly)
CREATE OR REPLACE FUNCTION learn_from_shopping_items()
RETURNS TRIGGER AS $$
DECLARE
  v_normalized TEXT;
BEGIN
  -- Normalize the item name
  v_normalized := LOWER(TRIM(NEW.name));
  
  -- Insert or update the frequency
  INSERT INTO item_supermarket_history (item_name, item_name_normalized, supermarket, frequency, last_used_at)
  VALUES (NEW.name, v_normalized, NEW.supermarket::supermarket_name, 1, NOW())
  ON CONFLICT (item_name_normalized, supermarket) 
  DO UPDATE SET 
    frequency = item_supermarket_history.frequency + 1,
    last_used_at = NOW(),
    item_name = EXCLUDED.item_name; -- Keep the most recent casing
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to learn from added items in shopping_items
DROP TRIGGER IF EXISTS learn_from_shopping_items_trigger ON shopping_items;
CREATE TRIGGER learn_from_shopping_items_trigger
  AFTER INSERT ON shopping_items
  FOR EACH ROW
  EXECUTE FUNCTION learn_from_shopping_items();











