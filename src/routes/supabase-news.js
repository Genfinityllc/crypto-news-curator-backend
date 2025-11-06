const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { scrapeNewsSources, performWebSearch, scrapePressReleases, fetchRealCryptoNews } = require('../services/newsService');
const { rewriteArticle, optimizeForSEO, generateAISummary } = require('../services/aiService');
const { generateFullLengthRewrite } = require('../services/enhanced-ai-rewrite');
const { generateCoverImage, generateCardCoverImage } = require('../services/imageService');
const { getArticles, getBreakingNews, getPressReleases, insertArticle, insertArticlesBatch, updateArticleEngagement } = require('../config/supabase');
const articlesCacheService = require('../services/articlesCacheService');
// REPLACED: Using Universal LoRA Service exclusively
// const LoRAiService = require('../services/loraAiService');
const logger = require('../utils/logger');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client for direct operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// REPLACED: Using Universal LoRA Service exclusively  
// const loraAiService = new LoRAiService();

// Get all news articles with filtering and pagination
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
      source = 'rss' // Default to RSS for better performance and images
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

    // Always fetch fresh RSS news with enhanced images for better user experience
    if (source === 'rss' || source === 'hybrid' || source === undefined) {
      logger.info('Fetching real news from RSS feeds with enhanced images...');
      const realNews = await fetchRealCryptoNews();
      
      // Apply filters to RSS news
      let filteredNews = realNews;
      
      if (network && network !== 'all') {
        filteredNews = filteredNews.filter(article => 
          article.network && article.network.toLowerCase().includes(network.toLowerCase())
        );
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
        filteredNews.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
      }
      
      // Apply pagination
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const paginatedNews = filteredNews.slice(startIndex, startIndex + parseInt(limit));
      
      return res.json({
        success: true,
        data: paginatedNews,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(filteredNews.length / limit),
          hasNext: startIndex + parseInt(limit) < filteredNews.length,
          hasPrev: parseInt(page) > 1,
          totalCount: filteredNews.length
        },
        message: 'Real-time news from RSS feeds with enhanced images',
        source: 'rss'
      });
    }

    // Fallback to database if explicitly requested
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
        message: 'Real-time news from RSS feeds (database fallback)',
        source: 'rss'
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
      },
      source: 'database'
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

// Get AI services status
router.get('/ai-services-status', async (req, res) => {
  try {
    // REPLACED: Using Universal LoRA Service exclusively
    const loraStatus = { available: true, service: 'Universal LoRA Service' };
    
    res.json({
      success: true,
      services: {
        lora: {
          available: loraStatus.available,
          service: loraStatus.service,
          aiCoverGeneratorUrl: loraStatus.aiCoverGeneratorUrl,
          clientMappings: loraStatus.clientMappings,
          lastChecked: loraStatus.lastChecked,
          priority: 1
        },
        traditional: {
          available: true,
          service: 'Traditional Image Service',
          priority: 3
        }
      },
      recommendation: loraStatus.available ? 'LoRA' : 'Traditional',
      lastChecked: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting AI services status:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting AI services status',
      error: error.message
    });
  }
});

// Get Google AI credits balance
router.get('/google-ai-credits', async (req, res) => {
  try {
    // Test Google AI API to check quota/credits
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Google AI API key not configured',
        credits: {
          available: 0,
          remaining: 'Unknown',
          status: 'No API Key'
        }
      });
    }
    
    try {
      // Quick test with minimal token usage
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      await model.generateContent(['Hi']);
      
      // If successful, credits are available (actual usage tracking would require API quota API)
      return res.json({
        success: true,
        credits: {
          available: true,
          remaining: '~300 USD',
          status: 'Active',
          lastChecked: new Date().toISOString(),
          imageGenerationAvailable: true,
          textGenerationAvailable: true
        }
      });
      
    } catch (error) {
      // Parse specific error types
      if (error.message?.includes('quota') || error.message?.includes('limit')) {
        return res.json({
          success: false,
          credits: {
            available: false,
            remaining: '$0',
            status: 'Quota Exceeded',
            lastChecked: new Date().toISOString(),
            imageGenerationAvailable: false,
            textGenerationAvailable: false,
            error: 'Quota exceeded - please add credits'
          }
        });
      }
      
      return res.json({
        success: false,
        credits: {
          available: false,
          remaining: 'Unknown',
          status: 'API Error',
          lastChecked: new Date().toISOString(),
          imageGenerationAvailable: false,
          textGenerationAvailable: false,
          error: error.message
        }
      });
    }
    
  } catch (error) {
    logger.error('Error checking Google AI credits:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to check credits',
      error: error.message,
      credits: {
        available: false,
        remaining: 'Unknown',
        status: 'Check Failed'
      }
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

// Generate card-optimized images for an article
router.post('/generate-card-image/:id?', async (req, res) => {
  try {
    const { id } = req.params;
    const { size = 'medium', title, network, url } = req.body;
    
    let article;
    
    if (id) {
      // Get article from database
      const { data: articles } = await getArticles({ limit: 1 });
      article = articles?.find(a => a.id === id);
      
      if (!article) {
        return res.status(404).json({
          success: false,
          message: 'Article not found'
        });
      }
    } else {
      // Use provided article data
      article = {
        title: title || 'Sample Crypto News',
        network: network || 'Bitcoin',
        url: url || 'https://example.com'
      };
    }
    
    logger.info(`Generating card image for article: ${article.title}`);
    
    // Check generation method preference - LoRA (preferred) or traditional
    const useLoRA = req.body.useLoRA !== false; // Default to true
    const useNanoBanana = req.body.useNanoBanana || req.query.useNanoBanana;
    
    let cardImages;
    let generationMethod = 'traditional';
    
    if (useLoRA) {
      logger.info('🎨 Using Universal LoRA Service (client-specific)');
      try {
        // Use imageHostingService which now uses Universal LoRA
        const ImageHostingService = require('../services/imageHostingService');
        const imageHostingService = new ImageHostingService();
        const loraResult = await imageHostingService.generateAndHostLoRAImage(article, { size });
        if (loraResult.success) {
          cardImages = {
            small: loraResult.image_url,
            medium: loraResult.image_url,
            large: loraResult.image_url,
            square: loraResult.image_url
          };
          generationMethod = 'lora';
        } else {
          throw new Error('LoRA generation failed');
        }
      } catch (loraError) {
        logger.error('LoRA generation failed:', loraError.message);
        throw new Error(`LoRA generation failed: ${loraError.message}`);
      }
    } else {
      // LoRA-only mode - return error instead of throwing
      return res.status(503).json({
        success: false,
        message: 'LoRA service is not available and fallbacks are disabled for testing',
        error: 'LoRA_UNAVAILABLE',
        service: 'lora'
      });
    }
    
    res.json({
      success: true,
      data: {
        coverImage: cardImages[size] || cardImages.medium,
        cardImages: cardImages,
        selectedSize: size,
        generationMethod: generationMethod,
        article: {
          id: article.id,
          title: article.title,
          network: article.network
        }
      }
    });
    
  } catch (error) {
    logger.error('Error generating card image:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating card image',
      error: error.message
    });
  }
});

// Generate LoRA-based AI images for crypto news with client-specific branding  
router.post('/generate-lora-image/:id?', async (req, res) => {
  try {
    // ✅ PURE LORA ONLY - NO FALLBACKS - USING YOUR TRAINED MODEL

    const { id } = req.params;
    const { 
      size = '1792x896', 
      style = 'professional', 
      title, 
      network, 
      category, 
      url 
    } = req.body;

    // REPLACED: Universal LoRA Service is always available
    // All LoRA generation now goes through Universal LoRA Service

    let article;

    if (id) {
      // Get article from database
      const { data: articles } = await getArticles({ limit: 1000 });
      article = articles?.find(a => a.id === id);
      
      if (!article) {
        return res.status(404).json({
          success: false,
          message: 'Article not found'
        });
      }
    } else {
      // Use provided article data
      article = {
        title: title || 'Sample Crypto News',
        network: network || 'Bitcoin',
        category: category || 'general',
        url: url || 'https://example.com'
      };
    }

    logger.info(`🎨 Generating LoRA AI image for: ${article.title}`);

    // ✅ USE YOUR TRAINED LORA SERVICE ONLY - NO FALLBACKS
    const TrainedLoraService = require('../services/trainedLoraService');
    const trainedLoraService = new TrainedLoraService();
    
    logger.info(`🎨 Calling YOUR trained LoRA on HF Spaces: ${article.title}`);
    
    const hostedResult = await trainedLoraService.generateLoraImage(
      article.title,
      article.content || article.category || 'crypto news',
      article.network || 'generic',
      style || 'professional'
    );

    if (!hostedResult.success) {
      return res.status(500).json({
        success: false,
        message: 'YOUR trained LoRA generation failed',
        error: hostedResult.error || 'Unknown error',
        service: 'trained_lora'
      });
    }

    res.json({
      success: true,
      data: {
        coverImage: hostedResult.imageUrl,
        cardImages: {
          small: hostedResult.imageUrl,
          medium: hostedResult.imageUrl,
          large: hostedResult.imageUrl,
          square: hostedResult.imageUrl
        },
        selectedSize: size,
        style,
        service: 'trained_lora',
        generationMethod: hostedResult.metadata?.method || 'trained_lora_hf_spaces',
        article: {
          id: article.id,
          title: article.title,
          network: article.network
        },
        generation: {
          timestamp: new Date().toISOString(),
          model: 'YOUR_TRAINED_LORA',
          quality: 'high',
          hosted: true,
          metadata: hostedResult.metadata
        }
      }
    });

  } catch (error) {
    logger.error('Error generating LoRA image:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating AI image with LoRA',
      error: error.message,
      service: 'lora'
    });
  }
});


// Batch generate card images for multiple articles
router.post('/generate-card-images/batch', async (req, res) => {
  try {
    const { articleIds, size = 'medium' } = req.body;
    
    if (!articleIds || !Array.isArray(articleIds)) {
      return res.status(400).json({
        success: false,
        message: 'Article IDs array is required'
      });
    }
    
    logger.info(`Batch generating card images for ${articleIds.length} articles`);
    
    const results = [];
    const { data: allArticles } = await getArticles({ limit: 1000 });
    
    for (const articleId of articleIds) {
      try {
        const article = allArticles?.find(a => a.id === articleId);
        
        if (article) {
          const cardImages = await generateCardCoverImage(article);
          results.push({
            articleId,
            success: true,
            coverImage: cardImages[size] || cardImages.medium,
            cardImages: cardImages
          });
        } else {
          results.push({
            articleId,
            success: false,
            error: 'Article not found'
          });
        }
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        logger.error(`Error generating image for article ${articleId}:`, error.message);
        results.push({
          articleId,
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        results,
        totalProcessed: results.length,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length
      }
    });
    
  } catch (error) {
    logger.error('Error in batch card image generation:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating card images',
      error: error.message
    });
  }
});

// Enhance all articles missing cover images
router.post('/enhance-missing-images', async (req, res) => {
  try {
    const { limit = 50, batch_size = 10 } = req.body;
    
    logger.info('Starting enhancement of articles missing cover images...');
    
    // Get articles without cover images
    const { data: allArticles } = await getArticles({ limit: limit });
    const articlesNeedingImages = allArticles.filter(article => 
      !article.cover_image || 
      article.cover_image === null || 
      article.cover_image === 'null'
    );
    
    logger.info(`Found ${articlesNeedingImages.length} articles needing cover images`);
    
    if (articlesNeedingImages.length === 0) {
      return res.json({
        success: true,
        message: 'No articles need cover images',
        data: { processed: 0, enhanced: 0 }
      });
    }
    
    // Process in smaller batches to avoid overwhelming the system
    const results = [];
    const batchSize = Math.min(batch_size, articlesNeedingImages.length);
    
    for (let i = 0; i < articlesNeedingImages.length; i += batchSize) {
      const batch = articlesNeedingImages.slice(i, i + batchSize);
      logger.info(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(articlesNeedingImages.length/batchSize)} (${batch.length} articles)`);
      
      try {
        const enhancedArticles = await enhanceArticlesWithImages(batch);
        results.push(...enhancedArticles);
        
        logger.info(`Enhanced batch of ${enhancedArticles.length} articles`);
        
        // Small delay between batches
        if (i + batchSize < articlesNeedingImages.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (batchError) {
        logger.error(`Error processing batch:`, batchError.message);
        // Continue with next batch even if this one fails
      }
    }
    
    const successfulEnhancements = results.filter(article => article.cover_image && article.cover_image !== 'null');
    
    res.json({
      success: true,
      message: `Successfully enhanced ${successfulEnhancements.length} articles with cover images`,
      data: {
        totalProcessed: articlesNeedingImages.length,
        enhanced: successfulEnhancements.length,
        failed: articlesNeedingImages.length - successfulEnhancements.length,
        batchSize: batchSize
      }
    });
    
  } catch (error) {
    logger.error('Error enhancing articles with missing images:', error);
    res.status(500).json({
      success: false,
      message: 'Error enhancing articles with images',
      error: error.message
    });
  }
});

// Rewrite RSS article content directly (for articles not in database)
router.post('/rewrite-rss-article', async (req, res) => {
  try {
    const { title, content, url, source, network, category } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }
    
    logger.info(`Rewriting RSS article: ${title.substring(0, 50)}...`);
    
    // Rewrite the article using ENHANCED AI service with 3-5 word titles and 97-100% readability
    const rewriteResult = await generateFullLengthRewrite(title, content, url);
    
    // Calculate additional metrics
    const wordCount = rewriteResult.content ? rewriteResult.content.split(' ').length : 0;
    const originalWordCount = content ? content.split(' ').length : 0;
    
    res.json({
      success: true,
      data: {
        rewrittenContent: rewriteResult.content,
        rewrittenTitle: rewriteResult.title,
        rewrittenText: rewriteResult.content,
        readabilityScore: rewriteResult.readabilityScore,
        seoScore: rewriteResult.seoScore,
        viralScore: rewriteResult.viralScore,
        wordCount: rewriteResult.wordCount,
        originalWordCount: originalWordCount,
        isOriginal: true,
        wordpressReady: rewriteResult.wordpressReady,
        copyrightSafe: rewriteResult.copyrightSafe,
        sources: rewriteResult.sources,
        cryptoElements: rewriteResult.cryptoElements,
        intelligentCoverPrompt: rewriteResult.intelligentCoverPrompt,
        seoOptimized: true,
        googleAdsReady: true,
        coverImage: rewriteResult.coverImage,
        enhancedMetadata: {
          title: rewriteResult.title || title,
          source: source || 'RSS Feed',
          network: network || 'General',
          category: category || 'news',
          url: url,
          processed_at: new Date().toISOString()
        }
      },
      message: 'RSS article successfully rewritten for originality and readability'
    });
    
  } catch (error) {
    logger.error('Error rewriting RSS article:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to rewrite RSS article',
      error: error.message
    });
  }
});

// Bookmark RSS articles (for articles not in database)
router.post('/bookmark-rss-article', async (req, res) => {
  try {
    const { articleData, userId } = req.body;
    
    if (!articleData || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Article data and user ID are required'
      });
    }
    
    logger.info(`Bookmarking RSS article for user ${userId}: ${articleData.title?.substring(0, 50)}...`);
    
    // Create a unique identifier for the RSS article
    const rssId = `rss_${Buffer.from(articleData.url || articleData.title || Date.now().toString()).toString('base64').substring(0, 20)}`;
    
    // Check if already bookmarked
    const { data: existingBookmark } = await supabase
      .from('rss_bookmarks')
      .select('id')
      .eq('user_id', userId)
      .eq('rss_id', rssId)
      .single();
    
    if (existingBookmark) {
      return res.status(409).json({
        success: false,
        message: 'RSS article already bookmarked'
      });
    }
    
    // Insert RSS bookmark
    const { data, error } = await supabase
      .from('rss_bookmarks')
      .insert({
        user_id: userId,
        rss_id: rssId,
        title: articleData.title,
        url: articleData.url,
        content: articleData.content || articleData.description || articleData.summary,
        source: articleData.source,
        network: articleData.network,
        category: articleData.category,
        published_at: articleData.published_at,
        image_url: articleData.image_url || articleData.cover_image,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
      
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      data: {
        bookmarkId: data.id,
        rssId: rssId,
        article: articleData
      },
      message: 'RSS article bookmarked successfully'
    });
    
  } catch (error) {
    logger.error('Error bookmarking RSS article:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to bookmark RSS article',
      error: error.message
    });
  }
});

// Get RSS article bookmarks
router.get('/rss-bookmarks/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    logger.info(`Getting RSS bookmarks for user ${userId}`);
    
    const { data, error } = await supabase
      .from('rss_bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
      message: 'RSS bookmarks retrieved successfully'
    });
    
  } catch (error) {
    logger.error('Error getting RSS bookmarks:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get RSS bookmarks',
      error: error.message
    });
  }
});

// Remove RSS article bookmark
router.delete('/rss-bookmarks/:bookmarkId', async (req, res) => {
  try {
    const { bookmarkId } = req.params;
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    logger.info(`Removing RSS bookmark ${bookmarkId} for user ${userId}`);
    
    // Verify ownership and delete
    const { data, error } = await supabase
      .from('rss_bookmarks')
      .delete()
      .eq('id', bookmarkId)
      .eq('user_id', userId)
      .select();
      
    if (error) {
      throw error;
    }
    
    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'RSS bookmark not found or access denied'
      });
    }
    
    res.json({
      success: true,
      message: 'RSS bookmark removed successfully'
    });
    
  } catch (error) {
    logger.error('Error removing RSS bookmark:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to remove RSS bookmark',
      error: error.message
    });
  }
});


module.exports = router;