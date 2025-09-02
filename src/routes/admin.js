const express = require('express');
const router = express.Router();
const { triggerJob, getCronJobStatus } = require('../services/cronService');
const { testSupabaseConnection, getArticles } = require('../config/supabase');
const { generateAISummary } = require('../services/aiService');
const logger = require('../utils/logger');

// Get system status
router.get('/status', async (req, res) => {
  try {
    const supabaseConnected = await testSupabaseConnection();
    const { data: articles, count: totalArticles } = await getArticles({ limit: 1 });
    const cronStatus = getCronJobStatus();
    
    res.json({
      success: true,
      status: {
        server: 'running',
        supabase: supabaseConnected ? 'connected' : 'disconnected',
        totalArticles,
        cronJobs: cronStatus,
        lastChecked: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error getting system status:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving system status'
    });
  }
});

// Get articles overview
router.get('/articles', async (req, res) => {
  try {
    const { data: recentArticles } = await getArticles({ limit: 10 });
    const { data: breakingNews } = await getArticles({ isBreaking: true, limit: 5 });
    
    // Get articles by network
    const networks = ['Bitcoin', 'Ethereum', 'Solana', 'Cardano', 'Polygon'];
    const networkStats = {};
    
    for (const network of networks) {
      const { count } = await getArticles({ network, limit: 1 });
      networkStats[network] = count;
    }
    
    res.json({
      success: true,
      data: {
        recent: recentArticles,
        breaking: breakingNews,
        networkStats,
        summary: {
          totalArticles: recentArticles.length > 0 ? await getArticles({}).then(r => r.count) : 0,
          breakingCount: breakingNews.length,
          networksTracked: Object.keys(networkStats).length
        }
      }
    });
  } catch (error) {
    logger.error('Error getting articles overview:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving articles overview'
    });
  }
});

// Trigger cron job manually
router.post('/trigger/:jobName', async (req, res) => {
  try {
    const { jobName } = req.params;
    const result = await triggerJob(jobName);
    
    res.json({
      success: result.success,
      message: result.message || result.error,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error triggering job:', error);
    res.status(500).json({
      success: false,
      message: 'Error triggering job'
    });
  }
});

// Generate AI summary for article
router.post('/ai-summary/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get article from database
    const { data: articles } = await getArticles({});
    const article = articles.find(a => a.id === id);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }
    
    const aiSummary = await generateAISummary(article.title, article.content);
    
    res.json({
      success: true,
      data: {
        articleId: id,
        title: article.title,
        originalSummary: article.summary,
        aiSummary,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error generating AI summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating AI summary'
    });
  }
});

// Search articles with advanced filters
router.get('/search', async (req, res) => {
  try {
    const {
      query,
      network,
      category,
      sentiment,
      breaking,
      limit = 20,
      page = 1
    } = req.query;
    
    const searchOptions = {
      search: query,
      network: network !== 'all' ? network : undefined,
      category: category !== 'all' ? category : undefined,
      isBreaking: breaking === 'true',
      limit: parseInt(limit),
      page: parseInt(page),
      sortBy: 'date'
    };
    
    const { data: articles, count } = await getArticles(searchOptions);
    
    // Add search metadata
    const searchResults = articles.map(article => ({
      ...article,
      hasAiSummary: !!article.ai_summary,
      contentLength: article.content?.length || 0
    }));
    
    res.json({
      success: true,
      query: query,
      filters: { network, category, sentiment, breaking },
      results: searchResults,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error performing admin search:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing search'
    });
  }
});

// Get system logs (simplified)
router.get('/logs', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Logs endpoint - check server console for detailed logs',
      note: 'In production, implement log aggregation system'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving logs'
    });
  }
});

module.exports = router;