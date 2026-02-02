const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

async function main() {
  console.log('🎨 Regenerating glass hands with black bg, bigger logo, no newspapers...\n');

  const oldPath = path.join(OUTPUT_DIR, '08_newspaper_glass_hands.png');
  if (fs.existsSync(oldPath)) {
    fs.unlinkSync(oldPath);
    console.log('🗑️ Deleted old file');
  }

  const logoResponse = await axios.get(
    `https://crypto-news-curator-backend-production.up.railway.app/api/cover-generator/logo-preview/${LOGO_SYMBOL}`,
    { responseType: 'arraybuffer', timeout: 15000 }
  );
  const base64Logo = Buffer.from(logoResponse.data).toString('base64');
  const logoUrl = `data:image/png;base64,${base64Logo}`;

  const prompt = `pure black void background with no gradient, dramatic cinematic lighting with purple accent highlights, photorealistic 3D environment, single very LARGE prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject taking up significant space in the center, the ${LOGO_SYMBOL} symbol rendered in frosted glass with purple inner glow and soft translucent edges, LARGE translucent 3D crystal glass human hands reaching dramatically into the frame from multiple edges of the image, the hands are big and prominent grabbing toward the logo, hands made of clear crystal glass with realistic finger details and light refractions, shallow depth of field with some motion blur on the hands, the logo crafted from premium frosted glass material with purple volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no newspapers, no paper, no text`

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
  fs.writeFileSync(path.join(OUTPUT_DIR, '08_glass_hands_black_void.png'), Buffer.from(img.data));
  console.log('✅ Saved: 08_glass_hands_black_void.png');
}

main().catch(e => console.log(`❌ Failed: ${e.message}`));
