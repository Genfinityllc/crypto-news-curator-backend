const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const StyleCatalogService = require('../services/styleCatalogService');
const { getSupabaseClient } = require('../config/supabase');
const logger = require('../utils/logger');

const styleCatalog = new StyleCatalogService();
const STYLE_EXAMPLES_DIR = path.join(__dirname, '../../style-examples');
const BUCKET_NAME = 'style-examples';

/**
 * GET /api/style-catalog/image/:styleId - Serve style sample image directly
 * Fallback for when Supabase storage isn't configured
 */
router.get('/image/:styleId', async (req, res) => {
  try {
    const { styleId } = req.params;
    const style = styleCatalog.getStyle(styleId);

    if (!style) {
      return res.status(404).json({ error: 'Style not found' });
    }

    const imagePath = path.join(STYLE_EXAMPLES_DIR, style.filename);

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    fs.createReadStream(imagePath).pipe(res);

  } catch (error) {
    logger.error('❌ Failed to serve style image:', error.message);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

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

/**
 * POST /api/style-catalog/upload-to-supabase - Upload style examples to Supabase storage
 * Admin endpoint to upload local style example images to Supabase
 */
router.post('/upload-to-supabase', async (req, res) => {
  try {
    logger.info('📤 Starting upload of style examples to Supabase storage');

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Supabase client not available'
      });
    }

    // Ensure bucket exists
    try {
      await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 10485760
      });
      logger.info(`✅ Created bucket: ${BUCKET_NAME}`);
    } catch (e) {
      logger.info(`ℹ️ Bucket ${BUCKET_NAME} may already exist`);
    }

    // Check if directory exists
    if (!fs.existsSync(STYLE_EXAMPLES_DIR)) {
      return res.status(404).json({
        success: false,
        error: 'Style examples directory not found on server'
      });
    }

    // Get all PNG files
    const files = fs.readdirSync(STYLE_EXAMPLES_DIR)
      .filter(f => f.endsWith('.png') && !f.startsWith('.'));

    logger.info(`📋 Found ${files.length} images to upload`);

    const results = [];
    const errors = [];

    for (const filename of files) {
      try {
        const filepath = path.join(STYLE_EXAMPLES_DIR, filename);
        const fileBuffer = fs.readFileSync(filepath);

        logger.info(`📤 Uploading: ${filename} (${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB)`);

        const { data, error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filename, fileBuffer, {
            contentType: 'image/png',
            cacheControl: '31536000',
            upsert: true
          });

        if (error) {
          logger.error(`❌ Failed to upload ${filename}:`, error.message);
          errors.push({ filename, error: error.message });
        } else {
          const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filename);

          results.push({ filename, url: urlData.publicUrl });
          logger.info(`✅ Uploaded: ${filename}`);
        }
      } catch (fileError) {
        logger.error(`❌ Error processing ${filename}:`, fileError.message);
        errors.push({ filename, error: fileError.message });
      }
    }

    res.json({
      success: results.length > 0,
      uploaded: results.length,
      failed: errors.length,
      total: files.length,
      results,
      errors
    });

  } catch (error) {
    logger.error('❌ Failed to upload style examples:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to upload style examples',
      message: error.message
    });
  }
});

module.exports = router;
