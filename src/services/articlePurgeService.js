const { getSupabaseClient } = require('../config/supabase');
const logger = require('../utils/logger');
const cacheCoordinator = require('./cacheCoordinator');

class ArticlePurgeService {
  constructor() {
    this.PURGE_DAYS = 4; // 4 days as requested
    this.MAX_ARTICLES_PER_CATEGORY = {
      'all': 500,         // Max 500 articles total for "All News" as requested
      'breaking': 200,    // Breaking news limit  
      'client': 500,      // Client articles limit (100 per client × 5 clients)
      'hedera': 100,      // Individual client limits
      'xdc': 100,
      'algorand': 100,
      'constellation': 100,
      'hashpack': 100
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
      
      // Delete articles older than 4 days
      const { data: deletedArticles, error: deleteError } = await supabase
        .from('articles')
        .delete()
        .lt('published_at', cutoffDate.toISOString())
        .select('id, title, network, published_at');

      if (deleteError) {
        throw deleteError;
      }

      const deletedCount = deletedArticles?.length || 0;
      logger.info(`🗑️ Purged ${deletedCount} articles older than ${this.PURGE_DAYS} days (4 days)`);

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
        
        // Skip 'all' category for individual deletion - it's a total count, not a specific filter
        if (category === 'all') {
          continue;
        }
        
        let whereClause = {};
        
        // Set up where clause based on category
        if (category === 'breaking') {
          whereClause.is_breaking = true;
        } else if (category === 'client') {
          // Client networks
          whereClause.network = {
            in: ['Hedera', 'XDC Network', 'Algorand', 'Constellation', 'HashPack']
          };
        } else if (category !== 'all') {
          // Specific network
          const networkMap = {
            'hedera': 'Hedera',
            'xdc': 'XDC Network', 
            'algorand': 'Algorand',
            'constellation': 'Constellation',
            'hashpack': 'HashPack'
          };
          whereClause.network = networkMap[category];
        }

        // Get current count for this category
        let query = supabase.from('articles').select('id', { count: 'exact' });
        
        if (category === 'breaking') {
          query = query.eq('is_breaking', true);
        } else if (category === 'client') {
          query = query.in('network', ['Hedera', 'XDC Network', 'Algorand', 'Constellation', 'HashPack']);
        } else if (category !== 'all') {
          const networkMap = {
            'hedera': 'Hedera',
            'xdc': 'XDC Network',
            'algorand': 'Algorand', 
            'constellation': 'Constellation',
            'hashpack': 'HashPack'
          };
          query = query.eq('network', networkMap[category]);
        }

        const { count } = await query;

        if (count > limit) {
          const excessCount = count - limit;
          logger.info(`⚠️ ${category}: ${count} articles (limit: ${limit}) - removing ${excessCount} oldest`);

          // Delete oldest articles in this category
          let deleteQuery = supabase
            .from('articles')
            .delete()
            .order('published_at', { ascending: true })
            .limit(excessCount);

          if (category === 'breaking') {
            deleteQuery = deleteQuery.eq('is_breaking', true);
          } else if (category === 'client') {
            deleteQuery = deleteQuery.in('network', ['Hedera', 'XDC Network', 'Algorand', 'Constellation', 'HashPack']);
          } else if (category !== 'all') {
            const networkMap = {
              'hedera': 'Hedera',
              'xdc': 'XDC Network',
              'algorand': 'Algorand',
              'constellation': 'Constellation', 
              'hashpack': 'HashPack'
            };
            deleteQuery = deleteQuery.eq('network', networkMap[category]);
          }

          const { error: limitError } = await deleteQuery;
          
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
        .in('network', ['Hedera', 'XDC Network', 'Algorand', 'Constellation', 'HashPack']);
      counts.client = clientCount;

      // Individual client networks
      const clientNetworks = ['Hedera', 'XDC Network', 'Algorand', 'Constellation', 'HashPack'];
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