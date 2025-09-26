const express = require('express');
const router = express.Router();
const pressReleaseService = require('../services/pressReleaseService');
const logger = require('../utils/logger');

/**
 * 🏛️ PRESS RELEASE API ROUTES
 * 
 * Legal workaround for PRNewswire keyword extraction
 * - Aggregates from multiple sources (Google News, GlobeNewswire, etc.)
 * - Client-specific keyword filtering
 * - 100% image coverage guarantee
 * - Hourly automated updates
 */

/**
 * GET /api/press-releases
 * Extract press releases with optional client filtering
 */
router.get('/', async (req, res) => {
  try {
    const { client, limit = 50 } = req.query;
    
    logger.info(`📰 Press release request: client=${client || 'all'}, limit=${limit}`);
    
    // Extract press releases with client filtering
    const pressReleases = await pressReleaseService.extractClientPressReleases(client || 'all');
    
    // Apply limit
    const limitedResults = pressReleases.slice(0, parseInt(limit));
    
    res.status(200).json({
      success: true,
      data: {
        press_releases: limitedResults,
        total_count: limitedResults.length,
        client_filter: client || 'all',
        timestamp: new Date().toISOString()
      },
      meta: {
        extraction_method: 'multi-source_legal_aggregation',
        sources: [
          'Google News (PRNewswire)',
          'GlobeNewswire Direct',
          'AccessWire',
          'General Crypto PR'
        ],
        image_guarantee: '100%',
        update_frequency: 'hourly'
      }
    });
    
  } catch (error) {
    logger.error('Press release extraction failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to extract press releases',
      message: error.message
    });
  }
});

/**
 * GET /api/press-releases/clients
 * Get available client filters
 */
router.get('/clients', (req, res) => {
  const availableClients = [
    'all',
    'XDC Network',
    'Hedera', 
    'Algorand',
    'Constellation',
    'HashPack'
  ];
  
  res.status(200).json({
    success: true,
    data: {
      available_clients: availableClients,
      description: 'Client filters for press release extraction'
    }
  });
});

/**
 * GET /api/press-releases/sources
 * Get information about press release sources
 */
router.get('/sources', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      sources: [
        {
          name: 'Google News (PRNewswire)',
          description: 'Legal extraction of PRNewswire content via Google News RSS',
          method: 'RSS aggregation',
          update_frequency: 'Real-time'
        },
        {
          name: 'GlobeNewswire',
          description: 'Direct RSS feeds from GlobeNewswire press releases',
          method: 'Direct RSS',
          update_frequency: 'Real-time'
        },
        {
          name: 'AccessWire',
          description: 'Technology and crypto press releases',
          method: 'Direct RSS',
          update_frequency: 'Real-time'
        },
        {
          name: 'General Crypto PR',
          description: 'Aggregated cryptocurrency press releases',
          method: 'Google News RSS',
          update_frequency: 'Real-time'
        }
      ],
      legal_compliance: 'All sources accessed via public RSS feeds or Google News aggregation',
      image_coverage: '100% through multi-layer validation pipeline'
    }
  });
});

/**
 * POST /api/press-releases/extract
 * Manual extraction trigger for testing
 */
router.post('/extract', async (req, res) => {
  try {
    const { client } = req.body;
    
    logger.info(`🔄 Manual press release extraction triggered for client: ${client || 'all'}`);
    
    const pressReleases = await pressReleaseService.extractClientPressReleases(client || 'all');
    
    res.status(200).json({
      success: true,
      data: {
        extracted_count: pressReleases.length,
        press_releases: pressReleases.slice(0, 10), // Return first 10 for preview
        client_filter: client || 'all',
        extraction_timestamp: new Date().toISOString()
      },
      message: 'Press release extraction completed successfully'
    });
    
  } catch (error) {
    logger.error('Manual press release extraction failed:', error);
    res.status(500).json({
      success: false,
      error: 'Manual extraction failed',
      message: error.message
    });
  }
});

module.exports = router;