const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

const GENERATIONS = [
  {
    // Ink splash - brighter purple bg, more 3D logo
    oldFile: '16_ink_splash_purple_bg.png',
    newFile: '16_ink_splash_bright_purple.png',
    prompt: `bright vivid purple (#9b59b6) studio background, dramatic cinematic lighting, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in thick chunky 3D polished chrome metal with strong depth and beveled edges showing dimensional thickness, explosive black ink splashes and splatters bursting outward from behind the logo in dynamic radial patterns, liquid ink droplets frozen mid-air with motion blur, some ink splashes tinted with deeper purple and lime green (#dbff03) accents, dramatic contrast of black ink against bright purple background, ink streams and ribbons flowing dynamically, the logo is very 3D with strong shadows and depth, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  },
  {
    // Like 26 paper explosion
    oldFile: '12_confetti_explosion_fire.png',
    newFile: '12_paper_burst_lime_flames.png',
    prompt: `deep black void background with subtle purple radial glow behind logo, dramatic cinematic lighting with purple highlights, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in frosted glass with purple inner glow centered and large, explosive radial burst of white paper fragments torn papers and document pieces flying outward from behind the logo in all directions, glass coins scattered among the flying papers at various angles, lime green (#dbff03) flames and fire wisps burning on some paper edges creating dynamic energy, papers frozen mid-explosion with motion blur on edges, chaotic explosive energy radiating outward, the logo crafted from premium glass material, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  },
  {
    // Like 26 paper explosion - variation
    oldFile: '07_navy_floating_glass_elements.png',
    newFile: '07_document_explosion_coins.png',
    prompt: `pure black void background with purple atmospheric glow, dramatic cinematic lighting with purple and magenta highlights, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in frosted glass with bright purple inner glow large and centered, hundreds of white paper documents receipts and financial paper fragments exploding outward from behind the logo like a document shredder explosion, many glass and chrome coins featuring the logo scattered among the flying papers at all angles, some papers with lime green (#dbff03) flame edges burning, dynamic radial explosion composition, motion blur on flying elements, the logo crafted from premium glass material with purple volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  },
  {
    // Rerender 20 - navy with lime plastic coins
    oldFile: '20_navy_hollow_glass_coins.png',
    newFile: '20_navy_lime_coins_v2.png',
    prompt: `deep navy blue void fading to rich black, soft even cinematic lighting with no glow or spotlight, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in crystal clear glass with chrome edges and subtle inner reflections, the logo is clean and well-lit, scattered medium-sized matte lime green (#dbff03) plastic coins floating weightlessly in the air at various heights depths and angles throughout the scene, coins are solid opaque plastic with soft matte finish, coins at varied rotations creating dynamic composition, some coins closer with slight blur some further away, clean minimal composition, the logo crafted from premium glass material, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
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
  console.log('🚀 Fixing 4 Styles\n');

  for (const item of GENERATIONS) {
    await generateImage(item);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\n✅ Done!');
}

main().catch(console.error);
