const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

const GENERATIONS = [
  {
    // Purple version of the hexagon style (replacing green)
    oldFile: '07_glass_bank_floating_bills.png',
    newFile: '07_purple_hexagon_glass.png',
    prompt: `deep rich purple gradient background with violet and magenta tones, dramatic cinematic lighting with purple highlights, photorealistic 3D environment, single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject in the center, the ${LOGO_SYMBOL} symbol rendered in holographic glass with silver chrome edges and purple light refractions, floating glass hexagon shapes at various sizes and depths with chrome silver edges, hexagons made of translucent purple tinted glass catching purple and magenta light, soft purple glow and atmospheric haze, the logo crafted from premium materials with volumetric purple lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, no gold, no green, no teal`
  },
  {
    // Lime and black version of holographic prism style
    newFile: '05b_holographic_lime_black.png',
    prompt: `absolute black void background with dramatic depth, intense cinematic lighting with lime green (#dbff03) accent highlights, photorealistic 3D environment, single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject, the ${LOGO_SYMBOL} symbol rendered in holographic prism glass with lime green (#dbff03) light refractions and chrome edges, floating glass prism shapes and geometric elements with lime green glow against pure black, sharp lime colored light rays and edge highlights, stark contrast between black void and bright lime accents, the logo crafted from premium materials with volumetric lime green lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, no purple, no blue`
  },
  {
    // Retry pattern with both sides
    newFile: '02_chrome_pattern_both_sides.png',
    prompt: `deep dark void background, dramatic cinematic lighting with cyan accents, photorealistic 3D environment, single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject positioned CENTER, the ${LOGO_SYMBOL} symbol rendered in polished chrome with cyan edge glow, lime green (#dbff03) flat rounded square grid pattern extending from BOTH left and right edges going off canvas, pattern is BEHIND everything in background, chrome coins floating in FRONT overlapping the pattern, lime pattern provides bright pop against dark, the logo crafted from premium materials with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
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
  console.log('🚀 Generating 3 Variations\n');
  for (const item of GENERATIONS) {
    await generateImage(item);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\n✅ Done!');
}

main().catch(console.error);
