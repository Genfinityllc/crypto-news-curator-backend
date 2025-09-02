const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { createClient } = require('@supabase/supabase-js');
const { rewriteArticle, calculateViralScore } = require('../services/aiService');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * @route GET /api/enhanced-news/viral
 * @desc Get most viral cryptocurrency news articles
 * @access Public
 */
router.get('/viral', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const minViralScore = parseInt(req.query.min_score) || 75;
    
    logger.info(`Fetching viral news with minimum score ${minViralScore}, limit ${limit}`);
    
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .gte('viral_score', minViralScore)
      .order('viral_score', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(limit);
      
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
      filters: {
        minViralScore,
        limit
      },
      message: 'Viral news articles fetched successfully'
    });
    
  } catch (error) {
    logger.error('Error fetching viral news:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch viral news articles',
      error: error.message
    });
  }
});

/**
 * @route GET /api/enhanced-news/high-readability
 * @desc Get articles with high readability scores (97+)
 * @access Public
 */
router.get('/high-readability', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const minReadabilityScore = parseInt(req.query.min_score) || 97;
    
    logger.info(`Fetching high-readability news with minimum score ${minReadabilityScore}`);
    
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .gte('readability_score', minReadabilityScore)
      .order('readability_score', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(limit);
      
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
      filters: {
        minReadabilityScore,
        limit
      },
      message: 'High-readability articles fetched successfully'
    });
    
  } catch (error) {
    logger.error('Error fetching high-readability news:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch high-readability articles',
      error: error.message
    });
  }
});

/**
 * @route POST /api/enhanced-news/:id/rewrite
 * @desc Rewrite article for originality and improved readability
 * @access Public
 */
router.post('/:id/rewrite', async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Rewriting article ${id} for originality and readability`);
    
    // Fetch the article
    const { data: article, error: fetchError } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .single();
      
    if (fetchError) {
      throw fetchError;
    }
    
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }
    
    // Rewrite the article
    const rewriteResult = await rewriteArticle(article.title, article.original_content || article.content);
    
    // Update article with rewritten content
    const { data: updatedArticle, error: updateError } = await supabase
      .from('articles')
      .update({
        content: rewriteResult.content,
        readability_score: rewriteResult.readabilityScore,
        is_original: rewriteResult.isOriginal,
        seo_optimized: rewriteResult.seoOptimized,
        google_ads_ready: rewriteResult.googleAdsReady,
        cover_image: rewriteResult.coverImage,
        rewritten_at: new Date().toISOString(),
        needs_rewrite: false
      })
      .eq('id', id)
      .select()
      .single();
      
    if (updateError) {
      throw updateError;
    }
    
    res.json({
      success: true,
      data: updatedArticle,
      rewriteMetrics: {
        originalWordCount: article.content.split(' ').length,
        newWordCount: rewriteResult.wordCount,
        readabilityScore: rewriteResult.readabilityScore,
        isOriginal: rewriteResult.isOriginal,
        seoOptimized: rewriteResult.seoOptimized,
        googleAdsReady: rewriteResult.googleAdsReady,
        coverImage: rewriteResult.coverImage,
        coverGeneration: rewriteResult.coverGeneration
      },
      message: 'Article successfully rewritten for originality and readability with AI-generated cover'
    });
    
  } catch (error) {
    logger.error(`Error rewriting article ${req.params.id}:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to rewrite article',
      error: error.message
    });
  }
});

/**
 * @route GET /api/enhanced-news/analytics
 * @desc Get analytics about viral potential and readability
 * @access Public
 */
router.get('/analytics', async (req, res) => {
  try {
    logger.info('Fetching news analytics');
    
    // Get viral score distribution
    const { data: viralAnalytics, error: viralError } = await supabase
      .from('articles')
      .select('viral_score, readability_score, is_viral, engagement_potential')
      .order('published_at', { ascending: false })
      .limit(1000);
      
    if (viralError) {
      throw viralError;
    }
    
    const analytics = {
      totalArticles: viralAnalytics.length,
      viralArticles: viralAnalytics.filter(a => a.is_viral).length,
      averageViralScore: Math.round(viralAnalytics.reduce((sum, a) => sum + (a.viral_score || 0), 0) / viralAnalytics.length),
      averageReadabilityScore: Math.round(viralAnalytics.reduce((sum, a) => sum + (a.readability_score || 0), 0) / viralAnalytics.length),
      engagementDistribution: {
        high: viralAnalytics.filter(a => a.engagement_potential === 'high').length,
        medium: viralAnalytics.filter(a => a.engagement_potential === 'medium').length,
        low: viralAnalytics.filter(a => a.engagement_potential === 'low').length
      },
      viralScoreRanges: {
        excellent: viralAnalytics.filter(a => a.viral_score >= 90).length,
        good: viralAnalytics.filter(a => a.viral_score >= 75 && a.viral_score < 90).length,
        average: viralAnalytics.filter(a => a.viral_score >= 50 && a.viral_score < 75).length,
        poor: viralAnalytics.filter(a => a.viral_score < 50).length
      },
      readabilityScoreRanges: {
        excellent: viralAnalytics.filter(a => a.readability_score >= 97).length,
        good: viralAnalytics.filter(a => a.readability_score >= 90 && a.readability_score < 97).length,
        average: viralAnalytics.filter(a => a.readability_score >= 80 && a.readability_score < 90).length,
        poor: viralAnalytics.filter(a => a.readability_score < 80).length
      }
    };
    
    res.json({
      success: true,
      data: analytics,
      message: 'News analytics fetched successfully'
    });
    
  } catch (error) {
    logger.error('Error fetching news analytics:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch news analytics',
      error: error.message
    });
  }
});

module.exports = router;