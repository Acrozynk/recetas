/**
 * Standalone module that re-exports the small `GROCERY_CATEGORIES` list.
 *
 * This is intentionally kept separate from `lib/spanish-groceries` (which
 * holds a ~70KB hand-curated catalog of products) so that screens that only
 * need the category list can import it without pulling the entire catalog
 * into the initial JS bundle.
 */

export const GROCERY_CATEGORIES = [
  "Frutas y Verduras",
  "Lácteos",
  "Carnes y Mariscos",
  "Panadería",
  "Despensa",
  "Congelados",
  "Bebidas",
  "Comida Preparada",
  "Droguería",
  "Otros",
] as const;

export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];
