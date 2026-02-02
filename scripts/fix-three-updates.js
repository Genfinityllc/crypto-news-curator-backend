const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

const GENERATIONS = [
  {
    // #07 - Black background instead of cyan
    oldFile: '07_paper_burst_bright_cyan.png',
    newFile: '07_paper_burst_black_bg.png',
    prompt: `deep black void background with subtle warm radial glow behind logo, dramatic cinematic lighting with orange and white highlights, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in bright polished chrome with strong white highlights clearly visible and well-lit, explosive radial burst of white paper fragments torn papers and document pieces flying outward from behind the logo in all directions, chrome coins with the logo scattered among the flying papers at various angles, bright orange (#ff6b35) flames and fire wisps burning on some paper edges creating dynamic energy, papers frozen mid-explosion with motion blur on edges, chaotic explosive energy radiating outward against the dark background, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
  },
  {
    // #08 - Frosted glass logo style like #21, hands overlapping logo
    oldFile: '08_two_glass_hands.png',
    newFile: '08_hands_frosted_logo.png',
    prompt: `pure black void background, soft dramatic cinematic lighting with purple and magenta ambient glow, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in bright frosted glass with purple inner glow like a glowing holographic material, exactly TWO elegant glass hands reaching toward and SLIGHTLY OVERLAPPING the logo from opposite sides - one hand from the left partially in front of the logo and one hand from the right partially in front of the logo, the hands are made of clear crystal glass with purple and magenta light refractions, hands positioned framing and slightly covering edges of the central logo creating depth, the glass hands have elegant sculpted form, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, only two hands total`
  },
  {
    // #09 - No shards, cleaner background, slightly less bright logo
    oldFile: '09_obsidian_bright_logo.png',
    newFile: '09_obsidian_clean.png',
    prompt: `deep black void background with subtle purple atmospheric gradient, soft dramatic cinematic lighting with purple and magenta neon edge accents around the frame, photorealistic 3D environment, single prominent cryptocurrency logo symbol as the hero subject rendered in polished chrome metal with good highlights and clearly visible but not overly bright, the logo has balanced lighting - visible but not glowing white, clean minimal background with no floating shards or debris just smooth dark void with subtle purple ambient glow, neon purple edge lighting accents creating atmosphere without clutter, elegant minimalist composition focusing on the logo, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
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
  console.log('🚀 Updating 3 Styles\n');
  console.log('1. #07 - Black background instead of cyan');
  console.log('2. #08 - Frosted glass logo, hands overlapping');
  console.log('3. #09 - No shards, cleaner bg, balanced logo brightness\n');

  for (const item of GENERATIONS) {
    await generateImage(item);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\n✅ All Done!');
}

main().catch(console.error);
