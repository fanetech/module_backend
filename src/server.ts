import { createServer } from 'http';
import dotenv from 'dotenv';
import app from './app';
import { WebSocketServer } from './websocket/socket.server';
import { testConnection } from './config/database';
import { CollaborationService } from './services/collaboration.service';

dotenv.config();

const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 3001;

async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Create HTTP server
    const server = createServer(app);

    // Initialize WebSocket server
    new WebSocketServer(server);

    // Start the server
    server.listen(PORT, () => {
      console.log(`🚀 REST API Server running on port ${PORT}`);
      console.log(`🔌 WebSocket Server running on same port`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💾 Database: SQL Server connected`);
    });

    // Cleanup inactive sessions periodically
    setInterval(async () => {
      try {
        const cleaned = await CollaborationService.cleanupInactiveSessions(30);
        if (cleaned > 0) {
          console.log(`Cleaned up ${cleaned} inactive sessions`);
        }
      } catch (error) {
        console.error('Error cleaning up sessions:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
