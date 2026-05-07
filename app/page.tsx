import { redirect } from "next/navigation";

// The Menús (planner) tab is the default landing page.
// The recipe list now lives at /recipes.
export default function HomePage() {
  redirect("/planner");
}
