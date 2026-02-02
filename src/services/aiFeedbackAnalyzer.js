/**
 * AI-Powered Feedback Analyzer
 * Uses Claude to contextually understand user feedback and provide specific prompt adjustments
 * Updated with curated prompts based on user's GOOD example generations
 */

const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

class AIFeedbackAnalyzer {
  constructor() {
    this.anthropic = null;
    this.initializeClient();
  }

  initializeClient() {
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (apiKey) {
        this.anthropic = new Anthropic({ apiKey });
        logger.info('✅ AI Feedback Analyzer initialized with Anthropic Claude');
      } else {
        logger.warn('⚠️ ANTHROPIC_API_KEY not found - AI feedback analysis disabled');
      }
    } catch (error) {
      logger.error('Failed to initialize Anthropic client:', error);
    }
  }

  /**
   * Analyze user feedback with AI understanding
   * Now supports 1-10 numeric ratings for granularity
   * @param {Object} params - Feedback parameters
   * @param {string} params.feedbackText - User's written feedback
   * @param {number} params.logoQuality - 1-10 rating for logo quality
   * @param {number} params.logoSize - 1-10 rating for logo size (5 = perfect)
   * @param {number} params.logoStyle - 1-10 rating for logo style
   * @param {number} params.backgroundQuality - 1-10 rating for background quality
   * @param {number} params.backgroundStyle - 1-10 rating for background style
   * @param {string} params.network - The cryptocurrency network
   * @param {string} params.promptUsed - The prompt that was used
   * @returns {Object} Analyzed feedback with specific adjustments
   */
  async analyzeFeedback(params) {
    const {
      feedbackText,
      logoQuality,
      logoSize,
      logoStyle,
      backgroundQuality,
      backgroundStyle,
      network,
      promptUsed
    } = params;

    // If no Anthropic client, return basic analysis
    if (!this.anthropic) {
      return this.basicAnalysis(params);
    }

    try {
      const systemPrompt = `You are an expert image generation prompt engineer specializing in 3D CGI cryptocurrency cover art.
      
Your task is to analyze user feedback about generated images and provide specific, actionable adjustments for future prompts.

CRITICAL STYLE REQUIREMENTS:
- All images must be 3D CGI renders, NOT photography or photorealistic photos
- The LOGO is always the PRIMARY subject; any extra elements are SECONDARY accents only
- Logos must NEVER be inside boxes, frames, or containers - they should float freely
- NO server racks, data centers, or computer equipment in backgrounds
- Avoid red/yellow dominance; prefer cool tones and subtle warm highlights
- Color palette: dark base with reflective surfaces, 2–3 main colors max
- Accent colors allowed: subtle purple, neon green, occasional pink (paired well)

Based on user feedback, return a JSON object with these fields:
- logoAdjustments: Object with sizeMultiplier (0.7 to 1.5, where 1.0 is normal), material (string), style (string), avoid (array)
- backgroundAdjustments: Object with type (string), mood (string), avoid (array)
- promptModifiers: Array of specific phrases to add to prompts
- negativePrompts: Array of things to explicitly avoid
- overallQuality: "excellent" | "good" | "average" | "needs_improvement" | "poor"
- confidenceScore: 0-1 how confident you are in the analysis
- reasoning: Brief explanation of your analysis

RATING INTERPRETATION (1-10 scale):
- Logo Quality: 1-3 = poor, 4-5 = needs work, 6-7 = good, 8-10 = excellent
- Logo Size: 1 = very bad size, 10 = perfect size (higher is better)
- Logo Style: 1-3 = wrong style, 4-5 = needs work, 6-7 = good, 8-10 = perfect style
- Background Quality: 1-3 = poor, 4-5 = needs work, 6-7 = good, 8-10 = excellent
- Background Style: 1-3 = wrong style, 4-6 = acceptable, 7-10 = perfect style

PROVEN GOOD STYLES the user likes (from their approved examples):
1. Iridescent crystal prism logos with rainbow refractions on dark cinematic backgrounds
2. Glass logos with subtle neon cyan/magenta edge lighting (clean, premium)
3. Crystal or chrome logos on mirror floors with crisp reflections
4. Glass logos with scattered coins as secondary accents
5. Liquid metal splash beneath logo (logo remains primary)
6. Minimal dark environment with premium product lighting and soft gradients
7. Glass/metal logos with halo rings or subtle rim glow
8. Clean pedestal presentations with golden rays (subtle, not dominant)

User likes: 3D CGI renders, glass/crystal/chrome materials, reflective surfaces, premium cinematic lighting,
clean dark backgrounds with depth and reflections, subtle neon accents (purple/green/pink), large prominent logos,
limited palettes (no more than 3 main colors).
User dislikes: boxes around logos, photorealistic photos, server racks, cityscapes, sparkles, nebula spirals, dominant red/yellow.`;

      const userMessage = `Analyze this feedback for a ${network} cryptocurrency cover image:

NUMERIC RATINGS (1-10 scale):
- Logo Quality: ${logoQuality || 'not provided'}/10
- Logo Size: ${logoSize || 'not provided'}/10 (1=very bad size, 10=perfect size)
- Logo Style: ${logoStyle || 'not provided'}/10
- Background Quality: ${backgroundQuality || 'not provided'}/10
- Background Style: ${backgroundStyle || 'not provided'}/10

USER'S WRITTEN FEEDBACK:
"${feedbackText || 'No written feedback provided'}"

PROMPT THAT WAS USED:
"${promptUsed || 'Not available'}"

Please analyze this feedback and return a JSON object with specific adjustments for future generations.`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          { role: 'user', content: userMessage }
        ],
        system: systemPrompt
      });

      const responseText = response.content[0].text;
      
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        logger.info(`🤖 AI Feedback Analysis completed for ${network}:`, analysis.reasoning);
        return {
          success: true,
          aiAnalyzed: true,
          ...analysis
        };
      }

      logger.warn('Could not parse AI response, falling back to basic analysis');
      return this.basicAnalysis(params);

    } catch (error) {
      logger.error('AI Feedback Analysis error:', error);
      return this.basicAnalysis(params);
    }
  }

  /**
   * Basic rule-based analysis when AI is unavailable
   * Updated to handle 1-10 numeric ratings
   */
  basicAnalysis(params) {
    const {
      feedbackText,
      logoQuality,
      logoSize,
      logoStyle,
      backgroundQuality,
      backgroundStyle
    } = params;

    const result = {
      success: true,
      aiAnalyzed: false,
      logoAdjustments: { sizeMultiplier: 1.0, material: null, style: null, avoid: [] },
      backgroundAdjustments: { type: null, mood: null, avoid: [] },
      promptModifiers: [],
      negativePrompts: ['box', 'frame', 'container', 'server rack', 'data center', 'photography', 'photorealistic photo'],
      overallQuality: 'needs_improvement',
      confidenceScore: 0.5,
      reasoning: 'Basic rule-based analysis (AI unavailable)'
    };

    // Convert numeric ratings to adjustments
    const lq = parseInt(logoQuality) || 5;
    const ls = parseInt(logoSize) || 5;
    const lst = parseInt(logoStyle) || 5;
    const bq = parseInt(backgroundQuality) || 5;
    const bs = parseInt(backgroundStyle) || 5;

    // Logo size adjustments based on 1-10 scale
    // 1-3 = too small (increase), 4-6 = good, 7-10 = too large (decrease)
    if (ls <= 3) {
      // Size rating is bad - prioritize making logo bigger
      result.logoAdjustments.sizeMultiplier = 1.0 + (0.1 * (4 - ls)); // 1.1 to 1.3
      result.promptModifiers.push('large prominent dominating');
      logger.info(`📏 Logo size ${ls}/10 = bad, increasing size: ${result.logoAdjustments.sizeMultiplier}`);
    } else if (ls >= 8) {
      // Size is near perfect - keep proportions
      result.promptModifiers.push('well-proportioned logo size');
      logger.info(`📏 Logo size ${ls}/10 = perfect, keep size`);
    }

    // Logo quality adjustments
    if (lq <= 3) {
      result.promptModifiers.push('ultra detailed', 'sharp focus', 'high definition');
      result.logoAdjustments.style = 'highly detailed 3D CGI';
    } else if (lq >= 8) {
      result.overallQuality = 'good';
    }

    // Logo style adjustments
    if (lst <= 3) {
      result.logoAdjustments.style = 'clean premium 3D styling';
      result.promptModifiers.push('refined 3D styling', 'clean premium finish');
    } else if (lst >= 8) {
      result.promptModifiers.push('maintain current logo styling');
    }

    // Background quality adjustments
    if (bq <= 3) {
      result.backgroundAdjustments.mood = 'dramatic atmospheric';
      result.promptModifiers.push('cinematic background', 'professional lighting');
    }

    // Background style adjustments
    if (bs <= 3) {
      result.backgroundAdjustments.type = 'abstract void';
      result.backgroundAdjustments.avoid.push('current_style');
    }

    // Parse feedback text for common issues
    const feedback = (feedbackText || '').toLowerCase();
    
    if (feedback.includes('glass') && (feedback.includes('too much') || feedback.includes('everything'))) {
      result.backgroundAdjustments.avoid.push('glass_everywhere');
      result.promptModifiers.push('solid matte background');
    }
    
    if (feedback.includes('small') || feedback.includes('bigger') || feedback.includes('larger')) {
      result.logoAdjustments.sizeMultiplier = Math.max(result.logoAdjustments.sizeMultiplier, 1.2);
    }

    if (feedback.includes('box') || feedback.includes('frame') || feedback.includes('container')) {
      result.negativePrompts.push('no box', 'no frame', 'no container', 'floating freely');
    }

    if (feedback.includes('server') || feedback.includes('rack') || feedback.includes('data center')) {
      result.negativePrompts.push('no server', 'no rack', 'no data center', 'no computer equipment');
    }

    if (feedback.includes('photo') || feedback.includes('realistic')) {
      result.negativePrompts.push('no photography', 'no photorealistic', '3D CGI render only');
    }

    // Determine overall quality from combined ratings
    const avgRating = (lq + bq + bs) / 3;
    if (avgRating >= 8) result.overallQuality = 'excellent';
    else if (avgRating >= 6) result.overallQuality = 'good';
    else if (avgRating >= 4) result.overallQuality = 'average';
    else if (avgRating >= 2) result.overallQuality = 'needs_improvement';
    else result.overallQuality = 'poor';

    return result;
  }

  /**
   * Get curated prompt based on proven good styles from user's examples
   * @param {string} network - The cryptocurrency network
   * @param {number} generationCount - Current generation count for variety
   * @returns {Object} Curated prompt components
   */
  getCuratedPromptStyle(network, generationCount = 0) {
    // These are the proven styles from the user's GOOD example images
    // All are 3D CGI renders with NO boxes, NO server racks, NO photography
    const curatedStyles = [
      // PROMPT CATALOG BASED ON USER-APPROVED EXAMPLES
      {
        name: 'iridescent_prism_logo',
        prompt: 'A {network} logo rendered as iridescent crystal glass with rainbow refractions, floating as the primary subject in a premium dark cinematic environment, clean rim lighting, subtle spectral reflections on edges, luxury 3D CGI product render, deep depth-of-field, dark gradient backdrop.'
      },
      {
        name: 'neon_edge_chrome',
        prompt: 'A {network} logo in polished chrome with subtle cyan/magenta edge glow, primary subject centered, soft cinematic key light, micro reflections on metal surface, premium dark gradient background.'
      },
      {
        name: 'mirror_floor_reflection',
        prompt: 'A {network} logo hovering just above a mirror floor with crisp reflection, primary subject, polished metal or crystal glass finish, clean cinematic lighting with strong reflections, infinite dark space.'
      },
      {
        name: 'glass_coin_scatter',
        prompt: 'A {network} logo of subtle iridescent glass floating above scattered glass coins, coins are secondary accents, soft neon edge lighting with gentle ambient fill, dark blue gradient background with soft reflections.'
      },
      {
        name: 'metal_coin_scatter',
        prompt: 'A {network} logo in brushed metal floating above scattered metal coins (secondary), soft cinematic key light with subtle rim, premium financial aesthetic, dark neutral gradient background.'
      },
      {
        name: 'glass_shard_orbit',
        prompt: 'A {network} logo floating with a few minimal glass shards orbiting as accents, edge-lit glass, soft ambient fill, clean futuristic mood, dark geometric gradient.'
      },
      {
        name: 'holographic_prism_edges',
        prompt: 'A {network} logo made of crystal glass with holographic prism edges, primary subject, prismatic rim light with soft ambient fill, rainbow refraction along edges, deep navy gradient background.'
      },
      {
        name: 'platinum_brush',
        prompt: 'A {network} logo in brushed platinum with subtle reflections, primary subject floating, soft cinematic key light with gentle rim, refined executive aesthetic, dark grey gradient.'
      },
      {
        name: 'pearl_gloss_plastic',
        prompt: 'A {network} logo in pearl white glossy plastic with soft sheen, primary subject floating, soft diffused light with mild rim, subtle color shift in gloss, dark matte gradient.'
      },
      {
        name: 'anodized_titanium',
        prompt: 'A {network} logo in anodized titanium with cool blue-violet sheen, primary subject floating, crisp specular highlights, refined cinematic lighting, deep dark gradient background.'
      },
      {
        name: 'obsidian_glass',
        prompt: 'A {network} logo in obsidian black glass with sharp reflections, primary subject floating, rim lighting emphasizing depth, subtle reflections, deep charcoal gradient background.'
      },
      {
        name: 'ceramic_white',
        prompt: 'A {network} logo in matte ceramic white with subtle gloss edges, primary subject floating, soft cinematic key light with gentle rim, minimal dark gradient background.'
      },
      {
        name: 'carbon_fiber',
        prompt: 'A {network} logo in dark carbon fiber with metallic inlays, primary subject floating, crisp highlights on texture, cinematic lighting, deep blue-black gradient background.'
      },
      {
        name: 'satin_aluminum',
        prompt: 'A {network} logo in satin aluminum with soft reflections, primary subject floating, clean cinematic lighting, subtle edge highlights, dark neutral gradient background.'
      },
      {
        name: 'liquid_steel',
        prompt: 'A {network} logo in liquid steel with smooth flowing reflections, primary subject floating, dramatic highlights, cinematic depth, dark gradient background.'
      },
      {
        name: 'blue_cyan_cinematic',
        prompt: 'A {network} logo in polished metal with cool blue reflections, primary subject, cool cyan key light with soft rim, soft light streak reflections, deep blue gradient background.'
      },
      {
        name: 'glass_outline_logo',
        prompt: 'A {network} logo as a clear glass outline with inner glow, primary subject centered, edge glow with soft ambient fill, minimal neon aesthetic, black gradient with soft vignette.'
      },
      {
        name: 'micro_shard_clean',
        prompt: 'A {network} logo in crystal glass with a few tiny glass accents nearby, primary subject, soft cinematic lighting, refined minimal aesthetic, deep charcoal gradient background.'
      },
      {
        name: 'glass_bevel_highlight',
        prompt: 'A {network} logo made of beveled crystal glass with strong specular highlights, primary subject floating, crisp bevel reflections, soft fill light, dark blue to black gradient backdrop.'
      },
      {
        name: 'glass_logo_coin_orbit',
        prompt: 'A {network} logo in crystal glass floating as primary subject, with several {network} logo coins orbiting at different angles as secondary elements, clean cinematic lighting, dark gradient background, premium 3D CGI render.'
      },
      {
        name: 'logo_scattered_glass_tokens',
        prompt: 'A {network} logo floating as primary subject, surrounded by scattered glass tokens showing the {network} logo at varied angles, soft neon rim light, dark gradient with depth.'
      },
      {
        name: 'abstract_glass_shapes',
        prompt: 'A {network} logo in polished chrome as primary subject, with floating abstract glass shapes (prisms and shards) as subtle secondary accents, soft cinematic key light, dark geometric background.'
      },
      {
        name: 'cgi_glass_spheres',
        prompt: 'A {network} logo floating as primary subject, surrounded by CGI glass spheres at different depths, clean rim lighting, subtle refractions, dark gradient background.'
      },
      {
        name: 'floating_glass_rings',
        prompt: 'A {network} logo in crystal glass as primary subject, with a few floating glass rings and arcs nearby as secondary elements (no halo around logo), soft cinematic lighting, deep dark gradient.'
      },
      {
        name: 'dual_material_logo_scatter',
        prompt: 'A {network} logo in glass and chrome mixed materials, primary subject, with scattered {network} logo coins (glass) and minimal abstract shapes as secondary elements, clean cinematic lighting, dark gradient background.'
      },
      {
        name: 'logo_coin_river',
        prompt: 'A {network} logo floating as primary subject above a subtle river-like trail of {network} logo coins at varied angles, soft reflections, dark gradient, premium 3D CGI render.'
      },
      {
        name: 'multi_depth_tokens',
        prompt: 'A {network} logo floating as primary subject, with multiple {network} logo tokens at different depths and angles, shallow depth-of-field, soft cinematic lighting, dark blue gradient background.'
      },
      {
        name: 'glass_orbit_clusters',
        prompt: 'A {network} logo in iridescent glass, primary subject, with small clusters of floating glass shapes and {network} logo coins as secondary elements, soft rim lighting, dark gradient.'
      },
      {
        name: 'holo_coin_spheres',
        prompt: 'A {network} logo in holographic glass, primary subject, with floating glass spheres and {network} logo coins as secondary accents, clean cinematic light, deep dark gradient background.'
      },
      {
        name: 'iridescent_gradient_glass',
        prompt: 'A {network} logo in gradient glass shifting cyan to magenta, primary subject, soft cinematic lighting, gentle refractions, dark gradient with subtle depth.'
      },
      {
        name: 'neon_edge_minimal',
        prompt: 'A {network} logo in smooth chrome with restrained neon edge accents, primary subject, clean cinematic key light, minimal background, dark charcoal gradient.'
      },
      {
        name: 'coins_glass_surface',
        prompt: 'A {network} logo floating above a clean reflective surface with scattered glass coins, coins are secondary, soft neon edge highlights, dark blue gradient with reflections.'
      },
      {
        name: 'depth_layers',
        prompt: 'A {network} logo in polished metal with layered depth lighting in the background, primary subject, atmospheric separation, soft cinematic highlights, deep dark gradient.'
      }
    ];

    // TRUE RANDOM selection - Math.random() is unique per call
    // Previously used generationCount % length which always picked the same style
    // when generationCount didn't change between requests
    const styleIndex = Math.floor(Math.random() * curatedStyles.length);
    const selectedStyle = curatedStyles[styleIndex];

    logger.info(`🎨 RANDOMLY selected curated style: ${selectedStyle.name} (index ${styleIndex}/${curatedStyles.length})`);

    return selectedStyle;
  }

  /**
   * Build an optimized prompt using curated styles and user ratings
   * @param {string} network - The cryptocurrency network
   * @param {Object} feedbackAnalysis - Previous AI feedback analysis
   * @param {number} generationCount - Current generation count
   * @param {string} customKeyword - User's custom keyword/phrase
   * @param {Object} preferences - User preferences from promptRefinementService
   * @returns {string} Optimized prompt
   */
  buildOptimizedPrompt(network, feedbackAnalysis = null, generationCount = 0, customKeyword = null, preferences = null, options = {}) {
    const style = this.getCuratedPromptStyle(network, generationCount);
    
    let material = style.material;
    let scene = style.scene;
    let lighting = style.lighting;
    let extras = style.extras;
    let background = style.background;
    
    // Apply feedback analysis adjustments if available
    if (feedbackAnalysis) {
      const { logoAdjustments, backgroundAdjustments, promptModifiers } = feedbackAnalysis;
      
      // Adjust material based on feedback
      if (logoAdjustments?.material) {
        material = logoAdjustments.material;
      }
      
      // Adjust background based on feedback
      if (backgroundAdjustments?.type) {
        scene = backgroundAdjustments.type;
      }
      if (backgroundAdjustments?.mood) {
        background = `${backgroundAdjustments.mood} ${background}`;
      }
      
      // Add prompt modifiers
      if (promptModifiers && promptModifiers.length > 0) {
        extras = `${extras}, ${promptModifiers.join(', ')}`;
      }
    }
    
    // Apply user preferences for size hints
    let sizePrefix = '';
    if (preferences?.logoSizeIssues?.includes('increase_logo_size')) {
      sizePrefix = 'large prominent dominating ';
    } else if (preferences?.logoSizeIssues?.includes('decrease_logo_size')) {
      sizePrefix = 'elegantly proportioned ';
    }
    
    // Build the prompt - explicitly 3D CGI, NOT photography
    let prompt;
    if (style.prompt) {
      // Use curated prompt template
      prompt = style.prompt.replace('{network}', network);
    } else {
      prompt = `A stunning ${sizePrefix}${network} cryptocurrency logo, 3D CGI render, `;
      prompt += `${material}, `;
      prompt += `${scene}, `;
      prompt += `${lighting}, `;
      prompt += `${extras}, `;
      prompt += `${background}. `;
      prompt += `${style.mood}. `;
    }
    
    const logoTextMode = options?.logoTextMode || 'full';
    if (logoTextMode === 'full') {
      prompt += ` Preserve the full logo including any text, wordmarks, or typography; do not crop or omit text.`;
    } else if (logoTextMode === 'mark') {
      prompt += ` Use the symbol-only logo mark, omit wordmarks or logo text.`;
    }

    // Add logo angle variation for depth (tilted perspectives)
    const anglePhrases = [
      'tilted three-quarter view to emphasize depth',
      'angled perspective with visible depth',
      'slight rotation showcasing 3D thickness',
      'dynamic angled view with depth shadows',
      'subtle tilt revealing dimensionality'
    ];
    if (Math.random() > 0.35) {
      const angleHint = anglePhrases[Math.floor(Math.random() * anglePhrases.length)];
      prompt += ` ${angleHint}.`;
    }

    // Add color palette guidance (dark base, limited palette, accent colors)
    prompt += ` Use a dark reflective base with depth and refractions, limit to 2-3 main colors.`;
    prompt += ` Preferred accent colors: subtle purple, neon green, occasional pink when paired well.`;

    // Add custom keyword as SECONDARY elements (logo remains primary subject)
    if (customKeyword && customKeyword.trim()) {
      const secondary = customKeyword.trim();
      prompt += `Include subtle secondary elements of ${secondary} in the background or as accents, `;
      prompt += `but keep the logo as the primary subject. `;
    }
    
    // Quality boosters - emphasize 3D CGI NOT photography
    prompt += `Octane render, Cinema 4D quality, ultra high detail, 8K resolution, `;
    prompt += `professional 3D CGI artwork, Blender render, unreal engine quality.`;
    
    // CRITICAL negative prompts - things to ALWAYS avoid
    const negatives = [
      // No boxes/frames
      'no box', 'no frame', 'no border', 'no container', 'logo floating freely',
      // No photography
      'no photography', 'no photorealistic photo', 'no camera photo', 'no stock photo',
      // No server equipment
      'no server rack', 'no data center', 'no server room', 'no computer equipment',
      // No cityscapes
      'no cityscape', 'no buildings', 'no skyline', 'no skyscrapers',
      // No unwanted effects
      'no sparkles', 'no glitter particles', 'no nebula spiral', 'no spiraling effects',
      // Avoid strong warm colors
      'no dominant red', 'no dominant yellow', 'no heavy warm tones',
      // Preserve logo text (full logo mode only)
      ...(logoTextMode === 'full'
        ? ['no missing text', 'no cropped text', 'no incomplete logo text']
        : []),
      'no more than three main colors',
      // Quality
      'no blur', 'no distortion', 'no watermark', 'no text overlay'
    ];
    
    // Add any feedback-specific negatives
    if (feedbackAnalysis?.negativePrompts) {
      negatives.push(...feedbackAnalysis.negativePrompts);
    }
    
    prompt += ` Negative: ${negatives.join(', ')}.`;
    
    logger.info(`📝 Built optimized 3D CGI prompt for ${network}:`, prompt.substring(0, 200) + '...');
    
    return prompt;
  }
}

module.exports = new AIFeedbackAnalyzer();
