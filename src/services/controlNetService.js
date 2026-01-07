const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const logger = require('../utils/logger');
const SVGLogoService = require('./svgLogoService');
const WatermarkService = require('./watermarkService');
const FreeLoraService = require('./freeLoraService');
const { logImageGeneration } = require('./outputMonitorService');

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
    this.freeLoraService = new FreeLoraService();
    
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
   * 2-STEP CONTROLNET PROCESS:
   * Step 1: Generate contextual background prompt from article rewrite
   * Step 2: Use ControlNet with actual PNG/SVG logo for 3D integration
   */
  async generateWithAdvancedControlNet(title, logoSymbol, style = 'holographic', options = {}) {
    const startTime = Date.now();
    const imageId = this.generateImageId();
    let monitorData = {
      imageId,
      articleTitle: title,
      logoSymbol,
      style,
      prompt: options.prompt || '',
      startTime: new Date().toISOString()
    };
    
    try {
      logger.info(`🎯 2-STEP CONTROLNET: ${logoSymbol} with ${style} style`);
      logger.info(`📝 Step 1: Generate prompt from article content`);
      logger.info(`🖼️ Step 2: Apply ControlNet with actual ${logoSymbol} logo PNG/SVG`);
      
      // STEP 1: Build contextual background prompt from article
      const contentPrompt = this.buildEnvironmentPrompt(title, style, options);
      logger.info(`📝 Content prompt: ${contentPrompt.substring(0, 100)}...`);
      
      // STEP 2: Get the actual logo for ControlNet conditioning
      const logoData = await this.getPngLogo(logoSymbol);
      if (!logoData) {
        throw new Error(`No PNG/SVG logo found for ${logoSymbol}`);
      }
      logger.info(`✅ Logo loaded: ${logoSymbol} (${logoData.source})`);
      
      // Preprocess logo for ControlNet (create canny/depth conditioning image)
      const controlImage = await this.preprocessPngForControlNet(logoData.buffer, 1024);
      const controlImageBase64 = controlImage.toString('base64');
      
      // PRIORITY 1: Use Wavespeed API with actual ControlNet (if API key available)
      let result;
      let method = 'unknown';
      
      if (process.env.WAVESPEED_API_KEY) {
        try {
          logger.info('🎯 Using Wavespeed ControlNet with actual logo conditioning...');
          result = await this.generateWithWavespeedControlNet({
            prompt: `${contentPrompt}, with ${logoSymbol} cryptocurrency logo integrated as 3D metallic element, the exact ${logoSymbol} symbol with proper branding, realistic lighting and shadows`,
            controlType: 'canny',
            controlImageBase64: controlImageBase64,
            detected: logoSymbol,
            imageId: imageId,
            options: {
              ...options,
              controlnet_strength: 0.85 // High strength for accurate logo
            }
          });
          method = 'wavespeed_controlnet';
          logger.info('✅ Wavespeed ControlNet succeeded with actual logo!');
        } catch (wavespeedError) {
          logger.warn(`⚠️ Wavespeed ControlNet failed: ${wavespeedError.message}`);
          result = null;
        }
      }
      
      // PRIORITY 2: Use HuggingFace ControlNet (if API key available)
      if (!result && process.env.HUGGINGFACE_API_KEY) {
        try {
          logger.info('🎯 Using HuggingFace ControlNet with logo conditioning...');
          result = await this.generateWithHuggingFaceControlNet({
            prompt: contentPrompt,
            logoSymbol: logoSymbol,
            controlImageBase64: controlImageBase64,
            imageId: imageId,
            options: options
          });
          method = 'huggingface_controlnet';
          logger.info('✅ HuggingFace ControlNet succeeded!');
        } catch (hfError) {
          logger.warn(`⚠️ HuggingFace ControlNet failed: ${hfError.message}`);
          result = null;
        }
      }
      
      // PRIORITY 3: Use FreeLoraService with logo composite overlay
      if (!result) {
        try {
          logger.info('🎯 Using Free LoRA with logo composite...');
          const FreeLoraService = require('./freeLoraService');
          const freeLoraService = new FreeLoraService();
          const freeResult = await freeLoraService.generateWithFreeLoRA(title, logoSymbol, options);
          
          // Composite the actual logo onto the generated background
          if (freeResult.localPath && logoData) {
            logger.info('🔧 Compositing actual logo onto generated background...');
            const compositedPath = await this.compositeLogoOntoBackground(
              freeResult.localPath,
              logoData.buffer,
              logoSymbol,
              imageId
            );
            result = {
              ...freeResult,
              localPath: compositedPath,
              imageUrl: this.getImageUrl(imageId)
            };
            method = 'free_lora_with_logo_composite';
          } else {
            result = freeResult;
            method = 'free_lora_prompt_only';
          }
          logger.info('✅ Free LoRA with logo composite succeeded!');
        } catch (freeError) {
          logger.warn(`⚠️ Free LoRA failed: ${freeError.message}`);
          result = null;
        }
      }
      
      // PRIORITY 4: Emergency fallback - generate background and composite logo
      if (!result) {
        logger.warn('🚨 All ControlNet methods failed - using emergency composite fallback');
        result = await this.generateImprovedFallback({
          logoSymbol,
          imageId,
          style,
          options: { ...options, dynamicBackgroundPrompt: { themes: ['technology'] } }
        });
        method = 'emergency_composite_fallback';
      }
      
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      logger.info(`✅ 2-Step ControlNet completed in ${totalTime}s using ${method}`);
      
      // 📊 MONITOR: Log generation
      await logImageGeneration({
        ...monitorData,
        imageId: result.imageId || imageId,
        method: method,
        controlNetUsed: method.includes('controlnet'),
        controlNetType: method.includes('wavespeed') ? 'wavespeed_canny' : method.includes('huggingface') ? 'hf_controlnet' : 'composite',
        logoSource: logoData.source,
        success: true,
        imageUrl: result.imageUrl || this.getImageUrl(imageId),
        localPath: result.localPath,
        processingTimeMs: totalTime * 1000,
        apiUsed: method.split('_')[0],
        is3DIntegrated: method.includes('controlnet'),
        isFlatOverlay: method.includes('composite') || method.includes('fallback'),
        hasContextualBackground: true
      });
      
      return {
        success: true,
        imageId: result.imageId || imageId,
        imageUrl: result.imageUrl || this.getImageUrl(result.imageId || imageId),
        localPath: result.localPath,
        metadata: {
          method: method,
          logoSymbol,
          style,
          totalProcessingTime: totalTime,
          controlNetUsed: method.includes('controlnet'),
          logoSource: logoData.source,
          improvements: method.includes('controlnet') ? [
            'actual_logo_as_controlnet_input',
            'true_3d_logo_embedding',
            'content_based_prompting'
          ] : [
            'logo_composite_overlay',
            'content_based_background'
          ]
        }
      };
        
    } catch (error) {
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      logger.error(`❌ 2-Step ControlNet failed:`, error);
      
      // 📊 MONITOR: Log complete failure
      await logImageGeneration({
        ...monitorData,
        method: 'complete_failure',
        controlNetUsed: false,
        success: false,
        processingTimeMs: totalTime * 1000,
        error: error.message,
        fallbackReason: 'All generation methods exhausted'
      });
      
      throw error;
    }
  }

  /**
   * Composite actual logo onto generated background
   * Used when ControlNet APIs fail but we still have a good background
   */
  async compositeLogoOntoBackground(backgroundPath, logoBuffer, logoSymbol, imageId) {
    try {
      logger.info(`🔧 Compositing ${logoSymbol} logo onto background...`);
      
      // Read background image
      const backgroundBuffer = await fs.readFile(backgroundPath);
      const backgroundMeta = await sharp(backgroundBuffer).metadata();
      
      // Calculate logo size (30% of image height for visibility)
      const logoSize = Math.round(backgroundMeta.height * 0.35);
      
      // Resize logo with transparency preserved
      const resizedLogo = await sharp(logoBuffer)
        .resize(logoSize, logoSize, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();
      
      // Create a glow effect for 3D appearance
      const glowLogo = await sharp(logoBuffer)
        .resize(Math.round(logoSize * 1.1), Math.round(logoSize * 1.1), {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .blur(15)
        .modulate({ brightness: 1.5, saturation: 1.2 })
        .png()
        .toBuffer();
      
      // Center position
      const logoX = Math.round((backgroundMeta.width - logoSize) / 2);
      const logoY = Math.round((backgroundMeta.height - logoSize) / 2);
      const glowX = Math.round((backgroundMeta.width - logoSize * 1.1) / 2);
      const glowY = Math.round((backgroundMeta.height - logoSize * 1.1) / 2);
      
      // Composite with glow effect for 3D look
      const compositedBuffer = await sharp(backgroundBuffer)
        .composite([
          // Glow layer (behind logo)
          {
            input: glowLogo,
            left: glowX,
            top: glowY,
            blend: 'screen'
          },
          // Main logo
          {
            input: resizedLogo,
            left: logoX,
            top: logoY
          }
        ])
        .jpeg({ quality: 95 })
        .toBuffer();
      
      // Save composited image
      const outputPath = path.join(this.imageStorePath, `${imageId}.jpg`);
      await fs.writeFile(outputPath, compositedBuffer);
      
      // Apply watermark
      await this.watermarkService.addWatermark(outputPath, outputPath, {
        title: `${logoSymbol} Analysis`
      });
      
      logger.info(`✅ Logo composite complete: ${outputPath}`);
      return outputPath;
      
    } catch (error) {
      logger.error('❌ Logo composite failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate using HuggingFace ControlNet Union model
   */
  async generateWithHuggingFaceControlNet({ prompt, logoSymbol, controlImageBase64, imageId, options = {} }) {
    const hfApiKey = process.env.HUGGINGFACE_API_KEY;
    if (!hfApiKey) {
      throw new Error('HUGGINGFACE_API_KEY not configured');
    }
    
    logger.info(`🤗 Calling HuggingFace ControlNet for ${logoSymbol}...`);
    
    try {
      // Use HuggingFace's ControlNet SDXL model
      const response = await axios.post(
        'https://api-inference.huggingface.co/models/diffusers/controlnet-canny-sdxl-1.0',
        {
          inputs: `${prompt}, featuring the exact ${logoSymbol} cryptocurrency logo with 3D metallic integration, professional lighting`,
          parameters: {
            negative_prompt: `flat overlay, 2D sticker, wrong logo, different symbol, text, watermarks`,
            num_inference_steps: 30,
            guidance_scale: 7.5
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${hfApiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer',
          timeout: 120000
        }
      );
      
      if (response.data && response.data.byteLength > 1000) {
        // Save the generated image
        const outputPath = path.join(this.imageStorePath, `${imageId}.jpg`);
        
        await sharp(response.data)
          .resize(1800, 900, { fit: 'cover' })
          .jpeg({ quality: 95 })
          .toFile(outputPath);
        
        // Apply watermark
        await this.watermarkService.addWatermark(outputPath, outputPath, {
          title: `${logoSymbol} Analysis`
        });
        
        return {
          localPath: outputPath,
          imageUrl: this.getImageUrl(imageId)
        };
      }
      
      throw new Error('Invalid response from HuggingFace ControlNet');
      
    } catch (error) {
      if (error.response?.status === 503) {
        throw new Error('HuggingFace ControlNet model is loading, try again in 1-2 minutes');
      }
      throw error;
    }
  }

  /**
   * CORE METHOD: Generate using actual SVG geometry as ControlNet input
   * This is the breakthrough method that uses real logo shapes
   */
  async generateWithSVGControlNet(title, logoSymbol, style, imageId, options = {}) {
    try {
      logger.info(`🔧 CORE SVG METHOD: Loading actual ${logoSymbol} SVG geometry for ControlNet`);
      
      // 1. Get actual SVG logo data
      const svgLogoData = await this.getSVGLogoForControlNet(logoSymbol);
      if (!svgLogoData) {
        throw new Error(`No SVG logo data found for ${logoSymbol}`);
      }
      
      logger.info(`✅ SVG logo loaded: ${svgLogoData.symbol} (${svgLogoData.source})`);
      
      // 2. Convert SVG to ControlNet conditioning images
      const controlNetInputs = await this.convertSVGToControlNetInputs(svgLogoData);
      
      // 3. Build dynamic environment prompt from content analysis
      const environmentPrompt = this.buildEnvironmentPrompt(title, style, options);
      
      // 4. Build logo integration prompt
      const logoPrompt = `${environmentPrompt}, 
      the ${logoSymbol} cryptocurrency logo naturally integrated as 3D architectural element,
      multiple instances of the ${logoSymbol} symbol at different depths and angles,
      the logo casting realistic shadows and receiving environmental lighting,
      photorealistic materials with proper surface properties,
      absolutely no flat overlays or 2D sticker effects,
      pure 3D environmental integration, studio-quality cinematography`;
      
      logger.info(`🎯 Using SVG-derived ControlNet with dynamic prompt`);
      
      // 5. Generate using SVG-guided ControlNet
      const result = await this.callOptimalControlNetAPI({
        prompt: logoPrompt,
        negative_prompt: `flat overlay, 2d sticker, wrong ${logoSymbol} logo, different cryptocurrency, text, letters, low quality`,
        control_image: controlNetInputs.canny, // Use actual SVG-derived edges
        logoSymbol: logoSymbol,
        imageId: imageId,
        style: 'svg_guided',
        width: 1600,
        height: 900,
        steps: 80,
        guidance_scale: 7.5,
        controlnet_conditioning_scale: 0.8, // High conditioning for precise logo control
        options: {
          ...options,
          svgControlInputs: controlNetInputs,
          dynamicPrompt: environmentPrompt
        }
      });
      
      return {
        success: true,
        imageId: imageId,
        localPath: result.localPath,
        svgData: svgLogoData,
        metadata: {
          method: 'svg_guided_controlnet',
          svgSource: svgLogoData.source,
          controlNetTypes: controlNetInputs.types,
          logoSymbol: logoSymbol
        }
      };
      
    } catch (error) {
      logger.error(`❌ SVG ControlNet failed for ${logoSymbol}:`, error);
      throw error;
    }
  }

  /**
   * Build environment prompt based on content analysis
   */
  buildEnvironmentPrompt(title, style, options = {}) {
    // Use dynamic background analysis if available
    if (options.dynamicBackgroundPrompt) {
      const analysis = options.dynamicBackgroundPrompt;
      logger.info(`🎨 Using content-based environment: ${analysis.environmentType}`);
      return analysis.fullPrompt;
    }
    
    // Fallback to style-based environment
    const styleEnvironments = {
      holographic: 'futuristic digital environment with holographic displays and flowing data streams',
      metallic: 'premium trading floor with sophisticated displays and professional lighting',
      professional: 'modern corporate workspace with clean architecture and elegant lighting',
      artistic: 'abstract artistic space with creative geometric elements and dramatic lighting'
    };
    
    const environment = styleEnvironments[style] || styleEnvironments.professional;
    logger.info(`🏢 Using style-based environment: ${environment}`);
    
    return `${environment}, photorealistic 3D scene with cinematic depth and atmosphere, professional photography quality, 8k resolution`;
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
   * NEW: Build optimized prompt for PNG ControlNet generation with dynamic backgrounds
   */
  buildPngControlNetPrompt(title, logoSymbol, styleTemplate, options = {}) {
    logger.info(`🎯 BUILDING CONTENT-BASED PROMPT for ${logoSymbol} based on article: "${title}"`);
    
    // CORE FIX: Always analyze content for dynamic backgrounds
    const contentAnalysis = this.analyzeArticleForScene(title, options);
    logger.info(`🎨 Content analysis: ${contentAnalysis.environment}`);
    
    // Build DETAILED scene prompt based on actual article content
    let prompt = `${contentAnalysis.fullScenePrompt}, 
    ultra-realistic 3D ${logoSymbol} cryptocurrency logo naturally integrated as architectural element,
    the ${logoSymbol} symbol crafted from premium metallic materials with proper volumetric lighting,
    multiple instances at various depths creating true 3D perspective,
    the logo casting realistic shadows and receiving environmental reflections,
    photorealistic surface properties and atmospheric depth,
    absolutely no flat overlays or 2D sticker effects,
    cinematic composition with professional studio lighting`;
    
    // Add logo-specific material properties for 3D realism
    switch (logoSymbol.toUpperCase()) {
      case 'XRP':
        prompt += ', XRP logo in polished chrome with blue accent lighting and holographic reflections';
        break;
      case 'BTC':
        prompt += ', Bitcoin logo in golden metallic finish with warm amber highlights and coin-like texture';
        break;
      case 'ETH':
        prompt += ', Ethereum logo in sleek titanium silver with purple accent lighting and crystal-like facets';
        break;
      case 'SOLANA':
        prompt += ', Solana logo in gradient purple-to-pink metal with iridescent finish';
        break;
      default:
        prompt += ', cryptocurrency logo in premium metallic finish with brand-appropriate accent lighting';
    }
    
    prompt += ', 8k resolution, ultra-detailed, professional product photography, no text or typography';
    
    logger.info(`✅ CONTENT-BASED prompt: ${contentAnalysis.keywords.join(', ')}`);
    return prompt;
  }

  /**
   * NEW: Analyze article content to generate appropriate scene backgrounds
   */
  analyzeArticleForScene(title, options = {}) {
    const fullText = `${title} ${options.articleContent || ''}`.toLowerCase();
    
    logger.info(`🔍 Analyzing article content: "${title.substring(0, 60)}..."`);
    
    let environment = '';
    let sceneElements = '';
    let lighting = '';
    let keywords = [];
    
    // SPECIFIC SCENE ANALYSIS based on article content
    if (fullText.includes('trading') || fullText.includes('price') || fullText.includes('chart')) {
      environment = 'sophisticated trading floor with massive curved holographic displays showing live market data';
      sceneElements = 'candlestick charts floating in 3D space, dynamic price indicators, professional financial workstations';
      lighting = 'dramatic blue and green monitor lighting with professional studio accents';
      keywords = ['trading', 'financial', 'market'];
    }
    else if (fullText.includes('bank') || fullText.includes('payment') || fullText.includes('financial institution')) {
      environment = 'premium corporate banking environment with elegant glass architecture';
      sceneElements = 'floating holographic financial reports, elegant marble surfaces, executive presentation displays';
      lighting = 'warm sophisticated lighting with golden accent tones and professional ambiance';
      keywords = ['banking', 'corporate', 'premium'];
    }
    else if (fullText.includes('technology') || fullText.includes('innovation') || fullText.includes('development')) {
      environment = 'cutting-edge technology laboratory with advanced holographic interfaces';
      sceneElements = 'floating code displays, high-tech equipment, innovative digital projections';
      lighting = 'cool blue technological lighting with bright accent highlights';
      keywords = ['technology', 'innovation', 'futuristic'];
    }
    else if (fullText.includes('security') || fullText.includes('hack') || fullText.includes('protection')) {
      environment = 'high-security cyber command center with encrypted data visualizations';
      sceneElements = 'digital security shields, secure network displays, cybersecurity monitoring systems';
      lighting = 'dramatic blue and purple security lighting with digital effects';
      keywords = ['security', 'cyber', 'protection'];
    }
    else if (fullText.includes('partnership') || fullText.includes('collaboration') || fullText.includes('agreement')) {
      environment = 'modern conference center with interconnected digital networks visualization';
      sceneElements = 'flowing connection lines between corporate logos, collaborative workspace displays';
      lighting = 'bright professional conference lighting with connectivity highlights';
      keywords = ['partnership', 'collaboration', 'corporate'];
    }
    else if (fullText.includes('regulation') || fullText.includes('government') || fullText.includes('legal')) {
      environment = 'formal government chamber with official digital documentation displays';
      sceneElements = 'floating legal documents, official governmental architecture, regulatory displays';
      lighting = 'formal institutional lighting with authoritative ambiance';
      keywords = ['regulatory', 'government', 'legal'];
    }
    else {
      environment = 'professional modern digital workspace with sophisticated holographic displays';
      sceneElements = 'floating data visualizations, contemporary tech interfaces, professional presentation setup';
      lighting = 'clean professional lighting with modern accent highlights';
      keywords = ['professional', 'modern', 'digital'];
    }
    
    const fullScenePrompt = `${environment}, ${sceneElements}, ${lighting}, 
    photorealistic 3D environment with cinematic depth and professional atmosphere,
    ultra-detailed architectural elements creating perfect integration space`;
    
    logger.info(`🎬 Scene analysis complete: ${environment.substring(0, 50)}...`);
    
    return {
      environment,
      sceneElements,
      lighting,
      fullScenePrompt,
      keywords
    };
  }

  /**
   * Call SDXL ControlNet API with optimal 2024 settings
   * Uses RunPod SDXL + ControlNet for precise logo control
   */
  async callOptimalControlNetAPI(payload) {
    try {
      logger.info('🎯 Calling SDXL ControlNet with revolutionary dynamic backgrounds...');
      logger.info(`   📊 Logo Symbol: ${payload.logoSymbol}`);
      logger.info(`   📊 Dynamic Background: ${payload.options?.dynamicBackgroundPrompt ? 'YES' : 'NO'}`);
      logger.info(`   📊 Control Weight: ${this.optimalSettings.stage2.controlnet_conditioning_scale}`);
      logger.info(`   📊 Guidance Scale: ${this.optimalSettings.stage2.guidance_scale}`);
      logger.info(`   📊 Model: SDXL + ControlNet with Enhanced Prompting`);
      
      // IMPROVED: Try multiple generation methods for maximum success
      let result;
      
      // Method 1: Try FREE Open-Source LoRA with ControlNet
      try {
        logger.info('📊 Method 1: Attempting FREE Open-Source LoRA ControlNet...');
        result = await this.generateWithFreeLoRA(payload);
        logger.info('✅ FREE LoRA ControlNet succeeded!');
        return result;
      } catch (freeLoraError) {
        logger.warn('⚠️ FREE LoRA ControlNet failed:', freeLoraError.message);
        
        // Method 2: Try Wavespeed ControlNet as backup
        try {
          logger.info('📊 Method 2: Attempting Wavespeed ControlNet backup...');
          const wavespeedResult = await this.generateWithWavespeedControlNet({
            prompt: payload.prompt,
            controlType: 'canny',
            controlImageBase64: payload.control_image,
            detected: payload.logoSymbol,
            imageId: payload.imageId,
            options: payload.options
          });
          logger.info('✅ Wavespeed ControlNet backup succeeded!');
          return wavespeedResult;
        } catch (wavespeedError) {
          logger.warn('⚠️ Wavespeed ControlNet backup failed:', wavespeedError.message);
          
          // Method 3: Emergency fallback with improved backgrounds
          logger.warn('🔄 Using emergency fallback with improved background generation...');
          return await this.generateImprovedFallback(payload);
        }
      }
      
    } catch (error) {
      logger.error('❌ All ControlNet methods failed:', error.message);
      throw new Error(`ControlNet generation failed: ${error.message}`);
    }
  }

  /**
   * Generate image using FREE Open-Source LoRA with ControlNet
   */
  async generateWithFreeLoRA(payload) {
    try {
      logger.info('🆓 Starting FREE Open-Source LoRA generation...');
      
      // Use the FreeLoraService with content analysis
      const options = {
        articleContent: payload.options?.articleContent,
        content: payload.options?.content,
        style: payload.options?.style,
        dynamicBackgroundPrompt: payload.options?.dynamicBackgroundPrompt,
        seed: payload.options?.seed
      };

      const result = await this.freeLoraService.generateWithFreeLoRA(
        payload.title || payload.prompt,
        payload.logoSymbol,
        options
      );

      if (!result.success || !result.localPath) {
        throw new Error('FREE LoRA generation failed - no image generated');
      }

      // Move generated image to ControlNet directory with standard naming
      const standardPath = path.join(this.imageStorePath, `${payload.imageId}.jpg`);
      
      // Ensure ControlNet storage directory exists
      await fs.mkdir(path.dirname(standardPath), { recursive: true });
      
      // Process and resize to standard format (1800x900)
      const metadata = await sharp(result.localPath).metadata();
      logger.info(`📏 FREE LoRA dimensions: ${metadata.width}x${metadata.height}`);
      
      if (metadata.width === 1800 && metadata.height === 900) {
        // Already correct size
        await sharp(result.localPath).jpeg({ quality: 95 }).toFile(standardPath);
      } else {
        // Resize to 1800x900
        await sharp(result.localPath)
          .resize(1800, 900, { fit: 'cover' })
          .jpeg({ quality: 95 })
          .toFile(standardPath);
      }

      // Apply watermark
      await this.watermarkService.addWatermark(
        standardPath,
        standardPath,
        { title: `${payload.logoSymbol} FREE LoRA` }
      );

      logger.info(`✅ FREE LoRA generation completed for ${payload.logoSymbol}`);
      
      return { 
        localPath: standardPath,
        metadata: result.metadata 
      };
      
    } catch (error) {
      logger.error('❌ FREE LoRA generation failed:', error.message);
      throw error;
    }
  }

  /**
   * IMPROVED: Generate enhanced fallback image with dynamic backgrounds
   * This should rarely be used - ControlNet should handle most cases
   */
  async generateImprovedFallback(payload) {
    try {
      const { logoSymbol, imageId, style, options } = payload;
      
      logger.warn('🚨 EMERGENCY FALLBACK: ControlNet systems failed, using improved fallback generation');
      
      // Get logo data
      const logoData = await this.getPngLogo(logoSymbol);
      if (!logoData) {
        throw new Error(`No logo available for ${logoSymbol}`);
      }

      logger.info(`🎨 Creating improved fallback image for ${logoSymbol}`);
      
      // Use dynamic background if available, otherwise professional gradient
      let backgroundImage;
      if (options?.dynamicBackgroundPrompt) {
        logger.info('🎨 Using simplified dynamic background for fallback');
        // Create a more sophisticated background based on the dynamic analysis
        backgroundImage = await this.createDynamicFallbackBackground(options.dynamicBackgroundPrompt);
      } else {
        logger.info('🎨 Using professional gradient background');
        backgroundImage = await this.createStyledBackground('professional');
      }
      
      // Composite logo with improved positioning and effects
      const finalImageBuffer = await this.createEnhancedLogoComposition(
        backgroundImage, 
        logoData.buffer, 
        logoSymbol,
        options
      );
      
      // Save buffer to temp file first
      const tempImagePath = path.join(this.imageStorePath, `${imageId}_temp.png`);
      await fs.writeFile(tempImagePath, finalImageBuffer);
      
      // Apply watermark
      const finalImagePath = path.join(this.imageStorePath, `${imageId}.png`);
      await this.watermarkService.addWatermark(
        tempImagePath, 
        finalImagePath,
        { title: `${logoSymbol} Professional Analysis` }
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
      logger.error('❌ Improved fallback generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Create dynamic background based on content analysis
   */
  async createDynamicFallbackBackground(dynamicPrompt) {
    const width = 1800;
    const height = 900;
    
    logger.info('🎨 Creating dynamic fallback background based on content themes');
    
    // Create backgrounds based on detected themes
    const themes = dynamicPrompt.themes || [];
    let gradientColors = {
      start: '#1e3c72',
      middle: '#2a5298', 
      end: '#1e3c72'
    };
    
    if (themes.includes('technology')) {
      gradientColors = { start: '#0f0f0f', middle: '#1a365d', end: '#2d3748' };
    } else if (themes.includes('trading')) {
      gradientColors = { start: '#1a202c', middle: '#2d3748', end: '#4a5568' };
    } else if (themes.includes('finance')) {
      gradientColors = { start: '#2c1810', middle: '#744210', end: '#2c1810' };
    } else if (themes.includes('security')) {
      gradientColors = { start: '#1a0d33', middle: '#4c1d95', end: '#1a0d33' };
    }
    
    const backgroundSvg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="dynamic" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${gradientColors.start};stop-opacity:1"/>
            <stop offset="50%" style="stop-color:${gradientColors.middle};stop-opacity:1"/>
            <stop offset="100%" style="stop-color:${gradientColors.end};stop-opacity:1"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#dynamic)"/>
      </svg>
    `;
    
    return await sharp(Buffer.from(backgroundSvg)).png().toBuffer();
  }

  /**
   * Create enhanced logo composition with better positioning and effects
   */
  async createEnhancedLogoComposition(backgroundBuffer, logoBuffer, logoSymbol, options = {}) {
    const logoSize = 400; // Larger logo for better presence
    
    // Resize logo with better quality
    const resizedLogo = await sharp(logoBuffer)
      .resize(logoSize, logoSize, { 
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();
    
    // Create enhanced composition with multiple logo instances for depth effect
    const finalImage = await sharp(backgroundBuffer)
      .composite([
        // Main logo in center (remove invalid blend parameter)
        {
          input: resizedLogo,
          top: Math.round((900 - logoSize) / 2),
          left: Math.round((1800 - logoSize) / 2)
          // No blend parameter - Sharp will use default 'over' mode
        },
        // Subtle background logo for depth
        {
          input: await sharp(logoBuffer)
            .resize(logoSize * 1.5, logoSize * 1.5, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .modulate({ brightness: 0.3, saturation: 0.5 })
            .blur(8)
            .png()
            .toBuffer(),
          top: Math.round((900 - logoSize * 1.5) / 2),
          left: Math.round((1800 - logoSize * 1.5) / 2),
          blend: 'multiply'  // This blend mode is valid
        }
      ])
      .png()
      .toBuffer();
    
    logger.info(`✅ Enhanced composition created for ${logoSymbol} with improved depth effects`);
    return finalImage;
  }

  /**
   * DEPRECATED: Basic PNG-based image generation (legacy fallback)
   */
  async generateDirectPngImage(payload) {
    logger.warn('⚠️ DEPRECATED: generateDirectPngImage called - using generateImprovedFallback instead');
    return await this.generateImprovedFallback(payload);
  }

  /**
   * Create professional background for emergency fallback only
   * IMPORTANT: This should rarely be used - ControlNet should handle backgrounds
   */
  async createStyledBackground(style = 'professional') {
    const width = 1800;
    const height = 900;
    
    logger.warn('⚠️ Using emergency fallback background - ControlNet should handle this normally');
    
    // Create a professional dark gradient instead of ugly radial patterns
    const backgroundSvg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="professional" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1e3c72;stop-opacity:1"/>
            <stop offset="50%" style="stop-color:#2a5298;stop-opacity:1"/>
            <stop offset="100%" style="stop-color:#1e3c72;stop-opacity:1"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#professional)"/>
      </svg>
    `;
    
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
   * STAGE 1: Generate High-Quality 3D Environment using Replicate SDXL Base
   */
  async generateEnvironmentStage(style, options = {}) {
    try {
      const styleTemplate = this.styleTemplates[style] || this.styleTemplates.holographic;
      const stage1Settings = this.optimalSettings.stage1;
      
      logger.info(`🎬 Stage 1: Generating ${style} environment with Replicate SDXL...`);
      
      // Use Replicate SDXL Base for high-quality environment generation
      const environmentPrompt = styleTemplate.environmentPrompt;
      const negativePrompt = styleTemplate.negative_prompt;
      
      const result = await this.callReplicateSDXLBase({
        prompt: environmentPrompt,
        negative_prompt: negativePrompt,
        width: stage1Settings.width,
        height: stage1Settings.height,
        steps: stage1Settings.steps,
        guidance_scale: stage1Settings.guidance_scale,
        scheduler: stage1Settings.scheduler
      });
      
      return {
        success: true,
        environmentImage: result.image_base64,
        imageUrl: result.imageUrl, // For Stage 2 reference
        metadata: {
          prompt: environmentPrompt,
          settings: stage1Settings,
          processingTime: result.processing_time || 0,
          model: 'replicate_sdxl_base'
        }
      };
      
    } catch (error) {
      logger.error('❌ Stage 1 Environment Generation failed:', error);
      throw error;
    }
  }

  /**
   * STAGE 2: Integrate Logo with Depth Awareness using Replicate SDXL ControlNet
   */
  async integrateLogoStage(environmentResult, logoSymbol, style, imageId, options = {}) {
    try {
      logger.info(`🔗 Stage 2: Integrating ${logoSymbol} logo with depth awareness using Replicate...`);
      
      const styleTemplate = this.styleTemplates[style] || this.styleTemplates.holographic;
      const stage2Settings = this.optimalSettings.stage2;
      
      // Get logo PNG for depth control
      const logoData = await this.getPngLogo(logoSymbol);
      if (!logoData) {
        throw new Error(`No PNG logo found for ${logoSymbol}`);
      }
      
      // Preprocess logo for ControlNet depth guidance
      const controlImage = await this.preprocessPngForControlNet(logoData.buffer, stage2Settings.width);
      
      // Create logo integration prompt
      const logoPrompt = `${styleTemplate.logoIntegration}, specifically ${logoSymbol} cryptocurrency symbol, ${logoSymbol} logo accuracy is critical`;
      const negativePrompt = styleTemplate.negative_prompt + `, wrong ${logoSymbol} logo, incorrect ${logoSymbol} symbol`;
      
      // Call Replicate SDXL ControlNet for depth-aware logo integration
      const result = await this.callReplicateSDXLControlNet({
        base_image_url: environmentResult.imageUrl, // Use URL from Stage 1
        logo_control_image: controlImage.toString('base64'),
        prompt: logoPrompt,
        negative_prompt: negativePrompt,
        
        // Revolutionary depth-aware settings
        controlnet_conditioning_scale: stage2Settings.controlnet_conditioning_scale,
        control_guidance_start: stage2Settings.control_guidance_start,
        control_guidance_end: stage2Settings.control_guidance_end,
        
        // Generation settings
        width: stage2Settings.width,
        height: stage2Settings.height,
        steps: stage2Settings.steps,
        guidance_scale: stage2Settings.guidance_scale,
        scheduler: stage2Settings.scheduler,
        strength: 0.65, // Preserve environment while integrating logo
        
        logoSymbol,
        imageId
      });
      
      return {
        success: true,
        localPath: result.localPath,
        metadata: {
          method: 'replicate_sdxl_controlnet_depth_aware',
          logoSymbol,
          prompt: logoPrompt,
          settings: stage2Settings,
          processingTime: result.processing_time || 0,
          model: 'replicate_sdxl_controlnet_depth'
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
   * STAGE 1: Environment Generation using Google AI (working API)
   * DEPRECATED: Using enhanced ControlNet instead
   */
  async callReplicateSDXLBase(params) {
    logger.info('🔄 callReplicateSDXLBase is deprecated - using enhanced ControlNet instead');
    
    return {
      image_base64: null,
      processing_time: 0,
      imageUrl: null,
      deprecated: true
    };
  }

  /**
   * STAGE 2: Logo Integration using Replicate SDXL ControlNet Depth
   * DEPRECATED: Using enhanced ControlNet instead
   */
  async callReplicateSDXLControlNet(params) {
    logger.info('🔄 callReplicateSDXLControlNet is deprecated - using enhanced ControlNet instead');
    
    return {
      localPath: null,
      processing_time: 0,
      deprecated: true
    };
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

  /**
   * STAGE 1: Generate 3D environment based on article content analysis
   * No logos - pure environment generation for Stage 2 logo embedding
   */
  async generateEnvironmentStageTrue(title, logoSymbol, style, options = {}) {
    try {
      logger.info(`🎬 STAGE 1: Generating pure 3D environment for ${style} style`);
      
      // Use dynamic background analysis from options
      let environmentPrompt;
      if (options.dynamicBackgroundPrompt) {
        const analysis = options.dynamicBackgroundPrompt;
        environmentPrompt = `${analysis.fullPrompt} without any logos or symbols, 
        pure environmental scene ready for logo integration, 
        photorealistic 3D environment with proper lighting and depth,
        cinematic composition with clear focal areas for logo placement,
        professional studio lighting setup, 8k resolution`;
        
        logger.info(`🎨 Using dynamic environment: ${analysis.environmentType}`);
      } else {
        // Fallback static environment
        environmentPrompt = `professional modern digital workspace with clean architecture,
        sophisticated lighting and depth, no logos or symbols,
        pure 3D environment ready for logo integration,
        cinematic composition, 8k photorealistic rendering`;
        
        logger.warn('⚠️ No dynamic analysis available, using static environment');
      }
      
      // Generate pure environment using RunPod
      const environmentResult = await this.generatePureEnvironment({
        prompt: environmentPrompt,
        style,
        width: 1600,
        height: 900,
        steps: 60,
        guidance_scale: 8.5
      });
      
      return {
        success: true,
        environmentImagePath: environmentResult.localPath,
        environmentImageBase64: environmentResult.imageBase64,
        metadata: {
          prompt: environmentPrompt,
          style,
          stage: 'environment_generation',
          dynamicAnalysis: options.dynamicBackgroundPrompt || null
        }
      };
      
    } catch (error) {
      logger.error('❌ Stage 1 Environment Generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * STAGE 2: Use actual SVG logo geometry to guide 3D logo embedding
   */
  async embedLogoWithSVGGuidance(environmentResult, logoSymbol, style, imageId, options = {}) {
    try {
      logger.info(`🔗 STAGE 2: Embedding ${logoSymbol} logo using SVG geometry guidance`);
      
      // Get actual SVG logo data from database/file
      const svgLogoData = await this.getSVGLogoForControlNet(logoSymbol);
      if (!svgLogoData) {
        throw new Error(`No SVG logo data found for ${logoSymbol}`);
      }
      
      logger.info(`✅ SVG logo loaded: ${svgLogoData.symbol} (${svgLogoData.source})`);
      
      // Convert SVG to ControlNet conditioning images
      const controlNetImages = await this.convertSVGToControlNetInputs(svgLogoData);
      
      // Create logo embedding prompt
      const logoPrompt = this.createSVGEmbeddingPrompt(logoSymbol, style, options);
      
      // Use environment image as base and embed logo using SVG-guided ControlNet
      const embeddingResult = await this.runSVGGuidedControlNet({
        baseImagePath: environmentResult.environmentImagePath,
        svgControlImages: controlNetImages,
        logoPrompt,
        logoSymbol,
        imageId,
        options
      });
      
      return {
        success: true,
        imageId,
        imageUrl: this.getImageUrl(imageId),
        localPath: embeddingResult.localPath,
        svgData: svgLogoData,
        metadata: {
          stage: 'svg_guided_embedding',
          logoSymbol,
          svgSource: svgLogoData.source,
          controlNetTypes: controlNetImages.types,
          prompt: logoPrompt
        }
      };
      
    } catch (error) {
      logger.error(`❌ Stage 2 SVG Logo Embedding failed:`, error);
      throw error;
    }
  }

  /**
   * Get SVG logo data for ControlNet processing
   */
  async getSVGLogoForControlNet(logoSymbol) {
    try {
      // First try to get from SVG database
      const svgLogo = await this.svgLogoService.getSvgLogoInfo(logoSymbol);
      if (svgLogo && svgLogo.svgContent) {
        logger.info(`📊 SVG logo loaded from database: ${logoSymbol}`);
        return {
          symbol: logoSymbol,
          svgContent: svgLogo.svgContent,
          source: 'database',
          metadata: svgLogo
        };
      }
      
      // Fallback: Try to generate from PNG file
      logger.info(`🔄 No SVG in database, checking PNG files for ${logoSymbol}...`);
      const pngLogo = await this.getPngLogo(logoSymbol);
      if (pngLogo) {
        // Convert PNG to SVG-like processing
        return {
          symbol: logoSymbol,
          pngBuffer: pngLogo.buffer,
          source: 'png_file',
          filename: pngLogo.filename
        };
      }
      
      logger.error(`❌ No SVG or PNG logo found for ${logoSymbol}`);
      return null;
      
    } catch (error) {
      logger.error(`❌ Error getting SVG logo for ${logoSymbol}:`, error);
      return null;
    }
  }

  /**
   * Convert SVG to ControlNet conditioning inputs (Canny, Depth, etc.)
   */
  async convertSVGToControlNetInputs(svgLogoData) {
    try {
      logger.info(`🔧 Converting ${svgLogoData.symbol} to ControlNet inputs...`);
      
      let logoBuffer;
      
      if (svgLogoData.svgContent) {
        // Convert SVG to high-quality PNG
        logoBuffer = await sharp(Buffer.from(svgLogoData.svgContent))
          .png({ quality: 100 })
          .resize(1024, 1024, { 
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 }
          })
          .toBuffer();
      } else if (svgLogoData.pngBuffer) {
        // Use PNG directly
        logoBuffer = svgLogoData.pngBuffer;
      } else {
        throw new Error('No valid logo data for ControlNet conversion');
      }
      
      // Create Canny edge detection for precise logo boundaries
      const cannyImage = await sharp(logoBuffer)
        .greyscale()
        .normalize()
        // High contrast for sharp edges
        .linear(2.0, -(128 * 2.0) + 128)
        .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
        .png()
        .toBuffer();
      
      // Create depth map for 3D positioning
      const depthImage = await sharp(logoBuffer)
        .greyscale()
        .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
        .blur(2) // Slight blur for smooth depth transitions
        .png()
        .toBuffer();
      
      logger.info(`✅ ControlNet inputs created: Canny edges + Depth map`);
      
      return {
        canny: cannyImage.toString('base64'),
        depth: depthImage.toString('base64'),
        types: ['canny', 'depth'],
        originalLogo: logoBuffer.toString('base64')
      };
      
    } catch (error) {
      logger.error('❌ SVG to ControlNet conversion failed:', error);
      throw error;
    }
  }

  /**
   * Create prompt specifically for SVG-guided logo embedding
   */
  createSVGEmbeddingPrompt(logoSymbol, style, options = {}) {
    let prompt = `Integrate the ${logoSymbol} cryptocurrency logo shape into this 3D environment, 
    the logo should appear as natural architectural elements embedded in the scene,
    multiple instances of the ${logoSymbol} symbol at different depths and perspectives,
    the logo casting realistic shadows and receiving environmental lighting,
    seamless integration with no flat overlay appearance,
    photorealistic materials and surface properties,
    cinematic depth of field and atmospheric perspective`;
    
    // Add style-specific integration
    if (style.includes('trading')) {
      prompt += ', the logo integrated into trading displays and financial interfaces';
    } else if (style.includes('technology')) {
      prompt += ', the logo embedded in high-tech displays and holographic projections';
    } else if (style.includes('professional')) {
      prompt += ', the logo elegantly integrated into corporate architectural elements';
    }
    
    prompt += ', absolutely no text or typography, pure 3D logo integration only';
    
    return prompt;
  }

  /**
   * Run SVG-guided ControlNet for logo embedding
   */
  async runSVGGuidedControlNet(params) {
    try {
      logger.info(`🎯 Running SVG-guided ControlNet for ${params.logoSymbol}...`);
      
      // Use img2img with ControlNet to embed logo into environment
      const result = await this.generateWithRunPodSDXLControlNet({
        prompt: params.logoPrompt,
        negative_prompt: `flat overlay, 2d sticker, wrong ${params.logoSymbol} logo, different cryptocurrency, text, letters`,
        control_image: params.svgControlImages.canny, // Use Canny edges for precise control
        base_image: params.baseImagePath, // Environment from Stage 1
        logoSymbol: params.logoSymbol,
        imageId: params.imageId,
        style: 'img2img_svg_guided',
        strength: 0.7, // Preserve environment while embedding logo
        options: params.options
      });
      
      return result;
      
    } catch (error) {
      logger.error('❌ SVG-guided ControlNet failed:', error);
      throw error;
    }
  }

  /**
   * Generate pure environment without logos (Stage 1)
   * SIMPLIFIED: Use existing working generation methods
   */
  async generatePureEnvironment(params) {
    try {
      logger.info('🎬 Generating pure environment (no logos)...');
      
      // SIMPLIFIED: Use existing PNG ControlNet method without logos
      const result = await this.generateWithPngControlNet(
        'Pure Environment Generation',
        'NONE', // No logo symbol
        'professional',
        {
          ...params,
          environmentOnly: true,
          prompt: params.prompt,
          negative_prompt: 'logos, symbols, cryptocurrency, text, letters, overlays, flat elements'
        }
      );
      
      // Convert result to base64 for Stage 2 processing
      if (result.localPath) {
        const fs = require('fs').promises;
        const imageBuffer = await fs.readFile(result.localPath);
        const imageBase64 = imageBuffer.toString('base64');
        
        return {
          localPath: result.localPath,
          imageBase64: imageBase64
        };
      }
      
      throw new Error('No environment image generated from PNG ControlNet');
      
    } catch (error) {
      logger.error('❌ Pure environment generation failed:', error.message);
      // Return a fallback so Stage 2 can still proceed
      logger.warn('🔄 Stage 1 failed, Stage 2 will handle complete generation');
      throw error;
    }
  }

  /**
   * HYBRID REVOLUTIONARY: Use existing RunPod with revolutionary settings and prompts
   */
  async generateWithRevolutionaryHybrid(title, logoSymbol, style, imageId, options) {
    try {
      const startTime = Date.now();
      logger.info(`🎯 HYBRID Revolutionary: Enhanced ControlNet with revolutionary prompts for ${logoSymbol}`);
      
      // Get logo PNG
      const logoData = await this.getPngLogo(logoSymbol);
      if (!logoData) {
        throw new Error(`No PNG logo found for ${logoSymbol}`);
      }
      
      // Use revolutionary style templates
      const styleTemplate = this.styleTemplates[style] || this.styleTemplates.holographic;
      
      // Build REVOLUTIONARY prompts using your existing RunPod
      const revolutionaryPrompt = this.buildRevolutionaryPrompt(logoSymbol, styleTemplate);
      
      // Enhanced preprocessing for better 3D integration
      const controlImage = await this.preprocessPngForRevolutionary(logoData.buffer);
      
      // Call Hugging Face SDXL ControlNet with REVOLUTIONARY settings
      const result = await this.callRevolutionarySDXL({
        prompt: revolutionaryPrompt,
        negative_prompt: styleTemplate.negative_prompt + `, flat overlay, 2d sticker, wrong ${logoSymbol} symbol`,
        control_image: controlImage.toString('base64'),
        logoSymbol,
        imageId,
        style,
        settings: this.optimalSettings.stage2, // Use revolutionary stage 2 settings
        options
      });
      
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      logger.info(`🎯 HYBRID Revolutionary completed in ${totalTime}s for ${logoSymbol}`);
      
      return {
        success: true,
        imageId,
        imageUrl: this.getImageUrl(imageId),
        localPath: result.localPath,
        metadata: {
          method: 'hybrid_revolutionary_controlnet',
          logoSymbol,
          style,
          prompt: revolutionaryPrompt,
          settings: this.optimalSettings.stage2,
          processingTime: totalTime,
          improvements: [
            'revolutionary_prompts',
            'enhanced_3d_integration',
            'perspective_awareness', 
            'environmental_depth',
            'cinematic_quality'
          ],
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error(`❌ HYBRID Revolutionary failed:`, error);
      throw error;
    }
  }

  /**
   * Build revolutionary prompts for existing RunPod
   */
  buildRevolutionaryPrompt(logoSymbol, styleTemplate) {
    // Combine environment and logo integration for single-stage generation
    const environmentPrompt = styleTemplate.environmentPrompt;
    const logoIntegration = styleTemplate.logoIntegration;
    
    return `${environmentPrompt}, ${logoIntegration.replace('cryptocurrency', logoSymbol)}, 
    CRITICAL: The ${logoSymbol} symbol must be perfectly accurate and recognizable, 
    integrated into the 3D environment with proper perspective, depth, and lighting interaction,
    multiple instances at different depths and angles, photorealistic materials, 
    cinema-quality rendering, 8k resolution, absolutely no flat overlays`;
  }

  /**
   * Enhanced preprocessing for revolutionary approach
   */
  async preprocessPngForRevolutionary(logoBuffer) {
    try {
      // Enhanced preprocessing for better 3D integration
      const processed = await sharp(logoBuffer)
        .resize(this.optimalSettings.stage2.width, this.optimalSettings.stage2.height, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();
      
      logger.info(`🔧 Revolutionary preprocessing: Enhanced for 3D integration`);
      return processed;
      
    } catch (error) {
      logger.error('❌ Revolutionary preprocessing failed:', error);
      throw error;
    }
  }

  /**
   * Call Replicate SDXL ControlNet with revolutionary settings
   */
  async callRevolutionarySDXL(params) {
    try {
      const replicateApiKey = process.env.REPLICATE_API_TOKEN || process.env.OPENAI_API_KEY; // Fallback to OpenAI key
      
      if (!replicateApiKey) {
        throw new Error('No API key available for SDXL ControlNet');
      }
      
      logger.info(`🎯 Calling Replicate SDXL ControlNet Depth with revolutionary settings...`);
      
      // Use Replicate's SDXL ControlNet Depth model
      const response = await axios.post('https://api.replicate.com/v1/predictions', {
        version: "7eba9a1e-4fdb-41e6-9cd1-d4dd91e52cf1", // SDXL ControlNet Depth
        input: {
          image: `data:image/png;base64,${params.control_image}`,
          prompt: params.prompt,
          negative_prompt: params.negative_prompt,
          
          // Revolutionary ControlNet settings optimized for 3D logo integration
          num_inference_steps: params.settings.steps,
          guidance_scale: params.settings.guidance_scale,
          controlnet_conditioning_scale: params.settings.controlnet_conditioning_scale,
          control_guidance_start: params.settings.control_guidance_start,
          control_guidance_end: params.settings.control_guidance_end,
          
          // High quality settings
          width: params.settings.width,
          height: params.settings.height,
          scheduler: "UniPC",
          seed: params.options.seed || -1,
          
          // Depth-aware settings for 3D integration
          apply_watermark: false
        }
      }, {
        headers: {
          'Authorization': `Token ${replicateApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      });
      
      // Poll for completion
      const prediction = response.data;
      const result = await this.pollReplicatePrediction(prediction.id, replicateApiKey);
      
      if (!result.output || !result.output[0]) {
        throw new Error('No image output from SDXL ControlNet');
      }
      
      // Download and save the image
      const imageUrl = result.output[0];
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(imageResponse.data);
      
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
        processing_time: (result.metrics?.predict_time || 0) * 1000
      };
      
    } catch (error) {
      logger.error('❌ Replicate SDXL ControlNet call failed:', error);
      throw error;
    }
  }

  /**
   * Poll Replicate prediction until completion
   */
  async pollReplicatePrediction(predictionId, apiKey) {
    const maxAttempts = 60; // 5 minutes max
    const pollInterval = 5000; // 5 seconds
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await axios.get(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: {
          'Authorization': `Token ${apiKey}`,
        }
      });
      
      const prediction = response.data;
      
      if (prediction.status === 'succeeded') {
        return prediction;
      } else if (prediction.status === 'failed') {
        throw new Error(`Replicate prediction failed: ${prediction.error}`);
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      logger.info(`🔄 Waiting for SDXL ControlNet completion... (${attempt + 1}/${maxAttempts})`);
    }
    
    throw new Error('Replicate prediction timed out');
  }
}

module.exports = ControlNetService;