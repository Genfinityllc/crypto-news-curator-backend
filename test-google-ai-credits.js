#!/usr/bin/env node

/**
 * Simple Google AI Credit Test Script
 * This will help us identify if credit/quota issues are preventing Nano Banana from working
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function testGoogleAICredits() {
  console.log('🧪 Testing Google AI Credits and Quota...\n');
  
  // Check if API key is present
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.error('❌ GOOGLE_AI_API_KEY not found in environment variables');
    return;
  }
  
  console.log('✅ API Key found:', apiKey.substring(0, 10) + '...');
  
  try {
    // Initialize Google AI client
    console.log('🔧 Initializing Google AI client...');
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Test 1: Try to get a simple model for text generation first
    console.log('\n📝 Test 1: Testing basic text generation (cheaper)...');
    try {
      const textModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const textResult = await textModel.generateContent(['Say hello in one word']);
      const textResponse = await textResult.response;
      console.log('✅ Text generation works:', textResponse.text());
      console.log('💡 This confirms API key and basic quota are working');
    } catch (textError) {
      console.log('❌ Text generation failed:', {
        message: textError.message,
        status: textError.status,
        code: textError.code,
        details: textError.details
      });
      console.log('💡 If text generation fails, it\'s likely an API key or account issue');
    }
    
    // Test 2: Try the image generation model (Nano Banana)
    console.log('\n🍌 Test 2: Testing Nano Banana (Gemini 2.5 Flash Image)...');
    try {
      const imageModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image-preview" });
      console.log('✅ Image model created successfully');
      
      // Simple image generation test
      const prompt = 'Create a simple red circle on a white background';
      console.log('📤 Sending image generation request...');
      
      const imageResult = await imageModel.generateContent([prompt]);
      console.log('📥 Received response from Google AI');
      
      const imageResponse = await imageResult.response;
      console.log('📋 Response parsed successfully');
      
      // Check for image data
      const parts = imageResponse.candidates[0].content.parts;
      let hasImage = false;
      
      for (const part of parts) {
        if (part.inline_data) {
          hasImage = true;
          console.log('🖼️ Image data found! Size:', part.inline_data.data.length, 'characters');
          break;
        }
      }
      
      if (hasImage) {
        console.log('🎉 SUCCESS! Nano Banana is working with your credits!');
        console.log('💰 You have sufficient credits for image generation');
      } else {
        console.log('⚠️ Response received but no image data found');
        console.log('📄 Response structure:', JSON.stringify(parts, null, 2));
      }
      
    } catch (imageError) {
      console.log('❌ Image generation failed:', {
        message: imageError.message,
        status: imageError.status,
        statusText: imageError.statusText,
        code: imageError.code,
        name: imageError.name,
        details: imageError.details
      });
      
      // Analyze the error
      if (imageError.message?.includes('quota') || imageError.message?.includes('limit')) {
        console.log('💸 QUOTA/CREDIT ISSUE: You may be out of credits or hitting rate limits');
      } else if (imageError.message?.includes('permission') || imageError.message?.includes('access')) {
        console.log('🔐 PERMISSION ISSUE: Your API key may not have access to image generation');
      } else if (imageError.message?.includes('model') || imageError.message?.includes('not found')) {
        console.log('🤖 MODEL ISSUE: The image model may not be available or the name is incorrect');
      } else {
        console.log('❓ UNKNOWN ISSUE: This might be a different problem');
      }
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
  }
  
  console.log('\n🏁 Test completed!');
}

// Run the test
testGoogleAICredits().catch(console.error);