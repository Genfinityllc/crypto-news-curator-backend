const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * 🚀 PHASE 1: Enhanced Crypto Logo Collection Service
 * Based on ULTRA_LORA_TRAINING_PLAN.md roadmap
 * Scrapes cryptologos.cc and creates style variations for LoRA training
 */
class EnhancedCryptoLogoCollector {
  constructor() {
    this.logoDir = path.join(__dirname, '../../training-data/logos');
    this.variationsDir = path.join(this.logoDir, 'variations');
    this.baseStylesDir = path.join(__dirname, '../../training-data/base-styles');
    
    // Target cryptos from roadmap + additional major ones
    this.targetCryptos = [
      'bitcoin', 'ethereum', 'solana', 'cardano', 'polygon', 'avalanche',
      'chainlink', 'polkadot', 'algorand', 'hedera', 'constellation', 'xdc',
      'matic', 'ada', 'dot', 'link', 'avax', 'sol', 'hbar', 'dag'
    ];
    
    // Style variations for LoRA training
    this.styleVariations = [
      'glowing', 'metallic', 'crystalline', 'translucent', 'neon',
      'holographic', 'glass', 'liquid', 'geometric', 'abstract'
    ];
    
    this.collectionStats = {
      attempted: 0,
      successful: 0,
      variations: 0,
      failed: []
    };
    
    logger.info('🎯 Enhanced Crypto Logo Collector initialized - Phase 1 ULTRA LoRA Training');
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.logoDir, { recursive: true });
      await fs.mkdir(this.variationsDir, { recursive: true });
      await fs.mkdir(this.baseStylesDir, { recursive: true });
      
      logger.info('📁 Training directories ready');
    } catch (error) {
      logger.error('❌ Failed to create directories:', error);
      throw error;
    }
  }

  /**
   * Scrape crypto logos from cryptologos.cc
   */
  async scrapeCryptoLogos() {
    try {
      await this.ensureDirectories();
      
      logger.info(`🚀 Starting Phase 1: Crypto logo collection for ${this.targetCryptos.length} cryptocurrencies`);
      
      for (const crypto of this.targetCryptos) {
        try {
          this.collectionStats.attempted++;
          await this.downloadLogoVariations(crypto);
          await this.generateStyleVariations(crypto);
          this.collectionStats.successful++;
          
          logger.info(`✅ Completed ${crypto}: logos + variations collected`);
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          logger.error(`❌ Failed to collect ${crypto}: ${error.message}`);
          this.collectionStats.failed.push({ crypto, error: error.message });
        }
      }
      
      // Generate collection report
      const report = await this.generateCollectionReport();
      
      logger.info(`🎯 Phase 1 Complete: ${this.collectionStats.successful}/${this.collectionStats.attempted} cryptos collected`);
      logger.info(`🎨 Total variations created: ${this.collectionStats.variations}`);
      
      return report;
      
    } catch (error) {
      logger.error('❌ Logo collection failed:', error);
      throw error;
    }
  }

  /**
   * Download logo variations for a crypto
   */
  async downloadLogoVariations(crypto) {
    const logoUrls = await this.getCryptoLogoUrls(crypto);
    
    for (let i = 0; i < logoUrls.length; i++) {
      try {
        const logoPath = path.join(this.logoDir, `${crypto}_${i}.png`);
        await this.downloadImage(logoUrls[i], logoPath);
        logger.info(`📥 Downloaded ${crypto} logo variant ${i + 1}`);
      } catch (error) {
        logger.warn(`⚠️ Failed to download ${crypto} logo ${i}: ${error.message}`);
      }
    }
  }

  /**
   * Get crypto logo URLs from cryptologos.cc
   */
  async getCryptoLogoUrls(crypto) {
    try {
      // Multiple potential URLs for each crypto
      const potentialUrls = [
        `https://cryptologos.cc/logos/${crypto}-${crypto.substring(0, 3)}-logo.png`,
        `https://cryptologos.cc/logos/${crypto}-logo.png`,
        `https://cryptologos.cc/logos/${crypto}.png`,
        `https://cryptologos.cc/logos/${crypto}-${crypto.toUpperCase()}-logo.png`
      ];
      
      const validUrls = [];
      
      for (const url of potentialUrls) {
        try {
          const response = await axios.head(url, { timeout: 10000 });
          if (response.status === 200) {
            validUrls.push(url);
          }
        } catch (error) {
          // URL not valid, continue
        }
      }
      
      if (validUrls.length === 0) {
        throw new Error(`No valid logo URLs found for ${crypto}`);
      }
      
      return validUrls;
      
    } catch (error) {
      throw new Error(`Failed to get logo URLs for ${crypto}: ${error.message}`);
    }
  }

  /**
   * Download image from URL
   */
  async downloadImage(url, filepath) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LoRA-Training-Bot/1.0)'
        }
      });
      
      await fs.writeFile(filepath, response.data);
      logger.debug(`💾 Downloaded: ${path.basename(filepath)}`);
      
    } catch (error) {
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  /**
   * Generate style variations for training (glowing, metallic, crystalline, etc.)
   */
  async generateStyleVariations(crypto) {
    try {
      // Check if we have logos for this crypto
      const logoFiles = await this.getLogoFiles(crypto);
      
      if (logoFiles.length === 0) {
        logger.warn(`⚠️ No logo files found for ${crypto}, skipping variations`);
        return;
      }
      
      // Create training prompts for each style variation
      for (const style of this.styleVariations) {
        const trainingPrompt = this.createTrainingPrompt(crypto, style);
        const metadataPath = path.join(this.variationsDir, `${crypto}_${style}_metadata.json`);
        
        const metadata = {
          crypto: crypto,
          style: style,
          prompt: trainingPrompt,
          base_logos: logoFiles,
          training_category: 'logo_style_variation',
          created_at: new Date().toISOString(),
          for_lora_training: true
        };
        
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        this.collectionStats.variations++;
        
        logger.debug(`🎨 Created ${style} variation for ${crypto}`);
      }
      
      logger.info(`✨ Generated ${this.styleVariations.length} style variations for ${crypto}`);
      
    } catch (error) {
      throw new Error(`Style variation generation failed for ${crypto}: ${error.message}`);
    }
  }

  /**
   * Get logo files for a crypto
   */
  async getLogoFiles(crypto) {
    try {
      const files = await fs.readdir(this.logoDir);
      return files.filter(file => file.startsWith(crypto) && file.endsWith('.png'));
    } catch (error) {
      return [];
    }
  }

  /**
   * Create training prompt for LoRA
   */
  createTrainingPrompt(crypto, style) {
    const baseStyle = 'professional cryptocurrency news cover background';
    const cryptoName = crypto.charAt(0).toUpperCase() + crypto.slice(1);
    
    const styleDescriptions = {
      glowing: `${baseStyle}, ${cryptoName} logo with glowing luminescent effects, soft light emission, energy aura`,
      metallic: `${baseStyle}, ${cryptoName} logo with metallic chrome finish, reflective surface, premium metal texture`,
      crystalline: `${baseStyle}, ${cryptoName} logo as crystalline structure, transparent crystal formation, prismatic effects`,
      translucent: `${baseStyle}, ${cryptoName} logo with translucent glass-like appearance, see-through elements, depth`,
      neon: `${baseStyle}, ${cryptoName} logo in neon lighting style, bright electric colors, cyberpunk aesthetic`,
      holographic: `${baseStyle}, ${cryptoName} logo with holographic projection effect, iridescent rainbow shimmer`,
      glass: `${baseStyle}, ${cryptoName} logo as polished glass element, smooth transparent surface, elegant reflection`,
      liquid: `${baseStyle}, ${cryptoName} logo as liquid mercury form, flowing metallic surface, dynamic shape`,
      geometric: `${baseStyle}, ${cryptoName} logo integrated into geometric patterns, abstract mathematical forms`,
      abstract: `${baseStyle}, ${cryptoName} logo as abstract artistic interpretation, creative stylized design`
    };
    
    return styleDescriptions[style] || `${baseStyle}, ${cryptoName} logo with ${style} styling effects`;
  }

  /**
   * Generate collection report
   */
  async generateCollectionReport() {
    try {
      const report = {
        phase: 'Phase 1: Enhanced Crypto Logo Collection',
        timestamp: new Date().toISOString(),
        statistics: this.collectionStats,
        target_cryptos: this.targetCryptos,
        style_variations: this.styleVariations,
        training_readiness: {
          logos_collected: this.collectionStats.successful,
          variations_created: this.collectionStats.variations,
          ready_for_phase_2: this.collectionStats.successful >= 10 && this.collectionStats.variations >= 50
        },
        next_steps: [
          'Phase 2: Train crypto-specific LoRA models',
          'Phase 3: Implement smart LoRA selection',
          'Phase 4: Deploy multi-LoRA HF Space'
        ]
      };
      
      const reportPath = path.join(this.logoDir, 'phase1_collection_report.json');
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      logger.info(`📋 Phase 1 report saved: ${reportPath}`);
      return report;
      
    } catch (error) {
      logger.error('❌ Failed to generate report:', error);
      throw error;
    }
  }

  /**
   * Get collection status
   */
  async getCollectionStatus() {
    try {
      const reportPath = path.join(this.logoDir, 'phase1_collection_report.json');
      const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
      return report;
    } catch (error) {
      return {
        phase: 'Phase 1: Enhanced Crypto Logo Collection',
        status: 'Not Started',
        message: 'Collection not yet initiated'
      };
    }
  }
}

module.exports = EnhancedCryptoLogoCollector;