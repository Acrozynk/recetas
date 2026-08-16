import { lookupGroceryCategory } from "@/lib/spanish-groceries";

/** Pick the best category when merging an existing item with a new one. */
export function preferShoppingCategory(
  existing: string,
  incoming: string
): string {
  if (existing === "Otros" && incoming !== "Otros") return incoming;
  if (incoming === "Otros" && existing !== "Otros") return existing;
  return existing;
}

/** Resolve category for a shopping item name (catalog first, then heuristics). */
export function categorizeIngredient(name: string): string {
  const fromCatalog = lookupGroceryCategory(name);
  if (fromCatalog) return fromCatalog;

  const lowerName = name.toLowerCase();

  if (
    /\b(chicken|beef|pork|lamb|turkey|fish|salmon|shrimp|bacon|sausage|meat|steak|ground|pollo|res|cerdo|cordero|pavo|pescado|salmón|camarón|tocino|salchicha|carne|bistec|molida|panceta|jamón|chorizo|lomo|solomillo|chuleta|costilla|ternera|gambas?|langostinos?|mejillones?|almejas?|calamares?|pulpo|sepia|lonchas?|morcillas?|butifarras?|sobrasada|fuet|salchichón|hígado|higado)\b/.test(
      lowerName
    )
  ) {
    return "Carnes y Mariscos";
  }

  if (
    /\b(lettuce|tomato|onion|garlic|pepper|carrot|celery|potato|broccoli|spinach|kale|cucumber|zucchini|squash|mushroom|avocado|lemon|lime|orange|apple|banana|berry|fruit|vegetable|herb|cilantro|parsley|basil|mint|thyme|rosemary|lechuga|tomate|cebolla|ajos?|pimiento|zanahoria|apio|patatas?|papa|brócoli|espinaca|pepino|calabacín|champiñón|aguacate|limón|naranja|manzana|plátanos?|fruta|verdura|hierba|perejil|albahaca|menta|romero|puerro|berenjena|calabaza|judías verdes|guisantes|habas|remolacha|rábano|nabo|jengibre|dátiles?)\b/.test(
      lowerName
    )
  ) {
    return "Frutas y Verduras";
  }

  if (
    /\b(milk|cheese|butter|cream|yogurt|sour cream|egg|eggs|leche|queso|mantequilla|nata|crema|yogur|huevo|huevos|kéfir|kefir)\b/.test(
      lowerName
    )
  ) {
    return "Lácteos";
  }

  if (
    /\b(bread|roll|bun|bagel|tortilla|pita|croissant|pan|bollo|bolillo|panecillos?|barra|baguette|chapata|molde)\b/.test(
      lowerName
    )
  ) {
    return "Panadería";
  }

  if (/\b(frozen|ice cream|congelado|helado)\b/.test(lowerName)) {
    return "Congelados";
  }

  if (
    /\b(juice|soda|water|wine|beer|coffee|tea|jugo|refresco|agua|vino|cerveza|café|té)\b/.test(
      lowerName
    )
  ) {
    return "Bebidas";
  }

  if (
    /\b(flour|sugar|salt|oil|vinegar|sauce|pasta|rice|bean|can|stock|broth|spice|seasoning|harina|azúcar|sal|aceite|vinagre|salsa|arroz|frijol|lata|caldo|especia|condimento|azafrán|canela|pimentón|orégano|tomillo|laurel|comino|cúrcuma|curry|nuez moscada|clavo|pimienta|garbanzos?|lentejas?|alubias?|conserva|cocidos?|bicarbonato|vainilla|tofu|tempeh|seitán)\b/.test(
      lowerName
    )
  ) {
    return "Despensa";
  }

  return "Otros";
}

/** If stored as Otros, try to resolve a better category from the catalog/heuristics. */
export function improveCategoryIfOtros(
  name: string,
  currentCategory: string | null | undefined
): string | null {
  const current = currentCategory || "Otros";
  if (current !== "Otros") return null;
  const resolved = categorizeIngredient(name);
  return resolved !== "Otros" ? resolved : null;
}
