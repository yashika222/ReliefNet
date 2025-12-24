const mongoose = require('mongoose');
const logger = require('./logger');

const MONGO_URI = process.env.MONGO_URI;

let isConnected = false;

async function connectDB() {
  if (isConnected) {
    logger.info('MongoDB already connected');
    return;
  }

  if (!MONGO_URI) {
    logger.error('❌ MONGO_URI is missing');
    return;
  }

  try {
    await mongoose.connect(MONGO_URI, {
      autoIndex: false,
      serverSelectionTimeoutMS: 5000,
      dbName: 'disaster_relief' // Force consistent DB name
    });

    isConnected = true;
    logger.info('✅ MongoDB connected successfully');
    console.log('✅ MongoDB connected');
  } catch (error) {
    logger.error('❌ MongoDB connection failed', {
      error: error.message
    });

    console.error('❌ MongoDB connection failed:', error.message);

    // ❗ DO NOT EXIT PROCESS (important for Railway/Render health checks)
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    if (isConnected) {
      await mongoose.connection.close();
      logger.info('MongoDB disconnected on app termination');
    }
    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
});

module.exports = {
  connectDB
};
