#!/usr/bin/env node

console.log('🧪 Testing backend startup...');

try {
  // Test if main modules can be required without errors
  console.log('📦 Testing core dependencies...');
  
  const express = require('express');
  console.log('✅ Express loaded');
  
  const cors = require('cors');
  console.log('✅ CORS loaded');
  
  const { createClient } = require('@supabase/supabase-js');
  console.log('✅ Supabase loaded');
  
  console.log('📂 Testing route files...');
  const unifiedNews = require('./src/routes/unified-news.js');
  console.log('✅ unified-news route loaded');
  
  const supabaseNews = require('./src/routes/supabase-news.js');
  console.log('✅ supabase-news route loaded');
  
  console.log('🔧 Testing services...');
  const newsService = require('./src/services/newsService.js');
  console.log('✅ newsService loaded');
  
  console.log('🎨 Testing LoRA service...');
  const WorkingLoraService = require('./src/services/workingLoraService.js');
  console.log('✅ WorkingLoraService loaded');
  
  const loraService = new WorkingLoraService();
  console.log('✅ WorkingLoraService instantiated');
  
  console.log('✅ All tests passed! Backend should start successfully.');
  
} catch (error) {
  console.error('❌ Backend test failed:', error.message);
  console.error('📍 Error stack:', error.stack);
  process.exit(1);
}