/**
 * Upload style examples to Supabase storage using REST API
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const STYLE_EXAMPLES_DIR = path.join(__dirname, '../style-examples');
const BUCKET_NAME = 'logos'; // Use existing bucket with proper permissions

// Fix URL - env has .supabase.com but API needs .supabase.co
const SUPABASE_URL = process.env.SUPABASE_URL?.replace('.supabase.com', '.supabase.co');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const STORAGE_URL = `${SUPABASE_URL}/storage/v1`;

async function createBucket() {
  try {
    console.log('📁 Creating bucket...');
    await axios.post(`${STORAGE_URL}/bucket`, {
      id: BUCKET_NAME,
      name: BUCKET_NAME,
      public: true,
      file_size_limit: 10485760
    }, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Bucket created');
  } catch (e) {
    if (e.response?.data?.message?.includes('already exists')) {
      console.log('ℹ️ Bucket already exists');
    } else {
      console.log('⚠️ Bucket creation:', e.response?.data?.message || e.message);
    }
  }
}

async function uploadFile(filename) {
  const filepath = path.join(STYLE_EXAMPLES_DIR, filename);
  const fileBuffer = fs.readFileSync(filepath);
  const sizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);

  console.log(`📤 Uploading: ${filename} (${sizeMB}MB)`);

  try {
    await axios.post(
      `${STORAGE_URL}/object/${BUCKET_NAME}/style-examples/${filename}`,
      fileBuffer,
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'image/png',
          'x-upsert': 'true'
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );
    console.log(`✅ Uploaded: ${filename}`);
    return true;
  } catch (e) {
    console.error(`❌ Failed ${filename}:`, e.response?.data?.message || e.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Uploading style examples to Supabase\n');
  console.log(`📦 Supabase URL: ${SUPABASE_URL}`);
  console.log(`📁 Source: ${STYLE_EXAMPLES_DIR}\n`);

  await createBucket();

  const files = fs.readdirSync(STYLE_EXAMPLES_DIR)
    .filter(f => f.endsWith('.png') && !f.startsWith('.'));

  console.log(`\n📋 Found ${files.length} images\n`);

  let success = 0;
  for (const file of files) {
    if (await uploadFile(file)) success++;
    await new Promise(r => setTimeout(r, 1000)); // Rate limit
  }

  console.log(`\n✅ Done: ${success}/${files.length} uploaded`);
  console.log(`\n🔗 Public URL base: ${SUPABASE_URL.replace('.supabase.com', '.supabase.co')}/storage/v1/object/public/${BUCKET_NAME}/`);
}

main().catch(console.error);
