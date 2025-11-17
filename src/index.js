// src/index.js

require('dotenv').config();
const app = require('./app');
const { testConnection } = require('./database/db');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Test database connection
    await testConnection();
    console.log('✓ Database connected');

    // Start server - listen on all network interfaces (0.0.0.0) to allow device access
    const HOST = process.env.HOST || '0.0.0.0'; // 0.0.0.0 allows connections from network
    app.listen(PORT, HOST, () => {
      console.log(`✓ GoOrderly.ai API server running on port ${PORT}`);
      console.log(`✓ Health check: http://localhost:${PORT}/health`);
      console.log(`✓ Network access: http://192.168.29.220:${PORT}/health`);
      console.log(`✓ Listening on ${HOST}:${PORT} (accessible from network)`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

