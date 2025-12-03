const express = require('express');
const router = express.Router();
// Try both services - canvas-based and simple SVG
let DirectSvgRenderingService, SimpleSvgService;
try {
  DirectSvgRenderingService = require('../services/directSvgRenderingService');
} catch (error) {
  console.log('Canvas-based service not available, using simple SVG service');
}
SimpleSvgService = require('../services/simpleSvgService');
const logger = require('../utils/logger');

// Initialize service based on availability
let directSvgService;
if (DirectSvgRenderingService) {
  try {
    directSvgService = new DirectSvgRenderingService();
    logger.info('🎨 Using canvas-based Direct SVG Rendering Service');
  } catch (error) {
    logger.warn('Canvas service failed to initialize, falling back to Simple SVG');
    directSvgService = new SimpleSvgService();
  }
} else {
  directSvgService = new SimpleSvgService();
  logger.info('🎨 Using Simple SVG Service (canvas not available)');
}

// Direct SVG rendering endpoint
router.post('/generate-direct-svg', async (req, res) => {
  try {
    logger.info('🎨 Direct SVG rendering request received');
    
    const {
      title,
      content,
      network,
      cryptocurrency = network,
      style = 'professional',
      options = {}
    } = req.body;

    // Validate required parameters
    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: title'
      });
    }

    logger.info(`🔧 Starting direct SVG rendering for: ${title.substring(0, 50)}...`);
    
    // Generate image using exact SVG geometry + professional styling
    const result = await (directSvgService.generateDirectSvgCover || directSvgService.generateExactLogoCover).call(
      directSvgService,
      title,
      content,
      style,
      {
        cryptocurrency: cryptocurrency?.toLowerCase(),
        ...options
      }
    );

    if (!result || !result.success) {
      throw new Error(result?.error || 'Direct SVG rendering failed');
    }

    logger.info(`✅ Direct SVG rendering successful for: ${result.metadata.cryptocurrency}`);
    
    res.json({
      success: true,
      imageUrl: result.imageUrl,
      imageBase64: result.imageBase64,
      metadata: {
        ...result.metadata,
        title: title.substring(0, 100),
        method: 'direct_svg_rendering'
      }
    });

  } catch (error) {
    logger.error('❌ Direct SVG rendering error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Direct SVG rendering failed',
      details: error.stack
    });
  }
});

// Test endpoint for direct SVG rendering
router.get('/test/:cryptocurrency', async (req, res) => {
  try {
    const { cryptocurrency } = req.params;
    const { style = 'professional' } = req.query;
    
    logger.info(`🧪 Testing direct SVG rendering for ${cryptocurrency}`);
    
    // Test with sample data
    const testResult = await (directSvgService.generateDirectSvgCover || directSvgService.generateExactLogoCover).call(
      directSvgService,
      `Test ${cryptocurrency.toUpperCase()} Article Cover`,
      `Professional direct SVG rendering test for ${cryptocurrency} with exact geometric accuracy`,
      style,
      {
        cryptocurrency: cryptocurrency.toLowerCase()
      }
    );

    res.json({
      success: true,
      test: true,
      result: testResult,
      cryptocurrency: cryptocurrency.toLowerCase(),
      style,
      message: 'Direct SVG rendering test completed successfully'
    });

  } catch (error) {
    logger.error('❌ Direct SVG rendering test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      test: true,
      cryptocurrency: req.params.cryptocurrency
    });
  }
});

// List available style presets
router.get('/styles', (req, res) => {
  res.json({
    success: true,
    styles: {
      professional: {
        description: 'Dark blue gradient with cyan glow effects',
        backgroundColor: '#0a0f1c',
        features: ['metallic_effects', 'particle_field', 'geometric_grid']
      },
      elegant: {
        description: 'Purple-black gradient with violet glow effects', 
        backgroundColor: '#1a1625',
        features: ['metallic_effects', 'geometric_grid']
      },
      modern: {
        description: 'GitHub-inspired dark theme with blue accents',
        backgroundColor: '#0d1117', 
        features: ['particle_field', 'geometric_grid']
      }
    },
    default: 'professional',
    note: 'All styles preserve exact SVG geometry with 3D effects'
  });
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'direct-svg-rendering',
    status: 'operational',
    features: ['exact_geometry', '3d_effects', 'professional_styling'],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;