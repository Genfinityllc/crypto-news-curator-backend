const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../style-examples');
const LOGO_SYMBOL = 'HBAR';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

// Creative wild variations matching user's aesthetic
const GENERATIONS = [
  {
    // Shattered glass reality - logo emerging from broken mirror
    oldFile: '19_cgi_glass_spheres_chrome_reflection.png',
    newFile: '19_shattered_glass_emergence.png',
    prompt: `absolute black void background, dramatic cinematic lighting, photorealistic 3D environment, single prominent cryptocurrency logo symbol rendered in crystal clear glass emerging from a massive SHATTERED mirror plane, sharp glass shards and fragments exploding outward from the center, broken glass pieces floating and flying in all directions with motion blur, some glass fragments tinted with lime green (#dbff03) catching light, deep purple volumetric light rays streaming through the broken glass, dramatic depth with foreground shards blurred, the logo pristine and undamaged at the center of the chaos, premium glass materials with realistic refractions, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, no spheres, no balls`
  },
  {
    // Digital glitch corruption - cyberpunk aesthetic
    oldFile: '13_liquid_chrome_glowing_cracks.png',
    newFile: '13_digital_glitch_corruption.png',
    prompt: `pure black void background with subtle scan lines, dramatic cyberpunk cinematic lighting, photorealistic 3D environment, single prominent cryptocurrency logo symbol rendered in polished chrome with RGB chromatic aberration color split effect on the edges showing red blue green separation, digital glitch artifacts and pixel blocks scattered around the logo, horizontal scan lines and VHS distortion effects in the background, lime green (#dbff03) digital noise particles floating, purple neon accent lighting, the logo partially dissolving into digital pixels on one edge while remaining solid chrome on the other, cyberpunk data corruption aesthetic, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, no liquid, no melting`
  },
  {
    // Gravity defying paper explosion
    newFile: '26_paper_explosion_chaos.png',
    prompt: `absolute black void background, dramatic cinematic lighting with purple accent rim lights, photorealistic 3D environment, single prominent cryptocurrency logo symbol rendered in frosted glass with purple inner glow floating at center, hundreds of small white paper fragments and torn paper pieces exploding outward from behind the logo in a radial burst pattern, papers caught mid-flight with motion blur, some paper pieces on fire with lime green (#dbff03) flames at the edges, chaotic dynamic energy, scattered glass coins flying among the papers, dramatic depth of field with foreground papers blurred, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, no text on papers`
  },
  {
    // Magnetic ferrofluid spikes
    newFile: '27_ferrofluid_spikes_magnetic.png',
    prompt: `deep black void background, dramatic cinematic lighting with purple highlights, photorealistic 3D environment, single prominent cryptocurrency logo symbol rendered in polished chrome floating above a pool of black magnetic ferrofluid liquid, sharp spiky ferrofluid formations rising up around and toward the logo like magnetic attraction, the spikes are glossy black with purple and lime green (#dbff03) light reflections, dramatic contrast between the smooth chrome logo and the organic sharp ferrofluid spikes, some spikes nearly touching the logo creating tension, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
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
  console.log('🚀 Generating Creative Wild Variations\n');
  console.log('Concepts:');
  console.log('1. Shattered glass reality - logo emerging from broken mirror');
  console.log('2. Digital glitch corruption - cyberpunk RGB split');
  console.log('3. Paper explosion chaos - papers bursting outward');
  console.log('4. Ferrofluid magnetic spikes - organic tension\n');

  for (const item of GENERATIONS) {
    await generateImage(item);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\n✅ Done!');
}

main().catch(console.error);
