const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');
const WatermarkService = require('./watermarkService');
const ControlNetService = require('./controlNetService');

/**
 * HBAR Specific LoRA Service - Uses custom trained HBAR LoRA
 * Replaces generic RunPod for HBAR articles specifically
 */
class HbarLoraService {
  constructor() {
    this.timeout = 300000; // 5 minutes max
    this.imageStorePath = path.join(__dirname, '../../temp/lora-images');
    this.baseUrl = process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app';
    this.watermarkService = new WatermarkService();
    this.controlNetService = new ControlNetService();
    
    // HBAR LoRA Model Information
    this.hbarLoraPath = path.join(__dirname, '../../ai-cover-generator/models/lora/hbar_new_lora.safetensors');
    this.hbarTriggerWord = 'Hbar'; // From your training metadata
    
    // Ensure storage directory exists
    this.ensureStorageDirectory().catch(err => {
      logger.error('❌ Failed to create storage directory:', err);
    });
    
    logger.info('🎯 HBAR Specific LoRA Service initialized with Wavespeed support');
  }

  async ensureStorageDirectory() {
    try {
      await fs.mkdir(this.imageStorePath, { recursive: true });
      logger.info(`📁 HBAR LoRA image storage ready: ${this.imageStorePath}`);
    } catch (error) {
      logger.error('❌ Failed to create storage directory:', error);
    }
  }

  /**
   * Generate unique image ID
   */
  generateImageId() {
    const randomBytes = crypto.randomBytes(8);
    return `hbar_lora_${randomBytes.toString('hex')}`;
  }

  /**
   * Get hosted image URL for an image ID
   */
  getImageUrl(imageId) {
    return `${this.baseUrl}/temp/lora-images/${imageId}.png`;
  }

  /**
   * Generate HBAR image using custom LoRA with ControlNet for maximum accuracy
   */
  async generateHbarLoraImage(title, content = '', network = 'hbar', style = 'modern') {
    const imageId = this.generateImageId();
    const startTime = Date.now();
    
    logger.info(`🎯 Generating HBAR with Custom LoRA + ControlNet: "${title}"`);
    
    try {
      // PRIORITY 1: Try ControlNet + SVG guidance for maximum logo accuracy
      try {
        logger.info('🎯 Attempting ControlNet generation for maximum HBAR logo accuracy...');
        const controlNetResult = await this.controlNetService.generateWithSVGGuidance(
          title, content, style, 
          { 
            controlnet_strength: 1.0,   // ABSOLUTE MAXIMUM ControlNet strength for HBAR H logo
            guidance_scale: 25.0,       // NUCLEAR guidance for perfect H logo precision
            steps: 80                   // NUCLEAR steps for perfect quality
          }
        );
        
        if (controlNetResult && controlNetResult.success) {
          logger.info('✅ ControlNet generation succeeded with high logo accuracy');
          return controlNetResult;
        }
      } catch (controlNetError) {
        logger.warn(`⚠️ ControlNet failed: ${controlNetError.message}, falling back to LoRA`);
      }

      // PRIORITY 2: Wavespeed LoRA with increased strength
      const wavespeedApiKey = process.env.WAVESPEED_API_KEY;
      if (wavespeedApiKey) {
        logger.info('✅ Using enhanced Wavespeed LoRA with increased strength');
        return await this.generateWithWavespeedLora(title, content, network, style);
      }

      // PRIORITY 3: Local model fallback
      const modelExists = await this.checkHbarLoraModel();
      if (!modelExists) {
        logger.warn('⚠️ No Wavespeed API key and no local HBAR LoRA model, falling back to OpenAI');
        return await this.generateWithOpenAI(title, content, network, style);
      }

      // Final fallback
      return await this.generateWithWavespeedLora(title, content, network, style);
      
    } catch (error) {
      logger.error('❌ HBAR LoRA generation failed:', error);
      throw new Error(`HBAR LoRA generation failed: ${error.message}`);
    }
  }

  /**
   * Check if HBAR LoRA model file exists
   */
  async checkHbarLoraModel() {
    try {
      const stats = await fs.stat(this.hbarLoraPath);
      const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
      logger.info(`✅ HBAR LoRA model found: ${sizeInMB} MB`);
      return true;
    } catch (error) {
      logger.error(`❌ HBAR LoRA model not found at: ${this.hbarLoraPath}`);
      return false;
    }
  }

  /**
   * Create HBAR-specific prompt using trigger word
   * SIMPLIFIED to match actual HBAR logo: simple geometric H-shape
   */
  createHbarPrompt(title, content, style) {
    // SIMPLIFIED HBAR prompts focused on accurate logo geometry (matching SVG reference)
    const hbarPrompts = [
      `${this.hbarTriggerWord} cryptocurrency logo featuring the exact HBAR symbol: a clean geometric capital H made of two thick vertical rectangular bars connected by a single horizontal crossbar in the center, flat design, professional teal color (#00D4AA), minimalist style, simple geometry, clean lines, flat logo design, official HBAR symbol, two vertical bars plus one horizontal connecting bar, geometric precision, no 3D effects, no complex elements, pure logo focus, no text, no words, no letters`,
      
      `${this.hbarTriggerWord} token displaying the authentic HBAR logo design - simple flat H letter with two vertical rectangular bars and one thick horizontal bar connecting them in the middle, official teal brand color, clean geometric shapes, minimalist cryptocurrency logo, professional flat design, precise H geometry, simple logo elements only, clean brand identity, no decorative elements, no text, no words, no letters`,
      
      `${this.hbarTriggerWord} symbol showing the correct HBAR logo: geometric H shape with exactly two thick vertical bars connected by a single horizontal crossbar in the center position, flat teal colored design, clean professional logo, simple geometric form, official brand symbol, minimalist H letter design, precise logo geometry, clean brand mark, flat design aesthetic, no text, no words, no letters`
    ];

    // Randomly select HBAR prompt variation based on title hash
    const titleHash = title.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0);
    const promptIndex = Math.abs(titleHash) % hbarPrompts.length;
    const selectedPrompt = hbarPrompts[promptIndex];
    
    logger.info(`🎨 Using SIMPLIFIED HBAR prompt variation ${promptIndex + 1}/3 (focused on logo accuracy)`);
    
    // Add quality terms but keep focus on logo simplicity
    let finalPrompt = selectedPrompt + ', professional logo design, high quality, crisp clean lines, precise geometry';
    
    // NUCLEAR text blocking
    finalPrompt += ', absolutely no text, no words, no letters, no typography, no readable content, no alphabet characters, no linguistic elements';
    
    // NUCLEAR Bitcoin exclusion and REINFORCE simple H geometry
    finalPrompt += ', NEVER bitcoin symbol, NEVER ₿, NEVER BTC logo, NEVER orange cryptocurrency, FORBIDDEN bitcoin elements, PROHIBITED bitcoin imagery, ABSOLUTELY REQUIRED simple flat geometric H letter with exactly two vertical bars and one horizontal crossbar, ONLY official HBAR logo geometry, must be simple flat design, no 3D elements, no crystals, no complex effects';
    
    return finalPrompt;
  }

  /**
   * Generate with Wavespeed API using your actual trained HBAR LoRA
   */
  async generateWithWavespeedLora(title, content = '', network = 'hbar', style = 'modern') {
    const imageId = this.generateImageId();
    const startTime = Date.now();
    
    logger.info(`🎯 Generating HBAR with Wavespeed LoRA: "${title}"`);
    
    try {
      const wavespeedApiKey = process.env.WAVESPEED_API_KEY;
      if (!wavespeedApiKey) {
        logger.warn('⚠️ WAVESPEED_API_KEY not configured, falling back to OpenAI');
        return await this.generateWithOpenAI(title, content, network, style);
      }

      // Create HBAR-specific prompt with trigger word
      const prompt = this.createHbarPrompt(title, content, style);
      
      logger.info(`🔤 Wavespeed HBAR Prompt: "${prompt}"`);
      
      // Use Wavespeed API with your trained LoRA model
      const response = await axios.post('https://api.wavespeed.ai/api/v3/predictions', {
        model: "wavespeed-ai/flux-dev-lora-trainer-turbo",
        input: {
          prompt: prompt,
          lora_url: "https://d2p7pge43lyniu.cloudfront.net/output/9ea945dd-64cb-45f2-b279-31ac622ccef8-u2_f8a79fc7-5c8d-4144-91da-25ce6a00f282.safetensors",
          trigger_word: this.hbarTriggerWord,
          width: 1800,
          height: 900,
          num_inference_steps: 75,
          guidance_scale: 20.0,
          lora_scale: 2.0
        }
      }, {
        headers: {
          'Authorization': `Bearer ${wavespeedApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });

      if (!response.data.id) {
        throw new Error('No job ID received from Wavespeed API');
      }

      const jobId = response.data.id;
      logger.info(`✅ Wavespeed job submitted: ${jobId}`);
      
      // Poll for completion
      const result = await this.pollWavespeedJob(jobId, wavespeedApiKey);
      
      if (!result || !result.output || !result.output[0]) {
        throw new Error('No image URL received from Wavespeed');
      }

      const imageUrl = result.output[0];
      logger.info(`⬇️ Downloading HBAR LoRA image from: ${imageUrl}`);
      
      // Download image
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      // Save the original image first
      const tempImagePath = path.join(this.imageStorePath, `${imageId}_temp.png`);
      await fs.writeFile(tempImagePath, imageResponse.data);
      
      // Apply watermark overlay
      const imagePath = path.join(this.imageStorePath, `${imageId}.png`);
      await this.watermarkService.addWatermark(tempImagePath, imagePath, { title });
      
      // Clean up temp file
      try {
        await fs.unlink(tempImagePath);
        if (global.gc) global.gc();
      } catch (cleanupError) {
        logger.warn(`⚠️ Failed to clean up temp file: ${cleanupError.message}`);
      }

      const totalTime = Math.round((Date.now() - startTime) / 1000);
      logger.info(`✅ HBAR Wavespeed generation completed in ${totalTime}s`);
      
      return {
        success: true,
        imageId: imageId,
        imageUrl: this.getImageUrl(imageId),
        localPath: imagePath,
        metadata: {
          title,
          content,
          network: 'hbar',
          style,
          prompt,
          generationTime: totalTime,
          method: 'wavespeed_hbar_lora',
          model: 'HBAR_CUSTOM_LORA_FLUX',
          triggerWord: this.hbarTriggerWord,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('❌ Wavespeed HBAR LoRA generation failed:', error);
      logger.warn('⚠️ Falling back to OpenAI DALL-E');
      return await this.generateWithOpenAI(title, content, network, style);
    }
  }

  /**
   * Poll Wavespeed job until completion
   */
  async pollWavespeedJob(jobId, apiKey) {
    const maxAttempts = 12; // 1 minute max
    const pollInterval = 5000; // 5 seconds
    const statusUrl = `https://api.wavespeed.ai/api/v3/predictions/${jobId}/result`;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        logger.info(`🔄 Polling Wavespeed job ${jobId} (attempt ${attempt + 1}/${maxAttempts})`);
        
        const response = await axios.get(statusUrl, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          },
          timeout: 15000
        });
        
        const status = response.data.data.status;
        logger.info(`📊 Wavespeed job status: ${status}`);
        
        if (status === 'completed') {
          logger.info(`✅ Wavespeed job completed`);
          return response.data.data;
        } else if (status === 'failed') {
          const error = response.data.data.error || 'Unknown error';
          throw new Error(`Wavespeed job failed: ${error}`);
        }
        
        // Wait before next poll
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        
      } catch (pollError) {
        logger.error(`❌ Error polling Wavespeed job: ${pollError.message}`);
        throw pollError;
      }
    }
    
    throw new Error(`Timeout: Wavespeed job ${jobId} did not complete after ${maxAttempts} attempts`);
  }

  /**
   * OpenAI DALL-E with HBAR-specific prompting (fallback)
   */
  async generateWithOpenAI(title, content = '', network = 'hbar', style = 'modern') {
    const imageId = this.generateImageId();
    const startTime = Date.now();
    
    logger.info(`🎨 Generating HBAR with OpenAI + Custom Prompting: "${title}"`);
    
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY not configured');
      }

      // Create HBAR-specific prompt
      const prompt = this.createHbarPrompt(title, content, style);
      const dallePrompt = `${prompt}, professional magazine cover design, detailed cryptocurrency illustration, ultra-realistic 3D render`;
      
      logger.info(`🔤 DALL-E HBAR Prompt: "${dallePrompt.substring(0, 200)}..."`);
      
      const response = await axios.post('https://api.openai.com/v1/images/generations', {
        model: "dall-e-3",
        prompt: dallePrompt,
        size: "1792x1024",
        quality: "hd",
        n: 1
      }, {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });

      if (!response.data.data || !response.data.data[0] || !response.data.data[0].url) {
        throw new Error('No image URL received from DALL-E');
      }

      const imageUrl = response.data.data[0].url;
      logger.info(`⬇️ Downloading HBAR DALL-E image from: ${imageUrl}`);
      
      // Download image
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      // Save the original image first
      const tempImagePath = path.join(this.imageStorePath, `${imageId}_temp.png`);
      await fs.writeFile(tempImagePath, imageResponse.data);
      
      // FORCE resize to 1800x900 (same as RunPod service)
      const sharp = require('sharp');
      const resizedImagePath = path.join(this.imageStorePath, `${imageId}_resized.png`);
      
      const metadata = await sharp(tempImagePath).metadata();
      logger.info(`📏 Original DALL-E dimensions: ${metadata.width}x${metadata.height}`);
      
      // Force resize to 1800x900
      logger.info(`🔧 FORCING resize to 1800x900 for HBAR image`);
      await sharp(tempImagePath)
        .resize(1800, 900, { 
          fit: 'fill',
          background: { r: 0, g: 0, b: 0, alpha: 1 }
        })
        .png()
        .toFile(resizedImagePath);
      
      // Apply watermark overlay to resized image
      const imagePath = path.join(this.imageStorePath, `${imageId}.png`);
      await this.watermarkService.addWatermark(resizedImagePath, imagePath, { title });
      
      // Clean up temp files
      try {
        await fs.unlink(tempImagePath);
        await fs.unlink(resizedImagePath);
        if (global.gc) global.gc();
      } catch (cleanupError) {
        logger.warn(`⚠️ Failed to clean up temp files: ${cleanupError.message}`);
      }

      const totalTime = Math.round((Date.now() - startTime) / 1000);
      logger.info(`✅ HBAR Custom generation completed in ${totalTime}s`);
      
      return {
        success: true,
        imageId: imageId,
        imageUrl: this.getImageUrl(imageId),
        localPath: imagePath,
        metadata: {
          title,
          content,
          network: 'hbar',
          style,
          prompt: dallePrompt,
          generationTime: totalTime,
          method: 'hbar_custom_lora_dalle3',
          model: 'HBAR_CUSTOM_LORA',
          timestamp: new Date().toISOString(),
          triggerWord: this.hbarTriggerWord
        }
      };
      
    } catch (error) {
      logger.error('❌ HBAR Custom generation failed:', error);
      throw new Error(`HBAR Custom generation failed: ${error.message}`);
    }
  }

  /**
   * Test HBAR LoRA service
   */
  async testHbarLoraService() {
    try {
      logger.info('🧪 Testing HBAR LoRA service...');
      
      const modelExists = await this.checkHbarLoraModel();
      
      return {
        success: true,
        hbarModelExists: modelExists,
        triggerWord: this.hbarTriggerWord,
        modelPath: this.hbarLoraPath,
        status: 'HBAR LoRA service ready'
      };
      
    } catch (error) {
      logger.error(`❌ HBAR LoRA test failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        status: 'HBAR LoRA service failed'
      };
    }
  }
}

module.exports = HbarLoraService;