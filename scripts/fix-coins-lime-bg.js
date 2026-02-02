const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

const GENERATIONS = [
  {
    // Plastic coins - no glow, smaller, floating
    oldFile: '20_navy_lime_plastic_coins.png',
    newFile: '20_navy_floating_plastic_coins.png',
    prompt: `deep navy blue void fading to black, soft even lighting with NO glow or spotlight behind the logo, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in crystal glass with silver chrome core, scattered SMALL matte lime green (#dbff03) plastic coins FLOATING in the air at various heights and angles throughout the scene, the coins are small compared to the logo and suspended in space not sitting on any surface, coins made of solid opaque plastic with soft matte finish, clean minimal composition, the logo crafted from premium materials with soft volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, no glow behind logo, no spotlight`
  },
  {
    // Lime background version like the purple one
    oldFile: '05b_holographic_lime_black.png',
    newFile: '05b_lime_background_glass.png',
    prompt: `bright lime green (#dbff03) gradient background similar to a soft studio backdrop, the entire background is lime green colored, soft dreamy lighting with subtle bokeh, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in crystal clear holographic glass with rainbow refractions, floating glass shapes and curved glass elements around the scene, subtle glass surfaces creating depth, the logo and all elements are transparent crystal glass catching light against the lime green backdrop, soft lens flare and bokeh effects, the logo crafted from premium holographic glass material, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, lime green background`
  }
];

async function generateImage(item) {
  console.log(`\n🎨 Generating: ${item.newFile}`);

  try {
    if (item.oldFile) {
      const oldPath = path.join(OUTPUT_DIR, item.oldFile);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
        console.log(`   🗑️ Deleted: ${item.oldFile}`);
      }
    }

    const logoResponse = await axios.get(
      `https://crypto-news-curator-backend-production.up.railway.app/api/cover-generator/logo-preview/${LOGO_SYMBOL}`,
      { responseType: 'arraybuffer', timeout: 15000 }
    );
    const base64Logo = Buffer.from(logoResponse.data).toString('base64');
    const logoUrl = `data:image/png;base64,${base64Logo}`;

    const response = await axios.post('https://api.wavespeed.ai/api/v3/google/nano-banana-pro/edit', {
      enable_base64_output: false,
      enable_sync_mode: false,
      images: [logoUrl],
      output_format: "png",
      prompt: item.prompt,
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
    console.log(`   📋 Job ID: ${requestId}`);

    let result = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise(r => setTimeout(r, 2000));
      const poll = await axios.get(`https://api.wavespeed.ai/api/v3/predictions/${requestId}/result`, {
        headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` },
        timeout: 15000
      });
      if (poll.data.data?.status === 'completed') { result = poll.data.data; break; }
      if (poll.data.data?.status === 'failed') throw new Error(`Job failed: ${poll.data.data.error || 'Unknown'}`);
      if (attempt % 5 === 0) console.log(`   ⏳ Waiting... (${attempt * 2}s)`);
    }

    if (!result?.outputs?.[0]) throw new Error('Timeout');

    const img = await axios.get(result.outputs[0], { responseType: 'arraybuffer', timeout: 30000 });
    fs.writeFileSync(path.join(OUTPUT_DIR, item.newFile), Buffer.from(img.data));
    console.log(`   ✅ Saved: ${item.newFile}`);
    return true;
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Fixing Coins & Lime Background\n');
  for (const item of GENERATIONS) {
    await generateImage(item);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\n✅ Done!');
}

main().catch(console.error);
