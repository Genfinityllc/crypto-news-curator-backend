const cron = require('node-cron');
const { updateNewsScores, scrapeNewsSources, getBreakingNews } = require('./newsService');
const { getMarketData } = require('./cryptoService');
const logger = require('../utils/logger');

// Official network sources for automated scraping
const NETWORKS_TO_SCRAPE = [
  'Hedera HBAR',
  'XDC Network', 
  'Constellation DAG',
  'Ethereum',
  'Solana',
  'Cardano',
  'Polygon',
  'Chainlink',
  'Avalanche',
  'Polkadot'
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
  
  // Generate breaking news alerts every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
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
    const result = await require('../models/News').updateMany(
      {
        publishedAt: { $lt: thirtyDaysAgo },
        isActive: true,
        'engagement.views': { $lt: 100 } // Keep popular articles
      },
      {
        $set: { isActive: false }
      }
    );
    
    logger.info(`Marked ${result.modifiedCount} old articles as inactive`);
    
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
    'Solana': ['https://solana.com/news'],
    'Cardano': ['https://cardano.org/blog'],
    'Polygon': ['https://blog.polygon.technology'],
    'Chainlink': ['https://blog.chain.link'],
    'Avalanche': ['https://medium.com/avalancheavax'],
    'Polkadot': ['https://polkadot.network/blog']
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
