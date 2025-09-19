/**
 * Check total article count in database
 */

require('dotenv').config();
const { getSupabaseClient } = require('./src/config/supabase');

async function checkDatabaseCount() {
  try {
    console.log('🔍 Checking total articles in database...');
    
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('❌ Supabase client not available');
      return;
    }
    
    // Get total count
    const { count, error } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Database error:', error.message);
      return;
    }
    
    console.log(`\n📊 Total articles in database: ${count}`);
    
    if (count === 0) {
      console.log('❌ DATABASE IS EMPTY! This explains why your frontend shows no articles.');
      console.log('🔧 SOLUTION: Need to populate database with RSS articles');
    } else if (count < 50) {
      console.log('⚠️  DATABASE IS NEARLY EMPTY! This explains the low article count.');
      console.log('🔧 SOLUTION: Need to fetch more RSS articles');
    } else {
      console.log('✅ Database has sufficient articles');
    }
    
    // Check recent articles
    const { data: recentArticles, error: recentError } = await supabase
      .from('articles')
      .select('title, published_at, source, network')
      .order('published_at', { ascending: false })
      .limit(5);
    
    if (!recentError && recentArticles) {
      console.log('\n📰 Most recent articles:');
      recentArticles.forEach((article, index) => {
        console.log(`${index + 1}. "${article.title.substring(0, 60)}..." (${article.published_at})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
  }
}

if (require.main === module) {
  checkDatabaseCount();
}

module.exports = { checkDatabaseCount };