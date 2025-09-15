const logger = require('../utils/logger');
const axios = require('axios');
let sharp;
try {
  sharp = require('sharp');
} catch (error) {
  logger.warn('Sharp not available, using fallback image processing');
  sharp = null;
}
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// For production, you'd use a proper image generation service like:
// - DALL-E API
// - Midjourney API
// - Stable Diffusion API
// - Or integrate with design tools

/**
 * Fetch and resize real images from article sources
 */
async function fetchAndResizeImage(url, width = 400, height = 225) {
  try {
    logger.info(`Fetching image from: ${url}`);
    
    if (!sharp) {
      // Fallback to URL-based resizing service
      logger.info('Using URL-based image resizing fallback');
      return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${width}&h=${height}&fit=cover&output=jpg&q=85`;
    }
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const buffer = Buffer.from(response.data);
    
    // Resize and optimize the image
    const resizedBuffer = await sharp(buffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({
        quality: 85,
        progressive: true
      })
      .toBuffer();
    
    // Save to temp directory and return URL
    const filename = `${crypto.randomBytes(16).toString('hex')}.jpg`;
    const filepath = path.join(__dirname, '../../temp', filename);
    
    // Ensure temp directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, resizedBuffer);
    
    return `/temp/${filename}`;
    
  } catch (error) {
    logger.warn(`Failed to fetch/resize image from ${url}:`, error.message);
    return null;
  }
}

/**
 * Extract Open Graph and meta tag images from HTML
 */
function extractMetaImages($, articleUrl) {
  const metaImages = [];
  
  // Extract og:image
  const ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="og:image"]').attr('content');
  if (ogImage) {
    const absoluteUrl = ogImage.startsWith('http') ? ogImage : new URL(ogImage, articleUrl).href;
    metaImages.push({
      url: absoluteUrl,
      alt: 'Featured image',
      source: 'og:image',
      priority: 10
    });
  }
  
  // Extract Twitter card image
  const twitterImage = $('meta[name="twitter:image"]').attr('content') || $('meta[property="twitter:image"]').attr('content');
  if (twitterImage && twitterImage !== ogImage) {
    const absoluteUrl = twitterImage.startsWith('http') ? twitterImage : new URL(twitterImage, articleUrl).href;
    metaImages.push({
      url: absoluteUrl,
      alt: 'Twitter card image',
      source: 'twitter:image',
      priority: 9
    });
  }
  
  // Extract article:image (some sites use this)
  const articleImage = $('meta[property="article:image"]').attr('content');
  if (articleImage && articleImage !== ogImage && articleImage !== twitterImage) {
    const absoluteUrl = articleImage.startsWith('http') ? articleImage : new URL(articleImage, articleUrl).href;
    metaImages.push({
      url: absoluteUrl,
      alt: 'Article image',
      source: 'article:image',
      priority: 8
    });
  }
  
  return metaImages;
}

/**
 * Extract images from article content HTML with improved selectors
 */
function extractContentImages($, articleUrl) {
  const images = [];
  
  // Site-specific high-priority selectors
  const domain = new URL(articleUrl).hostname.toLowerCase();
  
  // Bitcoinist-specific selectors
  if (domain.includes('bitcoinist.com')) {
    const bitcoinistSelectors = [
      // Main featured image (highest priority)
      '.wp-post-image.background-img',
      // Large attachment images
      '.attachment-large:not(.lazyload)',
      '.size-large:not(.lazyload)',
      // Content images with good sizes
      '.entry-content .size-large',
      '.entry-content .wp-image-*[class*="size-large"]'
    ];
    
    // Process Bitcoinist-specific selectors first with high priority
    for (const selector of bitcoinistSelectors) {
      $(selector).each((i, element) => {
        const $img = $(element);
        let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original') || $img.attr('data-lazy-src');
        
        if (!src || src.length < 10) return;
        
        const alt = $img.attr('alt') || '';
        const absoluteUrl = src.startsWith('http') ? src : new URL(src, articleUrl).href;
        
        if (isValidNewsImage(absoluteUrl, alt, $img)) {
          const width = parseInt($img.attr('width')) || 0;
          const height = parseInt($img.attr('height')) || 0;
          const className = $img.attr('class') || '';
          const parentClass = $img.parent().attr('class') || '';
          
          let priority = calculateImagePriority(className, parentClass, alt, width, height);
          // Boost priority for Bitcoinist main images
          if (className.includes('background-img')) priority += 5;
          
          images.push({
            url: absoluteUrl,
            alt: alt,
            width: width,
            height: height,
            source: 'bitcoinist-featured',
            className: className,
            priority: priority
          });
        }
      });
    }
  }
  
  // CryptoSlate-specific selectors (enhanced)
  if (domain.includes('cryptoslate.com')) {
    const cryptoslateSelectors = [
      // Featured image in article header (highest priority)
      '.post-hero img, .article-hero img',
      // Lead/main article images
      '.post-lead img, .article-lead img',
      // Main content images with CryptoSlate domain
      '.post-content img[src*="cryptoslate"], .article-content img[src*="cryptoslate"]',
      // WordPress attachment images
      '.wp-post-image, .attachment-full, .attachment-large',
      // Figure elements with high-res images
      'figure.wp-block-image img, figure img',
      // Post thumbnail and featured containers
      '.post-thumbnail img, .featured-image img',
      // Content area images with good dimensions
      '.content img[width], .article img[width]',
      // Media and image wrapper elements
      '.media img, .image-wrapper img, .post-media img'
    ];
    
    for (const selector of cryptoslateSelectors) {
      $(selector).each((i, element) => {
        const $img = $(element);
        let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original') || $img.attr('data-lazy-src');
        
        if (!src || src.length < 10) return;
        
        const alt = $img.attr('alt') || '';
        const absoluteUrl = src.startsWith('http') ? src : new URL(src, articleUrl).href;
        
        if (isValidNewsImage(absoluteUrl, alt, $img)) {
          const width = parseInt($img.attr('width')) || 0;
          const height = parseInt($img.attr('height')) || 0;
          const className = $img.attr('class') || '';
          const parentClass = $img.parent().attr('class') || '';
          
          let priority = calculateImagePriority(className, parentClass, alt, width, height);
          // Boost priority for CryptoSlate hero/featured images
          if (className.includes('wp-post-image') || parentClass.includes('post-hero') ||
              parentClass.includes('article-hero') || className.includes('featured')) priority += 4;
          
          images.push({
            url: absoluteUrl,
            alt: alt,
            width: width,
            height: height,
            source: 'cryptoslate-enhanced',
            className: className,
            priority: priority
          });
        }
      });
    }
  }
  
  // 99Bitcoins-specific selectors
  if (domain.includes('99bitcoins.com')) {
    const bitcoinsSelectors = [
      // Featured image
      '.featured-image img, .post-thumbnail img',
      // Article content images
      '.post-content img[src*="99bitcoins"], .entry-content img[src*="99bitcoins"]',
      // WordPress attachment images
      '.wp-post-image, .attachment-large, .attachment-full',
      // Hero/banner images
      '.hero-image img, .banner-image img',
      // Content area images
      '.content img[width], .main-content img'
    ];
    
    for (const selector of bitcoinsSelectors) {
      $(selector).each((i, element) => {
        const $img = $(element);
        let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original');
        
        if (!src || src.length < 10) return;
        
        const alt = $img.attr('alt') || '';
        const absoluteUrl = src.startsWith('http') ? src : new URL(src, articleUrl).href;
        
        if (isValidNewsImage(absoluteUrl, alt, $img)) {
          const width = parseInt($img.attr('width')) || 0;
          const height = parseInt($img.attr('height')) || 0;
          const className = $img.attr('class') || '';
          const parentClass = $img.parent().attr('class') || '';
          
          let priority = calculateImagePriority(className, parentClass, alt, width, height);
          // Boost priority for 99Bitcoins featured images
          if (className.includes('featured') || parentClass.includes('featured')) priority += 4;
          
          images.push({
            url: absoluteUrl,
            alt: alt,
            width: width,
            height: height,
            source: '99bitcoins-featured',
            className: className,
            priority: priority
          });
        }
      });
    }
  }
  
  // openPR.com-specific selectors
  if (domain.includes('openpr.com')) {
    const openprSelectors = [
      // Press release images
      '.press-release-image img, .pr-image img',
      // Article content images
      '.article-content img, .press-content img',
      // Featured images
      '.featured img, .main-image img',
      // Content area images with good dimensions
      '.content img[width], .body img[src*="openpr"]'
    ];
    
    for (const selector of openprSelectors) {
      $(selector).each((i, element) => {
        const $img = $(element);
        let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original');
        
        if (!src || src.length < 10) return;
        
        const alt = $img.attr('alt') || '';
        const absoluteUrl = src.startsWith('http') ? src : new URL(src, articleUrl).href;
        
        if (isValidNewsImage(absoluteUrl, alt, $img)) {
          const width = parseInt($img.attr('width')) || 0;
          const height = parseInt($img.attr('height')) || 0;
          const className = $img.attr('class') || '';
          const parentClass = $img.parent().attr('class') || '';
          
          let priority = calculateImagePriority(className, parentClass, alt, width, height);
          // Boost priority for openPR main images
          if (className.includes('main') || parentClass.includes('press-release')) priority += 4;
          
          images.push({
            url: absoluteUrl,
            alt: alt,
            width: width,
            height: height,
            source: 'openpr-featured',
            className: className,
            priority: priority
          });
        }
      });
    }
  }
  
  // CoinDesk-specific selectors
  if (domain.includes('coindesk.com')) {
    const coindeskSelectors = [
      // Article lead image
      '.article-lead-image img, .lead-image img',
      // Featured image
      '.featured-image img, .hero-image img',
      // Article content images
      '.article-wrap img[src*="coindesk"], .content-wrap img[src*="coindesk"]',
      // WordPress and CMS images
      '.wp-post-image, .post-image img',
      // High-resolution content images
      'figure img, .media img, .image-wrap img'
    ];
    
    for (const selector of coindeskSelectors) {
      $(selector).each((i, element) => {
        const $img = $(element);
        let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original');
        
        if (!src || src.length < 10) return;
        
        const alt = $img.attr('alt') || '';
        const absoluteUrl = src.startsWith('http') ? src : new URL(src, articleUrl).href;
        
        if (isValidNewsImage(absoluteUrl, alt, $img)) {
          const width = parseInt($img.attr('width')) || 0;
          const height = parseInt($img.attr('height')) || 0;
          const className = $img.attr('class') || '';
          const parentClass = $img.parent().attr('class') || '';
          
          let priority = calculateImagePriority(className, parentClass, alt, width, height);
          // Boost priority for CoinDesk lead/featured images
          if (className.includes('lead') || parentClass.includes('lead') || 
              className.includes('hero') || parentClass.includes('hero')) priority += 5;
          
          images.push({
            url: absoluteUrl,
            alt: alt,
            width: width,
            height: height,
            source: 'coindesk-featured',
            className: className,
            priority: priority
          });
        }
      });
    }
  }
  
  // Yahoo Finance-specific selectors
  if (domain.includes('finance.yahoo.com')) {
    const yahooFinanceSelectors = [
      // Article hero/lead image
      '.caas-lead-media img, .caas-hero img',
      // Main article image
      '.caas-img img, .caas-figure img',
      // Content images
      '.caas-body img[src*="yahoo"], .caas-content img',
      // Media container images
      '.media-object img, .figure img',
      // High-resolution images
      'img[src*="s.yimg.com"]'
    ];
    
    for (const selector of yahooFinanceSelectors) {
      $(selector).each((i, element) => {
        const $img = $(element);
        let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original');
        
        if (!src || src.length < 10) return;
        
        const alt = $img.attr('alt') || '';
        const absoluteUrl = src.startsWith('http') ? src : new URL(src, articleUrl).href;
        
        if (isValidNewsImage(absoluteUrl, alt, $img)) {
          const width = parseInt($img.attr('width')) || 0;
          const height = parseInt($img.attr('height')) || 0;
          const className = $img.attr('class') || '';
          const parentClass = $img.parent().attr('class') || '';
          
          let priority = calculateImagePriority(className, parentClass, alt, width, height);
          // Boost priority for Yahoo Finance lead/hero images
          if (className.includes('caas-lead') || parentClass.includes('caas-lead') || 
              className.includes('caas-hero') || parentClass.includes('caas-hero')) priority += 5;
          
          images.push({
            url: absoluteUrl,
            alt: alt,
            width: width,
            height: height,
            source: 'yahoo-finance-featured',
            className: className,
            priority: priority
          });
        }
      });
    }
  }
  
  // Brave New Coin-specific selectors
  if (domain.includes('bravenewcoin.com')) {
    const braveNewCoinSelectors = [
      // Article featured image
      '.article-hero img, .post-hero img',
      // Featured/main images
      '.featured-image img, .main-image img',
      // Content images with good resolution
      '.article-content img[width], .post-content img[width]',
      // WordPress and CMS images
      '.wp-post-image, .attachment-large',
      // Figure and media elements
      'figure img, .media img',
      // High-resolution images in content
      '.content img[src*="bravenewcoin"], .article img[src*="bravenewcoin"]'
    ];
    
    for (const selector of braveNewCoinSelectors) {
      $(selector).each((i, element) => {
        const $img = $(element);
        let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original');
        
        if (!src || src.length < 10) return;
        
        const alt = $img.attr('alt') || '';
        const absoluteUrl = src.startsWith('http') ? src : new URL(src, articleUrl).href;
        
        if (isValidNewsImage(absoluteUrl, alt, $img)) {
          const width = parseInt($img.attr('width')) || 0;
          const height = parseInt($img.attr('height')) || 0;
          const className = $img.attr('class') || '';
          const parentClass = $img.parent().attr('class') || '';
          
          let priority = calculateImagePriority(className, parentClass, alt, width, height);
          // Boost priority for Brave New Coin hero/featured images
          if (className.includes('wp-post-image') || parentClass.includes('article-hero') ||
              parentClass.includes('featured')) priority += 4;
          
          images.push({
            url: absoluteUrl,
            alt: alt,
            width: width,
            height: height,
            source: 'bravenewcoin-featured',
            className: className,
            priority: priority
          });
        }
      });
    }
  }

  // CryptoNews.com-specific selectors (enhanced)
  if (domain.includes('cryptonews.com') || domain.includes('crypto.news')) {
    const cryptonewsSelectors = [
      // Article featured image (highest priority)
      '.post-featured-image img, .article-featured img',
      // Hero/banner images
      '.hero-image img, .banner-image img',
      // Content images with good resolution
      '.post-content img[width], .article-content img[width]',
      // WordPress and CMS images
      '.wp-post-image, .post-image img, .attachment-large',
      // Figure and media elements
      'figure img, .media img, .image-wrapper img',
      // High-resolution images in content
      '.content img[src*="cryptonews"], .post-body img[src*="crypto.news"]',
      // Additional CryptoNews specific patterns
      '.article-body img, .news-content img',
      // Thumbnail and gallery images (lower priority)
      '.thumbnail img, .gallery img'
    ];
    
    for (const selector of cryptonewsSelectors) {
      $(selector).each((i, element) => {
        const $img = $(element);
        let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original') || $img.attr('data-lazy-src');
        
        if (!src || src.length < 10) return;
        
        const alt = $img.attr('alt') || '';
        const absoluteUrl = src.startsWith('http') ? src : new URL(src, articleUrl).href;
        
        if (isValidNewsImage(absoluteUrl, alt, $img)) {
          const width = parseInt($img.attr('width')) || 0;
          const height = parseInt($img.attr('height')) || 0;
          const className = $img.attr('class') || '';
          const parentClass = $img.parent().attr('class') || '';
          
          let priority = calculateImagePriority(className, parentClass, alt, width, height);
          // Boost priority for CryptoNews featured images
          if (className.includes('wp-post-image') || parentClass.includes('post-featured') ||
              parentClass.includes('hero') || className.includes('featured')) priority += 4;
          
          images.push({
            url: absoluteUrl,
            alt: alt,
            width: width,
            height: height,
            source: 'cryptonews-enhanced',
            className: className,
            priority: priority
          });
        }
      });
    }
  }
  
  // CoinCentral-specific selectors
  if (domain.includes('coincentral.com')) {
    const coincentralSelectors = [
      // Article featured/hero image
      '.post-hero img, .article-hero img, .featured-image img',
      // Main article content images
      '.post-content img[width], .article-content img[width]',
      // WordPress attachment images
      '.wp-post-image, .attachment-large, .attachment-full',
      // Content images with CoinCentral domain
      '.content img[src*="coincentral"], .post img[src*="coincentral"]',
      // Figure and media elements
      'figure img, .media img, .image-container img',
      // Post thumbnail and lead images
      '.post-thumbnail img, .lead-image img'
    ];
    
    for (const selector of coincentralSelectors) {
      $(selector).each((i, element) => {
        const $img = $(element);
        let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original') || $img.attr('data-lazy-src');
        
        if (!src || src.length < 10) return;
        
        const alt = $img.attr('alt') || '';
        const absoluteUrl = src.startsWith('http') ? src : new URL(src, articleUrl).href;
        
        if (isValidNewsImage(absoluteUrl, alt, $img)) {
          const width = parseInt($img.attr('width')) || 0;
          const height = parseInt($img.attr('height')) || 0;
          const className = $img.attr('class') || '';
          const parentClass = $img.parent().attr('class') || '';
          
          let priority = calculateImagePriority(className, parentClass, alt, width, height);
          // Boost priority for CoinCentral hero/featured images
          if (className.includes('wp-post-image') || parentClass.includes('post-hero') ||
              className.includes('featured') || parentClass.includes('featured')) priority += 4;
          
          images.push({
            url: absoluteUrl,
            alt: alt,
            width: width,
            height: height,
            source: 'coincentral-featured',
            className: className,
            priority: priority
          });
        }
      });
    }
  }
  
  // U.Today-specific selectors
  if (domain.includes('u.today')) {
    const utodaySelectors = [
      // Article hero/featured image
      '.article-hero img, .post-hero img, .news-hero img',
      // Main article images
      '.article-image img, .featured-image img',
      // Content images with good dimensions
      '.article-content img[width], .post-content img[width]',
      // High-resolution content images
      '.content img[src*="u.today"], .article img[src*="u.today"]',
      // WordPress and CMS images
      '.wp-post-image, .attachment-large',
      // Figure and media elements
      'figure img, .media img, .image-wrapper img',
      // Lead and thumbnail images
      '.lead-image img, .post-thumbnail img'
    ];
    
    for (const selector of utodaySelectors) {
      $(selector).each((i, element) => {
        const $img = $(element);
        let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original') || $img.attr('data-lazy-src');
        
        if (!src || src.length < 10) return;
        
        const alt = $img.attr('alt') || '';
        const absoluteUrl = src.startsWith('http') ? src : new URL(src, articleUrl).href;
        
        if (isValidNewsImage(absoluteUrl, alt, $img)) {
          const width = parseInt($img.attr('width')) || 0;
          const height = parseInt($img.attr('height')) || 0;
          const className = $img.attr('class') || '';
          const parentClass = $img.parent().attr('class') || '';
          
          let priority = calculateImagePriority(className, parentClass, alt, width, height);
          // Boost priority for U.Today hero/featured images
          if (className.includes('wp-post-image') || parentClass.includes('article-hero') ||
              parentClass.includes('news-hero') || className.includes('featured')) priority += 4;
          
          images.push({
            url: absoluteUrl,
            alt: alt,
            width: width,
            height: height,
            source: 'utoday-featured',
            className: className,
            priority: priority
          });
        }
      });
    }
  }
  
  // Crypto Daily-specific selectors
  if (domain.includes('cryptodaily.co.uk')) {
    const cryptodailySelectors = [
      // Article featured/hero image
      '.article-hero img, .post-hero img, .featured-image img',
      // Main content images with good resolution
      '.article-content img[width], .post-content img[width]',
      // WordPress and CMS images
      '.wp-post-image, .attachment-large, .attachment-full',
      // Content images from Crypto Daily domain
      '.content img[src*="cryptodaily"], .article img[src*="cryptodaily"]',
      // Figure and media elements
      'figure img, .media img, .image-container img',
      // Post thumbnail and lead images
      '.post-thumbnail img, .lead-image img, .main-image img',
      // News specific containers
      '.news-image img, .story-image img'
    ];
    
    for (const selector of cryptodailySelectors) {
      $(selector).each((i, element) => {
        const $img = $(element);
        let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original') || $img.attr('data-lazy-src');
        
        if (!src || src.length < 10) return;
        
        const alt = $img.attr('alt') || '';
        const absoluteUrl = src.startsWith('http') ? src : new URL(src, articleUrl).href;
        
        if (isValidNewsImage(absoluteUrl, alt, $img)) {
          const width = parseInt($img.attr('width')) || 0;
          const height = parseInt($img.attr('height')) || 0;
          const className = $img.attr('class') || '';
          const parentClass = $img.parent().attr('class') || '';
          
          let priority = calculateImagePriority(className, parentClass, alt, width, height);
          // Boost priority for Crypto Daily hero/featured images
          if (className.includes('wp-post-image') || parentClass.includes('article-hero') ||
              className.includes('featured') || parentClass.includes('featured')) priority += 4;
          
          images.push({
            url: absoluteUrl,
            alt: alt,
            width: width,
            height: height,
            source: 'cryptodaily-featured',
            className: className,
            priority: priority
          });
        }
      });
    }
  }
  
  // Common news site image selectors (in order of priority)
  const imageSelectors = [
    // Featured/hero images
    '.featured-image img, .hero-image img, .article-hero img',
    // Article content images (avoid lazy loaded ones for now)
    '.article-content img:not(.lazyload), .post-content img:not(.lazyload), .entry-content img:not(.lazyload), .content img:not(.lazyload)',
    // Story/news specific selectors
    '.story-image img, .news-image img, .article-image img',
    // WordPress and CMS common selectors (avoid small lazy loaded)
    '.wp-post-image:not(.lazyload), .attachment-large, .attachment-medium',
    // Figure and picture elements
    'figure img:not(.lazyload), picture img',
    // Generic article selectors
    'article img:not(.lazyload), .article img:not(.lazyload), .post img:not(.lazyload)',
    // Finally, try lazy loaded images if no others found
    'img[data-src]:not([class*="64x64"]):not([class*="sm_square"]), img[data-original], img[data-lazy-src]'
  ];
  
  for (const selector of imageSelectors) {
    $(selector).each((i, element) => {
      const $img = $(element);
      let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original') || $img.attr('data-lazy-src');
      
      if (!src || src.length < 10) return; // Skip invalid/empty src
      
      const alt = $img.attr('alt') || '';
      const absoluteUrl = src.startsWith('http') ? src : new URL(src, articleUrl).href;
      
      // Skip if we already have this URL
      if (images.some(img => img.url === absoluteUrl)) return;
      
      // Enhanced filtering logic
      if (isValidNewsImage(absoluteUrl, alt, $img)) {
        // Get image dimensions and context
        const width = parseInt($img.attr('width')) || 0;
        const height = parseInt($img.attr('height')) || 0;
        const className = $img.attr('class') || '';
        const parentClass = $img.parent().attr('class') || '';
        
        // Calculate priority based on context
        let priority = calculateImagePriority(className, parentClass, alt, width, height);
        
        images.push({
          url: absoluteUrl,
          alt: alt,
          width: width,
          height: height,
          source: 'content',
          className: className,
          priority: priority
        });
      }
    });
  }
  
  return images;
}

/**
 * Determine if an image is valid for news articles
 */
function isValidNewsImage(url, alt, $img) {
  const urlLower = url.toLowerCase();
  const altLower = alt.toLowerCase();
  
  // Skip common non-content images
  const skipPatterns = [
    'logo', 'icon', 'avatar', 'profile', 'banner', 'header', 'footer',
    'sidebar', 'ad', 'advertisement', 'sponsor', 'widget', 'button',
    'pixel', 'tracking', 'beacon', 'spacer', 'separator'
  ];
  
  for (const pattern of skipPatterns) {
    if (urlLower.includes(pattern) || altLower.includes(pattern)) {
      return false;
    }
  }
  
  // Skip placeholder/empty images (Bitcoinist specific)
  const placeholderPatterns = [
    'jeg-empty.png', 'placeholder', 'loading.gif', 'spinner', 'blank.png'
  ];
  
  for (const pattern of placeholderPatterns) {
    if (urlLower.includes(pattern)) {
      return false;
    }
  }
  
  // Skip very small images (likely icons) - more restrictive for Bitcoinist
  const width = parseInt($img.attr('width')) || 0;
  const height = parseInt($img.attr('height')) || 0;
  if ((width > 0 && width < 120) || (height > 0 && height < 120)) {
    return false;
  }
  
  // Skip common ad/tracker domains
  const skipDomains = ['googletagmanager.com', 'google-analytics.com', 'facebook.com/tr', 'doubleclick.net'];
  for (const domain of skipDomains) {
    if (urlLower.includes(domain)) {
      return false;
    }
  }
  
  // Must be a reasonable image format
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
  const hasValidExtension = validExtensions.some(ext => urlLower.includes(ext)) || 
                            !urlLower.includes('.'); // URLs without extensions (often CDN)
  
  return hasValidExtension;
}

/**
 * Calculate image priority based on context clues
 */
function calculateImagePriority(className, parentClass, alt, width, height) {
  let priority = 5; // Base priority
  
  const classNames = `${className} ${parentClass}`.toLowerCase();
  const altLower = alt.toLowerCase();
  
  // High priority indicators
  if (classNames.includes('featured') || classNames.includes('hero') || classNames.includes('main')) priority += 3;
  if (classNames.includes('article') || classNames.includes('story') || classNames.includes('news')) priority += 2;
  if (altLower.includes('featured') || altLower.includes('main') || altLower.includes('hero')) priority += 2;
  
  // Bitcoinist-specific high priority
  if (classNames.includes('background-img')) priority += 5;
  if (classNames.includes('wp-post-image') && !classNames.includes('lazyload')) priority += 3;
  
  // Size-based priority (larger images likely more important)
  if (width > 800 && height > 600) priority += 4;
  else if (width > 500 && height > 300) priority += 3;
  else if (width > 300 && height > 200) priority += 2;
  else if (width > 120 && height > 120) priority += 1;
  
  // Penalize very small images (Bitcoinist sidebar thumbnails)
  if ((width > 0 && width <= 64) || (height > 0 && height <= 64)) priority -= 5;
  if (classNames.includes('sm_square') || classNames.includes('64x64')) priority -= 3;
  
  // WordPress specific
  if (classNames.includes('attachment-large')) priority += 3;
  if (classNames.includes('size-large')) priority += 2;
  
  // Penalize lazy loading placeholders
  if (classNames.includes('lazyload') && !classNames.includes('background-img')) priority -= 2;
  
  return priority;
}

/**
 * Extract images from RSS content:encoded field
 */
function extractRSSContentImages(content, articleUrl) {
  if (!content) return [];
  
  try {
    const $ = cheerio.load(content);
    const images = [];
    
    $('img').each((i, element) => {
      const $img = $(element);
      let src = $img.attr('src') || $img.attr('data-src');
      
      if (src) {
        const absoluteUrl = src.startsWith('http') ? src : new URL(src, articleUrl).href;
        const alt = $img.attr('alt') || '';
        
        if (isValidNewsImage(absoluteUrl, alt, $img)) {
          images.push({
            url: absoluteUrl,
            alt: alt,
            source: 'rss-content',
            priority: 6
          });
        }
      }
    });
    
    return images;
  } catch (error) {
    logger.warn('Error parsing RSS content for images:', error.message);
    return [];
  }
}

/**
 * Detect if an image is a generic Google News image
 */
function isGenericGoogleImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return false;
  
  const urlLower = imageUrl.toLowerCase();
  
  // Google generic image patterns
  const googleGenericPatterns = [
    'lh3.googleusercontent.com',
    'lh4.googleusercontent.com', 
    'lh5.googleusercontent.com',
    'lh6.googleusercontent.com'
  ];
  
  for (const pattern of googleGenericPatterns) {
    if (urlLower.includes(pattern)) {
      // Check for specific generic image characteristics
      if (urlLower.includes('s0-w300-rw') || 
          urlLower.includes('=s0-') ||
          urlLower.includes('=w300-') ||
          urlLower.includes('default-') ||
          urlLower.includes('noimage') ||
          urlLower.includes('placeholder')) {
        return true;
      }
      // If it's from googleusercontent but doesn't have these patterns,
      // it might still be generic if it's very small or has generic params
      if (urlLower.includes('=w100') || urlLower.includes('=h100') || 
          urlLower.includes('=s100') || urlLower.includes('=s64')) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Enhanced Google News URL decoding with better Base64/redirect handling
 */
async function decodeGoogleNewsUrl(googleNewsUrl) {
  try {
    logger.info(`Decoding Google News URL: ${googleNewsUrl}`);
    
    // Method 1: Check if URL contains encoded data
    if (googleNewsUrl.includes('articles/')) {
      const articleMatch = googleNewsUrl.match(/articles\/([^?&]+)/);
      if (articleMatch && articleMatch[1]) {
        const encodedData = articleMatch[1];
        
        // Try to decode if it looks like Base64
        try {
          const decoded = Buffer.from(encodedData, 'base64').toString('utf-8');
          const urlMatch = decoded.match(/https?:\/\/[^\s"'>]+/);
          if (urlMatch) {
            logger.info(`Decoded URL from Base64: ${urlMatch[0]}`);
            return urlMatch[0];
          }
        } catch (decodeError) {
          // Not valid Base64, continue with other methods
        }
        
        // Try URL decoding
        try {
          const urlDecoded = decodeURIComponent(encodedData);
          const urlMatch = urlDecoded.match(/https?:\/\/[^\s"'>]+/);
          if (urlMatch) {
            logger.info(`Decoded URL from URI encoding: ${urlMatch[0]}`);
            return urlMatch[0];
          }
        } catch (urlDecodeError) {
          // Continue with redirect method
        }
      }
    }
    
    // Method 2: Follow redirects with better handling
    const response = await axios.get(googleNewsUrl, {
      timeout: 15000,
      maxRedirects: 8, // Increased redirect limit
      validateStatus: (status) => status >= 200 && status < 500,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    // Get the final URL after all redirects
    let finalUrl = response.request.res.responseUrl || 
                   response.request.responseURL || 
                   response.config.url;
    
    if (finalUrl && finalUrl !== googleNewsUrl && !finalUrl.includes('news.google.com')) {
      logger.info(`Google News URL resolved via redirects to: ${finalUrl}`);
      return finalUrl;
    }
    
    // Method 3: Parse response body for embedded URLs
    if (response.data && typeof response.data === 'string') {
      const bodyContent = response.data;
      
      // Look for various URL patterns in the response
      const urlPatterns = [
        /url=([^&"'\s>]+)/gi,
        /href="([^"]+)"/gi,
        /data-url="([^"]+)"/gi,
        /'url'\s*:\s*'([^']+)'/gi,
        /"url"\s*:\s*"([^"]+)"/gi,
        /window\.location\.href\s*=\s*["']([^"']+)["']/gi
      ];
      
      for (const pattern of urlPatterns) {
        let match;
        while ((match = pattern.exec(bodyContent)) !== null) {
          const potentialUrl = decodeURIComponent(match[1]);
          if (potentialUrl.startsWith('http') && !potentialUrl.includes('google.com')) {
            logger.info(`Found embedded URL in Google News response: ${potentialUrl}`);
            return potentialUrl;
          }
        }
      }
    }
    
    logger.warn(`Could not decode Google News URL: ${googleNewsUrl}`);
    return googleNewsUrl;
    
  } catch (error) {
    logger.warn(`Failed to decode Google News URL ${googleNewsUrl}:`, error.message);
    return googleNewsUrl;
  }
}

/**
 * Handle Google News URLs and extract the actual source URL
 */
async function resolveGoogleNewsUrl(googleNewsUrl) {
  try {
    if (!googleNewsUrl.includes('news.google.com')) {
      return googleNewsUrl; // Not a Google News URL
    }
    
    return await decodeGoogleNewsUrl(googleNewsUrl);
    
  } catch (error) {
    logger.warn(`Failed to resolve Google News URL ${googleNewsUrl}:`, error.message);
    return googleNewsUrl; // Return original URL as fallback
  }
}

/**
 * Secondary image extraction with retry logic for failed Google News extractions
 */
async function secondaryImageExtraction(articleUrl, originalImages = [], attempt = 1) {
  const maxAttempts = 3;
  
  if (attempt > maxAttempts) {
    logger.warn(`Max attempts reached for secondary extraction: ${articleUrl}`);
    return originalImages;
  }
  
  try {
    logger.info(`Secondary image extraction attempt ${attempt} for: ${articleUrl}`);
    
    // Wait between attempts with exponential backoff
    if (attempt > 1) {
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Try different user agents for better compatibility
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
    ];
    
    const userAgent = userAgents[attempt - 1] || userAgents[0];
    
    const response = await axios.get(articleUrl, {
      timeout: 20000,
      maxRedirects: 10,
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1'
      },
      validateStatus: (status) => status >= 200 && status < 400
    });
    
    const $ = cheerio.load(response.data);
    const domain = new URL(articleUrl).hostname.toLowerCase();
    const images = [];
    
    // More aggressive image extraction for secondary attempt
    const aggressiveSelectors = [
      // JSON-LD structured data images
      'script[type="application/ld+json"]',
      // Meta tags (even if we already tried them)
      'meta[property*="image"], meta[name*="image"]',
      // Any img with reasonable size attributes
      'img[width], img[height], img[style*="width"], img[style*="height"]',
      // Images in main content areas regardless of class
      'main img, .main img, #main img, .content img, #content img',
      // Article-related containers
      '[class*="article"] img, [class*="post"] img, [class*="story"] img',
      // Images with srcset (responsive images)
      'img[srcset]',
      // Background images in CSS
      '[style*="background-image"]'
    ];
    
    // Extract JSON-LD structured data
    $('script[type="application/ld+json"]').each((i, element) => {
      try {
        const jsonData = JSON.parse($(element).html());
        const extractImagesFromJson = (obj) => {
          if (typeof obj === 'object' && obj !== null) {
            if (obj.image) {
              const imgUrl = typeof obj.image === 'string' ? obj.image : 
                           obj.image.url || obj.image.contentUrl || obj.image['@id'];
              if (imgUrl && imgUrl.startsWith('http')) {
                images.push({
                  url: imgUrl,
                  alt: obj.headline || obj.name || 'Structured data image',
                  source: 'json-ld',
                  priority: 9
                });
              }
            }
            for (const key in obj) {
              extractImagesFromJson(obj[key]);
            }
          } else if (Array.isArray(obj)) {
            obj.forEach(extractImagesFromJson);
          }
        };
        extractImagesFromJson(jsonData);
      } catch (jsonError) {
        // Skip invalid JSON
      }
    });
    
    // Process other selectors
    for (const selector of aggressiveSelectors.slice(1)) {
      $(selector).each((i, element) => {
        const $el = $(element);
        let src = null;
        
        if ($el.is('img')) {
          src = $el.attr('src') || $el.attr('data-src') || $el.attr('data-original') || 
                $el.attr('data-lazy-src') || $el.attr('data-srcset');
          
          // Handle srcset
          if (!src && $el.attr('srcset')) {
            const srcset = $el.attr('srcset');
            const srcsetMatch = srcset.match(/([^\s,]+)\s+\d+[wx]/g);
            if (srcsetMatch && srcsetMatch.length > 0) {
              // Get the largest image from srcset
              src = srcsetMatch[srcsetMatch.length - 1].split(' ')[0];
            }
          }
        } else if ($el.attr('style') && $el.attr('style').includes('background-image')) {
          const style = $el.attr('style');
          const bgMatch = style.match(/background-image:\s*url\(['"]?([^'"\)]+)['"]?\)/);
          if (bgMatch && bgMatch[1]) {
            src = bgMatch[1];
          }
        }
        
        if (src && src.length > 10) {
          const absoluteUrl = src.startsWith('http') ? src : new URL(src, articleUrl).href;
          
          // Skip if we already have this URL
          if (images.some(img => img.url === absoluteUrl) || 
              originalImages.some(img => img.url === absoluteUrl)) {
            return;
          }
          
          const alt = $el.attr('alt') || $el.attr('title') || '';
          
          if (isValidNewsImage(absoluteUrl, alt, $el)) {
            const width = parseInt($el.attr('width')) || parseInt($el.css('width')) || 0;
            const height = parseInt($el.attr('height')) || parseInt($el.css('height')) || 0;
            const className = $el.attr('class') || '';
            const parentClass = $el.parent().attr('class') || '';
            
            let priority = calculateImagePriority(className, parentClass, alt, width, height);
            // Boost priority for images found in secondary extraction
            priority += 2;
            
            images.push({
              url: absoluteUrl,
              alt: alt,
              width: width,
              height: height,
              source: `secondary-extraction-${attempt}`,
              className: className,
              priority: priority
            });
          }
        }
      });
    }
    
    logger.info(`Secondary extraction attempt ${attempt} found ${images.length} additional images`);
    
    // Combine with original images and sort by priority
    const allImages = [...originalImages, ...images];
    allImages.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    // If we found good images, return them; otherwise retry
    if (images.length > 0) {
      return allImages;
    } else {
      return await secondaryImageExtraction(articleUrl, originalImages, attempt + 1);
    }
    
  } catch (error) {
    logger.warn(`Secondary extraction attempt ${attempt} failed for ${articleUrl}:`, error.message);
    
    // Retry on failure
    if (attempt < maxAttempts) {
      return await secondaryImageExtraction(articleUrl, originalImages, attempt + 1);
    } else {
      return originalImages;
    }
  }
}

/**
 * Enhanced image extraction for Google News articles
 */
async function extractGoogleNewsImages(articleUrl, rssContent = null) {
  try {
    logger.info(`Extracting images from Google News article: ${articleUrl}`);
    
    // First, resolve the actual article URL if it's a Google News URL
    const actualUrl = await resolveGoogleNewsUrl(articleUrl);
    
    // If we got a different URL, extract images from the actual source
    if (actualUrl !== articleUrl) {
      logger.info(`Following redirect to source: ${actualUrl}`);
      const primaryImages = await extractArticleImages(actualUrl, rssContent);
      
      // Check if we got any good non-generic images
      const nonGenericImages = primaryImages.filter(img => !isGenericGoogleImage(img.url));
      
      if (nonGenericImages.length > 0) {
        return primaryImages;
      } else {
        // If we only got generic images, try secondary extraction
        logger.info(`Primary extraction yielded generic images, trying secondary extraction`);
        return await secondaryImageExtraction(actualUrl, primaryImages);
      }
    }
    
    // If it's still a Google News URL, try to extract what we can
    let allImages = [];
    
    // Try RSS content first for Google News
    if (rssContent) {
      const rssImages = extractRSSContentImages(rssContent, articleUrl);
      allImages.push(...rssImages);
      logger.info(`Found ${rssImages.length} images in Google News RSS content`);
    }
    
    // For Google News articles, look for specific patterns
    const response = await axios.get(articleUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      maxRedirects: 5
    });
    
    const $ = cheerio.load(response.data);
    
    // Google News specific selectors
    const googleNewsSelectors = [
      // Article images in Google News layout
      'article img[src*="gstatic.com"]',
      'article img[src*="googleusercontent.com"]',
      // Regular content images
      'img[alt*="image"]',
      'img[src*="images"]'
    ];
    
    for (const selector of googleNewsSelectors) {
      $(selector).each((i, element) => {
        const $img = $(element);
        let src = $img.attr('src') || $img.attr('data-src');
        
        if (!src || src.length < 10) return;
        
        const alt = $img.attr('alt') || '';
        const absoluteUrl = src.startsWith('http') ? src : new URL(src, articleUrl).href;
        
        if (isValidNewsImage(absoluteUrl, alt, $img) && !isGenericGoogleImage(absoluteUrl)) {
          allImages.push({
            url: absoluteUrl,
            alt: alt,
            source: 'google-news',
            priority: 6
          });
        }
      });
    }
    
    logger.info(`Extracted ${allImages.length} images from Google News article`);
    return allImages;
    
  } catch (error) {
    logger.warn(`Failed to extract images from Google News article ${articleUrl}:`, error.message);
    return [];
  }
}

/**
 * Extract images from article URL with comprehensive approach
 */
async function extractArticleImages(articleUrl, rssContent = null) {
  try {
    logger.info(`Extracting images from: ${articleUrl}`);
    
    let allImages = [];
    
    // Special handling for Google News URLs
    if (articleUrl.includes('news.google.com')) {
      const googleImages = await extractGoogleNewsImages(articleUrl, rssContent);
      allImages.push(...googleImages);
      
      // Filter out generic Google images
      const nonGenericImages = googleImages.filter(img => !isGenericGoogleImage(img.url));
      
      // If we got good non-generic results from Google News extraction, return those
      if (nonGenericImages.length > 0) {
        return nonGenericImages.slice(0, 8);
      } else if (googleImages.length > 0) {
        // If we only got generic images, try secondary extraction
        logger.info(`Google News extraction yielded only generic images, trying secondary extraction`);
        const resolvedUrl = await resolveGoogleNewsUrl(articleUrl);
        if (resolvedUrl !== articleUrl) {
          const secondaryImages = await secondaryImageExtraction(resolvedUrl, googleImages);
          return secondaryImages.slice(0, 8);
        }
      }
    }
    
    // First, try to extract from RSS content if available
    if (rssContent) {
      const rssImages = extractRSSContentImages(rssContent, articleUrl);
      allImages.push(...rssImages);
      logger.info(`Found ${rssImages.length} images in RSS content`);
    }
    
    // Then fetch and parse the full article
    const response = await axios.get(articleUrl, {
      timeout: 15000, // Increased timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache'
      },
      maxRedirects: 5 // Increased redirect limit for better Google News handling
    });
    
    const $ = cheerio.load(response.data);
    
    // Extract meta tag images (highest priority)
    const metaImages = extractMetaImages($, articleUrl);
    allImages.push(...metaImages);
    logger.info(`Found ${metaImages.length} meta tag images`);
    
    // Extract content images
    const contentImages = extractContentImages($, articleUrl);
    allImages.push(...contentImages);
    logger.info(`Found ${contentImages.length} content images`);
    
    // Remove duplicates and sort by priority
    const uniqueImages = [];
    const seenUrls = new Set();
    
    // Sort by priority (highest first)
    allImages.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    for (const img of allImages) {
      if (!seenUrls.has(img.url)) {
        seenUrls.add(img.url);
        uniqueImages.push(img);
      }
    }
    
    logger.info(`Extracted ${uniqueImages.length} unique images from ${articleUrl}`);
    return uniqueImages.slice(0, 8); // Return top 8 candidates
    
  } catch (error) {
    logger.warn(`Failed to extract images from ${articleUrl}:`, error.message);
    
    // If we have RSS content, try to extract from that at least
    if (rssContent) {
      const rssImages = extractRSSContentImages(rssContent, articleUrl);
      if (rssImages.length > 0) {
        logger.info(`Falling back to ${rssImages.length} RSS content images`);
        return rssImages;
      }
    }
    
    return [];
  }
}

/**
 * Extract images from RSS feed item
 */
function extractRSSItemImages(rssItem) {
  const images = [];
  
  try {
    // Extract from enclosures (common in RSS)
    if (rssItem.enclosure && rssItem.enclosure.url) {
      const url = rssItem.enclosure.url;
      if (isImageUrl(url)) {
        images.push({
          url: url,
          alt: 'RSS enclosure image',
          source: 'rss-enclosure',
          priority: 8,
          type: rssItem.enclosure.type
        });
      }
    }
    
    // Extract from media:content (Media RSS)
    if (rssItem['media:content']) {
      const mediaContent = Array.isArray(rssItem['media:content']) ? rssItem['media:content'] : [rssItem['media:content']];
      for (const media of mediaContent) {
        if (media.$ && media.$.url && isImageUrl(media.$.url)) {
          images.push({
            url: media.$.url,
            alt: media.$.description || 'Media content image',
            source: 'media-content',
            priority: 8,
            width: media.$.width ? parseInt(media.$.width) : 0,
            height: media.$.height ? parseInt(media.$.height) : 0
          });
        }
      }
    }
    
    // Extract from media:thumbnail
    if (rssItem['media:thumbnail']) {
      const mediaThumbnail = Array.isArray(rssItem['media:thumbnail']) ? rssItem['media:thumbnail'] : [rssItem['media:thumbnail']];
      for (const thumb of mediaThumbnail) {
        if (thumb.$ && thumb.$.url) {
          images.push({
            url: thumb.$.url,
            alt: 'Media thumbnail',
            source: 'media-thumbnail',
            priority: 7,
            width: thumb.$.width ? parseInt(thumb.$.width) : 0,
            height: thumb.$.height ? parseInt(thumb.$.height) : 0
          });
        }
      }
    }
    
    // Extract from iTunes image (used by some feeds)
    if (rssItem['itunes:image'] && rssItem['itunes:image'].href) {
      images.push({
        url: rssItem['itunes:image'].href,
        alt: 'iTunes image',
        source: 'itunes-image',
        priority: 6
      });
    }
    
    logger.info(`Extracted ${images.length} images from RSS item`);
    return images;
    
  } catch (error) {
    logger.warn('Error extracting RSS item images:', error.message);
    return [];
  }
}

/**
 * Check if a URL is likely an image
 */
function isImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  const urlLower = url.toLowerCase();
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
  
  // Check for explicit image extensions
  for (const ext of imageExtensions) {
    if (urlLower.includes(ext)) return true;
  }
  
  // Check for common image CDN patterns
  const imageCdnPatterns = [
    'images.', 'img.', 'cdn.', 'media.', 'static.', 'assets.',
    'imgur.com', 'cloudinary.com', 'amazonaws.com'
  ];
  
  for (const pattern of imageCdnPatterns) {
    if (urlLower.includes(pattern)) return true;
  }
  
  return false;
}

/**
 * Generate a cover image for an article with real image extraction
 */
async function generateCoverImage(article) {
  try {
    logger.info(`Generating cover image for article: ${article.title}`);
    
    let imageUrl = null;
    
    // Try to extract images from multiple sources
    let allImages = [];
    
    // First, try RSS item images if available
    if (article.rssItem) {
      const rssImages = extractRSSItemImages(article.rssItem);
      allImages.push(...rssImages);
    }
    
    // Then try to extract from article URL
    if (article.url && article.url !== '#') {
      const rssContent = article.rssItem ? article.rssItem['content:encoded'] : null;
      const extractedImages = await extractArticleImages(article.url, rssContent);
      allImages.push(...extractedImages);
    }
    
    // Sort by priority and try to fetch/resize
    if (allImages.length > 0) {
      allImages.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      
      for (const img of allImages) {
        try {
          const resizedUrl = await fetchAndResizeImage(img.url, 400, 225);
          if (resizedUrl) {
            imageUrl = resizedUrl;
            logger.info(`Successfully processed image from ${img.source}: ${img.url}`);
            break;
          }
        } catch (imgError) {
          logger.warn(`Failed to process image ${img.url}:`, imgError.message);
          continue;
        }
      }
    }
    
    // Fallback to placeholder if no real image found
    if (!imageUrl) {
      const networkColors = {
        'Hedera HBAR': '00f2ff',
        'XDC Network': 'ffa500',
        'Constellation DAG': '9c27b0',
        'Ethereum': '627eea',
        'Bitcoin': 'f7931a',
        'Solana': '9945ff',
        'Breaking News': 'ef4444',
        'Press Release': '3b82f6',
        'Cardano': '0033ad',
        'XRP': '23292f',
        'Polkadot': 'e6007a',
        'Chainlink': '2a5ada',
        'Polygon': '8247e5',
        'Avalanche': 'e84142'
      };
      
      const accentColor = networkColors[article.network] || '00f2ff';
      const title = encodeURIComponent(article.title.substring(0, 100));
      imageUrl = `https://via.placeholder.com/400x225/${accentColor}/ffffff?text=${title}`;
    }
    
    logger.info('Cover image generated successfully');
    return imageUrl;
    
  } catch (error) {
    logger.error('Error generating cover image:', error.message);
    throw new Error(`Failed to generate cover image: ${error.message}`);
  }
}

/**
 * Generate AI-powered cover image using external service
 */
async function generateAICoverImage(article, style = 'modern') {
  try {
    logger.info(`Generating AI cover image for article: ${article.title}`);
    
    // In production, you'd integrate with an AI image generation service
    // Example with OpenAI DALL-E:
    /*
    const response = await axios.post('https://api.openai.com/v1/images/generations', {
      prompt: `Create a modern, professional cover image for a cryptocurrency news article titled "${article.title}". 
               Style: ${style}, Network: ${article.network}, Category: ${article.category}. 
               The image should be suitable for social media sharing and professional presentation.`,
      n: 1,
      size: '1792x1024',
      quality: 'hd',
      style: 'vivid'
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.data[0].url;
    */
    
    // For demo purposes, return a placeholder
    // Card-optimized dimensions: 400x225 (16:9 aspect ratio for cards)
    return `https://via.placeholder.com/400x225/1a1a2e/ffffff?text=${encodeURIComponent(article.title)}`;
    
  } catch (error) {
    logger.error('Error generating AI cover image:', error.message);
    throw new Error(`Failed to generate AI cover image: ${error.message}`);
  }
}

/**
 * Generate card-optimized cover image with real image resizing
 */
async function generateCardCoverImage(article) {
  try {
    logger.info(`Generating card-optimized cover image for article: ${article.title}`);
    
    // Card sizes for different layouts
    const cardSizes = {
      small: { width: 300, height: 169 },    // Small cards
      medium: { width: 400, height: 225 },   // Standard cards
      large: { width: 500, height: 281 },    // Large cards
      square: { width: 300, height: 300 }    // Square cards
    };
    
    const results = {};
    let sourceImage = null;
    
    // Try to extract real images from multiple sources
    let allImages = [];
    
    // First, try RSS item images if available
    if (article.rssItem) {
      const rssImages = extractRSSItemImages(article.rssItem);
      allImages.push(...rssImages);
    }
    
    // Then try to extract from article URL
    if (article.url && article.url !== '#') {
      const rssContent = article.rssItem ? article.rssItem['content:encoded'] : null;
      const extractedImages = await extractArticleImages(article.url, rssContent);
      allImages.push(...extractedImages);
    }
    
    // Sort by priority and use the best image
    if (allImages.length > 0) {
      allImages.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      sourceImage = allImages[0]; // Use the highest priority image
      logger.info(`Using image from ${sourceImage.source}: ${sourceImage.url}`);
    }
    
    // Generate images for each card size
    for (const [sizeName, dimensions] of Object.entries(cardSizes)) {
      if (sourceImage) {
        // Try to resize real image
        const resizedUrl = await fetchAndResizeImage(
          sourceImage.url, 
          dimensions.width, 
          dimensions.height
        );
        
        if (resizedUrl) {
          results[sizeName] = resizedUrl;
          continue;
        }
      }
      
      // Fallback to placeholder
      const networkColors = {
        'Hedera HBAR': '00f2ff',
        'XDC Network': 'ffa500',
        'Constellation DAG': '9c27b0',
        'Ethereum': '627eea',
        'Bitcoin': 'f7931a',
        'Solana': '9945ff',
        'Breaking News': 'ef4444',
        'Press Release': '3b82f6',
        'Cardano': '0033ad',
        'XRP': '23292f',
        'Polkadot': 'e6007a',
        'Chainlink': '2a5ada',
        'Polygon': '8247e5',
        'Avalanche': 'e84142',
        'Uniswap': 'ff007a'
      };
      
      const accentColor = networkColors[article.network] || '00f2ff';
      const title = encodeURIComponent(article.title.substring(0, 60));
      const sizeStr = `${dimensions.width}x${dimensions.height}`;
      
      results[sizeName] = `https://via.placeholder.com/${sizeStr}/${accentColor}/ffffff?text=${title}`;
    }
    
    logger.info('Card cover images generated successfully');
    return results;
    
  } catch (error) {
    logger.error('Error generating card cover image:', error.message);
    throw new Error(`Failed to generate card cover image: ${error.message}`);
  }
}

/**
 * Generate social media optimized images
 */
async function generateSocialMediaImages(article) {
  try {
    logger.info(`Generating social media images for article: ${article.title}`);
    
    const images = {};
    
    // Twitter/X image (1200x675)
    images.twitter = await generateImage(article, 1200, 675, 'twitter');
    
    // LinkedIn image (1200x627)
    images.linkedin = await generateImage(article, 1200, 627, 'linkedin');
    
    // Facebook image (1200x630)
    images.facebook = await generateImage(article, 1200, 630, 'facebook');
    
    // Instagram image (1080x1080)
    images.instagram = await generateImage(article, 1080, 1080, 'instagram');
    
    logger.info('Social media images generated successfully');
    return images;
    
  } catch (error) {
    logger.error('Error generating social media images:', error.message);
    throw new Error(`Failed to generate social media images: ${error.message}`);
  }
}

/**
 * Generate image with specific dimensions and platform optimization
 */
async function generateImage(article, width, height, platform) {
  try {
    // Platform-specific styling
    const platformColors = {
      twitter: '1DA1F2',
      linkedin: '0077B5', 
      facebook: '1877F2',
      instagram: 'E4405F'
    };
    
    const color = platformColors[platform] || '00f2ff';
    const title = encodeURIComponent(article.title.substring(0, 80));
    
    return `https://via.placeholder.com/${width}x${height}/${color}/ffffff?text=${title}`;
    
  } catch (error) {
    logger.error(`Error generating ${platform} image:`, error.message);
    throw new Error(`Failed to generate ${platform} image: ${error.message}`);
  }
}

/**
 * Optimize image for web delivery
 */
async function optimizeImage(imageBuffer, quality = 0.8) {
  try {
    // In production, you'd use a library like Sharp or ImageMagick
    // For demo purposes, return the original buffer
    return imageBuffer;
  } catch (error) {
    logger.error('Error optimizing image:', error.message);
    throw new Error(`Failed to optimize image: ${error.message}`);
  }
}

module.exports = {
  generateCoverImage,
  generateAICoverImage,
  generateCardCoverImage,
  generateSocialMediaImages,
  generateImage,
  optimizeImage,
  fetchAndResizeImage,
  extractArticleImages,
  extractGoogleNewsImages,
  resolveGoogleNewsUrl,
  extractRSSItemImages,
  isImageUrl,
  isGenericGoogleImage,
  decodeGoogleNewsUrl,
  secondaryImageExtraction
};
