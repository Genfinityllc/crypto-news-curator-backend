const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const Sharp = require('sharp');
const axios = require('axios');

class NanoBananaService {
  constructor() {
    this.googleApiKey = process.env.GOOGLE_AI_API_KEY;
    this.genAI = null;
    this.initialized = false;
    
    if (!this.googleApiKey) {
      logger.warn('Google AI API key not found. Nano Banana service will be disabled.');
      return;
    }
    
    this.initialize();
  }

  async initialize() {
    try {
      // Initialize Nano Banana with Google AI (Gemini 2.5 Flash Image)
      this.genAI = new GoogleGenerativeAI(this.googleApiKey);
      this.initialized = true;
      logger.info('✅ Nano Banana service initialized with Google Gemini 2.5 Flash Image');
    } catch (error) {
      logger.error('❌ Failed to initialize Nano Banana service:', error.message);
      this.initialized = false;
    }
  }

  isAvailable() {
    return this.initialized && this.googleApiKey;
  }

  /**
   * Generate crypto-themed image for news articles
   */
  async generateCryptoNewsImage(articleData, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Nano Banana service not available');
    }

    const {
      size = 'medium',
      style = 'professional',
      includeNetwork = true,
      aspectRatio = '16:9'
    } = options;

    try {
      logger.info(`🎨 Generating Nano Banana image for: ${articleData.title}`);

      // Create sophisticated crypto-themed prompt
      const prompt = this.createCryptoPrompt(articleData, { style, includeNetwork, aspectRatio });
      
      logger.info(`📝 Using prompt: ${prompt}`);

      // Use Google AI Gemini 2.5 Flash Image (Nano Banana)
      logger.info('🍌 Generating image with Nano Banana (Google Gemini 2.5 Flash Image)');
      
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash-image-preview" });
      
      const result = await model.generateContent([prompt]);
      const response = await result.response;
      
      // Extract image data from response following official Gemini pattern
      const parts = response.candidates[0].content.parts;
      let imageBuffer = null;
      
      for (const part of parts) {
        if (part.text !== null && part.text !== undefined) {
          logger.info(`🍌 Nano Banana response text: ${part.text}`);
        } else if (part.inline_data !== null && part.inline_data !== undefined) {
          logger.info('🍌 Found image data in Nano Banana response');
          imageBuffer = Buffer.from(part.inline_data.data, 'base64');
          break;
        }
      }
      
      if (!imageBuffer) {
        throw new Error('No image data found in Nano Banana response');
      }
      
      // Process with title overlay
      const savedImage = await this.processAndSaveImageWithTitle(imageBuffer, articleData, size);
      
      logger.info(`✅ Nano Banana image generated successfully: ${savedImage.filename}`);
      return savedImage;

    } catch (error) {
      logger.error('❌ Nano Banana image generation failed:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        code: error.code,
        stack: error.stack?.substring(0, 500),
        details: error.details || error.response?.data
      });
      
      // Final fallback to enhanced placeholder with title overlay
      try {
        const fallbackImage = await this.generateEnhancedPlaceholderWithTitle(articleData, options);
        logger.info(`🔄 Using fallback placeholder image with title overlay: ${fallbackImage.filename}`);
        return fallbackImage;
      } catch (fallbackError) {
        logger.error('❌ Even fallback generation failed:', fallbackError.message);
        throw error;
      }
    }
  }

  /**
   * Call the real Nano Banana API for context-based image generation
   */
  async callNanoBananaAPI(prompt, articleData) {
    try {
      logger.info('🍌 Generating Nano Banana style image with context prompt');
      
      // For now, since we don't have the real Nano Banana API endpoint,
      // let's generate professional crypto-themed images directly
      // This simulates what Nano Banana would return
      
      logger.info('📝 Processing context for Nano Banana style generation');
      
      // Simulate API processing time
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate a high-quality crypto-themed image buffer
      const imageBuffer = await this.generateNanoBananaStyleImage(articleData);
      
      logger.info('✅ Nano Banana style image generation completed');
      
      return {
        imageBuffer: imageBuffer,
        success: true,
        service: 'nano-banana-simulation',
        prompt: prompt
      };
      
    } catch (error) {
      logger.error('❌ Nano Banana style generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate Nano Banana style image (simulation until real API is available)
   */
  async generateNanoBananaStyleImage(articleData) {
    const networkColors = {
      'Bitcoin': '#f7931a',
      'Ethereum': '#627eea', 
      'Hedera': '#8a2be2',
      'XDC Network': '#0066cc',
      'Algorand': '#00d4aa',
      'Constellation': '#ff6b9d',
      'Solana': '#14f195',
      'Cardano': '#0033ad',
      'Polygon': '#8247e5',
      'default': '#0066cc'
    };
    
    const primaryColor = networkColors[articleData.network] || networkColors.default;
    const secondaryColor = '#1a1a1a';
    
    // Create a professional crypto-themed SVG that looks like AI-generated content
    const width = 1024;
    const height = 1024;
    
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="mainGrad" cx="30%" cy="30%" r="70%">
            <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:0.9" />
            <stop offset="50%" style="stop-color:${primaryColor};stop-opacity:0.6" />
            <stop offset="100%" style="stop-color:${secondaryColor};stop-opacity:0.9" />
          </radialGradient>
          <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:0.3" />
            <stop offset="100%" style="stop-color:#ffffff;stop-opacity:0.1" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <!-- Background -->
        <rect width="100%" height="100%" fill="url(#mainGrad)" />
        
        <!-- Geometric patterns -->
        <polygon points="150,100 250,100 200,200" fill="url(#accentGrad)" opacity="0.7" filter="url(#glow)"/>
        <circle cx="800" cy="200" r="80" fill="${primaryColor}" opacity="0.4" filter="url(#glow)"/>
        <rect x="600" y="600" width="150" height="150" fill="url(#accentGrad)" opacity="0.5" transform="rotate(45 675 675)"/>
        
        <!-- Network/blockchain visualization -->
        <circle cx="200" cy="800" r="30" fill="${primaryColor}" opacity="0.8"/>
        <circle cx="400" cy="750" r="25" fill="${primaryColor}" opacity="0.7"/>
        <circle cx="600" cy="850" r="35" fill="${primaryColor}" opacity="0.6"/>
        <line x1="200" y1="800" x2="400" y2="750" stroke="${primaryColor}" stroke-width="3" opacity="0.5"/>
        <line x1="400" y1="750" x2="600" y2="850" stroke="${primaryColor}" stroke-width="3" opacity="0.5"/>
        
        <!-- Abstract crypto symbols -->
        <path d="M 100 500 Q 150 450 200 500 Q 250 550 300 500" stroke="${primaryColor}" stroke-width="4" fill="none" opacity="0.6" filter="url(#glow)"/>
        <path d="M 700 400 L 750 350 L 800 400 L 750 450 Z" fill="url(#accentGrad)" opacity="0.7"/>
        
        <!-- Additional tech elements -->
        <rect x="50" y="300" width="100" height="4" fill="${primaryColor}" opacity="0.8"/>
        <rect x="50" y="320" width="150" height="4" fill="${primaryColor}" opacity="0.6"/>
        <rect x="50" y="340" width="120" height="4" fill="${primaryColor}" opacity="0.4"/>
      </svg>
    `;
    
    const imageBuffer = await Sharp(Buffer.from(svg))
      .png({ quality: 95 })
      .toBuffer();
    
    return imageBuffer;
  }

  /**
   * Create sophisticated crypto-themed prompts
   */
  createCryptoPrompt(articleData, options) {
    const { title, network, category, sentiment } = articleData;
    const { style, includeNetwork, aspectRatio } = options;

    // Network-specific visual themes
    const networkThemes = {
      'Hedera': 'futuristic holographic grid with purple and silver accents, hashgraph network patterns',
      'XDC Network': 'enterprise blockchain infrastructure with blue and gold geometric patterns',
      'Algorand': 'pure proof-of-stake visualization with green energy flows and algorithmic structures',
      'Constellation': 'cosmic network topology with star constellation patterns and DAG architecture',
      'HashPack': 'secure wallet interface with cryptographic security patterns and purple gradients',
      'Bitcoin': 'golden digital architecture with mining imagery and blockchain structures',
      'Ethereum': 'smart contract visualization with blue ethereal energy and decentralized patterns',
      'default': 'abstract cryptocurrency symbols with blockchain network visualization'
    };

    // Style variations
    const stylePresets = {
      professional: 'clean, corporate, minimal design with subtle gradients',
      futuristic: 'cyberpunk aesthetic with neon lighting and digital elements',
      elegant: 'sophisticated luxury design with premium materials and lighting',
      dynamic: 'energetic composition with motion blur and dynamic angles',
      abstract: 'artistic interpretation with geometric shapes and color theory'
    };

    // Sentiment-based color schemes
    const sentimentColors = {
      positive: 'vibrant greens, golds, and upward trending visual elements',
      negative: 'sophisticated reds, oranges with downward trending but not alarming elements',
      neutral: 'balanced blues, purples, and stable horizontal elements',
      bullish: 'emerald greens, bright golds with rocket or arrow imagery',
      bearish: 'deep reds, amber oranges with subtle declining elements but maintained professionalism'
    };

    const networkTheme = networkThemes[network] || networkThemes.default;
    const stylePreset = stylePresets[style] || stylePresets.professional;
    const colorScheme = sentimentColors[sentiment] || sentimentColors.neutral;

    // Create narrative, descriptive prompt following Google's best practices
    let prompt = `A photorealistic, high-resolution cryptocurrency news image in ${aspectRatio} aspect ratio. The scene depicts a professional financial technology environment that captures the essence of "${title}". `;
    
    if (includeNetwork && network) {
      prompt += `The composition centers around ${network} blockchain technology, featuring ${networkThemes[network] || networkThemes.default}. `;
    }
    
    prompt += `The overall aesthetic follows a ${stylePresets[style] || stylePresets.professional} approach, with a sophisticated color palette emphasizing ${sentimentColors[sentiment] || sentimentColors.neutral}. `;
    
    // Add category-specific narrative elements
    if (category) {
      const categoryNarratives = {
        market: 'The background subtly incorporates flowing price charts and elegant trading interfaces, with soft candlestick patterns creating depth and movement.',
        technology: 'Intricate blockchain architecture elements weave through the composition, with smart contract visualizations and technical diagrams forming an sophisticated technological landscape.',
        regulation: 'The setting conveys institutional authority with refined governmental and legal imagery, featuring clean architectural lines and compliance-focused design elements.',
        adoption: 'The scene illustrates mainstream cryptocurrency integration with modern user interfaces and adoption metrics flowing seamlessly through the composition.',
        partnership: 'Corporate collaboration themes dominate the scene, with elegant handshake imagery and business network visualizations creating a sense of unity and progress.',
        security: 'Advanced cybersecurity elements form the foundation, with encryption patterns and digital safety imagery creating a secure, trustworthy atmosphere.'
      };
      
      if (categoryNarratives[category]) {
        prompt += categoryNarratives[category] + ' ';
      }
    }

    // Final composition instructions following Gemini best practices
    prompt += `The lighting is studio-quality with professional three-point setup, creating depth and visual interest. The image should be ultra-realistic with sharp focus on key technological elements, suitable for premium financial news publication. Avoid any text overlays or typography - focus purely on visual storytelling and symbolic representation.`;

    return prompt;
  }

  /**
   * Process and save image with centered title overlay
   */
  async processAndSaveImageWithTitle(imageBuffer, articleData, size) {
    try {
      const timestamp = Date.now();
      const networkSlug = (articleData.network || 'crypto').toLowerCase().replace(/\s+/g, '-');
      const filename = `nano-banana-${networkSlug}-${timestamp}.jpg`;
      const filepath = path.join(__dirname, '..', '..', 'temp', filename);

      // Ensure temp directory exists
      const tempDir = path.join(__dirname, '..', '..', 'temp');
      await fs.mkdir(tempDir, { recursive: true });

      // Size configurations
      const sizeConfigs = {
        small: { width: 300, height: 169 },   // 16:9 small
        medium: { width: 400, height: 225 },  // 16:9 medium  
        large: { width: 500, height: 281 },   // 16:9 large
        square: { width: 300, height: 300 }   // 1:1 square
      };

      const config = sizeConfigs[size] || sizeConfigs.medium;

      // Create title overlay SVG
      const title = articleData.title || 'Crypto News Update';
      const titleSvg = this.createTitleOverlaySvg(title, config);

      // Process image with Sharp and add title overlay
      const processedImage = await Sharp(imageBuffer)
        .resize(config.width, config.height, {
          fit: 'cover',
          position: 'center'
        })
        .composite([{
          input: Buffer.from(titleSvg),
          top: 0,
          left: 0
        }])
        .jpeg({ 
          quality: 90,
          progressive: true 
        })
        .toBuffer();

      // Save main image
      await fs.writeFile(filepath, processedImage);

      // Create card images for different sizes with title overlays
      const cardImages = {};
      for (const [sizeName, sizeConfig] of Object.entries(sizeConfigs)) {
        const cardImagePath = path.join(tempDir, `nano-banana-${networkSlug}-${timestamp}-${sizeName}.jpg`);
        const cardTitleSvg = this.createTitleOverlaySvg(title, sizeConfig);
        
        await Sharp(imageBuffer)
          .resize(sizeConfig.width, sizeConfig.height, {
            fit: 'cover',
            position: 'center'
          })
          .composite([{
            input: Buffer.from(cardTitleSvg),
            top: 0,
            left: 0
          }])
          .jpeg({ quality: 90, progressive: true })
          .toFile(cardImagePath);
        
        cardImages[sizeName] = `/temp/nano-banana-${networkSlug}-${timestamp}-${sizeName}.jpg`;
      }

      return {
        filename,
        path: `/temp/${filename}`,
        fullPath: filepath,
        cardImages,
        size: config,
        generated: true,
        withTitleOverlay: true,
        service: 'nano-banana'
      };

    } catch (error) {
      logger.error('❌ Failed to process Nano Banana image with title overlay:', error.message);
      throw error;
    }
  }

  /**
   * Create SVG title overlay for centering text on image
   */
  createTitleOverlaySvg(title, dimensions) {
    const { width, height } = dimensions;
    
    // Calculate font size based on image width (responsive text)
    const baseFontSize = Math.max(14, Math.min(32, width / 15));
    const titleLength = title.length;
    const fontSize = titleLength > 50 ? baseFontSize * 0.8 : baseFontSize;
    
    // Break long titles into multiple lines
    const maxCharsPerLine = Math.floor(width / (fontSize * 0.6));
    const words = title.split(' ');
    const lines = [];
    let currentLine = '';
    
    words.forEach(word => {
      if ((currentLine + word).length <= maxCharsPerLine) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });
    if (currentLine) lines.push(currentLine);

    // Limit to 3 lines maximum
    const finalLines = lines.slice(0, 3);
    const lineHeight = fontSize * 1.2;
    const totalTextHeight = finalLines.length * lineHeight;
    const startY = (height - totalTextHeight) / 2 + fontSize;

    // Create text elements for each line
    const textElements = finalLines.map((line, index) => {
      const y = startY + (index * lineHeight);
      return `
        <text x="50%" y="${y}" text-anchor="middle" 
              fill="white" 
              stroke="rgba(0,0,0,0.8)" 
              stroke-width="2"
              font-family="Arial, sans-serif" 
              font-size="${fontSize}px" 
              font-weight="bold">${line}</text>
      `;
    }).join('');

    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.7)"/>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.3)" />
        <g filter="url(#shadow)">
          ${textElements}
        </g>
      </svg>
    `;
  }

  /**
   * Generate enhanced placeholder image with title overlay
   */
  async generateEnhancedPlaceholderWithTitle(articleData, options = {}) {
    const { size = 'medium' } = options;
    
    try {
      // Create a colored placeholder based on network/category
      const networkColors = {
        'Bitcoin': '#f7931a',
        'Ethereum': '#627eea', 
        'Hedera': '#8a2be2',
        'XDC Network': '#0066cc',
        'Algorand': '#00d4aa',
        'Constellation': '#ff6b9d',
        'default': '#0066cc'
      };
      
      const color = networkColors[articleData.network] || networkColors.default;
      
      // Generate a gradient placeholder using Sharp
      const width = 1024;
      const height = 1024;
      
      // Create SVG for gradient background
      const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
              <stop offset="100%" style="stop-color:#000000;stop-opacity:0.8" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grad1)" />
          <circle cx="200" cy="200" r="50" fill="rgba(255,255,255,0.1)" />
          <circle cx="800" cy="600" r="80" fill="rgba(255,255,255,0.05)" />
          <rect x="100" y="400" width="200" height="200" fill="rgba(255,255,255,0.03)" />
        </svg>
      `;
      
      const imageBuffer = await Sharp(Buffer.from(svg))
        .png()
        .toBuffer();
      
      const result = await this.processAndSaveImageWithTitle(imageBuffer, articleData, size);
      result.isPlaceholder = true;
      result.service = 'nano-banana-placeholder';
      
      return result;
      
    } catch (error) {
      logger.error('❌ Failed to generate enhanced placeholder with title overlay:', error.message);
      throw error;
    }
  }

  /**
   * Generate enhanced placeholder image when API is not available
   */
  async generateEnhancedPlaceholder(articleData, options = {}) {
    const { size = 'medium' } = options;
    
    try {
      // Create a colored placeholder based on network/category
      const networkColors = {
        'Bitcoin': '#f7931a',
        'Ethereum': '#627eea', 
        'Hedera': '#8a2be2',
        'XDC Network': '#0066cc',
        'Algorand': '#00d4aa',
        'Constellation': '#ff6b9d',
        'default': '#0066cc'
      };
      
      const color = networkColors[articleData.network] || networkColors.default;
      
      // Generate a gradient placeholder using Sharp
      const width = 1024;
      const height = 1024;
      
      // Create SVG for gradient background
      const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
              <stop offset="100%" style="stop-color:#000000;stop-opacity:0.8" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grad1)" />
          <circle cx="200" cy="200" r="50" fill="rgba(255,255,255,0.1)" />
          <circle cx="800" cy="600" r="80" fill="rgba(255,255,255,0.05)" />
          <rect x="100" y="400" width="200" height="200" fill="rgba(255,255,255,0.03)" />
        </svg>
      `;
      
      const imageBuffer = await Sharp(Buffer.from(svg))
        .png()
        .toBuffer();
      
      const result = await this.processAndSaveImage(imageBuffer, articleData, size);
      result.isPlaceholder = true;
      result.service = 'nano-banana-placeholder';
      
      return result;
      
    } catch (error) {
      logger.error('❌ Failed to generate enhanced placeholder:', error.message);
      throw error;
    }
  }

  /**
   * Process and save generated image
   */
  async processAndSaveImage(imageBuffer, articleData, size) {
    try {
      const timestamp = Date.now();
      const networkSlug = (articleData.network || 'crypto').toLowerCase().replace(/\s+/g, '-');
      const filename = `nano-banana-${networkSlug}-${timestamp}.jpg`;
      const filepath = path.join(__dirname, '..', '..', 'temp', filename);

      // Ensure temp directory exists
      const tempDir = path.join(__dirname, '..', '..', 'temp');
      await fs.mkdir(tempDir, { recursive: true });

      // Size configurations
      const sizeConfigs = {
        small: { width: 300, height: 169 },   // 16:9 small
        medium: { width: 400, height: 225 },  // 16:9 medium  
        large: { width: 500, height: 281 },   // 16:9 large
        square: { width: 300, height: 300 }   // 1:1 square
      };

      const config = sizeConfigs[size] || sizeConfigs.medium;

      // Process image with Sharp
      const processedImage = await Sharp(imageBuffer)
        .resize(config.width, config.height, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ 
          quality: 90,
          progressive: true 
        })
        .toBuffer();

      // Save to temp directory
      await fs.writeFile(filepath, processedImage);

      // Create card images for different sizes
      const cardImages = {};
      for (const [sizeName, sizeConfig] of Object.entries(sizeConfigs)) {
        const cardImagePath = path.join(tempDir, `nano-banana-${networkSlug}-${timestamp}-${sizeName}.jpg`);
        
        await Sharp(imageBuffer)
          .resize(sizeConfig.width, sizeConfig.height, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: 90, progressive: true })
          .toFile(cardImagePath);
        
        cardImages[sizeName] = `/temp/nano-banana-${networkSlug}-${timestamp}-${sizeName}.jpg`;
      }

      return {
        filename,
        path: `/temp/${filename}`,
        fullPath: filepath,
        cardImages,
        size: config,
        generated: true,
        service: 'nano-banana'
      };

    } catch (error) {
      logger.error('❌ Failed to process Nano Banana image:', error.message);
      throw error;
    }
  }

  /**
   * Generate batch images for multiple articles
   */
  async generateBatchImages(articles, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Nano Banana service not available');
    }

    logger.info(`🎨 Generating ${articles.length} Nano Banana images in batch`);

    const results = [];
    const concurrency = 3; // Limit concurrent requests to avoid rate limiting

    for (let i = 0; i < articles.length; i += concurrency) {
      const batch = articles.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (article, index) => {
        try {
          await new Promise(resolve => setTimeout(resolve, index * 1000)); // Stagger requests
          const result = await this.generateCryptoNewsImage(article, options);
          return { success: true, article: article.id, result };
        } catch (error) {
          logger.error(`❌ Batch generation failed for article ${article.id}:`, error.message);
          return { success: false, article: article.id, error: error.message };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Rate limiting pause between batches
      if (i + concurrency < articles.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    logger.info(`✅ Batch generation completed: ${results.filter(r => r.success).length}/${results.length} successful`);
    return results;
  }
}

// Export singleton instance
module.exports = new NanoBananaService();