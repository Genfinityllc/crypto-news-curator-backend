const express = require('express');
const router = express.Router();
const { getMarketData, getNetworkInfo, getTopNetworks } = require('../services/cryptoService');
const logger = require('../utils/logger');

// Get market data for top cryptocurrencies
router.get('/market-data', async (req, res) => {
  try {
    const { limit = 100, currency = 'USD' } = req.query;
    
    const marketData = await getMarketData(parseInt(limit), currency);
    
    res.json({
      success: true,
      data: marketData
    });
  } catch (error) {
    logger.error('Error fetching market data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching market data'
    });
  }
});

// Get specific network information
router.get('/network/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    const networkInfo = await getNetworkInfo(symbol);
    
    if (!networkInfo) {
      return res.status(404).json({
        success: false,
        message: 'Network not found'
      });
    }

    res.json({
      success: true,
      data: networkInfo
    });
  } catch (error) {
    logger.error('Error fetching network info:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching network information'
    });
  }
});

// Get top networks by various metrics
router.get('/top-networks', async (req, res) => {
  try {
    const { metric = 'marketCap', limit = 25 } = req.query;
    
    const topNetworks = await getTopNetworks(metric, parseInt(limit));
    
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

// Get network price history
router.get('/network/:symbol/price-history', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { days = 30, currency = 'USD' } = req.query;
    
    // This would integrate with a price API like CoinGecko or CoinMarketCap
    const priceHistory = await getPriceHistory(symbol, parseInt(days), currency);
    
    res.json({
      success: true,
      data: priceHistory
    });
  } catch (error) {
    logger.error('Error fetching price history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching price history'
    });
  }
});

// Get network social metrics
router.get('/network/:symbol/social', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    // This would integrate with social media APIs
    const socialMetrics = await getSocialMetrics(symbol);
    
    res.json({
      success: true,
      data: socialMetrics
    });
  } catch (error) {
    logger.error('Error fetching social metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching social metrics'
    });
  }
});

// Get trending networks
router.get('/trending', async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    const trendingNetworks = await getTrendingNetworks(timeframe);
    
    res.json({
      success: true,
      data: trendingNetworks
    });
  } catch (error) {
    logger.error('Error fetching trending networks:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching trending networks'
    });
  }
});

// Get network news sentiment
router.get('/network/:symbol/sentiment', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { days = 7 } = req.query;
    
    const sentiment = await getNetworkSentiment(symbol, parseInt(days));
    
    res.json({
      success: true,
      data: sentiment
    });
  } catch (error) {
    logger.error('Error fetching network sentiment:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching network sentiment'
    });
  }
});

// Get network comparison
router.post('/compare', async (req, res) => {
  try {
    const { networks } = req.body;
    
    if (!networks || !Array.isArray(networks) || networks.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 networks are required for comparison'
      });
    }

    const comparison = await compareNetworks(networks);
    
    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    logger.error('Error comparing networks:', error);
    res.status(500).json({
      success: false,
      message: 'Error comparing networks'
    });
  }
});

// Get global crypto market overview
router.get('/overview', async (req, res) => {
  try {
    const overview = await getGlobalMarketOverview();
    
    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    logger.error('Error fetching market overview:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching market overview'
    });
  }
});

module.exports = router;
