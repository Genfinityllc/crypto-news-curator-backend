const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

// Get user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile'
    });
  }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { username, email, preferences } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (username) user.username = username;
    if (email) user.email = email;
    if (preferences) user.preferences = { ...user.preferences, ...preferences };

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
  } catch (error) {
    logger.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user profile'
    });
  }
});

// Get user's curated articles
router.get('/curated', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const articles = await News.find({
      'curation.curatedBy': req.user.id,
      isActive: true
    })
    .sort({ 'curation.curatedAt': -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await News.countDocuments({
      'curation.curatedBy': req.user.id,
      isActive: true
    });

    res.json({
      success: true,
      data: articles,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error('Error fetching curated articles:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching curated articles'
    });
  }
});

// Get user's reading history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findById(req.user.id).populate({
      path: 'readingHistory.article',
      select: 'title network category publishedAt coverImage'
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const history = user.readingHistory
      .sort((a, b) => new Date(b.readAt) - new Date(a.readAt))
      .slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      data: history,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(user.readingHistory.length / limit),
        hasNext: page * limit < user.readingHistory.length,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error('Error fetching reading history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reading history'
    });
  }
});

// Add article to reading history
router.post('/history/:articleId', authMiddleware, async (req, res) => {
  try {
    const { articleId } = req.params;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove if already exists
    user.readingHistory = user.readingHistory.filter(
      item => item.article.toString() !== articleId
    );

    // Add to beginning
    user.readingHistory.unshift({
      article: articleId,
      readAt: new Date()
    });

    // Keep only last 100 articles
    if (user.readingHistory.length > 100) {
      user.readingHistory = user.readingHistory.slice(0, 100);
    }

    await user.save();

    res.json({
      success: true,
      message: 'Article added to reading history'
    });
  } catch (error) {
    logger.error('Error adding to reading history:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding to reading history'
    });
  }
});

// Get user preferences
router.get('/preferences', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('preferences');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user.preferences
    });
  } catch (error) {
    logger.error('Error fetching user preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user preferences'
    });
  }
});

// Update user preferences
router.put('/preferences', authMiddleware, async (req, res) => {
  try {
    const { preferences } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.preferences = { ...user.preferences, ...preferences };
    await user.save();

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: user.preferences
    });
  } catch (error) {
    logger.error('Error updating user preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user preferences'
    });
  }
});

module.exports = router;
