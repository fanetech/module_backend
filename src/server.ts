import dotenv from 'dotenv';
import { createServer } from 'http';
import { createApp } from './app';
import { initSocketServer } from './websocket/socket.server';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

// Create Express app
const app = createApp();

// Create HTTP server
const httpServer = createServer(app);

// Initialize WebSocket server
const socketServer = initSocketServer(httpServer);

// Port configuration
const PORT = process.env.PORT || 3000;

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  httpServer.close(async () => {
    logger.info('HTTP server closed');

    // Close WebSocket connections
    if (socketServer) {
      await socketServer.close();
    }

    logger.info('Graceful shutdown completed');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    message: error.message,
    stack: error.stack
  });
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, _) => {
  logger.error('Unhandled Rejection', { 
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined
  });
  gracefulShutdown('unhandledRejection');
});

// Start server
httpServer.listen(PORT, () => {
  logger.info(`
    🚀 Server is running!
    📡 HTTP Server: http://localhost:${PORT}
    🔌 WebSocket Server: ws://localhost:${PORT}
    🌍 Environment: ${process.env.NODE_ENV || 'development'}
    📊 API URL: ${process.env.EXTERNAL_API_URL || 'Not configured'}
  `);
});

export { httpServer, app, socketServer };
