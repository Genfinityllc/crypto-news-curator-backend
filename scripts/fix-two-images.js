const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

const GENERATIONS = [
  {
    // Hands image - smaller logo, only 2 hands
    oldFile: '02_glass_hands_lime_pattern.png',
    newFile: '02_glass_two_hands_lime.png',
    prompt: `pure black void background, dramatic cinematic lighting with purple accent highlights, photorealistic 3D environment, the provided cryptocurrency logo symbol rendered in medium size crystal clear glass material centered in the composition, the logo icon rendered in frosted transparent glass with purple inner glow and realistic refractions, exactly TWO translucent 3D crystal glass human hands reaching into the frame - one from the left edge and one from the right edge - grabbing toward the logo, only 2 hands total, hands made of clear crystal glass with realistic fingers, lime green (#dbff03) flat rounded square pattern in the bottom left corner extending off frame, shallow depth of field, the logo crafted from premium glass material with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, only two hands maximum`
  },
  {
    // Coins image - plastic material instead of glass
    oldFile: '20_navy_lime_accent_coins.png',
    newFile: '20_navy_lime_plastic_coins.png',
    prompt: `deep navy blue void fading to rich black, dramatic dark lighting with lime green (#dbff03) accent highlights, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in crystal glass with silver chrome core and lime green edge glow, soft cinematic lighting, scattered coins featuring the logo made of MATTE PLASTIC material with lime green (#dbff03) color, the coins are solid opaque plastic not glass or metal, plastic coins have soft matte finish with subtle surface texture, coins at various angles creating depth, clean minimal composition, the logo crafted from premium materials with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
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
  console.log('🚀 Fixing 2 Images\n');
  for (const item of GENERATIONS) {
    await generateImage(item);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\n✅ Done!');
}

main().catch(console.error);
