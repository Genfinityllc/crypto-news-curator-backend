const express = require('express');
const router = express.Router();
const { fetchRealCryptoNews } = require('../services/newsService');
const simpleCache = require('../services/simpleCacheService');
const logger = require('../utils/logger');

// Ultra-fast cached news endpoint
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      network,
      category,
      sortBy = 'publishedAt',
      search,
      breaking = false,
      forceRefresh = false
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      network,
      category,
      sortBy,
      search,
      breaking: breaking === 'true',
      forceRefresh: forceRefresh === 'true'
    };

    const cacheKey = simpleCache.generateKey(options);

    // Try cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = simpleCache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached.articles,
          pagination: cached.pagination,
          cached: true,
          cacheKey,
          timestamp: new Date().toISOString()
        });
      }
    }

    logger.info(`Fetching fresh articles for ${network || 'all'} networks`);

    // Fetch fresh data (same logic as working original route)
    const realNews = await fetchRealCryptoNews();
    
    // Apply filters to RSS news
    let filteredNews = realNews;
    
    if (network && network !== 'all') {
      if (network === 'clients') {
        // Special filter for client networks - prioritize your specific clients
        const clientNetworks = ['Hedera', 'XDC Network', 'Algorand', 'Constellation', 'HashPack', 'SWAP'];
        filteredNews = filteredNews.filter(article => 
          article.network && clientNetworks.some(client => 
            article.network.toLowerCase().includes(client.toLowerCase())
          )
        );
      } else {
        filteredNews = filteredNews.filter(article => 
          article.network && article.network.toLowerCase().includes(network.toLowerCase())
        );
      }
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
    
    // Apply sorting
    if (sortBy === 'viral_score') {
      filteredNews.sort((a, b) => (b.viral_score || 0) - (a.viral_score || 0));
    } else {
      filteredNews.sort((a, b) => new Date(b.published_at || b.publishedAt) - new Date(a.published_at || a.publishedAt));
    }
    
    // Apply pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedNews = filteredNews.slice(startIndex, startIndex + parseInt(limit));
    
    const result = {
      articles: paginatedNews,
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

module.exports = router;
