const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');
const WatermarkService = require('./watermarkService');

/**
 * ULTRA FIXED Universal LoRA Service - Async Event Stream API
 * Uses the REAL Gradio async pattern that your HF Space actually uses
 */
class UltraFixedLoraService {
  constructor() {
    this.hfSpacesUrl = process.env.HF_SPACES_LORA_URL || 'https://valtronk-crypto-news-lora-generator.hf.space';
    this.timeout = 300000; // 5 minutes
    this.imageStorePath = path.join(__dirname, '../../temp/lora-images');
    this.baseUrl = process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app';
    this.watermarkService = new WatermarkService();
    
    // Ensure storage directory exists
    this.ensureStorageDirectory();
    
    logger.info('🎨 ULTRA FIXED Universal LoRA Service initialized - Async Event Stream API');
  }

  async ensureStorageDirectory() {
    try {
      await fs.mkdir(this.imageStorePath, { recursive: true });
      logger.info(`📁 LoRA image storage ready: ${this.imageStorePath}`);
    } catch (error) {
      logger.error('❌ Failed to create storage directory:', error);
    }
  }

  /**
   * Generate unique image ID
   */
  generateImageId() {
    const randomBytes = crypto.randomBytes(8);
    return `lora_${randomBytes.toString('hex')}`;
  }

  /**
   * Get hosted image URL for an image ID
   */
  getImageUrl(imageId) {
    return `${this.baseUrl}/temp/lora-images/${imageId}.png`;
  }

  /**
   * ULTRA FIXED: Async event stream API (how Gradio actually works)
   */
  async generateUniversalLoraImage(title, subtitle = '', client = '', style = 'modern') {
    try {
      const imageId = this.generateImageId();
      const startTime = Date.now();
      
      logger.info(`🎨 Starting ULTRA FIXED LoRA generation for: "${title}"`);
      logger.info(`📋 Parameters: subtitle="${subtitle}", client="${client}", style="${style}"`);
      
      // Create enhanced prompt
      const prompt = this.createEnhancedPrompt(title, subtitle, client, style);
      logger.info(`🔤 Enhanced prompt: "${prompt}"`);
      
      // Step 1: Submit job to HF Spaces (get event_id)
      const submitUrl = `${this.hfSpacesUrl}/call/generate_crypto_cover`;
      logger.info(`🌐 Submitting job to: ${submitUrl}`);
      
      const submitResponse = await axios.post(submitUrl, {
        data: [
          prompt,           // Image prompt
          title,           // Cover title
          "",              // Negative prompt (default)
          30,              // Inference steps
          7.5              // Guidance scale
        ]
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      const eventId = submitResponse.data.event_id;
      if (!eventId) {
        throw new Error('No event_id received from HF Spaces');
      }
      
      logger.info(`✅ Job submitted, event_id: ${eventId}`);
      
      // Step 2: Poll for completion using event stream
      const resultUrl = `${this.hfSpacesUrl}/call/generate_crypto_cover/${eventId}`;
      logger.info(`🔄 Polling for results: ${resultUrl}`);
      
      const imageData = await this.pollAsyncResult(resultUrl, eventId);
      
      if (!imageData) {
        throw new Error('No image data received from async polling');
      }
      
      // Step 3: Download image
      const imageUrl = imageData.url;
      logger.info(`⬇️ Downloading image from: ${imageUrl}`);
      
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 60000
      });
      
      // Save image locally
      const imagePath = path.join(this.imageStorePath, `${imageId}.png`);
      await fs.writeFile(imagePath, imageResponse.data);
      
      const fileSize = (await fs.stat(imagePath)).size;
      logger.info(`💾 Image saved: ${imagePath} (${fileSize} bytes)`);
      
      // Apply watermark
      let finalImagePath = imagePath;
      try {
        finalImagePath = await this.watermarkService.addWatermark(imagePath, imageId);
        logger.info(`🔖 Watermark applied: ${finalImagePath}`);
      } catch (watermarkError) {
        logger.warn(`⚠️ Watermark failed, using original: ${watermarkError.message}`);
      }
      
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      logger.info(`🎉 ULTRA FIXED LoRA generation completed in ${totalTime}s`);
      
      return {
        success: true,
        imageId: imageId,
        imageUrl: this.getImageUrl(imageId),
        localPath: finalImagePath,
        metadata: {
          title,
          subtitle,
          client,
          style,
          prompt,
          generationTime: totalTime,
          method: 'async_event_stream',
          model: 'SDXL_LoRA',
          eventId: eventId,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('❌ ULTRA FIXED Universal LoRA generation failed:', error);
      
      if (error.response) {
        logger.error(`📊 Response status: ${error.response.status}`);
        logger.error(`📄 Response data:`, error.response.data);
      }
      
      throw new Error(`ULTRA FIXED Universal LoRA generation failed: ${error.message}`);
    }
  }

  /**
   * Poll async result using event stream
   */
  async pollAsyncResult(resultUrl, eventId) {
    const maxAttempts = 60; // 5 minutes max
    const pollInterval = 5000; // 5 seconds
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        logger.info(`🔄 Polling attempt ${attempt + 1}/${maxAttempts} for event: ${eventId}`);
        
        const response = await axios.get(resultUrl, {
          timeout: 15000,
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache'
          }
        });
        
        // Parse event stream response
        const lines = response.data.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('event: complete')) {
            logger.info(`✅ Event complete detected`);
            continue;
          }
          
          if (line.startsWith('data: ')) {
            const dataString = line.substring(6);
            
            try {
              const data = JSON.parse(dataString);
              
              if (Array.isArray(data) && data.length > 0) {
                const imageData = data[0];
                
                if (imageData && typeof imageData === 'object' && (imageData.url || imageData.path)) {
                  logger.info(`🖼️ Image data found:`, imageData);
                  return imageData;
                }
              }
            } catch (parseError) {
              // Not JSON, might be status message
              logger.info(`📄 Non-JSON data: ${dataString}`);
            }
          }
        }
        
        // If we get here, no completion found yet - wait and retry
        logger.info(`⏳ No completion yet, waiting ${pollInterval}ms...`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
      } catch (pollError) {
        if (pollError.response && pollError.response.status === 404) {
          logger.info(`⏳ Event not ready yet (404), waiting...`);
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }
        
        logger.error(`❌ Polling error: ${pollError.message}`);
        throw pollError;
      }
    }
    
    throw new Error(`Timeout: No completion after ${maxAttempts} attempts`);
  }

  /**
   * Create enhanced prompt for better generation
   */
  createEnhancedPrompt(title, subtitle, client, style) {
    let prompt = `Professional cryptocurrency news cover: ${title}`;
    
    if (subtitle) {
      prompt += `, ${subtitle}`;
    }
    
    // Add style-specific keywords
    const styleKeywords = {
      'modern': 'clean, minimalist, professional, high-tech',
      'futuristic': 'neon, cyberpunk, digital, advanced technology',
      'classic': 'traditional, elegant, sophisticated, timeless',
      'bold': 'vibrant colors, strong typography, dramatic, eye-catching'
    };
    
    if (styleKeywords[style]) {
      prompt += `, ${styleKeywords[style]}`;
    }
    
    prompt += ', crypto currency, blockchain, digital asset, high quality, detailed, 4k';
    
    return prompt;
  }

  /**
   * Test HF Spaces connectivity
   */
  async testConnection() {
    try {
      logger.info(`🔍 Testing HF Spaces connection: ${this.hfSpacesUrl}`);
      
      const response = await axios.get(`${this.hfSpacesUrl}/info`, {
        timeout: 10000
      });
      
      logger.info(`✅ HF Spaces is accessible`);
      logger.info(`📋 Available endpoints:`, Object.keys(response.data.named_endpoints || {}));
      
      return {
        success: true,
        endpoints: response.data.named_endpoints,
        status: 'accessible'
      };
      
    } catch (error) {
      logger.error(`❌ HF Spaces connection failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        status: 'unreachable'
      };
    }
  }

  /**
   * Compatibility method for old imageHostingService calls
   */
  async generateLoraImage(title, content = '', network = 'generic', style = 'modern') {
    return this.generateUniversalLoraImage(title, content, network, style);
  }
}

module.exports = UltraFixedLoraService;