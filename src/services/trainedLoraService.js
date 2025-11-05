const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');
const WatermarkService = require('./watermarkService');

/**
 * Trained LoRA Service - Calls Your Deployed Trained LoRA on HF Spaces
 * This service properly calls your Gradio interface with the generate_crypto_cover function
 */
class TrainedLoraService {
  constructor() {
    this.hfSpacesUrl = process.env.HF_SPACES_LORA_URL || 'https://valtronk-crypto-news-lora-generator.hf.space';
    this.timeout = 300000; // 5 minutes
    this.imageStorePath = path.join(__dirname, '../../temp/lora-images');
    this.baseUrl = process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app';
    this.watermarkService = new WatermarkService();
    
    // Ensure storage directory exists
    this.ensureStorageDirectory().catch(err => {
      logger.error('❌ Failed to create storage directory:', err);
    });
    
    logger.info('🎨 Trained LoRA Service initialized - Using YOUR trained model on HF Spaces');
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
   * Generate image using your trained LoRA model
   */
  async generateLoraImage(title, content = '', network = 'generic', style = 'modern') {
    const imageId = this.generateImageId();
    const startTime = Date.now();
    
    logger.info(`🎨 Generating with YOUR trained LoRA: "${title}"`);
    
    try {
      // Create enhanced prompt for your trained model
      const prompt = this.createEnhancedPrompt(title, content, network, style);
      const negativePrompt = "low quality, blurry, text, watermark, signature, bad anatomy, poorly drawn";
      
      logger.info(`🔤 Prompt: "${prompt}"`);
      logger.info(`🚫 Negative: "${negativePrompt}"`);
      
      // Step 1: Submit job to your trained LoRA
      const submitUrl = `${this.hfSpacesUrl}/call/generate_crypto_cover`;
      logger.info(`🌐 Calling your trained LoRA: ${submitUrl}`);
      
      const submitResponse = await axios.post(submitUrl, {
        data: [
          prompt,           // Image prompt
          title,           // Cover title  
          negativePrompt,  // Negative prompt
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
        throw new Error('No event_id received from your trained LoRA');
      }
      
      logger.info(`✅ Job submitted to trained LoRA, event_id: ${eventId}`);
      
      // Step 2: Poll for completion
      const resultUrl = `${this.hfSpacesUrl}/call/generate_crypto_cover/${eventId}`;
      logger.info(`🔄 Polling trained LoRA results: ${resultUrl}`);
      
      const imageData = await this.pollForResult(resultUrl, eventId);
      
      if (!imageData) {
        throw new Error('No image data received from trained LoRA');
      }
      
      // Step 3: Download and store the generated image
      const imageUrl = imageData.url || imageData.path;
      logger.info(`⬇️ Downloading trained LoRA image from: ${imageUrl}`);
      
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 60000
      });
      
      // Save image locally
      const imagePath = path.join(this.imageStorePath, `${imageId}.png`);
      await fs.writeFile(imagePath, imageResponse.data);
      
      const fileSize = (await fs.stat(imagePath)).size;
      logger.info(`💾 Trained LoRA image saved: ${imagePath} (${fileSize} bytes)`);
      
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      logger.info(`🎉 YOUR trained LoRA generation completed in ${totalTime}s`);
      
      return {
        success: true,
        imageId: imageId,
        imageUrl: this.getImageUrl(imageId),
        localPath: imagePath,
        metadata: {
          title,
          content,
          network,
          style,
          prompt,
          generationTime: totalTime,
          method: 'trained_lora_gradio',
          model: 'YOUR_TRAINED_LORA',
          eventId: eventId,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('❌ Trained LoRA generation failed:', error);
      
      if (error.response) {
        logger.error(`📊 Response status: ${error.response.status}`);
        logger.error(`📄 Response data:`, error.response.data);
      }
      
      throw new Error(`Trained LoRA generation failed: ${error.message}`);
    }
  }

  /**
   * Poll for result from Gradio async event stream
   */
  async pollForResult(resultUrl, eventId) {
    const maxAttempts = 60; // 5 minutes max
    const pollInterval = 5000; // 5 seconds
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        logger.info(`🔄 Polling trained LoRA attempt ${attempt + 1}/${maxAttempts} for event: ${eventId}`);
        
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
            logger.info(`✅ Trained LoRA event complete detected`);
            continue;
          }
          
          if (line.startsWith('data: ')) {
            const dataString = line.substring(6);
            
            try {
              const data = JSON.parse(dataString);
              
              if (Array.isArray(data) && data.length > 0) {
                const imageData = data[0];
                
                if (imageData && typeof imageData === 'object' && (imageData.url || imageData.path)) {
                  logger.info(`🖼️ Trained LoRA image data found:`, imageData);
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
   * Create enhanced prompt for your trained LoRA model
   */
  createEnhancedPrompt(title, content, network, style) {
    // Base prompt with crypto context
    let prompt = `crypto cover art style, ${title}`;
    
    if (content) {
      prompt += `, ${content}`;
    }
    
    // Add network-specific elements
    const networkStyles = {
      'bitcoin': 'golden orange colors, digital gold, secure blockchain',
      'ethereum': 'blue purple colors, smart contracts, decentralized',
      'solana': 'purple pink colors, fast transactions, high performance',
      'hedera': 'black white colors, hashgraph technology, enterprise',
      'algorand': 'green blue colors, pure proof of stake, sustainable',
      'constellation': 'purple cosmic colors, DAG network, constellation',
      'generic': 'professional crypto design, modern blockchain'
    };
    
    if (networkStyles[network]) {
      prompt += `, ${networkStyles[network]}`;
    }
    
    // Add style keywords
    const styleKeywords = {
      'modern': 'clean, minimalist, professional, high-tech',
      'futuristic': 'neon, cyberpunk, digital, advanced technology',
      'classic': 'traditional, elegant, sophisticated, timeless',
      'professional': 'business, corporate, premium, polished'
    };
    
    if (styleKeywords[style]) {
      prompt += `, ${styleKeywords[style]}`;
    }
    
    prompt += ', professional design, high quality, detailed, trending on artstation';
    
    return prompt;
  }

  /**
   * Test connection to your trained LoRA
   */
  async testConnection() {
    try {
      logger.info(`🔍 Testing connection to your trained LoRA: ${this.hfSpacesUrl}`);
      
      const response = await axios.get(this.hfSpacesUrl, {
        timeout: 10000
      });
      
      logger.info(`✅ Your trained LoRA is accessible`);
      
      return {
        success: true,
        status: 'accessible',
        url: this.hfSpacesUrl
      };
      
    } catch (error) {
      logger.error(`❌ Your trained LoRA connection failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        status: 'unreachable'
      };
    }
  }

  /**
   * Retrieve image by ID
   */
  async getImageById(imageId) {
    const imagePath = path.join(this.imageStorePath, `${imageId}.png`);
    const imageUrl = this.getImageUrl(imageId);
    
    try {
      const stats = await fs.stat(imagePath);
      if (stats.size > 1000) { // Ensure file is not empty/corrupted
        return {
          success: true,
          imageId: imageId,
          imageUrl: imageUrl,
          imagePath: imagePath
        };
      }
    } catch (error) {
      // File doesn't exist
    }
    
    throw new Error(`Image with ID ${imageId} not found`);
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

module.exports = TrainedLoraService;