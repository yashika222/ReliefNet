if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const http = require('http');
const app = require('./src/app');
const { connectDB } = require('./src/config/db');
const { initSocket } = require('./src/config/socket');
const logger = require('./src/config/logger');

const { validateEnv } = require('./src/config/env');

const PORT = process.env.PORT; // ✅ FIX


// Global error handlers
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason });
});

async function start() {
  try {
    // 1. Validate Env (Non-blocking warning if missing)
    validateEnv();

    // 2. Start HTTP Server immediately (Faster Startup)
    const server = http.createServer(app);
    initSocket(server);

    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on http://0.0.0.0:${PORT}`);
      console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
    });

    // 3. Connect to DB (Non-blocking)
    connectDB().catch((err) => {
      logger.error('Failed to connect to MongoDB', { error: err.message });
      console.error('❌ DB Connection Failed:', err.message);
      // We do NOT exit, so the server remains up for health checks
    });

  } catch (err) {
    logger.error('Failed to initialize server', { error: err.message });
    console.error(err);
    process.exit(1);
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

start();
