/**
 * Upload style examples via production server endpoint
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const STYLE_EXAMPLES_DIR = path.join(__dirname, '../style-examples');
const BACKEND_URL = 'https://crypto-news-curator-backend-production.up.railway.app';

async function uploadImage(filename) {
  const filepath = path.join(STYLE_EXAMPLES_DIR, filename);
  const fileBuffer = fs.readFileSync(filepath);
  const sizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);

  console.log(`📤 Uploading: ${filename} (${sizeMB}MB)`);

  try {
    // Use the logo upload endpoint which handles Supabase uploads
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: `style-examples/${filename}`,
      contentType: 'image/png'
    });
    formData.append('symbol', `style-${filename.replace('.png', '')}`);

    const response = await axios.post(`${BACKEND_URL}/api/logos/upload`, formData, {
      headers: formData.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 60000
    });

    if (response.data.success) {
      console.log(`✅ Uploaded: ${filename}`);
      return response.data.url;
    } else {
      console.error(`❌ Failed: ${filename} - ${response.data.error}`);
      return null;
    }
  } catch (e) {
    console.error(`❌ Error: ${filename} - ${e.response?.data?.error || e.message}`);
    return null;
  }
}

async function main() {
  console.log('🚀 Uploading style examples to production\n');

  const files = fs.readdirSync(STYLE_EXAMPLES_DIR)
    .filter(f => f.endsWith('.png') && !f.startsWith('.'));

  console.log(`📋 Found ${files.length} images\n`);

  let success = 0;
  const results = [];

  for (const file of files) {
    const url = await uploadImage(file);
    if (url) {
      success++;
      results.push({ file, url });
    }
    await new Promise(r => setTimeout(r, 2000)); // Rate limit
  }

  console.log(`\n✅ Done: ${success}/${files.length} uploaded`);
  if (results.length > 0) {
    console.log('\n📋 URLs:');
    results.forEach(r => console.log(`  ${r.file}: ${r.url}`));
  }
}

main().catch(console.error);
