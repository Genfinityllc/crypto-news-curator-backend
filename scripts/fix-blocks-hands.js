const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

const GENERATIONS = [
  {
    // Black blocks with light beaming through cracks
    oldFile: '13_liquid_chrome_black_walls.png',
    newFile: '13_liquid_chrome_glowing_cracks.png',
    prompt: `absolute black matte wall panels and blocks forming geometric architectural background, a few of the black blocks have bright glowing light beaming through the cracks and gaps around their edges creating dramatic rim lighting effect, volumetric light rays streaming through 2-3 block cracks, dramatic cinematic lighting, photorealistic 3D environment, single large prominent cryptocurrency logo symbol as the hero subject rendered in liquid chrome mercury metal with smooth flowing reflective surface, the liquid metal logo appears organic and flowing, smaller liquid chrome logos on black wall panels at different sizes, the logo crafted from premium liquid metal material with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  },
  {
    // Smaller hands
    oldFile: '02_glass_two_hands_lime.png',
    newFile: '02_glass_small_hands_lime.png',
    prompt: `pure black void background, dramatic cinematic lighting with purple accent highlights, photorealistic 3D environment, the provided cryptocurrency logo symbol rendered in medium size crystal clear glass material centered in the composition, the logo icon rendered in frosted transparent glass with purple inner glow and realistic refractions, exactly TWO small delicate translucent 3D crystal glass human hands reaching into the frame from the edges - one from the left and one from the right - the hands are proportionally SMALL compared to the logo not oversized, hands made of clear crystal glass with realistic fingers, lime green (#dbff03) flat rounded square pattern in the bottom left corner extending off frame, shallow depth of field, the logo crafted from premium glass material with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, small hands only`
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
  console.log('🚀 Fixing Blocks & Hands\n');
  for (const item of GENERATIONS) {
    await generateImage(item);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\n✅ Done!');
}

main().catch(console.error);
