const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

// Replace with dynamic styles like paper explosion and ferrofluid
const GENERATIONS = [
  {
    // Replace arctic white with ink splash chaos
    oldFile: '16_micro_shard_clean_arctic_white_clean.png',
    newFile: '16_ink_splash_dynamic.png',
    prompt: `pure white studio background, dramatic cinematic lighting, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in polished chrome metal centered in composition, explosive black ink splashes and splatters bursting outward from behind the logo in dynamic radial patterns, liquid ink droplets frozen mid-air with motion blur, some ink splashes tinted with purple and lime green (#dbff03) accents, dramatic contrast of black ink against white background, ink streams and ribbons flowing dynamically around the logo, chaotic energy and movement, the logo crafted from premium chrome material, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  },
  {
    // Replace purple network with twisted wire mesh deformation
    oldFile: '12_purple_network_crystal_shards.png',
    newFile: '12_wire_mesh_deformation.png',
    prompt: `pure black void background, dramatic cinematic lighting with purple accent highlights, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in polished chrome metal floating at center, twisted deformed wire mesh and metal grid warping and bending around the logo like magnetic attraction pulling it inward, the wire mesh is purple-tinted chrome catching purple light, organic flowing mesh deformations creating tension and energy, some mesh sections torn and frayed, scattered wire fragments floating, dramatic purple rim lighting, the logo crafted from premium chrome material, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  },
  {
    // Replace purple hexagons with crystalline growth organic formation
    oldFile: '07_purple_hexagon_glass.png',
    newFile: '07_crystal_growth_organic.png',
    prompt: `deep dark purple gradient background fading to black, dramatic cinematic lighting with purple and magenta highlights, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in frosted glass with purple inner glow at center, organic crystalline formations growing outward from behind the logo like natural crystal clusters, sharp angular crystal spikes and formations in translucent purple and clear glass materials, crystals growing in chaotic organic patterns radiating from the logo, some crystals catching and refracting purple light creating caustics, dramatic depth with foreground crystals slightly blurred, the logo crafted from premium glass material, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, no hexagons`
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
  console.log('🚀 Replacing with Dynamic Chaotic Styles\n');
  console.log('New concepts:');
  console.log('1. Ink splash chaos - explosive black ink on white');
  console.log('2. Wire mesh deformation - twisted metal grid warping');
  console.log('3. Crystal growth organic - chaotic crystal formations\n');

  for (const item of GENERATIONS) {
    await generateImage(item);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\n✅ Done!');
}

main().catch(console.error);
