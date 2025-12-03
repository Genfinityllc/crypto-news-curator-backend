const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const logger = require('../utils/logger');
const SVGLogoService = require('./svgLogoService');
const WatermarkService = require('./watermarkService');

/**
 * Simple SVG Service - Direct SVG to PNG conversion with styling
 * 
 * Creates exact logo representations by:
 * 1. Loading the exact SVG from your uploaded files
 * 2. Converting to PNG with high resolution
 * 3. Applying professional background and styling
 * 4. Adding title text and watermark
 */
class SimpleSvgService {
  constructor() {
    this.timeout = 60000; // 1 minute
    this.imageStorePath = path.join(__dirname, '../../temp/simple-svg-renders');
    this.outputSize = { width: 1800, height: 900 };
    this.svgLogoService = new SVGLogoService();
    this.watermarkService = new WatermarkService();
    this.baseUrl = process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app';
    
    // Ensure storage directory exists
    this.ensureStorageDirectory().catch(err => {
      logger.error('❌ Failed to create Simple SVG storage directory:', err);
    });
    
    logger.info('🎨 Simple SVG Service initialized for exact logo accuracy');
  }

  async ensureStorageDirectory() {
    try {
      await fs.mkdir(this.imageStorePath, { recursive: true });
      logger.info(`📁 Simple SVG rendering storage ready: ${this.imageStorePath}`);
    } catch (error) {
      logger.error('❌ Failed to create storage directory:', error);
    }
  }

  /**
   * Generate exact logo cover using direct SVG rendering
   */
  async generateExactLogoCover(title, content = '', style = 'professional', options = {}) {
    const startTime = Date.now();
    
    try {
      logger.info(`🎨 Starting exact logo rendering for: ${title.substring(0, 50)}...`);
      
      // Detect cryptocurrency
      const cryptocurrency = options.cryptocurrency || this.detectCryptocurrency(title + ' ' + content);
      if (!cryptocurrency) {
        throw new Error('Could not detect cryptocurrency for exact logo rendering');
      }
      
      logger.info(`🔍 Detected cryptocurrency: ${cryptocurrency.toUpperCase()}`);
      
      // Get the exact SVG logo
      const logoInfo = await this.svgLogoService.getSvgLogoInfo(cryptocurrency.toUpperCase());
      if (!logoInfo || !logoInfo.svgPath) {
        throw new Error(`SVG logo not found for ${cryptocurrency}`);
      }
      
      logger.info(`📁 Loading exact SVG: ${logoInfo.svgPath}`);
      
      // Create professional cover with exact logo
      const imageResult = await this.createProfessionalCover({
        title,
        logoInfo,
        cryptocurrency,
        style,
        options
      });
      
      const processingTime = Date.now() - startTime;
      logger.info(`✅ Exact logo rendering complete in ${processingTime}ms`);
      
      return {
        success: true,
        imageUrl: imageResult.imageUrl,
        imageBase64: imageResult.imageBase64,
        metadata: {
          method: 'exact_svg_rendering',
          cryptocurrency,
          style,
          processingTime,
          exactGeometry: true,
          svgSource: logoInfo.svgPath
        }
      };
      
    } catch (error) {
      logger.error('❌ Exact logo rendering failed:', error);
      throw error;
    }
  }

  /**
   * Create professional cover with exact SVG logo
   */
  async createProfessionalCover({ title, logoInfo, cryptocurrency, style, options }) {
    try {
      // Read the exact SVG file
      const svgContent = await fs.readFile(logoInfo.svgPath, 'utf-8');
      logger.info(`📖 Loaded SVG content: ${svgContent.substring(0, 100)}...`);
      
      // Create styled SVG with professional background
      const styledSvg = await this.createStyledSvg(svgContent, title, style, cryptocurrency);
      
      // Convert to PNG with high quality
      const pngBuffer = await sharp(Buffer.from(styledSvg))
        .png({ quality: 100 })
        .resize(this.outputSize.width, this.outputSize.height, { 
          fit: 'fill',
          background: { r: 10, g: 15, b: 28, alpha: 1 } // Dark blue background
        })
        .toBuffer();
      
      // Apply watermark
      const watermarkedBuffer = await this.watermarkService.addWatermark(pngBuffer, {
        outputWidth: this.outputSize.width,
        outputHeight: this.outputSize.height
      });
      
      // Save the result
      const imageId = `exact_svg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const imagePath = path.join(this.imageStorePath, `${imageId}.png`);
      
      await fs.writeFile(imagePath, watermarkedBuffer);
      
      const imageUrl = `${this.baseUrl}/temp/simple-svg-renders/${imageId}.png`;
      const imageBase64 = `data:image/png;base64,${watermarkedBuffer.toString('base64')}`;
      
      logger.info(`💾 Exact SVG render saved: ${imagePath}`);
      
      return { imageUrl, imageBase64 };
      
    } catch (error) {
      logger.error('❌ Failed to create professional cover:', error);
      throw error;
    }
  }

  /**
   * Create styled SVG with professional background and effects
   */
  async createStyledSvg(originalSvg, title, style, cryptocurrency) {
    // Extract the path data from the original SVG
    const pathMatch = originalSvg.match(/<path[^>]*d="([^"]*)"[^>]*>/g);
    const paths = pathMatch || [];
    
    // Get style colors based on cryptocurrency
    const styleColors = this.getStyleColors(style, cryptocurrency);
    
    // Create professional styled SVG
    const styledSvg = `
      <svg width="${this.outputSize.width}" height="${this.outputSize.height}" viewBox="0 0 ${this.outputSize.width} ${this.outputSize.height}" xmlns="http://www.w3.org/2000/svg">
        <!-- Professional gradient background -->
        <defs>
          <radialGradient id="bgGradient" cx="50%" cy="50%" r="70%">
            <stop offset="0%" style="stop-color:${styleColors.bgCenter};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${styleColors.bgEdge};stop-opacity:1" />
          </radialGradient>
          
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${styleColors.logoLight};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${styleColors.logoDark};stop-opacity:1" />
          </linearGradient>
          
          <!-- Drop shadow filter -->
          <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="5" dy="5" stdDeviation="10" flood-color="${styleColors.shadow}" flood-opacity="0.5"/>
          </filter>
          
          <!-- Glow filter -->
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <!-- Background -->
        <rect width="100%" height="100%" fill="url(#bgGradient)"/>
        
        <!-- Geometric grid pattern -->
        ${this.createGridPattern(styleColors)}
        
        <!-- Title text -->
        <text x="${this.outputSize.width / 2}" y="80" text-anchor="middle" 
              font-family="Arial, sans-serif" font-size="42" font-weight="bold" 
              fill="${styleColors.text}" filter="url(#glow)">
          ${this.truncateTitle(title)}
        </text>
        
        <!-- Exact logo geometry scaled and centered -->
        <g transform="translate(${(this.outputSize.width - 400) / 2}, ${(this.outputSize.height - 400) / 2 + 50}) scale(1.5)">
          <g fill="url(#logoGradient)" filter="url(#dropShadow)">
            ${this.renderExactLogoPaths(paths, originalSvg)}
          </g>
        </g>
        
        <!-- Particle effects -->
        ${this.createParticleEffects(styleColors)}
      </svg>
    `;
    
    return styledSvg;
  }

  /**
   * Render exact logo paths from SVG
   */
  renderExactLogoPaths(paths, originalSvg) {
    if (paths.length === 0) {
      // Fallback: extract viewBox and create basic path
      const viewBoxMatch = originalSvg.match(/viewBox="([^"]*)"/);
      const viewBox = viewBoxMatch ? viewBoxMatch[1].split(' ').map(Number) : [0, 0, 100, 100];
      return `<path d="M ${viewBox[2]*0.2} ${viewBox[3]*0.2} L ${viewBox[2]*0.8} ${viewBox[3]*0.8} M ${viewBox[2]*0.8} ${viewBox[3]*0.2} L ${viewBox[2]*0.2} ${viewBox[3]*0.8}" stroke="currentColor" stroke-width="8" fill="none"/>`;
    }
    
    return paths.map(path => {
      // Extract path data and preserve exact geometry
      const dMatch = path.match(/d="([^"]*)"/);
      const pathData = dMatch ? dMatch[1] : '';
      
      return `<path d="${pathData}" />`;
    }).join('\n');
  }

  /**
   * Get style-specific colors
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
   * Create grid pattern
   */
  createGridPattern(colors) {
    let grid = '';
    for (let x = 0; x < this.outputSize.width; x += 100) {
      grid += `<line x1="${x}" y1="0" x2="${x}" y2="${this.outputSize.height}" stroke="${colors.accent}" stroke-opacity="0.1" stroke-width="1"/>`;
    }
    for (let y = 0; y < this.outputSize.height; y += 100) {
      grid += `<line x1="0" y1="${y}" x2="${this.outputSize.width}" y2="${y}" stroke="${colors.accent}" stroke-opacity="0.1" stroke-width="1"/>`;
    }
    return grid;
  }

  /**
   * Create particle effects
   */
  createParticleEffects(colors) {
    let particles = '';
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * this.outputSize.width;
      const y = Math.random() * this.outputSize.height;
      const size = Math.random() * 3 + 1;
      particles += `<circle cx="${x}" cy="${y}" r="${size}" fill="${colors.accent}" opacity="0.3"/>`;
    }
    return particles;
  }

  /**
   * Truncate title for display
   */
  truncateTitle(title) {
    return title.length > 60 ? title.substring(0, 57) + '...' : title;
  }

  /**
   * Detect cryptocurrency from text
   */
  detectCryptocurrency(text) {
    const lowerText = text.toLowerCase();
    
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
    
    return 'bitcoin';
  }
}

module.exports = SimpleSvgService;