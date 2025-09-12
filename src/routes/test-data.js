const express = require('express');
const router = express.Router();
const { insertArticlesBatch, getSupabaseClient } = require('../config/supabase');
const logger = require('../utils/logger');

// Insert test articles with proper images
router.post('/insert-test-articles', async (req, res) => {
  try {
    logger.info('Inserting test articles with proper images');
    
    // First, clear old test articles from database
    const client = getSupabaseClient();
    if (client) {
      const clientNetworks = ['Hedera', 'XDC Network', 'Algorand', 'Constellation', 'HashPack', 'SWAP'];
      for (const network of clientNetworks) {
        const { error } = await client
          .from('articles')
          .delete()
          .eq('network', network);
        if (error) {
          logger.error(`Error deleting old ${network} articles:`, error.message);
        }
      }
      logger.info('Cleared old test articles from database');
    }
    
    const testArticles = [
      {
        title: "Hedera (HBAR) Price Surges 15% as ETF Speculation Drives Institutional Interest",
        content: "Hedera Hashgraph's native token HBAR has seen significant price movement following news of potential ETF filings. The cryptocurrency has gained 15% in the last 24 hours as institutional investors show increased interest in the enterprise-focused blockchain platform.",
        source: "CoinDesk",
        url: "https://example.com/hedera-price-surge",
        publishedAt: new Date().toISOString(),
        network: "Hedera",
        cover_image: "https://images.weserv.nl/?url=https%3A%2F%2Fcryptoslate.com%2Fwp-content%2Fuploads%2F2024%2F11%2Fhedera-hashgraph.jpg&w=400&h=225&fit=cover&output=jpg&q=85",
        breaking: false
      },
      {
        title: "XDC Network Partners with Major Financial Institution for Cross-Border Payments",
        content: "XDC Network has announced a strategic partnership with a leading financial institution to facilitate faster and more cost-effective cross-border payment solutions. The partnership leverages XDC's hybrid blockchain technology.",
        source: "Crypto News",
        url: "https://example.com/xdc-partnership",
        publishedAt: new Date().toISOString(),
        network: "XDC Network",
        cover_image: "https://images.weserv.nl/?url=https%3A%2F%2Fcryptoslate.com%2Fwp-content%2Fuploads%2F2024%2F11%2Fxdc-network.jpg&w=400&h=225&fit=cover&output=jpg&q=85",
        breaking: true
      },
      {
        title: "Algorand Launches New DeFi Protocol for Enhanced Yield Farming",
        content: "Algorand has introduced a new decentralized finance protocol that enables enhanced yield farming opportunities for users. The protocol is built on Algorand's carbon-negative blockchain infrastructure.",
        source: "DeFi Pulse",
        url: "https://example.com/algorand-defi",
        publishedAt: new Date().toISOString(),
        network: "Algorand",
        cover_image: "https://images.weserv.nl/?url=https%3A%2F%2Fcryptoslate.com%2Fwp-content%2Fuploads%2F2024%2F11%2Falgorand.jpg&w=400&h=225&fit=cover&output=jpg&q=85",
        breaking: false
      },
      {
        title: "Constellation Network's DAG Technology Gains Enterprise Adoption",
        content: "Constellation Network's Directed Acyclic Graph (DAG) technology has seen increased enterprise adoption as companies seek scalable blockchain solutions for their operations.",
        source: "Enterprise Blockchain News",
        url: "https://example.com/constellation-dag",
        publishedAt: new Date().toISOString(),
        network: "Constellation",
        cover_image: "https://images.weserv.nl/?url=https%3A%2F%2Fcryptoslate.com%2Fwp-content%2Fuploads%2F2024%2F11%2Fconstellation-network.jpg&w=400&h=225&fit=cover&output=jpg&q=85",
        breaking: false
      },
      {
        title: "HashPack Wallet Integrates with Major NFT Marketplace",
        content: "HashPack wallet has announced integration with a major NFT marketplace, enabling users to seamlessly trade and manage their NFT collections directly from the wallet interface.",
        source: "NFT News",
        url: "https://example.com/hashpack-nft",
        publishedAt: new Date().toISOString(),
        network: "HashPack",
        cover_image: "https://images.weserv.nl/?url=https%3A%2F%2Fcryptoslate.com%2Fwp-content%2Fuploads%2F2024%2F11%2Fhashpack-wallet.jpg&w=400&h=225&fit=cover&output=jpg&q=85",
        breaking: false
      }
    ];
    
    const insertedArticles = await insertArticlesBatch(testArticles);
    
    logger.info(`Test articles inserted: ${insertedArticles.length}`);
    
    res.json({
      success: true,
      message: `Successfully inserted ${insertedArticles.length} test articles`,
      articlesCount: insertedArticles.length
    });
  } catch (error) {
    logger.error('Error inserting test articles:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error inserting test articles',
      error: error.message
    });
  }
});

// Update existing articles with better images
router.post('/update-article-images', async (req, res) => {
  try {
    logger.info('Updating existing articles with better images');
    
    const client = getSupabaseClient();
    if (!client) {
      return res.status(500).json({
        success: false,
        message: 'Database not available'
      });
    }

    // Update Algorand article with proper image
    const { error: algoError } = await client
      .from('articles')
      .update({ 
        cover_image: 'https://images.weserv.nl/?url=https%3A%2F%2Fcryptoslate.com%2Fwp-content%2Fuploads%2F2024%2F11%2Falgorand.jpg&w=400&h=225&fit=cover&output=jpg&q=85'
      })
      .eq('network', 'Algorand')
      .eq('title', 'Algorand Launches New DeFi Protocol for Enhanced Yield Farming');

    if (algoError) {
      logger.error('Error updating Algorand image:', algoError.message);
    } else {
      logger.info('Updated Algorand article image');
    }

    // Update Hedera article with proper image
    const { error: hederaError } = await client
      .from('articles')
      .update({ 
        cover_image: 'https://images.weserv.nl/?url=https%3A%2F%2Fcryptoslate.com%2Fwp-content%2Fuploads%2F2024%2F11%2Fhedera-hashgraph.jpg&w=400&h=225&fit=cover&output=jpg&q=85'
      })
      .eq('network', 'Hedera')
      .eq('title', 'Hedera (HBAR) Price Surges 15% as ETF Speculation Drives Institutional Interest');

    if (hederaError) {
      logger.error('Error updating Hedera image:', hederaError.message);
    } else {
      logger.info('Updated Hedera article image');
    }

    // Update XDC Network article with proper image
    const { error: xdcError } = await client
      .from('articles')
      .update({ 
        cover_image: 'https://images.weserv.nl/?url=https%3A%2F%2Fcryptoslate.com%2Fwp-content%2Fuploads%2F2024%2F11%2Fxdc-network.jpg&w=400&h=225&fit=cover&output=jpg&q=85'
      })
      .eq('network', 'XDC Network')
      .eq('title', 'XDC Network Partners with Major Financial Institution for Cross-Border Payments');

    if (xdcError) {
      logger.error('Error updating XDC Network image:', xdcError.message);
    } else {
      logger.info('Updated XDC Network article image');
    }

    res.json({
      success: true,
      message: 'Updated article images successfully'
    });
  } catch (error) {
    logger.error('Error updating article images:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error updating article images',
      error: error.message
    });
  }
});

// Test image scraping for a specific URL
router.post('/test-image-scraping', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL is required'
      });
    }
    
    // Import the scraping function
    const { scrapeArticleImage } = require('../services/newsService');
    
    logger.info(`Testing image scraping for: ${url}`);
    const scrapedImage = await scrapeArticleImage(url);
    
    res.json({
      success: true,
      url: url,
      scrapedImage: scrapedImage,
      message: scrapedImage ? 'Image found' : 'No image found'
    });
  } catch (error) {
    logger.error('Error testing image scraping:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error testing image scraping',
      error: error.message
    });
  }
});

module.exports = router;
