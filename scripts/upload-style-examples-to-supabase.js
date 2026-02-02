/**
 * Upload style example images to Supabase storage
 * This allows Railway to serve them without including large files in deployment
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const STYLE_EXAMPLES_DIR = path.join(__dirname, '../style-examples');
const BUCKET_NAME = 'style-examples';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function ensureBucket() {
  console.log('📁 Ensuring bucket exists...');

  // Try to create bucket (will fail silently if exists)
  try {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 10485760 // 10MB
    });

    if (error && !error.message.includes('already exists')) {
      console.error('❌ Failed to create bucket:', error.message);
    } else {
      console.log('✅ Bucket ready:', BUCKET_NAME);
    }
  } catch (e) {
    console.log('ℹ️ Bucket may already exist');
  }
}

async function uploadImage(filename) {
  const filepath = path.join(STYLE_EXAMPLES_DIR, filename);

  if (!fs.existsSync(filepath)) {
    console.log(`⚠️ File not found: ${filename}`);
    return null;
  }

  const fileBuffer = fs.readFileSync(filepath);

  console.log(`📤 Uploading: ${filename} (${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB)`);

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filename, fileBuffer, {
      contentType: 'image/png',
      cacheControl: '31536000', // 1 year cache
      upsert: true // Overwrite if exists
    });

  if (error) {
    console.error(`❌ Failed to upload ${filename}:`, error.message);
    return null;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filename);

  console.log(`✅ Uploaded: ${filename}`);
  return urlData.publicUrl;
}

async function main() {
  console.log('🚀 Uploading style examples to Supabase storage\n');

  await ensureBucket();

  // Get all PNG files in the directory
  const files = fs.readdirSync(STYLE_EXAMPLES_DIR)
    .filter(f => f.endsWith('.png') && !f.startsWith('.'));

  console.log(`\n📋 Found ${files.length} images to upload\n`);

  const results = [];

  for (const file of files) {
    const url = await uploadImage(file);
    if (url) {
      results.push({ filename: file, url });
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n✅ Uploaded ${results.length}/${files.length} images`);
  console.log('\n📋 URLs:');
  results.forEach(r => console.log(`  ${r.filename}: ${r.url}`));

  // Output the base URL for updating the service
  if (results.length > 0) {
    const baseUrl = results[0].url.replace(results[0].filename, '');
    console.log(`\n🔗 Base URL for styleCatalogService: ${baseUrl}`);
  }
}

main().catch(console.error);
