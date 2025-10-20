const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * 🎯 PHASE 2: Logo Integration Training Service
 * Creates training samples with crypto logos integrated INTO background imagery
 * NOT as overlays - logos become part of the artistic composition
 * Based on crypto.news aesthetic with darker background variants
 */
class LogoIntegrationTrainingService {
  constructor() {
    this.trainingDir = path.join(__dirname, '../../training-data');
    this.logoDir = path.join(this.trainingDir, 'logos');
    this.integratedSamplesDir = path.join(this.trainingDir, 'integrated-samples');
    this.backgroundStylesDir = path.join(this.trainingDir, 'background-styles');
    
    // Crypto.news inspired styles for integration
    this.integrationStyles = [
      {
        name: 'crystalline_structures',
        description: 'Logos become crystalline formations in the background',
        colors: ['#0066cc', '#004499', '#0088ff', '#ffffff'],
        darkness_level: 'medium'
      },
      {
        name: 'energy_fields', 
        description: 'Logos transform into energy field patterns',
        colors: ['#00ffaa', '#0099cc', '#0066ff', '#ffffff'],
        darkness_level: 'dark'
      },
      {
        name: 'network_nodes',
        description: 'Logos become nodes in network visualization',
        colors: ['#ff6600', '#cc4400', '#ff8833', '#ffffff'],
        darkness_level: 'medium'
      },
      {
        name: 'particle_waves',
        description: 'Logos dissolve into particle wave formations',
        colors: ['#9933ff', '#6600cc', '#bb55ff', '#ffffff'],
        darkness_level: 'dark'
      },
      {
        name: 'abstract_flow',
        description: 'Logos flow as abstract geometric patterns',
        colors: ['#ff3366', '#cc0033', '#ff5577', '#ffffff'],
        darkness_level: 'medium'
      },
      {
        name: 'geometric_patterns',
        description: 'Logos integrate as geometric background elements',
        colors: ['#ffaa00', '#cc8800', '#ffcc33', '#ffffff'],
        darkness_level: 'light'
      },
      {
        name: 'dark_cyber',
        description: 'Dark cyberpunk aesthetic with logo integration',
        colors: ['#001122', '#003344', '#0066aa', '#00aaff'],
        darkness_level: 'very_dark'
      },
      {
        name: 'financial_dark',
        description: 'Dark financial theme with subtle logo presence',
        colors: ['#111111', '#222222', '#444444', '#666666'],
        darkness_level: 'very_dark'
      }
    ];
    
    // Integration techniques for logos in backgrounds
    this.integrationTechniques = [
      'logo_as_texture_pattern',
      'logo_silhouette_in_geometry', 
      'logo_morphed_into_particles',
      'logo_as_light_source',
      'logo_embedded_in_structures',
      'logo_as_shadow_forms',
      'logo_dissolved_in_gradients',
      'logo_reflected_in_surfaces'
    ];
    
    this.trainingStats = {
      samples_generated: 0,
      styles_covered: 0,
      networks_integrated: 0,
      variations_created: 0
    };
    
    logger.info('🎨 Logo Integration Training Service initialized');
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.integratedSamplesDir, { recursive: true });
      await fs.mkdir(this.backgroundStylesDir, { recursive: true });
      
      // Create style-specific directories
      for (const style of this.integrationStyles) {
        await fs.mkdir(path.join(this.integratedSamplesDir, style.name), { recursive: true });
      }
      
      logger.info('📁 Training directories ready');
    } catch (error) {
      logger.error('❌ Failed to create training directories:', error);
      throw error;
    }
  }

  /**
   * Generate training prompts for logo integration
   */
  generateIntegrationPrompts(cryptoNetwork, logoStyle, integrationStyle) {
    const style = this.integrationStyles.find(s => s.name === logoStyle);
    const basePrompt = this.getBasePromptForStyle(style);
    
    const integrationPrompts = {
      logo_as_texture_pattern: `${basePrompt}, ${cryptoNetwork} logo pattern subtly repeated as background texture, integrated seamlessly into the composition, not as overlay`,
      
      logo_silhouette_in_geometry: `${basePrompt}, ${cryptoNetwork} logo silhouette formed by geometric shapes and lines in the background, architectural integration, logo becomes part of the structure`,
      
      logo_morphed_into_particles: `${basePrompt}, ${cryptoNetwork} logo shape suggested by particle formations and energy flows, dissolved logo elements, organic integration`,
      
      logo_as_light_source: `${basePrompt}, ${cryptoNetwork} logo shape created by strategic lighting and glow effects, illuminated background patterns, logo as illumination source`,
      
      logo_embedded_in_structures: `${basePrompt}, ${cryptoNetwork} logo elements embedded within 3D structural formations, architectural logo integration, built into the environment`,
      
      logo_as_shadow_forms: `${basePrompt}, ${cryptoNetwork} logo shape created by shadows and negative space, subtle silhouette integration, logo implied through darkness`,
      
      logo_dissolved_in_gradients: `${basePrompt}, ${cryptoNetwork} logo elements dissolved into color gradients and transitions, fluid logo integration, shape suggested by color flow`,
      
      logo_reflected_in_surfaces: `${basePrompt}, ${cryptoNetwork} logo reflected and refracted through multiple surfaces, prismatic logo integration, geometric reflections`
    };
    
    return integrationPrompts[integrationStyle] || integrationPrompts.logo_as_texture_pattern;
  }

  /**
   * Get base prompt for specific style
   */
  getBasePromptForStyle(style) {
    const colorPalette = style.colors.join(', ');
    
    const basePrompts = {
      crystalline_structures: `Professional crypto news cover, crystalline digital structures, geometric formations, tech industry aesthetic, color palette: ${colorPalette}`,
      
      energy_fields: `Futuristic cryptocurrency background, energy field visualizations, flowing digital streams, modern tech aesthetic, color palette: ${colorPalette}`,
      
      network_nodes: `Network visualization background, connected nodes and pathways, blockchain-inspired design, professional tech style, color palette: ${colorPalette}`,
      
      particle_waves: `Digital particle wave formations, flowing crypto data visualization, dynamic movement, modern financial tech, color palette: ${colorPalette}`,
      
      abstract_flow: `Abstract geometric flow patterns, modern financial technology design, clean professional aesthetic, color palette: ${colorPalette}`,
      
      geometric_patterns: `Clean geometric pattern background, modern crypto industry design, professional tech aesthetic, color palette: ${colorPalette}`,
      
      dark_cyber: `Dark cyberpunk cryptocurrency atmosphere, futuristic tech background, neon accents on dark base, color palette: ${colorPalette}`,
      
      financial_dark: `Dark professional financial technology background, subtle textures, minimal modern design, color palette: ${colorPalette}`
    };
    
    return basePrompts[style.name] || basePrompts.abstract_flow;
  }

  /**
   * Create training metadata for a sample
   */
  createTrainingMetadata(cryptoNetwork, style, technique, promptUsed) {
    return {
      crypto_network: cryptoNetwork,
      integration_style: style.name,
      integration_technique: technique,
      darkness_level: style.darkness_level,
      color_palette: style.colors,
      prompt_used: promptUsed,
      training_category: 'logo_background_integration',
      generated_at: new Date().toISOString(),
      target_use: 'lora_training_crypto_covers'
    };
  }

  /**
   * Generate training samples for a specific crypto network
   */
  async generateTrainingSamplesForNetwork(cryptoNetwork, sampleCount = 8) {
    try {
      logger.info(`🎨 Generating training samples for ${cryptoNetwork} (${sampleCount} samples)`);
      
      const samples = [];
      
      for (let i = 0; i < sampleCount; i++) {
        // Rotate through styles and techniques
        const style = this.integrationStyles[i % this.integrationStyles.length];
        const technique = this.integrationTechniques[i % this.integrationTechniques.length];
        
        const prompt = this.generateIntegrationPrompts(cryptoNetwork, style.name, technique);
        const metadata = this.createTrainingMetadata(cryptoNetwork, style, technique, prompt);
        
        const sampleData = {
          id: `${cryptoNetwork}_${style.name}_${technique}_${i}`,
          prompt: prompt,
          metadata: metadata,
          output_path: path.join(this.integratedSamplesDir, style.name, `${cryptoNetwork}_sample_${i}.png`)
        };
        
        samples.push(sampleData);
        
        // Save metadata file
        const metadataPath = path.join(this.integratedSamplesDir, style.name, `${cryptoNetwork}_sample_${i}_metadata.json`);
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      }
      
      this.trainingStats.samples_generated += sampleCount;
      this.trainingStats.networks_integrated++;
      
      logger.info(`✅ Generated ${sampleCount} training samples for ${cryptoNetwork}`);
      return samples;
      
    } catch (error) {
      logger.error(`❌ Failed to generate training samples for ${cryptoNetwork}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create training dataset for all collected logos
   */
  async createCompleteTrainingDataset() {
    try {
      await this.ensureDirectories();
      
      // Get list of collected crypto networks
      const logoCollectionReport = path.join(this.logoDir, 'enhanced_collection_report.json');
      let collectedNetworks = [];
      
      try {
        const reportData = JSON.parse(await fs.readFile(logoCollectionReport, 'utf8'));
        collectedNetworks = reportData.successful_networks?.map(n => n.cryptoId) || [];
      } catch (error) {
        // Fallback to original collection
        const originalReport = path.join(this.logoDir, 'collection_report.json');
        const originalData = JSON.parse(await fs.readFile(originalReport, 'utf8'));
        collectedNetworks = originalData.summary?.cryptos?.map(c => c.name) || [];
      }
      
      if (collectedNetworks.length === 0) {
        throw new Error('No collected crypto networks found for training');
      }
      
      logger.info(`🚀 Creating training dataset for ${collectedNetworks.length} crypto networks`);
      
      const allSamples = [];
      
      for (const network of collectedNetworks) {
        const samples = await this.generateTrainingSamplesForNetwork(network, 8);
        allSamples.push(...samples);
      }
      
      // Create master training dataset file
      const datasetInfo = {
        dataset_name: 'crypto_logo_background_integration',
        created_at: new Date().toISOString(),
        networks_count: collectedNetworks.length,
        samples_count: allSamples.length,
        styles_used: this.integrationStyles,
        techniques_used: this.integrationTechniques,
        training_purpose: 'LoRA model for crypto news covers with integrated logo backgrounds',
        samples: allSamples,
        statistics: this.trainingStats
      };
      
      const datasetPath = path.join(this.integratedSamplesDir, 'training_dataset.json');
      await fs.writeFile(datasetPath, JSON.stringify(datasetInfo, null, 2));
      
      logger.info(`✅ Training dataset created: ${allSamples.length} samples for ${collectedNetworks.length} networks`);
      return datasetInfo;
      
    } catch (error) {
      logger.error('❌ Failed to create training dataset:', error);
      throw error;
    }
  }

  /**
   * Get training dataset status
   */
  async getTrainingDatasetStatus() {
    try {
      const datasetPath = path.join(this.integratedSamplesDir, 'training_dataset.json');
      const dataset = JSON.parse(await fs.readFile(datasetPath, 'utf8'));
      return dataset;
    } catch (error) {
      return {
        status: 'not_created',
        message: 'Training dataset not found',
        error: error.message
      };
    }
  }

  /**
   * Generate samples for crypto.news style analysis
   */
  async analyzeCryptoNewsStyle() {
    try {
      logger.info('🔍 Analyzing crypto.news style for reference');
      
      const cryptoNewsStyles = [
        {
          name: 'crypto_news_dark',
          description: 'Dark professional cryptocurrency news aesthetic',
          characteristics: [
            'Dark backgrounds (#1a1a1a, #2d2d2d)',
            'Blue accent colors (#0066cc, #0088ff)',
            'Clean typography overlays',
            'Subtle geometric patterns',
            'Professional financial look',
            'Logo integration via subtle patterns'
          ]
        },
        {
          name: 'crypto_news_light',
          description: 'Light variant of crypto.news style',
          characteristics: [
            'Light backgrounds (#f5f5f5, #ffffff)',
            'Dark text overlays',
            'Blue brand colors',
            'Minimal clean design',
            'Technology-focused imagery'
          ]
        }
      ];
      
      const analysisPath = path.join(this.backgroundStylesDir, 'crypto_news_style_analysis.json');
      await fs.writeFile(analysisPath, JSON.stringify(cryptoNewsStyles, null, 2));
      
      logger.info('✅ Crypto.news style analysis complete');
      return cryptoNewsStyles;
      
    } catch (error) {
      logger.error('❌ Style analysis failed:', error);
      throw error;
    }
  }
}

module.exports = LogoIntegrationTrainingService;