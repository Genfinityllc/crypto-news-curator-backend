#!/usr/bin/env node

const axios = require('axios');
const { fetchRealCryptoNews } = require('./src/services/newsService');
const { getMarketData } = require('./src/services/cryptoService');
const { testSupabaseConnection } = require('./src/config/supabase');

const BASE_URL = 'http://localhost:3000/api';

async function testAllIntegrations() {
  console.log('🚀 Testing Crypto News Curator Backend Integrations...\n');

  // Test 1: Supabase Connection
  console.log('1️⃣ Testing Supabase Connection...');
  try {
    const supabaseConnected = await testSupabaseConnection();
    console.log(`   ${supabaseConnected ? '✅' : '❌'} Supabase: ${supabaseConnected ? 'Connected' : 'Not connected'}`);
  } catch (error) {
    console.log(`   ❌ Supabase: Error - ${error.message}`);
  }

  // Test 2: RSS Feed Integration
  console.log('\n2️⃣ Testing RSS Feed Integration...');
  try {
    const realNews = await fetchRealCryptoNews();
    console.log(`   ✅ RSS Feeds: Fetched ${realNews.length} articles`);
    if (realNews.length > 0) {
      console.log(`   📰 Sample: "${realNews[0].title}"`);
    }
  } catch (error) {
    console.log(`   ❌ RSS Feeds: Error - ${error.message}`);
  }

  // Test 3: CoinGecko API
  console.log('\n3️⃣ Testing CoinGecko API...');
  try {
    const marketData = await getMarketData(5);
    console.log(`   ✅ CoinGecko: Fetched ${marketData.length} cryptocurrencies`);
    if (marketData.length > 0) {
      console.log(`   💰 Top: ${marketData[0].name} ($${marketData[0].currentPrice})`);
    }
  } catch (error) {
    console.log(`   ❌ CoinGecko: Error - ${error.message}`);
  }

  // Test 4: API Endpoints (if server is running)
  console.log('\n4️⃣ Testing API Endpoints...');
  try {
    const response = await axios.get(`${BASE_URL}/news`, { timeout: 5000 });
    console.log(`   ✅ API Server: Running (${response.data.data.length} articles)`);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('   ⚠️  API Server: Not running (start with npm run dev)');
    } else {
      console.log(`   ❌ API Server: Error - ${error.message}`);
    }
  }

  // Test 5: Breaking News
  console.log('\n5️⃣ Testing Breaking News Detection...');
  try {
    const response = await axios.get(`${BASE_URL}/news/breaking`, { timeout: 5000 });
    console.log(`   ✅ Breaking News: ${response.data.data.length} articles`);
  } catch (error) {
    console.log(`   ❌ Breaking News: Error - ${error.message}`);
  }

  // Test 6: Market Data Endpoint
  console.log('\n6️⃣ Testing Market Data Endpoint...');
  try {
    const response = await axios.get(`${BASE_URL}/crypto/market-data?limit=5`, { timeout: 5000 });
    console.log(`   ✅ Market Data: ${response.data.data.length} cryptocurrencies`);
  } catch (error) {
    console.log(`   ❌ Market Data: Error - ${error.message}`);
  }

  console.log('\n🎉 Integration Test Complete!');
  console.log('\n📋 Next Steps:');
  console.log('   1. Set up your Supabase project and add credentials to .env');
  console.log('   2. Start the server: npm run dev');
  console.log('   3. Test the frontend integration');
  console.log('   4. Set up cron jobs for automated updates');
}

// Run the test
testAllIntegrations().catch(console.error);
