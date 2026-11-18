const { getSupabaseClient } = require('../config/supabase');
const logger = require('../utils/logger');
const cacheCoordinator = require('./cacheCoordinator');
const { CLIENT_NETWORK_NAMES, NOT_CLIENT_FILTER } = require('../data/clients');

/**
 * Intelligent Article Management Service
 * Manages article limits and replacement in real-time during insertion
 */
class IntelligentArticleManager {
  constructor() {
    // General news and client news are counted apart, so a busy news day can
    // never push a client's stories out (it used to: at 500 rows the 50 oldest
    // of any kind were deleted, and a client's are usually the oldest).
    this.LIMITS = {
      'all': 500,         // general (non-client) articles
      'client': 750,      // all client articles together
      'perClient': 150,   // any one client
      'breaking': 200
    };

    this.CLIENT_NETWORKS = CLIENT_NETWORK_NAMES;
  }

  getSupabase() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not available');
    }
    return supabase;
  }

  /**
   * Intelligently insert articles with real-time limit enforcement
   * Removes oldest articles if limits would be exceeded
   */
  async insertArticlesWithLimits(articlesData) {
    try {
      const supabase = this.getSupabase();
      logger.info(`🧠 Intelligent insertion starting for ${articlesData.length} articles`);

      // First, check current counts
      const currentCounts = await this.getCurrentCounts();
      logger.info('📊 Current article counts:', currentCounts);

      // Process each article and determine if we need to make room
      const insertedArticles = [];
      
      for (const articleData of articlesData) {
        try {
          // Transform article for Supabase
          const transformedArticle = await this.transformArticleForSupabase(articleData);
          
          // Check if this article already exists (by URL)
          const { data: existingArticle } = await supabase
            .from('articles')
            .select('id, url')
            .eq('url', transformedArticle.url)
            .single();

          if (existingArticle) {
            logger.info(`⚠️ Article already exists, updating: ${transformedArticle.title?.substring(0, 50)}...`);
            // Update existing article
            const { data: updatedArticle, error } = await supabase
              .from('articles')
              .update(transformedArticle)
              .eq('id', existingArticle.id)
              .select()
              .single();
              
            if (!error && updatedArticle) {
              insertedArticles.push(updatedArticle);
            }
            continue;
          }

          // For new articles, check if we need to make room
          await this.makeRoomForNewArticle(transformedArticle);

          // Insert the new article
          const { data: newArticle, error } = await supabase
            .from('articles')
            .insert(transformedArticle)
            .select()
            .single();

          if (error) {
            logger.error(`❌ Error inserting article: ${error.message}`);
            continue;
          }

          if (newArticle) {
            insertedArticles.push(newArticle);
            logger.info(`✅ Inserted: "${newArticle.title?.substring(0, 50)}..." (${newArticle.network})`);
          }

        } catch (articleError) {
          logger.error(`❌ Error processing individual article: ${articleError.message}`);
          continue;
        }
      }

      logger.info(`🧠 Intelligent insertion completed: ${insertedArticles.length} articles processed`);
      
      // Invalidate all caches after successful article operations
      if (insertedArticles.length > 0) {
        await cacheCoordinator.invalidateAfterArticleChange('Article insertion', insertedArticles.length);
      }
      
      return insertedArticles;

    } catch (error) {
      logger.error('❌ Error in intelligent article insertion:', error);
      throw error;
    }
  }

  /**
   * Make room for a new article by removing oldest if limits would be exceeded
   */
  async makeRoomForNewArticle(articleData) {
    const supabase = this.getSupabase();
    const network = articleData.network;
    const isBreaking = articleData.is_breaking;
    const isClientNetwork = this.CLIENT_NETWORKS.includes(network);

    if (!isClientNetwork) {
      // General news: its own limit, and only general articles are removed
      const { count: generalCount } = await supabase
        .from('articles')
        .select('id', { count: 'exact', head: true })
        .or(NOT_CLIENT_FILTER);

      if (generalCount >= this.LIMITS.all) {
        logger.info(`🗑️ General articles (${generalCount}) at limit (${this.LIMITS.all}), removing oldest general articles`);
        await this.removeOldestArticles(50, { network: { notClient: true } });
      }
    } else {
      const { count: clientCount } = await supabase
        .from('articles')
        .select('id', { count: 'exact', head: true })
        .in('network', this.CLIENT_NETWORKS);

      if (clientCount >= this.LIMITS.client) {
        logger.info(`🗑️ Client articles (${clientCount}) at limit (${this.LIMITS.client}), removing oldest client articles`);
        await this.removeOldestArticles(25, { network: { in: this.CLIENT_NETWORKS } });
      }

      const { count: networkCount } = await supabase
        .from('articles')
        .select('id', { count: 'exact', head: true })
        .eq('network', network);

      if (networkCount >= this.LIMITS.perClient) {
        logger.info(`🗑️ ${network} articles (${networkCount}) at limit (${this.LIMITS.perClient}), removing oldest for this client`);
        await this.removeOldestArticles(10, { network: { eq: network } });
      }
    }

    // Check breaking news limit
    if (isBreaking) {
      const { count: breakingCount } = await supabase
        .from('articles')
        .select('id', { count: 'exact' })
        .eq('is_breaking', true);

      if (breakingCount >= this.LIMITS.breaking) {
        logger.info(`🗑️ Breaking articles (${breakingCount}) at limit (${this.LIMITS.breaking}), removing oldest breaking article`);
        await this.removeOldestArticles(1, { 
          is_breaking: { eq: true },
          network: { notClient: true } // never a client's article
        });
      }
    }
  }

  /**
   * Remove oldest articles based on filters and optional age cutoff
   */
  async removeOldestArticles(count, filters = {}, maxAgeDays = null) {
    const supabase = this.getSupabase();
    
    try {
      let query = supabase
        .from('articles')
        .select('id, title, network, published_at')
        .order('published_at', { ascending: true })
        .limit(count);

      // Apply age filter if specified (prioritize removing articles older than X days)
      if (maxAgeDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
        query = query.lt('published_at', cutoffDate.toISOString());
      }

      // Apply filters
      if (filters.network?.notClient) {
        query = query.or(NOT_CLIENT_FILTER);
      } else if (filters.network?.in) {
        query = query.in('network', filters.network.in);
      } else if (filters.network?.eq) {
        query = query.eq('network', filters.network.eq);
      }

      if (filters.is_breaking?.eq) {
        query = query.eq('is_breaking', filters.is_breaking.eq);
      }

      const { data: oldestArticles, error: selectError } = await query;

      if (selectError || !oldestArticles?.length) {
        logger.warn('No articles to remove or error selecting oldest articles');
        return;
      }

      // Delete the oldest articles
      const idsToDelete = oldestArticles.map(article => article.id);
      const { error: deleteError } = await supabase
        .from('articles')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        logger.error('Error deleting oldest articles:', deleteError);
        return;
      }

      logger.info(`🗑️ Removed ${oldestArticles.length} oldest articles to make room for new ones`);
      oldestArticles.forEach(article => {
        logger.info(`   - "${article.title?.substring(0, 50)}..." (${article.network})`);
      });

      // Invalidate caches after article deletion
      await cacheCoordinator.invalidateAfterArticleChange('Article deletion', oldestArticles.length);

    } catch (error) {
      logger.error('Error removing oldest articles:', error);
    }
  }

  /**
   * Get current article counts by category
   */
  async getCurrentCounts() {
    const supabase = this.getSupabase();
    const counts = {};

    try {
      // Total articles
      const { count: totalCount } = await supabase
        .from('articles')
        .select('id', { count: 'exact' });
      counts.total = totalCount;

      // Client articles
      const { count: clientCount } = await supabase
        .from('articles')
        .select('id', { count: 'exact' })
        .in('network', this.CLIENT_NETWORKS);
      counts.client = clientCount;

      // Breaking articles
      const { count: breakingCount } = await supabase
        .from('articles')
        .select('id', { count: 'exact' })
        .eq('is_breaking', true);
      counts.breaking = breakingCount;

      // Individual client networks
      for (const network of this.CLIENT_NETWORKS) {
        const { count } = await supabase
          .from('articles')
          .select('id', { count: 'exact' })
          .eq('network', network);
        counts[network.toLowerCase().replace(' network', '').replace(' ', '_')] = count;
      }

      return counts;
    } catch (error) {
      logger.error('Error getting current counts:', error);
      return {};
    }
  }

  /**
   * Transform article data for Supabase (simplified version)
   */
  async transformArticleForSupabase(articleData) {
    // Use the existing transformation logic from supabase.js
    const { transformArticleForSupabase } = require('../config/supabase');
    return await transformArticleForSupabase(articleData);
  }
}

module.exports = new IntelligentArticleManager();