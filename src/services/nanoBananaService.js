const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const Sharp = require('sharp');

class NanoBananaService {
  constructor() {
    this.apiKey = process.env.GOOGLE_AI_API_KEY;
    this.genAI = null;
    this.model = null;
    this.initialized = false;
    
    if (!this.apiKey) {
      logger.warn('Google AI API key not found. Nano Banana service will be disabled.');
      return;
    }
    
    this.initialize();
  }

  async initialize() {
    try {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image-preview' });
      this.initialized = true;
      logger.info('✅ Nano Banana service initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Nano Banana service:', error.message);
      this.initialized = false;
    }
  }

  isAvailable() {
    return this.initialized && this.apiKey;
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

      const result = await this.model.generateContent([prompt]);
      const response = await result.response;
      
      // Extract image data from response
      if (response.candidates && response.candidates[0]) {
        const candidate = response.candidates[0];
        if (candidate.content && candidate.content.parts) {
          const imagePart = candidate.content.parts.find(part => part.inlineData);
          
          if (imagePart && imagePart.inlineData) {
            const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
            
            // Process and save image
            const savedImage = await this.processAndSaveImage(imageBuffer, articleData, size);
            
            logger.info(`✅ Nano Banana image generated successfully: ${savedImage.filename}`);
            return savedImage;
          }
        }
      }
      
      throw new Error('No image data found in Nano Banana response');

    } catch (error) {
      logger.error('❌ Nano Banana image generation failed:', error.message);
      throw error;
    }
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

    // Create dynamic prompt based on article content
    let basePrompt = `Create a ${aspectRatio} aspect ratio professional cryptocurrency news image that represents "${title}".`;
    
    if (includeNetwork && network) {
      basePrompt += ` Focus on ${network} blockchain with ${networkTheme}.`;
    }
    
    basePrompt += ` Use ${stylePreset} styling with ${colorScheme}.`;
    
    // Add category-specific elements
    if (category) {
      const categoryElements = {
        market: 'price charts, trading candlesticks, market data visualization',
        technology: 'blockchain architecture, smart contracts, technical diagrams',
        regulation: 'government buildings, legal documents, compliance imagery',
        adoption: 'mainstream integration, user interfaces, adoption metrics',
        partnership: 'handshake imagery, corporate collaboration, business networks',
        security: 'cybersecurity elements, encryption patterns, safety imagery'
      };
      
      if (categoryElements[category]) {
        basePrompt += ` Include ${categoryElements[category]}.`;
      }
    }

    // Final styling instructions
    basePrompt += ` Ensure high-quality, professional appearance suitable for financial news. No text overlays needed. Focus on visual metaphors and symbolic representation rather than literal interpretation.`;

    return basePrompt;
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