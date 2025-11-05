const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');
const WatermarkService = require('./watermarkService');

/**
 * SIMPLE FIXED Universal LoRA Service - Direct sync approach
 * Bypasses complex async event streaming for reliability
 */
class SimpleFixedLoraService {
  constructor() {
    this.hfSpacesUrl = process.env.HF_SPACES_LORA_URL || 'https://valtronk-crypto-news-lora-generator.hf.space';
    this.timeout = 180000; // 3 minutes - shorter for reliability
    this.imageStorePath = path.join(__dirname, '../../temp/lora-images');
    this.baseUrl = process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app';
    this.watermarkService = new WatermarkService();
    
    // Ensure storage directory exists
    this.ensureStorageDirectory();
    
    logger.info('🎨 SIMPLE FIXED Universal LoRA Service initialized - Direct sync approach');
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
   * SIMPLE FIXED: Use gradio_client pattern for reliable results
   */
  async generateUniversalLoraImage(title, subtitle = '', client = '', style = 'modern') {
    try {
      const imageId = this.generateImageId();
      const startTime = Date.now();
      
      logger.info(`🎨 Starting SIMPLE FIXED LoRA generation for: "${title}"`);
      
      // Create enhanced prompt
      const prompt = this.createEnhancedPrompt(title, subtitle, client, style);
      logger.info(`🔤 Enhanced prompt: "${prompt}"`);
      
      // SIMPLE APPROACH: Try to get result in one call using gradio_client pattern
      const apiUrl = `${this.hfSpacesUrl}/api/predict`;
      logger.info(`🌐 Calling HF Spaces predict API: ${apiUrl}`);
      
      const response = await axios.post(apiUrl, {
        data: [
          prompt,           // Image prompt
          title,           // Cover title  
          "",              // Negative prompt (default)
          30,              // Inference steps
          7.5              // Guidance scale
        ],
        fn_index: 0       // First function
      }, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      logger.info(`✅ HF Spaces API response received`);
      logger.info(`📊 Response status: ${response.status}`);
      
      // Parse response - should have data array with image
      let imageData = null;
      
      if (response.data && response.data.data && Array.isArray(response.data.data)) {
        const outputData = response.data.data;
        logger.info(`📋 Output data:`, outputData);
        
        // Look for image in response data
        for (const item of outputData) {
          if (item && typeof item === 'object' && (item.url || item.path)) {
            imageData = item;
            logger.info(`🖼️ Found image data:`, imageData);
            break;
          }
        }
      }
      
      if (!imageData) {
        logger.error(`❌ No image data in response:`, response.data);
        throw new Error('No image data found in HF Spaces response');
      }
      
      // Download image from HF Spaces
      const imageUrl = imageData.url || `${this.hfSpacesUrl}/file=${imageData.path}`;
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
      logger.info(`🎉 SIMPLE FIXED LoRA generation completed in ${totalTime}s`);
      
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
          method: 'simple_direct_api',
          model: 'SDXL_LoRA',
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('❌ SIMPLE FIXED Universal LoRA generation failed:', error);
      
      if (error.response) {
        logger.error(`📊 Response status: ${error.response.status}`);
        logger.error(`📄 Response data:`, error.response.data);
      }
      
      throw new Error(`SIMPLE FIXED Universal LoRA generation failed: ${error.message}`);
    }
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
   * Compatibility method for old imageHostingService calls
   */
  async generateLoraImage(title, content = '', network = 'generic', style = 'modern') {
    return this.generateUniversalLoraImage(title, content, network, style);
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
}

module.exports = SimpleFixedLoraService;