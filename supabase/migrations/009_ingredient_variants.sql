-- Add support for ingredient variants (different amounts for different container sizes)
-- e.g., "molde grande" vs "molde pequeño"

-- Add variant labels to recipes
-- variant_1_label: label for the primary amounts (amount/unit)
-- variant_2_label: label for the secondary amounts (amount2/unit2)
ALTER TABLE recipes 
  ADD COLUMN IF NOT EXISTS variant_1_label TEXT,
  ADD COLUMN IF NOT EXISTS variant_2_label TEXT;

-- Note: Ingredients already have amount2/unit2 fields in JSONB
-- We'll use these for variant amounts:
--   amount/unit = variant 1 amounts
--   amount2/unit2 = variant 2 amounts
-- 
-- Ingredients can also have isHeader: true to mark section headers
-- like "Para la base:" or "Para el relleno:"




