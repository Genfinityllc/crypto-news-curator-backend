const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * Client Network Metadata Endpoint
 * Provides logos, descriptions, and other metadata for client network buttons
 */

const { CLIENTS } = require('../data/clients');

// Where this server is reached from outside (the logos are served by it)
const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app').replace(/\/$/, '');

/**
 * The clients' button details, built from the one list in ../data/clients.js
 */
function getClientNetworkMetadata() {
  const metadata = {};

  CLIENTS.forEach((client, index) => {
    const logo = `${PUBLIC_BASE}/api/cover-generator/logo-preview/${client.logoSymbol}`;
    metadata[client.name] = {
      id: client.id,
      name: client.name,
      displayName: client.displayName,
      symbol: client.symbol,
      logo,
      logoSquare: logo,
      color: client.color,
      secondaryColor: '#ffffff',
      description: client.description,
      website: client.website,
      isClient: true,
      priority: index + 1
    };
  });

  return metadata;
}

// Major cryptocurrency networks for reference
const MAJOR_NETWORK_METADATA = {
  'Bitcoin': {
    name: 'Bitcoin',
    displayName: 'Bitcoin',
    symbol: 'BTC',
    logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg',
    logoSquare: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
    color: '#F7931A',
    secondaryColor: '#ffffff',
    description: 'Digital gold and store of value',
    category: 'Store of Value',
    website: 'https://bitcoin.org',
    founded: '2009',
    consensus: 'Proof of Work',
    features: ['Store of Value', 'Digital Gold', 'Decentralized', 'Secure'],
    isClient: false,
    priority: 10
  },
  'Ethereum': {
    name: 'Ethereum',
    displayName: 'Ethereum',
    symbol: 'ETH',
    logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
    logoSquare: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    color: '#627EEA',
    secondaryColor: '#ffffff',
    description: 'Leading smart contract platform',
    category: 'Smart Contracts',
    website: 'https://ethereum.org',
    founded: '2015',
    consensus: 'Proof of Stake',
    features: ['Smart Contracts', 'DeFi Hub', 'NFTs', 'Layer 2'],
    isClient: false,
    priority: 11
  }
};

/**
 * Get all client network metadata
 */
router.get('/', async (req, res) => {
  try {
    const { includeAll = 'false', clientsOnly = 'true' } = req.query;
    
    let networks = {};
    const CLIENT_NETWORK_METADATA = getClientNetworkMetadata();
    
    if (clientsOnly === 'true') {
      // Return only client networks
      networks = CLIENT_NETWORK_METADATA;
    } else if (includeAll === 'true') {
      // Return both client and major networks
      networks = { ...CLIENT_NETWORK_METADATA, ...MAJOR_NETWORK_METADATA };
    } else {
      // Default: client networks only
      networks = CLIENT_NETWORK_METADATA;
    }
    
    // Convert to array format with additional metadata
    const networkArray = Object.values(networks).sort((a, b) => a.priority - b.priority);
    
    logger.info(`🎨 Serving ${networkArray.length} network metadata records`);
    
    res.json({
      success: true,
      data: networkArray,
      meta: {
        total: networkArray.length,
        clientNetworks: Object.values(CLIENT_NETWORK_METADATA).length,
        majorNetworks: Object.values(MAJOR_NETWORK_METADATA).length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('❌ Client networks metadata error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch network metadata',
      error: error.message
    });
  }
});

/**
 * Get specific network metadata by name
 */
router.get('/:networkName', async (req, res) => {
  try {
    const { networkName } = req.params;
    const CLIENT_NETWORK_METADATA = getClientNetworkMetadata();
    const allNetworks = { ...CLIENT_NETWORK_METADATA, ...MAJOR_NETWORK_METADATA };
    
    // Find network by exact name or case-insensitive match
    const network = allNetworks[networkName] || 
                   Object.values(allNetworks).find(net => 
                     net.name.toLowerCase() === networkName.toLowerCase()
                   );
    
    if (!network) {
      return res.status(404).json({
        success: false,
        message: `Network '${networkName}' not found`,
        availableNetworks: Object.keys(allNetworks)
      });
    }
    
    res.json({
      success: true,
      data: network,
      meta: {
        networkName,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error(`❌ Network metadata error for ${req.params.networkName}:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch network metadata',
      error: error.message
    });
  }
});

/**
 * Get client network counts with metadata
 */
router.get('/counts/with-metadata', async (req, res) => {
  try {
    const { getArticles } = require('../config/supabase');
    const CLIENT_NETWORK_METADATA = getClientNetworkMetadata();
    
    const networksWithCounts = [];
    
    for (const [networkName, metadata] of Object.entries(CLIENT_NETWORK_METADATA)) {
      try {
        const result = await getArticles({
          page: 1,
          limit: 1,
          network: networkName
        });
        
        networksWithCounts.push({
          ...metadata,
          articleCount: result.count || 0
        });
        
      } catch (error) {
        logger.warn(`Failed to get count for ${networkName}:`, error.message);
        networksWithCounts.push({
          ...metadata,
          articleCount: 0
        });
      }
    }
    
    // Sort by priority
    networksWithCounts.sort((a, b) => a.priority - b.priority);
    
    res.json({
      success: true,
      data: networksWithCounts,
      meta: {
        total: networksWithCounts.length,
        totalArticles: networksWithCounts.reduce((sum, net) => sum + net.articleCount, 0),
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('❌ Network counts with metadata error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch network counts with metadata',
      error: error.message
    });
  }
});

/**
 * Get button configuration for frontend
 */
router.get('/buttons/config', async (req, res) => {
  try {
    const { includeArticleCounts = 'false' } = req.query;
    const CLIENT_NETWORK_METADATA = getClientNetworkMetadata();
    
    const buttonConfigs = Object.values(CLIENT_NETWORK_METADATA).map(network => ({
      id: network.id || network.name.toLowerCase(),
      name: network.name,
      displayName: network.displayName,
      symbol: network.symbol,
      logo: network.logo,
      logoSquare: network.logoSquare,
      color: network.color,
      secondaryColor: network.secondaryColor,
      description: network.description,
      isClient: network.isClient,
      priority: network.priority,
      // Frontend button specific configs
      buttonClass: `btn-${network.name.toLowerCase().replace(/\s+/g, '-')}`,
      iconSize: '24px',
      showLabel: true,
      showCount: includeArticleCounts === 'true'
    }));
    
    // Sort by priority
    buttonConfigs.sort((a, b) => a.priority - b.priority);
    
    // Add article counts if requested (the same numbers the Client News feed shows)
    if (includeArticleCounts === 'true') {
      let counted = [];
      try {
        const { loadClientNews, clientList } = require('./client-news');
        counted = clientList(await loadClientNews(), '');
      } catch (error) {
        counted = [];
      }
      for (const config of buttonConfigs) {
        const match = counted.find(c => c.id === config.id);
        config.articleCount = match ? match.count : 0;
      }
    }
    
    res.json({
      success: true,
      data: buttonConfigs,
      meta: {
        total: buttonConfigs.length,
        includeCounts: includeArticleCounts === 'true',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('❌ Button config error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch button configuration',
      error: error.message
    });
  }
});

module.exports = router;