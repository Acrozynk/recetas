-- Optional breakdown for "Personas" portions (batch cooking + adults/children per batch).
-- When all three are set, recipe detail/edit restore this UI; servings stays the rounded equivalent for scaling/legacy.

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS personas_batch_count INTEGER DEFAULT NULL;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS personas_adults_per_batch INTEGER DEFAULT NULL;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS personas_children_per_batch INTEGER DEFAULT NULL;

COMMENT ON COLUMN recipes.personas_batch_count IS 'Personas mode: number of batches (e.g. meal prep). NULL = use servings as single baseline.';
COMMENT ON COLUMN recipes.personas_adults_per_batch IS 'Personas mode: adults fed per batch.';
COMMENT ON COLUMN recipes.personas_children_per_batch IS 'Personas mode: children per batch (each counts as ½ portion in UI math).';
