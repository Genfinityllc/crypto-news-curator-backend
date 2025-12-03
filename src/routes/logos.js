const express = require('express');
// const multer = require('multer'); // Temporarily disabled for deployment
const SVGLogoService = require('../services/svgLogoService');
const logger = require('../utils/logger');

const router = express.Router();
const svgLogoService = new SVGLogoService();

// Multer temporarily disabled for deployment
// const upload = multer({ ... });

/**
 * GET /api/logos
 * Get all cryptocurrency logos
 */
router.get('/', async (req, res) => {
  try {
    const logos = await svgLogoService.getAllLogos();
    
    res.json({
      success: true,
      count: logos.length,
      data: logos
    });
  } catch (error) {
    logger.error('❌ Error getting all logos:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve logos',
      message: error.message
    });
  }
});

/**
 * GET /api/logos/stats
 * Get logo statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await svgLogoService.getLogoStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('❌ Error getting logo stats:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve logo statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/logos/:symbol
 * Get specific cryptocurrency logo
 */
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const logo = await svgLogoService.getLogoBySymbol(symbol);
    
    if (!logo) {
      return res.status(404).json({
        success: false,
        error: 'Logo not found',
        message: `No logo found for ${symbol}`
      });
    }
    
    res.json({
      success: true,
      data: logo
    });
  } catch (error) {
    logger.error(`❌ Error getting logo for ${req.params.symbol}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve logo',
      message: error.message
    });
  }
});

/**
 * GET /api/logos/:symbol/controlnet/:type
 * Get ControlNet conditioning image for a cryptocurrency
 */
router.get('/:symbol/controlnet/:type', async (req, res) => {
  try {
    const { symbol, type } = req.params;
    
    if (!['canny', 'depth', 'pose'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ControlNet type',
        message: 'Type must be one of: canny, depth, pose'
      });
    }
    
    const imageBuffer = await svgLogoService.getControlNetImage(symbol, type);
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="${symbol}_${type}.png"`);
    res.send(imageBuffer);
  } catch (error) {
    logger.error(`❌ Error getting ControlNet image for ${req.params.symbol}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve ControlNet image',
      message: error.message
    });
  }
});

/**
 * POST /api/logos/detect
 * Detect cryptocurrency from article content and return logo info
 */
router.post('/detect', async (req, res) => {
  try {
    const { title, content } = req.body;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Title is required'
      });
    }
    
    const result = await svgLogoService.detectAndGetLogo(title, content);
    
    if (!result) {
      return res.json({
        success: true,
        detected: false,
        message: 'No cryptocurrency detected'
      });
    }
    
    res.json({
      success: true,
      detected: true,
      cryptocurrency: result.detected,
      keyword: result.keyword,
      logo: result.logo
    });
  } catch (error) {
    logger.error('❌ Error detecting cryptocurrency:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to detect cryptocurrency',
      message: error.message
    });
  }
});

/**
 * POST /api/logos
 * Upload new cryptocurrency logo (JSON payload)
 */
router.post('/', async (req, res) => {
  try {
    const { symbol, name, svgContent } = req.body;
    
    if (!symbol || !name || !svgContent) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'symbol, name, and svgContent are required'
      });
    }
    
    // Validate SVG content
    if (!svgContent.trim().startsWith('<svg')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid SVG content',
        message: 'Content must be valid SVG markup'
      });
    }
    
    const logo = await svgLogoService.upsertLogo(symbol, name, svgContent);
    
    res.json({
      success: true,
      message: 'Logo successfully uploaded and processed',
      data: logo
    });
  } catch (error) {
    logger.error('❌ Error uploading logo:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to upload logo',
      message: error.message
    });
  }
});

/**
 * POST /api/logos/upload
 * Upload new cryptocurrency logo (file upload) - TEMPORARILY DISABLED
 */
router.post('/upload', async (req, res) => {
  res.status(501).json({ 
    success: false, 
    error: 'File upload temporarily disabled during deployment' 
  });
});

/**
 * PUT /api/logos/:symbol
 * Update existing cryptocurrency logo
 */
router.put('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { name, svgContent } = req.body;
    
    if (!name || !svgContent) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'name and svgContent are required'
      });
    }
    
    // Check if logo exists
    const existing = await svgLogoService.getLogoBySymbol(symbol);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Logo not found',
        message: `No logo found for ${symbol}`
      });
    }
    
    const logo = await svgLogoService.upsertLogo(symbol, name, svgContent);
    
    res.json({
      success: true,
      message: 'Logo successfully updated and processed',
      data: logo
    });
  } catch (error) {
    logger.error(`❌ Error updating logo for ${req.params.symbol}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update logo',
      message: error.message
    });
  }
});

/**
 * DELETE /api/logos/:symbol
 * Delete cryptocurrency logo
 */
router.delete('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    // Check if logo exists
    const existing = await svgLogoService.getLogoBySymbol(symbol);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Logo not found',
        message: `No logo found for ${symbol}`
      });
    }
    
    await svgLogoService.deleteLogo(symbol);
    
    res.json({
      success: true,
      message: `Logo for ${symbol} successfully deleted`
    });
  } catch (error) {
    logger.error(`❌ Error deleting logo for ${req.params.symbol}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to delete logo',
      message: error.message
    });
  }
});

/**
 * POST /api/logos/reprocess
 * Reprocess all logos (admin operation)
 */
router.post('/reprocess', async (req, res) => {
  try {
    const results = await svgLogoService.reprocessAllLogos();
    
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;
    
    res.json({
      success: true,
      message: `Reprocessing completed: ${successful} successful, ${failed} failed`,
      results: results
    });
  } catch (error) {
    logger.error('❌ Error reprocessing logos:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to reprocess logos',
      message: error.message
    });
  }
});

// Multer error handler temporarily disabled

module.exports = router;