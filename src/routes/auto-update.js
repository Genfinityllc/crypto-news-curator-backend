const express = require('express');
const router = express.Router();
const { autoUpdateService } = require('../services/autoUpdateService');
const { websocketService } = require('../services/websocketService');
const { simpleCronService } = require('../services/simpleCronService');
const logger = require('../utils/logger');

// Middleware to check if auto-update service is available
const checkService = (req, res, next) => {
  if (!autoUpdateService) {
    return res.status(503).json({
      success: false,
      message: 'Auto-update service is not available'
    });
  }
  next();
};

// Get auto-update service status
router.get('/status', checkService, (req, res) => {
  try {
    const status = autoUpdateService.getStatus();
    const health = autoUpdateService.isHealthy();
    
    res.json({
      success: true,
      data: {
        ...status,
        health
      }
    });
  } catch (error) {
    logger.error('Error getting auto-update status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get service status',
      error: error.message
    });
  }
});

// Start auto-update service
router.post('/start', checkService, (req, res) => {
  try {
    if (autoUpdateService.isRunning) {
      return res.status(400).json({
        success: false,
        message: 'Auto-update service is already running'
      });
    }

    autoUpdateService.start();
    
    // Broadcast status change via WebSocket
    if (websocketService.isStarted) {
      websocketService.broadcastToChannel('system-status', {
        type: 'service-control',
        action: 'started',
        service: 'auto-update',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Auto-update service started via API');
    
    res.json({
      success: true,
      message: 'Auto-update service started successfully',
      data: autoUpdateService.getStatus()
    });
  } catch (error) {
    logger.error('Error starting auto-update service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start auto-update service',
      error: error.message
    });
  }
});

// Stop auto-update service
router.post('/stop', checkService, (req, res) => {
  try {
    if (!autoUpdateService.isRunning) {
      return res.status(400).json({
        success: false,
        message: 'Auto-update service is not running'
      });
    }

    autoUpdateService.stop();
    
    // Broadcast status change via WebSocket
    if (websocketService.isStarted) {
      websocketService.broadcastToChannel('system-status', {
        type: 'service-control',
        action: 'stopped',
        service: 'auto-update',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Auto-update service stopped via API');
    
    res.json({
      success: true,
      message: 'Auto-update service stopped successfully',
      data: autoUpdateService.getStatus()
    });
  } catch (error) {
    logger.error('Error stopping auto-update service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop auto-update service',
      error: error.message
    });
  }
});

// Restart auto-update service
router.post('/restart', checkService, (req, res) => {
  try {
    const wasRunning = autoUpdateService.isRunning;
    
    if (wasRunning) {
      autoUpdateService.stop();
    }
    
    autoUpdateService.start();
    
    // Broadcast status change via WebSocket
    if (websocketService.isStarted) {
      websocketService.broadcastToChannel('system-status', {
        type: 'service-control',
        action: 'restarted',
        service: 'auto-update',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Auto-update service restarted via API');
    
    res.json({
      success: true,
      message: 'Auto-update service restarted successfully',
      data: autoUpdateService.getStatus()
    });
  } catch (error) {
    logger.error('Error restarting auto-update service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restart auto-update service',
      error: error.message
    });
  }
});

// Trigger manual update
router.post('/trigger', checkService, async (req, res) => {
  try {
    if (!autoUpdateService.isRunning) {
      return res.status(400).json({
        success: false,
        message: 'Auto-update service is not running'
      });
    }

    logger.info('Manual update triggered via API');
    
    // Don't wait for completion to avoid timeout
    autoUpdateService.triggerUpdate().catch(error => {
      logger.error('Manual update failed:', error);
    });
    
    res.json({
      success: true,
      message: 'Manual update triggered successfully',
      note: 'Update is running in background. Check status or subscribe to WebSocket for updates.'
    });
  } catch (error) {
    logger.error('Error triggering manual update:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger manual update',
      error: error.message
    });
  }
});

// Update configuration
router.patch('/config', checkService, (req, res) => {
  try {
    const { config } = req.body;
    
    if (!config || typeof config !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid configuration provided'
      });
    }

    // Validate configuration values
    const validKeys = ['normalInterval', 'intensiveInterval', 'marketHoursInterval', 'backoffMultiplier', 'maxBackoff', 'retryAttempts'];
    const invalidKeys = Object.keys(config).filter(key => !validKeys.includes(key));
    
    if (invalidKeys.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid configuration keys: ${invalidKeys.join(', ')}`
      });
    }

    autoUpdateService.updateConfig(config);
    
    logger.info('Auto-update configuration updated via API:', config);
    
    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: autoUpdateService.getStatus()
    });
  } catch (error) {
    logger.error('Error updating auto-update configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update configuration',
      error: error.message
    });
  }
});

// Get health check
router.get('/health', checkService, (req, res) => {
  try {
    const health = autoUpdateService.isHealthy();
    const statusCode = health.healthy ? 200 : 503;
    
    res.status(statusCode).json({
      success: health.healthy,
      data: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting auto-update health:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get health status',
      error: error.message
    });
  }
});

// Get metrics
router.get('/metrics', checkService, (req, res) => {
  try {
    const status = autoUpdateService.getStatus();
    const websocketStats = websocketService.getStats();
    
    res.json({
      success: true,
      data: {
        autoUpdate: status.metrics,
        websocket: websocketStats,
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    logger.error('Error getting auto-update metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get metrics',
      error: error.message
    });
  }
});

// WebSocket statistics
router.get('/websocket/stats', (req, res) => {
  try {
    const stats = websocketService.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting WebSocket stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get WebSocket statistics',
      error: error.message
    });
  }
});

// Broadcast message via WebSocket
router.post('/websocket/broadcast', (req, res) => {
  try {
    const { channel, message, toAll = false } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    let sentCount;
    
    if (toAll) {
      sentCount = websocketService.broadcastToAll(message);
    } else {
      if (!channel) {
        return res.status(400).json({
          success: false,
          message: 'Channel is required when not broadcasting to all'
        });
      }
      sentCount = websocketService.broadcastToChannel(channel, message);
    }
    
    res.json({
      success: true,
      message: `Message broadcasted successfully`,
      data: {
        sentToClients: sentCount,
        channel: toAll ? 'all' : channel
      }
    });
  } catch (error) {
    logger.error('Error broadcasting WebSocket message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to broadcast message',
      error: error.message
    });
  }
});

// Simple Cron Service endpoints

// Get simple cron status
router.get('/simple-cron/status', (req, res) => {
  try {
    const status = simpleCronService.getStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting simple cron status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get simple cron status',
      error: error.message
    });
  }
});

// Start simple cron service
router.post('/simple-cron/start', (req, res) => {
  try {
    simpleCronService.start();
    
    res.json({
      success: true,
      message: 'Simple cron service started successfully',
      data: simpleCronService.getStatus()
    });
  } catch (error) {
    logger.error('Error starting simple cron service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start simple cron service',
      error: error.message
    });
  }
});

// Stop simple cron service
router.post('/simple-cron/stop', (req, res) => {
  try {
    simpleCronService.stop();
    
    res.json({
      success: true,
      message: 'Simple cron service stopped successfully',
      data: simpleCronService.getStatus()
    });
  } catch (error) {
    logger.error('Error stopping simple cron service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop simple cron service',
      error: error.message
    });
  }
});

// Trigger manual RSS update via simple cron
router.post('/simple-cron/trigger', async (req, res) => {
  try {
    logger.info('Manual RSS update triggered via simple cron');
    
    // Don't wait for completion to avoid timeout
    simpleCronService.triggerUpdate().catch(error => {
      logger.error('Simple cron manual update failed:', error);
    });
    
    res.json({
      success: true,
      message: 'Manual RSS update triggered via simple cron service',
      note: 'Update is running in background. Check status for updates.'
    });
  } catch (error) {
    logger.error('Error triggering simple cron update:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger simple cron update',
      error: error.message
    });
  }
});

module.exports = router;