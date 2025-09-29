const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * Client Network Metadata Endpoint
 * Provides logos, descriptions, and other metadata for client network buttons
 */

/**
 * Helper function to get logo URL (uploaded logo first, then external fallback)
 */
function getLogoUrl(networkName, fallbackUrl) {
  const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'logos');
  const safeName = networkName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  
  // Check for various logo file extensions
  const extensions = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp'];
  
  for (const ext of extensions) {
    const logoPath = path.join(uploadsDir, `${safeName}_logo${ext}`);
    if (fs.existsSync(logoPath)) {
      const logoUrl = `/uploads/logos/${safeName}_logo${ext}`;
      logger.info(`📁 Using uploaded logo for ${networkName}: ${logoUrl}`);
      return logoUrl;
    }
  }
  
  // Fall back to external URL
  logger.info(`🌐 Using external logo for ${networkName}: ${fallbackUrl}`);
  return fallbackUrl;
}

// Base client network metadata template (logos will be resolved dynamically)
const CLIENT_NETWORK_BASE_METADATA = {
  'Hedera': {
    name: 'Hedera',
    displayName: 'Hedera Hashgraph',
    symbol: 'HBAR',
    logo: 'https://cryptologos.cc/logos/hedera-hbar-logo.svg',
    logoSquare: 'https://cryptologos.cc/logos/hedera-hbar-logo.png',
    color: '#000000',
    secondaryColor: '#ffffff',
    description: 'Enterprise-grade hashgraph consensus platform',
    category: 'Enterprise Blockchain',
    website: 'https://hedera.com',
    founded: '2018',
    consensus: 'Hashgraph',
    features: ['Fast Transactions', 'Low Fees', 'Enterprise Grade', 'Carbon Negative'],
    isClient: true,
    priority: 1
  },
  'XDC Network': {
    name: 'XDC Network',
    displayName: 'XDC Network',
    symbol: 'XDC',
    logo: 'https://cryptologos.cc/logos/xdc-network-xdc-logo.svg',
    logoSquare: 'https://cryptologos.cc/logos/xdc-network-xdc-logo.png',
    color: '#F7931A',
    secondaryColor: '#ffffff',
    description: 'Hybrid blockchain for trade finance and payments',
    category: 'Trade Finance',
    website: 'https://xdc.network',
    founded: '2017',
    consensus: 'XDPoS',
    features: ['Trade Finance', 'ISO 20022', 'Enterprise Ready', 'Interoperable'],
    isClient: true,
    priority: 2
  },
  'Algorand': {
    name: 'Algorand',
    displayName: 'Algorand',
    symbol: 'ALGO',
    logo: 'https://cryptologos.cc/logos/algorand-algo-logo.svg',
    logoSquare: 'https://cryptologos.cc/logos/algorand-algo-logo.png',
    color: '#000000',
    secondaryColor: '#ffffff',
    description: 'Pure proof-of-stake blockchain platform',
    category: 'Smart Contracts',
    website: 'https://algorand.foundation',
    founded: '2019',
    consensus: 'Pure Proof of Stake',
    features: ['Instant Finality', 'Carbon Negative', 'Smart Contracts', 'DeFi Ready'],
    isClient: true,
    priority: 3
  },
  'Constellation': {
    name: 'Constellation',
    displayName: 'Constellation Network',
    symbol: 'DAG',
    logo: 'https://cryptologos.cc/logos/constellation-dag-logo.svg',
    logoSquare: 'https://cryptologos.cc/logos/constellation-dag-logo.png',
    color: '#3C3C3C',
    secondaryColor: '#ffffff',
    description: 'DAG-based distributed ledger for data applications',
    category: 'Data Layer',
    website: 'https://constellationnetwork.io',
    founded: '2017',
    consensus: 'DAG Technology',
    features: ['Scalable', 'Data Focus', 'Microservices', 'Enterprise'],
    isClient: true,
    priority: 4
  },
  'HashPack': {
    name: 'HashPack',
    displayName: 'HashPack Wallet',
    symbol: 'PACK',
    logo: 'https://www.hashpack.app/img/logo.svg',
    logoSquare: 'https://www.hashpack.app/favicon.ico',
    color: '#654CFF',
    secondaryColor: '#ffffff',
    description: 'Leading Hedera ecosystem wallet and DeFi platform',
    category: 'DeFi Wallet',
    website: 'https://www.hashpack.app',
    founded: '2021',
    consensus: 'Built on Hedera',
    features: ['Web3 Wallet', 'DeFi Integration', 'NFT Support', 'Hedera Native'],
    isClient: true,
    priority: 5,
    parentNetwork: 'Hedera'
  }
};

/**
 * Generate client network metadata with resolved logo URLs
 */
function getClientNetworkMetadata() {
  const metadata = {};
  
  for (const [networkName, baseData] of Object.entries(CLIENT_NETWORK_BASE_METADATA)) {
    metadata[networkName] = {
      ...baseData,
      logo: getLogoUrl(networkName, baseData.logo),
      logoSquare: getLogoUrl(networkName, baseData.logoSquare)
    };
  }
  
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
          network: networkName,
          onlyWithImages: true
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
      id: network.name.toLowerCase(),
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
    
    // Add article counts if requested
    if (includeArticleCounts === 'true') {
      const { getArticles } = require('../config/supabase');
      
      for (const config of buttonConfigs) {
        try {
          const result = await getArticles({
            page: 1,
            limit: 1,
            network: config.name,
            onlyWithImages: true
          });
          config.articleCount = result.count || 0;
        } catch (error) {
          config.articleCount = 0;
        }
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