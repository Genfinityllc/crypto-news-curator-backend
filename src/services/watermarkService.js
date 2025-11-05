const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

/**
 * Genfinity Watermark Service
 * Adds Genfinity watermark overlay to all generated images
 */
class WatermarkService {
  constructor() {
    this.watermarkPath = path.join(__dirname, '../../assets/genfinity-watermark.png');
    this.hfSpacesWatermarkUrl = 'https://valtronk-crypto-news-lora-generator.hf.space/file/genfinity-watermark.png';
    this.watermarkPosition = 'overlay'; // Full-size overlay as requested
    this.watermarkOpacity = 1.0; // Full opacity for perfect overlay
    this.useHfSpacesWatermark = false; // Use local first, then HF Spaces fallback
    
    logger.info('🎨 Genfinity Watermark Service initialized - Using local file with HF Spaces fallback');
  }

  /**
   * Add Genfinity watermark and optional title to image
   */
  async addWatermark(inputImagePath, outputImagePath = null, options = {}) {
    try {
      // Create unique output path to avoid Sharp conflict
      const finalOutputPath = outputImagePath || inputImagePath.replace(/(\.[^.]+)$/, '_watermarked$1');
      
      const { title } = options;
      logger.info(`🏷️ Adding Genfinity watermark${title ? ' and title' : ''} to: ${path.basename(inputImagePath)}`);
      
      // Load main image info
      const mainImage = sharp(inputImagePath);
      const { width: mainWidth, height: mainHeight } = await mainImage.metadata();
      
      // Create composite layers array
      const compositeOperations = [];
      
      // Add title overlay if provided
      if (title) {
        const titleOverlay = await this.createTitleOverlay(mainWidth, mainHeight, title);
        compositeOperations.push({
          input: titleOverlay,
          left: 0,
          top: 0,
          blend: 'over'
        });
      }
      
      // Get watermark (from HF Spaces or local)
      const watermarkBuffer = await this.getWatermarkBuffer();
      
      // Resize watermark maintaining aspect ratio, no stretching
      const overlayWatermark = sharp(watermarkBuffer)
        .resize(mainWidth, mainHeight, {
          fit: 'inside', // Maintain aspect ratio, no stretching
          position: 'centre',
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
        })
        .png({ quality: 95 });
      
      // Add watermark to composite operations
      compositeOperations.push({
        input: await overlayWatermark.toBuffer(),
        left: 0,
        top: 0,
        blend: 'over', // Use 'over' blend mode for 100% opacity
      });
      
      // Apply all overlays
      await mainImage
        .composite(compositeOperations)
        .png({ quality: 95 })
        .toFile(finalOutputPath);
      
      // If we created a temp file, replace the original
      if (!outputImagePath && finalOutputPath !== inputImagePath) {
        await fs.rename(finalOutputPath, inputImagePath);
        logger.info(`✅ Genfinity full-size watermark overlay applied successfully to: ${path.basename(inputImagePath)}`);
        
        return {
          success: true,
          outputPath: inputImagePath,
          watermarkInfo: {
            type: 'full_size_overlay',
            source: this.useHfSpacesWatermark ? 'hf_spaces' : 'local',
            position: this.watermarkPosition,
            opacity: this.watermarkOpacity
          }
        };
      }
      
      logger.info(`✅ Genfinity full-size watermark overlay applied successfully to: ${path.basename(finalOutputPath)}`);
      
      return {
        success: true,
        outputPath: finalOutputPath,
        watermarkInfo: {
          type: 'full_size_overlay',
          source: this.useHfSpacesWatermark ? 'hf_spaces' : 'local',
          position: this.watermarkPosition,
          opacity: this.watermarkOpacity
        }
      };
      
    } catch (error) {
      logger.error(`❌ Watermark application failed: ${error.message}`);
      throw new Error(`Watermark failed: ${error.message}`);
    }
  }

  /**
   * Get watermark buffer from local file or HF Spaces fallback
   */
  async getWatermarkBuffer() {
    let localError = null;
    
    // Try local watermark first
    try {
      await fs.access(this.watermarkPath);
      const watermarkBuffer = await fs.readFile(this.watermarkPath);
      logger.info(`📁 Using local watermark: ${this.watermarkPath}`);
      return watermarkBuffer;
    } catch (error) {
      localError = error;
      logger.warn(`⚠️ Local watermark not accessible: ${error.message}`);
      logger.info(`🔄 Trying HF Spaces fallback`);
    }
    
    // Fall back to HF Spaces if local fails
    try {
      logger.info(`📥 Downloading watermark from HF Spaces: ${this.hfSpacesWatermarkUrl}`);
      const axios = require('axios');
      
      const response = await axios.get(this.hfSpacesWatermarkUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });
      
      logger.info(`✅ HF Spaces watermark downloaded successfully`);
      return Buffer.from(response.data);
      
    } catch (hfError) {
      logger.error(`❌ HF Spaces watermark failed: ${hfError.message}`);
      throw new Error(`Neither local nor HF Spaces watermark available. Local: ${localError?.message || 'unknown'}, HF: ${hfError.message}`);
    }
  }

  /**
   * Verify watermark file exists
   */
  async verifyWatermarkExists() {
    try {
      await fs.access(this.watermarkPath);
      logger.debug(`✅ Watermark verified: ${this.watermarkPath}`);
    } catch (error) {
      throw new Error(`Genfinity watermark not found: ${this.watermarkPath}`);
    }
  }

  /**
   * Prepare watermark with proper scaling and opacity
   */
  async prepareWatermark(mainWidth, mainHeight) {
    try {
      // Scale watermark based on main image size
      const scale = this.calculateWatermarkScale(mainWidth, mainHeight);
      const scaledWidth = Math.round(this.watermarkSize.width * scale);
      const scaledHeight = Math.round(this.watermarkSize.height * scale);
      
      logger.debug(`🔧 Scaling watermark to: ${scaledWidth}x${scaledHeight} (scale: ${scale.toFixed(2)})`);
      
      // Load and process watermark
      const watermark = sharp(this.watermarkPath)
        .resize(scaledWidth, scaledHeight, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png();
      
      // Store scaled dimensions for position calculation
      watermark.width = scaledWidth;
      watermark.height = scaledHeight;
      
      return watermark;
      
    } catch (error) {
      throw new Error(`Watermark preparation failed: ${error.message}`);
    }
  }

  /**
   * Calculate appropriate watermark scale based on image size
   */
  calculateWatermarkScale(mainWidth, mainHeight) {
    // Base scale for different image sizes
    const minDimension = Math.min(mainWidth, mainHeight);
    
    if (minDimension >= 1800) return 1.2; // Large images - bigger watermark
    if (minDimension >= 1200) return 1.0; // Standard size
    if (minDimension >= 800) return 0.8;  // Medium images
    return 0.6; // Small images - smaller watermark
  }

  /**
   * Create title overlay for the image
   */
  async createTitleOverlay(width, height, title) {
    try {
      // Create SVG for title overlay
      const fontSize = Math.max(48, Math.min(72, width * 0.04)); // Responsive font size
      const lineHeight = fontSize * 1.2;
      
      // Break title into lines if too long
      const maxCharsPerLine = Math.floor(width / (fontSize * 0.6));
      const titleLines = this.breakTextIntoLines(title, maxCharsPerLine);
      
      // Calculate total text height
      const totalTextHeight = titleLines.length * lineHeight;
      const startY = (height - totalTextHeight) / 2 + fontSize; // Center vertically
      
      // Create SVG text elements
      const textElements = titleLines.map((line, index) => {
        const y = startY + (index * lineHeight);
        return `
          <text x="50%" y="${y}" 
                text-anchor="middle" 
                font-family="Arial, sans-serif" 
                font-size="${fontSize}" 
                font-weight="bold" 
                fill="white" 
                stroke="black" 
                stroke-width="2">${this.escapeXml(line)}</text>
        `;
      }).join('');
      
      const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="3" dy="3" stdDeviation="3" flood-color="black" flood-opacity="0.7"/>
            </filter>
          </defs>
          <g filter="url(#shadow)">
            ${textElements}
          </g>
        </svg>
      `;
      
      // Convert SVG to buffer
      return Buffer.from(svg);
      
    } catch (error) {
      logger.error('❌ Failed to create title overlay:', error);
      // Return transparent overlay if title creation fails
      return sharp({
        create: {
          width: width,
          height: height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      }).png().toBuffer();
    }
  }

  /**
   * Break text into lines to fit width
   */
  breakTextIntoLines(text, maxCharsPerLine) {
    if (text.length <= maxCharsPerLine) {
      return [text];
    }
    
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Word is too long, truncate it
          lines.push(word.substring(0, maxCharsPerLine - 3) + '...');
          currentLine = '';
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }

  /**
   * Escape XML special characters
   */
  escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Calculate watermark position
   */
  calculatePosition(mainWidth, mainHeight, watermarkWidth, watermarkHeight) {
    let x, y;
    
    switch (this.watermarkPosition) {
      case 'bottom-right':
        x = mainWidth - watermarkWidth - this.padding.x;
        y = mainHeight - watermarkHeight - this.padding.y;
        break;
      case 'bottom-left':
        x = this.padding.x;
        y = mainHeight - watermarkHeight - this.padding.y;
        break;
      case 'top-right':
        x = mainWidth - watermarkWidth - this.padding.x;
        y = this.padding.y;
        break;
      case 'top-left':
        x = this.padding.x;
        y = this.padding.y;
        break;
      case 'center':
        x = (mainWidth - watermarkWidth) / 2;
        y = (mainHeight - watermarkHeight) / 2;
        break;
      default:
        // Default to bottom-right
        x = mainWidth - watermarkWidth - this.padding.x;
        y = mainHeight - watermarkHeight - this.padding.y;
    }
    
    // Ensure position is within bounds
    x = Math.max(0, Math.min(x, mainWidth - watermarkWidth));
    y = Math.max(0, Math.min(y, mainHeight - watermarkHeight));
    
    logger.debug(`📍 Watermark position: ${x}, ${y}`);
    
    return { x: Math.round(x), y: Math.round(y) };
  }

  /**
   * Set watermark position
   */
  setPosition(position) {
    const validPositions = ['bottom-right', 'bottom-left', 'top-right', 'top-left', 'center'];
    if (validPositions.includes(position)) {
      this.watermarkPosition = position;
      logger.info(`🎯 Watermark position set to: ${position}`);
    } else {
      logger.warn(`⚠️ Invalid position: ${position}. Using default: bottom-right`);
    }
  }

  /**
   * Set watermark opacity
   */
  setOpacity(opacity) {
    if (opacity >= 0 && opacity <= 1) {
      this.watermarkOpacity = opacity;
      logger.info(`🎨 Watermark opacity set to: ${opacity}`);
    } else {
      logger.warn(`⚠️ Invalid opacity: ${opacity}. Using default: 0.8`);
    }
  }

  /**
   * Batch watermark multiple images
   */
  async batchWatermark(imagePaths) {
    const results = [];
    
    for (const imagePath of imagePaths) {
      try {
        const result = await this.addWatermark(imagePath);
        results.push({ path: imagePath, success: true, result });
      } catch (error) {
        results.push({ path: imagePath, success: false, error: error.message });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    logger.info(`📊 Batch watermark complete: ${successful}/${imagePaths.length} successful`);
    
    return results;
  }
}

module.exports = WatermarkService;