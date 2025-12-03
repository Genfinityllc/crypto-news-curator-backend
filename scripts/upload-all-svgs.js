#!/usr/bin/env node

/**
 * Upload ALL SVG Crypto Logos to Supabase
 * Processes every SVG in the crypto logos folder for 100% logo accuracy
 */

const fs = require('fs').promises;
const path = require('path');
const { getSupabaseClient } = require('../src/config/supabase');
const SVGPreprocessor = require('../src/services/svgPreprocessor');
const logger = require('../src/utils/logger');

const CRYPTO_LOGOS_FOLDER = '/Users/valorkopeny/Desktop/SVG CRYPTO LOGOS';

// Cryptocurrency name mappings for proper database entries
const CRYPTO_MAPPINGS = {
  '21shares': { symbol: '21SHARES', name: '21Shares' },
  'ALGORAND': { symbol: 'ALGO', name: 'Algorand' },
  'APTOS': { symbol: 'APT', name: 'Aptos' },
  'AVALANCHE': { symbol: 'AVAX', name: 'Avalanche' },
  'BITTENSOR': { symbol: 'TAO', name: 'Bittensor' },
  'BLACKROCK': { symbol: 'BLACKROCK', name: 'BlackRock' },
  'BNB': { symbol: 'BNB', name: 'BNB Chain' },
  'Bitmine': { symbol: 'BITMINE', name: 'Bitmine' },
  'CARDANO': { symbol: 'ADA', name: 'Cardano' },
  'CHAINLINK': { symbol: 'LINK', name: 'Chainlink' },
  'CONSTELLATION': { symbol: 'DAG', name: 'Constellation' },
  'CRONOS': { symbol: 'CRO', name: 'Cronos' },
  'DOGECOIN': { symbol: 'DOGE', name: 'Dogecoin' },
  'ETH-textmark': { symbol: 'ETH_TEXT', name: 'Ethereum Textmark' },
  'ETH': { symbol: 'ETH', name: 'Ethereum' },
  'FILECOIN': { symbol: 'FIL', name: 'Filecoin' },
  'Grayscale': { symbol: 'GRAYSCALE', name: 'Grayscale' },
  'HASHPACK': { symbol: 'HASHPACK', name: 'HashPack' },
  'HBAR': { symbol: 'HBAR', name: 'Hedera' },
  'HEDERA': { symbol: 'HEDERA', name: 'Hedera Network' },
  'IMMUTABLE IMX': { symbol: 'IMX', name: 'Immutable X' },
  'MONERO': { symbol: 'XMR', name: 'Monero' },
  'MoonPay': { symbol: 'MOONPAY', name: 'MoonPay' },
  'NEAR': { symbol: 'NEAR', name: 'NEAR Protocol' },
  'NVIDIA': { symbol: 'NVIDIA', name: 'NVIDIA' },
  'ONDO': { symbol: 'ONDO', name: 'Ondo Finance' },
  'PAXOS': { symbol: 'PAXOS', name: 'Paxos' },
  'POLKADOT': { symbol: 'DOT', name: 'Polkadot' },
  'QUANT': { symbol: 'QNT', name: 'Quant' },
  'Robinhood': { symbol: 'ROBINHOOD', name: 'Robinhood' },
  'SEI': { symbol: 'SEI', name: 'Sei' },
  'SOLANA': { symbol: 'SOL', name: 'Solana' },
  'STELLAR': { symbol: 'XLM', name: 'Stellar' },
  'SUI': { symbol: 'SUI', name: 'Sui' },
  'THORCHAIN': { symbol: 'RUNE', name: 'THORChain' },
  'TONCOIN': { symbol: 'TON', name: 'Toncoin' },
  'TRON': { symbol: 'TRX', name: 'TRON' },
  'UNISWAP': { symbol: 'UNI', name: 'Uniswap' },
  'USDC': { symbol: 'USDC', name: 'USD Coin' },
  'USDT': { symbol: 'USDT', name: 'Tether' },
  'XDC': { symbol: 'XDC', name: 'XDC Network' },
  'XRP-textmark': { symbol: 'XRP_TEXT', name: 'XRP Textmark' },
  'XRP': { symbol: 'XRP', name: 'XRP' }
};

async function uploadAllSVGs() {
  logger.info('🚀 Starting upload of ALL crypto SVG logos...');
  
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    const preprocessor = new SVGPreprocessor();
    
    // Read all SVG files from the crypto logos directory
    const files = await fs.readdir(CRYPTO_LOGOS_FOLDER);
    const svgFiles = files.filter(file => file.endsWith('.svg'));
    
    logger.info(`📋 Found ${svgFiles.length} SVG files to process`);
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const svgFile of svgFiles) {
      const baseName = path.basename(svgFile, '.svg');
      const mapping = CRYPTO_MAPPINGS[baseName];
      
      if (!mapping) {
        logger.warn(`⚠️ No mapping found for ${baseName}, skipping...`);
        skipCount++;
        continue;
      }
      
      const { symbol, name } = mapping;
      logger.info(`🎯 Processing ${symbol} (${name}) from ${svgFile}...`);
      
      try {
        // Read SVG content
        const svgPath = path.join(CRYPTO_LOGOS_FOLDER, svgFile);
        const svgContent = await fs.readFile(svgPath, 'utf-8');
        
        // Check if already exists
        const { data: existing, error: checkError } = await supabase
          .from('crypto_logos')
          .select('id, symbol')
          .eq('symbol', symbol)
          .single();
        
        if (existing && !checkError) {
          logger.info(`✅ ${symbol} already exists, updating...`);
        }
        
        // Preprocess SVG for ControlNet
        const processed = await preprocessor.processSVGForControlNet(svgContent, symbol);
        
        // Prepare logo data
        const logoData = {
          symbol: symbol,
          name: name,
          svg_data: svgContent,
          svg_hash: processed.svgHash,
          preprocessed_canny: processed.preprocessedCanny,
          preprocessed_depth: processed.preprocessedDepth,
          brand_colors: processed.brandColors,
          dimensions: processed.dimensions,
          metadata: {
            ...processed.metadata,
            source_file: svgFile,
            uploaded_at: new Date().toISOString()
          }
        };
        
        // Insert or update in database
        const { error: upsertError } = await supabase
          .from('crypto_logos')
          .upsert(logoData, { 
            onConflict: 'symbol',
            ignoreDuplicates: false
          });
        
        if (upsertError) {
          logger.error(`❌ Failed to upsert ${symbol}:`, upsertError);
          errorCount++;
          continue;
        }
        
        logger.info(`✅ Successfully processed ${symbol} - SVG + ControlNet data ready`);
        successCount++;
        
      } catch (processError) {
        logger.error(`❌ Failed to process ${baseName}:`, processError.message);
        errorCount++;
        continue;
      }
    }
    
    // Final summary
    logger.info('🎉 SVG Upload Summary:');
    logger.info(`  ✅ Successful: ${successCount}`);
    logger.info(`  ⚠️ Skipped: ${skipCount}`);
    logger.info(`  ❌ Errors: ${errorCount}`);
    logger.info(`  📊 Total SVG files: ${svgFiles.length}`);
    
    // Verify database state
    const { data: verification, error: verifyError } = await supabase
      .from('crypto_logos')
      .select('symbol, name, preprocessed_canny, preprocessed_depth')
      .order('symbol');
    
    if (!verifyError && verification) {
      logger.info(`📊 Database now contains ${verification.length} crypto logos with ControlNet data:`);
      verification.forEach(logo => {
        const cannyStatus = logo.preprocessed_canny ? '✅' : '❌';
        const depthStatus = logo.preprocessed_depth ? '✅' : '❌';
        logger.info(`  ${logo.symbol}: ${logo.name} | Canny ${cannyStatus} | Depth ${depthStatus}`);
      });
    }
    
    logger.info('🚀 ALL crypto logos uploaded and ready for 100% accurate generation!');
    
  } catch (error) {
    logger.error('❌ SVG upload failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  uploadAllSVGs()
    .then(() => process.exit(0))
    .catch(error => {
      logger.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { uploadAllSVGs };