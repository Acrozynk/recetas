#!/usr/bin/env bash
# Apply pending SQL migrations to the linked Supabase project.
# Prerequisites:
#   1. npx supabase login
#   2. npx supabase link --project-ref YOUR_PROJECT_REF
# Or set SUPABASE_DB_URL (URI from Project Settings > Database) and run:
#   psql "$SUPABASE_DB_URL" -f supabase/migrations/022_shopping_items_pinned.sql

set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  if ! command -v psql &>/dev/null; then
    echo "psql is required when using SUPABASE_DB_URL"
    exit 1
  fi
  echo "Applying 022_shopping_items_pinned.sql via psql..."
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/022_shopping_items_pinned.sql
  echo "Done."
  exit 0
fi

echo "Pushing migrations with Supabase CLI..."
npx --yes supabase@2.23.4 db push
