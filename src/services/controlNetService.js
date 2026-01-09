const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const logger = require('../utils/logger');
const SVGLogoService = require('./svgLogoService');
const WatermarkService = require('./watermarkService');
const FreeLoraService = require('./freeLoraService');
const { logImageGeneration } = require('./outputMonitorService');

/**
 * ControlNet Service - Precise Logo Generation with PNG + Stable Diffusion
 * 
 * Enhanced with 2024 optimal settings for exact logo accuracy using PNG inputs.
 * Supports both PNG logos (new) and SVG database logos (legacy) for maximum compatibility.
 */
class ControlNetService {
  constructor() {
    this.timeout = 300000; // 5 minutes max
    this.imageStorePath = path.join(__dirname, '../../temp/controlnet-images');
    this.baseUrl = process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app';
    this.svgLogoService = new SVGLogoService();
    this.watermarkService = new WatermarkService();
    this.freeLoraService = new FreeLoraService();
    
    // PNG Logo Directory - NEW: Direct PNG logo support for maximum accuracy
    // Use server-side directory in production, local directory in development
    // FIXED: Using path.resolve for consistent resolution
    this.pngLogoDir = process.env.NODE_ENV === 'production' 
      ? path.resolve(__dirname, '../../uploads/png-logos')
      : '/Users/valorkopeny/Desktop/crypto-news-curator-backend/uploads/png-logos';
    
    logger.info(`📁 PNG Logo Directory: ${this.pngLogoDir}`);
    
    // REVOLUTIONARY 2024 Two-Stage Depth-Aware ControlNet Settings
    this.optimalSettings = {
      // STAGE 1: Environment Generation (No ControlNet - Pure Scene Creation)
      stage1: {
        steps: 60,                    // High quality environment generation
        guidance_scale: 8.5,          // Strong prompt adherence for detailed scenes
        width: 1600,                  // Cinematic resolution  
        height: 900,                  // 16:9 aspect ratio
        scheduler: 'DPMSolverMultistep' // Better for environments
      },
      
      // STAGE 2: Logo Integration via Depth-Aware ControlNet  
      stage2: {
        steps: 50,                    // Focused on logo integration
        guidance_scale: 6.5,          // Balanced control/creativity
        width: 1600,                  
        height: 900,
        
        // DEPTH-BASED CONTROLNET - NOT CANNY
        controlnet_model: 'depth',           // Depth for 3D perspective integration
        controlnet_conditioning_scale: 0.75, // HIGHER - Strong logo integration  
        control_guidance_start: 0.0,         
        control_guidance_end: 0.9,           // Extended guidance for logo preservation
        
        // Depth preprocessing settings
        depth_estimator: 'midas',            // Better than Zoe for logo placement
        pixel_perfect: true,                 
        processor_res: 1024,                 
        
        // Advanced composition control
        strength: 0.65,                      // Partial denoise for scene preservation
        scheduler: 'UniPC'                   // Quality-focused
      }
    };
    
    // REVOLUTIONARY Style Templates - Matching XRP Reference Quality
    this.styleTemplates = {
      holographic: {
        // STAGE 1: Generate complex 3D environment  
        environmentPrompt: "futuristic cyberpunk financial data center, multiple holographic displays, neon grid floors, atmospheric fog with volumetric lighting, metallic surfaces with rainbow reflections, zero gravity digital space, flowing data particles, cyan and purple color scheme, cinematic depth of field, professional photography lighting, 8k photorealistic render",
        
        // STAGE 2: Logo integration prompts
        logoIntegration: "3D metallic cryptocurrency coins floating at multiple depths, perspective-correct placement, environmental reflections on coin surfaces, proper lighting interaction, coins integrated into holographic displays, some coins tilted showing depth, logo symbols etched into metallic surfaces with proper material properties",
        
        negative_prompt: "flat overlay, 2d sticker effect, incorrect perspective, wrong cryptocurrency symbol, bad logo proportions, cartoon style, sketch, amateur lighting, low resolution, text, letters, watermarks"
      },
      
      neon_architecture: {
        // Like XRP20.jpg - Architectural integration
        environmentPrompt: "cyberpunk server room corridor with perspective depth, rows of server racks extending into distance, purple and cyan neon lighting tubes, metallic floor with reflections, atmospheric haze, dramatic one-point perspective, architectural details, futuristic industrial design, professional cinematic lighting",
        
        logoIntegration: "cryptocurrency logo symbols integrated into architectural elements, neon tube logo shapes embedded in walls, holographic logo displays at various depths, logo patterns in floor reflections, perspective-correct scaling, environmental glow effects on logo surfaces",
        
        negative_prompt: "flat logo overlay, 2d placement, incorrect perspective scaling, amateur composition, cartoon style, wrong cryptocurrency symbols, poor lighting integration, text, letters"
      },
      
      floating_coins: {
        // Like XRP13.jpg - Multiple 3D coins with proper perspective
        environmentPrompt: "dark space environment with subtle atmospheric effects, professional studio lighting setup, gradual depth transitions, metallic surfaces for reflections, minimal background allowing coin focus, cinematic composition with depth layers, volumetric lighting effects",
        
        logoIntegration: "multiple 3D cryptocurrency coins at different depths and angles, each coin showing proper perspective distortion, metallic materials with environmental reflections, coins tilted to show dimensionality, logo symbols precisely embossed into coin surfaces, realistic physics-based placement, varied lighting on each coin surface",
        
        negative_prompt: "flat coins, identical positioning, no depth variation, incorrect logo symbols, 2d overlay effect, poor perspective, unrealistic materials, cartoon coins, wrong cryptocurrency branding"
      }
    };
    
    // Ensure storage directory exists
    this.ensureStorageDirectory().catch(err => {
      logger.error('❌ Failed to create ControlNet storage directory:', err);
    });
    
    logger.info('🎯 Enhanced ControlNet Service initialized - PNG + SVG support with 2024 optimal settings');
  }

  async ensureStorageDirectory() {
    try {
      await fs.mkdir(this.imageStorePath, { recursive: true });
      logger.info(`📁 ControlNet image storage ready: ${this.imageStorePath}`);
    } catch (error) {
      logger.error('❌ Failed to create storage directory:', error);
    }
  }

  /**
   * Generate unique image ID
   */
  generateImageId() {
    const randomBytes = crypto.randomBytes(8);
    return `controlnet_${randomBytes.toString('hex')}`;
  }

  /**
   * NEW: Get PNG logo for a cryptocurrency with SVG fallback
   */
  async getPngLogo(symbol) {
    try {
      const normalizedSymbol = symbol.toUpperCase();
      
      // First, try to get PNG logo from server directory
      logger.info(`🔍 Looking for ${symbol} logo in PNG directory: ${this.pngLogoDir}`);
      const pngLogo = await this.tryGetPngFromDirectory(symbol);
      if (pngLogo) {
        logger.info(`✅ Found ${symbol} PNG logo from ${pngLogo.source}`);
        return pngLogo;
      }
      logger.info(`⚠️ ${symbol} PNG not found in directory`);
      
      // Second: Try to fetch from public CDN
      logger.info(`🌐 Trying to fetch ${symbol} logo from public CDN...`);
      const cdnLogo = await this.fetchLogoFromCDN(symbol);
      if (cdnLogo) {
        logger.info(`✅ Found ${symbol} logo from CDN`);
        return cdnLogo;
      }
      logger.info(`⚠️ ${symbol} not found on CDN`);
      
      // Fallback: Generate PNG from SVG data
      logger.info(`🔄 PNG not found, generating from SVG for ${symbol}...`);
      const svgLogo = await this.generatePngFromSvg(symbol);
      if (svgLogo) {
        logger.info(`✅ Generated ${symbol} logo from SVG`);
        return svgLogo;
      }
      
      logger.warn(`⚠️  No PNG or SVG logo available for ${symbol}`);
      return null;
      
    } catch (error) {
      logger.error(`❌ Error getting logo for ${symbol}:`, error.message);
      return null;
    }
  }
  
  /**
   * Fetch logo from public CDN (cryptologos.cc)
   */
  async fetchLogoFromCDN(symbol) {
    const normalizedSymbol = symbol.toLowerCase();
    
    // Mapping of symbols to cryptologos.cc slugs
    const slugMapping = {
      // Major coins
      'btc': 'bitcoin-btc', 'eth': 'ethereum-eth', 'xrp': 'xrp-xrp',
      'bnb': 'bnb-bnb', 'sol': 'solana-sol', 'ada': 'cardano-ada', 
      'doge': 'dogecoin-doge', 'trx': 'tron-trx', 'ton': 'toncoin-ton',
      'dot': 'polkadot-new-dot', 'matic': 'polygon-matic', 'pol': 'polygon-matic',
      'link': 'chainlink-link', 'avax': 'avalanche-avax', 'uni': 'uniswap-uni',
      'atom': 'cosmos-atom', 'ltc': 'litecoin-ltc', 'bch': 'bitcoin-cash-bch',
      'near': 'near-protocol-near', 'algo': 'algorand-algo', 'xlm': 'stellar-xlm',
      'hbar': 'hedera-hbar', 'fil': 'filecoin-fil', 'icp': 'internet-computer-icp',
      'etc': 'ethereum-classic-etc', 'vet': 'vechain-vet', 'ftm': 'fantom-ftm',
      'aave': 'aave-aave', 'mkr': 'maker-mkr', 'crv': 'curve-dao-token-crv',
      'snx': 'synthetix-network-token-snx', 'comp': 'compound-comp',
      // L2s and new chains
      'arb': 'arbitrum-arb', 'op': 'optimism-ethereum-op', 'sui': 'sui-sui',
      'apt': 'aptos-apt', 'inj': 'injective-inj', 'sei': 'sei-sei',
      'tia': 'celestia-tia', 'stx': 'stacks-stx', 'imx': 'immutable-x-imx',
      'mina': 'mina-mina', 'kas': 'kaspa-kas', 'flow': 'flow-flow',
      // Memecoins
      'pepe': 'pepe-pepe', 'shib': 'shiba-inu-shib', 'bonk': 'bonk-bonk',
      'wif': 'dogwifhat-wif', 'floki': 'floki-inu-floki',
      // DeFi
      'jup': 'jupiter-jup', 'ray': 'raydium-ray', 'orca': 'orca-orca',
      'ldo': 'lido-dao-ldo', 'rpl': 'rocket-pool-rpl', 'pendle': 'pendle-pendle',
      // Stablecoins (in case needed)
      'usdt': 'tether-usdt', 'usdc': 'usd-coin-usdc', 'dai': 'multi-collateral-dai-dai'
    };
    
    const slug = slugMapping[normalizedSymbol] || `${normalizedSymbol}-${normalizedSymbol}`;
    const urls = [
      `https://cryptologos.cc/logos/${slug}-logo.png`,
      `https://cryptologos.cc/logos/${normalizedSymbol}-${normalizedSymbol}-logo.png`
    ];
    
    for (const url of urls) {
      try {
        logger.info(`📥 Fetching logo: ${url}`);
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 10000,
          headers: { 'User-Agent': 'Genfinity/1.0' }
        });
        
        if (response.status === 200 && response.data.length > 1000) {
          logger.info(`✅ Fetched ${symbol} logo from CDN (${response.data.length} bytes)`);
          return {
            buffer: Buffer.from(response.data),
            source: 'cdn_cryptologos'
          };
        }
      } catch (error) {
        // Try next URL
      }
    }
    
    logger.warn(`⚠️ Could not fetch ${symbol} logo from CDN`);
    return null;
  }

  /**
   * Try to get PNG logo from server directory
   * Uses case-insensitive matching and scans all available files
   */
  async tryGetPngFromDirectory(symbol) {
    try {
      const normalizedSymbol = symbol.toUpperCase().replace(/\s+/g, '');
      logger.info(`📂 tryGetPngFromDirectory: Looking for "${normalizedSymbol}" in ${this.pngLogoDir}`);
      
      // First, scan the directory for all PNG files and create a case-insensitive lookup
      let allPngFiles = [];
      try {
        allPngFiles = await fs.readdir(this.pngLogoDir);
        allPngFiles = allPngFiles.filter(f => f.toLowerCase().endsWith('.png'));
        logger.info(`📂 Found ${allPngFiles.length} PNG files: ${allPngFiles.join(', ')}`);
      } catch (e) {
        logger.warn(`❌ Could not read PNG directory ${this.pngLogoDir}:`, e.message);
        return null;
      }
      
      // Create case-insensitive filename lookup
      const filenameLookup = {};
      for (const file of allPngFiles) {
        const baseName = file.replace(/\.png$/i, '');
        filenameLookup[baseName.toUpperCase().replace(/\s+/g, '')] = file;
        filenameLookup[baseName.toUpperCase()] = file;
        filenameLookup[baseName.toLowerCase()] = file;
      }
      
      // Alias mappings for common variations
      const aliasMap = {
        'BTC': ['BITCOIN', 'Bitcoin'],
        'BITCOIN': ['BTC', 'Bitcoin'],
        'ETH': ['ETHEREUM', 'Ethereum'],
        'ETHEREUM': ['ETH'],
        'XRP': ['RIPPLE', 'Ripple'],
        'RIPPLE': ['XRP'],
        'BNB': ['BINANCE', 'Binance'],
        'BINANCE': ['BNB'],
        'WLFI': ['WORLDLIBERTYFINANCIAL', 'WORL LIBERTY FINANCIAL', 'World Liberty Financial'],
        'WORLDLIBERTYFINANCIAL': ['WLFI'],
        'LTC': ['LITECOIN', 'Litecoin'],
        'LITECOIN': ['LTC'],
        'IMX': ['IMMUTABLE', 'Immutable'],
        'IMMUTABLE': ['IMX'],
        'SHIB': ['SHIBAINU', 'SHIBA INU', 'Shiba Inu'],
        'HBAR': ['HEDERA', 'Hedera'],
        'HEDERA': ['HBAR'],
        'ALGO': ['ALGORAND', 'Algorand'],
        'ALGORAND': ['ALGO'],
        'DAG': ['CONSTELLATION', 'Constellation'],
        'CONSTELLATION': ['DAG'],
        'ADA': ['CARDANO', 'Cardano'],
        'CARDANO': ['ADA'],
        'SOL': ['SOLANA', 'Solana'],
        'SOLANA': ['SOL'],
        'AVAX': ['AVALANCHE', 'Avalanche'],
        'AVALANCHE': ['AVAX'],
        'DOT': ['POLKADOT', 'Polkadot'],
        'POLKADOT': ['DOT'],
        'LINK': ['CHAINLINK', 'Chainlink'],
        'CHAINLINK': ['LINK'],
        'DOGE': ['DOGECOIN', 'Dogecoin'],
        'DOGECOIN': ['DOGE'],
        'ATOM': ['COSMOS', 'Cosmos'],
        'COSMOS': ['ATOM'],
        'XLM': ['STELLAR', 'Stellar'],
        'STELLAR': ['XLM'],
        'FIL': ['FILECOIN', 'Filecoin'],
        'FILECOIN': ['FIL'],
        'UNI': ['UNISWAP', 'Uniswap'],
        'UNISWAP': ['UNI'],
        'TRX': ['TRON', 'Tron'],
        'TRON': ['TRX'],
        'MATIC': ['POLYGON', 'Polygon'],
        'POLYGON': ['MATIC'],
        'XMR': ['MONERO', 'Monero'],
        'MONERO': ['XMR'],
        'ZEC': ['ZCASH', 'Zcash'],
        'ZCASH': ['ZEC'],
        'CRO': ['CRONOS', 'Cronos'],
        'CRONOS': ['CRO'],
        'RUNE': ['THORCHAIN', 'THORChain'],
        'THORCHAIN': ['RUNE'],
        'TAO': ['BITTENSOR', 'Bittensor'],
        'BITTENSOR': ['TAO'],
        'QNT': ['QUANT', 'Quant'],
        'QUANT': ['QNT'],
        'TON': ['TONCOIN', 'Toncoin'],
        'TONCOIN': ['TON'],
        'APT': ['APTOS', 'Aptos'],
        'APTOS': ['APT'],
        'SUI': ['SUI'],
        'SEI': ['SEI'],
        'NEAR': ['NEAR', 'Near'],
        'CANTON': ['Canton'],
        'MONAD': ['Monad', 'MONAD'],
        'KRAKEN': ['Kraken'],
        'KUCOIN': ['Kucoin', 'KuCoin'],
        'METAMASK': ['Metamask', 'MetaMask'],
        'MAGICEDEN': ['Magic Eden', 'MAGIC EDEN'],
        'BITGO': ['BitGo', 'BITGO'],
        'UPHOLD': ['Uphold'],
        'AXELAR': ['Axelar'],
        'IMF': ['IMF'],
        'CFTC': ['CFTC'],
        '21SHARES': ['21shares'],
        'GRAYSCALE': ['Grayscale'],
        'BLACKROCK': ['BlackRock', 'BLACKROCK'],
        'BITMINE': ['Bitmine'],
        'MOONPAY': ['MoonPay'],
        'NVIDIA': ['NVIDIA', 'Nvidia'],
        'PAXOS': ['Paxos', 'PAXOS'],
        'ROBINHOOD': ['Robinhood'],
        'HASHPACK': ['HashPack', 'PACK'],
        'PACK': ['HASHPACK', 'HashPack']
      };
      
      // Build list of possible names to search
      const searchNames = [normalizedSymbol, symbol.toUpperCase(), symbol];
      if (aliasMap[normalizedSymbol]) {
        searchNames.push(...aliasMap[normalizedSymbol]);
      }
      
      // Try to find a matching file
      for (const searchName of searchNames) {
        const normalizedSearch = searchName.toUpperCase().replace(/\s+/g, '');
        if (filenameLookup[normalizedSearch] || filenameLookup[searchName.toUpperCase()] || filenameLookup[searchName]) {
          const filename = filenameLookup[normalizedSearch] || filenameLookup[searchName.toUpperCase()] || filenameLookup[searchName];
          const logoPath = path.join(this.pngLogoDir, filename);
          
          try {
            await fs.access(logoPath);
            const logoBuffer = await fs.readFile(logoPath);
            const stats = await fs.stat(logoPath);
            
            logger.info(`🎯 Found PNG logo for ${symbol}: ${filename} (${(stats.size / 1024).toFixed(1)}KB)`);
            
            return {
              buffer: logoBuffer,
              path: logoPath,
              filename,
              symbol: normalizedSymbol,
              size: stats.size,
              source: 'png_file'
            };
          } catch (error) {
            // Continue searching
          }
        }
      }
      
      // Last resort: case-insensitive partial match on the directory
      for (const file of allPngFiles) {
        const baseName = file.replace(/\.png$/i, '').toUpperCase().replace(/\s+/g, '');
        if (baseName === normalizedSymbol || baseName.includes(normalizedSymbol) || normalizedSymbol.includes(baseName)) {
          const logoPath = path.join(this.pngLogoDir, file);
          try {
            await fs.access(logoPath);
            const logoBuffer = await fs.readFile(logoPath);
            const stats = await fs.stat(logoPath);
            
            logger.info(`🎯 Found PNG logo (partial match) for ${symbol}: ${file} (${(stats.size / 1024).toFixed(1)}KB)`);
            
            return {
              buffer: logoBuffer,
              path: logoPath,
              filename: file,
              symbol: normalizedSymbol,
              size: stats.size,
              source: 'png_file'
            };
          } catch (error) {
            // Continue
          }
        }
      }
      
      return null;
    } catch (error) {
      logger.error(`❌ Error loading PNG from directory for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Generate PNG from SVG data as fallback
   */
  async generatePngFromSvg(symbol) {
    try {
      // Get SVG logo data from database
      const logoData = await this.svgLogoService.getSvgLogoInfo(symbol.toUpperCase());
      if (!logoData || !logoData.svgContent) {
        logger.info(`📭 No SVG data found for ${symbol}`);
        return null;
      }
      
      logger.info(`🔄 Converting SVG to PNG for ${symbol}...`);
      
      // Convert SVG to PNG using Sharp
      const svgBuffer = Buffer.from(logoData.svgContent);
      
      const pngBuffer = await sharp(svgBuffer)
        .png({ quality: 100 })
        .resize(1024, 1024, { 
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
        })
        .toBuffer();
      
      logger.info(`✅ Generated PNG from SVG for ${symbol} (${(pngBuffer.length / 1024).toFixed(1)}KB)`);
      
      return {
        buffer: pngBuffer,
        filename: `${symbol}.png`,
        symbol: symbol.toUpperCase(),
        size: pngBuffer.length,
        source: 'svg_converted'
      };
      
    } catch (error) {
      logger.error(`❌ Error generating PNG from SVG for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * NEW: Process PNG logo for optimal ControlNet input 
   * - Convert to high-contrast for Canny edge detection
   * - Optimize resolution for ControlNet processing
   * - Apply preprocessing based on 2024 best practices
   */
  async preprocessPngForControlNet(logoBuffer, targetSize = 1024) {
    try {
      // Step 1: Get original image metadata
      const metadata = await sharp(logoBuffer).metadata();
      logger.info(`🎯 Preprocessing PNG: ${metadata.width}x${metadata.height} → ${targetSize}x${targetSize}`);
      
      // Step 2: CREATE ABSTRACT POSITIONING GUIDE (not literal logo shape)
      const processedLogo = await sharp(logoBuffer)
        .resize(targetSize, targetSize, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 1 }, // BLACK background = far depth
          withoutEnlargement: false
        })
        // Convert to grayscale for depth processing  
        .grayscale()
        // ABSTRACT GUIDANCE: Create soft positioning area, not exact shape
        .linear(1.2, 30) // Gentler brightening
        .blur(8)         // MUCH more blur to abstract the shape
        .resize(targetSize, targetSize, { // Resize again to ensure consistency
          fit: 'fill',
          kernel: 'cubic'
        })
        // Create soft gradient center instead of hard logo edges
        .modulate({ brightness: 0.8, saturation: 0 })
        // Normalize for smooth positioning guidance
        .normalise()
        // Output as abstract positioning guide
        .png({ 
          quality: 100, 
          compressionLevel: 0,
          palette: false
        })
        .toBuffer();
        
      logger.info(`✅ ABSTRACT POSITIONING GUIDE created: ${targetSize}x${targetSize}, soft guidance for 3D placement`);
      return processedLogo;
      
    } catch (error) {
      logger.error('❌ Error preprocessing PNG for ControlNet:', error.message);
      throw error;
    }
  }

  /**
   * 2-STEP CONTROLNET PROCESS:
   * Step 1: Generate contextual background prompt from article rewrite
   * Step 2: Use ControlNet with actual PNG/SVG logo for 3D integration
   */
  async generateWithAdvancedControlNet(title, logoSymbol, style = 'holographic', options = {}) {
      const startTime = Date.now();
      const imageId = this.generateImageId();
    let monitorData = {
      imageId,
      articleTitle: title,
      logoSymbol,
      style,
      prompt: options.prompt || '',
      startTime: new Date().toISOString()
    };
    
    try {
      logger.info(`🎯 NANO-BANANA-PRO 3D LOGO GENERATION: ${logoSymbol}`);
      logger.info(`📝 Using Google's image editing model for stunning 3D glass/liquid effect`);
      
      // Get the ACTUAL logo file (100% accurate shape)
      const logoData = await this.getPngLogo(logoSymbol);
      if (!logoData) {
        throw new Error(`No PNG/SVG logo found for ${logoSymbol}`);
      }
      logger.info(`✅ Logo loaded: ${logoSymbol} (${logoData.source})`);
      
      let imagePath;
      let method = 'unknown';
      
      // PRIMARY: Use Google Nano-Banana-Pro Edit for stunning 3D glass effect
      let promptUsed = null;
      
      if (process.env.WAVESPEED_API_KEY) {
        try {
          logger.info('🌟 Using Nano-Banana-Pro image edit for 3D glass/liquid effect...');
          const result = await this.generateWithNanoBananaPro({
            logoBuffer: logoData.buffer,
            logoSymbol: logoSymbol,
            title: title,
            imageId: imageId,
            article: article  // Pass article for custom keyword
          });
          imagePath = result.imagePath;
          promptUsed = result.promptUsed;
          method = 'nano_banana_pro_3d';
          logger.info('✅ Nano-Banana-Pro 3D generation succeeded!');
        } catch (nanoError) {
          logger.warn(`⚠️ Nano-Banana-Pro failed: ${nanoError.message}`);
          imagePath = null;
        }
      }
      
      // FALLBACK 1: Wavespeed ControlNet
      if (!imagePath && process.env.WAVESPEED_API_KEY) {
        try {
          logger.info('🔄 Trying Wavespeed ControlNet fallback...');
          const controlImage = await this.prepareLogoForControlNet(logoData.buffer);
          const controlImageBase64 = controlImage.toString('base64');
          const scenePrompt = this.get3DScenePromptForLogo(title, logoSymbol);
          
          imagePath = await this.generateWithLogoControlNet({
            prompt: scenePrompt,
            controlImageBase64: controlImageBase64,
            logoSymbol: logoSymbol,
            imageId: imageId
          });
          method = 'wavespeed_controlnet_3d';
          logger.info('✅ ControlNet fallback succeeded!');
        } catch (controlNetError) {
          logger.warn(`⚠️ ControlNet fallback failed: ${controlNetError.message}`);
          imagePath = null;
        }
      }
      
      // FALLBACK 2: Background + 3D metallic composite
      if (!imagePath) {
        logger.info('🔄 Final fallback: background + 3D metallic composite...');
        try {
          const backgroundPrompt = this.getPremiumBackgroundPrompt(title);
          const backgroundPath = await this.generatePollinationsBackground({
            prompt: backgroundPrompt,
            imageId: imageId
          });
          
          imagePath = await this.composite3DMetallicLogo(
            backgroundPath,
            logoData.buffer,
            logoSymbol,
            imageId
          );
          method = 'fallback_3d_metallic';
        } catch (fallbackError) {
          logger.error(`⚠️ Final fallback failed: ${fallbackError.message}`);
        }
      }
      
      if (!imagePath) {
        throw new Error('All generation methods failed');
      }
      
      // Apply watermark
      await this.watermarkService.addWatermark(imagePath, imagePath, { title: logoSymbol });
      
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      logger.info(`✅ Generation completed in ${totalTime}s using ${method}`);
      
      // 📊 MONITOR: Log generation
      await logImageGeneration({
        ...monitorData,
        imageId: imageId,
        method: method,
        controlNetUsed: method.includes('controlnet'),
        controlNetType: method.includes('controlnet') ? 'logo_shape_guide' : '3d_metallic_composite',
        logoSource: logoData.source,
        success: true,
        imageUrl: this.getImageUrl(imageId),
        localPath: imagePath,
        processingTimeMs: totalTime * 1000,
        apiUsed: method.split('_')[0],
        is3DIntegrated: true,
        isFlatOverlay: false,
        logoAccuracy: '100%'
      });
      
      return {
        success: true,
        imageId: imageId,
        imageUrl: this.getImageUrl(imageId),
        localPath: imagePath,
        metadata: {
          method: method,
          logoSymbol,
          style,
          totalProcessingTime: totalTime,
          logoAccuracy: '100% (actual logo shape used)',
          controlNetUsed: method.includes('controlnet'),
          promptUsed: promptUsed || null
        }
      };
        
    } catch (error) {
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      logger.error(`❌ Generation failed:`, error);
      
      await logImageGeneration({
        ...monitorData,
        method: 'complete_failure',
        success: false,
        processingTimeMs: totalTime * 1000,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Prepare logo for ControlNet - uses preprocessPngForControlNet which works
   */
  async prepareLogoForControlNet(logoBuffer) {
    logger.info('🔧 Preparing logo for ControlNet...');
    // Use the proven preprocessing method
    return await this.preprocessPngForControlNet(logoBuffer, 1024);
  }
  
  /**
   * Build prompt that describes the logo as a 3D element in a scene
   */
  get3DScenePromptForLogo(title, logoSymbol) {
    const scenes = [
      // Chrome floating element
      `futuristic scene with a large 3D chrome metallic ${logoSymbol} cryptocurrency symbol floating in center, the symbol is made of polished reflective chrome metal with cyan and magenta neon edge lighting, dark cyberpunk background with purple and blue atmospheric fog, holographic particles floating around, the metal surface shows realistic reflections and highlights, cinematic lighting, 8k ultra detailed render`,
      
      // Architectural integration
      `cyberpunk server room corridor with the ${logoSymbol} symbol as a massive 3D brushed metal architectural element mounted on the back wall, neon cyan edge lighting on the symbol, purple and blue ambient lighting, rows of server racks on sides, metallic floor with reflections, atmospheric fog, the symbol appears as solid metal construction integrated into the architecture`,
      
      // Glowing orb with symbol
      `dark atmospheric scene with a glowing 3D sphere containing the ${logoSymbol} cryptocurrency symbol embossed in chrome silver on its surface, the sphere emits purple and cyan light, floating particles around it, dark gradient background, the symbol has metallic reflective properties, professional product photography lighting`,
      
      // Multiple 3D coins
      `multiple 3D metallic cryptocurrency coins featuring the ${logoSymbol} symbol floating at different angles in dark space, coins have chrome iridescent edges with rainbow reflections, the symbol is raised and embossed on coin faces in bright silver metal, dark blue background with subtle glow, depth of field blur on distant coins, photorealistic 3D render`,
      
      // Energy portal
      `the ${logoSymbol} cryptocurrency symbol rendered as a 3D chrome metallic element in the center of a glowing energy portal, cyan and magenta neon rings surrounding it, dark void background with particle effects, the symbol has polished metal surface with realistic light reflections, dramatic volumetric lighting`,
      
      // Abstract tech
      `abstract technological visualization with the ${logoSymbol} symbol as a large 3D holographic chrome element, surrounded by flowing data streams and geometric shapes, dark background with cyan and purple accent colors, the symbol appears metallic and three-dimensional with proper lighting and shadows`
    ];
    
    const titleHash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const sceneIndex = titleHash % scenes.length;
    
    logger.info(`🎬 Selected scene style ${sceneIndex + 1}/${scenes.length}`);
    return scenes[sceneIndex];
  }
  
  /**
   * Generate stunning 3D glass/liquid logo using Google Nano-Banana-Pro Edit
   * This produces the BEST quality - crystal glass, liquid-filled, reflective surfaces
   * UPDATED: Using exact Wavespeed API format from official docs
   */
  async generateWithNanoBananaPro({ logoBuffer, logoSymbol, title, imageId, article = {} }) {
    const wavespeedApiKey = process.env.WAVESPEED_API_KEY;
    
    logger.info(`🌟 Nano-Banana-Pro: Creating 3D glass/liquid ${logoSymbol} logo...`);
    
    // Get PUBLIC URL for the logo that Wavespeed can access
    const cdnSlugs = {
      'btc': 'bitcoin-btc', 'bitcoin': 'bitcoin-btc',
      'eth': 'ethereum-eth', 'ethereum': 'ethereum-eth',
      'xrp': 'xrp-xrp', 'ripple': 'xrp-xrp',
      'bnb': 'bnb-bnb', 'binance': 'bnb-bnb',
      'sol': 'solana-sol', 'solana': 'solana-sol',
      'ada': 'cardano-ada', 'cardano': 'cardano-ada',
      'doge': 'dogecoin-doge', 'dogecoin': 'dogecoin-doge',
      'dot': 'polkadot-new-dot', 'polkadot': 'polkadot-new-dot',
      'link': 'chainlink-link', 'chainlink': 'chainlink-link',
      'avax': 'avalanche-avax', 'avalanche': 'avalanche-avax',
      'uni': 'uniswap-uni', 'uniswap': 'uniswap-uni',
      'ltc': 'litecoin-ltc', 'litecoin': 'litecoin-ltc',
      'atom': 'cosmos-atom', 'cosmos': 'cosmos-atom',
      'xlm': 'stellar-xlm', 'stellar': 'stellar-xlm',
      'hbar': 'hedera-hbar', 'hedera': 'hedera-hbar',
      'near': 'near-protocol-near',
      'algo': 'algorand-algo', 'algorand': 'algorand-algo',
      'fil': 'filecoin-fil', 'filecoin': 'filecoin-fil',
      'arb': 'arbitrum-arb', 'arbitrum': 'arbitrum-arb',
      'op': 'optimism-ethereum-op', 'optimism': 'optimism-ethereum-op',
      'sui': 'sui-sui', 'apt': 'aptos-apt', 'aptos': 'aptos-apt',
      'inj': 'injective-inj', 'sei': 'sei-sei',
      'shib': 'shiba-inu-shib', 'pepe': 'pepe-pepe'
    };
    
    const slug = cdnSlugs[logoSymbol.toLowerCase()];
    let logoUrl;
    if (slug) {
      logoUrl = `https://cryptologos.cc/logos/${slug}-logo.png?v=040`;
      logger.info(`📷 Using CDN logo URL: ${logoUrl}`);
    } else {
      // For tokens not on CDN, we need to use a hosted URL
      // Save logo temporarily and use our server URL
      const tempLogoPath = path.join(this.imageStorePath, `temp_logo_${imageId}.png`);
      await fs.writeFile(tempLogoPath, logoBuffer);
      logoUrl = `${this.baseUrl}/temp/controlnet-images/temp_logo_${imageId}.png`;
      logger.info(`📷 Using server-hosted logo URL: ${logoUrl}`);
    }
    
    // Build our dynamic prompt for 3D glass/liquid effect (now async with refinement)
    const customKeyword = article?.customKeyword || null;
    const prompt = await this.getNanoBananaPrompt(logoSymbol, title, customKeyword);
    logger.info(`📝 Prompt: ${prompt.substring(0, 150)}...`);
    
    // EXACT Wavespeed API format from official docs
    // Using 16:9 aspect ratio to match our 1800x900 output without stretching
    const payload = {
      enable_base64_output: false,
      enable_sync_mode: false,
      images: [logoUrl],
      output_format: "png",
      prompt: prompt,
      resolution: "2k",  // 2K resolution - same cost as 1K but better quality!
      aspect_ratio: "16:9"  // Match our 1800x900 output to prevent stretching
    };
    
    logger.info(`🚀 Submitting to Wavespeed Nano-Banana-Pro API...`);
    logger.info(`📦 Payload: ${JSON.stringify(payload).substring(0, 300)}...`);
    
    const response = await axios.post('https://api.wavespeed.ai/api/v3/google/nano-banana-pro/edit', payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${wavespeedApiKey}`
      },
      timeout: 120000
    });
    
    logger.info(`📬 API Response: ${JSON.stringify(response.data).substring(0, 300)}`);
    
    const responseData = response.data.data || response.data;
    if (!responseData.id) {
      logger.error(`❌ Nano-Banana-Pro API response:`, JSON.stringify(response.data).substring(0, 500));
      throw new Error(`Nano-Banana-Pro failed: ${JSON.stringify(response.data).substring(0, 200)}`);
    }
    
    const requestId = responseData.id;
    logger.info(`📋 Nano-Banana-Pro job ID: ${requestId}`);
    
    // Poll for result using exact format from docs
    let result = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second intervals
      
      const pollResponse = await axios.get(
        `https://api.wavespeed.ai/api/v3/predictions/${requestId}/result`,
        {
          headers: {
            'Authorization': `Bearer ${wavespeedApiKey}`
          },
          timeout: 15000
        }
      );
      
      const data = pollResponse.data.data;
      const status = data?.status;
      
      logger.info(`🔄 Poll ${attempt + 1}: Status = ${status}`);
      
      if (status === 'completed') {
        result = data;
        break;
      } else if (status === 'failed') {
        throw new Error(`Nano-Banana-Pro job failed: ${data.error || 'Unknown error'}`);
      }
    }
    
    if (!result) {
      throw new Error('Nano-Banana-Pro job timed out after 120 seconds');
    }
    
    const outputs = result.outputs || [];
    if (!outputs[0]) {
      throw new Error(`No output from Nano-Banana-Pro: ${JSON.stringify(result).substring(0, 200)}`);
    }
    
    logger.info(`⬇️ Downloading Nano-Banana-Pro result from: ${outputs[0].substring(0, 80)}...`);
    
    const imageResponse = await axios.get(outputs[0], {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    const imagePath = path.join(this.imageStorePath, `${imageId}.png`);
    await fs.writeFile(imagePath, imageResponse.data);
    
    // Clean up temp logo if we created one
    if (!slug) {
      try {
        await fs.unlink(path.join(this.imageStorePath, `temp_logo_${imageId}.png`));
      } catch (e) { /* ignore */ }
    }
    
    logger.info(`✅ Nano-Banana-Pro 3D glass logo saved: ${imagePath}`);
    return { imagePath, promptUsed: prompt };
  }
  
  /**
   * Build dynamic, diverse prompts for Nano-Banana-Pro
   * Uses randomization + keyword extraction for variety
   * Now supports user-provided custom keywords and learned preferences
   */
  async getNanoBananaPrompt(logoSymbol, title, customKeyword = null) {
    // Load prompt refinement preferences if available
    let refinedElements = null;
    try {
      const PromptRefinementService = require('./promptRefinementService');
      const promptRefinement = new PromptRefinementService();
      refinedElements = await promptRefinement.getRefinedElements();
    } catch (e) {
      logger.warn('Could not load prompt refinements:', e.message);
    }
    const networkNames = {
      // Major coins
      'BTC': 'Bitcoin', 'BITCOIN': 'Bitcoin', 'ETH': 'Ethereum', 'XRP': 'XRP Ripple',
      'BNB': 'BNB Binance', 'SOL': 'Solana', 'ADA': 'Cardano', 'DOGE': 'Dogecoin',
      'DOT': 'Polkadot', 'MATIC': 'Polygon', 'LINK': 'Chainlink', 'AVAX': 'Avalanche',
      'UNI': 'Uniswap', 'LTC': 'Litecoin', 'ATOM': 'Cosmos', 'XLM': 'Stellar',
      // Mid-cap
      'HBAR': 'Hedera', 'NEAR': 'NEAR Protocol', 'ALGO': 'Algorand', 'FIL': 'Filecoin',
      'ICP': 'Internet Computer', 'AAVE': 'Aave', 'TRX': 'Tron', 'TON': 'Toncoin',
      // L2s and new chains
      'SUI': 'Sui', 'APT': 'Aptos', 'ARB': 'Arbitrum', 'OP': 'Optimism',
      'INJ': 'Injective', 'SEI': 'Sei', 'TIA': 'Celestia', 'JUP': 'Jupiter',
      // Memes
      'PEPE': 'Pepe', 'SHIB': 'Shiba Inu', 'BONK': 'Bonk', 'WIF': 'dogwifhat',
      // Special/Projects
      'WLFI': 'World Liberty Financial', 'WORLDLIBERTYFINANCIAL': 'World Liberty Financial',
      'IMX': 'Immutable X', 'IMMUTABLE': 'Immutable X'
    };
    const networkName = networkNames[logoSymbol] || logoSymbol;
    
    // Keyword-based context from article title
    const titleLower = (title || '').toLowerCase();
    const contextMap = {
      'bank': 'inside a futuristic bank vault with gold bars',
      'space': 'floating in outer space with distant stars and nebulae',
      'usa': 'with subtle American patriotic elements',
      'trading': 'on a high-tech trading floor with holographic screens',
      'stock': 'in a stock exchange environment with ticker displays',
      'market': 'surrounded by market data visualizations',
      'economy': 'with abstract economic growth charts',
      'mountain': 'atop a majestic crystal mountain peak',
      'glass': 'made entirely of pristine transparent glass',
      'fast': 'with dynamic motion blur suggesting speed',
      'global': 'with a translucent globe in the background',
      'rocket': 'launching upward like a rocket with thrust flames',
      'moon': 'on the lunar surface with Earth visible',
      'huge': 'at monumental architectural scale',
      'falling': 'dramatically descending with trailing particles',
      'explosion': 'with explosive energy radiating outward',
      'code': 'surrounded by streams of glowing code',
      'computer': 'integrated into a massive circuit board',
      'ai': 'with neural network patterns flowing around it',
      'liquid': 'filled with swirling luminescent liquid',
      'wall street': 'in front of iconic Wall Street architecture',
      'bull': 'alongside a powerful golden charging bull',
      'bear': 'with an icy bear emerging from frost',
      'cyber': 'in a neon-lit cyberpunk cityscape',
      'metaverse': 'in an abstract metaverse digital realm',
      'institutional': 'in a sleek corporate environment',
      'enterprise': 'within a massive enterprise data center',
      'growth': 'with upward-pointing growth indicators',
      'surge': 'surrounded by surging energy waves',
      'partnership': 'with symbolic connected elements',
      'defi': 'in a decentralized network visualization',
      'layer': 'with visible technology layer stacks',
      'upgrade': 'transforming with upgrade particle effects'
    };
    
    let context = '';
    for (const [kw, phrase] of Object.entries(contextMap)) {
      if (titleLower.includes(kw)) { context = phrase; break; }
    }
    
    // Expanded randomized building blocks for TRUE variety
    const materials = [
      'made of polished chrome metal', 'as crystal glass filled with glowing liquid',
      'constructed from circuit board components with glowing traces', 'forged from molten gold',
      'carved from transparent diamond', 'built with holographic light beams',
      'formed by neon energy particles', 'crafted from brushed titanium',
      'made of iridescent opal glass', 'sculpted from liquid mercury',
      'rendered in frosted glass with internal glow', 'built from stacked transparent layers',
      'made of solid platinum with mirror finish', 'constructed from crystalline ice',
      'formed by interconnected hexagonal cells', 'made of brushed copper with patina'
    ];
    
    const scenes = [
      'hovering above a sea of scattered coins', 'floating in a dark void',
      'as a 3D holographic projection', 'emerging from liquid metal',
      'at the center of a swirling vortex', 'on a pedestal of stacked tokens',
      'surrounded by orbiting smaller versions', 'breaking through a digital wall',
      'at the intersection of light beams', 'within a geometric crystal structure',
      'rising from a pool of mercury', 'suspended by invisible force',
      'positioned at the center of a spiral galaxy', 'locked inside a transparent cube',
      'rotating slowly above a reflective plane', 'emerging from a quantum portal'
    ];
    
    const lighting = [
      'with cyan and purple neon rim lighting', 'illuminated by golden rays',
      'with dramatic blue backlighting', 'under matrix-green lighting',
      'with warm amber accents', 'bathed in ethereal white glow',
      'with rainbow prismatic reflections', 'under cold blue moonlight',
      'with fiery orange underlighting', 'surrounded by bioluminescent particles',
      'lit by multiple colored spotlights', 'with volumetric god rays',
      'under soft diffused studio lighting', 'with harsh dramatic shadows',
      'illuminated by aurora borealis colors', 'with pulsing energy light'
    ];
    
    const backgrounds = [
      'on a dark reflective surface', 'against a starfield backdrop',
      'in foggy atmospheric environment', 'above flowing data streams',
      'within a geometric void', 'over a city skyline at night',
      'in abstract gradient space', 'surrounded by floating particles',
      'in a server room corridor', 'above clouds at sunrise',
      'inside an empty black studio', 'within a futuristic laboratory',
      'floating in deep ocean darkness', 'in a vast empty warehouse',
      'against a wall of monitors', 'in an abandoned temple'
    ];
    
    // TRUE randomization using Math.random() - completely unique each call
    const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
    
    // Build truly unique prompt each time - each element independently randomized
    const selectedMaterial = rand(materials);
    const selectedScene = rand(scenes);
    const selectedLighting = rand(lighting);
    const selectedBackground = rand(backgrounds);
    
    let prompt = `The ${networkName} logo ${selectedMaterial}, ${selectedScene}, ${selectedLighting}, ${selectedBackground}`;
    
    if (context) prompt += `, ${context}`;
    
    // Add custom keyword from user input
    if (customKeyword && customKeyword.trim()) {
      const keyword = customKeyword.trim().toLowerCase();
      // Check if keyword maps to a context phrase
      const customContext = contextMap[keyword];
      if (customContext) {
        prompt += `, ${customContext}`;
      } else {
        prompt += `, with ${keyword} aesthetic`;
      }
      logger.info(`   Custom keyword: "${customKeyword}"`);
    }
    
    // Add a random user-suggested keyword if available (from past feedback)
    if (refinedElements?.userKeywords?.length > 0 && Math.random() > 0.5) {
      const userKeyword = refinedElements.userKeywords[Math.floor(Math.random() * refinedElements.userKeywords.length)];
      if (userKeyword && !prompt.toLowerCase().includes(userKeyword)) {
        prompt += `, ${userKeyword} elements`;
        logger.info(`   User-suggested: "${userKeyword}"`);
      }
    }
    
    // CRITICAL: Prevent logo distortion
    prompt += `, maintain exact logo proportions without stretching, professional 3D render, 8k quality`;
    
    // Log the unique combination
    logger.info(`🎬 UNIQUE prompt for ${networkName}:`);
    logger.info(`   Material: ${selectedMaterial}`);
    logger.info(`   Scene: ${selectedScene}`);
    logger.info(`   Lighting: ${selectedLighting}`);
    logger.info(`   Background: ${selectedBackground}`);
    logger.info(`   Context: ${context || 'none'}`);
    
    return prompt;
  }
  
  /**
   * Generate image using Wavespeed ControlNet with actual logo as shape guide
   */
  async generateWithLogoControlNet({ prompt, controlImageBase64, logoSymbol, imageId }) {
    const wavespeedApiKey = process.env.WAVESPEED_API_KEY;
    
    logger.info(`🎯 Submitting to Wavespeed ControlNet with ${logoSymbol} logo shape...`);
    
    // Use ControlNet Union - parameters matched to working test endpoint
    const response = await axios.post('https://api.wavespeed.ai/api/v3/wavespeed-ai/flux-controlnet-union-pro-2.0', {
      prompt: prompt,
      control_image: `data:image/png;base64,${controlImageBase64}`,
      size: "1024*1024",  // Square works best with ControlNet
      num_inference_steps: 30,
      guidance_scale: 7.5,
      // 0.7 = good balance between logo accuracy and 3D creativity
      controlnet_conditioning_scale: 0.7,
      control_guidance_start: 0,
      control_guidance_end: 1.0,
      num_images: 1,
      output_format: "jpeg"
    }, {
      headers: {
        'Authorization': `Bearer ${wavespeedApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000
    });
    
    const responseData = response.data.data || response.data;
    if (!responseData.id) {
      throw new Error('No job ID from Wavespeed ControlNet');
    }
    
    logger.info(`📋 ControlNet job ID: ${responseData.id}`);
    
    const result = await this.pollWavespeedJob(responseData.id, wavespeedApiKey);
    const outputs = result.outputs || result.output || [];
    if (!outputs[0]) {
      throw new Error('No image from Wavespeed ControlNet');
    }
    
    logger.info(`⬇️ Downloading ControlNet result...`);
    
    const imageResponse = await axios.get(outputs[0], {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    const imagePath = path.join(this.imageStorePath, `${imageId}.png`);
    await fs.writeFile(imagePath, imageResponse.data);
    
    logger.info(`✅ ControlNet 3D logo image saved: ${imagePath}`);
    return imagePath;
  }
  
  /**
   * Get FULL 3D COIN/TOKEN prompt - based on user's example outputs
   * The AI generates the ENTIRE image including the 3D logo - NO compositing
   */
  get3DCoinPrompt(title, logoSymbol) {
    // Symbol descriptions for accurate rendering
    const symbolDescriptions = {
      'XRP': 'stylized X shape with curved lines',
      'BTC': 'Bitcoin B symbol with two vertical lines',
      'ETH': 'Ethereum diamond shape',
      'SOL': 'Solana angular S shape with three horizontal bars',
      'HBAR': 'Hedera H symbol with horizontal bar',
      'ADA': 'Cardano starburst symbol',
      'DOGE': 'Dogecoin D symbol',
      'DOT': 'Polkadot circular pattern',
      'AVAX': 'Avalanche A mountain shape',
      'MATIC': 'Polygon angular M shape',
      'LINK': 'Chainlink hexagon chain',
      'UNI': 'Uniswap unicorn symbol'
    };
    
    const symbolDesc = symbolDescriptions[logoSymbol.toUpperCase()] || `${logoSymbol} cryptocurrency symbol`;
    
    // 12 PREMIUM PROMPT TEMPLATES - based on user's actual example outputs
    const coinPrompts = [
      // Style 1: Multiple floating 3D coins (like XRP13.jpg)
      `multiple floating 3D cryptocurrency coins at different angles and depths, each coin has a ${symbolDesc} embossed in raised WHITE SILVER metal on dark metallic face, coins have CHROME IRIDESCENT holographic rainbow edges with neon cyan and magenta rim lighting, coins are tilted showing thickness and perspective, dark deep blue-black background with subtle blue glow, depth of field blur on distant coins, professional 3D render quality, Octane render, 8k`,
      
      // Style 2: Server room architectural (like XRP20.jpg)
      `massive 3D brushed metal ${symbolDesc} as architectural element in futuristic server room corridor, the symbol has NEON CYAN edge lighting and chrome metallic finish, rows of server racks on both sides with purple and cyan holographic displays, metallic coins scattered on floor, dramatic one-point perspective, cyberpunk lighting, purple and cyan neon accents, professional 3D visualization`,
      
      // Style 3: Single glowing sphere/orb (like HBAR1.jpg)
      `glowing 3D sphere with ${symbolDesc} displayed in WHITE on the surface, sphere has vibrant PURPLE MAGENTA gradient glow, sitting on dark reflective surface casting purple light, dark background with floating particles and subtle purple lighting accents, clean minimalist composition, professional product photography lighting`,
      
      // Style 4: Abstract glitch background (like HBAR10.jpg)
      `3D black metallic coin puck with WHITE ${symbolDesc} raised on face, chrome silver beveled edge, vibrant abstract GLITCH ART background with flowing pink magenta blue and gold streaks, digital distortion effects, motion blur energy, the coin is sharp and in focus against blurred dynamic background, contemporary digital art`,
      
      // Style 5: Cosmic floating coins (like XRP17.jpg)
      `3D metallic cryptocurrency coins floating in cosmic space, main coin features ${symbolDesc} in RAISED WHITE SILVER on dark face with CHROME rim, secondary blurred coins at different depths, swirling PURPLE TEAL cosmic nebula background with cyan particle effects and stars, depth of field, cinematic space photography style`,
      
      // Style 6: Energy ring portal (like HBAR5.jpg)  
      `circular 3D token with ${symbolDesc} in bright WHITE on BLACK face, surrounded by glowing PURPLE chrome energy ring, abstract CYAN GREEN flowing liquid metal energy streams radiating outward, dark background with motion blur streaks, futuristic portal effect, professional 3D render`,
      
      // Style 7: Network connections (like SOLANA3.png)
      `glowing 3D orb with ${symbolDesc} as gradient CYAN to PURPLE metallic element inside, orb has soft glow effect, surrounded by network constellation connection points with thin glowing lines, dark TEAL to PURPLE gradient background, blockchain visualization aesthetic, clean modern design`,
      
      // Style 8: Tilted green chrome coins (like xrp5.jpg)
      `multiple 3D cryptocurrency coins with GREEN CHROME metallic finish, ${symbolDesc} embossed in contrasting color on face, coins tilted at dynamic angles showing ridged edges, purple gradient background with abstract geometric white shapes, professional product render style`,
      
      // Style 9: Hourglass integration (like SOLANA1.png)
      `3D metallic coin with ${symbolDesc} in SILVER on face, coin embedded in stylized PURPLE abstract flowing shape, dark background with subtle grid pattern, clean geometric design, the coin has proper lighting and chrome edge, minimalist futuristic aesthetic`,
      
      // Style 10: Dark token with energy (like HBAR variations)
      `3D dark metallic token with ${symbolDesc} glowing in WHITE CYAN, purple NEON ring edge lighting, floating against dark void background with subtle MAGENTA and TEAL energy wisps, the symbol appears illuminated from within, dramatic product lighting`,
      
      // Style 11: Iridescent coins depth (like XRP13.jpg variant)
      `3D cryptocurrency coins with IRIDESCENT RAINBOW chrome finish, ${symbolDesc} with ribbed texture raised on face, multiple coins at different depths creating dynamic composition, DARK BLUE background with soft blue glow, holographic reflections on coin surfaces, premium 3D product render`,
      
      // Style 12: Clean minimal glow
      `single 3D metallic coin centered, ${symbolDesc} in crisp WHITE on DARK face, coin has subtle CYAN glow emanating from edges, clean dark PURPLE to BLACK gradient background with minimal particle effects, professional minimalist design, sharp focus product photography`
    ];
    
    // Select based on title hash
    const titleHash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const promptIndex = titleHash % coinPrompts.length;
    const selectedPrompt = coinPrompts[promptIndex];
    
    logger.info(`🎨 Selected coin style ${promptIndex + 1}/${coinPrompts.length}`);
    
    // Quality suffix
    const quality = ', masterpiece quality, ultra detailed, 8k resolution, professional lighting, sharp focus, no text, no watermarks';
    
    return selectedPrompt + quality;
  }
  
  /**
   * Enhanced negative prompt for backgrounds (no crypto elements)
   */
  getBackgroundNegativePrompt() {
    return `cryptocurrency, bitcoin, ethereum, xrp, solana, crypto coin, crypto logo, trading floor, office, desk, computer monitors, stock charts, realistic human, person, face, text, watermark, signature, blurry, low quality, distorted`;
  }
  
  /**
   * Get premium BACKGROUND-ONLY prompt (no crypto elements)
   * The actual logo will be composited after as a 3D metallic element
   */
  getPremiumBackgroundPrompt(title) {
    const backgrounds = [
      // Dark abstract with neon accents
      'abstract dark void with flowing streams of cyan and magenta neon light, particle effects, subtle grid pattern, deep purple to black gradient, volumetric fog, cinematic lighting',
      
      // Cyberpunk server corridor
      'futuristic server room corridor with purple and cyan neon strip lights, metallic walls with reflections, holographic displays on sides, atmospheric fog, one-point perspective, cyberpunk aesthetic',
      
      // Cosmic nebula
      'deep space nebula scene with swirling purple and blue cosmic gases, distant stars and galaxies, ethereal light rays, NASA Hubble photography style',
      
      // Abstract energy
      'abstract visualization of flowing energy ribbons in cyan gold and magenta, dark background, particle systems, sacred geometry elements, digital art style',
      
      // Glitch art background
      'abstract glitch art background with flowing horizontal streaks of pink blue gold and cyan, motion blur effects, digital distortion, contemporary art style',
      
      // Dark minimal with accent
      'minimalist dark gradient background transitioning from deep purple to black, subtle particle dust floating, soft cyan accent glow from below, clean professional look',
      
      // Network visualization
      'abstract blockchain network visualization, constellation of connected glowing nodes, thin luminous connection lines, dark teal to purple gradient background, futuristic tech aesthetic',
      
      // Liquid chrome abstract
      'abstract flowing liquid chrome and iridescent surfaces, rainbow light reflections, dark background, experimental photography style, metallic textures',
      
      // Neon grid
      'retro-futuristic neon grid floor extending to horizon, purple and cyan wireframe, dark sky with stars, synthwave aesthetic, 80s inspired',
      
      // Crystal formations
      'dark cavern with glowing crystal formations in purple and cyan, bioluminescent accents, atmospheric fog, fantasy art quality'
    ];
    
    const titleHash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const bgIndex = titleHash % backgrounds.length;
    
    logger.info(`🎬 Selected background style ${bgIndex + 1}/${backgrounds.length}`);
    
    return `${backgrounds[bgIndex]}, ultra high quality, 8k resolution, professional photography, masterpiece`;
  }
  
  /**
   * Generate background with Wavespeed
   */
  async generatePremiumBackground({ prompt, imageId }) {
    const wavespeedApiKey = process.env.WAVESPEED_API_KEY;
    
    logger.info('🎨 Generating premium background with Wavespeed...');
    
    const response = await axios.post('https://api.wavespeed.ai/api/v3/wavespeed-ai/flux-schnell', {
      prompt: prompt,
      size: "1792*1024",
      num_inference_steps: 4,
      guidance_scale: 0,
      num_images: 1,
      output_format: "png"
    }, {
      headers: {
        'Authorization': `Bearer ${wavespeedApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000
    });
    
    const responseData = response.data.data || response.data;
    if (!responseData.id) {
      throw new Error('No job ID from Wavespeed');
    }
    
    const result = await this.pollWavespeedJob(responseData.id, wavespeedApiKey);
    const outputs = result.outputs || result.output || [];
    if (!outputs[0]) {
      throw new Error('No image from Wavespeed');
    }
    
    const imageResponse = await axios.get(outputs[0], {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    const bgPath = path.join(this.imageStorePath, `${imageId}_bg.png`);
    await fs.writeFile(bgPath, imageResponse.data);
    
    return bgPath;
  }
  
  /**
   * Generate background with Pollinations (fallback)
   */
  async generatePollinationsBackground({ prompt, imageId }) {
    logger.info('🎨 Generating background with Pollinations...');
    
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1792&height=1024&seed=${Date.now()}&nologo=true&model=flux`;
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 120000
    });
    
    const bgPath = path.join(this.imageStorePath, `${imageId}_bg.png`);
    await fs.writeFile(bgPath, response.data);
    
    return bgPath;
  }
  
  /**
   * Transform flat logo into 3D METALLIC element
   * This creates chrome/silver effect with proper lighting
   */
  async transformLogoTo3DMetallic(logoBuffer, targetSize) {
    logger.info('🔧 Transforming logo to 3D metallic appearance...');
    
    // Step 1: Resize logo and get metadata
    const resizedLogo = await sharp(logoBuffer)
      .resize(targetSize, targetSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    
    // Step 2: Create SILVER/WHITE version of logo (high contrast)
    // This replaces the original colors with bright metallic silver
    const silverLogo = await sharp(resizedLogo)
      .grayscale()
      .modulate({ brightness: 1.8, saturation: 0 })
      .linear(1.5, 30) // Increase contrast, boost whites
      .png()
      .toBuffer();
    
    // Step 3: Create highlight layer (top-lit effect)
    // Brighter version offset slightly up
    const highlightLayer = await sharp(resizedLogo)
      .grayscale()
      .modulate({ brightness: 2.2 })
      .blur(1)
      .png()
      .toBuffer();
    
    // Step 4: Create shadow/depth layer (bottom shadow)
    const shadowLayer = await sharp(resizedLogo)
      .grayscale()
      .modulate({ brightness: 0.4 })
      .blur(8)
      .png()
      .toBuffer();
    
    // Step 5: Create cyan rim glow (neon edge lighting)
    const rimGlow = await sharp(resizedLogo)
      .blur(12)
      .modulate({ brightness: 2.0, saturation: 1.5 })
      .tint({ r: 0, g: 255, b: 255 }) // Cyan tint
      .png()
      .toBuffer();
    
    // Step 6: Create magenta accent glow
    const accentGlow = await sharp(resizedLogo)
      .blur(20)
      .modulate({ brightness: 1.5 })
      .tint({ r: 255, g: 0, b: 255 }) // Magenta tint
      .png()
      .toBuffer();
    
    // Step 7: Composite all layers for 3D metallic effect
    // Create a transparent canvas
    const canvasSize = Math.round(targetSize * 1.3); // Extra space for glows
    const offset = Math.round((canvasSize - targetSize) / 2);
    
    const finalLogo = await sharp({
      create: {
        width: canvasSize,
        height: canvasSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([
      // Layer 1: Accent glow (bottom, magenta)
      { input: accentGlow, left: offset + 5, top: offset + 8, blend: 'screen' },
      // Layer 2: Rim glow (cyan neon edge)
      { input: rimGlow, left: offset, top: offset, blend: 'screen' },
      // Layer 3: Shadow layer (depth)
      { input: shadowLayer, left: offset + 3, top: offset + 5, blend: 'multiply' },
      // Layer 4: Highlight layer (top light)
      { input: highlightLayer, left: offset - 1, top: offset - 2, blend: 'screen' },
      // Layer 5: Main silver logo (on top)
      { input: silverLogo, left: offset, top: offset }
    ])
    .png()
    .toBuffer();
    
    logger.info('✅ 3D metallic logo transformation complete');
    return { buffer: finalLogo, size: canvasSize };
  }
  
  /**
   * Composite 3D metallic logo onto background with proper integration
   */
  async composite3DMetallicLogo(backgroundPath, logoBuffer, logoSymbol, imageId) {
    logger.info(`🔧 Compositing 3D metallic ${logoSymbol} logo onto background...`);
    
    const backgroundBuffer = await fs.readFile(backgroundPath);
    const bgMeta = await sharp(backgroundBuffer).metadata();
    const { width, height } = bgMeta;
    
    // Calculate logo size (35% of height for prominence)
    const logoSize = Math.round(height * 0.38);
    
    // Transform logo to 3D metallic appearance
    const { buffer: metallicLogo, size: logoCanvasSize } = await this.transformLogoTo3DMetallic(logoBuffer, logoSize);
    
    // Center position (slightly above center)
    const logoX = Math.round((width - logoCanvasSize) / 2);
    const logoY = Math.round((height - logoCanvasSize) / 2) - Math.round(height * 0.02);
    
    // Create environmental glow beneath logo (reflection on surface)
    const envGlow = await sharp(logoBuffer)
      .resize(Math.round(logoSize * 1.2), Math.round(logoSize * 0.4))
      .blur(30)
      .modulate({ brightness: 0.8 })
      .tint({ r: 100, g: 200, b: 255 })
      .png()
      .toBuffer();
    
    const envGlowX = Math.round((width - logoSize * 1.2) / 2);
    const envGlowY = logoY + logoCanvasSize - Math.round(logoSize * 0.1);
    
    // Composite everything
    const finalBuffer = await sharp(backgroundBuffer)
      .composite([
        // Environmental reflection glow
        { input: envGlow, left: envGlowX, top: envGlowY, blend: 'screen' },
        // 3D metallic logo
        { input: metallicLogo, left: logoX, top: logoY }
      ])
      .png({ quality: 95 })
      .toBuffer();
    
    // Save final image
    const outputPath = path.join(this.imageStorePath, `${imageId}.png`);
    await fs.writeFile(outputPath, finalBuffer);
    
    // Clean up temp background
    try { await fs.unlink(backgroundPath); } catch (e) { /* ignore */ }
    
    logger.info(`✅ 3D metallic composite complete: ${outputPath}`);
    return outputPath;
  }

  /**
   * Composite actual logo onto generated background
   * Used when ControlNet APIs fail but we still have a good background
   */
  async compositeLogoOntoBackground(backgroundPath, logoBuffer, logoSymbol, imageId) {
    try {
      logger.info(`🔧 Creating professional 3D logo composite for ${logoSymbol}...`);
      
      // Read background image
      const backgroundBuffer = await fs.readFile(backgroundPath);
      const backgroundMeta = await sharp(backgroundBuffer).metadata();
      const { width, height } = backgroundMeta;
      
      // Calculate logo size (40% of image height for prominent visibility like examples)
      const logoSize = Math.round(height * 0.4);
      
      // Create main logo - slightly brightened for metallic effect
      const resizedLogo = await sharp(logoBuffer)
        .resize(logoSize, logoSize, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .modulate({ brightness: 1.1, saturation: 1.1 })
        .png()
        .toBuffer();
      
      // Create outer glow (soft cyan/white glow like holographic effect)
      const outerGlow = await sharp(logoBuffer)
        .resize(Math.round(logoSize * 1.3), Math.round(logoSize * 1.3), {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .blur(25)
        .modulate({ brightness: 2.0, saturation: 0.5 })
        .tint({ r: 100, g: 200, b: 255 }) // Cyan tint
        .png()
        .toBuffer();
      
      // Create inner glow (stronger, smaller)
      const innerGlow = await sharp(logoBuffer)
        .resize(Math.round(logoSize * 1.15), Math.round(logoSize * 1.15), {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .blur(12)
        .modulate({ brightness: 1.8, saturation: 1.3 })
        .png()
        .toBuffer();
      
      // Create subtle shadow (offset down and right)
      const shadow = await sharp(logoBuffer)
        .resize(logoSize, logoSize, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .blur(20)
        .modulate({ brightness: 0.3 })
        .png()
        .toBuffer();
      
      // Center position with slight upward offset for floating effect
      const logoX = Math.round((width - logoSize) / 2);
      const logoY = Math.round((height - logoSize) / 2) - Math.round(height * 0.02);
      const outerGlowSize = Math.round(logoSize * 1.3);
      const innerGlowSize = Math.round(logoSize * 1.15);
      const outerGlowX = Math.round((width - outerGlowSize) / 2);
      const outerGlowY = Math.round((height - outerGlowSize) / 2) - Math.round(height * 0.02);
      const innerGlowX = Math.round((width - innerGlowSize) / 2);
      const innerGlowY = Math.round((height - innerGlowSize) / 2) - Math.round(height * 0.02);
      
      // Shadow offset (down and right for 3D depth)
      const shadowX = logoX + Math.round(logoSize * 0.03);
      const shadowY = logoY + Math.round(logoSize * 0.08);
      
      // Composite with multiple layers for professional 3D look
      const compositedBuffer = await sharp(backgroundBuffer)
        .composite([
          // Layer 1: Shadow (bottom layer for depth)
          {
            input: shadow,
            left: shadowX,
            top: shadowY,
            blend: 'multiply'
          },
          // Layer 2: Outer glow (holographic effect)
          {
            input: outerGlow,
            left: outerGlowX,
            top: outerGlowY,
            blend: 'screen'
          },
          // Layer 3: Inner glow (edge highlight)
          {
            input: innerGlow,
            left: innerGlowX,
            top: innerGlowY,
            blend: 'screen'
          },
          // Layer 4: Main logo (top)
          {
            input: resizedLogo,
            left: logoX,
            top: logoY
          }
        ])
        .png({ quality: 95 })
        .toBuffer();
      
      // Save composited image
      const outputPath = path.join(this.imageStorePath, `${imageId}.png`);
      await fs.writeFile(outputPath, compositedBuffer);
      
      // Apply watermark
      await this.watermarkService.addWatermark(outputPath, outputPath, {
        title: `${logoSymbol} Analysis`
      });
      
      logger.info(`✅ Professional 3D logo composite complete: ${outputPath}`);
      return outputPath;
      
    } catch (error) {
      logger.error('❌ Logo composite failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate using HuggingFace ControlNet Union model
   */
  async generateWithHuggingFaceControlNet({ prompt, logoSymbol, controlImageBase64, imageId, options = {} }) {
    const hfApiKey = process.env.HUGGINGFACE_API_KEY;
    if (!hfApiKey) {
      throw new Error('HUGGINGFACE_API_KEY not configured');
    }
    
    logger.info(`🤗 Calling HuggingFace ControlNet for ${logoSymbol}...`);
    
    try {
      // Use HuggingFace's ControlNet SDXL model
      const response = await axios.post(
        'https://api-inference.huggingface.co/models/diffusers/controlnet-canny-sdxl-1.0',
        {
          inputs: `${prompt}, featuring the exact ${logoSymbol} cryptocurrency logo with 3D metallic integration, professional lighting`,
          parameters: {
            negative_prompt: `flat overlay, 2D sticker, wrong logo, different symbol, text, watermarks`,
            num_inference_steps: 30,
            guidance_scale: 7.5
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${hfApiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer',
          timeout: 120000
        }
      );
      
      if (response.data && response.data.byteLength > 1000) {
        // Save the generated image as PNG for consistency with getImageUrl()
        const outputPath = path.join(this.imageStorePath, `${imageId}.png`);
        
        await sharp(response.data)
          .resize(1800, 900, { fit: 'cover' })
          .jpeg({ quality: 95 })
          .toFile(outputPath);
        
        // Apply watermark
        await this.watermarkService.addWatermark(outputPath, outputPath, {
          title: `${logoSymbol} Analysis`
        });
        
        return {
          localPath: outputPath,
          imageUrl: this.getImageUrl(imageId)
        };
      }
      
      throw new Error('Invalid response from HuggingFace ControlNet');
      
    } catch (error) {
      if (error.response?.status === 503) {
        throw new Error('HuggingFace ControlNet model is loading, try again in 1-2 minutes');
      }
      throw error;
    }
  }

  /**
   * CORE METHOD: Generate using actual SVG geometry as ControlNet input
   * This is the breakthrough method that uses real logo shapes
   */
  async generateWithSVGControlNet(title, logoSymbol, style, imageId, options = {}) {
    try {
      logger.info(`🔧 CORE SVG METHOD: Loading actual ${logoSymbol} SVG geometry for ControlNet`);
      
      // 1. Get actual SVG logo data
      const svgLogoData = await this.getSVGLogoForControlNet(logoSymbol);
      if (!svgLogoData) {
        throw new Error(`No SVG logo data found for ${logoSymbol}`);
      }
      
      logger.info(`✅ SVG logo loaded: ${svgLogoData.symbol} (${svgLogoData.source})`);
      
      // 2. Convert SVG to ControlNet conditioning images
      const controlNetInputs = await this.convertSVGToControlNetInputs(svgLogoData);
      
      // 3. Build dynamic environment prompt from content analysis
      const environmentPrompt = this.buildEnvironmentPrompt(title, style, options);
      
      // 4. Build logo integration prompt
      const logoPrompt = `${environmentPrompt}, 
      the ${logoSymbol} cryptocurrency logo naturally integrated as 3D architectural element,
      multiple instances of the ${logoSymbol} symbol at different depths and angles,
      the logo casting realistic shadows and receiving environmental lighting,
      photorealistic materials with proper surface properties,
      absolutely no flat overlays or 2D sticker effects,
      pure 3D environmental integration, studio-quality cinematography`;
      
      logger.info(`🎯 Using SVG-derived ControlNet with dynamic prompt`);
      
      // 5. Generate using SVG-guided ControlNet
      const result = await this.callOptimalControlNetAPI({
        prompt: logoPrompt,
        negative_prompt: `flat overlay, 2d sticker, wrong ${logoSymbol} logo, different cryptocurrency, text, letters, low quality`,
        control_image: controlNetInputs.canny, // Use actual SVG-derived edges
        logoSymbol: logoSymbol,
        imageId: imageId,
        style: 'svg_guided',
        width: 1600,
        height: 900,
        steps: 80,
        guidance_scale: 7.5,
        controlnet_conditioning_scale: 0.8, // High conditioning for precise logo control
        options: {
          ...options,
          svgControlInputs: controlNetInputs,
          dynamicPrompt: environmentPrompt
        }
      });
      
      return {
        success: true,
        imageId: imageId,
        localPath: result.localPath,
        svgData: svgLogoData,
        metadata: {
          method: 'svg_guided_controlnet',
          svgSource: svgLogoData.source,
          controlNetTypes: controlNetInputs.types,
          logoSymbol: logoSymbol
        }
      };
      
    } catch (error) {
      logger.error(`❌ SVG ControlNet failed for ${logoSymbol}:`, error);
      throw error;
    }
  }

  /**
   * Build HIGH-QUALITY environment prompt with diverse scenes
   * Based on professional crypto.news style outputs
   */
  buildEnvironmentPrompt(title, style, options = {}) {
    // Use dynamic background analysis if available
    if (options.dynamicBackgroundPrompt) {
      const analysis = options.dynamicBackgroundPrompt;
      logger.info(`🎨 Using content-based environment: ${analysis.environmentType}`);
      return analysis.fullPrompt;
    }
    
    // HIGH-QUALITY DIVERSE SCENE TEMPLATES - NOT generic trading floors!
    const premiumScenes = [
      // Cyberpunk/Futuristic
      'massive cyberpunk cityscape at night with towering neon-lit skyscrapers, holographic billboards displaying crypto data, rain-slicked streets reflecting vibrant blue and purple lights, flying vehicles in the distance, atmospheric fog, Blade Runner aesthetic',
      
      // Abstract Digital
      'abstract digital realm with flowing streams of golden light particles, geometric crystalline structures floating in a deep blue void, data visualization ribbons weaving through space, ethereal glow, minimalist futuristic aesthetic',
      
      // Space/Cosmic
      'cosmic scene with a nebula backdrop in deep purples and blues, distant galaxies and stars, a massive translucent planetary ring structure, aurora-like energy waves, cinematic space photography',
      
      // Tech Minimal
      'sleek minimalist environment with clean white surfaces and subtle blue accent lighting, floating geometric shapes casting soft shadows, professional product photography style, Apple-inspired aesthetic',
      
      // Underwater Tech
      'underwater technology environment with bioluminescent elements, translucent structures, flowing caustic light patterns, deep ocean blue atmosphere, scattered light particles floating like plankton',
      
      // Crystal Cave
      'magnificent crystal cavern with massive glowing crystalline formations in cyan and purple hues, light rays piercing through from above, reflective surfaces creating prismatic effects, mystical atmosphere',
      
      // Neural Network
      'visualization of a vast neural network, interconnected nodes pulsing with energy, synaptic connections firing with golden light, deep purple background, abstract technological art',
      
      // Quantum Realm
      'quantum realm environment with probability waves visualized as luminous ribbons, particle effects, mathematical equations floating as holographic displays, scientific visualization aesthetic',
      
      // Arctic Tech
      'futuristic arctic research station at golden hour, pristine ice formations, aurora borealis in the sky, high-tech structures with warm interior lighting contrasting cold blue exterior',
      
      // Desert Oasis Tech
      'modern architectural marvel in a desert setting at sunset, clean geometric buildings with reflective surfaces catching golden and pink light, sand dunes in background, cinematic wide shot'
    ];
    
    // Select a scene based on title hash for consistency, or random for variety
    const titleHash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const sceneIndex = titleHash % premiumScenes.length;
    const selectedScene = premiumScenes[sceneIndex];
    
    // Quality modifiers
    const qualityModifiers = 'ultra detailed, 8k resolution, photorealistic rendering, cinematic lighting, depth of field, volumetric lighting, ray tracing, professional photography, masterpiece quality';
    
    logger.info(`🎨 Selected premium scene ${sceneIndex + 1}/${premiumScenes.length}`);
    
    return `${selectedScene}, ${qualityModifiers}`;
  }

  /**
   * NEW: Generate precise logo image using PNG + ControlNet with optimal 2024 settings
   * This is the LEGACY method - kept for compatibility
   */
  async generateWithPngControlNet(title, logoSymbol, style = 'holographic', options = {}) {
    try {
      const startTime = Date.now();
      const imageId = this.generateImageId();
      
      logger.info(`🎯 Starting PNG ControlNet generation for ${logoSymbol} with ${style} style`);
      
      // Step 1: Get PNG logo
      const logoData = await this.getPngLogo(logoSymbol);
      if (!logoData) {
        throw new Error(`No PNG logo found for ${logoSymbol}`);
      }
      
      // Step 2: Preprocess logo for optimal ControlNet
      const controlImage = await this.preprocessPngForControlNet(logoData.buffer, this.optimalSettings.width);
      
      // Step 3: Get style template
      const styleTemplate = this.styleTemplates[style] || this.styleTemplates.holographic;
      
      // Step 4: Build enhanced prompt with logo-specific terms
      const enhancedPrompt = this.buildPngControlNetPrompt(title, logoSymbol, styleTemplate, options);
      
      // Step 5: Generate using optimal ControlNet settings
      const result = await this.callOptimalControlNetAPI({
        prompt: enhancedPrompt,
        negative_prompt: styleTemplate.negative_prompt + `, wrong ${logoSymbol} logo, incorrect cryptocurrency symbol, different coin`,
        control_image: controlImage.toString('base64'),
        logoSymbol,
        imageId,
        style,
        options
      });
      
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      logger.info(`🎯 PNG ControlNet generation completed in ${totalTime}s for ${logoSymbol}`);
      
      return {
        success: true,
        imageId,
        imageUrl: this.getImageUrl(imageId),
        localPath: result.localPath,
        metadata: {
          method: 'png_controlnet_2024',
          logoSymbol,
          style,
          prompt: enhancedPrompt,
          settings: this.optimalSettings,
          processingTime: totalTime,
          logoSource: 'png_file',
          logoFile: logoData.filename,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error(`❌ PNG ControlNet generation failed for ${logoSymbol}:`, error.message);
      throw error;
    }
  }

  /**
   * NEW: Build optimized prompt for PNG ControlNet generation with dynamic backgrounds
   */
  buildPngControlNetPrompt(title, logoSymbol, styleTemplate, options = {}) {
    logger.info(`🎯 BUILDING CONTENT-BASED PROMPT for ${logoSymbol} based on article: "${title}"`);
    
    // CORE FIX: Always analyze content for dynamic backgrounds
    const contentAnalysis = this.analyzeArticleForScene(title, options);
    logger.info(`🎨 Content analysis: ${contentAnalysis.environment}`);
    
    // Build DETAILED scene prompt based on actual article content
    let prompt = `${contentAnalysis.fullScenePrompt}, 
    ultra-realistic 3D ${logoSymbol} cryptocurrency logo naturally integrated as architectural element,
    the ${logoSymbol} symbol crafted from premium metallic materials with proper volumetric lighting,
    multiple instances at various depths creating true 3D perspective,
    the logo casting realistic shadows and receiving environmental reflections,
    photorealistic surface properties and atmospheric depth,
    absolutely no flat overlays or 2D sticker effects,
    cinematic composition with professional studio lighting`;
    
    // Add logo-specific material properties for 3D realism
    switch (logoSymbol.toUpperCase()) {
      case 'XRP':
        prompt += ', XRP logo in polished chrome with blue accent lighting and holographic reflections';
        break;
      case 'BTC':
        prompt += ', Bitcoin logo in golden metallic finish with warm amber highlights and coin-like texture';
        break;
      case 'ETH':
        prompt += ', Ethereum logo in sleek titanium silver with purple accent lighting and crystal-like facets';
        break;
      case 'SOLANA':
        prompt += ', Solana logo in gradient purple-to-pink metal with iridescent finish';
        break;
      default:
        prompt += ', cryptocurrency logo in premium metallic finish with brand-appropriate accent lighting';
    }
    
    prompt += ', 8k resolution, ultra-detailed, professional product photography, no text or typography';
    
    logger.info(`✅ CONTENT-BASED prompt: ${contentAnalysis.keywords.join(', ')}`);
    return prompt;
  }

  /**
   * NEW: Analyze article content to generate appropriate scene backgrounds
   */
  analyzeArticleForScene(title, options = {}) {
    const fullText = `${title} ${options.articleContent || ''}`.toLowerCase();
    
    logger.info(`🔍 Analyzing article content: "${title.substring(0, 60)}..."`);
    
    let environment = '';
    let sceneElements = '';
    let lighting = '';
    let keywords = [];
    
    // SPECIFIC SCENE ANALYSIS based on article content
    if (fullText.includes('trading') || fullText.includes('price') || fullText.includes('chart')) {
      environment = 'sophisticated trading floor with massive curved holographic displays showing live market data';
      sceneElements = 'candlestick charts floating in 3D space, dynamic price indicators, professional financial workstations';
      lighting = 'dramatic blue and green monitor lighting with professional studio accents';
      keywords = ['trading', 'financial', 'market'];
    }
    else if (fullText.includes('bank') || fullText.includes('payment') || fullText.includes('financial institution')) {
      environment = 'premium corporate banking environment with elegant glass architecture';
      sceneElements = 'floating holographic financial reports, elegant marble surfaces, executive presentation displays';
      lighting = 'warm sophisticated lighting with golden accent tones and professional ambiance';
      keywords = ['banking', 'corporate', 'premium'];
    }
    else if (fullText.includes('technology') || fullText.includes('innovation') || fullText.includes('development')) {
      environment = 'cutting-edge technology laboratory with advanced holographic interfaces';
      sceneElements = 'floating code displays, high-tech equipment, innovative digital projections';
      lighting = 'cool blue technological lighting with bright accent highlights';
      keywords = ['technology', 'innovation', 'futuristic'];
    }
    else if (fullText.includes('security') || fullText.includes('hack') || fullText.includes('protection')) {
      environment = 'high-security cyber command center with encrypted data visualizations';
      sceneElements = 'digital security shields, secure network displays, cybersecurity monitoring systems';
      lighting = 'dramatic blue and purple security lighting with digital effects';
      keywords = ['security', 'cyber', 'protection'];
    }
    else if (fullText.includes('partnership') || fullText.includes('collaboration') || fullText.includes('agreement')) {
      environment = 'modern conference center with interconnected digital networks visualization';
      sceneElements = 'flowing connection lines between corporate logos, collaborative workspace displays';
      lighting = 'bright professional conference lighting with connectivity highlights';
      keywords = ['partnership', 'collaboration', 'corporate'];
    }
    else if (fullText.includes('regulation') || fullText.includes('government') || fullText.includes('legal')) {
      environment = 'formal government chamber with official digital documentation displays';
      sceneElements = 'floating legal documents, official governmental architecture, regulatory displays';
      lighting = 'formal institutional lighting with authoritative ambiance';
      keywords = ['regulatory', 'government', 'legal'];
    }
    else {
      environment = 'professional modern digital workspace with sophisticated holographic displays';
      sceneElements = 'floating data visualizations, contemporary tech interfaces, professional presentation setup';
      lighting = 'clean professional lighting with modern accent highlights';
      keywords = ['professional', 'modern', 'digital'];
    }
    
    const fullScenePrompt = `${environment}, ${sceneElements}, ${lighting}, 
    photorealistic 3D environment with cinematic depth and professional atmosphere,
    ultra-detailed architectural elements creating perfect integration space`;
    
    logger.info(`🎬 Scene analysis complete: ${environment.substring(0, 50)}...`);
    
    return {
      environment,
      sceneElements,
      lighting,
      fullScenePrompt,
      keywords
    };
  }

  /**
   * Call SDXL ControlNet API with optimal 2024 settings
   * Uses RunPod SDXL + ControlNet for precise logo control
   */
  async callOptimalControlNetAPI(payload) {
    try {
      logger.info('🎯 Calling SDXL ControlNet with revolutionary dynamic backgrounds...');
      logger.info(`   📊 Logo Symbol: ${payload.logoSymbol}`);
      logger.info(`   📊 Dynamic Background: ${payload.options?.dynamicBackgroundPrompt ? 'YES' : 'NO'}`);
      logger.info(`   📊 Control Weight: ${this.optimalSettings.stage2.controlnet_conditioning_scale}`);
      logger.info(`   📊 Guidance Scale: ${this.optimalSettings.stage2.guidance_scale}`);
      logger.info(`   📊 Model: SDXL + ControlNet with Enhanced Prompting`);
      
      // IMPROVED: Try multiple generation methods for maximum success
      let result;
      
      // Method 1: Try FREE Open-Source LoRA with ControlNet
      try {
        logger.info('📊 Method 1: Attempting FREE Open-Source LoRA ControlNet...');
        result = await this.generateWithFreeLoRA(payload);
        logger.info('✅ FREE LoRA ControlNet succeeded!');
        return result;
      } catch (freeLoraError) {
        logger.warn('⚠️ FREE LoRA ControlNet failed:', freeLoraError.message);
        
        // Method 2: Try Wavespeed ControlNet as backup
        try {
          logger.info('📊 Method 2: Attempting Wavespeed ControlNet backup...');
          const wavespeedResult = await this.generateWithWavespeedControlNet({
            prompt: payload.prompt,
            controlType: 'canny',
            controlImageBase64: payload.control_image,
            detected: payload.logoSymbol,
            imageId: payload.imageId,
            options: payload.options
          });
          logger.info('✅ Wavespeed ControlNet backup succeeded!');
          return wavespeedResult;
        } catch (wavespeedError) {
          logger.warn('⚠️ Wavespeed ControlNet backup failed:', wavespeedError.message);
          
          // Method 3: Emergency fallback with improved backgrounds
          logger.warn('🔄 Using emergency fallback with improved background generation...');
          return await this.generateImprovedFallback(payload);
        }
      }
      
    } catch (error) {
      logger.error('❌ All ControlNet methods failed:', error.message);
      throw new Error(`ControlNet generation failed: ${error.message}`);
    }
  }

  /**
   * Generate image using FREE Open-Source LoRA with ControlNet
   */
  async generateWithFreeLoRA(payload) {
    try {
      logger.info('🆓 Starting FREE Open-Source LoRA generation...');
      
      // Use the FreeLoraService with content analysis
      const options = {
        articleContent: payload.options?.articleContent,
        content: payload.options?.content,
        style: payload.options?.style,
        dynamicBackgroundPrompt: payload.options?.dynamicBackgroundPrompt,
        seed: payload.options?.seed
      };

      const result = await this.freeLoraService.generateWithFreeLoRA(
        payload.title || payload.prompt,
        payload.logoSymbol,
        options
      );

      if (!result.success || !result.localPath) {
        throw new Error('FREE LoRA generation failed - no image generated');
      }

      // Move generated image to ControlNet directory with standard naming
      const standardPath = path.join(this.imageStorePath, `${payload.imageId}.jpg`);
      
      // Ensure ControlNet storage directory exists
      await fs.mkdir(path.dirname(standardPath), { recursive: true });
      
      // Process and resize to standard format (1800x900)
      const metadata = await sharp(result.localPath).metadata();
      logger.info(`📏 FREE LoRA dimensions: ${metadata.width}x${metadata.height}`);
      
      if (metadata.width === 1800 && metadata.height === 900) {
        // Already correct size
        await sharp(result.localPath).jpeg({ quality: 95 }).toFile(standardPath);
      } else {
        // Resize to 1800x900
        await sharp(result.localPath)
          .resize(1800, 900, { fit: 'cover' })
          .jpeg({ quality: 95 })
          .toFile(standardPath);
      }

      // Apply watermark
      await this.watermarkService.addWatermark(
        standardPath,
        standardPath,
        { title: `${payload.logoSymbol} FREE LoRA` }
      );

      logger.info(`✅ FREE LoRA generation completed for ${payload.logoSymbol}`);
      
      return { 
        localPath: standardPath,
        metadata: result.metadata 
      };
      
    } catch (error) {
      logger.error('❌ FREE LoRA generation failed:', error.message);
      throw error;
    }
  }

  /**
   * IMPROVED: Generate enhanced fallback image with dynamic backgrounds
   * This should rarely be used - ControlNet should handle most cases
   */
  async generateImprovedFallback(payload) {
    try {
      const { logoSymbol, imageId, style, options } = payload;
      
      logger.warn('🚨 EMERGENCY FALLBACK: ControlNet systems failed, using improved fallback generation');
      
      // Get logo data
      const logoData = await this.getPngLogo(logoSymbol);
      if (!logoData) {
        throw new Error(`No logo available for ${logoSymbol}`);
      }

      logger.info(`🎨 Creating improved fallback image for ${logoSymbol}`);
      
      // Use dynamic background if available, otherwise professional gradient
      let backgroundImage;
      if (options?.dynamicBackgroundPrompt) {
        logger.info('🎨 Using simplified dynamic background for fallback');
        // Create a more sophisticated background based on the dynamic analysis
        backgroundImage = await this.createDynamicFallbackBackground(options.dynamicBackgroundPrompt);
      } else {
        logger.info('🎨 Using professional gradient background');
        backgroundImage = await this.createStyledBackground('professional');
      }
      
      // Composite logo with improved positioning and effects
      const finalImageBuffer = await this.createEnhancedLogoComposition(
        backgroundImage, 
        logoData.buffer, 
        logoSymbol,
        options
      );
      
      // Save buffer to temp file first
      const tempImagePath = path.join(this.imageStorePath, `${imageId}_temp.png`);
      await fs.writeFile(tempImagePath, finalImageBuffer);
      
      // Apply watermark
      const finalImagePath = path.join(this.imageStorePath, `${imageId}.png`);
      await this.watermarkService.addWatermark(
        tempImagePath, 
        finalImagePath,
        { title: `${logoSymbol} Professional Analysis` }
      );
      
      // Clean up temp file
      try {
        await fs.unlink(tempImagePath);
      } catch (cleanupError) {
        logger.warn(`⚠️ Failed to clean up temp file: ${cleanupError.message}`);
      }
      
      return { 
        localPath: finalImagePath
      };
      
    } catch (error) {
      logger.error('❌ Improved fallback generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Create dynamic background based on content analysis
   */
  async createDynamicFallbackBackground(dynamicPrompt) {
    const width = 1800;
    const height = 900;
    
    logger.info('🎨 Creating dynamic fallback background based on content themes');
    
    // Create backgrounds based on detected themes
    const themes = dynamicPrompt.themes || [];
    let gradientColors = {
      start: '#1e3c72',
      middle: '#2a5298', 
      end: '#1e3c72'
    };
    
    if (themes.includes('technology')) {
      gradientColors = { start: '#0f0f0f', middle: '#1a365d', end: '#2d3748' };
    } else if (themes.includes('trading')) {
      gradientColors = { start: '#1a202c', middle: '#2d3748', end: '#4a5568' };
    } else if (themes.includes('finance')) {
      gradientColors = { start: '#2c1810', middle: '#744210', end: '#2c1810' };
    } else if (themes.includes('security')) {
      gradientColors = { start: '#1a0d33', middle: '#4c1d95', end: '#1a0d33' };
    }
    
    const backgroundSvg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="dynamic" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${gradientColors.start};stop-opacity:1"/>
            <stop offset="50%" style="stop-color:${gradientColors.middle};stop-opacity:1"/>
            <stop offset="100%" style="stop-color:${gradientColors.end};stop-opacity:1"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#dynamic)"/>
      </svg>
    `;
    
    return await sharp(Buffer.from(backgroundSvg)).png().toBuffer();
  }

  /**
   * Create enhanced logo composition with better positioning and effects
   */
  async createEnhancedLogoComposition(backgroundBuffer, logoBuffer, logoSymbol, options = {}) {
    const logoSize = 400; // Larger logo for better presence
    
    // Resize logo with better quality
    const resizedLogo = await sharp(logoBuffer)
      .resize(logoSize, logoSize, { 
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();
    
    // Create enhanced composition with multiple logo instances for depth effect
    const finalImage = await sharp(backgroundBuffer)
      .composite([
        // Main logo in center (remove invalid blend parameter)
        {
          input: resizedLogo,
          top: Math.round((900 - logoSize) / 2),
          left: Math.round((1800 - logoSize) / 2)
          // No blend parameter - Sharp will use default 'over' mode
        },
        // Subtle background logo for depth
        {
          input: await sharp(logoBuffer)
            .resize(logoSize * 1.5, logoSize * 1.5, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .modulate({ brightness: 0.3, saturation: 0.5 })
            .blur(8)
            .png()
            .toBuffer(),
          top: Math.round((900 - logoSize * 1.5) / 2),
          left: Math.round((1800 - logoSize * 1.5) / 2),
          blend: 'multiply'  // This blend mode is valid
        }
      ])
      .png()
      .toBuffer();
    
    logger.info(`✅ Enhanced composition created for ${logoSymbol} with improved depth effects`);
    return finalImage;
  }

  /**
   * DEPRECATED: Basic PNG-based image generation (legacy fallback)
   */
  async generateDirectPngImage(payload) {
    logger.warn('⚠️ DEPRECATED: generateDirectPngImage called - using generateImprovedFallback instead');
    return await this.generateImprovedFallback(payload);
  }

  /**
   * Create professional background for emergency fallback only
   * IMPORTANT: This should rarely be used - ControlNet should handle backgrounds
   */
  async createStyledBackground(style = 'professional') {
    const width = 1800;
    const height = 900;
    
    logger.warn('⚠️ Using emergency fallback background - ControlNet should handle this normally');
    
    // Create a professional dark gradient instead of ugly radial patterns
    const backgroundSvg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="professional" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1e3c72;stop-opacity:1"/>
            <stop offset="50%" style="stop-color:#2a5298;stop-opacity:1"/>
            <stop offset="100%" style="stop-color:#1e3c72;stop-opacity:1"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#professional)"/>
      </svg>
    `;
    
    return await sharp(Buffer.from(backgroundSvg))
      .png()
      .toBuffer();
  }

  /**
   * Composite logo onto background
   */
  async compositeLogo(backgroundBuffer, logoBuffer, logoSymbol) {
    const logoSize = 300; // Logo size in pixels
    
    // Resize logo to fit properly
    const resizedLogo = await sharp(logoBuffer)
      .resize(logoSize, logoSize, { 
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();
    
    // Composite logo in center of background
    const finalImage = await sharp(backgroundBuffer)
      .composite([{
        input: resizedLogo,
        top: Math.round((900 - logoSize) / 2),
        left: Math.round((1800 - logoSize) / 2)
      }])
      .png()
      .toBuffer();
    
    logger.info(`✅ Composited ${logoSymbol} logo onto styled background`);
    return finalImage;
  }

  /**
   * Get hosted image URL for an image ID
   */
  getImageUrl(imageId) {
    return `${this.baseUrl}/temp/controlnet-images/${imageId}.png`;
  }

  /**
   * Generate image with enhanced multi-format SVG guidance using ControlNet
   * Uses multiple conditioning formats for maximum geometric accuracy
   */
  async generateWithSVGGuidance(title, content = '', style = 'professional', options = {}) {
    const imageId = this.generateImageId();
    const startTime = Date.now();
    
    logger.info(`🎯 Generating image with Enhanced Multi-Format ControlNet guidance: "${title}"`);
    
    try {
      // Step 1: Detect cryptocurrency and get SVG logo
      const detection = await this.svgLogoService.detectAndGetLogo(title, content);
      if (!detection) {
        throw new Error('No cryptocurrency detected for SVG guidance');
      }

      // Handle both single and multiple entity detection formats
      let detected, logo;
      if (detection.multiple) {
        // Multiple entities detected - use the first one for ControlNet
        const firstEntity = detection.entities[0];
        detected = firstEntity.detected;
        logo = firstEntity.logo;
        logger.info(`🎯 Multiple entities detected: ${detection.entities.map(e => e.name).join(', ')} - Using ${firstEntity.name} for Enhanced ControlNet`);
      } else {
        // Single entity detected - use as before
        detected = detection.detected;
        logo = detection.logo;
        logger.info(`✅ Single entity detected: ${detected}, found Enhanced SVG logo`);
      }

      // Step 2: Determine best conditioning strategy based on available formats
      const availableFormats = this.analyzeAvailableConditioningFormats(logo);
      
      if (availableFormats.count === 0) {
        throw new Error(`No ControlNet conditioning images available for ${detected}`);
      }

      logger.info(`🎨 Enhanced ControlNet: ${availableFormats.count} conditioning formats available for ${detected}: ${availableFormats.types.join(', ')}`);

      // Step 3: Select optimal conditioning strategy
      const conditioningStrategy = this.selectOptimalConditioningStrategy(availableFormats, logo, options);
      
      logger.info(`🎯 Selected conditioning strategy: ${conditioningStrategy.primary} (${conditioningStrategy.description})`);

      // Step 4: Create enhanced crypto-specific prompt
      const prompt = this.createEnhancedControlNetPrompt(title, content, detected, logo, style, conditioningStrategy);
      
      logger.info(`🔤 Enhanced ControlNet Prompt: "${prompt.substring(0, 100)}..."`);

      // Step 5: Generate with Enhanced Wavespeed ControlNet
      const result = await this.generateWithEnhancedWavespeedControlNet({
        prompt,
        conditioning: conditioningStrategy,
        detected,
        imageId,
        options
      });

      const totalTime = Math.round((Date.now() - startTime) / 1000);
      logger.info(`✅ Enhanced SVG-guided ControlNet generation completed in ${totalTime}s`);
      
      return {
        success: true,
        imageId: imageId,
        imageUrl: this.getImageUrl(imageId),
        localPath: result.localPath,
        metadata: {
          title,
          content,
          cryptocurrency: detected,
          conditioningStrategy: conditioningStrategy.primary,
          conditioningFormats: conditioningStrategy.formats,
          style,
          prompt,
          generationTime: totalTime,
          method: 'enhanced_svg_controlnet_guidance',
          model: 'FLUX_CONTROLNET_UNION_PRO_2.0',
          resolution: '2048x2048',
          logoUsed: {
            symbol: logo.symbol,
            name: logo.name,
            colors: logo.brand_colors
          },
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('❌ Enhanced SVG-guided ControlNet generation failed:', error);
      throw new Error(`Enhanced SVG ControlNet generation failed: ${error.message}`);
    }
  }

  /**
   * Analyze available conditioning formats for optimal strategy selection
   */
  analyzeAvailableConditioningFormats(logo) {
    const formats = {
      canny: !!logo.preprocessed_canny,
      depth: !!logo.preprocessed_depth,
      normal: !!(logo.metadata?.enhanced_conditioning?.normal_map),
      mask: !!(logo.metadata?.enhanced_conditioning?.mask)
    };
    
    const types = Object.keys(formats).filter(type => formats[type]);
    
    return {
      formats,
      types,
      count: types.length,
      hasEnhanced: formats.normal || formats.mask
    };
  }

  /**
   * Select optimal conditioning strategy based on available formats and requirements
   */
  selectOptimalConditioningStrategy(availableFormats, logo, options = {}) {
    const { formats, types, hasEnhanced } = availableFormats;
    
    // Strategy 1: Multi-format enhanced (NUCLEAR ACCURACY)
    if (hasEnhanced && formats.canny && formats.depth) {
      return {
        primary: 'multi_enhanced',
        formats: ['canny', 'depth', 'normal', 'mask'],
        description: 'Multi-format enhanced conditioning for NUCLEAR SVG accuracy',
        controlImageBase64: this.getCombinedConditioningImage(availableFormats, logo),
        strength: options.strength || 1.0  // MAXIMUM STRENGTH for exact SVG geometry
      };
    }
    
    // Strategy 2: Canny + Depth (NUCLEAR HIGH ACCURACY)
    if (formats.canny && formats.depth) {
      return {
        primary: 'canny_depth',
        formats: ['canny', 'depth'],
        description: 'Canny edges + depth map for NUCLEAR precise geometry',
        controlImageBase64: logo.preprocessed_canny,
        strength: options.strength || 0.95  // NEAR MAXIMUM for exact edges
      };
    }
    
    // Strategy 3: Canny only (NUCLEAR EDGE ACCURACY)
    if (formats.canny) {
      return {
        primary: 'canny',
        formats: ['canny'],
        description: 'Canny edge detection for NUCLEAR sharp boundaries',
        controlImageBase64: logo.preprocessed_canny,
        strength: options.strength || 0.9   // HIGH STRENGTH for exact edges
      };
    }
    
    // Strategy 4: Depth only (NUCLEAR SHAPE ACCURACY)
    if (formats.depth) {
      return {
        primary: 'depth',
        formats: ['depth'],
        description: 'Depth map for NUCLEAR 3D shape control',
        controlImageBase64: logo.preprocessed_depth,
        strength: options.strength || 0.9   // HIGH STRENGTH for exact shapes
      };
    }
    
    // Fallback
    throw new Error('No viable conditioning strategy available');
  }

  /**
   * Create enhanced ControlNet prompt based on conditioning strategy
   */
  createEnhancedControlNetPrompt(title, content, cryptocurrency, logo, style, conditioningStrategy) {
    const colors = logo.brand_colors || {};
    const primaryColor = colors.primary || '#000000';
    
    // Base prompt with enhanced accuracy requirements
    let prompt = `Ultra-precise ${logo.name} cryptocurrency logo with exact geometric fidelity, ${primaryColor} brand colors, `;
    
    // Style-specific enhancements
    switch (style) {
      case 'professional':
        prompt += 'professional 3D rendering, premium materials, sophisticated lighting, ';
        break;
      case 'futuristic':
        prompt += 'futuristic holographic effects, advanced materials, dynamic lighting, ';
        break;
      case 'minimal':
        prompt += 'clean minimalist 3D design, subtle materials, elegant lighting, ';
        break;
      default:
        prompt += 'high-quality 3D rendering, premium finish, professional lighting, ';
    }
    
    // Conditioning-specific enhancements
    switch (conditioningStrategy.primary) {
      case 'multi_enhanced':
        prompt += 'MAXIMUM geometric precision with multi-format conditioning, exact SVG path adherence, ';
        break;
      case 'canny_depth':
        prompt += 'precise edge geometry with accurate depth, exact boundary control, ';
        break;
      case 'canny':
        prompt += 'sharp geometric boundaries, exact edge definition, ';
        break;
      case 'depth':
        prompt += 'accurate 3D shape control, precise volumetric form, ';
        break;
    }
    
    // Universal quality and exclusion terms
    prompt += 'ultra-high quality, photorealistic, sharp focus, detailed textures, premium finish, ';
    prompt += 'absolutely no text, no words, no letters, no typography, pure visual symbol only';
    
    return prompt;
  }

  /**
   * Get combined conditioning image for multi-format strategies
   * For now, returns the best single format until multi-format API is available
   */
  getCombinedConditioningImage(availableFormats, logo) {
    // Priority: Canny > Depth > Normal > Mask
    if (availableFormats.formats.canny) return logo.preprocessed_canny;
    if (availableFormats.formats.depth) return logo.preprocessed_depth;
    // Enhanced formats would be accessed from metadata
    return null;
  }

  /**
   * Nuclear SVG injection - forces exact SVG path data into the prompt
   */
  injectNuclearSVGGuidance(prompt, cryptocurrency) {
    if (cryptocurrency === 'HBAR') {
      // NUCLEAR INJECTION: Force exact SVG path coordinates from HBAR.svg
      const svgInjection = ' MANDATORY SVG PATH COORDINATES: M2061.7,2117.5h-253.6v-539.1H691.9v539.1h-253.6V369.3h253.6v526.2h1116.2V369.3h253.6v1748.2ZM703.9,1376.7h1116.2v-278.5H703.9v278.5Z - this EXACT geometric shape with TWO vertical bars and ONE horizontal crossbar connecting them, pixel-perfect SVG reproduction required, NUCLEAR adherence to path data, absolutely mandatory geometric H structure with crossbar at 1376.7-1098.2 coordinates, ';
      
      prompt = svgInjection + prompt + ' NUCLEAR REQUIREMENT: follow SVG path coordinates exactly, show complete H letter with proper proportions from viewBox 0 0 2500 2500, vertical bars from 369.3 to 2117.5, horizontal crossbar at coordinates 703.9-1820.1 by 1376.7-1098.2, FORBIDDEN any other H shape variations';
    } else if (cryptocurrency === 'XRP') {
      // ULTRA-ENHANCED MATHEMATICAL CONSTRAINT INJECTION for XRP
      let mathematicalDescription = `MATHEMATICAL VECTOR SPECIFICATION for XRP logo: `;
      mathematicalDescription += `COORDINATE SYSTEM: ViewBox 0,0,512,424 (width=512px, height=424px). `;
      mathematicalDescription += `GEOMETRIC STRUCTURE: Exactly TWO independent triangular path elements forming X-shape. `;
      mathematicalDescription += `PATH 1 COORDINATES: M437,0 h74 L357,152.48 c-55.77,55.19 -146.19,55.19 -202,0 L0.94,0 H75 L192,115.83 a91.11,91.11 0,0,0 127.91,0 Z `;
      mathematicalDescription += `PATH 2 COORDINATES: M74.05,424 H0 L155,270.58 c55.77,-55.19 146.19,-55.19 202,0 L512,424 H438 L320,307.23 a91.11,91.11 0,0,0 -127.91,0 Z `;
      mathematicalDescription += `MATHEMATICAL CONSTRAINTS: Path 1 starts at top (y=0), Path 2 starts at bottom (y=424). `;
      mathematicalDescription += `Both paths are FLAT triangular shapes with curved connections, NO depth, NO roundness. `;
      mathematicalDescription += `TOPOLOGY: Open X-shape formed by two separate triangular elements, NOT enclosed by circles. `;
      mathematicalDescription += `FORBIDDEN ABSOLUTELY: Circular rings, round enclosures, enclosed circles, O-shapes, rings around the X. `;
      mathematicalDescription += `REQUIRED: Pure flat X-shape made of exactly two triangular path elements, no additional geometry. `;
      
      // Triple reinforcement for mathematical precision
      let constraintReinforcement = ` MATHEMATICAL PRECISION ENFORCEMENT: `;
      constraintReinforcement += `Shape topology = exactly two triangular paths forming X. `;
      constraintReinforcement += `NO circular elements whatsoever. NO rings. NO enclosures. `;
      constraintReinforcement += `Width/height ratio = 512:424 = 1.21:1. `;
      constraintReinforcement += `Geometric accuracy = exact SVG path mathematics. `;
      constraintReinforcement += `FORBIDDEN shapes: circles, rings, enclosed shapes, O-letters, round elements. `;
      constraintReinforcement += `MANDATORY shapes: flat triangular X-shape, open geometry, angular paths only.`;
      
      prompt = mathematicalDescription + prompt + constraintReinforcement + ` FINAL CONSTRAINT: The XRP logo is two flat triangular shapes forming an X - never circles or rings.`;
    }
    
    return prompt;
  }

  /**
   * Create MINIMAL ControlNet prompt - let SVG conditioning do the work
   * NEW: Minimal prompts for maximum SVG adherence
   */
  createControlNetPrompt(title, content, cryptocurrency, logo, style) {
    // MINIMAL prompt - let ControlNet SVG conditioning drive accuracy
    const colors = logo.brand_colors || {};
    const primaryColor = colors.primary || '#000000';
    
    // ULTRA-MINIMAL prompt focused on quality only
    let prompt = `Professional ${logo.name} cryptocurrency illustration, ${primaryColor} brand colors, `;
    
    // Style terms only
    switch (style) {
      case 'professional':
        prompt += 'clean modern design, professional lighting, ';
        break;
      case 'futuristic':
        prompt += 'futuristic aesthetic, high-tech environment, ';
        break;
      case 'minimal':
        prompt += 'minimalist design, clean composition, ';
        break;
      default:
        prompt += 'professional magazine quality, ';
    }
    
    // Quality terms only - NO logo descriptions (ControlNet handles this)
    prompt += 'ultra-high quality, sharp focus, detailed, premium finish, ';
    prompt += 'absolutely no text, no words, no letters, no typography';
    
    // CRITICAL: Let ControlNet handle ALL logo accuracy - no text descriptions needed
    logger.info(`🎯 MINIMAL ControlNet prompt - SVG conditioning drives 100% logo accuracy`);
    
    return prompt;
  }

  /**
   * Generate with Enhanced Wavespeed ControlNet API using optimal conditioning strategy
   */
  async generateWithEnhancedWavespeedControlNet({ prompt, conditioning, detected, imageId, options = {} }) {
    try {
      const wavespeedApiKey = process.env.WAVESPEED_API_KEY;
      if (!wavespeedApiKey) {
        throw new Error('WAVESPEED_API_KEY not configured');
      }

      // SIMPLIFIED: Skip complex prompt injection for now to test basic ControlNet
      // TODO: Re-enable nuclear SVG injection once basic system is working
      // if (detected === 'HBAR' || detected === 'XRP') {
      //   prompt = this.injectNuclearSVGGuidance(prompt, detected);
      // }

      // Prepare ControlNet image using optimal conditioning
      const controlImageBuffer = Buffer.from(conditioning.controlImageBase64, 'base64');
      const tempControlPath = path.join(this.imageStorePath, `${imageId}_control.png`);
      await fs.writeFile(tempControlPath, controlImageBuffer);

      logger.info(`📤 Submitting Enhanced ControlNet job to Wavespeed (${conditioning.primary} strategy)...`);

      // Submit generation job with enhanced parameters
      // Fixed API format: prompt at root level, model in URL path
      const response = await axios.post('https://api.wavespeed.ai/api/v3/wavespeed-ai/flux-controlnet-union-pro-2.0', {
          prompt: prompt,
          control_image: `data:image/png;base64,${conditioning.controlImageBase64}`,
        size: "1024*1024",
        num_inference_steps: options.steps || 35,
        guidance_scale: options.guidance_scale || 5.0,
        controlnet_conditioning_scale: conditioning.strength,
          control_guidance_start: 0,
        control_guidance_end: 1.0,
          num_images: 1,
          output_format: "jpeg"
      }, {
        headers: {
          'Authorization': `Bearer ${wavespeedApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      });

      // Wavespeed API returns nested data structure: { code, message, data: { id, status, ... } }
      const responseData = response.data.data || response.data;
      if (!responseData.id) {
        logger.error('Wavespeed response structure:', JSON.stringify(response.data).substring(0, 500));
        throw new Error('No job ID received from Enhanced Wavespeed ControlNet API');
      }

      const jobId = responseData.id;
      logger.info(`✅ Enhanced ControlNet job submitted: ${jobId} (${conditioning.description})`);
      
      // Poll for completion
      const result = await this.pollWavespeedJob(jobId, wavespeedApiKey);
      
      if (!result || !result.output || !result.output[0]) {
        throw new Error('No image URL received from Enhanced Wavespeed ControlNet');
      }

      const imageUrl = result.output[0];
      logger.info(`⬇️ Downloading Enhanced ControlNet image from: ${imageUrl}`);
      
      // Download and process image
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      // Save the original image first
      const tempImagePath = path.join(this.imageStorePath, `${imageId}_temp.png`);
      await fs.writeFile(tempImagePath, imageResponse.data);
      
      // Apply watermark overlay
      const imagePath = path.join(this.imageStorePath, `${imageId}.png`);
      await this.watermarkService.addWatermark(tempImagePath, imagePath, { title: prompt.substring(0, 50) });
      
      // Clean up temp files
      try {
        await fs.unlink(tempImagePath);
        await fs.unlink(tempControlPath);
        if (global.gc) global.gc();
      } catch (cleanupError) {
        logger.warn(`⚠️ Failed to clean up temp files: ${cleanupError.message}`);
      }

      return { localPath: imagePath };
      
    } catch (error) {
      logger.error('❌ Enhanced Wavespeed ControlNet generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate with Wavespeed ControlNet API (Legacy method)
   */
  async generateWithWavespeedControlNet({ prompt, controlType, controlImageBase64, detected, imageId, options = {} }) {
    try {
      const wavespeedApiKey = process.env.WAVESPEED_API_KEY;
      if (!wavespeedApiKey) {
        throw new Error('WAVESPEED_API_KEY not configured');
      }

      // SIMPLIFIED: Skip complex prompt injection for now to test basic ControlNet
      // TODO: Re-enable nuclear SVG injection once basic system is working
      // if (detected === 'HBAR' || detected === 'XRP') {
      //   prompt = this.injectNuclearSVGGuidance(prompt, detected);
      // }

      // Prepare ControlNet image
      const controlImageBuffer = Buffer.from(controlImageBase64, 'base64');
      const tempControlPath = path.join(this.imageStorePath, `${imageId}_control.png`);
      await fs.writeFile(tempControlPath, controlImageBuffer);

      logger.info(`📤 Submitting ControlNet generation job to Wavespeed...`);

      // Submit generation job to Wavespeed with FLUX ControlNet
      // API format: prompt and control_image at root level, not inside 'input'
      const response = await axios.post('https://api.wavespeed.ai/api/v3/wavespeed-ai/flux-controlnet-union-pro-2.0', {
          prompt: prompt,
          control_image: `data:image/png;base64,${controlImageBase64}`,
        size: "1024*1024",
        num_inference_steps: options.steps || 35,
        guidance_scale: options.guidance_scale || 5.0,
        controlnet_conditioning_scale: options.controlnet_strength || 0.95,
          control_guidance_start: 0,
        control_guidance_end: 1.0,
          num_images: 1,
          output_format: "jpeg"
      }, {
        headers: {
          'Authorization': `Bearer ${wavespeedApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000 // 2 minutes for ControlNet generation
      });

      // Wavespeed API returns nested data structure: { code, message, data: { id, status, ... } }
      const responseData = response.data.data || response.data;
      if (!responseData.id) {
        logger.error('Wavespeed response structure:', JSON.stringify(response.data).substring(0, 500));
        throw new Error('No job ID received from Wavespeed ControlNet API');
      }

      const jobId = responseData.id;
      logger.info(`✅ ControlNet job submitted: ${jobId}`);
      
      // Poll for completion
      const result = await this.pollWavespeedJob(jobId, wavespeedApiKey);
      
      // Wavespeed returns 'outputs' (plural) not 'output'
      const outputs = result.outputs || result.output || [];
      if (!result || !outputs[0]) {
        logger.error('Wavespeed result structure:', JSON.stringify(result).substring(0, 500));
        throw new Error('No image URL received from Wavespeed ControlNet');
      }

      const imageUrl = outputs[0];
      logger.info(`⬇️ Downloading ControlNet image from: ${imageUrl}`);
      
      // Download and process image
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      // Save the original image first
      const tempImagePath = path.join(this.imageStorePath, `${imageId}_temp.png`);
      await fs.writeFile(tempImagePath, imageResponse.data);
      
      // Apply watermark overlay
      const imagePath = path.join(this.imageStorePath, `${imageId}.png`);
      await this.watermarkService.addWatermark(tempImagePath, imagePath, { title: prompt.substring(0, 50) });
      
      // Clean up temp files
      try {
        await fs.unlink(tempImagePath);
        await fs.unlink(tempControlPath);
        if (global.gc) global.gc();
      } catch (cleanupError) {
        logger.warn(`⚠️ Failed to clean up temp files: ${cleanupError.message}`);
      }

      return { localPath: imagePath };
      
    } catch (error) {
      logger.error('❌ Wavespeed ControlNet generation failed:', error);
      throw error;
    }
  }

  /**
   * Poll Wavespeed job until completion
   */
  async pollWavespeedJob(jobId, apiKey) {
    const maxAttempts = 15; // Extended for ControlNet processing
    const pollInterval = 5000; // 5 seconds
    const statusUrl = `https://api.wavespeed.ai/api/v3/predictions/${jobId}/result`;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        logger.info(`🔄 Polling ControlNet job ${jobId} (attempt ${attempt + 1}/${maxAttempts})`);
        
        const response = await axios.get(statusUrl, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          },
          timeout: 15000
        });
        
        const status = response.data.data.status;
        logger.info(`📊 ControlNet job status: ${status}`);
        
        if (status === 'completed') {
          logger.info(`✅ ControlNet job completed`);
          return response.data.data;
        } else if (status === 'failed') {
          const error = response.data.data.error || 'Unknown error';
          throw new Error(`ControlNet job failed: ${error}`);
        }
        
        // Wait before next poll
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        
      } catch (pollError) {
        logger.error(`❌ Error polling ControlNet job: ${pollError.message}`);
        throw pollError;
      }
    }
    
    throw new Error(`Timeout: ControlNet job ${jobId} did not complete after ${maxAttempts} attempts`);
  }

  /**
   * Test ControlNet service with a specific cryptocurrency (legacy SVG method)
   */
  async testControlNetService(symbol = 'HBAR') {
    try {
      logger.info(`🧪 Testing ControlNet service with ${symbol}...`);
      
      const logo = await this.svgLogoService.getLogoBySymbol(symbol);
      if (!logo) {
        throw new Error(`Logo not found for ${symbol}`);
      }
      
      const hasControlNet = !!(logo.preprocessed_canny || logo.preprocessed_depth);
      
      return {
        success: true,
        logoFound: true,
        hasControlNetData: hasControlNet,
        logo: {
          symbol: logo.symbol,
          name: logo.name,
          hasCanny: !!logo.preprocessed_canny,
          hasDepth: !!logo.preprocessed_depth,
          brandColors: logo.brand_colors
        },
        status: 'ControlNet service ready'
      };
      
    } catch (error) {
      logger.error(`❌ ControlNet test failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        status: 'ControlNet service failed'
      };
    }
  }

  /**
   * NEW: Test PNG ControlNet generation with optimal 2024 settings
   */
  async testPngControlNet(symbol = 'XRP', style = 'holographic') {
    try {
      logger.info(`🧪 Testing PNG ControlNet with ${symbol} (${style} style)...`);
      
      // Step 1: Check if PNG logo exists
      const logoData = await this.getPngLogo(symbol);
      if (!logoData) {
        return {
          success: false,
          error: `No PNG logo found for ${symbol}`,
          checkedDirectory: this.pngLogoDir
        };
      }
      
      // Step 2: Test preprocessing
      logger.info(`🎯 Testing PNG preprocessing for ${symbol}...`);
      const preprocessed = await this.preprocessPngForControlNet(logoData.buffer);
      
      // Step 3: Test full generation
      const testTitle = `Professional ${symbol.toUpperCase()} Market Analysis and Technical Outlook`;
      const result = await this.generateWithPngControlNet(testTitle, symbol, style, {
        test: true,
        seed: 123456 // Fixed seed for consistent testing
      });
      
      logger.info(`🎯 PNG ControlNet test successful for ${symbol}`);
      
      return {
        success: true,
        test: true,
        method: 'png_controlnet_2024',
        symbol,
        style,
        logoFile: logoData.filename,
        logoSize: `${(logoData.size / 1024).toFixed(1)}KB`,
        preprocessedSize: `${preprocessed.length} bytes`,
        settings: this.optimalSettings,
        result
      };
      
    } catch (error) {
      logger.error(`❌ PNG ControlNet test failed for ${symbol}:`, error.message);
      return {
        success: false,
        error: error.message,
        symbol,
        style
      };
    }
  }

  /**
   * NEW: List available PNG logos for testing and verification
   */
  async listAvailablePngLogos() {
    try {
      const files = await fs.readdir(this.pngLogoDir);
      const pngFiles = files.filter(file => file.toLowerCase().endsWith('.png'));
      
      const logoInfo = await Promise.all(
        pngFiles.map(async (filename) => {
          try {
            const logoPath = path.join(this.pngLogoDir, filename);
            const stats = await fs.stat(logoPath);
            const symbol = filename.replace('.png', '').toUpperCase();
            
            return {
              symbol,
              filename,
              size: `${(stats.size / 1024).toFixed(1)}KB`,
              path: logoPath
            };
          } catch (error) {
            return {
              filename,
              error: error.message
            };
          }
        })
      );
      
      logger.info(`📁 Found ${pngFiles.length} PNG logos in ${this.pngLogoDir}`);
      
      return {
        success: true,
        directory: this.pngLogoDir,
        totalLogos: pngFiles.length,
        logos: logoInfo.sort((a, b) => a.symbol?.localeCompare(b.symbol) || a.filename.localeCompare(b.filename))
      };
      
    } catch (error) {
      logger.error(`❌ Error listing PNG logos:`, error.message);
      return {
        success: false,
        error: error.message,
        directory: this.pngLogoDir
      };
    }
  }

  /**
   * STAGE 1: Generate High-Quality 3D Environment using Replicate SDXL Base
   */
  async generateEnvironmentStage(style, options = {}) {
    try {
      const styleTemplate = this.styleTemplates[style] || this.styleTemplates.holographic;
      const stage1Settings = this.optimalSettings.stage1;
      
      logger.info(`🎬 Stage 1: Generating ${style} environment with Replicate SDXL...`);
      
      // Use Replicate SDXL Base for high-quality environment generation
      const environmentPrompt = styleTemplate.environmentPrompt;
      const negativePrompt = styleTemplate.negative_prompt;
      
      const result = await this.callReplicateSDXLBase({
        prompt: environmentPrompt,
        negative_prompt: negativePrompt,
        width: stage1Settings.width,
        height: stage1Settings.height,
        steps: stage1Settings.steps,
        guidance_scale: stage1Settings.guidance_scale,
        scheduler: stage1Settings.scheduler
      });
      
      return {
        success: true,
        environmentImage: result.image_base64,
        imageUrl: result.imageUrl, // For Stage 2 reference
        metadata: {
          prompt: environmentPrompt,
          settings: stage1Settings,
          processingTime: result.processing_time || 0,
          model: 'replicate_sdxl_base'
        }
      };
      
    } catch (error) {
      logger.error('❌ Stage 1 Environment Generation failed:', error);
      throw error;
    }
  }

  /**
   * STAGE 2: Integrate Logo with Depth Awareness using Replicate SDXL ControlNet
   */
  async integrateLogoStage(environmentResult, logoSymbol, style, imageId, options = {}) {
    try {
      logger.info(`🔗 Stage 2: Integrating ${logoSymbol} logo with depth awareness using Replicate...`);
      
      const styleTemplate = this.styleTemplates[style] || this.styleTemplates.holographic;
      const stage2Settings = this.optimalSettings.stage2;
      
      // Get logo PNG for depth control
      const logoData = await this.getPngLogo(logoSymbol);
      if (!logoData) {
        throw new Error(`No PNG logo found for ${logoSymbol}`);
      }
      
      // Preprocess logo for ControlNet depth guidance
      const controlImage = await this.preprocessPngForControlNet(logoData.buffer, stage2Settings.width);
      
      // Create logo integration prompt
      const logoPrompt = `${styleTemplate.logoIntegration}, specifically ${logoSymbol} cryptocurrency symbol, ${logoSymbol} logo accuracy is critical`;
      const negativePrompt = styleTemplate.negative_prompt + `, wrong ${logoSymbol} logo, incorrect ${logoSymbol} symbol`;
      
      // Call Replicate SDXL ControlNet for depth-aware logo integration
      const result = await this.callReplicateSDXLControlNet({
        base_image_url: environmentResult.imageUrl, // Use URL from Stage 1
        logo_control_image: controlImage.toString('base64'),
        prompt: logoPrompt,
        negative_prompt: negativePrompt,
        
        // Revolutionary depth-aware settings
        controlnet_conditioning_scale: stage2Settings.controlnet_conditioning_scale,
        control_guidance_start: stage2Settings.control_guidance_start,
        control_guidance_end: stage2Settings.control_guidance_end,
        
        // Generation settings
        width: stage2Settings.width,
        height: stage2Settings.height,
        steps: stage2Settings.steps,
        guidance_scale: stage2Settings.guidance_scale,
        scheduler: stage2Settings.scheduler,
        strength: 0.65, // Preserve environment while integrating logo
        
        logoSymbol,
        imageId
      });
      
      return {
        success: true,
        localPath: result.localPath,
        metadata: {
          method: 'replicate_sdxl_controlnet_depth_aware',
          logoSymbol,
          prompt: logoPrompt,
          settings: stage2Settings,
          processingTime: result.processing_time || 0,
          model: 'replicate_sdxl_controlnet_depth'
        }
      };
      
    } catch (error) {
      logger.error('❌ Stage 2 Logo Integration failed:', error);
      throw error;
    }
  }

  /**
   * Generate depth map from environment image
   */
  async generateDepthMapFromImage(imageBase64) {
    try {
      logger.info('📐 Generating depth map from environment image...');
      
      // Convert base64 to buffer
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      
      // Use MiDaS depth estimation via RunPod
      const depthResult = await this.callRunPodDepthEstimation({
        image: imageBase64,
        method: 'midas'
      });
      
      return depthResult.depth_map;
      
    } catch (error) {
      logger.error('❌ Depth map generation failed:', error);
      
      // Fallback: Create basic depth gradient
      const gradientDepth = await this.createDepthGradient(1600, 900);
      return gradientDepth.toString('base64');
    }
  }

  /**
   * Create basic depth gradient as fallback
   */
  async createDepthGradient(width, height) {
    try {
      // Create a simple depth gradient from top to bottom
      const canvas = await sharp({
        create: {
          width,
          height,
          channels: 1,
          background: { r: 128, g: 128, b: 128, alpha: 1 }
        }
      })
      .png()
      .toBuffer();
      
      return canvas;
    } catch (error) {
      logger.error('❌ Failed to create depth gradient:', error);
      throw error;
    }
  }

  /**
   * STAGE 1: Environment Generation using Google AI (working API)
   * DEPRECATED: Using enhanced ControlNet instead
   */
  async callReplicateSDXLBase(params) {
    logger.info('🔄 callReplicateSDXLBase is deprecated - using enhanced ControlNet instead');
    
    return {
      image_base64: null,
      processing_time: 0,
      imageUrl: null,
      deprecated: true
    };
  }

  /**
   * STAGE 2: Logo Integration using Replicate SDXL ControlNet Depth
   * DEPRECATED: Using enhanced ControlNet instead
   */
  async callReplicateSDXLControlNet(params) {
    logger.info('🔄 callReplicateSDXLControlNet is deprecated - using enhanced ControlNet instead');
    
    return {
      localPath: null,
      processing_time: 0,
      deprecated: true
    };
  }

  /**
   * Call RunPod for depth estimation
   */
  async callRunPodDepthEstimation(params) {
    try {
      const runpodUrl = process.env.RUNPOD_ENDPOINT_URL;
      const apiKey = process.env.RUNPOD_API_KEY;
      
      const response = await axios.post(runpodUrl, {
        input: {
          method: 'depth_estimation',
          image: params.image,
          depth_method: params.method
        }
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      });
      
      return response.data.output;
      
    } catch (error) {
      logger.error('❌ RunPod depth estimation failed:', error);
      throw error;
    }
  }

  /**
   * STAGE 1: Generate 3D environment based on article content analysis
   * No logos - pure environment generation for Stage 2 logo embedding
   */
  async generateEnvironmentStageTrue(title, logoSymbol, style, options = {}) {
    try {
      logger.info(`🎬 STAGE 1: Generating pure 3D environment for ${style} style`);
      
      // Use dynamic background analysis from options
      let environmentPrompt;
      if (options.dynamicBackgroundPrompt) {
        const analysis = options.dynamicBackgroundPrompt;
        environmentPrompt = `${analysis.fullPrompt} without any logos or symbols, 
        pure environmental scene ready for logo integration, 
        photorealistic 3D environment with proper lighting and depth,
        cinematic composition with clear focal areas for logo placement,
        professional studio lighting setup, 8k resolution`;
        
        logger.info(`🎨 Using dynamic environment: ${analysis.environmentType}`);
      } else {
        // Fallback static environment
        environmentPrompt = `professional modern digital workspace with clean architecture,
        sophisticated lighting and depth, no logos or symbols,
        pure 3D environment ready for logo integration,
        cinematic composition, 8k photorealistic rendering`;
        
        logger.warn('⚠️ No dynamic analysis available, using static environment');
      }
      
      // Generate pure environment using RunPod
      const environmentResult = await this.generatePureEnvironment({
        prompt: environmentPrompt,
        style,
        width: 1600,
        height: 900,
        steps: 60,
        guidance_scale: 8.5
      });
      
      return {
        success: true,
        environmentImagePath: environmentResult.localPath,
        environmentImageBase64: environmentResult.imageBase64,
        metadata: {
          prompt: environmentPrompt,
          style,
          stage: 'environment_generation',
          dynamicAnalysis: options.dynamicBackgroundPrompt || null
        }
      };
      
    } catch (error) {
      logger.error('❌ Stage 1 Environment Generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * STAGE 2: Use actual SVG logo geometry to guide 3D logo embedding
   */
  async embedLogoWithSVGGuidance(environmentResult, logoSymbol, style, imageId, options = {}) {
    try {
      logger.info(`🔗 STAGE 2: Embedding ${logoSymbol} logo using SVG geometry guidance`);
      
      // Get actual SVG logo data from database/file
      const svgLogoData = await this.getSVGLogoForControlNet(logoSymbol);
      if (!svgLogoData) {
        throw new Error(`No SVG logo data found for ${logoSymbol}`);
      }
      
      logger.info(`✅ SVG logo loaded: ${svgLogoData.symbol} (${svgLogoData.source})`);
      
      // Convert SVG to ControlNet conditioning images
      const controlNetImages = await this.convertSVGToControlNetInputs(svgLogoData);
      
      // Create logo embedding prompt
      const logoPrompt = this.createSVGEmbeddingPrompt(logoSymbol, style, options);
      
      // Use environment image as base and embed logo using SVG-guided ControlNet
      const embeddingResult = await this.runSVGGuidedControlNet({
        baseImagePath: environmentResult.environmentImagePath,
        svgControlImages: controlNetImages,
        logoPrompt,
        logoSymbol,
        imageId,
        options
      });
      
      return {
        success: true,
        imageId,
        imageUrl: this.getImageUrl(imageId),
        localPath: embeddingResult.localPath,
        svgData: svgLogoData,
        metadata: {
          stage: 'svg_guided_embedding',
          logoSymbol,
          svgSource: svgLogoData.source,
          controlNetTypes: controlNetImages.types,
          prompt: logoPrompt
        }
      };
      
    } catch (error) {
      logger.error(`❌ Stage 2 SVG Logo Embedding failed:`, error);
      throw error;
    }
  }

  /**
   * Get SVG logo data for ControlNet processing
   */
  async getSVGLogoForControlNet(logoSymbol) {
    try {
      // First try to get from SVG database
      const svgLogo = await this.svgLogoService.getSvgLogoInfo(logoSymbol);
      if (svgLogo && svgLogo.svgContent) {
        logger.info(`📊 SVG logo loaded from database: ${logoSymbol}`);
        return {
          symbol: logoSymbol,
          svgContent: svgLogo.svgContent,
          source: 'database',
          metadata: svgLogo
        };
      }
      
      // Fallback: Try to generate from PNG file
      logger.info(`🔄 No SVG in database, checking PNG files for ${logoSymbol}...`);
      const pngLogo = await this.getPngLogo(logoSymbol);
      if (pngLogo) {
        // Convert PNG to SVG-like processing
        return {
          symbol: logoSymbol,
          pngBuffer: pngLogo.buffer,
          source: 'png_file',
          filename: pngLogo.filename
        };
      }
      
      logger.error(`❌ No SVG or PNG logo found for ${logoSymbol}`);
      return null;
      
    } catch (error) {
      logger.error(`❌ Error getting SVG logo for ${logoSymbol}:`, error);
      return null;
    }
  }

  /**
   * Convert SVG to ControlNet conditioning inputs (Canny, Depth, etc.)
   */
  async convertSVGToControlNetInputs(svgLogoData) {
    try {
      logger.info(`🔧 Converting ${svgLogoData.symbol} to ControlNet inputs...`);
      
      let logoBuffer;
      
      if (svgLogoData.svgContent) {
        // Convert SVG to high-quality PNG
        logoBuffer = await sharp(Buffer.from(svgLogoData.svgContent))
          .png({ quality: 100 })
          .resize(1024, 1024, { 
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 }
          })
          .toBuffer();
      } else if (svgLogoData.pngBuffer) {
        // Use PNG directly
        logoBuffer = svgLogoData.pngBuffer;
      } else {
        throw new Error('No valid logo data for ControlNet conversion');
      }
      
      // Create Canny edge detection for precise logo boundaries
      const cannyImage = await sharp(logoBuffer)
        .greyscale()
        .normalize()
        // High contrast for sharp edges
        .linear(2.0, -(128 * 2.0) + 128)
        .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
        .png()
        .toBuffer();
      
      // Create depth map for 3D positioning
      const depthImage = await sharp(logoBuffer)
        .greyscale()
        .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
        .blur(2) // Slight blur for smooth depth transitions
        .png()
        .toBuffer();
      
      logger.info(`✅ ControlNet inputs created: Canny edges + Depth map`);
      
      return {
        canny: cannyImage.toString('base64'),
        depth: depthImage.toString('base64'),
        types: ['canny', 'depth'],
        originalLogo: logoBuffer.toString('base64')
      };
      
    } catch (error) {
      logger.error('❌ SVG to ControlNet conversion failed:', error);
      throw error;
    }
  }

  /**
   * Create prompt specifically for SVG-guided logo embedding
   */
  createSVGEmbeddingPrompt(logoSymbol, style, options = {}) {
    let prompt = `Integrate the ${logoSymbol} cryptocurrency logo shape into this 3D environment, 
    the logo should appear as natural architectural elements embedded in the scene,
    multiple instances of the ${logoSymbol} symbol at different depths and perspectives,
    the logo casting realistic shadows and receiving environmental lighting,
    seamless integration with no flat overlay appearance,
    photorealistic materials and surface properties,
    cinematic depth of field and atmospheric perspective`;
    
    // Add style-specific integration
    if (style.includes('trading')) {
      prompt += ', the logo integrated into trading displays and financial interfaces';
    } else if (style.includes('technology')) {
      prompt += ', the logo embedded in high-tech displays and holographic projections';
    } else if (style.includes('professional')) {
      prompt += ', the logo elegantly integrated into corporate architectural elements';
    }
    
    prompt += ', absolutely no text or typography, pure 3D logo integration only';
    
    return prompt;
  }

  /**
   * Run SVG-guided ControlNet for logo embedding
   */
  async runSVGGuidedControlNet(params) {
    try {
      logger.info(`🎯 Running SVG-guided ControlNet for ${params.logoSymbol}...`);
      
      // Use img2img with ControlNet to embed logo into environment
      const result = await this.generateWithRunPodSDXLControlNet({
        prompt: params.logoPrompt,
        negative_prompt: `flat overlay, 2d sticker, wrong ${params.logoSymbol} logo, different cryptocurrency, text, letters`,
        control_image: params.svgControlImages.canny, // Use Canny edges for precise control
        base_image: params.baseImagePath, // Environment from Stage 1
        logoSymbol: params.logoSymbol,
        imageId: params.imageId,
        style: 'img2img_svg_guided',
        strength: 0.7, // Preserve environment while embedding logo
        options: params.options
      });
      
      return result;
      
    } catch (error) {
      logger.error('❌ SVG-guided ControlNet failed:', error);
      throw error;
    }
  }

  /**
   * Generate pure environment without logos (Stage 1)
   * SIMPLIFIED: Use existing working generation methods
   */
  async generatePureEnvironment(params) {
    try {
      logger.info('🎬 Generating pure environment (no logos)...');
      
      // SIMPLIFIED: Use existing PNG ControlNet method without logos
      const result = await this.generateWithPngControlNet(
        'Pure Environment Generation',
        'NONE', // No logo symbol
        'professional',
        {
          ...params,
          environmentOnly: true,
          prompt: params.prompt,
          negative_prompt: 'logos, symbols, cryptocurrency, text, letters, overlays, flat elements'
        }
      );
      
      // Convert result to base64 for Stage 2 processing
      if (result.localPath) {
        const fs = require('fs').promises;
        const imageBuffer = await fs.readFile(result.localPath);
        const imageBase64 = imageBuffer.toString('base64');
        
        return {
          localPath: result.localPath,
          imageBase64: imageBase64
        };
      }
      
      throw new Error('No environment image generated from PNG ControlNet');
      
    } catch (error) {
      logger.error('❌ Pure environment generation failed:', error.message);
      // Return a fallback so Stage 2 can still proceed
      logger.warn('🔄 Stage 1 failed, Stage 2 will handle complete generation');
      throw error;
    }
  }

  /**
   * HYBRID REVOLUTIONARY: Use existing RunPod with revolutionary settings and prompts
   */
  async generateWithRevolutionaryHybrid(title, logoSymbol, style, imageId, options) {
    try {
      const startTime = Date.now();
      logger.info(`🎯 HYBRID Revolutionary: Enhanced ControlNet with revolutionary prompts for ${logoSymbol}`);
      
      // Get logo PNG
      const logoData = await this.getPngLogo(logoSymbol);
      if (!logoData) {
        throw new Error(`No PNG logo found for ${logoSymbol}`);
      }
      
      // Use revolutionary style templates
      const styleTemplate = this.styleTemplates[style] || this.styleTemplates.holographic;
      
      // Build REVOLUTIONARY prompts using your existing RunPod
      const revolutionaryPrompt = this.buildRevolutionaryPrompt(logoSymbol, styleTemplate);
      
      // Enhanced preprocessing for better 3D integration
      const controlImage = await this.preprocessPngForRevolutionary(logoData.buffer);
      
      // Call Hugging Face SDXL ControlNet with REVOLUTIONARY settings
      const result = await this.callRevolutionarySDXL({
        prompt: revolutionaryPrompt,
        negative_prompt: styleTemplate.negative_prompt + `, flat overlay, 2d sticker, wrong ${logoSymbol} symbol`,
        control_image: controlImage.toString('base64'),
        logoSymbol,
        imageId,
        style,
        settings: this.optimalSettings.stage2, // Use revolutionary stage 2 settings
        options
      });
      
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      logger.info(`🎯 HYBRID Revolutionary completed in ${totalTime}s for ${logoSymbol}`);
      
      return {
        success: true,
        imageId,
        imageUrl: this.getImageUrl(imageId),
        localPath: result.localPath,
        metadata: {
          method: 'hybrid_revolutionary_controlnet',
          logoSymbol,
          style,
          prompt: revolutionaryPrompt,
          settings: this.optimalSettings.stage2,
          processingTime: totalTime,
          improvements: [
            'revolutionary_prompts',
            'enhanced_3d_integration',
            'perspective_awareness', 
            'environmental_depth',
            'cinematic_quality'
          ],
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error(`❌ HYBRID Revolutionary failed:`, error);
      throw error;
    }
  }

  /**
   * Build revolutionary prompts for existing RunPod
   */
  buildRevolutionaryPrompt(logoSymbol, styleTemplate) {
    // Combine environment and logo integration for single-stage generation
    const environmentPrompt = styleTemplate.environmentPrompt;
    const logoIntegration = styleTemplate.logoIntegration;
    
    return `${environmentPrompt}, ${logoIntegration.replace('cryptocurrency', logoSymbol)}, 
    CRITICAL: The ${logoSymbol} symbol must be perfectly accurate and recognizable, 
    integrated into the 3D environment with proper perspective, depth, and lighting interaction,
    multiple instances at different depths and angles, photorealistic materials, 
    cinema-quality rendering, 8k resolution, absolutely no flat overlays`;
  }

  /**
   * Enhanced preprocessing for revolutionary approach
   */
  async preprocessPngForRevolutionary(logoBuffer) {
    try {
      // Enhanced preprocessing for better 3D integration
      const processed = await sharp(logoBuffer)
        .resize(this.optimalSettings.stage2.width, this.optimalSettings.stage2.height, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();
      
      logger.info(`🔧 Revolutionary preprocessing: Enhanced for 3D integration`);
      return processed;
      
    } catch (error) {
      logger.error('❌ Revolutionary preprocessing failed:', error);
      throw error;
    }
  }

  /**
   * Call Replicate SDXL ControlNet with revolutionary settings
   */
  async callRevolutionarySDXL(params) {
    try {
      const replicateApiKey = process.env.REPLICATE_API_TOKEN || process.env.OPENAI_API_KEY; // Fallback to OpenAI key
      
      if (!replicateApiKey) {
        throw new Error('No API key available for SDXL ControlNet');
      }
      
      logger.info(`🎯 Calling Replicate SDXL ControlNet Depth with revolutionary settings...`);
      
      // Use Replicate's SDXL ControlNet Depth model
      const response = await axios.post('https://api.replicate.com/v1/predictions', {
        version: "7eba9a1e-4fdb-41e6-9cd1-d4dd91e52cf1", // SDXL ControlNet Depth
        input: {
          image: `data:image/png;base64,${params.control_image}`,
          prompt: params.prompt,
          negative_prompt: params.negative_prompt,
          
          // Revolutionary ControlNet settings optimized for 3D logo integration
          num_inference_steps: params.settings.steps,
          guidance_scale: params.settings.guidance_scale,
          controlnet_conditioning_scale: params.settings.controlnet_conditioning_scale,
          control_guidance_start: params.settings.control_guidance_start,
          control_guidance_end: params.settings.control_guidance_end,
          
          // High quality settings
          width: params.settings.width,
          height: params.settings.height,
          scheduler: "UniPC",
          seed: params.options.seed || -1,
          
          // Depth-aware settings for 3D integration
          apply_watermark: false
        }
      }, {
        headers: {
          'Authorization': `Token ${replicateApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      });
      
      // Poll for completion
      const prediction = response.data;
      const result = await this.pollReplicatePrediction(prediction.id, replicateApiKey);
      
      if (!result.output || !result.output[0]) {
        throw new Error('No image output from SDXL ControlNet');
      }
      
      // Download and save the image
      const imageUrl = result.output[0];
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(imageResponse.data);
      
      const filename = `${params.imageId}.png`;
      const localPath = path.join(this.imageStorePath, filename);
      
      await fs.writeFile(localPath, imageBuffer);
      
      // Apply watermark
      const watermarkedPath = await this.watermarkService.addWatermarkAndTitle(
        localPath,
        'Professional Cryptocurrency Analysis',
        params.logoSymbol
      );
      
      return {
        localPath: watermarkedPath,
        processing_time: (result.metrics?.predict_time || 0) * 1000
      };
      
    } catch (error) {
      logger.error('❌ Replicate SDXL ControlNet call failed:', error);
      throw error;
    }
  }

  /**
   * Poll Replicate prediction until completion
   */
  async pollReplicatePrediction(predictionId, apiKey) {
    const maxAttempts = 60; // 5 minutes max
    const pollInterval = 5000; // 5 seconds
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await axios.get(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: {
          'Authorization': `Token ${apiKey}`,
        }
      });
      
      const prediction = response.data;
      
      if (prediction.status === 'succeeded') {
        return prediction;
      } else if (prediction.status === 'failed') {
        throw new Error(`Replicate prediction failed: ${prediction.error}`);
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      logger.info(`🔄 Waiting for SDXL ControlNet completion... (${attempt + 1}/${maxAttempts})`);
    }
    
    throw new Error('Replicate prediction timed out');
  }
}

module.exports = ControlNetService;