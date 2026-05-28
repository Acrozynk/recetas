-- Pin shopping items to the top of the list for quick supermarket trips.
-- This project uses shopping_items (not shopping_list_items from migration 004).

ALTER TABLE shopping_items
ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_shopping_items_pinned_active
ON shopping_items (supermarket, pinned DESC)
WHERE deleted_at IS NULL;

-- Optional: only if you use the newer shopping_lists / shopping_list_items tables
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'shopping_list_items'
  ) THEN
    ALTER TABLE shopping_list_items
    ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

    CREATE INDEX IF NOT EXISTS idx_shopping_list_items_pinned
    ON shopping_list_items (list_id, pinned DESC);
  END IF;
END $$;
