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
        prompt: (logoSymbol) => `infinite deep blue void with subtle atmospheric depth, soft volumetric fog, gentle light rays piercing darkness, dramatic cinematic blue with cool undertones and professional depth, photorealistic 3D environment with cinematic depth and professional atmosphere, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in iridescent crystal glass with rainbow refractions, clean rim lighting, subtle spectral reflections on edges, luxury 3D CGI product render, floating abstract glass prisms and geometric shards as background accents, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, only ONE logo - do not repeat or duplicate the logo, cinematic composition with professional lighting, 8k resolution, ultra-detailed, professional product photography, no text or typography, Octane render, Cinema 4D quality, premium 3D CGI product render`
      },

      '02_glass_banks_lime': {
        id: '02_glass_banks_lime',
        name: 'Glass Banks',
        description: 'Frosted glass logo with crystal bank buildings and lime accent pattern',
        filename: '02_glass_banks_lime_pattern.png',
        category: 'architectural',
        prompt: (logoSymbol) => `pure black void background, dramatic cinematic lighting with purple accent highlights, photorealistic 3D environment, the provided cryptocurrency logo symbol rendered in medium size frosted glass material with purple inner glow centered in the composition, translucent 3D crystal glass bank buildings reaching into the frame from the edges - classical bank architecture with columns and facades rendered entirely in clear crystal glass material matching the hands style from before, the glass banks are see-through with realistic light refractions and purple tinted reflections, 2-3 small glass bank buildings positioned around the edges of frame, lime green (#dbff03) flat rounded square pattern in the bottom left corner extending off frame, shallow depth of field, the logo crafted from premium frosted glass material with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, no hands`
      },

      '03_neon_glass_dynamic': {
        id: '03_neon_glass_dynamic',
        name: 'Neon Glass Dynamic',
        description: 'Mirror chrome logo with cyan/magenta neon split lighting and floating glass cubes',
        filename: '03_neon_glass_dynamic.png',
        category: 'neon',
        prompt: (logoSymbol) => `deep black environment with dramatic cinematic lighting, cyan neon glow on the left side and magenta neon glow on the right side creating split lighting, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered in bright polished mirror chrome with strong white highlights clearly visible and well-lit, a few sleek neon light tubes in the background creating geometric accent lines but not overwhelming, glossy black mirror floor with logo reflection, many floating 3D glass cubes prisms and rectangular blocks of varying sizes scattered dynamically around the logo at different depths and angles, the glass shapes catch and refract the cyan and magenta neon light beautifully, some glass elements larger in foreground some smaller in background creating depth, the 3D elements add visual complexity and movement, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
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
        prompt: (logoSymbol) => `pure black void background, soft dramatic cinematic lighting with purple and magenta ambient glow, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered in bright frosted glass with purple inner glow like a glowing holographic material, exactly TWO elegant glass hands reaching toward and SLIGHTLY OVERLAPPING the logo from opposite sides - one hand from the left partially in front of the logo and one hand from the right partially in front of the logo, the hands are made of clear crystal glass with purple and magenta light refractions, hands positioned framing and slightly covering edges of the central logo creating depth, the glass hands have elegant sculpted form, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text, only two hands total`
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
        prompt: (logoSymbol) => `pure black void background with subtle scan lines, dramatic cyberpunk cinematic lighting, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol rendered in polished chrome with RGB chromatic aberration color split effect on the edges showing red blue green separation, digital glitch artifacts and pixel blocks scattered around the logo, horizontal scan lines and VHS distortion effects in the background, lime green (#dbff03) digital noise particles floating, purple neon accent lighting, the logo partially dissolving into digital pixels on one edge while remaining solid chrome on the other, cyberpunk data corruption aesthetic, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, no liquid, no melting`
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
        prompt: (logoSymbol) => `bright vivid purple (#9b59b6) studio background, dramatic cinematic lighting, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered in LIQUID MERCURY MIRROR CHROME with perfect mirror reflections visible on every surface, the logo reflects the purple background and black ink splashes like a polished car hood or liquid metal terminator, highly reflective liquid metal finish showing distorted environment reflections, thick chunky 3D shape with strong depth and beveled edges, explosive black ink splashes and splatters bursting outward from behind the logo in dynamic radial patterns, liquid ink droplets frozen mid-air with motion blur, some ink splashes tinted with deeper purple and lime green (#dbff03) accents, dramatic contrast of black ink against bright purple background, ink streams and ribbons flowing dynamically, the chrome logo surface shows warped reflections of surrounding elements, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
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
        prompt: (logoSymbol) => `absolute black void background, dramatic cinematic lighting, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol rendered in crystal clear glass emerging from a massive SHATTERED mirror plane, sharp glass shards and fragments exploding outward from the center, broken glass pieces floating and flying in all directions with motion blur, some glass fragments tinted with lime green (#dbff03) catching light, deep purple volumetric light rays streaming through the broken glass, dramatic depth with foreground shards blurred, the logo pristine and undamaged at the center of the chaos, premium glass materials with realistic refractions, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, no spheres, no balls`
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
        prompt: (logoSymbol) => `deep black void background, dramatic cinematic lighting with magenta and cyan accents, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered in bright frosted glass with purple inner glow well-lit and clearly visible, bold flat bright magenta (#e91e63) geometric shapes as graphic design layers in different locations - diagonal stripes angular blocks and abstract flat patterns creating dynamic background interest like a modern poster design, floating transparent glass geometric shapes catching colored light, mix of flat 2D graphic design elements with premium 3D glass objects, modern editorial design aesthetic, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '22_neon_minimal': {
        id: '22_neon_minimal',
        name: 'Neon Minimal Coin',
        description: 'Chrome logo with restrained neon edge accents on clean dark background',
        filename: '22_neon_minimal_coin_dark.png',
        category: 'minimal',
        prompt: (logoSymbol) => `deep black void with sharp neon accent edges, geometric neon line accents, clean edge highlights, dramatic edge lighting with neon cyan and pink accents, photorealistic 3D environment with cinematic depth and professional atmosphere, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in smooth chrome with restrained neon edge accents, clean cinematic key light, minimal background, logo coins in glass material orbiting at different distances, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, only ONE logo - do not repeat or duplicate the logo, cinematic composition with professional lighting, 8k resolution, ultra-detailed, professional product photography, no text or typography, Octane render, Cinema 4D quality, premium 3D CGI product render`
      },

      '23_depth_layers': {
        id: '23_depth_layers',
        name: 'Depth Layers',
        description: 'Polished metal logo with layered depth lighting on purple dark background',
        filename: '23_depth_layers_purple_dark.png',
        category: 'premium',
        prompt: (logoSymbol) => `deep black void with rich violet accent gradients, subtle purple mist, dark atmospheric depth, dramatic dark lighting with vivid purple rim accents, photorealistic 3D environment with cinematic depth and professional atmosphere, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in polished metal with layered depth lighting, atmospheric separation, soft cinematic highlights, floating lens flare elements and light artifacts, the logo casting realistic shadows and receiving environmental reflections, photorealistic surface properties and atmospheric depth, absolutely no flat overlays or 2D sticker effects, only ONE logo - do not repeat or duplicate the logo, cinematic composition with professional lighting, 8k resolution, ultra-detailed, professional product photography, no text or typography, Octane render, Cinema 4D quality, premium 3D CGI product render`
      },

      '24_purple_graphic': {
        id: '24_purple_graphic',
        name: 'Purple Graphic',
        description: 'Mirror chrome logo with bold purple graphic design elements',
        filename: '24_purple_graphic_glass.png',
        category: 'graphic',
        prompt: (logoSymbol) => `deep black void background, dramatic cinematic lighting with purple highlights, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol as the hero subject rendered in bright polished mirror chrome with strong white highlights clearly visible, flat bright purple (#9b59b6) geometric shapes as graphic design elements layered behind and around the scene - angular blocks zigzag patterns and bold flat color sections creating visual interest like a graphic design poster, floating glass cubes and prisms scattered around catching purple light reflections, the flat purple graphic elements contrast with the 3D glass objects, clean modern design aesthetic mixing 2D graphic elements with 3D renders, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '25_trading_floor': {
        id: '25_trading_floor',
        name: 'Trading Floor',
        description: 'Platinum chrome logo with holographic trading data on dynamic financial background',
        filename: '25_trading_floor_dynamic.png',
        category: 'financial',
        prompt: (logoSymbol) => `dark atmospheric trading environment with abstract holographic data displays in the background, dramatic cinematic lighting with cyan and magenta accent lights, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo as the hero subject, the ${logoSymbol} symbol rendered in polished platinum chrome with iridescent multicolor reflections showing cyan blue purple and magenta hues, abstract glowing price chart lines and candlestick patterns made of light floating in background, dynamic financial energy atmosphere, scattered chrome and glass coins, the logo crafted from premium materials with volumetric lighting, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      },

      '26_paper_explosion': {
        id: '26_paper_explosion',
        name: 'Paper Explosion',
        description: 'Frosted glass logo with explosive paper fragments and lime flames',
        filename: '26_paper_explosion_chaos.png',
        category: 'dynamic',
        prompt: (logoSymbol) => `absolute black void background, dramatic cinematic lighting with purple accent rim lights, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol rendered in frosted glass with purple inner glow floating at center, hundreds of small white paper fragments and torn paper pieces exploding outward from behind the logo in a radial burst pattern, papers caught mid-flight with motion blur, some paper pieces on fire with lime green (#dbff03) flames at the edges, chaotic dynamic energy, scattered glass coins flying among the papers, dramatic depth of field with foreground papers blurred, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, no text on papers`
      },

      '27_ferrofluid': {
        id: '27_ferrofluid',
        name: 'Ferrofluid Magnetic',
        description: 'Polished chrome logo with magnetic ferrofluid spikes rising toward it',
        filename: '27_ferrofluid_spikes_magnetic.png',
        category: 'conceptual',
        prompt: (logoSymbol) => `deep black void background, dramatic cinematic lighting with purple highlights, photorealistic 3D environment, single prominent ${logoSymbol} cryptocurrency logo symbol rendered in polished chrome floating above a pool of black magnetic ferrofluid liquid, sharp spiky ferrofluid formations rising up around and toward the logo like magnetic attraction, the spikes are glossy black with purple and lime green (#dbff03) light reflections, dramatic contrast between the smooth chrome logo and the organic sharp ferrofluid spikes, some spikes nearly touching the logo creating tension, cinematic composition, 8k resolution, ultra-detailed, Octane render, Cinema 4D quality, premium 3D CGI product render, no text`
      }
    };

    logger.info(`🎨 Style Catalog initialized with ${Object.keys(this.styles).length} curated styles`);
  }

  /**
   * Get all styles with sample image URLs
   */
  getAllStyles() {
    return Object.values(this.styles).map(style => ({
      id: style.id,
      name: style.name,
      description: style.description,
      category: style.category,
      sampleImageUrl: `${this.baseUrl}/style-examples/${style.filename}`,
      filename: style.filename
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
      sampleImageUrl: `${this.baseUrl}/style-examples/${style.filename}`,
      filename: style.filename
    };
  }

  /**
   * Get the exact Wavespeed prompt for a style
   * This is the core function - returns the prompt to use for generation
   */
  getStylePrompt(styleId, logoSymbol) {
    const style = this.styles[styleId];
    if (!style) {
      logger.warn(`Style not found: ${styleId}, using default`);
      // Fallback to first style
      const firstStyle = Object.values(this.styles)[0];
      return firstStyle.prompt(logoSymbol);
    }
    return style.prompt(logoSymbol);
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
