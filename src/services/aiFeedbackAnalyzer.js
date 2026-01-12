/**
 * AI-Powered Feedback Analyzer
 * Uses Claude to contextually understand user feedback and provide specific prompt adjustments
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
   * @param {Object} params - Feedback parameters
   * @param {string} params.feedbackText - User's written feedback
   * @param {string} params.logoRating - good/bad rating for logo
   * @param {string} params.logoSize - too_small/perfect/too_large
   * @param {string} params.logoStyle - User's style feedback
   * @param {string} params.backgroundRating - good/bad rating for background
   * @param {string} params.backgroundStyle - User's background style feedback
   * @param {string} params.network - The cryptocurrency network
   * @param {string} params.promptUsed - The prompt that was used
   * @returns {Object} Analyzed feedback with specific adjustments
   */
  async analyzeFeedback(params) {
    const {
      feedbackText,
      logoRating,
      logoSize,
      logoStyle,
      backgroundRating,
      backgroundStyle,
      network,
      promptUsed
    } = params;

    // If no Anthropic client, return basic analysis
    if (!this.anthropic) {
      return this.basicAnalysis(params);
    }

    try {
      const systemPrompt = `You are an expert image generation prompt engineer specializing in 3D cryptocurrency cover art. 
      
Your task is to analyze user feedback about generated images and provide specific, actionable adjustments for future prompts.

Based on user feedback, you must return a JSON object with these fields:
- logoAdjustments: Object with size (number -0.3 to 0.3), material (string), style (string), avoid (array)
- backgroundAdjustments: Object with type (string), mood (string), avoid (array)
- promptModifiers: Array of specific phrases to add to prompts
- negativePrompts: Array of things to explicitly avoid
- overallQuality: "good" | "needs_improvement" | "poor"
- confidenceScore: 0-1 how confident you are in the analysis
- reasoning: Brief explanation of your analysis

IMPORTANT CONTEXT - These are proven GOOD styles the user likes:
1. Holographic iridescent glass logos in ancient temple settings with volumetric lighting
2. Crystal/glass logos filled with colored liquid (amber, cyan) with underwater caustics
3. Gold circuit board logos with LED lights on beds of dark crypto coins
4. Copper/bronze logos with patina breaking through holographic data matrices
5. Diamond/crystal text on metal pedestals with golden light rays
6. Liquid metal (gold/bronze) splash effects in Roman temple ruins

The user generally likes: glass effects (but not EVERYTHING glass), liquid-filled materials, dramatic lighting, 
ancient/temple backgrounds, space backgrounds, underwater scenes, large prominent logos.`;

      const userMessage = `Analyze this feedback for a ${network} cryptocurrency cover image:

RATINGS:
- Logo Rating: ${logoRating || 'not provided'}
- Logo Size: ${logoSize || 'not provided'}  
- Logo Style Feedback: ${logoStyle || 'not provided'}
- Background Rating: ${backgroundRating || 'not provided'}
- Background Style Feedback: ${backgroundStyle || 'not provided'}

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
   */
  basicAnalysis(params) {
    const {
      feedbackText,
      logoRating,
      logoSize,
      backgroundRating
    } = params;

    const result = {
      success: true,
      aiAnalyzed: false,
      logoAdjustments: { size: 0, material: null, style: null, avoid: [] },
      backgroundAdjustments: { type: null, mood: null, avoid: [] },
      promptModifiers: [],
      negativePrompts: [],
      overallQuality: 'needs_improvement',
      confidenceScore: 0.5,
      reasoning: 'Basic rule-based analysis (AI unavailable)'
    };

    // Logo size adjustments
    if (logoSize === 'too_small') {
      result.logoAdjustments.size = 0.2;
      result.promptModifiers.push('large prominent');
    } else if (logoSize === 'too_large') {
      result.logoAdjustments.size = -0.15;
      result.promptModifiers.push('elegantly sized');
    }

    // Parse feedback text for common issues
    const feedback = (feedbackText || '').toLowerCase();
    
    if (feedback.includes('glass') && (feedback.includes('too much') || feedback.includes('everything'))) {
      result.backgroundAdjustments.avoid.push('glass_everywhere');
      result.promptModifiers.push('solid matte background');
    }
    
    if (feedback.includes('small') || feedback.includes('bigger')) {
      result.logoAdjustments.size = Math.max(result.logoAdjustments.size, 0.15);
    }

    if (feedback.includes('dark') && feedback.includes('background')) {
      result.backgroundAdjustments.mood = 'dark dramatic';
    }

    // Quality assessment
    if (logoRating === 'good' && backgroundRating === 'good') {
      result.overallQuality = 'good';
    } else if (logoRating === 'bad' && backgroundRating === 'bad') {
      result.overallQuality = 'poor';
    }

    return result;
  }

  /**
   * Get curated prompt based on proven good styles
   * @param {string} network - The cryptocurrency network
   * @param {number} generationCount - Current generation count for variety
   * @returns {Object} Curated prompt components
   */
  getCuratedPromptStyle(network, generationCount = 0) {
    // These are the proven styles from the good examples
    const curatedStyles = [
      {
        name: 'temple_holographic',
        material: 'holographic iridescent glass filled with swirling energy',
        scene: 'ancient stone temple interior with moss-covered columns',
        lighting: 'volumetric god rays from above',
        extras: 'floating holographic trading charts and data visualizations',
        mood: 'mystical technological fusion'
      },
      {
        name: 'liquid_crystal_underwater',
        material: 'crystal glass vessel filled with glowing amber liquid',
        scene: 'submerged underwater environment',
        lighting: 'caustic light patterns and gentle bubbles',
        extras: 'underwater particles and light refraction',
        mood: 'serene premium luxury'
      },
      {
        name: 'circuit_gold_coins',
        material: 'golden circuit board with embedded LED lights and traces',
        scene: 'scattered pile of dark metallic cryptocurrency coins',
        lighting: 'dramatic top-down spotlight with green accent glow',
        extras: 'subtle bokeh and depth of field',
        mood: 'high-tech wealth'
      },
      {
        name: 'copper_data_warehouse',
        material: 'oxidized copper with turquoise patina',
        scene: 'vast industrial warehouse with concrete floors',
        lighting: 'natural light from large windows',
        extras: 'breaking through holographic digital matrix, debris particles',
        mood: 'raw industrial power'
      },
      {
        name: 'diamond_space_pedestal',
        material: 'faceted diamond crystal with internal light refraction',
        scene: 'sleek metallic pedestal against deep space starfield',
        lighting: 'golden backlight with radiating rays',
        extras: 'subtle nebula colors and star particles',
        mood: 'cosmic premium'
      },
      {
        name: 'liquid_metal_temple',
        material: 'molten gold/bronze liquid metal splash crown',
        scene: 'ancient Roman temple ruins with statues',
        lighting: 'dramatic cinematic golden hour',
        extras: 'liquid droplets suspended in air',
        mood: 'epic historical'
      },
      {
        name: 'holographic_glass_minimal',
        material: 'prismatic holographic glass with rainbow refractions',
        scene: 'minimalist dark concrete pedestal and wall',
        lighting: 'soft studio lighting with subtle shadows',
        extras: 'clean professional presentation',
        mood: 'modern minimalist luxury'
      },
      {
        name: 'crystal_coins_reflection',
        material: 'gradient crystalline glass with cyan and magenta tints',
        scene: 'reflective dark surface with scattered glass coins',
        lighting: 'soft ambient glow from below',
        extras: 'mirror reflections and subtle fog',
        mood: 'ethereal wealth'
      }
    ];

    // Select style based on generation count for variety
    const styleIndex = generationCount % curatedStyles.length;
    const selectedStyle = curatedStyles[styleIndex];

    logger.info(`🎨 Selected curated style: ${selectedStyle.name} (gen #${generationCount})`);

    return selectedStyle;
  }

  /**
   * Build an optimized prompt using curated styles and AI feedback
   * @param {string} network - The cryptocurrency network
   * @param {Object} feedbackAnalysis - Previous AI feedback analysis
   * @param {number} generationCount - Current generation count
   * @param {string} customKeyword - User's custom keyword/phrase
   * @returns {string} Optimized prompt
   */
  buildOptimizedPrompt(network, feedbackAnalysis = null, generationCount = 0, customKeyword = null) {
    const style = this.getCuratedPromptStyle(network, generationCount);
    
    let material = style.material;
    let scene = style.scene;
    let lighting = style.lighting;
    let extras = style.extras;
    
    // Apply AI feedback adjustments if available
    if (feedbackAnalysis && feedbackAnalysis.aiAnalyzed) {
      const { logoAdjustments, backgroundAdjustments, promptModifiers, negativePrompts } = feedbackAnalysis;
      
      // Adjust material based on feedback
      if (logoAdjustments?.material) {
        material = logoAdjustments.material;
      }
      
      // Add prompt modifiers
      if (promptModifiers && promptModifiers.length > 0) {
        extras = `${extras}, ${promptModifiers.join(', ')}`;
      }
    }
    
    // Build the prompt
    let prompt = `A stunning 3D ${network} cryptocurrency logo rendered in ${material}, `;
    prompt += `positioned in ${scene}, `;
    prompt += `illuminated by ${lighting}, `;
    prompt += `featuring ${extras}. `;
    prompt += `The mood is ${style.mood}. `;
    
    // Add custom keyword naturally
    if (customKeyword && customKeyword.trim()) {
      prompt += `Incorporating ${customKeyword.trim()} elements. `;
    }
    
    // Standard quality boosters
    prompt += `Ultra high quality, 8K resolution, professional 3D render, photorealistic, `;
    prompt += `cinematic composition, award-winning digital art.`;
    
    // Add negative prompt section
    const negatives = [
      'no text', 'no watermarks', 'no distortion', 'no blur',
      'no low quality', 'no pixelation', 'no artifacts',
      'no cityscape', 'no buildings', 'no skyline',
      'no nebula spirals', 'no sparkle emissions'
    ];
    
    if (feedbackAnalysis?.negativePrompts) {
      negatives.push(...feedbackAnalysis.negativePrompts);
    }
    
    prompt += ` Negative: ${negatives.join(', ')}.`;
    
    logger.info(`📝 Built optimized prompt for ${network}:`, prompt.substring(0, 150) + '...');
    
    return prompt;
  }
}

module.exports = new AIFeedbackAnalyzer();
