#!/usr/bin/env node

const axios = require('axios');

async function populateDatabase() {
  console.log('🚀 Populating database with real news articles...\n');

  try {
    // Call the populate endpoint
    const response = await axios.post('http://localhost:3000/api/news/populate-database', {}, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    console.log('✅ Database populated successfully!');
    console.log(`📊 Total articles fetched: ${response.data.data.totalFetched}`);
    console.log(`💾 Articles inserted: ${response.data.data.inserted}`);
    console.log(`📝 Message: ${response.data.message}`);

    // Test that articles are now available
    console.log('\n🧪 Testing article retrieval...');
    const articlesResponse = await axios.get('http://localhost:3000/api/news?limit=5');
    console.log(`📰 Articles now available: ${articlesResponse.data.data.length}`);
    
    if (articlesResponse.data.data.length > 0) {
      console.log(`📰 Sample article: "${articlesResponse.data.data[0].title}"`);
    }

    console.log('\n🎉 Your site should now show real news articles!');

  } catch (error) {
    console.error('❌ Error populating database:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure your server is running:');
      console.log('   npm run dev');
    }
  }
}

// Run the script
populateDatabase().catch(console.error);
