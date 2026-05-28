-- Pin shopping items to the top of the list for quick supermarket trips
ALTER TABLE shopping_items
ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_shopping_items_pinned_active
ON shopping_items (supermarket, pinned DESC)
WHERE deleted_at IS NULL;

ALTER TABLE shopping_list_items
ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_shopping_list_items_pinned
ON shopping_list_items (list_id, pinned DESC);
