const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

async function main() {
  console.log('🎨 Regenerating neon style with BRIGHTER logo...\n');

  // Delete existing neon files
  const filesToDelete = [
    '03_neon_bright_logo.png',
    '03_cyan_magenta_mirror_v2.png',
    '03_mirror_floor_reflection_cyan_magenta_split.png'
  ];

  for (const file of filesToDelete) {
    const oldPath = path.join(OUTPUT_DIR, file);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
      console.log(`🗑️ Deleted: ${file}`);
    }
  }

  const logoResponse = await axios.get(
    `https://crypto-news-curator-backend-production.up.railway.app/api/cover-generator/logo-preview/${LOGO_SYMBOL}`,
    { responseType: 'arraybuffer', timeout: 15000 }
  );
  const base64Logo = Buffer.from(logoResponse.data).toString('base64');
  const logoUrl = `data:image/png;base64,${base64Logo}`;

  const prompt = `dark environment with neon light accents, dramatic cinematic lighting with cyan neon on the left and magenta neon on the right, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in BRIGHT WHITE polished chrome metal that is VERY WELL-LIT and CLEARLY VISIBLE standing out against the dark background, the logo has STRONG WHITE HIGHLIGHTS and bright reflections catching the cyan and magenta neon lights, the logo glows with reflected light and is the brightest element in the scene, glossy black mirror floor with logo reflection, neon light tubes and lines in the background creating geometric patterns, the logo is the BRIGHT focal point not dark or hard to see, floating glass geometric shapes around catching neon light, front-lit logo with additional key light illuminating it, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`;

  const response = await axios.post('https://api.wavespeed.ai/api/v3/google/nano-banana-pro/edit', {
    enable_base64_output: false,
    enable_sync_mode: false,
    images: [logoUrl],
    output_format: "png",
    prompt: prompt,
    resolution: "2k",
    aspect_ratio: "16:9"
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${WAVESPEED_API_KEY}`
    },
    timeout: 120000
  });

  const requestId = response.data.data?.id || response.data.id;
  console.log(`📋 Job ID: ${requestId}`);

  let result = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(r => setTimeout(r, 2000));
    const poll = await axios.get(`https://api.wavespeed.ai/api/v3/predictions/${requestId}/result`, {
      headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` },
      timeout: 15000
    });
    if (poll.data.data?.status === 'completed') { result = poll.data.data; break; }
    if (poll.data.data?.status === 'failed') throw new Error(`Job failed: ${poll.data.data.error || 'Unknown'}`);
    if (attempt % 5 === 0) console.log(`⏳ Waiting... (${attempt * 2}s)`);
  }

  if (!result?.outputs?.[0]) throw new Error('Timeout');

  const img = await axios.get(result.outputs[0], { responseType: 'arraybuffer', timeout: 30000 });
  fs.writeFileSync(path.join(OUTPUT_DIR, '03_neon_bright_chrome.png'), Buffer.from(img.data));
  console.log('✅ Saved: 03_neon_bright_chrome.png');
}

main().catch(e => console.log(`❌ Failed: ${e.message}`));
