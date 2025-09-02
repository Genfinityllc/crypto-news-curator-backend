const express = require('express');
const {
  createFirebaseUser,
  verifyFirebaseToken,
  createUserProfile,
  getUserProfile,
  updateUserProfile,
  addBookmarkToFirestore,
  getUserBookmarks
} = require('../config/firebase');
const logger = require('../utils/logger');

const router = express.Router();

// Firebase Auth Middleware
async function firebaseAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token required'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyFirebaseToken(idToken);
    
    req.user = decodedToken;
    next();
    
  } catch (error) {
    logger.error('Firebase auth error:', error.message);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
}

// Create user account (called after Firebase Auth signup)
router.post('/create-profile', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { username, displayName } = req.body;
    const userId = req.user.uid;
    const email = req.user.email;

    // Check if profile already exists
    const existingProfile = await getUserProfile(userId);
    if (existingProfile) {
      return res.json({
        success: true,
        message: 'Profile already exists',
        profile: existingProfile
      });
    }

    // Create new profile
    const profileData = {
      email,
      username: username || email.split('@')[0],
      displayName: displayName || username || email.split('@')[0]
    };

    const profile = await createUserProfile(userId, profileData);
    
    res.status(201).json({
      success: true,
      message: 'User profile created successfully',
      profile
    });

  } catch (error) {
    logger.error('Error creating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user profile'
    });
  }
});

// Get current user profile
router.get('/profile', firebaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.uid;
    const profile = await getUserProfile(userId);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }
    
    res.json({
      success: true,
      profile
    });

  } catch (error) {
    logger.error('Error getting profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
});

// Update user profile
router.put('/profile', firebaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { username, displayName, preferences } = req.body;

    const updateData = {};
    if (username) updateData.username = username;
    if (displayName) updateData.displayName = displayName;
    if (preferences) updateData.preferences = preferences;

    await updateUserProfile(userId, updateData);
    
    const updatedProfile = await getUserProfile(userId);
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      profile: updatedProfile
    });

  } catch (error) {
    logger.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// Add bookmark
router.post('/bookmarks', firebaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { articleId } = req.body;

    if (!articleId) {
      return res.status(400).json({
        success: false,
        message: 'Article ID is required'
      });
    }

    const bookmark = await addBookmarkToFirestore(userId, articleId);
    
    res.status(201).json({
      success: true,
      message: 'Article bookmarked successfully',
      bookmark
    });

  } catch (error) {
    logger.error('Error adding bookmark:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add bookmark'
    });
  }
});

// Get user bookmarks
router.get('/bookmarks', firebaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.uid;
    const bookmarks = await getUserBookmarks(userId);
    
    res.json({
      success: true,
      bookmarks
    });

  } catch (error) {
    logger.error('Error getting bookmarks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get bookmarks'
    });
  }
});

// Remove bookmark
router.delete('/bookmarks/:bookmarkId', firebaseAuthMiddleware, async (req, res) => {
  try {
    const { bookmarkId } = req.params;
    const userId = req.user.uid;

    const db = require('../config/firebase').getFirestoreDB();
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    // Verify bookmark ownership
    const bookmarkDoc = await db.collection('bookmarks').doc(bookmarkId).get();
    
    if (!bookmarkDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Bookmark not found'
      });
    }

    const bookmark = bookmarkDoc.data();
    if (bookmark.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this bookmark'
      });
    }

    await db.collection('bookmarks').doc(bookmarkId).delete();
    
    res.json({
      success: true,
      message: 'Bookmark removed successfully'
    });

  } catch (error) {
    logger.error('Error removing bookmark:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove bookmark'
    });
  }
});

// Verify token endpoint (for client-side token validation)
router.post('/verify-token', async (req, res) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'ID token is required'
      });
    }

    const decodedToken = await verifyFirebaseToken(idToken);
    
    res.json({
      success: true,
      message: 'Token is valid',
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified
      }
    });

  } catch (error) {
    logger.error('Error verifying token:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

module.exports = { router, firebaseAuthMiddleware };