const express = require('express');
const router = express.Router();
const { fetchRealCryptoNews } = require('../services/newsService');
const { insertArticlesBatch } = require('../config/supabase');
const logger = require('../utils/logger');

// Clear database and fetch fresh crypto news
router.post('/refresh-news', async (req, res) => {
  try {
    logger.info('Manual news refresh triggered');
    
    // Fetch fresh crypto news from RSS feeds
    const freshNews = await fetchRealCryptoNews();
    
    // Insert fresh articles into database
    const insertedArticles = await insertArticlesBatch(freshNews);
    
    logger.info(`Fresh news refresh completed: ${insertedArticles.length} articles inserted`);
    
    res.json({
      success: true,
      message: `Successfully refreshed ${insertedArticles.length} crypto articles`,
      articlesCount: insertedArticles.length
    });
  } catch (error) {
    logger.error('Error refreshing news:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error refreshing news',
      error: error.message
    });
  }
});

module.exports = router;