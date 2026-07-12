-- Track when each item was checked off (for "En el carrito" sort: most recent first)
ALTER TABLE shopping_items
ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ;

-- Existing checked items: use created_at as a reasonable fallback
UPDATE shopping_items
SET checked_at = created_at
WHERE checked = true AND checked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shopping_items_checked_at
ON shopping_items (supermarket, checked_at DESC NULLS LAST)
WHERE deleted_at IS NULL AND checked = true;
