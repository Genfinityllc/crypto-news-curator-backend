const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const fs = require('fs').promises;
const multer = require('multer');
const { testSupabaseConnection, uploadImageToStorage } = require('./config/supabase');
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

// Serve public logos (for cover generator)
app.use('/logos', express.static(path.join(__dirname, '..', 'public', 'logos')));

// Serve AI generated covers
app.use('/ai-covers', express.static(path.join(__dirname, '..', 'ai-cover-generator', 'style_outputs')));

// Serve style example images for the frontend style picker
app.use('/style-examples', express.static(path.join(__dirname, '..', 'style-examples')));

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

// Style Catalog - Curated style examples with Wavespeed prompts for frontend picker
try {
  app.use('/api/style-catalog', require('./routes/style-catalog')); // Style picker for frontend
  console.log('✅ Style Catalog routes loaded successfully - Frontend style picker');
} catch (error) {
  console.error('❌ Error loading Style Catalog routes:', error.message);
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

// 🎨 AUTO-COVER GENERATION ENDPOINT
// Frontend can call this to get/generate a cover for any article
app.post('/api/auto-cover', async (req, res) => {
  const logger = require('./utils/logger');
  const { detectCryptocurrency, networkToSymbol } = require('./services/cryptoDetectionService');
  
  try {
    const { title, network, cryptocurrency, content, articleId } = req.body;
    
    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }
    
    // Use UNIFIED crypto detection service for consistent, accurate detection
    let detectedCrypto = cryptocurrency;
    let detectionResult = null;
    
    if (!detectedCrypto) {
      // Try to convert network name to symbol first (if article was already tagged)
      if (network && network !== 'General') {
        detectedCrypto = networkToSymbol(network);
      }
      
      // Always re-detect from content for accuracy (may override incorrect tags)
      detectionResult = detectCryptocurrency(title, content || '', { debug: true });
      
      if (detectionResult && detectionResult.confidence > 25) {
        // Use detection result if confidence is reasonable
        // This can OVERRIDE incorrect article tags
        detectedCrypto = detectionResult.crypto;
        logger.info(`🎯 Crypto detected with ${detectionResult.confidence}% confidence: ${detectedCrypto} (${detectionResult.displayName})`);
      } else if (!detectedCrypto) {
        // No detection and no network tag - use default
        detectedCrypto = 'BTC';
        logger.info('⚠️ No crypto detected, defaulting to BTC');
      }
    }
    
    logger.info(`🎨 Auto-cover generation for: ${title.substring(0, 50)}... (${detectedCrypto})`);
    
    // Use ControlNet service for generation
    // Parameters: title, logoSymbol, style, options
    const ControlNetService = require('./services/controlNetService');
    const controlNetService = new ControlNetService();
    
    const result = await controlNetService.generateWithAdvancedControlNet(
      title,
      detectedCrypto,  // logoSymbol is the second parameter
      'professional',
      { content: content || '' }
    );
    
    if (result.success) {
      logger.info(`✅ 🎨 Auto-cover generated for ${detectedCrypto}: ${result.imageUrl}`);
      
      // If articleId provided, update the article in Supabase with the new cover
      let databaseUpdated = false;
      if (articleId) {
        try {
          const { updateArticleCoverImage } = require('./config/supabase');
          await updateArticleCoverImage(articleId, result.imageUrl);
          databaseUpdated = true;
          logger.info(`✅ Article ${articleId} cover image updated in database`);
        } catch (dbError) {
          logger.warn(`⚠️ Failed to update article ${articleId} cover in database:`, dbError.message);
        }
      }
      
      return res.json({
        success: true,
        imageUrl: result.imageUrl,
        localPath: result.localPath,
        cryptocurrency: detectedCrypto,
        method: result.metadata?.method || 'controlnet',
        databaseUpdated: databaseUpdated,
        message: '🎨 Universal LoRA cover auto-generated!'
      });
    } else {
      throw new Error(result.error || 'Generation failed');
    }
    
  } catch (error) {
    const logger = require('./utils/logger');
    logger.error('Auto-cover generation failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Cover generation failed'
    });
  }
});

// 🧪 TEST ARTICLE REWRITE - Debug endpoint
app.post('/api/test-rewrite', async (req, res) => {
  const logger = require('./utils/logger');
  
  try {
    const { title, content } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Title and content required' });
    }
    
    logger.info(`🧪 Testing article rewrite for: ${title.substring(0, 50)}...`);
    
    const { generateFullLengthRewrite } = require('./services/enhanced-ai-rewrite');
    
    const startTime = Date.now();
    const result = await generateFullLengthRewrite(title, content);
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      duration: `${duration}ms`,
      originalTitle: title,
      rewrittenTitle: result.title,
      wordCount: result.wordCount,
      readabilityScore: result.readabilityScore,
      factChecked: result.factChecked,
      validationPassed: result.validationPassed,
      model: result.model || 'fallback',
      contentPreview: result.content?.substring(0, 500) + '...',
      isFallback: !result.factChecked && !result.validationPassed,
      fallbackReason: result.fallbackReason || null,
      fallbackErrorCode: result.fallbackErrorCode || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack?.substring(0, 500)
    });
  }
});

// 🧪 FULL WAVESPEED CONTROLNET TEST - Debug endpoint
app.get('/api/test-controlnet-full', async (req, res) => {
  const axios = require('axios');
  const sharp = require('sharp');
  const fs = require('fs').promises;
  const path = require('path');
  
  const symbol = req.query.symbol || 'XRP';
  const steps = [];
  
  try {
    steps.push('Starting full ControlNet test...');
    
    // Step 1: Load logo
    const ControlNetService = require('./services/controlNetService');
    const controlNetService = new ControlNetService();
    
    steps.push(`Loading ${symbol} logo...`);
    const logoData = await controlNetService.getPngLogo(symbol);
    if (!logoData) {
      return res.json({ success: false, error: `No logo found for ${symbol}`, steps });
    }
    steps.push(`✅ Logo loaded: ${logoData.source}, ${logoData.buffer.length} bytes`);
    
    // Step 2: Preprocess for ControlNet
    steps.push('Preprocessing logo for ControlNet...');
    const controlImage = await controlNetService.preprocessPngForControlNet(logoData.buffer, 1024);
    const controlImageBase64 = controlImage.toString('base64');
    steps.push(`✅ Control image: ${controlImage.length} bytes`);
    
    // Step 3: Build high-quality prompt
    const prompt = `Futuristic cryptocurrency scene with ${symbol} logo as a glowing 3D holographic element floating in a cyberpunk environment, volumetric lighting, neon blue and purple accents, digital particles, ultra detailed, 8k, cinematic composition, the ${symbol} symbol is prominently featured as the centerpiece with realistic metallic and glass materials`;
    steps.push(`✅ Prompt: ${prompt.substring(0, 100)}...`);
    
    // Step 4: Submit to Wavespeed
    steps.push('Submitting to Wavespeed ControlNet...');
    const wavespeedKey = process.env.WAVESPEED_API_KEY;
    
    const submitResponse = await axios.post('https://api.wavespeed.ai/api/v3/wavespeed-ai/flux-controlnet-union-pro-2.0', {
      prompt: prompt,
      control_image: `data:image/png;base64,${controlImageBase64}`,
      size: "1024*1024",
      num_inference_steps: 30,
      guidance_scale: 7.5,
      controlnet_conditioning_scale: 0.85,
      control_guidance_start: 0,
      control_guidance_end: 1.0,
      num_images: 1,
      output_format: "jpeg"
    }, {
      headers: {
        'Authorization': `Bearer ${wavespeedKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });
    
    const jobData = submitResponse.data.data || submitResponse.data;
    steps.push(`✅ Job submitted: ${jobData.id}`);
    
    // Step 5: Poll for result
    steps.push('Polling for result...');
    let result = null;
    let attempts = 0;
    const maxAttempts = 20;
    
    while (attempts < maxAttempts) {
      attempts++;
      await new Promise(r => setTimeout(r, 3000));
      
      const statusResponse = await axios.get(`https://api.wavespeed.ai/api/v3/predictions/${jobData.id}/result`, {
        headers: { 'Authorization': `Bearer ${wavespeedKey}` }
      });
      
      const statusData = statusResponse.data.data || statusResponse.data;
      steps.push(`Poll ${attempts}: status=${statusData.status}`);
      
      if (statusData.status === 'completed') {
        result = statusData;
        break;
      } else if (statusData.status === 'failed') {
        return res.json({ success: false, error: statusData.error || 'Generation failed', steps });
      }
    }
    
    if (!result || !result.outputs || !result.outputs[0]) {
      return res.json({ success: false, error: 'Timeout waiting for result', steps });
    }
    
    // Step 6: Download and save
    steps.push(`Downloading image from: ${result.outputs[0]}`);
    const imageResponse = await axios.get(result.outputs[0], { responseType: 'arraybuffer' });
    
    const imageId = `test_controlnet_${Date.now()}`;
    const imagePath = path.join(__dirname, '..', 'temp', 'controlnet-images', `${imageId}.png`);
    await fs.mkdir(path.dirname(imagePath), { recursive: true });
    await fs.writeFile(imagePath, imageResponse.data);
    
    const imageUrl = `https://crypto-news-curator-backend-production.up.railway.app/temp/controlnet-images/${imageId}.png`;
    steps.push(`✅ Image saved: ${imageUrl}`);
    
    res.json({
      success: true,
      imageUrl,
      symbol,
      steps,
      jobId: jobData.id,
      method: 'wavespeed_controlnet_full_test'
    });
    
  } catch (error) {
    steps.push(`❌ Error: ${error.message}`);
    if (error.response) {
      steps.push(`Response status: ${error.response.status}`);
      steps.push(`Response data: ${JSON.stringify(error.response.data || {}).substring(0, 300)}`);
    }
    res.json({ success: false, error: error.message, steps });
  }
});

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

// 🎨 COVER GENERATOR API ENDPOINTS

// Cache for networks list (refreshes every 5 minutes)
let networksCache = null;
let networksCacheTime = 0;
const NETWORKS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Precomputed networks and companies list for instant loading
const NETWORKS_LIST = [
  // Cryptocurrencies
  { symbol: 'BTC', name: 'Bitcoin', type: 'network' },
  { symbol: 'ETH', name: 'Ethereum', type: 'network' },
  { symbol: 'XRP', name: 'XRP (Ripple)', type: 'network' },
  { symbol: 'SOL', name: 'Solana', type: 'network' },
  { symbol: 'HBAR', name: 'Hedera Hashgraph', type: 'network' },
  { symbol: 'ADA', name: 'Cardano', type: 'network' },
  { symbol: 'AVAX', name: 'Avalanche', type: 'network' },
  { symbol: 'DOT', name: 'Polkadot', type: 'network' },
  { symbol: 'MATIC', name: 'Polygon', type: 'network' },
  { symbol: 'LINK', name: 'Chainlink', type: 'network' },
  { symbol: 'UNI', name: 'Uniswap', type: 'network' },
  { symbol: 'DOGE', name: 'Dogecoin', type: 'network' },
  { symbol: 'LTC', name: 'Litecoin', type: 'network' },
  { symbol: 'ATOM', name: 'Cosmos', type: 'network' },
  { symbol: 'NEAR', name: 'NEAR Protocol', type: 'network' },
  { symbol: 'ALGO', name: 'Algorand', type: 'network' },
  { symbol: 'XLM', name: 'Stellar', type: 'network' },
  { symbol: 'SUI', name: 'Sui', type: 'network' },
  { symbol: 'APT', name: 'Aptos', type: 'network' },
  { symbol: 'ARB', name: 'Arbitrum', type: 'network' },
  { symbol: 'OP', name: 'Optimism', type: 'network' },
  { symbol: 'INJ', name: 'Injective', type: 'network' },
  { symbol: 'SEI', name: 'Sei', type: 'network' },
  { symbol: 'TIA', name: 'Celestia', type: 'network' },
  { symbol: 'PEPE', name: 'Pepe', type: 'network' },
  { symbol: 'SHIB', name: 'Shiba Inu', type: 'network' },
  { symbol: 'BNB', name: 'Binance', type: 'network' },
  { symbol: 'TRX', name: 'Tron', type: 'network' },
  { symbol: 'TON', name: 'Toncoin', type: 'network' },
  { symbol: 'FIL', name: 'Filecoin', type: 'network' },
  { symbol: 'XMR', name: 'Monero', type: 'network' },
  { symbol: 'CRO', name: 'Cronos', type: 'network' },
  { symbol: 'RUNE', name: 'THORChain', type: 'network' },
  { symbol: 'TAO', name: 'Bittensor', type: 'network' },
  { symbol: 'QNT', name: 'Quant', type: 'network' },
  { symbol: 'ONDO', name: 'Ondo', type: 'network' },
  { symbol: 'IMX', name: 'Immutable X', type: 'network' },
  { symbol: 'DAG', name: 'Constellation (DAG)', type: 'network' },
  { symbol: 'XDC', name: 'XDC Network', type: 'network' },
  { symbol: 'USDC', name: 'USD Coin', type: 'network' },
  { symbol: 'USDT', name: 'Tether', type: 'network' },
  { symbol: 'ZEC', name: 'Zcash', type: 'network' },
  { symbol: 'CANTON', name: 'Canton', type: 'network' },
  { symbol: 'MONAD', name: 'Monad', type: 'network' },
  { symbol: 'AXELAR', name: 'Axelar', type: 'network' },
];

const COMPANIES_LIST = [
  // Companies/Institutions
  { symbol: 'BLACKROCK', name: 'BlackRock', type: 'company' },
  { symbol: 'GRAYSCALE', name: 'Grayscale', type: 'company' },
  { symbol: '21SHARES', name: '21Shares', type: 'company' },
  { symbol: 'WLFI', name: 'World Liberty Financial', type: 'company' },
  { symbol: 'BITMINE', name: 'Bitmine', type: 'company' },
  { symbol: 'MOONPAY', name: 'MoonPay', type: 'company' },
  { symbol: 'NVIDIA', name: 'NVIDIA', type: 'company' },
  { symbol: 'PAXOS', name: 'Paxos', type: 'company' },
  { symbol: 'ROBINHOOD', name: 'Robinhood', type: 'company' },
  { symbol: 'HASHPACK', name: 'HashPack (PACK)', type: 'company' },
  { symbol: 'KRAKEN', name: 'Kraken', type: 'company' },
  { symbol: 'KUCOIN', name: 'KuCoin', type: 'company' },
  { symbol: 'BINANCE', name: 'Binance Exchange', type: 'company' },
  { symbol: 'BITGO', name: 'BitGo', type: 'company' },
  { symbol: 'METAMASK', name: 'MetaMask', type: 'company' },
  { symbol: 'MAGICEDEN', name: 'Magic Eden', type: 'company' },
  { symbol: 'UPHOLD', name: 'Uphold', type: 'company' },
  { symbol: 'IMF', name: 'IMF', type: 'company' },
  { symbol: 'CFTC', name: 'CFTC', type: 'company' },
  // Newly added companies/institutions (from PNG folder)
  { symbol: 'ABERDEEN', name: 'Aberdeen', type: 'company' },
  { symbol: 'ARROW', name: 'Arrow', type: 'company' },
  { symbol: 'ARCHAX', name: 'Archax', type: 'company' },
  { symbol: 'AVERYDENNISON', name: 'Avery Dennison', type: 'company' },
  { symbol: 'BLOCKCHAINFORENERGY', name: 'Blockchain for Energy', type: 'company' },
  { symbol: 'BOEING', name: 'Boeing', type: 'company' },
  { symbol: 'CONFRA', name: 'Confra', type: 'company' },
  { symbol: 'DELL', name: 'Dell', type: 'company' },
  { symbol: 'DENTONS', name: 'Dentons', type: 'company' },
  { symbol: 'DEUTSCHETELEKOM', name: 'Deutsche Telekom', type: 'company' },
  { symbol: 'DLAPIPER', name: 'DLA Piper', type: 'company' },
  { symbol: 'EDF', name: 'EDF', type: 'company' },
  { symbol: 'EFTPOS', name: 'Eftpos', type: 'company' },
  { symbol: 'GBBC', name: 'GBBC', type: 'company' },
  { symbol: 'GOOGLE', name: 'Google', type: 'company' },
  { symbol: 'HITACHI', name: 'Hitachi', type: 'company' },
  { symbol: 'IBM', name: 'IBM', type: 'company' },
  { symbol: 'IITMADRAS', name: 'IIT Madras', type: 'company' },
  { symbol: 'LGELECTRONICS', name: 'LG Electronics', type: 'company' },
  { symbol: 'LSE', name: 'LSE', type: 'company' },
  { symbol: 'MAGALU', name: 'Magalu', type: 'company' },
  { symbol: 'MONDELEZ', name: 'Mondelez', type: 'company' },
  { symbol: 'NOMURA', name: 'Nomura', type: 'company' },
  { symbol: 'SERVICENOW', name: 'ServiceNow', type: 'company' },
  { symbol: 'SHINHANBANK', name: 'Shinhan Bank', type: 'company' },
  { symbol: 'SWIRLDSLABS', name: 'Swirlds Labs', type: 'company' },
  { symbol: 'TATACOMMUNICATIONS', name: 'Tata Communications', type: 'company' },
  { symbol: 'UBISOFT', name: 'Ubisoft', type: 'company' },
  { symbol: 'WORLDPAY', name: 'Worldpay', type: 'company' },
  { symbol: 'ZAIN', name: 'Zain', type: 'company' },
  { symbol: 'AXIOM', name: 'Axiom', type: 'company' },
  { symbol: 'PLUGANDPLAY', name: 'Plug and Play', type: 'company' },
  { symbol: 'RAZE', name: 'Raze', type: 'company' },
  { symbol: 'RIPPLE', name: 'Ripple', type: 'company' },
  { symbol: 'COINBASE', name: 'Coinbase', type: 'company' },
];

// Dynamic lists for runtime additions (loaded from file if exists)
let DYNAMIC_NETWORKS = [];
let DYNAMIC_COMPANIES = [];

// Load dynamic logos from config file if exists
const DYNAMIC_LOGOS_FILE = path.join(__dirname, '../uploads/dynamic-logos.json');
async function loadDynamicLogos() {
  try {
    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, '../uploads');
    const pngLogosDir = path.join(__dirname, '../uploads/png-logos');
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      await fs.mkdir(pngLogosDir, { recursive: true });
    } catch (e) {
      // Directories might already exist
    }

    const data = await fs.readFile(DYNAMIC_LOGOS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    DYNAMIC_NETWORKS = parsed.networks || [];
    DYNAMIC_COMPANIES = parsed.companies || [];
    console.log(`📦 Loaded ${DYNAMIC_NETWORKS.length} dynamic networks and ${DYNAMIC_COMPANIES.length} dynamic companies`);
  } catch (error) {
    // File doesn't exist yet, that's fine
    DYNAMIC_NETWORKS = [];
    DYNAMIC_COMPANIES = [];
  }
}
// Load async but don't block startup
loadDynamicLogos().catch(e => console.log('Dynamic logos load skipped:', e.message));

async function saveDynamicLogos() {
  try {
    await fs.writeFile(DYNAMIC_LOGOS_FILE, JSON.stringify({
      networks: DYNAMIC_NETWORKS,
      companies: DYNAMIC_COMPANIES
    }, null, 2));
    logger.info(`💾 Saved dynamic logos config`);
  } catch (error) {
    logger.error(`❌ Failed to save dynamic logos: ${error.message}`);
  }
}

// Multer configuration for logo uploads
const logoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/png-logos'));
  },
  filename: function (req, file, cb) {
    // Use the symbol from request body, fallback to original filename
    const symbol = req.body.symbol || file.originalname.replace(/\.[^/.]+$/, '');
    cb(null, `${symbol}.png`);
  }
});

const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    // Accept PNG and JPG
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
      cb(null, true);
    } else {
      cb(new Error('Only PNG and JPG files are allowed'));
    }
  }
});

// POST /api/cover-generator/upload-logo - Upload a new logo (Valor admin only)
app.post('/api/cover-generator/upload-logo', logoUpload.single('logo'), async (req, res) => {
  try {
    const { symbol, name, type } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    if (!symbol || !name || !type) {
      // Delete the uploaded file if validation fails
      await fs.unlink(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: symbol, name, and type are required'
      });
    }

    if (type !== 'network' && type !== 'company') {
      await fs.unlink(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Type must be either "network" or "company"'
      });
    }

    const normalizedSymbol = symbol.toUpperCase().replace(/\s+/g, '');

    // Read the uploaded file and upload to Supabase Storage for persistence
    let supabaseUrl = null;
    try {
      const fileBuffer = await fs.readFile(req.file.path);
      const supabaseFilename = `${normalizedSymbol}.png`;
      supabaseUrl = await uploadImageToStorage(fileBuffer, supabaseFilename, 'logos');
      if (supabaseUrl) {
        logger.info(`☁️ Logo uploaded to Supabase Storage: ${supabaseUrl}`);
      }
    } catch (uploadErr) {
      logger.warn(`⚠️ Could not upload logo to Supabase Storage: ${uploadErr.message}`);
    }

    const logoEntry = {
      symbol: normalizedSymbol,
      name,
      type,
      supabaseUrl: supabaseUrl || null  // Store Supabase URL for persistence
    };

    // Add to dynamic list (or update if exists)
    if (type === 'network') {
      const existingIndex = DYNAMIC_NETWORKS.findIndex(n => n.symbol === normalizedSymbol);
      const builtinExists = NETWORKS_LIST.find(n => n.symbol === normalizedSymbol);

      if (existingIndex !== -1) {
        // Update existing entry
        DYNAMIC_NETWORKS[existingIndex] = logoEntry;
      } else if (!builtinExists) {
        DYNAMIC_NETWORKS.push(logoEntry);
      } else {
        // Built-in exists, add to dynamic to override with supabaseUrl
        DYNAMIC_NETWORKS.push(logoEntry);
      }
    } else {
      const existingIndex = DYNAMIC_COMPANIES.findIndex(c => c.symbol === normalizedSymbol);
      const builtinExists = COMPANIES_LIST.find(c => c.symbol === normalizedSymbol);

      if (existingIndex !== -1) {
        // Update existing entry
        DYNAMIC_COMPANIES[existingIndex] = logoEntry;
      } else if (!builtinExists) {
        DYNAMIC_COMPANIES.push(logoEntry);
      } else {
        // Built-in exists, add to dynamic to override with supabaseUrl
        DYNAMIC_COMPANIES.push(logoEntry);
      }
    }

    // Save dynamic logos to file
    await saveDynamicLogos();

    // Clear the networks cache so the new logo appears
    networksCache = null;
    networksCacheTime = 0;

    logger.info(`✅ Logo uploaded: ${normalizedSymbol} (${name}) as ${type}`);
    logger.info(`📁 File saved to: ${req.file.path}`);
    if (supabaseUrl) {
      logger.info(`☁️ Supabase URL: ${supabaseUrl}`);
    }

    res.json({
      success: true,
      message: `Logo "${name}" (${normalizedSymbol}) uploaded successfully as ${type}`,
      data: {
        symbol: normalizedSymbol,
        name,
        type,
        filename: req.file.filename,
        localPath: `/uploads/png-logos/${req.file.filename}`,
        supabaseUrl: supabaseUrl
      }
    });
  } catch (error) {
    logger.error(`❌ Logo upload failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to upload logo',
      message: error.message
    });
  }
});

// PUT /api/cover-generator/update-logo - Update a dynamic logo entry (admin only)
app.put('/api/cover-generator/update-logo', async (req, res) => {
  try {
    const { oldSymbol, newSymbol, newName, adminKey } = req.body;

    // Basic admin check
    if (adminKey !== 'valor-master-2024') {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    if (!oldSymbol || !newName) {
      return res.status(400).json({ success: false, error: 'oldSymbol and newName are required' });
    }

    const normalizedOldSymbol = oldSymbol.toUpperCase().replace(/\s+/g, '');
    const normalizedNewSymbol = (newSymbol || newName).toUpperCase().replace(/\s+/g, '');

    // Find and update in dynamic lists
    let found = false;

    // Check dynamic networks
    const networkIndex = DYNAMIC_NETWORKS.findIndex(n => n.symbol === normalizedOldSymbol);
    if (networkIndex !== -1) {
      DYNAMIC_NETWORKS[networkIndex] = {
        ...DYNAMIC_NETWORKS[networkIndex],
        symbol: normalizedNewSymbol,
        name: newName
      };
      found = true;
    }

    // Check dynamic companies
    const companyIndex = DYNAMIC_COMPANIES.findIndex(c => c.symbol === normalizedOldSymbol);
    if (companyIndex !== -1) {
      DYNAMIC_COMPANIES[companyIndex] = {
        ...DYNAMIC_COMPANIES[companyIndex],
        symbol: normalizedNewSymbol,
        name: newName
      };
      found = true;
    }

    if (!found) {
      return res.status(404).json({ success: false, error: `Logo with symbol ${normalizedOldSymbol} not found in dynamic logos` });
    }

    // Save and clear cache
    await saveDynamicLogos();
    networksCache = null;
    networksCacheTime = 0;

    logger.info(`✅ Logo updated: ${normalizedOldSymbol} -> ${normalizedNewSymbol} (${newName})`);

    res.json({
      success: true,
      message: `Logo updated from ${normalizedOldSymbol} to ${normalizedNewSymbol} (${newName})`
    });
  } catch (error) {
    logger.error(`❌ Logo update failed: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/cover-generator/delete-logo - Delete a dynamic logo entry (admin only)
app.delete('/api/cover-generator/delete-logo', async (req, res) => {
  try {
    const { symbol, adminKey } = req.body;

    // Basic admin check
    if (adminKey !== 'valor-master-2024') {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    if (!symbol) {
      return res.status(400).json({ success: false, error: 'symbol is required' });
    }

    const normalizedSymbol = symbol.toUpperCase().replace(/\s+/g, '');
    let found = false;

    // Remove from dynamic networks
    const networkIndex = DYNAMIC_NETWORKS.findIndex(n => n.symbol === normalizedSymbol);
    if (networkIndex !== -1) {
      DYNAMIC_NETWORKS.splice(networkIndex, 1);
      found = true;
    }

    // Remove from dynamic companies
    const companyIndex = DYNAMIC_COMPANIES.findIndex(c => c.symbol === normalizedSymbol);
    if (companyIndex !== -1) {
      DYNAMIC_COMPANIES.splice(companyIndex, 1);
      found = true;
    }

    if (!found) {
      return res.status(404).json({ success: false, error: `Logo with symbol ${normalizedSymbol} not found in dynamic logos` });
    }

    // Save and clear cache
    await saveDynamicLogos();
    networksCache = null;
    networksCacheTime = 0;

    logger.info(`✅ Logo deleted: ${normalizedSymbol}`);

    res.json({
      success: true,
      message: `Logo ${normalizedSymbol} deleted`
    });
  } catch (error) {
    logger.error(`❌ Logo delete failed: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/cover-generator/logo-info/:symbol - Get logo info with source
app.get('/api/cover-generator/logo-info/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const normalizedSymbol = symbol.toUpperCase().replace(/\s+/g, '');

    // Check for alias (e.g., TAO -> BITTENSOR)
    const aliasedSymbol = LOGO_SYMBOL_ALIASES[normalizedSymbol];
    const symbolsToTry = [normalizedSymbol];
    if (aliasedSymbol) symbolsToTry.push(aliasedSymbol);

    // 1. Check local uploads directory first (try both symbols)
    for (const sym of symbolsToTry) {
      const localPath = path.join(__dirname, '../uploads/png-logos', `${sym}.png`);
      try {
        await fs.access(localPath);
        return res.json({
          success: true,
          symbol: normalizedSymbol,
          source: 'uploaded',
          sourceLabel: 'Your Upload',
          previewUrl: `${process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app'}/api/cover-generator/logo-preview/${normalizedSymbol}`
        });
      } catch (e) {
        // Not found locally, continue
      }
    }

    // 2. Check Supabase Storage (try both symbols)
    const { getSupabaseClient } = require('./config/supabase');
    const client = getSupabaseClient();
    if (client) {
      for (const sym of symbolsToTry) {
        const filename = `${sym}.png`;
        const { data: urlData } = client.storage
          .from('logos')
          .getPublicUrl(filename);

        if (urlData?.publicUrl) {
          try {
            const axios = require('axios');
            const response = await axios.head(urlData.publicUrl, { timeout: 5000 });
            if (response.status === 200) {
              return res.json({
                success: true,
                symbol: normalizedSymbol,
                source: 'supabase',
                sourceLabel: 'Your Upload (Cloud)',
                previewUrl: `${process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app'}/api/cover-generator/logo-preview/${normalizedSymbol}`
              });
            }
          } catch (e) {
            // Not in Supabase with this symbol, try next
          }
        }
      }
    }

    // 3. Try CDN
    return res.json({
      success: true,
      symbol: normalizedSymbol,
      source: 'cdn',
      sourceLabel: 'Default Logo',
      previewUrl: `${process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app'}/api/cover-generator/logo-preview/${normalizedSymbol}`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Symbol aliases - map ticker symbols to logo filenames (case-insensitive, will try multiple)
const LOGO_SYMBOL_ALIASES = {
  // Ticker to full name mappings
  'TAO': 'BITTENSOR',
  'ADA': 'CARDANO',
  'RUNE': 'THORCHAIN',
  'TIA': 'CELESTIA',
  'CRO': 'CRONOS',
  'DOT': 'POLKADOT',
  'LINK': 'CHAINLINK',
  'XLM': 'STELLAR',
  'ATOM': 'COSMOS',
  'ALGO': 'ALGORAND',
  'FIL': 'FILECOIN',
  'DOGE': 'DOGECOIN',
  'LTC': 'LITECOIN',
  'SHIB': 'SHIBAINU',
  'TON': 'TONCOIN',
  'TRX': 'TRON',
  'UNI': 'UNISWAP',
  'ARB': 'ARBITRUM',
  'AVAX': 'AVALANCHE',
  'MATIC': 'POLYGON',
  'INJ': 'INJECTIVE',
  'APT': 'APTOS',
  'XMR': 'MONERO',
  'ZEC': 'ZCASH',
  'QNT': 'QUANT',
  'HBAR': 'HEDERA',
  'DAG': 'CONSTELLATION',
  // Company name variations
  'MCLARENRACING': 'MCLAREN',
  'MAGICEDEN': 'MAGICEDEN',
  'PLUGANDPLAY': 'PLUGANDPLAY',
  '21SHARES': '21SHARES'
};

// GET /api/cover-generator/logo-preview/:symbol - Get logo preview image
app.get('/api/cover-generator/logo-preview/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    let normalizedSymbol = symbol.toUpperCase().replace(/\s+/g, '');

    // Check for alias (e.g., TAO -> BITTENSOR)
    const aliasedSymbol = LOGO_SYMBOL_ALIASES[normalizedSymbol];

    // Set CORS headers for cross-origin image loading
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');

    // Symbols to try: original first, then alias
    const symbolsToTry = [normalizedSymbol];
    if (aliasedSymbol) symbolsToTry.push(aliasedSymbol);

    // 1. Check local uploads directory first (try both symbols)
    for (const sym of symbolsToTry) {
      const localPath = path.join(__dirname, '../uploads/png-logos', `${sym}.png`);
      try {
        await fs.access(localPath);
        const logoBuffer = await fs.readFile(localPath);
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=3600'); // 1 hour cache
        res.set('X-Logo-Source', 'uploaded');
        return res.send(logoBuffer);
      } catch (e) {
        // Not found locally, continue
      }
    }

    // 2. Check Supabase Storage (try both symbols)
    const { getSupabaseClient } = require('./config/supabase');
    const client = getSupabaseClient();
    if (client) {
      for (const sym of symbolsToTry) {
        const filename = `${sym}.png`;
        const { data: urlData } = client.storage
          .from('logos')
          .getPublicUrl(filename);

        if (urlData?.publicUrl) {
          try {
            const axios = require('axios');
            const response = await axios.get(urlData.publicUrl, {
              responseType: 'arraybuffer',
              timeout: 10000,
              validateStatus: (status) => status === 200
            });
            if (response.data && response.data.length > 500) {
              res.set('Content-Type', 'image/png');
              res.set('Cache-Control', 'public, max-age=3600');
              res.set('X-Logo-Source', 'supabase');
              return res.send(Buffer.from(response.data));
            }
          } catch (e) {
            // Not in Supabase with this symbol, try next
          }
        }
      }
    }

    // 3. Try CDN (cryptologos.cc)
    const slugMapping = {
      'BTC': 'bitcoin-btc', 'ETH': 'ethereum-eth', 'XRP': 'xrp-xrp',
      'BNB': 'bnb-bnb', 'SOL': 'solana-sol', 'ADA': 'cardano-ada',
      'DOGE': 'dogecoin-doge', 'DOT': 'polkadot-new-dot', 'MATIC': 'polygon-matic',
      'LINK': 'chainlink-link', 'AVAX': 'avalanche-avax', 'UNI': 'uniswap-uni',
      'ATOM': 'cosmos-atom', 'LTC': 'litecoin-ltc', 'NEAR': 'near-protocol-near',
      'ALGO': 'algorand-algo', 'XLM': 'stellar-xlm', 'HBAR': 'hedera-hbar',
      'FIL': 'filecoin-fil', 'ARB': 'arbitrum-arb', 'OP': 'optimism-ethereum-op',
      'SUI': 'sui-sui', 'APT': 'aptos-apt', 'INJ': 'injective-inj',
      'SEI': 'sei-sei', 'TIA': 'celestia-tia', 'PEPE': 'pepe-pepe',
      'SHIB': 'shiba-inu-shib', 'TON': 'toncoin-ton', 'TRX': 'tron-trx',
      'AAVE': 'aave-aave', 'IMX': 'immutable-x-imx', 'RUNE': 'thorchain-rune'
    };
    const slug = slugMapping[normalizedSymbol] || `${normalizedSymbol.toLowerCase()}-${normalizedSymbol.toLowerCase()}`;
    const cdnUrl = `https://cryptologos.cc/logos/${slug}-logo.png`;

    try {
      const axios = require('axios');
      const response = await axios.get(cdnUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: { 'User-Agent': 'Genfinity/1.0' }
      });
      if (response.status === 200 && response.data.length > 1000) {
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=3600');
        res.set('X-Logo-Source', 'cdn');
        return res.send(Buffer.from(response.data));
      }
    } catch (e) {
      // CDN failed
    }

    // No logo found - return 404
    res.status(404).json({ error: 'Logo not found', symbol: normalizedSymbol });
  } catch (error) {
    logger.error(`Logo preview error for ${req.params.symbol}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get list of available networks with logos - FAST cached version
app.get('/api/cover-generator/networks', async (req, res) => {
  try {
    // Return cached data if still valid
    if (networksCache && (Date.now() - networksCacheTime) < NETWORKS_CACHE_TTL) {
      return res.json(networksCache);
    }
    
    const fs = require('fs').promises;
    const pngDir = process.env.NODE_ENV === 'production' 
      ? '/app/public/logos'
      : '/Users/valorkopeny/Desktop/SVG CRYPTO LOGOS/PNG';
    
    // Get actual PNG files to verify availability
    let availablePngs = new Set();
    try {
      const files = await fs.readdir(pngDir);
      files.filter(f => f.toLowerCase().endsWith('.png')).forEach(f => {
        const baseName = f.replace(/\.png$/i, '').toUpperCase().replace(/\s+/g, '');
        availablePngs.add(baseName);
        // Also add the original case version
        availablePngs.add(f.replace(/\.png$/i, '').toUpperCase());
      });
    } catch (e) {
      // Use default list if directory not accessible
      logger.info('Using default networks list (PNG directory not accessible)');
    }
    
    // Build final list with availability status (including dynamic logos)
    // Deduplicate by symbol - dynamic entries override builtin entries
    const networkMap = new Map();
    NETWORKS_LIST.forEach(n => networkMap.set(n.symbol, n));
    DYNAMIC_NETWORKS.forEach(n => networkMap.set(n.symbol, n)); // Dynamic overrides builtin
    const allNetworks = Array.from(networkMap.values());

    const companyMap = new Map();
    COMPANIES_LIST.forEach(c => companyMap.set(c.symbol, c));
    DYNAMIC_COMPANIES.forEach(c => companyMap.set(c.symbol, c)); // Dynamic overrides builtin
    const allCompanies = Array.from(companyMap.values());

    // Check for logos - either local files, Supabase URL in entry, or assume true if no local files available
    const networks = allNetworks.map(n => ({
      ...n,
      hasLogo: n.supabaseUrl || availablePngs.size === 0 || availablePngs.has(n.symbol) || availablePngs.has(n.symbol.replace(/\s+/g, ''))
    })).sort((a, b) => a.name.localeCompare(b.name));

    const companies = allCompanies.map(c => ({
      ...c,
      hasLogo: c.supabaseUrl || availablePngs.size === 0 || availablePngs.has(c.symbol) || availablePngs.has(c.symbol.replace(/\s+/g, ''))
    })).sort((a, b) => a.name.localeCompare(b.name));
    
    // Cache the result
    networksCache = {
      success: true,
      count: networks.length + companies.length,
      networks,
      companies
    };
    networksCacheTime = Date.now();
    
    res.json(networksCache);
  } catch (error) {
    logger.error('Error listing networks:', error);
    // Return hardcoded list on error for instant response
    res.json({
      success: true,
      count: NETWORKS_LIST.length + COMPANIES_LIST.length,
      networks: NETWORKS_LIST,
      companies: COMPANIES_LIST
    });
  }
});

// Generate cover image for a network
app.post('/api/cover-generator/generate', async (req, res) => {
  const { network, additionalNetworks, title, style, customKeyword, styleId, bgColor, elementColor, accentLightColor, accentColor, lightingColor, customSubject, logoTextMode, logoMaterial, logoBaseColor, logoAccentLight } = req.body;

  if (!network) {
    return res.status(400).json({ success: false, error: 'Network symbol required' });
  }

  const startTime = Date.now();

  // Optional: extract user context from auth header for per-user prompt preferences
  let userId = null;
  let userEmail = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const idToken = authHeader.split('Bearer ')[1];
      const tokenParts = idToken.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        userId = payload.user_id || payload.sub || payload.uid || payload.email;
        userEmail = payload.email || payload.user_email || null;
      }
    } catch (e) {
      logger.warn('Could not decode token for generate:', e.message);
    }
  }

  // Combine primary and additional networks
  const allNetworks = [network.toUpperCase()];
  if (additionalNetworks && Array.isArray(additionalNetworks)) {
    additionalNetworks.forEach(n => {
      if (n && typeof n === 'string') {
        allNetworks.push(n.toUpperCase());
      }
    });
  }

  try {
    const ControlNetService = require('./services/controlNetService');
    const controlNetService = new ControlNetService();

    const networkLabel = allNetworks.join(' + ');
    const articleTitle = title || `${networkLabel} Cryptocurrency News`;

    // Get style prompt from catalog if styleId is provided
    let stylePrompt = null;
    if (styleId) {
      try {
        const StyleCatalogService = require('./services/styleCatalogService');
        const styleCatalog = new StyleCatalogService();
        // Build color overrides from 3 separate color fields, with legacy fallback
        const colorOverrides = (bgColor || elementColor || accentLightColor || lightingColor)
          ? { bgColor: bgColor || null, elementColor: elementColor || null, accentLightColor: accentLightColor || null, lightingColor: lightingColor || null }
          : accentColor
            ? { bgColor: null, elementColor: accentColor, accentLightColor: accentColor, lightingColor: null }
            : null;
        const logoOverrides = (logoMaterial || logoBaseColor || logoAccentLight)
          ? { logoMaterial: logoMaterial || null, logoBaseColor: logoBaseColor || null, logoAccentLight: logoAccentLight || null }
          : null;
        stylePrompt = styleCatalog.getStylePrompt(styleId, network.toUpperCase(), colorOverrides, customSubject || null, logoOverrides);
        const colorLog = colorOverrides ? `bg=${bgColor || 'default'} elem=${elementColor || accentColor || 'default'} accent=${accentLightColor || accentColor || 'default'}` : 'default colors';
        const logoLog = logoOverrides ? ` | logo: mat=${logoMaterial || 'default'} color=${logoBaseColor || 'default'} glow=${logoAccentLight || 'default'}` : '';
        logger.info(`🎨 Using style: ${styleId} [${colorLog}${logoLog}]${customSubject ? ` subject="${customSubject}"` : ''}`);
      } catch (e) {
        logger.warn(`Could not load style ${styleId}:`, e.message);
      }
    }

    const resolvedLogoTextMode = ['full', 'mark'].includes(logoTextMode) ? logoTextMode : 'full';

    logger.info(`🎨 Cover Generator: Creating ${networkLabel} cover (${allNetworks.length} logo(s))... ${customKeyword ? `(keyword: ${customKeyword})` : ''} ${styleId ? `(style: ${styleId})` : ''} (logoTextMode: ${resolvedLogoTextMode})`);

    const result = await controlNetService.generateWithAdvancedControlNet(
      articleTitle,
      network.toUpperCase(),
      style || 'professional',
      { content: '', customKeyword: customKeyword || null, userId, userEmail, additionalNetworks: allNetworks.slice(1), stylePrompt, logoTextMode: resolvedLogoTextMode }
    );
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    if (result.success) {
      res.json({
        success: true,
        imageUrl: result.imageUrl,
        network: network.toUpperCase(),
        method: result.metadata?.method || 'nano_banana_pro_3d',
        duration: `${duration}s`,
        promptUsed: result.metadata?.promptUsed || null,
        timestamp: new Date().toISOString(),
        // Include logo loading info
        requestedLogos: result.metadata?.requestedLogos,
        loadedLogos: result.metadata?.loadedLogos,
        missingLogos: result.metadata?.missingLogos,
        warnings: result.warnings
      });
    } else {
      throw new Error(result.error || 'Generation failed');
    }
  } catch (error) {
    logger.error('Cover generation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      duration: `${Math.round((Date.now() - startTime) / 1000)}s`
    });
  }
});

// IN-MEMORY COVER STORAGE (persists during server lifetime, fallback when DB fails)
const inMemoryCovers = new Map(); // userId -> [covers]

function addToMemoryStorage(userId, coverData) {
  if (!inMemoryCovers.has(userId)) {
    inMemoryCovers.set(userId, []);
  }
  const covers = inMemoryCovers.get(userId);
  covers.unshift({ ...coverData, savedAt: new Date().toISOString(), source: 'memory' });
  // Keep only last 100 per user
  if (covers.length > 100) {
    inMemoryCovers.set(userId, covers.slice(0, 100));
  }
  logger.info(`💾 Saved to memory storage for user ${userId}. Total: ${covers.length}`);
}

function getFromMemoryStorage(userId) {
  return inMemoryCovers.get(userId) || [];
}

// Firebase Auth Middleware for cover generator routes
const coverAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    logger.info(`🔐 Auth check: Authorization header ${authHeader ? 'present' : 'missing'}`);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('❌ No Bearer token in Authorization header');
      return res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];
    logger.info(`🔑 Token received: ${idToken.substring(0, 20)}...`);
    
    const { verifyFirebaseToken, getFirebaseAuth } = require('./config/firebase');
    
    // Check if Firebase is initialized
    const auth = getFirebaseAuth();
    if (!auth) {
      logger.error('❌ Firebase Auth not initialized - check FIREBASE_SERVICE_ACCOUNT env var');
      return res.status(500).json({
        success: false,
        error: 'Server authentication not configured'
      });
    }
    
    const decodedToken = await verifyFirebaseToken(idToken);
    logger.info(`✅ Token verified for user: ${decodedToken.uid}`);
    
    req.user = decodedToken;
    next();
    
  } catch (error) {
    logger.error('❌ Firebase auth error:', error.message);
    logger.error('   Full error:', error);
    res.status(401).json({
      success: false,
      error: `Invalid or expired token: ${error.message}`
    });
  }
};

// Save generation to user profile - ROBUST multi-fallback approach
app.post('/api/cover-generator/save', async (req, res) => {
  const { imageUrl, network, title } = req.body;
  
  logger.info(`📥 Save cover request: network=${network}, imageUrl=${imageUrl?.substring(0, 50)}...`);
  
  // Extract userId/email from token (flexible approach)
  let userId = null;
  let userEmail = null;
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const idToken = authHeader.split('Bearer ')[1];
      
      // First try Firebase Admin if available
      try {
        const { verifyFirebaseToken, getFirebaseAuth } = require('./config/firebase');
        const auth = getFirebaseAuth();
        if (auth) {
          const decodedToken = await verifyFirebaseToken(idToken);
          userId = decodedToken.uid;
          logger.info(`✅ Firebase verified: ${userId}`);
        }
      } catch (e) { /* Firebase not available */ }
      
      // Fallback: decode JWT manually
      if (!userId) {
        const tokenParts = idToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          userId = payload.user_id || payload.sub || payload.uid || payload.email;
          userEmail = payload.email || payload.user_email || userEmail;
          logger.info(`📧 Token decoded: ${userId}`);
        }
      }
    } catch (e) {
      logger.warn('Token extraction failed:', e.message);
    }
  }
  
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Login required' });
  }
  
  if (!imageUrl) {
    return res.status(400).json({ success: false, error: 'Image URL required' });
  }
  
  const coverData = {
    user_id: String(userId),
    image_url: imageUrl,
    network: network?.toUpperCase() || 'UNKNOWN',
    title: title || `${network} Cover`,
    created_at: new Date().toISOString()
  };
  
  let saved = false;
  let saveMethod = 'none';
  let savedData = null;
  
  // ATTEMPT 1: Supabase Client - use articles table with all REQUIRED columns
  try {
    const { getSupabaseClient } = require('./config/supabase');
    const supabase = getSupabaseClient();
    
    if (supabase) {
      // Required columns (NOT NULL): title, content, url, source, published_at
      const articleData = {
        title: `[USER_COVER] ${coverData.network}: ${coverData.title}`,
        url: coverData.image_url,
        source: `user_cover_${coverData.user_id}`,  // Mark as user cover with user ID
        content: JSON.stringify({
          type: 'user_generated_cover',
          user_id: coverData.user_id,
          user_email: userEmail || null,
          image_url: coverData.image_url,
          network: coverData.network,
          original_title: coverData.title,
          generated_at: coverData.created_at
        }),
        published_at: new Date().toISOString()
      };
      
      logger.info(`📝 Attempting articles insert: ${JSON.stringify(articleData).substring(0, 200)}`);
      
      const { data, error } = await supabase
        .from('articles')
        .insert(articleData)
        .select()
        .single();
      
      if (!error && data) {
        saved = true;
        saveMethod = 'supabase_articles';
        savedData = { 
          id: data.id,
          user_id: coverData.user_id,
          image_url: coverData.image_url,
          network: coverData.network,
          title: coverData.title,
          created_at: coverData.created_at
        };
        logger.info(`✅ Saved via Supabase articles table (id: ${data.id})`);
        
        // ALSO save to master account's covers (if configured and user isn't master)
        try {
          const PromptRefinementService = require('./services/promptRefinementService');
          const isMaster = PromptRefinementService.isMasterAccount(coverData.user_id, userEmail);
          const masterEmail = process.env.MASTER_ACCOUNT_EMAIL;
          const masterUid = process.env.MASTER_ACCOUNT_UID;
          const masterSourceId = masterUid || masterEmail;
          
          if (!isMaster && masterSourceId) {
            const masterArticleData = {
              title: `[USER_COVER] ${coverData.network}: ${coverData.title}`,
              url: coverData.image_url,
              source: `user_cover_${masterSourceId}`,
              content: JSON.stringify({
                type: 'user_generated_cover',
                user_id: masterSourceId,
                image_url: coverData.image_url,
                network: coverData.network,
                original_title: coverData.title,
                generated_at: coverData.created_at,
                original_user_id: coverData.user_id,
                original_user_email: userEmail || null
              }),
              published_at: new Date().toISOString()
            };
            
            const { error: masterError } = await supabase
              .from('articles')
              .insert(masterArticleData);
            
            if (masterError) {
              logger.warn(`Master cover save failed: ${masterError.message}`);
            } else {
              logger.info(`✅ Also saved to master account covers (${masterSourceId})`);
            }
          }
        } catch (masterSaveError) {
          logger.warn(`Master cover save skipped: ${masterSaveError.message}`);
        }
      } else {
        logger.error(`❌ Articles insert failed: ${error?.message}`);
      }
    }
  } catch (e) {
    logger.warn('Supabase attempt failed:', e.message);
  }
  
  // ATTEMPT 2: Direct HTTP to Supabase REST API
  if (!saved) {
    try {
      const axios = require('axios');
      const supabaseUrl = process.env.SUPABASE_URL?.trim();
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();
      
      if (supabaseUrl && supabaseKey) {
        const response = await axios.post(
          `${supabaseUrl}/rest/v1/user_generated_covers`,
          coverData,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            timeout: 10000,
            validateStatus: () => true
          }
        );
        
        if (response.status === 201 || response.status === 200) {
          saved = true;
          saveMethod = 'http';
          savedData = Array.isArray(response.data) ? response.data[0] : response.data;
          logger.info(`✅ Saved via direct HTTP (status ${response.status})`);
        } else {
          logger.warn(`HTTP insert status ${response.status}: ${JSON.stringify(response.data).substring(0, 100)}`);
        }
      }
    } catch (e) {
      logger.warn('Direct HTTP attempt failed:', e.message);
    }
  }
  
  // ATTEMPT 3: In-Memory Storage (always works, persists until server restart)
  if (!saved) {
    addToMemoryStorage(userId, coverData);
    saved = true;
    saveMethod = 'memory';
    savedData = { id: 'memory_' + Date.now(), ...coverData };
    logger.info(`✅ Saved to in-memory storage (fallback)`);
  }
  
  // ATTEMPT 4: Also save to local file (backup)
  try {
    const localStorePath = path.join(__dirname, '../data/local-covers.json');
    const fs = require('fs').promises;
    let localCovers = [];
    try {
      const existing = await fs.readFile(localStorePath, 'utf-8');
      localCovers = JSON.parse(existing);
    } catch (e) { /* file doesn't exist yet */ }
    
    // Add if not already there
    const exists = localCovers.some(c => c.image_url === imageUrl && c.user_id === userId);
    if (!exists) {
      localCovers.unshift({ ...coverData, saveMethod });
      await fs.mkdir(path.dirname(localStorePath), { recursive: true });
      await fs.writeFile(localStorePath, JSON.stringify(localCovers.slice(0, 500), null, 2));
    }
  } catch (e) {
    // Local file backup is optional
  }
  
  if (saved) {
    logger.info(`✅ Cover saved for ${userId} via ${saveMethod}`);
    res.json({ success: true, saved: savedData, method: saveMethod });
  } else {
    logger.error(`❌ All save methods failed for ${userId}`);
    res.status(500).json({ success: false, error: 'All save methods failed' });
  }
});

// COMPREHENSIVE DATABASE DIAGNOSTIC - Find what works and what doesn't
app.get('/api/cover-generator/db-diagnostic', async (req, res) => {
  logger.info('🔬 Running comprehensive database diagnostic...');
  
  const diagnostic = {
    timestamp: new Date().toISOString(),
    supabase: {
      url: !!process.env.SUPABASE_URL,
      anonKey: !!process.env.SUPABASE_ANON_KEY,
      serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      keyUsed: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON'
    },
    tables: {},
    insertTests: {},
    recommendations: []
  };
  
  try {
    const { getSupabaseClient } = require('./config/supabase');
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      diagnostic.supabase.initialized = false;
      diagnostic.recommendations.push('Supabase client failed to initialize. Check env vars.');
      return res.json(diagnostic);
    }
    
    diagnostic.supabase.initialized = true;
    
    // Test 1: Can we SELECT from articles (known working table)?
    const { data: articlesData, error: articlesError } = await supabase
      .from('articles')
      .select('id')
      .limit(1);
    
    diagnostic.tables.articles = {
      select: !articlesError,
      error: articlesError?.message || null
    };
    
    // Test 2: Can we SELECT from user_generated_covers?
    const { data: coversData, error: coversError } = await supabase
      .from('user_generated_covers')
      .select('id')
      .limit(1);
    
    diagnostic.tables.user_generated_covers = {
      select: !coversError,
      error: coversError?.message || null,
      isSchemaCache: coversError?.message?.includes('schema cache') || false
    };
    
    // Test 3: Try INSERT into user_generated_covers
    const testInsert = {
      user_id: 'diagnostic_test_' + Date.now(),
      image_url: 'https://test.diagnostic.com/test.png',
      network: 'DIAGNOSTIC',
      title: 'Diagnostic Test',
      created_at: new Date().toISOString()
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('user_generated_covers')
      .insert(testInsert)
      .select()
      .single();
    
    diagnostic.insertTests.supabaseClient = {
      success: !insertError,
      error: insertError?.message || null,
      data: insertData ? { id: insertData.id } : null
    };
    
    // If insert succeeded, delete the test row
    if (insertData?.id) {
      await supabase.from('user_generated_covers').delete().eq('id', insertData.id);
      diagnostic.insertTests.supabaseClient.cleaned = true;
    }
    
    // Test 4: Try direct HTTP insert
    if (insertError) {
      try {
        const axios = require('axios');
        const supabaseUrl = process.env.SUPABASE_URL?.trim();
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();
        
        const httpResponse = await axios.post(
          `${supabaseUrl}/rest/v1/user_generated_covers`,
          { ...testInsert, user_id: 'http_test_' + Date.now() },
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            timeout: 10000,
            validateStatus: () => true
          }
        );
        
        diagnostic.insertTests.directHttp = {
          status: httpResponse.status,
          success: httpResponse.status === 201 || httpResponse.status === 200,
          response: JSON.stringify(httpResponse.data).substring(0, 200)
        };
        
        // Clean up if succeeded
        if (httpResponse.status === 201 && httpResponse.data?.[0]?.id) {
          await supabase.from('user_generated_covers').delete().eq('id', httpResponse.data[0].id);
        }
      } catch (httpErr) {
        diagnostic.insertTests.directHttp = {
          success: false,
          error: httpErr.message
        };
      }
    }
    
    // Test 5: Check if we can use SQL via RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('version');
    diagnostic.rpcAvailable = !rpcError;
    
    // Generate recommendations
    if (diagnostic.tables.articles.select && !diagnostic.tables.user_generated_covers.select) {
      if (diagnostic.tables.user_generated_covers.isSchemaCache) {
        diagnostic.recommendations.push('SCHEMA CACHE ISSUE: Table exists but PostgREST has not cached it.');
        diagnostic.recommendations.push('FIX: Go to Supabase Dashboard > Settings > API > Click "Reload Schema"');
        diagnostic.recommendations.push('OR: Wait for auto-refresh (can take hours)');
        diagnostic.recommendations.push('OR: Make any DDL change to the table to force refresh');
      } else {
        diagnostic.recommendations.push('Table user_generated_covers may not exist. Create it via SQL Editor.');
      }
    }
    
    if (diagnostic.insertTests.supabaseClient.success) {
      diagnostic.recommendations.push('✅ INSERT works! The table is ready.');
    }
    
    logger.info('🔬 Diagnostic complete:', JSON.stringify(diagnostic, null, 2));
    res.json(diagnostic);
    
  } catch (error) {
    diagnostic.error = error.message;
    res.json(diagnostic);
  }
});

// TEST articles table insert - exact same as save endpoint
app.get('/api/cover-generator/test-articles-save', async (req, res) => {
  logger.info('🧪 Testing exact save logic...');
  
  try {
    const { getSupabaseClient } = require('./config/supabase');
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      return res.json({ success: false, error: 'Supabase not initialized' });
    }
    
    // Exact same data structure as save endpoint - all required columns
    const articleData = {
      title: `[USER_COVER] TEST: Test Cover`,
      url: 'https://test.com/test.png',
      source: 'user_cover_test_user_123',  // Required!
      content: JSON.stringify({
        type: 'user_generated_cover',
        user_id: 'test_user_123',
        image_url: 'https://test.com/test.png',
        network: 'TEST',
        original_title: 'Test Cover',
        generated_at: new Date().toISOString()
      }),
      published_at: new Date().toISOString()
    };
    
    logger.info(`📝 Test insert data: ${JSON.stringify(articleData)}`);
    
    const { data, error } = await supabase
      .from('articles')
      .insert(articleData)
      .select()
      .single();
    
    if (error) {
      return res.json({
        success: false,
        error: error.message,
        code: error.code,
        hint: error.hint,
        details: error.details,
        data: articleData
      });
    }
    
    // Clean up
    const cleanupResult = await supabase.from('articles').delete().eq('id', data.id);
    
    res.json({
      success: true,
      insertedId: data.id,
      cleaned: !cleanupResult.error,
      returnedData: data
    });
    
  } catch (e) {
    res.json({ success: false, error: e.message, stack: e.stack?.substring(0, 300) });
  }
});

// TEST generated_images table specifically - discover its columns
app.get('/api/cover-generator/test-gen-images', async (req, res) => {
  logger.info('🧪 Testing generated_images table...');
  
  try {
    const { getSupabaseClient } = require('./config/supabase');
    const supabase = getSupabaseClient();
    
    // Test SELECT on generated_images
    const { data: selectData, error: selectError } = await supabase
      .from('generated_images')
      .select('*')
      .limit(1);
    
    if (selectError) {
      return res.json({
        success: false,
        table: 'generated_images',
        selectWorks: false,
        error: selectError.message
      });
    }
    
    // Try minimal INSERT to discover required columns
    const minimalTestData = {
      image_url: 'https://test.com/test.png',
      created_at: new Date().toISOString()
    };
    
    const { data: minInsertData, error: minInsertError } = await supabase
      .from('generated_images')
      .insert(minimalTestData)
      .select()
      .single();
    
    if (minInsertError) {
      // Try with just image_url
      const { data: justUrlData, error: justUrlError } = await supabase
        .from('generated_images')
        .insert({ url: 'https://test.com/test.png' })
        .select()
        .single();
      
      if (!justUrlError && justUrlData) {
        await supabase.from('generated_images').delete().eq('id', justUrlData.id);
        return res.json({
          success: true,
          table: 'generated_images',
          insertWorks: true,
          workingSchema: 'url field',
          insertedRow: justUrlData
        });
      }
      
      return res.json({
        success: false,
        table: 'generated_images',
        selectWorks: true,
        insertWorks: false,
        minimalInsertError: minInsertError.message,
        justUrlError: justUrlError?.message,
        sampleRow: selectData?.[0]
      });
    }
    
    // Clean up test row
    if (minInsertData?.id) {
      await supabase.from('generated_images').delete().eq('id', minInsertData.id);
    }
    
    res.json({
      success: true,
      table: 'generated_images',
      selectWorks: true,
      insertWorks: true,
      insertedColumns: Object.keys(minimalTestData),
      sampleRow: selectData?.[0],
      insertedRow: minInsertData
    });
    
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// DIAGNOSTIC: Check Firebase and Supabase status
app.get('/api/cover-generator/auth-status', async (req, res) => {
  try {
    const { getFirebaseAuth } = require('./config/firebase');
    const { getSupabaseClient } = require('./config/supabase');
    
    const firebaseAuth = getFirebaseAuth();
    const supabase = getSupabaseClient();
    
    const status = {
      firebase: {
        initialized: !!firebaseAuth,
        envVar: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      },
      supabase: {
        initialized: !!supabase,
        url: !!process.env.SUPABASE_URL,
        key: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    };
    
    // Test Supabase connection
    if (supabase) {
      const { error } = await supabase.from('user_generated_covers').select('id').limit(1);
      status.supabase.tableAccess = !error;
      if (error) status.supabase.tableError = error.message;
    }
    
    logger.info('Auth status check:', status);
    res.json({ success: true, status });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// AUTO-CREATE TABLES endpoint - creates the required tables if they don't exist
app.post('/api/cover-generator/setup-tables', async (req, res) => {
  try {
    const { getSupabaseClient } = require('./config/supabase');
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      return res.status(500).json({ 
        success: false, 
        error: 'Supabase client not initialized'
      });
    }
    
    logger.info('🔧 Setting up user_generated_covers and cover_ratings tables...');
    
    const results = { tables: {}, created: [] };
    
    // SQL statements to create tables
    const createCoversTableSQL = `
      CREATE TABLE IF NOT EXISTS user_generated_covers (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id TEXT NOT NULL,
        image_url TEXT NOT NULL,
        network TEXT,
        title TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_user_generated_covers_user_id ON user_generated_covers(user_id);
    `;
    
    const createRatingsTableSQL = `
      CREATE TABLE IF NOT EXISTS cover_ratings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        image_url TEXT,
        network TEXT,
        prompt_used TEXT,
        logo_rating TEXT,
        logo_size TEXT,
        logo_style TEXT,
        background_rating TEXT,
        background_style TEXT,
        feedback_keyword TEXT,
        user_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_cover_ratings_network ON cover_ratings(network);
    `;
    
    // Try to create tables using Supabase's rpc (if exec_sql is enabled)
    let coversCreated = false;
    let ratingsCreated = false;
    
    // First check if tables already exist
    const { error: coversCheckError } = await supabase
      .from('user_generated_covers')
      .select('id')
      .limit(1);
    
    const coversExists = !coversCheckError || !coversCheckError.message.includes('does not exist');
    
    const { error: ratingsCheckError } = await supabase
      .from('cover_ratings')
      .select('id')
      .limit(1);
    
    const ratingsExists = !ratingsCheckError || !ratingsCheckError.message.includes('does not exist');
    
    // Try to create tables if they don't exist
    if (!coversExists) {
      logger.info('🔨 Attempting to create user_generated_covers table...');
      try {
        // Try using rpc to execute SQL (requires exec_sql function in Supabase)
        const { error: rpcError } = await supabase.rpc('exec_sql', { sql: createCoversTableSQL });
        if (!rpcError) {
          coversCreated = true;
          results.created.push('user_generated_covers');
          logger.info('✅ Created user_generated_covers table via RPC');
        } else {
          logger.warn('RPC method not available:', rpcError.message);
        }
      } catch (e) {
        logger.warn('Could not create table via RPC:', e.message);
      }
    }
    
    if (!ratingsExists) {
      logger.info('🔨 Attempting to create cover_ratings table...');
      try {
        const { error: rpcError } = await supabase.rpc('exec_sql', { sql: createRatingsTableSQL });
        if (!rpcError) {
          ratingsCreated = true;
          results.created.push('cover_ratings');
          logger.info('✅ Created cover_ratings table via RPC');
        }
      } catch (e) {
        logger.warn('Could not create table via RPC:', e.message);
      }
    }
    
    // Re-check table status after creation attempts
    const { error: finalCoversError } = await supabase
      .from('user_generated_covers')
      .select('id')
      .limit(1);
    
    const { error: finalRatingsError } = await supabase
      .from('cover_ratings')
      .select('id')
      .limit(1);
    
    results.tables.user_generated_covers = {
      exists: !finalCoversError || !finalCoversError.message.includes('does not exist'),
      created: coversCreated
    };
    
    results.tables.cover_ratings = {
      exists: !finalRatingsError || !finalRatingsError.message.includes('does not exist'),
      created: ratingsCreated
    };
    
    // Determine overall status
    const allTablesReady = results.tables.user_generated_covers.exists && results.tables.cover_ratings.exists;
    
    // If tables exist but have schema cache issues, try inserting and deleting a test row
    if (finalCoversError && finalCoversError.message.includes('schema cache')) {
      logger.info('🔄 Schema cache issue detected, trying to refresh...');
      try {
        // Insert a test row to force schema cache refresh
        const { data: testInsert, error: insertError } = await supabase
          .from('user_generated_covers')
          .insert({
            user_id: 'schema_test_' + Date.now(),
            image_url: 'https://test.com/test.png',
            network: 'TEST',
            title: 'Schema Cache Test'
          })
          .select()
          .single();
        
        if (testInsert && testInsert.id) {
          // Delete the test row
          await supabase
            .from('user_generated_covers')
            .delete()
            .eq('id', testInsert.id);
          
          logger.info('✅ Schema cache refreshed successfully!');
          results.tables.user_generated_covers.exists = true;
          results.tables.user_generated_covers.schemaRefreshed = true;
        }
      } catch (e) {
        logger.warn('Could not refresh schema cache:', e.message);
      }
    }
    
    if (allTablesReady) {
      results.success = true;
      results.message = '🎉 All tables are ready! Cover generations will now be saved to your profile.';
      logger.info('✅ All tables ready!');
    } else {
      results.success = false;
      results.message = 'Some tables could not be created automatically. Manual setup required.';
      results.manualSQL = `
-- Copy and run this in Supabase SQL Editor (supabase.com -> Your Project -> SQL Editor):

CREATE TABLE IF NOT EXISTS user_generated_covers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  network TEXT,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cover_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT,
  network TEXT,
  prompt_used TEXT,
  logo_rating TEXT,
  logo_size TEXT,
  logo_style TEXT,
  background_rating TEXT,
  background_style TEXT,
  feedback_keyword TEXT,
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
      `.trim();
    }
    
    res.json(results);
    
  } catch (error) {
    logger.error('Setup tables error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug endpoint to check table status and try to fix issues
app.get('/api/cover-generator/check-tables', async (req, res) => {
  try {
    const { getSupabaseClient } = require('./config/supabase');
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      return res.json({ 
        success: false, 
        error: 'Supabase client not initialized',
        instructions: 'Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Railway'
      });
    }
    
    const results = {
      success: true,
      tables: {},
      coversCount: 0,
      ratingsCount: 0
    };
    
    // Try to query the user_generated_covers table
    const { data: coversData, error: coversError, count: coversCount } = await supabase
      .from('user_generated_covers')
      .select('*', { count: 'exact', head: true });
    
    // Try to query the cover_ratings table
    const { data: ratingsData, error: ratingsError, count: ratingsCount } = await supabase
      .from('cover_ratings')
      .select('*', { count: 'exact', head: true });
    
    // Check if errors indicate table doesn't exist
    const coversNotExist = coversError?.message?.includes('does not exist');
    const ratingsNotExist = ratingsError?.message?.includes('does not exist');
    
    // Schema cache issue is different - table exists but PostgREST hasn't cached it
    const coversSchemaIssue = coversError?.message?.includes('schema cache');
    const ratingsSchemaIssue = ratingsError?.message?.includes('schema cache');
    
    results.tables.user_generated_covers = {
      exists: !coversNotExist,
      working: !coversError,
      count: coversCount || 0,
      schemaIssue: coversSchemaIssue,
      error: coversError?.message || null
    };
    
    results.tables.cover_ratings = {
      exists: !ratingsNotExist,
      working: !ratingsError,
      count: ratingsCount || 0,
      schemaIssue: ratingsSchemaIssue,
      error: ratingsError?.message || null
    };
    
    results.coversCount = coversCount || 0;
    results.ratingsCount = ratingsCount || 0;
    
    // If there are schema cache issues, try to refresh by inserting/deleting
    if (coversSchemaIssue) {
      logger.info('🔄 Attempting to refresh schema cache for user_generated_covers...');
      try {
        const { data: testRow, error: testError } = await supabase
          .from('user_generated_covers')
          .insert({
            user_id: 'cache_refresh_' + Date.now(),
            image_url: 'https://placeholder.com/refresh.png',
            network: 'CACHE_REFRESH',
            title: 'Schema Refresh Test'
          })
          .select()
          .single();
        
        if (testRow) {
          await supabase.from('user_generated_covers').delete().eq('id', testRow.id);
          results.tables.user_generated_covers.schemaRefreshed = true;
          results.tables.user_generated_covers.working = true;
          logger.info('✅ Schema cache refreshed!');
        }
      } catch (e) {
        logger.warn('Could not refresh schema:', e.message);
      }
    }
    
    const allWorking = results.tables.user_generated_covers.working && results.tables.cover_ratings.working;
    
    results.status = allWorking ? 'ready' : 'issues';
    results.message = allWorking 
      ? `All tables working! ${results.coversCount} covers saved, ${results.ratingsCount} ratings recorded.`
      : 'Some tables have issues. Check the error messages.';
    
    logger.info(`📊 Table check: covers=${results.tables.user_generated_covers.working}, ratings=${results.tables.cover_ratings.working}`);
    
    res.json(results);
  } catch (error) {
    logger.error('Table check error:', error);
    res.json({ success: false, error: error.message });
  }
});

// Get user's saved covers
app.get('/api/cover-generator/my-covers', async (req, res) => {
  // Extract userId/email from auth header
  let userId = null;
  let userEmail = null;
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const idToken = authHeader.split('Bearer ')[1];
      const tokenParts = idToken.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        userId = payload.user_id || payload.sub || payload.uid || payload.email;
        userEmail = payload.email || payload.user_email || null;
      }
    } catch (e) {
      logger.warn('Could not decode token for my-covers:', e.message);
    }
  }
  
  logger.info(`📂 Getting covers for user: ${userId || 'anonymous'}`);
  
  let allCovers = [];
  const sources = { supabase: 0, memory: 0, local: 0 };
  
  // SOURCE 1: Supabase - check articles table for user covers (source starts with user_cover_)
  if (userId) {
    try {
      const { getSupabaseClient } = require('./config/supabase');
      const supabase = getSupabaseClient();
      
      if (supabase) {
        // If master, also fetch master email-based covers
        const PromptRefinementService = require('./services/promptRefinementService');
        const isMaster = PromptRefinementService.isMasterAccount(userId, userEmail);
        const masterEmail = process.env.MASTER_ACCOUNT_EMAIL;
        const sourcesToFetch = new Set([`user_cover_${userId}`]);
        if (isMaster && masterEmail) {
          sourcesToFetch.add(`user_cover_${masterEmail}`);
        }
        
        // Query articles table where source matches any of the sources
        const { data: articlesData, error: articlesError } = await supabase
          .from('articles')
          .select('id, title, url, content, published_at, source')
          .in('source', Array.from(sourcesToFetch))
          .order('published_at', { ascending: false })
          .limit(150);
        
        if (!articlesError && articlesData) {
          // Transform articles to cover format
          for (const article of articlesData) {
            try {
              const metadata = JSON.parse(article.content || '{}');
              allCovers.push({
                id: article.id,
                user_id: metadata.user_id || userId,
                image_url: metadata.image_url || article.url,
                network: metadata.network,
                title: metadata.original_title,
                created_at: metadata.generated_at || article.published_at,
                source: 'supabase'
              });
            } catch (e) {
              // Fallback if content isn't valid JSON
              allCovers.push({
                id: article.id,
                user_id: userId,
                image_url: article.url,
                network: 'UNKNOWN',
                title: article.title.replace('[USER_COVER] ', ''),
                created_at: article.published_at,
                source: 'supabase'
              });
            }
          }
          sources.supabase = articlesData.length;
          logger.info(`📂 Found ${articlesData.length} user covers from articles table`);
        } else if (articlesError) {
          logger.warn(`Articles query failed: ${articlesError.message}`);
        }
      }
    } catch (e) {
      logger.warn('Supabase query failed:', e.message);
    }
  }
  
  // SOURCE 2: In-Memory Storage
  if (userId) {
    const memoryCovers = getFromMemoryStorage(userId);
    if (memoryCovers.length > 0) {
      const existingUrls = new Set(allCovers.map(c => c.image_url));
      for (const cover of memoryCovers) {
        if (!existingUrls.has(cover.image_url)) {
          allCovers.push({ ...cover, source: 'memory' });
          sources.memory++;
        }
      }
    }
  }
  
  // SOURCE 3: Local File Storage
  try {
    const localStorePath = path.join(__dirname, '../data/local-covers.json');
    const fs = require('fs').promises;
    const existing = await fs.readFile(localStorePath, 'utf-8');
    const localCovers = JSON.parse(existing);
    
    const userLocalCovers = userId 
      ? localCovers.filter(c => c.user_id === userId)
      : localCovers.slice(0, 50);
    
    const existingUrls = new Set(allCovers.map(c => c.image_url));
    for (const cover of userLocalCovers) {
      if (!existingUrls.has(cover.image_url)) {
        allCovers.push({ ...cover, source: 'local' });
        sources.local++;
      }
    }
  } catch (e) {
    // Local file doesn't exist - that's OK
  }
  
  // Sort by created_at descending
  allCovers.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  logger.info(`📂 Total: ${allCovers.length} (supabase: ${sources.supabase}, memory: ${sources.memory}, local: ${sources.local})`);
  res.json({ 
    success: true, 
    covers: allCovers.slice(0, 100),
    sources 
  });
});

// DEBUG: View current prompt preferences (what feedback has been learned)
app.get('/api/cover-generator/preferences', async (req, res) => {
  try {
    const PromptRefinementService = require('./services/promptRefinementService');
    const isMaster = PromptRefinementService.isMasterAccount(userId, userEmail);
    const promptRefinement = new PromptRefinementService({ userId, email: userEmail, isMaster });
    await promptRefinement.loadPreferences(true);
    
    const prefs = promptRefinement.preferences || {};
    
    res.json({
      success: true,
      preferences: {
        totalRatings: prefs.totalRatings || 0,
        lastUpdated: prefs.lastUpdated,
        
        // Size adjustments
        logoSizeIssues: prefs.logoSizeIssues || [],
        
        // Style feedback
        logoStyleGood: prefs.logoStyleGood || [],
        logoStyleBad: prefs.logoStyleBad || [],
        bgStyleGood: prefs.bgStyleGood || [],
        bgStyleBad: prefs.bgStyleBad || [],
        
        // Materials
        goodMaterials: prefs.goodMaterials || [],
        badMaterials: prefs.badMaterials || [],
        
        // User keywords
        userSuggestedKeywords: prefs.userSuggestedKeywords || [],
        
        // Recent feedback
        recentFeedback: (prefs.userFeedback || []).slice(-5),
        
        // Recent ratings
        recentRatings: (prefs.ratingHistory || []).slice(-5)
      }
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Submit rating feedback for prompt refinement
app.post('/api/cover-generator/rating', async (req, res) => {
  const { 
    imageUrl, 
    network, 
    promptUsed, 
    // NEW: 1-10 Numeric ratings for granularity
    logoQuality,      // 1-10: Logo overall quality
    logoSize,         // 1-10: 1-3=too small, 4-6=good, 7-10=too large
    logoStyle,        // 1-10: Logo style quality
    backgroundQuality, // 1-10: Background overall quality
    backgroundStyle,  // 1-10: Background style appropriateness
    // Written feedback
    feedbackKeyword, 
    userId,
    userEmail,
    // LEGACY support - convert old checkbox values to numeric
    logoRating,       // Old: 'good', 'bad'
    backgroundRating  // Old: 'good', 'bad'
  } = req.body;
  
  // Convert ratings to numeric - use null checks, not falsy checks (0 is a valid rating!)
  // undefined/null → use default, but explicit 0 is preserved
  const parseRating = (val, defaultVal) => {
    if (val === undefined || val === null || val === '') return defaultVal;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? defaultVal : parsed;
  };
  
  let lq = parseRating(logoQuality, null);  // null = not provided
  let ls = parseRating(logoSize, null);
  let lstyle = parseRating(logoStyle, null);
  let bq = parseRating(backgroundQuality, null);
  let bs = parseRating(backgroundStyle, null);
  
  // Handle legacy string ratings (convert to numeric)
  if (lq === null && logoRating) {
    lq = logoRating === 'good' || logoRating === 'excellent' ? 8 : 3;
  }
  if (bq === null && backgroundRating) {
    bq = backgroundRating === 'good' || backgroundRating === 'excellent' ? 8 : 3;
  }
  
  // Check if ANY rating was actually provided (null means not provided)
  const hasAnyRating = lq !== null || ls !== null || lstyle !== null || bq !== null || bs !== null || feedbackKeyword;
  
  // Apply defaults for processing (after the hasAnyRating check)
  if (lq === null) lq = 5;  // Default to neutral
  if (ls === null) ls = 5;  // Default to "good size"
  if (lstyle === null) lstyle = 5;
  if (bq === null) bq = 5;
  if (bs === null) bs = 5;
  if (!hasAnyRating) {
    return res.status(400).json({ success: false, error: 'At least one rating required' });
  }
  
  try {
    const { getSupabaseClient } = require('./config/supabase');
    const supabase = getSupabaseClient();
    const PromptRefinementService = require('./services/promptRefinementService');
    const promptRefinement = new PromptRefinementService();
    
    // Build comprehensive rating log with numeric values
    const ratingLog = {
      timestamp: new Date().toISOString(),
      network: network?.toUpperCase(),
      promptUsed: promptUsed?.substring(0, 500),
      ratings: {
        logoQuality: lq,
        logoSize: ls,
        logoStyle: lstyle,
        backgroundQuality: bq,
        backgroundStyle: bs
      },
      feedbackKeyword: feedbackKeyword || null,
      userId: userId || 'anonymous',
      scope: isMaster ? 'global' : 'user'
    };
    
    // Interpret logo size rating
    let sizeInterpretation = 'good size';
    if (ls <= 3) sizeInterpretation = 'TOO SMALL - will increase';
    else if (ls >= 7) sizeInterpretation = 'TOO LARGE - will decrease';
    
    // Log to console for learning/debugging
    logger.info('='.repeat(60));
    logger.info('📊 COVER RATING RECEIVED - NUMERIC RATINGS (1-10)');
    logger.info('='.repeat(60));
    logger.info(`🎯 Network: ${ratingLog.network}`);
    logger.info(`📝 Prompt: ${ratingLog.promptUsed?.substring(0, 100)}...`);
    logger.info(`🎨 Logo Quality: ${lq}/10 ${lq >= 7 ? '✅' : lq <= 3 ? '❌' : '➖'}`);
    logger.info(`🎛️ Logo Style: ${lstyle}/10 ${lstyle >= 7 ? '✅' : lstyle <= 3 ? '❌' : '➖'}`);
    logger.info(`📏 Logo Size: ${ls}/10 → ${sizeInterpretation}`);
    logger.info(`🖼️ Background Quality: ${bq}/10 ${bq >= 7 ? '✅' : bq <= 3 ? '❌' : '➖'}`);
    logger.info(`🎭 Background Style: ${bs}/10 ${bs >= 7 ? '✅' : bs <= 3 ? '❌' : '➖'}`);
    logger.info(`💬 User Feedback: ${feedbackKeyword || 'none'}`);
    logger.info(`👤 Preference Scope: ${isMaster ? 'global' : 'user'}`);
    logger.info('='.repeat(60));
    
    // Try to save to database (graceful if table doesn't exist)
    if (supabase) {
      try {
        const { error } = await supabase
          .from('cover_ratings')
          .insert({
            image_url: imageUrl,
            network: network?.toUpperCase(),
            prompt_used: promptUsed,
            logo_quality: lq,
            logo_size: ls,
            background_quality: bq,
            background_style: bs,
            feedback_keyword: feedbackKeyword,
            user_id: userId || null,
            created_at: new Date().toISOString()
          });
        
        if (error && error.code !== '42P01') {
          logger.warn('Could not save rating to DB:', error.message);
        }
      } catch (dbError) {
        logger.warn('DB save failed (non-critical):', dbError.message);
      }
    }
    
    // Process the rating to refine prompts using NEW numeric system
    await promptRefinement.processRating({
      logoQuality: lq,
      logoSize: ls,
      logoStyle: lstyle,
      backgroundQuality: bq,
      backgroundStyle: bs,
      feedbackKeyword,
      promptUsed,
      network
    });
    
    // ALSO: Use AI to deeply analyze the feedback for contextual understanding
    let aiAnalysis = null;
    try {
      const AIFeedbackAnalyzer = require('./services/aiFeedbackAnalyzer');
        aiAnalysis = await AIFeedbackAnalyzer.analyzeFeedback({
          feedbackText: feedbackKeyword,
          logoQuality: lq,
          logoSize: ls,
          logoStyle: lstyle,
          backgroundQuality: bq,
          backgroundStyle: bs,
          network,
          promptUsed
        });
      
      if (aiAnalysis && aiAnalysis.aiAnalyzed) {
        logger.info('🤖 AI Feedback Analysis completed:', aiAnalysis.reasoning);
        
        // Apply AI recommendations to preferences using new sizeMultiplier
        if (aiAnalysis.logoAdjustments?.sizeMultiplier) {
          const multiplier = aiAnalysis.logoAdjustments.sizeMultiplier;
          if (multiplier > 1.1) {
            promptRefinement.addToList('logoSizeIssues', ['increase_logo_size']);
            logger.info(`📏 AI: Recommending larger logos (${multiplier}x)`);
          } else if (multiplier < 0.9) {
            promptRefinement.addToList('logoSizeIssues', ['decrease_logo_size']);
            logger.info(`📏 AI: Recommending smaller logos (${multiplier}x)`);
          }
        }
        
        // Apply AI-recommended negative prompts to avoid bad patterns
        if (aiAnalysis.negativePrompts && aiAnalysis.negativePrompts.length > 0) {
          for (const neg of aiAnalysis.negativePrompts) {
            if (neg.includes('box') || neg.includes('frame')) {
              promptRefinement.addToList('bgStyleBad', ['boxes_frames']);
            }
            if (neg.includes('server') || neg.includes('rack')) {
              promptRefinement.addToList('bgStyleBad', ['server_equipment']);
            }
          }
        }
        
        // Save AI-enhanced preferences
        await promptRefinement.savePreferences();
      }
    } catch (aiError) {
      logger.warn('AI analysis optional - continuing:', aiError.message);
    }
    
    res.json({ 
      success: true, 
      message: 'Feedback recorded - thank you for helping improve generations!',
      refinementApplied: true,
      aiAnalyzed: aiAnalysis?.aiAnalyzed || false
    });
  } catch (error) {
    logger.error('Failed to process rating:', error);
    // Still return success - don't fail user experience
    res.json({ 
      success: true, 
      message: 'Rating received (storage pending)',
      refinementApplied: false
    });
  }
});

// Get prompt statistics (for debugging/admin)
app.get('/api/cover-generator/prompt-stats', async (req, res) => {
  try {
    const PromptRefinementService = require('./services/promptRefinementService');
    const promptRefinement = new PromptRefinementService();
    
    const stats = await promptRefinement.getStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Failed to get prompt stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🔧 DEBUG: Test logo loading via ControlNetService
app.get('/api/debug/test-logo/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const ControlNetService = require('./services/controlNetService');
    const controlNetService = new ControlNetService();
    
    logger.info(`🔧 DEBUG: Testing logo load for ${symbol}`);
    logger.info(`🔧 DEBUG: pngLogoDir = ${controlNetService.pngLogoDir}`);
    
    const logoData = await controlNetService.getPngLogo(symbol);
    
    if (logoData) {
      res.json({
        success: true,
        symbol,
        source: logoData.source,
        size: logoData.buffer?.length || 0,
        sizeKB: ((logoData.buffer?.length || 0) / 1024).toFixed(1) + 'KB',
        path: logoData.path || 'N/A',
        pngLogoDir: controlNetService.pngLogoDir
      });
    } else {
      res.json({
        success: false,
        symbol,
        error: 'Logo not found',
        pngLogoDir: controlNetService.pngLogoDir
      });
    }
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// 🔧 DEBUG: Check PNG logo availability
app.get('/api/debug/png-logos', async (req, res) => {
  const path = require('path');
  const fs = require('fs').promises;
  
  try {
    const pngDir = path.join(__dirname, './services/../../uploads/png-logos');
    const resolvedPath = path.resolve(pngDir);
    
    let files = [];
    let error = null;
    
    try {
      files = await fs.readdir(resolvedPath);
      files = files.filter(f => f.toLowerCase().endsWith('.png'));
    } catch (e) {
      error = e.message;
    }
    
    res.json({
      success: !error,
      pngDirectory: resolvedPath,
      NODE_ENV: process.env.NODE_ENV,
      totalPngs: files.length,
      files: files,
      error: error
    });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// 🔧 DEBUG: Test Nano-Banana-Pro API directly with full PNG support
app.post('/api/debug/nano-banana', async (req, res) => {
  const axios = require('axios');
  const logger = require('./utils/logger');
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    const { network = 'ETH' } = req.body;
    const wavespeedApiKey = process.env.WAVESPEED_API_KEY;
    
    if (!wavespeedApiKey) {
      return res.status(400).json({ success: false, error: 'WAVESPEED_API_KEY not set' });
    }
    
    // First, try to load PNG from our directory
    const pngDir = path.resolve(__dirname, './services/../../uploads/png-logos');
    let logoUrl;
    let logoSource = 'unknown';
    
    try {
      const pngPath = path.join(pngDir, `${network.toUpperCase()}.png`);
      const logoBuffer = await fs.readFile(pngPath);
      logoUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      logoSource = 'png_base64';
      logger.info(`📷 DEBUG: Using base64 PNG for ${network} (${(logoBuffer.length/1024).toFixed(1)}KB)`);
    } catch (e) {
      // Fall back to CDN
      const cdnSlugs = {
        'eth': 'ethereum-eth', 'btc': 'bitcoin-btc', 'xrp': 'xrp-xrp',
        'sol': 'solana-sol', 'hbar': 'hedera-hbar'
      };
      const slug = cdnSlugs[network.toLowerCase()] || 'ethereum-eth';
      logoUrl = `https://cryptologos.cc/logos/${slug}-logo.png?v=040`;
      logoSource = 'cdn';
      logger.info(`📷 DEBUG: Using CDN URL for ${network}: ${logoUrl}`);
    }
    
    logger.info(`🔧 DEBUG: Testing Nano-Banana-Pro with ${network}`);
    logger.info(`🔧 DEBUG: Logo URL: ${logoUrl}`);
    logger.info(`🔧 DEBUG: API Key: ${wavespeedApiKey.substring(0, 12)}...`);
    
    const prompt = `The ${network} logo made of crystal glass, hovering above scattered coins, with cyan neon lighting, on a dark reflective surface, maintain exact logo proportions without stretching`;
    
    // Full payload matching production settings
    const payload = {
      enable_base64_output: false,
      enable_sync_mode: false,
      images: [logoUrl],
      output_format: "png",
      prompt: prompt,
      resolution: "2k",
      aspect_ratio: "16:9"
    };
    
    // Step 1: Submit job
    logger.info(`🔧 DEBUG: Submitting to Wavespeed API with payload (excluding logo data)...`);
    logger.info(`🔧 DEBUG: Payload: prompt=${prompt.substring(0, 100)}, resolution=2k, aspect_ratio=16:9, logoSource=${logoSource}`);
    
    const submitResponse = await axios.post('https://api.wavespeed.ai/api/v3/google/nano-banana-pro/edit', payload, {
      headers: {
        'Authorization': `Bearer ${wavespeedApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    logger.info(`🔧 DEBUG: Submit response: ${JSON.stringify(submitResponse.data).substring(0, 500)}`);
    
    const jobData = submitResponse.data.data || submitResponse.data;
    if (!jobData.id) {
      return res.json({
        success: false,
        error: 'No job ID returned',
        response: submitResponse.data
      });
    }
    
    // Step 2: Poll for result
    const jobId = jobData.id;
    logger.info(`🔧 DEBUG: Job ID: ${jobId}, polling...`);
    
    let result = null;
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 5000));
      
      const pollResponse = await axios.get(`https://api.wavespeed.ai/api/v3/predictions/${jobId}/result`, {
        headers: { 'Authorization': `Bearer ${wavespeedApiKey}` },
        timeout: 15000
      });
      
      const status = pollResponse.data.data?.status;
      logger.info(`🔧 DEBUG: Poll ${i+1} - Status: ${status}`);
      
      if (status === 'completed') {
        result = pollResponse.data.data;
        break;
      } else if (status === 'failed') {
        return res.json({
          success: false,
          error: 'Job failed',
          jobId,
          result: pollResponse.data.data
        });
      }
    }
    
    if (!result) {
      return res.json({ success: false, error: 'Job timed out', jobId });
    }
    
    const outputs = result.outputs || result.output || [];
    res.json({
      success: true,
      jobId,
      method: 'nano_banana_pro_3d',
      imageUrl: outputs[0],
      prompt,
      logoSource,
      logoUrlPreview: logoSource === 'cdn' ? logoUrl : `base64 (${logoUrl.length} chars)`
    });
    
  } catch (error) {
    logger.error(`🔧 DEBUG ERROR: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      response: error.response?.data
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

// Trigger redeploy Thu Jan  8 11:11:51 PST 2026
// Build: 1768972900
