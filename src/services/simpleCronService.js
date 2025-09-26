const logger = require('../utils/logger');
const { fetchRealCryptoNews } = require('./newsService');
const { insertArticlesBatch } = require('../config/supabase');

class SimpleCronService {
  constructor() {
    this.intervals = new Map();
    this.isRunning = false;
    this.lastUpdate = null;
    this.updateCount = 0;
  }

  start() {
    if (this.isRunning) {
      logger.warn('SimpleCronService already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Starting SimpleCronService...');

    // RSS aggregation every 20 minutes (reduced from 2 min to allow proper 4-day retention)
    const rssInterval = setInterval(async () => {
      await this.performRSSUpdate();
    }, 20 * 60 * 1000); // 20 minutes

    // Cache clearing every 4 hours  
    const cacheInterval = setInterval(async () => {
      await this.clearCaches();
    }, 4 * 60 * 60 * 1000); // 4 hours

    this.intervals.set('rss', rssInterval);
    this.intervals.set('cache', cacheInterval);

    // Run initial RSS update after 10 seconds
    setTimeout(() => {
      this.performRSSUpdate();
    }, 10000);

    logger.info('✅ SimpleCronService started successfully');
  }

  stop() {
    if (!this.isRunning) {
      logger.warn('SimpleCronService not running');
      return;
    }

    this.isRunning = false;
    
    // Clear all intervals
    this.intervals.forEach((interval, name) => {
      clearInterval(interval);
      logger.info(`⏹️ Stopped ${name} interval`);
    });
    
    this.intervals.clear();
    logger.info('⏹️ SimpleCronService stopped');
  }

  async performRSSUpdate() {
    if (!this.isRunning) return;

    try {
      logger.info('🔄 Starting RSS update...');
      const startTime = Date.now();

      // Fetch fresh articles
      const articles = await fetchRealCryptoNews();
      const fetchTime = Date.now() - startTime;

      if (!articles || articles.length === 0) {
        logger.info('📰 No new articles found');
        return;
      }

      logger.info(`📥 Fetched ${articles.length} articles in ${fetchTime}ms`);

      // Insert into database
      const insertStart = Date.now();
      const insertedArticles = await insertArticlesBatch(articles);
      const insertTime = Date.now() - insertStart;

      logger.info(`✅ Inserted ${insertedArticles.length} articles in ${insertTime}ms`);

      // Clear caches after successful update
      await this.clearCaches();

      this.lastUpdate = new Date();
      this.updateCount++;

      logger.info(`🎉 RSS update #${this.updateCount} completed successfully`);

    } catch (error) {
      logger.error('❌ RSS update failed:', error.message);
      logger.error('Stack trace:', error.stack);
    }
  }

  async clearCaches() {
    try {
      // Clear cache services
      const cacheService = require('./cacheService');
      if (cacheService && cacheService.clearArticlesCache) {
        const cleared = cacheService.clearArticlesCache();
        logger.info(`🗑️ Cleared ${cleared} cache entries`);
      }

      const simpleCache = require('./simpleCacheService');
      if (simpleCache && simpleCache.clear) {
        simpleCache.clear();
        logger.info('🗑️ Cleared simple cache');
      }
    } catch (error) {
      logger.warn('Warning: Cache clearing failed:', error.message);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastUpdate: this.lastUpdate,
      updateCount: this.updateCount,
      activeIntervals: Array.from(this.intervals.keys()),
      uptime: this.isRunning ? Date.now() - (this.lastUpdate || Date.now()) : 0
    };
  }

  // Manual trigger
  async triggerUpdate() {
    logger.info('🔧 Manual RSS update triggered');
    await this.performRSSUpdate();
  }
}

// Create singleton
const simpleCronService = new SimpleCronService();

module.exports = {
  SimpleCronService,
  simpleCronService
};