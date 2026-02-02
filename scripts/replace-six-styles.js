/**
 * Replace 6 style examples with improved prompts
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
    oldFile: '20_floating_rings_deep_navy.png',
    newFile: '20_deep_navy_glass_coins.png',
    prompt: `deep navy blue void fading to rich black, dramatic dark lighting with cool silver rim highlights, photorealistic 3D environment, single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject, the ${LOGO_SYMBOL} symbol rendered in crystal glass with silver metallic core, soft cinematic lighting with elegant refractions, scattered glass coins featuring the ${LOGO_SYMBOL} logo floating at various depths creating premium financial aesthetic, flat abstract rounded geometric shapes in deep blue tones floating as accent elements, the logo crafted from premium materials with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, no rings`
  },
  {
    oldFile: '02_neon_edge_chrome_flat_geo_dark.png',
    newFile: '02_neon_chrome_tight_pattern_coins.png',
    prompt: `deep dark void with dramatic cinematic depth, dark lighting with cyan and magenta edge accents, photorealistic 3D environment, single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject in the foreground, the ${LOGO_SYMBOL} symbol rendered in polished chrome with subtle cyan and magenta neon edge glow, soft cinematic key light with micro reflections, a tight clustered grouping of flat rounded squares circles and organic blob shapes positioned directly behind the logo as a contained graphic element NOT covering the entire background, multiple 3D glass and chrome coins featuring the ${LOGO_SYMBOL} logo scattered around the scene at various angles, the logo crafted from premium materials with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  },
  {
    oldFile: '07_pearl_gloss_plastic_electric_teal.png',
    newFile: '07_obsidian_void_purple_glow.png',
    prompt: `absolute obsidian black void with deep purple gradient undertones, dramatic dark moody lighting with vivid purple rim accents, photorealistic 3D environment, single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject, the ${LOGO_SYMBOL} symbol rendered in glossy pearl white plastic with bright purple edge glow and purple light reflections, intense purple backlighting creating dramatic silhouette effect, flat abstract geometric shapes in deep violet and magenta tones floating as graphic design elements, scattered glass coins with purple tinted reflections, the logo crafted from premium materials with volumetric purple lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, no teal, no lightning`
  },
  {
    oldFile: '08_anodized_titanium_midnight_charcoal.png',
    newFile: '08_titanium_dramatic_purple_glow.png',
    prompt: `absolute black void with dramatic depth and atmosphere, intense dark cinematic lighting with vivid glowing purple highlights, photorealistic 3D environment, single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject, the ${LOGO_SYMBOL} symbol rendered in anodized titanium with bright glowing purple edges and purple light emission, the logo itself glowing with intense purple neon light from within, dramatic purple rim lighting creating powerful contrast against the dark void, flat abstract shapes in deep purple floating as accents, scattered metallic coins with purple reflections, the logo crafted from premium materials with intense purple volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  },
  {
    oldFile: '25_luxury_chrome_dark_coins.png',
    newFile: '25_multicolor_chrome_dynamic.png',
    prompt: `obsidian black void with deep blue and purple gradient undertones, dramatic cinematic lighting with multiple colored light sources, photorealistic 3D environment, single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject, the ${LOGO_SYMBOL} symbol rendered in polished platinum chrome with dynamic multicolor reflections showing cyan blue and purple hues across the surface, complex lighting setup with cool blue key light and warm magenta fill creating iridescent chrome effect, scattered chrome and glass coins with varied colorful reflections at different angles, abstract glass prism elements refracting rainbow light accents, the logo crafted from premium materials with dynamic volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  },
  {
    oldFile: '14_blue_cyan_cinematic_dark_coins.png',
    newFile: '14_glass_charts_lime_purple.png',
    prompt: `deep dark blue-black void with professional financial atmosphere, dramatic cinematic lighting with lime green (#dbff03) and purple accent lights, photorealistic 3D environment, single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject, the ${LOGO_SYMBOL} symbol rendered in polished glass and chrome with lime and purple light reflections, abstract 3D glass trading charts and bar graphs floating in the background rendered in translucent glass with lime green (#dbff03) glow and purple edges, financial data visualization elements made of crystal glass, scattered glass coins featuring the logo, the logo crafted from premium materials with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
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
  console.log('🚀 Replacing 6 Style Examples');
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
