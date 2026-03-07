import { NextResponse } from "next/server";
import { supabase, type Recipe, normalizeInstructions } from "@/lib/supabase";
import JSZip from "jszip";

export type ExportFormat = "json" | "csv" | "markdown" | "html" | "all";

interface ImageMapping {
  recipeId: string;
  originalUrl: string;
  localPath: string;
}

// GET export recipes in different formats
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "json") as ExportFormat;
    const recipeIds = searchParams.get("ids")?.split(",").filter(Boolean);
    const includeImages = searchParams.get("include_images") === "true";

    // Fetch recipes
    let query = supabase
      .from("recipes")
      .select("*")
      .order("title", { ascending: true });

    if (recipeIds && recipeIds.length > 0) {
      query = query.in("id", recipeIds);
    }

    const { data: recipes, error } = await query;

    if (error) throw error;

    if (!recipes || recipes.length === 0) {
      return NextResponse.json(
        { error: "No recipes found" },
        { status: 404 }
      );
    }

    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `recetas-backup-${timestamp}`;

    // "all" format always includes images and all formats
    if (format === "all") {
      return await exportAllFormats(recipes, filename);
    }

    if (includeImages) {
      return await exportWithImages(recipes, format, filename);
    }

    switch (format) {
      case "json":
        return new NextResponse(JSON.stringify(recipes, null, 2), {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="${filename}.json"`,
          },
        });

      case "csv":
        const csv = recipesToCSV(recipes);
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}.csv"`,
          },
        });

      case "markdown":
        const markdown = recipesToMarkdown(recipes);
        return new NextResponse(markdown, {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}.md"`,
          },
        });

      case "html":
        const html = recipesToPrintableHTML(recipes);
        return new NextResponse(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}.html"`,
          },
        });

      default:
        return NextResponse.json(
          { error: "Invalid format. Use: json, csv, markdown, html, or all" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error exporting recipes:", error);
    return NextResponse.json(
      { error: "Failed to export recipes" },
      { status: 500 }
    );
  }
}

async function exportWithImages(
  recipes: Recipe[],
  format: ExportFormat,
  filename: string
): Promise<NextResponse> {
  const zip = new JSZip();
  const imagesFolder = zip.folder("images");
  const imageMappings: ImageMapping[] = [];

  // Download and add images to ZIP
  for (const recipe of recipes) {
    if (recipe.image_url) {
      try {
        const response = await fetch(recipe.image_url);
        if (response.ok) {
          const imageBuffer = await response.arrayBuffer();
          const extension = getImageExtension(recipe.image_url, response.headers.get("content-type"));
          const imageFilename = `${slugify(recipe.title)}-${recipe.id.slice(0, 8)}${extension}`;
          
          imagesFolder?.file(imageFilename, imageBuffer);
          imageMappings.push({
            recipeId: recipe.id,
            originalUrl: recipe.image_url,
            localPath: `images/${imageFilename}`,
          });
        }
      } catch (err) {
        console.warn(`Failed to download image for recipe ${recipe.title}:`, err);
      }
    }
  }

  // Create recipes with local image paths for the export
  const recipesWithLocalImages = recipes.map((recipe) => {
    const mapping = imageMappings.find((m) => m.recipeId === recipe.id);
    return {
      ...recipe,
      image_url: mapping?.localPath || recipe.image_url,
      original_image_url: recipe.image_url,
    };
  });

  // Generate export content based on format
  let exportContent: string;
  let exportFilename: string;

  switch (format) {
    case "json":
      exportContent = JSON.stringify(recipesWithLocalImages, null, 2);
      exportFilename = `${filename}.json`;
      break;
    case "csv":
      exportContent = recipesToCSV(recipes, imageMappings);
      exportFilename = `${filename}.csv`;
      break;
    case "markdown":
      exportContent = recipesToMarkdown(recipes, imageMappings);
      exportFilename = `${filename}.md`;
      break;
    case "html":
      exportContent = recipesToPrintableHTML(recipes, imageMappings);
      exportFilename = `${filename}.html`;
      break;
    default:
      throw new Error("Invalid format");
  }

  zip.file(exportFilename, exportContent);

  // Generate ZIP
  const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}.zip"`,
    },
  });
}

async function exportAllFormats(
  recipes: Recipe[],
  filename: string
): Promise<NextResponse> {
  const zip = new JSZip();
  const imagesFolder = zip.folder("images");
  const imageMappings: ImageMapping[] = [];

  // Download and add images to ZIP
  for (const recipe of recipes) {
    if (recipe.image_url) {
      try {
        const response = await fetch(recipe.image_url);
        if (response.ok) {
          const imageBuffer = await response.arrayBuffer();
          const extension = getImageExtension(recipe.image_url, response.headers.get("content-type"));
          const imageFilename = `${slugify(recipe.title)}-${recipe.id.slice(0, 8)}${extension}`;
          
          imagesFolder?.file(imageFilename, imageBuffer);
          imageMappings.push({
            recipeId: recipe.id,
            originalUrl: recipe.image_url,
            localPath: `images/${imageFilename}`,
          });
        }
      } catch (err) {
        console.warn(`Failed to download image for recipe ${recipe.title}:`, err);
      }
    }
  }

  // Create recipes with local image paths for JSON export
  const recipesWithLocalImages = recipes.map((recipe) => {
    const mapping = imageMappings.find((m) => m.recipeId === recipe.id);
    return {
      ...recipe,
      image_url: mapping?.localPath || recipe.image_url,
      original_image_url: recipe.image_url,
    };
  });

  // Add all 4 formats to the ZIP
  zip.file(`${filename}.json`, JSON.stringify(recipesWithLocalImages, null, 2));
  zip.file(`${filename}.csv`, recipesToCSV(recipes, imageMappings));
  zip.file(`${filename}.md`, recipesToMarkdown(recipes, imageMappings));
  zip.file(`${filename}.html`, recipesToPrintableHTML(recipes, imageMappings));

  // Generate ZIP
  const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}-completo.zip"`,
    },
  });
}

function getImageExtension(url: string, contentType: string | null): string {
  if (contentType) {
    if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
    if (contentType.includes("png")) return ".png";
    if (contentType.includes("gif")) return ".gif";
    if (contentType.includes("webp")) return ".webp";
  }
  
  const urlLower = url.toLowerCase();
  if (urlLower.includes(".jpg") || urlLower.includes(".jpeg")) return ".jpg";
  if (urlLower.includes(".png")) return ".png";
  if (urlLower.includes(".gif")) return ".gif";
  if (urlLower.includes(".webp")) return ".webp";
  
  return ".jpg";
}

function recipesToCSV(recipes: Recipe[], imageMappings?: ImageMapping[]): string {
  const headers = [
    "Título",
    "Descripción",
    "Porciones",
    "Tiempo Preparación (min)",
    "Tiempo Cocción (min)",
    "Etiquetas",
    "Ingredientes",
    "Instrucciones",
    "Notas",
    "Valoración",
    "Lo he hecho",
    "URL Fuente",
    "Imagen",
    "Fecha Creación",
  ];

  const escapeCSV = (value: string | null | undefined): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = recipes.map((recipe) => {
    const ingredients = recipe.ingredients
      ?.map((ing) => `${ing.amount} ${ing.unit} ${ing.name}`.trim())
      .join("; ") || "";

    const instructions = normalizeInstructions(recipe.instructions)
      .map((inst, i) => `${i + 1}. ${inst.text}`)
      .join("; ");

    const imageMapping = imageMappings?.find((m) => m.recipeId === recipe.id);
    const imagePath = imageMapping?.localPath || recipe.image_url || "";

    return [
      escapeCSV(recipe.title),
      escapeCSV(recipe.description),
      recipe.servings || "",
      recipe.prep_time_minutes || "",
      recipe.cook_time_minutes || "",
      escapeCSV(recipe.tags?.join(", ")),
      escapeCSV(ingredients),
      escapeCSV(instructions),
      escapeCSV(recipe.notes),
      recipe.rating || "",
      recipe.made_it ? "Sí" : "No",
      escapeCSV(recipe.source_url),
      escapeCSV(imagePath),
      recipe.created_at?.split("T")[0] || "",
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

function recipesToMarkdown(recipes: Recipe[], imageMappings?: ImageMapping[]): string {
  const timestamp = new Date().toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let md = `# 📖 Mis Recetas\n\n`;
  md += `*Exportado el ${timestamp}*\n\n`;
  md += `---\n\n`;
  md += `## Índice\n\n`;

  recipes.forEach((recipe, i) => {
    md += `${i + 1}. [${recipe.title}](#${slugify(recipe.title)})\n`;
  });

  md += `\n---\n\n`;

  recipes.forEach((recipe) => {
    md += `## ${recipe.title} {#${slugify(recipe.title)}}\n\n`;

    // Image
    const imageMapping = imageMappings?.find((m) => m.recipeId === recipe.id);
    const imagePath = imageMapping?.localPath || recipe.image_url;
    if (imagePath) {
      md += `![${recipe.title}](${imagePath})\n\n`;
    }

    if (recipe.description) {
      md += `*${recipe.description}*\n\n`;
    }

    // Metadata
    const meta: string[] = [];
    if (recipe.servings) meta.push(`🍽️ ${recipe.servings} porciones`);
    if (recipe.prep_time_minutes) meta.push(`⏱️ Prep: ${recipe.prep_time_minutes} min`);
    if (recipe.cook_time_minutes) meta.push(`🔥 Cocción: ${recipe.cook_time_minutes} min`);
    if (recipe.rating) meta.push(`⭐ ${recipe.rating}/3`);
    if (recipe.made_it) meta.push(`✅ Lo he hecho`);

    if (meta.length > 0) {
      md += `${meta.join(" | ")}\n\n`;
    }

    if (recipe.tags && recipe.tags.length > 0) {
      md += `**Etiquetas:** ${recipe.tags.join(", ")}\n\n`;
    }

    // Ingredients
    if (recipe.ingredients && recipe.ingredients.length > 0) {
      md += `### Ingredientes\n\n`;
      recipe.ingredients.forEach((ing) => {
        const amount = `${ing.amount} ${ing.unit}`.trim();
        md += `- ${amount ? amount + " " : ""}${ing.name}\n`;
      });
      md += `\n`;
    }

    // Instructions
    const instructions = normalizeInstructions(recipe.instructions);
    if (instructions.length > 0) {
      md += `### Instrucciones\n\n`;
      instructions.forEach((inst, i) => {
        md += `${i + 1}. ${inst.text}\n`;
      });
      md += `\n`;
    }

    // Notes
    if (recipe.notes) {
      md += `### Notas\n\n${recipe.notes}\n\n`;
    }

    if (recipe.source_url) {
      md += `📎 [Fuente original](${recipe.source_url})\n\n`;
    }

    md += `---\n\n`;
  });

  return md;
}

function recipesToPrintableHTML(recipes: Recipe[], imageMappings?: ImageMapping[]): string {
  const timestamp = new Date().toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mis Recetas - Exportado ${timestamp}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Source+Sans+3:wght@400;600&display=swap');
    
    :root {
      --orange: #F97316;
      --orange-dark: #EA580C;
      --orange-light: #FFF7ED;
      --text: #451A03;
      --text-light: #64748B;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Source Sans 3', system-ui, sans-serif;
      color: var(--text);
      line-height: 1.6;
      background: #fff;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    h1, h2, h3 {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-weight: 600;
    }
    
    .header {
      text-align: center;
      margin-bottom: 3rem;
      padding-bottom: 2rem;
      border-bottom: 3px solid var(--orange);
    }
    
    .header h1 {
      font-size: 2.5rem;
      color: var(--orange-dark);
      margin-bottom: 0.5rem;
    }
    
    .header p {
      color: var(--text-light);
    }
    
    .toc {
      background: var(--orange-light);
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 3rem;
    }
    
    .toc h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      color: var(--orange-dark);
    }
    
    .toc ol {
      columns: 2;
      column-gap: 2rem;
    }
    
    .toc li {
      margin-bottom: 0.25rem;
    }
    
    .toc a {
      color: var(--text);
      text-decoration: none;
    }
    
    .toc a:hover {
      color: var(--orange);
    }
    
    .recipe {
      page-break-inside: avoid;
      margin-bottom: 3rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid #eee;
    }
    
    .recipe h2 {
      font-size: 1.75rem;
      color: var(--orange-dark);
      margin-bottom: 0.5rem;
    }
    
    .recipe-image {
      width: 100%;
      max-height: 300px;
      object-fit: cover;
      border-radius: 8px;
      margin-bottom: 1rem;
    }
    
    .recipe-description {
      font-style: italic;
      color: var(--text-light);
      margin-bottom: 1rem;
    }
    
    .recipe-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 1rem;
      font-size: 0.9rem;
      color: var(--text-light);
    }
    
    .recipe-meta span {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }
    
    .tag {
      background: var(--orange-light);
      color: var(--orange-dark);
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.85rem;
    }
    
    .recipe h3 {
      font-size: 1.25rem;
      color: var(--text);
      margin: 1.5rem 0 0.75rem;
      border-bottom: 2px solid var(--orange-light);
      padding-bottom: 0.25rem;
    }
    
    .ingredients {
      list-style: none;
    }
    
    .ingredients li {
      padding: 0.5rem 0;
      border-bottom: 1px dotted #ddd;
    }
    
    .ingredients li:last-child {
      border-bottom: none;
    }
    
    .instructions {
      list-style: none;
      counter-reset: step;
    }
    
    .instructions li {
      position: relative;
      padding: 0.75rem 0 0.75rem 3rem;
      border-bottom: 1px solid #f0f0f0;
      counter-increment: step;
    }
    
    .instructions li::before {
      content: counter(step);
      position: absolute;
      left: 0;
      top: 0.75rem;
      width: 2rem;
      height: 2rem;
      background: var(--orange);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.9rem;
    }
    
    .notes {
      background: var(--orange-light);
      padding: 1rem;
      border-radius: 8px;
      margin-top: 1rem;
      border-left: 4px solid var(--orange);
    }
    
    .source {
      margin-top: 1rem;
      font-size: 0.85rem;
      color: var(--text-light);
    }
    
    .source a {
      color: var(--orange);
    }
    
    @media print {
      body { padding: 0; }
      .toc { page-break-after: always; }
      .recipe { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📖 Mis Recetas</h1>
    <p>Exportado el ${timestamp}</p>
  </div>

  <nav class="toc">
    <h2>Índice</h2>
    <ol>
      ${recipes.map((r) => `<li><a href="#${slugify(r.title)}">${escapeHTML(r.title)}</a></li>`).join("\n      ")}
    </ol>
  </nav>

  ${recipes.map((recipe) => recipeToHTML(recipe, imageMappings)).join("\n\n")}

</body>
</html>`;

  return html;
}

function recipeToHTML(recipe: Recipe, imageMappings?: ImageMapping[]): string {
  let html = `<article class="recipe" id="${slugify(recipe.title)}">
    <h2>${escapeHTML(recipe.title)}</h2>`;

  // Image
  const imageMapping = imageMappings?.find((m) => m.recipeId === recipe.id);
  const imagePath = imageMapping?.localPath || recipe.image_url;
  if (imagePath) {
    html += `\n    <img class="recipe-image" src="${escapeHTML(imagePath)}" alt="${escapeHTML(recipe.title)}">`;
  }

  if (recipe.description) {
    html += `\n    <p class="recipe-description">${escapeHTML(recipe.description)}</p>`;
  }

  const meta: string[] = [];
  if (recipe.servings) meta.push(`<span>🍽️ ${recipe.servings} porciones</span>`);
  if (recipe.prep_time_minutes) meta.push(`<span>⏱️ Prep: ${recipe.prep_time_minutes} min</span>`);
  if (recipe.cook_time_minutes) meta.push(`<span>🔥 Cocción: ${recipe.cook_time_minutes} min</span>`);
  if (recipe.rating) meta.push(`<span>⭐ ${recipe.rating}/3</span>`);
  if (recipe.made_it) meta.push(`<span>✅ Lo he hecho</span>`);

  if (meta.length > 0) {
    html += `\n    <div class="recipe-meta">${meta.join("")}</div>`;
  }

  if (recipe.tags && recipe.tags.length > 0) {
    html += `\n    <div class="tags">${recipe.tags.map((t) => `<span class="tag">${escapeHTML(t)}</span>`).join("")}</div>`;
  }

  if (recipe.ingredients && recipe.ingredients.length > 0) {
    html += `\n    <h3>Ingredientes</h3>\n    <ul class="ingredients">`;
    recipe.ingredients.forEach((ing) => {
      const amount = `${ing.amount} ${ing.unit}`.trim();
      html += `\n      <li>${amount ? `<strong>${escapeHTML(amount)}</strong> ` : ""}${escapeHTML(ing.name)}</li>`;
    });
    html += `\n    </ul>`;
  }

  const instructions = normalizeInstructions(recipe.instructions);
  if (instructions.length > 0) {
    html += `\n    <h3>Instrucciones</h3>\n    <ol class="instructions">`;
    instructions.forEach((inst) => {
      html += `\n      <li>${escapeHTML(inst.text)}</li>`;
    });
    html += `\n    </ol>`;
  }

  if (recipe.notes) {
    html += `\n    <div class="notes"><strong>Notas:</strong> ${escapeHTML(recipe.notes)}</div>`;
  }

  if (recipe.source_url) {
    html += `\n    <p class="source">📎 <a href="${escapeHTML(recipe.source_url)}" target="_blank">Fuente original</a></p>`;
  }

  html += `\n  </article>`;
  return html;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function escapeHTML(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}






























