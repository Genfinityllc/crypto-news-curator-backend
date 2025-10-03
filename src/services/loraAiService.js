const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const axios = require('axios');

/**
 * LoRA-based AI Cover Generation Service
 * Integrates with your existing crypto news backend
 * Uses client-specific LoRA models for branded cover generation
 */
class LoRAiService {
  constructor() {
    this.aiCoverGeneratorUrl = process.env.AI_COVER_GENERATOR_URL || 'http://localhost:8000';
    this.initialized = false;
    this.clientMapping = this.initializeClientMapping();
    
    this.initialize();
  }

  async initialize() {
    try {
      // Test connection to AI Cover Generator service
      const response = await axios.get(`${this.aiCoverGeneratorUrl}/health`, { timeout: 5000 });
      
      if (response.status === 200) {
        this.initialized = true;
        logger.info('✅ LoRA AI Cover Generator service connected');
      }
    } catch (error) {
      logger.warn('⚠️  LoRA AI Cover Generator service not available, will use fallback');
      this.initialized = false;
    }
  }

  initializeClientMapping() {
    return {
      // XDC Network
      'xdc': 'xdc_network',
      'xdc_network': 'xdc_network', 
      'xdc network': 'xdc_network',
      
      // Hedera
      'hedera': 'hedera',
      'hbar': 'hbar',
      'hedera_foundation': 'hedera_foundation',
      'hashgraph': 'hedera',
      
      // HashPack
      'hashpack': 'hashpack',
      
      // Constellation
      'constellation': 'constellation',
      'dag': 'constellation',
      
      // Algorand
      'algorand': 'algorand',
      'algo': 'algorand',
      
      // THA
      'tha': 'tha',
      
      // Genfinity
      'genfinity': 'genfinity',
      'gen': 'genfinity',
      
      // Default fallbacks
      'bitcoin': 'generic',
      'ethereum': 'generic',
      'crypto': 'generic'
    };
  }

  isAvailable() {
    return this.initialized;
  }

  /**
   * Detect client/network from article content
   */
  detectClientFromArticle(article) {
    const searchText = `${article.title} ${article.content} ${article.network || ''}`.toLowerCase();
    
    // Check for client mentions
    for (const [keyword, client] of Object.entries(this.clientMapping)) {
      if (searchText.includes(keyword.toLowerCase())) {
        return client;
      }
    }
    
    // Check network field
    if (article.network) {
      const networkClient = this.clientMapping[article.network.toLowerCase()];
      if (networkClient) {
        return networkClient;
      }
    }
    
    return 'generic';
  }

  /**
   * Generate crypto-themed cover image using LoRA models
   */
  async generateCryptoNewsImage(articleData, options = {}) {
    try {
      if (!this.isAvailable()) {
        logger.info('🧪 LoRA service unavailable, generating test image');
        return await this.generateFallbackCover(articleData);
      }

      const {
        size = '1792x896',
        style = 'professional',
        includeWatermark = false
      } = options;

      // Detect client for LoRA selection
      const clientId = this.detectClientFromArticle(articleData);
      
      logger.info(`🎨 Generating LoRA cover for article: ${articleData.title} (Client: ${clientId})`);

      // Prepare generation request
      const generateRequest = {
        title: articleData.title,
        subtitle: this.createSubtitle(articleData),
        client_id: clientId !== 'generic' ? clientId : null,
        style: {
          theme: style,
          size: size,
          enhancement: this.createEnhancement(articleData)
        }
      };

      // Call AI Cover Generator service
      const response = await axios.post(
        `${this.aiCoverGeneratorUrl}/generate`, 
        generateRequest,
        { 
          timeout: 60000, // 60 second timeout for generation
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        logger.info(`✅ LoRA cover generated successfully for ${articleData.title}`);
        
        return {
          success: true,
          coverUrl: response.data.image_url,
          generationMethod: 'lora_ai',
          clientId: clientId,
          style: style,
          size: size,
          generatedAt: new Date().toISOString(),
          metadata: response.data.metadata || {}
        };
      } else {
        throw new Error(response.data.error || 'Generation failed');
      }

    } catch (error) {
      logger.error(`❌ LoRA cover generation failed: ${error.message}`);
      
      // Fallback to simple generated cover
      return await this.generateFallbackCover(articleData);
    }
  }

  /**
   * Create subtitle from article content
   */
  createSubtitle(article) {
    if (article.network) {
      return `${article.network.toUpperCase()} News`;
    }
    
    // Extract key crypto terms
    const cryptoTerms = ['Bitcoin', 'Ethereum', 'Crypto', 'Blockchain', 'DeFi', 'NFT'];
    const title = article.title;
    
    for (const term of cryptoTerms) {
      if (title.includes(term)) {
        return `${term} Update`;
      }
    }
    
    return 'Crypto News';
  }

  /**
   * Create prompt enhancement based on article content
   */
  createEnhancement(article) {
    const title = article.title.toLowerCase();
    
    if (title.includes('price') || title.includes('surge') || title.includes('rally')) {
      return 'market surge energy';
    }
    
    if (title.includes('partnership') || title.includes('integration')) {
      return 'collaboration growth';
    }
    
    if (title.includes('launch') || title.includes('release')) {
      return 'innovation launch';
    }
    
    if (title.includes('regulation') || title.includes('sec') || title.includes('legal')) {
      return 'regulatory focus';
    }
    
    return 'professional crypto';
  }

  /**
   * Generate fallback cover when LoRA service is unavailable
   */
  async generateFallbackCover(articleData) {
    logger.info(`📝 Generating LoRA test cover for: ${articleData.title}`);
    
    const clientId = this.detectClientFromArticle(articleData);
    
    // Generate a test LoRA-style image URL for testing
    const testImageUrl = this.createTestLoRAImageUrl(articleData, clientId);
    
    return {
      success: true,
      coverUrl: testImageUrl,
      generationMethod: 'lora_test',
      clientId: clientId,
      style: 'test-mode',
      generatedAt: new Date().toISOString(),
      metadata: {
        note: 'Test LoRA image - AI Cover Generator service not deployed yet',
        client: clientId,
        title: articleData.title
      }
    };
  }

  /**
   * Create a test LoRA image URL for testing
   */
  createTestLoRAImageUrl(article, clientId) {
    const title = encodeURIComponent(article.title.substring(0, 80));
    const client = encodeURIComponent(clientId.toUpperCase());
    
    // Generate a test image that looks like a LoRA-generated crypto news cover
    // Using placeholder service with LoRA-style parameters
    return `https://via.placeholder.com/1792x896/1a1a2e/ffffff?text=LoRA+TEST:+${client}+|+${title}`;
  }

  /**
   * Create a simple text-based cover URL
   */
  createFallbackImageUrl(article, clientId) {
    const title = encodeURIComponent(article.title.substring(0, 100));
    const subtitle = encodeURIComponent(this.createSubtitle(article));
    
    // Use a service like images.weserv.nl for text-based images
    return `https://images.weserv.nl/?w=1792&h=896&bg=1a1a2e&color=fff&text=${title}&subtitle=${subtitle}&style=crypto`;
  }

  /**
   * Get service status
   */
  async getStatus() {
    return {
      available: this.initialized,
      service: 'LoRA AI Cover Generator',
      aiCoverGeneratorUrl: this.aiCoverGeneratorUrl,
      clientMappings: Object.keys(this.clientMapping).length,
      lastChecked: new Date().toISOString()
    };
  }

  /**
   * Test cover generation
   */
  async testGeneration() {
    const testArticle = {
      title: 'XDC Network Announces Major Partnership',
      content: 'XDC Network has announced a strategic partnership...',
      network: 'XDC'
    };

    return await this.generateCryptoNewsImage(testArticle);
  }
}

module.exports = LoRAiService;