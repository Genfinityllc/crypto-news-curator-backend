const express = require('express');
const router = express.Router();
const TwoStepLogoService = require('../services/twoStepLogoService');
const logger = require('../utils/logger');

// Initialize service
const twoStepService = new TwoStepLogoService();

// Two-Step Logo Generation endpoint
router.post('/generate', async (req, res) => {
  try {
    logger.info('🎨 Two-Step logo generation request received');
    
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

    logger.info(`🔧 Starting two-step generation for: ${title.substring(0, 50)}...`);
    
    // Generate using two-step approach
    const result = await twoStepService.generateTwoStepCover(
      title,
      content,
      style,
      { ...options, cryptocurrency }
    );

    logger.info('✅ Two-step logo generation completed successfully');

    res.json(result);

  } catch (error) {
    logger.error('❌ Two-step logo generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      service: 'two-step-logo'
    });
  }
});

// Test endpoint for debugging
router.get('/test/:cryptocurrency', async (req, res) => {
  try {
    const { cryptocurrency } = req.params;
    const { style = 'professional' } = req.query;
    
    logger.info(`🧪 Testing two-step generation for ${cryptocurrency}`);
    
    // Test with sample data
    const testResult = await twoStepService.generateTwoStepCover(
      `Professional ${cryptocurrency.toUpperCase()} Market Analysis`,
      `In-depth analysis of ${cryptocurrency} market trends and technical indicators showing strong momentum.`,
      style,
      { cryptocurrency: cryptocurrency.toLowerCase() }
    );

    res.json({
      success: true,
      test: true,
      result: testResult,
      cryptocurrency: cryptocurrency.toLowerCase(),
      style,
      message: 'Two-step logo generation test completed successfully'
    });

  } catch (error) {
    logger.error('❌ Two-step logo test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      test: true,
      cryptocurrency: req.params.cryptocurrency
    });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'two-step-logo',
    status: 'operational',
    method: 'Perfect SVG isolation + Style scene compositing'
  });
});

module.exports = router;