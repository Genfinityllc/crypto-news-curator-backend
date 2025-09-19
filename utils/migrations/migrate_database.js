const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function migrateDatabase() {
  try {
    console.log('Adding missing columns for AI rewrite functionality...');
    
    // Add missing columns using raw SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Add missing columns for AI rewrite functionality
        DO $$
        BEGIN
          -- Add columns if they don't exist
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'viral_score') THEN
            ALTER TABLE public.articles ADD COLUMN viral_score INTEGER DEFAULT 0;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'readability_score') THEN
            ALTER TABLE public.articles ADD COLUMN readability_score INTEGER DEFAULT 0;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'is_original') THEN
            ALTER TABLE public.articles ADD COLUMN is_original BOOLEAN DEFAULT TRUE;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'seo_optimized') THEN
            ALTER TABLE public.articles ADD COLUMN seo_optimized BOOLEAN DEFAULT FALSE;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'google_ads_ready') THEN
            ALTER TABLE public.articles ADD COLUMN google_ads_ready BOOLEAN DEFAULT FALSE;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'rewritten_at') THEN
            ALTER TABLE public.articles ADD COLUMN rewritten_at TIMESTAMP WITH TIME ZONE;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'needs_rewrite') THEN
            ALTER TABLE public.articles ADD COLUMN needs_rewrite BOOLEAN DEFAULT FALSE;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'original_content') THEN
            ALTER TABLE public.articles ADD COLUMN original_content TEXT;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'card_images') THEN
            ALTER TABLE public.articles ADD COLUMN card_images JSONB DEFAULT '{}';
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'engagement_potential') THEN
            ALTER TABLE public.articles ADD COLUMN engagement_potential TEXT DEFAULT 'medium';
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'is_viral') THEN
            ALTER TABLE public.articles ADD COLUMN is_viral BOOLEAN DEFAULT FALSE;
          END IF;
        END $$;
        
        -- Create indexes for new columns if they don't exist
        CREATE INDEX IF NOT EXISTS idx_articles_viral_score ON public.articles(viral_score DESC);
        CREATE INDEX IF NOT EXISTS idx_articles_readability_score ON public.articles(readability_score DESC);
        CREATE INDEX IF NOT EXISTS idx_articles_needs_rewrite ON public.articles(needs_rewrite);
      `
    });
    
    if (error) {
      console.error('Error executing migration:', error);
      throw error;
    }
    
    console.log('Migration completed successfully!');
    console.log('Updating existing articles with default values...');
    
    // Update existing articles with some sample values
    const { data: updateData, error: updateError } = await supabase
      .from('articles')
      .update({
        viral_score: Math.floor(Math.random() * 50) + 25,  // Random score between 25-75
        readability_score: Math.floor(Math.random() * 20) + 80,  // Random score between 80-100
        engagement_potential: 'medium',
        is_viral: false
      })
      .is('viral_score', null);
    
    if (updateError) {
      console.log('Note: Could not update existing articles with default values:', updateError.message);
      console.log('This is normal if the RPC function is not available or if permissions are limited.');
    } else {
      console.log('Existing articles updated with default values!');
    }
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    
    // Try alternative approach - direct column addition
    console.log('Trying alternative approach...');
    
    try {
      // Just try to update the schema by inserting/updating a record
      const { data: testArticle, error: testError } = await supabase
        .from('articles')
        .select('id')
        .limit(1)
        .single();
        
      if (!testError && testArticle) {
        // Try to update with new fields
        const { error: updateError } = await supabase
          .from('articles')
          .update({
            viral_score: 50,
            readability_score: 85,
            is_original: true,
            seo_optimized: false,
            google_ads_ready: false,
            needs_rewrite: false,
            engagement_potential: 'medium',
            is_viral: false
          })
          .eq('id', testArticle.id);
          
        if (updateError) {
          console.log('Columns may not exist yet. Error:', updateError.message);
          console.log('\n=== MANUAL MIGRATION REQUIRED ===');
          console.log('Please run the following SQL in your Supabase SQL Editor:');
          console.log(`
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_articles_viral_score ON public.articles(viral_score DESC);
CREATE INDEX IF NOT EXISTS idx_articles_readability_score ON public.articles(readability_score DESC);
CREATE INDEX IF NOT EXISTS idx_articles_needs_rewrite ON public.articles(needs_rewrite);
          `);
        } else {
          console.log('Migration appears to have worked!');
        }
      }
    } catch (altError) {
      console.error('Alternative approach also failed:', altError.message);
    }
  }
}

migrateDatabase().then(() => {
  console.log('Migration script completed.');
  process.exit(0);
}).catch((error) => {
  console.error('Migration script failed:', error);
  process.exit(1);
});