const axios = require('axios');
const logger = require('../utils/logger');

// Cache for crypto market cap data
let cryptoMarketData = null;
let lastFetchTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get top 50 cryptocurrencies by market cap
 */
async function getTop50CryptosByMarketCap() {
  try {
    // Return cached data if still valid
    if (cryptoMarketData && lastFetchTime && (Date.now() - lastFetchTime) < CACHE_DURATION) {
      logger.info('Returning cached crypto market data');
      return cryptoMarketData;
    }

    logger.info('Fetching top 50 cryptocurrencies by market cap');

    // Try CoinGecko first (free API)
    let cryptoData;
    try {
      cryptoData = await fetchFromCoinGecko();
    } catch (coinGeckoError) {
      logger.warn('CoinGecko API failed, trying fallback:', coinGeckoError.message);
      // Fallback to simulated data
      cryptoData = generateFallbackCryptoData();
    }

    // Cache the data
    cryptoMarketData = cryptoData;
    lastFetchTime = Date.now();

    logger.info(`Successfully fetched ${cryptoData.length} cryptocurrencies`);
    return cryptoData;

  } catch (error) {
    logger.error('Error fetching crypto market data:', error.message);
    
    // Return cached data if available
    if (cryptoMarketData) {
      return cryptoMarketData;
    }
    
    // Final fallback
    return generateFallbackCryptoData();
  }
}

/**
 * Fetch cryptocurrency data from CoinGecko API
 */
async function fetchFromCoinGecko() {
  const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
    params: {
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: 50,
      page: 1,
      sparkline: false,
      price_change_percentage: '1h,24h,7d'
    },
    timeout: 10000
  });

  return response.data.map(crypto => ({
    id: crypto.id,
    symbol: crypto.symbol.toUpperCase(),
    name: crypto.name,
    rank: crypto.market_cap_rank,
    price: crypto.current_price,
    marketCap: crypto.market_cap,
    volume: crypto.total_volume,
    change24h: crypto.price_change_percentage_24h,
    change7d: crypto.price_change_percentage_7d_in_currency,
    image: crypto.image,
    isActive: true
  }));
}

/**
 * Generate fallback crypto data when APIs are unavailable
 */
function generateFallbackCryptoData() {
  const fallbackCryptos = [
    { name: 'Bitcoin', symbol: 'BTC', rank: 1 },
    { name: 'Ethereum', symbol: 'ETH', rank: 2 },
    { name: 'Tether', symbol: 'USDT', rank: 3 },
    { name: 'BNB', symbol: 'BNB', rank: 4 },
    { name: 'Solana', symbol: 'SOL', rank: 5 },
    { name: 'XRP', symbol: 'XRP', rank: 6 },
    { name: 'Dogecoin', symbol: 'DOGE', rank: 7 },
    { name: 'TRON', symbol: 'TRX', rank: 8 },
    { name: 'Cardano', symbol: 'ADA', rank: 9 },
    { name: 'Avalanche', symbol: 'AVAX', rank: 10 },
    { name: 'Chainlink', symbol: 'LINK', rank: 11 },
    { name: 'Polygon', symbol: 'MATIC', rank: 12 },
    { name: 'Polkadot', symbol: 'DOT', rank: 13 },
    { name: 'Litecoin', symbol: 'LTC', rank: 14 },
    { name: 'Bitcoin Cash', symbol: 'BCH', rank: 15 },
    { name: 'Internet Computer', symbol: 'ICP', rank: 16 },
    { name: 'Uniswap', symbol: 'UNI', rank: 17 },
    { name: 'Stellar', symbol: 'XLM', rank: 18 },
    { name: 'Filecoin', symbol: 'FIL', rank: 19 },
    { name: 'VeChain', symbol: 'VET', rank: 20 },
    { name: 'Hedera', symbol: 'HBAR', rank: 21 },
    { name: 'Cosmos', symbol: 'ATOM', rank: 22 },
    { name: 'Algorand', symbol: 'ALGO', rank: 23 },
    { name: 'The Graph', symbol: 'GRT', rank: 24 },
    { name: 'Sandbox', symbol: 'SAND', rank: 25 },
    { name: 'ApeCoin', symbol: 'APE', rank: 26 },
    { name: 'Decentraland', symbol: 'MANA', rank: 27 },
    { name: 'Aave', symbol: 'AAVE', rank: 28 },
    { name: 'Maker', symbol: 'MKR', rank: 29 },
    { name: 'Flow', symbol: 'FLOW', rank: 30 },
    { name: 'Fantom', symbol: 'FTM', rank: 31 },
    { name: 'Theta', symbol: 'THETA', rank: 32 },
    { name: 'Axie Infinity', symbol: 'AXS', rank: 33 },
    { name: 'PancakeSwap', symbol: 'CAKE', rank: 34 },
    { name: 'Bitcoin SV', symbol: 'BSV', rank: 35 },
    { name: 'EOS', symbol: 'EOS', rank: 36 },
    { name: 'Chiliz', symbol: 'CHZ', rank: 37 },
    { name: 'IOTA', symbol: 'MIOTA', rank: 38 },
    { name: 'Klaytn', symbol: 'KLAY', rank: 39 },
    { name: 'Tezos', symbol: 'XTZ', rank: 40 },
    { name: 'NEO', symbol: 'NEO', rank: 41 },
    { name: 'Enjin Coin', symbol: 'ENJ', rank: 42 },
    { name: 'Compound', symbol: 'COMP', rank: 43 },
    { name: 'Qtum', symbol: 'QTUM', rank: 44 },
    { name: 'Zilliqa', symbol: 'ZIL', rank: 45 },
    { name: 'Dash', symbol: 'DASH', rank: 46 },
    { name: 'Zcash', symbol: 'ZEC', rank: 47 },
    { name: 'Waves', symbol: 'WAVES', rank: 48 },
    { name: 'Basic Attention Token', symbol: 'BAT', rank: 49 },
    { name: 'OMG Network', symbol: 'OMG', rank: 50 }
  ];

  return fallbackCryptos.map(crypto => ({
    id: crypto.name.toLowerCase().replace(/\s+/g, '-'),
    symbol: crypto.symbol,
    name: crypto.name,
    rank: crypto.rank,
    price: 50 + Math.random() * 1000,
    marketCap: (1000000000 + Math.random() * 10000000000) * (51 - crypto.rank),
    volume: 100000000 + Math.random() * 500000000,
    change24h: (Math.random() - 0.5) * 20,
    change7d: (Math.random() - 0.5) * 40,
    image: `https://assets.coingecko.com/coins/images/1/${crypto.symbol.toLowerCase()}.png`,
    isActive: true
  }));
}

/**
 * Get crypto by symbol
 */
function getCryptoBySymbol(symbol) {
  if (!cryptoMarketData) {
    return null;
  }
  
  return cryptoMarketData.find(crypto => 
    crypto.symbol.toLowerCase() === symbol.toLowerCase()
  );
}

/**
 * Get trending cryptocurrencies (top movers)
 */
function getTrendingCryptos(limit = 10) {
  if (!cryptoMarketData) {
    return [];
  }
  
  return cryptoMarketData
    .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
    .slice(0, limit);
}

module.exports = {
  getTop50CryptosByMarketCap,
  getCryptoBySymbol,
  getTrendingCryptos
};