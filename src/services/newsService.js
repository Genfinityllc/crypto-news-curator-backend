const axios = require('axios');
const cheerio = require('cheerio');
const Parser = require('rss-parser');
// News model removed - using Supabase instead
const logger = require('../utils/logger');
const { calculateViralScore, rewriteArticle, calculateReadabilityScore } = require('./aiService');
const { generateCardCoverImage, extractArticleImages } = require('./imageService');

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
 */
async function performWebSearch(query, network = null) {
  try {
    logger.info(`Performing web search for: ${query}`);
    
    // For demo purposes, we'll simulate web search results
    // In production, you'd integrate with Google Custom Search API, Bing Search API, or similar
    
    const searchResults = [
      {
        title: `Breaking: ${query} Shows Strong Market Performance`,
        network: network || `${query} (Web Search)`,
        category: 'Market Analysis',
        score: 78,
        engagementMetrics: { shares: 156, comments: 23, views: 3400 },
        originalSource: 'Live Web Search',
        publishedAt: new Date(),
        content: `Recent market analysis reveals ${query} demonstrating exceptional growth patterns with increased trading volume and positive sentiment indicators. Technical analysis suggests continued upward momentum with strong support levels established across major exchanges.`,
        url: '#',
        tags: [query, 'Market', 'Analysis'],
        isActive: true
      },
      {
        title: `${query} Network Announces Major Partnership`,
        network: network || `${query} (Web Search)`,
        category: 'Partnership',
        score: 82,
        engagementMetrics: { shares: 89, comments: 12, views: 2100 },
        originalSource: 'Live Web Search',
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        content: `${query} has announced a strategic partnership with a leading enterprise client, marking a significant milestone in their expansion efforts. The collaboration focuses on implementing blockchain solutions for supply chain management.`,
        url: '#',
        tags: [query, 'Partnership', 'Enterprise'],
        isActive: true
      }
    ];

    // Save search results to database
    const savedResults = [];
    for (const result of searchResults) {
      try {
        const savedResult = await News.create(result);
        savedResults.push(savedResult);
      } catch (error) {
        logger.warn(`Error saving search result:`, error.message);
      }
    }

    return savedResults;

  } catch (error) {
    logger.error(`Error performing web search:`, error.message);
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
async function enhanceArticlesWithImages(articles) {
  try {
    logger.info(`Enhancing ${articles.length} articles with card images`);
    
    const enhancedArticles = [];
    
    for (const article of articles) {
      try {
        // Generate card images for the article - prioritize RSS images when available
        let cardImages;
        let coverImage = article.cover_image;
        
        if (article.cover_image) {
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
              // Invalid image URL, generate a new one
              cardImages = await generateCardCoverImage(article);
              coverImage = cardImages.medium;
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
          // Generate card images for articles without RSS images
          cardImages = await generateCardCoverImage(article);
          coverImage = cardImages.medium;
        }
        
        // Add image data to article
        const enhancedArticle = {
          ...article,
          card_images: cardImages,
          cover_image: coverImage,
          has_real_image: !!article.cover_image, // True if we have an RSS image
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
      // Dedicated crypto news sources (primary sources for quality crypto content)
      'https://www.coindesk.com/arc/outboundfeeds/rss/',
      'https://cointelegraph.com/rss',
      'https://decrypt.co/feed',
      'https://cryptoslate.com/feed/',
      'https://crypto.news/feed/',
      'https://cryptopotato.com/feed/',
      'https://news.bitcoin.com/feed/',
      'https://bitcoinist.com/feed/',
      'https://u.today/rss',
      'https://coingape.com/feed/',
      'https://ambcrypto.com/feed/',
      'https://cryptonews.com/news/feed/',
      'https://cryptobriefing.com/feed/',
      'https://beincrypto.com/feed/',
      'https://cryptodaily.co.uk/feed/',
      
      // Your specific client networks (enhanced for better client news coverage)
      'https://news.google.com/rss/search?q=Hedera+OR+HBAR&hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q=Hedera+Hashgraph&hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q=XDC+Network+OR+XinFin&hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q=XDC+cryptocurrency&hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q=Algorand+OR+ALGO&hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q=Algorand+blockchain&hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q=Constellation+Network+OR+DAG&hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q=Constellation+DAG+crypto&hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q=HashPack+wallet&hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q="SWAP+token"+cryptocurrency&hl=en-US&gl=US&ceid=US:en'
    ];

    const allArticles = [];

    for (const feedUrl of rssFeeds) {
      try {
        logger.info(`Parsing RSS feed: ${feedUrl}`);
        const feed = await parser.parseURL(feedUrl);
        
        const articles = feed.items.slice(0, 10).map(item => {
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
            'Optimism': ['optimism', 'op', 'optimism network'],
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
          const cryptoContextKeywords = [
            'crypto', 'cryptocurrency', 'blockchain', 'token', 'coin', 'defi', 'nft', 
            'trading', 'price', 'market', 'exchange', 'wallet', 'mining', 'staking',
            'protocol', 'network', 'ethereum', 'bitcoin', 'altcoin', 'digital currency',
            'smart contract', 'dapp', 'web3', 'yield', 'liquidity', 'governance',
            'consensus', 'validator', 'node', 'hash', 'ledger', 'decentralized',
            'btc', 'eth', 'ada', 'sol', 'matic', 'avax', 'dot', 'link', 'hbar',
            'xdc', 'algorand', 'constellation', 'dag', 'hashpack', 'swap'
          ];
          
          for (const [networkName, keywords] of Object.entries(networkKeywords)) {
            for (const keyword of keywords) {
              if (searchText.includes(keyword.toLowerCase())) {
                // ALWAYS verify crypto context for ALL network matches to prevent false positives
                const hasCryptoContext = cryptoContextKeywords.some(cryptoKeyword => 
                  searchText.includes(cryptoKeyword)
                );
                
                if (!hasCryptoContext) {
                  console.log(`⚠️  Skipping ${networkName} match for "${title.substring(0, 50)}..." - no crypto context detected`);
                  continue; // Skip this match if no crypto context
                }
                
                network = networkName;
                console.log(`✅ Network detected: ${network} (keyword: "${keyword}") - crypto context verified`);
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
          
          // Enhanced image extraction prioritizing featured images
          if (item.enclosure && item.enclosure.url && item.enclosure.type && item.enclosure.type.includes('image')) {
            imageUrl = item.enclosure.url;
            console.log('📷 Using enclosure image:', imageUrl);
          } else if (item['media:content'] && item['media:content'].url) {
            imageUrl = item['media:content'].url;
            console.log('📷 Using media:content image:', imageUrl);
          } else if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) {
            imageUrl = item['media:content'].$.url;
            console.log('📷 Using media:content.$ image:', imageUrl);
          } else if (item['media:thumbnail'] && item['media:thumbnail'].url) {
            imageUrl = item['media:thumbnail'].url;
            console.log('📷 Using media:thumbnail image:', imageUrl);
          } else if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
            imageUrl = item['media:thumbnail'].$.url;
            console.log('📷 Using media:thumbnail.$ image:', imageUrl);
          } else if (item.image && item.image.url) {
            imageUrl = item.image.url;
            console.log('📷 Using item.image.url:', imageUrl);
          } else if (item['itunes:image'] && item['itunes:image'].href) {
            imageUrl = item['itunes:image'].href;
            console.log('📷 Using iTunes image:', imageUrl);
          }
          
          if (!imageUrl && feedUrl.includes('crypto.news')) {
            console.log('❌ No image found for crypto.news article:', title.substring(0, 50));
          }

          // Enhanced source extraction for Google News
          let sourceExtraction = feed.title || new URL(feedUrl).hostname;
          let originalUrl = item.link;
          let cleanTitle = title;
          
          // Extract original source from Google News titles and URLs
          if (feedUrl.includes('news.google.com')) {
            // Extract source from title (format: "Article Title - Original Source")
            const titleMatch = title.match(/^(.+)\s-\s([^-]+)$/);
            if (titleMatch && titleMatch[2]) {
              sourceExtraction = titleMatch[2].trim();
              // Clean up title by removing source
              cleanTitle = titleMatch[1].trim();
            }
            
            // Try to extract original URL from Google News URL
            try {
              const googleUrl = new URL(item.link);
              if (googleUrl.searchParams.get('url')) {
                originalUrl = decodeURIComponent(googleUrl.searchParams.get('url'));
              }
            } catch (urlError) {
              logger.warn('Could not extract original URL from Google News link');
            }
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

          // Calculate viral score
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
          
          return enhancedArticle;
        });

        allArticles.push(...articles);
        logger.info(`Parsed ${articles.length} articles from ${feed.title || feedUrl}`);
        
      } catch (feedError) {
        logger.error(`Error parsing RSS feed ${feedUrl}:`, feedError.message);
      }
    }

    // Sort by publication date
    allArticles.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    
    // Enhance articles with card-optimized images
    const topArticles = allArticles.slice(0, 50); // Get top 50 newest articles
    const enhancedArticles = await enhanceArticlesWithImages(topArticles);
    
    logger.info(`Successfully fetched and enhanced ${enhancedArticles.length} real crypto news articles`);
    return enhancedArticles;
    
  } catch (error) {
    logger.error('Error fetching real crypto news:', error.message);
    
    // Return fallback sample data
    return [
      {
        id: '1',
        title: 'Bitcoin Reaches New Heights (Live Data Unavailable)',
        content: 'Bitcoin continues its upward trajectory as institutional adoption grows. This is fallback data.',
        source: 'Fallback',
        published_at: new Date().toISOString(),
        category: 'market',
        network: 'Bitcoin',
        is_breaking: true,
        view_count: 150,
        tags: ['bitcoin', 'market', 'institutional']
      }
    ];
  }
}

module.exports = {
  scrapeNewsSources,
  performWebSearch,
  scrapePressReleases,
  getBreakingNews,
  updateNewsScores,
  fetchRealCryptoNews,
  enhanceArticlesWithImages
};
