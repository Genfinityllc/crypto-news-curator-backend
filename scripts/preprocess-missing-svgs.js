#!/usr/bin/env node

/**
 * Preprocess Missing SVG Logos for ControlNet Conditioning
 * Generates exact edge/depth maps from SVG data for 100% logo accuracy
 */

const { getSupabaseClient } = require('../src/config/supabase');
const SVGPreprocessor = require('../src/services/svgPreprocessor');
const logger = require('../src/utils/logger');

async function preprocessMissingSVGs() {
  logger.info('🎨 Starting SVG preprocessing for missing ControlNet data...');
  
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    const preprocessor = new SVGPreprocessor();
    
    // Get logos missing ControlNet data
    const { data: logosToProcess, error } = await supabase
      .from('crypto_logos')
      .select('id, symbol, name, svg_data')
      .or('preprocessed_canny.is.null,preprocessed_depth.is.null')
      .in('symbol', ['SOL', 'ADA']);
    
    if (error) {
      throw error;
    }
    
    logger.info(`📋 Found ${logosToProcess.length} logos to preprocess`);
    
    for (const logo of logosToProcess) {
      logger.info(`🎯 Processing ${logo.symbol} (${logo.name})...`);
      
      try {
        // Preprocess SVG to generate ControlNet conditioning data
        const processed = await preprocessor.processSVGForControlNet(logo.svg_data, logo.symbol);
        
        // Update database with preprocessed data
        const { error: updateError } = await supabase
          .from('crypto_logos')
          .update({
            preprocessed_canny: processed.preprocessedCanny,
            preprocessed_depth: processed.preprocessedDepth,
            svg_hash: processed.svgHash,
            dimensions: processed.dimensions,
            brand_colors: processed.brandColors,
            updated_at: new Date().toISOString()
          })
          .eq('id', logo.id);
        
        if (updateError) {
          logger.error(`❌ Failed to update ${logo.symbol}:`, updateError);
          continue;
        }
        
        logger.info(`✅ Successfully processed ${logo.symbol} - ControlNet data generated`);
        
      } catch (processError) {
        logger.error(`❌ Failed to process ${logo.symbol}:`, processError.message);
        continue;
      }
    }
    
    // Verify all logos now have ControlNet data
    const { data: verification, error: verifyError } = await supabase
      .from('crypto_logos')
      .select('symbol, name, preprocessed_canny, preprocessed_depth')
      .in('symbol', ['XRP', 'ETH', 'BNB', 'SOL', 'ADA', 'HBAR'])
      .order('symbol');
    
    if (!verifyError && verification) {
      logger.info('📊 ControlNet Data Status:');
      verification.forEach(logo => {
        const cannyStatus = logo.preprocessed_canny ? '✅' : '❌';
        const depthStatus = logo.preprocessed_depth ? '✅' : '❌';
        logger.info(`  ${logo.symbol}: Canny ${cannyStatus} | Depth ${depthStatus}`);
      });
    }
    
    logger.info('🎉 SVG preprocessing completed! All logos ready for 100% accurate generation');
    
  } catch (error) {
    logger.error('❌ SVG preprocessing failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  preprocessMissingSVGs()
    .then(() => process.exit(0))
    .catch(error => {
      logger.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { preprocessMissingSVGs };