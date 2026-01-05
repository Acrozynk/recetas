-- Add supermarket field to shopping_items table
-- This allows each supermarket to have its own separate shopping list

-- Add the supermarket column with a default value
ALTER TABLE shopping_items 
ADD COLUMN IF NOT EXISTS supermarket TEXT DEFAULT 'Mercadona';

-- Add a check constraint to ensure only valid supermarket names
ALTER TABLE shopping_items 
ADD CONSTRAINT shopping_items_supermarket_check 
CHECK (supermarket IN ('DIA', 'Consum', 'Mercadona'));

-- Create an index for better query performance when filtering by supermarket
CREATE INDEX IF NOT EXISTS idx_shopping_items_supermarket 
ON shopping_items(supermarket);

-- Create a composite index for the common query pattern (week + supermarket)
CREATE INDEX IF NOT EXISTS idx_shopping_items_week_supermarket 
ON shopping_items(week_start, supermarket);



