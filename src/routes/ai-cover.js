const express = require('express');
const router = express.Router();
const LoRAiService = require('../services/loraAiService');
const LogoCollectionService = require('../services/LogoCollectionService');

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

module.exports = router;