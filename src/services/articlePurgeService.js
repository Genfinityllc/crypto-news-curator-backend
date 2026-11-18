const { getSupabaseClient } = require('../config/supabase');
const logger = require('../utils/logger');
const cacheCoordinator = require('./cacheCoordinator');
const { CLIENT_NETWORK_NAMES, NOT_CLIENT_FILTER, CLIENT_RETENTION_DAYS, GENERAL_RETENTION_DAYS } = require('../data/clients');

class ArticlePurgeService {
  constructor() {
    this.PURGE_DAYS = GENERAL_RETENTION_DAYS;        // general news
    this.CLIENT_PURGE_DAYS = CLIENT_RETENTION_DAYS;  // the clients' news is kept longer
    this.MAX_ARTICLES_PER_CATEGORY = {
      'all': 500,       // general (non-client) articles
      'breaking': 200,
      'client': 750     // all client articles together
    };
  }

  getSupabase() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not available');
    }
    return supabase;
  }

  /**
   * Remove WSJ articles that might have been stored before blocking was implemented
   */
  async removeWSJArticles() {
    try {
      logger.info('🚫 Removing WSJ articles from database...');
      
      const supabase = this.getSupabase();
      const { data: wsjArticles, error: wsjError } = await supabase
        .from('articles')
        .delete()
        .or(`title.ilike.%Wall Street Journal%,title.ilike.%WSJ%,url.ilike.%wsj.com%,source.ilike.%Wall Street Journal%`)
        .select('id, title, source');
      
      if (wsjError) {
        logger.error('❌ Error removing WSJ articles:', wsjError.message);
        return 0;
      }
      
      const removedCount = wsjArticles?.length || 0;
      if (removedCount > 0) {
        logger.info(`🚫 Removed ${removedCount} WSJ articles from database`);
        wsjArticles.forEach(article => {
          logger.info(`   - "${article.title.substring(0, 60)}..." from ${article.source}`);
        });
      } else {
        logger.info('✅ No WSJ articles found in database');
      }
      
      return removedCount;
    } catch (error) {
      logger.error('❌ Error removing WSJ articles:', error.message);
      return 0;
    }
  }

  /**
   * Purge old articles (older than 4 days) and enforce limits per category
   */
  async purgeOldArticles() {
    try {
      logger.info('🗑️ Starting article purge process...');
      
      const supabase = this.getSupabase();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.PURGE_DAYS); // 4 days ago
      
      // First, remove any WSJ articles that might have been stored before blocking
      await this.removeWSJArticles();
      
      // General news older than its limit
      const { data: deletedGeneral, error: deleteError } = await supabase
        .from('articles')
        .delete()
        .lt('published_at', cutoffDate.toISOString())
        .or(NOT_CLIENT_FILTER)
        .select('id, title, network, published_at');

      if (deleteError) {
        throw deleteError;
      }

      // Client news older than its (longer) limit
      const clientCutoff = new Date(Date.now() - this.CLIENT_PURGE_DAYS * 24 * 60 * 60 * 1000);
      const { data: deletedClient, error: clientDeleteError } = await supabase
        .from('articles')
        .delete()
        .lt('published_at', clientCutoff.toISOString())
        .in('network', CLIENT_NETWORK_NAMES)
        .select('id, title, network, published_at');

      if (clientDeleteError) {
        throw clientDeleteError;
      }

      const deletedArticles = [...(deletedGeneral || []), ...(deletedClient || [])];

      const deletedCount = deletedArticles?.length || 0;
      logger.info(`🗑️ Purged ${deletedCount} articles (general older than ${this.PURGE_DAYS} days, client older than ${this.CLIENT_PURGE_DAYS} days)`);

      // Enforce category limits
      await this.enforceCategoryLimits();

      // Log current article counts
      await this.logArticleCounts();

      // Invalidate all caches after purging
      if (deletedCount > 0) {
        await cacheCoordinator.invalidateAfterArticleChange('Article purging', deletedCount);
      }

      return {
        success: true,
        purgedOld: deletedCount,
        cutoffDate: cutoffDate
      };

    } catch (error) {
      logger.error('❌ Error during article purge:', error);
      throw error;
    }
  }

  /**
   * Enforce maximum article limits per category
   */
  async enforceCategoryLimits() {
    try {
      logger.info('📊 Enforcing category limits...');
      
      const supabase = this.getSupabase();
      const limits = this.MAX_ARTICLES_PER_CATEGORY;
      
      for (const category of Object.keys(limits)) {
        const limit = limits[category];
        const only = (q) => {
          if (category === 'breaking') return q.eq('is_breaking', true).or(NOT_CLIENT_FILTER);
          if (category === 'client') return q.in('network', CLIENT_NETWORK_NAMES);
          return q.or(NOT_CLIENT_FILTER); // 'all' = general news
        };

        const { count } = await only(supabase.from('articles').select('id', { count: 'exact', head: true }));

        if (count > limit) {
          const excessCount = count - limit;
          logger.info(`⚠️ ${category}: ${count} articles (limit: ${limit}) - removing ${excessCount} oldest`);

          // A delete cannot be ordered or limited, so pick the oldest first.
          const { data: oldest, error: pickError } = await only(supabase.from('articles').select('id'))
            .order('published_at', { ascending: true })
            .limit(excessCount);

          if (pickError || !oldest || !oldest.length) {
            logger.error(`❌ Error enforcing ${category} limit:`, pickError);
            continue;
          }

          const { error: limitError } = await supabase
            .from('articles')
            .delete()
            .in('id', oldest.map(a => a.id));

          if (limitError) {
            logger.error(`❌ Error enforcing ${category} limit:`, limitError);
          } else {
            logger.info(`✅ ${category}: Enforced limit of ${limit} articles`);
          }
        }
      }

    } catch (error) {
      logger.error('❌ Error enforcing category limits:', error);
      throw error;
    }
  }

  /**
   * Log current article counts by category
   */
  async logArticleCounts() {
    try {
      const supabase = this.getSupabase();
      const counts = {};
      
      // Total articles
      const { count: totalCount } = await supabase
        .from('articles')
        .select('id', { count: 'exact' });
      counts.total = totalCount;

      // Breaking news
      const { count: breakingCount } = await supabase
        .from('articles')
        .select('id', { count: 'exact' })
        .eq('is_breaking', true);
      counts.breaking = breakingCount;

      // Client articles
      const { count: clientCount } = await supabase
        .from('articles')  
        .select('id', { count: 'exact' })
        .in('network', CLIENT_NETWORK_NAMES);
      counts.client = clientCount;

      // Individual client networks
      const clientNetworks = CLIENT_NETWORK_NAMES;
      for (const network of clientNetworks) {
        const { count } = await supabase
          .from('articles')
          .select('id', { count: 'exact' })
          .eq('network', network);
        counts[network.toLowerCase().replace(' ', '_')] = count;
      }

      logger.info('📊 Current article counts:', counts);
      return counts;

    } catch (error) {
      logger.error('❌ Error logging article counts:', error);
      return {};
    }
  }

  /**
   * Get article statistics for monitoring
   */
  async getArticleStats() {
    try {
      const supabase = this.getSupabase();
      const stats = await this.logArticleCounts();
      
      // Add age distribution
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.PURGE_DAYS);
      
      const { count: recentCount } = await supabase
        .from('articles')
        .select('id', { count: 'exact' })
        .gte('published_at', cutoffDate.toISOString());
      
      stats.recent_4_days = recentCount;
      stats.limits = this.MAX_ARTICLES_PER_CATEGORY;
      stats.purge_age_days = this.PURGE_DAYS;
      
      return stats;
    } catch (error) {
      logger.error('❌ Error getting article stats:', error);
      return {};
    }
  }
}

module.exports = new ArticlePurgeService();