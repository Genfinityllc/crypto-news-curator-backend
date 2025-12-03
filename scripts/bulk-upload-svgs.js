const fs = require('fs').promises;
const path = require('path');
const SVGLogoService = require('../src/services/svgLogoService');
const logger = require('../src/utils/logger');

/**
 * Bulk SVG Upload Script
 * Processes all SVG files in the collection and uploads them to the database
 * Maps SVG filenames to proper cryptocurrency/company symbols and names
 */

// SVG filename to symbol/name mapping
const SVG_MAPPING = {
  // Major Cryptocurrencies
  'XRP.svg': { symbol: 'XRP', name: 'Ripple' },
  'XRP-textmark.svg': { symbol: 'XRP-TEXTMARK', name: 'Ripple Text' },
  'ETH.svg': { symbol: 'ETH', name: 'Ethereum' },
  'ETH-textmark.svg': { symbol: 'ETH-TEXTMARK', name: 'Ethereum Text' },
  'CARDANO.svg': { symbol: 'CARDANO', name: 'Cardano' },
  'SOLANA.svg': { symbol: 'SOLANA', name: 'Solana' },
  'AVALANCHE.svg': { symbol: 'AVALANCHE', name: 'Avalanche' },
  'POLKADOT.svg': { symbol: 'POLKADOT', name: 'Polkadot' },
  'CHAINLINK.svg': { symbol: 'CHAINLINK', name: 'Chainlink' },
  'ALGORAND.svg': { symbol: 'ALGORAND', name: 'Algorand' },
  'APTOS.svg': { symbol: 'APTOS', name: 'Aptos' },
  
  // Layer 1 & Alternative Blockchains
  'HBAR.svg': { symbol: 'HBAR', name: 'Hedera Hashgraph' },
  'HEDERA.svg': { symbol: 'HEDERA', name: 'Hedera' },
  'CONSTELLATION.svg': { symbol: 'CONSTELLATION', name: 'Constellation Network' },
  'XDC.svg': { symbol: 'XDC', name: 'XDC Network' },
  'CRONOS.svg': { symbol: 'CRONOS', name: 'Cronos' },
  'NEAR.svg': { symbol: 'NEAR', name: 'NEAR Protocol' },
  'SUI.svg': { symbol: 'SUI', name: 'Sui Network' },
  'SEI.svg': { symbol: 'SEI', name: 'Sei Network' },
  'TRON.svg': { symbol: 'TRON', name: 'Tron' },
  'STELLAR.svg': { symbol: 'STELLAR', name: 'Stellar' },
  'TONCOIN.svg': { symbol: 'TONCOIN', name: 'Toncoin' },
  
  // Binance Ecosystem
  'BNB.svg': { symbol: 'BNB', name: 'BNB Chain' },
  
  // DeFi & Layer 2
  'UNISWAP.svg': { symbol: 'UNISWAP', name: 'Uniswap' },
  'THORCHAIN.svg': { symbol: 'THORCHAIN', name: 'THORChain' },
  'IMMUTABLE IMX.svg': { symbol: 'IMMUTABLE', name: 'Immutable X' },
  
  // Privacy Coins & Meme Coins
  'MONERO.svg': { symbol: 'MONERO', name: 'Monero' },
  'DOGECOIN.svg': { symbol: 'DOGECOIN', name: 'Dogecoin' },
  
  // Stablecoins
  'USDC.svg': { symbol: 'USDC', name: 'USD Coin' },
  'USDT.svg': { symbol: 'USDT', name: 'Tether' },
  
  // AI & Tech
  'BITTENSOR.svg': { symbol: 'BITTENSOR', name: 'Bittensor' },
  'FILECOIN.svg': { symbol: 'FILECOIN', name: 'Filecoin' },
  'QUANT.svg': { symbol: 'QUANT', name: 'Quant Network' },
  'ONDO.svg': { symbol: 'ONDO', name: 'Ondo Finance' },
  
  // Companies & Institutions
  'BLACKROCK.svg': { symbol: 'BLACKROCK', name: 'BlackRock' },
  'Grayscale.svg': { symbol: 'GRAYSCALE', name: 'Grayscale Investments' },
  '21shares.svg': { symbol: '21SHARES', name: '21Shares' },
  'PAXOS.svg': { symbol: 'PAXOS', name: 'Paxos' },
  'MoonPay.svg': { symbol: 'MOONPAY', name: 'MoonPay' },
  'Robinhood.svg': { symbol: 'ROBINHOOD', name: 'Robinhood' },
  'NVIDIA.svg': { symbol: 'NVIDIA', name: 'NVIDIA' },
  'Bitmine.svg': { symbol: 'BITMINE', name: 'Bitmine' }
};

async function bulkUploadSVGs() {
  const svgDir = '/Users/valorkopeny/Desktop/SVG CRYPTO LOGOS';
  const svgLogoService = new SVGLogoService();
  
  logger.info('🚀 Starting bulk SVG upload process...');
  
  try {
    // Read all SVG files from directory
    const files = await fs.readdir(svgDir);
    const svgFiles = files.filter(file => file.endsWith('.svg'));
    
    logger.info(`📁 Found ${svgFiles.length} SVG files to process`);
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const filename of svgFiles) {
      try {
        logger.info(`🎨 Processing: ${filename}`);
        
        // Get symbol and name mapping
        const mapping = SVG_MAPPING[filename];
        if (!mapping) {
          logger.warn(`⚠️ No mapping found for ${filename}, skipping...`);
          results.push({ filename, status: 'skipped', reason: 'No mapping found' });
          continue;
        }
        
        // Read SVG content
        const filePath = path.join(svgDir, filename);
        const svgContent = await fs.readFile(filePath, 'utf8');
        
        // Upload to database
        const result = await svgLogoService.upsertLogo(
          mapping.symbol,
          mapping.name,
          svgContent
        );
        
        logger.info(`✅ Successfully uploaded: ${mapping.symbol} (${mapping.name})`);
        results.push({ 
          filename, 
          status: 'success', 
          symbol: mapping.symbol, 
          name: mapping.name,
          id: result.id 
        });
        successCount++;
        
      } catch (error) {
        logger.error(`❌ Failed to process ${filename}:`, error.message);
        results.push({ 
          filename, 
          status: 'error', 
          error: error.message 
        });
        errorCount++;
      }
    }
    
    // Summary
    logger.info(`\n📊 BULK UPLOAD SUMMARY:`);
    logger.info(`✅ Successful: ${successCount}`);
    logger.info(`❌ Failed: ${errorCount}`);
    logger.info(`⏭️ Skipped: ${results.filter(r => r.status === 'skipped').length}`);
    logger.info(`📁 Total processed: ${results.length}`);
    
    // Show detailed results
    logger.info(`\n📋 DETAILED RESULTS:`);
    results.forEach(result => {
      const status = result.status === 'success' ? '✅' : 
                    result.status === 'error' ? '❌' : '⏭️';
      logger.info(`${status} ${result.filename} ${result.symbol ? '→ ' + result.symbol : ''}`);
    });
    
    return results;
    
  } catch (error) {
    logger.error('❌ Bulk upload process failed:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  bulkUploadSVGs()
    .then(results => {
      logger.info('🎉 Bulk upload completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      logger.error('💥 Bulk upload failed:', error);
      process.exit(1);
    });
}

module.exports = { bulkUploadSVGs, SVG_MAPPING };