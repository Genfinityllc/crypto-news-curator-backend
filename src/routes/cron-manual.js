const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { fetchRealCryptoNews } = require('../services/newsService');
const { insertArticlesBatch } = require('../config/supabase');
const { triggerJob, getCronJobStatus } = require('../services/cronService');
const articlePurgeService = require('../services/articlePurgeService');

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
    
    // Also clear simple cache service
    const simpleCache = require('../services/simpleCacheService');
    simpleCache.clear();
    logger.info('🗑️ Cleared both cache services');
    
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

/**
 * Test client network filtering
 */
router.get('/test-clients', async (req, res) => {
  try {
    const { getArticles } = require('../config/supabase');
    
    // Get all articles and filter for client networks
    const allArticles = await getArticles({ limit: 200 });
    const clientNetworks = ['Hedera', 'XDC Network', 'Algorand', 'Constellation', 'HashPack', 'SWAP', 'Axiom'];
    
    const clientArticles = allArticles.data.filter(article => 
      article.network && clientNetworks.some(client => 
        article.network.toLowerCase().includes(client.toLowerCase())
      )
    );
    
    res.json({
      success: true,
      totalArticles: allArticles.data.length,
      clientArticles: clientArticles.length,
      networkBreakdown: clientArticles.reduce((acc, article) => {
        acc[article.network] = (acc[article.network] || 0) + 1;
        return acc;
      }, {}),
      sampleTitles: clientArticles.slice(0, 5).map(article => ({
        title: article.title,
        network: article.network
      })),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error testing client networks:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Test individual network filtering
 */
router.get('/test-network/:networkName', async (req, res) => {
  try {
    const { getArticles } = require('../config/supabase');
    const { networkName } = req.params;
    
    // Get all articles and filter for specific network
    const allArticles = await getArticles({ limit: 200 });
    
    // Test different filtering approaches
    const exactMatch = allArticles.data.filter(article => 
      article.network === networkName
    );
    
    const caseInsensitiveMatch = allArticles.data.filter(article => 
      article.network && article.network.toLowerCase() === networkName.toLowerCase()
    );
    
    const containsMatch = allArticles.data.filter(article => 
      article.network && article.network.toLowerCase().includes(networkName.toLowerCase())
    );
    
    // Get all unique networks for reference
    const allNetworks = [...new Set(allArticles.data.map(article => article.network))].sort();
    
    res.json({
      success: true,
      searchingFor: networkName,
      totalArticles: allArticles.data.length,
      exactMatch: {
        count: exactMatch.length,
        samples: exactMatch.slice(0, 3).map(a => ({ title: a.title, network: a.network }))
      },
      caseInsensitiveMatch: {
        count: caseInsensitiveMatch.length,
        samples: caseInsensitiveMatch.slice(0, 3).map(a => ({ title: a.title, network: a.network }))
      },
      containsMatch: {
        count: containsMatch.length,
        samples: containsMatch.slice(0, 3).map(a => ({ title: a.title, network: a.network }))
      },
      allNetworks: allNetworks,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error testing network filtering:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Cleanup fake/example articles from database
 */
router.post('/cleanup-fake-articles', async (req, res) => {
  try {
    const { deleteArticlesByQuery } = require('../config/supabase');
    
    logger.info('🧹 Starting cleanup of fake/example articles');
    
    // Delete articles with example URLs or fake content
    const fakeUrlPatterns = [
      "url LIKE '%example.com%'",
      "url = '#'",
      "url LIKE '%example%'",
      "content LIKE '%fallback%'",
      "content LIKE '%demo purposes%'",
      "content LIKE '%This is fallback data%'",
      "title LIKE '%Live Data Unavailable%'",
      "source = 'Fallback'",
      "source LIKE '%Web Search%'"
    ];
    
    const whereClause = fakeUrlPatterns.join(' OR ');
    
    // Use direct Supabase query
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    // First count the fake articles
    const { data: countData, error: countError } = await supabase
      .from('articles')
      .select('count(*)', { count: 'exact' })
      .or(whereClause);
    
    if (countError) {
      throw new Error(`Error counting fake articles: ${countError.message}`);
    }
    
    const fakeCount = countData?.[0]?.count || 0;
    
    if (fakeCount === 0) {
      return res.json({
        success: true,
        message: 'No fake articles found to clean up',
        deletedCount: 0,
        timestamp: new Date().toISOString()
      });
    }
    
    // Delete the fake articles
    const { data, error } = await supabase
      .from('articles')
      .delete()
      .or(whereClause);
    
    if (error) {
      throw new Error(`Error deleting fake articles: ${error.message}`);
    }
    
    logger.info(`✅ Deleted ${fakeCount} fake/example articles`);
    
    // Clear cache to refresh frontend
    const cacheService = require('../services/cacheService');
    if (cacheService && cacheService.clearArticlesCache) {
      const cleared = cacheService.clearArticlesCache();
      logger.info(`🗑️ Cleared ${cleared} cache entries`);
    }
    
    res.json({
      success: true,
      message: `Successfully deleted ${fakeCount} fake/example articles`,
      deletedCount: fakeCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error cleaning up fake articles:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Remove WSJ articles (simple version)
 */
router.post('/cleanup-wsj-simple', async (req, res) => {
  try {
    logger.info('🧹 Starting simple WSJ cleanup...');
    
    const { getSupabaseClient } = require('../config/supabase');
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Supabase client not available',
        timestamp: new Date().toISOString()
      });
    }
    
    // Remove WSJ articles - try individual queries
    let totalRemoved = 0;
    const removedArticles = [];
    
    // 1. Remove by title containing Wall Street Journal
    const { data: wsjTitle, error: error1 } = await supabase
      .from('articles')
      .delete()
      .ilike('title', '%Wall Street Journal%')
      .select('id, title, source');
    
    if (error1) {
      logger.error('Error removing WSJ by title:', error1.message);
    } else {
      const count1 = wsjTitle?.length || 0;
      totalRemoved += count1;
      removedArticles.push(...(wsjTitle || []));
      logger.info(`Removed ${count1} articles by title containing 'Wall Street Journal'`);
    }
    
    // 2. Remove by URL containing wsj.com
    const { data: wsjUrl, error: error2 } = await supabase
      .from('articles')
      .delete()
      .ilike('url', '%wsj.com%')
      .select('id, title, source');
    
    if (error2) {
      logger.error('Error removing WSJ by URL:', error2.message);
    } else {
      const count2 = wsjUrl?.length || 0;
      totalRemoved += count2;
      removedArticles.push(...(wsjUrl || []));
      logger.info(`Removed ${count2} articles by URL containing 'wsj.com'`);
    }
    
    // 3. Remove specific article title
    const { data: wsjSpecific, error: error3 } = await supabase
      .from('articles')
      .delete()
      .ilike('title', '%Investors\' Optimism for Lower Rates%')
      .select('id, title, source');
    
    if (error3) {
      logger.error('Error removing specific WSJ article:', error3.message);
    } else {
      const count3 = wsjSpecific?.length || 0;
      totalRemoved += count3;
      removedArticles.push(...(wsjSpecific || []));
      logger.info(`Removed ${count3} articles with specific WSJ title`);
    }
    
    logger.info(`✅ Total WSJ articles removed: ${totalRemoved}`);
    
    if (totalRemoved > 0) {
      removedArticles.forEach(article => {
        logger.info(`   - "${article.title.substring(0, 60)}..." from ${article.source}`);
      });
    }
    
    // Clear cache to refresh frontend
    const cacheService = require('../services/cacheService');
    if (cacheService && cacheService.clearArticlesCache) {
      const cleared = cacheService.clearArticlesCache();
      logger.info(`🗑️ Cleared ${cleared} cache entries`);
    }
    
    res.json({
      success: true,
      message: `Successfully removed ${totalRemoved} WSJ articles`,
      removedCount: totalRemoved,
      removedArticles: removedArticles.map(a => ({ title: a.title.substring(0, 80), source: a.source })),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error in WSJ cleanup:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Remove WSJ articles and enforce article limits (500 max, 4 days retention)
 */
router.post('/cleanup-wsj-and-purge', async (req, res) => {
  try {
    logger.info('🧹 Starting WSJ cleanup and article purge...');
    
    // First, remove WSJ articles specifically
    const wsjRemoved = await articlePurgeService.removeWSJArticles();
    
    // Then run the full purge process
    const purgeResults = await articlePurgeService.purgeOldArticles();
    
    // Clear cache to refresh frontend
    const cacheService = require('../services/cacheService');
    if (cacheService && cacheService.clearArticlesCache) {
      const cleared = cacheService.clearArticlesCache();
      logger.info(`🗑️ Cleared ${cleared} cache entries`);
    }
    
    res.json({
      success: true,
      message: 'WSJ cleanup and article purge completed successfully',
      wsjRemoved,
      purgeResults,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error in WSJ cleanup and purge:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * NUCLEAR OPTION: Complete cache clear and WSJ cleanup
 */
router.post('/nuclear-wsj-cleanup', async (req, res) => {
  try {
    logger.info('💣 NUCLEAR WSJ CLEANUP: Complete cache and database purge...');
    
    const { getSupabaseClient } = require('../config/supabase');
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Supabase client not available',
        timestamp: new Date().toISOString()
      });
    }
    
    let totalRemoved = 0;
    const removedArticles = [];
    
    // 1. Search and destroy ANY article with "Lower Rates" in title (WSJ financial content)
    const { data: optimismArticles, error: error1 } = await supabase
      .from('articles')
      .delete()
      .ilike('title', '%Lower%Rates%')
      .select('id, title, source, network');
    
    if (!error1 && optimismArticles) {
      totalRemoved += optimismArticles.length;
      removedArticles.push(...optimismArticles);
      logger.info(`💥 Removed ${optimismArticles.length} articles with 'Optimism Lower Rates'`);
    }
    
    // 2. Search for the exact title pattern
    const { data: exactMatch, error: error2 } = await supabase
      .from('articles')
      .delete()
      .ilike('title', '%Investors%Optimism%Lower%Rates%Lifts%Nasdaq%')
      .select('id, title, source, network');
    
    if (!error2 && exactMatch) {
      totalRemoved += exactMatch.length;
      removedArticles.push(...exactMatch);
      logger.info(`💥 Removed ${exactMatch.length} articles with exact WSJ title pattern`);
    }
    
    // 3. Remove any article with "Nasdaq" and "Record" (likely WSJ financial content)
    const { data: nasdaqArticles, error: error3 } = await supabase
      .from('articles')
      .delete()
      .ilike('title', '%Nasdaq%')
      .select('id, title, source, network');
    
    if (!error3 && nasdaqArticles) {
      totalRemoved += nasdaqArticles.length;
      removedArticles.push(...nasdaqArticles);
      logger.info(`💥 Removed ${nasdaqArticles.length} Nasdaq/Record articles`);
    }
    
    // 4. Clear ALL caches
    try {
      const cacheService = require('../services/cacheService');
      if (cacheService && cacheService.clearAll) {
        cacheService.clearAll();
        logger.info('💥 Cleared main cache service');
      }
      if (cacheService && cacheService.clearArticlesCache) {
        const cleared = cacheService.clearArticlesCache();
        logger.info(`💥 Cleared ${cleared} article cache entries`);
      }
    } catch (cacheError) {
      logger.info('Cache service not available or error clearing:', cacheError.message);
    }
    
    // 5. Clear simple cache service if available
    try {
      const simpleCacheService = require('../services/simpleCacheService');
      if (simpleCacheService && simpleCacheService.clearAll) {
        simpleCacheService.clearAll();
        logger.info('💥 Cleared simple cache service');
      }
    } catch (simpleError) {
      logger.info('Simple cache service not available');
    }
    
    logger.info(`💣 NUCLEAR CLEANUP COMPLETE: Removed ${totalRemoved} articles`);
    
    res.json({
      success: true,
      message: `NUCLEAR CLEANUP: Removed ${totalRemoved} articles and cleared all caches`,
      removedCount: totalRemoved,
      removedArticles: removedArticles.map(a => ({ 
        title: a.title.substring(0, 80), 
        source: a.source,
        network: a.network 
      })),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('💣 Error in nuclear WSJ cleanup:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get article statistics and limits
 */
router.get('/article-stats', async (req, res) => {
  try {
    const stats = await articlePurgeService.getArticleStats();
    
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Error getting article stats:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;