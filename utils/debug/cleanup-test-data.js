const { getSupabaseClient } = require('./src/config/supabase');

async function cleanupTestData() {
  try {
    console.log('🧹 Starting cleanup of test data...');
    
    const client = getSupabaseClient();
    if (!client) {
      console.error('❌ Database client not available');
      return;
    }

    // Delete articles with example URLs
    console.log('🗑️  Deleting articles with example URLs...');
    const { error: exampleError } = await client
      .from('articles')
      .delete()
      .like('url', '%example.com%');

    if (exampleError) {
      console.error('❌ Error deleting example articles:', exampleError.message);
    } else {
      console.log('✅ Deleted articles with example URLs');
    }

    // Delete articles with placeholder images
    console.log('🗑️  Deleting articles with placeholder images...');
    const { error: placeholderError } = await client
      .from('articles')
      .delete()
      .like('cover_image', '%via.placeholder%');

    if (placeholderError) {
      console.error('❌ Error deleting placeholder articles:', placeholderError.message);
    } else {
      console.log('✅ Deleted articles with placeholder images');
    }

    // Delete test articles from fake sources
    const testSources = ['DeFi Pulse', 'Enterprise Blockchain News', 'NFT News'];
    for (const source of testSources) {
      console.log(`🗑️  Deleting ${source} articles...`);
      const { error: sourceError } = await client
        .from('articles')
        .delete()
        .eq('source', source);
      
      if (sourceError) {
        console.error(`❌ Error deleting ${source} articles:`, sourceError.message);
      } else {
        console.log(`✅ Deleted ${source} test articles`);
      }
    }

    // Delete specific test articles by title
    const testTitles = [
      'Algorand Launches New DeFi Protocol for Enhanced Yield Farming',
      'Constellation Network\'s DAG Technology Gains Enterprise Adoption',
      'HashPack Wallet Integrates with Major NFT Marketplace',
      'Hedera (HBAR) Price Surges 15% as ETF Speculation Drives Institutional Interest',
      'XDC Network Partners with Major Financial Institution for Cross-Border Payments'
    ];
    
    for (const title of testTitles) {
      console.log(`🗑️  Deleting test article: "${title}"...`);
      const { error: titleError } = await client
        .from('articles')
        .delete()
        .eq('title', title);
      
      if (titleError) {
        console.error(`❌ Error deleting article "${title}":`, titleError.message);
      } else {
        console.log(`✅ Deleted article "${title}"`);
      }
    }

    // Delete non-crypto articles
    console.log('🗑️  Deleting non-crypto articles...');
    const nonCryptoTitles = [
      'Op-Ed: From Dreams to Nightmares',
      'investors-optimism-for-lower-rates-lifts-nasdaq',
      'Panther volleyball rolls past Rice in three-set sweep - UNI Athletics'
    ];
    
    for (const title of nonCryptoTitles) {
      const { error: titleError } = await client
        .from('articles')
        .delete()
        .ilike('title', `%${title}%`);
      
      if (titleError) {
        console.error(`❌ Error deleting article with title "${title}":`, titleError.message);
      } else {
        console.log(`✅ Deleted article with title "${title}"`);
      }
    }

    console.log('🎉 Cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  }
}

// Run cleanup if this script is executed directly
if (require.main === module) {
  cleanupTestData().then(() => {
    console.log('✅ Cleanup script finished');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Cleanup script failed:', error);
    process.exit(1);
  });
}

module.exports = cleanupTestData;
