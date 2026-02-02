const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

async function main() {
  console.log('🎨 Fixing coins - hollow logo, medium coins...\n');

  const oldPath = path.join(OUTPUT_DIR, '20_navy_floating_plastic_coins.png');
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

  // Hollow outline glass logo, medium sized coins
  const prompt = `deep navy blue void fading to black, soft even cinematic lighting with no spotlight or glow behind the logo, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in HOLLOW transparent crystal glass outline style showing just the glass edges and frame not solid filled, the logo is see-through glass tube structure with chrome edges, medium-sized matte lime green (#dbff03) plastic coins floating in the air at various heights and angles throughout the scene, the coins are a good visible size - not too small not too large, coins made of solid opaque plastic with soft matte finish floating weightlessly, clean minimal composition, the logo crafted from premium hollow glass tube material, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, no glow`

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
  fs.writeFileSync(path.join(OUTPUT_DIR, '20_navy_hollow_glass_coins.png'), Buffer.from(img.data));
  console.log('✅ Saved: 20_navy_hollow_glass_coins.png');
}

main().catch(e => console.log(`❌ Failed: ${e.message}`));
