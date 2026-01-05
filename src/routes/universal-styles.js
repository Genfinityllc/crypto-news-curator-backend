const express = require('express');
const router = express.Router();
const UniversalStyleCompositor = require('../services/universalStyleCompositor');
const logger = require('../utils/logger');

const universalStyleCompositor = new UniversalStyleCompositor();

/**
 * GET /api/universal-styles - Get available style options
 */
router.get('/', async (req, res) => {
  try {
    logger.info('📋 Fetching available universal styles');
    
    const availableStyles = universalStyleCompositor.getAvailableStyles();
    
    res.json({
      success: true,
      styles: availableStyles,
      totalCount: availableStyles.length
    });
    
  } catch (error) {
    logger.error('❌ Failed to fetch universal styles:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available styles',
      message: error.message
    });
  }
});

/**
 * POST /api/universal-styles/generate - Generate image with specific style
 */
router.post('/generate', async (req, res) => {
  try {
    const { title, logoSymbol, style = 'digital', options = {} } = req.body;
    
    if (!title || !logoSymbol) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title and logoSymbol are required'
      });
    }
    
    logger.info(`🎨 Universal style generation request: ${style} for ${logoSymbol}`);
    logger.info(`📝 Title: ${title}`);
    
    const result = await universalStyleCompositor.generateStyleWithLogo(
      title,
      logoSymbol,
      style,
      options
    );
    
    res.json(result);
    
  } catch (error) {
    logger.error('❌ Universal style generation failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate universal style image',
      message: error.message,
      service: 'universal_style_compositor'
    });
  }
});

/**
 * GET /api/universal-styles/image/:imageId - Get generated image URL
 */
router.get('/image/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    
    if (!imageId) {
      return res.status(400).json({
        success: false,
        error: 'Image ID is required'
      });
    }
    
    const imageUrl = universalStyleCompositor.getImageUrl(imageId);
    
    res.json({
      success: true,
      imageId,
      imageUrl
    });
    
  } catch (error) {
    logger.error('❌ Failed to get image URL:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get image URL',
      message: error.message
    });
  }
});

/**
 * POST /api/universal-styles/batch-generate - Generate multiple styles for comparison
 */
router.post('/batch-generate', async (req, res) => {
  try {
    const { title, logoSymbol, styles = ['digital', 'trading', 'abstract'], options = {} } = req.body;
    
    if (!title || !logoSymbol) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title and logoSymbol are required'
      });
    }
    
    logger.info(`🎨 Batch generation request for ${logoSymbol}: [${styles.join(', ')}]`);
    
    const results = [];
    
    for (const style of styles) {
      try {
        logger.info(`🎯 Generating ${style} style...`);
        
        const result = await universalStyleCompositor.generateStyleWithLogo(
          title,
          logoSymbol,
          style,
          { ...options, batchMode: true }
        );
        
        results.push({
          style,
          ...result
        });
        
      } catch (styleError) {
        logger.error(`❌ Failed to generate ${style} style:`, styleError.message);
        results.push({
          style,
          success: false,
          error: styleError.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    res.json({
      success: successCount > 0,
      results,
      summary: {
        total: styles.length,
        successful: successCount,
        failed: styles.length - successCount
      }
    });
    
  } catch (error) {
    logger.error('❌ Batch generation failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate batch styles',
      message: error.message
    });
  }
});

module.exports = router;