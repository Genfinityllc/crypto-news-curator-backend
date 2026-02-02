const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

async function main() {
  console.log('🎨 Replacing hands with glass banks...\n');

  const oldPath = path.join(OUTPUT_DIR, '02_glass_small_hands_lime.png');
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

  // Glass banks instead of hands, same style
  const prompt = `pure black void background, dramatic cinematic lighting with purple accent highlights, photorealistic 3D environment, the provided cryptocurrency logo symbol rendered in medium size frosted glass material with purple inner glow centered in the composition, translucent 3D crystal glass bank buildings reaching into the frame from the edges - classical bank architecture with columns and facades rendered entirely in clear crystal glass material matching the hands style from before, the glass banks are see-through with realistic light refractions and purple tinted reflections, 2-3 small glass bank buildings positioned around the edges of frame, lime green (#dbff03) flat rounded square pattern in the bottom left corner extending off frame, shallow depth of field, the logo crafted from premium frosted glass material with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, no hands`

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
  fs.writeFileSync(path.join(OUTPUT_DIR, '02_glass_banks_lime_pattern.png'), Buffer.from(img.data));
  console.log('✅ Saved: 02_glass_banks_lime_pattern.png');
}

main().catch(e => console.log(`❌ Failed: ${e.message}`));
