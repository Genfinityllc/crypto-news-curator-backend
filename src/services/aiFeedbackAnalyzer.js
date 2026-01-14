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
- Logos must NEVER be inside boxes, frames, or containers - they should float freely
- NO server racks, data centers, or computer equipment in backgrounds
- Focus on artistic 3D environments: temples, underwater, space, abstract voids

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
- Logo Size: 1-3 = too small (need bigger), 4-6 = about right, 7-10 = too large (need smaller)
- Background Quality: 1-3 = poor, 4-5 = needs work, 6-7 = good, 8-10 = excellent
- Background Style: 1-3 = wrong style, 4-6 = acceptable, 7-10 = perfect style

PROVEN GOOD STYLES the user likes (from their approved examples):
1. Iridescent glass Solana logo in ancient temple ruins with holographic trading data overlays
2. Amber/gold liquid-filled crystal logo submerged underwater with caustic lighting and bubbles
3. Crystal glass Hedera H logo on reflective surface with scattered glowing coins
4. Floating glass spheres with logos inside, neon cyan/magenta lighting on dark background
5. Crystal text on sleek metal pedestal with golden rays against deep space starfield
6. Gradient glass logo (cyan to magenta) with scattered glass coins on reflective dark surface

User likes: 3D CGI renders, glass/crystal materials, liquid-filled logos, dramatic lighting, 
ancient/temple backgrounds, underwater scenes, space backgrounds, scattered coins, large prominent logos.
User dislikes: boxes around logos, photorealistic photos, server racks, cityscapes, sparkles, nebula spirals.`;

      const userMessage = `Analyze this feedback for a ${network} cryptocurrency cover image:

NUMERIC RATINGS (1-10 scale):
- Logo Quality: ${logoQuality || 'not provided'}/10
- Logo Size: ${logoSize || 'not provided'}/10 (1-3=too small, 4-6=good, 7-10=too large)
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
    const bq = parseInt(backgroundQuality) || 5;
    const bs = parseInt(backgroundStyle) || 5;

    // Logo size adjustments based on 1-10 scale
    // 1-3 = too small (increase), 4-6 = good, 7-10 = too large (decrease)
    if (ls <= 3) {
      // Logo is too small - increase size
      result.logoAdjustments.sizeMultiplier = 1.0 + (0.1 * (4 - ls)); // 1.1 to 1.3
      result.promptModifiers.push('large prominent dominating');
      logger.info(`📏 Logo size ${ls}/10 = too small, multiplier: ${result.logoAdjustments.sizeMultiplier}`);
    } else if (ls >= 7) {
      // Logo is too large - decrease size
      result.logoAdjustments.sizeMultiplier = 1.0 - (0.05 * (ls - 6)); // 0.95 to 0.8
      result.promptModifiers.push('elegantly proportioned');
      logger.info(`📏 Logo size ${ls}/10 = too large, multiplier: ${result.logoAdjustments.sizeMultiplier}`);
    }

    // Logo quality adjustments
    if (lq <= 3) {
      result.promptModifiers.push('ultra detailed', 'sharp focus', 'high definition');
      result.logoAdjustments.style = 'highly detailed 3D CGI';
    } else if (lq >= 8) {
      result.overallQuality = 'good';
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
      // CORE STYLES FROM USER'S GOOD EXAMPLES (NO temple fusion, no distracting subjects)
      {
        name: 'iridescent_prism_logo',
        description: 'Iridescent crystal prism logo, premium studio',
        material: 'iridescent crystal glass with rainbow refractions',
        scene: 'logo floating at center, primary subject',
        lighting: 'clean studio lighting with soft rim highlights',
        extras: 'subtle spectral reflections on edges',
        mood: 'luxury premium minimal',
        background: 'dark gradient studio backdrop with soft falloff'
      },
      {
        name: 'glass_frame_logo',
        description: 'Floating glass frame around logo (minimal, elegant)',
        material: 'clear glass frame with cyan/magenta edges',
        scene: 'logo floating inside a minimal glass frame, primary subject',
        lighting: 'neon edge lighting with soft ambient fill',
        extras: 'light refractions along glass edges',
        mood: 'clean futuristic elegance',
        background: 'dark matte studio with subtle geometric facets'
      },
      {
        name: 'neon_edge_chrome',
        description: 'Polished chrome logo with controlled neon edges',
        material: 'polished chrome with subtle neon edge glow',
        scene: 'logo floating, primary subject',
        lighting: 'cyan/magenta rim light with soft studio key',
        extras: 'micro reflections on metal surface',
        mood: 'premium futuristic minimal',
        background: 'deep charcoal gradient with faint shapes'
      },
      {
        name: 'glass_liquid_core',
        description: 'Glass logo with liquid-filled core',
        material: 'crystal glass with glowing liquid interior',
        scene: 'logo floating, primary subject',
        lighting: 'soft internal glow with gentle top light',
        extras: 'liquid refraction inside glass',
        mood: 'luxury high-tech',
        background: 'dark smooth gradient with subtle haze'
      },
      {
        name: 'mirror_floor_reflection',
        description: 'Logo on mirror floor with crisp reflection',
        material: 'polished metal or crystal glass',
        scene: 'logo floating just above mirror floor, primary subject',
        lighting: 'soft studio light with strong reflections',
        extras: 'clean mirror reflection beneath logo',
        mood: 'premium product render',
        background: 'infinite dark studio with mirror floor'
      },
      {
        name: 'glass_coin_scatter',
        description: 'Logo with scattered glass coins',
        material: 'glass logo with subtle iridescence',
        scene: 'logo floating above scattered glass coins',
        lighting: 'soft neon edge light with gentle ambient fill',
        extras: 'glass coins with matching tint',
        mood: 'elegant crypto luxury',
        background: 'dark blue gradient with soft reflections'
      },
      {
        name: 'metal_coin_scatter',
        description: 'Logo with metal coin scatter (clean)',
        material: 'brushed metal logo with warm highlights',
        scene: 'logo floating above scattered metal coins',
        lighting: 'studio key light with subtle rim',
        extras: 'coins with soft depth-of-field',
        mood: 'premium financial',
        background: 'dark neutral gradient with subtle glow'
      },
      {
        name: 'liquid_metal_pool',
        description: 'Logo rising from a liquid metal pool',
        material: 'chrome or liquid metal surface',
        scene: 'logo emerging from smooth liquid metal pool',
        lighting: 'dramatic studio highlights on metal',
        extras: 'soft ripples in liquid metal',
        mood: 'high-end cinematic',
        background: 'dark studio with subtle haze'
      },
      {
        name: 'glass_shard_orbit',
        description: 'Logo with glass shard orbit (subtle)',
        material: 'clear glass with cyan/magenta accents',
        scene: 'logo floating with few glass shards orbiting',
        lighting: 'edge-lit glass with soft fill',
        extras: 'small glass shards, minimal count',
        mood: 'clean futuristic',
        background: 'dark geometric studio gradient'
      },
      {
        name: 'neon_halo_ring',
        description: 'Logo with glowing halo ring',
        material: 'polished chrome or crystal glass',
        scene: 'logo centered with a soft glowing ring behind',
        lighting: 'halo glow with soft studio key',
        extras: 'subtle light bloom around ring',
        mood: 'premium futuristic minimal',
        background: 'black to deep blue gradient'
      },
      {
        name: 'glass_panel_layers',
        description: 'Logo with layered glass panels',
        material: 'clear glass panels with light tint',
        scene: 'logo floating between layered glass panels',
        lighting: 'soft edge lighting with gentle reflections',
        extras: 'thin glass layers, minimal',
        mood: 'clean and architectural',
        background: 'dark matte studio'
      },
      {
        name: 'holographic_prism_edges',
        description: 'Logo with holographic prism edges',
        material: 'crystal glass with holographic rim',
        scene: 'logo floating, primary subject',
        lighting: 'prismatic rim light with soft ambient',
        extras: 'rainbow refraction along edges',
        mood: 'luxury futuristic',
        background: 'deep navy gradient'
      },
      {
        name: 'platinum_brush',
        description: 'Brushed platinum logo, clean studio',
        material: 'brushed platinum with subtle reflections',
        scene: 'logo floating, primary subject',
        lighting: 'soft studio key with gentle rim',
        extras: 'fine brushed texture highlights',
        mood: 'executive premium',
        background: 'dark grey studio gradient'
      },
      {
        name: 'pearl_gloss_plastic',
        description: 'Pearl glossy plastic logo',
        material: 'pearl white glossy plastic with soft sheen',
        scene: 'logo floating, primary subject',
        lighting: 'soft diffused light with mild rim',
        extras: 'subtle color shift in gloss',
        mood: 'clean modern luxury',
        background: 'dark matte studio with faint gradient'
      },
      {
        name: 'glass_cube_minimal',
        description: 'Minimal glass cube with logo',
        material: 'clear glass cube with logo embedded',
        scene: 'logo inside glass cube, centered',
        lighting: 'edge lighting with soft reflections',
        extras: 'clean refractions through cube',
        mood: 'minimal premium',
        background: 'dark studio with subtle geometric panels'
      },
      {
        name: 'blue_cyan_studio',
        description: 'Cool cyan studio glow',
        material: 'polished metal with cool blue reflections',
        scene: 'logo floating, primary subject',
        lighting: 'cool cyan key with soft rim',
        extras: 'soft light streak reflections',
        mood: 'cool futuristic',
        background: 'deep blue gradient'
      },
      {
        name: 'warm_amber_studio',
        description: 'Warm amber studio glow',
        material: 'golden metal with warm highlights',
        scene: 'logo floating, primary subject',
        lighting: 'warm amber key with soft rim',
        extras: 'gentle glow and reflections',
        mood: 'premium warm',
        background: 'dark brown to black gradient'
      },
      {
        name: 'clean_typographic_3d',
        description: '3D letters styled logo (Axelar style)',
        material: 'polished metal letters with glass edges',
        scene: 'logo letters standing on a clean pedestal',
        lighting: 'golden rays from behind with soft fill',
        extras: 'subtle pedestal reflection',
        mood: 'prestige premium',
        background: 'dark studio with soft light rays'
      },
      {
        name: 'glass_outline_logo',
        description: 'Glass outline logo with inner glow',
        material: 'clear glass outline with inner glow',
        scene: 'logo centered, primary subject',
        lighting: 'edge glow with soft ambient',
        extras: 'subtle internal light',
        mood: 'minimal neon',
        background: 'black gradient with soft vignette'
      },
      {
        name: 'micro_shard_sparkle_free',
        description: 'Logo with micro glass accents (no sparkles)',
        material: 'crystal glass with clean edges',
        scene: 'logo floating with a few tiny glass accents',
        lighting: 'soft studio lighting',
        extras: 'no sparkles, no particles',
        mood: 'refined minimal',
        background: 'deep charcoal gradient'
      },
      {
        name: 'coin_pedestal_minimal',
        description: 'Logo on clean pedestal with coins',
        material: 'polished metal logo with glass accents',
        scene: 'logo resting on sleek pedestal, minimal coins',
        lighting: 'soft spotlight with subtle rim',
        extras: 'few coins, low clutter',
        mood: 'premium finance',
        background: 'dark studio with gentle fog'
      },
      {
        name: 'glass_bevel_highlight',
        description: 'Beveled glass logo with strong highlights',
        material: 'beveled crystal glass with internal glow',
        scene: 'logo floating, primary subject',
        lighting: 'bright specular highlights with soft fill',
        extras: 'crisp bevel reflections',
        mood: 'luxury precision',
        background: 'dark blue to black gradient'
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
  buildOptimizedPrompt(network, feedbackAnalysis = null, generationCount = 0, customKeyword = null, preferences = null) {
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
    let prompt = `A stunning ${sizePrefix}${network} cryptocurrency logo, 3D CGI render, `;
    prompt += `${material}, `;
    prompt += `${scene}, `;
    prompt += `${lighting}, `;
    prompt += `${extras}, `;
    prompt += `${background}. `;
    prompt += `${style.mood}. `;
    
    // Add custom keyword naturally
    if (customKeyword && customKeyword.trim()) {
      prompt += `With ${customKeyword.trim()} elements. `;
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
