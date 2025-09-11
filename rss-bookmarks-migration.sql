-- RSS Bookmarks Migration for Supabase
-- This adds support for bookmarking RSS articles that aren't in the main articles table

-- Create RSS bookmarks table for storing bookmarks of RSS feed articles
CREATE TABLE IF NOT EXISTS public.rss_bookmarks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    rss_id TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT,
    content TEXT,
    source TEXT,
    network TEXT,
    category TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate bookmarks for same user and article
    UNIQUE(user_id, rss_id)
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_rss_bookmarks_user_id ON public.rss_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_rss_bookmarks_created_at ON public.rss_bookmarks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rss_bookmarks_rss_id ON public.rss_bookmarks(rss_id);

-- Enable Row Level Security
ALTER TABLE public.rss_bookmarks ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
-- Users can only see and manage their own bookmarks
CREATE POLICY "Users can view their own RSS bookmarks"
ON public.rss_bookmarks
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own RSS bookmarks"
ON public.rss_bookmarks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own RSS bookmarks"
ON public.rss_bookmarks
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own RSS bookmarks"
ON public.rss_bookmarks
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_rss_bookmarks_updated_at
    BEFORE UPDATE ON public.rss_bookmarks
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();