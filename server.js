require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { connectDB } = require('./src/config/db');
const { initSocket } = require('./src/config/socket');
const logger = require('./src/config/logger');

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await connectDB();

    const server = http.createServer(app);
    initSocket(server);

    server.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });

  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    console.error(err);
    process.exit(1);
  }
}

start();
