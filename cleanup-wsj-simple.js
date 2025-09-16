/**
 * Simple WSJ cleanup script
 */

const { getSupabaseClient } = require('./src/config/supabase');

async function cleanupWSJ() {
  try {
    console.log('🧹 Starting WSJ cleanup...');
    
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('❌ Supabase client not available');
      return;
    }
    
    // Remove WSJ articles
    const { data: removed, error } = await supabase
      .from('crypto_news')
      .delete()
      .or(`title.ilike.%Wall Street Journal%,title.ilike.%WSJ%,url.ilike.%wsj.com%,source.ilike.%Wall Street Journal%,title.ilike.%Investors' Optimism for Lower Rates%`)
      .select('id, title, source');
    
    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }
    
    const count = removed?.length || 0;
    console.log(`✅ Removed ${count} WSJ articles`);
    
    if (count > 0) {
      removed.forEach(article => {
        console.log(`   - "${article.title.substring(0, 60)}..."`);
      });
    }
    
    // Get current article count
    const { count: totalCount } = await supabase
      .from('crypto_news')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Total articles remaining: ${totalCount}`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  }
}

if (require.main === module) {
  cleanupWSJ();
}

module.exports = { cleanupWSJ };