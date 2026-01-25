const express = require('express');
const router = express.Router();
const StyleCatalogService = require('../services/styleCatalogService');
const logger = require('../utils/logger');

const styleCatalog = new StyleCatalogService();

/**
 * GET /api/style-catalog - Get all available styles with sample images
 * This is the main endpoint for the frontend style picker
 */
router.get('/', async (req, res) => {
  try {
    logger.info('📋 Fetching style catalog for frontend');

    const styles = styleCatalog.getAllStyles();
    const categories = styleCatalog.getCategories();

    res.json({
      success: true,
      styles,
      categories,
      totalCount: styles.length
    });

  } catch (error) {
    logger.error('❌ Failed to fetch style catalog:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch style catalog',
      message: error.message
    });
  }
});

/**
 * GET /api/style-catalog/categories - Get available categories
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = styleCatalog.getCategories();

    res.json({
      success: true,
      categories
    });

  } catch (error) {
    logger.error('❌ Failed to fetch categories:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
      message: error.message
    });
  }
});

/**
 * GET /api/style-catalog/category/:category - Get styles by category
 */
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const styles = styleCatalog.getStylesByCategory(category);

    res.json({
      success: true,
      category,
      styles,
      count: styles.length
    });

  } catch (error) {
    logger.error('❌ Failed to fetch styles by category:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch styles by category',
      message: error.message
    });
  }
});

/**
 * GET /api/style-catalog/style/:styleId - Get a specific style
 */
router.get('/style/:styleId', async (req, res) => {
  try {
    const { styleId } = req.params;
    const style = styleCatalog.getStyle(styleId);

    if (!style) {
      return res.status(404).json({
        success: false,
        error: `Style not found: ${styleId}`
      });
    }

    res.json({
      success: true,
      style
    });

  } catch (error) {
    logger.error('❌ Failed to fetch style:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch style',
      message: error.message
    });
  }
});

/**
 * GET /api/style-catalog/search - Search styles by keyword
 */
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query (q) is required'
      });
    }

    const styles = styleCatalog.searchStyles(q);

    res.json({
      success: true,
      query: q,
      styles,
      count: styles.length
    });

  } catch (error) {
    logger.error('❌ Failed to search styles:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to search styles',
      message: error.message
    });
  }
});

/**
 * GET /api/style-catalog/prompt/:styleId - Get the prompt for a style (internal use)
 * Used by the generation service to get the exact prompt
 */
router.get('/prompt/:styleId', async (req, res) => {
  try {
    const { styleId } = req.params;
    const { logoSymbol = 'LOGO' } = req.query;

    const prompt = styleCatalog.getStylePrompt(styleId, logoSymbol);

    res.json({
      success: true,
      styleId,
      logoSymbol,
      prompt
    });

  } catch (error) {
    logger.error('❌ Failed to get style prompt:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get style prompt',
      message: error.message
    });
  }
});

/**
 * GET /api/style-catalog/validate - Validate that all sample images exist
 */
router.get('/validate', async (req, res) => {
  try {
    const results = styleCatalog.validateSampleImages();
    const allExist = results.every(r => r.exists);
    const missing = results.filter(r => !r.exists);

    res.json({
      success: true,
      valid: allExist,
      total: results.length,
      existing: results.filter(r => r.exists).length,
      missing: missing.map(r => r.filename)
    });

  } catch (error) {
    logger.error('❌ Failed to validate sample images:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to validate sample images',
      message: error.message
    });
  }
});

module.exports = router;
