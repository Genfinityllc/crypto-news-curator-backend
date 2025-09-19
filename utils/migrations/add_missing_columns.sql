-- Add missing columns for AI rewrite functionality
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS viral_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS readability_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_original BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS seo_optimized BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS google_ads_ready BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rewritten_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS needs_rewrite BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS original_content TEXT,
ADD COLUMN IF NOT EXISTS card_images JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS engagement_potential TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS is_viral BOOLEAN DEFAULT FALSE;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_articles_viral_score ON public.articles(viral_score DESC);
CREATE INDEX IF NOT EXISTS idx_articles_readability_score ON public.articles(readability_score DESC);
CREATE INDEX IF NOT EXISTS idx_articles_needs_rewrite ON public.articles(needs_rewrite);

-- Update existing articles with default values
UPDATE public.articles 
SET 
    viral_score = FLOOR(RANDOM() * 50) + 25,  -- Random score between 25-75
    readability_score = FLOOR(RANDOM() * 20) + 80,  -- Random score between 80-100
    engagement_potential = CASE 
        WHEN RANDOM() < 0.3 THEN 'high'
        WHEN RANDOM() < 0.7 THEN 'medium'
        ELSE 'low'
    END,
    is_viral = CASE WHEN RANDOM() < 0.15 THEN true ELSE false END
WHERE viral_score IS NULL OR viral_score = 0;
