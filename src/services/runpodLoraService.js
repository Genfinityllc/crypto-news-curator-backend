const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');
const WatermarkService = require('./watermarkService');

/**
 * RunPod LoRA Service - Calls Deployed LoRA on RunPod Serverless
 * Replaces HF Spaces with reliable RunPod infrastructure
 */
class RunPodLoraService {
  constructor() {
    // RunPod Configuration
    this.runpodEndpoint = 'https://api.runpod.ai/v2/dr3yg58suwkise/run';
    // RunPod API key from environment variables
    this.runpodApiKey = process.env.RUNPOD_API_KEY;
    
    if (!this.runpodApiKey) {
      logger.error('❌ RUNPOD_API_KEY environment variable not set');
      throw new Error('RUNPOD_API_KEY environment variable required');
    }
    this.timeout = 300000; // 5 minutes max
    this.imageStorePath = path.join(__dirname, '../../temp/lora-images');
    this.baseUrl = process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app';
    this.watermarkService = new WatermarkService();
    
    // Ensure storage directory exists
    this.ensureStorageDirectory().catch(err => {
      logger.error('❌ Failed to create storage directory:', err);
    });
    
    logger.info('🚀 RunPod LoRA Service initialized - Using RunPod Serverless');
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
   * Generate image using RunPod serverless endpoint with OpenAI fallback
   */
  async generateLoraImage(title, content = '', network = 'generic', style = 'modern') {
    // Try RunPod first, with quick timeout, then fallback to OpenAI
    try {
      return await this.tryRunPodGeneration(title, content, network, style);
    } catch (runpodError) {
      logger.warn(`⚠️ RunPod failed: ${runpodError.message}, falling back to OpenAI DALL-E`);
      return await this.generateWithOpenAI(title, content, network, style);
    }
  }

  /**
   * Try RunPod generation (original method)
   */
  async tryRunPodGeneration(title, content = '', network = 'generic', style = 'modern') {
    const imageId = this.generateImageId();
    const startTime = Date.now();
    
    logger.info(`🚀 Generating with RunPod LoRA: "${title}"`);
    
    try {
      // Create enhanced prompt for the LoRA model
      const prompt = this.createEnhancedPrompt(title, content, network, style);
      
      logger.info(`🔤 Prompt: "${prompt}"`);
      logger.info(`🎯 Network: "${network}", Style: "${style}"`);
      
      // Step 1: Submit job to RunPod
      // Add EXTREMELY strong negative prompts for non-Bitcoin articles
      const negativePrompt = network !== 'bitcoin' 
        ? 'bitcoin, BTC, ₿, bitcoin symbol, bitcoin logo, orange cryptocurrency, golden bitcoin coin, B symbol, bitcoin icon, btc icon, orange coin, yellow bitcoin, golden bitcoin, bitcoin network, btc network, bitcoin trading, bitcoin price, bitcoin chart, bitcoin mining, cryptocurrency bitcoin, bitcoin blockchain, bitcoin digital currency, orange circular coin, golden circular coin with B, bitcoin cash, bitcoin core, bitcoin technology'
        : 'low quality, blurry, distorted';
      
      const jobPayload = {
        input: {
          prompt: prompt,
          negative_prompt: negativePrompt,
          title: title,
          width: 1800,
          height: 900,
          num_inference_steps: 25,
          guidance_scale: 7.5,
          lora_scale: 1.0
        }
      };
      
      logger.info(`🌐 Submitting job to RunPod: ${this.runpodEndpoint}`);
      logger.info(`📋 Job payload:`, jobPayload);
      
      const submitResponse = await axios.post(this.runpodEndpoint, jobPayload, {
        timeout: 60000, // Increase to 60 seconds for job submission
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.runpodApiKey}`,
          'Accept': 'application/json'
        }
      });
      
      if (!submitResponse.data.id) {
        throw new Error('No job ID received from RunPod');
      }
      
      const jobId = submitResponse.data.id;
      logger.info(`✅ Job submitted to RunPod, ID: ${jobId}`);
      
      // Step 2: Poll for completion
      const result = await this.pollRunPodJob(jobId);
      
      if (!result || !result.image_url) {
        throw new Error('No image URL received from RunPod');
      }
      
      // Step 3: Download and process image
      logger.info(`⬇️ Downloading image from: ${result.image_url}`);
      const imageResponse = await axios.get(result.image_url, {
        responseType: 'arraybuffer',
        timeout: 60000
      });
      
      // Save the original image first
      const tempImagePath = path.join(this.imageStorePath, `${imageId}_temp.png`);
      await fs.writeFile(tempImagePath, imageResponse.data);
      logger.info(`💾 Downloaded RunPod image saved temporarily: ${tempImagePath}`);
      
      // FORCE resize to 1800x900 (RunPod ignores our size parameters)
      const sharp = require('sharp');
      const resizedImagePath = path.join(this.imageStorePath, `${imageId}_resized.png`);
      
      const metadata = await sharp(tempImagePath).metadata();
      logger.info(`📏 Original RunPod dimensions: ${metadata.width}x${metadata.height}`);
      
      if (metadata.width === 1800 && metadata.height === 900) {
        // Already correct size, just copy
        logger.info(`✅ Already 1800x900 - copying without resize`);
        await sharp(tempImagePath).png().toFile(resizedImagePath);
      } else {
        // Force resize to 1800x900
        logger.info(`🔧 FORCING resize from ${metadata.width}x${metadata.height} to 1800x900`);
        await sharp(tempImagePath)
          .resize(1800, 900, { 
            fit: 'fill',
            background: { r: 0, g: 0, b: 0, alpha: 1 }
          })
          .png()
          .toFile(resizedImagePath);
      }
      
      // Verify the resize worked
      const resizedMetadata = await sharp(resizedImagePath).metadata();
      logger.info(`✅ Final image dimensions: ${resizedMetadata.width}x${resizedMetadata.height}`);
      
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
      
      const fileSize = (await fs.stat(imagePath)).size;
      logger.info(`✅ RunPod image with watermark applied: ${imagePath} (${fileSize} bytes)`);
      
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      logger.info(`🎉 RunPod LoRA generation completed in ${totalTime}s`);
      
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
          method: 'runpod_serverless',
          model: 'VALOR_CRYPTO_LORA',
          jobId: jobId,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('❌ RunPod LoRA generation failed:', error);
      
      if (error.response) {
        logger.error(`📊 Response status: ${error.response.status}`);
        logger.error(`📄 Response data:`, error.response.data);
      }
      
      throw new Error(`RunPod LoRA generation failed: ${error.message}`);
    }
  }

  /**
   * Poll RunPod job until completion
   */
  async pollRunPodJob(jobId) {
    const maxAttempts = 12; // 1 minute max for quick fallback
    const pollInterval = 5000; // 5 seconds
    const statusUrl = `https://api.runpod.ai/v2/dr3yg58suwkise/status/${jobId}`;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        logger.info(`🔄 Polling RunPod job ${jobId} (attempt ${attempt + 1}/${maxAttempts})`);
        
        const response = await axios.get(statusUrl, {
          timeout: 15000,
          headers: {
            'Authorization': `Bearer ${this.runpodApiKey}`,
            'Accept': 'application/json'
          }
        });
        
        const status = response.data.status;
        logger.info(`📊 Job status: ${status}`);
        
        if (status === 'COMPLETED') {
          const output = response.data.output;
          if (output && output.image_url) {
            logger.info(`✅ RunPod job completed with image: ${output.image_url}`);
            return output;
          } else {
            throw new Error('Job completed but no image URL in output');
          }
        } else if (status === 'FAILED') {
          const error = response.data.error || 'Unknown error';
          throw new Error(`RunPod job failed: ${error}`);
        } else if (status === 'IN_QUEUE' || status === 'IN_PROGRESS') {
          // Continue polling
          logger.info(`⏳ Job ${status.toLowerCase()}, waiting ${pollInterval}ms...`);
        } else {
          logger.warn(`⚠️ Unknown job status: ${status}`);
        }
        
        // Wait before next poll (except on last attempt)
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        
      } catch (pollError) {
        logger.error(`❌ Error polling RunPod job: ${pollError.message}`);
        
        // If it's a 404, the job might not be ready yet
        if (pollError.response && pollError.response.status === 404) {
          logger.info(`⏳ Job not found yet (404), waiting...`);
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }
        
        throw pollError;
      }
    }
    
    throw new Error(`Timeout: RunPod job ${jobId} did not complete after ${maxAttempts} attempts`);
  }

  /**
   * Detect crypto network from article title and content
   */
  detectCryptoNetwork(title, content) {
    const text = `${title} ${content}`.toLowerCase();
    
    logger.info(`🔍 Network detection - Full text: "${text}"`);
    
    // PRIORITY-BASED network detection - more specific matches first
    
    // Check XRP token mentions first (higher priority than Ripple network)
    if (text.includes('xrp token') || text.includes('xrp price') || text.includes('xrp trading') || 
        text.includes('xrp coin') || text.includes('xrp cryptocurrency') || 
        (text.includes('xrp') && !text.includes('ripple'))) {
      logger.info(`✅ Found XRP TOKEN keywords - using XRP training image`);
      return 'xrp';
    }
    
    // Check Ripple network mentions (when "ripple" is mentioned)
    if (text.includes('ripple network') || text.includes('ripple labs') || text.includes('ripple company') ||
        text.includes('ripple protocol') || text.includes('ripple payment') || text.includes('ripple blockchain') ||
        (text.includes('ripple') && !text.includes('xrp token'))) {
      logger.info(`✅ Found RIPPLE NETWORK keywords - using Ripple training image`);
      return 'ripple';
    }
    
    // Other network detection
    const networkDetection = {
      'aave': ['aave', 'ghost token', 'defi lending'],
      'bitcoin': ['bitcoin', 'btc'],
      'ethereum': ['ethereum', 'eth'],
      'dogecoin': ['dogecoin', 'doge'],
      'solana': ['solana', 'sol'],
      'hedera': ['hedera', 'hbar'],
      'bybit': ['bybit'],
      'hyperliquid': ['hyperliquid'],
      'pump.fun': ['pump.fun', 'pumpfun'],
      'pi': ['pi network', 'pi coin']
    };
    
    // Check each network for matches
    for (const [network, keywords] of Object.entries(networkDetection)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          logger.info(`✅ Found keyword "${keyword}" for network "${network}"`);
          return network;
        }
      }
    }
    
    logger.info(`❌ No network detected from text`);
    return 'generic';
  }

  /**
   * Create enhanced prompt matching training data style
   */
  createEnhancedPrompt(title, content, networkParam, style) {
    // Detect actual network from content
    const detectedNetwork = this.detectCryptoNetwork(title, content);
    const network = detectedNetwork !== 'generic' ? detectedNetwork : networkParam;
    
    logger.info(`📝 Article title: "${title}"`);
    logger.info(`📝 Article content: "${content}"`);
    logger.info(`🎯 Detected network: "${detectedNetwork}" from article, using: "${network}"`);
    
    // ULTRA-SPECIFIC SYMBOL PROMPTS - No backgrounds, focus on exact symbols from training
    const networkPrompts = {
      'aave': 'aave ghost symbol only, white ethereal ghost floating, ghost token design, minimalist ghost icon, ZERO bitcoin, ZERO orange, ZERO BTC, ZERO ₿',
      'bitcoin': 'bitcoin symbol ₿, golden bitcoin coin, orange cryptocurrency',
      'ripple': 'ripple logo only, teal company branding, ripple network symbol, flowing design elements, ZERO bitcoin, ZERO orange, ZERO BTC, ZERO ₿',
      'xrp': 'XRP coin symbol only, purple XRP token design, XRP logo on coin surface, minimalist purple coin, ZERO bitcoin, ZERO orange, ZERO BTC, ZERO ₿',
      'ethereum': 'ethereum diamond symbol only, ETH logo design, geometric diamond shape, ZERO bitcoin, ZERO orange, ZERO BTC, ZERO ₿',
      'dogecoin': 'dogecoin symbol only, shiba inu coin design, DOGE branding, ZERO bitcoin, ZERO orange, ZERO BTC, ZERO ₿',
      'solana': 'solana symbol only, SOL logo design, minimalist purple branding, ZERO bitcoin, ZERO orange, ZERO BTC, ZERO ₿',
      'hedera': 'hedera symbol only, HBAR logo design, hashgraph branding, ZERO bitcoin, ZERO orange, ZERO BTC, ZERO ₿',
      'bybit': 'bybit logo only, exchange branding, trading platform symbol, ZERO bitcoin, ZERO orange, ZERO BTC, ZERO ₿',
      'hyperliquid': 'hyperliquid symbol only, protocol logo design, ZERO bitcoin, ZERO orange, ZERO BTC, ZERO ₿', 
      'pump.fun': 'pump.fun logo only, meme platform branding, vibrant design, ZERO bitcoin, ZERO orange, ZERO BTC, ZERO ₿',
      'pi': 'PI SYMBOL ONLY π, mathematical pi character π, golden pi coin π design, pi network branding π, NO BITCOIN EVER, NO BTC EVER, NO ₿ EVER, NO ORANGE COIN, ONLY PI SYMBOL π',
      'generic': 'modern cryptocurrency symbol, minimalist design, ZERO bitcoin, ZERO orange, ZERO BTC, ZERO ₿'
    };
    
    let prompt = networkPrompts[network] || networkPrompts['generic'];
    
    // SMART BACKGROUND DETECTION - only add when article context suggests it
    const articleText = `${title} ${content}`.toLowerCase();
    const chartKeywords = ['chart', 'sentiment', 'trend', 'analysis', 'price action', 'technical analysis', 'market data', 'trading view', 'graph', 'statistics'];
    
    const hasChartContext = chartKeywords.some(keyword => articleText.includes(keyword));
    
    if (hasChartContext) {
      prompt += ', digital trading charts background, market analysis interface';
      logger.info(`📊 Added chart background - found chart/analysis keywords in article`);
    } else {
      logger.info(`🎯 Clean symbol focus - no chart keywords detected`);
    }
    
    // Minimal quality terms
    prompt += ', 3D render, high quality';
    
    // Explicitly exclude Bitcoin for non-Bitcoin articles
    if (network !== 'bitcoin') {
      prompt += ', NOT bitcoin symbol, NOT BTC logo, NOT orange bitcoin';
    }
    
    return prompt;
  }

  /**
   * Test connection to RunPod
   */
  async testConnection() {
    try {
      logger.info(`🔍 Testing RunPod connection: ${this.runpodEndpoint}`);
      
      // Test with a simple job to check connectivity
      const testPayload = {
        input: {
          prompt: 'test connection',
          title: 'Test',
          num_inference_steps: 1,
          guidance_scale: 7.5,
          lora_scale: 1.0
        }
      };
      
      const response = await axios.post(this.runpodEndpoint, testPayload, {
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${this.runpodApiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && response.data.id) {
        logger.info(`✅ RunPod is accessible, test job ID: ${response.data.id}`);
        return {
          success: true,
          status: 'accessible',
          endpoint: this.runpodEndpoint
        };
      } else {
        throw new Error('No job ID received from test request');
      }
      
    } catch (error) {
      logger.error(`❌ RunPod connection failed: ${error.message}`);
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
      if (stats.size > 1000) {
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

  /**
   * OpenAI DALL-E fallback when RunPod fails
   */
  async generateWithOpenAI(title, content = '', network = 'generic', style = 'modern') {
    const imageId = this.generateImageId();
    const startTime = Date.now();
    
    logger.info(`🎨 Generating with OpenAI DALL-E fallback: "${title}"`);
    
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY not configured - cannot use fallback');
      }

      // Create enhanced prompt for DALL-E
      const prompt = this.createEnhancedPrompt(title, content, network, style);
      const dallePrompt = `${prompt}, professional magazine cover design, high quality cryptocurrency illustration, detailed digital art`;
      
      logger.info(`🔤 DALL-E Prompt: "${dallePrompt}"`);
      
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
      logger.info(`⬇️ Downloading DALL-E image from: ${imageUrl}`);
      
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
      logger.info(`✅ DALL-E fallback generation completed in ${totalTime}s`);
      
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
          prompt: dallePrompt,
          generationTime: totalTime,
          method: 'openai_dalle3_fallback',
          model: 'DALL-E-3',
          timestamp: new Date().toISOString(),
          fallback_reason: 'RunPod unavailable'
        }
      };
      
    } catch (error) {
      logger.error('❌ OpenAI DALL-E fallback failed:', error);
      throw new Error(`Both RunPod and OpenAI failed: ${error.message}`);
    }
  }
}

module.exports = RunPodLoraService;