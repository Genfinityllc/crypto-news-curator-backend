const express = require('express');
const router = express.Router();
const { searchNews } = require('../services/newsService');
const { getArticles } = require('../config/supabase');
const logger = require('../utils/logger');

// Enhanced client news aggregation with multiple search strategies
router.get('/', async (req, res) => {
  try {
    const { forceRefresh = false, limit = 500 } = req.query; // 500 total (100 per client × 5 clients)
    
    logger.info('🎯 Enhanced client news aggregation starting...');
    
    // Client-specific search terms with multiple variations
    const clientSearchStrategies = {
      hedera: [
        'Hedera OR HBAR OR "Hedera Hashgraph" OR "Hedera Network" OR "Hedera Council"',
        '"HBAR token" OR "HBAR price" OR "Hedera DeFi" OR "Hedera NFT"',
        '"Hedera Governing Council" OR "Hedera ecosystem" OR "Hedera partnership"',
        'Hashgraph OR "Hashgraph technology" OR "Hedera consensus"'
      ],
      xdc: [
        'XDC OR "XDC Network" OR XinFin OR "XDC token"',
        '"XDC price" OR "XinFin network" OR "XDC blockchain"',
        '"XDC ecosystem" OR "XDC partnership" OR "XDC adoption"',
        '"TradeFinex" OR "XinFin DeFi" OR "XDC enterprise"'
      ],
      algorand: [
        'Algorand OR ALGO OR "Algorand Foundation" OR "Algorand blockchain"',
        '"ALGO token" OR "ALGO price" OR "Algorand DeFi"',
        '"Algorand ecosystem" OR "Algorand partnership" OR "Algorand NFT"',
        '"Pure Proof of Stake" OR "Algorand governance" OR "Algorand development"'
      ],
      constellation: [
        '"Constellation Network" OR "Constellation Labs" OR DAG OR "$DAG"',
        '"DAG token" OR "DAG price" OR "Constellation protocol"',
        '"Hypergraph" OR "State channels" OR "Constellation ecosystem"',
        '"DAG technology" OR "Constellation partnership"'
      ],
      hashpack: [
        'HashPack OR "HashPack wallet" OR "PACK token" OR "$PACK"',
        '"HashPack DeFi" OR "HashPack ecosystem" OR "HashPack integration"',
        '"Hedera wallet" OR "HBAR wallet" OR "HashPack features"'
      ],
      swap: [
        '"SWAP token" OR "$SWAP" cryptocurrency OR "SWAP protocol"',
        '"SWAP DeFi" OR "SWAP exchange" OR "SWAP ecosystem"'
      ]
    };

    const allClientArticles = [];
    const searchPromises = [];

    // Execute multiple search strategies for each client
    for (const [client, strategies] of Object.entries(clientSearchStrategies)) {
      console.log(`🔍 Searching for ${client} articles with ${strategies.length} strategies...`);
      
      for (const [index, searchTerm] of strategies.entries()) {
        const searchPromise = searchNews(searchTerm, {
          limit: 25, // Get more results per search
          source: 'hybrid',
          sortBy: 'publishedAt'
        }).then(response => {
          if (response && response.data) {
            const articles = response.data.map(article => ({
              ...article,
              client_network: client,
              search_strategy: index + 1,
              search_term: searchTerm.substring(0, 50) + '...',
              enhanced_client_search: true
            }));
            console.log(`✅ ${client} strategy ${index + 1}: ${articles.length} articles`);
            return articles;
          }
          return [];
        }).catch(error => {
          console.error(`❌ Error in ${client} search:`, error);
          return [];
        });

        searchPromises.push(searchPromise);
      }
    }

    // Execute all searches in parallel
    console.log(`🚀 Executing ${searchPromises.length} parallel client searches...`);
    const searchResults = await Promise.all(searchPromises);
    
    // Flatten and deduplicate results
    const flatResults = searchResults.flat();
    console.log(`📊 Total raw results: ${flatResults.length}`);

    // Advanced deduplication by URL and title similarity
    const deduplicatedArticles = [];
    const seenUrls = new Set();
    const seenTitles = new Set();

    for (const article of flatResults) {
      const url = article.url || article.link;
      const title = (article.title || '').toLowerCase().trim();
      
      // Skip if URL already seen
      if (url && seenUrls.has(url)) {
        continue;
      }
      
      // Skip if very similar title already seen
      const titleWords = title.split(' ').filter(word => word.length > 3);
      const titleKey = titleWords.slice(0, 5).join(' '); // First 5 significant words
      
      if (titleKey && seenTitles.has(titleKey)) {
        continue;
      }
      
      // Enhanced client relevance scoring
      let relevanceScore = 0;
      const text = `${title} ${article.content || article.description || article.summary || ''}`.toLowerCase();
      
      // Client mention scoring
      const clientNetworks = ['hedera', 'hbar', 'xdc', 'xinfin', 'algorand', 'algo', 'constellation', 'dag', 'hashpack', 'pack', 'swap'];
      clientNetworks.forEach(network => {
        if (text.includes(network)) {
          relevanceScore += text.split(network).length - 1; // Count occurrences
        }
      });
      
      // Crypto context scoring
      const cryptoTerms = ['blockchain', 'cryptocurrency', 'token', 'defi', 'nft', 'trading', 'price', 'market', 'partnership', 'ecosystem', 'protocol'];
      cryptoTerms.forEach(term => {
        if (text.includes(term)) {
          relevanceScore += 1;
        }
      });
      
      // Only include articles with good relevance
      if (relevanceScore >= 2) {
        if (url) seenUrls.add(url);
        if (titleKey) seenTitles.add(titleKey);
        
        deduplicatedArticles.push({
          ...article,
          relevance_score: relevanceScore,
          is_client_focused: true
        });
      }
    }

    // Sort by relevance and recency
    const sortedArticles = deduplicatedArticles.sort((a, b) => {
      // First by relevance score
      if (b.relevance_score !== a.relevance_score) {
        return b.relevance_score - a.relevance_score;
      }
      // Then by date
      return new Date(b.publishedAt || b.published_at || 0) - new Date(a.publishedAt || a.published_at || 0);
    });

    // Take the best results
    const finalResults = sortedArticles.slice(0, parseInt(limit));

    // Log distribution by client
    const clientDistribution = {};
    finalResults.forEach(article => {
      const client = article.client_network || 'unknown';
      clientDistribution[client] = (clientDistribution[client] || 0) + 1;
    });

    console.log('🎯 Enhanced client news distribution:', clientDistribution);
    console.log(`✅ Enhanced client news: ${finalResults.length} high-quality articles`);

    res.json({
      success: true,
      data: finalResults,
      meta: {
        total: finalResults.length,
        searchStrategies: Object.keys(clientSearchStrategies).length,
        totalSearches: searchPromises.length,
        clientDistribution,
        averageRelevanceScore: finalResults.reduce((sum, a) => sum + (a.relevance_score || 0), 0) / finalResults.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Enhanced client news error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: []
    });
  }
});

// Get cached client articles for instant loading
router.get('/cached', async (req, res) => {
  try {
    const { limit = 500 } = req.query; // 500 total for instant loading (100 per client)
    
    // Get recent client articles from database
    const { data: cachedArticles } = await getArticles({
      limit: parseInt(limit),
      sortBy: 'publishedAt',
      // Filter for client networks
      network: ['Hedera', 'XDC Network', 'Algorand', 'Constellation', 'HashPack', 'Axiom']
    });

    // If no cached articles, return empty with flag to trigger full search
    if (!cachedArticles || cachedArticles.length === 0) {
      return res.json({
        success: true,
        data: [],
        meta: {
          cached: true,
          shouldTriggerFullSearch: true,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Enhance cached articles with client flags
    const enhancedCached = cachedArticles.map(article => ({
      ...article,
      from_cache: true,
      is_client_focused: true
    }));

    logger.info(`⚡ Serving ${enhancedCached.length} cached client articles instantly`);

    res.json({
      success: true,
      data: enhancedCached,
      meta: {
        total: enhancedCached.length,
        cached: true,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Cached client news error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: []
    });
  }
});

module.exports = router;