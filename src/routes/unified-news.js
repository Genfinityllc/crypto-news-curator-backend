const express = require('express');
const router = express.Router();
const { getArticles, getBreakingNews } = require('../config/supabase');
const simpleCache = require('../services/simpleCacheService');
// Use lightweight service for Railway deployment compatibility
const lightweightImageService = require('../services/lightweightImageService');
const logger = require('../utils/logger');

/**
 * 🚀 UNIFIED NEWS ENDPOINT - Single source of truth for all news data
 * 
 * Consolidates functionality from:
 * - /api/news
 * - /api/fast-news  
 * - /api/cached-news
 * - /api/enhanced-news
 * - /api/enhanced-client-news
 * 
 * Standardized Parameters:
 * - network: 'all', 'clients', 'bitcoin', 'ethereum', 'hedera', etc.
 * - category: 'all', 'breaking', 'market', 'technology', etc.
 * - onlyWithImages: true/false (consistent across all endpoints)
 * - sortBy: 'date', 'engagement', 'score' 
 * - page, limit: pagination
 * - search: text search
 * 
 * Unified Response Format:
 * {
 *   success: boolean,
 *   data: Article[],
 *   pagination: { current, total, hasNext, hasPrev, totalCount },
 *   meta: { cached, cacheAge, source, timestamp }
 * }
 */

// Client network definitions - single source of truth
const CLIENT_NETWORKS = ['Hedera', 'XDC Network', 'Algorand', 'Constellation', 'HashPack', 'SWAP'];

/**
 * Main unified news endpoint
 */
router.get('/', async (req, res) => {
  try {
    const {
      // Network filtering
      network = 'all',           // 'all', 'clients', 'bitcoin', 'hedera', etc.
      
      // Content filtering  
      category = 'all',          // 'all', 'breaking', 'market', 'technology', etc.
      onlyWithImages = 'true',   // Standardized: always filter for images by default
      search,                    // Text search
      
      // Sorting & pagination
      sortBy = 'date',           // 'date', 'engagement', 'score'
      page = 1,
      limit = 50,
      
      // Cache control
      forceRefresh = 'false'
    } = req.query;

    // Validate and normalize parameters
    const options = {
      page: Math.max(1, parseInt(page)),
      limit: Math.min(200, Math.max(1, parseInt(limit))),
      sortBy,
      search,
      onlyWithImages: onlyWithImages === 'true',
      forceRefresh: forceRefresh === 'true'
    };

    // Handle network filtering
    if (network === 'clients') {
      // No specific network - will filter by CLIENT_NETWORKS in query
      options.network = null;
      options.clientNetworks = CLIENT_NETWORKS;
    } else if (network !== 'all') {
      options.network = network;
    }

    // Handle category filtering
    if (category === 'breaking') {
      options.isBreaking = true;
    } else if (category !== 'all') {
      options.category = category;
    }

    // Generate cache key
    const cacheKey = `unified_news:${JSON.stringify(options)}`;
    
    // Check cache first
    let cached = null;
    let cacheAge = 0;
    if (!options.forceRefresh) {
      cached = simpleCache.get(cacheKey);
      if (cached) {
        cacheAge = (Date.now() - cached.timestamp) / (1000 * 60); // minutes
        
        // Use cache if less than 5 minutes old
        if (cacheAge < 5) {
          return res.json({
            success: true,
            data: cached.articles,
            pagination: cached.pagination,
            meta: {
              cached: true,
              cacheAge: Math.round(cacheAge * 10) / 10,
              source: 'unified-cache',
              timestamp: new Date().toISOString()
            }
          });
        }
      }
    }

    logger.info(`🔍 Unified news query: network=${network}, category=${category}, onlyWithImages=${options.onlyWithImages}, limit=${limit}`);

    // 📰 RSS-ONLY APPROACH: 100% guaranteed images (reverting to working solution)
    let articleResult;
    
    try {
      logger.info('📰 Using RSS-only approach for 100% image guarantee...');
      
      // Get fresh RSS articles (guaranteed images)
      const { fetchRealCryptoNews } = require('../services/newsService');
      const rssArticles = await fetchRealCryptoNews();
      
      // Apply filters to RSS data
      let filteredArticles = rssArticles;
      
      // Filter by network
      if (network === 'clients') {
        filteredArticles = filteredArticles.filter(article => 
          CLIENT_NETWORKS.includes(article.network)
        );
      } else if (network !== 'all') {
        filteredArticles = filteredArticles.filter(article => 
          article.network && article.network.toLowerCase() === network.toLowerCase()
        );
      }
      
      // Filter by category
      if (category === 'breaking') {
        filteredArticles = filteredArticles.filter(article => article.is_breaking === true);
      } else if (category !== 'all') {
        filteredArticles = filteredArticles.filter(article => article.category === category);
      }
      
      // 🚀 LIGHTWEIGHT IMAGE VALIDATION - RAILWAY-OPTIMIZED
      if (options.onlyWithImages) {
        logger.info('🔄 Starting lightweight image validation for Railway...');
        
        // Process articles through lightweight validation pipeline
        filteredArticles = await lightweightImageService.processArticlesWithImageValidation(filteredArticles);
        
        logger.info(`✅ Lightweight image validation complete: ${filteredArticles.length} articles with confirmed images`);
      }
      
      // Apply search filter
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        filteredArticles = filteredArticles.filter(article => 
          article.title.toLowerCase().includes(searchLower) ||
          (article.content && article.content.toLowerCase().includes(searchLower))
        );
      }
      
      // Sort articles
      filteredArticles.sort((a, b) => 
        new Date(b.published_at || b.publishedAt) - new Date(a.published_at || a.publishedAt)
      );
      
      // Apply pagination
      const startIndex = (options.page - 1) * options.limit;
      const paginatedArticles = filteredArticles.slice(startIndex, startIndex + options.limit);
      
      articleResult = {
        data: paginatedArticles,
        count: filteredArticles.length
      };
      
      logger.info(`📰 RSS-only result: ${paginatedArticles.length} articles with 100% image guarantee`);
      
    } catch (rssError) {
      logger.error('RSS approach failed:', rssError.message);
      throw rssError;
    }

    const articles = articleResult.data || [];
    const totalCount = articleResult.count || 0;

    // Build unified response
    const response = {
      success: true,
      data: articles,
      pagination: {
        current: options.page,
        total: Math.ceil(totalCount / options.limit),
        hasNext: (options.page * options.limit) < totalCount,
        hasPrev: options.page > 1,
        totalCount
      },
      meta: {
        cached: false,
        cacheAge: 0,
        source: 'database',
        timestamp: new Date().toISOString(),
        query: {
          network,
          category,
          onlyWithImages: options.onlyWithImages,
          sortBy: options.sortBy
        }
      }
    };

    // Cache the result
    simpleCache.set(cacheKey, {
      articles,
      pagination: response.pagination,
      timestamp: Date.now()
    });

    res.json(response);

  } catch (error) {
    logger.error('❌ Unified news endpoint error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch news',
      error: error.message,
      meta: {
        source: 'unified-news',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Network counts endpoint - provides counts for all networks
 */
router.get('/counts', async (req, res) => {
  try {
    const { onlyWithImages = 'true' } = req.query;
    const cacheKey = `network_counts_rss:${onlyWithImages}`;
    
    // Check cache
    const cached = simpleCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < 300000) { // 5 minute cache
      return res.json({
        success: true,
        data: cached.data,
        meta: {
          cached: true,
          cacheAge: Math.round((Date.now() - cached.timestamp) / 60000),
          timestamp: new Date().toISOString()
        }
      });
    }

    const counts = {
      all: 0,
      clients: 0,
      networks: {}
    };

    try {
      // Use RSS data for counts (matches main endpoint)
      const { fetchRealCryptoNews } = require('../services/newsService');
      const rssArticles = await fetchRealCryptoNews();
      
      // Filter by images using lightweight validation
      let filteredArticles = rssArticles;
      if (onlyWithImages === 'true') {
        logger.info('🔄 Lightweight validation for counts...');
        
        // Use lightweight validation for consistent counting
        filteredArticles = await lightweightImageService.processArticlesWithImageValidation(rssArticles);
        
        logger.info(`✅ Lightweight validation for counts complete: ${filteredArticles.length} articles`);
      }
      
      counts.all = filteredArticles.length;
      
      // Count by client networks
      let clientTotal = 0;
      for (const network of CLIENT_NETWORKS) {
        const networkCount = filteredArticles.filter(article => 
          article.network === network
        ).length;
        counts.networks[network] = networkCount;
        clientTotal += networkCount;
      }
      
      counts.clients = clientTotal;
      
    } catch (rssError) {
      logger.warn('RSS counts failed, falling back to database:', rssError.message);
      
      // Fallback to database counts
      const allResult = await getArticles({
        page: 1,
        limit: 1,
        onlyWithImages: onlyWithImages === 'true'
      });
      counts.all = allResult.count || 0;

      // Get client network counts
      let clientTotal = 0;
      for (const network of CLIENT_NETWORKS) {
        try {
          const result = await getArticles({
            page: 1,
            limit: 1,
            network,
            onlyWithImages: onlyWithImages === 'true'
          });
          const networkCount = result.count || 0;
          counts.networks[network] = networkCount;
          clientTotal += networkCount;
        } catch (error) {
          logger.error(`Error getting count for ${network}:`, error.message);
          counts.networks[network] = 0;
        }
      }
      
      counts.clients = clientTotal;
    }

    // Cache result
    simpleCache.set(cacheKey, {
      data: counts,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      data: counts,
      meta: {
        cached: false,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('❌ Network counts error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get network counts',
      error: error.message
    });
  }
});

/**
 * Breaking news endpoint - convenience endpoint for breaking news
 */
router.get('/breaking', async (req, res) => {
  try {
    const { limit = 10, onlyWithImages = 'true' } = req.query;
    
    const breakingNews = await getBreakingNews();
    
    let filteredNews = breakingNews;
    
    // Apply image filtering if requested
    if (onlyWithImages === 'true') {
      filteredNews = breakingNews.filter(article => {
        const hasImage = article.cover_image && 
                        !article.cover_image.includes('placeholder') &&
                        !article.cover_image.includes('placehold.co') &&
                        !article.cover_image.includes('via.placeholder');
        return hasImage;
      });
    }

    // Apply limit
    const limitedNews = filteredNews.slice(0, parseInt(limit));

    res.json({
      success: true,
      data: limitedNews,
      pagination: {
        current: 1,
        total: 1,
        hasNext: false,
        hasPrev: false,
        totalCount: limitedNews.length
      },
      meta: {
        cached: false,
        source: 'breaking-news',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('❌ Breaking news error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch breaking news',
      error: error.message
    });
  }
});

/**
 * Cache management
 */
router.post('/cache/clear', (req, res) => {
  simpleCache.clear();
  res.json({
    success: true,
    message: 'Unified news cache cleared',
    timestamp: new Date().toISOString()
  });
});

router.get('/cache/stats', (req, res) => {
  const stats = simpleCache.getStats();
  res.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;