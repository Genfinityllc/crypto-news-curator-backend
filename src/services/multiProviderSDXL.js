const axios = require('axios');
const FormData = require('form-data');
const logger = require('../utils/logger');

/**
 * Multi-Provider SDXL Service
 * 
 * Automatically tries multiple SDXL providers with fallbacks:
 * 1. RunPod (existing)
 * 2. Hugging Face Inference API 
 * 3. Replicate API
 * 4. Stability AI API
 */
class MultiProviderSDXLService {
  constructor() {
    this.providers = [
      {
        name: 'wavespeed',
        enabled: !!process.env.WAVESPEED_API_KEY,
        priority: 1,
        timeout: 30000, // 30 seconds - reliable
        generate: this.generateWavespeed.bind(this)
      },
      {
        name: 'pollinations',
        enabled: true, // Always available, completely free
        priority: 2,
        timeout: 20000, // 20 seconds - very fast
        generate: this.generatePollinations.bind(this)
      },
      {
        name: 'runpod',
        enabled: !!process.env.RUNPOD_API_KEY,
        priority: 3,
        timeout: 60000, // Reduced timeout - 1 minute
        generate: this.generateRunPod.bind(this)
      },
      {
        name: 'huggingface_free',
        enabled: true, // Always available, no API key needed
        priority: 4,
        timeout: 30000, // 30 seconds
        generate: this.generateHuggingFaceFree.bind(this)
      },
      {
        name: 'huggingface',
        enabled: !!process.env.HUGGINGFACE_API_KEY,
        priority: 5,
        timeout: 60000, // 1 minute
        generate: this.generateHuggingFace.bind(this)
      },
      {
        name: 'replicate',
        enabled: !!process.env.REPLICATE_API_TOKEN,
        priority: 6,
        timeout: 180000, // 3 minutes
        generate: this.generateReplicate.bind(this)
      },
      {
        name: 'stabilityai',
        enabled: !!process.env.STABILITY_API_KEY,
        priority: 7,
        timeout: 90000, // 1.5 minutes
        generate: this.generateStabilityAI.bind(this)
      },
      {
        name: 'placeholder',
        enabled: true, // Always available as final fallback
        priority: 99,
        timeout: 5000, // 5 seconds
        generate: this.generatePlaceholder.bind(this)
      }
    ];

    // Sort by priority and filter enabled providers
    this.enabledProviders = this.providers
      .filter(p => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    logger.info(`🔄 Multi-Provider SDXL initialized with ${this.enabledProviders.length} providers: ${this.enabledProviders.map(p => p.name).join(', ')}`);
  }

  /**
   * Generate with automatic provider fallback
   */
  async generateWithFallback(prompt, negativePrompt, options = {}) {
    const {
      width = 1800,
      height = 900,
      steps = 40,
      guidance_scale = 8.0,
      seed = Math.floor(Math.random() * 1000000)
    } = options;

    let lastError = null;

    for (const provider of this.enabledProviders) {
      try {
        logger.info(`🎯 Trying SDXL provider: ${provider.name}`);
        
        const startTime = Date.now();
        const result = await provider.generate({
          prompt,
          negative_prompt: negativePrompt,
          width,
          height,
          steps,
          guidance_scale,
          seed
        });

        const duration = Date.now() - startTime;
        logger.info(`✅ ${provider.name} succeeded in ${duration}ms`);

        return {
          success: true,
          provider: provider.name,
          duration,
          imageBuffer: result.imageBuffer,
          metadata: {
            provider: provider.name,
            duration,
            prompt,
            settings: { width, height, steps, guidance_scale, seed }
          }
        };

      } catch (error) {
        logger.warn(`❌ ${provider.name} failed: ${error.message}`);
        lastError = error;
        continue;
      }
    }

    // All providers failed
    throw new Error(`All SDXL providers failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * RunPod SDXL Generation (existing logic)
   */
  async generateRunPod(params) {
    const runpodApiKey = process.env.RUNPOD_API_KEY;
    if (!runpodApiKey) {
      throw new Error('RUNPOD_API_KEY not configured');
    }

    const payload = {
      input: {
        prompt: params.prompt,
        negative_prompt: params.negative_prompt,
        width: params.width,
        height: params.height,
        num_inference_steps: params.steps,
        guidance_scale: params.guidance_scale,
        scheduler: 'DPMSolverMultistep',
        seed: params.seed
      }
    };

    // Submit job
    const submitResponse = await axios.post('https://api.runpod.ai/v2/fnj041fg4ox7sn/run', payload, {
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${runpodApiKey}`,
        'Accept': 'application/json'
      }
    });

    const jobId = submitResponse.data.id;
    if (!jobId) {
      throw new Error('RunPod job submission failed');
    }

    // Poll for completion with much shorter timeout
    const maxAttempts = 6; // Reduced to 30 seconds max
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await axios.get(`https://api.runpod.ai/v2/fnj041fg4ox7sn/status/${jobId}`, {
        headers: { 'Authorization': `Bearer ${runpodApiKey}` },
        timeout: 30000
      });

      const status = statusResponse.data.status;
      
      if (status === 'COMPLETED') {
        const imageUrl = statusResponse.data.output?.image_url;
        if (!imageUrl) {
          throw new Error('RunPod completed but no image URL');
        }

        // Download image
        const imageResponse = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 60000
        });

        return { imageBuffer: Buffer.from(imageResponse.data) };
        
      } else if (status === 'FAILED') {
        throw new Error(`RunPod generation failed: ${statusResponse.data.error || 'Unknown error'}`);
      }
    }
    
    throw new Error('RunPod timeout - trying next provider');
  }

  /**
   * Hugging Face SDXL Generation
   */
  async generateHuggingFace(params) {
    const hfApiKey = process.env.HUGGINGFACE_API_KEY;
    if (!hfApiKey) {
      throw new Error('HUGGINGFACE_API_KEY not configured');
    }

    const payload = {
      inputs: params.prompt,
      parameters: {
        negative_prompt: params.negative_prompt,
        width: params.width,
        height: params.height,
        num_inference_steps: params.steps,
        guidance_scale: params.guidance_scale,
        seed: params.seed
      }
    };

    const response = await axios.post('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0', 
      payload, {
      timeout: 60000,
      headers: {
        'Authorization': `Bearer ${hfApiKey}`,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer'
    });

    if (response.headers['content-type']?.includes('application/json')) {
      // Error response
      const errorText = Buffer.from(response.data).toString();
      throw new Error(`Hugging Face error: ${errorText}`);
    }

    return { imageBuffer: Buffer.from(response.data) };
  }

  /**
   * Replicate SDXL Generation
   */
  async generateReplicate(params) {
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      throw new Error('REPLICATE_API_TOKEN not configured');
    }

    // Create prediction
    const prediction = await axios.post('https://api.replicate.com/v1/predictions', {
      version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b", // SDXL
      input: {
        prompt: params.prompt,
        negative_prompt: params.negative_prompt,
        width: params.width,
        height: params.height,
        num_inference_steps: params.steps,
        guidance_scale: params.guidance_scale,
        seed: params.seed
      }
    }, {
      headers: {
        'Authorization': `Token ${replicateToken}`,
        'Content-Type': 'application/json'
      }
    });

    const predictionId = prediction.data.id;

    // Poll for completion
    const maxAttempts = 20;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 3000));

      const status = await axios.get(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { 'Authorization': `Token ${replicateToken}` }
      });

      if (status.data.status === 'succeeded') {
        const imageUrl = status.data.output[0];
        
        // Download image
        const imageResponse = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 60000
        });

        return { imageBuffer: Buffer.from(imageResponse.data) };
        
      } else if (status.data.status === 'failed') {
        throw new Error(`Replicate failed: ${status.data.error || 'Unknown error'}`);
      }
    }

    throw new Error('Replicate timeout');
  }

  /**
   * Stability AI SDXL Generation
   */
  async generateStabilityAI(params) {
    const stabilityKey = process.env.STABILITY_API_KEY;
    if (!stabilityKey) {
      throw new Error('STABILITY_API_KEY not configured');
    }

    const formData = new FormData();
    formData.append('text_prompts[0][text]', params.prompt);
    if (params.negative_prompt) {
      formData.append('text_prompts[0][weight]', '1');
      formData.append('text_prompts[1][text]', params.negative_prompt);
      formData.append('text_prompts[1][weight]', '-1');
    }
    formData.append('cfg_scale', params.guidance_scale.toString());
    formData.append('width', params.width.toString());
    formData.append('height', params.height.toString());
    formData.append('steps', params.steps.toString());
    formData.append('seed', params.seed.toString());

    const response = await axios.post('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', 
      formData, {
      timeout: 90000,
      headers: {
        'Authorization': `Bearer ${stabilityKey}`,
        'Accept': 'application/json'
      }
    });

    if (response.data.artifacts && response.data.artifacts.length > 0) {
      const base64Image = response.data.artifacts[0].base64;
      return { imageBuffer: Buffer.from(base64Image, 'base64') };
    }

    throw new Error('Stability AI: No image artifacts returned');
  }


  /**
   * Wavespeed API Generation (Reliable)
   */
  async generateWavespeed(params) {
    const wavespeedApiKey = process.env.WAVESPEED_API_KEY;
    if (!wavespeedApiKey) {
      throw new Error('WAVESPEED_API_KEY not configured');
    }

    try {
      const payload = {
        prompt: params.prompt,
        negative_prompt: params.negative_prompt || '',
        width: params.width,
        height: params.height,
        steps: params.steps,
        guidance_scale: params.guidance_scale,
        seed: params.seed
      };

      logger.info(`⚡ Wavespeed generation: ${params.prompt.substring(0, 50)}...`);

      const response = await axios.post('https://wavespeed.ai/api/v1/generate', payload, {
        timeout: 30000,
        headers: {
          'Authorization': `Bearer ${wavespeedApiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      });

      if (response.headers['content-type']?.includes('application/json')) {
        // Error response
        const errorText = Buffer.from(response.data).toString();
        throw new Error(`Wavespeed error: ${errorText}`);
      }

      return { imageBuffer: Buffer.from(response.data) };

    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Wavespeed timeout - trying next provider');
      }
      throw new Error(`Wavespeed failed: ${error.message}`);
    }
  }

  /**
   * Pollinations.ai Generation (Free, Fast, No API Key)
   */
  async generatePollinations(params) {
    try {
      // Build prompt with negative prompts incorporated
      const fullPrompt = `${params.prompt}, professional digital art, high quality, ultra detailed, ${params.width}x${params.height}`;
      
      // Pollinations.ai simple URL-based API
      const encodedPrompt = encodeURIComponent(fullPrompt);
      const imageUrl = `https://pollinations.ai/p/${encodedPrompt}?width=${params.width}&height=${params.height}&enhance=true&nologo=true&seed=${params.seed || Math.floor(Math.random() * 1000000)}`;
      
      logger.info(`🌸 Pollinations.ai URL: ${imageUrl}`);
      
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 20000, // 20 seconds
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CryptoNewsBot/1.0)'
        }
      });
      
      if (response.data.length < 1000) {
        throw new Error('Pollinations returned suspiciously small image');
      }
      
      return { imageBuffer: Buffer.from(response.data) };
      
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Pollinations timeout - trying next provider');
      }
      throw new Error(`Pollinations failed: ${error.message}`);
    }
  }

  /**
   * Free Hugging Face SDXL Generation (No API Key Required)
   */
  async generateHuggingFaceFree(params) {
    try {
      // Use public Hugging Face inference endpoint (rate-limited but free)
      const response = await axios.post(
        'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
        {
          inputs: `${params.prompt}, professional digital art, high quality, ultra detailed`,
          parameters: {
            negative_prompt: params.negative_prompt || 'blurry, low quality, distorted',
            width: Math.min(params.width, 1024), // Limit size for free tier
            height: Math.min(params.height, 1024),
            num_inference_steps: Math.min(params.steps, 30), // Limit steps
            guidance_scale: params.guidance_scale
          }
        },
        {
          timeout: 30000, // Short timeout
          responseType: 'arraybuffer',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      // Check if response is an error (JSON) or image (binary)
      if (response.headers['content-type']?.includes('application/json')) {
        const errorText = Buffer.from(response.data).toString();
        const errorData = JSON.parse(errorText);
        
        if (errorData.error?.includes('loading')) {
          // Model is loading, wait and retry once
          await new Promise(resolve => setTimeout(resolve, 10000));
          throw new Error('HuggingFace model loading - trying next provider');
        }
        
        throw new Error(`HuggingFace Free error: ${errorData.error || errorText}`);
      }

      return { imageBuffer: Buffer.from(response.data) };
      
    } catch (error) {
      if (error.response?.status === 503) {
        throw new Error('HuggingFace Free service unavailable - model loading');
      }
      throw error;
    }
  }

  /**
   * Placeholder Generation (Final Fallback)
   */
  async generatePlaceholder(params) {
    const sharp = require('sharp');
    
    try {
      logger.info('🎨 Generating placeholder image as final fallback');
      
      // Create a solid color background with gradient
      const width = Math.min(params.width, 1800);
      const height = Math.min(params.height, 900);
      
      // Generate a simple gradient placeholder
      const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
              <stop offset="50%" style="stop-color:#16213e;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#0f3460;stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grad)"/>
          <text x="50%" y="40%" text-anchor="middle" fill="white" font-family="Arial" font-size="36" font-weight="bold">Crypto News</text>
          <text x="50%" y="55%" text-anchor="middle" fill="#00d4aa" font-family="Arial" font-size="24">${params.prompt?.substring(0, 50) || 'AI Generation'}</text>
          <text x="50%" y="70%" text-anchor="middle" fill="#888" font-family="Arial" font-size="16">Genfinity.com</text>
        </svg>
      `;
      
      const imageBuffer = await sharp(Buffer.from(svg))
        .png()
        .toBuffer();
        
      return { imageBuffer };
      
    } catch (error) {
      logger.error('❌ Even placeholder generation failed:', error.message);
      
      // Ultimate fallback - create minimal 1x1 pixel image
      const minimalBuffer = await sharp({
        create: {
          width: Math.min(params.width, 800),
          height: Math.min(params.height, 400),
          channels: 3,
          background: { r: 26, g: 26, b: 46 }
        }
      }).png().toBuffer();
      
      return { imageBuffer: minimalBuffer };
    }
  }

  /**
   * Get provider status
   */
  getProviderStatus() {
    return this.enabledProviders.map(provider => ({
      name: provider.name,
      enabled: provider.enabled,
      priority: provider.priority,
      hasApiKey: provider.enabled
    }));
  }

  /**
   * Test a specific provider
   */
  async testProvider(providerName) {
    const provider = this.enabledProviders.find(p => p.name === providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found or not enabled`);
    }

    logger.info(`🧪 Testing provider: ${providerName}`);

    try {
      const result = await provider.generate({
        prompt: "test image, simple coin, metallic surface, professional lighting",
        negative_prompt: "blurry, low quality",
        width: 512,
        height: 512,
        steps: 20,
        guidance_scale: 7.0,
        seed: 12345
      });

      return {
        success: true,
        provider: providerName,
        imageSize: result.imageBuffer.length
      };
      
    } catch (error) {
      return {
        success: false,
        provider: providerName,
        error: error.message
      };
    }
  }
}

module.exports = MultiProviderSDXLService;