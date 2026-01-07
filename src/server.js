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
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: [
    'https://crypto-news-frontend-ruddy.vercel.app',
    'https://crypto-news-frontend-ioih8fxg4-valors-projects-03f742a5.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
}));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(limiter);

// Serve temporary images  
app.use('/temp', express.static(path.join(__dirname, '..', 'temp')));

// Serve generated cover images
app.use('/temp/generated-covers', express.static(path.join(__dirname, '..', 'temp', 'generated-covers')));

// Serve coin compositor images
app.use('/temp/coin-images', express.static(path.join(__dirname, '..', 'temp', 'coin-images')));

// Serve universal style images  
app.use('/temp/universal-styles', express.static(path.join(__dirname, '..', 'temp', 'universal-styles')));

// Serve downloaded LoRA images with CORS headers
app.use('/temp/lora-images', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
}, express.static(path.join(__dirname, '..', 'temp', 'lora-images')));

// Serve working LoRA generated images
app.use('/temp/working-lora', express.static(path.join(__dirname, '..', 'temp', 'working-lora')));

// Serve VectorFusion generated images with CORS headers
app.use('/temp/vectorfusion-images', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
}, express.static(path.join(__dirname, '..', 'temp', 'vectorfusion-images')));

// Serve Direct SVG rendered images with CORS headers
app.use('/temp/direct-svg-renders', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
}, express.static(path.join(__dirname, '..', 'temp', 'direct-svg-renders')));

// Serve Simple SVG rendered images with CORS headers
app.use('/temp/simple-svg-renders', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
}, express.static(path.join(__dirname, '..', 'temp', 'simple-svg-renders')));

// Serve ControlNet generated images with CORS headers
app.use('/temp/controlnet-images', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
}, express.static(path.join(__dirname, '..', 'temp', 'controlnet-images')));

// Serve screenshot images for fallback cases
app.use('/screenshots', express.static(path.join(__dirname, '..', 'screenshots')));

// Serve uploaded logos
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Serve AI generated covers
app.use('/ai-covers', express.static(path.join(__dirname, '..', 'ai-cover-generator', 'style_outputs')));

// Proxy images from external AI service
app.get('/ai-service-proxy/*', async (req, res) => {
  try {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const imagePath = req.path.replace('/ai-service-proxy', '');
    const imageUrl = `${aiServiceUrl}${imagePath}`;
    
    const response = await require('axios').get(imageUrl, { responseType: 'stream' });
    
    res.set('Content-Type', response.headers['content-type']);
    res.set('Content-Length', response.headers['content-length']);
    
    response.data.pipe(res);
  } catch (error) {
    res.status(404).json({ error: 'Image not found' });
  }
});

// Health check endpoint - Railway compatible
console.log('🚀 Health endpoint registration complete');
app.get('/health', async (req, res) => {
  try {
    // Basic health indicators
    const health = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      service: 'crypto-news-curator-backend',
      version: '1.0.0'
    };

    // Test critical services
    try {
      // Test Supabase connection
      const { testSupabaseConnection } = require('./config/supabase');
      const supabaseHealthy = await Promise.race([
        testSupabaseConnection(),
        new Promise(resolve => setTimeout(() => resolve(false), 5000))
      ]);
      health.services = {
        supabase: supabaseHealthy ? 'healthy' : 'degraded'
      };
    } catch (error) {
      health.services = {
        supabase: 'degraded'
      };
    }

    // Return success even if some services are degraded
    res.status(200).json(health);
  } catch (error) {
    // Return error status for Railway
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message,
      service: 'crypto-news-curator-backend'
    });
  }
});

// Simple healthcheck for Railway (backup)
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// API routes
app.use('/api/news', newsRoutes);
app.use('/api/ai-cover', require('./routes/ai-cover')); // LoRA AI Cover Generator endpoint
app.use('/api/lora-archive', require('./routes/lora-archive')); // LoRA Archive Browser
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
app.use('/api/logos', require('./routes/logos')); // SVG logo management and ControlNet preprocessing v1.1
app.use('/api/admin-svg', require('./routes/admin-svg-upload')); // Admin SVG bulk upload
app.use('/api/vectorfusion', require('./routes/vectorfusion')); // VectorFusion mathematical SVG geometry preservation
app.use('/api/vector-native', require('./routes/vector-native')); // Vector-native AI generation for exact geometry
// Direct SVG routes with error handling
try {
  app.use('/api/direct-svg', require('./routes/direct-svg')); // Direct SVG rendering with 3D effects (Option 1)
  console.log('✅ Direct SVG routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading Direct SVG routes:', error.message);
}

try {
  app.use('/api/direct-svg-test', require('./routes/direct-svg-test')); // Test route for debugging
  console.log('✅ Direct SVG test routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading Direct SVG test routes:', error.message);
}

// Two-Step Logo Generation - Perfect accuracy + Style scenes
try {
  app.use('/api/two-step-logo', require('./routes/two-step-logo')); // Perfect SVG isolation + Scene compositing
  console.log('✅ Two-Step Logo routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading Two-Step Logo routes:', error.message);
}

// PNG ControlNet Logo Generation - 2024 Optimal Settings for Exact Logo Accuracy
try {
  app.use('/api/controlnet-png', require('./routes/controlnet-png')); // PNG logos with optimal ControlNet settings
  console.log('✅ PNG ControlNet routes loaded successfully - 2024 Enhanced');
} catch (error) {
  console.error('❌ Error loading PNG ControlNet routes:', error.message);
  console.error('❌ Full error:', error);
}

// Hyper-Realistic Coin Compositor - Two-Stage Exact Logo Compositing
try {
  app.use('/api/coin-compositor', require('./routes/coin-compositor')); // Hyper-realistic coins with exact logos
  console.log('✅ Coin Compositor routes loaded successfully - Two-stage compositing');
} catch (error) {
  console.error('❌ Error loading Coin Compositor routes:', error.message);
  console.error('❌ Full error:', error);
}

// Universal Style Compositor - Diverse Generation Types with Exact Logo Accuracy
try {
  app.use('/api/universal-styles', require('./routes/universal-styles')); // Diverse styles beyond just coins
  console.log('✅ Universal Style Compositor routes loaded successfully - Multiple generation types');
} catch (error) {
  console.error('❌ Error loading Universal Style Compositor routes:', error.message);
  console.error('❌ Full error:', error);
}
// REMOVED: app.use('/api/test-data', require('./routes/test-data')); // Fake articles removed

// Conditionally add Firebase auth routes if available
if (firebaseAuthRoutes) {
  app.use('/api/firebase-auth', firebaseAuthRoutes.router);
  console.log('✅ Firebase auth routes enabled at /api/firebase-auth');
} else {
  console.log('⚠️  Firebase auth routes disabled (missing dependencies)');
}

// 📊 AI OUTPUT MONITORING DASHBOARD
const outputMonitor = require('./services/outputMonitorService');

// 🧪 WAVESPEED API TEST ENDPOINT
app.get('/api/test-wavespeed', async (req, res) => {
  const axios = require('axios');
  const sharp = require('sharp');
  
  if (!process.env.WAVESPEED_API_KEY) {
    return res.json({ success: false, error: 'WAVESPEED_API_KEY not set' });
  }
  
  try {
    // Create a simple test control image (white circle on black background)
    const testControlImage = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 3,
        background: { r: 0, g: 0, b: 0 }
      }
    })
    .composite([{
      input: Buffer.from(`<svg width="512" height="512"><circle cx="256" cy="256" r="150" fill="white"/></svg>`),
      blend: 'over'
    }])
    .png()
    .toBuffer();
    
    const controlImageBase64 = testControlImage.toString('base64');
    
    // Correct Wavespeed API format with control_image
    const response = await axios.post('https://api.wavespeed.ai/api/v3/wavespeed-ai/flux-controlnet-union-pro-2.0', {
      prompt: "A blue cryptocurrency logo floating in space, 3D metallic, professional lighting, futuristic",
      control_image: `data:image/png;base64,${controlImageBase64}`,
      size: "1024*1024",
      num_inference_steps: 20,
      num_images: 1
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.WAVESPEED_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000
    });
    
    res.json({
      success: true,
      message: 'Wavespeed ControlNet API working!',
      jobId: response.data.id,
      status: response.data.status,
      data: response.data
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      apiKeyPrefix: process.env.WAVESPEED_API_KEY?.substring(0, 8)
    });
  }
});

// 🔑 API KEY DIAGNOSTIC ENDPOINT
app.get('/api/verify-keys', (req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    keys: {
      WAVESPEED_API_KEY: process.env.WAVESPEED_API_KEY ? `✅ Set (${process.env.WAVESPEED_API_KEY.substring(0, 8)}...)` : '❌ Not set',
      HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY ? `✅ Set (${process.env.HUGGINGFACE_API_KEY.substring(0, 8)}...)` : '❌ Not set',
      HUGGINGFACE_LORA_MODEL: process.env.HUGGINGFACE_LORA_MODEL || '❌ Not set (using default)',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set',
      SUPABASE_URL: process.env.SUPABASE_URL ? '✅ Set' : '❌ Not set'
    },
    controlNetPriority: [
      process.env.WAVESPEED_API_KEY ? '1. Wavespeed ControlNet ✅' : '1. Wavespeed ControlNet ❌ (skipped)',
      process.env.HUGGINGFACE_API_KEY ? '2. HuggingFace ControlNet ✅' : '2. HuggingFace ControlNet ❌ (skipped)',
      '3. Free LoRA + Logo Composite (fallback)',
      '4. Emergency Composite (last resort)'
    ]
  });
});

// Get monitoring dashboard summary
app.get('/api/monitor/dashboard', (req, res) => {
  try {
    const dashboard = outputMonitor.getDashboard();
    res.json({
      success: true,
      ...dashboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get rewrite history
app.get('/api/monitor/rewrites', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = outputMonitor.getRewriteHistory(limit);
    res.json({
      success: true,
      count: history.length,
      rewrites: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get image generation history
app.get('/api/monitor/images', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = outputMonitor.getImageHistory(limit);
    res.json({
      success: true,
      count: history.length,
      images: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get failed generations for debugging
app.get('/api/monitor/failures', (req, res) => {
  try {
    const failures = outputMonitor.getFailedGenerations();
    res.json({
      success: true,
      count: failures.length,
      failures: failures,
      message: failures.length > 0 
        ? `⚠️ ${failures.length} failed/fallback generations detected`
        : '✅ No recent failures'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

console.log('📊 Output Monitor Dashboard enabled at /api/monitor/*');

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
  logger.info(`🚀 Server running on port ${PORT} - LoRA interceptor fixed!`);
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

