const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { testSupabaseConnection } = require('./config/supabase');
const rateLimit = require('express-rate-limit');

// Load environment variables
dotenv.config();

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

// Skip Sequelize models to avoid association errors

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');

// Import logger
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

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
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(limiter);

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
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/crypto-market', require('./routes/cryptoMarket'));
app.use('/api/enhanced-news', require('./routes/enhancedNews'));

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

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize cron jobs after server starts
  initializeCronJobs();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;
