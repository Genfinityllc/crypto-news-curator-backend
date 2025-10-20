// Stub User model - MongoDB/Mongoose removed
// Use Firebase Auth instead via /api/firebase-auth routes

const User = {
  findById: () => {
    throw new Error('MongoDB User model deprecated. Use Firebase Auth via /api/firebase-auth');
  }
};

module.exports = User;
