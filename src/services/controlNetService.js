const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const logger = require('../utils/logger');
const SVGLogoService = require('./svgLogoService');
const WatermarkService = require('./watermarkService');

/**
 * ControlNet Service - Precise Logo Generation with PNG + Stable Diffusion
 * 
 * Enhanced with 2024 optimal settings for exact logo accuracy using PNG inputs.
 * Supports both PNG logos (new) and SVG database logos (legacy) for maximum compatibility.
 */
class ControlNetService {
  constructor() {
    this.timeout = 300000; // 5 minutes max
    this.imageStorePath = path.join(__dirname, '../../temp/controlnet-images');
    this.baseUrl = process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app';
    this.svgLogoService = new SVGLogoService();
    this.watermarkService = new WatermarkService();
    
    // PNG Logo Directory - NEW: Direct PNG logo support for maximum accuracy
    // Use server-side directory in production, local directory in development
    this.pngLogoDir = process.env.NODE_ENV === 'production' 
      ? path.join(__dirname, '../../uploads/png-logos')
      : '/Users/valorkopeny/Desktop/SVG CRYPTO LOGOS/PNG';
    
    // REVOLUTIONARY 2024 Two-Stage Depth-Aware ControlNet Settings
    this.optimalSettings = {
      // STAGE 1: Environment Generation (No ControlNet - Pure Scene Creation)
      stage1: {
        steps: 60,                    // High quality environment generation
        guidance_scale: 8.5,          // Strong prompt adherence for detailed scenes
        width: 1600,                  // Cinematic resolution  
        height: 900,                  // 16:9 aspect ratio
        scheduler: 'DPMSolverMultistep' // Better for environments
      },
      
      // STAGE 2: Logo Integration via Depth-Aware ControlNet  
      stage2: {
        steps: 50,                    // Focused on logo integration
        guidance_scale: 6.5,          // Balanced control/creativity
        width: 1600,                  
        height: 900,
        
        // DEPTH-BASED CONTROLNET - NOT CANNY
        controlnet_model: 'depth',           // Depth for 3D perspective integration
        controlnet_conditioning_scale: 0.75, // HIGHER - Strong logo integration  
        control_guidance_start: 0.0,         
        control_guidance_end: 0.9,           // Extended guidance for logo preservation
        
        // Depth preprocessing settings
        depth_estimator: 'midas',            // Better than Zoe for logo placement
        pixel_perfect: true,                 
        processor_res: 1024,                 
        
        // Advanced composition control
        strength: 0.65,                      // Partial denoise for scene preservation
        scheduler: 'UniPC'                   // Quality-focused
      }
    };
    
    // REVOLUTIONARY Style Templates - Matching XRP Reference Quality
    this.styleTemplates = {
      holographic: {
        // STAGE 1: Generate complex 3D environment  
        environmentPrompt: "futuristic cyberpunk financial data center, multiple holographic displays, neon grid floors, atmospheric fog with volumetric lighting, metallic surfaces with rainbow reflections, zero gravity digital space, flowing data particles, cyan and purple color scheme, cinematic depth of field, professional photography lighting, 8k photorealistic render",
        
        // STAGE 2: Logo integration prompts
        logoIntegration: "3D metallic cryptocurrency coins floating at multiple depths, perspective-correct placement, environmental reflections on coin surfaces, proper lighting interaction, coins integrated into holographic displays, some coins tilted showing depth, logo symbols etched into metallic surfaces with proper material properties",
        
        negative_prompt: "flat overlay, 2d sticker effect, incorrect perspective, wrong cryptocurrency symbol, bad logo proportions, cartoon style, sketch, amateur lighting, low resolution, text, letters, watermarks"
      },
      
      neon_architecture: {
        // Like XRP20.jpg - Architectural integration
        environmentPrompt: "cyberpunk server room corridor with perspective depth, rows of server racks extending into distance, purple and cyan neon lighting tubes, metallic floor with reflections, atmospheric haze, dramatic one-point perspective, architectural details, futuristic industrial design, professional cinematic lighting",
        
        logoIntegration: "cryptocurrency logo symbols integrated into architectural elements, neon tube logo shapes embedded in walls, holographic logo displays at various depths, logo patterns in floor reflections, perspective-correct scaling, environmental glow effects on logo surfaces",
        
        negative_prompt: "flat logo overlay, 2d placement, incorrect perspective scaling, amateur composition, cartoon style, wrong cryptocurrency symbols, poor lighting integration, text, letters"
      },
      
      floating_coins: {
        // Like XRP13.jpg - Multiple 3D coins with proper perspective
        environmentPrompt: "dark space environment with subtle atmospheric effects, professional studio lighting setup, gradual depth transitions, metallic surfaces for reflections, minimal background allowing coin focus, cinematic composition with depth layers, volumetric lighting effects",
        
        logoIntegration: "multiple 3D cryptocurrency coins at different depths and angles, each coin showing proper perspective distortion, metallic materials with environmental reflections, coins tilted to show dimensionality, logo symbols precisely embossed into coin surfaces, realistic physics-based placement, varied lighting on each coin surface",
        
        negative_prompt: "flat coins, identical positioning, no depth variation, incorrect logo symbols, 2d overlay effect, poor perspective, unrealistic materials, cartoon coins, wrong cryptocurrency branding"
      }
    };
    
    // Ensure storage directory exists
    this.ensureStorageDirectory().catch(err => {
      logger.error('❌ Failed to create ControlNet storage directory:', err);
    });
    
    logger.info('🎯 Enhanced ControlNet Service initialized - PNG + SVG support with 2024 optimal settings');
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
   * NEW: Get PNG logo for a cryptocurrency with SVG fallback
   */
  async getPngLogo(symbol) {
    try {
      const normalizedSymbol = symbol.toUpperCase();
      
      // First, try to get PNG logo from server directory
      const pngLogo = await this.tryGetPngFromDirectory(symbol);
      if (pngLogo) {
        return pngLogo;
      }
      
      // Fallback: Generate PNG from SVG data
      logger.info(`🔄 PNG not found, generating from SVG for ${symbol}...`);
      const svgLogo = await this.generatePngFromSvg(symbol);
      if (svgLogo) {
        return svgLogo;
      }
      
      logger.warn(`⚠️  No PNG or SVG logo available for ${symbol}`);
      return null;
      
    } catch (error) {
      logger.error(`❌ Error getting logo for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Try to get PNG logo from server directory
   */
  async tryGetPngFromDirectory(symbol) {
    try {
      const normalizedSymbol = symbol.toUpperCase();
      
      // Multiple filename patterns for maximum compatibility
      const possibleFiles = [
        `${normalizedSymbol}.png`,
        `${symbol.toLowerCase()}.png`, 
        `${symbol}.png`,
        // Handle special cases
        ...(normalizedSymbol === 'IMMUTABLE' ? ['IMX.png'] : []),
        ...(normalizedSymbol === 'IMX' ? ['IMMUTABLE.png'] : []),
        ...(normalizedSymbol === 'RIPPLE' ? ['XRP.png'] : []),
        ...(normalizedSymbol === 'XRP' ? ['Ripple.png'] : [])
      ];
      
      for (const filename of possibleFiles) {
        const logoPath = path.join(this.pngLogoDir, filename);
        try {
          await fs.access(logoPath);
          const logoBuffer = await fs.readFile(logoPath);
          const stats = await fs.stat(logoPath);
          
          logger.info(`🎯 Found PNG logo for ${symbol}: ${filename} (${(stats.size / 1024).toFixed(1)}KB)`);
          
          return {
            buffer: logoBuffer,
            path: logoPath,
            filename,
            symbol: normalizedSymbol,
            size: stats.size,
            source: 'png_file'
          };
        } catch (error) {
          // Continue to next possible filename
        }
      }
      
      return null;
    } catch (error) {
      logger.error(`❌ Error loading PNG from directory for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Generate PNG from SVG data as fallback
   */
  async generatePngFromSvg(symbol) {
    try {
      // Get SVG logo data from database
      const logoData = await this.svgLogoService.getSvgLogoInfo(symbol.toUpperCase());
      if (!logoData || !logoData.svgContent) {
        logger.info(`📭 No SVG data found for ${symbol}`);
        return null;
      }
      
      logger.info(`🔄 Converting SVG to PNG for ${symbol}...`);
      
      // Convert SVG to PNG using Sharp
      const svgBuffer = Buffer.from(logoData.svgContent);
      
      const pngBuffer = await sharp(svgBuffer)
        .png({ quality: 100 })
        .resize(1024, 1024, { 
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
        })
        .toBuffer();
      
      logger.info(`✅ Generated PNG from SVG for ${symbol} (${(pngBuffer.length / 1024).toFixed(1)}KB)`);
      
      return {
        buffer: pngBuffer,
        filename: `${symbol}.png`,
        symbol: symbol.toUpperCase(),
        size: pngBuffer.length,
        source: 'svg_converted'
      };
      
    } catch (error) {
      logger.error(`❌ Error generating PNG from SVG for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * NEW: Process PNG logo for optimal ControlNet input 
   * - Convert to high-contrast for Canny edge detection
   * - Optimize resolution for ControlNet processing
   * - Apply preprocessing based on 2024 best practices
   */
  async preprocessPngForControlNet(logoBuffer, targetSize = 1024) {
    try {
      // Step 1: Get original image metadata
      const metadata = await sharp(logoBuffer).metadata();
      logger.info(`🎯 Preprocessing PNG: ${metadata.width}x${metadata.height} → ${targetSize}x${targetSize}`);
      
      // Step 2: CREATE ABSTRACT POSITIONING GUIDE (not literal logo shape)
      const processedLogo = await sharp(logoBuffer)
        .resize(targetSize, targetSize, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 1 }, // BLACK background = far depth
          withoutEnlargement: false
        })
        // Convert to grayscale for depth processing  
        .grayscale()
        // ABSTRACT GUIDANCE: Create soft positioning area, not exact shape
        .linear(1.2, 30) // Gentler brightening
        .blur(8)         // MUCH more blur to abstract the shape
        .resize(targetSize, targetSize, { // Resize again to ensure consistency
          fit: 'fill',
          kernel: 'cubic'
        })
        // Create soft gradient center instead of hard logo edges
        .modulate({ brightness: 0.8, saturation: 0 })
        // Normalize for smooth positioning guidance
        .normalise()
        // Output as abstract positioning guide
        .png({ 
          quality: 100, 
          compressionLevel: 0,
          palette: false
        })
        .toBuffer();
        
      logger.info(`✅ ABSTRACT POSITIONING GUIDE created: ${targetSize}x${targetSize}, soft guidance for 3D placement`);
      return processedLogo;
      
    } catch (error) {
      logger.error('❌ Error preprocessing PNG for ControlNet:', error.message);
      throw error;
    }
  }

  /**
   * REVOLUTIONARY: Two-Stage Depth-Aware ControlNet Generation
   * Stage 1: Generate high-quality 3D environment
   * Stage 2: Integrate logo using depth-aware ControlNet
   */
  async generateWithAdvancedControlNet(title, logoSymbol, style = 'holographic', options = {}) {
    try {
      const startTime = Date.now();
      const imageId = this.generateImageId();
      
      logger.info(`🚀 REVOLUTIONARY Two-Stage Generation: ${logoSymbol} with ${style} style`);
      
      // STAGE 1: Generate Environment
      const environmentResult = await this.generateEnvironmentStage(style, options);
      logger.info(`✅ Stage 1 Complete: Environment generated`);
      
      // STAGE 2: Integrate Logo with Depth Awareness
      const logoResult = await this.integrateLogoStage(environmentResult, logoSymbol, style, imageId, options);
      logger.info(`✅ Stage 2 Complete: Logo integrated with depth awareness`);
      
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      logger.info(`🚀 REVOLUTIONARY Generation completed in ${totalTime}s for ${logoSymbol}`);
      
      return {
        success: true,
        imageId,
        imageUrl: this.getImageUrl(imageId),
        localPath: logoResult.localPath,
        metadata: {
          method: 'revolutionary_two_stage_depth_aware',
          logoSymbol,
          style,
          stage1: environmentResult.metadata,
          stage2: logoResult.metadata,
          totalProcessingTime: totalTime,
          improvements: [
            'two_stage_generation',
            'depth_aware_logo_integration', 
            'perspective_correct_placement',
            'environmental_interaction',
            'cinematic_quality_scenes'
          ]
        }
      };
      
    } catch (error) {
      logger.error(`❌ REVOLUTIONARY Generation failed:`, error);
      throw error;
    }
  }

  /**
   * NEW: Generate precise logo image using PNG + ControlNet with optimal 2024 settings
   * This is the LEGACY method - kept for compatibility
   */
  async generateWithPngControlNet(title, logoSymbol, style = 'holographic', options = {}) {
    try {
      const startTime = Date.now();
      const imageId = this.generateImageId();
      
      logger.info(`🎯 Starting PNG ControlNet generation for ${logoSymbol} with ${style} style`);
      
      // Step 1: Get PNG logo
      const logoData = await this.getPngLogo(logoSymbol);
      if (!logoData) {
        throw new Error(`No PNG logo found for ${logoSymbol}`);
      }
      
      // Step 2: Preprocess logo for optimal ControlNet
      const controlImage = await this.preprocessPngForControlNet(logoData.buffer, this.optimalSettings.width);
      
      // Step 3: Get style template
      const styleTemplate = this.styleTemplates[style] || this.styleTemplates.holographic;
      
      // Step 4: Build enhanced prompt with logo-specific terms
      const enhancedPrompt = this.buildPngControlNetPrompt(title, logoSymbol, styleTemplate, options);
      
      // Step 5: Generate using optimal ControlNet settings
      const result = await this.callOptimalControlNetAPI({
        prompt: enhancedPrompt,
        negative_prompt: styleTemplate.negative_prompt + `, wrong ${logoSymbol} logo, incorrect cryptocurrency symbol, different coin`,
        control_image: controlImage.toString('base64'),
        logoSymbol,
        imageId,
        style,
        options
      });
      
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      logger.info(`🎯 PNG ControlNet generation completed in ${totalTime}s for ${logoSymbol}`);
      
      return {
        success: true,
        imageId,
        imageUrl: this.getImageUrl(imageId),
        localPath: result.localPath,
        metadata: {
          method: 'png_controlnet_2024',
          logoSymbol,
          style,
          prompt: enhancedPrompt,
          settings: this.optimalSettings,
          processingTime: totalTime,
          logoSource: 'png_file',
          logoFile: logoData.filename,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error(`❌ PNG ControlNet generation failed for ${logoSymbol}:`, error.message);
      throw error;
    }
  }

  /**
   * NEW: Build optimized prompt for PNG ControlNet generation
   */
  buildPngControlNetPrompt(title, logoSymbol, styleTemplate, options = {}) {
    // REVOLUTIONARY: Build CINEMATIC QUALITY prompts matching your XRP reference images
    const style = styleTemplate.style || 'holographic';
    
    let prompt = '';
    
    // Generate prompts that describe logo as 3D SCENE GEOMETRY
    switch (style) {
      case 'holographic':
        // Like your xrp3.jpg - floating 3D logo in futuristic environment
        prompt = `massive 3D floating ${logoSymbol} cryptocurrency logo suspended in futuristic digital environment, holographic data streams flowing around logo, neon grid floor with cyan and blue lighting, atmospheric fog, digital rain effects, cyberpunk aesthetic, the ${logoSymbol} symbol glowing with internal light, metallic chrome finish with rainbow reflections, floating in zero gravity, surrounded by flowing data particles`;
        break;
        
      case 'metallic':
        // Like your xrp4.jpg - physical 3D coin with trading background
        prompt = `ultra-realistic 3D ${logoSymbol} cryptocurrency coin, heavy metallic coin with detailed ${logoSymbol} symbol etched deep into surface, sitting on reflective surface in front of dynamic trading charts, candlestick patterns in background, professional studio lighting, the coin has weight and substance, detailed metal texture, chrome and silver finish, depth of field, trading floor environment`;
        break;
        
      case 'neon':
        // 3D neon logo in urban environment
        prompt = `glowing 3D ${logoSymbol} cryptocurrency logo made of bright neon tubes, floating in cyberpunk cityscape, electric blue and purple lighting, the logo constructed from actual neon glass tubes, sparking electricity effects, urban tech environment, holographic displays in background, rain-soaked streets reflecting neon light`;
        break;
        
      case 'artistic':
        // Abstract 3D artistic interpretation
        prompt = `artistic 3D ${logoSymbol} cryptocurrency symbol rendered as sculptural art piece, geometric abstract composition, the logo emerging from flowing liquid metal, dramatic studio lighting, artistic interpretation of ${logoSymbol} symbol integrated into abstract geometric shapes, premium art gallery presentation, sophisticated color palette`;
        break;
        
      case 'professional':
        // Clean professional 3D presentation
        prompt = `premium 3D ${logoSymbol} cryptocurrency logo floating in minimalist professional environment, clean corporate presentation, the ${logoSymbol} symbol rendered in polished metal with subtle lighting, floating above clean geometric platform, professional photography, high-end brand presentation, subtle shadows and reflections`;
        break;
        
      default:
        // Default to holographic style
        prompt = `massive 3D floating ${logoSymbol} cryptocurrency logo in futuristic digital environment, holographic effects, the logo suspended in space with internal glow, surrounded by data streams and digital particles, cyberpunk lighting, atmospheric depth`;
    }
    
    // Add environmental context based on article title
    if (title.toLowerCase().includes('trading') || title.toLowerCase().includes('market')) {
      prompt += ', trading charts and financial data in background, professional trading floor atmosphere';
    } else if (title.toLowerCase().includes('payment') || title.toLowerCase().includes('transaction')) {
      prompt += ', digital payment flow visualization, transaction streams, financial technology environment';
    } else if (title.toLowerCase().includes('breakthrough') || title.toLowerCase().includes('technology')) {
      prompt += ', advanced technology showcase, innovation presentation, cutting-edge tech environment';
    }
    
    // CINEMATIC QUALITY requirements
    prompt += ', cinematic composition, professional photography, ultra-realistic rendering, 8k resolution, dramatic lighting with depth and atmosphere, photorealistic materials, high dynamic range, studio quality, absolutely no flat overlays or 2D elements';
    prompt += ', absolutely no text, no words, no letters, no typography, pure visual symbol only';
    
    logger.info(`🎯 PNG ControlNet prompt built: "${prompt.substring(0, 80)}..."`);
    return prompt;
  }

  /**
   * Call SDXL ControlNet API with optimal 2024 settings
   * Uses RunPod SDXL + ControlNet for precise logo control
   */
  async callOptimalControlNetAPI(payload) {
    try {
      logger.info('🎯 Calling SDXL ControlNet with optimal 2024 settings...');
      logger.info(`   📊 Logo Symbol: ${payload.logoSymbol}`);
      logger.info(`   📊 Control Weight: ${this.optimalSettings.controlnet_conditioning_scale}`);
      logger.info(`   📊 Guidance Scale: ${this.optimalSettings.guidance_scale}`);
      logger.info(`   📊 Model: SDXL + ControlNet Canny`);
      
      // Use RunPod SDXL ControlNet instead of Wavespeed
      const result = await this.generateWithRunPodSDXLControlNet(payload);
      return result;
      
    } catch (error) {
      logger.error('❌ SDXL ControlNet generation failed:', error.message);
      // Fallback to direct generation if SDXL fails
      logger.info('🔄 Falling back to direct PNG generation...');
      return await this.generateDirectPngImage(payload);
    }
  }

  /**
   * Generate image using RunPod SDXL + ControlNet
   */
  async generateWithRunPodSDXLControlNet(payload) {
    try {
      const runpodApiKey = process.env.RUNPOD_API_KEY;
      if (!runpodApiKey) {
        throw new Error('RUNPOD_API_KEY not configured');
      }

      logger.info('📤 Submitting SDXL ControlNet job to RunPod...');

      // RunPod ControlNet API call - matching existing endpoint format
      const runpodPayload = {
        input: {
          prompt: payload.prompt,
          negative_prompt: payload.negative_prompt || `low quality, blurry, distorted, wrong logo, incorrect symbol, wrong ${payload.logoSymbol} logo, different cryptocurrency`,
          title: `${payload.logoSymbol} ControlNet Generation`,
          
          // Standard dimensions
          width: 1800,
          height: 900,
          
          // Enhanced parameters for ControlNet precision
          num_inference_steps: this.optimalSettings.steps,
          guidance_scale: 12.0, // Higher for ControlNet accuracy
          cfg_scale: 12.0,
          
          // ControlNet specific parameters
          controlnet_conditioning_scale: this.optimalSettings.controlnet_conditioning_scale,
          control_guidance_start: this.optimalSettings.control_guidance_start,
          control_guidance_end: this.optimalSettings.control_guidance_end,
          
          // Control image as base64 string
          control_image: payload.control_image,
          controlnet_model: "canny",
          
          // Quality settings
          strength: 1.0,
          seed: payload.options?.seed || Math.floor(Math.random() * 1000000)
        }
      };

      // Submit job to RunPod (async pattern)
      const submitResponse = await axios.post('https://api.runpod.ai/v2/fnj041fg4ox7sn/run', runpodPayload, {
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${runpodApiKey}`,
          'Accept': 'application/json'
        }
      });

      if (!submitResponse.data.id) {
        throw new Error('No job ID received from RunPod ControlNet');
      }

      const jobId = submitResponse.data.id;
      logger.info(`✅ ControlNet job submitted to RunPod, ID: ${jobId}`);

      // Poll for completion using existing method
      const runpodLoraService = require('./runpodLoraService');
      const loraService = new runpodLoraService();
      const result = await loraService.pollRunPodJob(jobId);

      if (!result || !result.image_url) {
        throw new Error('No image URL received from RunPod ControlNet');
      }

      // Download and process the generated image
      logger.info(`⬇️ Downloading ControlNet image from: ${result.image_url}`);
      const imageResponse = await axios.get(result.image_url, {
        responseType: 'arraybuffer',
        timeout: 60000
      });

      // Save temporary image
      const tempImagePath = path.join(this.imageStorePath, `${payload.imageId}_temp.png`);
      await fs.writeFile(tempImagePath, imageResponse.data);
      
      // Resize to standard format (1800x900)
      const imagePath = path.join(this.imageStorePath, `${payload.imageId}.png`);
      
      const metadata = await sharp(tempImagePath).metadata();
      logger.info(`📏 RunPod ControlNet dimensions: ${metadata.width}x${metadata.height}`);
      
      if (metadata.width === 1800 && metadata.height === 900) {
        // Already correct size
        await sharp(tempImagePath).png().toFile(imagePath);
      } else {
        // Resize to 1800x900
        await sharp(tempImagePath)
          .resize(1800, 900, { fit: 'cover' })
          .png()
          .toFile(imagePath);
      }

      // Apply watermark
      await this.watermarkService.addWatermark(
        imagePath,
        imagePath,
        { title: `${payload.logoSymbol} ControlNet` }
      );

      // Clean up temp file
      try {
        await fs.unlink(tempImagePath);
      } catch (cleanupError) {
        logger.warn(`⚠️ Failed to clean up temp file: ${cleanupError.message}`);
      }

      logger.info(`✅ RunPod ControlNet generation completed for ${payload.logoSymbol}`);
      
      return { localPath: imagePath };
      
    } catch (error) {
      logger.error('❌ RunPod SDXL ControlNet failed:', error.message);
      throw error;
    }
  }

  /**
   * Direct PNG-based image generation as fallback
   */
  async generateDirectPngImage(payload) {
    try {
      const { logoSymbol, imageId, style } = payload;
      
      // Create a professional image with the PNG logo
      const logoData = await this.getPngLogo(logoSymbol);
      if (!logoData) {
        throw new Error(`No logo available for ${logoSymbol}`);
      }

      logger.info(`🎨 Creating professional image for ${logoSymbol} with ${style} style`);
      
      // Create a styled background and composite the logo
      const backgroundImage = await this.createStyledBackground(style);
      const finalImageBuffer = await this.compositeLogo(backgroundImage, logoData.buffer, logoSymbol);
      
      // Save buffer to temp file first
      const tempImagePath = path.join(this.imageStorePath, `${imageId}_temp.png`);
      await fs.writeFile(tempImagePath, finalImageBuffer);
      
      // Apply watermark (now with proper file path)
      const finalImagePath = path.join(this.imageStorePath, `${imageId}.png`);
      await this.watermarkService.addWatermark(
        tempImagePath, 
        finalImagePath,
        { title: `${logoSymbol} Professional Cover` }
      );
      
      // Clean up temp file
      try {
        await fs.unlink(tempImagePath);
      } catch (cleanupError) {
        logger.warn(`⚠️ Failed to clean up temp file: ${cleanupError.message}`);
      }
      
      return { 
        localPath: finalImagePath
      };
      
    } catch (error) {
      logger.error('❌ Direct PNG generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Create styled background for different styles
   */
  async createStyledBackground(style = 'holographic') {
    const width = 1800;
    const height = 900;
    
    let backgroundSvg;
    
    switch (style) {
      case 'holographic':
        backgroundSvg = `
          <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="holo" cx="50%" cy="50%" r="50%">
                <stop offset="0%" style="stop-color:#ff6b6b;stop-opacity:0.8"/>
                <stop offset="25%" style="stop-color:#4ecdc4;stop-opacity:0.6"/>
                <stop offset="50%" style="stop-color:#45b7d1;stop-opacity:0.4"/>
                <stop offset="75%" style="stop-color:#96ceb4;stop-opacity:0.6"/>
                <stop offset="100%" style="stop-color:#ffeaa7;stop-opacity:0.8"/>
              </radialGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#holo)"/>
          </svg>
        `;
        break;
      case 'minimal':
        backgroundSvg = `
          <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="minimal" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#667eea;stop-opacity:0.8"/>
                <stop offset="100%" style="stop-color:#764ba2;stop-opacity:0.8"/>
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#minimal)"/>
          </svg>
        `;
        break;
      case 'cyberpunk':
        backgroundSvg = `
          <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="cyber" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#0f0f0f;stop-opacity:1"/>
                <stop offset="50%" style="stop-color:#1a0033;stop-opacity:1"/>
                <stop offset="100%" style="stop-color:#000000;stop-opacity:1"/>
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#cyber)"/>
          </svg>
        `;
        break;
      default:
        backgroundSvg = `
          <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#2c3e50"/>
          </svg>
        `;
    }
    
    return await sharp(Buffer.from(backgroundSvg))
      .png()
      .toBuffer();
  }

  /**
   * Composite logo onto background
   */
  async compositeLogo(backgroundBuffer, logoBuffer, logoSymbol) {
    const logoSize = 300; // Logo size in pixels
    
    // Resize logo to fit properly
    const resizedLogo = await sharp(logoBuffer)
      .resize(logoSize, logoSize, { 
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();
    
    // Composite logo in center of background
    const finalImage = await sharp(backgroundBuffer)
      .composite([{
        input: resizedLogo,
        top: Math.round((900 - logoSize) / 2),
        left: Math.round((1800 - logoSize) / 2)
      }])
      .png()
      .toBuffer();
    
    logger.info(`✅ Composited ${logoSymbol} logo onto styled background`);
    return finalImage;
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
      let mathematicalDescription = `MATHEMATICAL VECTOR SPECIFICATION for XRP logo: `;
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
      let constraintReinforcement = ` MATHEMATICAL PRECISION ENFORCEMENT: `;
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

      // SIMPLIFIED: Skip complex prompt injection for now to test basic ControlNet
      // TODO: Re-enable nuclear SVG injection once basic system is working
      // if (detected === 'HBAR' || detected === 'XRP') {
      //   prompt = this.injectNuclearSVGGuidance(prompt, detected);
      // }

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

      // SIMPLIFIED: Skip complex prompt injection for now to test basic ControlNet
      // TODO: Re-enable nuclear SVG injection once basic system is working
      // if (detected === 'HBAR' || detected === 'XRP') {
      //   prompt = this.injectNuclearSVGGuidance(prompt, detected);
      // }

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
   * Test ControlNet service with a specific cryptocurrency (legacy SVG method)
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

  /**
   * NEW: Test PNG ControlNet generation with optimal 2024 settings
   */
  async testPngControlNet(symbol = 'XRP', style = 'holographic') {
    try {
      logger.info(`🧪 Testing PNG ControlNet with ${symbol} (${style} style)...`);
      
      // Step 1: Check if PNG logo exists
      const logoData = await this.getPngLogo(symbol);
      if (!logoData) {
        return {
          success: false,
          error: `No PNG logo found for ${symbol}`,
          checkedDirectory: this.pngLogoDir
        };
      }
      
      // Step 2: Test preprocessing
      logger.info(`🎯 Testing PNG preprocessing for ${symbol}...`);
      const preprocessed = await this.preprocessPngForControlNet(logoData.buffer);
      
      // Step 3: Test full generation
      const testTitle = `Professional ${symbol.toUpperCase()} Market Analysis and Technical Outlook`;
      const result = await this.generateWithPngControlNet(testTitle, symbol, style, {
        test: true,
        seed: 123456 // Fixed seed for consistent testing
      });
      
      logger.info(`🎯 PNG ControlNet test successful for ${symbol}`);
      
      return {
        success: true,
        test: true,
        method: 'png_controlnet_2024',
        symbol,
        style,
        logoFile: logoData.filename,
        logoSize: `${(logoData.size / 1024).toFixed(1)}KB`,
        preprocessedSize: `${preprocessed.length} bytes`,
        settings: this.optimalSettings,
        result
      };
      
    } catch (error) {
      logger.error(`❌ PNG ControlNet test failed for ${symbol}:`, error.message);
      return {
        success: false,
        error: error.message,
        symbol,
        style
      };
    }
  }

  /**
   * NEW: List available PNG logos for testing and verification
   */
  async listAvailablePngLogos() {
    try {
      const files = await fs.readdir(this.pngLogoDir);
      const pngFiles = files.filter(file => file.toLowerCase().endsWith('.png'));
      
      const logoInfo = await Promise.all(
        pngFiles.map(async (filename) => {
          try {
            const logoPath = path.join(this.pngLogoDir, filename);
            const stats = await fs.stat(logoPath);
            const symbol = filename.replace('.png', '').toUpperCase();
            
            return {
              symbol,
              filename,
              size: `${(stats.size / 1024).toFixed(1)}KB`,
              path: logoPath
            };
          } catch (error) {
            return {
              filename,
              error: error.message
            };
          }
        })
      );
      
      logger.info(`📁 Found ${pngFiles.length} PNG logos in ${this.pngLogoDir}`);
      
      return {
        success: true,
        directory: this.pngLogoDir,
        totalLogos: pngFiles.length,
        logos: logoInfo.sort((a, b) => a.symbol?.localeCompare(b.symbol) || a.filename.localeCompare(b.filename))
      };
      
    } catch (error) {
      logger.error(`❌ Error listing PNG logos:`, error.message);
      return {
        success: false,
        error: error.message,
        directory: this.pngLogoDir
      };
    }
  }

  /**
   * STAGE 1: Generate High-Quality 3D Environment
   */
  async generateEnvironmentStage(style, options = {}) {
    try {
      const styleTemplate = this.styleTemplates[style] || this.styleTemplates.holographic;
      const stage1Settings = this.optimalSettings.stage1;
      
      logger.info(`🎬 Stage 1: Generating ${style} environment...`);
      
      // Call RunPod for environment generation (no ControlNet)
      const environmentPrompt = styleTemplate.environmentPrompt;
      const negativePrompt = styleTemplate.negative_prompt;
      
      const result = await this.callRunPodEnvironmentGeneration({
        prompt: environmentPrompt,
        negative_prompt: negativePrompt,
        ...stage1Settings
      });
      
      return {
        success: true,
        environmentImage: result.image_base64,
        metadata: {
          prompt: environmentPrompt,
          settings: stage1Settings,
          processingTime: result.processing_time || 0
        }
      };
      
    } catch (error) {
      logger.error('❌ Stage 1 Environment Generation failed:', error);
      throw error;
    }
  }

  /**
   * STAGE 2: Integrate Logo with Depth Awareness
   */
  async integrateLogoStage(environmentResult, logoSymbol, style, imageId, options = {}) {
    try {
      logger.info(`🔗 Stage 2: Integrating ${logoSymbol} logo with depth awareness...`);
      
      const styleTemplate = this.styleTemplates[style] || this.styleTemplates.holographic;
      const stage2Settings = this.optimalSettings.stage2;
      
      // Get logo PNG for depth control
      const logoData = await this.getPngLogo(logoSymbol);
      if (!logoData) {
        throw new Error(`No PNG logo found for ${logoSymbol}`);
      }
      
      // Generate depth map from environment
      const depthMap = await this.generateDepthMapFromImage(environmentResult.environmentImage);
      
      // Create logo integration prompt
      const logoPrompt = `${styleTemplate.logoIntegration}, specifically ${logoSymbol} cryptocurrency symbol, ${logoSymbol} logo accuracy is critical`;
      const negativePrompt = styleTemplate.negative_prompt + `, wrong ${logoSymbol} logo, incorrect ${logoSymbol} symbol`;
      
      // Call RunPod for depth-aware integration
      const result = await this.callRunPodDepthControlNet({
        base_image: environmentResult.environmentImage,
        depth_map: depthMap,
        logo_control_image: logoData.buffer.toString('base64'),
        prompt: logoPrompt,
        negative_prompt: negativePrompt,
        ...stage2Settings,
        logoSymbol,
        imageId
      });
      
      return {
        success: true,
        localPath: result.localPath,
        metadata: {
          method: 'depth_aware_logo_integration',
          logoSymbol,
          prompt: logoPrompt,
          settings: stage2Settings,
          processingTime: result.processing_time || 0
        }
      };
      
    } catch (error) {
      logger.error('❌ Stage 2 Logo Integration failed:', error);
      throw error;
    }
  }

  /**
   * Generate depth map from environment image
   */
  async generateDepthMapFromImage(imageBase64) {
    try {
      logger.info('📐 Generating depth map from environment image...');
      
      // Convert base64 to buffer
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      
      // Use MiDaS depth estimation via RunPod
      const depthResult = await this.callRunPodDepthEstimation({
        image: imageBase64,
        method: 'midas'
      });
      
      return depthResult.depth_map;
      
    } catch (error) {
      logger.error('❌ Depth map generation failed:', error);
      
      // Fallback: Create basic depth gradient
      const gradientDepth = await this.createDepthGradient(1600, 900);
      return gradientDepth.toString('base64');
    }
  }

  /**
   * Create basic depth gradient as fallback
   */
  async createDepthGradient(width, height) {
    try {
      // Create a simple depth gradient from top to bottom
      const canvas = await sharp({
        create: {
          width,
          height,
          channels: 1,
          background: { r: 128, g: 128, b: 128, alpha: 1 }
        }
      })
      .png()
      .toBuffer();
      
      return canvas;
    } catch (error) {
      logger.error('❌ Failed to create depth gradient:', error);
      throw error;
    }
  }

  /**
   * Call RunPod for environment generation
   */
  async callRunPodEnvironmentGeneration(params) {
    try {
      const runpodUrl = process.env.RUNPOD_ENDPOINT_URL;
      const apiKey = process.env.RUNPOD_API_KEY;
      
      if (!runpodUrl || !apiKey) {
        throw new Error('RunPod configuration missing');
      }
      
      const response = await axios.post(runpodUrl, {
        input: {
          method: 'environment_generation',
          prompt: params.prompt,
          negative_prompt: params.negative_prompt,
          steps: params.steps,
          guidance_scale: params.guidance_scale,
          width: params.width,
          height: params.height,
          scheduler: params.scheduler
        }
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      });
      
      return response.data.output;
      
    } catch (error) {
      logger.error('❌ RunPod environment generation failed:', error);
      throw error;
    }
  }

  /**
   * Call RunPod for depth-aware ControlNet integration
   */
  async callRunPodDepthControlNet(params) {
    try {
      const runpodUrl = process.env.RUNPOD_ENDPOINT_URL;
      const apiKey = process.env.RUNPOD_API_KEY;
      
      if (!runpodUrl || !apiKey) {
        throw new Error('RunPod configuration missing');
      }
      
      const response = await axios.post(runpodUrl, {
        input: {
          method: 'depth_controlnet_integration',
          base_image: params.base_image,
          depth_map: params.depth_map,
          logo_control_image: params.logo_control_image,
          prompt: params.prompt,
          negative_prompt: params.negative_prompt,
          steps: params.steps,
          guidance_scale: params.guidance_scale,
          controlnet_conditioning_scale: params.controlnet_conditioning_scale,
          control_guidance_start: params.control_guidance_start,
          control_guidance_end: params.control_guidance_end,
          strength: params.strength,
          width: params.width,
          height: params.height,
          scheduler: params.scheduler
        }
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      });
      
      // Save the result
      const imageBuffer = Buffer.from(response.data.output.image, 'base64');
      const filename = `${params.imageId}.png`;
      const localPath = path.join(this.imageStorePath, filename);
      
      await fs.writeFile(localPath, imageBuffer);
      
      // Apply watermark
      const watermarkedPath = await this.watermarkService.addWatermarkAndTitle(
        localPath,
        'Professional Cryptocurrency Analysis', 
        params.logoSymbol
      );
      
      return {
        localPath: watermarkedPath,
        processing_time: response.data.output.processing_time || 0
      };
      
    } catch (error) {
      logger.error('❌ RunPod depth ControlNet failed:', error);
      throw error;
    }
  }

  /**
   * Call RunPod for depth estimation
   */
  async callRunPodDepthEstimation(params) {
    try {
      const runpodUrl = process.env.RUNPOD_ENDPOINT_URL;
      const apiKey = process.env.RUNPOD_API_KEY;
      
      const response = await axios.post(runpodUrl, {
        input: {
          method: 'depth_estimation',
          image: params.image,
          depth_method: params.method
        }
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      });
      
      return response.data.output;
      
    } catch (error) {
      logger.error('❌ RunPod depth estimation failed:', error);
      throw error;
    }
  }
}

module.exports = ControlNetService;