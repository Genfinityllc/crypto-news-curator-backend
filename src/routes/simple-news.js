const express = require('express');
const router = express.Router();

// Sample news data for demo
const sampleNews = [
  {
    id: 1,
    title: "Bitcoin Reaches New All-Time High",
    content: "Bitcoin surged to unprecedented levels today as institutional adoption continues to grow.",
    source: "CryptoNews",
    publishedAt: new Date().toISOString(),
    category: "market",
    network: "Bitcoin",
    isBreaking: true
  },
  {
    id: 2,
    title: "Ethereum 2.0 Upgrade Shows Promise",
    content: "The latest Ethereum upgrade demonstrates significant improvements in transaction speed and energy efficiency.",
    source: "BlockchainToday",
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    category: "technology",
    network: "Ethereum",
    isBreaking: false
  },
  {
    id: 3,
    title: "DeFi Market Expands Rapidly",
    content: "Decentralized Finance protocols continue to attract billions in total value locked.",
    source: "DeFiPulse",
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
    category: "analysis",
    network: "Multi-chain",
    isBreaking: false
  }
];

// Get all news articles
router.get('/', async (req, res) => {
  try {
    const { category, network, breaking } = req.query;
    
    let filteredNews = [...sampleNews];
    
    // Apply filters
    if (category && category !== 'all') {
      filteredNews = filteredNews.filter(article => article.category === category);
    }
    
    if (network && network !== 'all') {
      filteredNews = filteredNews.filter(article => article.network === network);
    }
    
    if (breaking === 'true') {
      filteredNews = filteredNews.filter(article => article.isBreaking === true);
    }
    
    res.json({
      success: true,
      data: filteredNews,
      total: filteredNews.length,
      message: 'News articles retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching news articles',
      error: error.message
    });
  }
});

// Get breaking news
router.get('/breaking', async (req, res) => {
  try {
    const breakingNews = sampleNews.filter(article => article.isBreaking === true);
    
    res.json({
      success: true,
      data: breakingNews,
      total: breakingNews.length,
      message: 'Breaking news retrieved successfully'
    });
  } catch (error) {
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
    
    // Simulate search results
    const searchResults = [
      {
        id: Date.now(),
        title: `Latest news about ${query}`,
        content: `Search results for "${query}" - This is a demo response.`,
        source: "WebSearch",
        publishedAt: new Date().toISOString(),
        category: "search",
        network: query.includes('Bitcoin') ? 'Bitcoin' : 'General',
        relevanceScore: 0.95
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
    res.status(500).json({
      success: false,
      message: 'Error performing web search',
      error: error.message
    });
  }
});

module.exports = router;