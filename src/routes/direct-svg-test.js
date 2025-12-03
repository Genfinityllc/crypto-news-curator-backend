const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Minimal test route
router.get('/health', (req, res) => {
  logger.info('🔧 Direct SVG test health endpoint called');
  res.json({
    success: true,
    service: 'direct-svg-test',
    status: 'operational',
    message: 'Test route working correctly'
  });
});

module.exports = router;