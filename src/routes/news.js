const express = require('express');
const router = express.Router();
const News = require('../models/News');
const { authMiddleware } = require('../middleware/auth');
const { scrapeNewsSources, performWebSearch, scrapePressReleases } = require('../services/newsService');
const { rewriteArticle, optimizeForSEO } = require('../services/aiService');
const { generateCoverImage } = require('../services/imageService');
const logger = require('../utils/logger');

// Get all news articles with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      network,
      category,
      sortBy = 'publishedAt',
      search,
      breaking = false
    } = req.query;

    const query = { isActive: true };
    
    // Filter by network
    if (network && network !== 'all') {
      query.network = network;
    }
    
    // Filter by category
    if (category && category !== 'all') {
      query.category = category;
    }
    
    // Filter breaking news
    if (breaking === 'true') {
      query.isBreaking = true;
    }
    
    // Search functionality
    if (search) {
      query.$text = { $search: search };
    }

    const skip = (page - 1) * limit;
    
    let sortOptions = {};
    switch (sortBy) {
      case 'score':
        sortOptions = { score: -1 };
        break;
      case 'date':
        sortOptions = { publishedAt: -1 };
        break;
      case 'engagement':
        sortOptions = { 'engagement.views': -1 };
        break;
      default:
        sortOptions = { publishedAt: -1 };
    }

    const articles = await News.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('curatedBy', 'username');

    const total = await News.countDocuments(query);

    res.json({
      success: true,
      data: articles,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error('Error fetching news:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching news articles'
    });
  }
});

// Get breaking news
router.get('/breaking', async (req, res) => {
  try {
    const breakingNews = await News.find({
      isActive: true,
      isBreaking: true
    })
    .sort({ publishedAt: -1 })
    .limit(10);

    res.json({
      success: true,
      data: breakingNews
    });
  } catch (error) {
    logger.error('Error fetching breaking news:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching breaking news'
    });
  }
});

// Get press releases
router.get('/press-releases', async (req, res) => {
  try {
    const pressReleases = await News.find({
      isActive: true,
      category: 'press-release'
    })
    .sort({ publishedAt: -1 })
    .limit(20);

    res.json({
      success: true,
      data: pressReleases
    });
  } catch (error) {
    logger.error('Error fetching press releases:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching press releases'
    });
  }
});

// Scrape news from official sources
router.post('/scrape', authMiddleware, async (req, res) => {
  try {
    const { network, source } = req.body;
    
    if (!network || !source) {
      return res.status(400).json({
        success: false,
        message: 'Network and source are required'
      });
    }

    const scrapedArticles = await scrapeNewsSources(network, source);
    
    res.json({
      success: true,
      message: `Successfully scraped ${scrapedArticles.length} articles from ${source}`,
      data: scrapedArticles
    });
  } catch (error) {
    logger.error('Error scraping news:', error);
    res.status(500).json({
      success: false,
      message: 'Error scraping news articles'
    });
  }
});

// Perform web search
router.post('/web-search', async (req, res) => {
  try {
    const { query, network } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const searchResults = await performWebSearch(query, network);
    
    res.json({
      success: true,
      data: searchResults
    });
  } catch (error) {
    logger.error('Error performing web search:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing web search'
    });
  }
});

// Scrape press releases for a specific network
router.post('/scrape-press-releases', authMiddleware, async (req, res) => {
  try {
    const { network } = req.body;
    
    if (!network) {
      return res.status(400).json({
        success: false,
        message: 'Network is required'
      });
    }

    const pressReleases = await scrapePressReleases(network);
    
    res.json({
      success: true,
      message: `Successfully scraped ${pressReleases.length} press releases for ${network}`,
      data: pressReleases
    });
  } catch (error) {
    logger.error('Error scraping press releases:', error);
    res.status(500).json({
      success: false,
      message: 'Error scraping press releases'
    });
  }
});

// AI rewrite article
router.post('/rewrite/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const article = await News.findById(id);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    const rewrittenContent = await rewriteArticle(article.content);
    
    article.rewrittenContent = rewrittenContent;
    article.lastRewritten = new Date();
    await article.save();

    res.json({
      success: true,
      data: article
    });
  } catch (error) {
    logger.error('Error rewriting article:', error);
    res.status(500).json({
      success: false,
      message: 'Error rewriting article'
    });
  }
});

// SEO optimize article
router.post('/seo-optimize/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const article = await News.findById(id);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    const seoOptimized = await optimizeForSEO(article);
    
    article.seoMetrics = seoOptimized;
    article.lastOptimized = new Date();
    await article.save();

    res.json({
      success: true,
      data: article
    });
  } catch (error) {
    logger.error('Error optimizing article for SEO:', error);
    res.status(500).json({
      success: false,
      message: 'Error optimizing article for SEO'
    });
  }
});

// Generate cover image for article
router.post('/generate-cover/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const article = await News.findById(id);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    const coverImageUrl = await generateCoverImage(article);
    
    article.coverImage = coverImageUrl;
    await article.save();

    res.json({
      success: true,
      data: { coverImage: coverImageUrl }
    });
  } catch (error) {
    logger.error('Error generating cover image:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating cover image'
    });
  }
});

// Get top networks by activity
router.get('/top-networks', async (req, res) => {
  try {
    const topNetworks = await News.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$network',
          articleCount: { $sum: 1 },
          totalViews: { $sum: '$engagement.views' },
          avgScore: { $avg: '$score' }
        }
      },
      { $sort: { articleCount: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: topNetworks
    });
  } catch (error) {
    logger.error('Error fetching top networks:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching top networks'
    });
  }
});

// Get article by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const article = await News.findById(id)
      .populate('curatedBy', 'username');

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    // Increment view count
    article.engagement.views += 1;
    await article.save();

    res.json({
      success: true,
      data: article
    });
  } catch (error) {
    logger.error('Error fetching article:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching article'
    });
  }
});

// Update article engagement
router.patch('/:id/engagement', async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body; // likes, shares, comments
    
    const article = await News.findById(id);
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    if (article.engagement[type] !== undefined) {
      article.engagement[type] += 1;
      await article.save();
    }

    res.json({
      success: true,
      data: article.engagement
    });
  } catch (error) {
    logger.error('Error updating engagement:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating engagement'
    });
  }
});

module.exports = router;
