const logger = require('../utils/logger');

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 4 * 24 * 60 * 60 * 1000; // 4 days

/**
 * Simple cache service for ultra-fast responses
 */
class SimpleCacheService {
  
  get(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.info(`Cache HIT for key: ${key}`);
      return {
        ...cached.data,
        timestamp: cached.timestamp
      };
    }
    
    if (cached) {
      cache.delete(key);
    }
    
    logger.info(`Cache MISS for key: ${key}`);
    return null;
  }

  set(key, data, ttl = CACHE_TTL) {
    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
    logger.info(`Cache SET for key: ${key}`);
  }

  generateKey(options) {
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

  clear() {
    cache.clear();
    logger.info('Cache cleared');
  }

  getStats() {
    return {
      size: cache.size,
      keys: Array.from(cache.keys())
    };
  }
}

module.exports = new SimpleCacheService();
