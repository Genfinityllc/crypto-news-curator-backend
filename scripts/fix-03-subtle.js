const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

async function main() {
  console.log('🎨 Regenerating #03 with subtle neon and more 3D elements...\n');

  const oldPath = path.join(OUTPUT_DIR, '03_neon_bright_chrome.png');
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

  const prompt = `deep black void background with subtle ambient glow, soft cinematic lighting with gentle cyan accent on the left and soft magenta accent on the right, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in bright polished mirror chrome with strong white highlights clearly visible, the logo is well-lit and the focal point, multiple floating 3D glass cubes and rectangular prisms scattered around the logo at various depths and angles, glass geometric shapes catching subtle cyan and magenta light reflections, glossy black mirror floor with logo reflection, minimal background with just soft color washes instead of bright neon tubes, clean elegant composition with emphasis on the 3D floating elements, the glass shapes have depth and dimension, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`;

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
  fs.writeFileSync(path.join(OUTPUT_DIR, '03_subtle_neon_3d_elements.png'), Buffer.from(img.data));
  console.log('✅ Saved: 03_subtle_neon_3d_elements.png');
}

main().catch(e => console.log(`❌ Failed: ${e.message}`));
