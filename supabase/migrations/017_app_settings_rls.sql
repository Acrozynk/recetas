-- Enable Row Level Security for app_settings table
-- This resolves the Supabase Security Advisor warning

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations (since we use app-level auth)
CREATE POLICY "Allow all for app_settings" ON app_settings 
  FOR ALL USING (true) WITH CHECK (true);

