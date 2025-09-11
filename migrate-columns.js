const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function migrateColumns() {
  try {
    console.log('Adding viral and readability columns to articles table...');
    
    // First, let's check if the columns already exist by trying to query them
    console.log('Checking existing columns...');
    const { data: existingData, error: checkError } = await supabase
      .from('articles')
      .select('id, viral_score')
      .limit(1);
    
    if (!checkError) {
      console.log('✅ Columns already exist! Migration not needed.');
      return;
    }
    
    console.log('Columns don\'t exist, need to add them via SQL Editor.');
    console.log('Please run the following SQL in your Supabase SQL Editor:');
    console.log('');
    console.log('ALTER TABLE public.articles');
    console.log('ADD COLUMN IF NOT EXISTS viral_score INTEGER DEFAULT 0,');
    console.log('ADD COLUMN IF NOT EXISTS readability_score INTEGER DEFAULT 0,');
    console.log('ADD COLUMN IF NOT EXISTS is_viral BOOLEAN DEFAULT FALSE,');
    console.log('ADD COLUMN IF NOT EXISTS engagement_potential TEXT DEFAULT \'low\';');
    console.log('');
    console.log('CREATE INDEX IF NOT EXISTS idx_articles_viral_score ON public.articles(viral_score);');
    console.log('CREATE INDEX IF NOT EXISTS idx_articles_readability_score ON public.articles(readability_score);');
    console.log('CREATE INDEX IF NOT EXISTS idx_articles_is_viral ON public.articles(is_viral);');
    console.log('CREATE INDEX IF NOT EXISTS idx_articles_engagement_potential ON public.articles(engagement_potential);');
    console.log('');
    console.log('Go to https://supabase.com/dashboard/project/daqxnvcfmepjzcgfdrdf/sql/new and run the above SQL.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

migrateColumns();