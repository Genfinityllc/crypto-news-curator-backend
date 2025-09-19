/**
 * Debug the getArticles function to see what's happening
 */

require('dotenv').config();
const { getArticles } = require('./src/config/supabase');

async function debugGetArticles() {
  try {
    console.log('🔍 Testing getArticles function...');
    
    // Test the exact same parameters as fast-news route
    const result = await getArticles({ 
      page: 1, 
      limit: 1000,
      network: null, // For 'all' networks
      category: null, // For 'all' categories
      isBreaking: undefined
    });
    
    console.log(`\n📊 getArticles result:`);
    console.log(`- Articles returned: ${result.data?.length || 0}`);
    console.log(`- Total count: ${result.count || 0}`);
    
    if (result.data && result.data.length > 0) {
      console.log('\n📰 First few articles:');
      result.data.slice(0, 5).forEach((article, index) => {
        console.log(`${index + 1}. "${article.title.substring(0, 60)}..." (${article.published_at})`);
        console.log(`    Network: ${article.network || 'null'}`);
        console.log(`    Source: ${article.source}`);
      });
    } else {
      console.log('❌ No articles returned by getArticles function!');
      console.log('This explains why your frontend only sees 3 articles.');
    }
    
  } catch (error) {
    console.error('❌ Error testing getArticles:', error.message);
  }
}

if (require.main === module) {
  debugGetArticles();
}

module.exports = { debugGetArticles };