/**
 * Replace specific style examples with better prompts
 * Only regenerates the 8 files that need replacement
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';

// 8 REPLACEMENT STYLES - dark backgrounds, flat abstract patterns, coin scatter
const REPLACEMENTS = [
  {
    filename: '02_neon_edge_chrome_flat_geo_dark.png',
    oldFile: '02_neon_edge_chrome_warm_amber_glow.png',
    logoStyle: { material: 'polished chrome with subtle cyan/magenta edge glow', finish: 'soft cinematic key light, micro reflections on metal surface' },
    scene: {
      environment: 'deep dark void with floating flat abstract geometric shapes',
      sceneElements: 'flat rounded squares, circles, and organic blob patterns floating at various depths in cool blue and teal colors',
      lighting: 'dramatic dark lighting with cyan edge accents'
    },
    supportingElement: 'flat abstract rounded rectangles and circle patterns floating like graphic design elements'
  },
  {
    filename: '14_blue_cyan_cinematic_coin_scatter.png',
    oldFile: '14_blue_cyan_cinematic_sunset_gradient.png',
    logoStyle: { material: 'polished metal with cool blue reflections', finish: 'cool cyan key light with soft rim, soft light streak reflections' },
    scene: {
      environment: 'deep dark blue gradient void with professional depth',
      sceneElements: 'scattered logo coins at various angles creating financial premium feel',
      lighting: 'dramatic blue cinematic lighting with cyan highlights'
    },
    supportingElement: 'scattered glass and chrome coins featuring the logo at various angles and depths'
  },
  {
    filename: '17_glass_bevel_dark_pattern.png',
    oldFile: '17_glass_bevel_highlight_blood_orange_dark.png',
    logoStyle: { material: 'beveled crystal glass with strong specular highlights', finish: 'crisp bevel reflections, soft fill light' },
    scene: {
      environment: 'pure black void with subtle purple undertones',
      sceneElements: 'flat geometric rounded shapes floating as abstract accents in violet and magenta',
      lighting: 'minimal dramatic lighting with purple rim accents'
    },
    supportingElement: 'flat abstract organic blob shapes and rounded squares floating in deep purple tones'
  },
  {
    filename: '20_floating_rings_deep_navy.png',
    oldFile: '20_floating_glass_rings_navy_gold_luxury.png',
    logoStyle: { material: 'crystal glass with floating glass rings and arcs nearby', finish: 'soft cinematic lighting' },
    scene: {
      environment: 'deep navy blue void fading to black',
      sceneElements: 'floating logo coins and glass rings creating depth',
      lighting: 'rich navy lighting with cool silver rim highlights'
    },
    supportingElement: 'logo coins in glass material orbiting with ethereal glass rings'
  },
  {
    filename: '21_gradient_glass_dark_geo.png',
    oldFile: '21_iridescent_gradient_glass_mint_fresh.png',
    logoStyle: { material: 'gradient glass shifting cyan to magenta', finish: 'soft cinematic lighting, gentle refractions' },
    scene: {
      environment: 'dark charcoal void with subtle iridescent hints',
      sceneElements: 'flat rounded geometric patterns in shifting cyan to purple colors',
      lighting: 'moody dark lighting with iridescent edge accents'
    },
    supportingElement: 'flat abstract rounded rectangles and circles in gradient cyan-magenta floating as graphic elements'
  },
  {
    filename: '22_neon_minimal_coin_dark.png',
    oldFile: '22_neon_edge_minimal_noir_dramatic.png',
    logoStyle: { material: 'smooth chrome with restrained neon edge accents', finish: 'clean cinematic key light, minimal background' },
    scene: {
      environment: 'absolute dark void with minimal neon accents',
      sceneElements: 'scattered logo coins creating premium financial aesthetic',
      lighting: 'stark minimal lighting with subtle neon cyan rim'
    },
    supportingElement: 'multiple logo coins floating and scattered at different depths creating dimension'
  },
  {
    filename: '23_depth_layers_violet_dark.png',
    oldFile: '23_depth_layers_rose_pink_soft.png',
    logoStyle: { material: 'polished metal with layered depth lighting', finish: 'atmospheric separation, soft cinematic highlights' },
    scene: {
      environment: 'deep black void with rich violet accent gradients',
      sceneElements: 'flat abstract geometric shapes in deep purple tones creating depth layers',
      lighting: 'dramatic dark lighting with vivid purple rim accents'
    },
    supportingElement: 'flat rounded squares and organic blob shapes floating in violet and deep purple'
  },
  {
    filename: '25_luxury_chrome_dark_coins.png',
    oldFile: '25_rose_gold_luxury_obsidian_void.png',
    logoStyle: { material: 'polished platinum chrome with cool silver metallic reflections', finish: 'elegant soft lighting, premium luxury aesthetic with subtle sparkle' },
    scene: {
      environment: 'obsidian black void with deep blue undertones',
      sceneElements: 'premium scattered logo coins and abstract glass shapes',
      lighting: 'luxurious dark lighting with platinum silver highlights'
    },
    supportingElement: 'scattered metallic coins showing the logo with abstract glass prism accents'
  }
];

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

function buildPrompt(replacement) {
  const { logoStyle, scene, supportingElement } = replacement;

  const prompt = `${scene.environment}, ${scene.sceneElements}, ${scene.lighting},
    photorealistic 3D environment with cinematic depth and professional atmosphere,
    single prominent ${LOGO_SYMBOL} cryptocurrency logo as the hero subject,
    the ${LOGO_SYMBOL} symbol rendered in ${logoStyle.material},
    ${logoStyle.finish},
    the ${LOGO_SYMBOL} symbol crafted from premium materials with proper volumetric lighting,
    ${supportingElement},
    the logo casting realistic shadows and receiving environmental reflections,
    photorealistic surface properties and atmospheric depth,
    absolutely no flat overlays or 2D sticker effects on the logo itself,
    no smoke, no flowers, no orange, no amber, no gold colors,
    cinematic composition with professional lighting,
    8k resolution, ultra-detailed, professional product photography, no text or typography,
    Octane render, Cinema 4D quality, premium 3D CGI product render`;

  return prompt;
}

async function generateImage(replacement) {
  console.log(`\n🎨 Replacing: ${replacement.oldFile}`);
  console.log(`   New file: ${replacement.filename}`);

  try {
    // Delete old file if exists
    const oldPath = path.join(OUTPUT_DIR, replacement.oldFile);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
      console.log(`   🗑️ Deleted old file`);
    }

    // Get logo from Supabase
    const logoResponse = await axios.get(
      `https://crypto-news-curator-backend-production.up.railway.app/api/cover-generator/logo-preview/${LOGO_SYMBOL}`,
      { responseType: 'arraybuffer', timeout: 15000 }
    );

    const logoBuffer = Buffer.from(logoResponse.data);
    const base64Logo = logoBuffer.toString('base64');
    const logoUrl = `data:image/png;base64,${base64Logo}`;

    // Build prompt
    const fullPrompt = buildPrompt(replacement);
    console.log(`   Prompt length: ${fullPrompt.length} chars`);

    // Submit to Wavespeed
    const payload = {
      enable_base64_output: false,
      enable_sync_mode: false,
      images: [logoUrl],
      output_format: "png",
      prompt: fullPrompt,
      resolution: "2k",
      aspect_ratio: "16:9"
    };

    const response = await axios.post('https://api.wavespeed.ai/api/v3/google/nano-banana-pro/edit', payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WAVESPEED_API_KEY}`
      },
      timeout: 120000
    });

    const requestId = response.data.data?.id || response.data.id;
    if (!requestId) {
      throw new Error('No request ID returned');
    }

    console.log(`   📋 Job ID: ${requestId}`);

    // Poll for result
    let result = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const pollResponse = await axios.get(
        `https://api.wavespeed.ai/api/v3/predictions/${requestId}/result`,
        {
          headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` },
          timeout: 15000
        }
      );

      const data = pollResponse.data.data;
      const status = data?.status;

      if (status === 'completed') {
        result = data;
        break;
      } else if (status === 'failed') {
        throw new Error(`Job failed: ${data.error || 'Unknown error'}`);
      }

      if (attempt % 5 === 0) {
        console.log(`   ⏳ Waiting... (${attempt * 2}s)`);
      }
    }

    if (!result || !result.outputs?.[0]) {
      throw new Error('Job timed out or no output');
    }

    // Download the image
    const imageResponse = await axios.get(result.outputs[0], {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    // Save to file
    const filepath = path.join(OUTPUT_DIR, replacement.filename);
    fs.writeFileSync(filepath, Buffer.from(imageResponse.data));

    console.log(`   ✅ Saved: ${replacement.filename}`);
    return { success: true, filename: replacement.filename };

  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Replacing 8 Style Examples with Better Prompts');
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log(`🎯 Using logo: ${LOGO_SYMBOL}`);
  console.log(`📝 Files to replace: ${REPLACEMENTS.length}\n`);

  if (!WAVESPEED_API_KEY) {
    console.error('❌ WAVESPEED_API_KEY not found in environment');
    process.exit(1);
  }

  let success = 0;
  let failed = 0;

  for (const replacement of REPLACEMENTS) {
    const result = await generateImage(replacement);
    if (result.success) {
      success++;
    } else {
      failed++;
    }

    // Small delay between generations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n✅ Done! ${success} replaced, ${failed} failed`);
  console.log(`📁 Check: ${OUTPUT_DIR}`);
}

main().catch(console.error);
