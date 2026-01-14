"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase, type ShoppingItem, type MealPlan, type Ingredient, type SupermarketName, type SupermarketCategoryOrder, type ItemSupermarketHistory, SUPERMARKETS, SUPERMARKET_COLORS, DEFAULT_CATEGORIES } from "@/lib/supabase";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { searchGroceries, type GroceryProduct, GROCERY_CATEGORIES } from "@/lib/spanish-groceries";
import { combineQuantities, parseQuantity, formatQuantity } from "@/lib/unit-conversion";

// Category icons mapping
const CATEGORY_ICONS: Record<string, string> = {
  "Frutas y Verduras": "🥬",
  "Lácteos": "🥛",
  "Carnes y Mariscos": "🥩",
  "Panadería": "🥖",
  "Despensa": "🫙",
  "Congelados": "🧊",
  "Bebidas": "🥤",
  "Comida Preparada": "🍱",
  "Droguería": "🧴",
  "Otros": "🛒",
};

// Trash item interface (items with deleted_at set)
interface TrashItem extends ShoppingItem {
  deleted_at: string;
}

function categorizeIngredient(name: string): string {
  const lowerName = name.toLowerCase();

  // Carnes y Mariscos (check first - meat products may contain vegetable names like "morcilla de cebolla")
  if (
    /\b(chicken|beef|pork|lamb|turkey|fish|salmon|shrimp|bacon|sausage|meat|steak|ground|pollo|res|cerdo|cordero|pavo|pescado|salmón|camarón|tocino|salchicha|carne|bistec|molida|panceta|jamón|chorizo|lomo|solomillo|chuleta|costilla|ternera|gambas?|langostinos?|mejillones?|almejas?|calamares?|pulpo|sepia|lonchas?|morcillas?|butifarras?|sobrasada|fuet|salchichón)\b/.test(
      lowerName
    )
  ) {
    return "Carnes y Mariscos";
  }

  // Frutas y Verduras
  if (
    /\b(lettuce|tomato|onion|garlic|pepper|carrot|celery|potato|broccoli|spinach|kale|cucumber|zucchini|squash|mushroom|avocado|lemon|lime|orange|apple|banana|berry|fruit|vegetable|herb|cilantro|parsley|basil|mint|thyme|rosemary|lechuga|tomate|cebolla|ajos?|pimiento|zanahoria|apio|patatas?|papa|brócoli|espinaca|pepino|calabacín|champiñón|aguacate|limón|naranja|manzana|plátanos?|fruta|verdura|hierba|perejil|albahaca|menta|romero|puerro|berenjena|calabaza|judías verdes|guisantes|habas|remolacha|rábano|nabo|jengibre|dátiles?)\b/.test(
      lowerName
    )
  ) {
    return "Frutas y Verduras";
  }

  // Lácteos
  if (
    /\b(milk|cheese|butter|cream|yogurt|sour cream|egg|eggs|leche|queso|mantequilla|nata|crema|yogur|huevo|huevos)\b/.test(lowerName)
  ) {
    return "Lácteos";
  }

  // Panadería
  if (/\b(bread|roll|bun|bagel|tortilla|pita|croissant|pan|bollo|bolillo)\b/.test(lowerName)) {
    return "Panadería";
  }

  // Congelados
  if (/\b(frozen|ice cream|congelado|helado)\b/.test(lowerName)) {
    return "Congelados";
  }

  // Bebidas
  if (/\b(juice|soda|water|wine|beer|coffee|tea|jugo|refresco|agua|vino|cerveza|café|té)\b/.test(lowerName)) {
    return "Bebidas";
  }

  // Despensa (dry goods, canned items, spices, legumes, etc.)
  if (
    /\b(flour|sugar|salt|oil|vinegar|sauce|pasta|rice|bean|can|stock|broth|spice|seasoning|harina|azúcar|sal|aceite|vinagre|salsa|arroz|frijol|lata|caldo|especia|condimento|azafrán|canela|pimentón|orégano|tomillo|laurel|comino|cúrcuma|curry|nuez moscada|clavo|pimienta|garbanzos?|lentejas?|alubias?|conserva|cocidos?|bicarbonato|vainilla)\b/.test(
      lowerName
    )
  ) {
    return "Despensa";
  }

  return "Otros";
}

// Category Order Editor Modal
function CategoryOrderModal({
  isOpen,
  onClose,
  supermarket,
  categoryOrder,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  supermarket: SupermarketName;
  categoryOrder: string[];
  onSave: (newOrder: string[]) => void;
}) {
  const [categories, setCategories] = useState<string[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCategories([...categoryOrder]);
  }, [categoryOrder, isOpen]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newCategories = [...categories];
    const draggedItem = newCategories[draggedIndex];
    newCategories.splice(draggedIndex, 1);
    newCategories.splice(index, 0, draggedItem);
    setCategories(newCategories);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const moveCategory = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === categories.length - 1)
    ) {
      return;
    }

    const newCategories = [...categories];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    [newCategories[index], newCategories[newIndex]] = [
      newCategories[newIndex],
      newCategories[index],
    ];
    setCategories(newCategories);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(categories);
    setSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  const supermarketColor = SUPERMARKET_COLORS[supermarket];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl animate-fade-in">
        {/* Header */}
        <div className={`p-4 border-b border-[var(--border-color)] ${supermarketColor.bg}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">
                Orden de Categorías
              </h2>
              <p className={`text-sm ${supermarketColor.text} font-medium mt-1`}>
                {supermarket}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="px-4 py-3 bg-[var(--color-purple-bg)] border-b border-[var(--border-color)]">
          <p className="text-sm text-[var(--color-slate)]">
            📍 Arrastra las categorías para ordenarlas según aparecen en <strong>{supermarket}</strong>
          </p>
        </div>

        {/* Category List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {categories.map((category, index) => (
              <div
                key={category}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-move ${
                  draggedIndex === index
                    ? "border-[var(--color-purple)] bg-[var(--color-purple-bg)] scale-[1.02] shadow-lg"
                    : "border-[var(--border-color)] bg-white hover:border-[var(--color-purple-light)]"
                }`}
              >
                {/* Drag Handle */}
                <div className="text-[var(--color-slate-light)]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                </div>

                {/* Order Number */}
                <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold ${supermarketColor.bg} ${supermarketColor.text}`}>
                  {index + 1}
                </span>

                {/* Category Icon & Name */}
                <span className="text-xl">{CATEGORY_ICONS[category] || "📦"}</span>
                <span className="flex-1 font-medium text-[var(--foreground)]">
                  {category}
                </span>

                {/* Up/Down Buttons */}
                <div className="flex gap-1">
                  <button
                    onClick={() => moveCategory(index, "up")}
                    disabled={index === 0}
                    className="p-1.5 rounded-lg hover:bg-[var(--color-purple-bg)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveCategory(index, "down")}
                    disabled={index === categories.length - 1}
                    className="p-1.5 rounded-lg hover:bg-[var(--color-purple-bg)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-color)] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 btn-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 btn-primary flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar Orden"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Grocery Search Modal Component
function GrocerySearchModal({
  isOpen,
  onClose,
  onSelectProduct,
  onAddManual,
  categoryOrder,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: GroceryProduct) => void;
  onAddManual: (name: string, quantity: string, category: string) => void;
  categoryOrder: string[];
}) {
  const [manualName, setManualName] = useState("");
  const [manualQuantity, setManualQuantity] = useState("");
  const [manualCategory, setManualCategory] = useState("Otros");

  const handleAddManual = () => {
    if (!manualName.trim()) return;
    onAddManual(manualName.trim(), manualQuantity.trim(), manualCategory);
    setManualName("");
    setManualQuantity("");
    setManualCategory("Otros");
    onClose();
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GroceryProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const results = searchGroceries(searchQuery, 30);
      setSearchResults(results);
      setSelectedCategory(null);
    } else if (searchQuery.trim().length === 0) {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category === selectedCategory ? null : category);
    setSearchQuery("");
  };

  const handleProductSelect = (product: GroceryProduct) => {
    onSelectProduct(product);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedCategory(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">
              Base de Productos
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--color-purple-bg-dark)] rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Search Input */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-slate-light)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar productos españoles..."
              className="input pl-10"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {searchQuery.trim().length >= 2 ? (
            // Search Results
            <div>
              {searchResults.length > 0 ? (
                <>
                  <p className="text-sm text-[var(--color-slate)] mb-3">
                    {searchResults.length} producto{searchResults.length !== 1 ? 's' : ''} encontrado{searchResults.length !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-1">
                    {searchResults.map((product, index) => (
                      <button
                        key={`${product.name}-${index}`}
                        onClick={() => handleProductSelect(product)}
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[var(--color-purple-bg)] transition-colors text-left group"
                      >
                        <div>
                          <span className="font-medium text-[var(--foreground)] group-hover:text-[var(--color-purple-dark)]">
                            {product.name}
                          </span>
                          {product.subcategory && (
                            <span className="text-sm text-[var(--color-slate-light)] ml-2">
                              · {product.subcategory}
                            </span>
                          )}
                        </div>
                        <span className="text-xs px-2 py-1 bg-[var(--color-purple-bg-dark)] text-[var(--color-purple-dark)] rounded-full">
                          {product.category}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-3 bg-[var(--color-purple-bg-dark)] rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-[var(--color-slate-light)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-[var(--color-slate)]">No se encontraron productos</p>
                  <p className="text-sm text-[var(--color-slate-light)] mt-1">
                    Prueba con otra búsqueda
                  </p>
                </div>
              )}
            </div>
          ) : (
            // Category Browse
            <div>
              <p className="text-sm text-[var(--color-slate)] mb-3">
                Busca o explora por categoría
              </p>
              <div className="grid grid-cols-2 gap-2">
                {GROCERY_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    onClick={() => handleCategoryClick(category)}
                    className={`p-3 rounded-xl text-left transition-all ${
                      selectedCategory === category
                        ? "bg-[var(--color-purple)] text-white shadow-lg scale-[0.98]"
                        : "bg-[var(--color-purple-bg)] hover:bg-[var(--color-purple-bg-dark)] text-[var(--foreground)]"
                    }`}
                  >
                    <span className="text-xl mb-1 block">{CATEGORY_ICONS[category] || "📦"}</span>
                    <span className="font-medium text-sm">{category}</span>
                  </button>
                ))}
              </div>

              {/* Category Products */}
              {selectedCategory && (
                <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                  <h3 className="font-semibold text-[var(--foreground)] mb-3">
                    {selectedCategory}
                  </h3>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {searchGroceries("", 500)
                      .filter((p) => p.category === selectedCategory)
                      .map((product, index) => (
                        <button
                          key={`${product.name}-${index}`}
                          onClick={() => handleProductSelect(product)}
                          className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[var(--color-purple-bg)] transition-colors text-left text-sm"
                        >
                          <span className="text-[var(--foreground)]">{product.name}</span>
                          {product.subcategory && (
                            <span className="text-xs text-[var(--color-slate-light)]">
                              {product.subcategory}
                            </span>
                          )}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Manual Add Section */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--color-purple-bg)]">
          <p className="text-xs text-[var(--color-slate)] mb-3">
            ¿No encuentras el producto? Añádelo manualmente:
          </p>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Nombre del producto"
                className="input flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && manualName.trim()) {
                    handleAddManual();
                  }
                }}
              />
              <input
                type="text"
                value={manualQuantity}
                onChange={(e) => setManualQuantity(e.target.value)}
                placeholder="Cantidad"
                className="input w-24"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={manualCategory}
                onChange={(e) => setManualCategory(e.target.value)}
                className="input flex-1"
              >
                {categoryOrder.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddManual}
                disabled={!manualName.trim()}
                className="btn-primary px-4 disabled:opacity-50"
              >
                Añadir
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Move/Copy Items Modal
function MoveItemsModal({
  isOpen,
  onClose,
  items,
  currentSupermarket,
  onMove,
  onCopy,
}: {
  isOpen: boolean;
  onClose: () => void;
  items: ShoppingItem[];
  currentSupermarket: SupermarketName;
  onMove: (items: ShoppingItem[], targetSupermarket: SupermarketName) => Promise<void>;
  onCopy: (items: ShoppingItem[], targetSupermarket: SupermarketName) => Promise<void>;
}) {
  const [targetSupermarket, setTargetSupermarket] = useState<SupermarketName | null>(null);
  const [action, setAction] = useState<"move" | "copy">("move");
  const [processing, setProcessing] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setTargetSupermarket(null);
      setAction("move");
    }
  }, [isOpen]);

  const availableSupermarkets = SUPERMARKETS.filter(s => s !== currentSupermarket);

  const handleConfirm = async () => {
    if (!targetSupermarket) return;
    setProcessing(true);
    try {
      if (action === "move") {
        await onMove(items, targetSupermarket);
      } else {
        await onCopy(items, targetSupermarket);
      }
      onClose();
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-color)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">
                {items.length === 1 ? "Mover o Copiar Artículo" : `Mover o Copiar ${items.length} Artículos`}
              </h2>
              <p className="text-sm text-[var(--color-slate)] mt-1">
                Desde <strong>{currentSupermarket}</strong>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--color-purple-bg-dark)] rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Items preview */}
          {items.length > 0 && items.length <= 5 && (
            <div className="bg-[var(--color-purple-bg)] rounded-xl p-3">
              <p className="text-xs text-[var(--color-slate)] mb-2">Artículos seleccionados:</p>
              <div className="flex flex-wrap gap-2">
                {items.map(item => (
                  <span 
                    key={item.id} 
                    className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-lg text-sm"
                  >
                    {item.name}
                    {item.quantity && (
                      <span className="text-[var(--color-purple)] text-xs">({item.quantity})</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action selector */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-slate)] mb-2">
              ¿Qué quieres hacer?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAction("move")}
                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                  action === "move"
                    ? "border-[var(--color-purple)] bg-[var(--color-purple-bg)]"
                    : "border-[var(--border-color)] hover:border-[var(--color-purple-light)]"
                }`}
              >
                <svg className="w-6 h-6 text-[var(--color-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <span className="font-medium text-sm">Mover</span>
                <span className="text-xs text-[var(--color-slate-light)]">Se quita de {currentSupermarket}</span>
              </button>
              <button
                onClick={() => setAction("copy")}
                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                  action === "copy"
                    ? "border-[var(--color-purple)] bg-[var(--color-purple-bg)]"
                    : "border-[var(--border-color)] hover:border-[var(--color-purple-light)]"
                }`}
              >
                <svg className="w-6 h-6 text-[var(--color-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="font-medium text-sm">Copiar</span>
                <span className="text-xs text-[var(--color-slate-light)]">Se mantiene en {currentSupermarket}</span>
              </button>
            </div>
          </div>

          {/* Target supermarket selector */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-slate)] mb-2">
              Supermercado destino
            </label>
            <div className="space-y-2">
              {availableSupermarkets.map(market => {
                const colors = SUPERMARKET_COLORS[market];
                const isSelected = targetSupermarket === market;
                return (
                  <button
                    key={market}
                    onClick={() => setTargetSupermarket(market)}
                    className={`w-full p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                      isSelected
                        ? `${colors.bg} ${colors.border}`
                        : "border-[var(--border-color)] hover:border-[var(--color-purple-light)]"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colors.bg}`}>
                      <span className={`font-bold ${colors.text}`}>{market.charAt(0)}</span>
                    </div>
                    <span className={`font-medium ${isSelected ? colors.text : "text-[var(--foreground)]"}`}>
                      {market}
                    </span>
                    {isSelected && (
                      <svg className={`w-5 h-5 ml-auto ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-color)] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 btn-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!targetSupermarket || processing}
            className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {processing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {action === "move" ? "Moviendo..." : "Copiando..."}
              </>
            ) : (
              <>
                {action === "move" ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
                {action === "move" ? "Mover" : "Copiar"} a {targetSupermarket}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Edit Item Modal Component
function EditItemModal({
  item,
  onClose,
  onSave,
  onMoveOrCopy,
  categoryOrder,
  currentSupermarket,
}: {
  item: ShoppingItem;
  onClose: () => void;
  onSave: (item: ShoppingItem, name: string, quantity: string, category?: string) => void;
  onMoveOrCopy: (item: ShoppingItem) => void;
  categoryOrder: string[];
  currentSupermarket: SupermarketName;
}) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity || "");
  const [category, setCategory] = useState(item.category || "Otros");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(item, name, quantity, category);
    setSaving(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-color)]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">
              Editar Artículo
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--color-purple-bg-dark)] rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name Field */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-slate)] mb-1">
              Nombre
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Nombre del artículo"
            />
          </div>

          {/* Quantity Field */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-slate)] mb-1">
              Cantidad <span className="text-[var(--color-slate-light)] font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="input"
              placeholder="Ej: 3, 500g, 2 kg, 1 docena..."
            />
            <p className="text-xs text-[var(--color-slate-light)] mt-1">
              Puedes escribir cualquier formato: "3", "500g", "2 bolsas", etc.
            </p>
          </div>

          {/* Category Field */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-slate)] mb-1">
              Categoría
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input"
            >
              {categoryOrder.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Move/Copy Button */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onMoveOrCopy(item);
            }}
            className="w-full p-3 rounded-xl border-2 border-[var(--border-color)] hover:border-[var(--color-purple-light)] hover:bg-[var(--color-purple-bg)] transition-all flex items-center justify-center gap-2 text-[var(--color-slate)]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Mover o copiar a otro supermercado
          </button>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Interface for preview ingredients
interface PreviewIngredient {
  id: string;
  name: string;
  quantity: string;
  category: string;
  selected: boolean;
  recipes: string[]; // Recipe names that use this ingredient
}

// Ingredient Preview Modal - shows before adding from planner
type GroupByMode = "recipe" | "category";

function IngredientPreviewModal({
  isOpen,
  onClose,
  ingredients,
  onConfirm,
  categoryOrder,
}: {
  isOpen: boolean;
  onClose: () => void;
  ingredients: PreviewIngredient[];
  onConfirm: (selectedIngredients: PreviewIngredient[]) => void;
  categoryOrder: string[];
}) {
  const [localIngredients, setLocalIngredients] = useState<PreviewIngredient[]>([]);
  const [saving, setSaving] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupByMode>("recipe");

  useEffect(() => {
    setLocalIngredients([...ingredients]);
  }, [ingredients, isOpen]);

  const toggleIngredient = (id: string) => {
    setLocalIngredients(prev =>
      prev.map(ing =>
        ing.id === id ? { ...ing, selected: !ing.selected } : ing
      )
    );
  };

  const toggleAll = (selected: boolean) => {
    setLocalIngredients(prev =>
      prev.map(ing => ({ ...ing, selected }))
    );
  };

  const toggleCategory = (category: string, selected: boolean) => {
    setLocalIngredients(prev =>
      prev.map(ing =>
        ing.category === category ? { ...ing, selected } : ing
      )
    );
  };

  const toggleRecipe = (recipeName: string, selected: boolean) => {
    setLocalIngredients(prev =>
      prev.map(ing =>
        ing.recipes.includes(recipeName) ? { ...ing, selected } : ing
      )
    );
  };

  const handleConfirm = async () => {
    setSaving(true);
    const selected = localIngredients.filter(ing => ing.selected);
    await onConfirm(selected);
    setSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  // Group ingredients by category
  const groupedByCategory = localIngredients.reduce(
    (acc, ing) => {
      const category = ing.category || "Otros";
      if (!acc[category]) acc[category] = [];
      acc[category].push(ing);
      return acc;
    },
    {} as Record<string, PreviewIngredient[]>
  );

  // Group ingredients by recipe
  const groupedByRecipe = localIngredients.reduce(
    (acc, ing) => {
      // An ingredient can belong to multiple recipes
      for (const recipe of ing.recipes) {
        if (!acc[recipe]) acc[recipe] = [];
        acc[recipe].push(ing);
      }
      return acc;
    },
    {} as Record<string, PreviewIngredient[]>
  );

  // Get sorted recipe names
  const recipeNames = Object.keys(groupedByRecipe).sort();

  const selectedCount = localIngredients.filter(i => i.selected).length;
  const totalCount = localIngredients.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-color)] bg-[var(--color-purple-bg)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">
                Confirmar Ingredientes
              </h2>
              <p className="text-sm text-[var(--color-slate)] mt-1">
                Selecciona los ingredientes que necesitas comprar
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Selection Controls */}
        <div className="px-4 py-3 border-b border-[var(--border-color)] bg-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-[var(--color-slate)]">
              {selectedCount} de {totalCount} seleccionados
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => toggleAll(true)}
                className="text-sm px-3 py-1.5 rounded-lg bg-[var(--color-purple-bg)] text-[var(--color-purple-dark)] hover:bg-[var(--color-purple-bg-dark)] transition-colors"
              >
                Seleccionar todo
              </button>
              <button
                onClick={() => toggleAll(false)}
                className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 text-[var(--color-slate)] hover:bg-gray-200 transition-colors"
              >
                Deseleccionar
              </button>
            </div>
          </div>
          
          {/* Group By Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-slate)]">Agrupar por:</span>
            <div className="flex rounded-lg bg-gray-100 p-0.5">
              <button
                onClick={() => setGroupBy("recipe")}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                  groupBy === "recipe"
                    ? "bg-white text-[var(--color-purple-dark)] shadow-sm font-medium"
                    : "text-[var(--color-slate)] hover:text-[var(--foreground)]"
                }`}
              >
                📖 Receta
              </button>
              <button
                onClick={() => setGroupBy("category")}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                  groupBy === "category"
                    ? "bg-white text-[var(--color-purple-dark)] shadow-sm font-medium"
                    : "text-[var(--color-slate)] hover:text-[var(--foreground)]"
                }`}
              >
                🏷️ Categoría
              </button>
            </div>
          </div>
        </div>

        {/* Ingredient List */}
        <div className="flex-1 overflow-y-auto p-4">
          {localIngredients.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-3 bg-[var(--color-purple-bg-dark)] rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-[var(--color-slate-light)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-[var(--color-slate)]">No hay ingredientes en las recetas planificadas</p>
            </div>
          ) : groupBy === "recipe" ? (
            /* Group by Recipe */
            <div className="space-y-6">
              {recipeNames.map(recipeName => {
                const recipeIngredients = groupedByRecipe[recipeName];
                const recipeSelectedCount = recipeIngredients.filter(i => i.selected).length;
                const allSelected = recipeSelectedCount === recipeIngredients.length;

                return (
                  <div key={recipeName}>
                    {/* Recipe Header */}
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
                        <span className="text-lg">📖</span>
                        <span className="truncate max-w-[200px]" title={recipeName}>{recipeName}</span>
                        <span className="text-xs font-normal text-[var(--color-slate-light)] flex-shrink-0">
                          ({recipeSelectedCount}/{recipeIngredients.length})
                        </span>
                      </h3>
                      <button
                        onClick={() => toggleRecipe(recipeName, !allSelected)}
                        className="text-xs text-[var(--color-purple)] hover:text-[var(--color-purple-dark)] transition-colors flex-shrink-0"
                      >
                        {allSelected ? "Deseleccionar" : "Seleccionar"} receta
                      </button>
                    </div>
                    
                    {/* Recipe Items */}
                    <div className="bg-white rounded-xl border border-[var(--border-color)] divide-y divide-[var(--border-color)]">
                      {recipeIngredients.map(ing => (
                        <label
                          key={`${recipeName}-${ing.id}`}
                          className={`flex items-start gap-3 p-3 cursor-pointer transition-colors hover:bg-[var(--color-purple-bg)] ${
                            !ing.selected ? "bg-gray-50" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={ing.selected}
                            onChange={() => toggleIngredient(ing.id)}
                            className="checkbox mt-1 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className={`font-medium ${!ing.selected ? "text-[var(--color-slate-light)]" : "text-[var(--foreground)]"}`}>
                                {ing.name}
                              </span>
                              {ing.quantity && (
                                <span className={`text-sm ${!ing.selected ? "text-[var(--color-slate-light)]" : "text-[var(--color-purple)]"} font-medium`}>
                                  {ing.quantity}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--color-slate-light)] mt-0.5">
                              <span className="inline-flex items-center gap-1">
                                <span>{CATEGORY_ICONS[ing.category] || "📦"}</span>
                                {ing.category}
                              </span>
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Group by Category */
            <div className="space-y-6">
              {categoryOrder.filter(cat => groupedByCategory[cat]?.length > 0).map(category => {
                const categoryIngredients = groupedByCategory[category];
                const categorySelectedCount = categoryIngredients.filter(i => i.selected).length;
                const allSelected = categorySelectedCount === categoryIngredients.length;

                return (
                  <div key={category}>
                    {/* Category Header */}
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
                        <span className="text-lg">{CATEGORY_ICONS[category] || "📦"}</span>
                        {category}
                        <span className="text-xs font-normal text-[var(--color-slate-light)]">
                          ({categorySelectedCount}/{categoryIngredients.length})
                        </span>
                      </h3>
                      <button
                        onClick={() => toggleCategory(category, !allSelected)}
                        className="text-xs text-[var(--color-purple)] hover:text-[var(--color-purple-dark)] transition-colors"
                      >
                        {allSelected ? "Deseleccionar" : "Seleccionar"} categoría
                      </button>
                    </div>
                    
                    {/* Category Items */}
                    <div className="bg-white rounded-xl border border-[var(--border-color)] divide-y divide-[var(--border-color)]">
                      {categoryIngredients.map(ing => (
                        <label
                          key={ing.id}
                          className={`flex items-start gap-3 p-3 cursor-pointer transition-colors hover:bg-[var(--color-purple-bg)] ${
                            !ing.selected ? "bg-gray-50" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={ing.selected}
                            onChange={() => toggleIngredient(ing.id)}
                            className="checkbox mt-1 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className={`font-medium ${!ing.selected ? "text-[var(--color-slate-light)]" : "text-[var(--foreground)]"}`}>
                                {ing.name}
                              </span>
                              {ing.quantity && (
                                <span className={`text-sm ${!ing.selected ? "text-[var(--color-slate-light)]" : "text-[var(--color-purple)]"} font-medium`}>
                                  {ing.quantity}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--color-slate-light)] mt-0.5 truncate">
                              {ing.recipes.join(", ")}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-color)] flex gap-3 bg-white">
          <button
            onClick={onClose}
            className="flex-1 btn-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedCount === 0 || saving}
            className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Añadiendo...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Añadir {selectedCount} artículo{selectedCount !== 1 ? "s" : ""}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ShoppingPage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Otros");
  const [isGroceryModalOpen, setIsGroceryModalOpen] = useState(false);
  const [isCategoryOrderModalOpen, setIsCategoryOrderModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  
  // Preview modal state
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewIngredients, setPreviewIngredients] = useState<PreviewIngredient[]>([]);
  
  // Supermarket state
  const [selectedSupermarket, setSelectedSupermarket] = useState<SupermarketName>("Mercadona");
  const [categoryOrder, setCategoryOrder] = useState<string[]>([...DEFAULT_CATEGORIES]);
  const [loadingCategoryOrder, setLoadingCategoryOrder] = useState(true);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<ItemSupermarketHistory[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Trash state
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [loadingTrash, setLoadingTrash] = useState(false);

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Move/Copy modal state
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [itemsToMove, setItemsToMove] = useState<ShoppingItem[]>([]);

  // Load category order for selected supermarket
  const loadCategoryOrder = useCallback(async () => {
    setLoadingCategoryOrder(true);
    try {
      const response = await fetch(`/api/category-order?supermarket=${selectedSupermarket}`);
      if (response.ok) {
        const data: SupermarketCategoryOrder[] = await response.json();
        if (data && data.length > 0) {
          // Sort by sort_order and extract category names
          const sortedCategories = data
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((item) => item.category);
          setCategoryOrder(sortedCategories);
        } else {
          // Use default order if no custom order exists
          setCategoryOrder([...DEFAULT_CATEGORIES]);
        }
      }
    } catch (error) {
      console.error("Error loading category order:", error);
      setCategoryOrder([...DEFAULT_CATEGORIES]);
    } finally {
      setLoadingCategoryOrder(false);
    }
  }, [selectedSupermarket]);

  useEffect(() => {
    loadCategoryOrder();
  }, [loadCategoryOrder]);

  const saveCategoryOrder = async (newOrder: string[]) => {
    try {
      const response = await fetch("/api/category-order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supermarket: selectedSupermarket,
          categories: newOrder,
        }),
      });

      if (response.ok) {
        setCategoryOrder(newOrder);
      }
    } catch (error) {
      console.error("Error saving category order:", error);
    }
  };

  const loadItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("shopping_items")
        .select("*")
        .eq("supermarket", selectedSupermarket)
        .is("deleted_at", null)
        .order("category")
        .order("checked")
        .order("name");

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error loading shopping items:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedSupermarket]);

  // Load trash items for selected supermarket
  const loadTrashItems = useCallback(async () => {
    setLoadingTrash(true);
    try {
      // Clean up items older than 30 days first
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      await supabase
        .from("shopping_items")
        .delete()
        .eq("supermarket", selectedSupermarket)
        .not("deleted_at", "is", null)
        .lt("deleted_at", thirtyDaysAgo.toISOString());

      // Now load remaining trash items
      const { data, error } = await supabase
        .from("shopping_items")
        .select("*")
        .eq("supermarket", selectedSupermarket)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) throw error;
      setTrashItems((data as TrashItem[]) || []);
    } catch (error) {
      console.error("Error loading trash items:", error);
    } finally {
      setLoadingTrash(false);
    }
  }, [selectedSupermarket]);

  useEffect(() => {
    loadItems();
    // Also load trash count on initial load
    loadTrashItems();
  }, [loadItems, loadTrashItems]);

  // Load suggestions for the selected supermarket
  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const response = await fetch(`/api/shopping-lists/suggestions?supermarket=${selectedSupermarket}&limit=30`);
      if (response.ok) {
        const data: ItemSupermarketHistory[] = await response.json();
        // Filter out items that are already in the current list
        const currentItemNames = new Set(items.map(item => item.name.toLowerCase().trim()));
        const filteredSuggestions = data.filter(
          suggestion => !currentItemNames.has(suggestion.item_name_normalized)
        );
        setSuggestions(filteredSuggestions);
      }
    } catch (error) {
      console.error("Error loading suggestions:", error);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [selectedSupermarket, items]);

  // Load suggestions when supermarket changes or items change
  useEffect(() => {
    if (showSuggestions) {
      loadSuggestions();
    }
  }, [loadSuggestions, showSuggestions]);

  const addSuggestionToList = async (suggestion: ItemSupermarketHistory) => {
    try {
      const category = categorizeIngredient(suggestion.item_name);
      const { error } = await supabase.from("shopping_items").insert([
        {
          name: suggestion.item_name,
          quantity: null,
          category: category,
          checked: false,
          recipe_id: null,
          supermarket: selectedSupermarket,
        },
      ]);

      if (error) throw error;

      // Remove from suggestions immediately for better UX
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      loadItems();
    } catch (error) {
      console.error("Error adding suggestion:", error);
    }
  };

  const generateFromMealPlan = async () => {
    setGenerating(true);

    try {
      // Calculate current week's start (Monday)
      const today = new Date();
      const weekStartDate = new Date(today);
      weekStartDate.setDate(today.getDate() - today.getDay() + 1);
      const weekStart = weekStartDate.toISOString().split("T")[0];
      
      // Get this week's meal plans with recipe details
      const weekEnd = new Date(weekStartDate);
      weekEnd.setDate(weekStartDate.getDate() + 6);

      const { data: mealPlans, error: plansError } = await supabase
        .from("meal_plans")
        .select("*, recipe:recipes(*)")
        .gte("plan_date", weekStart)
        .lte("plan_date", weekEnd.toISOString().split("T")[0]);

      if (plansError) throw plansError;

      if (!mealPlans || mealPlans.length === 0) {
        alert("No hay comidas planificadas para esta semana. ¡Añade algunas comidas al planificador primero!");
        return;
      }

      // Collect and combine ingredients intelligently
      const ingredientMap = new Map<
        string,
        { 
          name: string; 
          quantity: string; 
          category: string; 
          recipes: Set<string>;
        }
      >();

      for (const plan of mealPlans as MealPlan[]) {
        if (!plan.recipe) continue;

        const ingredients = plan.recipe.ingredients as Ingredient[];
        const selectedVariant = plan.selected_variant || 1;
        const alternativeSelections = plan.alternative_selections || {};
        const servingsMultiplier = plan.servings_multiplier || 1;
        
        // Common pantry ingredients to exclude from shopping list
        const excludedIngredients = ["sal", "agua", "especias", "pimienta", "pimienta negra"];
        
        for (let idx = 0; idx < ingredients.length; idx++) {
          const ing = ingredients[idx];
          
          // Skip section headers
          if (ing.isHeader) continue;
          
          // Skip common pantry ingredients that most people already have
          const ingredientNameLower = ing.name.toLowerCase().trim();
          if (excludedIngredients.some(excluded => ingredientNameLower === excluded || ingredientNameLower.includes(excluded))) continue;
          
          // Check if we should use the alternative ingredient
          const useAlternative = alternativeSelections[idx.toString()] === true;
          
          let ingredientName: string;
          let ingredientAmount: string;
          let ingredientUnit: string;
          
          if (useAlternative && ing.alternative?.name) {
            // Use alternative ingredient
            const alt = ing.alternative;
            ingredientName = alt.name;
            // Use variant 2 amounts for alternative if available and selected
            if (selectedVariant === 2 && alt.amount2) {
              ingredientAmount = alt.amount2;
              ingredientUnit = alt.unit2 || alt.unit || "";
            } else {
              ingredientAmount = alt.amount || "";
              ingredientUnit = alt.unit || "";
            }
          } else {
            // Use primary ingredient
            ingredientName = ing.name;
            // Use variant 2 amounts if selected and available
            if (selectedVariant === 2 && ing.amount2) {
              ingredientAmount = ing.amount2;
              ingredientUnit = ing.unit2 || ing.unit || "";
            } else {
              ingredientAmount = ing.amount || "";
              ingredientUnit = ing.unit || "";
            }
          }
          
          // Apply servings multiplier to the amount
          let adjustedAmount = ingredientAmount;
          if (ingredientAmount && servingsMultiplier !== 1) {
            const parsed = parseQuantity(ingredientAmount);
            if (parsed && parsed.amount !== null) {
              const multipliedValue = parsed.amount * servingsMultiplier;
              // Format nicely - round to 2 decimal places and remove trailing zeros
              const formattedValue = Math.round(multipliedValue * 100) / 100;
              adjustedAmount = formattedValue.toString();
            }
          }
          
          const key = ingredientName.toLowerCase().trim();
          const existing = ingredientMap.get(key);
          const newQuantity = adjustedAmount ? `${adjustedAmount} ${ingredientUnit}`.trim() : "";

          if (existing) {
            // Combine quantities intelligently
            if (newQuantity && existing.quantity) {
              existing.quantity = combineQuantities(existing.quantity, newQuantity, ingredientName);
            } else if (newQuantity) {
              existing.quantity = newQuantity;
            }
            existing.recipes.add(plan.recipe.title);
          } else {
            ingredientMap.set(key, {
              name: ingredientName,
              quantity: newQuantity,
              category: categorizeIngredient(ingredientName),
              recipes: new Set([plan.recipe.title]),
            });
          }
        }
      }

      // Convert to preview ingredients array
      const preview: PreviewIngredient[] = Array.from(ingredientMap.entries()).map(
        ([key, value], index) => ({
          id: `preview-${index}-${key}`,
          name: value.name,
          quantity: value.quantity,
          category: value.category,
          selected: true, // All selected by default
          recipes: Array.from(value.recipes),
        })
      );

      // Sort by category order
      preview.sort((a, b) => {
        const catIndexA = categoryOrder.indexOf(a.category);
        const catIndexB = categoryOrder.indexOf(b.category);
        if (catIndexA !== catIndexB) {
          return (catIndexA === -1 ? 999 : catIndexA) - (catIndexB === -1 ? 999 : catIndexB);
        }
        return a.name.localeCompare(b.name);
      });

      // Show preview modal
      setPreviewIngredients(preview);
      setIsPreviewModalOpen(true);
    } catch (error) {
      console.error("Error generating shopping list:", error);
      alert("Error al generar la lista de compras. Por favor, inténtalo de nuevo.");
    } finally {
      setGenerating(false);
    }
  };

  const confirmAddIngredients = async (selectedIngredients: PreviewIngredient[]) => {
    try {
      // Get existing items to combine with
      const existingItems = items.filter(item => !item.checked);
      
      // Create a map of existing items by normalized name
      const existingMap = new Map<string, ShoppingItem>();
      for (const item of existingItems) {
        existingMap.set(item.name.toLowerCase().trim(), item);
      }

      // Separate items to update and items to insert
      const itemsToUpdate: { id: string; quantity: string; recipe_sources: string[] }[] = [];
      const itemsToInsert: { 
        name: string; 
        quantity: string | null; 
        category: string; 
        checked: boolean; 
        recipe_id: string | null;
        recipe_sources: string[];
        supermarket: SupermarketName;
      }[] = [];

      for (const ing of selectedIngredients) {
        const key = ing.name.toLowerCase().trim();
        const existingItem = existingMap.get(key);

        if (existingItem) {
          // Combine quantities with existing item
          const combinedQuantity = existingItem.quantity && ing.quantity
            ? combineQuantities(existingItem.quantity, ing.quantity, ing.name)
            : ing.quantity || existingItem.quantity || "";
          
          // Merge recipe sources, removing duplicates
          const existingSources = existingItem.recipe_sources || [];
          const newSources = ing.recipes || [];
          const mergedSources = [...new Set([...existingSources, ...newSources])];
          
          itemsToUpdate.push({
            id: existingItem.id,
            quantity: combinedQuantity,
            recipe_sources: mergedSources,
          });
        } else {
          // New item to insert
          itemsToInsert.push({
            name: ing.name,
            quantity: ing.quantity || null,
            category: ing.category,
            checked: false,
            recipe_id: null,
            recipe_sources: ing.recipes || [],
            supermarket: selectedSupermarket,
          });
        }
      }

      // Update existing items with combined quantities and merged recipe sources
      for (const update of itemsToUpdate) {
        const { error: updateError } = await supabase
          .from("shopping_items")
          .update({ quantity: update.quantity, recipe_sources: update.recipe_sources })
          .eq("id", update.id);
        
        if (updateError) throw updateError;
      }

      // Insert new items
      if (itemsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("shopping_items")
          .insert(itemsToInsert);

        if (insertError) throw insertError;
      }

      loadItems();
    } catch (error) {
      console.error("Error adding ingredients:", error);
      const errorMessage = error instanceof Error ? error.message : 
        (typeof error === 'object' && error !== null && 'message' in error) 
          ? (error as { message: string }).message 
          : "Error desconocido";
      alert(`Error al añadir ingredientes: ${errorMessage}`);
    }
  };

  const toggleItem = async (item: ShoppingItem) => {
    try {
      const { error } = await supabase
        .from("shopping_items")
        .update({ checked: !item.checked })
        .eq("id", item.id);

      if (error) throw error;

      setItems(
        items.map((i) =>
          i.id === item.id ? { ...i, checked: !i.checked } : i
        )
      );
    } catch (error) {
      console.error("Error toggling item:", error);
    }
  };

  const addManualItem = async (name: string, quantity: string, category: string) => {
    if (!name.trim()) return;

    try {
      const { error } = await supabase.from("shopping_items").insert([
        {
          name: name.trim(),
          quantity: quantity.trim() || null,
          category: category,
          checked: false,
          recipe_id: null,
          supermarket: selectedSupermarket,
        },
      ]);

      if (error) throw error;

      loadItems();
    } catch (error) {
      console.error("Error adding item:", error);
    }
  };

  const updateItem = async (item: ShoppingItem, name: string, quantity: string, category?: string) => {
    try {
      const updates: { name: string; quantity: string | null; category?: string } = { 
        name: name.trim(),
        quantity: quantity.trim() || null 
      };
      
      if (category) {
        updates.category = category;
      }

      const { error } = await supabase
        .from("shopping_items")
        .update(updates)
        .eq("id", item.id);

      if (error) throw error;

      setItems(
        items.map((i) =>
          i.id === item.id ? { ...i, name: name.trim(), quantity: quantity.trim() || null, category: category || i.category } : i
        )
      );
      setEditingItem(null);
    } catch (error) {
      console.error("Error updating item:", error);
    }
  };

  const addProductFromDatabase = async (product: GroceryProduct) => {
    try {
      const { error } = await supabase.from("shopping_items").insert([
        {
          name: product.name,
          category: product.category,
          checked: false,
          recipe_id: null,
          supermarket: selectedSupermarket,
        },
      ]);

      if (error) throw error;

      loadItems();
    } catch (error) {
      console.error("Error adding product:", error);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      // Soft delete: set deleted_at instead of actually deleting
      const { error } = await supabase
        .from("shopping_items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      setItems(items.filter((i) => i.id !== id));
      // Refresh trash if it's open
      if (showTrash) {
        loadTrashItems();
      }
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  // Restore item from trash
  const restoreItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from("shopping_items")
        .update({ deleted_at: null, checked: false })
        .eq("id", id);

      if (error) throw error;

      setTrashItems(trashItems.filter((i) => i.id !== id));
      loadItems();
    } catch (error) {
      console.error("Error restoring item:", error);
    }
  };

  // Permanently delete item from trash
  const permanentlyDeleteItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from("shopping_items")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setTrashItems(trashItems.filter((i) => i.id !== id));
    } catch (error) {
      console.error("Error permanently deleting item:", error);
    }
  };

  // Empty entire trash for current supermarket
  const emptyTrash = async () => {
    if (!confirm("¿Seguro que quieres vaciar la papelera? Esta acción es permanente.")) return;
    
    try {
      const { error } = await supabase
        .from("shopping_items")
        .delete()
        .eq("supermarket", selectedSupermarket)
        .not("deleted_at", "is", null);

      if (error) throw error;

      setTrashItems([]);
    } catch (error) {
      console.error("Error emptying trash:", error);
    }
  };

  // Restore all items from trash
  const restoreAllTrash = async () => {
    try {
      const { error } = await supabase
        .from("shopping_items")
        .update({ deleted_at: null, checked: false })
        .eq("supermarket", selectedSupermarket)
        .not("deleted_at", "is", null);

      if (error) throw error;

      setTrashItems([]);
      loadItems();
    } catch (error) {
      console.error("Error restoring all items:", error);
    }
  };

  const clearChecked = async () => {
    try {
      // Soft delete: move to trash instead of deleting
      const { error } = await supabase
        .from("shopping_items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("supermarket", selectedSupermarket)
        .is("deleted_at", null)
        .eq("checked", true);

      if (error) throw error;

      loadItems();
      if (showTrash) {
        loadTrashItems();
      }
    } catch (error) {
      console.error("Error clearing checked items:", error);
    }
  };

  const clearAll = async () => {
    if (!confirm("¿Seguro que quieres vaciar toda la lista? Los productos irán a la papelera.")) return;
    
    try {
      // Soft delete: move to trash instead of deleting
      const { error } = await supabase
        .from("shopping_items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("supermarket", selectedSupermarket)
        .is("deleted_at", null);

      if (error) throw error;

      loadItems();
      if (showTrash) {
        loadTrashItems();
      }
    } catch (error) {
      console.error("Error clearing all items:", error);
    }
  };

  // Selection mode handlers
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedItems(new Set());
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const selectAllItems = () => {
    const allItemIds = uncheckedItems.map(item => item.id);
    setSelectedItems(new Set(allItemIds));
  };

  const deselectAllItems = () => {
    setSelectedItems(new Set());
  };

  const openMoveModalForSelection = () => {
    const selectedItemsList = items.filter(item => selectedItems.has(item.id));
    setItemsToMove(selectedItemsList);
    setIsMoveModalOpen(true);
  };

  const openMoveModalForItem = (item: ShoppingItem) => {
    setItemsToMove([item]);
    setIsMoveModalOpen(true);
  };

  // Move items to another supermarket
  const moveItemsToSupermarket = async (itemsToTransfer: ShoppingItem[], targetSupermarket: SupermarketName) => {
    try {
      const itemIds = itemsToTransfer.map(item => item.id);
      
      const { error } = await supabase
        .from("shopping_items")
        .update({ supermarket: targetSupermarket })
        .in("id", itemIds);

      if (error) throw error;

      // Exit selection mode and refresh
      setSelectionMode(false);
      setSelectedItems(new Set());
      loadItems();
    } catch (error) {
      console.error("Error moving items:", error);
      alert("Error al mover los artículos. Por favor, inténtalo de nuevo.");
    }
  };

  // Copy items to another supermarket
  const copyItemsToSupermarket = async (itemsToCopy: ShoppingItem[], targetSupermarket: SupermarketName) => {
    try {
      // Create new items with the target supermarket
      const newItems = itemsToCopy.map(item => ({
        name: item.name,
        quantity: item.quantity,
        category: item.category,
        checked: false,
        recipe_id: item.recipe_id,
        recipe_sources: item.recipe_sources || [],
        supermarket: targetSupermarket,
      }));

      const { error } = await supabase
        .from("shopping_items")
        .insert(newItems);

      if (error) throw error;

      // Exit selection mode (items stay in current list)
      setSelectionMode(false);
      setSelectedItems(new Set());
    } catch (error) {
      console.error("Error copying items:", error);
      alert("Error al copiar los artículos. Por favor, inténtalo de nuevo.");
    }
  };

  const adjustQuantity = async (item: ShoppingItem, delta: number) => {
    const parsed = parseQuantity(item.quantity || "1");
    const currentAmount = parsed.amount ?? 1;
    const newAmount = Math.max(1, currentAmount + delta);
    
    // Format the new quantity with the original unit
    const newQuantity = parsed.unit 
      ? formatQuantity(newAmount, parsed.unit)
      : newAmount.toString();
    
    try {
      const { error } = await supabase
        .from("shopping_items")
        .update({ quantity: newQuantity })
        .eq("id", item.id);

      if (error) throw error;

      setItems(
        items.map((i) =>
          i.id === item.id ? { ...i, quantity: newQuantity } : i
        )
      );
    } catch (error) {
      console.error("Error updating quantity:", error);
    }
  };

  // Separate checked and unchecked items
  const uncheckedItems = items.filter((item) => !item.checked);
  const checkedItems = items.filter((item) => item.checked);

  // Group only unchecked items by category
  const groupedItems = uncheckedItems.reduce(
    (acc, item) => {
      const category = item.category || "Otros";
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    },
    {} as Record<string, ShoppingItem[]>
  );

  const checkedCount = checkedItems.length;
  const totalCount = items.length;

  const supermarketColor = SUPERMARKET_COLORS[selectedSupermarket];

  const [showClearMenu, setShowClearMenu] = useState(false);

  return (
    <div className="min-h-screen pb-20">
      <Header
        title="Lista de Compras"
        rightAction={
          items.length > 0 ? (
            <div className="relative">
              <button
                onClick={() => setShowClearMenu(!showClearMenu)}
                className="p-2 text-[var(--color-slate)] hover:text-red-600 transition-colors"
                title="Opciones de lista"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              {showClearMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowClearMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-[var(--border-color)] py-1 z-50 min-w-[180px]">
                    {checkedCount > 0 && (
                      <button
                        onClick={() => {
                          clearChecked();
                          setShowClearMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-purple-bg)] transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Quitar marcados ({checkedCount})
                      </button>
                    )}
                    <button
                      onClick={() => {
                        clearAll();
                        setShowClearMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Vaciar toda la lista
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : undefined
        }
      />

      <main className="max-w-7xl mx-auto p-4 lg:px-8">
        {/* Supermarket Selector */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-[var(--color-slate)]">
              Supermercado
            </label>
            <button
              onClick={() => setIsCategoryOrderModalOpen(true)}
              className="text-sm text-[var(--color-purple)] hover:text-[var(--color-purple-dark)] flex items-center gap-1 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Editar orden de categorías
            </button>
          </div>
          <div className="flex gap-2">
            {SUPERMARKETS.map((market) => {
              const colors = SUPERMARKET_COLORS[market];
              const isSelected = selectedSupermarket === market;
              return (
                <button
                  key={market}
                  onClick={() => setSelectedSupermarket(market)}
                  className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all border-2 ${
                    isSelected
                      ? `${colors.bg} ${colors.text} ${colors.border} shadow-sm`
                      : "bg-white border-[var(--border-color)] text-[var(--color-slate)] hover:border-[var(--color-purple-light)]"
                  }`}
                >
                  {market}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setIsGroceryModalOpen(true)}
            className="flex-1 btn-primary flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Añadir Producto
          </button>
          
          <button
            onClick={generateFromMealPlan}
            disabled={generating}
            className="btn-secondary flex items-center justify-center gap-2 px-4"
          >
            {generating ? (
              <>
                <div className="w-5 h-5 border-2 border-[var(--color-purple)] border-t-transparent rounded-full animate-spin" />
                <span className="hidden sm:inline">Generando...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Desde Menús</span>
                <span className="sm:hidden">Menús</span>
              </>
            )}
          </button>
        </div>

        {/* Suggestions & Trash Section */}
        <div className="mb-6 space-y-2">
          {/* Suggestions Button */}
          <button
            onClick={() => {
              setShowSuggestions(!showSuggestions);
              setShowTrash(false);
              if (!showSuggestions) {
                loadSuggestions();
              }
            }}
            className="w-full flex items-center justify-between p-3 bg-[var(--color-purple-bg)] rounded-xl hover:bg-[var(--color-purple-bg-dark)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">💡</span>
              <span className="font-medium text-[var(--foreground)]">
                ¿Te falta algo?
              </span>
              <span className="text-sm text-[var(--color-slate)]">
                Sugerencias de {selectedSupermarket}
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-[var(--color-slate)] transition-transform ${showSuggestions ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Trash Button */}
          <button
            onClick={() => {
              setShowTrash(!showTrash);
              setShowSuggestions(false);
            }}
            className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
              showTrash 
                ? 'bg-orange-100 hover:bg-orange-200' 
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">🗑️</span>
              <span className="font-medium text-[var(--foreground)]">
                Papelera
              </span>
              {trashItems.length > 0 && (
                <span className="text-xs px-2 py-0.5 bg-orange-200 text-orange-700 rounded-full">
                  {trashItems.length}
                </span>
              )}
              <span className="text-sm text-[var(--color-slate)]">
                Se vacía automáticamente en 30 días
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-[var(--color-slate)] transition-transform ${showTrash ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showSuggestions && (
            <div className="mt-2 bg-white rounded-xl border border-[var(--border-color)] overflow-hidden">
              {loadingSuggestions ? (
                <div className="p-4 flex items-center justify-center gap-2 text-[var(--color-slate)]">
                  <div className="w-4 h-4 border-2 border-[var(--color-purple)] border-t-transparent rounded-full animate-spin" />
                  Cargando sugerencias...
                </div>
              ) : suggestions.length > 0 ? (
                <>
                  <div className="p-3 bg-[var(--color-purple-bg)] border-b border-[var(--border-color)]">
                    <p className="text-sm text-[var(--color-slate)]">
                      Productos que sueles comprar en <strong>{selectedSupermarket}</strong> y no están en tu lista:
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <div className="flex flex-wrap gap-2 p-3">
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          onClick={() => addSuggestionToList(suggestion)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-purple-bg)] hover:bg-[var(--color-purple-bg-dark)] rounded-full text-sm text-[var(--foreground)] transition-all hover:scale-105 active:scale-95"
                        >
                          <svg className="w-4 h-4 text-[var(--color-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          {suggestion.item_name}
                          {suggestion.frequency > 1 && (
                            <span className="text-xs text-[var(--color-slate-light)]">
                              ({suggestion.frequency}×)
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-4 text-center text-[var(--color-slate)]">
                  <p>No hay sugerencias disponibles aún.</p>
                  <p className="text-sm text-[var(--color-slate-light)] mt-1">
                    A medida que uses la app, aprenderemos tus productos favoritos de cada supermercado.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Trash Content */}
          {showTrash && (
            <div className="mt-2 bg-white rounded-xl border border-orange-200 overflow-hidden">
              {loadingTrash ? (
                <div className="p-4 flex items-center justify-center gap-2 text-[var(--color-slate)]">
                  <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  Cargando papelera...
                </div>
              ) : trashItems.length > 0 ? (
                <>
                  <div className="p-3 bg-orange-50 border-b border-orange-200 flex items-center justify-between">
                    <p className="text-sm text-orange-700">
                      {trashItems.length} producto{trashItems.length !== 1 ? 's' : ''} en la papelera
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={restoreAllTrash}
                        className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        Restaurar todo
                      </button>
                      <button
                        onClick={emptyTrash}
                        className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Vaciar papelera
                      </button>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-orange-100">
                    {trashItems.map((item) => {
                      const deletedDate = new Date(item.deleted_at);
                      const daysAgo = Math.floor((Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24));
                      const daysLeft = 30 - daysAgo;
                      
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 hover:bg-orange-50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="text-[var(--foreground)]">{item.name}</span>
                              {item.quantity && (
                                <span className="text-sm text-[var(--color-slate)]">
                                  {item.quantity}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-orange-600 mt-0.5">
                              {daysAgo === 0 ? 'Hoy' : daysAgo === 1 ? 'Ayer' : `Hace ${daysAgo} días`} 
                              {' · '}
                              <span className={daysLeft <= 7 ? 'text-red-600 font-medium' : ''}>
                                {daysLeft} día{daysLeft !== 1 ? 's' : ''} restante{daysLeft !== 1 ? 's' : ''}
                              </span>
                            </p>
                          </div>
                          <button
                            onClick={() => restoreItem(item.id)}
                            className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                            title="Restaurar"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                          </button>
                          <button
                            onClick={() => permanentlyDeleteItem(item.id)}
                            className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                            title="Eliminar permanentemente"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="p-6 text-center text-[var(--color-slate)]">
                  <div className="w-12 h-12 mx-auto mb-2 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">🗑️</span>
                  </div>
                  <p>La papelera está vacía</p>
                  <p className="text-sm text-[var(--color-slate-light)] mt-1">
                    Los productos que borres aparecerán aquí
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Progress */}
        {totalCount > 0 && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-[var(--color-slate)] mb-1">
              <span>Progreso</span>
              <span>
                {checkedCount} de {totalCount} artículos
              </span>
            </div>
            <div className="w-full bg-[var(--color-purple-bg-dark)] rounded-full h-2">
              <div
                className="bg-[var(--color-purple)] h-2 rounded-full transition-all"
                style={{ width: `${(checkedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        )}

        {loading || loadingCategoryOrder ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-6 bg-[var(--color-purple-bg-dark)] rounded w-24 mb-2" />
                <div className="space-y-2">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-12 bg-[var(--color-purple-bg-dark)] rounded" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : totalCount > 0 ? (
          <div className="space-y-6">
            {/* Unchecked items grouped by category */}
            {categoryOrder.filter((cat) => groupedItems[cat]?.length > 0).map(
              (category) => (
                <div key={category}>
                  <h3 className="font-display text-lg font-semibold text-[var(--foreground)] mb-2 flex items-center gap-2">
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${supermarketColor.bg} ${supermarketColor.text}`}>
                      {categoryOrder.indexOf(category) + 1}
                    </span>
                    <span className="text-xl">{CATEGORY_ICONS[category] || "📦"}</span>
                    {category}
                  </h3>
                  <div className="bg-white rounded-xl border border-[var(--border-color)] divide-y divide-[var(--border-color)]">
                    {groupedItems[category].map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 p-3 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => toggleItem(item)}
                          className="checkbox flex-shrink-0"
                        />
                        <button
                          onClick={() => setEditingItem(item)}
                          className="flex-1 min-w-0 text-left hover:bg-[var(--color-purple-bg)] rounded-lg px-2 py-1 transition-colors"
                        >
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-[var(--foreground)]">
                              {item.name}
                            </span>
                            {item.quantity && (
                              <span className="text-sm font-medium text-[var(--color-purple)]">
                                {item.quantity}
                              </span>
                            )}
                          </div>
                          {item.recipe_sources && item.recipe_sources.length > 0 && (
                            <p className="text-xs mt-0.5 truncate text-[var(--color-slate)]">
                              📖 {item.recipe_sources.join(", ")}
                            </p>
                          )}
                        </button>
                        {/* Quantity controls */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => adjustQuantity(item, -1)}
                            className="w-7 h-7 rounded-full flex items-center justify-center transition-all bg-[var(--color-purple-bg)] text-[var(--color-purple)] hover:bg-[var(--color-purple-bg-dark)] active:scale-95"
                            title="Reducir cantidad"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          </button>
                          <button
                            onClick={() => adjustQuantity(item, 1)}
                            className="w-7 h-7 rounded-full flex items-center justify-center transition-all bg-[var(--color-purple-bg)] text-[var(--color-purple)] hover:bg-[var(--color-purple-bg-dark)] active:scale-95"
                            title="Aumentar cantidad"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </div>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="p-1 text-[var(--color-slate-light)] hover:text-red-600 transition-colors flex-shrink-0"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}

            {/* Checked items - all together at the bottom without categories */}
            {checkedItems.length > 0 && (
              <div className="pt-4 border-t-2 border-dashed border-[var(--border-color)]">
                <h3 className="font-display text-lg font-semibold text-[var(--color-slate-light)] mb-2 flex items-center gap-2">
                  <span className="text-xl">✓</span>
                  En el carrito
                  <span className="text-sm font-normal">({checkedItems.length})</span>
                </h3>
                <div className="bg-[var(--color-purple-bg)] rounded-xl border border-[var(--border-color)] divide-y divide-[var(--border-color)]">
                  {checkedItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 p-3 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleItem(item)}
                        className="checkbox flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="line-through text-[var(--color-slate-light)]">
                            {item.name}
                          </span>
                          {item.quantity && (
                            <span className="text-sm font-medium text-[var(--color-slate-light)] line-through">
                              {item.quantity}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-1 text-[var(--color-slate-light)] hover:text-red-600 transition-colors flex-shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 bg-[var(--color-purple-bg-dark)] rounded-full flex items-center justify-center">
              <svg
                className="w-10 h-10 text-[var(--color-slate-light)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <h2 className="font-display text-xl font-semibold text-[var(--foreground)] mb-2">
              Aún no hay artículos
            </h2>
            <p className="text-[var(--color-slate-light)] mb-4">
              Genera una lista desde tu planificador o añade productos
            </p>
            <button
              onClick={() => setIsGroceryModalOpen(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Añadir Producto
            </button>
          </div>
        )}
      </main>

      <BottomNav />

      {/* Grocery Search Modal */}
      <GrocerySearchModal
        isOpen={isGroceryModalOpen}
        onClose={() => setIsGroceryModalOpen(false)}
        onSelectProduct={addProductFromDatabase}
        onAddManual={addManualItem}
        categoryOrder={categoryOrder}
      />

      {/* Category Order Modal */}
      <CategoryOrderModal
        isOpen={isCategoryOrderModalOpen}
        onClose={() => setIsCategoryOrderModalOpen(false)}
        supermarket={selectedSupermarket}
        categoryOrder={categoryOrder}
        onSave={saveCategoryOrder}
      />

      {/* Edit Item Modal */}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={updateItem}
          categoryOrder={categoryOrder}
        />
      )}

      {/* Ingredient Preview Modal */}
      <IngredientPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        ingredients={previewIngredients}
        onConfirm={confirmAddIngredients}
        categoryOrder={categoryOrder}
      />
    </div>
  );
}
