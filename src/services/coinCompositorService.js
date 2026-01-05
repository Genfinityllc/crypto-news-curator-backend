const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const axios = require('axios');
const logger = require('../utils/logger');
const SVGLogoService = require('./svgLogoService');
const WatermarkService = require('./watermarkService');
const MultiProviderSDXLService = require('./multiProviderSDXL');

/**
 * Hyper-Realistic Coin Compositor Service
 * 
 * Two-stage approach for perfect logo accuracy:
 * 1. Generate realistic 3D coin base + scene (no logo interpretation)
 * 2. Composite exact PNG logo onto coin surface with perspective mapping
 */
class CoinCompositorService {
  constructor() {
    this.timeout = 300000; // 5 minutes
    this.imageStorePath = path.join(__dirname, '../../temp/coin-images');
    this.baseUrl = process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app';
    this.svgLogoService = new SVGLogoService();
    this.watermarkService = new WatermarkService();
    this.sdxlService = new MultiProviderSDXLService();
    
    // RunPod settings for coin base generation
    this.coinBaseSettings = {
      steps: 40, // Faster for base generation
      guidance_scale: 8.0, // Higher for realistic materials
      width: 1800,
      height: 900,
      scheduler: 'DPMSolverMultistep'
    };
    
    // Style templates based on your XRP reference images
    this.coinStyles = {
      holographic: {
        prompt: "hyper-realistic 3D cryptocurrency coin, metallic chrome finish, rainbow holographic reflections, floating in space, dark cosmic background with blue nebula, studio lighting, ultra detailed, 8k resolution, professional photography, chrome and iridescent effects, futuristic atmosphere",
        negative_prompt: "logo, symbol, text, letters, any cryptocurrency symbol, bitcoin, ethereum, flat, 2d, cartoon, sketch, blurry, distorted"
      },
      cyberpunk: {
        prompt: "futuristic 3D cryptocurrency coin, metallic surface, cyberpunk space environment with purple and cyan lighting, floating coins, digital particles, holographic elements in background, dramatic lighting, ultra detailed, 8k, professional render",
        negative_prompt: "logo, symbol, text, letters, any cryptocurrency symbol, flat, 2d, cartoon, low quality"
      },
      space: {
        prompt: "realistic 3D metallic coin floating in deep space, Earth in background, cosmic lighting, chrome and silver materials, professional studio lighting, ultra detailed, 8k resolution, cinematic composition",
        negative_prompt: "logo, symbol, text, letters, any cryptocurrency symbol, flat, cartoon, blurry"
      }
    };
    
    this.ensureStorageDirectory().catch(err => {
      logger.error('❌ Failed to create coin compositor storage directory:', err);
    });
    
    logger.info('🪙 Hyper-Realistic Coin Compositor Service initialized - Two-stage logo compositing');
  }

  async ensureStorageDirectory() {
    try {
      await fs.mkdir(this.imageStorePath, { recursive: true });
      logger.info(`📁 Coin compositor storage ready: ${this.imageStorePath}`);
    } catch (error) {
      logger.error('❌ Failed to create storage directory:', error);
    }
  }

  /**
   * Generate unique image ID
   */
  generateImageId() {
    const randomBytes = crypto.randomBytes(8);
    return `coin_${randomBytes.toString('hex')}`;
  }

  /**
   * Main entry point - Generate hyper-realistic coin with exact logo
   */
  async generateCoinWithLogo(title, logoSymbol, style = 'holographic', options = {}) {
    const imageId = this.generateImageId();
    
    try {
      logger.info(`🪙 Starting two-stage coin generation for ${logoSymbol} (${style})`);
      
      // STAGE 1: Generate realistic coin base (no logo interpretation)
      logger.info(`🎭 STAGE 1: Generating realistic ${style} coin base...`);
      const coinBasePath = await this.generateCoinBase(imageId, style, options);
      
      // STAGE 2: Get exact logo and composite onto coin
      logger.info(`🎯 STAGE 2: Compositing exact ${logoSymbol} logo onto coin...`);
      const logoData = await this.getPngLogo(logoSymbol);
      if (!logoData) {
        throw new Error(`No logo available for ${logoSymbol}`);
      }
      
      const finalImagePath = await this.compositeLogo(coinBasePath, logoData, logoSymbol, imageId);
      
      // Apply watermark
      await this.watermarkService.addWatermark(
        finalImagePath,
        finalImagePath,
        { title: `${logoSymbol} Hyper-Realistic Coin` }
      );
      
      const imageUrl = `${this.baseUrl}/temp/coin-images/${imageId}_final.png`;
      
      logger.info(`✅ Two-stage coin generation completed for ${logoSymbol}`);
      
      return {
        success: true,
        imageId,
        imageUrl,
        localPath: finalImagePath,
        metadata: {
          method: 'two_stage_coin_compositor',
          logoSymbol,
          style,
          stage1: 'realistic_coin_base',
          stage2: 'exact_logo_compositing',
          logoSource: logoData.source,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error(`❌ Coin compositor failed for ${logoSymbol}:`, error.message);
      throw error;
    }
  }

  /**
   * STAGE 1: Generate realistic 3D coin base without any logo interpretation
   */
  async generateCoinBase(imageId, style, options) {
    try {
      const styleTemplate = this.coinStyles[style] || this.coinStyles.holographic;
      
      logger.info(`🎯 Generating coin base with multi-provider SDXL (${style})`);
      
      // Use multi-provider service with automatic fallback
      const result = await this.sdxlService.generateWithFallback(
        styleTemplate.prompt,
        styleTemplate.negative_prompt,
        {
          width: this.coinBaseSettings.width,
          height: this.coinBaseSettings.height,
          steps: this.coinBaseSettings.steps,
          guidance_scale: this.coinBaseSettings.guidance_scale,
          seed: options.seed || Math.floor(Math.random() * 1000000)
        }
      );

      // Save the generated image
      const coinBasePath = path.join(this.imageStorePath, `${imageId}_base.png`);
      await fs.writeFile(coinBasePath, result.imageBuffer);
      
      logger.info(`✅ Coin base generated using ${result.provider} in ${result.duration}ms: ${coinBasePath}`);
      return coinBasePath;
      
    } catch (error) {
      logger.error('❌ All coin base generation providers failed:', error.message);
      throw error;
    }
  }

  /**
   * STAGE 2: Composite exact PNG logo onto coin surface with perspective mapping
   */
  async compositeLogo(coinBasePath, logoData, logoSymbol, imageId) {
    try {
      logger.info(`🎯 Compositing exact ${logoSymbol} logo onto coin surface...`);
      
      // Load coin base
      const coinBase = sharp(coinBasePath);
      const coinMetadata = await coinBase.metadata();
      
      // Process logo for coin surface
      // Make logo smaller and add perspective/lighting effects to match coin
      const logoSize = Math.min(200, Math.floor(Math.min(coinMetadata.width, coinMetadata.height) * 0.15));
      
      const processedLogo = await sharp(logoData.buffer)
        .resize(logoSize, logoSize, { 
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        // Add subtle shadow and highlight for 3D coin effect
        .png()
        .toBuffer();
      
      // Calculate center position for logo on coin
      const centerX = Math.round(coinMetadata.width / 2 - logoSize / 2);
      const centerY = Math.round(coinMetadata.height / 2 - logoSize / 2);
      
      logger.info(`📍 Placing ${logoSize}x${logoSize} ${logoSymbol} logo at center: ${centerX}, ${centerY}`);
      
      // Composite logo onto coin
      const finalImagePath = path.join(this.imageStorePath, `${imageId}_final.png`);
      
      await coinBase
        .composite([{
          input: processedLogo,
          left: centerX,
          top: centerY,
          blend: 'over'
        }])
        .png({ quality: 95 })
        .toFile(finalImagePath);
      
      logger.info(`✅ Logo composited onto coin: ${finalImagePath}`);
      
      // Clean up intermediate files
      try {
        await fs.unlink(coinBasePath);
      } catch (cleanupError) {
        logger.warn(`⚠️ Failed to clean up coin base: ${cleanupError.message}`);
      }
      
      return finalImagePath;
      
    } catch (error) {
      logger.error('❌ Logo compositing failed:', error.message);
      throw error;
    }
  }

  /**
   * Get PNG logo with SVG fallback (same as ControlNet service)
   */
  async getPngLogo(symbol) {
    try {
      const normalizedSymbol = symbol.toUpperCase();
      
      // Try PNG directory first (if exists)
      const pngDir = process.env.NODE_ENV === 'production' 
        ? path.join(__dirname, '../../uploads/png-logos')
        : '/Users/valorkopeny/Desktop/SVG CRYPTO LOGOS/PNG';
      
      const pngPath = path.join(pngDir, `${normalizedSymbol}.png`);
      
      try {
        await fs.access(pngPath);
        const buffer = await fs.readFile(pngPath);
        const stats = await fs.stat(pngPath);
        
        logger.info(`📁 Found PNG logo: ${pngPath} (${stats.size} bytes)`);
        
        return {
          buffer,
          source: 'png_file',
          filename: `${normalizedSymbol}.png`,
          size: stats.size
        };
        
      } catch (pngError) {
        logger.warn(`⚠️ PNG logo not found: ${pngPath}, trying SVG conversion...`);
      }
      
      // Fallback to SVG conversion
      const svgLogoInfo = await this.svgLogoService.getSvgLogoInfo(normalizedSymbol);
      if (!svgLogoInfo || !svgLogoInfo.svgContent) {
        logger.warn(`❌ No SVG logo found for ${normalizedSymbol}`);
        return null;
      }
      
      // Convert SVG to PNG
      const pngBuffer = await sharp(Buffer.from(svgLogoInfo.svgContent))
        .resize(512, 512, { 
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toBuffer();
      
      logger.info(`✅ SVG converted to PNG for ${normalizedSymbol} (${pngBuffer.length} bytes)`);
      
      return {
        buffer: pngBuffer,
        source: 'svg_converted',
        filename: `${normalizedSymbol}.png`,
        size: pngBuffer.length,
        originalSvg: svgLogoInfo
      };
      
    } catch (error) {
      logger.error(`❌ Failed to get PNG logo for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Get hosted image URL
   */
  getImageUrl(imageId) {
    return `${this.baseUrl}/temp/coin-images/${imageId}_final.png`;
  }

  /**
   * Test coin generation
   */
  async testCoinGeneration(symbol, style = 'holographic') {
    try {
      logger.info(`🧪 Testing coin generation for ${symbol} (${style})`);
      
      const result = await this.generateCoinWithLogo(
        `Test ${symbol} Coin`,
        symbol,
        style,
        { seed: 12345 }
      );
      
      logger.info(`✅ Test completed for ${symbol}`);
      return result;
      
    } catch (error) {
      logger.error(`❌ Test failed for ${symbol}:`, error.message);
      throw error;
    }
  }
}

module.exports = CoinCompositorService;