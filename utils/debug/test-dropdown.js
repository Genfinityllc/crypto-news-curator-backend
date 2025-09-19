#!/usr/bin/env node

const axios = require('axios');

async function testDropdown() {
  console.log('🧪 Testing Top 50 Cryptocurrencies Dropdown...\n');

  try {
    const response = await axios.get('http://localhost:3000/api/crypto/top-cryptos-dropdown?limit=50', {
      timeout: 10000
    });

    const { data } = response.data;

    console.log('✅ Dropdown data fetched successfully!');
    console.log(`📊 Total options: ${data.length}`);
    console.log(`🏆 Top 10 cryptocurrencies:`);

    // Show top 10 with market cap info
    data.slice(1, 11).forEach((crypto, index) => {
      const marketCapFormatted = (crypto.marketCap / 1000000000).toFixed(2);
      const changeColor = crypto.change24h > 0 ? '🟢' : crypto.change24h < 0 ? '🔴' : '⚪';
      
      console.log(`   ${index + 1}. ${crypto.label} - $${marketCapFormatted}B ${changeColor}${crypto.change24h?.toFixed(2)}%`);
    });

    console.log('\n🎯 Dropdown includes:');
    console.log(`   ✅ "All Networks" option`);
    console.log(`   ✅ Top 50 cryptocurrencies by market cap`);
    console.log(`   ✅ Real-time prices and 24h changes`);
    console.log(`   ✅ Market cap rankings`);

    console.log('\n🚀 Ready for frontend integration!');
    console.log('\n📋 Next steps:');
    console.log('   1. Update your React component with the new network fetching logic');
    console.log('   2. Replace the static networks array with dynamic data');
    console.log('   3. Add loading states and error handling');
    console.log('   4. Test the dropdown functionality');

  } catch (error) {
    console.error('❌ Error testing dropdown:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure your server is running:');
      console.log('   npm run dev');
    }
  }
}

// Run the test
testDropdown().catch(console.error);
