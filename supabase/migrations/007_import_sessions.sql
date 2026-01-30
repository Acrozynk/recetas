-- Import sessions table for tracking recipe import progress
-- Allows users to review recipes one by one and resume later

CREATE TABLE IF NOT EXISTS import_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL DEFAULT 'copymethat', -- Source of import (copymethat, url, etc.)
  total_recipes INTEGER NOT NULL DEFAULT 0,
  current_index INTEGER NOT NULL DEFAULT 0, -- Current position in review
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  recipes JSONB NOT NULL DEFAULT '[]', -- Array of recipe objects with review status
  image_mapping JSONB DEFAULT '{}', -- Maps local image paths to uploaded URLs
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding active sessions
CREATE INDEX IF NOT EXISTS idx_import_sessions_status ON import_sessions(status);
CREATE INDEX IF NOT EXISTS idx_import_sessions_created ON import_sessions(created_at DESC);

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_import_sessions_updated_at ON import_sessions;
CREATE TRIGGER update_import_sessions_updated_at
  BEFORE UPDATE ON import_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE import_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for import_sessions" ON import_sessions FOR ALL USING (true) WITH CHECK (true);

-- Comment explaining the recipes JSONB structure:
-- Each recipe in the array has:
-- {
--   "original": { ... ParsedRecipe data ... },
--   "status": "pending" | "accepted" | "edited" | "discarded",
--   "edited": { ... modified recipe data if edited ... } | null,
--   "imported_id": "uuid" | null (ID of recipe in recipes table if imported)
-- }




















