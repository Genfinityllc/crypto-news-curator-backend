/**
 * BACKUP - FALLBACK METHODS (REMOVED FROM MAIN SERVICES BY USER REQUEST)
 * 
 * These methods were removed from the main LoRA services because the user
 * explicitly requested NO FALLBACKS under any circumstances.
 * 
 * This file is kept as a backup in case fallbacks are ever needed in the future.
 * To use these, you would need to explicitly re-add them to the main services.
 */

// From HFSpacesLoraService.js
function usePreGeneratedImages(articleData, options = {}) {
  const clientId = this.detectClientFromArticle(articleData);
  const style = options.style || this.selectStyleForArticle(articleData);
  
  logger.info(`🎨 Selecting pre-generated LoRA image for client: ${clientId}`);
  
  // Map of available pre-generated images
  const preGeneratedImages = {
    'hedera': [
      'https://valtronk-crypto-news-lora-generator.hf.space/download/hedera.png',
      'https://raw.githubusercontent.com/valtronk/crypto-covers/main/hedera_energy_fields.png'
    ],
    'algorand': [
      'https://valtronk-crypto-news-lora-generator.hf.space/download/algorand.png',
      'https://raw.githubusercontent.com/valtronk/crypto-covers/main/algorand_energy_fields.png'
    ],
    'constellation': [
      'https://valtronk-crypto-news-lora-generator.hf.space/download/constellation.png',
      'https://raw.githubusercontent.com/valtronk/crypto-covers/main/constellation_network_nodes.png'
    ],
    'generic': [
      'https://valtronk-crypto-news-lora-generator.hf.space/download/generic.png',
      'https://raw.githubusercontent.com/valtronk/crypto-covers/main/generic_crypto_cover.png'
    ]
  };
  
  // Select appropriate images for the client
  const availableImages = preGeneratedImages[clientId] || preGeneratedImages['generic'];
  const selectedImage = availableImages[Math.floor(Math.random() * availableImages.length)];
  
  logger.info(`✅ Selected pre-generated LoRA image: ${selectedImage}`);
  
  return {
    success: true,
    coverUrl: selectedImage,
    generationMethod: 'pre_generated_lora_temp',
    clientId: clientId,
    style: style,
    size: options.size || '1792x896',
    generatedAt: new Date().toISOString(),
    metadata: {
      temporarySolution: true,
      selectedImage: selectedImage,
      note: 'Using pre-generated images while HF Spaces is being debugged'
    }
  };
}

function generateIntelligentFallback(title, articleData) {
  const network = articleData?.network || 'crypto';
  const networkColors = {
    'hedera': { bg: '8B2CE6', text: 'FFFFFF', name: 'Hedera' },
    'algorand': { bg: '0078CC', text: 'FFFFFF', name: 'Algorand' },
    'constellation': { bg: '484D8B', text: 'FFFFFF', name: 'Constellation' },
    'bitcoin': { bg: 'F7931A', text: '000000', name: 'Bitcoin' },
    'ethereum': { bg: '627EEA', text: 'FFFFFF', name: 'Ethereum' },
    'generic': { bg: '4A90E2', text: 'FFFFFF', name: 'Crypto' }
  };
  
  const colors = networkColors[network.toLowerCase()] || networkColors['generic'];
  const safeTitle = encodeURIComponent(title.substring(0, 50));
  const fallbackUrl = `https://via.placeholder.com/1792x896/${colors.bg}/${colors.text}?text=${safeTitle}+%7C+${colors.name}+News`;
  
  return {
    success: true,
    coverUrl: fallbackUrl,
    generationMethod: 'intelligent_fallback',
    clientId: this.detectClientFromArticle(articleData),
    style: 'fallback',
    size: '1792x896',
    generatedAt: new Date().toISOString(),
    metadata: {
      fallbackReason: 'HF Spaces service unavailable',
      originalTitle: title
    }
  };
}

// From loraAiService.js
function generateFallbackCover(articleData) {
  logger.info(`📝 Generating LoRA test cover for: ${articleData.title}`);
  
  const clientId = this.detectClientFromArticle(articleData);
  
  // Generate a test LoRA-style image URL for testing
  const testImageUrl = this.createTestLoRAImageUrl(articleData, clientId);
  
  return {
    success: true,
    coverUrl: testImageUrl,
    generationMethod: 'lora_test',
    clientId: clientId,
    style: 'test-mode',
    generatedAt: new Date().toISOString(),
    metadata: {
      note: 'Test LoRA image - AI Cover Generator service not deployed yet',
      client: clientId,
      title: articleData.title
    }
  };
}

function createTestLoRAImageUrl(article, clientId) {
  const title = encodeURIComponent(article.title.substring(0, 80));
  const client = encodeURIComponent(clientId.toUpperCase());
  
  // Generate a test image that looks like a LoRA-generated crypto news cover
  // Using placeholder service with LoRA-style parameters
  return `https://via.placeholder.com/1792x896/1a1a2e/ffffff?text=LoRA+TEST:+${client}+|+${title}`;
}

function createFallbackImageUrl(article, clientId) {
  const title = encodeURIComponent(article.title.substring(0, 100));
  const subtitle = encodeURIComponent(this.createSubtitle(article));
  
  // Use a service like images.weserv.nl for text-based images
  return `https://images.weserv.nl/?w=1792&h=896&bg=1a1a2e&color=fff&text=${title}&subtitle=${subtitle}&style=crypto`;
}

module.exports = {
  usePreGeneratedImages,
  generateIntelligentFallback,
  generateFallbackCover,
  createTestLoRAImageUrl,
  createFallbackImageUrl
};