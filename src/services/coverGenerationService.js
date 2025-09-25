const axios = require('axios');
const logger = require('../utils/logger');

// Service for generating article covers using AI
class CoverGenerationService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || process.env.CLAUDE_API_KEY;
    this.baseUrl = process.env.COVER_GENERATION_API || 'https://api.openai.com/v1';
  }

  /**
   * Generate a crypto-news style article cover
   * @param {Object} article - Article object with title, content, network
   * @returns {Promise<Object>} Cover generation result
   */
  async generateArticleCover(article) {
    try {
      logger.info(`Generating article cover for: ${article.title}`);

      // Create a crypto.news-inspired design prompt
      const designPrompt = this.createCoverPrompt(article);
      
      // For demonstration, we'll create a structured response
      // In production, this would call an image generation API
      const coverData = await this.generateCoverImage(designPrompt, article);
      
      return {
        success: true,
        coverUrl: coverData.url,
        designElements: coverData.elements,
        style: 'crypto-news-inspired',
        generatedAt: new Date().toISOString(),
        article: {
          id: article.id,
          title: article.title,
          network: article.network
        }
      };

    } catch (error) {
      logger.error('Error generating article cover:', error.message);
      return {
        success: false,
        error: error.message,
        fallbackCover: this.createFallbackCover(article)
      };
    }
  }

  /**
   * Create design prompt for crypto.news style covers
   * @param {Object} article - Article data
   * @returns {string} Design prompt
   */
  createCoverPrompt(article) {
    const network = article.network || 'Crypto';
    const title = article.title || 'Crypto News Update';
    const category = article.category || 'general';
    
    // Analyze title for key elements
    const titleElements = this.extractTitleElements(title);
    
    return `
Create a modern, professional cryptocurrency news article cover in the style of crypto.news with these specifications:

DESIGN STYLE:
- Clean, modern layout with crypto.news aesthetic
- Dark theme with blue/teal accents (#0066cc, #00b4d8)
- Professional typography with bold headlines
- Subtle geometric patterns or blockchain-inspired elements
- High contrast for readability

CONTENT:
- Title: "${title}"
- Network/Crypto: ${network}
- Category: ${category}
- Key elements: ${titleElements.join(', ')}

LAYOUT ELEMENTS:
- Main headline prominently displayed
- ${network} logo or icon if applicable
- Subtle price chart or trading indicators in background
- Professional color scheme: dark background, white text, blue accents
- Modern typography (similar to Inter or Roboto)

VISUAL ELEMENTS:
- Abstract crypto/blockchain graphics
- Subtle grid or hexagonal patterns
- Professional gradients
- ${this.getCategorySpecificElements(category)}

SIZE: 1200x630px (social media optimized)
QUALITY: High resolution, professional appearance
STYLE: Crypto.news inspired, modern, trustworthy
`;
  }

  /**
   * Extract key elements from article title for design
   * @param {string} title - Article title
   * @returns {Array} Key elements
   */
  extractTitleElements(title) {
    const elements = [];
    const titleLower = title.toLowerCase();
    
    // Price-related elements
    if (titleLower.includes('price') || titleLower.includes('$')) {
      elements.push('price-chart');
    }
    
    // Market elements
    if (titleLower.includes('market') || titleLower.includes('trading')) {
      elements.push('market-indicators');
    }
    
    // Technology elements
    if (titleLower.includes('blockchain') || titleLower.includes('protocol')) {
      elements.push('tech-graphics');
    }
    
    // Breaking news elements
    if (titleLower.includes('breaking') || titleLower.includes('urgent')) {
      elements.push('breaking-badge');
    }
    
    // Regulatory elements
    if (titleLower.includes('sec') || titleLower.includes('regulation')) {
      elements.push('regulatory-icons');
    }
    
    return elements.length > 0 ? elements : ['general-crypto'];
  }

  /**
   * Get category-specific design elements
   * @param {string} category - Article category
   * @returns {string} Design elements description
   */
  getCategorySpecificElements(category) {
    switch (category) {
      case 'market':
        return 'Trading charts, candlestick patterns, market indicators';
      case 'technology':
        return 'Blockchain nodes, network diagrams, code elements';
      case 'regulation':
        return 'Legal scales, government buildings, official seals';
      case 'breaking':
        return 'Alert badges, urgent indicators, news flash elements';
      default:
        return 'Generic crypto symbols, network logos, professional graphics';
    }
  }

  /**
   * Generate the actual cover image (mock implementation)
   * @param {string} prompt - Design prompt
   * @param {Object} article - Article data
   * @returns {Promise<Object>} Generated cover data
   */
  async generateCoverImage(prompt, article) {
    // In a real implementation, this would call an AI image generation service
    // For now, we'll create a structured response
    
    const mockCoverUrl = this.createMockCoverUrl(article);
    
    return {
      url: mockCoverUrl,
      elements: {
        title: article.title,
        network: article.network,
        style: 'crypto-news-modern',
        colors: ['#0066cc', '#00b4d8', '#1a1a1a', '#ffffff'],
        fonts: ['Inter', 'Roboto'],
        layout: 'professional-header'
      },
      prompt: prompt,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Create a mock cover URL (in production, this would be a real generated image)
   * @param {Object} article - Article data
   * @returns {string} Mock cover URL
   */
  createMockCoverUrl(article) {
    const baseUrl = process.env.COVER_BASE_URL || 'https://images.unsplash.com';
    const network = (article.network || 'crypto').toLowerCase();
    const timestamp = Date.now();
    
    // Create a structured URL that could point to a real generated image
    return `${baseUrl}/generated-covers/${network}/${timestamp}.jpg`;
  }

  /**
   * Create fallback cover for failed generations
   * @param {Object} article - Article data
   * @returns {Object} Fallback cover data
   */
  createFallbackCover(article) {
    return {
      url: `https://placehold.co/1200x630/0066cc/ffffff?text=${encodeURIComponent(article.title)}`,
      style: 'fallback',
      elements: {
        title: article.title,
        network: article.network,
        type: 'fallback-generated'
      }
    };
  }

  /**
   * Batch generate covers for multiple articles
   * @param {Array} articles - Array of articles
   * @returns {Promise<Array>} Array of cover generation results
   */
  async batchGenerateCovers(articles) {
    const results = [];
    
    for (const article of articles) {
      try {
        const cover = await this.generateArticleCover(article);
        results.push(cover);
        
        // Rate limiting - wait between generations
        await this.delay(1000);
        
      } catch (error) {
        logger.error(`Error generating cover for article ${article.id}:`, error.message);
        results.push({
          success: false,
          articleId: article.id,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Utility delay function
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Delay promise
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
const coverGenerationService = new CoverGenerationService();

module.exports = {
  CoverGenerationService,
  generateArticleCover: (article) => coverGenerationService.generateArticleCover(article),
  batchGenerateCovers: (articles) => coverGenerationService.batchGenerateCovers(articles),
  coverGenerationService
};