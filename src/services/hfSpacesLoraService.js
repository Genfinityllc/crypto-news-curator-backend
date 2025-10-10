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

  isAvailable() {
    return this.initialized && this.hfSpacesUrl && !this.hfSpacesUrl.includes('YOUR-USERNAME');
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
      if (!this.isAvailable()) {
        throw new Error('HF Spaces LoRA service not available - check HF_SPACES_LORA_URL');
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
        style: style
      };

      const response = await axios.post(`${this.hfSpacesUrl}/generate`, requestData, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success && response.data.image_url) {
        // Convert relative URL to absolute
        const imageUrl = response.data.image_url.startsWith('http') 
          ? response.data.image_url 
          : `${this.hfSpacesUrl}${response.data.image_url}`;

        logger.info(`✅ HF Spaces LoRA cover generated: ${imageUrl}`);

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
      logger.error(`❌ HF Spaces LoRA generation failed: ${error.message}`);
      
      // Return intelligent fallback
      return this.generateIntelligentFallback(articleData.title, articleData);
    }
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