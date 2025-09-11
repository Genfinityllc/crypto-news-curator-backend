const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function runMigration() {
  try {
    console.log('Running migration to add viral and readability columns...');
    
    // Read the migration SQL
    const migrationSQL = fs.readFileSync('./add-viral-readability-columns.sql', 'utf8');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('SELECT'));
    
    // Run each statement
    for (const statement of statements) {
      if (statement.trim().length === 0) continue;
      
      console.log(`Executing: ${statement.substring(0, 100)}...`);
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: statement
      });
      
      if (error) {
        console.error('Error executing statement:', error);
        throw error;
      }
      
      console.log('✅ Statement executed successfully');
    }
    
    console.log('🎉 Migration completed successfully!');
    
    // Test the new columns
    console.log('Testing new columns...');
    const { data: testData, error: testError } = await supabase
      .from('articles')
      .select('id, viral_score, readability_score, is_viral, engagement_potential')
      .limit(1);
      
    if (testError) {
      console.error('Error testing columns:', testError);
    } else {
      console.log('✅ New columns working correctly');
      console.log('Sample data:', testData[0] || 'No articles found');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();