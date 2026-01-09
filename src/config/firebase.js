const logger = require('../utils/logger');

let admin = null;
let firebaseAdminAvailable = false;

try {
  admin = require('firebase-admin');
  firebaseAdminAvailable = true;
  logger.info('Firebase Admin SDK loaded successfully');
} catch (e) {
  logger.warn('Firebase Admin SDK not available:', e.message);
}

// Load environment variables
require('dotenv').config();

let db = null;
let auth = null;
let app = null;

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase() {
  try {
    // Check if firebase-admin module is available
    if (!firebaseAdminAvailable || !admin) {
      logger.warn('Firebase Admin SDK module not installed. Firebase features disabled.');
      return { db: null, auth: null, app: null };
    }
    
    // Check if Firebase is already initialized
    if (admin.apps.length > 0) {
      app = admin.apps[0];
      db = admin.firestore();
      auth = admin.auth();
      return { db, auth, app };
    }

    // Initialize Firebase with service account
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    } else if (process.env.FIREBASE_PROJECT_ID) {
      // Initialize with project ID (for local development)
      app = admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    } else {
      logger.warn('Firebase credentials not found. Firebase features will be disabled.');
      return { db: null, auth: null, app: null };
    }

    db = admin.firestore();
    auth = admin.auth();
    
    logger.info('Firebase Admin SDK initialized successfully');
    return { db, auth, app };
    
  } catch (error) {
    logger.error('Error initializing Firebase:', error.message);
    return { db: null, auth: null, app: null };
  }
}

/**
 * Get Firestore database instance
 */
function getFirestoreDB() {
  if (!db) {
    const { db: newDb } = initializeFirebase();
    return newDb;
  }
  return db;
}

/**
 * Get Firebase Auth instance
 */
function getFirebaseAuth() {
  if (!auth) {
    const { auth: newAuth } = initializeFirebase();
    return newAuth;
  }
  return auth;
}

/**
 * Create a new user in Firebase Auth
 */
async function createFirebaseUser(userData) {
  try {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error('Firebase Auth not initialized');
    }

    const userRecord = await auth.createUser({
      email: userData.email,
      password: userData.password,
      displayName: userData.displayName || userData.username,
      disabled: false,
      emailVerified: false
    });

    logger.info(`Firebase user created: ${userRecord.uid}`);
    return userRecord;
    
  } catch (error) {
    logger.error('Error creating Firebase user:', error.message);
    throw error;
  }
}

/**
 * Verify Firebase ID token
 */
async function verifyFirebaseToken(idToken) {
  try {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error('Firebase Auth not initialized');
    }

    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
    
  } catch (error) {
    logger.error('Error verifying Firebase token:', error.message);
    throw error;
  }
}

/**
 * Create user profile in Firestore
 */
async function createUserProfile(userId, profileData) {
  try {
    const db = getFirestoreDB();
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const userProfile = {
      uid: userId,
      email: profileData.email,
      username: profileData.username,
      displayName: profileData.displayName,
      createdAt: new Date(),
      updatedAt: new Date(),
      preferences: {
        theme: 'dark',
        notifications: {
          email: true,
          push: false,
          categories: ['breaking', 'market']
        },
        favoriteNetworks: []
      }
    };

    await db.collection('users').doc(userId).set(userProfile);
    
    logger.info(`User profile created in Firestore: ${userId}`);
    return userProfile;
    
  } catch (error) {
    logger.error('Error creating user profile:', error.message);
    throw error;
  }
}

/**
 * Get user profile from Firestore
 */
async function getUserProfile(userId) {
  try {
    const db = getFirestoreDB();
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return null;
    }
    
    return { id: userDoc.id, ...userDoc.data() };
    
  } catch (error) {
    logger.error('Error getting user profile:', error.message);
    throw error;
  }
}

/**
 * Update user profile in Firestore
 */
async function updateUserProfile(userId, updateData) {
  try {
    const db = getFirestoreDB();
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const updatePayload = {
      ...updateData,
      updatedAt: new Date()
    };

    await db.collection('users').doc(userId).update(updatePayload);
    
    logger.info(`User profile updated: ${userId}`);
    return true;
    
  } catch (error) {
    logger.error('Error updating user profile:', error.message);
    throw error;
  }
}

/**
 * Add article to Firestore
 */
async function addArticleToFirestore(articleData) {
  try {
    const db = getFirestoreDB();
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const article = {
      ...articleData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('articles').add(article);
    
    logger.info(`Article added to Firestore: ${docRef.id}`);
    return { id: docRef.id, ...article };
    
  } catch (error) {
    logger.error('Error adding article to Firestore:', error.message);
    throw error;
  }
}

/**
 * Get articles from Firestore with pagination
 */
async function getArticlesFromFirestore(options = {}) {
  try {
    const db = getFirestoreDB();
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    let query = db.collection('articles');

    // Apply filters
    if (options.network && options.network !== 'all') {
      query = query.where('network', '==', options.network);
    }

    if (options.category && options.category !== 'all') {
      query = query.where('category', '==', options.category);
    }

    if (options.isBreaking) {
      query = query.where('is_breaking', '==', true);
    }

    // Apply sorting
    switch (options.sortBy) {
      case 'date':
        query = query.orderBy('published_at', 'desc');
        break;
      case 'score':
        query = query.orderBy('impact_score', 'desc');
        break;
      default:
        query = query.orderBy('published_at', 'desc');
    }

    // Apply pagination
    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.startAfter) {
      query = query.startAfter(options.startAfter);
    }

    const snapshot = await query.get();
    const articles = [];

    snapshot.forEach(doc => {
      articles.push({ id: doc.id, ...doc.data() });
    });

    logger.info(`Retrieved ${articles.length} articles from Firestore`);
    return articles;
    
  } catch (error) {
    logger.error('Error getting articles from Firestore:', error.message);
    throw error;
  }
}

/**
 * Add bookmark to Firestore
 */
async function addBookmarkToFirestore(userId, articleId) {
  try {
    const db = getFirestoreDB();
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const bookmark = {
      userId,
      articleId,
      createdAt: new Date()
    };

    const docRef = await db.collection('bookmarks').add(bookmark);
    
    logger.info(`Bookmark added: ${docRef.id}`);
    return { id: docRef.id, ...bookmark };
    
  } catch (error) {
    logger.error('Error adding bookmark:', error.message);
    throw error;
  }
}

/**
 * Get user bookmarks from Firestore
 */
async function getUserBookmarks(userId) {
  try {
    const db = getFirestoreDB();
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const snapshot = await db.collection('bookmarks')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const bookmarks = [];
    snapshot.forEach(doc => {
      bookmarks.push({ id: doc.id, ...doc.data() });
    });

    logger.info(`Retrieved ${bookmarks.length} bookmarks for user: ${userId}`);
    return bookmarks;
    
  } catch (error) {
    logger.error('Error getting user bookmarks:', error.message);
    throw error;
  }
}

module.exports = {
  initializeFirebase,
  getFirestoreDB,
  getFirebaseAuth,
  createFirebaseUser,
  verifyFirebaseToken,
  createUserProfile,
  getUserProfile,
  updateUserProfile,
  addArticleToFirestore,
  getArticlesFromFirestore,
  addBookmarkToFirestore,
  getUserBookmarks
};