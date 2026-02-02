const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

const GENERATIONS = [
  {
    // Ink splash on light purple background instead of white
    oldFile: '16_ink_splash_dynamic.png',
    newFile: '16_ink_splash_purple_bg.png',
    prompt: `soft light purple lavender studio background, dramatic cinematic lighting, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in polished chrome metal centered in composition, explosive black ink splashes and splatters bursting outward from behind the logo in dynamic radial patterns, liquid ink droplets frozen mid-air with motion blur, some ink splashes tinted with deeper purple and lime green (#dbff03) accents, dramatic contrast of black ink against light purple background, ink streams and ribbons flowing dynamically around the logo, chaotic energy and movement, the logo crafted from premium chrome material, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  },
  {
    // Like paper explosion - confetti/fragments explosion with lime fire accents
    oldFile: '12_wire_mesh_deformation.png',
    newFile: '12_confetti_explosion_fire.png',
    prompt: `deep black void background with purple radial glow at center, dramatic cinematic lighting with purple highlights, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in frosted glass with purple inner glow centered, explosive radial burst of white paper confetti fragments and small paper pieces flying outward from behind the logo, glass coins scattered among the confetti at various angles, lime green (#dbff03) flames and fire wisps on some paper edges creating dynamic energy, papers and confetti frozen mid-explosion with motion blur, chaotic celebratory energy, the logo crafted from premium glass material, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  },
  {
    // Like floating coins style - clean navy with floating elements
    oldFile: '07_crystal_growth_organic.png',
    newFile: '07_navy_floating_glass_elements.png',
    prompt: `deep navy blue void fading to black, soft even cinematic lighting with subtle purple accents, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in hollow transparent crystal glass outline style with purple inner glow, floating translucent glass geometric shapes - triangular prisms pyramids and angular shards - scattered throughout at various depths and angles, glass coins featuring the logo floating among the geometric elements, clean minimal composition with depth, all glass elements catching subtle purple and lime green (#dbff03) light accents, the logo crafted from premium hollow glass material, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, no crystals growing`
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
  console.log('🚀 Fixing 3 Styles\n');
  console.log('1. Ink splash - now on light purple background');
  console.log('2. Confetti explosion with lime fire - like paper explosion');
  console.log('3. Navy floating glass elements - like style 20\n');

  for (const item of GENERATIONS) {
    await generateImage(item);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\n✅ Done!');
}

main().catch(console.error);
