const express = require('express');
const router = express.Router();
const articlePurgeService = require('../services/articlePurgeService');
const logger = require('../utils/logger');

// Get article statistics
router.get('/stats', async (req, res) => {
  try {
    logger.info('📊 Fetching article statistics...');
    const stats = await articlePurgeService.getArticleStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Error fetching article stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Trigger article purge (can be called manually or by cron)
router.post('/purge', async (req, res) => {
  try {
    logger.info('🗑️ Manual article purge triggered...');
    const result = await articlePurgeService.purgeOldArticles();
    
    res.json({
      success: true,
      data: result,
      message: `Purged ${result.purgedOld} old articles`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Error during manual purge:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get real-time article counts for frontend buttons
router.get('/counts', async (req, res) => {
  try {
    const counts = await articlePurgeService.logArticleCounts();
    
    // Format for frontend use
    const frontendCounts = {
      all: counts.total || 0,
      breaking: counts.breaking || 0,
      client: counts.client || 0,
      hedera: counts.hedera || 0,
      xdc_network: counts.xdc_network || 0,
      algorand: counts.algorand || 0,
      constellation: counts.constellation || 0,
      hashpack: counts.hashpack || 0
    };
    
    res.json({
      success: true,
      data: frontendCounts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Error fetching article counts:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: {
        all: 0,
        breaking: 0,
        client: 0
      }
    });
  }
});

module.exports = router;