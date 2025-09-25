/**
 * Enhanced News Service with Crypto Content Validation
 * 
 * VALIDATION FEATURES:
 * - Comprehensive crypto content validation with blacklist filtering
 * - Enhanced Google News filtering with stricter confidence requirements
 * - Rejection logging for monitoring and system improvement
 * - Multi-layered validation: blacklist → crypto indicators → confidence scoring
 * - Special handling for ambiguous terms like "optimism" vs Optimism network
 * 
 * BLACKLIST CATEGORIES:
 * - Traditional finance (stocks, rates, fed, nasdaq, etc.)
 * - Non-financial topics (sports, entertainment, politics, etc.)
 * - General business terms without crypto context
 * 
 * VALIDATION LEVELS:
 * - Strong (>= 0.95): Multiple crypto indicators or network-specific terms
 * - Medium (>= 0.8): Single strong crypto indicator
 * - Weak (>= 0.6): Multiple weak terms with crypto context
 * - Google News requires >= 0.8 confidence minimum
 */

const axios = require('axios');
const cheerio = require('cheerio');
const Parser = require('rss-parser');
// News model removed - using Supabase instead
const logger = require('../utils/logger');
const { calculateViralScore, rewriteArticle, calculateReadabilityScore } = require('./aiService');
const { generateCardCoverImage, extractArticleImages, isGenericGoogleImage, secondaryImageExtraction, extractGoogleNewsImages, resolveGoogleNewsUrl } = require('./imageService');

// Initialize RSS parser
const parser = new Parser({
  customFields: {
    item: [
      'pubDate', 
      'creator', 
      'content:encoded',
      'enclosure',
      'media:content',
      'media:thumbnail',
      'media:description',
      'itunes:image'
    ]
  }
});

/**
 * Validate if content is genuinely crypto-related
 * Returns { isValid: boolean, reason: string, confidence: number }
 */
function validateCryptoContent(title, content, source = '') {
  const searchText = `${title} ${content}`.toLowerCase();
  const fullText = `${title} ${content} ${source}`.toLowerCase();
  
  // TRUSTED CRYPTO SOURCES: Articles from these sources should have relaxed validation
  const trustedCryptoSources = [
    'coindesk.com', 'cointelegraph.com', 'cryptoslate.com',
    'crypto.news', 'cryptopotato.com', 'news.bitcoin.com',
    'u.today', 'ambcrypto.com', 'cryptonews.com',
    'cryptobriefing.com', 'beincrypto.com', 'cryptodaily.co.uk',
    'coincentral.com'
  ];
  
  // Check if this article comes from a trusted crypto source
  const isTrustedSource = trustedCryptoSources.some(trustedSource => 
    source.toLowerCase().includes(trustedSource) || 
    fullText.includes(trustedSource)
  );
  
  // For trusted crypto sources, use very relaxed validation
  if (isTrustedSource) {
    // Only reject if it contains VERY obvious non-crypto content
    const hardBlacklist = [
      'sports team', 'football team', 'basketball team', 'baseball team', 'soccer team', 
      'university sports', 'college sports', 'school sports', 'athletics team',
      'nfl', 'nba', 'mlb', 'premier league', 'champions league',
      'immigration policy', 'school board', 'education policy', 'healthcare policy',
      'climate change policy', 'food and drug', 'automotive industry', 'travel industry',
      'tourism industry', 'fashion industry', 'movie industry', 'music industry'
    ];
    
    // Only reject if article is CLEARLY about non-crypto topics
    for (const blacklistTerm of hardBlacklist) {
      if (searchText.includes(blacklistTerm)) {
        return {
          isValid: false,
          reason: `Trusted source but contains non-crypto content: "${blacklistTerm}"`,
          confidence: 0.9
        };
      }
    }
    
    // For trusted crypto sources, accept virtually all content
    return {
      isValid: true,
      reason: `From trusted crypto source: ${source}`,
      confidence: 0.95
    };
  }
  
  // BLACKLIST: Non-crypto terms that should immediately reject articles
  const nonCryptoBlacklist = [
    // Traditional Finance
    'nasdaq', 'dow jones', 'dow industrial', 's&p 500', 'russell 2000', 'ftse', 'nikkei',
    'federal reserve', 'fed rate', 'interest rate', 'fed meeting', 'fomc', 'fed chair',
    'wall street', 'stock market', 'equity market', 'bond market', 'treasury',
    'inflation rate', 'consumer price index', 'cpi', 'gdp growth', 'unemployment',
    'mortgage rate', 'housing market', 'real estate', 'commercial property',
    
    // Specific Sources to Block
    'wall street journal', 'wsj.com', 'wsj', 'the wall street journal',
    
    // Non-Financial Topics
    'immigration', 'supreme court', 'school board', 'education policy', 'politics',
    'election', 'voting', 'campaign', 'healthcare', 'climate change', 'environment',
    'sports', 'entertainment', 'celebrity', 'movie', 'music', 'fashion', 'food',
    'travel', 'tourism', 'insurance', 'automotive', 'manufacturing',
    
    // General Business (non-crypto)
    'quarterly earnings', 'corporate earnings', 'merger acquisition', 'ipo filing',
    'dividend', 'stock split', 'shareholder meeting', 'board of directors',
    
    // Sports & Entertainment
    'volleyball', 'football', 'basketball', 'baseball', 'soccer', 'tennis', 'golf',
    'athletics', 'university', 'college', 'school', 'student', 'team', 'game', 'match',
    'tournament', 'championship', 'league', 'coach', 'player'
  ];
  
  // NETWORK-SPECIFIC TERMS: These count as crypto indicators
  const networkTerms = [
    'hedera', 'hbar', 'hashgraph', 'xdc network', 'xinfin', 'algorand', 'algo',
    'constellation network', 'dag', 'hashpack', 'swap token',
    'bitcoin', 'ethereum', 'binance coin', 'cardano', 'solana', 'polkadot',
    'chainlink', 'litecoin', 'dogecoin', 'shiba inu', 'polygon', 'avalanche',
    'xrp', 'ripple', 'bnb', 'matic', 'avax', 'dot', 'cosmos', 'atom', 'near',
    'stellar', 'xlm', 'ada', 'btc', 'eth', 'sol', 'doge', 'vet', 'neo', 'icp'
  ];

  // Check if article has crypto network terms
  const hasNetworkTerms = networkTerms.some(term => searchText.includes(term));

  // Check for blacklisted terms in title, content, and source
  for (const blacklistTerm of nonCryptoBlacklist) {
    if (searchText.includes(blacklistTerm) || fullText.includes(blacklistTerm)) {
      // If article has crypto network terms, allow some traditionally blacklisted terms in crypto context
      const allowedInCryptoContext = [
        'treasury', 'team', 'federal reserve', 'fed rate', 'wall street', 
        'nasdaq', 'dow jones', 'dow industrial', 's&p 500', 'russell 2000', 'ftse', 'nikkei',
        'interest rate', 'fed meeting', 'fomc', 'fed chair', 'player', 'game', 'match', 
        'university', 'basketball', 'football', 'soccer', 'sports', 'entertainment',
        'movie', 'film', 'music', 'art', 'fashion', 'luxury'
      ];
      
      if (hasNetworkTerms && allowedInCryptoContext.includes(blacklistTerm)) {
        // Allow this blacklisted term since article has crypto network context
        continue;
      }
      
      return {
        isValid: false,
        reason: `Contains non-crypto blacklisted term: "${blacklistTerm}"`,
        confidence: 0.95
      };
    }
  }
  
  // CRYPTO INDICATORS: Strong signals this is crypto-related
  const strongCryptoIndicators = [
    // Core Crypto Terms
    'cryptocurrency', 'blockchain', 'crypto', 'digital currency',
    'smart contract', 'defi', 'decentralized finance', 'yield farming', 'liquidity mining',
    'staking', 'mining', 'hash rate', 'consensus', 'validator', 'node',
    'wallet', 'private key', 'public key', 'seed phrase', 'cold storage',
    
    // Trading & Markets
    'crypto exchange', 'trading pair', 'market cap', 'price prediction',
    'technical analysis', 'bull market', 'bear market', 'altcoin', 'memecoin',
    'airdrop', 'token sale', 'ico', 'ido', 'ieo',
    
    // Technology
    'layer 1', 'layer 2', 'scaling solution', 'sharding', 'proof of stake',
    'proof of work', 'consensus mechanism', 'fork', 'mainnet', 'testnet',
    'dapp', 'web3', 'metaverse', 'nft', 'dao', 'governance token',
    
    // Major Cryptocurrencies
    'bitcoin', 'ethereum', 'binance coin', 'cardano', 'solana', 'polkadot',
    'chainlink', 'litecoin', 'dogecoin', 'shiba inu', 'polygon', 'avalanche'
  ];
  
  // MEDIUM CRYPTO INDICATORS: Need additional context to be strong
  const mediumCryptoIndicators = [
    'digital asset', 'volume', 'token price', 'crypto market', 'blockchain technology'
  ];
  
  // NETWORK-SPECIFIC TERMS: These count as crypto indicators
  // (networkTerms already defined above)
  
  // WEAK CRYPTO TERMS: Need additional context to be valid
  const weakCryptoTerms = [
    'optimism', 'network', 'token', 'coin', 'digital', 'virtual', 'chain'
  ];
  
  // Count strong crypto indicators
  let strongIndicatorCount = 0;
  let foundStrongIndicators = [];
  
  for (const indicator of strongCryptoIndicators) {
    if (searchText.includes(indicator)) {
      strongIndicatorCount++;
      foundStrongIndicators.push(indicator);
    }
  }
  
  // Count medium crypto indicators
  let mediumIndicatorCount = 0;
  let foundMediumIndicators = [];
  
  for (const indicator of mediumCryptoIndicators) {
    if (searchText.includes(indicator)) {
      mediumIndicatorCount++;
      foundMediumIndicators.push(indicator);
    }
  }
  
  // Count network-specific terms
  let networkTermCount = 0;
  let foundNetworkTerms = [];
  
  for (const networkTerm of networkTerms) {
    if (searchText.includes(networkTerm)) {
      networkTermCount++;
      foundNetworkTerms.push(networkTerm);
    }
  }
  
  // Count weak crypto terms
  let weakTermCount = 0;
  let foundWeakTerms = [];
  
  for (const weakTerm of weakCryptoTerms) {
    if (searchText.includes(weakTerm)) {
      weakTermCount++;
      foundWeakTerms.push(weakTerm);
    }
  }
  
  // VALIDATION LOGIC
  
  // Strong validation: Multiple strong indicators OR network terms
  if (strongIndicatorCount >= 2 || networkTermCount >= 1) {
    return {
      isValid: true,
      reason: `Strong crypto context: ${[...foundStrongIndicators, ...foundNetworkTerms].join(', ')}`,
      confidence: 0.95
    };
  }
  
  // Medium-high validation: Strong indicator + medium indicator OR strong + multiple weak
  if (strongIndicatorCount >= 1 && (mediumIndicatorCount >= 1 || weakTermCount >= 2)) {
    return {
      isValid: true,
      reason: `Crypto context found: ${[...foundStrongIndicators, ...foundMediumIndicators, ...foundWeakTerms].join(', ')}`,
      confidence: 0.85
    };
  }
  
  // Medium validation: At least one strong indicator
  if (strongIndicatorCount >= 1) {
    return {
      isValid: true,
      reason: `Crypto context found: ${foundStrongIndicators.join(', ')}`,
      confidence: 0.8
    };
  }
  
  // Medium-weak validation: Multiple medium indicators with crypto context
  if (mediumIndicatorCount >= 2) {
    const hasCryptoContext = searchText.includes('crypto') || 
                           searchText.includes('blockchain') || 
                           searchText.includes('trading') ||
                           searchText.includes('exchange');
    
    if (hasCryptoContext) {
      return {
        isValid: true,
        reason: `Medium crypto terms with context: ${foundMediumIndicators.join(', ')}`,
        confidence: 0.75
      };
    }
  }
  
  // Weak validation: Multiple weak terms with crypto context
  if (weakTermCount >= 2) {
    // Check if the weak terms appear in a crypto context
    const hasCryptoContext = searchText.includes('crypto') || 
                           searchText.includes('blockchain') || 
                           searchText.includes('digital asset') ||
                           searchText.includes('trading') ||
                           searchText.includes('exchange');
    
    if (hasCryptoContext) {
      return {
        isValid: true,
        reason: `Weak crypto terms with context: ${foundWeakTerms.join(', ')}`,
        confidence: 0.6
      };
    }
  }
  
  // SPECIFIC REJECTION PATTERNS
  
  // Reject articles about traditional "Optimism" that aren't about OP network
  if (searchText.includes('optimism') && !searchText.includes('op network') && 
      !searchText.includes('optimistic rollup') && !searchText.includes('layer 2')) {
    // Check if it's about market optimism, investor sentiment, etc.
    if (searchText.includes('investor') || searchText.includes('market sentiment') || 
        searchText.includes('economic') || searchText.includes('stock')) {
      return {
        isValid: false,
        reason: 'References general market optimism, not Optimism crypto network',
        confidence: 0.9
      };
    }
  }
  
  // Reject general financial articles that mention crypto tangentially
  if ((searchText.includes('stock') || searchText.includes('equity') || 
       searchText.includes('share price') || searchText.includes('earnings')) &&
      strongIndicatorCount === 0 && networkTermCount === 0) {
    return {
      isValid: false,
      reason: 'Traditional finance article with no strong crypto context',
      confidence: 0.85
    };
  }
  
  // If we get here, insufficient crypto context
  return {
    isValid: false,
    reason: `Insufficient crypto context. Found: ${[...foundStrongIndicators, ...foundMediumIndicators, ...foundNetworkTerms, ...foundWeakTerms].join(', ') || 'none'}`,
    confidence: 0.7
  };
}

/**
 * Log rejected articles for monitoring and improvement
 */
function logRejectedArticle(article, validation) {
  const logData = {
    timestamp: new Date().toISOString(),
    title: article.title?.substring(0, 100),
    source: article.source || 'Unknown',
    url: article.url,
    rejection_reason: validation.reason,
    confidence: validation.confidence,
    feed_url: article.metadata?.feedUrl
  };
  
  logger.info('🚫 REJECTED ARTICLE:', logData);
  
  // Could optionally write to a separate rejection log file
  // fs.appendFileSync('./logs/rejected_articles.json', JSON.stringify(logData) + '\n');
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateStringSimilarity(str1, str2) {
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const maxLen = Math.max(len1, len2);
  return 1 - matrix[len1][len2] / maxLen;
}

// Official network sources mapping
const OFFICIAL_NETWORK_SOURCES = {
  'Bitcoin': ['https://bitcoincore.org/en/news/', 'https://bitcoin.org/en/news', 'https://bitcoinmagazine.com'],
  'Ethereum': ['https://blog.ethereum.org', 'https://medium.com/ethereum-cat-herders'],
  'BNB Chain': ['https://bnbchain.org/en/blog', 'https://www.binance.com/en/blog', 'https://medium.com/binanceexchange'],
  'Solana': ['https://solana.com/news', 'https://medium.com/solana-labs'],
  'XRP': ['https://ripple.com/insights/', 'https://xrpl.org/blog', 'https://medium.com/xrplcommunity'],
  'Cardano': ['https://cardano.org/blog/', 'https://medium.com/cardano-foundation'],
  'Avalanche': ['https://avax.network/blog/', 'https://medium.com/avalancheavax'],
  'Dogecoin': ['https://dogecoin.com/blog/', 'https://dogecoin.com/news', 'https://medium.com/@dogecoin'],
  'TRON': ['https://tron.network/blog', 'https://tron.network/news', 'https://medium.com/tronnetwork'],
  'Polygon': ['https://polygon.technology/blog/', 'https://blog.polygon.technology', 'https://medium.com/polygon-technology'],
  'Chainlink': ['https://blog.chain.link/', 'https://medium.com/chainlink'],
  'Polkadot': ['https://polkadot.network/blog/', 'https://medium.com/polkadot-network'],
  'Cosmos': ['https://blog.cosmos.network/', 'https://medium.com/cosmos-network'],
  'Near Protocol': ['https://near.org/blog/'],
  'Stellar': ['https://stellar.org/blog', 'https://medium.com/stellar-development-foundation'],
  'Litecoin': ['https://litecoin.org/news', 'https://medium.com/@litecoin'],
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
  'Uniswap': ['https://uniswap.org/blog/', 'https://medium.com/uniswap'],
  'Curve': ['https://curve.fi/news'],
  'Fantom': ['https://fantom.foundation/blog/'],
  'Algorand': ['https://algorand.foundation/news', 'https://medium.com/algorand'],
  'Axie Infinity': ['https://axie.substack.com'],
  'The Graph': ['https://thegraph.com/blog/'],
  'Helium': ['https://helium.com/blog/'],
  'Filecoin': ['https://filecoin.io/blog/', 'https://medium.com/filecoin'],
  'Flow': ['https://flowverse.co/news'],
  'Theta Network': ['https://medium.com/theta-network', 'https://www.thetatoken.org/news'],
  'BitTorrent': ['https://bittorrent.com/blog/'],
  'Fetch.ai': ['https://fetch.ai/blog/'],
  'Monero': ['https://getmonero.org/blog/'],
  'Zcash': ['https://z.cash/blog/'],
  'VeChain': ['https://vechain.org/blog/', 'https://medium.com/@vechainofficial'],
  'Neo': ['https://medium.com/neo-smart-economy'],
  'Hedera': ['https://hedera.com/blog', 'https://medium.com/hedera', 'https://us7.campaign-archive.com/home/?u=56cac902d74c5bcbf6354cdb5&id=2e170d50c3'],
  'XDC Network': ['https://xdc.network/blog', 'https://medium.com/xdcnetwork'],
  'Constellation': ['https://constellationnetwork.io/blog', 'https://medium.com/constellationlabs'],
  'Internet Computer': ['https://medium.com/dfinity', 'https://dfinity.org/blog'],
  'Bitcoin Cash': ['https://bitcoincash.org/news', 'https://medium.com/@bitcoincash']
};

/**
 * Scrape news from official network sources
 */
async function scrapeNewsSources(network, source) {
  try {
    logger.info(`Scraping news from ${source} for ${network}`);
    
    const response = await axios.get(source, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const articles = [];

    // Generic scraping logic - can be customized per source
    $('article, .post, .entry, .blog-post').each((i, element) => {
      try {
        const title = $(element).find('h1, h2, h3, .title, .post-title').first().text().trim();
        const content = $(element).find('.content, .post-content, .entry-content, p').first().text().trim();
        const url = $(element).find('a').first().attr('href');
        const publishedAt = $(element).find('time, .date, .published').first().attr('datetime') || 
                           $(element).find('time, .date, .published').first().text().trim();

        if (title && content && url) {
          // Make URL absolute if it's relative
          const absoluteUrl = url.startsWith('http') ? url : new URL(url, source).href;
          
          articles.push({
            title,
            content: content.substring(0, 500), // Limit content length
            url: absoluteUrl,
            network,
            source: {
              name: network,
              domain: new URL(source).hostname
            },
            publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
            category: 'general',
            tags: [network.toLowerCase()],
            isActive: true
          });
        }
      } catch (error) {
        logger.warn(`Error parsing article ${i}:`, error.message);
      }
    });

    // Save articles to database
    const savedArticles = [];
    for (const article of articles) {
      try {
        // Check if article already exists
        const existingArticle = await News.findOne({ url: article.url });
        if (!existingArticle) {
          const savedArticle = await News.create(article);
          savedArticles.push(savedArticle);
        }
      } catch (error) {
        logger.warn(`Error saving article:`, error.message);
      }
    }

    logger.info(`Successfully scraped ${savedArticles.length} articles from ${source}`);
    return savedArticles;

  } catch (error) {
    logger.error(`Error scraping ${source}:`, error.message);
    throw new Error(`Failed to scrape ${source}: ${error.message}`);
  }
}

/**
 * Perform web search for crypto-related content
 * DISABLED: This function previously created example articles with '#' URLs
 * Real articles come from RSS feeds only
 */
async function performWebSearch(query, network = null) {
  try {
    logger.info(`Web search disabled to prevent example articles. Query: ${query}`);
    
    // Return empty array to prevent example articles
    // Real articles are fetched from RSS feeds in fetchRealCryptoNews()
    return [];
    
  } catch (error) {
    logger.error(`Error in web search function:`, error.message);
    throw new Error(`Failed to perform web search: ${error.message}`);
  }
}

/**
 * Scrape press releases for a specific network
 */
async function scrapePressReleases(network) {
  try {
    logger.info(`Scraping press releases for ${network}`);
    
    const sources = OFFICIAL_NETWORK_SOURCES[network] || [];
    if (sources.length === 0) {
      throw new Error(`No official sources found for ${network}`);
    }

    const allPressReleases = [];

    for (const source of sources) {
      try {
        const response = await axios.get(source, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });

        const $ = cheerio.load(response.data);
        
        // Look for press release indicators
        $('article, .post, .entry, .blog-post, .press-release').each((i, element) => {
          try {
            const title = $(element).find('h1, h2, h3, .title, .post-title').first().text().trim();
            const content = $(element).find('.content, .post-content, .entry-content, p').first().text().trim();
            const url = $(element).find('a').first().attr('href');
            const publishedAt = $(element).find('time, .date, .published').first().attr('datetime') || 
                               $(element).find('time, .date, .published').first().text().trim();

            if (title && content && url) {
              const absoluteUrl = url.startsWith('http') ? url : new URL(url, source).href;
              
              allPressReleases.push({
                title,
                content: content.substring(0, 500),
                url: absoluteUrl,
                network,
                source: {
                  name: network,
                  domain: new URL(source).hostname
                },
                publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
                category: 'press-release',
                tags: [network.toLowerCase(), 'press-release'],
                isActive: true,
                curation: {
                  isCurated: true,
                  quality: 'high'
                }
              });
            }
          } catch (error) {
            logger.warn(`Error parsing press release ${i}:`, error.message);
          }
        });

      } catch (error) {
        logger.warn(`Error scraping ${source}:`, error.message);
      }
    }

    // Save press releases to database
    const savedPressReleases = [];
    for (const pressRelease of allPressReleases) {
      try {
        const existingPressRelease = await News.findOne({ url: pressRelease.url });
        if (!existingPressRelease) {
          const savedPressRelease = await News.create(pressRelease);
          savedPressReleases.push(savedPressRelease);
        }
      } catch (error) {
        logger.warn(`Error saving press release:`, error.message);
      }
    }

    logger.info(`Successfully scraped ${savedPressReleases.length} press releases for ${network}`);
    return savedPressReleases;

  } catch (error) {
    logger.error(`Error scraping press releases for ${network}:`, error.message);
    throw new Error(`Failed to scrape press releases for ${network}: ${error.message}`);
  }
}

/**
 * Get breaking news based on various criteria
 */
async function getBreakingNews() {
  try {
    // Look for articles with high engagement, recent publication, and breaking indicators
    const breakingNews = await News.find({
      isActive: true,
      publishedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
      $or: [
        { 'engagement.views': { $gte: 1000 } },
        { 'engagement.shares': { $gte: 100 } },
        { score: { $gte: 90 } }
      ]
    })
    .sort({ publishedAt: -1 })
    .limit(10);

    return breakingNews;
  } catch (error) {
    logger.error('Error fetching breaking news:', error.message);
    throw new Error(`Failed to fetch breaking news: ${error.message}`);
  }
}

/**
 * Update news scores based on engagement and recency
 */
async function updateNewsScores() {
  try {
    const articles = await News.find({ isActive: true });
    
    for (const article of articles) {
      const ageInHours = (Date.now() - article.publishedAt.getTime()) / (1000 * 60 * 60);
      const engagementScore = (article.engagement.views * 0.1) + 
                             (article.engagement.shares * 0.5) + 
                             (article.engagement.comments * 0.2);
      
      // Decay score based on age
      const timeDecay = Math.max(0.1, 1 - (ageInHours / 168)); // 1 week = 168 hours
      
      article.score = Math.min(100, Math.max(0, Math.round(engagementScore * timeDecay)));
      await article.save();
    }

    logger.info(`Updated scores for ${articles.length} articles`);
  } catch (error) {
    logger.error('Error updating news scores:', error.message);
  }
}

/**
 * Enhance articles with card-optimized images
 */
/**
 * Scrape article image from the actual article URL
 */
async function scrapeArticleImage(articleUrl) {
  try {
    const axios = require('axios');
    const cheerio = require('cheerio');
    
    logger.info(`Scraping image from: ${articleUrl}`);
    
    // Fetch the article page with redirect handling
    const response = await axios.get(articleUrl, {
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Log the final URL after redirects
    logger.info(`Final URL after redirects: ${response.request.res.responseUrl || articleUrl}`);
    
    // Look for common image patterns in news articles
    let imageUrl = null;
    
    // Try different selectors for news article images
    const selectors = [
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'img[class*="article"]',
      'img[class*="hero"]',
      'img[class*="featured"]',
      'img[class*="main"]',
      'img[class*="lead"]',
      'img[src*="im-"]', // Wall Street Journal pattern
      'img[src*="images.wsj.net"]', // WSJ specific
      'img[src*="media"]',
      'img[src*="cdn"]',
      'img[src*="static"]'
    ];
    
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length) {
        if (selector.includes('meta')) {
          imageUrl = element.attr('content');
        } else {
          imageUrl = element.attr('src') || element.attr('data-src');
        }
        
        if (imageUrl) {
          // Convert relative URLs to absolute
          if (imageUrl.startsWith('//')) {
            imageUrl = 'https:' + imageUrl;
          } else if (imageUrl.startsWith('/')) {
            const urlObj = new URL(articleUrl);
            imageUrl = urlObj.origin + imageUrl;
          }
          
          // Validate that it's a real image URL
          if (imageUrl.includes('.jpg') || imageUrl.includes('.png') || imageUrl.includes('.webp') || imageUrl.includes('im-')) {
            logger.info(`Found image: ${imageUrl}`);
            return imageUrl;
          }
        }
      }
    }
    
    logger.warn(`No suitable image found for: ${articleUrl}`);
    return null;
    
  } catch (error) {
    logger.error(`Error scraping image from ${articleUrl}:`, error.message);
    return null;
  }
}

async function enhanceArticlesWithImages(articles) {
  try {
    logger.info(`Enhancing ${articles.length} articles with card images`);
    
    const enhancedArticles = [];
    
    for (const article of articles) {
      try {
        // Generate card images for the article - prioritize RSS images when available
        let cardImages;
        let coverImage = article.cover_image;
        
        // Check if article has good RSS image from reliable sources
        const hasGoodRSSImage = article.cover_image && 
          (article.cover_image.includes('cimg.co') || 
           article.cover_image.includes('media.crypto.news') ||
           article.cover_image.includes('cryptonews.com') ||
           article.cover_image.includes('assets.beincrypto.com') ||
           article.cover_image.includes('static.cryptobriefing.com') ||
           article.cover_image.includes('cryptoslate.com') ||
           article.cover_image.includes('images.cointelegraph.com'));

        // Enhanced Google News article detection for image scraping
        const isGoogleNewsArticle = !hasGoodRSSImage && (
          (article.metadata && article.metadata.feedUrl && article.metadata.feedUrl.includes('news.google.com')) ||
          (article.google_news_url && article.google_news_url.includes('news.google.com')) ||
          (article.source && 
           (article.source.includes('Google News') || 
            article.source.includes('" - Google News'))) ||
          // Enhanced generic image detection
          (article.cover_image && (
           article.cover_image.includes('placeholder') || 
           article.cover_image.includes('via.placeholder') ||
           isGenericGoogleImage(article.cover_image))));

        // CryptoNews.com images should work from RSS enclosure - no URL extraction needed

        if (isGoogleNewsArticle) {
          // Use enhanced Google News image extraction
          try {
            logger.info(`Attempting enhanced Google News image extraction for: ${article.title.substring(0, 50)}...`);
            
            // Get RSS content if available
            const rssContent = article.rss_item ? article.rss_item['content:encoded'] : null;
            
            // Use the enhanced Google News image extraction
            const extractedImages = await extractGoogleNewsImages(article.url, rssContent);
            
            if (extractedImages && extractedImages.length > 0) {
              // Filter out generic Google images
              const nonGenericImages = extractedImages.filter(img => !isGenericGoogleImage(img.url));
              
              if (nonGenericImages.length > 0) {
                // Use the best non-generic image
                const bestImage = nonGenericImages[0];
                const optimizedImage = `https://images.weserv.nl/?url=${encodeURIComponent(bestImage.url)}&w=400&h=225&fit=cover&output=jpg&q=85`;
                
                cardImages = {
                  small: `https://images.weserv.nl/?url=${encodeURIComponent(bestImage.url)}&w=300&h=169&fit=cover&output=jpg&q=85`,
                  medium: optimizedImage,
                  large: `https://images.weserv.nl/?url=${encodeURIComponent(bestImage.url)}&w=500&h=281&fit=cover&output=jpg&q=85`,
                  square: `https://images.weserv.nl/?url=${encodeURIComponent(bestImage.url)}&w=300&h=300&fit=cover&output=jpg&q=85`
                };
                coverImage = optimizedImage;
                
                // Mark as having real image
                article.has_real_image = true;
                
                logger.info(`Enhanced extraction found real image from ${bestImage.source}: ${bestImage.url}`);
              } else if (extractedImages.length > 0) {
                // If we only got generic images, try secondary extraction
                logger.info(`Only generic images found, attempting secondary extraction`);
                const secondaryImages = await secondaryImageExtraction(article.url, extractedImages);
                const nonGenericSecondary = secondaryImages.filter(img => !isGenericGoogleImage(img.url));
                
                if (nonGenericSecondary.length > 0) {
                  const bestSecondaryImage = nonGenericSecondary[0];
                  const optimizedImage = `https://images.weserv.nl/?url=${encodeURIComponent(bestSecondaryImage.url)}&w=400&h=225&fit=cover&output=jpg&q=85`;
                  
                  cardImages = {
                    small: `https://images.weserv.nl/?url=${encodeURIComponent(bestSecondaryImage.url)}&w=300&h=169&fit=cover&output=jpg&q=85`,
                    medium: optimizedImage,
                    large: `https://images.weserv.nl/?url=${encodeURIComponent(bestSecondaryImage.url)}&w=500&h=281&fit=cover&output=jpg&q=85`,
                    square: `https://images.weserv.nl/?url=${encodeURIComponent(bestSecondaryImage.url)}&w=300&h=300&fit=cover&output=jpg&q=85`
                  };
                  coverImage = optimizedImage;
                  
                  // Mark as having real image
                  article.has_real_image = true;
                  
                  logger.info(`Secondary extraction found real image: ${bestSecondaryImage.url}`);
                } else {
                  // Still only generic images, no real images available
                  logger.warn(`Secondary extraction also yielded only generic images for: ${article.title.substring(0, 50)}`);
                  cardImages = null;
                  coverImage = null;
                  article.has_real_image = false;
                }
              } else {
                logger.warn(`No images found for Google News article: ${article.title.substring(0, 50)}`);
                cardImages = null;
                coverImage = null;
                article.has_real_image = false;
              }
            } else {
              logger.warn(`Enhanced extraction failed for: ${article.title.substring(0, 50)}`);
              cardImages = null;
              coverImage = null;
              article.has_real_image = false;
            }
          } catch (enhancedError) {
            logger.warn(`Enhanced Google News extraction failed for ${article.url}:`, enhancedError.message);
            // No fallback image generation - use null when extraction fails
            cardImages = null;
            coverImage = null;
            article.has_real_image = false;
          }
        } else if (article.cover_image) {
          // Clean up malformed URLs by extracting the original image URL
          let originalImageUrl = article.cover_image;
          
          // Handle multiple levels of encoding by decoding recursively
          while (originalImageUrl.includes('%3A%2F%2F') || originalImageUrl.includes('%252F')) {
            try {
              originalImageUrl = decodeURIComponent(originalImageUrl);
            } catch (e) {
              break; // Stop if decoding fails
            }
          }
          
          // If we have a clean original URL, use it; otherwise use the current URL
          if (originalImageUrl && !originalImageUrl.includes('images.weserv.nl')) {
            // Check if the original URL looks like a valid news image
            const isValidNewsImage = originalImageUrl.includes('media.') || 
                                   originalImageUrl.includes('cdn.') || 
                                   originalImageUrl.includes('static.') ||
                                   originalImageUrl.includes('.jpg') ||
                                   originalImageUrl.includes('.png') ||
                                   originalImageUrl.includes('.webp');
            
            if (isValidNewsImage) {
              // Use original RSS image and enhance with weserv.nl optimization
              const optimizedImage = `https://images.weserv.nl/?url=${encodeURIComponent(originalImageUrl)}&w=400&h=225&fit=cover&output=jpg&q=85`;
              cardImages = {
                small: `https://images.weserv.nl/?url=${encodeURIComponent(originalImageUrl)}&w=300&h=169&fit=cover&output=jpg&q=85`,
                medium: optimizedImage,
                large: `https://images.weserv.nl/?url=${encodeURIComponent(originalImageUrl)}&w=500&h=281&fit=cover&output=jpg&q=85`,
                square: `https://images.weserv.nl/?url=${encodeURIComponent(originalImageUrl)}&w=300&h=300&fit=cover&output=jpg&q=85`
              };
              coverImage = optimizedImage;
            } else {
              // Invalid image URL, no fallback generation
              cardImages = null;
              coverImage = null;
            }
          } else {
            // Image is already processed or we couldn't clean it, use as-is
            coverImage = article.cover_image;
            cardImages = {
              small: article.cover_image,
              medium: article.cover_image,
              large: article.cover_image,
              square: article.cover_image
            };
          }
        } else {
          // No RSS images available - don't generate placeholder images
          cardImages = null;
          coverImage = null;
        }
        
        // Determine if this is a real scraped/RSS image vs generated
        const hasRealImage = coverImage && 
          !coverImage.includes('placeholder') && 
          !coverImage.includes('generated') &&
          !coverImage.includes('default') &&
          (coverImage.includes('http') || coverImage.includes('https'));

        // Add image data to article
        const enhancedArticle = {
          ...article,
          card_images: cardImages,
          cover_image: coverImage,
          has_real_image: hasRealImage,
          image_optimized: true
        };
        
        // Update database with cover image if article has ID
        if (article.id) {
          try {
            const { updateArticleCoverImage } = require('../config/supabase');
            await updateArticleCoverImage(article.id, cardImages.medium);
          } catch (updateError) {
            logger.warn(`Failed to update cover image for article ${article.id}:`, updateError.message);
          }
        }
        
        enhancedArticles.push(enhancedArticle);
        
        // Small delay to avoid overwhelming image processing
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        logger.warn(`Failed to enhance article ${article.id || article.title} with images:`, error.message);
        // Include article without enhancement
        enhancedArticles.push({
          ...article,
          has_real_image: false,
          image_optimized: false
        });
      }
    }
    
    logger.info(`Successfully enhanced ${enhancedArticles.length} articles with images`);
    return enhancedArticles;
    
  } catch (error) {
    logger.error('Error enhancing articles with images:', error.message);
    logger.error('Error details:', error.stack || error);
    return articles; // Return original articles if enhancement fails
  }
}

/**
 * Fetch real news from RSS feeds
 */
async function fetchRealCryptoNews() {
  try {
    logger.info('Fetching real crypto news from RSS feeds');
    
    const rssFeeds = [
      // Top crypto news sources (minimal set for reliable deployment)
      'https://www.coindesk.com/arc/outboundfeeds/rss/',
      'https://cointelegraph.com/rss',
      'https://cryptoslate.com/feed/',
      'https://beincrypto.com/feed/',
      'https://cryptodaily.co.uk/feed/',
      
      // Client network searches - comprehensive coverage
      'https://news.google.com/rss/search?q=Hedera+cryptocurrency+OR+HBAR+crypto&hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q="XDC+Network"+cryptocurrency+OR+"XDC+token"&hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q=Algorand+cryptocurrency+OR+ALGO+crypto&hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q="Constellation+Network"+cryptocurrency+OR+DAG+crypto&hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q=HashPack+wallet+OR+"HashPack+Hedera"&hl=en-US&gl=US&ceid=US:en'
    ];

    const allArticles = [];

    for (const feedUrl of rssFeeds) {
      try {
        logger.info(`Parsing RSS feed: ${feedUrl}`);
        const feed = await parser.parseURL(feedUrl);
        
        const articles = await Promise.all(feed.items.slice(0, 10).map(async (item) => {
          try {
            // Enhanced crypto content validation using new validateCryptoContent function
            const title = item.title || '';
            const content = item.content || item.summary || item.description || '';
            const source = item.source || feedUrl;
            
            // Get the original URL
            let articleUrl = item.link || item.url || '';
            let originalUrl = articleUrl;
            let resolvedSource = source;
            
            // If this is a Google News URL, resolve it to the original source
            if (articleUrl.includes('news.google.com')) {
              try {
                console.log(`🔗 Resolving Google News URL: ${articleUrl.substring(0, 80)}...`);
                originalUrl = await resolveGoogleNewsUrl(articleUrl);
                
                if (originalUrl !== articleUrl) {
                  console.log(`✅ Resolved to source: ${new URL(originalUrl).hostname}`);
                  
                  // Extract the source domain from resolved URL
                  const resolvedDomain = new URL(originalUrl).hostname;
                  resolvedSource = `${resolvedDomain} (via Google News)`;
                  
                  // Update the article URL to use the resolved source
                  articleUrl = originalUrl;
                } else {
                  console.log(`⚠️ Could not resolve Google News URL, using original`);
                }
              } catch (error) {
                console.log(`❌ Error resolving Google News URL: ${error.message}`);
                // Continue with original URL if resolution fails
              }
            }
            
            // Check resolved URL for WSJ content (now this will catch WSJ sources!)
            if (articleUrl.includes('wsj.com') || articleUrl.includes('wall-street-journal') || 
                title.toLowerCase().includes('wall street journal') ||
                resolvedSource.toLowerCase().includes('wall street journal')) {
              logRejectedArticle({
                title,
                url: articleUrl,
                source: resolvedSource,
                content: content.substring(0, 200)
              }, {
                isValid: false,
                reason: 'WSJ article blocked - no WSJ content allowed',
                confidence: 1.0
              });
              console.log(`🚫 WSJ BLOCKED: "${title.substring(0, 50)}..." - No WSJ articles allowed`);
              return null; // Mark for filtering
            }
            
            // Use the comprehensive validation function
            const validation = validateCryptoContent(title, content, resolvedSource);
          
          if (!validation.isValid) {
            // Log rejected article with detailed reason
            logRejectedArticle({
              title,
              source: source,
              url: item.link,
              metadata: { feedUrl }
            }, validation);
            
            console.log(`🚫 REJECTED: "${title.substring(0, 50)}..." - ${validation.reason}`);
            return false; // Skip this article
          }
          
          // Additional validation for Google News articles (stricter requirements)
          if (feedUrl.includes('news.google.com')) {
            // Google News articles need higher confidence or multiple crypto indicators
            if (validation.confidence < 0.8) {
              logRejectedArticle({
                title,
                source: source,
                url: item.link,
                metadata: { feedUrl }
              }, {
                ...validation,
                reason: `Google News: ${validation.reason} (confidence too low: ${validation.confidence})`
              });
              
              console.log(`🚫 GOOGLE NEWS REJECTED: "${title.substring(0, 50)}..." - Low confidence (${validation.confidence})`);
              return false;
            }
            
            // Extra validation for "optimism" articles from Google News
            const searchText = `${title} ${content}`.toLowerCase();
            if (searchText.includes('optimism') && !searchText.includes('op network') && 
                !searchText.includes('optimistic rollup') && !searchText.includes('layer 2')) {
              // For Google News, be extra strict about optimism articles
              const hasTraditionalFinanceContext = searchText.includes('investor') || 
                                                 searchText.includes('market') || 
                                                 searchText.includes('rate') ||
                                                 searchText.includes('stock') ||
                                                 searchText.includes('nasdaq');
              
              if (hasTraditionalFinanceContext) {
                logRejectedArticle({
                  title,
                  source: source,
                  url: item.link,
                  metadata: { feedUrl }
                }, {
                  isValid: false,
                  reason: 'Google News: Traditional finance "optimism" article, not Optimism network',
                  confidence: 0.95
                });
                
                console.log(`🚫 GOOGLE NEWS OPTIMISM REJECTED: "${title.substring(0, 50)}..." - Traditional finance context`);
                return false;
              }
            }
          }
          
          console.log(`✅ APPROVED: "${title.substring(0, 50)}..." - ${validation.reason} (confidence: ${validation.confidence})`);
          
          // Return the processed item with resolved URL
          return {
            ...item,
            link: articleUrl, // Use resolved URL
            originalLink: item.link, // Keep original for reference
            resolvedSource: resolvedSource,
            isGoogleNewsResolved: originalUrl !== (item.link || item.url || '')
          };
        } catch (error) {
          console.log(`❌ Error processing article: ${error.message}`);
          return null;
        }
      }));
      
      // Filter out null results and map to final article format
      console.log(`🔍 DEBUG: Feed ${feedUrl} - Raw articles: ${articles.length}, Non-null: ${articles.filter(item => item !== null).length}`);
      const validArticles = articles.filter(item => item !== null).map(item => {
          // Extract network from title/content
          const title = item.title || '';
          const content = item.content || item.summary || item.description || '';
          
          let network = 'General';
          
          // Comprehensive network detection with CLIENT NETWORKS PRIORITIZED
          const networkKeywords = {
            // 🌟 CLIENT NETWORKS - CHECKED FIRST FOR PRIORITY
            'Hedera': ['hedera', 'hbar', 'hedera hashgraph', 'hedera network', 'hashgraph'],
            'XDC Network': ['xdc network', 'xdc token', 'xdc', 'xinfin', 'xinfin network'],
            'Algorand': ['algorand', 'algo', 'algorand network', 'algorand foundation'],
            'Constellation': ['constellation network', 'constellation labs', 'dag constellation', '$dag'],
            'HashPack': ['hashpack', 'hash pack', 'pack token', 'hashpack wallet'],
            
            // Major Networks
            'Bitcoin': ['bitcoin', 'btc', 'bitcoin core', 'bitcoin network'],
            'Ethereum': ['ethereum', 'eth', 'ether', 'ethereum network', 'eth2', 'ethereum 2.0'],
            'BNB Chain': ['bnb', 'binance coin', 'bnb chain', 'binance smart chain', 'bsc'],
            'Solana': ['solana', 'sol', 'solana network'],
            'Cardano': ['cardano', 'ada', 'cardano network'],
            'XRP': ['xrp', 'ripple', 'ripple network', 'xrp ledger'],
            'Dogecoin': ['dogecoin', 'doge', 'dogecoin network'],
            'Polygon': ['polygon', 'matic', 'polygon network', 'polygon matic'],
            'Avalanche': ['avalanche', 'avax', 'avalanche network'],
            'Chainlink': ['chainlink', 'chainlink network', 'chainlink oracle'],
            'Polkadot': ['polkadot', 'dot', 'polkadot network'],
            'Cosmos': ['cosmos', 'atom', 'cosmos network', 'cosmos hub'],
            'Near Protocol': ['near', 'near protocol', 'near network'],
            'Stellar': ['stellar', 'xlm', 'stellar network', 'stellar lumens'],
            'Litecoin': ['litecoin', 'ltc', 'litecoin network'],
            'Aave': ['aave', 'aave protocol', 'aave network'],
            'Cronos': ['cronos', 'cro', 'cronos network'],
            'Arbitrum': ['arbitrum', 'arb', 'arbitrum network'],
            'Optimism': ['op', 'optimism network'],
            'Injective': ['injective', 'inj', 'injective protocol'],
            'Celestia': ['celestia', 'tia', 'celestia network'],
            'Sui': ['sui', 'sui network', 'sui blockchain'],
            'Aptos': ['aptos', 'apt', 'aptos network'],
            'Shardeum': ['shardeum', 'shard', 'shardeum network'],
            'Immutable X': ['immutable x', 'imx', 'immutable'],
            'The Sandbox': ['sandbox', 'sand', 'the sandbox'],
            'Decentraland': ['decentraland', 'mana', 'decentraland network'],
            'MakerDAO': ['makerdao', 'mkr', 'maker', 'dai'],
            'Uniswap': ['uniswap', 'uni', 'uniswap protocol'],
            'Curve': ['curve', 'crv', 'curve finance'],
            'Fantom': ['fantom', 'ftm', 'fantom network'],
            'Axie Infinity': ['axie infinity', 'axie', 'axs'],
            'The Graph': ['the graph', 'graph', 'grt'],
            'Helium': ['helium', 'hnt', 'helium network'],
            'Filecoin': ['filecoin', 'fil', 'filecoin network'],
            'Flow': ['flow', 'flow network', 'flow blockchain'],
            'Theta Network': ['theta network', 'theta', 'tfuel'],
            'BitTorrent': ['bittorrent', 'btt', 'bittorrent network'],
            'Fetch.ai': ['fetch.ai', 'fetch', 'fet'],
            'Monero': ['monero', 'xmr', 'monero network'],
            'Zcash': ['zcash', 'zec', 'zcash network'],
            'VeChain': ['vechain', 'vet', 'vechain network'],
            'Neo': ['neo', 'neo network', 'neo blockchain'],
            'Internet Computer': ['internet computer', 'icp', 'dfinity'],
            'Bitcoin Cash': ['bitcoin cash', 'bch', 'bitcoin cash network']
          };
          
          // Check for network keywords in title and content with crypto context validation
          const searchText = (title + ' ' + content).toLowerCase();
          
          // Crypto context keywords to ensure articles are actually about cryptocurrency/blockchain
          // Network detection (crypto context already validated in filter)
          for (const [networkName, keywords] of Object.entries(networkKeywords)) {
            for (const keyword of keywords) {
              if (searchText.includes(keyword.toLowerCase())) {
                network = networkName;
                console.log(`✅ Network detected: ${network} (keyword: "${keyword}")`);
                break;
              }
            }
            if (network !== 'General') break;
          }

          // Determine category
          let category = 'general';
          if (title.toLowerCase().includes('price') || title.toLowerCase().includes('market') || title.toLowerCase().includes('trading')) {
            category = 'market';
          } else if (title.toLowerCase().includes('regulation') || title.toLowerCase().includes('sec') || title.toLowerCase().includes('legal')) {
            category = 'regulation';
          } else if (title.toLowerCase().includes('technology') || title.toLowerCase().includes('blockchain') || title.toLowerCase().includes('upgrade')) {
            category = 'technology';
          }


          // Determine if breaking news
          const isBreaking = title.toLowerCase().includes('breaking') || 
                            title.toLowerCase().includes('urgent') ||
                            title.toLowerCase().includes('alert') ||
                            (new Date() - new Date(item.pubDate)) < 2 * 60 * 60 * 1000; // Last 2 hours

          // Extract images from RSS item with enhanced crypto.news support
          let imageUrl = null;
          
          // Debug RSS item structure for crypto.news
          if (feedUrl.includes('crypto.news')) {
            console.log('🔍 Crypto.news RSS item structure:', {
              title: title.substring(0, 50),
              enclosure: item.enclosure,
              mediaContent: item['media:content'],
              mediaThumbnail: item['media:thumbnail'],
              image: item.image,
              guid: item.guid
            });
          }
          
          // Enhanced image extraction with more robust checking
          // Priority order: enclosure, media:content, media:thumbnail, other sources
          
          // 1. Enclosure (highest priority for RSS feeds)
          if (item.enclosure) {
            if (typeof item.enclosure === 'string') {
              imageUrl = item.enclosure;
            } else if (item.enclosure.url && item.enclosure.type && item.enclosure.type.includes('image')) {
              imageUrl = item.enclosure.url;
            } else if (Array.isArray(item.enclosure)) {
              const imageEnclosure = item.enclosure.find(enc => enc.type && enc.type.includes('image'));
              if (imageEnclosure && imageEnclosure.url) {
                imageUrl = imageEnclosure.url;
              }
            }
            if (imageUrl) console.log('📷 Using enclosure image:', imageUrl);
          }
          
          // 2. media:content (common in many feeds)
          if (!imageUrl && item['media:content']) {
            if (typeof item['media:content'] === 'string') {
              imageUrl = item['media:content'];
            } else if (item['media:content'].url) {
              imageUrl = item['media:content'].url;
            } else if (item['media:content'].$ && item['media:content'].$.url) {
              imageUrl = item['media:content'].$.url;
            } else if (Array.isArray(item['media:content'])) {
              const imageContent = item['media:content'].find(mc => mc.$ && mc.$.medium === 'image');
              if (imageContent && imageContent.$.url) {
                imageUrl = imageContent.$.url;
              }
            }
            if (imageUrl) console.log('📷 Using media:content image:', imageUrl);
          }
          
          // 3. media:thumbnail
          if (!imageUrl && item['media:thumbnail']) {
            if (typeof item['media:thumbnail'] === 'string') {
              imageUrl = item['media:thumbnail'];
            } else if (item['media:thumbnail'].url) {
              imageUrl = item['media:thumbnail'].url;
            } else if (item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
              imageUrl = item['media:thumbnail'].$.url;
            }
            if (imageUrl) console.log('📷 Using media:thumbnail image:', imageUrl);
          }
          
          // 4. Other image sources
          if (!imageUrl && item.image && item.image.url) {
            imageUrl = item.image.url;
            console.log('📷 Using item.image.url:', imageUrl);
          }
          
          if (!imageUrl && item['itunes:image'] && item['itunes:image'].href) {
            imageUrl = item['itunes:image'].href;
            console.log('📷 Using iTunes image:', imageUrl);
          }
          
          // Debug logging for specific sources
          if (!imageUrl && (feedUrl.includes('cryptodaily.co.uk') || feedUrl.includes('cryptoslate.com') || feedUrl.includes('cryptonews.com'))) {
            console.log(`❌ No image extracted for ${new URL(feedUrl).hostname}:`, {
              title: title.substring(0, 50),
              enclosure: item.enclosure,
              mediaContent: item['media:content'],
              mediaThumbnail: item['media:thumbnail']
            });
          }
          
          // Validate and clean image URL
          if (imageUrl) {
            // Ensure URL is absolute
            if (imageUrl.startsWith('//')) {
              imageUrl = 'https:' + imageUrl;
            } else if (imageUrl.startsWith('/')) {
              const baseUrl = new URL(feedUrl).origin;
              imageUrl = baseUrl + imageUrl;
            }
            
            // Validate image URL format - be more permissive for trusted RSS sources
            const trustedImageDomains = [
              'cimg.co', 'cryptoslate.com', 'livebitcoinnews.com', 'coincentral.com', 
              'images.cryptodaily.co.uk', 'images.cointelegraph.com', 'assets.beincrypto.com',
              'cdn.sanity.io', 'coindesk.com', 'cryptonews.com', 'cryptopotato.com'
            ];
            const hasKnownDomain = trustedImageDomains.some(domain => imageUrl.includes(domain));
            
            // Only reject if it's clearly not an image and from unknown source
            if (!imageUrl.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i) && !hasKnownDomain) {
              console.log(`⚠️ Potentially invalid image URL: ${imageUrl}`);
              imageUrl = null; // Clear invalid URLs
            } else if (hasKnownDomain) {
              const domain = trustedImageDomains.find(d => imageUrl.includes(d));
              console.log(`✅ Trusted RSS image from ${domain}: ${imageUrl}`);
            }
          }
          
          if (!imageUrl && feedUrl.includes('crypto.news')) {
            console.log('❌ No image found for crypto.news article:', title.substring(0, 50));
          }

          // Enhanced source extraction - use resolved data if available
          let sourceExtraction = item.resolvedSource || feed.title || new URL(feedUrl).hostname;
          let originalUrl = item.link; // This is now the resolved URL
          let cleanTitle = title;
          
          // Extract original source from Google News titles and URLs
          if (feedUrl.includes('news.google.com')) {
            // If we have resolved source data, use it
            if (item.resolvedSource && item.isGoogleNewsResolved) {
              sourceExtraction = item.resolvedSource;
              console.log(`🎯 Using resolved source: ${sourceExtraction}`);
            } else {
              // Fallback to title extraction
              const titleMatch = title.match(/^(.+)\s-\s([^-]+)$/);
              if (titleMatch && titleMatch[2]) {
                sourceExtraction = titleMatch[2].trim();
                // Clean up title by removing source
                cleanTitle = titleMatch[1].trim();
              }
            }
            
            // originalUrl is already resolved, no need to extract again
            console.log(`✅ Using resolved URL: ${originalUrl.substring(0, 80)}...`);
          }

          // Create base article object
          const baseArticle = {
            title: cleanTitle,
            content: content.substring(0, 300),
            summary: content.substring(0, 200),
            url: originalUrl, // Use original URL when available
            google_news_url: feedUrl.includes('news.google.com') ? item.link : null, // Keep Google News URL for reference
            source: sourceExtraction,
            author: item.creator || item.author || 'Unknown',
            published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
            publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
            category: category,
            network: network,
            tags: [network.toLowerCase(), category],
            sentiment: 'neutral',
            impact: 'medium',
            is_breaking: isBreaking,
            isBreaking: isBreaking,
            is_verified: true,
            view_count: Math.floor(Math.random() * 500) + 50,
            share_count: Math.floor(Math.random() * 100) + 10,
            image_url: imageUrl, // RSS image URL
            cover_image: imageUrl || null, // RSS cover image, null if not available
            extracted_images: [],
            needs_image_generation: !imageUrl, // Flag articles that need generated images
            metadata: {
              feedUrl: feedUrl,
              feedTitle: feed.title
            },
            rssItem: item // Pass the full RSS item for image extraction
          };

          const viralScore = calculateViralScore(baseArticle);
          
          // Add enhanced fields
          const enhancedArticle = {
            ...baseArticle,
            viral_score: viralScore,
            readability_score: calculateReadabilityScore(content),
            is_viral: viralScore >= 75,
            engagement_potential: viralScore >= 85 ? 'high' : viralScore >= 65 ? 'medium' : 'low',
            seo_optimized: true,
            google_ads_ready: true,
            original_content: content,
            needs_rewrite: viralScore < 70 // Flag articles that could benefit from AI rewriting
          };
          
          // CRITICAL: Filter out articles older than 4 days BEFORE storing
          const articleDate = new Date(enhancedArticle.published_at);
          const fourDaysAgo = new Date();
          fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
          
          if (articleDate < fourDaysAgo) {
            console.log(`🚫 REJECTED OLD ARTICLE: "${enhancedArticle.title.substring(0, 50)}..." - Published ${articleDate.toISOString()} (older than 4 days)`);
            return null; // Filter out old articles
          }
          
          console.log(`✅ FRESH ARTICLE: "${enhancedArticle.title.substring(0, 50)}..." - Published ${articleDate.toISOString()}`);
          return enhancedArticle;
        });

        // Filter out null articles (old articles that were rejected)
        const filteredValidArticles = validArticles.filter(article => article !== null);
        allArticles.push(...filteredValidArticles);
        logger.info(`Parsed ${filteredValidArticles.length} articles from ${feed.title || feedUrl}`);
        
      } catch (feedError) {
        logger.error(`Error parsing RSS feed ${feedUrl}:`, feedError.message);
      }
    }

    // Remove duplicate articles based on URL and title similarity
    const uniqueArticles = [];
    const seenUrls = new Set();
    const seenTitles = new Set();
    
    for (const article of allArticles) {
      // Skip null articles
      if (!article || typeof article !== 'object') {
        continue;
      }
      
      // Normalize URL by removing parameters and fragments
      const normalizedUrl = article.url ? article.url.split('?')[0].split('#')[0] : '';
      
      // Skip if normalized URL is already seen
      if (seenUrls.has(normalizedUrl)) {
        console.log(`🔄 Skipping duplicate URL: ${article.title ? article.title.substring(0, 50) : 'Unknown'}...`);
        continue;
      }
      
      // Enhanced duplicate detection: check titles and content similarity
      const cleanTitle = article.title 
        ? article.title
            .replace(/\s-\s[^-]+$/, '') // Remove " - Source Name" suffix
            .replace(/^[^:]+:\s/, '')   // Remove "Source:" prefix
            .replace(/BREAKING:/i, '')
            .replace(/EXCLUSIVE:/i, '')
            .toLowerCase()
            .trim()
        : '';
        
      // Check for title similarity
      const isDuplicateTitle = Array.from(seenTitles).some(existingTitle => {
        const similarity = calculateStringSimilarity(cleanTitle, existingTitle);
        return similarity > 0.85; // 85% similarity threshold
      });
      
      if (isDuplicateTitle) {
        console.log(`🔄 Skipping similar title: ${article.title.substring(0, 50)}...`);
        continue;
      }
      
      // Enhanced duplicate detection: Google News vs Direct RSS
      const isGoogleNewsArticle = article.metadata && article.metadata.feedUrl && article.metadata.feedUrl.includes('news.google.com');
      
      if (isGoogleNewsArticle) {
        // For Google News articles, check if we already have the same story from direct RSS
        // Extract key words from title for comparison
        const titleWords = cleanTitle.replace(/[^a-z0-9\s]/g, '').split(' ').filter(word => word.length > 3);
        const titleKeywords = titleWords.slice(0, 4).join(' '); // First 4 significant words
        
        // Check against existing unique articles
        const hasDirectRssVersion = uniqueArticles.some(existingArticle => {
          const existingTitle = existingArticle.title
            .replace(/\s-\s[^-]+$/, '')
            .replace(/^[^:]+:\s/, '')
            .replace(/BREAKING:/i, '')
            .toLowerCase()
            .trim();
            
          const existingWords = existingTitle.replace(/[^a-z0-9\s]/g, '').split(' ').filter(word => word.length > 3);
          const existingKeywords = existingWords.slice(0, 4).join(' ');
          
          // Check similarity and ensure the existing one is NOT from Google News
          const similarity = calculateStringSimilarity(titleKeywords, existingKeywords);
          const isExistingFromDirectRss = !existingArticle.metadata?.feedUrl?.includes('news.google.com');
          
          return similarity > 0.8 && isExistingFromDirectRss;
        });
        
        if (hasDirectRssVersion) {
          console.log(`🔄 Skipping Google News duplicate of direct RSS article: ${article.title.substring(0, 50)}...`);
          continue;
        }
      }
      
      seenUrls.add(normalizedUrl);
      seenTitles.add(cleanTitle);
      uniqueArticles.push(article);
    }
    
    console.log(`📊 Deduplication: ${allArticles.length} → ${uniqueArticles.length} articles (removed ${allArticles.length - uniqueArticles.length} duplicates)`);
    
    // Sort by publication date
    uniqueArticles.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    
    // Get top 50 newest articles and return immediately for fast database insertion
    const topArticles = uniqueArticles.slice(0, 50);
    
    logger.info(`Successfully fetched ${topArticles.length} real crypto news articles (images will be enhanced separately)`);
    
    // Schedule image enhancement in the background (non-blocking)
    setTimeout(async () => {
      try {
        logger.info('Starting background image enhancement...');
        await enhanceArticlesWithImages(topArticles);
        logger.info('Background image enhancement completed');
      } catch (error) {
        logger.warn('Background image enhancement failed:', error.message);
      }
    }, 1000);
    
    return topArticles;
    
  } catch (error) {
    logger.error('Error fetching real crypto news:', error.message);
    logger.error('Full error details:', error);
    
    // Return empty array instead of fallback sample data to prevent example articles
    logger.error('RSS aggregation failed, returning empty array to prevent example articles');
    return [];
  }
}

module.exports = {
  scrapeNewsSources,
  performWebSearch,
  scrapePressReleases,
  getBreakingNews,
  updateNewsScores,
  fetchRealCryptoNews,
  enhanceArticlesWithImages,
  scrapeArticleImage,
  validateCryptoContent,
  logRejectedArticle
};