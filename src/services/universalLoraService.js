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
      // Call HF Spaces LoRA service
      const result = await this.callHfSpacesLora(articleData, options);
      
      if (!result.success || !result.image_url) {
        throw new Error('HF Spaces LoRA generation failed - no fallbacks available');
      }
      
      // Download and store image with proper ID
      await this.downloadAndStoreImage(result.image_url, imagePath);
      
      // Apply Genfinity watermark to stored image
      logger.info(`🏷️ Applying Genfinity watermark to image: ${imageId}`);
      await this.watermarkService.addWatermark(imagePath);
      
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
   * Call HF Spaces LoRA service via Python client
   */
  async callHfSpacesLora(articleData, options = {}) {
    const { spawn } = require('child_process');
    const pythonScript = path.join(__dirname, '../../hf_spaces_client.py');
    
    // Check if Python script exists
    try {
      await fs.access(pythonScript);
    } catch (error) {
      throw new Error('HF Spaces Python client not found - deploy HF Spaces first');
    }
    
    const clientId = this.detectClient(articleData);
    const subtitle = this.createSubtitle(articleData);
    const style = options.style || this.selectStyle(articleData);
    
    const args = [pythonScript, articleData.title, subtitle, clientId, style];
    
    logger.info(`🐍 Calling HF Spaces via Python: ${args.join(' ')}`);
    
    return new Promise((resolve, reject) => {
      const python = spawn('python3', args);
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (e) {
            reject(new Error(`Failed to parse Python output: ${e.message}`));
          }
        } else {
          reject(new Error(`Python script failed: ${stderr}`));
        }
      });
      
      python.on('error', (err) => {
        reject(new Error(`Python execution failed: ${err.message}`));
      });
      
      // Timeout
      setTimeout(() => {
        python.kill();
        reject(new Error('HF Spaces timeout - no fallbacks available'));
      }, this.timeout);
    });
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