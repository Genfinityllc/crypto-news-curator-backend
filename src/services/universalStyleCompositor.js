const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const logger = require('../utils/logger');
const SVGLogoService = require('./svgLogoService');
const WatermarkService = require('./watermarkService');
const ControlNetService = require('./controlNetService'); // IMPROVED CONTROLNET FOR 3D INTEGRATION

/**
 * Universal Style Compositor Service
 * 
 * Generates diverse crypto art styles with exact logo accuracy using IMPROVED ControlNet:
 * - Exact logo accuracy through ControlNet positioning
 * - 3D scene integration through reduced conditioning + abstract guides
 * - Digital/Trading environments with integrated 3D logos
 * - Realistic 3D coins with precisely etched symbols
 * - Abstract artistic compositions with logos as scene elements
 */
class UniversalStyleCompositor {
  constructor() {
    this.timeout = 300000; // 5 minutes
    this.imageStorePath = path.join(__dirname, '../../temp/universal-styles');
    this.baseUrl = process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app';
    this.svgLogoService = new SVGLogoService();
    this.watermarkService = new WatermarkService();
    this.controlNetService = new ControlNetService(); // IMPROVED CONTROLNET FOR 3D INTEGRATION
    
    // Detailed geometric logo descriptions for integrated 3D generation
    this.logoGeometry = {
      'XRP': {
        description: 'large white 3D cryptocurrency symbol with curved X shape and curved bottom arc, sleek modern design, floating geometric form',
        detailed: 'three-dimensional white cryptocurrency logo featuring an elegant X-shaped symbol with smoothly curved intersecting lines that form a distinctive cross pattern, with a curved arc element at the bottom, rendered as a solid 3D object with clean geometric surfaces'
      },
      'BTC': {
        description: 'large orange 3D Bitcoin symbol with distinctive B letterform, dual vertical lines, geometric cryptocurrency emblem',
        detailed: 'three-dimensional orange Bitcoin logo featuring the iconic B letterform with two vertical parallel lines on the left side and curved right edges that create the distinctive Bitcoin symbol, rendered as a solid 3D geometric object'
      },
      'ETH': {
        description: 'large blue-purple 3D Ethereum diamond symbol, angular geometric crystal form, faceted pyramid structure',
        detailed: 'three-dimensional blue-purple Ethereum logo featuring the distinctive diamond-shaped symbol composed of angular geometric facets forming a crystalline structure with sharp edges and clean geometric surfaces'
      },
      'ADA': {
        description: 'large blue 3D Cardano symbol with curved interlocking circles, organic flowing geometry, smooth rounded forms',
        detailed: 'three-dimensional blue Cardano logo featuring interlocking curved circular elements that flow together organically, creating a smooth rounded geometric form with elegant curved surfaces'
      }
    };

    // Style templates with integrated 3D logo geometry (NO overlays!)
    this.styleTemplates = {
      // Digital/Trading Environment with embedded 3D logo
      digital: {
        getPrompt: (logoSymbol) => {
          const geometry = this.logoGeometry[logoSymbol] || this.generateDynamicLogoDescription(logoSymbol);
          return `${geometry.detailed} floating prominently in futuristic digital trading environment, cyberpunk atmosphere, holographic displays surrounding the 3D logo, data streams, financial technology interface, dark background with cyan and green lighting, the logo is the main focal point integrated into the scene, professional tech aesthetic, ultra detailed, 8k resolution, cinematic composition`;
        },
        negative_prompt: "flat logo, overlay, 2d symbol, text, letters, low quality, blurry, cartoon"
      },
      
      // Trading Charts with 3D coin
      trading: {
        getPrompt: (logoSymbol) => {
          const geometry = this.logoGeometry[logoSymbol] || this.generateDynamicLogoDescription(logoSymbol);
          return `hyper-realistic 3D cryptocurrency coin with ${geometry.detailed} etched into the metallic surface, floating above financial trading charts background, candlestick patterns, red and green price indicators, market data visualization, dark background, professional financial interface, the 3D coin with embedded logo is the centerpiece, high-tech trading platform aesthetic, ultra detailed, professional photography lighting`;
        },
        negative_prompt: "flat logo, overlay, 2d symbol, text on screen, low quality, cartoon"
      },
      
      // 3D Typography environment 
      typography: {
        getPrompt: (logoSymbol) => {
          const geometry = this.logoGeometry[logoSymbol] || this.generateDynamicLogoDescription(logoSymbol);
          return `${geometry.detailed} integrated as part of 3D futuristic typography environment, holographic text elements surrounding the logo, neon lighting effects, purple and green gradients, space background, the logo seamlessly blends with the 3D text elements as part of the composition, modern branding aesthetic, ultra detailed, 8k resolution, professional design`;
        },
        negative_prompt: "flat logo, overlay, 2d text, specific readable words, low quality, cartoon"
      },
      
      // Abstract artistic with logo as scene element
      abstract: {
        getPrompt: (logoSymbol) => {
          const geometry = this.logoGeometry[logoSymbol] || this.generateDynamicLogoDescription(logoSymbol);
          return `${geometry.detailed} as the central element in abstract artistic composition, geometric shapes flowing around the 3D logo, dynamic lighting casting dramatic shadows from the logo onto surrounding elements, creative digital art, modern artistic interpretation, the logo is sculpted into the scene itself, professional studio lighting, ultra detailed, 8k resolution, fine art photography`;
        },
        negative_prompt: "flat logo, overlay, 2d elements, realistic objects, low quality, cartoon"
      },
      
      // Hyper-realistic coin with etched logo
      coin: {
        getPrompt: (logoSymbol) => {
          const geometry = this.logoGeometry[logoSymbol] || this.generateDynamicLogoDescription(logoSymbol);
          return `extreme close-up of hyper-realistic 3D cryptocurrency coin with ${geometry.detailed} precisely etched and embossed into the metallic chrome surface, rainbow holographic reflections across the coin surface, floating in space, dark cosmic background with nebula, the logo is carved deep into the metal creating realistic depth and shadows, studio lighting, ultra detailed, 8k resolution, professional product photography`;
        },
        negative_prompt: "flat logo, overlay, 2d symbol, text, sketch, cartoon, low quality"
      },
      
      // Cosmic space with floating 3D logo
      cosmic: {
        getPrompt: (logoSymbol) => {
          const geometry = this.logoGeometry[logoSymbol] || this.generateDynamicLogoDescription(logoSymbol);
          return `${geometry.detailed} floating majestically in cosmic space environment, nebula clouds swirling around the 3D logo, star fields, deep space atmosphere, blue and purple cosmic lighting illuminating the logo's surfaces, the logo appears as a solid 3D object casting shadows in space, cinematic composition, ultra detailed, 8k resolution, professional space photography`;
        },
        negative_prompt: "flat logo, overlay, 2d symbol, earthly objects, low quality, cartoon"
      },
      
      // Clean professional with integrated logo
      minimal: {
        getPrompt: (logoSymbol) => {
          const geometry = this.logoGeometry[logoSymbol] || this.generateDynamicLogoDescription(logoSymbol);
          return `${geometry.detailed} as the centerpiece in minimal professional design, clean geometric background with subtle gradients, modern corporate aesthetic, professional lighting highlighting the 3D logo's form and edges, the logo is rendered as a solid architectural element in the scene, high-end brand presentation, ultra detailed, 8k resolution, professional commercial photography`;
        },
        negative_prompt: "flat logo, overlay, 2d symbol, cluttered elements, low quality, cartoon"
      }
    };
    
    this.ensureStorageDirectory().catch(err => {
      logger.error('❌ Failed to create universal style storage directory:', err);
    });
    
    logger.info('🎨 Universal Style Compositor initialized - Multiple generation types with exact logo accuracy');
  }

  async ensureStorageDirectory() {
    try {
      await fs.mkdir(this.imageStorePath, { recursive: true });
      logger.info(`📁 Universal style storage ready: ${this.imageStorePath}`);
    } catch (error) {
      logger.error('❌ Failed to create storage directory:', error);
    }
  }

  /**
   * Generate unique image ID
   */
  generateImageId() {
    const randomBytes = crypto.randomBytes(8);
    return `universal_${randomBytes.toString('hex')}`;
  }

  /**
   * IMPROVED CONTROLNET: Generate 3D integrated scenes with exact logo accuracy
   * Enhanced with dynamic background analysis based on article content
   */
  async generateStyleWithLogo(title, logoSymbol, style = 'digital', options = {}) {
    try {
      logger.info(`🎨 IMPROVED CONTROLNET: Generating 3D integrated ${logoSymbol} in ${style} style`);
      logger.info(`🔧 Using exact logo positioning + dynamic content analysis for 3D integration`);
      
      // NEW: Analyze article content for dynamic background generation
      const articleContent = options.articleContent || options.content || '';
      const contentAnalysisOptions = { articleContent, content: articleContent };
      const contentAnalysis = this.controlNetService.analyzeArticleForScene(title, contentAnalysisOptions);
      const dynamicPrompt = {
        environmentType: contentAnalysis.environment,
        fullPrompt: contentAnalysis.fullScenePrompt,
        keywords: contentAnalysis.keywords
      };
      
      // Map universal styles to ControlNet styles for compatibility
      const controlNetStyle = this.mapToControlNetStyle(style);
      
      // Use REVOLUTIONARY Two-Stage Depth-Aware ControlNet with dynamic background
      const result = await this.controlNetService.generateWithAdvancedControlNet(
        title,
        logoSymbol,
        controlNetStyle,
        {
          ...options,
          dynamicBackgroundPrompt: dynamicPrompt,  // NEW: Dynamic background based on content
          width: 1600,  // High quality cinematic aspect
          height: 900,
          steps: 80,    // High steps for detailed 3D geometry
          guidance_scale: 7.5,
          // REVOLUTIONARY FEATURES:
          // - Stage 1: Generate dynamic content-based 3D environments
          // - Stage 2: Depth-aware logo integration using MiDaS depth maps
          // - Perspective-correct logo placement with environmental interaction
          // - Multiple logo instances at various depths and angles
          style_intensity: 'revolutionary',
          quality_mode: 'cinematic_3d',
          contentAnalysis: dynamicPrompt  // Pass analysis for context
        }
      );

      if (!result.success) {
        throw new Error(`Improved ControlNet generation failed: ${result.error || 'Unknown error'}`);
      }

      // Apply watermark to final image
      if (result.localPath) {
        await this.watermarkService.addWatermark(
          result.localPath,
          result.localPath,
          { title: `${logoSymbol} ${style.charAt(0).toUpperCase() + style.slice(1)}` }
        );
      }
      
      logger.info(`✅ IMPROVED ControlNet generation completed: ${logoSymbol} ${style}`);
      
      return {
        success: true,
        imageId: result.imageId,
        imageUrl: result.imageUrl,
        localPath: result.localPath,
        metadata: {
          method: 'revolutionary_two_stage_depth_aware', // REVOLUTIONARY METHOD
          logoSymbol,
          style,
          controlNetStyle,
          improvements: [
            'two_stage_generation_process',
            'depth_aware_logo_integration',
            'perspective_correct_placement', 
            'environmental_interaction',
            'midas_depth_estimation',
            'cinematic_quality_scenes'
          ],
          template: this.styleTemplates[style] || this.styleTemplates.digital,
          timestamp: new Date().toISOString(),
          controlnet_metadata: result.metadata
        }
      };
      
    } catch (error) {
      logger.error(`❌ Improved ControlNet generation failed for ${logoSymbol} (${style}):`, error.message);
      throw error;
    }
  }

  /**
   * Map universal styles to ControlNet styles for compatibility
   */
  mapToControlNetStyle(universalStyle) {
    const styleMapping = {
      'digital': 'holographic',      // Digital → holographic for futuristic look
      'trading': 'metallic',         // Trading → metallic for professional charts  
      'typography': 'neon',          // Typography → neon for 3D text effects
      'abstract': 'artistic',        // Abstract → artistic for creative compositions
      'coin': 'metallic',           // Coin → metallic for 3D coin effects
      'cosmic': 'holographic',      // Cosmic → holographic for space effects
      'minimal': 'professional'     // Minimal → professional for clean design
    };
    
    const mappedStyle = styleMapping[universalStyle] || 'holographic';
    logger.info(`🎯 Mapped universal style '${universalStyle}' → ControlNet style '${mappedStyle}'`);
    return mappedStyle;
  }

  /**
   * NEW: Analyze article content for dynamic background generation
   * This replaces static ugly radial backgrounds with content-based environments
   */
  analyzeContentForBackground(title, content, logoSymbol, style) {
    const fullText = `${title} ${content}`.toLowerCase();
    
    logger.info(`🧠 Analyzing article content for dynamic background: "${title.substring(0, 50)}..."`);
    
    // Detect article themes and generate appropriate backgrounds
    let environmentType = '';
    let atmosphereElements = '';
    let lightingStyle = '';
    let additionalElements = '';
    
    // Technology/Innovation themes
    if (fullText.includes('technology') || fullText.includes('innovation') || 
        fullText.includes('breakthrough') || fullText.includes('development') ||
        fullText.includes('upgrade') || fullText.includes('protocol')) {
      environmentType = 'high-tech laboratory with advanced holographic displays and floating data visualizations';
      atmosphereElements = 'blue and white technological lighting, clean futuristic architecture';
      lightingStyle = 'cool ambient lighting with bright accent highlights';
    }
    
    // Trading/Market themes  
    else if (fullText.includes('trading') || fullText.includes('market') || 
             fullText.includes('price') || fullText.includes('exchange') ||
             fullText.includes('volume') || fullText.includes('chart')) {
      environmentType = 'sophisticated trading floor with multiple curved displays showing market data';
      atmosphereElements = 'dynamic candlestick charts, flowing data streams, professional finance environment';
      lightingStyle = 'dramatic professional lighting with green and red market indicators';
    }
    
    // Financial/Banking themes
    else if (fullText.includes('bank') || fullText.includes('payment') || 
             fullText.includes('finance') || fullText.includes('institution') ||
             fullText.includes('regulatory') || fullText.includes('compliance')) {
      environmentType = 'premium corporate boardroom with sophisticated digital interfaces';
      atmosphereElements = 'elegant marble surfaces, floating holographic financial reports, executive presentation setup';
      lightingStyle = 'warm sophisticated lighting with golden accent tones';
    }
    
    // Security/Privacy themes
    else if (fullText.includes('security') || fullText.includes('privacy') || 
             fullText.includes('encryption') || fullText.includes('hack') ||
             fullText.includes('protection') || fullText.includes('safe')) {
      environmentType = 'high-security cyber command center with encrypted data visualizations';
      atmosphereElements = 'digital shield effects, secure network visualization, cyber security aesthetics';
      lightingStyle = 'dramatic blue and purple cybersecurity lighting with digital effects';
    }
    
    // Partnership/Collaboration themes
    else if (fullText.includes('partnership') || fullText.includes('collaboration') || 
             fullText.includes('alliance') || fullText.includes('agreement') ||
             fullText.includes('integration') || fullText.includes('merge')) {
      environmentType = 'modern conference space with interconnected digital networks';
      atmosphereElements = 'flowing connection lines, network nodes, collaborative workspace visualization';
      lightingStyle = 'bright collaborative lighting with warm interconnection highlights';
    }
    
    // Regulatory/Legal themes
    else if (fullText.includes('regulation') || fullText.includes('legal') || 
             fullText.includes('government') || fullText.includes('law') ||
             fullText.includes('policy') || fullText.includes('compliance')) {
      environmentType = 'formal government chamber with digital policy documents';
      atmosphereElements = 'official architecture, digital legislation displays, formal governmental setting';
      lightingStyle = 'formal institutional lighting with authoritative ambiance';
    }
    
    // Environmental/Sustainability themes
    else if (fullText.includes('green') || fullText.includes('sustainable') || 
             fullText.includes('environment') || fullText.includes('carbon') ||
             fullText.includes('energy') || fullText.includes('eco')) {
      environmentType = 'sustainable technology center with green energy visualizations';
      atmosphereElements = 'flowing green energy patterns, eco-friendly tech displays, renewable energy aesthetics';
      lightingStyle = 'natural green lighting with sustainable technology highlights';
    }
    
    // Default: Modern professional environment
    else {
      environmentType = 'sleek modern digital workspace with clean professional architecture';
      atmosphereElements = 'minimalist tech displays, professional presentation setup, contemporary design elements';
      lightingStyle = 'clean professional lighting with modern accent highlights';
    }
    
    // Build the complete dynamic prompt
    const dynamicPrompt = `${environmentType}, ${atmosphereElements}, ${lightingStyle}, 
    photorealistic 3D environment with cinematic depth and atmosphere, 
    the ${logoSymbol} cryptocurrency logo naturally integrated into the scene architecture,
    professional photography quality, 8k resolution, dramatic composition, 
    absolutely no flat overlays or 2D elements, pure 3D environmental integration`;
    
    logger.info(`🎨 Generated dynamic background: ${environmentType}`);
    return {
      fullPrompt: dynamicPrompt,
      environmentType,
      atmosphereElements,
      lightingStyle,
      logoSymbol,
      themes: this.extractThemes(fullText)
    };
  }
  
  /**
   * Extract key themes from article content for background generation
   */
  extractThemes(text) {
    const themes = [];
    
    if (text.includes('technology') || text.includes('innovation')) themes.push('technology');
    if (text.includes('trading') || text.includes('market')) themes.push('trading');
    if (text.includes('bank') || text.includes('finance')) themes.push('finance');
    if (text.includes('security') || text.includes('privacy')) themes.push('security');
    if (text.includes('partnership') || text.includes('collaboration')) themes.push('partnership');
    if (text.includes('regulation') || text.includes('legal')) themes.push('regulatory');
    if (text.includes('green') || text.includes('sustainable')) themes.push('environmental');
    
    return themes;
  }

  /**
   * Add more detailed geometric descriptions for other cryptocurrencies
   */
  addLogoGeometry(symbol, description, detailed) {
    this.logoGeometry[symbol.toUpperCase()] = { description, detailed };
    logger.info(`📐 Added geometric description for ${symbol}`);
  }

  /**
   * Get available logo symbols with geometric descriptions
   */
  getAvailableLogos() {
    return Object.keys(this.logoGeometry).map(symbol => ({
      symbol,
      description: this.logoGeometry[symbol].description,
      hasDetailedGeometry: true
    }));
  }

  /**
   * Generate detailed description for custom logo symbols not in the geometry database
   */
  generateDynamicLogoDescription(logoSymbol) {
    // Fallback for symbols not in our geometry database
    const commonCryptos = {
      'SOL': 'large purple-blue 3D Solana symbol with curved gradient circular form',
      'MATIC': 'large purple 3D Polygon symbol with interconnected diamond shapes',
      'AVAX': 'large red 3D Avalanche symbol with triangular mountain peak design',
      'DOT': 'large pink 3D Polkadot symbol with circular dots pattern',
      'LINK': 'large blue 3D Chainlink symbol with interconnected hexagonal chain links'
    };
    
    const basic = commonCryptos[logoSymbol.toUpperCase()];
    if (basic) {
      return {
        description: basic,
        detailed: `three-dimensional ${basic} rendered as a solid geometric object with clean surfaces and professional finish`
      };
    }
    
    // Generic fallback
    return {
      description: `large 3D ${logoSymbol} cryptocurrency symbol with modern geometric design`,
      detailed: `three-dimensional ${logoSymbol} cryptocurrency logo featuring distinctive geometric elements rendered as a solid object with clean surfaces`
    };
  }

  /**
   * Update style templates to use dynamic logo descriptions
   */
  updateStyleTemplates() {
    // This ensures our templates use the most current geometry data
    Object.keys(this.styleTemplates).forEach(styleKey => {
      const template = this.styleTemplates[styleKey];
      if (typeof template.getPrompt === 'function') {
        // Templates are already using dynamic functions - good!
        logger.info(`✅ Style template '${styleKey}' uses dynamic logo geometry`);
      }
    });
  }


  /**
   * Get available styles
   */
  getAvailableStyles() {
    return Object.keys(this.styleTemplates).map(key => ({
      name: key,
      description: this.getStyleDescription(key)
    }));
  }

  /**
   * Get style description
   */
  getStyleDescription(style) {
    const descriptions = {
      digital: 'Futuristic digital trading environment with tech aesthetics',
      trading: 'Financial charts and market data visualization backgrounds',
      typography: '3D typography and holographic text integration',
      abstract: 'Abstract artistic compositions with creative elements',
      coin: 'Hyper-realistic 3D coins with metallic finishes',
      cosmic: 'Space environments with nebula and cosmic lighting',
      minimal: 'Clean minimalist design for professional contexts'
    };
    return descriptions[style] || 'Custom style generation';
  }

  /**
   * Get hosted image URL
   */
  getImageUrl(imageId) {
    return `${this.baseUrl}/temp/universal-styles/${imageId}_final.png`;
  }
}

module.exports = UniversalStyleCompositor;