/**
 * Hyper-Realistic Coin Compositor Routes
 * 
 * Two-stage approach for exact logo accuracy with cinematic quality:
 * 1. Generate realistic 3D coin base + scene (no logo interpretation)  
 * 2. Composite exact PNG logo onto coin surface
 */

const express = require('express');
const router = express.Router();
const CoinCompositorService = require('../services/coinCompositorService');
const logger = require('../utils/logger');

// Initialize service
const coinCompositorService = new CoinCompositorService();

/**
 * Generate hyper-realistic coin with exact logo
 * POST /api/coin-compositor/generate
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
    
    logger.info(`🪙 Coin compositor request: ${cryptocurrency} (${style || 'holographic'})`);
    
    // Generate hyper-realistic coin with exact logo
    const result = await coinCompositorService.generateCoinWithLogo(
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
      message: 'Hyper-realistic coin generation completed',
      ...result
    });
    
    logger.info(`✅ Coin compositor successful: ${cryptocurrency}`);
    
  } catch (error) {
    logger.error(`❌ Coin compositor failed:`, error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Coin compositor generation failed',
      details: {
        method: 'two_stage_coin_compositor',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Test coin generation for specific cryptocurrency
 * GET /api/coin-compositor/test/:symbol
 */
router.get('/test/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol;
    const style = req.query.style || 'holographic';
    
    logger.info(`🧪 Coin compositor test: ${symbol} (${style})`);
    
    const result = await coinCompositorService.testCoinGeneration(symbol, style);
    
    res.json({
      success: true,
      message: `Coin compositor test for ${symbol}`,
      ...result
    });
    
  } catch (error) {
    logger.error(`❌ Coin compositor test failed:`, error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      test: req.params.symbol
    });
  }
});

/**
 * Get coin compositor service status
 * GET /api/coin-compositor/status
 */
router.get('/status', (req, res) => {
  try {
    const service = new CoinCompositorService();
    const providers = service.sdxlService.getProviderStatus();
    
    res.json({
      success: true,
      status: 'Hyper-Realistic Coin Compositor ready',
      method: 'Two-stage exact logo compositing',
      styles: ['holographic', 'cyberpunk', 'space'],
      providers,
      features: [
        'Exact logo geometry preservation',
        'Hyper-realistic 3D coin generation', 
        'Cinematic scene composition',
        'Professional lighting and materials',
        'Universal style templates for all cryptocurrencies',
        'Two-stage compositing approach'
      ],
      stages: [
        'Stage 1: Generate realistic coin base (no logo interpretation)',
        'Stage 2: Composite exact PNG logo with perspective mapping'
      ],
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error getting coin compositor status:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * List available styles (universal for all cryptocurrencies)
 * GET /api/coin-compositor/styles
 */
router.get('/styles', (req, res) => {
  try {
    const service = new CoinCompositorService();
    
    res.json({
      success: true,
      message: 'Universal coin styles for all cryptocurrencies',
      styles: service.coinStyles,
      note: 'These styles are applied to all cryptocurrency generations, not just XRP',
      examples: {
        holographic: 'Chrome finish with rainbow iridescent effects, space background',
        cyberpunk: 'Futuristic environment with purple/cyan lighting, digital particles',
        space: 'Floating in deep space with Earth background, cosmic lighting'
      }
    });
    
  } catch (error) {
    logger.error('❌ Error listing styles:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Debug logo availability
 * GET /api/coin-compositor/debug/:symbol
 */
router.get('/debug/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol;
    logger.info(`🔍 Debugging logo availability for ${symbol}...`);
    
    const service = new CoinCompositorService();
    const logoData = await service.getPngLogo(symbol);
    
    res.json({
      success: true,
      message: `Debug info for ${symbol}`,
      logo: logoData ? {
        found: true,
        source: logoData.source,
        size: logoData.size,
        filename: logoData.filename
      } : { found: false },
      symbol
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
 * Test specific SDXL provider
 * GET /api/coin-compositor/test-provider/:provider
 */
router.get('/test-provider/:provider', async (req, res) => {
  try {
    const provider = req.params.provider;
    logger.info(`🧪 Testing SDXL provider: ${provider}`);
    
    const service = new CoinCompositorService();
    const result = await service.sdxlService.testProvider(provider);
    
    res.json({
      success: true,
      message: `Provider test for ${provider}`,
      ...result
    });
    
  } catch (error) {
    logger.error(`❌ Provider test failed:`, error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      provider: req.params.provider
    });
  }
});

/**
 * Batch test multiple cryptocurrencies
 * POST /api/coin-compositor/batch-test
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
    
    logger.info(`🧪 Batch coin compositor test: ${symbols.join(', ')}`);
    
    const results = [];
    
    for (const symbol of symbols) {
      try {
        const result = await coinCompositorService.testCoinGeneration(symbol, style || 'holographic');
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