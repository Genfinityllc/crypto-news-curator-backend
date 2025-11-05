const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');
const WatermarkService = require('./watermarkService');

/**
 * Universal LoRA Service - NO FALLBACKS
 * Generates images with proper IDs and hosting
 * Pure LoRA implementation as requested
 */
class UniversalLoraService {
  constructor() {
    this.hfSpacesUrl = process.env.HF_SPACES_LORA_URL || 'https://valtronk-crypto-news-lora-generator.hf.space';
    this.timeout = 300000; // 5 minutes
    this.imageStorePath = path.join(__dirname, '../../temp/lora-images');
    this.baseUrl = process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app';
    this.watermarkService = new WatermarkService();
    
    // Ensure storage directory exists
    this.ensureStorageDirectory();
    
    logger.info('🎨 Universal LoRA Service initialized - NO FALLBACKS MODE + Genfinity Watermark');
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
   * Generate LoRA image with proper ID and hosting
   * NO FALLBACKS - Pure LoRA only
   */
  async generateWithId(articleData, options = {}) {
    const imageId = this.generateImageId();
    const imagePath = path.join(this.imageStorePath, `${imageId}.png`);
    const imageUrl = this.getImageUrl(imageId);
    
    logger.info(`🎨 Generating LoRA image with ID: ${imageId}`);
    
    try {
      // Call HF Spaces LoRA service - NO FALLBACKS
      const result = await this.callHfSpacesLora(articleData, options);
      
      if (!result.success || !result.image_url) {
        throw new Error('HF Spaces LoRA generation failed - no fallbacks available');
      }
      
      // Download and store image with proper ID
      await this.downloadAndStoreImage(result.image_url, imagePath);
      
      // Apply Genfinity watermark to stored image
      logger.info(`🏷️ Applying Genfinity watermark to image: ${imageId}`);
      const watermarkTempPath = imagePath.replace('.png', '_temp_watermark.png');
      const watermarkResult = await this.watermarkService.addWatermark(imagePath, watermarkTempPath);
      
      // Replace original with watermarked version
      if (watermarkResult.success && watermarkResult.outputPath === watermarkTempPath) {
        await fs.rename(watermarkTempPath, imagePath);
        logger.info(`✅ Watermarked image replaced original: ${imageId}`);
      }
      
      // Verify final watermarked image exists
      const imageExists = await this.verifyImageExists(imagePath);
      if (!imageExists) {
        throw new Error('Watermarked image storage verification failed');
      }
      
      logger.info(`✅ LoRA image generated and stored: ${imageId}`);
      
      return {
        success: true,
        imageId: imageId,
        imageUrl: imageUrl,
        metadata: {
          method: 'universal_lora',
          client_id: this.detectClient(articleData),
          title: articleData.title,
          generated_at: new Date().toISOString(),
          stored_at: imagePath,
          watermarked: true,
          watermark: 'genfinity'
        }
      };
      
    } catch (error) {
      logger.error(`❌ LoRA generation failed for ${imageId}: ${error.message}`);
      
      // NO FALLBACKS - Return error as requested
      throw new Error(`Universal LoRA generation failed: ${error.message}`);
    }
  }

  /**
   * Call HF Spaces LoRA service via Gradio Queue System
   */
  async callHfSpacesLora(articleData, options = {}) {
    const clientId = this.detectClient(articleData);
    const subtitle = this.createSubtitle(articleData);
    const style = options.style || this.selectStyle(articleData);
    const sessionHash = this.generateSessionHash();
    
    logger.info(`🤗 Calling HF Spaces Gradio Queue: ${this.hfSpacesUrl}`);
    logger.info(`📋 Parameters: title="${articleData.title}", subtitle="${subtitle}", client="${clientId}", style="${style}"`);
    
    try {
      // Step 1: Join the queue with proper session hash
      const joinResponse = await axios.post(`${this.hfSpacesUrl}/queue/join`, {
        data: [
          articleData.title,  // title_input
          subtitle,           // subtitle_input
          clientId,          // client_select
          style              // style_select
        ],
        fn_index: 0,
        session_hash: sessionHash
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!joinResponse.data || !joinResponse.data.event_id) {
        throw new Error('Failed to join HF Spaces queue');
      }
      
      const eventId = joinResponse.data.event_id;
      logger.info(`🎯 Joined HF Spaces queue with event ID: ${eventId}, session: ${sessionHash}`);
      
      // Step 2: Poll for results using correct session hash and event ID
      const result = await this.pollGradioQueue(eventId, sessionHash);
      
      if (result.success && result.image_url) {
        logger.info(`✅ HF Spaces LoRA generation successful`);
        return result;
      } else {
        throw new Error(`HF Spaces generation failed: ${result.error || 'Unknown error'}`);
      }
      
    } catch (error) {
      if (error.response) {
        logger.error(`❌ HF Spaces queue error ${error.response.status}: ${error.response.data?.detail || error.message}`);
        throw new Error(`HF Spaces queue error: ${error.response.data?.detail || error.message}`);
      } else {
        logger.error(`❌ HF Spaces connection error: ${error.message}`);
        throw new Error(`HF Spaces connection failed: ${error.message}`);
      }
    }
  }

  /**
   * Generate session hash for Gradio
   */
  generateSessionHash() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Poll Gradio queue for results
   */
  async pollGradioQueue(eventId, sessionHash) {
    const maxAttempts = 20; // Reduced attempts
    const pollInterval = 10000; // 10 seconds between polls
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        logger.info(`🔄 Polling HF Spaces queue (attempt ${attempt + 1}/${maxAttempts}) for event: ${eventId}`);
        
        // Use correct session hash for polling with longer timeout for SSE
        const response = await axios.get(`${this.hfSpacesUrl}/queue/data?session_hash=${sessionHash}`, {
          timeout: 30000, // Increased timeout for SSE
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache'
          }
        });
        
        // Parse SSE data
        const lines = response.data.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              // Check if this is our event ID
              if (data.event_id === eventId) {
                if (data.msg === 'process_completed' && data.output) {
                  const [status_text, image_data] = data.output.data;
                  
                  if (status_text && status_text.includes('✅') && image_data) {
                    logger.info(`🎉 HF Spaces generation completed successfully`);
                    return {
                      success: true,
                      image_url: image_data.url || image_data.path || image_data,
                      status: status_text
                    };
                  } else {
                    return {
                      success: false,
                      error: `Generation failed: ${status_text || 'Unknown error'}`
                    };
                  }
                } else if (data.msg === 'process_starts') {
                  logger.info(`🚀 HF Spaces processing started for event: ${eventId}`);
                } else if (data.msg === 'estimation') {
                  logger.info(`⏳ Queue position: ${data.rank || 'N/A'}, estimated wait: ${data.queue_eta || 'N/A'}s`);
                }
              }
            } catch (parseError) {
              // Ignore parsing errors and continue
              logger.debug(`Parse error (non-critical): ${parseError.message}`);
            }
          }
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
      } catch (pollError) {
        logger.warn(`⚠️ Poll attempt ${attempt + 1} failed: ${pollError.message}`);
        
        // Check if this is a specific axios timeout vs stream abort
        if (pollError.message.includes('stream has been aborted') || pollError.code === 'ECONNABORTED') {
          logger.info(`🔄 Stream timeout on attempt ${attempt + 1}, this is normal for SSE polling`);
        } else {
          logger.error(`🚨 Unexpected polling error: ${pollError.message}`);
        }
        
        // Wait before retrying (shorter wait for stream aborts)
        const waitTime = pollError.message.includes('stream has been aborted') ? 3000 : pollInterval;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    throw new Error('HF Spaces queue polling timeout - no response after 5 minutes');
  }

  /**
   * Download image from URL and store with proper ID
   */
  async downloadAndStoreImage(imageUrl, localPath) {
    try {
      logger.info(`📥 Downloading image from: ${imageUrl}`);
      
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 60000
      });
      
      await fs.writeFile(localPath, response.data);
      logger.info(`💾 Image stored at: ${localPath}`);
      
    } catch (error) {
      throw new Error(`Failed to download/store image: ${error.message}`);
    }
  }

  /**
   * Verify image exists and is valid
   */
  async verifyImageExists(imagePath) {
    try {
      const stats = await fs.stat(imagePath);
      return stats.size > 1000; // Ensure file is not empty/corrupted
    } catch (error) {
      return false;
    }
  }

  /**
   * Detect client from article data
   */
  detectClient(articleData) {
    if (!articleData) return 'generic';
    
    const title = (articleData.title || '').toLowerCase();
    const content = (articleData.content || '').toLowerCase();
    const network = (articleData.network || '').toLowerCase();
    
    if (network === 'hedera' || title.includes('hedera') || content.includes('hedera')) return 'hedera';
    if (network === 'algorand' || title.includes('algorand') || content.includes('algorand')) return 'algorand';
    if (network === 'constellation' || title.includes('constellation') || content.includes('constellation')) return 'constellation';
    if (network === 'bitcoin' || title.includes('bitcoin') || content.includes('btc')) return 'bitcoin';
    if (network === 'ethereum' || title.includes('ethereum') || content.includes('eth')) return 'ethereum';
    
    return 'generic';
  }

  /**
   * Create subtitle for article
   */
  createSubtitle(articleData) {
    if (articleData.network) {
      return `${articleData.network.toUpperCase()} NEWS`;
    }
    return 'CRYPTO NEWS';
  }

  /**
   * Select style based on article content
   */
  selectStyle(articleData) {
    const title = (articleData.title || '').toLowerCase();
    
    if (title.includes('institutional') || title.includes('enterprise')) return 'crystalline_structures';
    if (title.includes('innovation') || title.includes('breakthrough')) return 'energy_fields';
    if (title.includes('network') || title.includes('protocol')) return 'network_nodes';
    if (title.includes('defi') || title.includes('trading')) return 'particle_waves';
    if (title.includes('launch') || title.includes('announcement')) return 'abstract_flow';
    
    const styles = ['energy_fields', 'network_nodes', 'abstract_flow', 'geometric_patterns', 'particle_waves', 'crystalline_structures'];
    return styles[Math.floor(Math.random() * styles.length)];
  }


  /**
   * Retrieve image by ID
   */
  async getImageById(imageId) {
    const imagePath = path.join(this.imageStorePath, `${imageId}.png`);
    const imageUrl = this.getImageUrl(imageId);
    
    const exists = await this.verifyImageExists(imagePath);
    if (!exists) {
      throw new Error(`Image with ID ${imageId} not found`);
    }
    
    return {
      success: true,
      imageId: imageId,
      imageUrl: imageUrl,
      imagePath: imagePath
    };
  }

  /**
   * List all generated images
   */
  async listImages() {
    try {
      const files = await fs.readdir(this.imageStorePath);
      const imageFiles = files.filter(file => file.endsWith('.png') && file.startsWith('lora_'));
      
      const images = imageFiles.map(file => {
        const imageId = file.replace('.png', '');
        return {
          imageId: imageId,
          imageUrl: this.getImageUrl(imageId),
          fileName: file
        };
      });
      
      return {
        success: true,
        count: images.length,
        images: images
      };
      
    } catch (error) {
      throw new Error(`Failed to list images: ${error.message}`);
    }
  }
}

module.exports = UniversalLoraService;