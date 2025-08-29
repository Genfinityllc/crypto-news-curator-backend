const { Sequelize } = require('sequelize');
const path = require('path');
const logger = require('../utils/logger');

// Create SQLite database connection
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../database/crypto-news-curator.db'),
  logging: (msg) => logger.debug(msg),
  define: {
    timestamps: true,
    underscored: false,
  }
});

// Test the connection
async function testConnection() {
  try {
    await sequelize.authenticate();
    logger.info('SQLite database connection established successfully');
    return true;
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    return false;
  }
}

// Initialize database and sync models
async function initializeDatabase() {
  try {
    await testConnection();
    await sequelize.sync({ alter: true });
    logger.info('Database synchronized successfully');
    return true;
  } catch (error) {
    logger.error('Database initialization failed:', error);
    return false;
  }
}

module.exports = {
  sequelize,
  testConnection,
  initializeDatabase
};