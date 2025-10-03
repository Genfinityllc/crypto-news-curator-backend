#!/usr/bin/env node

/**
 * Test OpenAI API Credits and Configuration
 */

const OpenAI = require('openai');
require('dotenv').config();

async function testOpenAICredits() {
  console.log('🧪 Testing OpenAI API Credits and Configuration...\n');
  
  // Check if API key is present
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment variables');
    return;
  }
  
  console.log('✅ API Key found:', apiKey.substring(0, 20) + '...');
  
  try {
    // Initialize OpenAI client
    console.log('🔧 Initializing OpenAI client...');
    const openai = new OpenAI({ apiKey });
    
    // Test 1: Try to get account/usage info (if available)
    console.log('\n💰 Test 1: Checking account status...');
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: "Say 'API Test Successful' in exactly those words." }],
        max_tokens: 10
      });
      
      console.log('✅ OpenAI API is working!');
      console.log('📝 Response:', completion.choices[0].message.content);
      console.log('💡 Model used:', completion.model);
      console.log('🪙 Tokens used:', completion.usage.total_tokens);
      
    } catch (error) {
      console.log('❌ OpenAI API test failed:', {
        message: error.message,
        type: error.type,
        code: error.code,
        status: error.status
      });
      
      // Analyze the error
      if (error.message?.includes('quota') || error.message?.includes('billing')) {
        console.log('💸 BILLING/QUOTA ISSUE: You may be out of credits or need to add billing');
      } else if (error.message?.includes('authentication') || error.message?.includes('api_key')) {
        console.log('🔐 API KEY ISSUE: Your API key may be invalid or expired');
      } else if (error.message?.includes('rate_limit')) {
        console.log('⏱️ RATE LIMIT: Too many requests, try again later');
      } else {
        console.log('❓ UNKNOWN ISSUE: This might be a different problem');
      }
    }
    
    // Test 2: Try cheaper model if GPT-4 fails
    console.log('\n🔬 Test 2: Testing with GPT-3.5-turbo (cheaper model)...');
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Say 'GPT-3.5 Test Successful'" }],
        max_tokens: 10
      });
      
      console.log('✅ GPT-3.5-turbo is working!');
      console.log('📝 Response:', completion.choices[0].message.content);
      console.log('🪙 Tokens used:', completion.usage.total_tokens);
      
    } catch (error) {
      console.log('❌ GPT-3.5-turbo also failed:', error.message);
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
  }
  
  console.log('\n🏁 OpenAI test completed!');
}

// Run the test
testOpenAICredits().catch(console.error);