/**
 * Output Monitor Service
 * Tracks all AI-generated content for quality control
 * - Article rewrites (original vs rewritten)
 * - Generated image prompts
 * - ControlNet generation results
 * - Success/failure tracking
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class OutputMonitorService {
  constructor() {
    this.monitorPath = path.join(__dirname, '../../logs/ai-outputs');
    this.rewriteLog = path.join(this.monitorPath, 'rewrites.json');
    this.imageLog = path.join(this.monitorPath, 'images.json');
    this.summaryLog = path.join(this.monitorPath, 'summary.json');
    
    // In-memory cache for recent outputs (last 100)
    this.recentRewrites = [];
    this.recentImages = [];
    this.maxCacheSize = 100;
    
    // Statistics
    this.stats = {
      totalRewrites: 0,
      totalImages: 0,
      successfulControlNet: 0,
      failedControlNet: 0,
      fallbacksUsed: 0,
      lastUpdated: null
    };
    
    this.ensureDirectories();
    this.loadExistingLogs();
    
    logger.info('📊 Output Monitor Service initialized - tracking all AI outputs');
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.monitorPath, { recursive: true });
      logger.info(`📁 Monitor log directory ready: ${this.monitorPath}`);
    } catch (error) {
      logger.error('❌ Failed to create monitor directory:', error.message);
    }
  }

  async loadExistingLogs() {
    try {
      // Load existing rewrite log
      try {
        const rewriteData = await fs.readFile(this.rewriteLog, 'utf8');
        const parsed = JSON.parse(rewriteData);
        this.recentRewrites = parsed.slice(-this.maxCacheSize);
        this.stats.totalRewrites = parsed.length;
      } catch (e) {
        // File doesn't exist yet
        this.recentRewrites = [];
      }

      // Load existing image log
      try {
        const imageData = await fs.readFile(this.imageLog, 'utf8');
        const parsed = JSON.parse(imageData);
        this.recentImages = parsed.slice(-this.maxCacheSize);
        this.stats.totalImages = parsed.length;
        
        // Count successes and failures
        parsed.forEach(img => {
          if (img.method === 'controlnet_success') {
            this.stats.successfulControlNet++;
          } else if (img.method === 'fallback' || img.method === 'placeholder') {
            this.stats.fallbacksUsed++;
          } else if (img.success === false) {
            this.stats.failedControlNet++;
          }
        });
      } catch (e) {
        // File doesn't exist yet
        this.recentImages = [];
      }

      logger.info(`📊 Loaded ${this.recentRewrites.length} rewrites, ${this.recentImages.length} images from logs`);
    } catch (error) {
      logger.error('❌ Error loading existing logs:', error.message);
    }
  }

  /**
   * Log an article rewrite for monitoring
   */
  async logRewrite(data) {
    const entry = {
      id: `rewrite_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      articleId: data.articleId,
      
      // Original content
      original: {
        title: data.originalTitle,
        content: data.originalContent?.substring(0, 500) + '...',
        wordCount: data.originalContent?.split(/\s+/).length || 0
      },
      
      // Rewritten content
      rewritten: {
        title: data.rewrittenTitle,
        content: data.rewrittenContent?.substring(0, 500) + '...',
        wordCount: data.rewrittenContent?.split(/\s+/).length || 0
      },
      
      // Quality metrics
      metrics: {
        readabilityScore: data.readabilityScore,
        seoScore: data.seoScore,
        factChecked: data.factChecked || false,
        validationPassed: data.validationPassed || false
      },
      
      // Crypto detection
      cryptoElements: data.cryptoElements,
      
      // Generated prompt for image
      imagePrompt: data.intelligentCoverPrompt,
      
      // Processing info
      processingTimeMs: data.processingTimeMs,
      model: data.model || 'gpt-4o-mini',
      success: data.success !== false
    };

    // Add to cache
    this.recentRewrites.push(entry);
    if (this.recentRewrites.length > this.maxCacheSize) {
      this.recentRewrites.shift();
    }

    // Update stats
    this.stats.totalRewrites++;
    this.stats.lastUpdated = new Date().toISOString();

    // Persist to file
    await this.persistRewriteLog(entry);

    logger.info(`📝 MONITORED REWRITE: "${entry.rewritten.title}" (${entry.rewritten.wordCount} words, Readability: ${entry.metrics.readabilityScore}%)`);
    
    return entry;
  }

  /**
   * Log an image generation for monitoring
   */
  async logImageGeneration(data) {
    const entry = {
      id: data.imageId || `img_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      articleId: data.articleId,
      
      // Input data
      input: {
        logoSymbol: data.logoSymbol,
        articleTitle: data.articleTitle,
        prompt: data.prompt?.substring(0, 300) + '...',
        style: data.style
      },
      
      // Generation method used
      method: data.method, // 'controlnet_success', 'wavespeed', 'pollinations', 'fallback', 'placeholder'
      
      // ControlNet specific
      controlNet: {
        used: data.controlNetUsed || false,
        type: data.controlNetType, // 'canny', 'depth', 'both'
        conditioningScale: data.conditioningScale,
        logoSource: data.logoSource // 'png', 'svg'
      },
      
      // Result
      result: {
        success: data.success,
        imageUrl: data.imageUrl,
        localPath: data.localPath,
        dimensions: data.dimensions
      },
      
      // Processing info
      processingTimeMs: data.processingTimeMs,
      apiUsed: data.apiUsed, // 'wavespeed', 'huggingface', 'pollinations', 'replicate'
      
      // Error tracking
      error: data.error,
      fallbackReason: data.fallbackReason,
      
      // Quality flags
      qualityFlags: {
        is3DIntegrated: data.is3DIntegrated || false,
        isFlatOverlay: data.isFlatOverlay || false,
        hasContextualBackground: data.hasContextualBackground || false,
        logoAccurate: data.logoAccurate
      }
    };

    // Add to cache
    this.recentImages.push(entry);
    if (this.recentImages.length > this.maxCacheSize) {
      this.recentImages.shift();
    }

    // Update stats
    this.stats.totalImages++;
    if (entry.method === 'controlnet_success' && entry.result.success) {
      this.stats.successfulControlNet++;
    } else if (entry.method === 'fallback' || entry.method === 'placeholder') {
      this.stats.fallbacksUsed++;
    } else if (!entry.result.success) {
      this.stats.failedControlNet++;
    }
    this.stats.lastUpdated = new Date().toISOString();

    // Persist to file
    await this.persistImageLog(entry);

    // Log with quality indicator
    const qualityEmoji = entry.controlNet.used ? '✅' : '⚠️';
    const methodLabel = entry.method === 'fallback' ? 'FALLBACK (flat overlay)' : entry.method;
    
    logger.info(`🖼️ MONITORED IMAGE: ${qualityEmoji} ${entry.input.logoSymbol} via ${methodLabel} (${entry.processingTimeMs}ms)`);
    
    if (entry.method === 'fallback' || entry.qualityFlags.isFlatOverlay) {
      logger.warn(`⚠️ IMAGE QUALITY ISSUE: Flat overlay used instead of 3D ControlNet integration`);
      logger.warn(`   Reason: ${entry.fallbackReason || 'Unknown'}`);
    }
    
    return entry;
  }

  /**
   * Persist rewrite log to file
   */
  async persistRewriteLog(entry) {
    try {
      let existingData = [];
      try {
        const data = await fs.readFile(this.rewriteLog, 'utf8');
        existingData = JSON.parse(data);
      } catch (e) {
        // File doesn't exist
      }
      
      existingData.push(entry);
      
      // Keep last 1000 entries
      if (existingData.length > 1000) {
        existingData = existingData.slice(-1000);
      }
      
      await fs.writeFile(this.rewriteLog, JSON.stringify(existingData, null, 2));
    } catch (error) {
      logger.error('❌ Failed to persist rewrite log:', error.message);
    }
  }

  /**
   * Persist image log to file
   */
  async persistImageLog(entry) {
    try {
      let existingData = [];
      try {
        const data = await fs.readFile(this.imageLog, 'utf8');
        existingData = JSON.parse(data);
      } catch (e) {
        // File doesn't exist
      }
      
      existingData.push(entry);
      
      // Keep last 1000 entries
      if (existingData.length > 1000) {
        existingData = existingData.slice(-1000);
      }
      
      await fs.writeFile(this.imageLog, JSON.stringify(existingData, null, 2));
    } catch (error) {
      logger.error('❌ Failed to persist image log:', error.message);
    }
  }

  /**
   * Get monitoring dashboard data
   */
  getDashboard() {
    const now = new Date();
    const last24h = new Date(now - 24 * 60 * 60 * 1000);
    
    // Filter recent entries
    const rewritesLast24h = this.recentRewrites.filter(r => new Date(r.timestamp) > last24h);
    const imagesLast24h = this.recentImages.filter(i => new Date(i.timestamp) > last24h);
    
    // Calculate quality metrics
    const controlNetSuccessRate = this.stats.totalImages > 0 
      ? ((this.stats.successfulControlNet / this.stats.totalImages) * 100).toFixed(1)
      : 0;
    
    const fallbackRate = this.stats.totalImages > 0
      ? ((this.stats.fallbacksUsed / this.stats.totalImages) * 100).toFixed(1)
      : 0;
    
    // Identify problematic generations
    const flatOverlayImages = this.recentImages.filter(i => 
      i.qualityFlags?.isFlatOverlay || i.method === 'fallback' || i.method === 'placeholder'
    );

    return {
      summary: {
        totalRewrites: this.stats.totalRewrites,
        totalImages: this.stats.totalImages,
        successfulControlNet: this.stats.successfulControlNet,
        failedControlNet: this.stats.failedControlNet,
        fallbacksUsed: this.stats.fallbacksUsed,
        controlNetSuccessRate: `${controlNetSuccessRate}%`,
        fallbackRate: `${fallbackRate}%`,
        lastUpdated: this.stats.lastUpdated
      },
      
      last24Hours: {
        rewrites: rewritesLast24h.length,
        images: imagesLast24h.length
      },
      
      qualityIssues: {
        flatOverlayCount: flatOverlayImages.length,
        flatOverlayImages: flatOverlayImages.slice(-10).map(i => ({
          id: i.id,
          logoSymbol: i.input?.logoSymbol,
          method: i.method,
          reason: i.fallbackReason,
          timestamp: i.timestamp
        }))
      },
      
      recentRewrites: this.recentRewrites.slice(-10).map(r => ({
        id: r.id,
        title: r.rewritten?.title,
        wordCount: r.rewritten?.wordCount,
        readability: r.metrics?.readabilityScore,
        factChecked: r.metrics?.factChecked,
        timestamp: r.timestamp
      })),
      
      recentImages: this.recentImages.slice(-10).map(i => ({
        id: i.id,
        logoSymbol: i.input?.logoSymbol,
        method: i.method,
        controlNetUsed: i.controlNet?.used,
        is3D: i.qualityFlags?.is3DIntegrated,
        success: i.result?.success,
        timestamp: i.timestamp
      }))
    };
  }

  /**
   * Get detailed rewrite history
   */
  getRewriteHistory(limit = 50) {
    return this.recentRewrites.slice(-limit).reverse();
  }

  /**
   * Get detailed image history
   */
  getImageHistory(limit = 50) {
    return this.recentImages.slice(-limit).reverse();
  }

  /**
   * Get failed generations for debugging
   */
  getFailedGenerations() {
    return this.recentImages
      .filter(i => !i.result?.success || i.method === 'fallback' || i.method === 'placeholder')
      .slice(-20)
      .reverse();
  }

  /**
   * Clear old logs (keep last 30 days)
   */
  async cleanupOldLogs() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    try {
      // Clean rewrite log
      const rewriteData = await fs.readFile(this.rewriteLog, 'utf8');
      const rewrites = JSON.parse(rewriteData);
      const filteredRewrites = rewrites.filter(r => new Date(r.timestamp) > thirtyDaysAgo);
      await fs.writeFile(this.rewriteLog, JSON.stringify(filteredRewrites, null, 2));
      
      // Clean image log
      const imageData = await fs.readFile(this.imageLog, 'utf8');
      const images = JSON.parse(imageData);
      const filteredImages = images.filter(i => new Date(i.timestamp) > thirtyDaysAgo);
      await fs.writeFile(this.imageLog, JSON.stringify(filteredImages, null, 2));
      
      logger.info(`🧹 Cleaned up logs older than 30 days`);
    } catch (error) {
      logger.error('❌ Error cleaning up logs:', error.message);
    }
  }
}

// Singleton instance
const outputMonitor = new OutputMonitorService();

module.exports = {
  OutputMonitorService,
  outputMonitor,
  logRewrite: (data) => outputMonitor.logRewrite(data),
  logImageGeneration: (data) => outputMonitor.logImageGeneration(data),
  getDashboard: () => outputMonitor.getDashboard(),
  getRewriteHistory: (limit) => outputMonitor.getRewriteHistory(limit),
  getImageHistory: (limit) => outputMonitor.getImageHistory(limit),
  getFailedGenerations: () => outputMonitor.getFailedGenerations()
};

