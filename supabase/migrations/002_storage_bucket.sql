-- Create storage bucket for recipe images
-- Run this in your Supabase SQL Editor

-- Create the bucket (you may need to do this via Supabase Dashboard > Storage)
INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to view images
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'recipe-images');

-- Allow authenticated uploads (using anon key with RLS)
CREATE POLICY "Allow uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'recipe-images');

-- Allow updates
CREATE POLICY "Allow updates"
ON storage.objects FOR UPDATE
USING (bucket_id = 'recipe-images');

-- Allow deletions
CREATE POLICY "Allow deletions"
ON storage.objects FOR DELETE
USING (bucket_id = 'recipe-images');






















