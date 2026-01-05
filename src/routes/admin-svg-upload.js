const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { getSupabaseClient } = require('../config/supabase');
const logger = require('../utils/logger');

// Admin endpoint to bulk upload SVGs
router.post('/bulk-upload-svgs', async (req, res) => {
  try {
    logger.info('🔧 Starting bulk SVG upload...');
    
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    const svgDir = '/Users/valorkopeny/Desktop/SVG CRYPTO LOGOS';
    
    let files;
    try {
      const allFiles = await fs.readdir(svgDir);
      files = allFiles.filter(file => file.endsWith('.svg'));
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: 'SVG directory not found',
        message: 'Could not read SVG directory'
      });
    }
    
    logger.info(`📁 Found ${files.length} SVG files to upload`);
    
    const results = {
      success: 0,
      errors: 0,
      details: []
    };
    
    for (const file of files) {
      try {
        const filePath = path.join(svgDir, file);
        const svgContent = await fs.readFile(filePath, 'utf8');
        
        // Extract symbol from filename
        let symbol = file.replace('.svg', '').toUpperCase();
        
        // Handle special cases
        if (symbol.includes('-TEXTMARK')) {
          results.details.push({ file, status: 'skipped', reason: 'textmark version' });
          continue;
        }
        if (symbol === 'IMMUTABLE IMX') {
          symbol = 'IMX';
        }
        if (symbol === 'BITMINE') {
          symbol = 'BTCM';
        }
        
        logger.info(`📤 Uploading ${symbol}...`);
        
        // Use upsert to handle duplicates
        const { data, error } = await supabase
          .from('crypto_logos')
          .upsert({
            symbol: symbol,
            name: symbol,
            svg_data: svgContent,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'symbol'
          });
        
        if (error) {
          logger.error(`❌ Failed to upload ${symbol}:`, error.message);
          results.errors++;
          results.details.push({ file, symbol, status: 'error', error: error.message });
        } else {
          logger.info(`✅ Uploaded ${symbol} successfully`);
          results.success++;
          results.details.push({ file, symbol, status: 'success' });
        }
        
      } catch (error) {
        logger.error(`❌ Failed to process ${file}:`, error.message);
        results.errors++;
        results.details.push({ file, status: 'error', error: error.message });
      }
    }
    
    logger.info(`🎉 Upload complete! Success: ${results.success}, Errors: ${results.errors}`);
    
    res.json({
      success: true,
      message: 'Bulk SVG upload completed',
      results: results
    });
    
  } catch (error) {
    logger.error('❌ Bulk SVG upload failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;