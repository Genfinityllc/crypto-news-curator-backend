const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

const GENERATIONS = [
  {
    // #24 - Flat purple graphic elements style (like 02 but purple)
    oldFile: '24_molten_forge_sparks.png',
    newFile: '24_purple_graphic_glass.png',
    prompt: `deep black void background, dramatic cinematic lighting with purple highlights, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in bright polished mirror chrome with strong white highlights clearly visible, flat bright purple (#9b59b6) geometric shapes as graphic design elements layered behind and around the scene - angular blocks zigzag patterns and bold flat color sections creating visual interest like a graphic design poster, floating glass cubes and prisms scattered around catching purple light reflections, the flat purple graphic elements contrast with the 3D glass objects, clean modern design aesthetic mixing 2D graphic elements with 3D renders, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  },
  {
    // #21 - Flat magenta graphic elements style (like 02 but magenta)
    oldFile: '21_gradient_glass_dark_abstract.png',
    newFile: '21_magenta_graphic_glass.png',
    prompt: `deep black void background, dramatic cinematic lighting with magenta and cyan accents, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in bright frosted glass with purple inner glow well-lit and clearly visible, bold flat bright magenta (#e91e63) geometric shapes as graphic design layers in different locations - diagonal stripes angular blocks and abstract flat patterns creating dynamic background interest like a modern poster design, floating transparent glass geometric shapes catching colored light, mix of flat 2D graphic design elements with premium 3D glass objects, modern editorial design aesthetic, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  },
  {
    // #09 - Same obsidian style but BRIGHTER logo
    oldFile: '09_obsidian_glass_neon_edge_dark.png',
    newFile: '09_obsidian_bright_logo.png',
    prompt: `deep black obsidian void background, dramatic cinematic lighting with purple and magenta neon edge accents, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in BRIGHT WHITE polished chrome metal that is VERY WELL-LIT with strong white highlights and clearly visible standing out against the dark background, the logo glows with reflected light and is the BRIGHTEST element in the scene, floating obsidian black glass shards and angular geometric shapes with glossy surfaces and neon purple edge lighting, the bright chrome logo contrasts dramatically with the dark obsidian elements, front-lit logo with strong key lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  },
  {
    // #08 - Same glass hands style but ONLY 2 hands
    oldFile: '08_glass_hands_black_void.png',
    newFile: '08_two_glass_hands.png',
    prompt: `pure black void background, soft dramatic cinematic lighting with subtle purple ambient glow, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in bright polished chrome metal with strong highlights clearly visible, exactly TWO elegant glass hands reaching toward the logo from opposite sides - one hand from the left and one hand from the right, the hands are made of clear crystal glass with purple and magenta light refractions, hands positioned symmetrically framing the central logo, minimalist composition with just the logo and two hands, the glass hands have elegant sculpted form, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, only two hands total, no more than 2 hands`
  },
  {
    // #07 - Same paper explosion but BRIGHT + different colors (cyan/orange)
    oldFile: '07_document_explosion_coins.png',
    newFile: '07_paper_burst_bright_cyan.png',
    prompt: `bright cyan (#00bcd4) background with radial gradient to darker edges, BRIGHT well-lit dramatic cinematic lighting with cyan and orange highlights, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in bright polished chrome with strong white highlights clearly visible and well-lit, explosive radial burst of white paper fragments torn papers and document pieces flying outward from behind the logo in all directions, chrome coins with the logo scattered among the flying papers at various angles, bright orange (#ff6b35) flames and fire wisps burning on some paper edges creating dynamic energy, papers frozen mid-explosion with motion blur on edges, the overall scene is BRIGHT and cheerful not dark, chaotic explosive energy radiating outward, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
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
  console.log('🚀 Regenerating 5 Styles with Flat Color Elements\n');
  console.log('Styles to generate:');
  console.log('1. #24 - Purple graphic elements + glass');
  console.log('2. #21 - Flat magenta abstract');
  console.log('3. #09 - Brighter logo');
  console.log('4. #08 - Two glass hands');
  console.log('5. #07 - Paper burst cyan/orange bright\n');

  for (const item of GENERATIONS) {
    await generateImage(item);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\n✅ All Done!');
}

main().catch(console.error);
