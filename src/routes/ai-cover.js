const express = require('express');
const router = express.Router();
const LoRAiService = require('../services/loraAiService');

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

// Legacy generate endpoint for backward compatibility - return LoRA response
router.post('/generate', async (req, res) => {
  try {
    const { title, subtitle, client_id } = req.body;
    
    // Now use the actual LoRA service
    const loraService = new LoRAiService();
    
    const articleData = {
      title: title,
      content: subtitle || 'Crypto news article',
      network: client_id
    };
    
    const options = {
      size: '1792x896',
      style: 'professional'
    };
    
    const result = await loraService.generateCryptoNewsImage(articleData, options);
    
    if (result.success) {
      // Return in the old format for compatibility
      res.json({
        success: true,
        image_url: result.coverUrl,
        metadata: {
          method: result.generationMethod || 'lora',
          client_id: client_id || 'generic',
          title: title || 'Crypto News',
          subtitle: subtitle || 'Analysis',
          generated_at: new Date().toISOString()
        }
      });
    } else {
      // Fallback to placeholder
      const placeholderUrl = `https://via.placeholder.com/1800x900/4A90E2/FFFFFF?text=${encodeURIComponent(title || 'Crypto News').replace(/\s+/g, '+')}&subtitle=${encodeURIComponent(subtitle || 'Analysis')}`;
      
      res.json({
        success: true,
        image_url: placeholderUrl,
        metadata: {
          method: 'placeholder_fallback',
          client_id: client_id || 'generic',
          title: title || 'Crypto News',
          subtitle: subtitle || 'Analysis',
          generated_at: new Date().toISOString()
        }
      });
    }
    
  } catch (error) {
    // Fallback to placeholder on error
    const placeholderUrl = `https://via.placeholder.com/1800x900/4A90E2/FFFFFF?text=${encodeURIComponent(req.body.title || 'Crypto News').replace(/\s+/g, '+')}&subtitle=${encodeURIComponent(req.body.subtitle || 'Analysis')}`;
    
    res.json({
      success: true,
      image_url: placeholderUrl,
      metadata: {
        method: 'placeholder_error',
        client_id: req.body.client_id || 'generic',
        title: req.body.title || 'Crypto News',
        subtitle: req.body.subtitle || 'Analysis',
        generated_at: new Date().toISOString(),
        error: error.message
      }
    });
  }
});

module.exports = router;