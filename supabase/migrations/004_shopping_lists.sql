-- Shopping Lists Enhancement: Multiple Supermarket Lists with Archiving
-- This migration adds support for:
-- 1. Multiple shopping lists per supermarket (DIA, Consum, Mercadona)
-- 2. List archiving when all items are checked
-- 3. Item-supermarket learning for suggestions

-- Create supermarkets enum (can be extended later)
CREATE TYPE supermarket_name AS ENUM ('DIA', 'Consum', 'Mercadona');

-- Shopping lists table (container for items)
CREATE TABLE IF NOT EXISTS shopping_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT, -- Optional custom name
  supermarket supermarket_name NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create new shopping_list_items table (replaces week-based shopping_items for new lists)
CREATE TABLE IF NOT EXISTS shopping_list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity TEXT,
  category TEXT,
  checked BOOLEAN DEFAULT FALSE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Item-supermarket learning table: tracks which items are typically bought at which supermarket
CREATE TABLE IF NOT EXISTS item_supermarket_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_name TEXT NOT NULL,
  item_name_normalized TEXT NOT NULL, -- Lowercase, trimmed for matching
  supermarket supermarket_name NOT NULL,
  frequency INTEGER DEFAULT 1, -- How many times this item was bought at this supermarket
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_name_normalized, supermarket)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shopping_lists_status ON shopping_lists(status);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_supermarket ON shopping_lists(supermarket);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_archived_at ON shopping_lists(archived_at);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_list ON shopping_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_checked ON shopping_list_items(checked);
CREATE INDEX IF NOT EXISTS idx_item_supermarket_history_normalized ON item_supermarket_history(item_name_normalized);
CREATE INDEX IF NOT EXISTS idx_item_supermarket_history_supermarket ON item_supermarket_history(supermarket);
CREATE INDEX IF NOT EXISTS idx_item_supermarket_history_frequency ON item_supermarket_history(frequency DESC);

-- Updated at trigger for shopping_lists
DROP TRIGGER IF EXISTS update_shopping_lists_updated_at ON shopping_lists;
CREATE TRIGGER update_shopping_lists_updated_at
  BEFORE UPDATE ON shopping_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_supermarket_history ENABLE ROW LEVEL SECURITY;

-- Policies to allow all operations
CREATE POLICY "Allow all for shopping_lists" ON shopping_lists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for shopping_list_items" ON shopping_list_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for item_supermarket_history" ON item_supermarket_history FOR ALL USING (true) WITH CHECK (true);

-- Function to update item-supermarket learning when items are added
CREATE OR REPLACE FUNCTION learn_item_supermarket()
RETURNS TRIGGER AS $$
DECLARE
  v_supermarket supermarket_name;
  v_normalized TEXT;
BEGIN
  -- Get the supermarket from the shopping list
  SELECT supermarket INTO v_supermarket
  FROM shopping_lists
  WHERE id = NEW.list_id;
  
  -- Normalize the item name
  v_normalized := LOWER(TRIM(NEW.name));
  
  -- Insert or update the frequency
  INSERT INTO item_supermarket_history (item_name, item_name_normalized, supermarket, frequency, last_used_at)
  VALUES (NEW.name, v_normalized, v_supermarket, 1, NOW())
  ON CONFLICT (item_name_normalized, supermarket) 
  DO UPDATE SET 
    frequency = item_supermarket_history.frequency + 1,
    last_used_at = NOW(),
    item_name = EXCLUDED.item_name; -- Keep the most recent casing
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to learn from added items
DROP TRIGGER IF EXISTS learn_from_shopping_item ON shopping_list_items;
CREATE TRIGGER learn_from_shopping_item
  AFTER INSERT ON shopping_list_items
  FOR EACH ROW
  EXECUTE FUNCTION learn_item_supermarket();

-- Function to auto-archive lists when all items are checked
CREATE OR REPLACE FUNCTION check_list_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_total INTEGER;
  v_checked INTEGER;
BEGIN
  -- Count items in the list
  SELECT COUNT(*), COUNT(*) FILTER (WHERE checked = true)
  INTO v_total, v_checked
  FROM shopping_list_items
  WHERE list_id = NEW.list_id;
  
  -- If all items are checked (and there are items), archive the list
  IF v_total > 0 AND v_total = v_checked THEN
    UPDATE shopping_lists
    SET status = 'archived', archived_at = NOW()
    WHERE id = NEW.list_id AND status = 'active';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check completion on item check
DROP TRIGGER IF EXISTS check_completion_on_check ON shopping_list_items;
CREATE TRIGGER check_completion_on_check
  AFTER UPDATE OF checked ON shopping_list_items
  FOR EACH ROW
  WHEN (NEW.checked = true)
  EXECUTE FUNCTION check_list_completion();

