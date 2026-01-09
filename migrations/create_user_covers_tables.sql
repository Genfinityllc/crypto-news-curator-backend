-- Run this SQL in your Supabase SQL Editor to create the required tables
-- for saving user-generated covers and ratings

-- Table for storing user-generated covers
CREATE TABLE IF NOT EXISTS user_generated_covers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  network TEXT,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries by user
CREATE INDEX IF NOT EXISTS idx_user_generated_covers_user_id 
ON user_generated_covers(user_id);

-- Index for ordering by creation date
CREATE INDEX IF NOT EXISTS idx_user_generated_covers_created_at 
ON user_generated_covers(created_at DESC);

-- Table for storing cover ratings (for prompt refinement)
CREATE TABLE IF NOT EXISTS cover_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT,
  network TEXT,
  prompt_used TEXT,
  logo_rating TEXT,
  logo_size TEXT,
  logo_style TEXT,
  background_rating TEXT,
  background_style TEXT,
  feedback_keyword TEXT,
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for analyzing ratings by network
CREATE INDEX IF NOT EXISTS idx_cover_ratings_network 
ON cover_ratings(network);

-- Index for time-based analysis
CREATE INDEX IF NOT EXISTS idx_cover_ratings_created_at 
ON cover_ratings(created_at DESC);

-- Enable Row Level Security (optional but recommended)
-- ALTER TABLE user_generated_covers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cover_ratings ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to see their own covers (if RLS is enabled)
-- CREATE POLICY "Users can view own covers" ON user_generated_covers
--   FOR SELECT USING (true);
-- CREATE POLICY "Users can insert own covers" ON user_generated_covers
--   FOR INSERT WITH CHECK (true);

-- Grant access to the service role
-- GRANT ALL ON user_generated_covers TO service_role;
-- GRANT ALL ON cover_ratings TO service_role;

