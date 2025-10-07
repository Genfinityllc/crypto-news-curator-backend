const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Google AI Fact-Checking Service
 * Validates AI rewritten articles for accuracy and provides improvement insights
 */
class FactCheckService {
  constructor() {
    this.googleApiKey = process.env.GOOGLE_AI_API_KEY;
    this.factCheckApiKey = process.env.GOOGLE_FACT_CHECK_API_KEY || this.googleApiKey;
    this.geminiApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
    this.factCheckApiUrl = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';
    
    if (!this.googleApiKey) {
      logger.warn('Google AI API key not found. Fact-checking will be disabled.');
    }
  }

  /**
   * Comprehensive fact-check of rewritten article
   */
  async factCheckArticle(rewrittenContent, originalContent, title, network) {
    try {
      if (!this.googleApiKey) {
        return this.createFallbackResponse('API key not available');
      }

      logger.info(`🔍 Starting fact-check for article: ${title}`);

      // Run multiple fact-checking approaches in parallel
      const [
        geminiAnalysis,
        claimVerification,
        speculationCheck
      ] = await Promise.allSettled([
        this.analyzeWithGemini(rewrittenContent, originalContent, title, network),
        this.verifyFactualClaims(rewrittenContent),
        this.checkSpeculation(rewrittenContent, network)
      ]);

      // Combine results
      const factCheckResult = {
        overall_score: 0,
        confidence_level: 'low',
        issues_found: [],
        improvements_suggested: [],
        fact_verification: {},
        speculation_analysis: {},
        gemini_insights: {},
        timestamp: new Date().toISOString()
      };

      // Process Gemini analysis
      if (geminiAnalysis.status === 'fulfilled') {
        factCheckResult.gemini_insights = geminiAnalysis.value;
        factCheckResult.overall_score += 40; // Gemini contributes 40% to score
      }

      // Process claim verification
      if (claimVerification.status === 'fulfilled') {
        factCheckResult.fact_verification = claimVerification.value;
        factCheckResult.overall_score += 30; // Claim verification contributes 30%
      }

      // Process speculation check
      if (speculationCheck.status === 'fulfilled') {
        factCheckResult.speculation_analysis = speculationCheck.value;
        factCheckResult.overall_score += 30; // Speculation check contributes 30%
      }

      // Calculate final confidence level
      if (factCheckResult.overall_score >= 80) {
        factCheckResult.confidence_level = 'high';
      } else if (factCheckResult.overall_score >= 60) {
        factCheckResult.confidence_level = 'medium';
      } else {
        factCheckResult.confidence_level = 'low';
      }

      // Compile issues and improvements
      this.compileRecommendations(factCheckResult);

      logger.info(`✅ Fact-check completed. Score: ${factCheckResult.overall_score}/100, Confidence: ${factCheckResult.confidence_level}`);
      
      return factCheckResult;

    } catch (error) {
      logger.error(`❌ Fact-check failed: ${error.message}`);
      return this.createFallbackResponse(error.message);
    }
  }

  /**
   * Use Gemini API for comprehensive content analysis
   */
  async analyzeWithGemini(rewrittenContent, originalContent, title, network) {
    try {
      const prompt = `You are a professional fact-checker specializing in cryptocurrency and financial content. Analyze the following rewritten article for factual accuracy, speculation, and potential issues.

ORIGINAL CONTENT:
${originalContent}

REWRITTEN CONTENT:
${rewrittenContent}

ANALYSIS REQUIREMENTS:
1. Factual Accuracy: Check for any factual claims that seem incorrect or unverifiable
2. Speculation Level: Identify speculative language and unsubstantiated predictions
3. Source Consistency: Verify that rewritten claims align with original content
4. Market Claims: Flag any price predictions or market claims that seem unrealistic
5. Technical Accuracy: Check cryptocurrency/blockchain technical details

Please provide your analysis in JSON format:
{
  "accuracy_score": 0-100,
  "speculation_level": "low|medium|high",
  "factual_issues": ["issue1", "issue2"],
  "speculative_claims": ["claim1", "claim2"],
  "improvements_needed": ["improvement1", "improvement2"],
  "technical_accuracy": "accurate|questionable|inaccurate",
  "overall_assessment": "detailed assessment"
}`;

      const response = await axios.post(
        `${this.geminiApiUrl}?key=${this.googleApiKey}`,
        {
          contents: [{
            parts: [{ text: prompt }]
          }]
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );

      const geminiText = response.data.candidates[0].content.parts[0].text;
      
      // Try to parse JSON response
      try {
        return JSON.parse(geminiText);
      } catch (parseError) {
        // If JSON parsing fails, create structured response from text
        return {
          accuracy_score: 75,
          speculation_level: 'medium',
          factual_issues: [],
          speculative_claims: [],
          improvements_needed: ['Review for factual accuracy'],
          technical_accuracy: 'questionable',
          overall_assessment: geminiText,
          raw_response: geminiText
        };
      }

    } catch (error) {
      logger.error(`Gemini analysis failed: ${error.message}`);
      return {
        accuracy_score: 50,
        speculation_level: 'unknown',
        factual_issues: ['Could not verify with Gemini'],
        speculative_claims: [],
        improvements_needed: ['Manual fact-check recommended'],
        technical_accuracy: 'unknown',
        overall_assessment: `Analysis failed: ${error.message}`
      };
    }
  }

  /**
   * Verify factual claims using Google Fact Check API
   */
  async verifyFactualClaims(content) {
    try {
      // Extract potential claims from content
      const claims = this.extractClaims(content);
      
      if (claims.length === 0) {
        return {
          claims_checked: 0,
          verified_claims: 0,
          flagged_claims: [],
          confidence: 'medium'
        };
      }

      const verificationResults = [];

      // Check each claim against Google's fact-check database
      for (const claim of claims.slice(0, 5)) { // Limit to 5 claims to avoid API limits
        try {
          const response = await axios.get(this.factCheckApiUrl, {
            params: {
              key: this.factCheckApiKey,
              query: claim,
              languageCode: 'en'
            },
            timeout: 10000
          });

          if (response.data.claims && response.data.claims.length > 0) {
            verificationResults.push({
              claim: claim,
              fact_check_data: response.data.claims[0],
              status: 'checked'
            });
          }
        } catch (apiError) {
          logger.warn(`Fact-check API error for claim "${claim}": ${apiError.message}`);
        }
      }

      return {
        claims_checked: claims.length,
        verified_claims: verificationResults.length,
        flagged_claims: verificationResults.filter(r => 
          r.fact_check_data.claimReview && 
          r.fact_check_data.claimReview[0].textualRating.toLowerCase().includes('false')
        ),
        verification_results: verificationResults,
        confidence: verificationResults.length > 0 ? 'high' : 'low'
      };

    } catch (error) {
      logger.error(`Claim verification failed: ${error.message}`);
      return {
        claims_checked: 0,
        verified_claims: 0,
        flagged_claims: [],
        confidence: 'low',
        error: error.message
      };
    }
  }

  /**
   * Check for excessive speculation in crypto content
   */
  async checkSpeculation(content, network) {
    const speculativePatterns = [
      /will (reach|hit|surge to|climb to)\s*\$?\d+/gi,
      /expected to (rise|increase|surge|moon)/gi,
      /could potentially (reach|hit|surge)/gi,
      /analysts predict.*\$?\d+/gi,
      /price target.*\$?\d+/gi,
      /next (bull run|rally|surge)/gi,
      /to the moon/gi,
      /diamond hands/gi,
      /guaranteed (returns|profits)/gi,
      /easy money/gi
    ];

    const speculativeMatches = [];
    let speculationScore = 0;

    speculativePatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        speculativeMatches.push(...matches);
        speculationScore += matches.length * 10; // Each match adds 10 points
      }
    });

    // Check for balanced language
    const balancedPhrases = content.match(/(may|might|could|potentially|according to|analysts suggest)/gi) || [];
    const definitiveStatements = content.match(/(will definitely|guaranteed|certain to|absolutely will)/gi) || [];

    return {
      speculation_score: Math.min(speculationScore, 100),
      speculation_level: speculationScore > 50 ? 'high' : speculationScore > 20 ? 'medium' : 'low',
      speculative_phrases: speculativeMatches,
      balanced_language_count: balancedPhrases.length,
      definitive_statements: definitiveStatements,
      recommendations: speculationScore > 30 ? [
        'Reduce speculative language',
        'Add more balanced, analytical tone',
        'Include disclaimers about market volatility'
      ] : ['Content speculation level is acceptable']
    };
  }

  /**
   * Extract potential factual claims from content
   */
  extractClaims(content) {
    const claims = [];
    
    // Remove HTML tags for text analysis
    const textContent = content.replace(/<[^>]*>/g, ' ').trim();
    
    // Split into sentences and filter for claim-like statements
    const sentences = textContent.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    sentences.forEach(sentence => {
      sentence = sentence.trim();
      
      // Look for factual claim patterns
      if (
        sentence.match(/according to|reports show|data reveals|studies indicate/i) ||
        sentence.match(/\$\d+|\d+%|\d+ billion|\d+ million/i) ||
        sentence.match(/increased by|decreased by|grew by|fell by/i) ||
        sentence.match(/partnership|announcement|launched|released/i)
      ) {
        claims.push(sentence);
      }
    });

    return claims.slice(0, 10); // Limit to 10 claims
  }

  /**
   * Compile final recommendations
   */
  compileRecommendations(factCheckResult) {
    const issues = [];
    const improvements = [];

    // From Gemini analysis
    if (factCheckResult.gemini_insights.factual_issues) {
      issues.push(...factCheckResult.gemini_insights.factual_issues);
    }
    if (factCheckResult.gemini_insights.improvements_needed) {
      improvements.push(...factCheckResult.gemini_insights.improvements_needed);
    }

    // From speculation analysis
    if (factCheckResult.speculation_analysis.speculation_level === 'high') {
      issues.push('High speculation level detected');
      improvements.push(...factCheckResult.speculation_analysis.recommendations);
    }

    // From claim verification
    if (factCheckResult.fact_verification.flagged_claims?.length > 0) {
      issues.push(`${factCheckResult.fact_verification.flagged_claims.length} potentially false claims found`);
      improvements.push('Review flagged claims against fact-check databases');
    }

    factCheckResult.issues_found = [...new Set(issues)]; // Remove duplicates
    factCheckResult.improvements_suggested = [...new Set(improvements)];
  }

  /**
   * Create fallback response when fact-checking fails
   */
  createFallbackResponse(reason) {
    return {
      overall_score: 60,
      confidence_level: 'medium',
      issues_found: ['Fact-checking service unavailable'],
      improvements_suggested: ['Manual review recommended'],
      fact_verification: { status: 'unavailable', reason },
      speculation_analysis: { status: 'unavailable', reason },
      gemini_insights: { status: 'unavailable', reason },
      timestamp: new Date().toISOString(),
      fallback: true
    };
  }

  /**
   * Get service status
   */
  async getStatus() {
    return {
      service: 'Google AI Fact Check Service',
      google_api_available: !!this.googleApiKey,
      fact_check_api_available: !!this.factCheckApiKey,
      last_checked: new Date().toISOString()
    };
  }
}

module.exports = FactCheckService;