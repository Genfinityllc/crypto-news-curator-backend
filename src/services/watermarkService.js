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
    this.watermarkPosition = 'bottom-right'; // Default position
    this.watermarkOpacity = 0.8; // 80% opacity
    this.watermarkSize = { width: 200, height: 60 }; // Reasonable size
    this.padding = { x: 20, y: 20 }; // Padding from edges
    
    logger.info('🎨 Genfinity Watermark Service initialized');
  }

  /**
   * Add Genfinity watermark to image
   */
  async addWatermark(inputImagePath, outputImagePath = null) {
    try {
      // Use same path if no output specified (overwrite)
      const finalOutputPath = outputImagePath || inputImagePath;
      
      logger.info(`🏷️ Adding Genfinity watermark to: ${path.basename(inputImagePath)}`);
      
      // Verify watermark exists
      await this.verifyWatermarkExists();
      
      // Load main image info
      const mainImage = sharp(inputImagePath);
      const { width: mainWidth, height: mainHeight } = await mainImage.metadata();
      
      // Prepare watermark
      const watermark = await this.prepareWatermark(mainWidth, mainHeight);
      
      // Calculate position
      const position = this.calculatePosition(mainWidth, mainHeight, watermark.width, watermark.height);
      
      // Apply watermark
      await mainImage
        .composite([{
          input: await watermark.png().toBuffer(),
          left: position.x,
          top: position.y,
          blend: 'over'
        }])
        .png({ quality: 95 })
        .toFile(finalOutputPath);
      
      logger.info(`✅ Watermark applied successfully: ${path.basename(finalOutputPath)}`);
      
      return {
        success: true,
        outputPath: finalOutputPath,
        watermarkInfo: {
          position: this.watermarkPosition,
          size: this.watermarkSize,
          opacity: this.watermarkOpacity
        }
      };
      
    } catch (error) {
      logger.error(`❌ Watermark application failed: ${error.message}`);
      throw new Error(`Watermark failed: ${error.message}`);
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