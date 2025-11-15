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
   * Generate image using RunPod serverless endpoint
   */
  async generateLoraImage(title, content = '', network = 'generic', style = 'modern') {
    const imageId = this.generateImageId();
    const startTime = Date.now();
    
    logger.info(`🚀 Generating with RunPod LoRA: "${title}"`);
    
    try {
      // Create enhanced prompt for the LoRA model
      const prompt = this.createEnhancedPrompt(title, content, network, style);
      
      logger.info(`🔤 Prompt: "${prompt}"`);
      logger.info(`🎯 Network: "${network}", Style: "${style}"`);
      
      // Step 1: Submit job to RunPod
      const jobPayload = {
        input: {
          prompt: prompt,
          title: title,
          num_inference_steps: 25,
          guidance_scale: 7.5,
          lora_scale: 1.0
        }
      };
      
      logger.info(`🌐 Submitting job to RunPod: ${this.runpodEndpoint}`);
      logger.info(`📋 Job payload:`, jobPayload);
      
      const submitResponse = await axios.post(this.runpodEndpoint, jobPayload, {
        timeout: 30000,
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
    const maxAttempts = 60; // 5 minutes max
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
   * Create enhanced prompt for LoRA model
   */
  createEnhancedPrompt(title, content, network, style) {
    // Network-specific base prompts
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
    
    // Add network-specific styling
    const networkStyles = {
      'bitcoin': 'golden orange colors, digital gold, secure blockchain',
      'ethereum': 'blue purple colors, smart contracts, NOT bitcoin, NOT BTC',
      'solana': 'purple pink colors, high performance, NOT bitcoin, NOT BTC',
      'hedera': 'black white colors, hashgraph, NOT bitcoin, NOT BTC',
      'algorand': 'green blue colors, proof of stake, NOT bitcoin, NOT BTC',
      'constellation': 'purple cosmic colors, DAG technology, NOT bitcoin, NOT BTC',
      'generic': 'professional crypto design, modern blockchain technology'
    };
    
    if (networkStyles[network]) {
      prompt += `, ${networkStyles[network]}`;
    }
    
    // Style keywords
    const styleKeywords = {
      'modern': 'clean design, minimalist',
      'futuristic': 'advanced technology, sci-fi',
      'classic': 'elegant, sophisticated',
      'professional': 'premium quality, editorial'
    };
    
    if (styleKeywords[style]) {
      prompt += `, ${styleKeywords[style]}`;
    }
    
    prompt += ', high quality, detailed, magazine cover design';
    
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
}

module.exports = RunPodLoraService;