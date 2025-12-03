const fs = require('fs').promises;
const path = require('path');
const SVGLogoService = require('../src/services/svgLogoService');

/**
 * Bulk upload SVG logos from user's collection
 */
async function uploadSVGLogos() {
  const svgLogoService = new SVGLogoService();
  const logoDirectory = '/Users/valorkopeny/Desktop/SVG CRYPTO LOGOS';
  
  // Mapping of filename to cryptocurrency info
  const cryptoMapping = {
    'HBAR.svg': { symbol: 'HBAR', name: 'Hedera Hashgraph' },
    'HEDERA.svg': { symbol: 'HBAR', name: 'Hedera Hashgraph' }, // Alternative HBAR logo
    'XRP.svg': { symbol: 'XRP', name: 'Ripple' },
    'XRP-textmark.svg': { symbol: 'XRP', name: 'Ripple' }, // Alternative XRP logo
    'ETH.svg': { symbol: 'ETH', name: 'Ethereum' },
    'ETH-textmark.svg': { symbol: 'ETH', name: 'Ethereum' }, // Alternative ETH logo
    'BNB.svg': { symbol: 'BNB', name: 'Binance Coin' },
    'CARDANO.svg': { symbol: 'ADA', name: 'Cardano' },
    'ALGORAND.svg': { symbol: 'ALGO', name: 'Algorand' },
    'CONSTELLATION.svg': { symbol: 'DAG', name: 'Constellation' },
    'SOLANA.svg': { symbol: 'SOL', name: 'Solana' },
    'POLKADOT.svg': { symbol: 'DOT', name: 'Polkadot' },
    'CHAINLINK.svg': { symbol: 'LINK', name: 'Chainlink' },
    'AVALANCHE.svg': { symbol: 'AVAX', name: 'Avalanche' },
    'DOGECOIN.svg': { symbol: 'DOGE', name: 'Dogecoin' },
    'STELLAR.svg': { symbol: 'XLM', name: 'Stellar' },
    'MONERO.svg': { symbol: 'XMR', name: 'Monero' },
    'NEAR.svg': { symbol: 'NEAR', name: 'NEAR Protocol' },
    'APTOS.svg': { symbol: 'APT', name: 'Aptos' },
    'SUI.svg': { symbol: 'SUI', name: 'Sui' },
    'QUANT.svg': { symbol: 'QNT', name: 'Quant' },
    'FILECOIN.svg': { symbol: 'FIL', name: 'Filecoin' },
    'TRON.svg': { symbol: 'TRX', name: 'TRON' },
    'CRONOS.svg': { symbol: 'CRO', name: 'Cronos' },
    'THORCHAIN.svg': { symbol: 'RUNE', name: 'THORChain' },
    'TONCOIN.svg': { symbol: 'TON', name: 'Toncoin' },
    'SEI.svg': { symbol: 'SEI', name: 'Sei' },
    'ONDO.svg': { symbol: 'ONDO', name: 'Ondo Finance' },
    'IMMUTABLE IMX.svg': { symbol: 'IMX', name: 'Immutable X' },
    'BITTENSOR.svg': { symbol: 'TAO', name: 'Bittensor' },
    'USDC.svg': { symbol: 'USDC', name: 'USD Coin' },
    'USDT.svg': { symbol: 'USDT', name: 'Tether' },
    'UNISWAP.svg': { symbol: 'UNI', name: 'Uniswap' }
  };
  
  try {
    console.log('🎨 Starting bulk SVG logo upload...');
    
    const files = await fs.readdir(logoDirectory);
    const svgFiles = files.filter(file => file.endsWith('.svg'));
    
    console.log(`📁 Found ${svgFiles.length} SVG files to process`);
    
    const results = [];
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const filename of svgFiles) {
      try {
        const cryptoInfo = cryptoMapping[filename];
        
        if (!cryptoInfo) {
          console.log(`⚠️ Skipping ${filename} - no mapping found`);
          skipped++;
          continue;
        }
        
        console.log(`🔄 Processing ${filename} → ${cryptoInfo.symbol} (${cryptoInfo.name})`);
        
        // Read SVG content
        const filePath = path.join(logoDirectory, filename);
        const svgContent = await fs.readFile(filePath, 'utf8');
        
        // Upload and process
        const result = await svgLogoService.upsertLogo(
          cryptoInfo.symbol,
          cryptoInfo.name,
          svgContent
        );
        
        results.push({
          filename,
          symbol: cryptoInfo.symbol,
          name: cryptoInfo.name,
          status: 'success',
          result
        });
        
        processed++;
        console.log(`✅ Successfully processed ${cryptoInfo.symbol}`);
        
      } catch (error) {
        console.error(`❌ Failed to process ${filename}:`, error.message);
        results.push({
          filename,
          status: 'error',
          error: error.message
        });
        errors++;
      }
    }
    
    console.log('\\n📊 Upload Summary:');
    console.log(`✅ Processed: ${processed}`);
    console.log(`⚠️ Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📁 Total files: ${svgFiles.length}`);
    
    // Get final logo statistics
    const stats = await svgLogoService.getLogoStats();
    console.log('\\n📈 Database Statistics:');
    console.log(`🎨 Total logos: ${stats.totalLogos}`);
    console.log(`🖼️ With Canny: ${stats.withCanny}`);
    console.log(`🕳️ With Depth: ${stats.withDepth}`);
    
    return {
      success: true,
      processed,
      skipped,
      errors,
      totalFiles: svgFiles.length,
      stats,
      results
    };
    
  } catch (error) {
    console.error('❌ Bulk upload failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the upload if called directly
if (require.main === module) {
  uploadSVGLogos()
    .then(result => {
      console.log('\\n🎯 Upload complete:', result.success ? 'SUCCESS' : 'FAILED');
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Upload crashed:', error);
      process.exit(1);
    });
}

module.exports = { uploadSVGLogos };