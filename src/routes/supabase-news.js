const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { scrapeNewsSources, performWebSearch, scrapePressReleases, fetchRealCryptoNews } = require('../services/newsService');
const { rewriteArticle, optimizeForSEO, generateAISummary } = require('../services/aiService');
const { generateCoverImage } = require('../services/imageService');
const { getArticles, getBreakingNews, getPressReleases, insertArticle, insertArticlesBatch, updateArticleEngagement } = require('../config/supabase');
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

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      network,
      category,
      sortBy,
      search,
      isBreaking: breaking === 'true'
    };

    const { data: articles, count } = await getArticles(options);

    // If no articles in database, fetch real news from RSS feeds
    if (!articles || articles.length === 0) {
      logger.info('No articles in database, fetching real news from RSS feeds...');
      const realNews = await fetchRealCryptoNews();
      
      // Return real news directly to frontend
      return res.json({
        success: true,
        data: realNews.slice(0, parseInt(limit)),
        pagination: {
          current: parseInt(page),
          total: Math.ceil(realNews.length / limit),
          hasNext: page * limit < realNews.length,
          hasPrev: page > 1,
          totalCount: realNews.length
        },
        message: 'Real-time news from RSS feeds'
      });
    }

    res.json({
      success: true,
      data: articles,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(count / limit),
        hasNext: page * limit < count,
        hasPrev: page > 1,
        totalCount: count
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
    const breakingNews = await getBreakingNews();

    // If no breaking news in database, fetch real breaking news from RSS feeds
    if (!breakingNews || breakingNews.length === 0) {
      logger.info('No breaking news in database, fetching real breaking news from RSS feeds...');
      const realNews = await fetchRealCryptoNews();
      const realBreakingNews = realNews.filter(article => article.is_breaking === true);
      
      return res.json({
        success: true,
        data: realBreakingNews.slice(0, 10),
        message: 'Real-time breaking news from RSS feeds'
      });
    }

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
    const pressReleases = await getPressReleases();

    // If no press releases in database, fetch real press releases from RSS feeds
    if (!pressReleases || pressReleases.length === 0) {
      logger.info('No press releases in database, fetching real press releases from RSS feeds...');
      const realNews = await fetchRealCryptoNews();
      const realPressReleases = realNews.filter(article => article.category === 'press-release');
      
      return res.json({
        success: true,
        data: realPressReleases.slice(0, 20),
        message: 'Real-time press releases from RSS feeds'
      });
    }

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

// Fetch real crypto news from RSS feeds (public for testing)
router.post('/fetch-real-news', async (req, res) => {
  try {
    logger.info('Fetching real crypto news from RSS feeds...');
    
    const realNews = await fetchRealCryptoNews();
    
    // Insert articles into Supabase using batch insertion
    const insertedArticles = await insertArticlesBatch(realNews);
    
    res.json({
      success: true,
      message: `Successfully fetched and inserted ${insertedArticles.length} articles from RSS feeds`,
      data: {
        totalFetched: realNews.length,
        inserted: insertedArticles.length,
        articles: insertedArticles.slice(0, 10) // Return first 10 for preview
      }
    });
  } catch (error) {
    logger.error('Error fetching real news:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching real news articles'
    });
  }
});

// Populate database with real news (simple endpoint)
router.post('/populate-database', async (req, res) => {
  try {
    logger.info('Populating database with real news from RSS feeds...');
    
    const realNews = await fetchRealCryptoNews();
    
    // Insert articles into Supabase using batch insertion
    const insertedArticles = await insertArticlesBatch(realNews);
    
    res.json({
      success: true,
      message: `Database populated with ${insertedArticles.length} articles`,
      data: {
        totalFetched: realNews.length,
        inserted: insertedArticles.length
      }
    });
  } catch (error) {
    logger.error('Error populating database:', error);
    res.status(500).json({
      success: false,
      message: 'Error populating database'
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
    
    // Insert into Supabase
    const insertedArticles = [];
    for (const article of scrapedArticles) {
      try {
        const inserted = await insertArticle(article);
        if (inserted) {
          insertedArticles.push(inserted);
        }
      } catch (error) {
        logger.warn(`Error inserting scraped article:`, error.message);
      }
    }
    
    res.json({
      success: true,
      message: `Successfully scraped ${insertedArticles.length} articles from ${source}`,
      data: insertedArticles
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
    
    // Insert search results into Supabase
    const insertedResults = [];
    for (const result of searchResults) {
      try {
        const inserted = await insertArticle(result);
        if (inserted) {
          insertedResults.push(inserted);
        }
      } catch (error) {
        logger.warn(`Error inserting search result:`, error.message);
      }
    }
    
    res.json({
      success: true,
      data: insertedResults
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
    
    // Insert into Supabase
    const insertedPressReleases = [];
    for (const pressRelease of pressReleases) {
      try {
        const inserted = await insertArticle(pressRelease);
        if (inserted) {
          insertedPressReleases.push(inserted);
        }
      } catch (error) {
        logger.warn(`Error inserting press release:`, error.message);
      }
    }
    
    res.json({
      success: true,
      message: `Successfully scraped ${insertedPressReleases.length} press releases for ${network}`,
      data: insertedPressReleases
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
    
    // Get article from Supabase
    const { data: articles } = await getArticles({ id });
    const article = articles[0];
    
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    const rewrittenContent = await rewriteArticle(article.content);
    
    // Update article in Supabase
    const { getSupabaseClient } = require('../config/supabase');
    const client = getSupabaseClient();
    
    if (client) {
      const { error } = await client
        .from('articles')
        .update({
          rewritten_content: rewrittenContent,
          last_rewritten: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        logger.error('Error updating article:', error.message);
      }
    }

    res.json({
      success: true,
      data: { ...article, rewritten_content: rewrittenContent }
    });
  } catch (error) {
    logger.error('Error rewriting article:', error);
    res.status(500).json({
      success: false,
      message: 'Error rewriting article'
    });
  }
});

// Generate AI summary for article
router.post('/summarize/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get article from Supabase
    const { data: articles } = await getArticles({ id });
    const article = articles[0];
    
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }
    
    // Generate AI summary
    const aiSummary = await generateAISummary(article.title, article.content);
    
    // Update article in Supabase
    const { getSupabaseClient } = require('../config/supabase');
    const client = getSupabaseClient();
    
    if (client) {
      const { error } = await client
        .from('articles')
        .update({
          ai_summary: aiSummary,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
        
      if (error) {
        logger.error('Error updating article summary:', error.message);
      }
    }
    
    res.json({
      success: true,
      data: { ...article, summary: aiSummary }
    });
    
  } catch (error) {
    logger.error('Error generating AI summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating AI summary'
    });
  }
});

// SEO optimize article
router.post('/seo-optimize/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get article from Supabase
    const { data: articles } = await getArticles({ id });
    const article = articles[0];
    
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    const seoOptimized = await optimizeForSEO(article);
    
    // Update article in Supabase
    const { getSupabaseClient } = require('../config/supabase');
    const client = getSupabaseClient();
    
    if (client) {
      const { error } = await client
        .from('articles')
        .update({
          seo_metrics: seoOptimized,
          last_optimized: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        logger.error('Error updating article:', error.message);
      }
    }

    res.json({
      success: true,
      data: { ...article, seo_metrics: seoOptimized }
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
    
    // Get article from Supabase
    const { data: articles } = await getArticles({ id });
    const article = articles[0];
    
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    const coverImageUrl = await generateCoverImage(article);
    
    // Update article in Supabase
    const { getSupabaseClient } = require('../config/supabase');
    const client = getSupabaseClient();
    
    if (client) {
      const { error } = await client
        .from('articles')
        .update({
          cover_image: coverImageUrl
        })
        .eq('id', id);

      if (error) {
        logger.error('Error updating article:', error.message);
      }
    }

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

// Generate card-optimized cover image for article
router.post('/generate-card-cover/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { size = 'medium' } = req.body; // small, medium, large, square
    
    // Get article from Supabase
    const { data: articles } = await getArticles({ id });
    const article = articles[0];
    
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    const { generateCardCoverImage } = require('../services/imageService');
    const cardImages = await generateCardCoverImage(article);
    const selectedImage = cardImages[size] || cardImages.medium;
    
    // Update article in Supabase
    const { getSupabaseClient } = require('../config/supabase');
    const client = getSupabaseClient();
    
    if (client) {
      const { error } = await client
        .from('articles')
        .update({
          cover_image: selectedImage,
          card_cover_images: cardImages // Store all sizes
        })
        .eq('id', id);

      if (error) {
        logger.error('Error updating article:', error.message);
      }
    }

    res.json({
      success: true,
      data: { 
        coverImage: selectedImage,
        cardImages,
        selectedSize: size
      }
    });
  } catch (error) {
    logger.error('Error generating card cover image:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating card cover image'
    });
  }
});

// Generate card-optimized cover image for any article (no database required)
router.post('/generate-card-image', async (req, res) => {
  try {
    const { title, network, size = 'medium' } = req.body;
    
    if (!title || !network) {
      return res.status(400).json({
        success: false,
        message: 'Title and network are required'
      });
    }

    // Create a mock article object
    const mockArticle = {
      title: title,
      network: network,
      category: 'general'
    };

    const { generateCardCoverImage } = require('../services/imageService');
    const cardImages = await generateCardCoverImage(mockArticle);
    const selectedImage = cardImages[size] || cardImages.medium;

    res.json({
      success: true,
      data: { 
        coverImage: selectedImage,
        cardImages,
        selectedSize: size,
        title: title,
        network: network
      }
    });
  } catch (error) {
    logger.error('Error generating card image:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating card image'
    });
  }
});

// Get top networks by activity
router.get('/top-networks', async (req, res) => {
  try {
    const { getSupabaseClient } = require('../config/supabase');
    const client = getSupabaseClient();
    
    if (!client) {
      // Return mock data if Supabase not available
      const mockTopNetworks = [
        { network: 'Hedera HBAR', article_count: 23, market_cap: 2800000000, change: 5.2 },
        { network: 'XDC Network', article_count: 18, market_cap: 687000000, change: 12.8 },
        { network: 'Constellation DAG', article_count: 15, market_cap: 234000000, change: 8.1 },
        { network: 'Ethereum', article_count: 34, market_cap: 291000000000, change: 2.4 },
        { network: 'Solana', article_count: 28, market_cap: 41000000000, change: 7.3 }
      ];
      
      return res.json({
        success: true,
        data: mockTopNetworks
      });
    }

    const { data, error } = await client
      .from('articles')
      .select('network')
      .not('network', 'is', null);

    if (error) {
      logger.error('Error fetching top networks:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Error fetching top networks'
      });
    }

    // Count articles per network
    const networkCounts = {};
    data.forEach(article => {
      if (article.network) {
        networkCounts[article.network] = (networkCounts[article.network] || 0) + 1;
      }
    });

    const topNetworks = Object.entries(networkCounts)
      .map(([network, count]) => ({
        network,
        article_count: count,
        market_cap: Math.random() * 1000000000000 + 1000000000, // Mock data
        change: (Math.random() - 0.5) * 20
      }))
      .sort((a, b) => b.article_count - a.article_count)
      .slice(0, 10);

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
    
    const { data: articles } = await getArticles({ id });
    const article = articles[0];

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    // Increment view count
    await updateArticleEngagement(id, 'view');

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
    
    const success = await updateArticleEngagement(id, type);

    if (!success) {
      return res.status(500).json({
        success: false,
        message: 'Error updating engagement'
      });
    }

    res.json({
      success: true,
      message: 'Engagement updated successfully'
    });
  } catch (error) {
    logger.error('Error updating engagement:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating engagement'
    });
  }
});

// Test endpoint for AI summarization
router.post('/test-ai-summary', async (req, res) => {
  try {
    const testArticle = {
      title: 'Bitcoin Reaches New All-Time High',
      content: 'Bitcoin has surged to a new all-time high of $67,000, driven by increased institutional adoption and positive regulatory developments. Major companies are now adding Bitcoin to their balance sheets, signaling growing confidence in the cryptocurrency as a store of value. This milestone comes amid broader market optimism about the future of digital assets.',
      url: `https://test.com/${Date.now()}`,
      source: 'Test Source',
      network: 'Bitcoin',
      category: 'market',
      published_at: new Date().toISOString(),
      is_breaking: true
    };

    const insertedArticle = await insertArticle(testArticle);
    
    if (insertedArticle) {
      res.json({
        success: true,
        message: 'Test article created with AI summary',
        data: insertedArticle
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to create test article'
      });
    }
    
  } catch (error) {
    logger.error('Error creating test article:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating test article'
    });
  }
});

module.exports = router;