const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * LoRA Archive Endpoint
 * Provides access to all generated LoRA images with metadata
 */

const LORA_IMAGES_PATH = path.join(__dirname, '../../temp/lora-images');
const BASE_URL = process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app';

/**
 * GET /api/lora-archive
 * Returns list of all LoRA generated images with metadata
 */
router.get('/', async (req, res) => {
  try {
    logger.info('📁 Fetching LoRA archive...');
    
    // Ensure directory exists
    try {
      await fs.access(LORA_IMAGES_PATH);
    } catch (error) {
      logger.warn('⚠️ LoRA images directory not found, creating...');
      await fs.mkdir(LORA_IMAGES_PATH, { recursive: true });
      return res.json({
        success: true,
        message: 'Archive directory created, no images yet',
        images: [],
        count: 0
      });
    }

    // Read directory contents
    const files = await fs.readdir(LORA_IMAGES_PATH);
    const loraFiles = files.filter(file => 
      file.startsWith('lora_') && 
      (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.webp'))
    );

    // Get file metadata
    const images = [];
    for (const file of loraFiles) {
      try {
        const filePath = path.join(LORA_IMAGES_PATH, file);
        const stats = await fs.stat(filePath);
        
        const imageInfo = {
          id: file.replace(/\.[^.]+$/, ''), // Remove extension for ID
          filename: file,
          url: `${BASE_URL}/temp/lora-images/${file}`,
          created: stats.birthtime,
          modified: stats.mtime,
          size: stats.size,
          sizeFormatted: formatFileSize(stats.size),
          age: calculateAge(stats.birthtime),
          ageFormatted: formatAge(stats.birthtime)
        };
        
        images.push(imageInfo);
      } catch (statError) {
        logger.warn(`Failed to get stats for ${file}:`, statError.message);
      }
    }

    // Sort by creation time (newest first)
    images.sort((a, b) => new Date(b.created) - new Date(a.created));

    logger.info(`✅ LoRA archive retrieved: ${images.length} images`);

    res.json({
      success: true,
      images,
      count: images.length,
      totalSize: images.reduce((sum, img) => sum + img.size, 0),
      totalSizeFormatted: formatFileSize(images.reduce((sum, img) => sum + img.size, 0)),
      archivePath: '/temp/lora-images',
      retentionPeriod: '4 days'
    });

  } catch (error) {
    logger.error('❌ LoRA archive fetch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch LoRA archive',
      message: error.message
    });
  }
});

/**
 * GET /api/lora-archive/:imageId
 * Returns specific image metadata and direct URL
 */
router.get('/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    
    if (!imageId.startsWith('lora_')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid LoRA image ID format'
      });
    }

    logger.info(`🔍 Fetching LoRA image: ${imageId}`);

    // Find the file (check multiple extensions)
    const extensions = ['.png', '.jpg', '.webp'];
    let foundFile = null;
    
    for (const ext of extensions) {
      const filename = `${imageId}${ext}`;
      const filePath = path.join(LORA_IMAGES_PATH, filename);
      
      try {
        await fs.access(filePath);
        foundFile = filename;
        break;
      } catch (error) {
        // File doesn't exist with this extension, try next
      }
    }

    if (!foundFile) {
      return res.status(404).json({
        success: false,
        error: 'LoRA image not found',
        imageId
      });
    }

    // Get file stats
    const filePath = path.join(LORA_IMAGES_PATH, foundFile);
    const stats = await fs.stat(filePath);

    const imageInfo = {
      id: imageId,
      filename: foundFile,
      url: `${BASE_URL}/temp/lora-images/${foundFile}`,
      directAccessUrl: `${BASE_URL}/temp/lora-images/${foundFile}`,
      created: stats.birthtime,
      modified: stats.mtime,
      size: stats.size,
      sizeFormatted: formatFileSize(stats.size),
      age: calculateAge(stats.birthtime),
      ageFormatted: formatAge(stats.birthtime)
    };

    logger.info(`✅ LoRA image found: ${imageId}`);

    res.json({
      success: true,
      image: imageInfo
    });

  } catch (error) {
    logger.error(`❌ LoRA image fetch failed for ${req.params.imageId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch LoRA image',
      message: error.message
    });
  }
});

/**
 * DELETE /api/lora-archive/:imageId
 * Deletes a specific LoRA image (admin function)
 */
router.delete('/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    
    if (!imageId.startsWith('lora_')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid LoRA image ID format'
      });
    }

    logger.info(`🗑️ Deleting LoRA image: ${imageId}`);

    // Find and delete the file
    const extensions = ['.png', '.jpg', '.webp'];
    let deletedFile = null;
    
    for (const ext of extensions) {
      const filename = `${imageId}${ext}`;
      const filePath = path.join(LORA_IMAGES_PATH, filename);
      
      try {
        await fs.access(filePath);
        await fs.unlink(filePath);
        deletedFile = filename;
        break;
      } catch (error) {
        // File doesn't exist with this extension, try next
      }
    }

    if (!deletedFile) {
      return res.status(404).json({
        success: false,
        error: 'LoRA image not found',
        imageId
      });
    }

    logger.info(`✅ LoRA image deleted: ${deletedFile}`);

    res.json({
      success: true,
      message: 'LoRA image deleted successfully',
      deletedFile,
      imageId
    });

  } catch (error) {
    logger.error(`❌ LoRA image deletion failed for ${req.params.imageId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete LoRA image',
      message: error.message
    });
  }
});

// Helper functions
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function calculateAge(birthtime) {
  return Date.now() - new Date(birthtime).getTime();
}

function formatAge(birthtime) {
  const age = calculateAge(birthtime);
  const hours = Math.floor(age / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  } else if (hours > 0) {
    const minutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  } else {
    const minutes = Math.floor(age / (1000 * 60));
    return `${minutes}m`;
  }
}

module.exports = router;