const mongoose = require('mongoose');

const NewsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  originalTitle: {
    type: String,
    trim: true
  },
  content: {
    type: String,
    required: [true, 'Please add content'],
    trim: true
  },
  rewrittenContent: {
    type: String,
    trim: true
  },
  summary: {
    type: String,
    trim: true,
    maxlength: [500, 'Summary cannot be more than 500 characters']
  },
  url: {
    type: String,
    required: [true, 'Please add a URL'],
    unique: true,
    trim: true
  },
  originalUrl: {
    type: String,
    trim: true
  },
  network: {
    type: String,
    required: [true, 'Please add a network'],
    trim: true
  },
  source: {
    name: {
      type: String,
      required: [true, 'Please add a source name'],
      trim: true
    },
    domain: {
      type: String,
      trim: true
    },
    logo: String
  },
  originalSource: {
    type: String,
    trim: true
  },
  author: {
    type: String,
    trim: true
  },
  publishedAt: {
    type: Date,
    required: [true, 'Please add a publication date']
  },
  category: {
    type: String,
    enum: ['bitcoin', 'ethereum', 'defi', 'nft', 'regulation', 'mining', 'trading', 'technology', 'general', 'press-release', 'market-analysis', 'partnership', 'enterprise', 'trade-finance'],
    default: 'general'
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  score: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  isBreaking: {
    type: Boolean,
    default: false
  },
  coverImage: {
    type: String
  },
  cryptocurrencies: [{
    name: {
      type: String,
      trim: true,
      lowercase: true
    },
    symbol: {
      type: String,
      trim: true,
      uppercase: true
    },
    sentiment: {
      type: String,
      enum: ['positive', 'negative', 'neutral'],
      default: 'neutral'
    }
  }],
  sentiment: {
    overall: {
      type: String,
      enum: ['positive', 'negative', 'neutral'],
      default: 'neutral'
    },
    score: {
      type: Number,
      min: -1,
      max: 1,
      default: 0
    }
  },
  engagement: {
    views: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },
    comments: {
      type: Number,
      default: 0
    }
  },
  engagementMetrics: {
    views: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },
    comments: {
      type: Number,
      default: 0
    }
  },
  curation: {
    isCurated: {
      type: Boolean,
      default: false
    },
    curatedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    curatedAt: Date,
    curationNotes: String,
    quality: {
      type: String,
      enum: ['low', 'medium', 'high', 'excellent'],
      default: 'medium'
    }
  },
  moderation: {
    isModerated: {
      type: Boolean,
      default: false
    },
    moderatedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    moderatedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    moderationNotes: String
  },
  seoMetrics: {
    readabilityScore: Number,
    keywordDensity: Number,
    metaDescription: String,
    focusKeyword: String,
    wordCount: Number,
    headingStructure: String,
    internalLinks: Number,
    imageAlt: String,
    googleNewsCompliance: Boolean,
    googleAdsCompliance: Boolean
  },
  lastRewritten: Date,
  lastOptimized: Date,
  metadata: {
    language: {
      type: String,
      default: 'en'
    },
    readingTime: Number, // in minutes
    wordCount: Number,
    imageCount: Number,
    hasVideo: {
      type: Boolean,
      default: false
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for formatted date
NewsSchema.virtual('formattedDate').get(function() {
  return this.publishedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Virtual for time ago
NewsSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diffInSeconds = Math.floor((now - this.publishedAt) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
});

// Indexes for better query performance
NewsSchema.index({ publishedAt: -1 });
NewsSchema.index({ category: 1, publishedAt: -1 });
NewsSchema.index({ 'cryptocurrencies.symbol': 1 });
NewsSchema.index({ tags: 1 });
NewsSchema.index({ 'sentiment.overall': 1 });
NewsSchema.index({ 'curation.isCurated': 1 });
NewsSchema.index({ 'moderation.status': 1 });
NewsSchema.index({ title: 'text', content: 'text', summary: 'text' });

// Text search index
NewsSchema.index({
  title: 'text',
  content: 'text',
  summary: 'text',
  tags: 'text'
});

// Static method to get trending news
NewsSchema.statics.getTrending = function(limit = 10) {
  return this.aggregate([
    { $match: { isActive: true, 'moderation.status': 'approved' } },
    {
      $addFields: {
        trendingScore: {
          $add: [
            { $multiply: ['$engagement.views', 0.1] },
            { $multiply: ['$engagement.likes', 0.3] },
            { $multiply: ['$engagement.shares', 0.5] },
            { $multiply: ['$engagement.comments', 0.2] }
          ]
        }
      }
    },
    { $sort: { trendingScore: -1, publishedAt: -1 } },
    { $limit: limit }
  ]);
};

// Static method to get news by category
NewsSchema.statics.getByCategory = function(category, limit = 20, page = 1) {
  const skip = (page - 1) * limit;
  return this.find({
    category,
    isActive: true,
    'moderation.status': 'approved'
  })
  .sort({ publishedAt: -1 })
  .skip(skip)
  .limit(limit);
};

// Static method to search news
NewsSchema.statics.search = function(query, limit = 20, page = 1) {
  const skip = (page - 1) * limit;
  return this.find({
    $text: { $search: query },
    isActive: true,
    'moderation.status': 'approved'
  })
  .sort({ score: { $meta: 'textScore' }, publishedAt: -1 })
  .skip(skip)
  .limit(limit);
};

// Instance method to increment engagement
NewsSchema.methods.incrementEngagement = function(type) {
  if (this.engagement[type] !== undefined) {
    this.engagement[type] += 1;
    return this.save();
  }
  throw new Error(`Invalid engagement type: ${type}`);
};

// Instance method to update sentiment
NewsSchema.methods.updateSentiment = function(sentiment, score) {
  this.sentiment.overall = sentiment;
  this.sentiment.score = score;
  return this.save();
};

module.exports = mongoose.model('News', NewsSchema);
