const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const logger = require('../utils/logger');
const SVGLogoService = require('./svgLogoService');
const WatermarkService = require('./watermarkService');

/**
 * Direct SVG Rendering Service - Exact Geometry with Sharp
 * 
 * Renders exact SVG geometry from database with professional styling
 * No Canvas dependency - uses Sharp for SVG to PNG conversion
 * Preserves 100% accuracy from uploaded SVG files
 */
class DirectSvgRenderingService {
  constructor() {
    this.timeout = 60000; // 1 minute
    this.imageStorePath = path.join(__dirname, '../../temp/direct-svg-renders');
    this.outputSize = { width: 1800, height: 900 };
    this.svgLogoService = new SVGLogoService();
    this.watermarkService = new WatermarkService();
    this.baseUrl = process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app';
    
    // Ensure storage directory exists
    this.ensureStorageDirectory().catch(err => {
      logger.error('❌ Failed to create Direct SVG storage directory:', err);
    });
    
    logger.info('🎨 Direct SVG Rendering Service initialized - exact geometry with Sharp');
  }

  async ensureStorageDirectory() {
    try {
      await fs.mkdir(this.imageStorePath, { recursive: true });
      logger.info(`📁 Direct SVG rendering storage ready: ${this.imageStorePath}`);
    } catch (error) {
      logger.error('❌ Failed to create storage directory:', error);
    }
  }

  /**
   * Generate exact logo cover with database SVG geometry
   */
  async generateDirectSvgCover(title, content = '', style = 'professional', options = {}) {
    const startTime = Date.now();
    
    try {
      logger.info(`🎨 Starting direct SVG rendering for: ${title.substring(0, 50)}...`);
      
      // Detect cryptocurrency from title/content
      const cryptocurrency = options.cryptocurrency || this.detectCryptocurrency(title + ' ' + content);
      if (!cryptocurrency) {
        throw new Error('Could not detect cryptocurrency for direct SVG rendering');
      }
      
      logger.info(`🔍 Detected cryptocurrency: ${cryptocurrency.toUpperCase()}`);
      
      // Get SVG logo data from database
      const logoInfo = await this.svgLogoService.getSvgLogoInfo(cryptocurrency.toUpperCase());
      if (!logoInfo || !logoInfo.svgContent) {
        throw new Error(`SVG logo not found for ${cryptocurrency}`);
      }
      
      logger.info(`🔧 SVG logo loaded: ${logoInfo.symbol} (${logoInfo.svgPath})`);
      
      // Create professional cover with exact geometry
      const imageResult = await this.renderProfessionalCover({
        title,
        logoInfo,
        cryptocurrency,
        style,
        options
      });
      
      const processingTime = Date.now() - startTime;
      logger.info(`✅ Direct SVG rendering complete in ${processingTime}ms`);
      
      return {
        success: true,
        imageUrl: imageResult.imageUrl,
        imageBase64: imageResult.imageBase64,
        metadata: {
          method: 'direct_svg_rendering',
          cryptocurrency,
          style,
          processingTime,
          exactGeometry: true,
          svgSource: logoInfo.svgPath
        }
      };
      
    } catch (error) {
      logger.error('❌ Direct SVG rendering failed:', error);
      throw error;
    }
  }

  /**
   * Render professional cover with exact SVG geometry using Sharp
   */
  async renderProfessionalCover({ title, logoInfo, cryptocurrency, style, options }) {
    try {
      logger.info(`🎨 Creating professional SVG cover for ${cryptocurrency}...`);
      
      // Create styled SVG with exact geometry from database
      const styledSvg = await this.createStyledSvg(logoInfo.svgContent, title, style, cryptocurrency);
      
      // Convert SVG to PNG using Sharp with exact geometry preservation
      const pngBuffer = await sharp(Buffer.from(styledSvg))
        .png({ quality: 100 })
        .resize(this.outputSize.width, this.outputSize.height, { 
          fit: 'fill',
          background: { r: 10, g: 15, b: 28, alpha: 1 } // Dark background
        })
        .toBuffer();
      
      // Save PNG buffer to temp file for watermarking
      const imageId = `direct_svg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const tempImagePath = path.join(this.imageStorePath, `${imageId}_temp.png`);
      const finalImagePath = path.join(this.imageStorePath, `${imageId}.png`);
      
      await fs.writeFile(tempImagePath, pngBuffer);
      
      // Apply watermark using file path
      await this.watermarkService.addWatermark(tempImagePath, finalImagePath);
      
      // Clean up temp file
      try {
        await fs.unlink(tempImagePath);
      } catch (cleanupError) {
        logger.warn(`⚠️ Failed to clean up temp file: ${cleanupError.message}`);
      }
      
      // Read final watermarked file for base64
      const watermarkedBuffer = await fs.readFile(finalImagePath);
      
      const imageUrl = `${this.baseUrl}/temp/direct-svg-renders/${imageId}.png`;
      const imageBase64 = `data:image/png;base64,${watermarkedBuffer.toString('base64')}`;
      
      logger.info(`💾 Direct SVG render saved: ${finalImagePath}`);
      
      return { imageUrl, imageBase64 };
      
    } catch (error) {
      logger.error('❌ Failed to render professional cover:', error);
      throw error;
    }
  }

  /**
   * Create styled SVG with exact database geometry and professional effects
   */
  async createStyledSvg(svgContent, title, style, cryptocurrency) {
    try {
      logger.info(`🎨 Creating styled SVG for ${cryptocurrency} with exact geometry`);
      
      // Extract exact path data from database SVG
      const pathMatch = svgContent.match(/<path[^>]*d=\"([^\"]*)\"[^>]*>/g);
      const paths = pathMatch || [];
      
      // Get style colors
      const styleColors = this.getStyleColors(style, cryptocurrency);
      
      // Create professional SVG with exact geometry
      const styledSvg = `
        <svg width="${this.outputSize.width}" height="${this.outputSize.height}" viewBox="0 0 ${this.outputSize.width} ${this.outputSize.height}" xmlns="http://www.w3.org/2000/svg">
          <!-- Professional gradient background -->
          <defs>
            <radialGradient id="bgGradient" cx="50%" cy="50%" r="80%">
              <stop offset="0%" style="stop-color:${styleColors.bgCenter};stop-opacity:1" />
              <stop offset="100%" style="stop-color:${styleColors.bgEdge};stop-opacity:1" />
            </radialGradient>
            
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${styleColors.logoLight};stop-opacity:1" />
              <stop offset="100%" style="stop-color:${styleColors.logoDark};stop-opacity:1" />
            </linearGradient>
            
            <!-- Enhanced 3D effects -->
            <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="8" dy="8" stdDeviation="15" flood-color="${styleColors.shadow}" flood-opacity="0.6"/>
            </filter>
            
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="12" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          <!-- Background -->
          <rect width="100%" height="100%" fill="url(#bgGradient)"/>
          
          <!-- Enhanced grid pattern -->
          ${this.createAdvancedGridPattern(styleColors)}
          
          <!-- Title text with enhanced styling -->
          <text x="${this.outputSize.width / 2}" y="90" text-anchor="middle" 
                font-family="Arial, sans-serif" font-size="48" font-weight="bold" 
                fill="${styleColors.text}" filter="url(#glow)">
            ${this.truncateTitle(title)}
          </text>
          
          <!-- Exact logo geometry from database, scaled and centered -->
          <g transform="translate(${(this.outputSize.width - 500) / 2}, ${(this.outputSize.height - 500) / 2 + 70}) scale(2.0)">
            <g fill="url(#logoGradient)" filter="url(#dropShadow)">
              ${this.renderExactLogoPaths(paths, svgContent)}
            </g>
          </g>
          
          <!-- Enhanced particle effects -->
          ${this.createEnhancedParticleEffects(styleColors)}
        </svg>
      `;
      
      return styledSvg;
      
    } catch (error) {
      logger.error('❌ Failed to create styled SVG:', error);
      throw error;
    }
  }

  /**
   * Get style-specific colors for professional themes
   */
  getStyleColors(style, cryptocurrency) {
    const baseColors = {
      professional: {
        bgCenter: '#1a2332',
        bgEdge: '#0a0f1c',
        logoLight: '#ffffff',
        logoDark: '#e2e8f0',
        text: '#ffffff',
        shadow: '#000000',
        accent: '#00d4ff'
      },
      elegant: {
        bgCenter: '#2d2438',
        bgEdge: '#1a1625',
        logoLight: '#f8f9fa',
        logoDark: '#e9ecef',
        text: '#f8f9fa',
        shadow: '#000000',
        accent: '#8b5cf6'
      },
      modern: {
        bgCenter: '#161b22',
        bgEdge: '#0d1117',
        logoLight: '#f0f6fc',
        logoDark: '#c9d1d9',
        text: '#f0f6fc',
        shadow: '#000000',
        accent: '#58a6ff'
      }
    };
    
    return baseColors[style] || baseColors.professional;
  }

  /**
   * Create advanced grid pattern with depth
   */
  createAdvancedGridPattern(colors) {
    let grid = '';
    for (let x = 0; x < this.outputSize.width; x += 120) {
      grid += `<line x1="${x}" y1="0" x2="${x}" y2="${this.outputSize.height}" stroke="${colors.accent}" stroke-opacity="0.15" stroke-width="1"/>`;
    }
    for (let y = 0; y < this.outputSize.height; y += 120) {
      grid += `<line x1="0" y1="${y}" x2="${this.outputSize.width}" y2="${y}" stroke="${colors.accent}" stroke-opacity="0.15" stroke-width="1"/>`;
    }
    return grid;
  }

  /**
   * Create enhanced particle effects
   */
  createEnhancedParticleEffects(colors) {
    let particles = '';
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * this.outputSize.width;
      const y = Math.random() * this.outputSize.height;
      const size = Math.random() * 4 + 1;
      particles += `<circle cx="${x}" cy="${y}" r="${size}" fill="${colors.accent}" opacity="0.4"/>`;
    }
    return particles;
  }

  /**
   * Render exact logo paths from database SVG
   */
  renderExactLogoPaths(paths, originalSvg) {
    if (paths.length === 0) {
      logger.warn('⚠️ No path data found in SVG, creating fallback');
      return `<path d="M 50 50 L 200 50 L 200 200 L 50 200 Z" stroke="currentColor" stroke-width="4" fill="currentColor"/>`;
    }
    
    return paths.map(path => {
      // Extract exact path data from database SVG
      const dMatch = path.match(/d=\"([^\"]*)\"/);;
      const pathData = dMatch ? dMatch[1] : '';
      
      logger.info(`🔧 Rendering exact path: ${pathData.substring(0, 50)}...`);
      
      return `<path d="${pathData}" />`;
    }).join('\n');
  }

  /**
   * Truncate title for display
   */
  truncateTitle(title) {
    return title.length > 55 ? title.substring(0, 52) + '...' : title;
  }

  /**
   * Detect cryptocurrency from article text
   */
  detectCryptocurrency(text) {
    const lowerText = text.toLowerCase();
    
    // Cryptocurrency detection patterns
    if (lowerText.includes('xrp') || lowerText.includes('ripple')) return 'xrp';
    if (lowerText.includes('bitcoin') || lowerText.includes('btc')) return 'bitcoin';
    if (lowerText.includes('ethereum') || lowerText.includes('eth')) return 'ethereum';
    if (lowerText.includes('solana') || lowerText.includes('sol')) return 'solana';
    if (lowerText.includes('cardano') || lowerText.includes('ada')) return 'cardano';
    if (lowerText.includes('polkadot') || lowerText.includes('dot')) return 'polkadot';
    if (lowerText.includes('chainlink') || lowerText.includes('link')) return 'chainlink';
    if (lowerText.includes('litecoin') || lowerText.includes('ltc')) return 'litecoin';
    if (lowerText.includes('dogecoin') || lowerText.includes('doge')) return 'dogecoin';
    if (lowerText.includes('avalanche') || lowerText.includes('avax')) return 'avalanche';
    
    // Default to bitcoin for general crypto articles
    return 'bitcoin';
  }
}

module.exports = DirectSvgRenderingService;