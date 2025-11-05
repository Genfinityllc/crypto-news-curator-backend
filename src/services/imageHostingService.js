const fs = require('fs').promises;
const createWriteStream = require('fs').createWriteStream;
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
   * Download image from URL and host it locally
   */
  async downloadAndHostImage(imageUrl, metadata = {}) {
    try {
      logger.info(`📥 Downloading LoRA image from: ${imageUrl}`);
      
      // Create safe filename
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 9);
      const filename = `lora_${timestamp}_${randomId}.png`;
      
      // Download image
      const response = await axios.get(imageUrl, { 
        responseType: 'stream',
        timeout: 30000,
        headers: {
          'User-Agent': 'Crypto-News-Curator/1.0'
        }
      });
      
      if (response.status !== 200) {
        throw new Error(`Failed to download image: HTTP ${response.status}`);
      }
      
      // Save to local temp directory
      const tempDir = path.join(__dirname, '../../temp/lora-images');
      
      // Ensure directory exists
      try {
        await fs.mkdir(tempDir, { recursive: true });
      } catch (e) {
        // Directory already exists
      }
      
      const localPath = path.join(tempDir, filename);
      const writeStream = createWriteStream(localPath);
      
      // Pipe the image data to file
      response.data.pipe(writeStream);
      
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
      
      // Generate URL that backend can serve
      const baseUrl = process.env.BACKEND_URL || 'https://crypto-news-curator-backend-production.up.railway.app';
      const hostedUrl = `${baseUrl}/temp/lora-images/${filename}`;
      
      logger.info(`✅ Image downloaded and hosted: ${hostedUrl}`);
      
      return {
        success: true,
        url: hostedUrl,
        local_path: localPath,
        filename: filename,
        original_url: imageUrl,
        metadata: {
          ...metadata,
          downloaded_at: new Date().toISOString(),
          file_size: (await fs.stat(localPath)).size
        }
      };
      
    } catch (error) {
      logger.error(`❌ Failed to download and host image: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate and host a LoRA image using YOUR trained model
   */
  async generateAndHostLoRAImage(articleData, options = {}) {
    try {
      // Use YOUR trained LoRA service
      logger.info('🎨✨ USING YOUR TRAINED LORA SERVICE ✨🎨');
      const TrainedLoraService = require('./trainedLoraService');
      const trainedLoraService = new TrainedLoraService();
      
      // Prepare article data for your trained LoRA
      const loraArticleData = {
        title: articleData.title,
        subtitle: articleData.subtitle || "CRYPTO NEWS",
        network: articleData.network || "generic",
        description: articleData.description || ""
      };
      
      const loraOptions = {
        style: options.style || "professional",
        ...options
      };
      
      const result = await trainedLoraService.generateLoraImage(
        loraArticleData.title,
        loraArticleData.content || '',
        loraArticleData.network || 'generic',
        loraOptions.style || 'professional'
      );
      
      if (result.success) {
        logger.info(`✅ YOUR trained LoRA generated: ${result.imageUrl}`);
        return {
          success: true,
          image_url: result.imageUrl,
          display_url: result.imageUrl,
          hosting_service: 'trained_lora_service',
          generation_method: 'your_trained_lora_model',
          image_id: result.imageId,
          metadata: result.metadata
        };
      }
      
      // If your trained LoRA Service fails
      throw new Error('Your trained LoRA Service failed');
      
    } catch (error) {
      logger.error('Your trained LoRA generation failed:', error.message);
      logger.error('Full error details:', error);
      
      // Return error details
      return {
        success: false,
        error: `Your trained LoRA generation failed: ${error.message}`,
        metadata: {
          error_type: 'trained_lora_generation_failure',
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

module.exports = ImageHostingService;