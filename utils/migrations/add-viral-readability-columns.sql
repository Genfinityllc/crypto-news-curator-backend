-- Add viral and readability columns to articles table
-- This migration adds the columns needed for the enhanced-news functionality

ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS viral_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS readability_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_viral BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS engagement_potential TEXT DEFAULT 'low';

-- Create indexes for performance on the new columns
CREATE INDEX IF NOT EXISTS idx_articles_viral_score ON public.articles(viral_score);
CREATE INDEX IF NOT EXISTS idx_articles_readability_score ON public.articles(readability_score);
CREATE INDEX IF NOT EXISTS idx_articles_is_viral ON public.articles(is_viral);
CREATE INDEX IF NOT EXISTS idx_articles_engagement_potential ON public.articles(engagement_potential);

-- Success message
SELECT 'Viral and readability columns added successfully! 🎉' as message;