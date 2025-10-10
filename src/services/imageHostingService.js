const fs = require('fs').promises;
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Image Hosting Service for LoRA Generated Images
 * Uploads generated images to a public hosting service
 */
class ImageHostingService {
  constructor() {
    // Use a free image hosting service that accepts API uploads
    this.hostingServices = [
      {
        name: 'imgbb',
        upload: this.uploadToImgBB.bind(this),
        apiKey: process.env.IMGBB_API_KEY || 'your_imgbb_key'
      },
      {
        name: 'temporary',
        upload: this.uploadToTemporaryHost.bind(this)
      }
    ];
  }

  /**
   * Upload image to ImgBB (free image hosting)
   */
  async uploadToImgBB(imagePath) {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      const formData = new FormData();
      formData.append('image', base64Image);
      
      const response = await axios.post(`https://api.imgbb.com/1/upload?key=${this.hostingServices[0].apiKey}`, formData, {
        headers: formData.getHeaders(),
        timeout: 30000
      });
      
      if (response.data.success) {
        return {
          success: true,
          url: response.data.data.url,
          display_url: response.data.data.display_url,
          delete_url: response.data.data.delete_url
        };
      }
      
      throw new Error('ImgBB upload failed');
    } catch (error) {
      logger.error('ImgBB upload error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fallback: Create a working image URL using our backend
   */
  async uploadToTemporaryHost(imagePath) {
    try {
      // Copy image to public temp directory
      const fileName = `lora_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
      const tempDir = path.join(__dirname, '../../temp');
      
      // Ensure temp directory exists
      try {
        await fs.mkdir(tempDir, { recursive: true });
      } catch (e) {
        // Directory already exists
      }
      
      const tempPath = path.join(tempDir, fileName);
      await fs.copyFile(imagePath, tempPath);
      
      // Return URL that the backend can serve
      const baseUrl = process.env.BACKEND_URL || 'https://crypto-news-curator-backend-production.up.railway.app';
      const imageUrl = `${baseUrl}/temp/${fileName}`;
      
      return {
        success: true,
        url: imageUrl,
        display_url: imageUrl,
        temporary: true
      };
    } catch (error) {
      logger.error('Temporary hosting error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Upload generated LoRA image to hosting service
   */
  async hostGeneratedImage(imagePath, metadata = {}) {
    logger.info(`📤 Uploading LoRA image: ${imagePath}`);
    
    // Try each hosting service until one works
    for (const service of this.hostingServices) {
      try {
        const result = await service.upload(imagePath);
        if (result.success) {
          logger.info(`✅ Image hosted successfully via ${service.name}: ${result.url}`);
          return {
            success: true,
            url: result.url,
            display_url: result.display_url || result.url,
            delete_url: result.delete_url,
            hosting_service: service.name,
            metadata
          };
        }
      } catch (error) {
        logger.warn(`❌ ${service.name} hosting failed: ${error.message}`);
        continue;
      }
    }
    
    // All hosting services failed
    return {
      success: false,
      error: 'All image hosting services failed',
      metadata
    };
  }

  /**
   * Generate and host a LoRA image
   */
  async generateAndHostLoRAImage(articleData, options = {}) {
    try {
      // Import LoRA service
      const LoRAiService = require('./loraAiService');
      const loraService = new LoRAiService();
      
      if (!loraService.isAvailable()) {
        throw new Error('LoRA service not available');
      }
      
      logger.info(`🎨 Generating LoRA image for: ${articleData.title}`);
      
      // Generate image
      const result = await loraService.generateCryptoNewsImage(articleData, options);
      
      if (result.success && result.coverUrl) {
        // If it's a local file path, upload it
        if (result.coverUrl.startsWith('/') || result.coverUrl.includes('style_outputs')) {
          const imagePath = result.coverUrl.startsWith('/') ? 
            result.coverUrl : 
            path.join(__dirname, '../../ai-cover-generator/style_outputs', path.basename(result.coverUrl));
          
          const hostingResult = await this.hostGeneratedImage(imagePath, {
            title: articleData.title,
            network: articleData.network,
            generated_at: new Date().toISOString()
          });
          
          if (hostingResult.success) {
            return {
              success: true,
              image_url: hostingResult.url,
              display_url: hostingResult.display_url,
              hosting_service: hostingResult.hosting_service,
              generation_method: result.generationMethod,
              metadata: result.metadata
            };
          }
        }
        
        // If it's already a URL, return as-is
        return {
          success: true,
          image_url: result.coverUrl,
          generation_method: result.generationMethod,
          metadata: result.metadata
        };
      }
      
      throw new Error(result.error || 'LoRA generation failed');
      
    } catch (error) {
      logger.error('LoRA generation and hosting failed:', error.message);
      
      // Return intelligent fallback
      const network = articleData?.network || 'crypto';
      const networkColors = {
        'hedera': { bg: '8B2CE6', text: 'FFFFFF', name: 'Hedera' },
        'algorand': { bg: '0078CC', text: 'FFFFFF', name: 'Algorand' },
        'constellation': { bg: '484D8B', text: 'FFFFFF', name: 'Constellation' },
        'bitcoin': { bg: 'F7931A', text: '000000', name: 'Bitcoin' },
        'ethereum': { bg: '627EEA', text: 'FFFFFF', name: 'Ethereum' },
        'generic': { bg: '4A90E2', text: 'FFFFFF', name: 'Crypto' }
      };
      
      const colors = networkColors[network.toLowerCase()] || networkColors['generic'];
      const safeTitle = encodeURIComponent(articleData.title.substring(0, 50));
      const fallbackUrl = `https://via.placeholder.com/1800x900/${colors.bg}/${colors.text}?text=${safeTitle}+%7C+${colors.name}+News`;
      
      return {
        success: true,
        image_url: fallbackUrl,
        generation_method: 'intelligent_fallback',
        error: error.message
      };
    }
  }
}

module.exports = ImageHostingService;