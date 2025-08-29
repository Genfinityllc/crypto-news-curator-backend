const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { fetchRealCryptoNews } = require('../services/newsService');
const logger = require('../utils/logger');

// Get all news articles with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      network,
      category,
      sortBy = 'published_at',
      search,
      breaking = false
    } = req.query;

    let data = null, error = null, count = 0;

    if (supabase) {
      let query = supabase.from('articles').select('*');

      // Apply filters
      if (network && network !== 'all') {
        query = query.eq('network', network);
      }

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      if (breaking === 'true') {
        query = query.eq('is_breaking', true);
      }

      if (search) {
        query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
      }

      // Apply sorting and pagination
      query = query
        .order(sortBy, { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      const result = await query;
      data = result.data;
      error = result.error;
      count = result.count;
    }

    if (error || !supabase) {
      if (error) logger.error('Error fetching articles from Supabase:', error);
      if (!supabase) logger.warn('Supabase not configured - fetching real RSS news data');
      
      // Fetch real news from RSS feeds
      const realNewsData = await fetchRealCryptoNews();
      
      // Apply filters to real data
      let filteredData = [...realNewsData];
      
      if (network && network !== 'all') {
        filteredData = filteredData.filter(article => 
          article.network.toLowerCase() === network.toLowerCase()
        );
      }

      if (category && category !== 'all') {
        filteredData = filteredData.filter(article => 
          article.category === category
        );
      }

      if (breaking === 'true') {
        filteredData = filteredData.filter(article => article.is_breaking === true);
      }

      if (search) {
        filteredData = filteredData.filter(article => 
          article.title.toLowerCase().includes(search.toLowerCase()) ||
          article.content.toLowerCase().includes(search.toLowerCase())
        );
      }

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedData = filteredData.slice(startIndex, endIndex);

      return res.json({
        success: true,
        data: paginatedData,
        total: filteredData.length,
        page: parseInt(page),
        totalPages: Math.ceil(filteredData.length / limit),
        message: 'Real crypto news articles from RSS feeds'
      });
    }

    res.json({
      success: true,
      data: data || [],
      total: count || 0,
      page: parseInt(page),
      totalPages: Math.ceil((count || 0) / limit),
      message: 'Articles retrieved successfully from Supabase'
    });

  } catch (error) {
    logger.error('Error in articles route:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get breaking news
router.get('/breaking', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('is_breaking', true)
      .order('published_at', { ascending: false })
      .limit(10);

    if (error || !supabase) {
      if (error) logger.error('Error fetching breaking news:', error);
      if (!supabase) logger.warn('Supabase not configured - fetching real breaking news');
      
      // Fetch real breaking news from RSS feeds
      const realNewsData = await fetchRealCryptoNews();
      const breakingNews = realNewsData.filter(article => article.is_breaking === true);

      return res.json({
        success: true,
        data: breakingNews.slice(0, 10), // Top 10 breaking news
        total: breakingNews.length,
        message: 'Real breaking news from RSS feeds'
      });
    }

    res.json({
      success: true,
      data: data || [],
      total: (data || []).length,
      message: 'Breaking news retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching breaking news:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching breaking news',
      error: error.message
    });
  }
});

// Web search endpoint
router.post('/web-search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // For now, return simulated search results
    // In production, you'd integrate with actual search APIs
    const searchResults = [
      {
        id: `search-${Date.now()}`,
        title: `Latest developments in ${query}`,
        content: `Search results for "${query}". This endpoint can be connected to real news APIs.`,
        source: 'WebSearch',
        published_at: new Date().toISOString(),
        category: 'search',
        network: query.toLowerCase().includes('bitcoin') ? 'Bitcoin' : 'General',
        relevance_score: 0.95,
        tags: [query.toLowerCase()]
      }
    ];

    res.json({
      success: true,
      data: searchResults,
      query: query,
      total: searchResults.length,
      message: 'Web search completed successfully'
    });

  } catch (error) {
    logger.error('Error performing web search:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing web search',
      error: error.message
    });
  }
});

// Create new article
router.post('/', async (req, res) => {
  try {
    const articleData = req.body;

    const { data, error } = await supabase
      .from('articles')
      .insert([{
        title: articleData.title,
        content: articleData.content,
        summary: articleData.summary,
        url: articleData.url,
        source: articleData.source,
        author: articleData.author,
        published_at: articleData.publishedAt || new Date().toISOString(),
        category: articleData.category || 'other',
        network: articleData.network,
        tags: articleData.tags || [],
        sentiment: articleData.sentiment || 'neutral',
        impact: articleData.impact || 'low',
        is_breaking: articleData.isBreaking || false,
        cover_image: articleData.coverImage,
        metadata: articleData.metadata || {}
      }])
      .select();

    if (error) {
      logger.error('Error creating article:', error);
      return res.status(400).json({
        success: false,
        message: 'Error creating article',
        error: error.message
      });
    }

    res.status(201).json({
      success: true,
      data: data[0],
      message: 'Article created successfully'
    });

  } catch (error) {
    logger.error('Error creating article:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;