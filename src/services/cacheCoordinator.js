const logger = require('../utils/logger');

/**
 * Coordinated Cache Management Service
 * Ensures all cache layers are invalidated when articles change
 */
class CacheCoordinator {
  constructor() {
    this.cacheServices = [];
    this.lastInvalidationTime = Date.now();
  }

  /**
   * Register cache services for coordinated invalidation
   */
  registerCacheService(cacheService, name) {
    this.cacheServices.push({ service: cacheService, name });
    logger.info(`📦 Registered cache service: ${name}`);
  }

  /**
   * Invalidate all registered cache services
   */
  async invalidateAllCaches(reason = 'Article data changed') {
    logger.info(`🗑️ Coordinated cache invalidation triggered: ${reason}`);
    
    const promises = this.cacheServices.map(async ({ service, name }) => {
      try {
        if (service.clear && typeof service.clear === 'function') {
          service.clear();
          logger.info(`✅ Cleared cache: ${name}`);
        } else if (service.clearCache && typeof service.clearCache === 'function') {
          await service.clearCache();
          logger.info(`✅ Cleared cache: ${name}`);
        } else if (service.clearAll && typeof service.clearAll === 'function') {
          await service.clearAll();
          logger.info(`✅ Cleared cache: ${name}`);
        } else {
          logger.warn(`⚠️ Cache service ${name} has no clear method`);
        }
      } catch (error) {
        logger.error(`❌ Error clearing cache ${name}:`, error.message);
      }
    });

    await Promise.allSettled(promises);
    this.lastInvalidationTime = Date.now();
    logger.info(`🧹 Coordinated cache invalidation completed`);
  }

  /**
   * Invalidate caches after article operations
   */
  async invalidateAfterArticleChange(operation, articleCount = 0) {
    const reason = `${operation} - ${articleCount} articles affected`;
    await this.invalidateAllCaches(reason);
  }

  /**
   * Get cache invalidation statistics
   */
  getStats() {
    return {
      registeredCacheServices: this.cacheServices.length,
      lastInvalidationTime: this.lastInvalidationTime,
      minutesSinceLastInvalidation: (Date.now() - this.lastInvalidationTime) / (1000 * 60)
    };
  }

  /**
   * Initialize all cache services
   */
  initializeCacheServices() {
    try {
      // Register simple cache service
      const simpleCacheService = require('./simpleCacheService');
      this.registerCacheService(simpleCacheService, 'SimpleCacheService');

      // Register articles cache service if it has a clear method
      try {
        const articlesCacheService = require('./articlesCacheService');
        this.registerCacheService(articlesCacheService, 'ArticlesCacheService');
      } catch (error) {
        logger.warn('ArticlesCacheService not available for cache coordination');
      }

      // Register any other cache services
      try {
        const cacheService = require('./cacheService');
        this.registerCacheService(cacheService, 'CacheService');
      } catch (error) {
        logger.warn('CacheService not available for cache coordination');
      }

      logger.info(`🔧 Cache coordinator initialized with ${this.cacheServices.length} cache services`);
    } catch (error) {
      logger.error('Error initializing cache services:', error);
    }
  }
}

// Create singleton instance
const cacheCoordinator = new CacheCoordinator();

// Auto-initialize cache services
cacheCoordinator.initializeCacheServices();

module.exports = cacheCoordinator;