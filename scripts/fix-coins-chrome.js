const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

async function main() {
  console.log('🎨 Regenerating with mirror chrome logo...\n');

  const oldPath = path.join(OUTPUT_DIR, '20_navy_lime_logo_coins.png');
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

  const prompt = `deep navy blue void fading to rich black, soft even cinematic lighting, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in perfect MIRROR CHROME with flawless reflective surface showing environment reflections, the logo is highly polished mirror finish metal reflecting the navy background and lime accents, thick chunky 3D shape with strong depth and beveled edges, 10-12 matte lime green (#dbff03) plastic coins floating weightlessly in the air at various heights depths and angles, coins vary dramatically in size from small distant coins to large close-up coins creating depth, each coin has the cryptocurrency logo embossed on its surface, coins are solid opaque plastic with soft matte finish showing the logo clearly, some coins very close and large with slight blur some tiny and far away, the mirror chrome logo catches and reflects light beautifully, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`;

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
  fs.writeFileSync(path.join(OUTPUT_DIR, '20_navy_chrome_lime_coins.png'), Buffer.from(img.data));
  console.log('✅ Saved: 20_navy_chrome_lime_coins.png');
}

main().catch(e => console.log(`❌ Failed: ${e.message}`));
