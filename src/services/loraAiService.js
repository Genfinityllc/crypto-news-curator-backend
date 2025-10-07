const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * LoRA-based AI Cover Generation Service
 * Integrates with your existing crypto news backend
 * Uses client-specific LoRA models for branded cover generation
 */
class LoRAiService {
  constructor() {
    // FORCE LORA TESTING - Use local service for full LoRA testing
    this.aiServiceUrl = 'http://localhost:8000'; // Force local service
    this.aiCoverGeneratorPath = path.join(__dirname, '../../ai-cover-generator');
    this.initialized = false;
    this.useExternalService = true; // Use local service running on 8000
    this.clientMapping = this.initializeClientMapping();
    this.forceLoRAMode = true; // Testing flag
    
    this.initialize();
  }

  async initialize() {
    if (this.forceLoRAMode) {
      // FORCE LOCAL LORA TESTING - Use local AI service
      logger.info('🧪 FORCE LORA MODE: Testing with local AI service on port 8000');
      
      try {
        // Test local AI service connection
        const response = await axios.get(`${this.aiServiceUrl}/health`, { timeout: 2000 });
        
        if (response.status === 200) {
          this.initialized = true;
          this.useExternalService = true;
          logger.info('✅ LoRA AI Service ready for FULL TESTING (local service on port 8000)');
          return;
        }
      } catch (error) {
        logger.error('❌ Local AI service not available on port 8000. Make sure it\'s running.');
        this.initialized = false;
        return;
      }
    }

    try {
      // Normal operation - try external service first
      const response = await axios.get(`${this.aiServiceUrl}/health`, { timeout: 2000 });
      
      if (response.status === 200) {
        this.initialized = true;
        this.useExternalService = true;
        logger.info(`✅ LoRA AI Service connected at ${this.aiServiceUrl}`);
        return;
      }
    } catch (error) {
      logger.info(`🔍 External AI service not available, checking local LoRA...`);
    }

    try {
      // Check if local script exists
      const generatorScript = path.join(this.aiCoverGeneratorPath, 'boxed_subtitle_generator.py');
      await fs.access(generatorScript);
      this.initialized = true;
      this.useExternalService = false;
      logger.info('✅ LoRA AI Service ready with local LoRA generation');
    } catch (error) {
      logger.error('❌ Neither external service nor local LoRA script available');
      this.initialized = false;
    }
  }

  /**
   * Generate intelligent fallback cover with network branding
   */
  generateIntelligentFallback(title, articleData) {
    const network = articleData?.network || 'crypto';
    const clientId = articleData?.client_id || 'generic';
    
    // Network-specific color schemes
    const networkColors = {
      'hedera': { bg: '8B2CE6', text: 'FFFFFF', name: 'Hedera' },
      'algorand': { bg: '0078CC', text: 'FFFFFF', name: 'Algorand' },
      'constellation': { bg: '484D8B', text: 'FFFFFF', name: 'Constellation' },
      'bitcoin': { bg: 'F7931A', text: '000000', name: 'Bitcoin' },
      'ethereum': { bg: '627EEA', text: 'FFFFFF', name: 'Ethereum' },
      'solana': { bg: '9945FF', text: 'FFFFFF', name: 'Solana' },
      'generic': { bg: '4A90E2', text: 'FFFFFF', name: 'Crypto' }
    };
    
    const colors = networkColors[network.toLowerCase()] || networkColors['generic'];
    const safeTitle = encodeURIComponent(title.substring(0, 50));
    
    // Create intelligent placeholder with network branding
    const fallbackUrl = `https://via.placeholder.com/1800x900/${colors.bg}/${colors.text}?text=${safeTitle}+%7C+${colors.name}+News`;
    
    return {
      success: true,
      image_url: fallbackUrl,
      metadata: {
        method: 'intelligent_fallback',
        network: colors.name,
        colors: colors,
        generated_at: new Date().toISOString()
      }
    };
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
        throw new Error('LoRA service not available');
      }

      const {
        size = '1792x896',
        style = 'professional',
        includeWatermark = false
      } = options;

      // Detect client for LoRA selection
      const clientId = this.detectClientFromArticle(articleData);
      const subtitle = this.createSubtitle(articleData);
      
      logger.info(`🎨 Generating LoRA cover for article: ${articleData.title} (Client: ${clientId})`);

      if (this.useExternalService) {
        // Use external AI service (FastAPI)
        return await this.generateViaExternalService(articleData, clientId, subtitle, options);
      } else {
        // Use local Python script (fallback)
        return await this.generateViaLocalScript(articleData, clientId, subtitle, options);
      }

    } catch (error) {
      logger.error(`❌ LoRA cover generation failed: ${error.message}`);
      
      // FORCE LORA TESTING - NO FALLBACKS ALLOWED
      throw new Error(`LoRA Testing Mode - Generation failed: ${error.message}. NO FALLBACKS - MUST FIX LORA SERVICE.`);
    }
  }

  async generateViaExternalService(articleData, clientId, subtitle, options) {
    try {
      const requestData = {
        title: articleData.title,
        subtitle: subtitle,
        client_id: clientId,
        article_content: articleData.content || articleData.summary || '',
        style: options.style || 'professional',
        size: options.size || '1792x896'
      };

      logger.info(`🌐 Calling external AI service: ${this.aiServiceUrl}/generate`);

      const response = await axios.post(`${this.aiServiceUrl}/generate`, requestData, {
        timeout: 180000, // 3 minute timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        // Convert external service URL to our proxy URL
        const externalImageUrl = response.data.image_url;
        const proxyUrl = `/ai-service-proxy${externalImageUrl}`;

        logger.info(`✅ External AI service generated cover: ${externalImageUrl}`);
        
        return {
          success: true,
          coverUrl: proxyUrl,
          generationMethod: 'external_ai_service',
          clientId: clientId,
          style: options.style || 'professional',
          size: options.size || '1792x896',
          generatedAt: new Date().toISOString(),
          metadata: {
            externalService: this.aiServiceUrl,
            originalImageUrl: externalImageUrl,
            generationTime: response.data.generation_time,
            ...response.data.metadata
          }
        };
      } else {
        throw new Error(response.data.error || 'External service failed');
      }

    } catch (error) {
      logger.error(`❌ External AI service failed: ${error.message}`);
      
      // FORCE LORA TESTING - NO FALLBACKS ALLOWED
      throw new Error(`External LoRA Service failed: ${error.message}. NO FALLBACKS - MUST FIX LORA SERVICE.`);
    }
  }

  async generateViaLocalScript(articleData, clientId, subtitle, options) {
    // Original local script implementation
    const articleContent = `${articleData.title}\n\n${articleData.content || articleData.summary || ''}`;
    const articleTempFile = path.join(this.aiCoverGeneratorPath, 'temp_article.txt');
    await fs.writeFile(articleTempFile, articleContent);

    const pythonScript = path.join(this.aiCoverGeneratorPath, 'boxed_subtitle_generator.py');
    
    const env = {
      ...process.env,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY
    };

    const command = [
      'python3',
      pythonScript,
      '--title', `"${articleData.title}"`,
      '--subtitle', `"${subtitle}"`,
      '--client', clientId,
      '--article', articleTempFile
    ].join(' ');

    logger.info(`🚀 Executing local script: ${command}`);

    const { stdout, stderr } = await execAsync(command, {
      cwd: this.aiCoverGeneratorPath,
      env: env,
      timeout: 120000
    });

    try {
      await fs.unlink(articleTempFile);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    if (stderr && !stderr.includes('Warning') && !stderr.includes('UserWarning')) {
      throw new Error(`Generation failed: ${stderr}`);
    }

    const outputPath = path.join(this.aiCoverGeneratorPath, 'style_outputs', `boxed_cover_${clientId}.png`);
    
    try {
      await fs.access(outputPath);
      const coverUrl = `/ai-covers/boxed_cover_${clientId}.png`;
      
      logger.info(`✅ Local LoRA cover generated: ${coverUrl}`);
      
      return {
        success: true,
        coverUrl: coverUrl,
        generationMethod: 'local_script',
        clientId: clientId,
        style: options.style || 'professional',
        size: options.size || '1792x896',
        generatedAt: new Date().toISOString(),
        metadata: {
          outputPath: outputPath,
          command: command,
          stdout: stdout
        }
      };
    } catch (fileError) {
      throw new Error(`Output file not created: ${outputPath}`);
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
      aiCoverGeneratorPath: this.aiCoverGeneratorPath,
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