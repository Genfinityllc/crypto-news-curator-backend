/**
 * ControlNet PNG Logo Generation Routes
 * 
 * API endpoints for precise logo generation using PNG inputs with optimal 2024 ControlNet settings.
 * Designed for exact cryptocurrency logo accuracy using high-resolution PNG control images.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const ControlNetService = require('../services/controlNetService');
const logger = require('../utils/logger');

// Initialize service
const controlNetService = new ControlNetService();

/**
 * Generate cover image using PNG ControlNet with optimal 2024 settings
 * POST /api/controlnet-png/generate
 */
router.post('/generate', async (req, res) => {
  try {
    const { title, content, cryptocurrency, style, options } = req.body;
    
    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required'
      });
    }
    
    if (!cryptocurrency) {
      return res.status(400).json({
        success: false,
        error: 'Cryptocurrency symbol is required'
      });
    }
    
    logger.info(`🎯 PNG ControlNet generation request: ${cryptocurrency} (${style || 'holographic'})`);
    
    // Generate image using REVOLUTIONARY Two-Stage Depth-Aware ControlNet
    const result = await controlNetService.generateWithAdvancedControlNet(
      title,
      cryptocurrency,
      style || 'holographic',
      {
        ...options,
        source: 'api',
        timestamp: Date.now()
      }
    );
    
    // Return success response
    res.json({
      success: true,
      message: 'PNG ControlNet generation completed',
      ...result
    });
    
    logger.info(`✅ PNG ControlNet generation successful: ${cryptocurrency}`);
    
  } catch (error) {
    logger.error(`❌ PNG ControlNet generation failed:`, error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'PNG ControlNet generation failed',
      details: {
        method: 'png_controlnet',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Test PNG ControlNet with specific cryptocurrency
 * GET /api/controlnet-png/test/:symbol
 */
router.get('/test/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol;
    const style = req.query.style || 'holographic';
    
    logger.info(`🧪 PNG ControlNet test request: ${symbol} (${style})`);
    
    const result = await controlNetService.testPngControlNet(symbol, style);
    
    res.json({
      success: true,
      message: `PNG ControlNet test for ${symbol}`,
      ...result
    });
    
  } catch (error) {
    logger.error(`❌ PNG ControlNet test failed:`, error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      test: req.params.symbol
    });
  }
});

/**
 * List available PNG logos
 * GET /api/controlnet-png/logos
 */
router.get('/logos', async (req, res) => {
  try {
    logger.info('📁 Listing available PNG logos...');
    
    const result = await controlNetService.listAvailablePngLogos();
    
    res.json({
      success: true,
      message: 'Available PNG logos',
      ...result
    });
    
  } catch (error) {
    logger.error('❌ Error listing PNG logos:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get ControlNet service status and settings
 * GET /api/controlnet-png/status
 */
router.get('/status', async (req, res) => {
  try {
    const service = new ControlNetService();
    
    res.json({
      success: true,
      status: 'ControlNet PNG service ready',
      settings: service.optimalSettings,
      styleTemplates: Object.keys(service.styleTemplates),
      pngDirectory: service.pngLogoDir,
      features: [
        'PNG logo preprocessing',
        'Optimal 2024 ControlNet settings', 
        'Multiple style templates',
        'High-precision Canny edge detection',
        'Professional watermarking',
        'Automatic logo detection'
      ],
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error getting ControlNet status:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get optimal settings documentation
 * GET /api/controlnet-png/settings
 */
router.get('/settings', (req, res) => {
  const service = new ControlNetService();
  
  res.json({
    success: true,
    message: 'Optimal 2024 ControlNet settings for logo generation',
    settings: service.optimalSettings,
    explanation: {
      steps: '50 steps minimum for high quality output',
      guidance_scale: '4.0 sweet spot for logos (3-5 range recommended)',
      controlnet_conditioning_scale: '0.8 high control weight for precise logos',
      control_guidance: 'Full guidance (0.0 to 1.0) for maximum accuracy',
      scheduler: 'UniPC recommended for best quality',
      pixel_perfect: 'Auto-resolution optimization enabled',
      canny_thresholds: 'Optimized for clean logo edge detection'
    },
    research: {
      based_on: '2024 ControlNet best practices research',
      optimized_for: 'Logo and brand generation with maximum accuracy',
      model_preference: 'Canny edge detection for precise boundaries'
    }
  });
});

/**
 * Debug logo availability for specific cryptocurrency
 * GET /api/controlnet-png/debug/:symbol
 */
router.get('/debug/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol;
    logger.info(`🔍 Debugging logo availability for ${symbol}...`);
    
    const service = new ControlNetService();
    
    // Test PNG directory access
    const debugInfo = {
      symbol,
      pngDirectory: service.pngLogoDir,
      directoryExists: false,
      pngLogo: null,
      svgLogo: null,
      error: null
    };
    
    // Check PNG directory
    try {
      await fs.access(service.pngLogoDir);
      debugInfo.directoryExists = true;
    } catch (error) {
      debugInfo.directoryError = error.message;
    }
    
    // Test PNG logo retrieval
    try {
      const pngResult = await service.getPngLogo(symbol);
      debugInfo.pngLogo = pngResult ? {
        found: true,
        source: pngResult.source,
        size: pngResult.size,
        filename: pngResult.filename
      } : { found: false };
    } catch (error) {
      debugInfo.pngLogo = { error: error.message };
    }
    
    // Test SVG logo service directly
    try {
      const svgResult = await service.svgLogoService.getSvgLogoInfo(symbol.toUpperCase());
      debugInfo.svgLogo = svgResult ? {
        found: true,
        hasContent: !!svgResult.svgContent,
        symbol: svgResult.symbol,
        name: svgResult.name
      } : { found: false };
    } catch (error) {
      debugInfo.svgLogo = { error: error.message };
    }
    
    res.json({
      success: true,
      message: `Debug info for ${symbol}`,
      debug: debugInfo
    });
    
  } catch (error) {
    logger.error(`❌ Debug failed:`, error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      symbol: req.params.symbol
    });
  }
});

/**
 * Batch test multiple cryptocurrencies
 * POST /api/controlnet-png/batch-test
 */
router.post('/batch-test', async (req, res) => {
  try {
    const { symbols, style } = req.body;
    
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({
        success: false,
        error: 'Symbols array is required'
      });
    }
    
    logger.info(`🧪 Batch PNG ControlNet test: ${symbols.join(', ')}`);
    
    const results = [];
    
    for (const symbol of symbols) {
      try {
        const result = await controlNetService.testPngControlNet(symbol, style || 'holographic');
        results.push({
          symbol,
          ...result
        });
      } catch (error) {
        results.push({
          symbol,
          success: false,
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    res.json({
      success: true,
      message: `Batch test completed: ${successCount}/${symbols.length} successful`,
      totalTested: symbols.length,
      successful: successCount,
      failed: symbols.length - successCount,
      results
    });
    
  } catch (error) {
    logger.error('❌ Batch test failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;