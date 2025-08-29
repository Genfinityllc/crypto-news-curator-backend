const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ACCESS_TOKEN;

let supabase = null;

// Only create client if we have valid configuration
if (supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project') && !supabaseKey.includes('your-')) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    logger.info('Supabase client initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Supabase client:', error);
  }
} else {
  logger.warn('Supabase configuration missing - using fallback data');
}

// Test connection
async function testSupabaseConnection() {
  if (!supabase) {
    logger.warn('Supabase not configured - skipping connection test');
    return false;
  }

  try {
    const { data, error } = await supabase.from('articles').select('count', { count: 'exact', head: true });
    if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist, which is ok
      logger.error('Supabase connection test failed:', error);
      return false;
    }
    logger.info('Supabase connection established successfully');
    return true;
  } catch (error) {
    logger.error('Supabase connection error:', error);
    return false;
  }
}

module.exports = {
  supabase,
  testSupabaseConnection
};