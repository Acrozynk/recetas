# Recetas 🍳

A personal recipe management app with meal planning and shopping lists. Built as a CopyMeThat replacement.

## Features

- **Recipe Management**: Add, edit, and organize your recipes with tags
- **Import from CopyMeThat**: Upload your HTML export file to import all recipes
- **Import from URL**: Paste any recipe URL and auto-extract the recipe
- **Meal Planner**: Plan your meals for the week (breakfast, lunch, dinner, snack)
- **Shopping List**: Auto-generate shopping lists from your meal plan
- **PWA Support**: Install on your iPhone for app-like experience

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **PWA**: @ducanh2912/next-pwa
- **Hosting**: Vercel

## Setup

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/recetas.git
cd recetas
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migration:

```sql
-- Copy contents from supabase/migrations/001_initial_schema.sql
```

3. Get your project URL and anon key from Settings > API

### 3. Configure Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
APP_PASSWORD=your_secure_password
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

1. Push your code to GitHub (private repo)
2. Go to [vercel.com](https://vercel.com) and import your repo
3. Add the same environment variables in Vercel project settings
4. Deploy!

## Installing on iPhone

1. Open your deployed app URL in Safari
2. Tap the Share button
3. Tap "Add to Home Screen"
4. Name it and tap Add

The app will now appear on your home screen and work like a native app!

## Importing from CopyMeThat

1. In CopyMeThat, go to Settings > Export Recipes
2. Choose HTML format and download
3. In Recetas, go to Import > From File
4. Upload your HTML file
5. Select which recipes to import

## Project Structure

```
recetas/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── login/             # Login page
│   ├── planner/           # Meal planner
│   ├── recipes/           # Recipe pages
│   └── shopping/          # Shopping list
├── components/            # React components
├── lib/                   # Utilities and Supabase client
├── public/                # Static assets
│   └── icons/            # PWA icons
└── supabase/
    └── migrations/        # Database schema
```

## License

Personal use only.
