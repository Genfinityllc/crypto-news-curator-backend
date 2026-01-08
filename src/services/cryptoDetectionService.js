/**
 * Unified Crypto Detection Service
 * 
 * SINGLE SOURCE OF TRUTH for detecting cryptocurrency/network from text.
 * Uses priority-based matching to ensure correct detection even with overlapping keywords.
 * 
 * Priority System:
 *   - Tier 1 (High Priority): Specific multi-word phrases (e.g., "World Liberty Financial")
 *   - Tier 2 (Medium Priority): Full network names (e.g., "Ethereum", "Bitcoin")
 *   - Tier 3 (Lower Priority): Ticker symbols (e.g., "ETH", "BTC")
 *   
 * Detection Logic:
 *   1. Search for Tier 1 matches first (most specific)
 *   2. Fall back to Tier 2 if no Tier 1 match
 *   3. Fall back to Tier 3 if no Tier 2 match
 *   4. Title matches weight higher than content matches
 */

const logger = require('../utils/logger');

/**
 * COMPREHENSIVE cryptocurrency patterns with priority tiers
 * Format: { crypto, displayName, tier, patterns[] }
 * 
 * TIER 1: Multi-word specific phrases (highest priority)
 * TIER 2: Full names
 * TIER 3: Ticker symbols (lowest priority, most likely to cause false positives)
 */
const CRYPTO_PATTERNS = [
  // ==================== TIER 1: HIGH PRIORITY (Multi-word phrases) ====================
  { crypto: 'WLFI', displayName: 'World Liberty Financial', tier: 1, 
    patterns: ['world liberty financial', 'world liberty', 'liberty financial', 'wlfi'] },
  { crypto: 'BNB', displayName: 'BNB Chain', tier: 1, 
    patterns: ['binance smart chain', 'bnb chain', 'binance coin'] },
  { crypto: 'NEAR', displayName: 'NEAR Protocol', tier: 1, 
    patterns: ['near protocol', 'near network'] },
  { crypto: 'XDC', displayName: 'XDC Network', tier: 1, 
    patterns: ['xdc network', 'xinfin'] },
  { crypto: 'HBAR', displayName: 'Hedera', tier: 1, 
    patterns: ['hedera hashgraph', 'hedera network'] },
  { crypto: 'XRP', displayName: 'XRP/Ripple', tier: 1, 
    patterns: ['ripple labs', 'ripple network', 'xrp ledger'] },
  { crypto: 'ICP', displayName: 'Internet Computer', tier: 1, 
    patterns: ['internet computer', 'dfinity'] },
  { crypto: 'IMX', displayName: 'Immutable X', tier: 1, 
    patterns: ['immutable x', 'immutable games'] },
  { crypto: 'OP', displayName: 'Optimism', tier: 1, 
    patterns: ['optimism network', 'op mainnet'] },
  { crypto: 'ARB', displayName: 'Arbitrum', tier: 1, 
    patterns: ['arbitrum one', 'arbitrum network'] },
  { crypto: 'BTC', displayName: 'Bitcoin', tier: 1, 
    patterns: ['bitcoin network', 'bitcoin core', 'bitcoin halving', 'btc etf', 'bitcoin etf'] },
  { crypto: 'ETH', displayName: 'Ethereum', tier: 1, 
    patterns: ['ethereum network', 'ethereum mainnet', 'eth 2.0', 'ethereum 2.0', 'eth staking'] },
  { crypto: 'SOL', displayName: 'Solana', tier: 1, 
    patterns: ['solana network', 'solana blockchain', 'solana ecosystem'] },
  { crypto: 'ADA', displayName: 'Cardano', tier: 1, 
    patterns: ['cardano network', 'cardano blockchain'] },
  { crypto: 'CRO', displayName: 'Cronos', tier: 1, 
    patterns: ['cronos chain', 'cronos network', 'crypto.com chain'] },
  
  // ==================== TIER 2: MEDIUM PRIORITY (Full names) ====================
  // Institutions/Companies (check before networks to avoid conflicts)
  { crypto: 'BLACKROCK', displayName: 'BlackRock', tier: 2, patterns: ['blackrock'] },
  { crypto: 'GRAYSCALE', displayName: 'Grayscale', tier: 2, patterns: ['grayscale'] },
  { crypto: '21SHARES', displayName: '21Shares', tier: 2, patterns: ['21shares'] },
  { crypto: 'NVIDIA', displayName: 'NVIDIA', tier: 2, patterns: ['nvidia'] },
  { crypto: 'PAXOS', displayName: 'Paxos', tier: 2, patterns: ['paxos'] },
  { crypto: 'ROBINHOOD', displayName: 'Robinhood', tier: 2, patterns: ['robinhood'] },
  { crypto: 'MOONPAY', displayName: 'MoonPay', tier: 2, patterns: ['moonpay'] },
  
  // Major Cryptocurrencies - Full names
  { crypto: 'BTC', displayName: 'Bitcoin', tier: 2, patterns: ['bitcoin'] },
  { crypto: 'ETH', displayName: 'Ethereum', tier: 2, patterns: ['ethereum', 'ether'] },
  { crypto: 'XRP', displayName: 'XRP', tier: 2, patterns: ['ripple'] },
  { crypto: 'BNB', displayName: 'BNB', tier: 2, patterns: ['binance'] },
  { crypto: 'SOL', displayName: 'Solana', tier: 2, patterns: ['solana'] },
  { crypto: 'ADA', displayName: 'Cardano', tier: 2, patterns: ['cardano'] },
  { crypto: 'DOGE', displayName: 'Dogecoin', tier: 2, patterns: ['dogecoin'] },
  { crypto: 'AVAX', displayName: 'Avalanche', tier: 2, patterns: ['avalanche'] },
  { crypto: 'DOT', displayName: 'Polkadot', tier: 2, patterns: ['polkadot'] },
  { crypto: 'MATIC', displayName: 'Polygon', tier: 2, patterns: ['polygon'] },
  { crypto: 'LINK', displayName: 'Chainlink', tier: 2, patterns: ['chainlink'] },
  { crypto: 'UNI', displayName: 'Uniswap', tier: 2, patterns: ['uniswap'] },
  { crypto: 'LTC', displayName: 'Litecoin', tier: 2, patterns: ['litecoin'] },
  { crypto: 'XMR', displayName: 'Monero', tier: 2, patterns: ['monero'] },
  { crypto: 'XLM', displayName: 'Stellar', tier: 2, patterns: ['stellar'] },
  { crypto: 'ATOM', displayName: 'Cosmos', tier: 2, patterns: ['cosmos'] },
  { crypto: 'FIL', displayName: 'Filecoin', tier: 2, patterns: ['filecoin'] },
  { crypto: 'AAVE', displayName: 'Aave', tier: 2, patterns: ['aave'] },
  { crypto: 'TRX', displayName: 'Tron', tier: 2, patterns: ['tron'] },
  { crypto: 'TON', displayName: 'Toncoin', tier: 2, patterns: ['toncoin', 'telegram open network'] },
  { crypto: 'ALGO', displayName: 'Algorand', tier: 2, patterns: ['algorand'] },
  { crypto: 'HBAR', displayName: 'Hedera', tier: 2, patterns: ['hedera', 'hashgraph'] },
  { crypto: 'APT', displayName: 'Aptos', tier: 2, patterns: ['aptos'] },
  { crypto: 'SUI', displayName: 'Sui', tier: 2, patterns: ['sui'] },
  { crypto: 'NEAR', displayName: 'NEAR', tier: 2, patterns: ['near'] },
  { crypto: 'INJ', displayName: 'Injective', tier: 2, patterns: ['injective'] },
  { crypto: 'SEI', displayName: 'Sei', tier: 2, patterns: ['sei network', 'sei blockchain'] },
  { crypto: 'TIA', displayName: 'Celestia', tier: 2, patterns: ['celestia'] },
  { crypto: 'RUNE', displayName: 'THORChain', tier: 2, patterns: ['thorchain'] },
  { crypto: 'TAO', displayName: 'Bittensor', tier: 2, patterns: ['bittensor'] },
  { crypto: 'ONDO', displayName: 'Ondo', tier: 2, patterns: ['ondo finance', 'ondo'] },
  { crypto: 'QNT', displayName: 'Quant', tier: 2, patterns: ['quant network', 'quant'] },
  { crypto: 'IMX', displayName: 'Immutable', tier: 2, patterns: ['immutable'] },
  { crypto: 'DAG', displayName: 'Constellation', tier: 2, patterns: ['constellation'] },
  { crypto: 'SHIB', displayName: 'Shiba Inu', tier: 2, patterns: ['shiba inu', 'shiba'] },
  { crypto: 'PEPE', displayName: 'Pepe', tier: 2, patterns: ['pepe coin', 'pepe'] },
  { crypto: 'WIF', displayName: 'dogwifhat', tier: 2, patterns: ['dogwifhat'] },
  { crypto: 'BONK', displayName: 'Bonk', tier: 2, patterns: ['bonk'] },
  { crypto: 'CRO', displayName: 'Cronos', tier: 2, patterns: ['cronos', 'crypto.com'] },
  { crypto: 'ARB', displayName: 'Arbitrum', tier: 2, patterns: ['arbitrum'] },
  { crypto: 'OP', displayName: 'Optimism', tier: 2, patterns: ['optimism'] },
  { crypto: 'FTM', displayName: 'Fantom', tier: 2, patterns: ['fantom'] },
  { crypto: 'USDT', displayName: 'Tether', tier: 2, patterns: ['tether', 'usdt'] },
  { crypto: 'USDC', displayName: 'USD Coin', tier: 2, patterns: ['usd coin', 'usdc'] },
  { crypto: 'BCH', displayName: 'Bitcoin Cash', tier: 2, patterns: ['bitcoin cash'] },
  
  // ==================== TIER 3: LOW PRIORITY (Ticker symbols only) ====================
  // These are most prone to false positives so lowest priority
  { crypto: 'BTC', displayName: 'Bitcoin', tier: 3, patterns: ['btc'] },
  { crypto: 'ETH', displayName: 'Ethereum', tier: 3, patterns: ['eth'] },
  { crypto: 'XRP', displayName: 'XRP', tier: 3, patterns: ['xrp'] },
  { crypto: 'BNB', displayName: 'BNB', tier: 3, patterns: ['bnb'] },
  { crypto: 'SOL', displayName: 'Solana', tier: 3, patterns: ['sol'] },
  { crypto: 'ADA', displayName: 'Cardano', tier: 3, patterns: ['ada'] },
  { crypto: 'DOGE', displayName: 'Dogecoin', tier: 3, patterns: ['doge'] },
  { crypto: 'AVAX', displayName: 'Avalanche', tier: 3, patterns: ['avax'] },
  { crypto: 'DOT', displayName: 'Polkadot', tier: 3, patterns: ['dot'] },
  { crypto: 'MATIC', displayName: 'Polygon', tier: 3, patterns: ['matic'] },
  { crypto: 'LINK', displayName: 'Chainlink', tier: 3, patterns: ['link'] },
  { crypto: 'UNI', displayName: 'Uniswap', tier: 3, patterns: ['uni'] },
  { crypto: 'LTC', displayName: 'Litecoin', tier: 3, patterns: ['ltc'] },
  { crypto: 'XMR', displayName: 'Monero', tier: 3, patterns: ['xmr'] },
  { crypto: 'XLM', displayName: 'Stellar', tier: 3, patterns: ['xlm'] },
  { crypto: 'ATOM', displayName: 'Cosmos', tier: 3, patterns: ['atom'] },
  { crypto: 'FIL', displayName: 'Filecoin', tier: 3, patterns: ['fil'] },
  { crypto: 'TRX', displayName: 'Tron', tier: 3, patterns: ['trx'] },
  { crypto: 'TON', displayName: 'Toncoin', tier: 3, patterns: ['ton'] },
  { crypto: 'ALGO', displayName: 'Algorand', tier: 3, patterns: ['algo'] },
  { crypto: 'HBAR', displayName: 'Hedera', tier: 3, patterns: ['hbar'] },
  { crypto: 'APT', displayName: 'Aptos', tier: 3, patterns: ['apt'] },
  { crypto: 'INJ', displayName: 'Injective', tier: 3, patterns: ['inj'] },
  { crypto: 'SEI', displayName: 'Sei', tier: 3, patterns: ['sei'] },
  { crypto: 'TIA', displayName: 'Celestia', tier: 3, patterns: ['tia'] },
  { crypto: 'RUNE', displayName: 'THORChain', tier: 3, patterns: ['rune'] },
  { crypto: 'TAO', displayName: 'Bittensor', tier: 3, patterns: ['tao'] },
  { crypto: 'QNT', displayName: 'Quant', tier: 3, patterns: ['qnt'] },
  { crypto: 'IMX', displayName: 'Immutable', tier: 3, patterns: ['imx'] },
  { crypto: 'DAG', displayName: 'Constellation', tier: 3, patterns: ['dag'] },
  { crypto: 'SHIB', displayName: 'Shiba Inu', tier: 3, patterns: ['shib'] },
  { crypto: 'CRO', displayName: 'Cronos', tier: 3, patterns: ['cro'] },
  { crypto: 'ARB', displayName: 'Arbitrum', tier: 3, patterns: ['arb'] },
  { crypto: 'OP', displayName: 'Optimism', tier: 3, patterns: ['op'] },
  { crypto: 'FTM', displayName: 'Fantom', tier: 3, patterns: ['ftm'] },
  { crypto: 'BCH', displayName: 'Bitcoin Cash', tier: 3, patterns: ['bch'] },
  { crypto: 'XDC', displayName: 'XDC', tier: 3, patterns: ['xdc'] },
  { crypto: 'ICP', displayName: 'Internet Computer', tier: 3, patterns: ['icp'] },
  { crypto: 'WLFI', displayName: 'World Liberty Financial', tier: 3, patterns: ['wlfi'] }
];

/**
 * Main detection function - detects cryptocurrency from title and content
 * 
 * @param {string} title - Article title (weighted higher)
 * @param {string} content - Article content
 * @param {Object} options - Optional settings
 * @returns {Object} - { crypto, displayName, confidence, matchedPattern, tier }
 */
function detectCryptocurrency(title, content = '', options = {}) {
  const { 
    defaultCrypto = null,  // What to return if no match (null = no default)
    debug = false 
  } = options;
  
  const titleLower = (title || '').toLowerCase();
  const contentLower = (content || '').toLowerCase();
  const combinedText = `${titleLower} ${contentLower}`;
  
  if (debug) {
    logger.info(`🔍 CryptoDetection: Analyzing text - Title: "${titleLower.substring(0, 100)}..."`);
  }
  
  // Results storage - keyed by crypto symbol
  const matches = {};
  
  // PHASE 1: Search for all matches across all tiers
  for (const entry of CRYPTO_PATTERNS) {
    for (const pattern of entry.patterns) {
      const patternLower = pattern.toLowerCase();
      
      // Check for word boundary match to avoid partial matches
      // e.g., "sol" shouldn't match "solution" or "sold"
      const wordBoundaryPattern = new RegExp(`\\b${escapeRegex(patternLower)}\\b`, 'i');
      
      let matchScore = 0;
      let matchedIn = [];
      
      // Title matches weighted 3x
      if (wordBoundaryPattern.test(titleLower)) {
        matchScore += 3 * (4 - entry.tier); // Tier 1 = 3 points, Tier 2 = 2 points, Tier 3 = 1 point
        matchedIn.push('title');
      }
      
      // Content matches weighted 1x
      if (wordBoundaryPattern.test(contentLower)) {
        matchScore += 1 * (4 - entry.tier);
        matchedIn.push('content');
      }
      
      if (matchScore > 0) {
        // If we already have this crypto, update if this pattern has a better score
        const existing = matches[entry.crypto];
        if (!existing || matchScore > existing.score) {
          matches[entry.crypto] = {
            crypto: entry.crypto,
            displayName: entry.displayName,
            score: matchScore,
            tier: entry.tier,
            matchedPattern: pattern,
            matchedIn: matchedIn
          };
        }
      }
    }
  }
  
  // PHASE 2: Find the best match (highest score)
  let bestMatch = null;
  for (const match of Object.values(matches)) {
    if (!bestMatch || match.score > bestMatch.score) {
      bestMatch = match;
    }
  }
  
  if (bestMatch) {
    // Calculate confidence: higher tier + higher score = higher confidence
    const confidence = Math.min(100, Math.round((bestMatch.score / 12) * 100)); // Max score ~12 (tier 1, title+content)
    
    const result = {
      crypto: bestMatch.crypto,
      displayName: bestMatch.displayName,
      confidence: confidence,
      tier: bestMatch.tier,
      matchedPattern: bestMatch.matchedPattern,
      matchedIn: bestMatch.matchedIn.join('+'),
      score: bestMatch.score
    };
    
    logger.info(`✅ CryptoDetection: Detected ${result.crypto} (${result.displayName}) - Confidence: ${result.confidence}%, Tier: ${result.tier}, Pattern: "${result.matchedPattern}", Found in: ${result.matchedIn}`);
    
    return result;
  }
  
  // No match found
  if (defaultCrypto) {
    logger.info(`⚠️ CryptoDetection: No match found, using default: ${defaultCrypto}`);
    return {
      crypto: defaultCrypto,
      displayName: defaultCrypto,
      confidence: 0,
      tier: 0,
      matchedPattern: null,
      matchedIn: 'default',
      score: 0
    };
  }
  
  logger.info('🤷 CryptoDetection: No cryptocurrency detected');
  return null;
}

/**
 * Get display name for a crypto symbol
 */
function getDisplayName(cryptoSymbol) {
  const upperSymbol = (cryptoSymbol || '').toUpperCase();
  const entry = CRYPTO_PATTERNS.find(p => p.crypto === upperSymbol);
  return entry ? entry.displayName : upperSymbol;
}

/**
 * Convert network name back to symbol (for article tagging)
 */
function networkToSymbol(networkName) {
  if (!networkName) return null;
  
  const nameLower = networkName.toLowerCase();
  
  // Direct mapping for common network names
  const nameToSymbol = {
    'bitcoin': 'BTC',
    'ethereum': 'ETH',
    'xrp': 'XRP',
    'ripple': 'XRP',
    'bnb chain': 'BNB',
    'binance': 'BNB',
    'solana': 'SOL',
    'cardano': 'ADA',
    'dogecoin': 'DOGE',
    'avalanche': 'AVAX',
    'polkadot': 'DOT',
    'polygon': 'MATIC',
    'chainlink': 'LINK',
    'uniswap': 'UNI',
    'hedera': 'HBAR',
    'algorand': 'ALGO',
    'cronos': 'CRO',
    'world liberty financial': 'WLFI',
    'near protocol': 'NEAR',
    'immutable x': 'IMX',
    'optimism': 'OP',
    'arbitrum': 'ARB',
    'stellar': 'XLM',
    'litecoin': 'LTC',
    'cosmos': 'ATOM',
    'filecoin': 'FIL',
    'monero': 'XMR',
    'tron': 'TRX',
    'internet computer': 'ICP',
    'sui': 'SUI',
    'aptos': 'APT',
    'celestia': 'TIA',
    'injective': 'INJ',
    'sei': 'SEI',
    'xdc network': 'XDC',
    'bitcoin cash': 'BCH',
    'fantom': 'FTM',
    'general': null
  };
  
  return nameToSymbol[nameLower] || networkName.toUpperCase();
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get all supported cryptocurrencies
 */
function getSupportedCryptos() {
  const uniqueCryptos = new Set();
  const cryptoList = [];
  
  for (const entry of CRYPTO_PATTERNS) {
    if (!uniqueCryptos.has(entry.crypto)) {
      uniqueCryptos.add(entry.crypto);
      cryptoList.push({
        symbol: entry.crypto,
        displayName: entry.displayName
      });
    }
  }
  
  return cryptoList.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

module.exports = {
  detectCryptocurrency,
  getDisplayName,
  networkToSymbol,
  getSupportedCryptos,
  CRYPTO_PATTERNS
};

