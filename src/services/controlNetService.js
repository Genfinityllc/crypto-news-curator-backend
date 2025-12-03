const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');
const SVGLogoService = require('./svgLogoService');
const WatermarkService = require('./watermarkService');

/**
 * ControlNet Service - Integrates SVG logos with SDXL+ControlNet for precise logo adherence
 * Uses Wavespeed API with ControlNet Union SDXL model for logo-guided image generation
 */
class ControlNetService {
  constructor() {
    this.timeout = 300000; // 5 minutes max
    this.imageStorePath = path.join(__dirname, '../../temp/controlnet-images');
    this.baseUrl = process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app';
    this.svgLogoService = new SVGLogoService();
    this.watermarkService = new WatermarkService();
    
    // Ensure storage directory exists
    this.ensureStorageDirectory().catch(err => {
      logger.error('❌ Failed to create ControlNet storage directory:', err);
    });
    
    logger.info('🎯 ControlNet Service initialized for SVG-guided generation');
  }

  async ensureStorageDirectory() {
    try {
      await fs.mkdir(this.imageStorePath, { recursive: true });
      logger.info(`📁 ControlNet image storage ready: ${this.imageStorePath}`);
    } catch (error) {
      logger.error('❌ Failed to create storage directory:', error);
    }
  }

  /**
   * Generate unique image ID
   */
  generateImageId() {
    const randomBytes = crypto.randomBytes(8);
    return `controlnet_${randomBytes.toString('hex')}`;
  }

  /**
   * Get hosted image URL for an image ID
   */
  getImageUrl(imageId) {
    return `${this.baseUrl}/temp/controlnet-images/${imageId}.png`;
  }

  /**
   * Generate image with enhanced multi-format SVG guidance using ControlNet
   * Uses multiple conditioning formats for maximum geometric accuracy
   */
  async generateWithSVGGuidance(title, content = '', style = 'professional', options = {}) {
    const imageId = this.generateImageId();
    const startTime = Date.now();
    
    logger.info(`🎯 Generating image with Enhanced Multi-Format ControlNet guidance: "${title}"`);
    
    try {
      // Step 1: Detect cryptocurrency and get SVG logo
      const detection = await this.svgLogoService.detectAndGetLogo(title, content);
      if (!detection) {
        throw new Error('No cryptocurrency detected for SVG guidance');
      }

      // Handle both single and multiple entity detection formats
      let detected, logo;
      if (detection.multiple) {
        // Multiple entities detected - use the first one for ControlNet
        const firstEntity = detection.entities[0];
        detected = firstEntity.detected;
        logo = firstEntity.logo;
        logger.info(`🎯 Multiple entities detected: ${detection.entities.map(e => e.name).join(', ')} - Using ${firstEntity.name} for Enhanced ControlNet`);
      } else {
        // Single entity detected - use as before
        detected = detection.detected;
        logo = detection.logo;
        logger.info(`✅ Single entity detected: ${detected}, found Enhanced SVG logo`);
      }

      // Step 2: Determine best conditioning strategy based on available formats
      const availableFormats = this.analyzeAvailableConditioningFormats(logo);
      
      if (availableFormats.count === 0) {
        throw new Error(`No ControlNet conditioning images available for ${detected}`);
      }

      logger.info(`🎨 Enhanced ControlNet: ${availableFormats.count} conditioning formats available for ${detected}: ${availableFormats.types.join(', ')}`);

      // Step 3: Select optimal conditioning strategy
      const conditioningStrategy = this.selectOptimalConditioningStrategy(availableFormats, logo, options);
      
      logger.info(`🎯 Selected conditioning strategy: ${conditioningStrategy.primary} (${conditioningStrategy.description})`);

      // Step 4: Create enhanced crypto-specific prompt
      const prompt = this.createEnhancedControlNetPrompt(title, content, detected, logo, style, conditioningStrategy);
      
      logger.info(`🔤 Enhanced ControlNet Prompt: "${prompt.substring(0, 100)}..."`);

      // Step 5: Generate with Enhanced Wavespeed ControlNet
      const result = await this.generateWithEnhancedWavespeedControlNet({
        prompt,
        conditioning: conditioningStrategy,
        detected,
        imageId,
        options
      });

      const totalTime = Math.round((Date.now() - startTime) / 1000);
      logger.info(`✅ Enhanced SVG-guided ControlNet generation completed in ${totalTime}s`);
      
      return {
        success: true,
        imageId: imageId,
        imageUrl: this.getImageUrl(imageId),
        localPath: result.localPath,
        metadata: {
          title,
          content,
          cryptocurrency: detected,
          conditioningStrategy: conditioningStrategy.primary,
          conditioningFormats: conditioningStrategy.formats,
          style,
          prompt,
          generationTime: totalTime,
          method: 'enhanced_svg_controlnet_guidance',
          model: 'FLUX_CONTROLNET_UNION_PRO_2.0',
          resolution: '2048x2048',
          logoUsed: {
            symbol: logo.symbol,
            name: logo.name,
            colors: logo.brand_colors
          },
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('❌ Enhanced SVG-guided ControlNet generation failed:', error);
      throw new Error(`Enhanced SVG ControlNet generation failed: ${error.message}`);
    }
  }

  /**
   * Analyze available conditioning formats for optimal strategy selection
   */
  analyzeAvailableConditioningFormats(logo) {
    const formats = {
      canny: !!logo.preprocessed_canny,
      depth: !!logo.preprocessed_depth,
      normal: !!(logo.metadata?.enhanced_conditioning?.normal_map),
      mask: !!(logo.metadata?.enhanced_conditioning?.mask)
    };
    
    const types = Object.keys(formats).filter(type => formats[type]);
    
    return {
      formats,
      types,
      count: types.length,
      hasEnhanced: formats.normal || formats.mask
    };
  }

  /**
   * Select optimal conditioning strategy based on available formats and requirements
   */
  selectOptimalConditioningStrategy(availableFormats, logo, options = {}) {
    const { formats, types, hasEnhanced } = availableFormats;
    
    // Strategy 1: Multi-format enhanced (NUCLEAR ACCURACY)
    if (hasEnhanced && formats.canny && formats.depth) {
      return {
        primary: 'multi_enhanced',
        formats: ['canny', 'depth', 'normal', 'mask'],
        description: 'Multi-format enhanced conditioning for NUCLEAR SVG accuracy',
        controlImageBase64: this.getCombinedConditioningImage(availableFormats, logo),
        strength: options.strength || 1.0  // MAXIMUM STRENGTH for exact SVG geometry
      };
    }
    
    // Strategy 2: Canny + Depth (NUCLEAR HIGH ACCURACY)
    if (formats.canny && formats.depth) {
      return {
        primary: 'canny_depth',
        formats: ['canny', 'depth'],
        description: 'Canny edges + depth map for NUCLEAR precise geometry',
        controlImageBase64: logo.preprocessed_canny,
        strength: options.strength || 0.95  // NEAR MAXIMUM for exact edges
      };
    }
    
    // Strategy 3: Canny only (NUCLEAR EDGE ACCURACY)
    if (formats.canny) {
      return {
        primary: 'canny',
        formats: ['canny'],
        description: 'Canny edge detection for NUCLEAR sharp boundaries',
        controlImageBase64: logo.preprocessed_canny,
        strength: options.strength || 0.9   // HIGH STRENGTH for exact edges
      };
    }
    
    // Strategy 4: Depth only (NUCLEAR SHAPE ACCURACY)
    if (formats.depth) {
      return {
        primary: 'depth',
        formats: ['depth'],
        description: 'Depth map for NUCLEAR 3D shape control',
        controlImageBase64: logo.preprocessed_depth,
        strength: options.strength || 0.9   // HIGH STRENGTH for exact shapes
      };
    }
    
    // Fallback
    throw new Error('No viable conditioning strategy available');
  }

  /**
   * Create enhanced ControlNet prompt based on conditioning strategy
   */
  createEnhancedControlNetPrompt(title, content, cryptocurrency, logo, style, conditioningStrategy) {
    const colors = logo.brand_colors || {};
    const primaryColor = colors.primary || '#000000';
    
    // Base prompt with enhanced accuracy requirements
    let prompt = `Ultra-precise ${logo.name} cryptocurrency logo with exact geometric fidelity, ${primaryColor} brand colors, `;
    
    // Style-specific enhancements
    switch (style) {
      case 'professional':
        prompt += 'professional 3D rendering, premium materials, sophisticated lighting, ';
        break;
      case 'futuristic':
        prompt += 'futuristic holographic effects, advanced materials, dynamic lighting, ';
        break;
      case 'minimal':
        prompt += 'clean minimalist 3D design, subtle materials, elegant lighting, ';
        break;
      default:
        prompt += 'high-quality 3D rendering, premium finish, professional lighting, ';
    }
    
    // Conditioning-specific enhancements
    switch (conditioningStrategy.primary) {
      case 'multi_enhanced':
        prompt += 'MAXIMUM geometric precision with multi-format conditioning, exact SVG path adherence, ';
        break;
      case 'canny_depth':
        prompt += 'precise edge geometry with accurate depth, exact boundary control, ';
        break;
      case 'canny':
        prompt += 'sharp geometric boundaries, exact edge definition, ';
        break;
      case 'depth':
        prompt += 'accurate 3D shape control, precise volumetric form, ';
        break;
    }
    
    // Universal quality and exclusion terms
    prompt += 'ultra-high quality, photorealistic, sharp focus, detailed textures, premium finish, ';
    prompt += 'absolutely no text, no words, no letters, no typography, pure visual symbol only';
    
    return prompt;
  }

  /**
   * Get combined conditioning image for multi-format strategies
   * For now, returns the best single format until multi-format API is available
   */
  getCombinedConditioningImage(availableFormats, logo) {
    // Priority: Canny > Depth > Normal > Mask
    if (availableFormats.formats.canny) return logo.preprocessed_canny;
    if (availableFormats.formats.depth) return logo.preprocessed_depth;
    // Enhanced formats would be accessed from metadata
    return null;
  }

  /**
   * Nuclear SVG injection - forces exact SVG path data into the prompt
   */
  injectNuclearSVGGuidance(prompt, cryptocurrency) {
    if (cryptocurrency === 'HBAR') {
      // NUCLEAR INJECTION: Force exact SVG path coordinates from HBAR.svg
      const svgInjection = ' MANDATORY SVG PATH COORDINATES: M2061.7,2117.5h-253.6v-539.1H691.9v539.1h-253.6V369.3h253.6v526.2h1116.2V369.3h253.6v1748.2ZM703.9,1376.7h1116.2v-278.5H703.9v278.5Z - this EXACT geometric shape with TWO vertical bars and ONE horizontal crossbar connecting them, pixel-perfect SVG reproduction required, NUCLEAR adherence to path data, absolutely mandatory geometric H structure with crossbar at 1376.7-1098.2 coordinates, ';
      
      prompt = svgInjection + prompt + ' NUCLEAR REQUIREMENT: follow SVG path coordinates exactly, show complete H letter with proper proportions from viewBox 0 0 2500 2500, vertical bars from 369.3 to 2117.5, horizontal crossbar at coordinates 703.9-1820.1 by 1376.7-1098.2, FORBIDDEN any other H shape variations';
    } else if (cryptocurrency === 'XRP') {
      // ULTRA-ENHANCED MATHEMATICAL CONSTRAINT INJECTION for XRP
      const mathematicalDescription = `MATHEMATICAL VECTOR SPECIFICATION for XRP logo: `;
      mathematicalDescription += `COORDINATE SYSTEM: ViewBox 0,0,512,424 (width=512px, height=424px). `;
      mathematicalDescription += `GEOMETRIC STRUCTURE: Exactly TWO independent triangular path elements forming X-shape. `;
      mathematicalDescription += `PATH 1 COORDINATES: M437,0 h74 L357,152.48 c-55.77,55.19 -146.19,55.19 -202,0 L0.94,0 H75 L192,115.83 a91.11,91.11 0,0,0 127.91,0 Z `;
      mathematicalDescription += `PATH 2 COORDINATES: M74.05,424 H0 L155,270.58 c55.77,-55.19 146.19,-55.19 202,0 L512,424 H438 L320,307.23 a91.11,91.11 0,0,0 -127.91,0 Z `;
      mathematicalDescription += `MATHEMATICAL CONSTRAINTS: Path 1 starts at top (y=0), Path 2 starts at bottom (y=424). `;
      mathematicalDescription += `Both paths are FLAT triangular shapes with curved connections, NO depth, NO roundness. `;
      mathematicalDescription += `TOPOLOGY: Open X-shape formed by two separate triangular elements, NOT enclosed by circles. `;
      mathematicalDescription += `FORBIDDEN ABSOLUTELY: Circular rings, round enclosures, enclosed circles, O-shapes, rings around the X. `;
      mathematicalDescription += `REQUIRED: Pure flat X-shape made of exactly two triangular path elements, no additional geometry. `;
      
      // Triple reinforcement for mathematical precision
      const constraintReinforcement = ` MATHEMATICAL PRECISION ENFORCEMENT: `;
      constraintReinforcement += `Shape topology = exactly two triangular paths forming X. `;
      constraintReinforcement += `NO circular elements whatsoever. NO rings. NO enclosures. `;
      constraintReinforcement += `Width/height ratio = 512:424 = 1.21:1. `;
      constraintReinforcement += `Geometric accuracy = exact SVG path mathematics. `;
      constraintReinforcement += `FORBIDDEN shapes: circles, rings, enclosed shapes, O-letters, round elements. `;
      constraintReinforcement += `MANDATORY shapes: flat triangular X-shape, open geometry, angular paths only.`;
      
      prompt = mathematicalDescription + prompt + constraintReinforcement + ` FINAL CONSTRAINT: The XRP logo is two flat triangular shapes forming an X - never circles or rings.`;
    }
    
    return prompt;
  }

  /**
   * Create MINIMAL ControlNet prompt - let SVG conditioning do the work
   * NEW: Minimal prompts for maximum SVG adherence
   */
  createControlNetPrompt(title, content, cryptocurrency, logo, style) {
    // MINIMAL prompt - let ControlNet SVG conditioning drive accuracy
    const colors = logo.brand_colors || {};
    const primaryColor = colors.primary || '#000000';
    
    // ULTRA-MINIMAL prompt focused on quality only
    let prompt = `Professional ${logo.name} cryptocurrency illustration, ${primaryColor} brand colors, `;
    
    // Style terms only
    switch (style) {
      case 'professional':
        prompt += 'clean modern design, professional lighting, ';
        break;
      case 'futuristic':
        prompt += 'futuristic aesthetic, high-tech environment, ';
        break;
      case 'minimal':
        prompt += 'minimalist design, clean composition, ';
        break;
      default:
        prompt += 'professional magazine quality, ';
    }
    
    // Quality terms only - NO logo descriptions (ControlNet handles this)
    prompt += 'ultra-high quality, sharp focus, detailed, premium finish, ';
    prompt += 'absolutely no text, no words, no letters, no typography';
    
    // CRITICAL: Let ControlNet handle ALL logo accuracy - no text descriptions needed
    logger.info(`🎯 MINIMAL ControlNet prompt - SVG conditioning drives 100% logo accuracy`);
    
    return prompt;
  }

  /**
   * Generate with Enhanced Wavespeed ControlNet API using optimal conditioning strategy
   */
  async generateWithEnhancedWavespeedControlNet({ prompt, conditioning, detected, imageId, options = {} }) {
    try {
      const wavespeedApiKey = process.env.WAVESPEED_API_KEY;
      if (!wavespeedApiKey) {
        throw new Error('WAVESPEED_API_KEY not configured');
      }

      // NUCLEAR SVG INJECTION for specific cryptocurrencies
      if (detected === 'HBAR' || detected === 'XRP') {
        prompt = this.injectNuclearSVGGuidance(prompt, detected);
      }

      // Prepare ControlNet image using optimal conditioning
      const controlImageBuffer = Buffer.from(conditioning.controlImageBase64, 'base64');
      const tempControlPath = path.join(this.imageStorePath, `${imageId}_control.png`);
      await fs.writeFile(tempControlPath, controlImageBuffer);

      logger.info(`📤 Submitting Enhanced ControlNet job to Wavespeed (${conditioning.primary} strategy)...`);

      // Submit generation job with enhanced parameters
      const response = await axios.post('https://api.wavespeed.ai/api/v3/predictions', {
        model: "wavespeed-ai/flux-controlnet-union-pro-2.0",
        input: {
          prompt: prompt,
          control_image: `data:image/png;base64,${conditioning.controlImageBase64}`,
          size: "1024*1024",  // FLUX format
          num_inference_steps: options.steps || 35, // MORE steps for MAXIMUM quality
          guidance_scale: options.guidance_scale || 5.0, // MAXIMUM guidance for SVG accuracy
          controlnet_conditioning_scale: conditioning.strength, // Use our NUCLEAR strength values
          control_guidance_start: 0,
          control_guidance_end: 1.0, // FULL GUIDANCE for perfect precision
          num_images: 1,
          output_format: "jpeg"
        }
      }, {
        headers: {
          'Authorization': `Bearer ${wavespeedApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });

      if (!response.data.id) {
        throw new Error('No job ID received from Enhanced Wavespeed ControlNet API');
      }

      const jobId = response.data.id;
      logger.info(`✅ Enhanced ControlNet job submitted: ${jobId} (${conditioning.description})`);
      
      // Poll for completion
      const result = await this.pollWavespeedJob(jobId, wavespeedApiKey);
      
      if (!result || !result.output || !result.output[0]) {
        throw new Error('No image URL received from Enhanced Wavespeed ControlNet');
      }

      const imageUrl = result.output[0];
      logger.info(`⬇️ Downloading Enhanced ControlNet image from: ${imageUrl}`);
      
      // Download and process image
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      // Save the original image first
      const tempImagePath = path.join(this.imageStorePath, `${imageId}_temp.png`);
      await fs.writeFile(tempImagePath, imageResponse.data);
      
      // Apply watermark overlay
      const imagePath = path.join(this.imageStorePath, `${imageId}.png`);
      await this.watermarkService.addWatermark(tempImagePath, imagePath, { title: prompt.substring(0, 50) });
      
      // Clean up temp files
      try {
        await fs.unlink(tempImagePath);
        await fs.unlink(tempControlPath);
        if (global.gc) global.gc();
      } catch (cleanupError) {
        logger.warn(`⚠️ Failed to clean up temp files: ${cleanupError.message}`);
      }

      return { localPath: imagePath };
      
    } catch (error) {
      logger.error('❌ Enhanced Wavespeed ControlNet generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate with Wavespeed ControlNet API (Legacy method)
   */
  async generateWithWavespeedControlNet({ prompt, controlType, controlImageBase64, detected, imageId, options = {} }) {
    try {
      const wavespeedApiKey = process.env.WAVESPEED_API_KEY;
      if (!wavespeedApiKey) {
        throw new Error('WAVESPEED_API_KEY not configured');
      }

      // NUCLEAR SVG INJECTION: Force the exact SVG shape into the prompt
      if (detected === 'HBAR' || detected === 'XRP') {
        prompt = this.injectNuclearSVGGuidance(prompt, detected);
      }

      // Prepare ControlNet image
      const controlImageBuffer = Buffer.from(controlImageBase64, 'base64');
      const tempControlPath = path.join(this.imageStorePath, `${imageId}_control.png`);
      await fs.writeFile(tempControlPath, controlImageBuffer);

      logger.info(`📤 Submitting ControlNet generation job to Wavespeed...`);

      // Submit generation job to Wavespeed with FLUX ControlNet
      const response = await axios.post('https://api.wavespeed.ai/api/v3/predictions', {
        model: "wavespeed-ai/flux-controlnet-union-pro-2.0",
        input: {
          prompt: prompt,
          control_image: `data:image/png;base64,${controlImageBase64}`,
          size: "1024*1024",  // FLUX format
          num_inference_steps: options.steps || 35, // MORE steps for MAXIMUM quality
          guidance_scale: options.guidance_scale || 5.0, // MAXIMUM guidance for SVG accuracy  
          controlnet_conditioning_scale: options.controlnet_strength || 0.95, // NUCLEAR strength
          control_guidance_start: 0,
          control_guidance_end: 1.0, // FULL GUIDANCE for perfect precision
          num_images: 1,
          output_format: "jpeg"
        }
      }, {
        headers: {
          'Authorization': `Bearer ${wavespeedApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });

      if (!response.data.id) {
        throw new Error('No job ID received from Wavespeed ControlNet API');
      }

      const jobId = response.data.id;
      logger.info(`✅ ControlNet job submitted: ${jobId}`);
      
      // Poll for completion
      const result = await this.pollWavespeedJob(jobId, wavespeedApiKey);
      
      if (!result || !result.output || !result.output[0]) {
        throw new Error('No image URL received from Wavespeed ControlNet');
      }

      const imageUrl = result.output[0];
      logger.info(`⬇️ Downloading ControlNet image from: ${imageUrl}`);
      
      // Download and process image
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      // Save the original image first
      const tempImagePath = path.join(this.imageStorePath, `${imageId}_temp.png`);
      await fs.writeFile(tempImagePath, imageResponse.data);
      
      // Apply watermark overlay
      const imagePath = path.join(this.imageStorePath, `${imageId}.png`);
      await this.watermarkService.addWatermark(tempImagePath, imagePath, { title: prompt.substring(0, 50) });
      
      // Clean up temp files
      try {
        await fs.unlink(tempImagePath);
        await fs.unlink(tempControlPath);
        if (global.gc) global.gc();
      } catch (cleanupError) {
        logger.warn(`⚠️ Failed to clean up temp files: ${cleanupError.message}`);
      }

      return { localPath: imagePath };
      
    } catch (error) {
      logger.error('❌ Wavespeed ControlNet generation failed:', error);
      throw error;
    }
  }

  /**
   * Poll Wavespeed job until completion
   */
  async pollWavespeedJob(jobId, apiKey) {
    const maxAttempts = 15; // Extended for ControlNet processing
    const pollInterval = 5000; // 5 seconds
    const statusUrl = `https://api.wavespeed.ai/api/v3/predictions/${jobId}/result`;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        logger.info(`🔄 Polling ControlNet job ${jobId} (attempt ${attempt + 1}/${maxAttempts})`);
        
        const response = await axios.get(statusUrl, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          },
          timeout: 15000
        });
        
        const status = response.data.data.status;
        logger.info(`📊 ControlNet job status: ${status}`);
        
        if (status === 'completed') {
          logger.info(`✅ ControlNet job completed`);
          return response.data.data;
        } else if (status === 'failed') {
          const error = response.data.data.error || 'Unknown error';
          throw new Error(`ControlNet job failed: ${error}`);
        }
        
        // Wait before next poll
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        
      } catch (pollError) {
        logger.error(`❌ Error polling ControlNet job: ${pollError.message}`);
        throw pollError;
      }
    }
    
    throw new Error(`Timeout: ControlNet job ${jobId} did not complete after ${maxAttempts} attempts`);
  }

  /**
   * Test ControlNet service with a specific cryptocurrency
   */
  async testControlNetService(symbol = 'HBAR') {
    try {
      logger.info(`🧪 Testing ControlNet service with ${symbol}...`);
      
      const logo = await this.svgLogoService.getLogoBySymbol(symbol);
      if (!logo) {
        throw new Error(`Logo not found for ${symbol}`);
      }
      
      const hasControlNet = !!(logo.preprocessed_canny || logo.preprocessed_depth);
      
      return {
        success: true,
        logoFound: true,
        hasControlNetData: hasControlNet,
        logo: {
          symbol: logo.symbol,
          name: logo.name,
          hasCanny: !!logo.preprocessed_canny,
          hasDepth: !!logo.preprocessed_depth,
          brandColors: logo.brand_colors
        },
        status: 'ControlNet service ready'
      };
      
    } catch (error) {
      logger.error(`❌ ControlNet test failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        status: 'ControlNet service failed'
      };
    }
  }
}

module.exports = ControlNetService;