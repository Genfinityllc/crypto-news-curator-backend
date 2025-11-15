/**
 * Test script to verify Railway deployment of LoRA timeout fix
 */

const axios = require('axios');

const RAILWAY_BACKEND_URL = 'https://crypto-news-curator-backend-production.up.railway.app';

async function testRailwayDeployment() {
  console.log('🧪 Testing Railway Backend Deployment Status...\n');
  
  try {
    // 1. Check health and uptime
    console.log('1️⃣ Checking backend health...');
    const healthResponse = await axios.get(`${RAILWAY_BACKEND_URL}/health`);
    const { uptime, timestamp } = healthResponse.data;
    
    console.log(`✅ Backend is healthy`);
    console.log(`📊 Uptime: ${Math.round(uptime)} seconds (${(uptime/60).toFixed(1)} minutes)`);
    console.log(`🕐 Last restart: ${new Date(Date.now() - uptime*1000).toLocaleString()}\n`);
    
    // 2. Test LoRA endpoint (quick timeout test)
    console.log('2️⃣ Testing LoRA generation timeout behavior...');
    console.log('⚠️  This will make an actual LoRA call - it should either:');
    console.log('   - Complete successfully (if deployed)');
    console.log('   - Timeout after 30 attempts (if old version)'); 
    console.log('   - Timeout after 60 attempts (if new version deployed)\n');
    
    const testPayload = {
      title: 'TEST DEPLOYMENT',
      content: 'Quick test to check timeout behavior',
      network: 'bitcoin'
    };
    
    const startTime = Date.now();
    
    try {
      const loraResponse = await axios.post(`${RAILWAY_BACKEND_URL}/api/ai-cover/generate-lora`, testPayload, {
        timeout: 120000 // 2 minutes max for this test
      });
      
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`✅ LoRA generation SUCCESS in ${elapsed}s!`);
      console.log(`🎉 NEW VERSION DEPLOYED - No more timeout issues!`);
      
      if (loraResponse.data.success) {
        console.log(`🖼️  Generated image: ${loraResponse.data.imageUrl}`);
      }
      
    } catch (loraError) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      
      if (loraError.response && loraError.response.data) {
        const errorMsg = loraError.response.data.error || loraError.response.data.message;
        
        if (errorMsg.includes('30 polling attempts')) {
          console.log(`❌ OLD VERSION DETECTED (${elapsed}s elapsed)`);
          console.log(`🚨 Error: ${errorMsg}`);
          console.log(`📋 SOLUTION: Run 'railway login && railway up' to deploy the fix`);
        } else if (errorMsg.includes('60 polling attempts')) {
          console.log(`⚠️  NEW VERSION DEPLOYED but still timed out after 60 attempts (${elapsed}s)`);
          console.log(`💡 This might be a different issue - the timeout fix is deployed`);
        } else {
          console.log(`🤔 Different error (${elapsed}s elapsed): ${errorMsg}`);
        }
      } else {
        console.log(`⏱️  Request timeout after ${elapsed}s (network/timeout issue)`);
      }
    }
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testRailwayDeployment().catch(console.error);
}

module.exports = { testRailwayDeployment };