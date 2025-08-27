const dotenv = require('dotenv');
const fs = require('fs');

// Load environment variables
dotenv.config();

const app = require('./src/app');
const { sequelize, testConnection } = require('./src/config/database');
const logger = require('./src/utils/logger');

// Import models to ensure they are registered
require('./src/models/User');
require('./src/models/Scan');

const PORT = process.env.PORT || 3000;

// Create logs directory if it doesn't exist
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await sequelize.close();
  process.exit(0);
});

// Unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    
    // Sync database (create tables)
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    logger.info('Database synchronized');
    
    // Start server
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT}`);
    });
    
    // Increase timeout for large report downloads
    server.timeout = 300000; // 5 minutes
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
