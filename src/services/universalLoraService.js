const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');
const WatermarkService = require('./watermarkService');

/**
 * FIXED Universal LoRA Service 
 * Proper SSE handling for HF Spaces integration
 * Long-term production architecture
 */
class UniversalLoraService {
  constructor() {
    // ULTRA FIX: Allow using local LoRA model for development
    this.hfSpacesUrl = process.env.HF_SPACES_LORA_URL || process.env.LOCAL_LORA_URL || 'https://valtronk-crypto-news-lora-generator.hf.space';
    this.timeout = 300000; // 5 minutes
    this.imageStorePath = path.join(__dirname, '../../temp/lora-images');
    this.baseUrl = process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app';
    this.watermarkService = new WatermarkService();
    
    // Ensure storage directory exists
    this.ensureStorageDirectory();
    
    logger.info('🎨 Fixed Universal LoRA Service initialized - Production SSE handling');
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
   * Generate LoRA image with proper SSE handling
   */
  async generateLoraImage(title, subtitle = '', client = 'generic', style = 'professional') {
    console.log('🚨 DEBUG: generateLoraImage called with:', { title, subtitle, client, style });
    logger.info('🚨 DEBUG: generateLoraImage method started');
    try {
      const imageId = this.generateImageId();
      const imagePath = path.join(this.imageStorePath, `${imageId}.png`);
      
      logger.info(`🎨 Generating LoRA image with ID: ${imageId}`);
      logger.info(`🤗 Calling HF Spaces Gradio Queue: ${this.hfSpacesUrl}`);
      logger.info(`📋 Parameters: title="${title}", subtitle="${subtitle}", client="${client}", style="${style}"`);

      // Step 1: Join the queue
      const sessionHash = this.generateSessionHash();
      const joinResult = await this.joinGradioQueue(title, subtitle, client, style, sessionHash);
      
      // Step 2: Poll for results with proper SSE handling
      const result = await this.pollGradioQueueFixed(joinResult.eventId, sessionHash);
      
      // Step 3: Download and store image
      await this.downloadAndStoreImage(result.image_url, imagePath);
      
      // Step 4: Resize to standard dimensions BEFORE watermarking
      await this.resizeToStandardDimensions(imagePath);
      
      // Step 5: Apply watermark
      await this.applyWatermarkToImage(imageId, imagePath);
      
      // Step 5: Verify final image
      await this.verifyImageExists(imagePath);
      
      logger.info(`✅ LoRA image generated and stored: ${imageId}`);
      
      return {
        success: true,
        imageId,
        imageUrl: this.getImageUrl(imageId),
        metadata: {
          generation_method: 'universal_lora_fixed',
          watermarked: true,
          watermark: 'genfinity',
          title,
          subtitle,
          client,
          style
        }
      };
      
    } catch (error) {
      logger.error('❌ Universal LoRA generation failed:', error);
      throw new Error(`Universal LoRA generation failed: ${error.message}`);
    }
  }

  /**
   * Generate session hash for Gradio
   */
  generateSessionHash() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Join Gradio queue
   */
  async joinGradioQueue(title, subtitle, client, style, sessionHash) {
    try {
      const response = await axios.post(`${this.hfSpacesUrl}/queue/join`, {
        data: [title, subtitle, client, style],
        fn_index: 0,
        session_hash: sessionHash
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const eventId = response.data.event_id;
      logger.info(`🎯 Joined HF Spaces queue with event ID: ${eventId}, session: ${sessionHash}`);
      
      return { eventId, sessionHash };
      
    } catch (error) {
      throw new Error(`Failed to join HF Spaces queue: ${error.message}`);
    }
  }

  /**
   * FIXED: Poll Gradio queue with proper SSE handling
   */
  async pollGradioQueueFixed(eventId, sessionHash) {
    const maxAttempts = 40; // 6-7 minutes max with varying intervals
    const pollInterval = 10000; // 10 seconds between polls
    const startTime = Date.now();
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const elapsedTime = Math.round((Date.now() - startTime) / 1000);
        logger.info(`🔄 Polling HF Spaces queue (attempt ${attempt + 1}/${maxAttempts}) for event: ${eventId} [${elapsedTime}s elapsed]`);
        
        // FIXED: Use shorter timeout and better error handling for SSE
        const response = await axios.get(`${this.hfSpacesUrl}/queue/data?session_hash=${sessionHash}`, {
          timeout: 25000, // 25 second timeout
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        });
        
        // Parse SSE data efficiently
        const completionData = this.parseSSEResponse(response.data, eventId);
        
        if (completionData) {
          logger.info(`🔍 Completion data received:`, JSON.stringify(completionData, null, 2));
          
          try {
            // Handle different possible response formats
            let image_data = null;
            let status_text = 'Generation completed';
            
            if (completionData.output && completionData.output.data) {
              const outputData = completionData.output.data;
              logger.info(`📋 Output data:`, JSON.stringify(outputData, null, 2));
              
              if (Array.isArray(outputData) && outputData.length > 0) {
                // If it's an array, look for image data
                for (const item of outputData) {
                  if (item && typeof item === 'object' && (item.url || item.path)) {
                    image_data = item;
                    break;
                  }
                }
                if (outputData.length > 1 && typeof outputData[0] === 'string') {
                  status_text = outputData[0];
                }
              } else if (outputData && typeof outputData === 'object') {
                // If it's an object, check if it has image properties
                if (outputData.url || outputData.path) {
                  image_data = outputData;
                }
              }
            }
            
            if (image_data && (image_data.url || image_data.path)) {
              const imageUrl = image_data.url || image_data.path;
              logger.info(`🎉 HF Spaces generation completed successfully with image: ${imageUrl}`);
              return {
                success: true,
                status_text,
                image_url: imageUrl
              };
            } else {
              logger.error(`❌ No valid image data found in response`);
              throw new Error(`HF Spaces generation failed: No image data in response`);
            }
          } catch (parseError) {
            logger.error(`❌ Error parsing completion data:`, parseError);
            throw new Error(`Failed to parse HF Spaces response: ${parseError.message}`);
          }
        }
        
        // Wait before next poll
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        
      } catch (pollError) {
        // FIXED: Better error categorization and handling
        if (pollError.code === 'ECONNABORTED' || pollError.message.includes('timeout')) {
          logger.info(`🔄 Connection timeout on attempt ${attempt + 1} (normal for SSE)`);
        } else if (pollError.message.includes('stream has been aborted')) {
          logger.info(`🔄 Stream completed on attempt ${attempt + 1} (normal for SSE)`);
        } else {
          logger.warn(`⚠️ Unexpected polling error on attempt ${attempt + 1}: ${pollError.message}`);
        }
        
        // Continue polling with shorter wait for timeouts
        if (attempt < maxAttempts - 1) {
          const waitTime = (pollError.code === 'ECONNABORTED') ? 5000 : pollInterval;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw new Error('HF Spaces queue polling timeout - generation may still be processing');
  }

  /**
   * Parse SSE response data efficiently - FIXED for HF Spaces
   */
  parseSSEResponse(data, targetEventId) {
    try {
      // Handle different data types from axios response
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
            // Ignore malformed JSON lines - this is normal for SSE
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
   * Resize image to standard 1800x900 dimensions to prevent watermark stretching
   */
  async resizeToStandardDimensions(imagePath) {
    try {
      logger.info(`📐 Resizing to standard 1800x900 dimensions: ${path.basename(imagePath)}`);
      
      const sharp = require('sharp');
      const tempPath = imagePath.replace('.png', '_resized.png');
      
      await sharp(imagePath)
        .resize(1800, 900, {
          fit: 'cover',
          position: 'center'
        })
        .png({ quality: 95 })
        .toFile(tempPath);
      
      // Replace original with resized version
      await fs.rename(tempPath, imagePath);
      logger.info(`✅ Image resized to 1800x900: ${path.basename(imagePath)}`);
      
    } catch (error) {
      throw new Error(`Image resize failed: ${error.message}`);
    }
  }

  /**
   * Download and store image
   */
  async downloadAndStoreImage(imageUrl, imagePath) {
    try {
      logger.info(`📥 Downloading image from: ${imageUrl}`);
      
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'UniversalLoraService/1.0'
        }
      });
      
      await fs.writeFile(imagePath, response.data);
      logger.info(`💾 Image stored at: ${imagePath}`);
      
    } catch (error) {
      throw new Error(`Image download failed: ${error.message}`);
    }
  }

  /**
   * Apply watermark to stored image
   */
  async applyWatermarkToImage(imageId, imagePath) {
    try {
      logger.info(`🏷️ Applying Genfinity watermark to image: ${imageId}`);
      const watermarkTempPath = imagePath.replace('.png', '_temp_watermark.png');
      const watermarkResult = await this.watermarkService.addWatermark(imagePath, watermarkTempPath);
      
      if (watermarkResult.success && watermarkResult.outputPath === watermarkTempPath) {
        await fs.rename(watermarkTempPath, imagePath);
        logger.info(`✅ Watermarked image replaced original: ${imageId}`);
      }
    } catch (error) {
      throw new Error(`Watermark application failed: ${error.message}`);
    }
  }

  /**
   * Verify image exists and is valid
   */
  async verifyImageExists(imagePath) {
    try {
      const stats = await fs.stat(imagePath);
      if (stats.size === 0) {
        throw new Error('Generated image file is empty');
      }
      return true;
    } catch (error) {
      throw new Error(`Image verification failed: ${error.message}`);
    }
  }
}

module.exports = UniversalLoraService;