-- Make shopping items persistent (no weekly reset) and add soft delete with trash
-- This migration:
-- 1. Adds deleted_at column for soft delete (trash functionality)
-- 2. Removes the week-based paradigm - items persist until manually deleted
-- 3. Makes week_start nullable since we no longer use weekly resets

-- Add deleted_at column for soft delete
ALTER TABLE shopping_items 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Make week_start nullable - items now persist indefinitely
ALTER TABLE shopping_items 
ALTER COLUMN week_start DROP NOT NULL;

-- Create index for efficient trash queries
CREATE INDEX IF NOT EXISTS idx_shopping_items_deleted_at 
ON shopping_items(deleted_at);

-- Create composite index for common query pattern (supermarket + not deleted)
CREATE INDEX IF NOT EXISTS idx_shopping_items_supermarket_active 
ON shopping_items(supermarket) WHERE deleted_at IS NULL;

-- Function to permanently delete old trash items (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_trash_items()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM shopping_items
  WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Optional: You can set up a cron job to call cleanup_old_trash_items() periodically
-- For now, the app will handle cleanup when loading the trash



