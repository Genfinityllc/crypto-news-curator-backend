const cacheService = require('./cacheService');
const { getArticles, insertArticlesBatch } = require('../config/supabase');
const { fetchRealCryptoNews } = require('./newsService');
const logger = require('../utils/logger');

/**
 * Optimized articles service with intelligent caching
 */
class ArticlesCacheService {
  
  /**
   * Get articles with intelligent caching
   */
  async getArticles(options = {}) {
    const {
      page = 1,
      limit = 200,
      network,
      category,
      sortBy = 'publishedAt',
      search,
      breaking = false,
      forceRefresh = false
    } = options;

    const cacheKey = cacheService.generateArticlesKey(options);

    // Return cached data if available and not forcing refresh
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        logger.info(`Returning cached articles for ${network || 'all'} networks`);
        return {
          success: true,
          data: cached.articles,
          pagination: cached.pagination,
          cached: true,
          cacheKey
        };
      }
    }

    try {
      logger.info(`Fetching fresh articles for ${network || 'all'} networks`);
      
      // Fetch from database first using the original news route logic
      const { fetchRealCryptoNews } = require('./newsService');
      
      // Always fetch fresh RSS news with enhanced images for better user experience
      logger.info('Fetching real news from RSS feeds with enhanced images...');
      const realNews = await fetchRealCryptoNews();
      
      // Apply filters to RSS news
      let filteredNews = realNews;
      
      if (network && network !== 'all') {
        filteredNews = filteredNews.filter(article => 
          article.network && article.network.toLowerCase().includes(network.toLowerCase())
        );
      }
      
      if (category && category !== 'all') {
        filteredNews = filteredNews.filter(article => 
          article.category === category
        );
      }
      
      if (breaking === 'true') {
        filteredNews = filteredNews.filter(article => article.is_breaking === true);
      }
      
      if (search) {
        const searchLower = search.toLowerCase();
        filteredNews = filteredNews.filter(article => 
          article.title.toLowerCase().includes(searchLower) ||
          article.content.toLowerCase().includes(searchLower)
        );
      }
      
      let articles = filteredNews;
      
      logger.info(`Articles type: ${typeof articles}, isArray: ${Array.isArray(articles)}, length: ${articles?.length}`);

      // Ensure articles is an array before sorting
      if (!Array.isArray(articles)) {
        logger.warn('Articles is not an array, converting to empty array');
        articles = [];
      }

      // Sort articles
      if (sortBy === 'publishedAt') {
        articles.sort((a, b) => new Date(b.publishedAt || b.pubDate) - new Date(a.publishedAt || a.pubDate));
      } else if (sortBy === 'viral_score') {
        articles.sort((a, b) => (b.viral_score || 0) - (a.viral_score || 0));
      }

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedArticles = articles.slice(startIndex, endIndex);

      const result = {
        articles: paginatedArticles,
        pagination: {
          page,
          limit,
          total: articles.length,
          totalPages: Math.ceil(articles.length / limit),
          hasNext: endIndex < articles.length,
          hasPrev: page > 1
        }
      };

      // Cache the result
      cacheService.set(cacheKey, result, cacheService.CACHE_TTL.articles);

      return {
        success: true,
        data: result.articles,
        pagination: result.pagination,
        cached: false,
        cacheKey
      };

    } catch (error) {
      logger.error('Error fetching articles:', error.message);
      return {
        success: false,
        error: error.message,
        data: [],
        cached: false
      };
    }
  }

  /**
   * Get breaking news with caching
   */
  async getBreakingNews(forceRefresh = false) {
    const cacheKey = cacheService.generateBreakingNewsKey();

    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          cached: true
        };
      }
    }

    try {
      const dbResult = await getArticles({
        limit: 10,
        isBreaking: true,
        sortBy: 'publishedAt'
      });
      
      const articles = dbResult?.data || dbResult || [];

      const result = articles || [];

      cacheService.set(cacheKey, result, cacheService.CACHE_TTL.breakingNews);

      return {
        success: true,
        data: result,
        cached: false
      };

    } catch (error) {
      logger.error('Error fetching breaking news:', error.message);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * Get trending networks with caching
   */
  async getTrendingNetworks(forceRefresh = false) {
    const cacheKey = cacheService.generateTrendingKey();

    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          cached: true
        };
      }
    }

    try {
      // Get articles from last 24 hours and count by network
      const dbResult = await getArticles({
        limit: 1000,
        sortBy: 'publishedAt'
      });
      
      const articles = dbResult?.data || dbResult || [];

      const networkCounts = {};
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      articles.forEach(article => {
        const publishedAt = new Date(article.publishedAt || article.pubDate);
        if (publishedAt > oneDayAgo && article.network) {
          networkCounts[article.network] = (networkCounts[article.network] || 0) + 1;
        }
      });

      const trending = Object.entries(networkCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([network, count]) => ({ network, articleCount: count }));

      cacheService.set(cacheKey, trending, cacheService.CACHE_TTL.trending);

      return {
        success: true,
        data: trending,
        cached: false
      };

    } catch (error) {
      logger.error('Error fetching trending networks:', error.message);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * Invalidate cache after new articles are added
   */
  invalidateArticlesCache() {
    const patterns = ['articles:', 'breaking_news:', 'trending:'];
    let totalInvalidated = 0;

    patterns.forEach(pattern => {
      totalInvalidated += cacheService.invalidate(pattern);
    });

    logger.info(`Invalidated ${totalInvalidated} article cache entries`);
    return totalInvalidated;
  }

  /**
   * Preload cache with common queries
   */
  async preloadCache() {
    logger.info('Preloading article cache...');

    const commonQueries = [
      { page: 1, limit: 20, network: 'all' },
      { page: 1, limit: 20, network: 'Bitcoin' },
      { page: 1, limit: 20, network: 'Ethereum' },
      { page: 1, limit: 20, network: 'Solana' },
      { page: 1, limit: 20, breaking: true },
      { page: 1, limit: 20, network: 'Cardano' },
      { page: 1, limit: 20, network: 'Polygon' }
    ];

    const promises = commonQueries.map(query => this.getArticles(query));
    
    try {
      await Promise.all(promises);
      logger.info(`Preloaded cache with ${commonQueries.length} common queries`);
    } catch (error) {
      logger.error('Error preloading cache:', error.message);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return cacheService.getStats();
  }
}

// Create singleton instance
const articlesCacheService = new ArticlesCacheService();

module.exports = articlesCacheService;
