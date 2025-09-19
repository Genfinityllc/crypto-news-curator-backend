const { getSupabaseClient } = require('./src/config/supabase');

async function nuclearCleanup() {
  try {
    console.log('🧨 Starting NUCLEAR cleanup - deleting ALL articles...');
    
    const client = getSupabaseClient();
    if (!client) {
      console.error('❌ Database client not available');
      return;
    }

    // Delete ALL articles
    console.log('🗑️  Deleting ALL articles from database...');
    const { error: deleteError } = await client
      .from('articles')
      .delete()
      .neq('id', 0); // Delete all rows

    if (deleteError) {
      console.error('❌ Error deleting all articles:', deleteError.message);
    } else {
      console.log('✅ Deleted ALL articles from database');
    }

    // Verify deletion
    const { data: remainingArticles, error: countError } = await client
      .from('articles')
      .select('id, title')
      .limit(10);

    if (countError) {
      console.error('❌ Error counting remaining articles:', countError.message);
    } else {
      console.log(`📊 Remaining articles in database: ${remainingArticles.length}`);
      if (remainingArticles.length > 0) {
        console.log('Remaining articles:');
        remainingArticles.forEach(article => {
          console.log(`  - ${article.title}`);
        });
      }
    }

    console.log('🎉 Nuclear cleanup completed!');
    
  } catch (error) {
    console.error('❌ Error during nuclear cleanup:', error.message);
  }
}

// Run cleanup if this script is executed directly
if (require.main === module) {
  nuclearCleanup().then(() => {
    console.log('✅ Nuclear cleanup script finished');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Nuclear cleanup script failed:', error);
    process.exit(1);
  });
}

module.exports = nuclearCleanup;

