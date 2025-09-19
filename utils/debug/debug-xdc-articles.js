/**
 * Debug script to check XDC Network articles in database
 */

require('dotenv').config();
const { getSupabaseClient } = require('./src/config/supabase');

async function debugXDCArticles() {
  try {
    console.log('🔍 Debugging XDC Network articles in database...');
    
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('❌ Supabase client not available');
      return;
    }
    
    // Get all XDC Network articles
    const { data: xdcArticles, error } = await supabase
      .from('articles')
      .select('*')
      .eq('network', 'XDC Network')
      .order('published_at', { ascending: false });
    
    if (error) {
      console.error('❌ Database error:', error.message);
      return;
    }
    
    console.log(`\n📊 Found ${xdcArticles.length} articles in XDC Network`);
    
    if (xdcArticles.length === 0) {
      console.log('✅ No XDC Network articles found in database');
      return;
    }
    
    // Check each article for problematic content
    xdcArticles.forEach((article, index) => {
      console.log(`\n--- Article ${index + 1} ---`);
      console.log(`Title: "${article.title}"`);
      console.log(`Source: ${article.source}`);
      console.log(`URL: ${article.url}`);
      console.log(`Published: ${article.published_at}`);
      console.log(`ID: ${article.id}`);
      
      // Check for problematic patterns
      const title = article.title.toLowerCase();
      const content = (article.content || '').toLowerCase();
      const source = (article.source || '').toLowerCase();
      
      const hasWSJIndicators = title.includes('wall street journal') ||
                              title.includes('wsj') ||
                              source.includes('wall street journal') ||
                              source.includes('wsj') ||
                              article.url.includes('wsj.com');
      
      const hasTraditionalFinance = title.includes('investor') ||
                                   title.includes('nasdaq') ||
                                   title.includes('stock market') ||
                                   title.includes('fed rate') ||
                                   title.includes('interest rate');
      
      const hasXDCKeywords = title.includes('xdc') ||
                            title.includes('xinfin') ||
                            content.includes('xdc') ||
                            content.includes('xinfin');
      
      if (hasWSJIndicators) {
        console.log(`❌ PROBLEMATIC: Contains WSJ indicators`);
      }
      
      if (hasTraditionalFinance) {
        console.log(`⚠️  SUSPICIOUS: Contains traditional finance terms`);
      }
      
      if (!hasXDCKeywords) {
        console.log(`❌ PROBLEMATIC: No XDC keywords found`);
      }
      
      if (hasWSJIndicators || (hasTraditionalFinance && !hasXDCKeywords)) {
        console.log(`🔥 SHOULD BE REMOVED`);
      } else {
        console.log(`✅ Looks legitimate`);
      }
    });
    
    // Check specifically for the "optimism" article
    const optimismArticles = xdcArticles.filter(article => 
      article.title.toLowerCase().includes('optimism') &&
      article.title.toLowerCase().includes('nasdaq')
    );
    
    if (optimismArticles.length > 0) {
      console.log(`\n🎯 FOUND SPECIFIC "OPTIMISM + NASDAQ" ARTICLES: ${optimismArticles.length}`);
      optimismArticles.forEach(article => {
        console.log(`  - ID: ${article.id}`);
        console.log(`  - Title: "${article.title}"`);
        console.log(`  - Source: ${article.source}`);
        console.log(`  - URL: ${article.url}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error debugging XDC articles:', error.message);
  }
}

if (require.main === module) {
  debugXDCArticles();
}

module.exports = { debugXDCArticles };