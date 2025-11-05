const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * 🧹 TEMP FILE CLEANUP SERVICE
 * 
 * Prevents Railway deployment failures by:
 * - Automatically cleaning temp directories
 * - Removing old image files  
 * - Monitoring disk usage
 * - Running cleanup on startup and scheduled intervals
 */

class TempCleanupService {
  constructor() {
    this.tempDirectories = [
      path.join(__dirname, '..', '..', 'temp'),
      path.join(__dirname, '..', '..', 'screenshots'),
      path.join(__dirname, '..', '..', 'logs')
    ];
    this.maxFileAge = 4 * 24 * 60 * 60 * 1000; // 4 days in milliseconds
    this.loraImageAge = 4 * 24 * 60 * 60 * 1000; // Keep LoRA images for 4 days
    this.maxDirectorySize = 100 * 1024 * 1024; // 100MB limit per directory
    this.cleanupInterval = null;
  }

  /**
   * Get directory size in bytes
   */
  async getDirectorySize(dirPath) {
    if (!fs.existsSync(dirPath)) return 0;
    
    let totalSize = 0;
    
    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          totalSize += await this.getDirectorySize(filePath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch (error) {
      logger.warn(`Error calculating directory size for ${dirPath}:`, error.message);
    }
    
    return totalSize;
  }

  /**
   * Clean old files from a directory
   */
  async cleanDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      logger.info(`📁 Directory doesn't exist: ${dirPath}`);
      return { deletedFiles: 0, freedSpace: 0 };
    }

    let deletedFiles = 0;
    let freedSpace = 0;
    const now = Date.now();

    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        // Skip directories for now (could recurse if needed)
        if (stats.isDirectory()) continue;
        
        // Delete old files (special handling for LoRA images)
        const fileAge = now - stats.mtime.getTime();
        const isLoraImage = dirPath.includes('lora-images') && file.startsWith('lora_');
        const ageThreshold = isLoraImage ? this.loraImageAge : this.maxFileAge;
        
        if (fileAge > ageThreshold) {
          try {
            const fileSize = stats.size;
            fs.unlinkSync(filePath);
            deletedFiles++;
            freedSpace += fileSize;
            const ageHours = (fileAge / (1000 * 60 * 60)).toFixed(1);
            logger.info(`🗑️ Deleted old ${isLoraImage ? 'LoRA' : ''} file: ${file} (${(fileSize / 1024).toFixed(1)}KB, ${ageHours}h old)`);
          } catch (deleteError) {
            logger.warn(`Failed to delete ${file}:`, deleteError.message);
          }
        }
      }
      
      // Check if directory is still too large
      const currentSize = await this.getDirectorySize(dirPath);
      if (currentSize > this.maxDirectorySize) {
        logger.warn(`⚠️ Directory still large after cleanup: ${dirPath} (${(currentSize / 1024 / 1024).toFixed(1)}MB)`);
        
        // Delete more files if needed (oldest first)
        const remainingFiles = fs.readdirSync(dirPath)
          .map(file => ({
            name: file,
            path: path.join(dirPath, file),
            mtime: fs.statSync(path.join(dirPath, file)).mtime
          }))
          .filter(file => !fs.statSync(file.path).isDirectory())
          .sort((a, b) => a.mtime - b.mtime); // Oldest first
        
        for (const file of remainingFiles) {
          if (await this.getDirectorySize(dirPath) <= this.maxDirectorySize) break;
          
          try {
            const fileSize = fs.statSync(file.path).size;
            fs.unlinkSync(file.path);
            deletedFiles++;
            freedSpace += fileSize;
            logger.info(`🗑️ Force deleted: ${file.name} (${(fileSize / 1024).toFixed(1)}KB)`);
          } catch (deleteError) {
            logger.warn(`Failed to force delete ${file.name}:`, deleteError.message);
          }
        }
      }
      
    } catch (error) {
      logger.error(`Error cleaning directory ${dirPath}:`, error.message);
    }

    return { deletedFiles, freedSpace };
  }

  /**
   * Run complete cleanup of all temp directories
   */
  async runCleanup() {
    const startTime = Date.now();
    let totalDeleted = 0;
    let totalFreed = 0;

    logger.info('🧹 Starting temp file cleanup...');

    for (const dirPath of this.tempDirectories) {
      const dirName = path.basename(dirPath);
      const initialSize = await this.getDirectorySize(dirPath);
      
      if (initialSize === 0) {
        logger.info(`📁 ${dirName}: Empty or doesn't exist`);
        continue;
      }
      
      logger.info(`📁 ${dirName}: ${(initialSize / 1024 / 1024).toFixed(1)}MB`);
      
      const { deletedFiles, freedSpace } = await this.cleanDirectory(dirPath);
      totalDeleted += deletedFiles;
      totalFreed += freedSpace;
      
      const finalSize = await this.getDirectorySize(dirPath);
      logger.info(`✅ ${dirName}: Deleted ${deletedFiles} files, freed ${(freedSpace / 1024 / 1024).toFixed(1)}MB, now ${(finalSize / 1024 / 1024).toFixed(1)}MB`);
    }

    const cleanupTime = (Date.now() - startTime) / 1000;
    logger.info(`🎉 Cleanup complete: ${totalDeleted} files deleted, ${(totalFreed / 1024 / 1024).toFixed(1)}MB freed (${cleanupTime.toFixed(1)}s)`);

    return {
      filesDeleted: totalDeleted,
      spaceFreed: totalFreed,
      cleanupTime
    };
  }

  /**
   * Start scheduled cleanup (runs every 2 hours)
   */
  startScheduledCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Run cleanup every 2 hours
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.runCleanup();
      } catch (error) {
        logger.error('Scheduled cleanup failed:', error);
      }
    }, 2 * 60 * 60 * 1000); // 2 hours

    logger.info('⏰ Scheduled temp file cleanup every 2 hours');
  }

  /**
   * Emergency cleanup - removes almost everything
   */
  async emergencyCleanup() {
    logger.warn('🚨 EMERGENCY CLEANUP - Removing all temp files!');
    
    let totalFreed = 0;
    
    for (const dirPath of this.tempDirectories) {
      if (!fs.existsSync(dirPath)) continue;
      
      try {
        const initialSize = await this.getDirectorySize(dirPath);
        
        // Remove all files (keep directories)
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          if (!fs.statSync(filePath).isDirectory()) {
            fs.unlinkSync(filePath);
          }
        }
        
        totalFreed += initialSize;
        logger.warn(`🚨 Emergency cleaned ${path.basename(dirPath)}: ${(initialSize / 1024 / 1024).toFixed(1)}MB`);
      } catch (error) {
        logger.error(`Emergency cleanup failed for ${dirPath}:`, error);
      }
    }
    
    logger.warn(`🚨 Emergency cleanup freed ${(totalFreed / 1024 / 1024).toFixed(1)}MB`);
    return totalFreed;
  }

  /**
   * Get cleanup statistics
   */
  async getStats() {
    const stats = {
      directories: {},
      totalSize: 0,
      timestamp: new Date().toISOString()
    };

    for (const dirPath of this.tempDirectories) {
      const dirName = path.basename(dirPath);
      const size = await this.getDirectorySize(dirPath);
      stats.directories[dirName] = {
        path: dirPath,
        size,
        sizeMB: (size / 1024 / 1024).toFixed(1),
        exists: fs.existsSync(dirPath)
      };
      stats.totalSize += size;
    }

    stats.totalSizeMB = (stats.totalSize / 1024 / 1024).toFixed(1);
    return stats;
  }

  /**
   * Stop scheduled cleanup
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('🛑 Temp cleanup service stopped');
    }
  }
}

// Export singleton instance
const tempCleanupService = new TempCleanupService();

module.exports = tempCleanupService;