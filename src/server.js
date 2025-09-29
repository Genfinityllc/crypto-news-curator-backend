const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const { testSupabaseConnection } = require('./config/supabase');
const rateLimit = require('express-rate-limit');
const { autoUpdateService } = require('./services/autoUpdateService');
const { websocketService } = require('./services/websocketService');
const cleanupService = require('./services/cleanupService');
const tempCleanupService = require('./services/tempCleanupService');
const pressReleaseService = require('./services/pressReleaseService');

// Load environment variables
dotenv.config(); // Force Railway redeploy - Nano Banana integration complete

// Import routes
const newsRoutes = require('./routes/supabase-news');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const cryptoRoutes = require('./routes/crypto');
const adminRoutes = require('./routes/admin');

// Try to load Firebase routes (graceful fallback if dependencies missing)
let firebaseAuthRoutes = null;
try {
  firebaseAuthRoutes = require('./routes/firebase-auth');
} catch (error) {
  console.warn('Firebase dependencies not installed. Firebase auth routes disabled.');
}


// Import services
const { initializeCronJobs } = require('./services/cronService');
const { simpleCronService } = require('./services/simpleCronService');

// Skip Sequelize models to avoid association errors

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');

// Import logger
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;

// Set NODE_ENV to production if not set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// Test Supabase connection
testSupabaseConnection()
  .then((connected) => {
    if (connected) {
      logger.info('Supabase connection successful');
    } else {
      logger.warn('Supabase connection failed, using sample data');
    }
  })
  .catch((error) => {
    logger.error('Supabase connection error:', error);
    logger.info('Continuing with sample data fallback');
  });

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000, // 5 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500, // limit each IP to 500 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(limiter);

// Serve temporary images  
app.use('/temp', express.static(path.join(__dirname, '..', 'temp')));

// Serve screenshot images for fallback cases
app.use('/screenshots', express.static(path.join(__dirname, '..', 'screenshots')));

// Serve uploaded logos
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/news', newsRoutes);
app.use('/api/unified-news', require('./routes/unified-news')); // Unified news endpoint - single source of truth
app.use('/api/cached-news', require('./routes/cached-news')); // New ultra-fast cached route
app.use('/api/fast-news', require('./routes/fast-news')); // Simple ultra-fast cached route
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/crypto-market', require('./routes/cryptoMarket'));
app.use('/api/enhanced-news', require('./routes/enhancedNews'));
app.use('/api/enhanced-client-news', require('./routes/enhanced-client-news'));
app.use('/api/article-management', require('./routes/article-management'));
app.use('/api/cron-manual', require('./routes/cron-manual'));
app.use('/api/auto-update', require('./routes/auto-update'));
app.use('/api/temp-cleanup', require('./routes/temp-cleanup')); // Temp file management for Railway
app.use('/api/press-releases', require('./routes/press-releases')); // Legal PRNewswire workaround - keyword extraction
app.use('/api/client-networks', require('./routes/client-networks')); // Client network metadata with logos
app.use('/api/logo-upload', require('./routes/logo-upload')); // Logo upload system for client networks
// REMOVED: app.use('/api/test-data', require('./routes/test-data')); // Fake articles removed

// Conditionally add Firebase auth routes if available
if (firebaseAuthRoutes) {
  app.use('/api/firebase-auth', firebaseAuthRoutes.router);
  console.log('✅ Firebase auth routes enabled at /api/firebase-auth');
} else {
  console.log('⚠️  Firebase auth routes disabled (missing dependencies)');
}


// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use(errorHandler);

// Create HTTP server and start it
const server = http.createServer(app);

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize WebSocket service
  websocketService.initialize(server);
  
  // Initialize cron jobs after server starts
  initializeCronJobs();
  
  // Start simple cron service (more reliable than node-cron on cloud platforms)
  setTimeout(() => {
    simpleCronService.start();
    logger.info('🚀 Simple cron service started');
  }, 5000); // Wait 5 seconds for other services to initialize
  
  // Start enhanced auto-update service
  setTimeout(() => {
    autoUpdateService.start();
    logger.info('🚀 Enhanced auto-update service started');
    
    // Start cleanup service to prevent Railway deployment timeouts
    cleanupService.startScheduledCleanup();
    // Run initial cleanup
    cleanupService.runCleanup();
    
    // 🧹 START TEMP FILE CLEANUP - PREVENTS RAILWAY DEPLOYMENT FAILURES
    tempCleanupService.startScheduledCleanup();
    tempCleanupService.runCleanup().then(stats => {
      logger.info(`🎉 Initial temp cleanup: ${stats.filesDeleted} files, ${(stats.spaceFreed / 1024 / 1024).toFixed(1)}MB freed`);
    }).catch(error => {
      logger.error('Initial temp cleanup failed:', error);
    });
    
    // 🏛️ START PRESS RELEASE MONITORING - HOURLY KEYWORD EXTRACTION
    const pressReleaseInterval = pressReleaseService.startHourlyMonitoring();
    logger.info('🏛️ Press release monitoring started - hourly keyword extraction active');
    
    // Store interval for cleanup
    global.pressReleaseMonitoringInterval = pressReleaseInterval;
    
  }, 7000); // Wait 7 seconds for other services to initialize
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  simpleCronService.stop();
  autoUpdateService.stop();
  tempCleanupService.stop();
  if (global.pressReleaseMonitoringInterval) {
    pressReleaseService.stopMonitoring(global.pressReleaseMonitoringInterval);
  }
  websocketService.shutdown();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  simpleCronService.stop();
  autoUpdateService.stop();
  tempCleanupService.stop();
  if (global.pressReleaseMonitoringInterval) {
    pressReleaseService.stopMonitoring(global.pressReleaseMonitoringInterval);
  }
  websocketService.shutdown();
  server.close(() => {
    process.exit(0);
  });
});

module.exports = app;

