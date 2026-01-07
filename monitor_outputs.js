#!/usr/bin/env node

/**
 * Output Monitoring Script
 * Automatically monitors frontend and backend outputs to verify fixes are working
 */

const axios = require('axios');
const fs = require('fs');

const BACKEND_URL = 'https://crypto-news-curator-backend-production.up.railway.app';
const FRONTEND_URL = 'https://crypto-news-frontend-ruddy.vercel.app';

// Test cases to verify
const TEST_CASES = [
  {
    name: 'XRP Article Detection Test',
    title: 'XRP Price Faces First Death Cross In 14 Months',
    content: 'XRP price has surged sharply in recent sessions, tracking the broader crypto markets bullish momentum. The altcoin reclaimed key levels after weeks of consolidation.',
    expectedCrypto: 'XRP',
    expectedScene: 'trading floor',
    expectedDisclaimer: 'Genfinity'
  },
  {
    name: 'Bitcoin Technical Analysis Test', 
    title: 'Bitcoin Technical Indicators Show Bullish Momentum',
    content: 'Bitcoin trading volume increased 40% as technical indicators signal continued upward momentum.',
    expectedCrypto: 'Bitcoin',
    expectedScene: 'trading floor',
    expectedDisclaimer: 'Genfinity'
  }
];

class OutputMonitor {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  async monitorRewriteOutput(testCase) {
    console.log(`🧪 Testing: ${testCase.name}`);
    
    try {
      // Test article rewrite
      const rewriteResponse = await axios.post(`${BACKEND_URL}/api/news/rewrite-rss-article`, {
        title: testCase.title,
        content: testCase.content,
        url: 'https://test.com',
        source: 'Test Source'
      }, { timeout: 60000 });

      const rewrite = rewriteResponse.data;
      
      // Verify crypto detection
      const cryptoDetected = rewrite.title.toLowerCase().includes(testCase.expectedCrypto.toLowerCase());
      
      // Verify disclaimer presence
      const disclaimerPresent = rewrite.content && rewrite.content.includes('Disclaimer: News content provided by Genfinity');
      
      // Verify content specificity (not generic)
      const hasSpecificContent = rewrite.content && !rewrite.content.includes('Current trends suggest growing institutional');
      
      const testResult = {
        testName: testCase.name,
        cryptoDetection: cryptoDetected ? '✅ PASS' : '❌ FAIL',
        disclaimer: disclaimerPresent ? '✅ PASS' : '❌ FAIL', 
        contentSpecific: hasSpecificContent ? '✅ PASS' : '❌ FAIL',
        actualTitle: rewrite.title,
        contentPreview: rewrite.content ? rewrite.content.substring(0, 200) + '...' : 'No content'
      };

      console.log(`   Crypto Detection: ${testResult.cryptoDetection}`);
      console.log(`   Disclaimer: ${testResult.disclaimer}`); 
      console.log(`   Specific Content: ${testResult.contentSpecific}`);
      console.log(`   Title: "${testResult.actualTitle}"`);
      
      this.results.push(testResult);
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      this.results.push({
        testName: testCase.name,
        error: error.message,
        status: 'FAILED'
      });
    }
  }

  async monitorImageGeneration(testCase) {
    console.log(`🖼️  Testing Image Generation: ${testCase.name}`);
    
    try {
      const imageResponse = await axios.post(`${BACKEND_URL}/api/news/generate-lora-image`, {
        title: testCase.title,
        content: testCase.content,
        entity: testCase.expectedCrypto,
        size: 'medium',
        style: 'professional'
      }, { timeout: 180000 });

      const imageResult = imageResponse.data;
      
      console.log(`   Image Generation: ${imageResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`   Image URL: ${imageResult.imageUrl || 'None'}`);
      
      // Add to results
      this.results.push({
        testName: `${testCase.name} - Image`,
        imageGeneration: imageResult.success ? '✅ PASS' : '❌ FAIL',
        imageUrl: imageResult.imageUrl,
        metadata: imageResult.metadata
      });
      
    } catch (error) {
      console.log(`   ❌ IMAGE ERROR: ${error.message}`);
    }
  }

  async runAllTests() {
    console.log('🔍 Starting Automated Output Monitoring...\n');
    
    for (const testCase of TEST_CASES) {
      await this.monitorRewriteOutput(testCase);
      console.log('');
      await this.monitorImageGeneration(testCase);
      console.log('---\n');
    }
    
    this.generateReport();
  }

  generateReport() {
    const totalTime = Math.round((Date.now() - this.startTime) / 1000);
    
    console.log('📊 MONITORING REPORT');
    console.log('===================');
    console.log(`Total Test Time: ${totalTime}s`);
    console.log(`Tests Run: ${this.results.length}`);
    
    const passCount = this.results.filter(r => 
      r.cryptoDetection === '✅ PASS' && 
      r.disclaimer === '✅ PASS' && 
      r.contentSpecific === '✅ PASS'
    ).length;
    
    console.log(`Pass Rate: ${Math.round(passCount / this.results.length * 100)}%`);
    console.log('');
    
    // Save detailed results
    fs.writeFileSync('/tmp/monitoring_results.json', JSON.stringify(this.results, null, 2));
    console.log('📄 Detailed results saved to /tmp/monitoring_results.json');
  }
}

// Run monitoring
const monitor = new OutputMonitor();
monitor.runAllTests().catch(console.error);