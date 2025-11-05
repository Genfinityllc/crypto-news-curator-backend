const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');
const WatermarkService = require('./watermarkService');

/**
 * WORKING Universal LoRA Service - Uses the actual HF Spaces pattern that works
 * Based on manual testing of the HF Space API
 */
class WorkingLoraService {
  constructor() {
    this.hfSpacesUrl = process.env.HF_SPACES_LORA_URL || 'https://valtronk-crypto-news-lora-generator.hf.space';
    this.timeout = 240000; // 4 minutes
    this.imageStorePath = path.join(__dirname, '../../temp/lora-images');
    this.baseUrl = process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app';
    this.watermarkService = new WatermarkService();
    
    // Ensure storage directory exists (non-blocking)
    this.ensureStorageDirectory().catch(err => {
      logger.error('❌ Failed to create storage directory:', err);
    });
    
    logger.info('🎨 WORKING Universal LoRA Service initialized - Real HF Spaces pattern');
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
   * FIXED: Modern Gradio queue-based pattern
   */
  async generateUniversalLoraImage(title, subtitle = '', client = '', style = 'modern') {
    try {
      const imageId = this.generateImageId();
      const startTime = Date.now();
      
      logger.info(`🎨 Starting FIXED LoRA generation for: "${title}"`);
      
      // Create enhanced prompt
      const prompt = this.createEnhancedPrompt(title, subtitle, client, style);
      logger.info(`🔤 Enhanced prompt: "${prompt}"`);
      
      // STEP 1: Call the Gradio 5.x API (new pattern)
      const submitUrl = `${this.hfSpacesUrl}/gradio_api/call/generate_crypto_cover`;
      logger.info(`🌐 Calling Gradio 5.x API: ${submitUrl}`);
      
      const submitResponse = await axios.post(submitUrl, {
        data: [
          prompt,          // Image prompt
          title,           // Cover title
          "",              // Negative prompt (use default)
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
        throw new Error('No event_id received from HF Spaces queue');
      }
      
      logger.info(`✅ Got event_id: ${eventId}`);
      
      // STEP 2: Poll Gradio 5.x event for completion
      const resultUrl = `${this.hfSpacesUrl}/gradio_api/call/generate_crypto_cover/${eventId}`;
      logger.info(`🔄 Polling Gradio 5.x event: ${resultUrl}`);
      
      // Efficient polling with queue-aware intervals
      let imageData = null;
      const maxAttempts = 40; // 2-3 minutes total with varying intervals
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          logger.info(`🔄 Gradio 5.x polling attempt ${attempt + 1}/${maxAttempts}`);
          
          const pollResponse = await axios.get(resultUrl, {
            timeout: 25000,
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
          
          logger.info(`📦 Poll response: ${JSON.stringify(pollResponse.data)}`);
          
          // Check if generation is complete
          if (pollResponse.data && pollResponse.data.length > 0) {
            const result = pollResponse.data[pollResponse.data.length - 1]; // Get latest event
            
            if (result.type === 'complete' && result.data) {
              logger.info(`✅ Generation complete!`);
              logger.info(`🔍 Result data: ${JSON.stringify(result.data, null, 2)}`);
              
              if (Array.isArray(result.data) && result.data.length > 0) {
                const potentialImage = result.data[0];
                logger.info(`🔍 Potential image: ${JSON.stringify(potentialImage, null, 2)}`);
                
                if (potentialImage && typeof potentialImage === 'object' && 
                    (potentialImage.url || potentialImage.path)) {
                  imageData = potentialImage;
                  logger.info(`🎉 Queue polling completed successfully in ${attempt + 1} attempts`);
                  break;
                }
              }
            }
          }
          
          // Wait with progressive backoff
          if (attempt < maxAttempts - 1) {
            const waitTime = Math.min(2000 + (attempt * 200), 10000); // 2-10 seconds
            logger.info(`⏳ Queue not ready, waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
          
        } catch (pollError) {
          // Handle common SSE errors gracefully
          if (pollError.code === 'ECONNABORTED' || pollError.message.includes('timeout')) {
            logger.info(`🔄 Connection timeout (normal for SSE), continuing...`);
          } else if (pollError.message.includes('stream has been aborted')) {
            logger.info(`🔄 Stream completed (normal for SSE), continuing...`);
          } else {
            logger.warn(`⚠️ Queue polling error on attempt ${attempt + 1}: ${pollError.message}`);
          }
          
          if (attempt < maxAttempts - 1) {
            const waitTime = pollError.code === 'ECONNABORTED' ? 5000 : 8000;
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
      
      if (!imageData) {
        throw new Error(`Queue timeout: No image generated after ${maxAttempts} attempts`);
      }
      
      // STEP 3: Download the image (handle Gradio file URLs)
      let imageUrl = imageData.url || imageData.path;
      
      // Convert relative paths to absolute URLs
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = `${this.hfSpacesUrl}/file=${imageUrl}`;
        logger.info(`🔧 Constructed absolute URL: ${imageUrl}`);
      }
      
      if (!imageUrl) {
        throw new Error(`No valid image URL found in response data`);
      }
      
      logger.info(`⬇️ Downloading image from: ${imageUrl}`);
      
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LoRAService/1.0)'
        }
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
      logger.info(`🎉 FIXED LoRA generation completed in ${totalTime}s`);
      
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
          method: 'fixed_gradio_queue_pattern',
          model: 'SDXL_LoRA',
          eventId: eventId,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('❌ FIXED Universal LoRA generation failed:', error);
      
      if (error.response) {
        logger.error(`📊 Response status: ${error.response.status}`);
        logger.error(`📄 Response data:`, error.response.data);
      }
      
      throw new Error(`FIXED Universal LoRA generation failed: ${error.message}`);
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
   * Generate session hash for Gradio
   */
  generateSessionHash() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Parse SSE response data for queue completion
   */
  parseSSEResponse(data, targetEventId) {
    try {
      const responseText = typeof data === 'string' ? data : String(data);
      const lines = responseText.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonText = line.substring(6).trim();
            if (!jsonText || jsonText === '[DONE]') continue;
            
            const parsed = JSON.parse(jsonText);
            
            // Check if this event matches our target
            if (parsed.event_id === targetEventId) {
              if (parsed.msg === 'process_completed' && parsed.output) {
                logger.info(`🎉 HF Spaces generation completed for event: ${targetEventId}`);
                return parsed;
              }
              
              if (parsed.msg === 'estimation') {
                const eta = parsed.rank_eta ? `${parsed.rank_eta}s` : 'N/A';
                const pos = parsed.rank || 'N/A';
                logger.info(`⏳ Queue position: ${pos}, estimated wait: ${eta}`);
              }
              
              if (parsed.msg === 'process_starts') {
                logger.info(`🚀 HF Spaces processing started for event: ${targetEventId}`);
              }
              
              if (parsed.msg === 'progress') {
                const progress = parsed.progress || 0;
                logger.info(`📊 Generation progress: ${(progress * 100).toFixed(1)}%`);
              }
            }
          } catch (parseError) {
            // Ignore malformed JSON lines - normal for SSE
            logger.debug(`Skipping non-JSON SSE line: ${line.substring(0, 50)}...`);
          }
        }
      }
    } catch (error) {
      logger.warn(`⚠️ SSE parsing error: ${error.message}`);
    }
    
    return null;
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

module.exports = WorkingLoraService;