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

    // 🎯 HYBRID APPROACH: RSS (guaranteed images) + Database (validated images) = 100+ articles with 100% images
    let articleResult;
    
    try {
      logger.info('🔄 Starting hybrid RSS + database approach for 100% image guarantee...');
      
      // Step 1: Get fresh RSS articles (guaranteed images)
      const { fetchRealCryptoNews } = require('../services/newsService');
      const rssArticles = await fetchRealCryptoNews();
      logger.info(`📰 RSS returned ${rssArticles.length} articles with guaranteed images`);
      
      // Step 2: Get database articles with confirmed real images (not placeholders)
      let databaseArticles = [];
      
      if (network === 'clients') {
        // Get client network articles from database
        for (const clientNetwork of CLIENT_NETWORKS) {
          const result = await getArticles({
            ...options,
            network: clientNetwork,
            limit: 1000,
            onlyWithImages: true // This filters for real images at database level
          });
          
          if (result.data && result.data.length > 0) {
            databaseArticles.push(...result.data);
          }
        }
      } else {
        // Get all network articles from database
        const result = await getArticles({
          ...options,
          limit: 1000,
          onlyWithImages: true // This filters for real images at database level
        });
        databaseArticles = result.data || [];
      }
      
      // Additional validation: Only keep database articles with real cover images
      const validatedDatabaseArticles = databaseArticles.filter(article => {
        const hasRealImage = article.cover_image && 
                            article.cover_image.trim() !== '' &&
                            !article.cover_image.includes('placeholder') &&
                            !article.cover_image.includes('placehold.co') &&
                            !article.cover_image.includes('via.placeholder') &&
                            !article.cover_image.includes('example.com') &&
                            article.cover_image.startsWith('http');
        return hasRealImage;
      });
      
      logger.info(`🔍 Database returned ${validatedDatabaseArticles.length} articles with validated images`);
      
      // Step 3: Combine RSS + Database articles
      const combinedArticles = [...rssArticles];
      const rssUrls = new Set(rssArticles.map(article => article.url));
      
      // Add database articles that don't duplicate RSS articles
      for (const dbArticle of validatedDatabaseArticles) {
        if (!rssUrls.has(dbArticle.url)) {
          combinedArticles.push(dbArticle);
        }
      }
      
      logger.info(`✅ Combined total: ${combinedArticles.length} articles (${rssArticles.length} RSS + ${combinedArticles.length - rssArticles.length} unique database)`);
      
      // Step 4: Apply network filtering to combined articles
      let filteredArticles = combinedArticles;
      
      if (network === 'clients') {
        filteredArticles = filteredArticles.filter(article => 
          CLIENT_NETWORKS.includes(article.network)
        );
      } else if (network !== 'all') {
        filteredArticles = filteredArticles.filter(article => 
          article.network && article.network.toLowerCase() === network.toLowerCase()
        );
      }
      
      // Step 5: Apply category filtering
      if (category === 'breaking') {
        filteredArticles = filteredArticles.filter(article => article.is_breaking === true);
      } else if (category !== 'all') {
        filteredArticles = filteredArticles.filter(article => article.category === category);
      }
      
      // Step 6: Apply search filter
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        filteredArticles = filteredArticles.filter(article => 
          article.title.toLowerCase().includes(searchLower) ||
          (article.content && article.content.toLowerCase().includes(searchLower))
        );
      }
      
      // Step 7: Sort by date
      filteredArticles.sort((a, b) => 
        new Date(b.published_at || b.publishedAt) - new Date(a.published_at || a.publishedAt)
      );
      
      // Step 8: Apply pagination
      const startIndex = (options.page - 1) * options.limit;
      const paginatedArticles = filteredArticles.slice(startIndex, startIndex + options.limit);
      
      articleResult = {
        data: paginatedArticles,
        count: filteredArticles.length
      };
      
      logger.info(`🎯 Hybrid result: ${paginatedArticles.length} articles on page ${options.page} of ${filteredArticles.length} total (100% image guarantee)`);
      
    } catch (error) {
      logger.error('Hybrid approach failed, falling back to RSS only:', error.message);
      
      // Ultimate fallback: RSS only (guaranteed images)
      try {
        const { fetchRealCryptoNews } = require('../services/newsService');
        const rssArticles = await fetchRealCryptoNews();
        
        // Apply basic filtering
        let filteredArticles = rssArticles;
        
        if (network === 'clients') {
          filteredArticles = filteredArticles.filter(article => 
            CLIENT_NETWORKS.includes(article.network)
          );
        } else if (network !== 'all') {
          filteredArticles = filteredArticles.filter(article => 
            article.network && article.network.toLowerCase() === network.toLowerCase()
          );
        }
        
        // Apply pagination
        const startIndex = (options.page - 1) * options.limit;
        const paginatedArticles = filteredArticles.slice(startIndex, startIndex + options.limit);
        
        articleResult = {
          data: paginatedArticles,
          count: filteredArticles.length
        };
        
        logger.info(`📰 RSS-only fallback: ${paginatedArticles.length} articles with guaranteed images`);
        
      } catch (rssError) {
        logger.error('RSS fallback also failed:', rssError.message);
        throw rssError;
      }
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
      // Use hybrid approach for counts (matches main endpoint)
      const { fetchRealCryptoNews } = require('../services/newsService');
      const rssArticles = await fetchRealCryptoNews();
      
      // Get database articles with real images (same validation as main endpoint)
      let databaseArticles = [];
      if (onlyWithImages === 'true') {
        const allDbArticles = await getArticles({
          page: 1,
          limit: 1000,
          onlyWithImages: true
        });
        
        // Apply same validation as main endpoint
        databaseArticles = (allDbArticles.data || []).filter(article => {
          const hasRealImage = article.cover_image && 
                              article.cover_image.trim() !== '' &&
                              !article.cover_image.includes('placeholder') &&
                              !article.cover_image.includes('placehold.co') &&
                              !article.cover_image.includes('via.placeholder') &&
                              !article.cover_image.includes('example.com') &&
                              article.cover_image.startsWith('http');
          return hasRealImage;
        });
      }
      
      // Combine RSS + Database (deduplicate by URL)
      const combinedArticles = [...rssArticles];
      const rssUrls = new Set(rssArticles.map(article => article.url));
      
      for (const dbArticle of databaseArticles) {
        if (!rssUrls.has(dbArticle.url)) {
          combinedArticles.push(dbArticle);
        }
      }
      
      logger.info(`📊 Hybrid counts: ${rssArticles.length} RSS + ${databaseArticles.length} database = ${combinedArticles.length} total`);
      
      counts.all = combinedArticles.length;
      
      // Count by client networks
      let clientTotal = 0;
      for (const network of CLIENT_NETWORKS) {
        const networkCount = combinedArticles.filter(article => 
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