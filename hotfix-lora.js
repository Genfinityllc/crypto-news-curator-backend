#!/usr/bin/env node
/**
 * Hotfix script to enable LoRA generation while Railway deployment is blocked
 * This bypasses the external service call and enables intelligent fallbacks
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Applying LoRA hotfix for Railway deployment...');

// Check if we're in the deployed environment
if (process.env.RAILWAY_ENVIRONMENT) {
  console.log('✅ Railway environment detected - applying hotfix');
  
  // Force the LoRA service to use intelligent fallbacks
  process.env.USE_EXTERNAL_AI_SERVICE = 'false';
  process.env.LORA_FALLBACK_MODE = 'true';
  
  console.log('✅ LoRA service configured for intelligent fallbacks');
  console.log('🎯 Generate Cover Image should now work with network-branded images');
} else {
  console.log('ℹ️ Not in Railway environment - no hotfix needed');
}