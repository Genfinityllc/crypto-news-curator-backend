const cron = require('node-cron');
const { updateNewsScores, scrapeNewsSources, getBreakingNews } = require('./newsService');
const { getMarketData } = require('./cryptoService');
const articlePurgeService = require('./articlePurgeService');
const logger = require('../utils/logger');

// Official network sources for automated scraping
const NETWORKS_TO_SCRAPE = [
  'Hedera HBAR',
  'XDC Network', 
  'Constellation DAG',
  'Ethereum',
  'Bitcoin',
  'Solana',
  'BNB Chain',
  'XRP',
  'Cardano',
  'Avalanche',
  'Dogecoin',
  'TRON',
  'Polygon',
  'Chainlink',
  'Polkadot',
  'Cosmos',
  'Near Protocol',
  'Stellar',
  'Litecoin',
  'Aave',
  'Cronos',
  'Arbitrum',
  'Optimism',
  'Injective',
  'Celestia',
  'Sui',
  'Aptos',
  'Shardeum',
  'Immutable X',
  'The Sandbox',
  'Decentraland',
  'MakerDAO',
  'Uniswap',
  'Curve',
  'Fantom',
  'Algorand',
  'Axie Infinity',
  'The Graph',
  'Helium',
  'Filecoin',
  'Flow',
  'Theta Network',
  'BitTorrent',
  'Fetch.ai',
  'Monero',
  'Zcash',
  'VeChain',
  'Neo'
];

/**
 * Initialize all cron jobs
 */
function initializeCronJobs() {
  logger.info('Initializing cron jobs...');
  
  // Update news scores every hour
  cron.schedule('0 * * * *', async () => {
    logger.info('Running scheduled news score update...');
    try {
      await updateNewsScores();
      logger.info('News score update completed successfully');
    } catch (error) {
      logger.error('Error updating news scores:', error.message);
    }
  });
  
  // Scrape news from official sources every 4 hours
  cron.schedule('0 */4 * * *', async () => {
    logger.info('Running scheduled news scraping...');
    try {
      await scrapeAllNetworks();
      logger.info('News scraping completed successfully');
    } catch (error) {
      logger.error('Error scraping news:', error.message);
    }
  });

  // Populate database with real news every 10 minutes (optimized for steady accumulation)
  cron.schedule('*/10 * * * *', async () => {
    logger.info('Running scheduled database population...');
    try {
      const { fetchRealCryptoNews } = require('./newsService');
      const { insertArticlesBatch } = require('../config/supabase');
      
      logger.info('📰 Calling fetchRealCryptoNews...');
      const realNews = await fetchRealCryptoNews();
      logger.info(`📰 fetchRealCryptoNews returned ${realNews?.length || 0} articles`);
      
      if (realNews && realNews.length > 0) {
        logger.info('📥 Calling insertArticlesBatch...');
        const insertedArticles = await insertArticlesBatch(realNews);
        logger.info(`Database population completed: ${insertedArticles.length} articles inserted`);
        
        // Clear all caches after successful insertion to ensure fresh data is served
        if (insertedArticles.length > 0) {
          try {
            const simpleCache = require('./simpleCacheService');
            simpleCache.clear();
            logger.info('🗑️ Cleared all caches after database insertion');
          } catch (cacheError) {
            logger.warn('Warning: Could not clear cache after insertion:', cacheError.message);
          }
        }
      } else {
        logger.warn('⚠️ No articles returned from fetchRealCryptoNews');
      }
    } catch (error) {
      logger.error('Error populating database:', error.message);
      logger.error('Error stack:', error.stack);
    }
  });
  
  // Update market data every 15 minutes during market hours
  cron.schedule('*/15 9-17 * * 1-5', async () => {
    logger.info('Running scheduled market data update...');
    try {
      await updateMarketData();
      logger.info('Market data update completed successfully');
    } catch (error) {
      logger.error('Error updating market data:', error.message);
    }
  });
  
  // Clean up old articles weekly (keep articles older than 30 days)
  cron.schedule('0 2 * * 0', async () => {
    logger.info('Running scheduled cleanup of old articles...');
    try {
      await cleanupOldArticles();
      logger.info('Article cleanup completed successfully');
    } catch (error) {
      logger.error('Error cleaning up old articles:', error.message);
    }
  });
  
  // Generate breaking news alerts every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    logger.info('Checking for breaking news...');
    try {
      await checkBreakingNews();
      logger.info('Breaking news check completed successfully');
    } catch (error) {
      logger.error('Error checking breaking news:', error.message);
    }
  });
  
  // Update trending networks daily at midnight
  cron.schedule('0 0 * * *', async () => {
    logger.info('Updating trending networks...');
    try {
      await updateTrendingNetworks();
      logger.info('Trending networks update completed successfully');
    } catch (error) {
      logger.error('Error updating trending networks:', error.message);
    }
  });

  // Clear articles cache every 4 days at 3 AM
  cron.schedule('0 3 */4 * *', async () => {
    logger.info('Running scheduled 4-day cache clear...');
    try {
      const cacheService = require('./cacheService');
      const cleared = cacheService.clearArticlesCache();
      logger.info(`4-day cache clear completed successfully. Cleared ${cleared} entries.`);
    } catch (error) {
      logger.error('Error clearing articles cache:', error.message);
    }
  });

  // Daily article purge - remove articles older than 4 days and enforce limits
  cron.schedule('0 1 * * *', async () => {
    logger.info('🗑️ Running daily article purge...');
    try {
      const result = await articlePurgeService.purgeOldArticles();
      logger.info(`✅ Daily purge completed: ${result.purgedOld} old articles removed`);
    } catch (error) {
      logger.error('❌ Error during daily article purge:', error.message);
    }
  });
  
  // Preload cache on startup for immediate fast responses
  setTimeout(async () => {
    logger.info('Preloading cache for fast initial responses...');
    try {
      await articlesCacheService.preloadCache();
      logger.info('Cache preloaded successfully');
    } catch (error) {
      logger.error('Error preloading cache:', error.message);
    }
  }, 10000); // Wait 10 seconds after server starts
  
  logger.info('All cron jobs initialized successfully');
}

/**
 * Scrape news from all configured networks
 */
async function scrapeAllNetworks() {
  const results = [];
  
  for (const network of NETWORKS_TO_SCRAPE) {
    try {
      logger.info(`Scraping news for ${network}...`);
      
      // Get the first source for each network (you could expand this to scrape multiple sources)
      const sources = getNetworkSources(network);
      if (sources && sources.length > 0) {
        const scrapedArticles = await scrapeNewsSources(network, sources[0]);
        results.push({
          network,
          articlesScraped: scrapedArticles.length,
          success: true
        });
      }
      
      // Add delay between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      logger.error(`Error scraping news for ${network}:`, error.message);
      results.push({
        network,
        articlesScraped: 0,
        success: false,
        error: error.message
      });
    }
  }
  
  logger.info('Network scraping results:', results);
  return results;
}

/**
 * Update market data for all tracked cryptocurrencies
 */
async function updateMarketData() {
  try {
    // In production, you'd store this in a cache or database
    // For demo purposes, we'll just log the update
    logger.info('Market data update triggered');
    
    // You could implement real-time price updates here
    // const marketData = await getMarketData(100, 'USD');
    // await cacheMarketData(marketData);
    
  } catch (error) {
    logger.error('Error updating market data:', error.message);
  }
}

/**
 * Clean up old articles to maintain database performance
 */
async function cleanupOldArticles() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Mark old articles as inactive instead of deleting them
    // Note: This would need to be implemented with Supabase
    logger.info('Cleanup old articles - Supabase implementation needed');
    
  } catch (error) {
    logger.error('Error cleaning up old articles:', error.message);
  }
}

/**
 * Check for breaking news and send alerts
 */
async function checkBreakingNews() {
  try {
    const breakingNews = await getBreakingNews();
    
    if (breakingNews.length > 0) {
      logger.info(`Found ${breakingNews.length} breaking news articles`);
      
      // In production, you'd send notifications here:
      // - Email alerts
      // - Push notifications
      // - Slack/Discord webhooks
      // - SMS alerts
      
      // For demo purposes, just log the breaking news
      breakingNews.forEach(article => {
        logger.info(`BREAKING: ${article.title} - ${article.network}`);
      });
    }
    
  } catch (error) {
    logger.error('Error checking breaking news:', error.message);
  }
}

/**
 * Update trending networks based on various metrics
 */
async function updateTrendingNetworks() {
  try {
    // In production, you'd calculate trending based on:
    // - Price changes
    // - Social media mentions
    // - News volume
    // - Trading volume
    
    logger.info('Trending networks update completed');
    
  } catch (error) {
    logger.error('Error updating trending networks:', error.message);
  }
}

/**
 * Get network sources for a specific network
 */
function getNetworkSources(network) {
  const networkSources = {
    'Hedera HBAR': ['https://hedera.com/blog'],
    'XDC Network': ['https://medium.com/xdcnetwork'],
    'Constellation DAG': ['https://medium.com/constellationlabs'],
    'Ethereum': ['https://blog.ethereum.org'],
    'Bitcoin': ['https://bitcoincore.org/en/news/'],
    'Solana': ['https://solana.com/news'],
    'BNB Chain': ['https://bnbchain.org/en/blog'],
    'XRP': ['https://ripple.com/insights/'],
    'Cardano': ['https://cardano.org/blog/'],
    'Avalanche': ['https://avax.network/blog/'],
    'Dogecoin': ['https://dogecoin.com/blog/'],
    'TRON': ['https://tron.network/blog'],
    'Polygon': ['https://polygon.technology/blog/'],
    'Chainlink': ['https://blog.chain.link/'],
    'Polkadot': ['https://polkadot.network/blog/'],
    'Cosmos': ['https://blog.cosmos.network/'],
    'Near Protocol': ['https://near.org/blog/'],
    'Stellar': ['https://stellar.org/blog'],
    'Litecoin': ['https://litecoin.org/news'],
    'Aave': ['https://aave.com/blog/'],
    'Cronos': ['https://cronos.org/blog'],
    'Arbitrum': ['https://arbitrum.io/blog'],
    'Optimism': ['https://optimism.mirror.xyz'],
    'Injective': ['https://blog.injective.com/'],
    'Celestia': ['https://celestia.org/blog/'],
    'Sui': ['https://blog.sui.io/'],
    'Aptos': ['https://aptosfoundation.org/blog'],
    'Shardeum': ['https://shardeum.org/blog/'],
    'Immutable X': ['https://immutable.com/blog'],
    'The Sandbox': ['https://medium.com/sandbox-game'],
    'Decentraland': ['https://decentraland.org/blog'],
    'MakerDAO': ['https://blog.makerdao.com'],
    'Uniswap': ['https://uniswap.org/blog/'],
    'Curve': ['https://curve.fi/news'],
    'Fantom': ['https://fantom.foundation/blog/'],
    'Algorand': ['https://algorand.foundation/news'],
    'Axie Infinity': ['https://axie.substack.com'],
    'The Graph': ['https://thegraph.com/blog/'],
    'Helium': ['https://helium.com/blog/'],
    'Filecoin': ['https://filecoin.io/blog/'],
    'Flow': ['https://flowverse.co/news'],
    'Theta Network': ['https://medium.com/theta-network'],
    'BitTorrent': ['https://bittorrent.com/blog/'],
    'Fetch.ai': ['https://fetch.ai/blog/'],
    'Monero': ['https://getmonero.org/blog/'],
    'Zcash': ['https://z.cash/blog/'],
    'VeChain': ['https://vechain.org/blog/'],
    'Neo': ['https://medium.com/neo-smart-economy']
  };
  
  return networkSources[network] || [];
}

/**
 * Manually trigger a specific cron job (useful for testing)
 */
async function triggerJob(jobName) {
  logger.info(`Manually triggering job: ${jobName}`);
  
  try {
    switch (jobName) {
      case 'rssAggregation':
        const { fetchRealCryptoNews } = require('./newsService');
        const { insertArticlesBatch } = require('../config/supabase');
        const realNews = await fetchRealCryptoNews();
        const insertedArticles = await insertArticlesBatch(realNews);
        logger.info(`RSS aggregation completed: ${insertedArticles.length} articles inserted`);
        break;
      case 'updateScores':
        await updateNewsScores();
        break;
      case 'scrapeNews':
        await scrapeAllNetworks();
        break;
      case 'updateMarketData':
        await updateMarketData();
        break;
      case 'cleanup':
        await cleanupOldArticles();
        break;
      case 'breakingNews':
        await checkBreakingNews();
        break;
      case 'trending':
        await updateTrendingNetworks();
        break;
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
    
    logger.info(`Job ${jobName} completed successfully`);
    return { success: true, message: `Job ${jobName} completed successfully` };
    
  } catch (error) {
    logger.error(`Error executing job ${jobName}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get cron job status
 */
function getCronJobStatus() {
  return {
    jobs: [
      {
        name: 'rssAggregation',
        schedule: '*/2 * * * *',
        description: 'RSS aggregation and database population every 2 minutes',
        lastRun: new Date().toISOString()
      },
      {
        name: 'updateScores',
        schedule: '0 * * * *',
        description: 'Update news scores every hour',
        lastRun: new Date().toISOString()
      },
      {
        name: 'scrapeNews',
        schedule: '0 */4 * * *',
        description: 'Scrape news from official sources every 4 hours',
        lastRun: new Date().toISOString()
      },
      {
        name: 'updateMarketData',
        schedule: '*/15 9-17 * * 1-5',
        description: 'Update market data every 15 minutes during market hours',
        lastRun: new Date().toISOString()
      },
      {
        name: 'cleanup',
        schedule: '0 2 * * 0',
        description: 'Clean up old articles weekly',
        lastRun: new Date().toISOString()
      },
      {
        name: 'breakingNews',
        schedule: '*/30 * * * *',
        description: 'Check for breaking news every 30 minutes',
        lastRun: new Date().toISOString()
      },
      {
        name: 'trending',
        schedule: '0 0 * * *',
        description: 'Update trending networks daily',
        lastRun: new Date().toISOString()
      },
      {
        name: 'cacheClear',
        schedule: '0 3 */4 * *',
        description: 'Clear articles cache every 4 days',
        lastRun: new Date().toISOString()
      }
    ],
    status: 'running'
  };
}

module.exports = {
  initializeCronJobs,
  triggerJob,
  getCronJobStatus,
  scrapeAllNetworks,
  updateNewsScores,
  updateMarketData,
  cleanupOldArticles,
  checkBreakingNews,
  updateTrendingNetworks
};
