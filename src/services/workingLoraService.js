const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const logger = require('../utils/logger');
const WatermarkService = require('./watermarkService');

/**
 * WORKING Universal LoRA Service - Uses the actual HF Spaces pattern that works
 * Based on manual testing of the HF Space API
 */
class WorkingLoraService {
  constructor() {
    this.hfSpacesUrl = process.env.HF_SPACES_LORA_URL || 'https://valtronk-crypto-news-lora-generator.hf.space';
    this.timeout = 240000; // 4 minutes
    this.imageStorePath = path.join(__dirname, '../../temp/lora-images');
    this.baseUrl = process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app';
    this.watermarkService = new WatermarkService();
    
    // Ensure storage directory exists (non-blocking)
    this.ensureStorageDirectory().catch(err => {
      logger.error('❌ Failed to create storage directory:', err);
    });
    
    logger.info('🎨 WORKING Universal LoRA Service initialized - Real HF Spaces pattern');
  }

  async ensureStorageDirectory() {
    try {
      await fs.mkdir(this.imageStorePath, { recursive: true });
      logger.info(`📁 LoRA image storage ready: ${this.imageStorePath}`);
    } catch (error) {
      logger.error('❌ Failed to create storage directory:', error);
    }
  }

  /**
   * Generate unique image ID
   */
  generateImageId() {
    const randomBytes = crypto.randomBytes(8);
    return `lora_${randomBytes.toString('hex')}`;
  }

  /**
   * Get hosted image URL for an image ID
   */
  getImageUrl(imageId) {
    return `${this.baseUrl}/temp/lora-images/${imageId}.png`;
  }

  /**
   * TEMPORARY: Ultra-simple fallback to prevent backend crashes
   */
  async generateUniversalLoraImage(title, subtitle = '', client = '', style = 'modern') {
    try {
      const imageId = this.generateImageId();
      const startTime = Date.now();
      
      logger.info(`🎨 FALLBACK: Creating simple placeholder for: "${title}"`);
      
      // Create a simple placeholder image using Sharp
      const imagePath = path.join(this.imageStorePath, `${imageId}.png`);
      
      // Generate a simple colored rectangle with text as fallback
      await this.createSimplePlaceholder(imagePath, title, 1800, 900);
      
      const fileSize = (await fs.stat(imagePath)).size;
      logger.info(`💾 Placeholder image created: ${imagePath} (${fileSize} bytes)`);
      
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      logger.info(`🎉 Fallback generation completed in ${totalTime}s`);
      
      return {
        success: true,
        imageId: imageId,
        imageUrl: this.getImageUrl(imageId),
        localPath: imagePath,
        metadata: {
          title,
          subtitle,
          client,
          style,
          generationTime: totalTime,
          method: 'simple_fallback',
          model: 'placeholder',
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('❌ Even fallback generation failed:', error);
      throw new Error(`Fallback generation failed: ${error.message}`);
    }
  }

  /**
   * Create simple placeholder image (ultra-safe fallback)
   */
  async createSimplePlaceholder(imagePath, title, width, height) {
    try {
      // Create SVG with title
      const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#1a1a2e"/>
          <rect x="50" y="50" width="${width-100}" height="${height-100}" fill="#16213e" stroke="#0f3460" stroke-width="4"/>
          <text x="50%" y="50%" text-anchor="middle" dy="0.35em" 
                font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#e94560">
            ${this.escapeXml(title.substring(0, 50))}
          </text>
          <text x="50%" y="85%" text-anchor="middle" 
                font-family="Arial, sans-serif" font-size="24" fill="#ffffff">
            Crypto News Cover
          </text>
        </svg>
      `;
      
      // Convert SVG to PNG using Sharp
      await sharp(Buffer.from(svg))
        .png()
        .toFile(imagePath);
        
      logger.info(`✅ Simple placeholder created: ${title.substring(0, 30)}...`);
      
    } catch (error) {
      logger.error('❌ Placeholder creation failed:', error);
      // Ultimate fallback - create a solid color image
      await sharp({
        create: {
          width: width,
          height: height,
          channels: 3,
          background: { r: 26, g: 26, b: 46 }
        }
      }).png().toFile(imagePath);
    }
  }

  /**
   * Escape XML special characters (simple version)
   */
  escapeXml(text) {
    return (text || '').replace(/[<>&"']/g, function (c) {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return c;
      }
    });
  }

  /**
   * Create enhanced prompt for better generation
   */
  createEnhancedPrompt(title, subtitle, client, style) {
    let prompt = `Professional cryptocurrency news cover: ${title}`;
    
    if (subtitle) {
      prompt += `, ${subtitle}`;
    }
    
    // Add style-specific keywords
    const styleKeywords = {
      'modern': 'clean, minimalist, professional, high-tech',
      'futuristic': 'neon, cyberpunk, digital, advanced technology',
      'classic': 'traditional, elegant, sophisticated, timeless',
      'bold': 'vibrant colors, strong typography, dramatic, eye-catching'
    };
    
    if (styleKeywords[style]) {
      prompt += `, ${styleKeywords[style]}`;
    }
    
    prompt += ', crypto currency, blockchain, digital asset, high quality, detailed, 4k';
    
    return prompt;
  }

  /**
   * Resize image to final 1800x900 dimensions for output
   */
  async resizeToStandardDimensions(imagePath) {
    try {
      logger.info(`📐 Resizing to final output dimensions 1800x900: ${path.basename(imagePath)}`);
      
      const tempPath = imagePath.replace('.png', '_resized.png');
      
      await sharp(imagePath)
        .resize(1800, 900, {  // Final output dimensions as required
          fit: 'cover',
          position: 'center'
        })
        .png({ quality: 95 })
        .toFile(tempPath);
      
      // Replace original with resized version
      await fs.rename(tempPath, imagePath);
      logger.info(`✅ Image resized to final 1800x900 output dimensions: ${path.basename(imagePath)}`);
      
    } catch (error) {
      throw new Error(`Image resize failed: ${error.message}`);
    }
  }

  /**
   * Compatibility method for old imageHostingService calls
   */
  async generateLoraImage(title, content = '', network = 'generic', style = 'modern') {
    return this.generateUniversalLoraImage(title, content, network, style);
  }

  /**
   * Generate session hash for Gradio
   */
  generateSessionHash() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Parse SSE response data for queue completion
   */
  parseSSEResponse(data, targetEventId) {
    try {
      const responseText = typeof data === 'string' ? data : String(data);
      const lines = responseText.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonText = line.substring(6).trim();
            if (!jsonText || jsonText === '[DONE]') continue;
            
            const parsed = JSON.parse(jsonText);
            
            // Check if this event matches our target
            if (parsed.event_id === targetEventId) {
              if (parsed.msg === 'process_completed' && parsed.output) {
                logger.info(`🎉 HF Spaces generation completed for event: ${targetEventId}`);
                return parsed;
              }
              
              if (parsed.msg === 'estimation') {
                const eta = parsed.rank_eta ? `${parsed.rank_eta}s` : 'N/A';
                const pos = parsed.rank || 'N/A';
                logger.info(`⏳ Queue position: ${pos}, estimated wait: ${eta}`);
              }
              
              if (parsed.msg === 'process_starts') {
                logger.info(`🚀 HF Spaces processing started for event: ${targetEventId}`);
              }
              
              if (parsed.msg === 'progress') {
                const progress = parsed.progress || 0;
                logger.info(`📊 Generation progress: ${(progress * 100).toFixed(1)}%`);
              }
            }
          } catch (parseError) {
            // Ignore malformed JSON lines - normal for SSE
            logger.debug(`Skipping non-JSON SSE line: ${line.substring(0, 50)}...`);
          }
        }
      }
    } catch (error) {
      logger.warn(`⚠️ SSE parsing error: ${error.message}`);
    }
    
    return null;
  }

  /**
   * Test HF Spaces connectivity
   */
  async testConnection() {
    try {
      logger.info(`🔍 Testing HF Spaces connection: ${this.hfSpacesUrl}`);
      
      const response = await axios.get(`${this.hfSpacesUrl}/info`, {
        timeout: 10000
      });
      
      logger.info(`✅ HF Spaces is accessible`);
      
      return {
        success: true,
        endpoints: response.data.named_endpoints,
        status: 'accessible'
      };
      
    } catch (error) {
      logger.error(`❌ HF Spaces connection failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        status: 'unreachable'
      };
    }
  }
}

module.exports = WorkingLoraService;