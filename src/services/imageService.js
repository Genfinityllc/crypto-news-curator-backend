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
 * Extract images from article URL
 */
async function extractArticleImages(articleUrl) {
  try {
    logger.info(`Extracting images from: ${articleUrl}`);
    
    const response = await axios.get(articleUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const images = [];
    
    // Look for article images
    $('img').each((i, element) => {
      const src = $(element).attr('src');
      const alt = $(element).attr('alt') || '';
      
      if (src) {
        // Make URL absolute
        const absoluteUrl = src.startsWith('http') ? src : new URL(src, articleUrl).href;
        
        // Filter out small images, icons, ads
        const width = parseInt($(element).attr('width')) || 0;
        const height = parseInt($(element).attr('height')) || 0;
        
        if ((width > 200 && height > 150) || (!width && !height)) {
          images.push({
            url: absoluteUrl,
            alt: alt,
            width: width,
            height: height
          });
        }
      }
    });
    
    return images.slice(0, 5); // Return top 5 candidates
    
  } catch (error) {
    logger.warn(`Failed to extract images from ${articleUrl}:`, error.message);
    return [];
  }
}

/**
 * Generate a cover image for an article with real image extraction
 */
async function generateCoverImage(article) {
  try {
    logger.info(`Generating cover image for article: ${article.title}`);
    
    let imageUrl = null;
    
    // Try to extract real image from article
    if (article.url && article.url !== '#') {
      const extractedImages = await extractArticleImages(article.url);
      
      if (extractedImages.length > 0) {
        // Try to fetch and resize the best image candidate
        for (const img of extractedImages) {
          const resizedUrl = await fetchAndResizeImage(img.url, 400, 225);
          if (resizedUrl) {
            imageUrl = resizedUrl;
            break;
          }
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
    
    // Try to extract real image from article first
    if (article.url && article.url !== '#') {
      const extractedImages = await extractArticleImages(article.url);
      if (extractedImages.length > 0) {
        sourceImage = extractedImages[0]; // Use the first (best) image
      }
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
  extractArticleImages
};
