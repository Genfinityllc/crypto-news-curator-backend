/**
 * Bulk upload all local PNG logos to Supabase Storage
 * This makes logos available on Railway after deployment
 */

const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const LOGOS_DIR = path.join(__dirname, '../uploads/png-logos');
const BUCKET = 'logos';

async function ensureBucket() {
  try {
    const { data, error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 10485760 // 10MB
    });
    if (error && !error.message.includes('already exists')) {
      console.error('Error creating bucket:', error.message);
    } else {
      console.log('✅ Bucket ready:', BUCKET);
    }
  } catch (e) {
    // Bucket likely exists
  }
}

async function uploadLogo(filePath) {
  const filename = path.basename(filePath);
  const symbol = filename.replace(/\.png$/i, '').toUpperCase();

  try {
    const buffer = await fs.readFile(filePath);

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(filename.toUpperCase().replace(/\.PNG$/i, '.png'), buffer, {
        contentType: 'image/png',
        cacheControl: '31536000',
        upsert: true
      });

    if (error) {
      console.error(`❌ ${symbol}: ${error.message}`);
      return false;
    }

    console.log(`✅ ${symbol} uploaded (${(buffer.length / 1024).toFixed(1)}KB)`);
    return true;
  } catch (e) {
    console.error(`❌ ${symbol}: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Bulk uploading logos to Supabase Storage...\n');

  await ensureBucket();

  const files = await fs.readdir(LOGOS_DIR);
  const pngFiles = files.filter(f => f.toLowerCase().endsWith('.png'));

  console.log(`📁 Found ${pngFiles.length} PNG files in ${LOGOS_DIR}\n`);

  let success = 0;
  let failed = 0;

  for (const file of pngFiles) {
    const filePath = path.join(LOGOS_DIR, file);
    const result = await uploadLogo(filePath);
    if (result) success++;
    else failed++;
  }

  console.log(`\n✅ Done! ${success} uploaded, ${failed} failed`);
}

main().catch(console.error);
