const axios = require('axios');
const logger = require('../utils/logger');

/**
 * 🚀 LIGHTWEIGHT IMAGE VALIDATION SERVICE
 * 
 * Railway-optimized version without heavy dependencies like Puppeteer
 * Focuses on RSS image validation and smart fallbacks without screenshots
 * 
 * This solves Railway deployment failures caused by:
 * - Puppeteer (100MB+ dependency)  
 * - Screenshot files accumulation
 * - Temp directory bloat
 */

class LightweightImageService {
  constructor() {
    this.validatedImages = new Map(); // Cache validated images
    this.imageTimeout = 8000; // 8 second timeout for Railway
    this.maxCacheSize = 1000; // Prevent memory bloat
  }

  /**
   * Validate that an image URL actually loads and is a real image
   */
  async validateImageUrl(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') return false;
    
    // Clean cache if getting too large
    if (this.validatedImages.size > this.maxCacheSize) {
      this.validatedImages.clear();
      logger.info('🧹 Image validation cache cleared');
    }
    
    // Check cache first
    if (this.validatedImages.has(imageUrl)) {
      return this.validatedImages.get(imageUrl);
    }

    try {
      const response = await axios.head(imageUrl, { 
        timeout: this.imageTimeout,
        maxRedirects: 3,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CryptoCurator/1.0)',
          'Accept': 'image/*'
        }
      });

      // Must be successful response
      if (response.status !== 200) {
        this.validatedImages.set(imageUrl, false);
        return false;
      }

      // Must be an image content type
      const contentType = response.headers['content-type'] || '';
      if (!contentType.startsWith('image/')) {
        logger.warn(`🚫 Not an image: ${contentType} - ${imageUrl}`);
        this.validatedImages.set(imageUrl, false);
        return false;
      }

      // Must not be a tiny tracking pixel
      const contentLength = parseInt(response.headers['content-length'] || '0');
      if (contentLength > 0 && contentLength < 1000) {
        logger.warn(`🚫 Image too small (${contentLength} bytes): ${imageUrl}`);
        this.validatedImages.set(imageUrl, false);
        return false;
      }

      // Cache success and return
      this.validatedImages.set(imageUrl, true);
      logger.info(`✅ Image validated: ${imageUrl.substring(0, 80)}...`);
      return true;

    } catch (error) {
      logger.warn(`🚫 Image validation failed: ${imageUrl.substring(0, 50)}... - ${error.message}`);
      this.validatedImages.set(imageUrl, false);
      return false;
    }
  }

  /**
   * Extract and validate multiple image candidates from RSS article
   */
  async findBestImage(article) {
    const { cover_image, image_url, url, title } = article;
    
    logger.info(`🔍 Finding best image for: ${title?.substring(0, 50)}...`);

    // Priority order: RSS images first (most reliable)
    const candidateImages = [
      cover_image,
      image_url,
      // Extract any images from content if available
      ...(this.extractImagesFromContent(article.content) || [])
    ].filter(Boolean);

    // Remove duplicates
    const uniqueImages = [...new Set(candidateImages)];
    
    // Try each image candidate
    for (const imageUrl of uniqueImages) {
      if (await this.validateImageUrl(imageUrl)) {
        logger.info(`✅ Best image found: ${imageUrl.substring(0, 80)}...`);
        return imageUrl;
      }
    }

    // If no images work, try common image patterns from the URL
    if (url) {
      const inferredImages = this.inferImagesFromUrl(url);
      for (const imageUrl of inferredImages) {
        if (await this.validateImageUrl(imageUrl)) {
          logger.info(`✅ Inferred image found: ${imageUrl}`);
          return imageUrl;
        }
      }
    }

    logger.warn(`🚫 No valid images found for: ${title}`);
    return null;
  }

  /**
   * Extract images from article content (simple regex)
   */
  extractImagesFromContent(content) {
    if (!content) return [];
    
    const imageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const matches = [];
    let match;
    
    while ((match = imageRegex.exec(content)) !== null) {
      const src = match[1];
      if (src && (src.startsWith('http') || src.startsWith('//'))) {
        matches.push(src.startsWith('//') ? `https:${src}` : src);
      }
    }
    
    return matches.slice(0, 3); // Limit to first 3 images
  }

  /**
   * Infer common image patterns from article URL
   */
  inferImagesFromUrl(articleUrl) {
    const images = [];
    
    try {
      const url = new URL(articleUrl);
      const domain = url.hostname;
      
      // Common patterns for major crypto news sites
      if (domain.includes('coindesk.com')) {
        // CoinDesk usually has images at cdn.sanity.io
        images.push(`https://cdn.sanity.io/images/s3y3vcno/production/default.jpg`);
      } else if (domain.includes('cointelegraph.com')) {
        // Cointelegraph pattern
        images.push(`https://images.cointelegraph.com/images/default.jpg`);
      } else if (domain.includes('beincrypto.com')) {
        // BeInCrypto pattern  
        images.push(`https://assets.beincrypto.com/img/default.jpg`);
      } else if (domain.includes('cryptoslate.com')) {
        // CryptoSlate pattern
        images.push(`https://cryptoslate.com/wp-content/themes/cryptoslate-2024/assets/images/default.jpg`);
      }
      
    } catch (error) {
      logger.warn(`Failed to parse URL for image inference: ${articleUrl}`);
    }
    
    return images;
  }

  /**
   * Process multiple articles with guaranteed lightweight validation
   */
  async processArticlesWithImageValidation(articles) {
    const validatedArticles = [];
    const startTime = Date.now();
    
    logger.info(`🔄 Processing ${articles.length} articles with lightweight image validation...`);
    
    // Process in smaller batches to prevent Railway timeouts
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < articles.length; i += batchSize) {
      batches.push(articles.slice(i, i + batchSize));
    }
    
    for (const [batchIndex, batch] of batches.entries()) {
      logger.info(`📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} articles)`);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (article) => {
          try {
            const bestImage = await this.findBestImage(article);
            
            if (bestImage) {
              return {
                ...article,
                cover_image: bestImage,
                image_source: 'validated',
                image_validated: true,
                image_validation_time: Date.now()
              };
            }
            return null;
          } catch (error) {
            logger.error(`❌ Error validating article: ${article.title}`, error);
            return null;
          }
        })
      );
      
      // Collect successful results
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          validatedArticles.push(result.value);
        }
      });
      
      // Prevent overwhelming Railway with too many concurrent requests
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const processingTime = (Date.now() - startTime) / 1000;
    logger.info(`✅ Lightweight image validation complete: ${validatedArticles.length}/${articles.length} articles (${processingTime.toFixed(1)}s)`);
    
    return validatedArticles;
  }

  /**
   * Clean up resources (lightweight - no browser to close)
   */
  cleanup() {
    this.validatedImages.clear();
    logger.info('🧹 Lightweight image service cleaned up');
  }

  /**
   * Get service stats
   */
  getStats() {
    return {
      cacheSize: this.validatedImages.size,
      maxCacheSize: this.maxCacheSize,
      service: 'lightweight-image-validation'
    };
  }
}

// Export singleton instance
const lightweightImageService = new LightweightImageService();

module.exports = lightweightImageService;