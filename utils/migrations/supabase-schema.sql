-- Crypto News Curator Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret-here';

-- Create custom types
CREATE TYPE article_category AS ENUM ('breaking', 'market', 'technology', 'regulation', 'analysis', 'general');
CREATE TYPE article_sentiment AS ENUM ('positive', 'negative', 'neutral');
CREATE TYPE article_impact AS ENUM ('high', 'medium', 'low');

-- Users table (extends auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{
        "notifications": {
            "email": true,
            "push": false,
            "categories": ["breaking", "market"]
        },
        "theme": "dark",
        "language": "en",
        "favorite_networks": []
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Articles table
CREATE TABLE public.articles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    url TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL,
    author TEXT,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    category article_category DEFAULT 'general',
    network TEXT,
    tags TEXT[] DEFAULT '{}',
    sentiment article_sentiment DEFAULT 'neutral',
    impact article_impact DEFAULT 'low',
    is_breaking BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    cover_image TEXT,
    ai_summary TEXT,
    ai_keywords TEXT[],
    viral_score INTEGER DEFAULT 0,
    readability_score INTEGER DEFAULT 0,
    is_viral BOOLEAN DEFAULT FALSE,
    engagement_potential TEXT DEFAULT 'low',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bookmarks table (many-to-many between users and articles)
CREATE TABLE public.bookmarks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, article_id)
);

-- User feeds/preferences table
CREATE TABLE public.user_feeds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    filters JSONB DEFAULT '{}', -- Contains network, category, keyword filters
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Article ratings table
CREATE TABLE public.article_ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, article_id)
);

-- Indexes for performance
CREATE INDEX idx_articles_published_at ON public.articles(published_at DESC);
CREATE INDEX idx_articles_category ON public.articles(category);
CREATE INDEX idx_articles_network ON public.articles(network);
CREATE INDEX idx_articles_is_breaking ON public.articles(is_breaking);
CREATE INDEX idx_articles_source ON public.articles(source);
CREATE INDEX idx_articles_tags ON public.articles USING GIN(tags);
CREATE INDEX idx_bookmarks_user_id ON public.bookmarks(user_id);
CREATE INDEX idx_bookmarks_article_id ON public.bookmarks(article_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_ratings ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Articles policies (public read, admin write)
CREATE POLICY "Articles are viewable by everyone" ON public.articles
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.articles
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users only" ON public.articles
    FOR UPDATE TO authenticated USING (true);

-- Bookmarks policies (users can only see/modify their own bookmarks)
CREATE POLICY "Users can view own bookmarks" ON public.bookmarks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmarks" ON public.bookmarks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks
    FOR DELETE USING (auth.uid() = user_id);

-- User feeds policies
CREATE POLICY "Users can view own feeds" ON public.user_feeds
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feeds" ON public.user_feeds
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feeds" ON public.user_feeds
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own feeds" ON public.user_feeds
    FOR DELETE USING (auth.uid() = user_id);

-- Article ratings policies
CREATE POLICY "Users can view all ratings" ON public.article_ratings
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own ratings" ON public.article_ratings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ratings" ON public.article_ratings
    FOR UPDATE USING (auth.uid() = user_id);

-- Functions

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, full_name, avatar_url)
    VALUES (
        new.id,
        new.raw_user_meta_data->>'username',
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'avatar_url'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_articles_updated_at
    BEFORE UPDATE ON public.articles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_feeds_updated_at
    BEFORE UPDATE ON public.user_feeds
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample data
INSERT INTO public.articles (
    title,
    content,
    summary,
    url,
    source,
    author,
    published_at,
    category,
    network,
    tags,
    is_breaking,
    ai_summary
) VALUES 
(
    'Bitcoin Reaches New All-Time High',
    'Bitcoin has surged to unprecedented levels today, breaking through the $50,000 barrier for the first time in months. This surge comes amid increased institutional adoption and positive regulatory news from major economies.',
    'Bitcoin breaks $50,000 amid institutional adoption and positive regulatory developments.',
    'https://example.com/bitcoin-ath-2025',
    'CryptoNews Pro',
    'Sarah Johnson',
    NOW() - INTERVAL '1 hour',
    'market',
    'Bitcoin',
    ARRAY['bitcoin', 'ath', 'institutional', 'adoption'],
    true,
    'AI Summary: Bitcoin reaches new highs driven by institutional investment and regulatory clarity, marking a significant milestone in cryptocurrency adoption.'
),
(
    'Ethereum 2.0 Staking Rewards Increase',
    'The Ethereum network has announced changes to its staking mechanism that will increase rewards for validators by an average of 15%. This change is part of the ongoing evolution of the Proof of Stake consensus mechanism.',
    'Ethereum increases staking rewards by 15% for validators in latest network update.',
    'https://example.com/ethereum-staking-2025',
    'BlockchainDaily',
    'Michael Chen',
    NOW() - INTERVAL '2 hours',
    'technology',
    'Ethereum',
    ARRAY['ethereum', 'staking', 'pos', 'rewards'],
    false,
    'AI Summary: Ethereum enhances validator incentives with 15% reward increase, strengthening network security and encouraging more participation in staking.'
);

-- Create a view for popular articles
CREATE VIEW public.popular_articles AS
SELECT 
    a.*,
    COALESCE(AVG(r.rating), 0) as avg_rating,
    COUNT(r.rating) as rating_count,
    COUNT(b.id) as bookmark_count
FROM public.articles a
LEFT JOIN public.article_ratings r ON a.id = r.article_id
LEFT JOIN public.bookmarks b ON a.id = b.article_id
GROUP BY a.id
ORDER BY 
    (a.view_count * 0.3 + COUNT(b.id) * 0.4 + COALESCE(AVG(r.rating), 0) * 0.3) DESC;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Success message
SELECT 'Database schema created successfully! 🎉' as message;2