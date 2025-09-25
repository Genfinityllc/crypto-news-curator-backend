const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class CleanupService {
  constructor() {
    this.tempDir = path.join(__dirname, '../../temp');
    this.logsDir = path.join(__dirname, '../../logs');
  }

  /**
   * Clean up old temporary files to prevent Railway deployment timeouts
   * Default to 4 days to align with article purge policy
   */
  async cleanupTempFiles(maxAgeHours = 96) { // 4 days = 96 hours
    try {
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
      const now = Date.now();
      let deletedCount = 0;

      const files = await fs.readdir(this.tempDir);
      
      for (const file of files) {
        if (!file.endsWith('.jpg') && !file.endsWith('.png')) continue;
        
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAgeMs) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      logger.info(`Cleanup: Removed ${deletedCount} old temp files`);
      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning temp files:', error.message);
      return 0;
    }
  }

  /**
   * Clean up old log files
   */
  async cleanupLogFiles(maxAgeHours = 168) { // 7 days
    try {
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
      const now = Date.now();
      let deletedCount = 0;

      const files = await fs.readdir(this.logsDir);
      
      for (const file of files) {
        if (!file.endsWith('.log')) continue;
        if (file === 'error.log' || file === 'combined.log') continue; // Keep current logs
        
        const filePath = path.join(this.logsDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAgeMs) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      logger.info(`Cleanup: Removed ${deletedCount} old log files`);
      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning log files:', error.message);
      return 0;
    }
  }

  /**
   * Run full cleanup process
   */
  async runCleanup() {
    logger.info('Starting automated cleanup...');
    
    const tempCleaned = await this.cleanupTempFiles();
    const logsCleaned = await this.cleanupLogFiles();
    
    logger.info(`Cleanup complete: ${tempCleaned} temp files, ${logsCleaned} log files removed`);
    
    return { tempFiles: tempCleaned, logFiles: logsCleaned };
  }

  /**
   * Schedule automatic cleanup
   */
  startScheduledCleanup() {
    // Run cleanup every 4 hours
    setInterval(() => {
      this.runCleanup().catch(error => {
        logger.error('Scheduled cleanup failed:', error.message);
      });
    }, 4 * 60 * 60 * 1000);

    logger.info('Scheduled cleanup started (every 4 hours)');
  }
}

module.exports = new CleanupService();