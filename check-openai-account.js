#!/usr/bin/env node

/**
 * Check OpenAI Account Information
 */

const OpenAI = require('openai');
require('dotenv').config();

async function checkOpenAIAccount() {
  console.log('🔍 Checking OpenAI Account Information...\n');
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found');
    return;
  }
  
  console.log('🔑 API Key:', apiKey.substring(0, 20) + '...');
  
  try {
    const openai = new OpenAI({ apiKey });
    
    // Try to get account information
    console.log('\n📊 Attempting to retrieve account information...');
    
    // Check if we can access models (this tells us about the account)
    try {
      const models = await openai.models.list();
      console.log('✅ Successfully connected to OpenAI');
      console.log('📋 Available models:', models.data.length);
      
      // Look for organization info in the response headers or data
      console.log('🏢 Organization info:');
      if (models.organization) {
        console.log('   Organization ID:', models.organization);
      }
      
      // Show some model info to verify account access
      const gptModels = models.data.filter(m => m.id.includes('gpt')).slice(0, 5);
      console.log('🤖 Available GPT models:');
      gptModels.forEach(model => {
        console.log(`   - ${model.id} (owned by: ${model.owned_by})`);
      });
      
    } catch (error) {
      console.log('❌ Error accessing models:', error.message);
      
      // Parse the error for account info
      if (error.status === 401) {
        console.log('🔐 Authentication issue - API key may be invalid');
      } else if (error.status === 429) {
        console.log('💸 Quota exceeded - account has no credits/billing');
      } else if (error.status === 403) {
        console.log('⛔ Permission denied - account may be restricted');
      }
    }
    
    // Try to make a small request to get usage info
    console.log('\n💰 Attempting small test request...');
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1
      });
      
      console.log('✅ Request successful - account has credits');
      
    } catch (error) {
      console.log('❌ Test request failed:', error.message);
      
      if (error.message.includes('quota')) {
        console.log('💳 ACCOUNT STATUS: No credits or billing not set up');
      }
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
  }
  
  console.log('\n📝 API Key Analysis:');
  console.log('   Format:', apiKey.startsWith('sk-proj-') ? 'Project-based key' : 'Legacy format');
  console.log('   Length:', apiKey.length, 'characters');
  
  console.log('\n🏁 Account check completed!');
}

checkOpenAIAccount().catch(console.error);