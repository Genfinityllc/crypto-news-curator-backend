const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { getTop50CryptosByMarketCap, getCryptoBySymbol, getTrendingCryptos } = require('../services/cryptoMarketService');

/**
 * @route GET /api/crypto-market/top50
 * @desc Get top 50 cryptocurrencies by market cap
 * @access Public
 */
router.get('/top50', async (req, res) => {
  try {
    logger.info('Fetching top 50 cryptocurrencies by market cap');
    
    const cryptos = await getTop50CryptosByMarketCap();
    
    res.json({
      success: true,
      data: cryptos,
      count: cryptos.length,
      lastUpdated: new Date().toISOString(),
      message: 'Top 50 cryptocurrencies fetched successfully'
    });
    
  } catch (error) {
    logger.error('Error fetching top 50 cryptocurrencies:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cryptocurrency market data',
      error: error.message
    });
  }
});

/**
 * @route GET /api/crypto-market/symbol/:symbol
 * @desc Get cryptocurrency by symbol
 * @access Public
 */
router.get('/symbol/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    logger.info(`Fetching cryptocurrency data for symbol: ${symbol}`);
    
    // Ensure we have market data
    await getTop50CryptosByMarketCap();
    const crypto = getCryptoBySymbol(symbol);
    
    if (!crypto) {
      return res.status(404).json({
        success: false,
        message: `Cryptocurrency with symbol '${symbol}' not found in top 50`,
        availableSymbols: 'Use /api/crypto-market/top50 to see available cryptocurrencies'
      });
    }
    
    res.json({
      success: true,
      data: crypto,
      message: `Cryptocurrency ${symbol} data fetched successfully`
    });
    
  } catch (error) {
    logger.error(`Error fetching cryptocurrency ${req.params.symbol}:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cryptocurrency data',
      error: error.message
    });
  }
});

/**
 * @route GET /api/crypto-market/trending
 * @desc Get trending cryptocurrencies (top movers)
 * @access Public
 */
router.get('/trending', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    logger.info(`Fetching ${limit} trending cryptocurrencies`);
    
    // Ensure we have market data
    await getTop50CryptosByMarketCap();
    const trending = getTrendingCryptos(limit);
    
    res.json({
      success: true,
      data: trending,
      count: trending.length,
      message: 'Trending cryptocurrencies fetched successfully'
    });
    
  } catch (error) {
    logger.error('Error fetching trending cryptocurrencies:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trending cryptocurrency data',
      error: error.message
    });
  }
});

/**
 * @route GET /api/crypto-market/dropdown
 * @desc Get dropdown options for cryptocurrency selection
 * @access Public
 */
router.get('/dropdown', async (req, res) => {
  try {
    logger.info('Fetching cryptocurrency dropdown options');
    
    const cryptos = await getTop50CryptosByMarketCap();
    
    const dropdownOptions = cryptos.map(crypto => ({
      value: crypto.symbol,
      label: `${crypto.name} (${crypto.symbol})`,
      rank: crypto.rank,
      price: crypto.price
    }));
    
    res.json({
      success: true,
      data: dropdownOptions,
      count: dropdownOptions.length,
      message: 'Cryptocurrency dropdown options fetched successfully'
    });
    
  } catch (error) {
    logger.error('Error fetching cryptocurrency dropdown options:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cryptocurrency dropdown options',
      error: error.message
    });
  }
});

module.exports = router;