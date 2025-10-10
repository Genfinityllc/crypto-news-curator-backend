const LoRAiService = require('./src/services/loraAiService');

async function testRealLoRASystem() {
  console.log('🚀 Testing REAL LoRA system with local AI generation...');
  
  const loraService = new LoRAiService();
  
  // Wait a bit for initialization
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('📊 Service Status:', await loraService.getStatus());
  console.log('✅ Available:', loraService.isAvailable());
  console.log('🌐 Service URL:', loraService.aiServiceUrl);
  
  if (loraService.isAvailable()) {
    console.log('🎨 Testing REAL LoRA image generation...');
    
    const testArticle = {
      title: 'Hedera Hashgraph Revolutionizes Enterprise Blockchain',
      content: 'Hedera Hashgraph has announced groundbreaking partnerships with Fortune 500 companies, bringing enterprise-grade distributed ledger technology to mainstream adoption.',
      network: 'Hedera'
    };
    
    try {
      const startTime = Date.now();
      console.log('⏱️ Starting REAL AI generation...');
      
      const result = await loraService.generateCryptoNewsImage(testArticle, {
        size: 'medium',
        style: 'professional'
      });
      
      const duration = Date.now() - startTime;
      console.log(`⏱️ Real LoRA generation completed in ${duration}ms`);
      console.log('✅ REAL LoRA result:', result);
      
      if (result.success && result.coverUrl) {
        console.log('🎯 SUCCESS! Real LoRA system is fully operational');
        console.log('🖼️ Generated image URL:', result.coverUrl);
        console.log('📸 Image accessible at:', result.coverUrl);
        
        // Test if the image URL is accessible
        const axios = require('axios');
        try {
          const imageResponse = await axios.head(result.coverUrl);
          console.log('✅ Image URL is accessible, status:', imageResponse.status);
        } catch (e) {
          console.log('❌ Image URL test failed:', e.message);
        }
      } else {
        console.log('❌ Generation failed despite successful response');
      }
      
    } catch (error) {
      console.log('❌ Real LoRA system test failed:', error.message);
    }
  }
}

testRealLoRASystem();