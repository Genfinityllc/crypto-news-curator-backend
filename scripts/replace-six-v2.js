/**
 * Replace 6 style examples - v2 with specific improvements
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

const REPLACEMENTS = [
  {
    // Fewer coins, different color than logo (purple/magenta coins instead of same navy)
    oldFile: '20_deep_navy_glass_coins.png',
    newFile: '20_navy_purple_coins_minimal.png',
    prompt: `deep navy blue void fading to rich black, dramatic dark lighting with cool silver rim highlights, photorealistic 3D environment, single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject rendered in crystal glass with silver metallic core, soft cinematic lighting with elegant refractions, only 3-4 scattered glass coins featuring the ${LOGO_SYMBOL} logo in purple and magenta tinted glass floating at various depths, the coins have purple and violet color tint different from the main logo, clean minimal composition, the logo crafted from premium materials with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, no rings, no flat patterns`
  },
  {
    // Pattern in corner quadrant (top right), lime #dbff03 color, simple symmetrical rounded squares with corner connections
    oldFile: '02_neon_chrome_tight_pattern_coins.png',
    newFile: '02_chrome_corner_pattern_lime.png',
    prompt: `deep dark void with dramatic cinematic depth, dark lighting with subtle cyan accents, photorealistic 3D environment, single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject positioned center-left, the ${LOGO_SYMBOL} symbol rendered in polished chrome with subtle cyan edge glow, soft cinematic key light, in the top right corner of the image a simple symmetrical flat graphic pattern made of lime green (#dbff03) rounded squares connected at corners forming a grid network pattern, the pattern is small contained in the corner as a graphic design accent element, the pattern provides bright lime pop against the dark background, scattered chrome coins around the scene, the logo crafted from premium materials with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  },
  {
    // Bank theme - classical architecture, pillars, vault aesthetic
    oldFile: '07_obsidian_void_purple_glow.png',
    newFile: '07_bank_vault_premium.png',
    prompt: `dark atmospheric bank vault interior with classical marble pillars and premium architecture, dramatic moody lighting with golden and warm accent lights, photorealistic 3D environment, single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject floating in the center, the ${LOGO_SYMBOL} symbol rendered in polished gold and chrome with premium metallic finish, the logo positioned in front of massive vault door or classical bank columns, luxurious banking atmosphere with marble textures and rich dark tones, scattered gold coins on reflective marble floor, the logo crafted from premium materials with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, no people`
  },
  {
    // Globe theme - world, global finance, international
    oldFile: '08_titanium_dramatic_purple_glow.png',
    newFile: '08_global_glass_sphere.png',
    prompt: `deep dark space environment with subtle blue and purple nebula tones, dramatic cinematic lighting with cool blue rim accents, photorealistic 3D environment, single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject positioned in front of a translucent glass globe or earth sphere, the ${LOGO_SYMBOL} symbol rendered in polished titanium with blue light reflections, the glass globe behind shows subtle continent outlines with glowing network connection lines, global financial technology aesthetic, scattered glass coins orbiting around, the logo crafted from premium materials with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  },
  {
    // Glass coin stacks on reflective surface
    oldFile: '14_glass_charts_lime_purple.png',
    newFile: '14_glass_coin_stacks_reflective.png',
    prompt: `absolute dark void with perfectly reflective glossy black floor surface, dramatic cinematic lighting with purple and blue accent lights from above, photorealistic 3D environment, single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject floating above the reflective surface, the ${LOGO_SYMBOL} symbol rendered in polished chrome and glass with purple light reflections, multiple stacks of glass coins featuring the ${LOGO_SYMBOL} logo arranged on the reflective floor surface, the coins made of translucent crystal glass catching and refracting purple and blue light, perfect mirror reflections on the glossy floor, the logo crafted from premium materials with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, no charts`
  },
  {
    // Trading/financial theme with dynamic elements, better composition
    oldFile: '25_multicolor_chrome_dynamic.png',
    newFile: '25_trading_floor_dynamic.png',
    prompt: `dark atmospheric trading environment with abstract holographic data displays in the background, dramatic cinematic lighting with cyan and magenta accent lights, photorealistic 3D environment, single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject, the ${LOGO_SYMBOL} symbol rendered in polished platinum chrome with iridescent multicolor reflections showing cyan blue purple and magenta hues, abstract glowing price chart lines and candlestick patterns made of light floating in background, dynamic financial energy atmosphere, scattered chrome and glass coins, the logo crafted from premium materials with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  }
];

async function generateImage(item) {
  console.log(`\n🎨 Replacing: ${item.oldFile}`);
  console.log(`   New file: ${item.newFile}`);

  try {
    // Delete old file if exists
    const oldPath = path.join(OUTPUT_DIR, item.oldFile);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
      console.log(`   🗑️ Deleted old file`);
    }

    // Get logo
    const logoResponse = await axios.get(
      `https://crypto-news-curator-backend-production.up.railway.app/api/cover-generator/logo-preview/${LOGO_SYMBOL}`,
      { responseType: 'arraybuffer', timeout: 15000 }
    );
    const base64Logo = Buffer.from(logoResponse.data).toString('base64');
    const logoUrl = `data:image/png;base64,${base64Logo}`;

    console.log(`   Prompt length: ${item.prompt.length} chars`);

    // Submit to Wavespeed
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

    // Poll for result
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

    // Download and save
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
  console.log('🚀 Replacing 6 Style Examples - V2');
  console.log(`📁 Output: ${OUTPUT_DIR}`);
  console.log(`🎯 Logo: ${LOGO_SYMBOL}\n`);

  let success = 0, failed = 0;
  for (const item of REPLACEMENTS) {
    if (await generateImage(item)) success++;
    else failed++;
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n✅ Done! ${success} replaced, ${failed} failed`);
}

main().catch(console.error);
