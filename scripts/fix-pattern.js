const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

async function main() {
  console.log('🎨 Fixing pattern style...\n');

  const oldPath = path.join(OUTPUT_DIR, '02_chrome_pattern_both_sides.png');
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

  // Asymmetrical, no glow, varied coins, depth, no neon blue
  const prompt = `deep black void background with subtle dark gradient, soft cinematic lighting with warm neutral tones, photorealistic 3D environment, single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject angled slightly showing 3D depth and perspective, the ${LOGO_SYMBOL} symbol rendered in matte brushed metal with realistic surface texture and subtle shadows, asymmetrical composition with lime green (#dbff03) flat rounded square pattern placed only in the bottom left corner extending off frame, the pattern is solid lime squares on dark background NOT inverted, chrome coins scattered at RANDOM VARIED ANGLES throughout the scene some tilted some flat some angled differently, one or two slightly blurred coins in the foreground creating depth without covering the logo, no neon glow no blue no cyan, the logo crafted from premium matte metal with soft volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, no symmetry`

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
  fs.writeFileSync(path.join(OUTPUT_DIR, '02_asymmetric_lime_pattern.png'), Buffer.from(img.data));
  console.log('✅ Saved: 02_asymmetric_lime_pattern.png');
}

main().catch(e => console.log(`❌ Failed: ${e.message}`));
