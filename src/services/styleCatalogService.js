const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

/**
 * Style Catalog Service
 *
 * Contains the curated style examples with their exact Wavespeed prompts.
 * Each style maps to a sample image in /style-examples/ folder.
 * When a user selects a style, the associated prompt is used for generation.
 */
class StyleCatalogService {
  constructor() {
    this.baseUrl = process.env.BASE_URL || 'https://crypto-news-curator-backend-production.up.railway.app';
    // Use Supabase storage for style examples (uploaded separately)
    this.supabaseStorageUrl = 'https://daqxnvcfmepjzcgfdrdf.supabase.co/storage/v1/object/public/style-examples';
    this.styleExamplesPath = path.join(__dirname, '../../style-examples');

    // Complete style catalog with exact Wavespeed prompts
    // Each style has the EXACT prompt used to generate the sample image
    this.styles = {
      '01_iridescent_prism': {
        id: '01_iridescent_prism',
        name: 'Iridescent Prism',
        description: 'Crystal glass logo with rainbow refractions on deep blue gradient',
        filename: '01_iridescent_prism_logo_deep_blue_gradient.png',
        category: 'glass',
        customSubject: { enabled: true, placeholder: 'e.g., diamonds, crystals, stars...', defaultSubject: 'glass prisms and geometric shards' },
        defaultColors: { bgColor: '#0a1628', elementColor: '#4a90d9', accentLightColor: '#7b68ee', lightingColor: '#1a3a5c' },
        prompt: (logoSymbol) => `infinite deep blue void with subtle atmospheric depth, soft volumetric fog, gentle light rays piercing darkness, soft cinematic blue with cool undertones and professional depth, photorealistic 3D environment with cinematic depth and professional atmosphere, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in iridescent crystal glass with rainbow refractions, clean rim lighting, subtle spectral reflections on edges, luxury 3D CGI product render, floating abstract {{3D_ELEMENTS}} as background accents, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, only ONE logo - do not repeat or duplicate the logo, cinematic composition with professional lighting, 8k resolution, ultra-detailed, professional product photography, no text or typography, Octane render, Cinema 4D quality, premium 3D CGI product render`
      },

      '02_glass_banks_lime': {
        id: '02_glass_banks_lime',
        name: 'Glass Banks',
        description: 'Frosted glass logo with crystal bank buildings and optional accent pattern',
        filename: '02_glass_banks_lime_pattern.png',
        category: 'architectural',
        customSubject: { enabled: true, placeholder: 'e.g., rockets, skyscrapers, pyramids...', defaultSubject: 'bank buildings' },
        defaultColors: { bgColor: '#000000', elementColor: '#9b59b6', accentLightColor: '#dbff03', lightingColor: '#6a0dad' },
        patternOptions: {
          enabled: true,
          defaultPattern: 'mosaic',
          defaultColor: '#dbff03',
          patterns: {
            none: { id: 'none', name: 'No Pattern', description: 'Clean scene without accent pattern', prompt: '' },
            mosaic: { id: 'mosaic', name: 'Mosaic Tiles', description: 'Varied rounded rectangles in an organic grid', prompt: (color) => `BEHIND all 3D elements as a background layer: ${color} flat-shaded 3D rounded rectangle mosaic pattern in the bottom-left corner and bottom-right corner, the shapes have a subtle 3D thickness like extruded flat tiles with soft beveled edges and a slight shadow giving depth while remaining flat-faced, like an iOS app icon grid - rounded rectangles of VARYING sizes arranged loosely with thin dark gaps between them, some shapes are small squares some are wider rectangles some are taller rectangles creating an irregular mosaic, occasionally two neighboring shapes merge into one larger combined shape with no gap between them, the pattern sits BEHIND and UNDERNEATH the 3D glass elements, roughly 15-20 percent of frame in the corners extending off-edge` },
            grid: { id: 'grid', name: 'Uniform Grid', description: 'Even rounded squares in a clean grid', prompt: (color) => `BEHIND all 3D elements as a background layer: ${color} flat rounded square grid pattern in the bottom-left corner and bottom-right corner, uniform evenly-spaced rounded squares all the same size arranged in a neat grid with thin dark gaps, the squares have subtle 3D thickness with soft beveled edges, the pattern sits BEHIND and UNDERNEATH the 3D glass elements, roughly 15-20 percent of frame in the corners extending off-edge` },
            dots: { id: 'dots', name: 'Dot Matrix', description: 'Scattered circles in a halftone pattern', prompt: (color) => `BEHIND all 3D elements as a background layer: ${color} flat-shaded 3D dot matrix pattern in the bottom-left corner and bottom-right corner, scattered circles of varying sizes arranged in a halftone gradient pattern - larger dots near the corner fading to smaller dots toward the center, the dots have subtle 3D thickness like raised buttons, the pattern sits BEHIND and UNDERNEATH the 3D glass elements, roughly 15-20 percent of frame in the corners extending off-edge` },
            hexagons: { id: 'hexagons', name: 'Honeycomb', description: 'Hexagonal cells in a honeycomb layout', prompt: (color) => `BEHIND all 3D elements as a background layer: ${color} flat-shaded 3D hexagonal honeycomb pattern in the bottom-left corner and bottom-right corner, hexagonal cells of varying sizes arranged in an organic honeycomb layout with thin dark gaps between them, the hexagons have subtle 3D thickness with soft beveled edges, the pattern sits BEHIND and UNDERNEATH the 3D glass elements, roughly 15-20 percent of frame in the corners extending off-edge` },
            diagonal: { id: 'diagonal', name: 'Diagonal Bars', description: 'Angled parallel bars at 45 degrees', prompt: (color) => `BEHIND all 3D elements as a background layer: ${color} flat-shaded 3D diagonal bar pattern in the bottom-left corner and bottom-right corner, parallel bars angled at 45 degrees with varying widths and thin dark gaps between them, the bars have subtle 3D thickness with soft beveled edges, the pattern sits BEHIND and UNDERNEATH the 3D glass elements, roughly 15-20 percent of frame in the corners extending off-edge` }
          }
        },
        prompt: (logoSymbol) => `pure black void background, soft cinematic rim lighting with purple accent highlights, photorealistic 3D environment, the provided cryptocurrency logo symbol rendered in medium size frosted glass material with purple inner glow centered in the composition floating freely with NO box NO frame NO rectangular panel NO glass card NO border around it - the logo shape itself is frosted glass not placed inside any container, translucent 3D crystal glass {{3D_ELEMENTS}} reaching into the frame from the edges - rendered entirely in clear crystal glass material, the glass elements are see-through with realistic light refractions and purple tinted reflections, 2-3 small glass elements positioned around the edges of frame, {{PATTERN_PLACEHOLDER}}, shallow depth of field, the logo crafted from premium frosted glass material with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, no hands`
      },

      '03_neon_glass_dynamic': {
        id: '03_neon_glass_dynamic',
        name: 'Neon Glass Dynamic',
        description: 'Mirror chrome logo with cyan/magenta neon split lighting and floating glass cubes',
        filename: '03_neon_glass_dynamic.png',
        category: 'neon',
        customSubject: { enabled: true, placeholder: 'e.g., spheres, pyramids, lightning bolts...', defaultSubject: 'glass cubes prisms and rectangular blocks' },
        defaultColors: { bgColor: '#000000', elementColor: '#00e5ff', accentLightColor: '#ff00ff', lightingColor: '#00e5ff' },
        prompt: (logoSymbol) => `deep black environment with soft cinematic rim lighting, cyan neon glow on the left side and magenta neon glow on the right side creating split lighting, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered in bright polished mirror chrome with strong white highlights clearly visible and well-lit, a few sleek neon light tubes in the background creating geometric accent lines but not overwhelming, glossy black mirror floor with logo reflection, many floating 3D {{3D_ELEMENTS}} of varying sizes scattered dynamically around the logo at different depths and angles, the elements catch and refract the cyan and magenta neon light beautifully, some elements larger in foreground some smaller in background creating depth, the 3D elements add visual complexity and movement, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '04_glass_shard_orbit': {
        id: '04_glass_shard_orbit',
        name: 'Glass Shard Orbit',
        description: 'Edge-lit glass logo with minimal glass shards orbiting on pure dark background',
        filename: '04_glass_shard_orbit_pure_dark_minimal.png',
        category: 'minimal',
        customSubject: { enabled: true, placeholder: 'e.g., asteroids, rings, feathers...', defaultSubject: 'glass shards and orbs' },
        defaultColors: { bgColor: '#000000', elementColor: '#c0c0c0', accentLightColor: '#ffffff', lightingColor: '#1a1a2e' },
        prompt: (logoSymbol) => `ultra-clean pure black void with infinite depth, absolute minimal environment, focus entirely on subject, precise rim lighting with subtle fill, stark contrast, photorealistic 3D environment with cinematic depth and professional atmosphere, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in edge-lit glass with minimal {{3D_ELEMENTS}} orbiting as accents, soft ambient fill, clean futuristic mood, subtle elements at varying depths creating dimension, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, only ONE logo - do not repeat or duplicate the logo, cinematic composition with professional lighting, 8k resolution, ultra-detailed, professional product photography, no text or typography, Octane render, Cinema 4D quality, premium 3D CGI product render`
      },

      '05_holographic_prism': {
        id: '05_holographic_prism',
        name: 'Holographic Prism',
        description: 'Crystal glass with holographic prism edges on soft purple haze',
        filename: '05_holographic_prism_edges_soft_purple_haze.png',
        category: 'holographic',
        customSubject: { enabled: true, placeholder: 'e.g., butterflies, gems, planets...', defaultSubject: 'glass coins' },
        defaultColors: { bgColor: '#2d1b4e', elementColor: '#9b59b6', accentLightColor: '#e0b0ff', lightingColor: '#7b2faf' },
        prompt: (logoSymbol) => `ethereal purple-violet gradient with dreamy atmosphere, soft bokeh orbs, gentle lens flare effects, soft diffused purple lighting with gentle violet undertones, photorealistic 3D environment with cinematic depth and professional atmosphere, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in crystal glass with holographic prism edges, prismatic rim light with soft ambient fill, rainbow refraction along edges, scattered {{3D_ELEMENTS}} at various angles and depths, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, only ONE logo - do not repeat or duplicate the logo, cinematic composition with professional lighting, 8k resolution, ultra-detailed, professional product photography, no text or typography, Octane render, Cinema 4D quality, premium 3D CGI product render`
      },

      '05b_lime_background': {
        id: '05b_lime_background',
        name: 'Lime Background Glass',
        description: 'Holographic glass logo on bright lime green studio backdrop',
        filename: '05b_lime_background_glass.png',
        category: 'colorful',
        customSubject: { enabled: true, placeholder: 'e.g., bubbles, orbs, flowers...', defaultSubject: 'glass shapes and curved glass elements' },
        defaultColors: { bgColor: '#dbff03', elementColor: '#dbff03', accentLightColor: '#ffffff', lightingColor: '#c8eb00' },
        prompt: (logoSymbol) => `bright lime green (#dbff03) gradient background similar to a soft studio backdrop, the entire background is lime green colored, soft dreamy lighting with subtle bokeh, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered in crystal clear holographic glass with rainbow refractions, floating {{3D_ELEMENTS}} around the scene, subtle glass surfaces creating depth, the logo and all elements are transparent crystal glass catching light against the lime green backdrop, soft lens flare and bokeh effects, the logo crafted from premium holographic glass material, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, lime green background`
      },

      '08_hands_frosted': {
        id: '08_hands_frosted',
        name: 'Glass Hands',
        description: 'Frosted glass logo with elegant crystal hands reaching from sides',
        filename: '08_hands_frosted_logo.png',
        category: 'conceptual',
        customSubject: { enabled: true, placeholder: 'e.g., wings, tentacles, claws...', defaultSubject: 'hands' },
        defaultColors: { bgColor: '#000000', elementColor: '#9b59b6', accentLightColor: '#ff00ff', lightingColor: '#6a0dad' },
        prompt: (logoSymbol) => `pure black void background, soft soft cinematic rim lighting with purple and magenta ambient glow, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered in bright frosted glass with purple inner glow like a glowing holographic material, elegant glass {{3D_ELEMENTS}} reaching toward and SLIGHTLY OVERLAPPING the logo from opposite sides - from the left partially in front of the logo and from the right partially in front of the logo, the elements are made of clear crystal glass with purple and magenta light refractions, elements positioned framing and slightly covering edges of the central logo creating depth, the glass elements have elegant sculpted form, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '10_ceramic_white': {
        id: '10_ceramic_white',
        name: 'Ceramic White',
        description: 'Matte ceramic white logo with holographic shimmer on iridescent background',
        filename: '10_ceramic_white_holographic_shimmer.png',
        category: 'premium',
        customSubject: { enabled: true, placeholder: 'e.g., pillars, monoliths, icebergs...', defaultSubject: 'angular crystal formations' },
        defaultColors: { bgColor: '#1a1a2e', elementColor: '#ffffff', accentLightColor: '#e0b0ff', lightingColor: '#c0c0c0' },
        prompt: (logoSymbol) => `iridescent holographic void with color-shifting properties, rainbow prismatic effects, holographic texture hints, shifting spectral lighting with iridescent reflections, photorealistic 3D environment with cinematic depth and professional atmosphere, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in matte ceramic white with subtle gloss edges, soft cinematic key light with gentle rim, {{3D_ELEMENTS}} emerging from the darkness, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, only ONE logo - do not repeat or duplicate the logo, cinematic composition with professional lighting, 8k resolution, ultra-detailed, professional product photography, no text or typography, Octane render, Cinema 4D quality, premium 3D CGI product render`
      },

      '13_digital_glitch': {
        id: '13_digital_glitch',
        name: 'Digital Glitch',
        description: 'Chrome logo with RGB chromatic aberration and cyberpunk glitch effects',
        filename: '13_digital_glitch_corruption.png',
        category: 'cyberpunk',
        customSubject: { enabled: true, placeholder: 'e.g., skulls, circuits, holograms...', defaultSubject: 'glitch artifacts and pixel blocks' },
        defaultColors: { bgColor: '#000000', elementColor: '#dbff03', accentLightColor: '#9b59b6', lightingColor: '#00ff41' },
        prompt: (logoSymbol) => `pure black void background with subtle scan lines, cyberpunk ambient rim lighting, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol rendered in polished chrome with RGB chromatic aberration color split effect on the edges showing red blue green separation, digital {{3D_ELEMENTS}} scattered around the logo, horizontal scan lines and VHS distortion effects in the background, lime green (#dbff03) digital noise particles floating, purple neon accent lighting, the logo partially dissolving into digital pixels on one edge while remaining solid chrome on the other, cyberpunk data corruption aesthetic, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, no liquid, no melting`
      },

      '15_glass_outline': {
        id: '15_glass_outline',
        name: 'Glass Outline',
        description: 'Clear glass outline logo with inner glow on emerald depth background',
        filename: '15_glass_outline_logo_emerald_depth.png',
        category: 'glass',
        customSubject: { enabled: true, placeholder: 'e.g., leaves, mushrooms, jellyfish...', defaultSubject: 'hexagonal glass tiles' },
        defaultColors: { bgColor: '#0d3b2e', elementColor: '#2ecc71', accentLightColor: '#00cec9', lightingColor: '#1a5c3a' },
        prompt: (logoSymbol) => `deep forest green gradient with dark undertones, subtle green mist, organic depth feeling, moody dark green lighting with teal accent highlights, photorealistic 3D environment with cinematic depth and professional atmosphere, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in clear glass outline with inner glow, edge glow with soft ambient fill, minimal neon aesthetic, floating {{3D_ELEMENTS}} creating depth layers, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, only ONE logo - do not repeat or duplicate the logo, cinematic composition with professional lighting, 8k resolution, ultra-detailed, professional product photography, no text or typography, Octane render, Cinema 4D quality, premium 3D CGI product render`
      },

      '16_ink_splash': {
        id: '16_ink_splash',
        name: 'Ink Splash Chrome',
        description: 'Liquid mercury chrome logo with explosive black ink splashes on purple',
        filename: '16_ink_splash_liquid_chrome.png',
        category: 'dynamic',
        customSubject: { enabled: true, placeholder: 'e.g., paint splatters, smoke, flames...', defaultSubject: 'ink splashes and splatters' },
        defaultColors: { bgColor: '#9b59b6', elementColor: '#000000', accentLightColor: '#dbff03', lightingColor: '#6a0dad' },
        prompt: (logoSymbol) => `bright vivid purple (#9b59b6) studio background, soft cinematic rim lighting, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered in LIQUID MERCURY MIRROR CHROME with perfect mirror reflections visible on every surface, the logo reflects the purple background like a polished car hood or liquid metal terminator, highly reflective liquid metal finish showing distorted environment reflections, thick chunky 3D shape with strong depth and beveled edges, explosive {{3D_ELEMENTS}} bursting outward from behind the logo in dynamic radial patterns, elements frozen mid-air with motion blur, some elements tinted with deeper purple and lime green (#dbff03) accents, dramatic contrast against bright purple background, dynamic flowing energy, the chrome logo surface shows warped reflections of surrounding elements, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '17_glass_bevel': {
        id: '17_glass_bevel',
        name: 'Glass Bevel',
        description: 'Beveled crystal glass logo with strong specular highlights on dark pattern',
        filename: '17_glass_bevel_dark_pattern.png',
        category: 'glass',
        customSubject: { enabled: true, placeholder: 'e.g., gears, chains, wires...', defaultSubject: 'wireframe geometric shapes' },
        defaultColors: { bgColor: '#2c2c2c', elementColor: '#c0c0c0', accentLightColor: '#ffffff', lightingColor: '#555555' },
        prompt: (logoSymbol) => `sophisticated charcoal grey gradient with subtle texture, fine grain texture overlay, subtle depth layers, refined neutral lighting with silver-grey highlights, photorealistic 3D environment with cinematic depth and professional atmosphere, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in beveled crystal glass with strong specular highlights, crisp bevel reflections, soft fill light, abstract {{3D_ELEMENTS}} as subtle accents, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, only ONE logo - do not repeat or duplicate the logo, cinematic composition with professional lighting, 8k resolution, ultra-detailed, professional product photography, no text or typography, Octane render, Cinema 4D quality, premium 3D CGI product render`
      },

      '18_abstract_glass': {
        id: '18_abstract_glass',
        name: 'Abstract Glass Cosmic',
        description: 'Polished chrome logo with floating abstract glass shapes on cosmic purple',
        filename: '18_abstract_glass_shapes_cosmic_purple.png',
        category: 'cosmic',
        customSubject: { enabled: true, placeholder: 'e.g., planets, nebulae, meteors...', defaultSubject: 'abstract glass shapes and chrome spheres' },
        defaultColors: { bgColor: '#1a0a2e', elementColor: '#9b59b6', accentLightColor: '#ff00ff', lightingColor: '#4a1a6b' },
        prompt: (logoSymbol) => `deep cosmic purple void with nebula-like depth, subtle cosmic dust, ethereal gas cloud hints, mysterious purple lighting with magenta highlights, photorealistic 3D environment with cinematic depth and professional atmosphere, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in polished chrome with floating {{3D_ELEMENTS}} as accents, soft cinematic key light, elements reflecting the environment, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, only ONE logo - do not repeat or duplicate the logo, cinematic composition with professional lighting, 8k resolution, ultra-detailed, professional product photography, no text or typography, Octane render, Cinema 4D quality, premium 3D CGI product render`
      },

      '19_shattered_glass': {
        id: '19_shattered_glass',
        name: 'Shattered Glass',
        description: 'Crystal glass logo emerging from exploding shattered mirror',
        filename: '19_shattered_glass_emergence.png',
        category: 'dynamic',
        customSubject: { enabled: true, placeholder: 'e.g., ice shards, rocks, debris...', defaultSubject: 'glass shards and fragments' },
        defaultColors: { bgColor: '#000000', elementColor: '#dbff03', accentLightColor: '#9b59b6', lightingColor: '#4a0080' },
        prompt: (logoSymbol) => `absolute black void background, soft cinematic rim lighting, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol rendered in crystal clear glass emerging from a massive SHATTERED plane, sharp {{3D_ELEMENTS}} exploding outward from the center, broken pieces floating and flying in all directions with motion blur, some fragments tinted with lime green (#dbff03) catching light, deep purple volumetric light rays streaming through the elements, dramatic depth with foreground elements blurred, the logo pristine and undamaged at the center of the chaos, premium materials with realistic refractions, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, no spheres, no balls`
      },

      '20_navy_chrome_coins': {
        id: '20_navy_chrome_coins',
        name: 'Navy Chrome Coins',
        description: 'Mirror chrome logo with floating lime plastic coins on deep navy',
        filename: '20_navy_chrome_lime_coins.png',
        category: 'financial',
        customSubject: { enabled: true, placeholder: 'e.g., gold bars, diamonds, tokens...', defaultSubject: 'plastic coins' },
        defaultColors: { bgColor: '#0a1628', elementColor: '#dbff03', accentLightColor: '#c0c0c0', lightingColor: '#1a2744' },
        prompt: (logoSymbol) => `deep navy blue void fading to rich black, soft even cinematic lighting, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered in perfect MIRROR CHROME with flawless reflective surface showing environment reflections, the logo is highly polished mirror finish metal reflecting the navy background and lime accents, thick chunky 3D shape with strong depth and beveled edges, 10-12 matte lime green (#dbff03) {{3D_ELEMENTS}} floating weightlessly in the air at various heights depths and angles, elements vary dramatically in size from small distant to large close-up creating depth, some elements very close and large with slight blur some tiny and far away, the mirror chrome logo catches and reflects light beautifully, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '21_magenta_graphic': {
        id: '21_magenta_graphic',
        name: 'Magenta Graphic',
        description: 'Frosted glass logo with bold magenta graphic design elements',
        filename: '21_magenta_graphic_glass.png',
        category: 'graphic',
        customSubject: { enabled: true, placeholder: 'e.g., arrows, ribbons, waves...', defaultSubject: 'geometric shapes and glass objects' },
        defaultColors: { bgColor: '#000000', elementColor: '#e91e63', accentLightColor: '#00e5ff', lightingColor: '#e91e63' },
        prompt: (logoSymbol) => `deep black void background, soft cinematic rim lighting with magenta and cyan accents, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered in bright frosted glass with purple inner glow well-lit and clearly visible, bold flat bright magenta (#e91e63) {{3D_ELEMENTS}} as graphic design layers in different locations - creating dynamic background interest like a modern poster design, floating transparent glass elements catching colored light, mix of flat 2D graphic design elements with premium 3D objects, modern editorial design aesthetic, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '22_neon_minimal': {
        id: '22_neon_minimal',
        name: 'Neon Minimal Coin',
        description: 'Chrome logo with restrained neon edge accents on clean dark background',
        filename: '22_neon_minimal_coin_dark.png',
        category: 'minimal',
        customSubject: { enabled: true, placeholder: 'e.g., rings, discs, tokens...', defaultSubject: 'glass coins' },
        defaultColors: { bgColor: '#000000', elementColor: '#00e5ff', accentLightColor: '#ff69b4', lightingColor: '#00e5ff' },
        prompt: (logoSymbol) => `deep black void with sharp neon accent edges, geometric neon line accents, clean edge highlights, soft edge lighting with neon cyan and pink accents, photorealistic 3D environment with cinematic depth and professional atmosphere, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in smooth chrome with restrained neon edge accents, clean cinematic key light, minimal background, {{3D_ELEMENTS}} in glass material orbiting at different distances, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, only ONE logo - do not repeat or duplicate the logo, cinematic composition with professional lighting, 8k resolution, ultra-detailed, professional product photography, no text or typography, Octane render, Cinema 4D quality, premium 3D CGI product render`
      },

      '23_depth_layers': {
        id: '23_depth_layers',
        name: 'Depth Layers',
        description: 'Polished metal logo with layered depth lighting on purple dark background',
        filename: '23_depth_layers_purple_dark.png',
        category: 'premium',
        customSubject: { enabled: true, placeholder: 'e.g., smoke trails, particles, aurora...', defaultSubject: 'lens flare elements and light artifacts' },
        defaultColors: { bgColor: '#0a0014', elementColor: '#9b59b6', accentLightColor: '#c084fc', lightingColor: '#6a0dad' },
        prompt: (logoSymbol) => `deep black void with rich violet accent gradients, subtle purple mist, dark atmospheric depth, moody ambient lighting with vivid purple rim accents, photorealistic 3D environment with cinematic depth and professional atmosphere, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in polished metal with layered depth lighting, atmospheric separation, soft cinematic highlights, floating {{3D_ELEMENTS}}, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, only ONE logo - do not repeat or duplicate the logo, cinematic composition with professional lighting, 8k resolution, ultra-detailed, professional product photography, no text or typography, Octane render, Cinema 4D quality, premium 3D CGI product render`
      },

      '24_purple_graphic': {
        id: '24_purple_graphic',
        name: 'Purple Graphic',
        description: 'Mirror chrome logo with bold purple graphic design elements',
        filename: '24_purple_graphic_glass.png',
        category: 'graphic',
        customSubject: { enabled: true, placeholder: 'e.g., arrows, blocks, triangles...', defaultSubject: 'geometric shapes and glass cubes' },
        defaultColors: { bgColor: '#000000', elementColor: '#9b59b6', accentLightColor: '#c0c0c0', lightingColor: '#6a0dad' },
        prompt: (logoSymbol) => `deep black void background, soft cinematic rim lighting with purple highlights, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered in bright polished mirror chrome with strong white highlights clearly visible, flat bright purple (#9b59b6) {{3D_ELEMENTS}} as graphic design elements layered behind and around the scene - creating visual interest like a graphic design poster, floating glass prisms scattered around catching purple light reflections, clean modern design aesthetic mixing 2D graphic elements with 3D renders, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '25_trading_floor': {
        id: '25_trading_floor',
        name: 'Trading Floor',
        description: 'Platinum chrome logo with holographic trading data on dynamic financial background',
        filename: '25_trading_floor_dynamic.png',
        category: 'financial',
        customSubject: { enabled: true, placeholder: 'e.g., gold coins, trophies, safes...', defaultSubject: 'chrome and glass coins' },
        defaultColors: { bgColor: '#0a0a14', elementColor: '#00e5ff', accentLightColor: '#ff00ff', lightingColor: '#00e5ff' },
        prompt: (logoSymbol) => `dark atmospheric trading environment with abstract holographic data displays in the background, soft cinematic rim lighting with cyan and magenta accent lights, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in polished platinum chrome with iridescent multicolor reflections showing cyan blue purple and magenta hues, abstract glowing price chart lines and candlestick patterns made of light floating in background, dynamic financial energy atmosphere, scattered {{3D_ELEMENTS}}, the logo crafted from premium materials with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '26_paper_explosion': {
        id: '26_paper_explosion',
        name: 'Paper Explosion',
        description: 'Frosted glass logo with explosive paper fragments and lime flames',
        filename: '26_paper_explosion_chaos.png',
        category: 'dynamic',
        customSubject: { enabled: true, placeholder: 'e.g., dollar bills, cards, confetti...', defaultSubject: 'paper fragments and torn paper pieces' },
        defaultColors: { bgColor: '#000000', elementColor: '#ffffff', accentLightColor: '#dbff03', lightingColor: '#9b59b6' },
        prompt: (logoSymbol) => `absolute black void background, soft cinematic rim lighting with purple accent rim lights, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol rendered in frosted glass with purple inner glow floating at center, hundreds of small white {{3D_ELEMENTS}} exploding outward from behind the logo in a radial burst pattern, elements caught mid-flight with motion blur, some pieces on fire with lime green (#dbff03) flames at the edges, chaotic dynamic energy, scattered glass coins flying among the elements, dramatic depth of field with foreground elements blurred, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, no text`
      },

      '27_ferrofluid': {
        id: '27_ferrofluid',
        name: 'Ferrofluid Magnetic',
        description: 'Polished chrome logo with magnetic ferrofluid spikes rising toward it',
        filename: '27_ferrofluid_spikes_magnetic.png',
        category: 'conceptual',
        customSubject: { enabled: true, placeholder: 'e.g., tentacles, vines, roots...', defaultSubject: 'ferrofluid spikes' },
        defaultColors: { bgColor: '#000000', elementColor: '#000000', accentLightColor: '#dbff03', lightingColor: '#9b59b6' },
        prompt: (logoSymbol) => `deep black void background, soft cinematic rim lighting with purple highlights, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol rendered in polished chrome floating above a pool of dark liquid, sharp spiky {{3D_ELEMENTS}} rising up around and toward the logo like magnetic attraction, the elements are glossy with purple and lime green (#dbff03) light reflections, dramatic contrast between the smooth chrome logo and the organic sharp elements, some elements nearly touching the logo creating tension, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '28_pastel_reflections': {
        id: '28_pastel_reflections',
        name: 'Pastel Reflections',
        description: 'Glossy clear glass logo with iridescent pastel pink, purple, and blue reflections',
        filename: '28_pastel_reflections.png',
        category: 'glass',
        customSubject: { enabled: true, placeholder: 'e.g., bubbles, orbs, ribbons...', defaultSubject: 'glass orbs and curved glass ribbons' },
        defaultColors: { bgColor: '#000000', elementColor: '#e8b4f8', accentLightColor: '#b4d8f8', lightingColor: '#f8b4d8' },
        prompt: (logoSymbol) => `pure black void background, soft cinematic rim lighting, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered in thick glossy clear glass with smooth rounded inflated 3D form, the glass surface catches soft pastel iridescent reflections - pink lavender baby blue and peach shifting across the curved surfaces like a soap bubble, the logo has substantial 3D depth with rounded puffy edges, light refracts beautifully through the transparent glass body revealing rainbow caustics, floating {{3D_ELEMENTS}} in matching pastel iridescent glass scattered around at varying depths, soft diffused lighting creating gentle color shifts across all surfaces, the logo casting soft colored light onto the dark background, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '29_beveled_facet': {
        id: '29_beveled_facet',
        name: 'Beveled Facet Crystal',
        description: 'Deep 3D diamond-cut crystal glass with angular facets and warm internal light',
        filename: '29_beveled_facet.png',
        category: 'glass',
        customSubject: { enabled: true, placeholder: 'e.g., gems, diamonds, crystals...', defaultSubject: 'faceted crystal fragments' },
        defaultColors: { bgColor: '#000000', elementColor: '#d4a754', accentLightColor: '#ffffff', lightingColor: '#b8860b' },
        prompt: (logoSymbol) => `pure black void background, dramatic cinematic spot lighting from above and behind, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered as a massive deep 3D crystal block with sharp angular diamond-cut beveled facets across every surface, the crystal is transparent with warm amber and golden light refracting through the internal facets creating brilliant specular highlights and caustic light patterns, each faceted plane catches light differently creating a gemstone-like quality, strong white point-light specular reflections on the sharpest edges, the logo sitting on a dark reflective surface with warm golden light reflections beneath, floating {{3D_ELEMENTS}} catching the same warm amber light, deep luxurious jeweler-quality rendering, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '30_neon_smoke': {
        id: '30_neon_smoke',
        name: 'Neon Smoke',
        description: 'Bright neon-outlined logo engulfed in dramatic colorful smoke plumes',
        filename: '30_neon_smoke.png',
        category: 'neon',
        customSubject: { enabled: true, placeholder: 'e.g., clouds, fire, mist...', defaultSubject: 'thick billowing smoke clouds' },
        defaultColors: { bgColor: '#0a0a2e', elementColor: '#ff00ff', accentLightColor: '#4169e1', lightingColor: '#ff00ff' },
        prompt: (logoSymbol) => `dark moody atmospheric environment with deep navy blue to dark purple gradient background, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered in bright glowing neon tube material with vivid magenta and electric blue neon light outlining the logo shape, the neon tubes emit strong visible light, massive {{3D_ELEMENTS}} in magenta pink blue and warm cream colors erupting and billowing dramatically around and through the logo, volumetric fog and haze catching the neon light creating colorful atmospheric glow, the smoke is thick dense and photorealistic with visible turbulence and layered depth, neon light from the logo illuminates the surrounding smoke with vibrant color, the logo sits on a dark reflective floor surface, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '31_glossy_plastic_outlined': {
        id: '31_glossy_plastic_outlined',
        name: 'Glossy Plastic Outlined',
        description: 'Shiny inflated 3D plastic logo with contrasting glossy outline on colored background',
        filename: '31_glossy_plastic_outlined.png',
        category: 'colorful',
        customSubject: { enabled: true, placeholder: 'e.g., candy, balloons, toys...', defaultSubject: 'glossy plastic shapes and spheres' },
        defaultColors: { bgColor: '#9b8ec4', elementColor: '#f5a623', accentLightColor: '#9b8ec4', lightingColor: '#ffffff' },
        prompt: (logoSymbol) => `soft purple (#9b8ec4) studio gradient background with gentle lighting, photorealistic 3D environment, the provided ${logoSymbol} cryptocurrency logo symbol as a single cohesive 3D unit maintaining its original layout and letter spacing — the entire logo is rendered in thick puffy inflated glossy plastic material, warm orange-yellow glossy plastic with a contrasting purple glossy plastic outline giving a layered candy-like appearance, strong specular highlights and reflections on the shiny plastic surfaces, soft studio lighting from above creating clean highlights and gentle shadows, the plastic has a high-gloss wet-look finish like a vinyl toy, floating {{3D_ELEMENTS}} in matching glossy plastic material scattered around, soft shadow beneath the logo on the studio floor, clean commercial product photography aesthetic, CRITICAL: keep the logo text and icon in their correct original positions and alignment — do NOT scatter or rearrange the letters, the logo must read correctly as one unit but without a flat backing plate behind it, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '32_matte_plastic': {
        id: '32_matte_plastic',
        name: 'Matte Textured Plastic',
        description: 'Solid matte-to-glossy 3D plastic logo on bright colored studio backdrop',
        filename: '32_matte_plastic.png',
        category: 'colorful',
        customSubject: { enabled: true, placeholder: 'e.g., blocks, cubes, tokens...', defaultSubject: 'rounded plastic shapes and blocks' },
        defaultColors: { bgColor: '#f5c518', elementColor: '#e63946', accentLightColor: '#ffffff', lightingColor: '#f5c518' },
        prompt: (logoSymbol) => `bright warm yellow (#f5c518) studio gradient background with soft even lighting, photorealistic 3D environment, the provided ${logoSymbol} cryptocurrency logo symbol as a single cohesive 3D unit maintaining its original layout and letter spacing — the entire logo is rendered in chunky solid 3D matte-to-slightly-glossy red (#e63946) plastic material, the plastic has subtle surface texture like injection-molded toy plastic, rounded soft edges with substantial depth and weight, soft studio lighting creating clean diffused highlights and gentle ambient shadows, the logo casts a soft shadow on the studio floor, floating {{3D_ELEMENTS}} in matching solid plastic material, clean minimal toy-like commercial aesthetic, product photography style, CRITICAL: keep the logo text and icon in their correct original positions and alignment — do NOT scatter or rearrange the letters, the logo must read correctly as one unit but without a flat backing plate behind it, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '33_faceted_gem_stars': {
        id: '33_faceted_gem_stars',
        name: 'Faceted Gem Stars',
        description: 'Deep faceted gemstone logo with internal galaxy reflections and sparkle stars',
        filename: '33_faceted_gem_stars.png',
        category: 'premium',
        customSubject: { enabled: true, placeholder: 'e.g., crystals, meteorites, jewels...', defaultSubject: 'tiny sparkling star points and crystal dust' },
        defaultColors: { bgColor: '#000000', elementColor: '#b76e79', accentLightColor: '#00cec9', lightingColor: '#d4a754' },
        prompt: (logoSymbol) => `pure black void background, dramatic cinematic lighting, photorealistic 3D environment, the provided ${logoSymbol} cryptocurrency logo symbol rendered where each individual letter and icon element of the logo is made FROM faceted precious gemstone material — the surface of every letter and icon piece is covered in dozens of angular crystal facets like a cut diamond, transparent gem material with internal reflections showing galaxy-like depth with warm rose gold copper teal and subtle pink light refracting through, each facet catches light creating brilliant prismatic fire and spectral dispersion, the letters and icon float freely as individual 3D gemstone pieces — do NOT place the logo inside a gem shape or encase it in a crystal, the logo IS the gem, scattered {{3D_ELEMENTS}} floating around — tiny bright four-pointed sparkle stars and glowing light points at varying distances creating a magical atmosphere, some facets show warm amber light others cool teal creating beautiful contrast, CRITICAL: the logo shape itself has faceted gem surfaces applied directly to it — NOT the logo placed inside or on top of a separate gemstone object, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '34_glass_color_fill': {
        id: '34_glass_color_fill',
        name: 'Glass Color Fill',
        description: 'Clear glossy glass shell filled with vivid color underneath on dark background',
        filename: '34_glass_color_fill.png',
        category: 'glass',
        customSubject: { enabled: true, placeholder: 'e.g., drops, spheres, discs...', defaultSubject: 'glass drops and rounded glass pieces' },
        defaultColors: { bgColor: '#2a2a2a', elementColor: '#cc0000', accentLightColor: '#ffffff', lightingColor: '#444444' },
        prompt: (logoSymbol) => `dark charcoal grey (#2a2a2a) background with subtle gradient, soft cinematic studio lighting, photorealistic 3D environment, the provided ${logoSymbol} cryptocurrency logo symbol as a single cohesive 3D unit maintaining its original layout and letter spacing — the entire logo is rendered with a clear transparent glass outer shell layered over a vivid red (#cc0000) opaque color fill underneath, the glass surface is smooth glossy and reflective with bright specular highlights, the red color beneath the glass is rich and saturated visible through the transparent layer creating a candy-like depth effect, soft rounded edges with substantial thickness, floating {{3D_ELEMENTS}} in matching glass-over-color material, soft ambient lighting with clean reflections, CRITICAL: keep the logo text and icon in their correct original positions and alignment — do NOT scatter or rearrange the letters, the logo must read correctly as one unit but without a flat backing plate behind it, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '35_chrome_rim_glass': {
        id: '35_chrome_rim_glass',
        name: 'Chrome Rim Glass',
        description: 'Deeply extruded 3D glass logo with mirror chrome extrusion edges and dramatic backlighting',
        filename: '35_chrome_rim_glass.png',
        category: 'premium',
        customSubject: { enabled: true, placeholder: 'e.g., rings, arcs, blades...', defaultSubject: 'chrome and glass accent pieces' },
        defaultColors: { bgColor: '#000000', elementColor: '#c0c0c0', accentLightColor: '#ffffff', lightingColor: '#e8e8e8' },
        prompt: (logoSymbol) => `pure black void background, dramatic backlight from behind creating strong edge glow, photorealistic 3D environment, the provided ${logoSymbol} cryptocurrency logo symbol rendered as a deeply extruded thick 3D form with significant depth — the front face is clear transparent glass with subtle reflections and slight environment mapping, the extruded side walls (the depth edge visible from a slight angle) are polished mirror chrome metal showing brilliant reflections, the extrusion is deep giving the logo substantial 3D thickness like a glass block with chrome sides, sharp but slightly rounded corners along the perimeter of the logo shape, dramatic white backlight creating a bright glow behind the chrome edges, neutral color palette — no pink no magenta no colored tints — only clean whites silvers and natural chrome reflections, the glass front catches subtle horizontal light streaks, floating {{3D_ELEMENTS}} in matching chrome and glass materials, premium luxury tech product aesthetic, minimal and refined, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, no pink lighting, no magenta`
      },

      '36_neon_core_glass': {
        id: '36_neon_core_glass',
        name: 'Neon Core Glass',
        description: 'Dark glass shell with intense neon inner glow on industrial background',
        filename: '36_neon_core_glass.png',
        category: 'neon',
        customSubject: { enabled: true, placeholder: 'e.g., pipes, cables, circuits...', defaultSubject: 'industrial metal accent pieces and glowing particles' },
        defaultColors: { bgColor: '#1a1a1a', elementColor: '#ff3300', accentLightColor: '#ff6600', lightingColor: '#331111' },
        prompt: (logoSymbol) => `dark industrial concrete wall background with subtle metal panel texture and small rivets, moody cinematic lighting, photorealistic 3D environment, the provided ${logoSymbol} cryptocurrency logo symbol where each individual letter and icon element is rendered as its own thick 3D piece with a dark matte rounded bezel housing that follows the exact contour of the logo shape — like a padded channel letter sign casing, the front face of each piece is covered in subtly frosted diffused glass with a slight haze texture, behind the frosted glass front a brilliant intense neon red-orange (#ff3300) light glows from inside illuminating through the diffused surface creating a warm backlit effect, the dark rounded bezel wraps around the edges like a deep frame in the shape of each character, multiple concentric rounded ridges visible on the bezel edges adding depth, the neon light bleeds and scatters softly through the frosted glass front, strong neon light casting warm red-orange glow and reflections onto the concrete wall behind and the glossy floor beneath, floating {{3D_ELEMENTS}} in matching dark housing with inner glow scattered around, dramatic contrast between the dark environment and the intense neon core behind frosted glass, the housing follows the logo shape exactly — it IS the logo shape not a separate addition around it, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      }
    };

    // Material definitions for logo material override dropdown
    this.materialDefinitions = {
      'frosted_glass': {
        label: 'Frosted Glass',
        promptText: 'frosted glass material'
      },
      'crystal_glass': {
        label: 'Crystal Glass',
        promptText: 'iridescent crystal glass with rainbow refractions'
      },
      'mirror_chrome': {
        label: 'Mirror Chrome',
        promptText: 'bright polished mirror chrome with strong highlights'
      },
      'matte_ceramic': {
        label: 'Matte Ceramic',
        promptText: 'matte ceramic with subtle gloss edges'
      },
      'liquid_mercury': {
        label: 'Liquid Mercury',
        promptText: 'liquid mercury mirror chrome with perfect mirror reflections'
      },
      'beveled_crystal': {
        label: 'Beveled Crystal',
        promptText: 'beveled crystal glass with strong specular highlights'
      },
      'edge_lit_glass': {
        label: 'Edge-Lit Glass',
        promptText: 'edge-lit glass with soft ambient glow'
      },
      'platinum_chrome': {
        label: 'Platinum Chrome',
        promptText: 'polished platinum chrome with iridescent reflections'
      },
      'brushed_metal': {
        label: 'Brushed Metal',
        promptText: 'brushed metal with warm directional highlights'
      }
    };

    logger.info(`🎨 Style Catalog initialized with ${Object.keys(this.styles).length} curated styles`);
  }

  /**
   * Get all styles with sample image URLs
   */
  getAllStyles() {
    // Use API endpoint to serve images (works with local files or Supabase)
    return Object.values(this.styles).map(style => ({
      id: style.id,
      name: style.name,
      description: style.description,
      category: style.category,
      sampleImageUrl: `${this.baseUrl}/api/style-catalog/image/${style.id}?v=2`,
      // Supabase URL as backup when manually uploaded
      supabaseUrl: `${this.supabaseStorageUrl}/${style.filename}`,
      filename: style.filename,
      customSubject: style.customSubject || null,
      defaultColors: style.defaultColors || null,
      patternOptions: style.patternOptions?.enabled ? {
        enabled: true,
        defaultPattern: style.patternOptions.defaultPattern,
        defaultColor: style.patternOptions.defaultColor,
        patterns: Object.values(style.patternOptions.patterns).map(p => ({
          id: p.id,
          name: p.name,
          description: p.description
        }))
      } : null
    }));
  }

  /**
   * Get styles by category
   */
  getStylesByCategory(category) {
    return this.getAllStyles().filter(style => style.category === category);
  }

  /**
   * Get available categories with counts
   */
  getCategories() {
    const categoryCounts = {};
    for (const style of Object.values(this.styles)) {
      categoryCounts[style.category] = (categoryCounts[style.category] || 0) + 1;
    }
    return Object.entries(categoryCounts).map(([id, count]) => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      styleCount: count
    }));
  }

  /**
   * Get a specific style by ID
   */
  getStyle(styleId) {
    const style = this.styles[styleId];
    if (!style) return null;

    const result = {
      id: style.id,
      name: style.name,
      description: style.description,
      category: style.category,
      sampleImageUrl: `${this.supabaseStorageUrl}/${style.filename}`,
      filename: style.filename
    };

    if (style.patternOptions?.enabled) {
      result.patternOptions = {
        enabled: true,
        defaultPattern: style.patternOptions.defaultPattern,
        defaultColor: style.patternOptions.defaultColor,
        patterns: Object.values(style.patternOptions.patterns).map(p => ({
          id: p.id,
          name: p.name,
          description: p.description
        }))
      };
    }

    return result;
  }

  /**
   * Get the exact Wavespeed prompt for a style
   * @param {string} styleId - The style identifier
   * @param {string} logoSymbol - The cryptocurrency symbol (e.g., 'BTC')
   * @param {object|null} colorOverrides - Optional color overrides: { bgColor, elementColor, accentLightColor }
   * @param {string|null} customSubject - Optional custom 3D subject to replace default objects (banks, hands, etc.)
   * @param {object|null} logoOverrides - Optional logo overrides: { logoMaterial, logoBaseColor, logoAccentLight }
   */
  getStylePrompt(styleId, logoSymbol, colorOverrides = null, customSubject = null, logoOverrides = null, patternOverrides = null) {
    const style = this.styles[styleId];
    if (!style) {
      logger.warn(`Style not found: ${styleId}, using default`);
      const firstStyle = Object.values(this.styles)[0];
      return firstStyle.prompt(logoSymbol);
    }

    let prompt = style.prompt(logoSymbol);

    if (style.patternOptions?.enabled) {
      const patternId = patternOverrides?.patternId || style.patternOptions.defaultPattern;
      const patternColor = patternOverrides?.patternColor || style.patternOptions.defaultColor;
      const pattern = style.patternOptions.patterns[patternId];
      let patternText = '';
      if (pattern && pattern.prompt) {
        patternText = typeof pattern.prompt === 'function' ? pattern.prompt(patternColor) : pattern.prompt;
      }
      prompt = prompt.replace('{{PATTERN_PLACEHOLDER}}', patternText);
      logger.info(`🎨 Pattern: ${patternId} | Color: ${patternColor}`);
    } else {
      prompt = prompt.replace('{{PATTERN_PLACEHOLDER}}', '');
    }

    if (customSubject && style.customSubject?.enabled) {
      const subject = customSubject.trim();
      prompt = prompt.replace('{{3D_ELEMENTS}}', subject);
      prompt += `. IMPORTANT 3D ELEMENTS: You MUST include multiple visible ${subject} floating around the scene as secondary 3D objects — these are separate from the main logo and must be clearly rendered at various sizes and positions.`;
      logger.info(`🎨 Custom subject "${subject}" replacing defaults in style ${styleId}`);
    } else if (style.customSubject?.defaultSubject) {
      prompt = prompt.replace('{{3D_ELEMENTS}}', style.customSubject.defaultSubject);
    } else {
      prompt = prompt.replace('{{3D_ELEMENTS}}', '');
    }

    // LOGO OVERRIDES: Apply logo-specific changes BEFORE scene color overrides
    // Supports both legacy single-object format and new per-logo array format
    const isPerLogoArray = Array.isArray(logoOverrides);
    if (logoOverrides && !isPerLogoArray) {
      const { logoMaterial, logoBaseColor, logoAccentLight } = logoOverrides;
      const isOgColor = logoMaterial === 'og_color';

      if (isOgColor) {
        logger.info(`🎨 OG Color mode: preserving original logo colors, 3D effect only`);
      } else {
        if (logoMaterial && logoMaterial !== 'default') {
          prompt = this._replaceLogoMaterial(prompt, logoMaterial);
          logger.info(`🎨 Logo material: ${logoMaterial}`);
        }

        if (logoBaseColor) {
          prompt = this._replaceLogoBaseColor(prompt, logoBaseColor);
          logger.info(`🎨 Logo base color: ${logoBaseColor}`);
        }

        if (logoAccentLight) {
          prompt = this._replaceLogoAccentLight(prompt, logoAccentLight);
          logger.info(`🎨 Logo accent light: ${logoAccentLight}`);
        }
      }
    }

    // Apply color overrides if provided
    if (colorOverrides) {
      const { bgColor, elementColor, accentLightColor, lightingColor } = colorOverrides;

      // PASS 1: Background color
      if (bgColor) {
        prompt = this._replaceBackgroundColor(prompt, bgColor);
        logger.info(`🎨 Background color: ${bgColor}`);
      }

      // PASS 2: Element color (shapes, coins, objects)
      if (elementColor) {
        prompt = this._replaceElementColor(prompt, elementColor);
        logger.info(`🎨 Element color: ${elementColor}`);
      }

      // PASS 3: Accent lighting color (rim, glow, neon)
      if (accentLightColor) {
        prompt = this._replaceAccentLightColor(prompt, accentLightColor);
        logger.info(`🎨 Accent light color: ${accentLightColor}`);
      }

      // PASS 4: Lighting color (scene glow, reflections, rim light)
      if (lightingColor) {
        logger.info(`🎨 Lighting color: ${lightingColor}`);
      }

      // Append targeted color directives per channel
      const directives = [];
      if (bgColor) directives.push(`The background/void color is ${bgColor}`);
      if (elementColor) directives.push(`The primary color for all 3D elements, geometric shapes, flat color sections, coins, and objects is ${elementColor} - make these elements prominently ${elementColor}`);
      if (accentLightColor) directives.push(`The accent lighting color for rim lights, ambient glow, inner glow, neon effects, and edge lighting is ${accentLightColor}`);
      if (lightingColor) directives.push(`The scene lighting, volumetric glow, light reflections on surfaces, specular highlights, and rim light color is ${lightingColor} - cast ${lightingColor} tinted light across the entire scene`);
      if (directives.length > 0) {
        prompt += `. IMPORTANT: ${directives.join('. ')}.`;
      }
    }

    // Append logo-specific directives
    const logoDirectives = [];
    if (isPerLogoArray && logoOverrides.length > 0) {
      logoOverrides.forEach((lo) => {
        const parts = [];
        const sym = lo.symbol || 'logo';
        const isOg = lo.logoMaterial === 'og_color';
        if (isOg) {
          parts.push(`preserve the EXACT original brand colors from the input image — match the precise color distribution where each part of the logo keeps its original color (if the icon has a gradient but the text is white, keep that exact split). Do NOT apply any color uniformly across the whole logo. Do NOT spread a gradient to parts that were originally solid colored. Render as 3D with depth and lighting but the color of every pixel must match the original input`);
        } else {
          if (lo.logoMaterial && lo.logoMaterial !== 'default') {
            const mat = this.materialDefinitions[lo.logoMaterial];
            if (mat) parts.push(`material: ${mat.label}`);
          }
          if (lo.logoBaseColor) {
            parts.push(`surface color: ${lo.logoBaseColor}`);
          }
          if (lo.logoAccentLight) {
            parts.push(`glow/edge light: ${lo.logoAccentLight}`);
          }
        }
        if (parts.length > 0) {
          logoDirectives.push(`${sym}: ${parts.join(', ')}`);
          logger.info(`🎨 Per-logo override for ${sym}: ${parts.join(', ')}`);
        }
      });
    } else if (logoOverrides && !isPerLogoArray) {
      const isOgColor = logoOverrides.logoMaterial === 'og_color';
      if (isOgColor) {
        logoDirectives.push('CRITICAL: Preserve the EXACT original brand colors from the input image — match the precise color distribution where each part of the logo keeps its original color (if the icon has a gradient but the text is white, keep that exact split). Do NOT apply any color uniformly across the whole logo. Do NOT spread a gradient to parts that were originally solid colored. Render the logo as a 3D object with depth, lighting, and shadows but the color of every pixel must match the original input');
      } else {
        if (logoOverrides.logoMaterial && logoOverrides.logoMaterial !== 'default') {
          const mat = this.materialDefinitions[logoOverrides.logoMaterial];
          if (mat) logoDirectives.push(`The logo material is ${mat.label}`);
        }
        if (logoOverrides.logoBaseColor) {
          logoDirectives.push(`The logo surface color is ${logoOverrides.logoBaseColor} - make the logo material prominently ${logoOverrides.logoBaseColor}`);
        } else {
          logoDirectives.push('Preserve the original brand colors of the logo as much as possible');
        }
        if (logoOverrides.logoAccentLight) {
          logoDirectives.push(`The glow and lighting on the logo itself (inner glow, rim highlights, edge light) is ${logoOverrides.logoAccentLight}`);
        }
      }
    }
    if (logoDirectives.length > 0) {
      prompt += `. LOGO: ${logoDirectives.join('. ')}.`;
    }

    // Always append anti-spotlight directive
    prompt += ', absolutely no spotlights or directional spot lights of any kind - use only soft rim lighting, ambient glow, volumetric fog, and edge lighting';
    prompt += ', CRITICAL: the logo must float freely in the scene as a 3D object - absolutely NO rectangular frames, NO bounding boxes, NO square borders, NO card shapes, NO plaques, NO panels, NO glass screens, NO glass cards, NO rounded rectangle containers behind or around the logo, NO solid block behind the letters, NO unified slab or base connecting the letters - the logo letters and icon maintain their correct original positions and alignment reading as a cohesive word/brand but each character is its own 3D piece in the specified material WITHOUT a flat backing plate';

    return prompt;
  }

  /**
   * Replace logo material in the prompt using explicit phrase matching
   */
  _replaceLogoMaterial(prompt, materialKey) {
    const material = this.materialDefinitions[materialKey];
    if (!material) return prompt;

    // Special cases: styles where material is followed by important context that must be preserved
    // Style 27: "polished chrome floating above a pool of black magnetic ferrofluid liquid"
    prompt = prompt.replace(
      /polished chrome floating above/i,
      `${material.promptText} floating above`
    );
    // Style 19: "crystal clear glass emerging from a massive SHATTERED mirror plane"
    prompt = prompt.replace(
      /crystal clear glass emerging from/i,
      `${material.promptText} emerging from`
    );
    // Style 04: "edge-lit glass with minimal glass shards orbiting as accents"
    prompt = prompt.replace(
      /edge-lit glass with minimal glass shards/i,
      `${material.promptText} with minimal glass shards`
    );

    // All known material phrases, ordered longest first for precise matching
    const knownMaterials = [
      'LIQUID MERCURY MIRROR CHROME with perfect mirror reflections visible on every surface',
      'polished platinum chrome with iridescent multicolor reflections showing cyan blue purple and magenta hues',
      'polished chrome with RGB chromatic aberration color split effect on the edges showing red blue green separation',
      'bright frosted glass with purple inner glow like a glowing holographic material',
      'crystal clear holographic glass with rainbow refractions',
      'bright polished mirror chrome with strong white highlights clearly visible and well-lit',
      'bright polished mirror chrome with strong white highlights clearly visible',
      'perfect MIRROR CHROME with flawless reflective surface showing environment reflections',
      'medium size frosted glass material with purple inner glow centered in the composition',
      'bright frosted glass with purple inner glow well-lit and clearly visible',
      'polished chrome with floating abstract glass shapes as accents',
      'beveled crystal glass with strong specular highlights',
      'iridescent crystal glass with rainbow refractions',
      'frosted glass with purple inner glow floating at center',
      'crystal glass with holographic prism edges',
      'matte ceramic white with subtle gloss edges',
      'polished metal with layered depth lighting',
      'smooth chrome with restrained neon edge accents',
      'clear glass outline with inner glow'
    ];

    for (const original of knownMaterials) {
      if (prompt.toLowerCase().includes(original.toLowerCase())) {
        const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        prompt = prompt.replace(new RegExp(escaped, 'i'), material.promptText);
        break; // Only one material per prompt
      }
    }

    return prompt;
  }

  /**
   * Replace logo base/surface color in the prompt
   */
  _replaceLogoBaseColor(prompt, logoBaseColor) {
    // Inject color before chrome material keywords
    prompt = prompt.replace(/\bmirror chrome\b/gi, `${logoBaseColor} mirror chrome`);
    prompt = prompt.replace(/\bMIRROR CHROME\b/g, `${logoBaseColor.toUpperCase()} MIRROR CHROME`);
    prompt = prompt.replace(/\bpolished chrome\b/gi, `${logoBaseColor} polished chrome`);
    prompt = prompt.replace(/\bpolished metal\b/gi, `${logoBaseColor} polished metal`);
    prompt = prompt.replace(/\bsmooth chrome\b/gi, `${logoBaseColor} smooth chrome`);
    prompt = prompt.replace(/\bplatinum chrome\b/gi, `${logoBaseColor} platinum chrome`);
    prompt = prompt.replace(/\bbrushed metal\b/gi, `${logoBaseColor} brushed metal`);
    prompt = prompt.replace(/\bliquid mercury\b/gi, `${logoBaseColor} liquid mercury`);

    // Inject color before glass material keywords
    prompt = prompt.replace(/\bfrosted glass\b/gi, `${logoBaseColor} frosted glass`);
    prompt = prompt.replace(/\bcrystal glass\b/gi, `${logoBaseColor} crystal glass`);
    prompt = prompt.replace(/\bclear glass\b/gi, `${logoBaseColor} tinted glass`);
    prompt = prompt.replace(/\bedge-lit glass\b/gi, `${logoBaseColor} edge-lit glass`);
    prompt = prompt.replace(/\bbeveled crystal\b/gi, `${logoBaseColor} beveled crystal`);
    prompt = prompt.replace(/\bholographic glass\b/gi, `${logoBaseColor} holographic glass`);

    // Handle ceramic: replace "white" with the color
    prompt = prompt.replace(/\bmatte ceramic white\b/gi, `matte ceramic ${logoBaseColor}`);
    prompt = prompt.replace(/\bmatte ceramic\b/gi, `${logoBaseColor} matte ceramic`);

    return prompt;
  }

  /**
   * Replace logo-specific lighting/glow effects in the prompt
   */
  _replaceLogoAccentLight(prompt, logoAccentLight) {
    // Logo-specific inner glow (inside the material description)
    prompt = prompt.replace(/\bpurple inner glow\b/gi, `${logoAccentLight} inner glow`);
    prompt = prompt.replace(/\bwith inner glow\b/gi, `with ${logoAccentLight} inner glow`);

    // Logo-specific edge/rim on the logo itself
    prompt = prompt.replace(/\bneon edge accents\b/gi, `${logoAccentLight} neon edge accents`);
    prompt = prompt.replace(/\bstrong white highlights\b/gi, `strong ${logoAccentLight} highlights`);
    prompt = prompt.replace(/\bspecular highlights\b/gi, `${logoAccentLight} specular highlights`);

    // Prismatic rim on logo
    prompt = prompt.replace(/\bprismatic rim light\b/gi, `${logoAccentLight} rim light`);
    prompt = prompt.replace(/\bedge glow\b/gi, `${logoAccentLight} edge glow`);

    // Rainbow/spectral on logo
    prompt = prompt.replace(/\brainbow refractions\b/gi, `${logoAccentLight} refractions`);
    prompt = prompt.replace(/\brainbow refraction\b/gi, `${logoAccentLight} refraction`);

    return prompt;
  }

  /**
   * Replace background/void color references in the prompt
   */
  _replaceBackgroundColor(prompt, bgColor) {
    // Specific background descriptions
    prompt = prompt.replace(/pure black void background/gi, `${bgColor} void background`);
    prompt = prompt.replace(/absolute black void background/gi, `${bgColor} void background`);
    prompt = prompt.replace(/deep black void background/gi, `deep ${bgColor} void background`);
    prompt = prompt.replace(/deep black void\b/gi, `deep ${bgColor} void`);
    prompt = prompt.replace(/deep black environment/gi, `deep ${bgColor} environment`);
    prompt = prompt.replace(/absolute black void\b/gi, `${bgColor} void`);
    prompt = prompt.replace(/ultra-clean pure black void/gi, `ultra-clean ${bgColor} void`);

    // Colored studio/gradient backgrounds
    prompt = prompt.replace(/bright vivid purple \(#[0-9a-fA-F]{6}\) studio background/gi, `${bgColor} studio background`);
    prompt = prompt.replace(/bright lime green \(#[0-9a-fA-F]{6}\) gradient background/gi, `${bgColor} gradient background`);
    prompt = prompt.replace(/the entire background is lime green colored/gi, `the entire background is ${bgColor} colored`);
    prompt = prompt.replace(/lime green backdrop/gi, `${bgColor} backdrop`);
    prompt = prompt.replace(/lime green background/gi, `${bgColor} background`);

    // Atmospheric/gradient backgrounds
    prompt = prompt.replace(/ethereal purple-violet gradient/gi, `${bgColor} gradient`);
    prompt = prompt.replace(/deep cosmic purple void/gi, `deep ${bgColor} void`);
    prompt = prompt.replace(/deep navy blue void/gi, `deep ${bgColor} void`);
    prompt = prompt.replace(/infinite deep blue void/gi, `infinite ${bgColor} void`);
    prompt = prompt.replace(/deep forest green gradient with dark undertones/gi, `${bgColor} gradient with dark undertones`);
    prompt = prompt.replace(/iridescent holographic void/gi, `${bgColor} void`);
    prompt = prompt.replace(/sophisticated charcoal grey gradient/gi, `${bgColor} gradient`);
    prompt = prompt.replace(/dark atmospheric trading environment/gi, `${bgColor} atmospheric trading environment`);

    prompt = prompt.replace(/deep black void with rich violet accent gradients/gi, `deep ${bgColor} void with rich accent gradients`);
    prompt = prompt.replace(/deep black void with sharp neon accent edges/gi, `deep ${bgColor} void with sharp neon accent edges`);
    prompt = prompt.replace(/against bright purple background/gi, `against ${bgColor} background`);
    prompt = prompt.replace(/against the lime green backdrop/gi, `against the ${bgColor} backdrop`);
    prompt = prompt.replace(/reflecting the navy background/gi, `reflecting the ${bgColor} background`);
    prompt = prompt.replace(/reflecting the purple background/gi, `reflecting the ${bgColor} background`);

    prompt = prompt.replace(/dark moody atmospheric environment with deep navy blue to dark purple gradient background/gi, `${bgColor} atmospheric environment`);
    prompt = prompt.replace(/soft purple \(#[0-9a-fA-F]{6}\) studio gradient background/gi, `${bgColor} studio gradient background`);
    prompt = prompt.replace(/bright warm yellow \(#[0-9a-fA-F]{6}\) studio gradient background/gi, `${bgColor} studio gradient background`);
    prompt = prompt.replace(/dark charcoal grey \(#[0-9a-fA-F]{6}\) background/gi, `${bgColor} background`);
    prompt = prompt.replace(/#9b8ec4/gi, bgColor);
    prompt = prompt.replace(/#f5c518/gi, bgColor);
    prompt = prompt.replace(/#2a2a2a/gi, bgColor);
    prompt = prompt.replace(/#1a1a1a/gi, bgColor);
    prompt = prompt.replace(/dark industrial concrete wall background/gi, `${bgColor} industrial wall background`);
    prompt = prompt.replace(/#331111/gi, bgColor);

    return prompt;
  }

  /**
   * Replace element/shape/object color references in the prompt
   */
  _replaceElementColor(prompt, elementColor) {
    // "color_name (#hex) element" patterns - most specific first
    prompt = prompt.replace(/lime green \(#[0-9a-fA-F]{6}\) flat rounded square pattern/gi, `${elementColor} flat rounded square pattern`);
    prompt = prompt.replace(/lime green \(#[0-9a-fA-F]{6}\) plastic coins/gi, `${elementColor} plastic coins`);
    prompt = prompt.replace(/lime green \(#[0-9a-fA-F]{6}\) digital noise particles/gi, `${elementColor} digital noise particles`);
    prompt = prompt.replace(/lime green \(#[0-9a-fA-F]{6}\) flames/gi, `${elementColor} flames`);
    prompt = prompt.replace(/lime green \(#[0-9a-fA-F]{6}\) accents/gi, `${elementColor} accents`);
    prompt = prompt.replace(/lime green \(#[0-9a-fA-F]{6}\) light reflections/gi, `${elementColor} light reflections`);
    prompt = prompt.replace(/lime green \(#[0-9a-fA-F]{6}\) catching light/gi, `${elementColor} catching light`);
    prompt = prompt.replace(/lime green \(#[0-9a-fA-F]{6}\)/gi, elementColor);

    // Flat graphic element patterns
    prompt = prompt.replace(/flat bright purple \(#[0-9a-fA-F]{6}\) geometric shapes/gi, `flat bright ${elementColor} geometric shapes`);
    prompt = prompt.replace(/flat bright magenta \(#[0-9a-fA-F]{6}\) geometric shapes/gi, `flat bright ${elementColor} geometric shapes`);
    prompt = prompt.replace(/bright purple \(#[0-9a-fA-F]{6}\) geometric shapes/gi, `bright ${elementColor} geometric shapes`);
    prompt = prompt.replace(/bold flat bright magenta \(#[0-9a-fA-F]{6}\)/gi, `bold flat bright ${elementColor}`);

    // Standalone element color words
    prompt = prompt.replace(/\bmatte lime green\b/gi, `matte ${elementColor}`);
    prompt = prompt.replace(/\blime green\b(?!\s*(?:background|backdrop|gradient|void|studio|colored))/gi, elementColor);
    prompt = prompt.replace(/\bexplosive black ink splashes\b/gi, `explosive ${elementColor} ink splashes`);
    prompt = prompt.replace(/\bblack ink splashes\b/gi, `${elementColor} ink splashes`);
    prompt = prompt.replace(/\bblack ink\b(?!\s*against)/gi, `${elementColor} ink`);
    prompt = prompt.replace(/\bthe flat purple graphic elements\b/gi, `the flat ${elementColor} graphic elements`);
    prompt = prompt.replace(/\bcatching purple light reflections\b/gi, `catching ${elementColor} light reflections`);
    prompt = prompt.replace(/\bcatching colored light\b/gi, `catching ${elementColor} light`);
    prompt = prompt.replace(/\bsome glass fragments tinted with\b/gi, `some glass fragments tinted with ${elementColor} and`);
    prompt = prompt.replace(/\bsome ink splashes tinted with deeper purple and\b/gi, `some ink splashes tinted with deeper ${elementColor} and`);
    prompt = prompt.replace(/\band lime accents\b/gi, `and ${elementColor} accents`);

    prompt = prompt.replace(/#dbff03/gi, elementColor);
    prompt = prompt.replace(/#e91e63/gi, elementColor);
    prompt = prompt.replace(/#cc0000/gi, elementColor);
    prompt = prompt.replace(/#e63946/gi, elementColor);
    prompt = prompt.replace(/#f5a623/gi, elementColor);
    prompt = prompt.replace(/#b76e79/gi, elementColor);
    prompt = prompt.replace(/#ff3300/gi, elementColor);
    prompt = prompt.replace(/#ff6600/gi, elementColor);
    prompt = prompt.replace(/\bneon red-orange\b/gi, `neon ${elementColor}`);
    prompt = prompt.replace(/\bred-orange\b(?!\s*(?:background|void))/gi, elementColor);
    prompt = prompt.replace(/\bwarm red-orange glow\b/gi, `warm ${elementColor} glow`);
    prompt = prompt.replace(/\bhot molten core\b/gi, `hot ${elementColor} molten core`);

    prompt = prompt.replace(/\bvivid red\b/gi, elementColor);
    prompt = prompt.replace(/\bwarm orange-yellow\b/gi, elementColor);
    prompt = prompt.replace(/\bmatte-to-slightly-glossy red\b/gi, `matte-to-slightly-glossy ${elementColor}`);
    prompt = prompt.replace(/\bwarm rose gold copper teal\b/gi, elementColor);
    prompt = prompt.replace(/\bwarm amber and golden light\b/gi, `${elementColor} tinted light`);
    prompt = prompt.replace(/\bpastel iridescent reflections - pink lavender baby blue and peach\b/gi, `${elementColor} tinted iridescent reflections`);
    prompt = prompt.replace(/\bin magenta pink blue and warm cream colors\b/gi, `in ${elementColor} tinted colors`);

    return prompt;
  }

  /**
   * Replace accent lighting / rim glow / neon color references in the prompt
   */
  _replaceAccentLightColor(prompt, accentLightColor) {
    // Purple lighting patterns
    prompt = prompt.replace(/\bpurple accent highlights\b/gi, `${accentLightColor} accent highlights`);
    prompt = prompt.replace(/\bpurple inner glow\b/gi, `${accentLightColor} inner glow`);
    prompt = prompt.replace(/\bpurple tinted reflections\b/gi, `${accentLightColor} tinted reflections`);
    prompt = prompt.replace(/\bpurple and magenta ambient glow\b/gi, `${accentLightColor} ambient glow`);
    prompt = prompt.replace(/\bpurple and magenta light refractions\b/gi, `${accentLightColor} light refractions`);
    prompt = prompt.replace(/\bpurple rim accents\b/gi, `${accentLightColor} rim accents`);
    prompt = prompt.replace(/\bpurple rim\b/gi, `${accentLightColor} rim`);
    prompt = prompt.replace(/\bpurple highlights\b/gi, `${accentLightColor} highlights`);
    prompt = prompt.replace(/\bpurple neon accent lighting\b/gi, `${accentLightColor} neon accent lighting`);
    prompt = prompt.replace(/\bpurple neon\b/gi, `${accentLightColor} neon`);
    prompt = prompt.replace(/\bpurple light\b/gi, `${accentLightColor} light`);
    prompt = prompt.replace(/\bpurple volumetric light rays\b/gi, `${accentLightColor} volumetric light rays`);
    prompt = prompt.replace(/\bpurple volumetric\b/gi, `${accentLightColor} volumetric`);
    prompt = prompt.replace(/\bpurple ambient\b/gi, `${accentLightColor} ambient`);
    prompt = prompt.replace(/\bpurple accent rim lights\b/gi, `${accentLightColor} accent rim lights`);

    // Neon glow patterns
    prompt = prompt.replace(/\bcyan neon glow\b/gi, `${accentLightColor} neon glow`);
    prompt = prompt.replace(/\bmagenta neon glow\b/gi, `${accentLightColor} neon glow`);
    prompt = prompt.replace(/\bcyan and magenta neon light\b/gi, `${accentLightColor} neon light`);
    prompt = prompt.replace(/\bcyan and magenta\b/gi, accentLightColor);
    prompt = prompt.replace(/\bmagenta and cyan accents\b/gi, `${accentLightColor} accents`);
    prompt = prompt.replace(/\bcyan and magenta accent lights\b/gi, `${accentLightColor} accent lights`);

    // Edge/rim lighting with color names
    prompt = prompt.replace(/\bneon cyan and pink accents\b/gi, `neon ${accentLightColor} accents`);
    prompt = prompt.replace(/\bcyan neon\b/gi, `${accentLightColor} neon`);
    prompt = prompt.replace(/\bmagenta accent\b/gi, `${accentLightColor} accent`);
    prompt = prompt.replace(/\bcyan accent\b/gi, `${accentLightColor} accent`);
    prompt = prompt.replace(/\bviolet accent\b/gi, `${accentLightColor} accent`);
    prompt = prompt.replace(/\bcyan blue purple and magenta hues\b/gi, `${accentLightColor} hues`);
    prompt = prompt.replace(/\bteal accent highlights\b/gi, `${accentLightColor} accent highlights`);

    // Purple/violet gradient lighting
    prompt = prompt.replace(/\bpurple-violet\b/gi, accentLightColor);
    prompt = prompt.replace(/\bdeeper purple\b/gi, `deeper ${accentLightColor}`);
    prompt = prompt.replace(/\bviolet accent gradients\b/gi, `${accentLightColor} accent gradients`);
    prompt = prompt.replace(/\bpurple mist\b/gi, `${accentLightColor} mist`);
    prompt = prompt.replace(/\bmysterious purple lighting with magenta highlights\b/gi, `mysterious ${accentLightColor} lighting with ${accentLightColor} highlights`);
    prompt = prompt.replace(/\bsoft diffused purple lighting with gentle violet undertones\b/gi, `soft diffused ${accentLightColor} lighting with gentle ${accentLightColor} undertones`);
    prompt = prompt.replace(/\bvivid purple rim accents\b/gi, `vivid ${accentLightColor} rim accents`);
    prompt = prompt.replace(/\bpurple accent\b/gi, `${accentLightColor} accent`);

    prompt = prompt.replace(/#9b59b6/gi, accentLightColor);

    prompt = prompt.replace(/\bvivid magenta and electric blue neon light\b/gi, `vivid ${accentLightColor} neon light`);
    prompt = prompt.replace(/\bbright glowing neon tube material with vivid magenta and electric blue\b/gi, `bright glowing neon tube material with vivid ${accentLightColor}`);
    prompt = prompt.replace(/\bwarm amber and golden light refracting\b/gi, `${accentLightColor} light refracting`);
    prompt = prompt.replace(/\bbrilliant white and subtle pink light reflections\b/gi, `brilliant ${accentLightColor} light reflections`);
    prompt = prompt.replace(/\bcontrasting purple glossy plastic outline\b/gi, `contrasting ${accentLightColor} glossy plastic outline`);
    prompt = prompt.replace(/\bsubt le pink light\b/gi, `${accentLightColor} light`);

    return prompt;
  }

  /**
   * Search styles by keyword
   */
  searchStyles(query) {
    const lowerQuery = query.toLowerCase();
    return this.getAllStyles().filter(style =>
      style.name.toLowerCase().includes(lowerQuery) ||
      style.description.toLowerCase().includes(lowerQuery) ||
      style.category.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Check if all sample images exist
   */
  validateSampleImages() {
    const results = [];
    for (const style of Object.values(this.styles)) {
      const imagePath = path.join(this.styleExamplesPath, style.filename);
      const exists = fs.existsSync(imagePath);
      results.push({
        id: style.id,
        filename: style.filename,
        exists
      });
    }
    return results;
  }
}

module.exports = StyleCatalogService;
