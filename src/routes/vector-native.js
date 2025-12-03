const express = require('express');
const router = express.Router();
const VectorNativeService = require('../services/vectorNativeService');
const logger = require('../utils/logger');

const vectorService = new VectorNativeService();

// Vector-native image generation endpoint
router.post('/generate-vector-image', async (req, res) => {
  try {
    logger.info('🎯 Vector-native image generation request received');
    
    const {
      title,
      content,
      network,
      cryptocurrency = network,
      styles = {}
    } = req.body;

    // Validate required parameters
    if (!title || !cryptocurrency) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: title and cryptocurrency'
      });
    }

    logger.info(`🔬 Starting vector-native generation for ${cryptocurrency}`);
    
    // Generate image using vector-native AI
    const result = await vectorService.generateWithVectorNativeAI(
      title,
      content,
      'professional',
      {
        cryptocurrency: cryptocurrency.toLowerCase(),
        styles
      }
    );

    if (!result || !result.success) {
      throw new Error(result?.error || 'Vector-native generation failed');
    }

    logger.info(`✅ Vector-native generation successful for ${cryptocurrency}`);
    
    res.json({
      success: true,
      imageUrl: result.imageUrl,
      imageBase64: result.imageBase64,
      metadata: {
        cryptocurrency,
        method: 'vector_native_ai',
        vectorParams: result.vectorParams,
        processingTime: result.processingTime
      }
    });

  } catch (error) {
    logger.error('❌ Vector-native generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Vector-native generation failed',
      details: error.stack
    });
  }
});

// Test endpoint for vector-native processing
router.get('/test/:cryptocurrency', async (req, res) => {
  try {
    const { cryptocurrency } = req.params;
    
    logger.info(`🧪 Testing vector-native processing for ${cryptocurrency}`);
    
    // Test with sample data
    const testResult = await vectorService.generateWithVectorNativeAI(
      `Test ${cryptocurrency.toUpperCase()} Article`,
      `Sample content for ${cryptocurrency} testing`,
      'professional',
      {
        cryptocurrency: cryptocurrency.toLowerCase(),
        styles: {
          theme: 'dark_futuristic',
          complexity: 'high'
        }
      }
    );

    res.json({
      success: true,
      test: true,
      result: testResult,
      cryptocurrency: cryptocurrency.toLowerCase()
    });

  } catch (error) {
    logger.error('❌ Vector-native test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      test: true
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'vector-native',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;