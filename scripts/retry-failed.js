const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

const RETRIES = [
  {
    filename: '14_blue_cyan_cinematic_dark_coins.png',
    prompt: `deep dark blue gradient void with professional cinematic depth, dramatic blue lighting with cyan highlights, photorealistic 3D environment, single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject, the ${LOGO_SYMBOL} symbol rendered in polished metal with cool blue reflections, cool cyan key light with soft rim, scattered glass coins at various angles creating depth, the logo crafted from premium materials with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  },
  {
    filename: '21_gradient_glass_dark_abstract.png',
    prompt: `dark charcoal void with subtle iridescent hints, moody dark lighting with colorful edge accents, photorealistic 3D environment, single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject, the ${LOGO_SYMBOL} symbol rendered in gradient glass shifting cyan to magenta, soft cinematic lighting with gentle refractions, floating abstract rounded geometric shapes in cyan and purple tones, the logo crafted from premium materials with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  },
  {
    filename: '23_depth_layers_purple_dark.png',
    prompt: `deep black void with rich violet accent gradients, dramatic dark lighting with vivid purple rim accents, photorealistic 3D environment, single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject, the ${LOGO_SYMBOL} symbol rendered in polished metal with layered depth lighting, atmospheric separation with soft cinematic highlights, floating abstract shapes in deep purple tones, the logo crafted from premium materials with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  }
];

async function generateImage(item) {
  console.log(`\n🎨 Retrying: ${item.filename}`);
  try {
    const logoResponse = await axios.get(
      `https://crypto-news-curator-backend-production.up.railway.app/api/cover-generator/logo-preview/${LOGO_SYMBOL}`,
      { responseType: 'arraybuffer', timeout: 15000 }
    );
    const base64Logo = Buffer.from(logoResponse.data).toString('base64');
    const logoUrl = `data:image/png;base64,${base64Logo}`;

    const response = await axios.post('https://api.wavespeed.ai/api/v3/google/nano-banana-pro/edit', {
      enable_base64_output: false, enable_sync_mode: false, images: [logoUrl],
      output_format: "png", prompt: item.prompt, resolution: "2k", aspect_ratio: "16:9"
    }, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${WAVESPEED_API_KEY}` },
      timeout: 120000
    });

    const requestId = response.data.data?.id || response.data.id;
    console.log(`   📋 Job ID: ${requestId}`);

    let result = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise(r => setTimeout(r, 2000));
      const poll = await axios.get(`https://api.wavespeed.ai/api/v3/predictions/${requestId}/result`, {
        headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` }, timeout: 15000
      });
      if (poll.data.data?.status === 'completed') { result = poll.data.data; break; }
      if (poll.data.data?.status === 'failed') throw new Error('Job failed');
      if (attempt % 5 === 0) console.log(`   ⏳ Waiting... (${attempt * 2}s)`);
    }
    if (!result?.outputs?.[0]) throw new Error('Timeout');

    const img = await axios.get(result.outputs[0], { responseType: 'arraybuffer', timeout: 30000 });
    fs.writeFileSync(path.join(OUTPUT_DIR, item.filename), Buffer.from(img.data));
    console.log(`   ✅ Saved: ${item.filename}`);
    return true;
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('🔄 Retrying 3 failed generations...\n');
  for (const item of RETRIES) {
    await generateImage(item);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\n✅ Done!');
}
main();
