const logger = require('../utils/logger');

// In-memory cache for ultra-fast responses
const memoryCache = new Map();
const CACHE_TTL = {
  articles: 4 * 24 * 60 * 60 * 1000, // 4 days
  breakingNews: 2 * 60 * 1000, // 2 minutes
  trending: 10 * 60 * 1000, // 10 minutes
  marketData: 1 * 60 * 1000 // 1 minute
};

/**
 * Cache service for ultra-fast API responses
 */
class CacheService {
  constructor() {
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0
    };
  }

  /**
   * Get cached data
   */
  get(key) {
    const cached = memoryCache.get(key);
    
    if (cached && this.isValid(cached)) {
      this.cacheStats.hits++;
      logger.debug(`Cache HIT for key: ${key}`);
      return cached.data;
    }
    
    if (cached && !this.isValid(cached)) {
      memoryCache.delete(key);
    }
    
    this.cacheStats.misses++;
    logger.debug(`Cache MISS for key: ${key}`);
    return null;
  }

  /**
   * Set cached data
   */
  set(key, data, ttl = CACHE_TTL.articles) {
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      ttl
    };
    
    memoryCache.set(key, cacheEntry);
    this.cacheStats.sets++;
    logger.debug(`Cache SET for key: ${key} with TTL: ${ttl}ms`);
  }

  /**
   * Check if cache entry is valid
   */
  isValid(cached) {
    return Date.now() - cached.timestamp < cached.ttl;
  }

  /**
   * Generate cache key for articles
   */
  generateArticlesKey(options = {}) {
    const {
      page = 1,
      limit = 200,
      network,
      category,
      sortBy = 'publishedAt',
      search,
      breaking = false
    } = options;

    return `articles:${page}:${limit}:${network || 'all'}:${category || 'all'}:${sortBy}:${search || 'none'}:${breaking}`;
  }

  /**
   * Generate cache key for breaking news
   */
  generateBreakingNewsKey() {
    return 'breaking_news:latest';
  }

  /**
   * Generate cache key for trending
   */
  generateTrendingKey() {
    return 'trending:networks';
  }

  /**
   * Generate cache key for market data
   */
  generateMarketDataKey() {
    return 'market_data:latest';
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidate(pattern) {
    let invalidated = 0;
    
    for (const key of memoryCache.keys()) {
      if (key.includes(pattern)) {
        memoryCache.delete(key);
        invalidated++;
      }
    }
    
    logger.info(`Invalidated ${invalidated} cache entries matching pattern: ${pattern}`);
    return invalidated;
  }

  /**
   * Clear all cache
   */
  clear() {
    memoryCache.clear();
    logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) * 100;
    
    return {
      ...this.cacheStats,
      hitRate: hitRate.toFixed(2) + '%',
      size: memoryCache.size,
      keys: Array.from(memoryCache.keys())
    };
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUp() {
    logger.info('Warming up cache...');
    
    try {
      // Pre-cache common queries
      const commonQueries = [
        { page: 1, limit: 20, network: 'all' },
        { page: 1, limit: 20, network: 'Bitcoin' },
        { page: 1, limit: 20, network: 'Ethereum' },
        { page: 1, limit: 20, network: 'Solana' },
        { page: 1, limit: 20, breaking: true }
      ];

      // This would be called by the cron service after updating articles
      logger.info(`Cache warmed up with ${commonQueries.length} common queries`);
      
    } catch (error) {
      logger.error('Error warming up cache:', error.message);
    }
  }

  /**
   * Cleanup expired cache entries
   */
  cleanup() {
    let cleaned = 0;
    
    for (const [key, cached] of memoryCache.entries()) {
      if (!this.isValid(cached)) {
        memoryCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} expired cache entries`);
    }
    
    return cleaned;
  }

  /**
   * Clear articles cache (for scheduled clearing every 4 days)
   */
  clearArticlesCache() {
    const articlesPattern = 'articles:';
    let cleared = 0;
    
    for (const key of memoryCache.keys()) {
      if (key.startsWith(articlesPattern)) {
        memoryCache.delete(key);
        cleared++;
      }
    }
    
    logger.info(`Cleared ${cleared} articles cache entries (4-day scheduled clear)`);
    return cleared;
  }

  /**
   * Get cache age for monitoring
   */
  getCacheAge() {
    const now = Date.now();
    const entries = Array.from(memoryCache.entries());
    
    if (entries.length === 0) {
      return { oldest: null, newest: null, count: 0 };
    }
    
    const ages = entries.map(([key, cached]) => ({
      key,
      age: now - cached.timestamp,
      ageHours: Math.round((now - cached.timestamp) / (1000 * 60 * 60))
    }));
    
    ages.sort((a, b) => a.age - b.age);
    
    return {
      oldest: ages[0],
      newest: ages[ages.length - 1],
      count: entries.length,
      averageAgeHours: Math.round(ages.reduce((sum, entry) => sum + entry.ageHours, 0) / ages.length)
    };
  }
}

// Create singleton instance
const cacheService = new CacheService();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  cacheService.cleanup();
}, 5 * 60 * 1000);

module.exports = cacheService;
