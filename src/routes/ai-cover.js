const express = require('express');
const router = express.Router();
const LoRAiService = require('../services/loraAiService');
const LogoCollectionService = require('../services/LogoCollectionService');
const EnhancedLogoCollectionService = require('../services/enhancedLogoCollectionService');
const LogoIntegrationTrainingService = require('../services/logoIntegrationTrainingService');

// Health check endpoint for LoRA AI service compatibility
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'AI Cover Generator',
    version: '1.0.0'
  });
});

// Status endpoint for LoRA AI service compatibility
router.get('/status', (req, res) => {
  res.json({
    available: true,
    service: 'AI Cover Generator',
    supported_clients: [
      'hedera', 'algorand', 'constellation',
      'bitcoin', 'ethereum', 'generic'
    ]
  });
});

// FastAPI-compatible generate cover endpoint
router.post('/generate/cover', async (req, res) => {
  try {
    const { title, subtitle, client_id, size } = req.body;
    
    const loraService = new LoRAiService();
    
    const articleData = {
      title: title,
      content: subtitle || 'Crypto news article',
      network: client_id
    };
    
    const options = {
      size: size || '1792x896',
      style: 'professional'
    };
    
    const result = await loraService.generateCryptoNewsImage(articleData, options);
    
    if (result.success) {
      res.json({
        job_id: Date.now().toString(),
        status: 'completed',
        image_url: result.coverUrl,
        message: 'Cover generated successfully'
      });
    } else {
      res.status(500).json({
        job_id: Date.now().toString(),
        status: 'failed',
        message: 'Generation failed'
      });
    }
    
  } catch (error) {
    res.status(500).json({
      job_id: Date.now().toString(),
      status: 'failed',
      message: error.message
    });
  }
});

// FastAPI-compatible status endpoint
router.get('/generate/status/:job_id', (req, res) => {
  // Since we're generating synchronously, always return completed
  res.json({
    job_id: req.params.job_id,
    status: 'completed',
    message: 'Status check complete'
  });
});

// UNIVERSAL LORA GENERATE - NO FALLBACKS, PROPER IMAGE IDS
router.post('/lora-generate', async (req, res) => {
  try {
    const { title, subtitle, client_id } = req.body;
    
    console.log('🎨 Universal LoRA Generate Request:', req.body);
    
    // Use new Universal LoRA Service - NO FALLBACKS
    const UniversalLoraService = require('../services/universalLoraService');
    const loraService = new UniversalLoraService();
    
    const articleData = {
      title: title || 'Crypto News',
      content: subtitle || 'Analysis', 
      network: client_id || 'generic'
    };
    
    const result = await loraService.generateWithId(articleData, { size: '1792x896' });
    
    console.log('✅ Universal LoRA successful:', result);
    res.json({
      success: true,
      image_id: result.imageId,
      image_url: result.imageUrl,
      metadata: result.metadata
    });
    
  } catch (error) {
    console.error('❌ Universal LoRA generation failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Universal LoRA generation failed - no fallbacks available'
    });
  }
});

// UNIVERSAL LORA GENERATE - PURE LORA, NO FALLBACKS
router.post('/generate', async (req, res) => {
  console.log('🎨 Universal LoRA Generate Request:', req.body);
  
  try {
    const { title, subtitle, client_id } = req.body;
    
    // Use Universal LoRA Service - NO FALLBACKS ALLOWED
    const UniversalLoraService = require('../services/universalLoraService');
    const loraService = new UniversalLoraService();
    
    const articleData = {
      title: title || 'Crypto News',
      content: subtitle || 'Analysis',
      network: client_id || 'generic'
    };
    
    const result = await loraService.generateWithId(articleData, { size: '1792x896' });
    
    const response = {
      success: true,
      image_id: result.imageId,
      image_url: result.imageUrl,
      metadata: result.metadata
    };
    
    console.log('📤 Universal LoRA Response:', response);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Universal LoRA generation failed:', error.message);
    // NO FALLBACKS! Return error as requested
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Universal LoRA generation failed - no fallbacks available'
    });
  }
});

// IMAGE RETRIEVAL BY ID - GET HOSTED LORA IMAGE
router.get('/image/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    
    console.log(`🖼️ Retrieving image: ${imageId}`);
    
    const UniversalLoraService = require('../services/universalLoraService');
    const loraService = new UniversalLoraService();
    
    const result = await loraService.getImageById(imageId);
    
    res.json({
      success: true,
      image_id: result.imageId,
      image_url: result.imageUrl,
      message: 'Image retrieved successfully'
    });
    
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message,
      message: `Image ${req.params.imageId} not found`
    });
  }
});

// LIST ALL GENERATED IMAGES
router.get('/images', async (req, res) => {
  try {
    console.log('📋 Listing all generated LoRA images');
    
    const UniversalLoraService = require('../services/universalLoraService');
    const loraService = new UniversalLoraService();
    
    const result = await loraService.listImages();
    
    res.json({
      success: true,
      count: result.count,
      images: result.images,
      message: `Found ${result.count} generated images`
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to list images'
    });
  }
});

// WATERMARK CONFIGURATION ENDPOINTS
router.post('/watermark/configure', async (req, res) => {
  try {
    const { position, opacity } = req.body;
    
    console.log('🎨 Watermark configuration request:', req.body);
    
    const UniversalLoraService = require('../services/universalLoraService');
    const loraService = new UniversalLoraService();
    
    if (position) {
      loraService.watermarkService.setPosition(position);
    }
    
    if (opacity !== undefined) {
      loraService.watermarkService.setOpacity(opacity);
    }
    
    res.json({
      success: true,
      message: 'Watermark configuration updated',
      config: {
        position: loraService.watermarkService.watermarkPosition,
        opacity: loraService.watermarkService.watermarkOpacity
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Watermark configuration failed'
    });
  }
});

// GET WATERMARK STATUS
router.get('/watermark/status', (req, res) => {
  try {
    const UniversalLoraService = require('../services/universalLoraService');
    const loraService = new UniversalLoraService();
    
    res.json({
      success: true,
      watermark: {
        enabled: true,
        brand: 'genfinity',
        position: loraService.watermarkService.watermarkPosition,
        opacity: loraService.watermarkService.watermarkOpacity,
        size: loraService.watermarkService.watermarkSize
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🎯 PHASE 1: Logo Collection Pipeline Endpoints
router.post('/training/collect-logos', async (req, res) => {
  try {
    const logoService = new LogoCollectionService();
    
    console.log('🚀 Phase 1: Starting crypto logo collection...');
    const results = await logoService.scrapeCryptoLogos();
    
    res.json({
      success: true,
      phase: 'Phase 1: Logo Collection',
      results: results,
      message: `Collected logos for ${results.collected} cryptocurrencies`,
      next_phase: 'Article Image Collection',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Logo collection failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      phase: 'Phase 1: Logo Collection',
      message: 'Logo collection pipeline failed'
    });
  }
});

// Manual logo collection for specific crypto
router.post('/training/collect-crypto-logos/:crypto', async (req, res) => {
  try {
    const { crypto } = req.params;
    const logoService = new LogoCollectionService();
    
    console.log(`🎯 Manual collection requested for: ${crypto}`);
    const result = await logoService.collectLogosForCrypto(crypto);
    
    if (result) {
      res.json({
        success: true,
        crypto: crypto,
        logos_collected: result.count,
        variations: result.variations,
        files: result.files,
        message: `Successfully collected ${result.count} logos for ${crypto}`
      });
    } else {
      res.status(404).json({
        success: false,
        crypto: crypto,
        message: `No logos found for ${crypto} on cryptologos.cc`
      });
    }
    
  } catch (error) {
    console.error(`❌ Logo collection failed for ${req.params.crypto}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      crypto: req.params.crypto,
      message: 'Logo collection failed'
    });
  }
});

// Get collection status and report
router.get('/training/collection-status', async (req, res) => {
  try {
    const logoService = new LogoCollectionService();
    const status = await logoService.getCollectionStatus();
    
    res.json({
      success: true,
      status: status,
      message: 'Collection status retrieved successfully'
    });
    
  } catch (error) {
    console.error('❌ Failed to get collection status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to get collection status'
    });
  }
});

// 🎯 PHASE 2: ENHANCED LOGO COLLECTION ENDPOINTS (150+ Networks)

// Collect all 150+ crypto network logos
router.post('/training/collect-all-networks', async (req, res) => {
  try {
    const enhancedLogoService = new EnhancedLogoCollectionService();
    
    console.log('🚀 Phase 2: Starting collection of 150+ crypto networks...');
    
    // This is a long-running operation, so respond immediately and process in background
    res.json({
      success: true,
      phase: 'Phase 2: Enhanced Logo Collection',
      message: 'Collection started for 150+ crypto networks',
      status: 'processing',
      estimated_time: '15-30 minutes',
      check_status_url: '/api/ai-cover/training/enhanced-status'
    });
    
    // Start collection in background
    enhancedLogoService.collectAll150Networks()
      .then(report => {
        console.log('✅ Enhanced logo collection completed:', report.statistics);
      })
      .catch(error => {
        console.error('❌ Enhanced logo collection failed:', error);
      });
    
  } catch (error) {
    console.error('❌ Enhanced logo collection failed to start:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      phase: 'Phase 2: Enhanced Logo Collection',
      message: 'Failed to start enhanced logo collection'
    });
  }
});

// Get enhanced collection status
router.get('/training/enhanced-status', async (req, res) => {
  try {
    const enhancedLogoService = new EnhancedLogoCollectionService();
    const status = await enhancedLogoService.getCollectionStatus();
    
    res.json({
      success: true,
      phase: 'Phase 2: Enhanced Logo Collection',
      status: status,
      message: 'Enhanced collection status retrieved'
    });
    
  } catch (error) {
    console.error('❌ Failed to get enhanced collection status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to get enhanced collection status'
    });
  }
});

// Collect specific crypto network manually (for testing)
router.post('/training/collect-network/:cryptoId', async (req, res) => {
  try {
    const { cryptoId } = req.params;
    const enhancedLogoService = new EnhancedLogoCollectionService();
    
    console.log(`🎯 Manual collection requested for: ${cryptoId}`);
    const result = await enhancedLogoService.collectSpecificCrypto(cryptoId);
    
    res.json({
      success: true,
      phase: 'Phase 2: Enhanced Logo Collection',
      cryptoId: cryptoId,
      result: result,
      message: `Successfully collected logos for ${cryptoId}`
    });
    
  } catch (error) {
    console.error(`❌ Enhanced logo collection failed for ${req.params.cryptoId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      cryptoId: req.params.cryptoId,
      phase: 'Phase 2: Enhanced Logo Collection',
      message: 'Enhanced logo collection failed'
    });
  }
});

// Get training readiness report
router.get('/training/readiness', async (req, res) => {
  try {
    const enhancedLogoService = new EnhancedLogoCollectionService();
    const originalLogoService = new LogoCollectionService();
    
    const [enhancedStatus, originalStatus] = await Promise.all([
      enhancedLogoService.getCollectionStatus(),
      originalLogoService.getCollectionStatus()
    ]);
    
    const totalNetworks = (enhancedStatus.statistics?.successful || 0) + (originalStatus.summary?.collected || 0);
    const totalVariations = (enhancedStatus.statistics?.totalVariations || 0) + 
                          (originalStatus.summary?.cryptos?.reduce((sum, crypto) => sum + crypto.variations, 0) || 0);
    
    const readiness = {
      phase: 'Phase 2: Training Readiness Assessment',
      logo_collection: {
        original_system: {
          networks: originalStatus.summary?.collected || 0,
          variations: originalStatus.summary?.cryptos?.reduce((sum, crypto) => sum + crypto.variations, 0) || 0
        },
        enhanced_system: {
          networks: enhancedStatus.statistics?.successful || 0,
          variations: enhancedStatus.statistics?.totalVariations || 0
        },
        total: {
          networks: totalNetworks,
          variations: totalVariations
        }
      },
      training_readiness: {
        logos_ready: totalNetworks >= 100,
        variations_ready: totalVariations >= 1000,
        overall_status: totalNetworks >= 100 && totalVariations >= 1000 ? 'Ready for LoRA Training' : 'Collecting More Data',
        next_phase: 'Logo Integration Training'
      }
    };
    
    res.json({
      success: true,
      readiness: readiness,
      message: `Training readiness: ${readiness.training_readiness.overall_status}`
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to assess training readiness'
    });
  }
});

// 🎯 PHASE 2: LOGO INTEGRATION TRAINING ENDPOINTS

// Create integrated background training samples
router.post('/training/create-integration-samples', async (req, res) => {
  try {
    const trainingService = new LogoIntegrationTrainingService();
    
    console.log('🎨 Creating logo integration training samples...');
    
    res.json({
      success: true,
      phase: 'Phase 2: Logo Integration Training',
      message: 'Creating training samples with logos integrated into backgrounds',
      status: 'processing',
      estimated_time: '10-20 minutes',
      check_status_url: '/api/ai-cover/training/integration-status'
    });
    
    // Start training sample creation in background
    trainingService.createCompleteTrainingDataset()
      .then(dataset => {
        console.log('✅ Logo integration training samples created:', dataset.samples_count);
      })
      .catch(error => {
        console.error('❌ Training sample creation failed:', error);
      });
    
  } catch (error) {
    console.error('❌ Failed to start training sample creation:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      phase: 'Phase 2: Logo Integration Training'
    });
  }
});

// Get integration training status
router.get('/training/integration-status', async (req, res) => {
  try {
    const trainingService = new LogoIntegrationTrainingService();
    const status = await trainingService.getTrainingDatasetStatus();
    
    res.json({
      success: true,
      phase: 'Phase 2: Logo Integration Training',
      status: status,
      message: 'Training dataset status retrieved'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to get training status'
    });
  }
});

// Analyze crypto.news style
router.post('/training/analyze-crypto-news-style', async (req, res) => {
  try {
    const trainingService = new LogoIntegrationTrainingService();
    
    console.log('🔍 Analyzing crypto.news style for reference...');
    const analysis = await trainingService.analyzeCryptoNewsStyle();
    
    res.json({
      success: true,
      phase: 'Phase 2: Style Analysis',
      analysis: analysis,
      message: 'Crypto.news style analysis complete'
    });
    
  } catch (error) {
    console.error('❌ Style analysis failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Style analysis failed'
    });
  }
});

module.exports = router;