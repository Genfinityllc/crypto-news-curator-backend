const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * 🎯 PHASE 1: Crypto Logo Collection Service
 * Collects high-quality crypto logos from CoinGecko API for LoRA training
 */
class LogoCollectionService {
  constructor() {
    this.coingeckoBaseUrl = 'https://api.coingecko.com/api/v3';
    this.logoDir = path.join(__dirname, '../../training-data/logos');
    this.initialized = false;
    
    // Your specific priority cryptos + top market cap coins
    this.priorityCryptos = [
      // Your specific requests
      'ripple', 'hedera-hashgraph', 'cardano', 'dogecoin', 'solana', 
      'constellation-labs', 'pepe', 'xdce-crowd-sale', 'crypto-com-chain',
      
      // Major cryptos
      'bitcoin', 'ethereum', 'binancecoin', 'tether', 'usd-coin',
      'matic-network', 'avalanche-2', 'chainlink', 'polkadot', 'litecoin',
      'bitcoin-cash', 'shiba-inu', 'tron', 'stellar', 'ethereum-classic',
      'cosmos', 'monero', 'okb', 'dai', 'near', 'lido-dao', 'uniswap',
      'leo-token', 'aptos', 'arbitrum', 'kaspa', 'internet-computer',
      'vechain', 'filecoin', 'optimism', 'maker', 'injective-protocol',
      'render-token', 'the-graph', 'celestia', 'stacks', 'immutable-x',
      'first-digital-usd', 'theta-token', 'mantle', 'cronos', 'aave',
      'algorand', 'flow', 'quant-network', 'sei', 'bitcoin-sv', 'fantom',
      'rocket-pool', 'elrond-erd-2', 'sandbox', 'decentraland', 'axie-infinity',
      'thorchain', 'kucoin-shares', 'chiliz', 'gala', 'mina-protocol',
      'eos', 'bitget-token', 'tezos', 'beam', 'iota', 'neo',
      'the-open-network', 'flare-networks', 'kava', 'conflux-token', 'pancakeswap-token',
      'curve-dao-token', 'gnosis', 'synthetix-network-token', 'compound-governance-token', 'sushi',
      '1inch', 'loopring', 'enjin-coin', 'zilliqa', 'basic-attention-token',
      'xyo-network', '0x', 'orchid-protocol', 'civic', 'golem',
      'numeraire', 'storj', 'livepeer', 'reserve-rights-token', 'ampleforth',
      'balancer', 'yearn-finance', 'uma', 'bancor', 'kyber-network-crystal',
      'ren', 'skale', 'keep-network', 'nucypher', 'harvest-finance',
      'badger-dao', 'perpetual-protocol', 'alpha-finance', 'cream-2', 'barnbridge',
      'hegic', 'cover-protocol', 'yfi-gold', 'dhedge-dao', 'piedao-dough',
      'reflexer-ungovernance-token', 'idle', 'pickle-finance', 'tornado-cash', 'api3',
      'mask-network', 'rarible', 'origin-protocol', 'audius', 'rally-2'
    ];
    
    // Map friendly names to CoinGecko IDs  
    this.cryptoIdMap = {
      'polygon': 'matic-network',
      'avalanche': 'avalanche-2', 
      'hedera': 'hedera-hashgraph',
      'hbar': 'hedera-hashgraph',
      'xrp': 'ripple',
      'ada': 'cardano',
      'doge': 'dogecoin',
      'sol': 'solana',
      'dag': 'constellation-labs',
      'xdc': 'xdce-crowd-sale',
      'cro': 'crypto-com-chain',
      'bnb': 'binancecoin',
      'usdt': 'tether',
      'usdc': 'usd-coin',
      'matic': 'matic-network',
      'avax': 'avalanche-2',
      'link': 'chainlink',
      'dot': 'polkadot',
      'ltc': 'litecoin',
      'bch': 'bitcoin-cash',
      'shib': 'shiba-inu',
      'trx': 'tron',
      'xlm': 'stellar',
      'etc': 'ethereum-classic',
      'atom': 'cosmos',
      'xmr': 'monero',
      'near': 'near',
      'ldo': 'lido-dao',
      'uni': 'uniswap',
      'apt': 'aptos',
      'arb': 'arbitrum',
      'kas': 'kaspa',
      'icp': 'internet-computer',
      'vet': 'vechain',
      'fil': 'filecoin',
      'op': 'optimism',
      'mkr': 'maker',
      'inj': 'injective-protocol',
      'rndr': 'render-token',
      'grt': 'the-graph',
      'tia': 'celestia',
      'stx': 'stacks',
      'imx': 'immutable-x',
      'fdusd': 'first-digital-usd',
      'theta': 'theta-token',
      'mnt': 'mantle',
      'algo': 'algorand',
      'qnt': 'quant-network',
      'sei': 'sei',
      'bsv': 'bitcoin-sv',
      'ftm': 'fantom',
      'rpl': 'rocket-pool',
      'egld': 'elrond-erd-2',
      'sand': 'sandbox',
      'mana': 'decentraland',
      'axs': 'axie-infinity',
      'rune': 'thorchain',
      'kcs': 'kucoin-shares',
      'chz': 'chiliz',
      'mina': 'mina-protocol',
      'bgb': 'bitget-token',
      'xtz': 'tezos',
      'beam': 'beam',
      'miota': 'iota',
      'ton': 'the-open-network',
      'flr': 'flare-networks',
      'cfx': 'conflux-token',
      'cake': 'pancakeswap-token',
      'crv': 'curve-dao-token',
      'gno': 'gnosis',
      'snx': 'synthetix-network-token',
      'comp': 'compound-governance-token',
      'lrc': 'loopring',
      'enj': 'enjin-coin',
      'zil': 'zilliqa',
      'bat': 'basic-attention-token',
      'xyo': 'xyo-network',
      'zrx': '0x',
      'oxt': 'orchid-protocol',
      'cvc': 'civic',
      'gnt': 'golem',
      'nmr': 'numeraire',
      'storj': 'storj',
      'lpt': 'livepeer',
      'rsr': 'reserve-rights-token',
      'ampl': 'ampleforth',
      'bal': 'balancer',
      'yfi': 'yearn-finance',
      'uma': 'uma',
      'bnt': 'bancor',
      'knc': 'kyber-network-crystal',
      'ren': 'ren',
      'skl': 'skale',
      'keep': 'keep-network',
      'nu': 'nucypher',
      'farm': 'harvest-finance',
      'badger': 'badger-dao',
      'perp': 'perpetual-protocol',
      'alpha': 'alpha-finance',
      'cream': 'cream-2',
      'bond': 'barnbridge',
      'hegic': 'hegic',
      'cover': 'cover-protocol',
      'yfig': 'yfi-gold',
      'dht': 'dhedge-dao',
      'dough': 'piedao-dough',
      'rai': 'reflexer-ungovernance-token',
      'idle': 'idle',
      'pickle': 'pickle-finance',
      'torn': 'tornado-cash',
      'api3': 'api3',
      'mask': 'mask-network',
      'rari': 'rarible',
      'ogn': 'origin-protocol',
      'audio': 'audius',
      'rly': 'rally-2'
    };
    
    logger.info('🎯 Logo Collection Service initialized for Phase 1 (CoinGecko API)');
  }

  async initialize() {
    try {
      // Create directories for logo storage
      await fs.mkdir(this.logoDir, { recursive: true });
      await fs.mkdir(path.join(this.logoDir, 'original'), { recursive: true });
      await fs.mkdir(path.join(this.logoDir, 'variations'), { recursive: true });
      
      this.initialized = true;
      logger.info('✅ Logo collection directories created');
    } catch (error) {
      logger.error('❌ Failed to initialize logo collection service:', error);
      throw error;
    }
  }

  async scrapeCryptoLogos() {
    if (!this.initialized) await this.initialize();
    
    logger.info('🚀 Starting Phase 1: Crypto logo collection');
    
    const results = {
      collected: 0,
      failed: 0,
      cryptos: []
    };

    for (const crypto of this.priorityCryptos) {
      try {
        logger.info(`📥 Collecting logos for: ${crypto}`);
        
        const logoData = await this.collectLogoForCrypto(crypto);
        if (logoData) {
          results.collected++;
          results.cryptos.push({
            name: crypto,
            logos: logoData.count,
            variations: logoData.variations
          });
          
          logger.info(`✅ Collected ${logoData.count} logos for ${crypto}`);
        } else {
          results.failed++;
          logger.warn(`⚠️ Failed to collect logos for ${crypto}`);
        }
        
        // Rate limiting
        await this.delay(2000);
        
      } catch (error) {
        logger.error(`❌ Error collecting ${crypto} logos:`, error);
        results.failed++;
      }
    }

    logger.info(`🎯 Phase 1 Collection Complete: ${results.collected} cryptos, ${results.failed} failed`);
    
    // Save collection report
    await this.saveCollectionReport(results);
    
    return results;
  }

  async collectLogoForCrypto(crypto) {
    try {
      // Strategy 1: Try cryptologos.cc direct URLs
      const logoUrls = await this.getCryptoLogoUrls(crypto);
      
      if (logoUrls.length === 0) {
        logger.warn(`No logos found for ${crypto} on cryptologos.cc`);
        return null;
      }

      const savedLogos = [];
      const variations = [];

      for (let i = 0; i < logoUrls.length; i++) {
        try {
          const logoUrl = logoUrls[i];
          const filename = `${crypto}_${i + 1}.png`;
          const filepath = path.join(this.logoDir, 'original', filename);
          
          // Download logo
          const response = await axios.get(logoUrl, { 
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; LogoCollector/1.0)'
            }
          });
          
          await fs.writeFile(filepath, response.data);
          savedLogos.push(filename);
          
          // Generate variations for training
          const logoVariations = await this.generateLogoVariations(filepath, crypto, i + 1);
          variations.push(...logoVariations);
          
          logger.info(`✅ Saved logo: ${filename}`);
          
        } catch (error) {
          logger.warn(`⚠️ Failed to download logo ${i + 1} for ${crypto}:`, error.message);
        }
      }

      return {
        count: savedLogos.length,
        files: savedLogos,
        variations: variations.length
      };

    } catch (error) {
      logger.error(`❌ Failed to collect logos for ${crypto}:`, error);
      return null;
    }
  }

  async getCryptoLogoUrls(crypto) {
    try {
      // Map friendly name to CoinGecko ID if needed
      const coinId = this.cryptoIdMap[crypto] || crypto;
      
      // Use CoinGecko API to get crypto data including logo URLs
      const response = await axios.get(`${this.coingeckoBaseUrl}/coins/${coinId}`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'CryptoLogoCollector/1.0'
        }
      });
      
      if (response.status === 200 && response.data.image) {
        const logoUrls = [];
        const { image } = response.data;
        
        // Get all available sizes from CoinGecko
        if (image.large) logoUrls.push(image.large);
        if (image.small) logoUrls.push(image.small);
        if (image.thumb) logoUrls.push(image.thumb);
        
        logger.info(`✅ Found ${logoUrls.length} logo URLs for ${crypto} from CoinGecko`);
        return logoUrls;
      }
      
      logger.warn(`⚠️ No logo data found for ${crypto} (${coinId}) on CoinGecko`);
      return [];
      
    } catch (error) {
      logger.error(`❌ Failed to get logos for ${crypto} from CoinGecko:`, error.message);
      return [];
    }
  }

  async generateLogoVariations(originalPath, crypto, index) {
    // For now, just create metadata for variations
    // Later we'll implement actual image processing for:
    // - Glowing effects
    // - Metallic textures  
    // - Crystalline structures
    // - Different colors
    
    const variations = [
      `${crypto}_${index}_glowing`,
      `${crypto}_${index}_metallic`, 
      `${crypto}_${index}_crystalline`,
      `${crypto}_${index}_neon`
    ];

    // Save variation metadata for future processing
    const metadataPath = path.join(this.logoDir, 'variations', `${crypto}_${index}_metadata.json`);
    await fs.writeFile(metadataPath, JSON.stringify({
      original: originalPath,
      crypto: crypto,
      variations: variations,
      created: new Date().toISOString()
    }, null, 2));

    return variations;
  }

  async saveCollectionReport(results) {
    const report = {
      phase: 'Phase 1: Logo Collection',
      timestamp: new Date().toISOString(),
      summary: results,
      nextPhase: 'Article Image Collection',
      training_readiness: results.collected >= 5 ? 'Ready' : 'Needs more logos'
    };

    const reportPath = path.join(this.logoDir, 'collection_report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    logger.info(`📊 Collection report saved: ${reportPath}`);
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // API endpoint for manual logo collection
  async collectLogosForCrypto(cryptoName) {
    if (!this.initialized) await this.initialize();
    
    logger.info(`🎯 Manual collection requested for: ${cryptoName}`);
    return await this.collectLogoForCrypto(cryptoName.toLowerCase());
  }

  // Get collection status
  async getCollectionStatus() {
    try {
      const reportPath = path.join(this.logoDir, 'collection_report.json');
      const reportData = await fs.readFile(reportPath, 'utf8');
      return JSON.parse(reportData);
    } catch (error) {
      return {
        phase: 'Phase 1: Not Started',
        timestamp: null,
        summary: { collected: 0, failed: 0, cryptos: [] }
      };
    }
  }
}

module.exports = LogoCollectionService;