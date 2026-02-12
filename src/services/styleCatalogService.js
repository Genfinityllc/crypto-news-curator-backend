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
        prompt: (logoSymbol) => `infinite deep blue void with subtle atmospheric depth, soft volumetric fog, gentle light rays piercing darkness, soft cinematic blue with cool undertones and professional depth, photorealistic 3D environment with cinematic depth and professional atmosphere, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in iridescent crystal glass with rainbow refractions, clean rim lighting, subtle spectral reflections on edges, luxury 3D CGI product render, floating abstract glass prisms and geometric shards as background accents, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, only ONE logo - do not repeat or duplicate the logo, cinematic composition with professional lighting, 8k resolution, ultra-detailed, professional product photography, no text or typography, Octane render, Cinema 4D quality, premium 3D CGI product render`
      },

      '02_glass_banks_lime': {
        id: '02_glass_banks_lime',
        name: 'Glass Banks',
        description: 'Frosted glass logo with crystal bank buildings and lime accent pattern',
        filename: '02_glass_banks_lime_pattern.png',
        category: 'architectural',
        customSubject: { enabled: true, placeholder: 'e.g., rockets, skyscrapers, pyramids...', defaultSubject: 'bank buildings' },
        prompt: (logoSymbol) => `pure black void background, soft cinematic rim lighting with purple accent highlights, photorealistic 3D environment, the provided cryptocurrency logo symbol rendered in medium size frosted glass material with purple inner glow centered in the composition, translucent 3D crystal glass bank buildings reaching into the frame from the edges - classical bank architecture with columns and facades rendered entirely in clear crystal glass material matching the hands style from before, the glass banks are see-through with realistic light refractions and purple tinted reflections, 2-3 small glass bank buildings positioned around the edges of frame, BEHIND all 3D elements as a background layer: lime green (#dbff03) flat graphic design pattern in the bottom-left corner and bottom-right corner, the pattern is like an iOS app icon grid - rounded rectangles of VARYING sizes arranged loosely with thin dark gaps between them, some shapes are small squares some are wider rectangles some are taller rectangles creating an irregular mosaic, occasionally two neighboring shapes merge into one larger combined shape with no gap between them like two app icons fused together, the pattern sits BEHIND and UNDERNEATH the 3D glass elements, roughly 15-20 percent of frame in the corners extending off-edge, shallow depth of field, the logo crafted from premium frosted glass material with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, no hands`
      },

      '03_neon_glass_dynamic': {
        id: '03_neon_glass_dynamic',
        name: 'Neon Glass Dynamic',
        description: 'Mirror chrome logo with cyan/magenta neon split lighting and floating glass cubes',
        filename: '03_neon_glass_dynamic.png',
        category: 'neon',
        prompt: (logoSymbol) => `deep black environment with soft cinematic rim lighting, cyan neon glow on the left side and magenta neon glow on the right side creating split lighting, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered in bright polished mirror chrome with strong white highlights clearly visible and well-lit, a few sleek neon light tubes in the background creating geometric accent lines but not overwhelming, glossy black mirror floor with logo reflection, many floating 3D glass cubes prisms and rectangular blocks of varying sizes scattered dynamically around the logo at different depths and angles, the glass shapes catch and refract the cyan and magenta neon light beautifully, some glass elements larger in foreground some smaller in background creating depth, the 3D elements add visual complexity and movement, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '04_glass_shard_orbit': {
        id: '04_glass_shard_orbit',
        name: 'Glass Shard Orbit',
        description: 'Edge-lit glass logo with minimal glass shards orbiting on pure dark background',
        filename: '04_glass_shard_orbit_pure_dark_minimal.png',
        category: 'minimal',
        prompt: (logoSymbol) => `ultra-clean pure black void with infinite depth, absolute minimal environment, focus entirely on subject, precise rim lighting with subtle fill, stark contrast, photorealistic 3D environment with cinematic depth and professional atmosphere, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in edge-lit glass with minimal glass shards orbiting as accents, soft ambient fill, clean futuristic mood, subtle glass orbs and spheres at varying depths creating dimension, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, only ONE logo - do not repeat or duplicate the logo, cinematic composition with professional lighting, 8k resolution, ultra-detailed, professional product photography, no text or typography, Octane render, Cinema 4D quality, premium 3D CGI product render`
      },

      '05_holographic_prism': {
        id: '05_holographic_prism',
        name: 'Holographic Prism',
        description: 'Crystal glass with holographic prism edges on soft purple haze',
        filename: '05_holographic_prism_edges_soft_purple_haze.png',
        category: 'holographic',
        prompt: (logoSymbol) => `ethereal purple-violet gradient with dreamy atmosphere, soft bokeh orbs, gentle lens flare effects, soft diffused purple lighting with gentle violet undertones, photorealistic 3D environment with cinematic depth and professional atmosphere, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in crystal glass with holographic prism edges, prismatic rim light with soft ambient fill, rainbow refraction along edges, scattered glass coins featuring the logo at various angles and depths, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, only ONE logo - do not repeat or duplicate the logo, cinematic composition with professional lighting, 8k resolution, ultra-detailed, professional product photography, no text or typography, Octane render, Cinema 4D quality, premium 3D CGI product render`
      },

      '05b_lime_background': {
        id: '05b_lime_background',
        name: 'Lime Background Glass',
        description: 'Holographic glass logo on bright lime green studio backdrop',
        filename: '05b_lime_background_glass.png',
        category: 'colorful',
        prompt: (logoSymbol) => `bright lime green (#dbff03) gradient background similar to a soft studio backdrop, the entire background is lime green colored, soft dreamy lighting with subtle bokeh, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered in crystal clear holographic glass with rainbow refractions, floating glass shapes and curved glass elements around the scene, subtle glass surfaces creating depth, the logo and all elements are transparent crystal glass catching light against the lime green backdrop, soft lens flare and bokeh effects, the logo crafted from premium holographic glass material, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, lime green background`
      },

      '08_hands_frosted': {
        id: '08_hands_frosted',
        name: 'Glass Hands',
        description: 'Frosted glass logo with elegant crystal hands reaching from sides',
        filename: '08_hands_frosted_logo.png',
        category: 'conceptual',
        customSubject: { enabled: true, placeholder: 'e.g., wings, tentacles, claws...', defaultSubject: 'hands' },
        prompt: (logoSymbol) => `pure black void background, soft soft cinematic rim lighting with purple and magenta ambient glow, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered in bright frosted glass with purple inner glow like a glowing holographic material, exactly TWO elegant glass hands reaching toward and SLIGHTLY OVERLAPPING the logo from opposite sides - one hand from the left partially in front of the logo and one hand from the right partially in front of the logo, the hands are made of clear crystal glass with purple and magenta light refractions, hands positioned framing and slightly covering edges of the central logo creating depth, the glass hands have elegant sculpted form, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, only two hands total`
      },

      '10_ceramic_white': {
        id: '10_ceramic_white',
        name: 'Ceramic White',
        description: 'Matte ceramic white logo with holographic shimmer on iridescent background',
        filename: '10_ceramic_white_holographic_shimmer.png',
        category: 'premium',
        prompt: (logoSymbol) => `iridescent holographic void with color-shifting properties, rainbow prismatic effects, holographic texture hints, shifting spectral lighting with iridescent reflections, photorealistic 3D environment with cinematic depth and professional atmosphere, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in matte ceramic white with subtle gloss edges, soft cinematic key light with gentle rim, angular crystal formations emerging from the darkness, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, only ONE logo - do not repeat or duplicate the logo, cinematic composition with professional lighting, 8k resolution, ultra-detailed, professional product photography, no text or typography, Octane render, Cinema 4D quality, premium 3D CGI product render`
      },

      '13_digital_glitch': {
        id: '13_digital_glitch',
        name: 'Digital Glitch',
        description: 'Chrome logo with RGB chromatic aberration and cyberpunk glitch effects',
        filename: '13_digital_glitch_corruption.png',
        category: 'cyberpunk',
        prompt: (logoSymbol) => `pure black void background with subtle scan lines, cyberpunk ambient rim lighting, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol rendered in polished chrome with RGB chromatic aberration color split effect on the edges showing red blue green separation, digital glitch artifacts and pixel blocks scattered around the logo, horizontal scan lines and VHS distortion effects in the background, lime green (#dbff03) digital noise particles floating, purple neon accent lighting, the logo partially dissolving into digital pixels on one edge while remaining solid chrome on the other, cyberpunk data corruption aesthetic, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, no liquid, no melting`
      },

      '15_glass_outline': {
        id: '15_glass_outline',
        name: 'Glass Outline',
        description: 'Clear glass outline logo with inner glow on emerald depth background',
        filename: '15_glass_outline_logo_emerald_depth.png',
        category: 'glass',
        prompt: (logoSymbol) => `deep forest green gradient with dark undertones, subtle green mist, organic depth feeling, moody dark green lighting with teal accent highlights, photorealistic 3D environment with cinematic depth and professional atmosphere, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in clear glass outline with inner glow, edge glow with soft ambient fill, minimal neon aesthetic, floating hexagonal glass tiles creating depth layers, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, only ONE logo - do not repeat or duplicate the logo, cinematic composition with professional lighting, 8k resolution, ultra-detailed, professional product photography, no text or typography, Octane render, Cinema 4D quality, premium 3D CGI product render`
      },

      '16_ink_splash': {
        id: '16_ink_splash',
        name: 'Ink Splash Chrome',
        description: 'Liquid mercury chrome logo with explosive black ink splashes on purple',
        filename: '16_ink_splash_liquid_chrome.png',
        category: 'dynamic',
        prompt: (logoSymbol) => `bright vivid purple (#9b59b6) studio background, soft cinematic rim lighting, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered in LIQUID MERCURY MIRROR CHROME with perfect mirror reflections visible on every surface, the logo reflects the purple background and black ink splashes like a polished car hood or liquid metal terminator, highly reflective liquid metal finish showing distorted environment reflections, thick chunky 3D shape with strong depth and beveled edges, explosive black ink splashes and splatters bursting outward from behind the logo in dynamic radial patterns, liquid ink droplets frozen mid-air with motion blur, some ink splashes tinted with deeper purple and lime green (#dbff03) accents, dramatic contrast of black ink against bright purple background, ink streams and ribbons flowing dynamically, the chrome logo surface shows warped reflections of surrounding elements, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '17_glass_bevel': {
        id: '17_glass_bevel',
        name: 'Glass Bevel',
        description: 'Beveled crystal glass logo with strong specular highlights on dark pattern',
        filename: '17_glass_bevel_dark_pattern.png',
        category: 'glass',
        prompt: (logoSymbol) => `sophisticated charcoal grey gradient with subtle texture, fine grain texture overlay, subtle depth layers, refined neutral lighting with silver-grey highlights, photorealistic 3D environment with cinematic depth and professional atmosphere, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in beveled crystal glass with strong specular highlights, crisp bevel reflections, soft fill light, abstract wireframe geometric shapes as subtle accents, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, only ONE logo - do not repeat or duplicate the logo, cinematic composition with professional lighting, 8k resolution, ultra-detailed, professional product photography, no text or typography, Octane render, Cinema 4D quality, premium 3D CGI product render`
      },

      '18_abstract_glass': {
        id: '18_abstract_glass',
        name: 'Abstract Glass Cosmic',
        description: 'Polished chrome logo with floating abstract glass shapes on cosmic purple',
        filename: '18_abstract_glass_shapes_cosmic_purple.png',
        category: 'cosmic',
        prompt: (logoSymbol) => `deep cosmic purple void with nebula-like depth, subtle cosmic dust, ethereal gas cloud hints, mysterious purple lighting with magenta highlights, photorealistic 3D environment with cinematic depth and professional atmosphere, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in polished chrome with floating abstract glass shapes as accents, soft cinematic key light, abstract chrome spheres reflecting the environment, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, only ONE logo - do not repeat or duplicate the logo, cinematic composition with professional lighting, 8k resolution, ultra-detailed, professional product photography, no text or typography, Octane render, Cinema 4D quality, premium 3D CGI product render`
      },

      '19_shattered_glass': {
        id: '19_shattered_glass',
        name: 'Shattered Glass',
        description: 'Crystal glass logo emerging from exploding shattered mirror',
        filename: '19_shattered_glass_emergence.png',
        category: 'dynamic',
        prompt: (logoSymbol) => `absolute black void background, soft cinematic rim lighting, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol rendered in crystal clear glass emerging from a massive SHATTERED mirror plane, sharp glass shards and fragments exploding outward from the center, broken glass pieces floating and flying in all directions with motion blur, some glass fragments tinted with lime green (#dbff03) catching light, deep purple volumetric light rays streaming through the broken glass, dramatic depth with foreground shards blurred, the logo pristine and undamaged at the center of the chaos, premium glass materials with realistic refractions, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, no spheres, no balls`
      },

      '20_navy_chrome_coins': {
        id: '20_navy_chrome_coins',
        name: 'Navy Chrome Coins',
        description: 'Mirror chrome logo with floating lime plastic coins on deep navy',
        filename: '20_navy_chrome_lime_coins.png',
        category: 'financial',
        prompt: (logoSymbol) => `deep navy blue void fading to rich black, soft even cinematic lighting, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered in perfect MIRROR CHROME with flawless reflective surface showing environment reflections, the logo is highly polished mirror finish metal reflecting the navy background and lime accents, thick chunky 3D shape with strong depth and beveled edges, 10-12 matte lime green (#dbff03) plastic coins floating weightlessly in the air at various heights depths and angles, coins vary dramatically in size from small distant coins to large close-up coins creating depth, each coin has the cryptocurrency logo embossed on its surface, coins are solid opaque plastic with soft matte finish showing the logo clearly, some coins very close and large with slight blur some tiny and far away, the mirror chrome logo catches and reflects light beautifully, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '21_magenta_graphic': {
        id: '21_magenta_graphic',
        name: 'Magenta Graphic',
        description: 'Frosted glass logo with bold magenta graphic design elements',
        filename: '21_magenta_graphic_glass.png',
        category: 'graphic',
        prompt: (logoSymbol) => `deep black void background, soft cinematic rim lighting with magenta and cyan accents, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered in bright frosted glass with purple inner glow well-lit and clearly visible, bold flat bright magenta (#e91e63) geometric shapes as graphic design layers in different locations - diagonal stripes angular blocks and abstract flat patterns creating dynamic background interest like a modern poster design, floating transparent glass geometric shapes catching colored light, mix of flat 2D graphic design elements with premium 3D glass objects, modern editorial design aesthetic, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '22_neon_minimal': {
        id: '22_neon_minimal',
        name: 'Neon Minimal Coin',
        description: 'Chrome logo with restrained neon edge accents on clean dark background',
        filename: '22_neon_minimal_coin_dark.png',
        category: 'minimal',
        prompt: (logoSymbol) => `deep black void with sharp neon accent edges, geometric neon line accents, clean edge highlights, soft edge lighting with neon cyan and pink accents, photorealistic 3D environment with cinematic depth and professional atmosphere, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in smooth chrome with restrained neon edge accents, clean cinematic key light, minimal background, logo coins in glass material orbiting at different distances, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, only ONE logo - do not repeat or duplicate the logo, cinematic composition with professional lighting, 8k resolution, ultra-detailed, professional product photography, no text or typography, Octane render, Cinema 4D quality, premium 3D CGI product render`
      },

      '23_depth_layers': {
        id: '23_depth_layers',
        name: 'Depth Layers',
        description: 'Polished metal logo with layered depth lighting on purple dark background',
        filename: '23_depth_layers_purple_dark.png',
        category: 'premium',
        prompt: (logoSymbol) => `deep black void with rich violet accent gradients, subtle purple mist, dark atmospheric depth, moody ambient lighting with vivid purple rim accents, photorealistic 3D environment with cinematic depth and professional atmosphere, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in polished metal with layered depth lighting, atmospheric separation, soft cinematic highlights, floating lens flare elements and light artifacts, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, only ONE logo - do not repeat or duplicate the logo, cinematic composition with professional lighting, 8k resolution, ultra-detailed, professional product photography, no text or typography, Octane render, Cinema 4D quality, premium 3D CGI product render`
      },

      '24_purple_graphic': {
        id: '24_purple_graphic',
        name: 'Purple Graphic',
        description: 'Mirror chrome logo with bold purple graphic design elements',
        filename: '24_purple_graphic_glass.png',
        category: 'graphic',
        prompt: (logoSymbol) => `deep black void background, soft cinematic rim lighting with purple highlights, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered in bright polished mirror chrome with strong white highlights clearly visible, flat bright purple (#9b59b6) geometric shapes as graphic design elements layered behind and around the scene - angular blocks zigzag patterns and bold flat color sections creating visual interest like a graphic design poster, floating glass cubes and prisms scattered around catching purple light reflections, the flat purple graphic elements contrast with the 3D glass objects, clean modern design aesthetic mixing 2D graphic elements with 3D renders, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '25_trading_floor': {
        id: '25_trading_floor',
        name: 'Trading Floor',
        description: 'Platinum chrome logo with holographic trading data on dynamic financial background',
        filename: '25_trading_floor_dynamic.png',
        category: 'financial',
        prompt: (logoSymbol) => `dark atmospheric trading environment with abstract holographic data displays in the background, soft cinematic rim lighting with cyan and magenta accent lights, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in polished platinum chrome with iridescent multicolor reflections showing cyan blue purple and magenta hues, abstract glowing price chart lines and candlestick patterns made of light floating in background, dynamic financial energy atmosphere, scattered chrome and glass coins, the logo crafted from premium materials with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '26_paper_explosion': {
        id: '26_paper_explosion',
        name: 'Paper Explosion',
        description: 'Frosted glass logo with explosive paper fragments and lime flames',
        filename: '26_paper_explosion_chaos.png',
        category: 'dynamic',
        prompt: (logoSymbol) => `absolute black void background, soft cinematic rim lighting with purple accent rim lights, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol rendered in frosted glass with purple inner glow floating at center, hundreds of small white paper fragments and torn paper pieces exploding outward from behind the logo in a radial burst pattern, papers caught mid-flight with motion blur, some paper pieces on fire with lime green (#dbff03) flames at the edges, chaotic dynamic energy, scattered glass coins flying among the papers, dramatic depth of field with foreground papers blurred, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, no text on papers`
      },

      '27_ferrofluid': {
        id: '27_ferrofluid',
        name: 'Ferrofluid Magnetic',
        description: 'Polished chrome logo with magnetic ferrofluid spikes rising toward it',
        filename: '27_ferrofluid_spikes_magnetic.png',
        category: 'conceptual',
        prompt: (logoSymbol) => `deep black void background, soft cinematic rim lighting with purple highlights, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol rendered in polished chrome floating above a pool of black magnetic ferrofluid liquid, sharp spiky ferrofluid formations rising up around and toward the logo like magnetic attraction, the spikes are glossy black with purple and lime green (#dbff03) light reflections, dramatic contrast between the smooth chrome logo and the organic sharp ferrofluid spikes, some spikes nearly touching the logo creating tension, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
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
      sampleImageUrl: `${this.baseUrl}/api/style-catalog/image/${style.id}`,
      // Supabase URL as backup when manually uploaded
      supabaseUrl: `${this.supabaseStorageUrl}/${style.filename}`,
      filename: style.filename,
      // Custom subject support (e.g., replace "banks" or "hands" with user's choice)
      customSubject: style.customSubject || null
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

    return {
      id: style.id,
      name: style.name,
      description: style.description,
      category: style.category,
      sampleImageUrl: `${this.supabaseStorageUrl}/${style.filename}`,
      filename: style.filename
    };
  }

  /**
   * Get the exact Wavespeed prompt for a style
   * @param {string} styleId - The style identifier
   * @param {string} logoSymbol - The cryptocurrency symbol (e.g., 'BTC')
   * @param {object|null} colorOverrides - Optional color overrides: { bgColor, elementColor, accentLightColor }
   * @param {string|null} customSubject - Optional custom 3D subject to replace default objects (banks, hands, etc.)
   * @param {object|null} logoOverrides - Optional logo overrides: { logoMaterial, logoBaseColor, logoAccentLight }
   */
  getStylePrompt(styleId, logoSymbol, colorOverrides = null, customSubject = null, logoOverrides = null) {
    const style = this.styles[styleId];
    if (!style) {
      logger.warn(`Style not found: ${styleId}, using default`);
      const firstStyle = Object.values(this.styles)[0];
      return firstStyle.prompt(logoSymbol);
    }

    let prompt = style.prompt(logoSymbol);

    // If user provided a custom subject, replace the default 3D objects in the prompt
    if (customSubject && style.customSubject?.enabled) {
      const subject = customSubject.trim();
      if (styleId === '02_glass_banks_lime') {
        prompt = prompt.replace(
          /translucent 3D crystal glass bank buildings reaching into the frame from the edges - classical bank architecture with columns and facades rendered entirely in clear crystal glass material matching the hands style from before, the glass banks are see-through with realistic light refractions and purple tinted reflections, 2-3 small glass bank buildings positioned around the edges of frame/,
          `translucent 3D crystal glass ${subject} reaching into the frame from the edges - rendered entirely in clear crystal glass material, the glass ${subject} are see-through with realistic light refractions and purple tinted reflections, 2-3 glass ${subject} positioned around the edges of frame`
        );
        logger.info(`🎨 Custom subject "${subject}" replacing banks in style ${styleId}`);
      } else if (styleId === '08_hands_frosted') {
        prompt = prompt.replace(
          /exactly TWO elegant glass hands reaching toward and SLIGHTLY OVERLAPPING the logo from opposite sides - one hand from the left partially in front of the logo and one hand from the right partially in front of the logo, the hands are made of clear crystal glass with purple and magenta light refractions, hands positioned framing and slightly covering edges of the central logo creating depth, the glass hands have elegant sculpted form/,
          `elegant glass ${subject} reaching toward and SLIGHTLY OVERLAPPING the logo from opposite sides - ${subject} from the left partially in front of the logo and ${subject} from the right partially in front of the logo, the ${subject} are made of clear crystal glass with purple and magenta light refractions, ${subject} positioned framing and slightly covering edges of the central logo creating depth, the glass ${subject} have elegant sculpted form`
        );
        prompt = prompt.replace(/only two hands total/, `only two ${subject} total`);
        logger.info(`🎨 Custom subject "${subject}" replacing hands in style ${styleId}`);
      }
    }

    // LOGO OVERRIDES: Apply logo-specific changes BEFORE scene color overrides
    if (logoOverrides) {
      const { logoMaterial, logoBaseColor, logoAccentLight } = logoOverrides;

      // Step 1: Replace logo material
      if (logoMaterial && logoMaterial !== 'default') {
        prompt = this._replaceLogoMaterial(prompt, logoMaterial);
        logger.info(`🎨 Logo material: ${logoMaterial}`);
      }

      // Step 2: Replace logo base color
      if (logoBaseColor) {
        prompt = this._replaceLogoBaseColor(prompt, logoBaseColor);
        logger.info(`🎨 Logo base color: ${logoBaseColor}`);
      }

      // Step 3: Replace logo accent lighting (runs before scene accent to prevent double-replace)
      if (logoAccentLight) {
        prompt = this._replaceLogoAccentLight(prompt, logoAccentLight);
        logger.info(`🎨 Logo accent light: ${logoAccentLight}`);
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
    if (logoOverrides) {
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
    if (logoDirectives.length > 0) {
      prompt += `. LOGO: ${logoDirectives.join('. ')}.`;
    }

    // Always append anti-spotlight directive
    prompt += ', absolutely no spotlights or directional spot lights of any kind - use only soft rim lighting, ambient glow, volumetric fog, and edge lighting';
    prompt += ', CRITICAL: logos must float freely in the scene - absolutely NO rectangular frames, NO bounding boxes, NO square borders, NO card shapes, NO plaques, NO panels, NO glass screens behind or around any logo - logos are free-floating 3D objects never enclosed or contained in any frame or box shape';

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

    // Background color in compound phrases
    prompt = prompt.replace(/deep black void with rich violet accent gradients/gi, `deep ${bgColor} void with rich accent gradients`);
    prompt = prompt.replace(/deep black void with sharp neon accent edges/gi, `deep ${bgColor} void with sharp neon accent edges`);
    prompt = prompt.replace(/against bright purple background/gi, `against ${bgColor} background`);
    prompt = prompt.replace(/against the lime green backdrop/gi, `against the ${bgColor} backdrop`);
    prompt = prompt.replace(/reflecting the navy background/gi, `reflecting the ${bgColor} background`);
    prompt = prompt.replace(/reflecting the purple background/gi, `reflecting the ${bgColor} background`);

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

    // Remaining hex codes in element contexts
    prompt = prompt.replace(/#dbff03/gi, elementColor);
    prompt = prompt.replace(/#e91e63/gi, elementColor);

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

    // Remaining hex codes in lighting contexts
    prompt = prompt.replace(/#9b59b6/gi, accentLightColor);

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
