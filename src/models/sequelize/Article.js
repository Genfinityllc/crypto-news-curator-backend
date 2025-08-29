const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Article = sequelize.define('Article', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  summary: {
    type: DataTypes.TEXT
  },
  url: {
    type: DataTypes.STRING(1000),
    allowNull: false,
    unique: true
  },
  source: {
    type: DataTypes.STRING,
    allowNull: false
  },
  author: {
    type: DataTypes.STRING
  },
  publishedAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM('breaking', 'market', 'technology', 'regulation', 'analysis', 'other'),
    defaultValue: 'other'
  },
  network: {
    type: DataTypes.STRING
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  sentiment: {
    type: DataTypes.ENUM('positive', 'negative', 'neutral'),
    defaultValue: 'neutral'
  },
  impact: {
    type: DataTypes.ENUM('high', 'medium', 'low'),
    defaultValue: 'low'
  },
  isBreaking: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  viewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  shareCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  coverImage: {
    type: DataTypes.STRING(1000)
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'articles',
  indexes: [
    { fields: ['publishedAt'] },
    { fields: ['category'] },
    { fields: ['network'] },
    { fields: ['isBreaking'] },
    { fields: ['source'] }
  ]
});

module.exports = Article;