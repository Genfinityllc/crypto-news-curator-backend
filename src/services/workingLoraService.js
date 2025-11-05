const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
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
   * FIXED: Gradio queue-based pattern with proper dimensions
   */
  async generateUniversalLoraImage(title, subtitle = '', client = '', style = 'modern') {
    try {
      const imageId = this.generateImageId();
      const startTime = Date.now();
      
      logger.info(`🎨 Starting Gradio LoRA generation for: "${title}"`);
      
      // Create enhanced prompt
      const prompt = this.createEnhancedPrompt(title, subtitle, client, style);
      logger.info(`🔤 Enhanced prompt: "${prompt}"`);
      
      // STEP 1: Call the Gradio API
      const submitUrl = `${this.hfSpacesUrl}/gradio_api/call/generate_crypto_cover`;
      logger.info(`🌐 Calling Gradio API: ${submitUrl}`);
      
      const submitResponse = await axios.post(submitUrl, {
        data: [
          prompt,          // Image prompt
          title,           // Cover title
          "",              // Negative prompt (use default)
          20,              // Inference steps (reduced from 30)
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
      
      // STEP 2: Poll Gradio event for completion
      const resultUrl = `${this.hfSpacesUrl}/gradio_api/call/generate_crypto_cover/${eventId}`;
      logger.info(`🔄 Polling Gradio event: ${resultUrl}`);
      
      // Poll for completion
      let imageData = null;
      const maxAttempts = 30; // Reduced attempts for faster failure
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          logger.info(`🔄 Polling attempt ${attempt + 1}/${maxAttempts}`);
          
          const pollResponse = await axios.get(resultUrl, {
            timeout: 15000, // Shorter timeout
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
          
          // Check for completion
          if (pollResponse.data && pollResponse.data.includes && pollResponse.data.includes('complete')) {
            logger.info(`✅ Generation complete!`);
            // Parse the SSE response
            const responseText = typeof pollResponse.data === 'string' ? pollResponse.data : String(pollResponse.data);
            const lines = responseText.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const jsonText = line.substring(6).trim();
                  if (jsonText && jsonText !== '[DONE]') {
                    const parsed = JSON.parse(jsonText);
                    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]) {
                      // Check if first element is an image object or base64
                      const potentialImage = parsed[0];
                      if (typeof potentialImage === 'string' && potentialImage.startsWith('data:image/')) {
                        imageData = { dataUrl: potentialImage };
                        break;
                      } else if (potentialImage && typeof potentialImage === 'object' && 
                                (potentialImage.url || potentialImage.path)) {
                        imageData = potentialImage;
                        break;
                      }
                    }
                  }
                } catch (parseError) {
                  // Continue looking for valid data
                }
              }
            }
            
            if (imageData) {
              logger.info(`🎉 Polling completed successfully in ${attempt + 1} attempts`);
              break;
            }
          }
          
          // Wait between attempts
          if (attempt < maxAttempts - 1) {
            const waitTime = Math.min(3000 + (attempt * 200), 8000); // 3-8 seconds
            logger.info(`⏳ Waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
          
        } catch (pollError) {
          logger.warn(`⚠️ Polling error on attempt ${attempt + 1}: ${pollError.message}`);
          if (attempt < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      }
      
      if (!imageData) {
        throw new Error(`Generation timeout: No image generated after ${maxAttempts} attempts`);
      }
      
      // STEP 3: Download the image
      let imageBuffer;
      if (imageData.dataUrl) {
        // Handle base64 data URL
        logger.info(`📥 Processing base64 image data`);
        const base64Data = imageData.dataUrl.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        // Handle file URL
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
        
        imageBuffer = imageResponse.data;
      }
      
      // Save image locally
      const imagePath = path.join(this.imageStorePath, `${imageId}.png`);
      await fs.writeFile(imagePath, imageBuffer);
      
      const fileSize = (await fs.stat(imagePath)).size;
      logger.info(`💾 Image saved: ${imagePath} (${fileSize} bytes)`);
      
      // Resize to standard dimensions BEFORE watermarking (using dimensions divisible by 8)
      await this.resizeToStandardDimensions(imagePath);
      
      // Apply watermark
      let finalImagePath = imagePath;
      try {
        finalImagePath = await this.watermarkService.addWatermark(imagePath, imageId);
        logger.info(`🔖 Watermark applied: ${finalImagePath}`);
      } catch (watermarkError) {
        logger.warn(`⚠️ Watermark failed, using original: ${watermarkError.message}`);
      }
      
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      logger.info(`🎉 Gradio LoRA generation completed in ${totalTime}s`);
      
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
          method: 'gradio_queue_fixed',
          model: 'SD_LoRA',
          eventId: eventId,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('❌ Gradio Universal LoRA generation failed:', error);
      
      if (error.response) {
        logger.error(`📊 Response status: ${error.response.status}`);
        logger.error(`📄 Response data:`, error.response.data);
      }
      
      throw new Error(`Gradio Universal LoRA generation failed: ${error.message}`);
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
   * Resize image to standard dimensions divisible by 8 to prevent SDXL errors
   */
  async resizeToStandardDimensions(imagePath) {
    try {
      logger.info(`📐 Resizing to SDXL-compatible 1792x896 dimensions: ${path.basename(imagePath)}`);
      
      const tempPath = imagePath.replace('.png', '_resized.png');
      
      await sharp(imagePath)
        .resize(1792, 896, {  // Both dimensions divisible by 8
          fit: 'cover',
          position: 'center'
        })
        .png({ quality: 95 })
        .toFile(tempPath);
      
      // Replace original with resized version
      await fs.rename(tempPath, imagePath);
      logger.info(`✅ Image resized to 1792x896 (divisible by 8): ${path.basename(imagePath)}`);
      
    } catch (error) {
      throw new Error(`Image resize failed: ${error.message}`);
    }
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