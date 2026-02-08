-- Add rating and made_it columns to recipes
-- Rating: 1-3 stars (null if not rated)
-- Made it: boolean to track if user has made this recipe

-- Add rating column (1-3 stars, null = not rated)
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 3);

-- Add made_it column (default false)
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS made_it BOOLEAN DEFAULT FALSE;

-- Create index for filtering by rating and made_it
CREATE INDEX IF NOT EXISTS idx_recipes_rating ON recipes(rating);
CREATE INDEX IF NOT EXISTS idx_recipes_made_it ON recipes(made_it);






















