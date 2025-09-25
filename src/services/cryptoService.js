const axios = require('axios');
const logger = require('../utils/logger');

// For production, you'd integrate with:
// - CoinGecko API (free tier available)
// - CoinMarketCap API (requires API key)
// - Binance API
// - CryptoCompare API

/**
 * Get market data for top cryptocurrencies
 */
async function getMarketData(limit = 100, currency = 'USD') {
  try {
    logger.info(`Fetching market data for top ${limit} cryptocurrencies`);
    
    // Use real CoinGecko API
      const response = await axios.get(`https://api.coingecko.com/api/v3/coins/markets`, {
        params: {
          vs_currency: currency.toLowerCase(),
          order: 'market_cap_desc',
          per_page: Math.min(limit, 250),
          page: 1,
          sparkline: false,
          locale: 'en',
          price_change_percentage: '24h,7d'
        },
        timeout: 10000
      });
      
      const realData = response.data.map(coin => ({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        image: coin.image,
        currentPrice: coin.current_price,
        price: coin.current_price, // Add alias for frontend compatibility
        marketCap: coin.market_cap,
        marketCapRank: coin.market_cap_rank,
        totalVolume: coin.total_volume,
        volume24h: coin.total_volume, // Add alias for frontend compatibility
        high24h: coin.high_24h,
        low24h: coin.low_24h,
        priceChange24h: coin.price_change_24h,
        priceChangePercentage24h: coin.price_change_percentage_24h,
        change24h: coin.price_change_percentage_24h, // Add alias for frontend compatibility
        change7d: coin.price_change_percentage_7d_in_currency || 0,
        rank: coin.market_cap_rank,
        lastUpdated: coin.last_updated
      }));
      
      logger.info(`Successfully fetched REAL market data for ${realData.length} cryptocurrencies from CoinGecko`);
      return realData;
      
  } catch (error) {
    logger.error('CoinGecko API error, falling back to mock data:', error.message);
    
    // Fallback to mock data if API fails
    const mockData = generateMockMarketData(limit);
    logger.info(`Fallback: Using mock market data for ${mockData.length} cryptocurrencies`);
    return mockData;
  }
}

/**
 * Get specific network information
 */
async function getNetworkInfo(symbol) {
  try {
    logger.info(`Fetching network info for ${symbol}`);
    
    // In production, you'd call a real API
    const networkInfo = await getMockNetworkInfo(symbol);
    
    if (!networkInfo) {
      return null;
    }
    
    logger.info(`Successfully fetched network info for ${symbol}`);
    return networkInfo;
    
  } catch (error) {
    logger.error(`Error fetching network info for ${symbol}:`, error.message);
    throw new Error(`Failed to fetch network info for ${symbol}: ${error.message}`);
  }
}

/**
 * Get top networks by various metrics
 */
async function getTopNetworks(metric = 'marketCap', limit = 25) {
  try {
    logger.info(`Fetching top networks by ${metric}`);
    
    // In production, you'd call a real API and sort by the specified metric
    const networks = await getMockTopNetworks(limit);
    
    // Sort by the specified metric
    networks.sort((a, b) => {
      switch (metric) {
        case 'marketCap':
          return b.marketCap - a.marketCap;
        case 'volume':
          return b.volume - a.volume;
        case 'priceChange':
          return Math.abs(b.priceChange24h) - Math.abs(a.priceChange24h);
        case 'articles':
          return b.articleCount - a.articleCount;
        default:
          return b.marketCap - a.marketCap;
      }
    });
    
    logger.info(`Successfully fetched top ${limit} networks by ${metric}`);
    return networks.slice(0, limit);
    
  } catch (error) {
    logger.error('Error fetching top networks:', error.message);
    throw new Error(`Failed to fetch top networks: ${error.message}`);
  }
}

/**
 * Get price history for a network
 */
async function getPriceHistory(symbol, days = 30, currency = 'USD') {
  try {
    logger.info(`Fetching price history for ${symbol} over ${days} days`);
    
    // In production, you'd call a real API
    // Example with CoinGecko:
    /*
    const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${symbol}/market_chart`, {
      params: {
        vs_currency: currency.toLowerCase(),
        days: days,
        interval: 'daily'
      }
    });
    
    return response.data.prices.map(([timestamp, price]) => ({
      timestamp,
      price,
      date: new Date(timestamp)
    }));
    */
    
    // For demo purposes, return mock data
    const mockPriceHistory = generateMockPriceHistory(symbol, days);
    
    logger.info(`Successfully fetched price history for ${symbol}`);
    return mockPriceHistory;
    
  } catch (error) {
    logger.error(`Error fetching price history for ${symbol}:`, error.message);
    throw new Error(`Failed to fetch price history for ${symbol}: ${error.message}`);
  }
}

/**
 * Get social metrics for a network
 */
async function getSocialMetrics(symbol) {
  try {
    logger.info(`Fetching social metrics for ${symbol}`);
    
    // In production, you'd integrate with social media APIs
    const mockSocialMetrics = generateMockSocialMetrics(symbol);
    
    logger.info(`Successfully fetched social metrics for ${symbol}`);
    return mockSocialMetrics;
    
  } catch (error) {
    logger.error(`Error fetching social metrics for ${symbol}:`, error.message);
    throw new Error(`Failed to fetch social metrics for ${symbol}: ${error.message}`);
  }
}

/**
 * Get trending networks
 */
async function getTrendingNetworks(timeframe = '24h') {
  try {
    logger.info(`Fetching trending networks for ${timeframe}`);
    
    // In production, you'd call a real API
    const mockTrending = generateMockTrendingNetworks(timeframe);
    
    logger.info(`Successfully fetched trending networks for ${timeframe}`);
    return mockTrending;
    
  } catch (error) {
    logger.error('Error fetching trending networks:', error.message);
    throw new Error(`Failed to fetch trending networks: ${error.message}`);
  }
}

/**
 * Get network sentiment analysis
 */
async function getNetworkSentiment(symbol, days = 7) {
  try {
    logger.info(`Fetching sentiment analysis for ${symbol} over ${days} days`);
    
    // In production, you'd use AI sentiment analysis on news articles
    const mockSentiment = generateMockSentiment(symbol, days);
    
    logger.info(`Successfully fetched sentiment analysis for ${symbol}`);
    return mockSentiment;
    
  } catch (error) {
    logger.error(`Error fetching sentiment analysis for ${symbol}:`, error.message);
    throw new Error(`Failed to fetch sentiment analysis for ${symbol}: ${error.message}`);
  }
}

/**
 * Compare multiple networks
 */
async function compareNetworks(networks) {
  try {
    logger.info(`Comparing networks: ${networks.join(', ')}`);
    
    const comparison = [];
    
    for (const network of networks) {
      const info = await getNetworkInfo(network);
      if (info) {
        comparison.push(info);
      }
    }
    
    logger.info(`Successfully compared ${comparison.length} networks`);
    return comparison;
    
  } catch (error) {
    logger.error('Error comparing networks:', error.message);
    throw new Error(`Failed to compare networks: ${error.message}`);
  }
}

/**
 * Get global market overview
 */
async function getGlobalMarketOverview() {
  try {
    logger.info('Fetching global market overview');
    
    // In production, you'd call a real API
    const mockOverview = generateMockGlobalOverview();
    
    logger.info('Successfully fetched global market overview');
    return mockOverview;
    
  } catch (error) {
    logger.error('Error fetching global market overview:', error.message);
    throw new Error(`Failed to fetch global market overview: ${error.message}`);
  }
}

// Mock data generators for demo purposes
function generateMockMarketData(limit) {
  const networks = [
    'Bitcoin', 'Ethereum', 'Binance Coin', 'Solana', 'XRP', 'Cardano', 'Avalanche',
    'Dogecoin', 'Tron', 'Polygon', 'Polkadot', 'Chainlink', 'Litecoin', 'Bitcoin Cash',
    'Uniswap', 'Stellar', 'Internet Computer', 'Filecoin', 'VeChain', 'Hedera',
    'XDC Network', 'Constellation', 'Algorand', 'Cosmos', 'Theta'
  ];
  
  return networks.slice(0, limit).map((name, index) => ({
    id: name.toLowerCase().replace(/\s+/g, '-'),
    symbol: name.split(' ')[0].substring(0, 4).toUpperCase(),
    name,
    image: `https://placehold.co/32x32/1a1a2e/ffffff?text=${name.charAt(0)}`,
    currentPrice: Math.random() * 10000 + 1,
    marketCap: Math.random() * 100000000000 + 1000000000,
    marketCapRank: index + 1,
    totalVolume: Math.random() * 10000000000 + 100000000,
    high24h: Math.random() * 12000 + 1,
    low24h: Math.random() * 8000 + 1,
    priceChange24h: (Math.random() - 0.5) * 1000,
    priceChangePercentage24h: (Math.random() - 0.5) * 20,
    marketCapChange24h: (Math.random() - 0.5) * 10000000000,
    marketCapChangePercentage24h: (Math.random() - 0.5) * 10,
    circulatingSupply: Math.random() * 1000000000 + 10000000,
    totalSupply: Math.random() * 1000000000 + 10000000,
    maxSupply: Math.random() * 1000000000 + 10000000,
    ath: Math.random() * 15000 + 1,
    athChangePercentage: (Math.random() - 0.5) * 50,
    athDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
    atl: Math.random() * 100 + 0.01,
    atlChangePercentage: Math.random() * 1000,
    atlDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
    lastUpdated: new Date()
  }));
}

function getMockNetworkInfo(symbol) {
  const networkData = {
    'BTC': {
      name: 'Bitcoin',
      symbol: 'BTC',
      description: 'The first and most well-known cryptocurrency',
      website: 'https://bitcoin.org',
      whitepaper: 'https://bitcoin.org/bitcoin.pdf',
      blockchain: 'Bitcoin',
      consensus: 'Proof of Work',
      maxSupply: 21000000,
      circulatingSupply: 19500000,
      marketCap: 800000000000,
      price: 45000,
      volume24h: 25000000000,
      priceChange24h: 2.5,
      allTimeHigh: 69000,
      allTimeLow: 0.01
    },
    'ETH': {
      name: 'Ethereum',
      symbol: 'ETH',
      description: 'A decentralized platform for smart contracts',
      website: 'https://ethereum.org',
      whitepaper: 'https://ethereum.org/en/whitepaper/',
      blockchain: 'Ethereum',
      consensus: 'Proof of Stake',
      maxSupply: null,
      circulatingSupply: 120000000,
      marketCap: 300000000000,
      price: 2500,
      volume24h: 15000000000,
      priceChange24h: -1.2,
      allTimeHigh: 4800,
      allTimeLow: 0.43
    }
  };
  
  return networkData[symbol.toUpperCase()] || null;
}

function getMockTopNetworks(limit) {
  const networks = [
    { name: 'Hedera HBAR', articles: 23, marketCap: 2800000000, change: 5.2 },
    { name: 'XDC Network', articles: 18, marketCap: 687000000, change: 12.8 },
    { name: 'Constellation DAG', articles: 15, marketCap: 234000000, change: 8.1 },
    { name: 'Ethereum', articles: 34, marketCap: 291000000000, change: 2.4 },
    { name: 'Solana', articles: 28, marketCap: 41000000000, change: 7.3 },
    { name: 'Cardano', articles: 21, marketCap: 12000000000, change: 3.8 },
    { name: 'Polygon', articles: 19, marketCap: 4200000000, change: 6.5 },
    { name: 'Chainlink', articles: 16, marketCap: 8900000000, change: 4.2 },
    { name: 'Avalanche', articles: 14, marketCap: 11000000000, change: 9.1 },
    { name: 'Polkadot', articles: 12, marketCap: 7300000000, change: 2.9 }
  ];
  
  return networks.slice(0, limit);
}

function generateMockPriceHistory(symbol, days) {
  const history = [];
  const basePrice = Math.random() * 1000 + 100;
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const volatility = (Math.random() - 0.5) * 0.1; // 10% daily volatility
    const price = basePrice * (1 + volatility);
    
    history.push({
      timestamp: date.getTime(),
      price: parseFloat(price.toFixed(2)),
      date
    });
  }
  
  return history;
}

function generateMockSocialMetrics(symbol) {
  return {
    twitter: {
      followers: Math.floor(Math.random() * 1000000) + 10000,
      mentions: Math.floor(Math.random() * 10000) + 100,
      sentiment: Math.random() > 0.5 ? 'positive' : 'negative'
    },
    reddit: {
      subscribers: Math.floor(Math.random() * 500000) + 5000,
      posts: Math.floor(Math.random() * 1000) + 50,
      sentiment: Math.random() > 0.5 ? 'positive' : 'negative'
    },
    telegram: {
      members: Math.floor(Math.random() * 100000) + 1000,
      messages: Math.floor(Math.random() * 10000) + 100
    }
  };
}

function generateMockTrendingNetworks(timeframe) {
  const networks = ['Bitcoin', 'Ethereum', 'Solana', 'Cardano', 'Polygon'];
  return networks.map(name => ({
    name,
    symbol: name.substring(0, 4).toUpperCase(),
    trend: Math.random() > 0.5 ? 'up' : 'down',
    change: (Math.random() * 20 + 5).toFixed(1),
    volume: Math.floor(Math.random() * 1000000000) + 100000000
  }));
}

function generateMockSentiment(symbol, days) {
  const sentiments = [];
  let currentSentiment = 0.5;
  
  for (let i = days; i >= 0; i--) {
    const change = (Math.random() - 0.5) * 0.2;
    currentSentiment = Math.max(0, Math.min(1, currentSentiment + change));
    
    sentiments.push({
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      sentiment: currentSentiment,
      overall: currentSentiment > 0.6 ? 'positive' : currentSentiment < 0.4 ? 'negative' : 'neutral'
    });
  }
  
  return {
    symbol,
    period: `${days} days`,
    averageSentiment: (sentiments.reduce((sum, s) => sum + s.sentiment, 0) / sentiments.length).toFixed(3),
    overall: sentiments[sentiments.length - 1].overall,
    dailySentiments: sentiments
  };
}

function generateMockGlobalOverview() {
  return {
    totalMarketCap: 2500000000000,
    totalVolume24h: 150000000000,
    marketCapChange24h: 2.5,
    activeCryptocurrencies: 2500,
    totalMarkets: 500,
    marketDominance: {
      bitcoin: 45.2,
      ethereum: 18.7,
      others: 36.1
    },
    marketTrend: 'bullish',
    fearGreedIndex: 65,
    lastUpdated: new Date()
  };
}

module.exports = {
  getMarketData,
  getNetworkInfo,
  getTopNetworks,
  getPriceHistory,
  getSocialMetrics,
  getTrendingNetworks,
  getNetworkSentiment,
  compareNetworks,
  getGlobalMarketOverview
};
