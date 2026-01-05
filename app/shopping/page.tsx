"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase, type ShoppingItem, type MealPlan, type Ingredient, type SupermarketName, type SupermarketCategoryOrder, SUPERMARKETS, SUPERMARKET_COLORS, DEFAULT_CATEGORIES } from "@/lib/supabase";
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

function getWeekStart(): string {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  return monday.toISOString().split("T")[0];
}

function categorizeIngredient(name: string): string {
  const lowerName = name.toLowerCase();

  // Frutas y Verduras
  if (
    /\b(lettuce|tomato|onion|garlic|pepper|carrot|celery|potato|broccoli|spinach|kale|cucumber|zucchini|squash|mushroom|avocado|lemon|lime|orange|apple|banana|berry|fruit|vegetable|herb|cilantro|parsley|basil|mint|thyme|rosemary|lechuga|tomate|cebolla|ajo|pimiento|zanahoria|apio|patata|papa|brócoli|espinaca|pepino|calabacín|champiñón|aguacate|limón|naranja|manzana|plátano|fruta|verdura|hierba|perejil|albahaca|menta|romero)\b/.test(
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

  // Carnes y Mariscos
  if (
    /\b(chicken|beef|pork|lamb|turkey|fish|salmon|shrimp|bacon|sausage|meat|steak|ground|pollo|res|cerdo|cordero|pavo|pescado|salmón|camarón|tocino|salchicha|carne|bistec|molida)\b/.test(
      lowerName
    )
  ) {
    return "Carnes y Mariscos";
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

  // Despensa (default for most dry goods, canned items, etc.)
  if (
    /\b(flour|sugar|salt|oil|vinegar|sauce|pasta|rice|bean|can|stock|broth|spice|seasoning|harina|azúcar|sal|aceite|vinagre|salsa|arroz|frijol|lata|caldo|especia|condimento)\b/.test(
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

// Edit Item Modal Component
function EditItemModal({
  item,
  onClose,
  onSave,
  categoryOrder,
}: {
  item: ShoppingItem;
  onClose: () => void;
  onSave: (item: ShoppingItem, name: string, quantity: string, category?: string) => void;
  categoryOrder: string[];
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

  const handleConfirm = async () => {
    setSaving(true);
    const selected = localIngredients.filter(ing => ing.selected);
    await onConfirm(selected);
    setSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  // Group ingredients by category
  const groupedIngredients = localIngredients.reduce(
    (acc, ing) => {
      const category = ing.category || "Otros";
      if (!acc[category]) acc[category] = [];
      acc[category].push(ing);
      return acc;
    },
    {} as Record<string, PreviewIngredient[]>
  );

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
        <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between bg-white">
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
          ) : (
            <div className="space-y-6">
              {categoryOrder.filter(cat => groupedIngredients[cat]?.length > 0).map(category => {
                const categoryIngredients = groupedIngredients[category];
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

  const weekStart = getWeekStart();

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
        .eq("week_start", weekStart)
        .eq("supermarket", selectedSupermarket)
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
  }, [weekStart, selectedSupermarket]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const generateFromMealPlan = async () => {
    setGenerating(true);

    try {
      // Get this week's meal plans with recipe details
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

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
        
        for (let idx = 0; idx < ingredients.length; idx++) {
          const ing = ingredients[idx];
          
          // Skip section headers
          if (ing.isHeader) continue;
          
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
        week_start: string; 
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
            week_start: weekStart,
            recipe_id: null,
            recipe_sources: ing.recipes || [],
            supermarket: selectedSupermarket,
          });
        }
      }

      // Update existing items with combined quantities and merged recipe sources
      for (const update of itemsToUpdate) {
        await supabase
          .from("shopping_items")
          .update({ quantity: update.quantity, recipe_sources: update.recipe_sources })
          .eq("id", update.id);
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
      alert("Error al añadir ingredientes. Por favor, inténtalo de nuevo.");
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
          week_start: weekStart,
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
          week_start: weekStart,
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
      const { error } = await supabase
        .from("shopping_items")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setItems(items.filter((i) => i.id !== id));
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  const clearChecked = async () => {
    try {
      const { error } = await supabase
        .from("shopping_items")
        .delete()
        .eq("week_start", weekStart)
        .eq("supermarket", selectedSupermarket)
        .eq("checked", true);

      if (error) throw error;

      loadItems();
    } catch (error) {
      console.error("Error clearing checked items:", error);
    }
  };

  const clearAll = async () => {
    if (!confirm("¿Seguro que quieres vaciar toda la lista de compras?")) return;
    
    try {
      const { error } = await supabase
        .from("shopping_items")
        .delete()
        .eq("week_start", weekStart)
        .eq("supermarket", selectedSupermarket);

      if (error) throw error;

      loadItems();
    } catch (error) {
      console.error("Error clearing all items:", error);
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

  // Group items by category
  const groupedItems = items.reduce(
    (acc, item) => {
      const category = item.category || "Otros";
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    },
    {} as Record<string, ShoppingItem[]>
  );

  const checkedCount = items.filter((i) => i.checked).length;
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
            {/* Use custom category order for this supermarket */}
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
                        className={`flex items-center gap-2 p-3 transition-colors ${
                          item.checked ? "bg-[var(--color-purple-bg-dark)]" : ""
                        }`}
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
                            <span
                              className={`${
                                item.checked
                                  ? "line-through text-[var(--color-slate-light)]"
                                  : "text-[var(--foreground)]"
                              }`}
                            >
                              {item.name}
                            </span>
                            {item.quantity && (
                              <span className={`text-sm font-medium ${item.checked ? "text-[var(--color-slate-light)]" : "text-[var(--color-purple)]"}`}>
                                {item.quantity}
                              </span>
                            )}
                          </div>
                          {item.recipe_sources && item.recipe_sources.length > 0 && (
                            <p className={`text-xs mt-0.5 truncate ${item.checked ? "text-[var(--color-slate-light)]" : "text-[var(--color-slate)]"}`}>
                              📖 {item.recipe_sources.join(", ")}
                            </p>
                          )}
                        </button>
                        {/* Quantity controls */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => adjustQuantity(item, -1)}
                            disabled={item.checked}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                              item.checked 
                                ? "bg-gray-100 text-gray-300 cursor-not-allowed" 
                                : "bg-[var(--color-purple-bg)] text-[var(--color-purple)] hover:bg-[var(--color-purple-bg-dark)] active:scale-95"
                            }`}
                            title="Reducir cantidad"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          </button>
                          <button
                            onClick={() => adjustQuantity(item, 1)}
                            disabled={item.checked}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                              item.checked 
                                ? "bg-gray-100 text-gray-300 cursor-not-allowed" 
                                : "bg-[var(--color-purple-bg)] text-[var(--color-purple)] hover:bg-[var(--color-purple-bg-dark)] active:scale-95"
                            }`}
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
