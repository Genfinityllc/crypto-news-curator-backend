const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Hugging Face Spaces LoRA Service
 * Calls external HF Spaces deployment for image generation
 */
class HFSpacesLoraService {
  constructor() {
    // Set your HF Spaces URL here after deployment
    this.hfSpacesUrl = process.env.HF_SPACES_LORA_URL || 'https://YOUR-USERNAME-crypto-news-lora-generator.hf.space';
    this.timeout = 180000; // 3 minutes
    this.initialized = true;
    
    logger.info(`🤗 HF Spaces LoRA Service initialized: ${this.hfSpacesUrl}`);
  }

  async isAvailable() {
    if (!this.initialized || !this.hfSpacesUrl || this.hfSpacesUrl.includes('YOUR-USERNAME')) {
      return false;
    }
    
    // Quick health check
    try {
      const response = await axios.get(`${this.hfSpacesUrl}/health`, { timeout: 30000 });
      return response.status === 200;
    } catch (error) {
      logger.warn(`🤗 HF Spaces health check failed: ${error.message}`);
      return false;
    }
  }

  detectClientFromArticle(articleData) {
    if (!articleData) return 'generic';
    
    const title = (articleData.title || '').toLowerCase();
    const content = (articleData.content || articleData.summary || '').toLowerCase();
    const network = (articleData.network || '').toLowerCase();
    
    // Network-based detection
    if (network === 'hedera' || title.includes('hedera') || content.includes('hedera')) return 'hedera';
    if (network === 'algorand' || title.includes('algorand') || content.includes('algorand')) return 'algorand';
    if (network === 'constellation' || title.includes('constellation') || content.includes('constellation')) return 'constellation';
    if (network === 'bitcoin' || title.includes('bitcoin') || content.includes('btc')) return 'bitcoin';
    if (network === 'ethereum' || title.includes('ethereum') || content.includes('eth')) return 'ethereum';
    
    return 'generic';
  }

  createSubtitle(article) {
    if (article.network) {
      return `${article.network.toUpperCase()} NEWS`;
    }
    return 'CRYPTO NEWS';
  }

  selectStyleForArticle(articleData) {
    const title = (articleData.title || '').toLowerCase();
    
    // Smart style selection based on content
    if (title.includes('institutional') || title.includes('enterprise')) return 'crystalline_structures';
    if (title.includes('innovation') || title.includes('breakthrough')) return 'energy_fields';
    if (title.includes('network') || title.includes('protocol')) return 'network_nodes';
    if (title.includes('defi') || title.includes('trading')) return 'particle_waves';
    if (title.includes('launch') || title.includes('announcement')) return 'abstract_flow';
    
    // Random selection from available styles
    const styles = ['energy_fields', 'network_nodes', 'abstract_flow', 'geometric_patterns', 'particle_waves', 'crystalline_structures'];
    return styles[Math.floor(Math.random() * styles.length)];
  }

  async generateCryptoNewsImage(articleData, options = {}) {
    try {
      // HF Spaces integration - now enabled
      const available = await this.isAvailable();
      if (!available) {
        throw new Error('HF Spaces LoRA service not available - check deployment status');
      }

      const clientId = this.detectClientFromArticle(articleData);
      const subtitle = this.createSubtitle(articleData);
      const style = options.style || this.selectStyleForArticle(articleData);

      logger.info(`🤗 Generating HF Spaces LoRA cover for: ${articleData.title} (Client: ${clientId}, Style: ${style})`);

      // Call HF Spaces API
      const requestData = {
        title: articleData.title,
        subtitle: subtitle,
        client: clientId,
        style: style,
        use_trained_lora: true  // ✅ Enable Universal LoRA generation
      };

      const response = await axios.post(`${this.hfSpacesUrl}/generate`, requestData, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success && response.data.image_url) {
        // Handle data URLs and regular URLs
        const imageUrl = response.data.image_url.startsWith('data:') || response.data.image_url.startsWith('http') 
          ? response.data.image_url 
          : `${this.hfSpacesUrl}${response.data.image_url}`;

        logger.info(`✅ HF Spaces LoRA cover generated successfully`);

        return {
          success: true,
          coverUrl: imageUrl,
          generationMethod: 'hf_spaces_lora',
          clientId: clientId,
          style: style,
          size: options.size || '1792x896',
          generatedAt: new Date().toISOString(),
          metadata: {
            hfSpacesUrl: this.hfSpacesUrl,
            ...response.data.metadata
          }
        };
      } else {
        throw new Error(response.data.error || 'HF Spaces generation failed');
      }

    } catch (error) {
      logger.error(`❌ LoRA generation failed: ${error.message}`);
      
      // Throw error instead of fallback since user wants real generation only
      throw new Error(`HF Spaces LoRA generation failed: ${error.message}`);
    }
  }

  async usePreGeneratedImages(articleData, options = {}) {
    const clientId = this.detectClientFromArticle(articleData);
    const style = options.style || this.selectStyleForArticle(articleData);
    
    logger.info(`🎨 Selecting pre-generated LoRA image for client: ${clientId}`);
    
    // Map of available pre-generated images
    const preGeneratedImages = {
      'hedera': [
        'https://valtronk-crypto-news-lora-generator.hf.space/download/hedera.png',
        'https://raw.githubusercontent.com/valtronk/crypto-covers/main/hedera_energy_fields.png'
      ],
      'algorand': [
        'https://valtronk-crypto-news-lora-generator.hf.space/download/algorand.png',
        'https://raw.githubusercontent.com/valtronk/crypto-covers/main/algorand_energy_fields.png'
      ],
      'constellation': [
        'https://valtronk-crypto-news-lora-generator.hf.space/download/constellation.png',
        'https://raw.githubusercontent.com/valtronk/crypto-covers/main/constellation_network_nodes.png'
      ],
      'generic': [
        'https://valtronk-crypto-news-lora-generator.hf.space/download/generic.png',
        'https://raw.githubusercontent.com/valtronk/crypto-covers/main/generic_crypto_cover.png'
      ]
    };
    
    // Select appropriate images for the client
    const availableImages = preGeneratedImages[clientId] || preGeneratedImages['generic'];
    const selectedImage = availableImages[Math.floor(Math.random() * availableImages.length)];
    
    logger.info(`✅ Selected pre-generated LoRA image: ${selectedImage}`);
    
    return {
      success: true,
      coverUrl: selectedImage,
      generationMethod: 'pre_generated_lora_temp',
      clientId: clientId,
      style: style,
      size: options.size || '1792x896',
      generatedAt: new Date().toISOString(),
      metadata: {
        temporarySolution: true,
        selectedImage: selectedImage,
        note: 'Using pre-generated images while HF Spaces is being debugged'
      }
    };
  }

  generateIntelligentFallback(title, articleData) {
    const network = articleData?.network || 'crypto';
    const networkColors = {
      'hedera': { bg: '8B2CE6', text: 'FFFFFF', name: 'Hedera' },
      'algorand': { bg: '0078CC', text: 'FFFFFF', name: 'Algorand' },
      'constellation': { bg: '484D8B', text: 'FFFFFF', name: 'Constellation' },
      'bitcoin': { bg: 'F7931A', text: '000000', name: 'Bitcoin' },
      'ethereum': { bg: '627EEA', text: 'FFFFFF', name: 'Ethereum' },
      'generic': { bg: '4A90E2', text: 'FFFFFF', name: 'Crypto' }
    };
    
    const colors = networkColors[network.toLowerCase()] || networkColors['generic'];
    const safeTitle = encodeURIComponent(title.substring(0, 50));
    const fallbackUrl = `https://via.placeholder.com/1792x896/${colors.bg}/${colors.text}?text=${safeTitle}+%7C+${colors.name}+News`;
    
    return {
      success: true,
      coverUrl: fallbackUrl,
      generationMethod: 'intelligent_fallback',
      clientId: this.detectClientFromArticle(articleData),
      style: 'fallback',
      size: '1792x896',
      generatedAt: new Date().toISOString(),
      metadata: {
        fallbackReason: 'HF Spaces service unavailable',
        originalTitle: title
      }
    };
  }

  async testConnection() {
    try {
      const response = await axios.get(`${this.hfSpacesUrl}/health`, { timeout: 10000 });
      return response.data.status === 'healthy';
    } catch (error) {
      logger.error(`❌ HF Spaces connection test failed: ${error.message}`);
      return false;
    }
  }
}

module.exports = HFSpacesLoraService;