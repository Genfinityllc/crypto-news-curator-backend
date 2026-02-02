/**
 * Generate style examples for the style picker feature
 * Uses FULL PRODUCTION PROMPTS with DYNAMIC BACKGROUNDS
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';

// 23 STYLISTIC SCENE VARIATIONS - abstract aesthetics, NOT literal locations
const DYNAMIC_SCENES = [
  {
    name: 'deep_blue_gradient',
    environment: 'infinite deep blue void with subtle atmospheric depth',
    sceneElements: 'soft volumetric fog, gentle light rays piercing darkness',
    lighting: 'dramatic cinematic blue with cool undertones and professional depth'
  },
  {
    name: 'deep_crimson_dark',
    environment: 'rich deep crimson gradient fading into pure black',
    sceneElements: 'subtle red mist, dark atmospheric depth',
    lighting: 'dramatic crimson rim lighting against dark shadows'
  },
  {
    name: 'cyan_magenta_split',
    environment: 'dramatic dual-tone void with cyan and magenta color split',
    sceneElements: 'color bleeding effects, chromatic aberration edges',
    lighting: 'bold complementary lighting with cyan key and magenta fill'
  },
  {
    name: 'pure_dark_minimal',
    environment: 'ultra-clean pure black void with infinite depth',
    sceneElements: 'absolute minimal environment, focus entirely on subject',
    lighting: 'precise rim lighting with subtle fill, stark contrast'
  },
  {
    name: 'soft_purple_haze',
    environment: 'ethereal purple-violet gradient with dreamy atmosphere',
    sceneElements: 'soft bokeh orbs, gentle lens flare effects',
    lighting: 'soft diffused purple lighting with gentle violet undertones'
  },
  {
    name: 'electric_teal',
    environment: 'vibrant teal void with electric energy feeling',
    sceneElements: 'subtle electric particle effects, energy wisps',
    lighting: 'bright teal key light with darker teal shadows'
  },
  {
    name: 'midnight_charcoal',
    environment: 'sophisticated charcoal grey gradient with subtle texture',
    sceneElements: 'fine grain texture overlay, subtle depth layers',
    lighting: 'refined neutral lighting with silver-grey highlights'
  },
  {
    name: 'neon_edge_dark',
    environment: 'deep black void with sharp neon accent edges',
    sceneElements: 'geometric neon line accents, clean edge highlights',
    lighting: 'dramatic edge lighting with neon cyan and pink accents'
  },
  {
    name: 'holographic_shimmer',
    environment: 'iridescent holographic void with color-shifting properties',
    sceneElements: 'rainbow prismatic effects, holographic texture hints',
    lighting: 'shifting spectral lighting with iridescent reflections'
  },
  {
    name: 'deep_space_black',
    environment: 'absolute deep space void with subtle star dust',
    sceneElements: 'microscopic particle dust, infinite depth sensation',
    lighting: 'single dramatic key light against pure darkness'
  },
  {
    name: 'cool_steel_grey',
    environment: 'industrial cool grey gradient with metallic undertones',
    sceneElements: 'subtle brushed metal texture hints in background',
    lighting: 'cool neutral lighting with steel blue accents'
  },
  {
    name: 'ink_black_void',
    environment: 'absolute ink black void with barely visible depth',
    sceneElements: 'ultra-minimal dark space, hint of dark blue in shadows',
    lighting: 'single sharp spotlight revealing only the subject'
  },
  {
    name: 'forest_dark_green',
    environment: 'deep forest green gradient with dark undertones',
    sceneElements: 'subtle green mist, organic depth feeling',
    lighting: 'moody dark green lighting with teal accent highlights'
  },
  {
    name: 'arctic_white_clean',
    environment: 'bright clean white-grey gradient with crisp feel',
    sceneElements: 'pristine minimal environment, pure clean aesthetic',
    lighting: 'bright diffused lighting with soft shadows'
  },
  {
    name: 'graphite_shadow',
    environment: 'dark graphite grey gradient with subtle depth',
    sceneElements: 'fine carbon texture hints, industrial darkness',
    lighting: 'minimal cold lighting with sharp silver edge accents'
  },
  {
    name: 'cosmic_purple',
    environment: 'deep cosmic purple void with nebula-like depth',
    sceneElements: 'subtle cosmic dust, ethereal gas cloud hints',
    lighting: 'mysterious purple lighting with magenta highlights'
  },
  {
    name: 'chrome_reflection',
    environment: 'abstract chrome-like reflective void environment',
    sceneElements: 'mirror-like surface reflections, chrome distortions',
    lighting: 'high-contrast lighting with sharp specular highlights'
  },
  {
    name: 'navy_silver_luxury',
    environment: 'premium navy blue gradient with silver accent tones',
    sceneElements: 'subtle silver particle dust, luxury atmosphere',
    lighting: 'rich navy lighting with cool silver rim highlights'
  },
  {
    name: 'mint_fresh',
    environment: 'fresh mint green gradient with clean modern feel',
    sceneElements: 'crisp clean atmosphere, refreshing minimal look',
    lighting: 'bright mint-tinted lighting with white highlights'
  },
  {
    name: 'noir_dramatic',
    environment: 'high-contrast noir black and white aesthetic',
    sceneElements: 'dramatic shadow play, film noir atmosphere',
    lighting: 'harsh dramatic single-source lighting with deep shadows'
  },
  {
    name: 'dark_violet_accent',
    environment: 'deep black void with rich violet accent gradients',
    sceneElements: 'subtle purple mist, dark atmospheric depth',
    lighting: 'dramatic dark lighting with vivid purple rim accents'
  },
  {
    name: 'electric_blue_pop',
    environment: 'vivid electric blue void with high energy',
    sceneElements: 'bright energetic atmosphere, bold visual impact',
    lighting: 'intense saturated blue lighting with bright highlights'
  },
  {
    name: 'obsidian_void',
    environment: 'ultra-deep obsidian black with glass-like depth',
    sceneElements: 'reflective dark surface hints, infinite darkness',
    lighting: 'minimal precise lighting revealing only the subject'
  }
];

// 23 CURATED LOGO STYLES FROM PRODUCTION (aiFeedbackAnalyzer.js) - single-logo only
const LOGO_STYLES = [
  { id: 1, name: 'iridescent_prism_logo', material: 'iridescent crystal glass with rainbow refractions', finish: 'clean rim lighting, subtle spectral reflections on edges, luxury 3D CGI product render' },
  { id: 2, name: 'neon_edge_chrome', material: 'polished chrome with subtle cyan/magenta edge glow', finish: 'soft cinematic key light, micro reflections on metal surface' },
  { id: 3, name: 'mirror_floor_reflection', material: 'polished metal or crystal glass finish hovering above mirror floor', finish: 'clean cinematic lighting with strong reflections' },
  { id: 4, name: 'glass_shard_orbit', material: 'edge-lit glass with minimal glass shards orbiting as accents', finish: 'soft ambient fill, clean futuristic mood' },
  { id: 5, name: 'holographic_prism_edges', material: 'crystal glass with holographic prism edges', finish: 'prismatic rim light with soft ambient fill, rainbow refraction along edges' },
  { id: 7, name: 'pearl_gloss_plastic', material: 'pearl white glossy plastic with soft sheen', finish: 'soft diffused light with mild rim, subtle color shift in gloss' },
  { id: 8, name: 'anodized_titanium', material: 'anodized titanium with cool blue-violet sheen', finish: 'crisp specular highlights, refined cinematic lighting' },
  { id: 9, name: 'obsidian_glass', material: 'obsidian black glass with sharp reflections', finish: 'rim lighting emphasizing depth, subtle reflections' },
  { id: 10, name: 'ceramic_white', material: 'matte ceramic white with subtle gloss edges', finish: 'soft cinematic key light with gentle rim' },
  { id: 12, name: 'satin_aluminum', material: 'satin aluminum with soft reflections', finish: 'clean cinematic lighting, subtle edge highlights' },
  { id: 13, name: 'liquid_steel', material: 'liquid steel with smooth flowing reflections', finish: 'dramatic highlights, cinematic depth' },
  { id: 14, name: 'blue_cyan_cinematic', material: 'polished metal with cool blue reflections', finish: 'cool cyan key light with soft rim, soft light streak reflections' },
  { id: 15, name: 'glass_outline_logo', material: 'clear glass outline with inner glow', finish: 'edge glow with soft ambient fill, minimal neon aesthetic' },
  { id: 16, name: 'micro_shard_clean', material: 'crystal glass with a few tiny glass accents nearby', finish: 'soft cinematic lighting, refined minimal aesthetic' },
  { id: 17, name: 'glass_bevel_highlight', material: 'beveled crystal glass with strong specular highlights', finish: 'crisp bevel reflections, soft fill light' },
  { id: 18, name: 'abstract_glass_shapes', material: 'polished chrome with floating abstract glass shapes as accents', finish: 'soft cinematic key light' },
  { id: 19, name: 'cgi_glass_spheres', material: 'premium glass surrounded by CGI glass spheres at different depths', finish: 'clean rim lighting, subtle refractions' },
  { id: 20, name: 'floating_glass_rings', material: 'crystal glass with floating glass rings and arcs nearby', finish: 'soft cinematic lighting' },
  { id: 21, name: 'iridescent_gradient_glass', material: 'gradient glass shifting cyan to magenta', finish: 'soft cinematic lighting, gentle refractions' },
  { id: 22, name: 'neon_edge_minimal', material: 'smooth chrome with restrained neon edge accents', finish: 'clean cinematic key light, minimal background' },
  { id: 23, name: 'depth_layers', material: 'polished metal with layered depth lighting', finish: 'atmospheric separation, soft cinematic highlights' },
  { id: 24, name: 'frosted_glass', material: 'frosted glass with soft diffused edges and subtle transparency', finish: 'gentle backlight glow, ethereal floating appearance' },
  { id: 25, name: 'rose_gold_luxury', material: 'polished rose gold with warm pink metallic reflections', finish: 'elegant soft lighting, premium luxury aesthetic with subtle sparkle' }
];

// Supporting visual elements - mix of abstract shapes AND some coin scatter concepts
const SUPPORTING_ELEMENTS = [
  'floating abstract glass prisms and geometric shards as background accents',
  'subtle glass orbs and spheres at varying depths creating dimension',
  'scattered glass coins featuring the logo at various angles and depths',
  'abstract light rays and volumetric beams cutting through the scene',
  'floating translucent cubes and rectangular forms as compositional elements',
  'multiple logo coins floating and scattered creating financial depth',
  'scattered bokeh light orbs creating depth and atmosphere',
  'angular crystal formations emerging from the darkness',
  'glass token coins with the logo scattered at different depths',
  'abstract wireframe geometric shapes as subtle accents',
  'flowing liquid metal streams and droplets suspended in space',
  'ethereal glass rings and circular forms at different scales',
  'sharp crystalline spikes and formations as background texture',
  'scattered metallic coins showing the logo at varied angles',
  'floating hexagonal glass tiles creating depth layers',
  'abstract chrome spheres reflecting the environment',
  'logo coins in glass material orbiting at different distances',
  'geometric pyramid forms and tetrahedrons floating',
  'soft aurora-like light curtains in the background',
  'scattered diamond-like crystals catching light',
  'floating logo tokens in chrome finish as secondary elements',
  'floating lens flare elements and light artifacts',
  'crystalline formations with logo coin accents scattered nearby'
];

// Build FULL PRODUCTION PROMPT with supporting elements (NOT logo repeats)
function buildFullProductionPrompt(logoStyle, scene, logoSymbol, elementIndex) {
  // Get a unique supporting element for this style
  const supportingElement = SUPPORTING_ELEMENTS[elementIndex % SUPPORTING_ELEMENTS.length];

  // Step 1: Build the full scene prompt
  const fullScenePrompt = `${scene.environment}, ${scene.sceneElements}, ${scene.lighting},
    photorealistic 3D environment with cinematic depth and professional atmosphere`;

  // Step 2: Build the complete prompt with ONE logo and supporting elements
  let prompt = `${fullScenePrompt},
    single prominent ${logoSymbol} cryptocurrency logo as the hero subject,
    the ${logoSymbol} symbol rendered in ${logoStyle.material},
    ${logoStyle.finish},
    the ${logoSymbol} symbol crafted from premium materials with proper volumetric lighting,
    ${supportingElement},
    the logo casting realistic shadows and receiving environmental reflections,
    photorealistic surface properties and atmospheric depth,
    absolutely no flat overlays or 2D sticker effects,
    only ONE logo - do not repeat or duplicate the logo,
    cinematic composition with professional lighting,
    8k resolution, ultra-detailed, professional product photography, no text or typography,
    Octane render, Cinema 4D quality, premium 3D CGI product render`;

  return prompt;
}

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

async function generateImage(logoStyle, scene) {
  console.log(`\n🎨 Generating style ${logoStyle.id}: ${logoStyle.name}`);
  console.log(`   Scene: ${scene.name}`);
  console.log(`   Material: ${logoStyle.material.substring(0, 50)}...`);

  try {
    // Get logo from Supabase
    const logoResponse = await axios.get(
      `https://crypto-news-curator-backend-production.up.railway.app/api/cover-generator/logo-preview/${LOGO_SYMBOL}`,
      { responseType: 'arraybuffer', timeout: 15000 }
    );

    const logoBuffer = Buffer.from(logoResponse.data);
    const base64Logo = logoBuffer.toString('base64');
    const logoUrl = `data:image/png;base64,${base64Logo}`;

    // Build FULL PRODUCTION PROMPT with unique supporting element
    const fullPrompt = buildFullProductionPrompt(logoStyle, scene, LOGO_SYMBOL, logoStyle.id - 1);
    console.log(`   Full prompt length: ${fullPrompt.length} chars`);

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

    // Save to file - include scene name for clarity
    const filename = `${logoStyle.id.toString().padStart(2, '0')}_${logoStyle.name}_${scene.name}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, Buffer.from(imageResponse.data));

    console.log(`   ✅ Saved: ${filename}`);
    return { success: true, filename };

  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Generating Style Examples with FULL PRODUCTION PROMPTS + DYNAMIC BACKGROUNDS');
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log(`🎯 Using logo: ${LOGO_SYMBOL}`);
  console.log(`📝 Total logo styles: ${LOGO_STYLES.length}`);
  console.log(`🌆 Total scene types: ${DYNAMIC_SCENES.length}\n`);

  if (!WAVESPEED_API_KEY) {
    console.error('❌ WAVESPEED_API_KEY not found in environment');
    process.exit(1);
  }

  // Clear and recreate output directory for fresh generation
  if (fs.existsSync(OUTPUT_DIR)) {
    const files = fs.readdirSync(OUTPUT_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(OUTPUT_DIR, file));
    }
    console.log('🗑️ Cleared existing style examples\n');
  } else {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let success = 0;
  let failed = 0;

  // Generate each logo style with a cycling scene type
  for (let i = 0; i < LOGO_STYLES.length; i++) {
    const logoStyle = LOGO_STYLES[i];
    const scene = DYNAMIC_SCENES[i % DYNAMIC_SCENES.length]; // Cycle through 7 scenes

    const result = await generateImage(logoStyle, scene);
    if (result.success) {
      success++;
    } else {
      failed++;
    }

    // Small delay between generations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n✅ Done! ${success} generated, ${failed} failed`);
  console.log(`📁 Check: ${OUTPUT_DIR}`);

  // Output summary
  console.log('\n📋 STYLE + SCENE COMBINATIONS:');
  LOGO_STYLES.forEach((s, i) => {
    const scene = DYNAMIC_SCENES[i % DYNAMIC_SCENES.length];
    console.log(`   ${s.id.toString().padStart(2, '0')}. ${s.name} + ${scene.name}`);
  });
}

main().catch(console.error);
