import Image from "next/image";
import Link from "next/link";
import type { Recipe } from "@/lib/supabase";

interface RecipeCardProps {
  recipe: Recipe;
  onTagClick?: (tag: string) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onAddToPlanner?: (recipe: Recipe) => void;
}

export default function RecipeCard({ 
  recipe, 
  onTagClick,
  selectionMode = false,
  isSelected = false,
  onSelect,
  onAddToPlanner,
}: RecipeCardProps) {
  const totalTime =
    (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectionMode && onSelect) {
      e.preventDefault();
      e.stopPropagation();
      onSelect(recipe.id, !isSelected);
    }
  };

  const CardContent = (
    <article 
      className={`recipe-card group h-full flex flex-col transition-all ${
        selectionMode ? 'cursor-pointer' : ''
      } ${isSelected ? 'ring-2 ring-[var(--color-purple)] ring-offset-2' : ''}`}
      onClick={handleCardClick}
    >
      <div className="relative aspect-[4/3] bg-[var(--color-purple-bg-dark)]">
        {/* Selection checkbox */}
        {selectionMode && (
          <div className="absolute top-2 left-2 z-20">
            <div 
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                isSelected 
                  ? 'bg-[var(--color-purple)] border-[var(--color-purple)]' 
                  : 'bg-white/90 border-[var(--color-slate-light)] hover:border-[var(--color-purple)]'
              }`}
            >
              {isSelected && (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
        )}
        {/* Made it badge */}
        {recipe.made_it && !selectionMode && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-1 bg-green-500 text-white text-xs font-semibold rounded-full shadow-sm">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Hecho
          </div>
        )}
        {/* Add to planner button */}
        {!selectionMode && onAddToPlanner && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddToPlanner(recipe);
            }}
            className="absolute bottom-2 right-2 z-10 w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur-sm text-[var(--color-purple)] rounded-full shadow-md opacity-0 group-hover:opacity-100 hover:bg-[var(--color-purple)] hover:text-white transition-all transform scale-90 group-hover:scale-100"
            title="Añadir al menú"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
        )}
          {/* Rating stars */}
          {recipe.rating && (
            <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-full">
              {[1, 2, 3].map((star) => (
                <svg
                  key={star}
                  className={`w-3.5 h-3.5 ${
                    star <= recipe.rating! ? "text-amber-400 fill-amber-400" : "text-white/40"
                  }`}
                  fill={star <= recipe.rating! ? "currentColor" : "none"}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
              ))}
            </div>
          )}
          {recipe.image_url ? (
            <Image
              src={recipe.image_url}
              alt={recipe.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="w-16 h-16 text-[var(--color-slate-light)] opacity-40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
          )}
        </div>

        <div className="p-3 sm:p-4 flex flex-col flex-1">
          <h3 className="font-display text-base sm:text-lg font-semibold text-[var(--foreground)] line-clamp-3 sm:line-clamp-2 group-hover:text-[var(--color-purple)] transition-colors leading-snug">
            {recipe.title}
          </h3>

          <div className="flex items-center gap-4 mt-2 text-sm text-[var(--color-slate-light)]">
            {totalTime > 0 && (
              <span className="flex items-center gap-1">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {totalTime} min
              </span>
            )}
            {/* Show container info, servings_unit, variant info, or regular servings */}
            {recipe.container ? (
              <span className="flex items-center gap-1" title={recipe.container.name}>
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                <span className="truncate">{recipe.container_quantity || 1} {recipe.container.name}</span>
              </span>
            ) : recipe.variant_1_label ? (
              // Recipe uses variants (e.g., different mold sizes) - show mold icon instead of servings
              <span className="flex items-center gap-1" title={`${recipe.variant_1_label} / ${recipe.variant_2_label}`}>
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                  />
                </svg>
                <span className="truncate text-xs">2 tamaños</span>
              </span>
            ) : recipe.servings_unit ? (
              <span className="flex items-center gap-1">
                {/* Grid/pieces icon for units */}
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
                <span className="truncate">{recipe.servings} {recipe.servings_unit}</span>
              </span>
            ) : recipe.servings ? (
              <span className="flex items-center gap-1">
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                {recipe.servings}
              </span>
            ) : null}
          </div>

          {/* Spacer to push tags to bottom */}
          <div className="flex-1" />

          {recipe.tags && recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {recipe.tags.slice(0, 3).map((tag) => (
                <button
                  key={tag}
                  className="tag text-xs hover:bg-[var(--color-purple)] hover:text-white transition-colors"
                  onClick={(e) => {
                    if (!selectionMode && onTagClick) {
                      e.preventDefault();
                      e.stopPropagation();
                      onTagClick(tag);
                    }
                  }}
                >
                  {tag}
                </button>
              ))}
              {recipe.tags.length > 3 && (
                <span className="tag text-xs">+{recipe.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </article>
  );

  // In selection mode, don't wrap in Link
  if (selectionMode) {
    return CardContent;
  }

  return (
    <Link href={`/recipes/${recipe.id}`} className="block h-full">
      {CardContent}
    </Link>
  );
}

