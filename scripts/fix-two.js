const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

const REPLACEMENTS = [
  {
    oldFile: '02_chrome_corner_pattern_lime.png',
    newFile: '02_chrome_pattern_both_sides.png',
    prompt: `deep dark void with dramatic cinematic depth, dark lighting with subtle cyan accents, photorealistic 3D environment, single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject positioned in the CENTER of the image, the ${LOGO_SYMBOL} symbol rendered in polished chrome with subtle cyan edge glow, soft cinematic key light, lime green (#dbff03) flat rounded square grid pattern extending from BOTH the left and right edges of the frame going off the canvas, the pattern is in the BACKGROUND behind everything, chrome coins and 3D elements floating in FRONT overlapping the pattern, the lime pattern provides bright pop against the dark background, the logo crafted from premium materials with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  },
  {
    oldFile: '07_bank_vault_premium.png',
    newFile: '07_glass_bank_floating_bills.png',
    prompt: `deep dark void with rich blue and purple undertones, dramatic cinematic lighting with cool silver and cyan accents, photorealistic 3D environment, single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject in the center, the ${LOGO_SYMBOL} symbol rendered in polished chrome and glass with blue light reflections, a simple minimalist glass bank building silhouette as a background element rendered in translucent crystal glass with blue tint, simple rectangular bill-shaped glass money pieces floating around the scene like paper bills made of crystal glass, the glass bills catching and refracting blue and purple light, the logo crafted from premium materials with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, no gold, no yellow, no vault`
  }
];

async function generateImage(item) {
  console.log(`\n🎨 Replacing: ${item.oldFile}`);
  console.log(`   New file: ${item.newFile}`);

  try {
    const oldPath = path.join(OUTPUT_DIR, item.oldFile);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
      console.log(`   🗑️ Deleted old file`);
    }

    const logoResponse = await axios.get(
      `https://crypto-news-curator-backend-production.up.railway.app/api/cover-generator/logo-preview/${LOGO_SYMBOL}`,
      { responseType: 'arraybuffer', timeout: 15000 }
    );
    const base64Logo = Buffer.from(logoResponse.data).toString('base64');
    const logoUrl = `data:image/png;base64,${base64Logo}`;

    console.log(`   Prompt length: ${item.prompt.length} chars`);

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
  console.log('🚀 Fixing 2 Style Examples\n');
  for (const item of REPLACEMENTS) {
    await generateImage(item);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\n✅ Done!');
}

main().catch(console.error);
