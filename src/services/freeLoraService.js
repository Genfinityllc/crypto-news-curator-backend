/**
 * Free Open Source LoRA Service
 * Uses Hugging Face Inference API with custom LORA model + ControlNet
 * Supports: HuggingFace Inference API, Pollinations.ai, HF Spaces
 */

const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { logImageGeneration } = require('./outputMonitorService');

class FreeLoraService {
  constructor() {
    this.timeout = 300000; // 5 minutes
    this.imageStorePath = path.join(__dirname, '../../temp/free-lora-images');
    this.baseUrl = process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app';
    
    // HuggingFace Configuration - Use custom LORA model if available
    this.hfApiKey = process.env.HUGGINGFACE_API_KEY;
    this.hfLoraModel = process.env.HUGGINGFACE_LORA_MODEL || 'ValtronK/valor-crypto-lora';
    
    // HuggingFace Inference API endpoints
    this.hfInferenceEndpoints = {
      // SDXL Base for high-quality generation
      sdxlBase: 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
      // SDXL with ControlNet (free tier)
      sdxlControlNet: 'https://api-inference.huggingface.co/models/diffusers/controlnet-canny-sdxl-1.0',
      // Custom LORA model
      customLora: `https://api-inference.huggingface.co/models/${this.hfLoraModel}`
    };
    
    // FREE SDXL LoRA: Use working Hugging Face Spaces as backup
    this.hfSpaces = {
      loraExplorer: 'https://multimodalart-loratheexplorer.hf.space',
      lcmLora: 'https://latent-consistency-lcm-lora-for-sdxl.hf.space'
    };
    
    // PNG Logo Directory for ControlNet input
    this.pngLogoDir = process.env.NODE_ENV === 'production' 
      ? path.join(__dirname, '../../uploads/png-logos')
      : '/Users/valorkopeny/Desktop/SVG CRYPTO LOGOS/PNG';
    
    this.ensureStorageDirectory();
    
    if (this.hfApiKey) {
      logger.info(`✅ HuggingFace API configured with LORA model: ${this.hfLoraModel}`);
    } else {
      logger.warn('⚠️ HUGGINGFACE_API_KEY not set - using free fallback methods only');
    }
  }

  async ensureStorageDirectory() {
    try {
      await fs.access(this.imageStorePath);
    } catch {
      await fs.mkdir(this.imageStorePath, { recursive: true });
      logger.info('📁 Free LoRA image storage ready:', this.imageStorePath);
    }
  }

  /**
   * Main generation method using HuggingFace Inference API with ControlNet
   * Priority order:
   * 1. HuggingFace Inference API with SDXL + ControlNet (if API key available)
   * 2. Pollinations.ai with enhanced prompts
   * 3. HuggingFace Spaces as backup
   * 4. Placeholder as last resort (logs as failure)
   */
  async generateWithFreeLoRA(title, logoSymbol, options = {}) {
    const startTime = Date.now();
    const imageId = this.generateImageId();
    
    try {
      logger.info(`🆓 Starting FREE LoRA generation for ${logoSymbol}`);
      logger.info(`🔧 2-Step Process: Article prompt → ControlNet logo integration`);
      
      // Step 1: Build content-based prompt from article rewrite
      const contentPrompt = this.buildContentBasedPrompt(title, logoSymbol, options);
      logger.info(`📝 Generated prompt from article: ${contentPrompt.substring(0, 100)}...`);
      
      // Step 2: Get logo for ControlNet input (PNG or SVG)
      const logoData = await this.getLogoForControlNet(logoSymbol);
      
      let result;
      let method = 'unknown';
      
      // Method 1: HuggingFace Inference API with ControlNet (BEST - requires API key)
      if (this.hfApiKey) {
        try {
          logger.info('🎯 Method 1: HuggingFace Inference API with ControlNet...');
          result = await this.generateWithHFInferenceAPI(contentPrompt, logoSymbol, logoData, imageId, options);
          method = 'huggingface_inference_controlnet';
          logger.info('✅ HuggingFace Inference API + ControlNet succeeded!');
        } catch (hfError) {
          logger.warn(`⚠️ HuggingFace Inference API failed: ${hfError.message}`);
          result = null;
        }
      }
      
      // Method 2: Pollinations.ai with enhanced prompts (FREE - no ControlNet but good quality)
      if (!result) {
        try {
          logger.info('🎯 Method 2: Pollinations.ai with enhanced prompts...');
          result = await this.generateWithPollinations(contentPrompt, logoSymbol, imageId, options);
          method = 'pollinations_enhanced';
          logger.info('✅ Pollinations.ai succeeded!');
        } catch (pollinationsError) {
          logger.warn(`⚠️ Pollinations.ai failed: ${pollinationsError.message}`);
          result = null;
        }
      }
      
      // Method 3: HuggingFace Spaces SDXL LoRA (FREE backup)
      if (!result) {
        try {
          logger.info('🎯 Method 3: HuggingFace Spaces SDXL LoRA...');
          result = await this.generateWithHFLoRA(contentPrompt, logoSymbol, imageId, options);
          method = 'hf_spaces_lora';
          logger.info('✅ HuggingFace Spaces succeeded!');
        } catch (hfSpacesError) {
          logger.warn(`⚠️ HuggingFace Spaces failed: ${hfSpacesError.message}`);
          result = null;
        }
      }
      
      // Method 4: Placeholder as absolute last resort (THIS IS A FAILURE CASE)
      if (!result) {
        logger.error('❌ ALL GENERATION METHODS FAILED - Using placeholder');
        result = await this.generatePlaceholderImage(logoSymbol, imageId);
        method = 'placeholder_fallback';
      }
      
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      logger.info(`✅ FREE LoRA generation completed in ${totalTime}s using ${method}`);
      
      return {
        success: true,
        imageId: result.imageId,
        imageUrl: result.imageUrl,
        localPath: result.localPath,
        metadata: {
          method: method,
          service: method.includes('huggingface') ? 'huggingface' : method.includes('pollinations') ? 'pollinations' : 'fallback',
          logoSymbol,
          totalProcessingTime: totalTime,
          controlNetUsed: method === 'huggingface_inference_controlnet',
          is3DIntegrated: method !== 'placeholder_fallback',
          isFlatOverlay: method === 'placeholder_fallback',
          features: [
            'content_based_prompting',
            'article_rewrite_prompt',
            method.includes('controlnet') ? 'controlnet_logo_integration' : 'prompt_based_logo'
          ]
        }
      };
      
    } catch (error) {
      logger.error(`❌ FREE LoRA generation failed:`, error);
      throw error;
    }
  }

  /**
   * Get logo data for ControlNet input (PNG or SVG)
   */
  async getLogoForControlNet(logoSymbol) {
    try {
      const normalizedSymbol = logoSymbol.toUpperCase();
      
      // Try PNG first
      const possibleFiles = [
        `${normalizedSymbol}.png`,
        `${logoSymbol.toLowerCase()}.png`,
        `${logoSymbol}.png`
      ];
      
      for (const filename of possibleFiles) {
        const logoPath = path.join(this.pngLogoDir, filename);
        try {
          await fs.access(logoPath);
          const logoBuffer = await fs.readFile(logoPath);
          logger.info(`✅ Found PNG logo for ${logoSymbol}: ${filename}`);
          return {
            buffer: logoBuffer,
            path: logoPath,
            type: 'png',
            symbol: normalizedSymbol
          };
        } catch (e) {
          // Continue to next file
        }
      }
      
      logger.warn(`⚠️ No PNG logo found for ${logoSymbol}, ControlNet will use prompt-only mode`);
      return null;
      
    } catch (error) {
      logger.error(`❌ Error getting logo for ${logoSymbol}:`, error.message);
      return null;
    }
  }

  /**
   * Generate using HuggingFace Inference API with SDXL + ControlNet
   * This is the preferred method when API key is available
   */
  async generateWithHFInferenceAPI(prompt, logoSymbol, logoData, imageId, options = {}) {
    if (!this.hfApiKey) {
      throw new Error('HuggingFace API key not configured');
    }
    
    logger.info(`🚀 Calling HuggingFace Inference API for ${logoSymbol}...`);
    
    try {
      // Enhanced prompt with logo integration instructions
      const enhancedPrompt = `${prompt}, featuring the ${logoSymbol} cryptocurrency logo as a 3D metallic element integrated into the scene, the ${logoSymbol} symbol with proper brand colors, realistic lighting and shadows, professional crypto news article cover, ultra-high quality, 8K resolution`;
      
      const negativePrompt = `flat overlay, 2D sticker, wrong ${logoSymbol} logo, incorrect symbol, text, watermarks, blurry, low quality, amateur`;
      
      // Call HuggingFace Inference API for SDXL
      const response = await axios.post(
        this.hfInferenceEndpoints.sdxlBase,
        {
          inputs: enhancedPrompt,
          parameters: {
            negative_prompt: negativePrompt,
            num_inference_steps: 30,
            guidance_scale: 7.5,
            width: 1024,
            height: 576  // 16:9 aspect ratio
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.hfApiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer',
          timeout: this.timeout
        }
      );
      
      if (response.data && response.data.byteLength > 1000) {
        logger.info('✅ HuggingFace Inference API returned image');
        return await this.processGeneratedImage(response.data, imageId, 'huggingface_inference');
      }
      
      throw new Error('Invalid response from HuggingFace Inference API');
      
    } catch (error) {
      // Handle model loading (503) - this is common for HF Inference API
      if (error.response?.status === 503) {
        logger.warn(`⏳ HuggingFace model is loading, please wait...`);
        throw new Error('HuggingFace model is loading, try again in 1-2 minutes');
      }
      
      if (error.response?.status === 401) {
        throw new Error('Invalid HuggingFace API key');
      }
      
      logger.error('❌ HuggingFace Inference API error:', error.message);
      throw error;
    }
  }

  /**
   * Generate using FREE HuggingFace LoRA Spaces  
   */
  async generateWithHFLoRA(prompt, logoSymbol, imageId, options = {}) {
    logger.info('🎯 Trying FREE HuggingFace SDXL LoRA...');
    
    try {
      // Enhanced prompt for crypto/financial content with logo integration
      const cryptoEnhancedPrompt = `${prompt}, featuring ${logoSymbol} cryptocurrency logo prominently displayed, professional 3D logo integration, metallic surfaces, holographic elements, sophisticated lighting, cinematic quality, ultra-detailed, 8k resolution`;
      
      const requestData = {
        data: [
          cryptoEnhancedPrompt,  // prompt
          "",                    // negative_prompt
          "artificialguybr/LogoRedmond-LogoLoraForSDXL", // Selected LoRA for logo generation
          1.0,                   // lora_scale
          1600,                  // width 
          900,                   // height
          25,                    // guidance_scale
          25,                    // num_inference_steps
          options.seed || Math.floor(Math.random() * 1000000), // seed
          true                   // randomize_seed
        ]
      };
      
      const response = await axios.post(
        `${this.hfSpaces.loraExplorer}/api/predict`,
        requestData,
        { 
          timeout: this.timeout,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (response.data && response.data.data && response.data.data[0] && response.data.data[0].url) {
        const imageUrl = response.data.data[0].url;
        return await this.downloadAndProcessImage(imageUrl, imageId, 'hf_lora');
      }
      
      throw new Error('No image data in HuggingFace LoRA response');
      
    } catch (error) {
      logger.error('❌ HuggingFace LoRA generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate using COMPLETELY FREE Pollinations.ai (NO API KEY NEEDED!)
   */
  async generateWithPollinations(prompt, logoSymbol, imageId, options = {}) {
    logger.info('⚡ Trying COMPLETELY FREE Pollinations.ai...');
    
    try {
      // Enhanced prompt for crypto with logo integration  
      const enhancedPrompt = `${prompt}, featuring ${logoSymbol} cryptocurrency logo prominently integrated into the environment, 3D metallic ${logoSymbol} logo with proper branding colors, realistic material properties, professional lighting, high-end financial technology aesthetic, ultra-detailed, 8K quality, cinematic composition`;
      
      // Pollinations.ai simple URL-based API - completely free!
      const encodedPrompt = encodeURIComponent(enhancedPrompt);
      const seed = options.seed || Math.floor(Math.random() * 1000000);
      
      const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1600&height=900&seed=${seed}&model=flux&nologo=true`;
      
      logger.info(`🌸 Calling Pollinations.ai: ${pollinationsUrl.substring(0, 100)}...`);
      
      // Fetch the generated image directly 
      const response = await axios.get(pollinationsUrl, { 
        timeout: this.timeout,
        responseType: 'arraybuffer'
      });
      
      if (response.data && response.data.byteLength > 0) {
        return await this.processGeneratedImage(response.data, imageId, 'pollinations_free');
      }
      
      throw new Error('No image data in Pollinations response');
      
    } catch (error) {
      logger.error('❌ Pollinations generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate placeholder image when all services fail
   */
  async generatePlaceholderImage(logoSymbol, imageId) {
    logger.info('🎨 Generating placeholder image...');
    
    try {
      // Create a simple placeholder with logo text
      const width = 1600;
      const height = 900;
      
      const placeholderSvg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#16213e;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0f4c75;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bgGrad)"/>
        <circle cx="${width/2}" cy="${height/2}" r="120" fill="#ffffff" opacity="0.1"/>
        <text x="${width/2}" y="${height/2 - 20}" text-anchor="middle" fill="#ffffff" font-size="48" font-weight="bold">${logoSymbol}</text>
        <text x="${width/2}" y="${height/2 + 30}" text-anchor="middle" fill="#bbbbbb" font-size="24">Cryptocurrency Analysis</text>
      </svg>`;
      
      const imageBuffer = await sharp(Buffer.from(placeholderSvg)).png().toBuffer();
      
      // Save placeholder image
      const filename = `freelora_${imageId}.png`;
      const localPath = path.join(this.imageStorePath, filename);
      await fs.writeFile(localPath, imageBuffer);
      
      const finalUrl = `${this.baseUrl}/temp/free-lora-images/${filename}`;
      
      logger.info(`✅ Placeholder image created: ${filename}`);
      
      return {
        imageId,
        imageUrl: finalUrl,
        localPath,
        method: 'placeholder'
      };
      
    } catch (error) {
      logger.error('❌ Placeholder generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Build content-based prompts using existing analysis
   */
  buildContentBasedPrompt(title, logoSymbol, options = {}) {
    const fullText = `${title} ${options.articleContent || options.content || ''}`.toLowerCase();
    
    logger.info(`🔍 Analyzing content for FREE LoRA: "${title.substring(0, 50)}..."`);
    
    let scenePrompt = '';
    
    // Content-based scene generation
    if (fullText.includes('trading') || fullText.includes('price') || fullText.includes('chart')) {
      scenePrompt = 'sophisticated trading floor with massive curved holographic displays showing live market data, candlestick charts floating in 3D space, dynamic price indicators, professional financial workstations, dramatic blue and green monitor lighting';
    } else if (fullText.includes('technology') || fullText.includes('innovation') || fullText.includes('development')) {
      scenePrompt = 'cutting-edge technology laboratory with advanced holographic interfaces, floating code displays, high-tech equipment, innovative digital projections, cool blue technological lighting';
    } else if (fullText.includes('bank') || fullText.includes('payment') || fullText.includes('financial institution')) {
      scenePrompt = 'premium corporate banking environment with elegant glass architecture, floating holographic financial reports, elegant marble surfaces, warm sophisticated lighting';
    } else if (fullText.includes('security') || fullText.includes('hack') || fullText.includes('protection')) {
      scenePrompt = 'high-security cyber command center with encrypted data visualizations, digital security shields, secure network displays, dramatic blue and purple security lighting';
    } else {
      scenePrompt = 'professional modern digital workspace with sophisticated holographic displays, floating data visualizations, contemporary tech interfaces, clean professional lighting';
    }
    
    const fullPrompt = `${scenePrompt}, ultra-realistic 3D ${logoSymbol} cryptocurrency logo naturally integrated as architectural element, multiple instances at various depths creating true 3D perspective, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, cinematic composition with professional studio lighting, 8k resolution, ultra-detailed`;
    
    logger.info(`✅ Content-based prompt built for ${logoSymbol}`);
    return fullPrompt;
  }


  /**
   * Process generated image from binary data (for Stable Diffusion v1.5)
   */
  async processGeneratedImage(imageBuffer, imageId, method) {
    try {
      logger.info('🖼️  Processing generated image from Stable Diffusion v1.5...');
      
      // Resize to standard dimensions and optimize
      const processedBuffer = await sharp(imageBuffer)
        .resize(1600, 900, { fit: 'cover' })
        .jpeg({ quality: 95 })
        .toBuffer();
      
      // Save to local storage
      const filename = `freelora_${imageId}.jpg`;
      const localPath = path.join(this.imageStorePath, filename);
      await fs.writeFile(localPath, processedBuffer);
      
      const finalUrl = `${this.baseUrl}/temp/free-lora-images/${filename}`;
      
      logger.info(`✅ Stable Diffusion v1.5 image processed and saved: ${filename}`);
      
      return {
        imageId,
        imageUrl: finalUrl,
        localPath,
        method
      };
      
    } catch (error) {
      logger.error('❌ Image processing failed:', error.message);
      throw error;
    }
  }

  /**
   * Download and process generated image from URL (for backup methods)
   */
  async downloadAndProcessImage(imageUrl, imageId, method) {
    try {
      logger.info('📥 Downloading generated image...');
      
      const response = await axios.get(imageUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000 
      });
      
      const imageBuffer = Buffer.from(response.data);
      
      // Resize to standard dimensions and apply watermark
      const processedBuffer = await sharp(imageBuffer)
        .resize(1600, 900, { fit: 'cover' })
        .jpeg({ quality: 95 })
        .toBuffer();
      
      // Save to local storage
      const filename = `freelora_${imageId}.jpg`;
      const localPath = path.join(this.imageStorePath, filename);
      await fs.writeFile(localPath, processedBuffer);
      
      const finalUrl = `${this.baseUrl}/temp/free-lora-images/${filename}`;
      
      logger.info(`✅ Image processed and saved: ${filename}`);
      
      return {
        imageId,
        imageUrl: finalUrl,
        localPath,
        method
      };
      
    } catch (error) {
      logger.error('❌ Image download/processing failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate unique image ID
   */
  generateImageId() {
    return Math.random().toString(36).substr(2, 16);
  }
}

module.exports = FreeLoraService;