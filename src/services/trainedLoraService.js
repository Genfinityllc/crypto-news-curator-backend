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
   * Generate image using your trained LoRA model via Gradio queue
   */
  async generateLoraImage(title, content = '', network = 'generic', style = 'modern') {
    const imageId = this.generateImageId();
    const startTime = Date.now();
    
    logger.info(`🎨 Generating with YOUR trained LoRA: "${title}"`);
    
    try {
      // First test connection to see if HF Space is ready
      const connectionTest = await this.testConnection();
      if (!connectionTest.success) {
        if (connectionTest.status === 'rebuilding' || connectionTest.status === 'building') {
          throw new Error(`Service under maintenance: ${connectionTest.error}`);
        } else {
          throw new Error(`Service unavailable: ${connectionTest.error}`);
        }
      }
      
      // Create enhanced prompt for your trained model
      const prompt = this.createEnhancedPrompt(title, content, network, style);
      const negativePrompt = "low quality, blurry, text, watermark, signature, bad anatomy, poorly drawn";
      
      logger.info(`🔤 Prompt: "${prompt}"`);
      logger.info(`🚫 Negative: "${negativePrompt}"`);
      
      // Step 1: Generate session hash and join queue
      const sessionHash = this.generateSessionHash();
      const queueUrl = `${this.hfSpacesUrl}/queue/join`;
      logger.info(`🌐 Joining queue for trained LoRA: ${queueUrl}`);
      logger.info(`🔑 Using session: ${sessionHash}`);
      
      const queueResponse = await axios.post(queueUrl, {
        data: [prompt, ""], // Send prompt + empty title (HF Space needs both params but we handle title in backend)
        event_data: null,
        fn_index: 0,
        trigger_id: 12,
        session_hash: sessionHash
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!queueResponse.data.event_id) {
        throw new Error('No event_id received from queue join');
      }
      
      const eventId = queueResponse.data.event_id;
      logger.info(`✅ Joined queue, event_id: ${eventId}`);
      
      // Step 2: Listen to queue updates with same session
      const result = await this.listenToQueueUpdates(eventId, sessionHash);
      
      if (!result) {
        throw new Error('No result received from queue');
      }
      
      // Step 3: Handle the image result
      let imagePath;
      let fileSize;
      
      if (result.type === 'base64') {
        // Handle base64 image
        const imageBuffer = Buffer.from(result.data, 'base64');
        
        // Save the original base64 image first
        const tempImagePath = path.join(this.imageStorePath, `${imageId}_temp.png`);
        await fs.writeFile(tempImagePath, imageBuffer);
        logger.info(`💾 Base64 LoRA image saved temporarily: ${tempImagePath}`);
        
        // Apply FULL SIZE watermark overlay at 1800x900
        imagePath = path.join(this.imageStorePath, `${imageId}.png`);
        await this.watermarkService.addWatermark(tempImagePath, imagePath, { title });
        
        // Clean up temp file and force garbage collection
        try {
          await fs.unlink(tempImagePath);
          if (global.gc) global.gc(); // Force garbage collection if available
        } catch (cleanupError) {
          logger.warn(`⚠️ Failed to clean up temp file: ${cleanupError.message}`);
        }
        
        fileSize = (await fs.stat(imagePath)).size;
        logger.info(`✅ Base64 LoRA image with FULL SIZE watermark overlay applied: ${imagePath} (${fileSize} bytes)`);
      } else if (result.type === 'file') {
        // Handle file URL
        logger.info(`⬇️ Downloading LoRA image from: ${result.url}`);
        const imageResponse = await axios.get(result.url, {
          responseType: 'arraybuffer',
          timeout: 60000
        });
        
        // Save the original image first (without watermark from HF Space)
        const tempImagePath = path.join(this.imageStorePath, `${imageId}_temp.png`);
        await fs.writeFile(tempImagePath, imageResponse.data);
        logger.info(`💾 Downloaded LoRA image saved temporarily: ${tempImagePath}`);
        
        // Apply FULL SIZE watermark overlay at 1800x900 (replacing HF Space tiny watermark)
        imagePath = path.join(this.imageStorePath, `${imageId}.png`);
        await this.watermarkService.addWatermark(tempImagePath, imagePath, { title });
        
        // Clean up temp file and force garbage collection
        try {
          await fs.unlink(tempImagePath);
          if (global.gc) global.gc(); // Force garbage collection if available
        } catch (cleanupError) {
          logger.warn(`⚠️ Failed to clean up temp file: ${cleanupError.message}`);
        }
        
        fileSize = (await fs.stat(imagePath)).size;
        logger.info(`✅ LoRA image with FULL SIZE watermark overlay applied: ${imagePath} (${fileSize} bytes)`);
      } else {
        throw new Error('Unknown result type from LoRA generation');
      }
      
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
          method: 'trained_lora_queue',
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
    // Create network-specific base instead of generic "crypto cover art"
    const networkBases = {
      'bitcoin': 'bitcoin digital currency cover',
      'ethereum': 'ethereum blockchain platform cover', 
      'solana': 'solana high-performance blockchain cover',
      'hedera': 'hedera hashgraph enterprise cover',
      'algorand': 'algorand pure proof of stake cover',
      'constellation': 'constellation DAG network cover',
      'generic': 'cryptocurrency technology cover'
    };
    
    const basePrompt = networkBases[network] || networkBases['generic'];
    let prompt = `${basePrompt}, ${title}`;
    
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
      
      // Check for specific error messages
      if (response.data && typeof response.data === 'string') {
        if (response.data.includes('error, check its status')) {
          logger.warn(`⚠️ HF Space is in error/rebuild mode`);
          return {
            success: false,
            status: 'rebuilding',
            error: 'HF Space is currently rebuilding. Please wait.',
            url: this.hfSpacesUrl
          };
        }
        
        if (response.data.includes('Building') || response.data.includes('build')) {
          logger.warn(`⚠️ HF Space is building`);
          return {
            success: false,
            status: 'building',
            error: 'HF Space is currently building. Please wait.',
            url: this.hfSpacesUrl
          };
        }
      }
      
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
   * Generate session hash for Gradio queue
   */
  generateSessionHash() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const timestamp = Date.now().toString(36); // Add timestamp for uniqueness
    let randomPart = '';
    for (let i = 0; i < 12; i++) { // Longer random part
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${randomPart}_${timestamp}`.substring(0, 16); // Limit to reasonable length
  }

  /**
   * Listen to queue updates via polling
   */
  async listenToQueueUpdates(eventId, sessionHash) {
    const maxAttempts = 60; // 10 minutes max (60 * 10s intervals)
    let attempts = 0;
    let hasStarted = false;
    
    logger.info(`🔄 Polling for queue updates for event: ${eventId} with session: ${sessionHash}`);
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        const eventUrl = `${this.hfSpacesUrl}/queue/data?session_hash=${sessionHash}`;
        
        const response = await axios.get(eventUrl, {
          timeout: 10000, // Reduced timeout to handle stream aborts faster
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache'
          }
        });
        
        // Parse response for our event
        if (response.data) {
          const lines = response.data.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                
                if (data.event_id === eventId) {
                  if (data.msg === 'process_completed') {
                    logger.info(`✅ Queue processing completed for event: ${eventId}`);
                    
                    // Extract image data from the response
                    if (data.output && data.output.data && data.output.data.length > 0) {
                      const imageResult = data.output.data[0];
                      
                      if (typeof imageResult === 'string' && imageResult.startsWith('data:image')) {
                        // Base64 image
                        const base64Data = imageResult.split(',')[1];
                        return { type: 'base64', data: base64Data };
                      } else if (imageResult && imageResult.url) {
                        // File URL result (preferred format from our test)
                        return { type: 'file', url: imageResult.url };
                      } else if (imageResult && imageResult.path) {
                        // File path result  
                        const imageUrl = `${this.hfSpacesUrl}/file=${imageResult.path}`;
                        return { type: 'file', url: imageUrl };
                      }
                    }
                    
                    throw new Error('No valid image data in completed result');
                  } else if (data.msg === 'process_starts') {
                    hasStarted = true;
                    logger.info(`🔄 Queue processing started for event: ${eventId}`);
                  } else if (data.msg === 'estimation') {
                    const rank = data.rank || 'unknown';
                    const queueSize = data.queue_size || 'unknown';
                    const eta = data.rank_eta ? `${Math.round(data.rank_eta)}s` : 'unknown';
                    logger.info(`⏳ Queue position: ${rank}/${queueSize}, ETA: ${eta}`);
                  } else if (data.msg === 'unexpected_error') {
                    throw new Error(`Queue error: ${data.message || 'Unknown error'}`);
                  }
                }
              } catch (parseError) {
                // Not JSON, continue
                if (parseError.message.includes('Queue error')) {
                  throw parseError;
                }
              }
            }
          }
        }
        
        // Adaptive waiting based on whether processing has started
        const waitTime = hasStarted ? 5000 : 8000; // Faster polling once started
        logger.info(`🔄 Polling attempt ${attempts}/${maxAttempts}, waiting ${waitTime/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
      } catch (error) {
        if (error.message.includes('Queue error') || error.message.includes('unexpected_error')) {
          throw error;
        }
        
        // Log different error types
        if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
          logger.warn(`⚠️ Network error (attempt ${attempts}): ${error.message}`);
        } else if (error.code === 'ECONNABORTED' || error.message.includes('stream has been aborted')) {
          logger.warn(`⚠️ Stream aborted (attempt ${attempts}): ${error.message}`);
        } else {
          logger.warn(`⚠️ Queue polling error (attempt ${attempts}): ${error.message}`);
        }
        
        // Shorter backoff for stream aborts since they're common
        const baseBackoff = error.message.includes('stream has been aborted') ? 3000 : 5000;
        const backoffTime = Math.min(baseBackoff + (attempts * 500), 12000);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
    
    throw new Error(`Timeout: No completion after ${maxAttempts} polling attempts (${Math.round(maxAttempts * 8 / 60)} minutes)`);
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