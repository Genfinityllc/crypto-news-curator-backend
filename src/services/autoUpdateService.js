const EventEmitter = require('events');
const logger = require('../utils/logger');
const { fetchRealCryptoNews } = require('./newsService');
const { insertArticlesBatch } = require('../config/supabase');

class AutoUpdateService extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.updateInterval = null;
    this.config = {
      normalInterval: 2 * 60 * 1000, // 2 minutes
      intensiveInterval: 30 * 1000, // 30 seconds during high activity
      marketHoursInterval: 60 * 1000, // 1 minute during market hours
      backoffMultiplier: 1.5,
      maxBackoff: 10 * 60 * 1000, // 10 minutes max
      retryAttempts: 3
    };
    this.currentInterval = this.config.normalInterval;
    this.failureCount = 0;
    this.lastSuccessTime = null;
    this.metrics = {
      totalUpdates: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      articlesProcessed: 0,
      lastUpdateDuration: 0
    };
  }

  start() {
    if (this.isRunning) {
      logger.warn('Auto-update service is already running');
      return;
    }

    this.isRunning = true;
    this.lastSuccessTime = new Date();
    logger.info('🚀 Starting enhanced auto-update service');
    
    this.scheduleNextUpdate();
    this.emit('started');
  }

  stop() {
    if (!this.isRunning) {
      logger.warn('Auto-update service is not running');
      return;
    }

    this.isRunning = false;
    if (this.updateInterval) {
      clearTimeout(this.updateInterval);
      this.updateInterval = null;
    }
    
    logger.info('⏹️ Auto-update service stopped');
    this.emit('stopped');
  }

  scheduleNextUpdate() {
    if (!this.isRunning) return;

    const interval = this.calculateInterval();
    this.currentInterval = interval;

    this.updateInterval = setTimeout(() => {
      this.performUpdate();
    }, interval);

    logger.debug(`📅 Next update scheduled in ${interval / 1000} seconds`);
  }

  calculateInterval() {
    // Adaptive interval based on market conditions and activity
    const now = new Date();
    const hour = now.getHours();
    
    // Market hours (9 AM - 5 PM EST, roughly)
    const isMarketHours = hour >= 9 && hour <= 17;
    
    // Backoff for failures
    if (this.failureCount > 0) {
      const backoffInterval = Math.min(
        this.config.normalInterval * Math.pow(this.config.backoffMultiplier, this.failureCount),
        this.config.maxBackoff
      );
      logger.debug(`⏱️ Using backoff interval: ${backoffInterval / 1000}s (failures: ${this.failureCount})`);
      return backoffInterval;
    }

    // Intensive mode during market hours
    if (isMarketHours) {
      return this.config.marketHoursInterval;
    }

    // Normal interval
    return this.config.normalInterval;
  }

  async performUpdate() {
    if (!this.isRunning) return;

    const startTime = Date.now();
    this.metrics.totalUpdates++;

    try {
      logger.info('🔄 Starting auto-update cycle...');
      
      // Fetch latest news
      const realNews = await this.fetchWithRetry();
      
      if (!realNews || realNews.length === 0) {
        logger.info('📰 No new articles found');
        this.handleSuccess(0, startTime);
        return;
      }

      // Insert articles into database
      const insertedArticles = await insertArticlesBatch(realNews);
      const insertedCount = insertedArticles?.length || 0;
      
      logger.info(`✅ Auto-update completed: ${insertedCount} articles processed`);
      
      // Clear cache after successful update
      try {
        const simpleCache = require('./simpleCacheService');
        simpleCache.clear();
        logger.debug('🗑️ Cache cleared after successful update');
      } catch (cacheError) {
        logger.warn('Warning: Could not clear cache:', cacheError.message);
      }

      this.handleSuccess(insertedCount, startTime);
      
      // Emit update event with results
      this.emit('update', {
        articlesProcessed: insertedCount,
        duration: Date.now() - startTime,
        timestamp: new Date()
      });

    } catch (error) {
      this.handleFailure(error, startTime);
    } finally {
      this.scheduleNextUpdate();
    }
  }

  async fetchWithRetry() {
    let lastError;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        logger.debug(`📥 Fetching news (attempt ${attempt}/${this.config.retryAttempts})`);
        const news = await fetchRealCryptoNews();
        return news;
      } catch (error) {
        lastError = error;
        logger.warn(`❌ Fetch attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.config.retryAttempts) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  handleSuccess(articlesProcessed, startTime) {
    this.failureCount = 0;
    this.lastSuccessTime = new Date();
    this.metrics.successfulUpdates++;
    this.metrics.articlesProcessed += articlesProcessed;
    this.metrics.lastUpdateDuration = Date.now() - startTime;
    
    this.emit('success', {
      articlesProcessed,
      duration: this.metrics.lastUpdateDuration
    });
  }

  handleFailure(error, startTime) {
    this.failureCount++;
    this.metrics.failedUpdates++;
    this.metrics.lastUpdateDuration = Date.now() - startTime;
    
    logger.error(`❌ Auto-update failed (failure #${this.failureCount}):`, error.message);
    
    this.emit('error', {
      error: error.message,
      failureCount: this.failureCount,
      duration: this.metrics.lastUpdateDuration
    });

    // Alert if failures exceed threshold
    if (this.failureCount >= 5) {
      this.emit('alert', {
        type: 'consecutive_failures',
        count: this.failureCount,
        lastSuccess: this.lastSuccessTime
      });
    }
  }

  // Manual trigger for updates
  async triggerUpdate() {
    if (!this.isRunning) {
      throw new Error('Auto-update service is not running');
    }

    logger.info('🔧 Manual update triggered');
    
    // Cancel scheduled update and perform immediately
    if (this.updateInterval) {
      clearTimeout(this.updateInterval);
      this.updateInterval = null;
    }
    
    await this.performUpdate();
  }

  // Get current status and metrics
  getStatus() {
    return {
      isRunning: this.isRunning,
      currentInterval: this.currentInterval,
      nextUpdate: this.updateInterval ? new Date(Date.now() + this.currentInterval) : null,
      failureCount: this.failureCount,
      lastSuccessTime: this.lastSuccessTime,
      metrics: { ...this.metrics },
      config: { ...this.config }
    };
  }

  // Update configuration
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('⚙️ Auto-update configuration updated:', newConfig);
    this.emit('configChanged', this.config);
  }

  // Health check
  isHealthy() {
    const now = new Date();
    const timeSinceLastSuccess = this.lastSuccessTime ? now - this.lastSuccessTime : Infinity;
    const maxAllowedGap = this.config.maxBackoff * 2;
    
    return {
      healthy: this.isRunning && this.failureCount < 10 && timeSinceLastSuccess < maxAllowedGap,
      running: this.isRunning,
      recentFailures: this.failureCount,
      timeSinceLastSuccess: timeSinceLastSuccess,
      lastSuccessTime: this.lastSuccessTime
    };
  }
}

// Create singleton instance
const autoUpdateService = new AutoUpdateService();

// Set up event listeners for monitoring
autoUpdateService.on('started', () => {
  logger.info('📊 Auto-update service monitoring started');
});

autoUpdateService.on('error', (data) => {
  logger.error(`🚨 Auto-update error: ${data.error} (failure count: ${data.failureCount})`);
});

autoUpdateService.on('alert', (data) => {
  logger.error(`🚨 ALERT: ${data.type} - ${data.count} consecutive failures. Last success: ${data.lastSuccess}`);
});

autoUpdateService.on('success', (data) => {
  logger.debug(`✅ Update successful: ${data.articlesProcessed} articles in ${data.duration}ms`);
});

module.exports = {
  AutoUpdateService,
  autoUpdateService
};