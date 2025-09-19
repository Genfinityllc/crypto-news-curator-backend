const { fetchRealCryptoNews } = require('./src/services/newsService');

async function quickTest() {
  console.log('🔍 Quick test for CryptoNews.com images...\n');
  
  try {
    const realNews = await Promise.race([
      fetchRealCryptoNews(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout after 10s')), 10000)
      )
    ]);
    
    console.log(`Total articles received: ${realNews.length}`);
    
    if (realNews.length === 0) {
      console.log('❌ Still getting 0 articles');
      return;
    }
    
    console.log('✅ RSS parsing is working!');
    
    // Focus specifically on CryptoNews.com
    const cryptoNewsArticles = realNews.filter(a => 
      (a.metadata && a.metadata.feedUrl && a.metadata.feedUrl.includes('cryptonews.com')) ||
      (a.source && a.source === 'News')
    );
    
    console.log(`\nCryptoNews.com articles found: ${cryptoNewsArticles.length}`);
    
    if (cryptoNewsArticles.length > 0) {
      console.log('\n=== CryptoNews.com Sample ===');
      const sample = cryptoNewsArticles[0];
      console.log(`Title: ${sample.title}`);
      console.log(`cover_image: ${sample.cover_image || 'NULL'}`);
      console.log(`has_real_image: ${sample.has_real_image}`);
      console.log(`card_images: ${sample.card_images ? 'YES' : 'NO'}`);
      
      if (sample.card_images) {
        console.log(`  small: ${sample.card_images.small}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

quickTest();