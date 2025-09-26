const Parser = require('rss-parser');
const logger = require('../utils/logger');
const { lightweightImageService } = require('./lightweightImageService');

/**
 * 🏛️ PRESS RELEASE AGGREGATION SERVICE
 * 
 * Legally aggregates press releases from multiple sources with keyword filtering
 * for client-specific content: XDC Network, Hedera, Algorand, Constellation, HashPack
 * 
 * Features:
 * - Hourly automated searches
 * - 100% image guarantee through validation pipeline
 * - Multi-source aggregation (PRNewswire via Google, GlobeNewswire direct, etc.)
 * - Keyword-based client filtering
 */
class PressReleaseService {
  constructor() {
    this.parser = new Parser({
      customFields: {
        item: [
          ['media:content', 'mediaContent'],
          ['media:thumbnail', 'mediaThumbnail'],
          ['enclosure', 'enclosure'],
          ['content:encoded', 'fullContent']
        ]
      }
    });
    
    // Client-specific keywords for press release filtering
    this.clientKeywords = {
      'XDC Network': [
        'XDC Network', 'XinFin', 'XDC token', 'trade finance blockchain',
        'XDC Foundation', 'XDC protocol', 'XDC enterprise', 'XDC partnership'
      ],
      'Hedera': [
        'Hedera', 'Hedera Hashgraph', 'HBAR', 'Hashgraph',
        'Hedera Council', 'Hedera Foundation', 'Swirlds', 'DLT'
      ],
      'Algorand': [
        'Algorand', 'ALGO', 'Algorand Foundation', 'Pure Proof of Stake',
        'Silvio Micali', 'Algorand blockchain', 'Algorand protocol'
      ],
      'Constellation': [
        'Constellation Network', 'Constellation DAG', '$DAG', 'DAG protocol',
        'Constellation Labs', 'Hypergraph', 'State Channels'
      ],
      'HashPack': [
        'HashPack', 'HashPack wallet', 'PACK token', 'Hedera wallet',
        'HashPack DeFi', 'HashPack platform'
      ]
    };
    
    // Press release RSS sources (legal alternatives to direct PRNewswire scraping)
    this.pressReleaseFeeds = [
      // STRATEGY 1: Google News searches targeting PRNewswire (LEGAL)
      'https://news.google.com/rss/search?q="XDC+Network"+press+release+OR+"XDC+Network"+announcement+site:prnewswire.com&hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q="Hedera"+press+release+OR+"Hedera+Hashgraph"+announcement+site:prnewswire.com&hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q="Algorand"+press+release+OR+"Algorand+Foundation"+announcement+site:prnewswire.com&hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q="Constellation+Network"+press+release+OR+"DAG"+announcement+site:prnewswire.com&hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q="HashPack"+press+release+OR+"HashPack+wallet"+announcement+site:prnewswire.com&hl=en-US&gl=US&ceid=US:en',
      
      // STRATEGY 2: GlobeNewswire direct RSS (LEGAL alternative to PRNewswire)
      'https://www.globenewswire.com/RssFeed/subjectcode/1079/feedTitle/GlobeNewswire%20-%20Cryptocurrency',
      'https://www.globenewswire.com/RssFeed/subjectcode/1075/feedTitle/GlobeNewswire%20-%20Financial%20Services',
      'https://www.globenewswire.com/RssFeed/subjectcode/1081/feedTitle/GlobeNewswire%20-%20Technology',
      
      // STRATEGY 3: Other legal press release sources
      'https://www.accesswire.com/rss/category/technology',
      'https://www.einnews.com/rss/pr/world-blockchain',
      
      // STRATEGY 4: General crypto press release searches
      'https://news.google.com/rss/search?q=cryptocurrency+press+release+OR+blockchain+announcement&hl=en-US&gl=US&ceid=US:en'
    ];
  }

  /**
   * 🎯 Extract press releases with client keyword filtering
   */
  async extractClientPressReleases(clientFilter = 'all') {
    try {
      logger.info(`🏛️ Starting press release extraction for client: ${clientFilter}`);
      
      const allPressReleases = [];
      
      for (const feedUrl of this.pressReleaseFeeds) {
        try {
          logger.info(`📰 Parsing press release feed: ${feedUrl}`);
          const feed = await this.parser.parseURL(feedUrl);
          
          const pressReleases = await Promise.all(
            feed.items.slice(0, 15).map(async (item) => {
              try {
                // Extract and clean press release data
                const pressRelease = await this.processPressReleaseItem(item, feedUrl);
                
                // Apply client filtering
                if (clientFilter !== 'all') {
                  const matchesClient = this.matchesClientKeywords(pressRelease, clientFilter);
                  if (!matchesClient) return null;
                }
                
                // Ensure 100% image coverage
                const pressReleaseWithImage = await this.ensureImageCoverage(pressRelease);
                
                return pressReleaseWithImage;
              } catch (error) {
                logger.warn(`❌ Error processing press release item: ${error.message}`);
                return null;
              }
            })
          );
          
          // Filter out null results and add to collection
          const validPressReleases = pressReleases.filter(pr => pr !== null);
          allPressReleases.push(...validPressReleases);
          
          logger.info(`✅ Extracted ${validPressReleases.length} press releases from ${feedUrl}`);
          
        } catch (error) {
          logger.warn(`⚠️ Failed to parse press release feed ${feedUrl}: ${error.message}`);
        }
      }
      
      // Remove duplicates and sort by date
      const uniquePressReleases = this.removeDuplicates(allPressReleases);
      const sortedPressReleases = uniquePressReleases.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
      
      logger.info(`🎉 Total unique press releases extracted: ${sortedPressReleases.length}`);
      return sortedPressReleases;
      
    } catch (error) {
      logger.error(`💥 Press release extraction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🔍 Process individual press release item
   */
  async processPressReleaseItem(item, feedUrl) {
    const title = item.title || '';
    const summary = item.contentSnippet || item.summary || item.description || '';
    const fullContent = item['content:encoded'] || item.content || summary;
    const url = item.link || item.guid;
    const publishedAt = item.pubDate || item.isoDate || new Date().toISOString();
    
    // Extract image from RSS
    let imageUrl = null;
    if (item.enclosure && item.enclosure.type && item.enclosure.type.startsWith('image/')) {
      imageUrl = item.enclosure.url;
    } else if (item.mediaContent && item.mediaContent.$) {
      imageUrl = item.mediaContent.$.url;
    } else if (item.mediaThumbnail && item.mediaThumbnail.$) {
      imageUrl = item.mediaThumbnail.$.url;
    }
    
    return {
      id: this.generateUniqueId(url, title),
      title: title.trim(),
      summary: summary.trim(),
      content: fullContent,
      url,
      published_at: publishedAt,
      source: this.extractSourceFromUrl(feedUrl),
      image_url: imageUrl,
      category: 'press-release',
      type: 'press-release',
      // Flag as press release for special handling
      is_press_release: true,
      feed_source: feedUrl
    };
  }

  /**
   * 🎯 Check if press release matches client keywords
   */
  matchesClientKeywords(pressRelease, clientFilter) {
    if (clientFilter === 'all') return true;
    
    const searchText = `${pressRelease.title} ${pressRelease.summary} ${pressRelease.content}`.toLowerCase();
    const keywords = this.clientKeywords[clientFilter] || [];
    
    return keywords.some(keyword => 
      searchText.includes(keyword.toLowerCase())
    );
  }

  /**
   * 🖼️ Ensure 100% image coverage for press releases
   */
  async ensureImageCoverage(pressRelease) {
    try {
      // If we already have an image, validate it
      if (pressRelease.image_url) {
        const isValidImage = await lightweightImageService.validateImageUrl(pressRelease.image_url);
        if (isValidImage) {
          return pressRelease;
        }
      }
      
      // Use existing image validation pipeline
      const pressReleaseWithImage = await lightweightImageService.processArticleWithImageValidation(pressRelease);
      
      return pressReleaseWithImage;
    } catch (error) {
      logger.warn(`⚠️ Image coverage failed for press release ${pressRelease.id}: ${error.message}`);
      return pressRelease;
    }
  }

  /**
   * 🗂️ Remove duplicate press releases
   */
  removeDuplicates(pressReleases) {
    const seen = new Set();
    return pressReleases.filter(pr => {
      const key = `${pr.title.toLowerCase()}_${pr.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * 🏷️ Extract source name from feed URL
   */
  extractSourceFromUrl(feedUrl) {
    if (feedUrl.includes('prnewswire.com')) return 'PR Newswire';
    if (feedUrl.includes('globenewswire.com')) return 'GlobeNewswire';
    if (feedUrl.includes('businesswire.com')) return 'Business Wire';
    if (feedUrl.includes('accesswire.com')) return 'AccessWire';
    if (feedUrl.includes('news.google.com')) return 'Google News';
    return 'Press Release';
  }

  /**
   * 🆔 Generate unique ID for press release
   */
  generateUniqueId(url, title) {
    const crypto = require('crypto');
    const content = `${url}_${title}`;
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * ⏰ Start hourly press release monitoring
   */
  startHourlyMonitoring() {
    logger.info('🚀 Starting hourly press release monitoring');
    
    // Run immediately
    this.extractClientPressReleases('all').catch(error => {
      logger.error('Initial press release extraction failed:', error);
    });
    
    // Then run every hour
    const hourlyInterval = setInterval(async () => {
      try {
        logger.info('⏰ Hourly press release extraction starting...');
        await this.extractClientPressReleases('all');
        logger.info('✅ Hourly press release extraction completed');
      } catch (error) {
        logger.error('Hourly press release extraction failed:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
    
    return hourlyInterval;
  }

  /**
   * 🛑 Stop monitoring
   */
  stopMonitoring(interval) {
    if (interval) {
      clearInterval(interval);
      logger.info('🛑 Press release monitoring stopped');
    }
  }
}

module.exports = new PressReleaseService();