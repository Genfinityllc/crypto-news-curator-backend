const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { fetchRealCryptoNews } = require('../services/newsService');
const { insertArticlesBatch } = require('../config/supabase');
const { triggerJob, getCronJobStatus } = require('../services/cronService');

/**
 * Manual trigger for RSS aggregation
 */
router.post('/trigger-rss', async (req, res) => {
  try {
    logger.info('🚀 Manual RSS aggregation triggered');
    
    // Fetch news from RSS feeds
    const startTime = Date.now();
    const realNews = await fetchRealCryptoNews();
    const fetchTime = Date.now() - startTime;
    
    logger.info(`✅ Fetched ${realNews.length} articles in ${fetchTime}ms`);
    
    // Insert into database
    const insertStart = Date.now();
    const insertedArticles = await insertArticlesBatch(realNews);
    const insertTime = Date.now() - insertStart;
    
    logger.info(`📊 Inserted ${insertedArticles.length} articles in ${insertTime}ms`);
    
    // Clear cache to refresh frontend
    const cacheService = require('../services/cacheService');
    cacheService.clearArticlesCache();
    
    res.json({
      success: true,
      message: 'RSS aggregation completed successfully',
      stats: {
        articlesFetched: realNews.length,
        articlesInserted: insertedArticles.length,
        fetchTimeMs: fetchTime,
        insertTimeMs: insertTime,
        totalTimeMs: Date.now() - (startTime - fetchTime)
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error in manual RSS trigger:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Manual trigger for any cron job
 */
router.post('/trigger/:jobName', async (req, res) => {
  try {
    const { jobName } = req.params;
    logger.info(`🚀 Manual trigger for job: ${jobName}`);
    
    const result = await triggerJob(jobName);
    
    res.json({
      success: result.success,
      message: result.message || result.error,
      jobName,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`❌ Error triggering job ${req.params.jobName}:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      jobName: req.params.jobName,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get cron job status
 */
router.get('/status', async (req, res) => {
  try {
    const status = getCronJobStatus();
    
    res.json({
      success: true,
      ...status,
      serverUptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error getting cron status:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Test RSS feed parsing (diagnostic endpoint)
 */
router.get('/test-rss/:count?', async (req, res) => {
  try {
    const count = parseInt(req.params.count) || 3;
    logger.info(`🧪 Testing RSS parsing with ${count} feeds`);
    
    const testFeeds = [
      'https://www.coindesk.com/arc/outboundfeeds/rss/',
      'https://cointelegraph.com/rss',
      'https://news.google.com/rss/search?q=Hedera+OR+HBAR&hl=en-US&gl=US&ceid=US:en'
    ];
    
    const results = [];
    const Parser = require('rss-parser');
    const parser = new Parser();
    
    for (let i = 0; i < Math.min(count, testFeeds.length); i++) {
      const feedUrl = testFeeds[i];
      try {
        logger.info(`Testing feed: ${feedUrl}`);
        const startTime = Date.now();
        const feed = await parser.parseURL(feedUrl);
        const parseTime = Date.now() - startTime;
        
        results.push({
          feedUrl,
          success: true,
          title: feed.title,
          itemCount: feed.items.length,
          parseTimeMs: parseTime,
          sampleTitles: feed.items.slice(0, 3).map(item => item.title)
        });
        
      } catch (error) {
        results.push({
          feedUrl,
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      message: `Tested ${results.length} RSS feeds`,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error testing RSS feeds:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Test breaking news database query
 */
router.get('/test-breaking', async (req, res) => {
  try {
    const { getBreakingNews, getArticles } = require('../config/supabase');
    
    // Test direct breaking news function
    const directBreaking = await getBreakingNews();
    
    // Test getArticles with breaking filter
    const filteredBreaking = await getArticles({ 
      isBreaking: true,
      limit: 10
    });
    
    res.json({
      success: true,
      directBreaking: {
        count: directBreaking.length,
        sample: directBreaking.slice(0, 3).map(article => ({
          title: article.title,
          is_breaking: article.is_breaking
        }))
      },
      filteredBreaking: {
        count: filteredBreaking.data ? filteredBreaking.data.length : 0,
        sample: filteredBreaking.data ? filteredBreaking.data.slice(0, 3).map(article => ({
          title: article.title,
          is_breaking: article.is_breaking
        })) : []
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error testing breaking news:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;