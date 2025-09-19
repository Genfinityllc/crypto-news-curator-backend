/**
 * Test RSS filtering to check if WSJ articles are properly blocked
 */

require('dotenv').config();
const { fetchRealCryptoNews } = require('./src/services/newsService');

async function testRSSFiltering() {
  try {
    console.log('🧪 Testing RSS filtering...');
    
    const articles = await fetchRealCryptoNews();
    
    console.log(`\n📊 Total articles fetched: ${articles.length}`);
    
    // Check for WSJ articles
    const wsjArticles = articles.filter(article => 
      article.title.toLowerCase().includes('wall street journal') ||
      article.title.toLowerCase().includes('wsj') ||
      article.source.toLowerCase().includes('wall street journal') ||
      article.url.includes('wsj.com') ||
      article.title.toLowerCase().includes('investors\' optimism for lower rates')
    );
    
    if (wsjArticles.length > 0) {
      console.log(`\n❌ FOUND ${wsjArticles.length} WSJ ARTICLES (should be 0):`);
      wsjArticles.forEach(article => {
        console.log(`  - "${article.title}" (Network: ${article.network})`);
        console.log(`    Source: ${article.source}`);
        console.log(`    URL: ${article.url}`);
        console.log('');
      });
    } else {
      console.log('\n✅ No WSJ articles found (filtering working correctly)');
    }
    
    // Check for problematic "optimism" articles
    const optimismArticles = articles.filter(article => 
      article.title.toLowerCase().includes('optimism') &&
      !article.title.toLowerCase().includes('op network') &&
      !article.title.toLowerCase().includes('optimistic rollup')
    );
    
    if (optimismArticles.length > 0) {
      console.log(`\n⚠️  FOUND ${optimismArticles.length} POTENTIAL TRADITIONAL FINANCE "OPTIMISM" ARTICLES:`);
      optimismArticles.forEach(article => {
        console.log(`  - "${article.title}" (Network: ${article.network})`);
        console.log(`    Source: ${article.source}`);
        console.log(`    URL: ${article.url}`);
        console.log('');
      });
    } else {
      console.log('\n✅ No problematic optimism articles found');
    }
    
    // Check XDC Network articles specifically
    const xdcArticles = articles.filter(article => 
      article.network === 'XDC Network'
    );
    
    console.log(`\n🔍 XDC Network articles: ${xdcArticles.length}`);
    xdcArticles.forEach(article => {
      console.log(`  - "${article.title.substring(0, 80)}..."`);
      console.log(`    Source: ${article.source}`);
      console.log(`    URL: ${article.url.substring(0, 80)}...`);
      
      // Check if this is actually crypto-related
      const hasXDCKeywords = article.title.toLowerCase().includes('xdc') ||
                            article.title.toLowerCase().includes('xinfin') ||
                            article.content.toLowerCase().includes('xdc') ||
                            article.content.toLowerCase().includes('xinfin');
      
      if (!hasXDCKeywords) {
        console.log(`    ❌ PROBLEMATIC: No XDC keywords found in title/content`);
      } else {
        console.log(`    ✅ Valid: Contains XDC keywords`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error testing RSS filtering:', error.message);
  }
}

if (require.main === module) {
  testRSSFiltering();
}

module.exports = { testRSSFiltering };