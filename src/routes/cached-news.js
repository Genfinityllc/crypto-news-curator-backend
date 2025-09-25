const express = require('express');
const router = express.Router();
const articlesCacheService = require('../services/articlesCacheService');
const logger = require('../utils/logger');

// Get all news articles with intelligent caching for ultra-fast responses
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      network,
      category,
      sortBy = 'publishedAt',
      search,
      breaking = false,
      forceRefresh = false
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      network,
      category,
      sortBy,
      search,
      breaking: breaking === 'true',
      forceRefresh: forceRefresh === 'true'
    };

    logger.info(`Fetching articles with options:`, options);

    // Use the optimized caching service
    const result = await articlesCacheService.getArticles(options);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        cached: result.cached,
        cacheKey: result.cacheKey,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error fetching articles',
        error: result.error
      });
    }

  } catch (error) {
    logger.error('Error in articles endpoint:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching articles',
      error: error.message
    });
  }
});

// Get breaking news with caching
router.get('/breaking', async (req, res) => {
  try {
    const { forceRefresh = false } = req.query;
    
    const result = await articlesCacheService.getBreakingNews(forceRefresh === 'true');
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        cached: result.cached,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error fetching breaking news',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error fetching breaking news:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching breaking news',
      error: error.message
    });
  }
});

// Get trending networks with caching
router.get('/trending', async (req, res) => {
  try {
    const { forceRefresh = false } = req.query;
    
    const result = await articlesCacheService.getTrendingNetworks(forceRefresh === 'true');
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        cached: result.cached,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error fetching trending networks',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error fetching trending networks:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching trending networks',
      error: error.message
    });
  }
});

// Cache management endpoints
router.get('/cache/stats', (req, res) => {
  try {
    const stats = articlesCacheService.getCacheStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting cache stats:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error getting cache stats',
      error: error.message
    });
  }
});

router.post('/cache/clear', (req, res) => {
  try {
    const invalidated = articlesCacheService.invalidateArticlesCache();
    res.json({
      success: true,
      message: `Invalidated ${invalidated} cache entries`,
      invalidated,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error clearing cache:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error clearing cache',
      error: error.message
    });
  }
});

router.post('/cache/preload', async (req, res) => {
  try {
    await articlesCacheService.preloadCache();
    res.json({
      success: true,
      message: 'Cache preloaded successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error preloading cache:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error preloading cache',
      error: error.message
    });
  }
});

module.exports = router;
