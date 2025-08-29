const { sequelize } = require('../../config/database');
const User = require('./User');
const Article = require('./Article');

// Define associations
User.hasMany(Article, { 
  foreignKey: 'userId', 
  as: 'bookmarkedArticles',
  through: 'UserBookmarks'
});

Article.belongsToMany(User, { 
  through: 'UserBookmarks',
  foreignKey: 'articleId',
  as: 'bookmarkedBy'
});

// Export models
module.exports = {
  sequelize,
  User,
  Article
};