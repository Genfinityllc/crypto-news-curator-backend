const { getSupabaseClient } = require('../config/supabase');
const SVGPreprocessor = require('./svgPreprocessor');
const logger = require('../utils/logger');
const { detectCryptocurrency } = require('./cryptoDetectionService');

/**
 * SVG Logo Service - CRUD operations for cryptocurrency logos
 * Handles SVG storage, preprocessing, and retrieval for ControlNet conditioning
 */
class SVGLogoService {
  constructor() {
    this.preprocessor = new SVGPreprocessor();
    logger.info('🎨 SVG Logo Service initialized');
  }

  /**
   * Get all cryptocurrency logos
   */
  async getAllLogos() {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { data, error } = await supabase
        .from('crypto_logos')
        .select('*')
        .order('symbol', { ascending: true });

      if (error) {
        throw error;
      }

      logger.info(`📋 Retrieved ${data.length} crypto logos`);
      return data;
    } catch (error) {
      logger.error('❌ Failed to get all logos:', error.message);
      throw error;
    }
  }

  /**
   * Detect cryptocurrency from article and get corresponding logo data
   * NEW: Used by ControlNet for automatic SVG conditioning
   */
  async detectAndGetLogo(title, content) {
    try {
      // Network detection logic (same as RunPod service)
      const text = `${title} ${content}`.toLowerCase();
      logger.info(`🔍 Detecting crypto from: "${text}"`);
      
      const networkMappings = {
        // XRP variants
        'xrp token': 'XRP',
        'xrp price': 'XRP', 
        'xrp trading': 'XRP',
        'xrp coin': 'XRP',
        'xrp cryptocurrency': 'XRP',
        'xrp': 'XRP',
        'ripple network': 'XRP',
        'ripple labs': 'XRP',
        'ripple': 'XRP',
        
        // USDT/Tether - CRITICAL MISSING!
        'usdt': 'USDT',
        'tether': 'USDT',
        'tether token': 'USDT',
        'usdt token': 'USDT',
        'tether usdt': 'USDT',
        
        // Major cryptocurrencies
        'ethereum': 'ETH',
        'eth': 'ETH',
        'bitcoin': 'BTC',
        'btc': 'BTC',
        'bnb': 'BNB',
        'binance coin': 'BNB',
        'binance': 'BNB',
        'solana': 'SOL',
        'sol': 'SOL',
        'cardano': 'ADA',
        'ada': 'ADA',
        'hbar': 'HBAR',
        'hedera': 'HBAR',
        'hashgraph': 'HBAR',
        
        // Additional cryptocurrencies from our 43 logo database
        'algorand': 'ALGO',
        'algo': 'ALGO',
        'chainlink': 'LINK',
        'link': 'LINK',
        'polkadot': 'DOT',
        'dot': 'DOT',
        'avalanche': 'AVAX',
        'avax': 'AVAX',
        'dogecoin': 'DOGE',
        'doge': 'DOGE',
        'shiba': 'DOGE',
        'filecoin': 'FIL',
        'fil': 'FIL',
        'monero': 'XMR',
        'xmr': 'XMR',
        'stellar': 'XLM',
        'xlm': 'XLM',
        'near protocol': 'NEAR',
        'near': 'NEAR',
        'cronos': 'CRO',
        'cro': 'CRO',
        'crypto.com': 'CRO',
        'aptos': 'APT',
        'apt': 'APT',
        'sui': 'SUI',
        'immutable': 'IMX',
        'imx': 'IMX',
        'bittensor': 'TAO',
        'tao': 'TAO',
        'ondo': 'ONDO',
        'quant': 'QNT',
        'qnt': 'QNT',
        'constellation': 'DAG',
        'dag': 'DAG',
        'thorchain': 'RUNE',
        'rune': 'RUNE',
        'toncoin': 'TON',
        'ton': 'TON',
        'tron': 'TRX',
        'trx': 'TRX',
        'uniswap': 'UNI',
        'uni': 'UNI',
        'xdc network': 'XDC',
        'xdc': 'XDC'
      };
      
      let detectedSymbol = null;
      for (const [keyword, symbol] of Object.entries(networkMappings)) {
        if (text.includes(keyword)) {
          detectedSymbol = symbol;
          logger.info(`✅ Detected ${symbol} from keyword: ${keyword}`);
          break;
        }
      }
      
      if (!detectedSymbol) {
        logger.warn(`❌ No cryptocurrency detected from text`);
        return null;
      }
      
      // Get the logo data
      const logo = await this.getLogoBySymbol(detectedSymbol);
      if (!logo) {
        logger.warn(`❌ No logo found for detected symbol: ${detectedSymbol}`);
        return null;
      }
      
      return {
        detected: detectedSymbol,
        logo: logo
      };
      
    } catch (error) {
      logger.error('❌ Failed to detect and get logo:', error.message);
      return null;
    }
  }

  /**
   * Get logo by cryptocurrency symbol
   */
  async getLogoBySymbol(symbol) {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        // Fallback to local SVG data if Supabase unavailable
        return this.getLocalFallbackLogo(symbol);
      }

      const { data, error } = await supabase
        .from('crypto_logos')
        .select('*')
        .eq('symbol', symbol.toUpperCase())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No logo found in database, try local fallback
          return this.getLocalFallbackLogo(symbol);
        }
        throw error;
      }

      logger.info(`🎯 Retrieved logo for ${symbol}`);
      return data;
    } catch (error) {
      logger.error(`❌ Failed to get logo for ${symbol}:`, error.message);
      // Try local fallback when database fails
      return this.getLocalFallbackLogo(symbol);
    }
  }

  /**
   * Get local fallback logo data when database is unavailable
   */
  getLocalFallbackLogo(symbol) {
    const fallbackLogos = {
      'XRP': {
        symbol: 'XRP',
        name: 'XRP',
        svg_data: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 424"><defs><style>.cls-1{fill:#23292f;}</style></defs><title>x</title><g id="Layer_2" data-name="Layer 2"><g id="Layer_1-2" data-name="Layer 1"><path class="cls-1" d="M437,0h74L357,152.48c-55.77,55.19-146.19,55.19-202,0L.94,0H75L192,115.83a91.11,91.11,0,0,0,127.91,0Z"/><path class="cls-1" d="M74.05,424H0L155,270.58c55.77-55.19,146.19-55.19,202,0L512,424H438L320,307.23a91.11,91.11,0,0,0-127.91,0Z"/></g></g></svg>',
        created_at: new Date().toISOString(),
        fallback: true
      }
    };
    
    const logo = fallbackLogos[symbol.toUpperCase()];
    if (logo) {
      logger.info(`📦 Using local fallback logo for ${symbol}`);
      return logo;
    }
    
    logger.warn(`❌ No logo found for ${symbol} in database or fallback`);
    return null;
  }

  /**
   * Get SVG logo info for Direct SVG service
   * Returns logo data with file path information
   */
  async getSvgLogoInfo(symbol) {
    try {
      const logoData = await this.getLogoBySymbol(symbol);
      if (!logoData) {
        logger.warn(`⚠️ No logo found for ${symbol}`);
        return null;
      }

      // Return formatted info for Direct SVG service
      return {
        symbol: logoData.symbol,
        name: logoData.name,
        svgContent: logoData.svg_data,
        svgPath: `database://${logoData.symbol}`, // Virtual path for database-stored SVG
        metadata: {
          hash: logoData.svg_hash,
          preprocessed: {
            canny: logoData.preprocessed_canny,
            depth: logoData.preprocessed_depth,
            normal: logoData.preprocessed_normal,
            mask: logoData.preprocessed_mask
          }
        }
      };
    } catch (error) {
      logger.error(`❌ Failed to get SVG logo info for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Add or update cryptocurrency logo
   */
  async upsertLogo(symbol, name, svgContent) {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      logger.info(`🎨 Processing logo for ${symbol}...`);

      // Preprocess SVG for ControlNet
      const processed = await this.preprocessor.processSVGForControlNet(svgContent, symbol);

      // Prepare data for insertion
      const logoData = {
        symbol: symbol.toUpperCase(),
        name: name,
        svg_data: svgContent,
        svg_hash: processed.svgHash,
        preprocessed_canny: processed.preprocessedCanny,
        preprocessed_depth: processed.preprocessedDepth,
        brand_colors: processed.brandColors,
        dimensions: processed.dimensions,
        metadata: processed.metadata,
        updated_at: new Date().toISOString()
      };

      // Upsert the logo
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

      logger.info(`✅ Logo successfully processed and stored for ${symbol}`);
      return data[0];
    } catch (error) {
      logger.error(`❌ Failed to upsert logo for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete logo by symbol
   */
  async deleteLogo(symbol) {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { error } = await supabase
        .from('crypto_logos')
        .delete()
        .eq('symbol', symbol.toUpperCase());

      if (error) {
        throw error;
      }

      logger.info(`🗑️ Logo deleted for ${symbol}`);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to delete logo for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Detect cryptocurrency from article content and get corresponding logo
   * NOW USES UNIFIED CRYPTO DETECTION SERVICE for consistent detection across the system
   */
  async detectAndGetLogoEnhanced(title, content = '') {
    try {
      // Use unified detection service for priority-based accurate detection
      const detectionResult = detectCryptocurrency(title, content);
      
      if (!detectionResult) {
        logger.info('🤷 No specific cryptocurrency or company detected in content');
        return null;
      }
      
      logger.info(`🎯 Detected ${detectionResult.crypto} (${detectionResult.displayName}) - Confidence: ${detectionResult.confidence}%`);
      
      // Get the logo for the detected crypto
      const logo = await this.getLogoBySymbol(detectionResult.crypto);
      
      if (!logo) {
        logger.warn(`⚠️ Logo not found for detected entity: ${detectionResult.crypto}`);
        return null;
      }
      
      return {
        detected: detectionResult.crypto,
        logo: logo,
        keyword: detectionResult.matchedPattern,
        name: detectionResult.displayName,
        confidence: detectionResult.confidence,
        priority: detectionResult.tier === 1 ? 1 : 2
      };
      
    } catch (error) {
      logger.error('❌ Failed to detect cryptocurrency and get logo:', error.message);
      return null;
    }
  }

  /**
   * Get ControlNet conditioning image for a cryptocurrency (Enhanced version)
   * Now supports enhanced conditioning formats from metadata
   */
  async getControlNetImage(symbol, type = 'canny') {
    try {
      const logo = await this.getLogoBySymbol(symbol);
      if (!logo) {
        throw new Error(`Logo not found for ${symbol}`);
      }

      // Enhanced field mapping with support for new formats
      const fieldMap = {
        'canny': 'preprocessed_canny',
        'depth': 'preprocessed_depth',
        'normal': null, // From enhanced conditioning metadata
        'mask': null,   // From enhanced conditioning metadata
        'pose': 'preprocessed_pose'
      };

      const field = fieldMap[type];
      let base64Data = null;

      if (field) {
        // Standard format from direct column
        base64Data = logo[field];
      } else if (type === 'normal' && logo.metadata?.enhanced_conditioning?.normal_map) {
        // Enhanced normal map from metadata
        base64Data = logo.metadata.enhanced_conditioning.normal_map;
      } else if (type === 'mask' && logo.metadata?.enhanced_conditioning?.mask) {
        // Enhanced mask from metadata
        base64Data = logo.metadata.enhanced_conditioning.mask;
      }

      if (!base64Data) {
        throw new Error(`No ${type} conditioning data available for ${symbol}`);
      }

      return this.preprocessor.getControlNetImage(base64Data, type);
    } catch (error) {
      logger.error(`❌ Failed to get ControlNet image for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Reprocess all logos (useful for updates)
   */
  async reprocessAllLogos() {
    try {
      const logos = await this.getAllLogos();
      const results = [];

      for (const logo of logos) {
        try {
          logger.info(`🔄 Reprocessing logo for ${logo.symbol}`);
          const updated = await this.upsertLogo(logo.symbol, logo.name, logo.svg_data);
          results.push({ symbol: logo.symbol, status: 'success', data: updated });
        } catch (error) {
          logger.error(`❌ Failed to reprocess ${logo.symbol}:`, error.message);
          results.push({ symbol: logo.symbol, status: 'error', error: error.message });
        }
      }

      logger.info(`✅ Reprocessing completed: ${results.length} logos processed`);
      return results;
    } catch (error) {
      logger.error('❌ Failed to reprocess all logos:', error.message);
      throw error;
    }
  }

  /**
   * Get logo statistics (Enhanced version)
   * Now includes enhanced conditioning format stats
   */
  async getLogoStats() {
    try {
      const logos = await this.getAllLogos();
      
      const stats = {
        totalLogos: logos.length,
        withCanny: logos.filter(logo => logo.preprocessed_canny).length,
        withDepth: logos.filter(logo => logo.preprocessed_depth).length,
        withPose: logos.filter(logo => logo.preprocessed_pose).length,
        // Enhanced conditioning stats
        withNormal: logos.filter(logo => logo.metadata?.enhanced_conditioning?.normal_map).length,
        withMask: logos.filter(logo => logo.metadata?.enhanced_conditioning?.mask).length,
        enhanced: logos.filter(logo => logo.metadata?.enhanced).length,
        byCategory: {}
      };

      // Count by category
      logos.forEach(logo => {
        const category = logo.metadata?.category || 'unknown';
        stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      });

      return stats;
    } catch (error) {
      logger.error('❌ Failed to get logo stats:', error.message);
      throw error;
    }
  }
}

module.exports = SVGLogoService;