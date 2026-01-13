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
      {
        name: 'temple_holographic_solana',
        description: 'Ancient temple with holographic trading data (Solana style)',
        material: 'iridescent holographic glass with rainbow refraction',
        scene: 'floating inside ancient stone temple ruins with moss-covered pillars',
        lighting: 'volumetric god rays streaming from above through gaps',
        extras: 'surrounded by floating holographic trading charts showing price data and candlesticks',
        mood: 'mystical ancient technology fusion',
        background: 'dark atmospheric temple interior with blue cyan ambient glow'
      },
      {
        name: 'underwater_amber_liquid',
        description: 'Underwater scene with liquid-filled crystal (Robinhood style)',
        material: 'crystal glass vessel filled with glowing amber-gold liquid',
        scene: 'submerged underwater with rising bubbles',
        lighting: 'caustic underwater light patterns with warm golden rays from above',
        extras: 'tiny bubbles catching light, soft depth blur',
        mood: 'serene luxury underwater elegance',
        background: 'deep dark water fading to black with warm light penetrating from surface'
      },
      {
        name: 'crystal_coin_scatter',
        description: 'Crystal logo on reflective surface with scattered coins (Hedera style)',
        material: 'pure crystal glass with internal blue-violet glow',
        scene: 'standing on a dark reflective mirror surface',
        lighting: 'soft ambient neon glow from below creating reflections',
        extras: 'scattered glowing cryptocurrency coins surrounding the logo',
        mood: 'elegant wealth display',
        background: 'infinite dark void with mirror floor reflection'
      },
      {
        name: 'floating_glass_spheres',
        description: 'Floating glass bubbles with logos (Hedera bubble style)',
        material: 'transparent glass sphere with logo floating inside',
        scene: 'floating in abstract dark space with other glass spheres in background',
        lighting: 'rim lighting with cyan and magenta neon accents',
        extras: 'multiple glass spheres at different depths with bokeh blur',
        mood: 'ethereal floating dreams',
        background: 'pure black void with subtle depth'
      },
      {
        name: 'space_pedestal_rays',
        description: 'Crystal on pedestal with golden rays in space (Axelar style)',
        material: 'faceted diamond crystal with golden internal light',
        scene: 'mounted on sleek metallic pedestal against deep space',
        lighting: 'dramatic golden light rays radiating outward from behind',
        extras: 'distant stars and subtle colorful nebula in far background',
        mood: 'cosmic premium prestige',
        background: 'deep space starfield with subtle purple and blue nebula hints'
      },
      {
        name: 'gradient_glass_coins',
        description: 'Gradient glass logo with scattered coins (Solana coins style)',
        material: 'gradient glass transitioning from cyan to magenta to teal',
        scene: 'hovering above dark reflective surface with glass coins scattered',
        lighting: 'soft diffused ambient light with subtle reflections',
        extras: 'matching glass coins with same gradient lying around',
        mood: 'modern premium crypto aesthetic',
        background: 'deep blue gradient fading to dark'
      },
      {
        name: 'liquid_chrome_splash',
        description: 'Liquid metal splash effect',
        material: 'liquid chrome metal with gold and bronze swirls mid-splash',
        scene: 'frozen moment of liquid metal explosion',
        lighting: 'dramatic studio lighting with strong highlights',
        extras: 'droplets suspended in air catching light',
        mood: 'dynamic energy and motion',
        background: 'solid dark matte backdrop'
      },
      {
        name: 'neon_void_minimal',
        description: 'Minimalist neon on dark void',
        material: 'polished chrome with neon edge lighting',
        scene: 'floating in pure geometric dark void',
        lighting: 'sharp neon rim lights in cyan and purple',
        extras: 'subtle geometric shapes in background',
        mood: 'clean futuristic minimal',
        background: 'pure matte black with subtle gradient'
      }
    ];

    // Select style based on generation count for variety
    const styleIndex = generationCount % curatedStyles.length;
    const selectedStyle = curatedStyles[styleIndex];

    logger.info(`🎨 Selected curated style: ${selectedStyle.name} (gen #${generationCount})`);

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
