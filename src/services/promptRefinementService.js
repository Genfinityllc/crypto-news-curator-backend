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
   * Load preferences from disk
   */
  async loadPreferences() {
    if (this.preferences) return this.preferences;
    
    try {
      const data = await fs.readFile(this.dataPath, 'utf-8');
      this.preferences = JSON.parse(data);
      logger.info(`📊 Loaded prompt preferences: ${this.preferences.goodKeywords?.length || 0} good keywords, ${this.preferences.badKeywords?.length || 0} bad keywords`);
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
        totalRatings: 0,
        lastUpdated: new Date().toISOString()
      };
      await this.savePreferences();
    }
    
    return this.preferences;
  }

  /**
   * Save preferences to disk
   */
  async savePreferences() {
    try {
      await fs.mkdir(path.dirname(this.dataPath), { recursive: true });
      await fs.writeFile(this.dataPath, JSON.stringify(this.preferences, null, 2));
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
    
    // Add user-suggested keyword
    if (feedbackKeyword && feedbackKeyword.trim()) {
      const cleanKeyword = feedbackKeyword.trim().toLowerCase();
      if (!this.preferences.userSuggestedKeywords.includes(cleanKeyword)) {
        this.preferences.userSuggestedKeywords.push(cleanKeyword);
        logger.info(`✨ Added user-suggested keyword: "${cleanKeyword}"`);
      }
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

