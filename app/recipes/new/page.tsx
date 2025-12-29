import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import RecipeForm from "@/components/RecipeForm";

export default function NewRecipePage() {
  return (
    <div className="min-h-screen pb-20">
      <Header title="Nueva Receta" showBack />

      <main className="max-w-7xl mx-auto p-4 lg:px-8">
        <RecipeForm mode="create" />
      </main>

      <BottomNav />
    </div>
  );
}

