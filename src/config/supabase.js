const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');
const { generateAISummary } = require('../services/aiService');

// Load environment variables
require('dotenv').config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;

/**
 * Initialize Supabase client
 */
function initializeSupabase() {
  logger.info(`Checking Supabase config: URL=${supabaseUrl ? 'present' : 'missing'}, Key=${supabaseKey ? 'present' : 'missing'}`);
  if (!supabaseUrl || !supabaseKey) {
    logger.warn('Supabase credentials not found. Using sample data mode.');
    return null;
  }

  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    logger.info('Supabase client initialized successfully');
    return supabase;
  } catch (error) {
    logger.error('Error initializing Supabase client:', error.message);
    return null;
  }
}

/**
 * Test Supabase connection
 */
async function testSupabaseConnection() {
  try {
    if (!supabase) {
      supabase = initializeSupabase();
    }

    if (!supabase) {
      return false;
    }

    // Test connection by fetching a single row
    const { data, error } = await supabase
      .from('articles')
      .select('id')
      .limit(1);

    if (error) {
      logger.error('Supabase connection test failed:', error.message);
      return false;
    }

    logger.info('Supabase connection test successful');
    return true;
  } catch (error) {
    logger.error('Supabase connection test error:', error.message);
    return false;
  }
}

/**
 * Get Supabase client
 */
function getSupabaseClient() {
  if (!supabase) {
    supabase = initializeSupabase();
  }
  return supabase;
}

/**
 * Transform RSS article data to Supabase schema
 */
async function transformArticleForSupabase(articleData) {
  const title = articleData.title || 'Untitled';
  const content = articleData.content || articleData.summary || 'No content available';
  
  // Generate AI summary if content is available
  let aiSummary = null;
  if (content.length > 100) {
    try {
      aiSummary = await generateAISummary(title, content);
    } catch (error) {
      logger.warn('Failed to generate AI summary, using fallback:', error.message);
    }
  }
  
  return {
    title,
    content,
    summary: articleData.summary || content.substring(0, 200),
    ai_summary: aiSummary,
    url: articleData.url,
    source: articleData.source || 'Unknown',
    author: articleData.author,
    published_at: articleData.published_at || new Date().toISOString(),
    category: articleData.category || 'general',
    network: articleData.network || 'General',
    tags: articleData.tags || [],
    sentiment: articleData.sentiment || 'neutral',
    impact: articleData.impact || 'medium',
    is_breaking: articleData.is_breaking || articleData.isBreaking || false,
    is_verified: articleData.is_verified || true,
    view_count: articleData.view_count || 0,
    share_count: articleData.share_count || 0,
    metadata: articleData.metadata || {}
  };
}

/**
 * Insert article into Supabase
 */
async function insertArticle(articleData) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      logger.warn('Supabase not available, skipping article insertion');
      return null;
    }

    // Transform the data to match Supabase schema
    const transformedData = await transformArticleForSupabase(articleData);

    const { data, error } = await client
      .from('articles')
      .upsert([transformedData], {
        onConflict: 'url',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      logger.error('Error inserting article:', error.message);
      logger.error('Error code:', error.code);
      logger.error('Error details:', error.details);
      logger.error('Article data keys:', Object.keys(transformedData));
      return null;
    }

    logger.info(`Article inserted successfully: ${data[0].id}`);
    return data[0];
  } catch (error) {
    logger.error('Error inserting article:', error.message);
    return null;
  }
}

/**
 * Get articles from Supabase
 */
async function getArticles(options = {}) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      logger.warn('Supabase not available, returning sample data');
      return { data: [], count: 0 };
    }

    let query = client
      .from('articles')
      .select('*', { count: 'exact' });

    // Apply filters
    if (options.network && options.network !== 'all') {
      query = query.eq('network', options.network);
    }

    if (options.category && options.category !== 'all') {
      query = query.eq('category', options.category);
    }

    if (options.isBreaking) {
      query = query.eq('is_breaking', true);
    }

    if (options.search) {
      query = query.or(`title.ilike.%${options.search}%,content.ilike.%${options.search}%`);
    }

    // Apply sorting
    if (options.sortBy) {
      switch (options.sortBy) {
        case 'score':
          query = query.order('impact_score', { ascending: false });
          break;
        case 'date':
          query = query.order('published_at', { ascending: false });
          break;
        case 'engagement':
          query = query.order('view_count', { ascending: false });
          break;
        default:
          query = query.order('published_at', { ascending: false });
      }
    } else {
      query = query.order('published_at', { ascending: false });
    }

    // Apply pagination
    if (options.page && options.limit) {
      const from = (options.page - 1) * options.limit;
      const to = from + options.limit - 1;
      query = query.range(from, to);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('Error fetching articles:', error.message);
      return { data: [], count: 0 };
    }

    return { data: data || [], count: count || 0 };
  } catch (error) {
    logger.error('Error fetching articles:', error.message);
    return { data: [], count: 0 };
  }
}

/**
 * Get breaking news from Supabase
 */
async function getBreakingNews() {
  try {
    const client = getSupabaseClient();
    if (!client) {
      return [];
    }

    const { data, error } = await client
      .from('articles')
      .select('*')
      .eq('is_breaking', true)
      .order('published_at', { ascending: false })
      .limit(10);

    if (error) {
      logger.error('Error fetching breaking news:', error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    logger.error('Error fetching breaking news:', error.message);
    return [];
  }
}

/**
 * Get press releases from Supabase
 */
async function getPressReleases() {
  try {
    const client = getSupabaseClient();
    if (!client) {
      return [];
    }

    const { data, error } = await client
      .from('articles')
      .select('*')
      .eq('category', 'press-release')
      .order('published_at', { ascending: false })
      .limit(20);

    if (error) {
      logger.error('Error fetching press releases:', error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    logger.error('Error fetching press releases:', error.message);
    return [];
  }
}

/**
 * Update article engagement
 */
async function updateArticleEngagement(articleId, engagementType) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      return false;
    }

    const { error } = await client
      .from('articles')
      .update({
        [`${engagementType}_count`]: client.rpc('increment', { column: `${engagementType}_count` })
      })
      .eq('id', articleId);

    if (error) {
      logger.error('Error updating engagement:', error.message);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error updating engagement:', error.message);
    return false;
  }
}

/**
 * Insert multiple articles in batch
 */
async function insertArticlesBatch(articlesData) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      logger.warn('Supabase not available, skipping batch insertion');
      return [];
    }

    // Transform all articles
    const transformedArticles = await Promise.all(
      articlesData.map(articleData => transformArticleForSupabase(articleData))
    );

    const { data, error } = await client
      .from('articles')
      .upsert(transformedArticles, {
        onConflict: 'url',
        ignoreDuplicates: true
      })
      .select();

    if (error) {
      logger.error('Error batch inserting articles:', error.message);
      return [];
    }

    logger.info(`Batch inserted ${data.length} articles successfully`);
    return data;
  } catch (error) {
    logger.error('Error in batch insertion:', error.message);
    return [];
  }
}

/**
 * Update article cover image
 */
async function updateArticleCoverImage(articleId, coverImageUrl) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      logger.warn('Supabase not available, skipping cover image update');
      return null;
    }
    
    const { data, error } = await client
      .from('articles')
      .update({ 
        cover_image: coverImageUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', articleId)
      .select();
      
    if (error) {
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(`Error updating cover image for article ${articleId}:`, error.message);
    throw error;
  }
}

module.exports = {
  initializeSupabase,
  testSupabaseConnection,
  getSupabaseClient,
  insertArticle,
  insertArticlesBatch,
  getArticles,
  getBreakingNews,
  getPressReleases,
  updateArticleEngagement,
  updateArticleCoverImage
};