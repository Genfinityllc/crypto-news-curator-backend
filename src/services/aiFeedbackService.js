/**
 * AI-Powered Feedback Evaluation Service
 * Uses GPT-4 Vision to analyze generated images and user feedback
 * to make intelligent, contextual adjustments to future prompts.
 */

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class AIFeedbackService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Counter for reference image usage (every 15th generation)
    this.generationCounter = 0;
    
    // Cache of good examples for reference
    this.referenceImagesDir = path.join(__dirname, '../../uploads/reference-images');
    this.referenceImages = [];
    this.loadReferenceImages();
    
    // Learned style preferences from AI analysis
    this.learnedStyles = {
      goodPromptPatterns: [],
      badPromptPatterns: [],
      logoSizePreference: 'large',  // small, medium, large, huge
      materialPreferences: ['chrome', 'crystal', 'gold', 'copper'],
      backgroundPreferences: ['dark', 'reflective', 'industrial'],
      lightingPreferences: ['dramatic', 'neon', 'backlit'],
      avoidElements: []
    };
  }

  loadReferenceImages() {
    try {
      if (fs.existsSync(this.referenceImagesDir)) {
        this.referenceImages = fs.readdirSync(this.referenceImagesDir)
          .filter(f => f.endsWith('.png') || f.endsWith('.jpg'))
          .map(f => path.join(this.referenceImagesDir, f));
        logger.info(`📸 Loaded ${this.referenceImages.length} reference images for style guidance`);
      }
    } catch (error) {
      logger.warn('Could not load reference images:', error.message);
    }
  }

  /**
   * Get a random reference image for "replace logo" generations (every 15th)
   */
  shouldUseReferenceImage() {
    this.generationCounter++;
    return this.generationCounter % 15 === 0;
  }

  getRandomReferenceImage() {
    if (this.referenceImages.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * this.referenceImages.length);
    return this.referenceImages[randomIndex];
  }

  /**
   * AI-powered analysis of user feedback with the generated image
   * Uses GPT-4 Vision to understand what the user means contextually
   */
  async analyzeUserFeedback({
    generatedImageUrl,
    logoRating,
    logoSize,
    logoStyle,
    backgroundRating,
    backgroundStyle,
    feedbackText,
    network,
    promptUsed
  }) {
    try {
      logger.info('🤖 AI Feedback Analysis starting...');
      
      // Build the analysis prompt
      const analysisPrompt = `You are an expert AI art director analyzing a generated cryptocurrency cover image.

CONTEXT:
- Network/Logo: ${network}
- Prompt used: "${promptUsed}"

USER FEEDBACK:
- Logo Rating: ${logoRating || 'not provided'}
- Logo Size Feedback: ${logoSize || 'not provided'}
- Logo Style Feedback: ${logoStyle || 'not provided'}
- Background Rating: ${backgroundRating || 'not provided'}
- Background Style Feedback: ${backgroundStyle || 'not provided'}
- Additional Comments: "${feedbackText || 'none'}"

TASK:
Analyze the generated image and the user's feedback. Provide specific, actionable adjustments for future prompts. Be precise about:

1. LOGO ANALYSIS: Is it 3D enough? Right size? Right material? Integrated into scene or looks flat/overlaid?
2. BACKGROUND ANALYSIS: Is it engaging? Too busy? Too plain? Right aesthetic?
3. LIGHTING ANALYSIS: Is the lighting dramatic enough? Good reflections?
4. MATERIAL ANALYSIS: What materials work/don't work based on feedback?
5. COMPOSITION: Is the layout balanced? Logo position good?

IMPORTANT STYLE GUIDELINES WE WANT:
- Logos should be large, 3D, and INTEGRATED into the scene (like physical objects)
- Materials: chrome, copper, gold, crystal glass, holographic, circuit patterns
- Lighting: dramatic backlighting, neon accents, volumetric rays
- Backgrounds: dark with contrast, industrial spaces, reflective surfaces, scattered coins
- NO flat overlays, NO small logos, NO generic stock-photo looks

Respond in JSON format:
{
  "overallQuality": "excellent|good|mediocre|poor",
  "logoAdjustments": {
    "sizeChange": "increase_50%|increase_25%|keep|decrease_25%",
    "materialSuggestion": "string describing ideal material",
    "integrationIssue": "none|slight|moderate|severe"
  },
  "backgroundAdjustments": {
    "styleSuggestion": "string describing ideal background",
    "elementsToAdd": ["array of elements"],
    "elementsToRemove": ["array of elements"]
  },
  "lightingAdjustments": {
    "suggestion": "string describing ideal lighting"
  },
  "promptModifications": {
    "addPhrases": ["phrases to add to future prompts"],
    "removePhrases": ["phrases to avoid in future prompts"]
  },
  "nextPromptSuggestion": "A complete prompt suggestion for a better generation"
}`;

      // Prepare the API call
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: analysisPrompt }
          ]
        }
      ];

      // Add image if available
      if (generatedImageUrl) {
        messages[0].content.push({
          type: 'image_url',
          image_url: {
            url: generatedImageUrl,
            detail: 'high'
          }
        });
      }

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      logger.info('🤖 AI Analysis complete:', JSON.stringify(analysis, null, 2));
      
      // Apply learned adjustments
      await this.applyLearnedAdjustments(analysis);
      
      return {
        success: true,
        analysis
      };
    } catch (error) {
      logger.error('AI Feedback analysis failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Apply the AI's learned adjustments to our prompt generation system
   */
  async applyLearnedAdjustments(analysis) {
    try {
      const PromptRefinementService = require('./promptRefinementService');
      
      // Size adjustments
      if (analysis.logoAdjustments?.sizeChange?.includes('increase')) {
        const increase = analysis.logoAdjustments.sizeChange.includes('50') ? 0.5 : 0.25;
        await PromptRefinementService.processRating({
          logoSize: `increase_${increase * 100}%`,
          feedbackKeyword: `make logo ${increase * 100}% larger`
        });
      }
      
      // Material preferences
      if (analysis.logoAdjustments?.materialSuggestion) {
        const materials = analysis.logoAdjustments.materialSuggestion.toLowerCase();
        if (materials.includes('chrome') || materials.includes('metal')) {
          this.learnedStyles.materialPreferences.push('chrome');
        }
        if (materials.includes('gold')) {
          this.learnedStyles.materialPreferences.push('gold');
        }
        if (materials.includes('crystal') || materials.includes('glass')) {
          this.learnedStyles.materialPreferences.push('crystal');
        }
      }
      
      // Elements to avoid
      if (analysis.backgroundAdjustments?.elementsToRemove) {
        this.learnedStyles.avoidElements.push(...analysis.backgroundAdjustments.elementsToRemove);
      }
      
      // Add good prompt phrases
      if (analysis.promptModifications?.addPhrases) {
        this.learnedStyles.goodPromptPatterns.push(...analysis.promptModifications.addPhrases);
      }
      
      // Track bad patterns
      if (analysis.promptModifications?.removePhrases) {
        this.learnedStyles.badPromptPatterns.push(...analysis.promptModifications.removePhrases);
      }
      
      logger.info('📚 Applied AI-learned adjustments to prompt system');
    } catch (error) {
      logger.error('Failed to apply learned adjustments:', error.message);
    }
  }

  /**
   * Get enhanced prompt based on AI learning
   */
  getPromptEnhancements() {
    return {
      addPhrases: [...new Set(this.learnedStyles.goodPromptPatterns)].slice(-10),
      avoidPhrases: [...new Set(this.learnedStyles.badPromptPatterns)].slice(-10),
      preferredMaterials: [...new Set(this.learnedStyles.materialPreferences)],
      avoidElements: [...new Set(this.learnedStyles.avoidElements)].slice(-15)
    };
  }

  /**
   * Generate a "replace logo" prompt for reference image usage
   */
  async generateReferenceBasedPrompt(network, referenceImagePath) {
    try {
      const referenceImageBase64 = fs.readFileSync(referenceImagePath).toString('base64');
      const mimeType = referenceImagePath.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `This is a high-quality cryptocurrency cover image that I love. I want to create a similar image but for ${network} cryptocurrency.

Analyze this image and create a prompt that would generate a SIMILAR style/composition/mood but with the ${network} logo instead.

Keep the same:
- Visual style and aesthetic
- Lighting approach
- Material treatments (chrome, glass, gold, etc.)
- Background mood
- Level of detail and quality

Change:
- Replace the logo with ${network} logo
- Adjust colors if ${network} has brand colors

Respond with ONLY the prompt text, no explanation. Make it detailed and specific for Nano-Banana-Pro image editing model.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${referenceImageBase64}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 500
      });

      const prompt = response.choices[0].message.content;
      logger.info(`🎨 Generated reference-based prompt for ${network}: ${prompt.substring(0, 100)}...`);
      
      return prompt;
    } catch (error) {
      logger.error('Failed to generate reference-based prompt:', error.message);
      return null;
    }
  }

  /**
   * Baseline prompts extracted from analyzing good examples
   */
  getBaselinePrompts(network) {
    const baselineStyles = [
      // Style 1: Crystal/holographic with trading data
      `A massive ${network} logo made of iridescent holographic crystal glass, floating in an ancient temple with stone pillars and ivy, surrounded by translucent holographic trading charts and price data, dramatic volumetric light rays from above, ultra-detailed 3D render`,
      
      // Style 2: Glowing neon particle on dark pedestal
      `The ${network} logo constructed from millions of glowing blue and gold particles, standing on a dark granite pedestal, minimal black background with subtle glass elements, dramatic rim lighting, reflective floor surface, 8k ultra detailed`,
      
      // Style 3: Golden circuit board scattered coins
      `A large 3D ${network} logo made of golden translucent glass with visible circuit board patterns inside, LED lights glowing within, scattered metallic crypto coins in background with shallow depth of field, dark moody lighting with green neon accents`,
      
      // Style 4: Copper patina industrial
      `Massive ${network} logo forged from weathered copper and teal patina metal, exploding through a digital matrix hologram, industrial warehouse setting, shattering glass and debris, rainbow light prisms, cinematic wide angle shot`,
      
      // Style 5: Crystal text space
      `The ${network} logo carved from pure diamond crystal, placed on a sleek black metal pedestal, deep space background with stars and distant galaxies, golden light rays emanating from behind, minimal elegant composition`,
      
      // Style 6: Stacked coins neon
      `Multiple ${network} branded coins stacked and scattered across a dark reflective surface, blue and orange neon light strips creating dramatic shadows, various angles and depths, metallic chrome and copper finish, ultra-realistic 3D render`,
      
      // Style 7: Liquid chrome splash
      `The ${network} logo emerging from a splash of liquid chrome metal, droplets frozen in mid-air, dark gradient background with subtle purple and blue tones, studio lighting with sharp reflections, professional product photography style`,
      
      // Style 8: Fire and ice contrast
      `A dramatic ${network} logo split between fire and ice materials, one half molten gold with flames, other half frozen crystal with frost, dark atmospheric background with smoke and mist, epic fantasy lighting`,
      
      // Style 9: Cyberpunk hologram
      `Giant ${network} hologram logo projected above a futuristic platform, cyan and magenta neon glow, scattered smaller holographic coins, rain droplets catching light, cyberpunk aesthetic without showing city buildings`,
      
      // Style 10: Abstract geometric
      `The ${network} logo constructed from geometric chrome shapes and fragments floating in formation, dark void background with subtle gradient, sharp studio lighting creating crisp reflections, modern minimal abstract art style`
    ];

    // Return a random baseline prompt
    return baselineStyles[Math.floor(Math.random() * baselineStyles.length)];
  }
}

module.exports = new AIFeedbackService();

