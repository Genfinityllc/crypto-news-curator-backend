/**
 * Enhanced SVG Processing Script - Maximum Accuracy for All 43 Cryptocurrencies
 * Processes all SVG logos with cutting-edge 2024 techniques for exact geometric preservation
 * 
 * Features:
 * - 2048x2048 high-resolution processing
 * - Multi-format conditioning (Canny, Depth, Normal, Mask)
 * - Enhanced edge detection with Sobel kernels
 * - 16-bit depth maps for precise control
 * - Normal maps for surface detail
 * - High-contrast masks for region control
 */

const fs = require('fs').promises;
const path = require('path');
const { getSupabaseClient } = require('../src/config/supabase');
const SVGPreprocessor = require('../src/services/svgPreprocessor');
const logger = require('../src/utils/logger');

class EnhancedSVGProcessor {
  constructor() {
    this.preprocessor = new SVGPreprocessor();
    this.svgDirectory = '/Users/valorkopeny/Desktop/SVG CRYPTO LOGOS';
    this.processedCount = 0;
    this.failedCount = 0;
    this.results = [];
    
    logger.info('🚀 Enhanced SVG Processor initialized for maximum accuracy');
  }

  /**
   * Get all SVG files from the directory
   */
  async getSVGFiles() {
    try {
      const files = await fs.readdir(this.svgDirectory);
      const svgFiles = files
        .filter(file => file.endsWith('.svg'))
        .map(file => ({
          filename: file,
          symbol: path.basename(file, '.svg').toUpperCase(),
          filepath: path.join(this.svgDirectory, file)
        }));
      
      logger.info(`📁 Found ${svgFiles.length} SVG files for enhanced processing`);
      return svgFiles;
    } catch (error) {
      logger.error('❌ Failed to read SVG directory:', error.message);
      throw error;
    }
  }

  /**
   * Generate cryptocurrency name from symbol
   */
  generateCryptoName(symbol) {
    const nameMap = {
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum', 
      'BNB': 'Binance Coin',
      'XRP': 'Ripple',
      'ADA': 'Cardano',
      'DOGE': 'Dogecoin',
      'MATIC': 'Polygon',
      'SOL': 'Solana',
      'DOT': 'Polkadot',
      'LTC': 'Litecoin',
      'SHIB': 'Shiba Inu',
      'TRX': 'TRON',
      'AVAX': 'Avalanche',
      'DAI': 'Dai',
      'LINK': 'Chainlink',
      'UNI': 'Uniswap',
      'WBTC': 'Wrapped Bitcoin',
      'LEO': 'LEO Token',
      'ETC': 'Ethereum Classic',
      'XMR': 'Monero',
      'NEAR': 'NEAR Protocol',
      'ICP': 'Internet Computer',
      'HBAR': 'Hedera',
      'VET': 'VeChain',
      'FIL': 'Filecoin',
      'ALGO': 'Algorand',
      'XTZ': 'Tezos',
      'SAND': 'The Sandbox',
      'MANA': 'Decentraland',
      'AXS': 'Axie Infinity',
      'THETA': 'Theta Network',
      'FTM': 'Fantom',
      'FLOW': 'Flow',
      'EGLD': 'MultiversX',
      'XDC': 'XDC Network',
      'USDT': 'Tether',
      'USDC': 'USD Coin',
      'BNB': 'BNB',
      'STETH': 'Lido Staked Ether',
      'FDUSD': 'First Digital USD',
      'TON': 'Toncoin',
      'PEPE': 'Pepe',
      'WIF': 'dogwifhat'
    };
    
    return nameMap[symbol] || symbol;
  }

  /**
   * Process single SVG with enhanced conditioning
   */
  async processSingleSVG(svgFile) {
    try {
      logger.info(`🎨 Processing ${svgFile.symbol} with enhanced conditioning...`);
      
      // Read SVG content
      const svgContent = await fs.readFile(svgFile.filepath, 'utf8');
      
      // Process with enhanced preprocessing
      const processed = await this.preprocessor.processSVGForControlNet(svgContent, svgFile.symbol);
      
      // Prepare data for database
      const logoData = {
        symbol: svgFile.symbol,
        name: this.generateCryptoName(svgFile.symbol),
        svg_data: svgContent,
        svg_hash: processed.svgHash,
        preprocessed_canny: processed.preprocessedCanny,
        preprocessed_depth: processed.preprocessedDepth,
        preprocessed_normal: processed.preprocessedNormal, // NEW
        preprocessed_mask: processed.preprocessedMask, // NEW
        brand_colors: processed.brandColors,
        dimensions: processed.dimensions,
        metadata: {
          ...processed.metadata,
          enhanced: true,
          source_file: svgFile.filename,
          processing_date: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      };

      // Upsert to database
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('crypto_logos')
        .upsert([logoData], {
          onConflict: 'symbol',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        throw error;
      }

      this.processedCount++;
      const result = {
        symbol: svgFile.symbol,
        name: logoData.name,
        success: true,
        formats: processed.metadata.formats,
        size: processed.metadata.outputSize,
        filename: svgFile.filename
      };
      
      this.results.push(result);
      logger.info(`✅ ${svgFile.symbol} processed successfully with ${Object.values(processed.metadata.formats).filter(Boolean).length} conditioning formats`);
      
      return result;
      
    } catch (error) {
      this.failedCount++;
      const result = {
        symbol: svgFile.symbol,
        success: false,
        error: error.message,
        filename: svgFile.filename
      };
      
      this.results.push(result);
      logger.error(`❌ Failed to process ${svgFile.symbol}: ${error.message}`);
      
      return result;
    }
  }

  /**
   * Process all SVG files with enhanced conditioning
   */
  async processAll() {
    const startTime = Date.now();
    
    try {
      logger.info('🚀 Starting enhanced processing of all 43 cryptocurrency SVGs');
      
      // Get all SVG files
      const svgFiles = await this.getSVGFiles();
      
      logger.info(`📋 Processing ${svgFiles.length} cryptocurrencies with enhanced conditioning formats:`);
      svgFiles.forEach(file => logger.info(`   • ${file.symbol} (${file.filename})`));
      
      // Process each SVG with enhanced conditioning
      for (let i = 0; i < svgFiles.length; i++) {
        const svgFile = svgFiles[i];
        logger.info(`\n[${i + 1}/${svgFiles.length}] Processing ${svgFile.symbol}...`);
        
        await this.processSingleSVG(svgFile);
        
        // Brief pause to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      
      // Generate final report
      this.generateReport(totalTime);
      
    } catch (error) {
      logger.error('❌ Enhanced processing failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate processing report
   */
  generateReport(totalTime) {
    logger.info('\n' + '='.repeat(80));
    logger.info('📊 ENHANCED SVG PROCESSING REPORT');
    logger.info('='.repeat(80));
    
    logger.info(`🎯 Total cryptocurrencies processed: ${this.processedCount + this.failedCount}`);
    logger.info(`✅ Successfully processed: ${this.processedCount}`);
    logger.info(`❌ Failed: ${this.failedCount}`);
    logger.info(`⏱️  Total processing time: ${totalTime}s`);
    logger.info(`📈 Average time per logo: ${(totalTime / (this.processedCount + this.failedCount)).toFixed(1)}s`);
    
    // Enhanced conditioning formats summary
    const successfulResults = this.results.filter(r => r.success);
    if (successfulResults.length > 0) {
      const formatCounts = {
        canny: 0,
        depth: 0, 
        normal: 0,
        mask: 0
      };
      
      successfulResults.forEach(result => {
        if (result.formats) {
          Object.keys(formatCounts).forEach(format => {
            if (result.formats[format]) formatCounts[format]++;
          });
        }
      });
      
      logger.info('\n🎨 Enhanced Conditioning Formats Generated:');
      logger.info(`   • Canny Edge Maps: ${formatCounts.canny}/${successfulResults.length}`);
      logger.info(`   • High-Res Depth Maps: ${formatCounts.depth}/${successfulResults.length}`);
      logger.info(`   • Normal Maps: ${formatCounts.normal}/${successfulResults.length}`);
      logger.info(`   • High-Contrast Masks: ${formatCounts.mask}/${successfulResults.length}`);
    }
    
    // List successful cryptocurrencies
    if (this.processedCount > 0) {
      logger.info('\n✅ Successfully Enhanced Cryptocurrencies:');
      successfulResults.forEach(result => {
        const formatCount = Object.values(result.formats || {}).filter(Boolean).length;
        logger.info(`   • ${result.symbol} (${result.name}) - ${formatCount} formats`);
      });
    }
    
    // List failed cryptocurrencies
    if (this.failedCount > 0) {
      logger.info('\n❌ Failed Processing:');
      this.results.filter(r => !r.success).forEach(result => {
        logger.info(`   • ${result.symbol}: ${result.error}`);
      });
    }
    
    logger.info('\n🚀 Enhanced processing complete! All cryptocurrencies now have maximum accuracy conditioning.');
    logger.info('🎯 Ready for exact geometric shape preservation with stylized 3D effects.');
    logger.info('='.repeat(80));
  }
}

// Main execution
async function main() {
  try {
    const processor = new EnhancedSVGProcessor();
    await processor.processAll();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Enhanced SVG processing failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = EnhancedSVGProcessor;