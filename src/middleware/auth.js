const logger = require('../utils/logger');

// MongoDB/Mongoose auth middleware deprecated
// Use Firebase Auth instead via /api/firebase-auth routes
const authMiddleware = async (req, res, next) => {
  logger.warn('MongoDB auth middleware deprecated - use Firebase Auth via /api/firebase-auth');
  return res.status(501).json({
    success: false,
    error: 'MongoDB authentication deprecated. Use Firebase Auth via /api/firebase-auth routes.',
    migration: {
      oldRoute: req.originalUrl,
      suggestedRoute: req.originalUrl.replace('/api/', '/api/firebase-auth/'),
      documentation: 'https://firebase.google.com/docs/auth'
    }
  });
};

// Optional auth middleware - also deprecated
const optionalAuth = async (req, res, next) => {
  logger.debug('Optional auth bypassed - MongoDB auth deprecated');
  // Continue without authentication for backward compatibility
  next();
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'User role is not authorized to access this route'
      });
    }

    next();
  };
};

module.exports = {
  authMiddleware,
  optionalAuth,
  authorize
};
