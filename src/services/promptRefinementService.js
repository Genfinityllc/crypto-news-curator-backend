/**
 * Prompt Refinement Service
 * Learns from user ratings to improve prompt generation over time
 */

const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

class PromptRefinementService {
  constructor() {
    // Path to store learned preferences (persisted JSON)
    this.dataPath = path.join(__dirname, '../../data/prompt-preferences.json');
    this.preferences = null;
  }

  /**
   * Load preferences from disk - ALWAYS reads fresh for real-time feedback
   * @param {boolean} forceReload - If true, always reads from disk (default: true for real-time)
   */
  async loadPreferences(forceReload = true) {
    // ALWAYS reload from disk to get the latest feedback in real-time
    if (!forceReload && this.preferences) return this.preferences;
    
    try {
      const data = await fs.readFile(this.dataPath, 'utf-8');
      this.preferences = JSON.parse(data);
      logger.info(`📊 Loaded FRESH preferences: ${this.preferences.logoSizeIssues?.length || 0} size issues, ${this.preferences.totalRatings || 0} total ratings`);
    } catch (error) {
      // Initialize default preferences if file doesn't exist
      this.preferences = {
        goodKeywords: [],      // Keywords that led to "So Good!" or "Good" ratings
        badKeywords: [],       // Keywords that led to "Just Okay" or "Bad" ratings
        userSuggestedKeywords: [], // Keywords users added that we should incorporate
        goodMaterials: [],     // Material descriptions that work well (chrome, glass, etc.)
        badMaterials: [],      // Materials to avoid
        goodScenes: [],        // Scene descriptions that work well
        badScenes: [],         // Scenes to avoid
        logoGoodPatterns: [],  // Logo-specific patterns that work
        logoBadPatterns: [],   // Logo-specific patterns that don't work
        bgGoodPatterns: [],    // Background patterns that work
        bgBadPatterns: [],     // Background patterns that don't work
        logoSizeIssues: [],    // Size feedback: 'increase_logo_size' or 'decrease_logo_size'
        logoStyleGood: [],     // Good logo styles
        logoStyleBad: [],      // Bad logo styles
        bgStyleGood: [],       // Good background styles
        bgStyleBad: [],        // Bad background styles
        totalRatings: 0,
        lastUpdated: new Date().toISOString()
      };
      await this.savePreferences();
    }
    
    return this.preferences;
  }

  /**
   * Save preferences to disk - saves immediately for real-time feedback
   */
  async savePreferences() {
    try {
      await fs.mkdir(path.dirname(this.dataPath), { recursive: true });
      await fs.writeFile(this.dataPath, JSON.stringify(this.preferences, null, 2));
      logger.info(`💾 Preferences saved! Next generation will use updated feedback.`);
      logger.info(`   Logo size adjustments: ${JSON.stringify(this.preferences.logoSizeIssues || [])}`);
      logger.info(`   Logo style good: ${JSON.stringify(this.preferences.logoStyleGood || [])}`);
      logger.info(`   Logo style bad: ${JSON.stringify(this.preferences.logoStyleBad || [])}`);
    } catch (error) {
      logger.error('Failed to save prompt preferences:', error.message);
    }
  }

  /**
   * Process a user rating and update preferences
   */
  async processRating({ logoRating, logoSize, logoStyle, backgroundRating, backgroundStyle, feedbackKeyword, promptUsed, network }) {
    await this.loadPreferences();
    
    // Initialize new preference arrays if they don't exist
    if (!this.preferences.logoSizeIssues) this.preferences.logoSizeIssues = [];
    if (!this.preferences.logoStyleGood) this.preferences.logoStyleGood = [];
    if (!this.preferences.logoStyleBad) this.preferences.logoStyleBad = [];
    if (!this.preferences.bgStyleGood) this.preferences.bgStyleGood = [];
    if (!this.preferences.bgStyleBad) this.preferences.bgStyleBad = [];
    if (!this.preferences.ratingHistory) this.preferences.ratingHistory = [];
    
    const isLogoGood = logoRating === 'excellent' || logoRating === 'good';
    const isLogoBad = logoRating === 'okay' || logoRating === 'bad';
    const isBgGood = backgroundRating === 'excellent' || backgroundRating === 'good';
    const isBgBad = backgroundRating === 'okay' || backgroundRating === 'bad';
    
    // Extract keywords from the prompt that was used
    const promptKeywords = this.extractKeywords(promptUsed);
    
    // Process LOGO SIZE feedback
    if (logoSize) {
      if (logoSize === 'too_small') {
        this.addToList('logoSizeIssues', ['increase_logo_size']);
        logger.info('📏 Learning: Logo too small - will increase size in future prompts');
      } else if (logoSize === 'too_large') {
        this.addToList('logoSizeIssues', ['decrease_logo_size']);
        logger.info('📏 Learning: Logo too large - will decrease size in future prompts');
      } else if (logoSize === 'perfect') {
        // Clear size issues if user says it's perfect
        this.preferences.logoSizeIssues = this.preferences.logoSizeIssues.filter(
          i => i !== 'increase_logo_size' && i !== 'decrease_logo_size'
        );
        logger.info('📏 Learning: Logo size is perfect!');
      }
    }
    
    // Process LOGO STYLE feedback
    if (logoStyle) {
      if (logoStyle === 'perfect_3d' || logoStyle === 'good_detail') {
        this.addToList('logoStyleGood', [logoStyle]);
        // Extract what made it good from the prompt
        if (promptUsed) {
          const materials = this.extractMaterials(promptUsed);
          this.addToList('goodMaterials', materials);
        }
        logger.info(`✨ Learning: Logo style "${logoStyle}" works well!`);
      } else if (logoStyle === 'looks_flat' || logoStyle === 'distorted') {
        this.addToList('logoStyleBad', [logoStyle]);
        logger.info(`⚠️ Learning: Logo style issue "${logoStyle}" - will adjust prompts`);
      }
    }
    
    // Process BACKGROUND STYLE feedback
    if (backgroundStyle) {
      if (backgroundStyle === 'love_it' || backgroundStyle === 'good') {
        this.addToList('bgStyleGood', [backgroundStyle]);
        if (promptUsed) {
          const scenes = this.extractScenes(promptUsed);
          this.addToList('goodScenes', scenes);
        }
        logger.info(`🖼️ Learning: Background style "${backgroundStyle}" is working!`);
      } else if (backgroundStyle === 'generic' || backgroundStyle === 'too_busy' || backgroundStyle === 'wrong_theme') {
        this.addToList('bgStyleBad', [backgroundStyle]);
        if (promptUsed) {
          const scenes = this.extractScenes(promptUsed);
          this.addToList('badScenes', scenes);
        }
        logger.info(`⚠️ Learning: Background issue "${backgroundStyle}" - will avoid similar`);
      }
    }
    
    // Update keyword lists based on quality ratings
    if (isLogoGood && promptKeywords.length > 0) {
      this.addToList('logoGoodPatterns', promptKeywords);
    }
    if (isLogoBad && promptKeywords.length > 0) {
      this.addToList('logoBadPatterns', promptKeywords);
      this.removeFromList('logoGoodPatterns', promptKeywords);
    }
    
    if (isBgGood && promptKeywords.length > 0) {
      this.addToList('bgGoodPatterns', promptKeywords);
    }
    if (isBgBad && promptKeywords.length > 0) {
      this.addToList('bgBadPatterns', promptKeywords);
      this.removeFromList('bgGoodPatterns', promptKeywords);
    }
    
    // Process user feedback - can be keywords, phrases, or full sentences
    if (feedbackKeyword && feedbackKeyword.trim()) {
      const feedback = feedbackKeyword.trim();
      
      // Store full feedback for analysis
      if (!this.preferences.userFeedback) this.preferences.userFeedback = [];
      this.preferences.userFeedback.push({
        text: feedback,
        network,
        timestamp: new Date().toISOString(),
        ratings: { logoRating, logoSize, logoStyle, backgroundRating, backgroundStyle }
      });
      // Keep last 50 feedback entries
      if (this.preferences.userFeedback.length > 50) {
        this.preferences.userFeedback = this.preferences.userFeedback.slice(-50);
      }
      
      // Extract actionable items from feedback
      const lowerFeedback = feedback.toLowerCase();
      
      // Check for size-related feedback
      if (lowerFeedback.includes('bigger') || lowerFeedback.includes('larger') || lowerFeedback.includes('too small')) {
        this.addToList('logoSizeIssues', ['increase_logo_size']);
        logger.info('📏 Feedback indicates: Make logo BIGGER');
      }
      if (lowerFeedback.includes('smaller') || lowerFeedback.includes('too big') || lowerFeedback.includes('too large')) {
        this.addToList('logoSizeIssues', ['decrease_logo_size']);
        logger.info('📏 Feedback indicates: Make logo SMALLER');
      }
      
      // Check for style preferences
      if (lowerFeedback.includes('more 3d') || lowerFeedback.includes('more depth') || lowerFeedback.includes('not 3d enough')) {
        this.addToList('logoStyleGood', ['needs_more_3d']);
        logger.info('✨ Feedback indicates: Need MORE 3D effect');
      }
      if (lowerFeedback.includes('flat') || lowerFeedback.includes('looks 2d')) {
        this.addToList('logoStyleBad', ['too_flat']);
        logger.info('⚠️ Feedback indicates: Logo looks too FLAT');
      }
      
      // Check for background preferences
      if (lowerFeedback.includes('dark') || lowerFeedback.includes('darker')) {
        this.addToList('bgStyleGood', ['prefer_dark']);
        logger.info('🖼️ Feedback indicates: Prefer DARKER backgrounds');
      }
      if (lowerFeedback.includes('bright') || lowerFeedback.includes('lighter') || lowerFeedback.includes('too dark')) {
        this.addToList('bgStyleGood', ['prefer_bright']);
        logger.info('🖼️ Feedback indicates: Prefer BRIGHTER backgrounds');
      }
      if (lowerFeedback.includes('simple') || lowerFeedback.includes('minimal') || lowerFeedback.includes('less busy')) {
        this.addToList('bgStyleGood', ['prefer_minimal']);
        logger.info('🖼️ Feedback indicates: Prefer MINIMAL backgrounds');
      }
      if (lowerFeedback.includes('complex') || lowerFeedback.includes('more detail') || lowerFeedback.includes('too simple')) {
        this.addToList('bgStyleGood', ['prefer_complex']);
        logger.info('🖼️ Feedback indicates: Prefer MORE DETAILED backgrounds');
      }
      
      // Extract any specific scene/theme keywords for future prompts
      const sceneKeywords = ['space', 'city', 'ocean', 'mountain', 'forest', 'desert', 'tech', 'futuristic', 
        'neon', 'gold', 'silver', 'crystal', 'glass', 'metal', 'liquid', 'fire', 'ice', 'water',
        'sunset', 'sunrise', 'night', 'day', 'abstract', 'minimal', 'corporate', 'cyber'];
      
      for (const keyword of sceneKeywords) {
        if (lowerFeedback.includes(keyword)) {
          if (!this.preferences.userSuggestedKeywords.includes(keyword)) {
            this.preferences.userSuggestedKeywords.push(keyword);
            logger.info(`✨ Extracted keyword from feedback: "${keyword}"`);
          }
        }
      }
      
      logger.info(`📝 Full user feedback stored: "${feedback.substring(0, 100)}${feedback.length > 100 ? '...' : ''}"`);
    }
    
    // Extract and categorize prompt elements for overall quality
    if (promptUsed) {
      const materials = this.extractMaterials(promptUsed);
      const scenes = this.extractScenes(promptUsed);
      
      if (isLogoGood || isBgGood) {
        this.addToList('goodMaterials', materials);
        this.addToList('goodScenes', scenes);
        this.addToList('goodKeywords', promptKeywords);
      }
      
      if (isLogoBad || isBgBad) {
        this.addToList('badMaterials', materials);
        this.addToList('badScenes', scenes);
        this.addToList('badKeywords', promptKeywords);
        // Remove from good lists
        this.removeFromList('goodMaterials', materials);
        this.removeFromList('goodScenes', scenes);
        this.removeFromList('goodKeywords', promptKeywords);
      }
    }
    
    // Store rating history for analysis (keep last 100)
    this.preferences.ratingHistory.push({
      timestamp: new Date().toISOString(),
      network,
      logoRating, logoSize, logoStyle,
      backgroundRating, backgroundStyle,
      feedbackKeyword,
      promptSample: promptUsed?.substring(0, 200)
    });
    if (this.preferences.ratingHistory.length > 100) {
      this.preferences.ratingHistory = this.preferences.ratingHistory.slice(-100);
    }
    
    this.preferences.totalRatings++;
    this.preferences.lastUpdated = new Date().toISOString();
    
    await this.savePreferences();
    
    logger.info(`📊 Processed rating #${this.preferences.totalRatings} for ${network}`);
    logger.info(`   Good patterns: ${this.preferences.logoGoodPatterns?.length || 0} logo, ${this.preferences.bgGoodPatterns?.length || 0} bg`);
    logger.info(`   Bad patterns: ${this.preferences.logoBadPatterns?.length || 0} logo, ${this.preferences.bgBadPatterns?.length || 0} bg`);
    logger.info(`   User keywords: ${this.preferences.userSuggestedKeywords?.length || 0}`);
  }

  /**
   * Extract keywords from a prompt
   */
  extractKeywords(prompt) {
    if (!prompt) return [];
    
    const keywords = [];
    const lowerPrompt = prompt.toLowerCase();
    
    // Material keywords
    const materialMatches = lowerPrompt.match(/\b(chrome|glass|metallic|liquid|crystal|neon|holographic|reflective|glossy|matte|frosted|iridescent|translucent|transparent|shimmering)\b/g);
    if (materialMatches) keywords.push(...materialMatches);
    
    // Scene keywords  
    const sceneMatches = lowerPrompt.match(/\b(space|futuristic|cyberpunk|city|mountain|ocean|sky|abstract|minimal|dark|dramatic|studio|vault|trading|corporate|tech)\b/g);
    if (sceneMatches) keywords.push(...sceneMatches);
    
    // Lighting keywords
    const lightingMatches = lowerPrompt.match(/\b(neon|ambient|dramatic|soft|harsh|spotlight|backlit|rim light|volumetric|cinematic)\b/g);
    if (lightingMatches) keywords.push(...lightingMatches);
    
    return [...new Set(keywords)]; // Dedupe
  }

  /**
   * Extract material descriptions from prompt
   */
  extractMaterials(prompt) {
    if (!prompt) return [];
    
    const materials = [];
    const patterns = [
      /filled with (\w+)/gi,
      /made of (\w+)/gi,
      /(\w+) surface/gi,
      /(\w+) texture/gi,
      /3D (\w+)/gi
    ];
    
    for (const pattern of patterns) {
      const matches = prompt.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) materials.push(match[1].toLowerCase());
      }
    }
    
    return [...new Set(materials)];
  }

  /**
   * Extract scene descriptions from prompt
   */
  extractScenes(prompt) {
    if (!prompt) return [];
    
    const scenes = [];
    const patterns = [
      /hovering above ([\w\s]+)/gi,
      /on a ([\w\s]+) surface/gi,
      /in a ([\w\s]+) environment/gi,
      /([\w\s]+) background/gi
    ];
    
    for (const pattern of patterns) {
      const matches = prompt.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) scenes.push(match[1].toLowerCase().trim());
      }
    }
    
    return [...new Set(scenes)];
  }

  /**
   * Add items to a list without duplicates
   */
  addToList(listName, items) {
    if (!this.preferences[listName]) this.preferences[listName] = [];
    
    for (const item of items) {
      if (!this.preferences[listName].includes(item)) {
        this.preferences[listName].push(item);
      }
    }
    
    // Keep lists manageable (max 50 items, prioritize recent)
    if (this.preferences[listName].length > 50) {
      this.preferences[listName] = this.preferences[listName].slice(-50);
    }
  }

  /**
   * Remove items from a list
   */
  removeFromList(listName, items) {
    if (!this.preferences[listName]) return;
    
    this.preferences[listName] = this.preferences[listName].filter(
      item => !items.includes(item)
    );
  }

  /**
   * Get refined prompt elements based on learned preferences
   */
  async getRefinedElements() {
    await this.loadPreferences();
    
    return {
      // Preferred elements (from good ratings)
      preferredMaterials: this.preferences.goodMaterials || [],
      preferredScenes: this.preferences.goodScenes || [],
      preferredKeywords: this.preferences.goodKeywords || [],
      
      // Elements to avoid (from bad ratings)
      avoidMaterials: this.preferences.badMaterials || [],
      avoidScenes: this.preferences.badScenes || [],
      avoidKeywords: this.preferences.badKeywords || [],
      
      // User-suggested keywords to incorporate
      userKeywords: this.preferences.userSuggestedKeywords || [],
      
      // Logo-specific patterns
      logoGoodPatterns: this.preferences.logoGoodPatterns || [],
      logoBadPatterns: this.preferences.logoBadPatterns || [],
      
      // Background-specific patterns
      bgGoodPatterns: this.preferences.bgGoodPatterns || [],
      bgBadPatterns: this.preferences.bgBadPatterns || []
    };
  }

  /**
   * Get a random user-suggested keyword to incorporate
   */
  async getRandomUserKeyword() {
    await this.loadPreferences();
    
    const keywords = this.preferences.userSuggestedKeywords || [];
    if (keywords.length === 0) return null;
    
    return keywords[Math.floor(Math.random() * keywords.length)];
  }

  /**
   * Check if a material/scene should be avoided
   */
  async shouldAvoid(element) {
    await this.loadPreferences();
    
    const allBad = [
      ...(this.preferences.badMaterials || []),
      ...(this.preferences.badScenes || []),
      ...(this.preferences.badKeywords || [])
    ];
    
    return allBad.includes(element.toLowerCase());
  }

  /**
   * Get statistics for debugging/admin
   */
  async getStats() {
    await this.loadPreferences();
    
    return {
      totalRatings: this.preferences.totalRatings || 0,
      lastUpdated: this.preferences.lastUpdated,
      goodKeywordsCount: this.preferences.goodKeywords?.length || 0,
      badKeywordsCount: this.preferences.badKeywords?.length || 0,
      userSuggestedCount: this.preferences.userSuggestedKeywords?.length || 0,
      topGoodKeywords: (this.preferences.goodKeywords || []).slice(-10),
      topBadKeywords: (this.preferences.badKeywords || []).slice(-10),
      userSuggestedKeywords: this.preferences.userSuggestedKeywords || []
    };
  }
}

module.exports = PromptRefinementService;

