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
];

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
    
    // Build final list with availability status
    const networks = NETWORKS_LIST.map(n => ({
      ...n,
      hasLogo: availablePngs.size === 0 || availablePngs.has(n.symbol) || availablePngs.has(n.symbol.replace(/\s+/g, ''))
    })).sort((a, b) => a.name.localeCompare(b.name));
    
    const companies = COMPANIES_LIST.map(c => ({
      ...c,
      hasLogo: availablePngs.size === 0 || availablePngs.has(c.symbol) || availablePngs.has(c.symbol.replace(/\s+/g, ''))
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
  const { network, title, style, customKeyword } = req.body;
  
  if (!network) {
    return res.status(400).json({ success: false, error: 'Network symbol required' });
  }
  
  const startTime = Date.now();
  
  try {
    const ControlNetService = require('./services/controlNetService');
    const controlNetService = new ControlNetService();
    
    const articleTitle = title || `${network} Cryptocurrency News`;
    
    logger.info(`🎨 Cover Generator: Creating ${network} cover... ${customKeyword ? `(keyword: ${customKeyword})` : ''}`);
    
    const result = await controlNetService.generateWithAdvancedControlNet(
      articleTitle,
      network.toUpperCase(),
      style || 'professional',
      { content: '', customKeyword: customKeyword || null }
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
        timestamp: new Date().toISOString()
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

// Firebase Auth Middleware for cover generator routes
const coverAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const { verifyFirebaseToken } = require('./config/firebase');
    const decodedToken = await verifyFirebaseToken(idToken);
    
    req.user = decodedToken;
    next();
    
  } catch (error) {
    logger.error('Firebase auth error:', error.message);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};

// Save generation to user profile (if logged in)
app.post('/api/cover-generator/save', coverAuthMiddleware, async (req, res) => {
  const { imageUrl, network, title } = req.body;
  const userId = req.user?.uid; // Firebase uses 'uid' not 'id'
  
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Login required to save' });
  }
  
  try {
    const supabase = require('./config/supabase').supabaseAdmin;
    
    const { data, error } = await supabase
      .from('user_generated_covers')
      .insert({
        user_id: userId,
        image_url: imageUrl,
        network: network,
        title: title || `${network} Cover`,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    logger.info(`✅ Cover saved for user ${userId}: ${network}`);
    res.json({ success: true, saved: data });
  } catch (error) {
    logger.error('Failed to save cover:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user's saved covers
app.get('/api/cover-generator/my-covers', coverAuthMiddleware, async (req, res) => {
  const userId = req.user?.uid; // Firebase uses 'uid' not 'id'
  
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Login required' });
  }
  
  try {
    const supabase = require('./config/supabase').supabaseAdmin;
    
    const { data, error } = await supabase
      .from('user_generated_covers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    res.json({ success: true, covers: data || [] });
  } catch (error) {
    logger.error('Failed to get covers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Submit rating feedback for prompt refinement
app.post('/api/cover-generator/rating', async (req, res) => {
  const { imageUrl, network, promptUsed, logoRating, backgroundRating, feedbackKeyword, userId } = req.body;
  
  if (!logoRating && !backgroundRating) {
    return res.status(400).json({ success: false, error: 'At least one rating required' });
  }
  
  try {
    const supabase = require('./config/supabase').supabaseAdmin;
    const PromptRefinementService = require('./services/promptRefinementService');
    const promptRefinement = new PromptRefinementService();
    
    // Save rating to database
    const { data, error } = await supabase
      .from('cover_ratings')
      .insert({
        image_url: imageUrl,
        network: network?.toUpperCase(),
        prompt_used: promptUsed,
        logo_rating: logoRating,
        background_rating: backgroundRating,
        feedback_keyword: feedbackKeyword,
        user_id: userId || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      // If table doesn't exist, create it (first-time setup)
      if (error.code === '42P01') {
        logger.warn('cover_ratings table does not exist - creating...');
        // Table will be created via migration or manually
      } else {
        throw error;
      }
    }
    
    // Process the rating to refine prompts
    await promptRefinement.processRating({
      logoRating,
      backgroundRating,
      feedbackKeyword,
      promptUsed,
      network
    });
    
    logger.info(`📊 Rating received: Logo=${logoRating}, Background=${backgroundRating}, Keyword=${feedbackKeyword || 'none'}`);
    
    res.json({ 
      success: true, 
      message: 'Rating saved',
      refinementApplied: true
    });
  } catch (error) {
    logger.error('Failed to save rating:', error);
    // Still return success if we got this far - don't fail user experience
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
