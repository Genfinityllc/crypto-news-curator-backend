const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Please add a username'],
    unique: true,
    trim: true,
    maxlength: [50, 'Username cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  profile: {
    firstName: {
      type: String,
      trim: true,
      maxlength: [50, 'First name cannot be more than 50 characters']
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [50, 'Last name cannot be more than 50 characters']
    },
    avatar: String,
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot be more than 500 characters']
    }
  },
  preferences: {
    favoriteCryptocurrencies: [{
      type: String,
      trim: true
    }],
    newsCategories: [{
      type: String,
      enum: ['bitcoin', 'ethereum', 'defi', 'nft', 'regulation', 'mining', 'trading', 'technology']
    }],
    notificationSettings: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: false
      },
      newsAlerts: {
        type: Boolean,
        default: true
      }
    }
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  loginCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
  if (this.profile.firstName && this.profile.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.username;
});

// Index for better query performance (email and username indexes are automatically created by unique: true)
UserSchema.index({ 'preferences.favoriteCryptocurrencies': 1 });

// Encrypt password using bcrypt
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { id: this._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Update last login
UserSchema.methods.updateLastLogin = function() {
  this.lastLogin = Date.now();
  this.loginCount += 1;
  return this.save();
};

// Get user preferences
UserSchema.methods.getPreferences = function() {
  return {
    favoriteCryptocurrencies: this.preferences.favoriteCryptocurrencies,
    newsCategories: this.preferences.newsCategories,
    notificationSettings: this.preferences.notificationSettings
  };
};

// Update user preferences
UserSchema.methods.updatePreferences = function(preferences) {
  if (preferences.favoriteCryptocurrencies) {
    this.preferences.favoriteCryptocurrencies = preferences.favoriteCryptocurrencies;
  }
  if (preferences.newsCategories) {
    this.preferences.newsCategories = preferences.newsCategories;
  }
  if (preferences.notificationSettings) {
    this.preferences.notificationSettings = {
      ...this.preferences.notificationSettings,
      ...preferences.notificationSettings
    };
  }
  return this.save();
};

module.exports = mongoose.model('User', UserSchema);
