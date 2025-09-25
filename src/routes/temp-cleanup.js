const express = require('express');
const router = express.Router();
const tempCleanupService = require('../services/tempCleanupService');
const logger = require('../utils/logger');

/**
 * 🧹 TEMP CLEANUP API ENDPOINTS
 * 
 * Provides manual control over temp file cleanup for Railway deployment management
 */

// Get cleanup statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await tempCleanupService.getStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting cleanup stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cleanup stats',
      error: error.message
    });
  }
});

// Manual cleanup trigger  
router.post('/run', async (req, res) => {
  try {
    logger.info('🧹 Manual cleanup triggered via API');
    const stats = await tempCleanupService.runCleanup();
    
    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      data: {
        filesDeleted: stats.filesDeleted,
        spaceFreedMB: (stats.spaceFreed / 1024 / 1024).toFixed(1),
        cleanupTimeSeconds: stats.cleanupTime
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Manual cleanup failed:', error);
    res.status(500).json({
      success: false,
      message: 'Cleanup failed',
      error: error.message
    });
  }
});

// Emergency cleanup (removes almost everything)
router.post('/emergency', async (req, res) => {
  try {
    logger.warn('🚨 EMERGENCY CLEANUP triggered via API');
    const freedSpace = await tempCleanupService.emergencyCleanup();
    
    res.json({
      success: true,
      message: 'Emergency cleanup completed',
      data: {
        spaceFreedMB: (freedSpace / 1024 / 1024).toFixed(1)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Emergency cleanup failed:', error);
    res.status(500).json({
      success: false,
      message: 'Emergency cleanup failed',
      error: error.message
    });
  }
});

module.exports = router;