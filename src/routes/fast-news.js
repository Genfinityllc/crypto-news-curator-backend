const express = require('express');
const router = express.Router();
const { getArticles, getBreakingNews } = require('../config/supabase');
const { enhanceArticlesWithImages } = require('../services/newsService');
const simpleCache = require('../services/simpleCacheService');
const logger = require('../utils/logger');
const { generateCryptoPlaceholder } = require('../services/imageService');

// Ultra-fast cached news endpoint with live RSS fallback
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 200,
      network,
      category,
      sortBy = 'publishedAt',
      search,
      breaking = false,
      forceRefresh = false,
      onlyWithImages = false
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      network,
      category,
      sortBy,
      search,
      breaking: breaking === 'true',
      forceRefresh: forceRefresh === 'true',
      onlyWithImages: onlyWithImages === 'true'
    };

    const cacheKey = simpleCache.generateKey(options);

    // Check cache age first - if cache is older than 5 minutes, force refresh
    const cached = simpleCache.get(cacheKey);
    const cacheAgeMinutes = cached ? (Date.now() - cached.timestamp) / (1000 * 60) : Infinity;
    const isCacheStale = cacheAgeMinutes > 5; // 5 minute cache expiry

    // Try cache first (unless forcing refresh or cache is stale)
    if (!forceRefresh && !isCacheStale && cached) {
      logger.info(`📦 Serving from cache (age: ${cacheAgeMinutes.toFixed(1)} min)`);
      return res.json({
        success: true,
        data: cached.articles,
        pagination: cached.pagination,
        cached: true,
        cacheAge: cacheAgeMinutes,
        cacheKey,
        timestamp: new Date().toISOString()
      });
    }

    if (isCacheStale) {
      logger.info(`🔄 Cache is stale (${cacheAgeMinutes.toFixed(1)} min old), refreshing...`);
    }

    logger.info(`Fetching fresh articles from database for ${network || 'all'} networks`);

    // First try to get articles from database
    const articleResult = await getArticles({ 
      page: 1, 
      limit: 1000, // Get more articles to filter properly
      network: (network === 'all' || network === 'clients') ? null : network,
      category: category === 'all' ? null : category,
      isBreaking: (breaking === 'true' || category === 'breaking') ? true : undefined,
      onlyWithImages: onlyWithImages === 'true'
    });
    
    let filteredNews = articleResult.data || [];
    
    // If database is empty or has very few articles, fetch fresh from RSS
    if (filteredNews.length < 10) {
      logger.info(`📰 Database has ${filteredNews.length} articles, fetching fresh RSS...`);
      try {
        const { fetchRealCryptoNews } = require('../services/newsService');
        const { insertArticlesBatch } = require('../config/supabase');
        
        const freshNews = await fetchRealCryptoNews();
        logger.info(`📰 RSS fetched ${freshNews.length} fresh articles`);
        
        if (freshNews.length > 0) {
          // Insert fresh articles into database
          const insertedArticles = await insertArticlesBatch(freshNews);
          logger.info(`📥 Inserted ${insertedArticles.length} fresh articles into database`);
          
          // Use fresh articles for response
          filteredNews = freshNews;
          
          // Clear all related caches after inserting fresh data
          simpleCache.clear();
          logger.info(`🗑️ Cleared all caches after fresh RSS insertion`);
        }
      } catch (rssError) {
        logger.error('Error fetching fresh RSS:', rssError.message);
        // Continue with database articles even if RSS fails
      }
    }
    
    // Additional client-side filters (if database filtering wasn't sufficient)
    if (network && network !== 'all' && network !== 'clients') {
      filteredNews = filteredNews.filter(article => {
        // Exact network matching to prevent cross-contamination
        // (e.g., prevent Hedera articles from showing in HashPack filter)
        return article.network && article.network.toLowerCase() === network.toLowerCase();
      });
    }
    
    if (network === 'clients') {
      // Special filter for client networks - prioritize your specific clients
      const clientNetworks = ['Hedera', 'XDC Network', 'Algorand', 'Constellation', 'HashPack'];
      filteredNews = filteredNews.filter(article => 
        article.network && clientNetworks.some(client => 
          article.network === client
        )
      );
    }
    
    // Remove redundant filters since they're handled by database query
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredNews = filteredNews.filter(article => 
        article.title.toLowerCase().includes(searchLower) ||
        article.content.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply sorting
    if (sortBy === 'viral_score') {
      filteredNews.sort((a, b) => (b.viral_score || 0) - (a.viral_score || 0));
    } else {
      filteredNews.sort((a, b) => new Date(b.published_at || b.publishedAt) - new Date(a.published_at || a.publishedAt));
    }
    
    // Apply pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedNews = filteredNews.slice(startIndex, startIndex + parseInt(limit));
    
    // Use existing images or create themed crypto placeholders
    const enhancedNews = paginatedNews.map(article => ({
      ...article,
      // Use existing cover_image or create a crypto-themed placeholder
      cover_image: article.cover_image || generateCryptoPlaceholder(article, '400x225'),
      image_optimized: !!article.cover_image,
      // Ensure card_images exist for frontend compatibility
      card_images: article.card_images || {
        small: article.cover_image || generateCryptoPlaceholder(article, '300x169'),
        medium: article.cover_image || generateCryptoPlaceholder(article, '400x225'),
        large: article.cover_image || generateCryptoPlaceholder(article, '500x281'),
        square: article.cover_image || generateCryptoPlaceholder(article, '300x300')
      }
    }));
    
    const result = {
      articles: enhancedNews,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(filteredNews.length / limit),
        hasNext: startIndex + parseInt(limit) < filteredNews.length,
        hasPrev: parseInt(page) > 1,
        totalCount: filteredNews.length
      }
    };

    // Cache the result
    simpleCache.set(cacheKey, result);

    res.json({
      success: true,
      data: result.articles,
      pagination: result.pagination,
      cached: false,
      cacheKey,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error in fast news endpoint:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching articles',
      error: error.message
    });
  }
});

// Cache management
router.get('/cache/stats', (req, res) => {
  const stats = simpleCache.getStats();
  res.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString()
  });
});

router.get('/cache/age', (req, res) => {
  try {
    const cacheService = require('../services/cacheService');
    const cacheAge = cacheService.getCacheAge();
    res.json({
      success: true,
      data: cacheAge,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting cache age',
      error: error.message
    });
  }
});

router.post('/cache/clear', (req, res) => {
  simpleCache.clear();
  res.json({
    success: true,
    message: 'Cache cleared',
    timestamp: new Date().toISOString()
  });
});

// Get counts for client networks (matching frontend filter logic)
router.get('/client-counts', async (req, res) => {
  try {
    const clientNetworks = ['Hedera', 'XDC Network', 'Algorand', 'Constellation', 'HashPack'];
    const counts = {};
    let totalClientCount = 0;
    
    for (const network of clientNetworks) {
      try {
        const articleResult = await getArticles({ 
          page: 1, 
          limit: 1000,
          network: network,
          onlyWithImages: true // Match frontend filtering
        });
        const networkCount = articleResult.data ? articleResult.data.length : 0;
        counts[network] = networkCount;
        totalClientCount += networkCount;
      } catch (error) {
        logger.error(`Error getting count for ${network}:`, error.message);
        counts[network] = 0;
      }
    }
    
    // Add total client count
    counts['total'] = totalClientCount;
    
    res.json({
      success: true,
      data: counts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting client counts:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error getting client counts',
      error: error.message
    });
  }
});

module.exports = router;
