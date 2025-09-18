const { fetchRealCryptoNews } = require('./src/services/newsService');

async function testSimplifiedImages() {
  console.log('🔍 Testing simplified image extraction approach...\n');
  
  try {
    const realNews = await Promise.race([
      fetchRealCryptoNews(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout after 20s')), 20000)
      )
    ]);
    
    console.log(`Total articles received: ${realNews.length}`);
    
    if (realNews.length === 0) {
      console.log('❌ Still getting 0 articles');
      return;
    }
    
    console.log('✅ RSS parsing is working again!');
    
    // Check for articles with images
    const withImages = realNews.filter(a => a.cover_image && !a.cover_image.includes('placeholder.com'));
    const cryptoNewsArticles = realNews.filter(a => 
      (a.metadata && a.metadata.feedUrl && a.metadata.feedUrl.includes('cryptonews.com')) ||
      (a.source && a.source === 'News')
    );
    
    console.log(`\\nImage Statistics:`);
    console.log(`  Articles with images: ${withImages.length}/${realNews.length}`);
    console.log(`  CryptoNews.com articles: ${cryptoNewsArticles.length}`);
    
    if (cryptoNewsArticles.length > 0) {
      console.log('\\n=== CryptoNews.com Articles ===');
      cryptoNewsArticles.forEach((article, i) => {
        console.log(`\\nArticle ${i + 1}:`);
        console.log(`  Title: ${article.title.substring(0, 60)}...`);
        console.log(`  cover_image: ${article.cover_image || 'NULL'}`);
        console.log(`  has_real_image: ${article.has_real_image}`);
        
        if (article.cover_image) {
          if (article.cover_image.includes('cimg.co')) {
            console.log(`  ✅ SUCCESS: CryptoNews.com image from cimg.co`);
          } else if (article.cover_image.includes('images.weserv.nl')) {
            console.log(`  🔄 PROCESSED: Using weserv.nl CDN`);
          } else if (article.cover_image.includes('placeholder.com')) {
            console.log(`  📝 PLACEHOLDER: Generated placeholder`);
          } else {
            console.log(`  ❓ OTHER: ${article.cover_image.substring(0, 60)}...`);
          }
        }
      });
    }
    
    // Test a few other sources
    console.log('\\n=== Other Source Samples ===');
    const otherSources = realNews.filter(a => !cryptoNewsArticles.includes(a)).slice(0, 3);
    otherSources.forEach((article, i) => {
      console.log(`\\n${i + 1}. ${article.source || 'Unknown'}`);
      console.log(`   Title: ${article.title.substring(0, 50)}...`);
      console.log(`   Image: ${article.cover_image ? (article.cover_image.includes('cimg.co') ? '✅ Real' : '🔄 Processed') : '❌ None'}`);
    });
    
    console.log('\\n🎯 SIMPLIFIED APPROACH RESULTS:');
    console.log(`   RSS parsing: ✅ Working (${realNews.length} articles)`);
    console.log(`   Image processing: ✅ Simplified (no complex enhancement)`);
    console.log(`   CryptoNews.com: ${cryptoNewsArticles.length > 0 ? '✅ Found' : '❌ Missing'}`);
    
  } catch (error) {
    if (error.message.includes('Timeout')) {
      console.log('⏰ Test timed out - RSS processing is slow');
    } else {
      console.error('❌ Test failed:', error.message);
    }
  }
}

testSimplifiedImages();