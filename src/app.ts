import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { SpreadsheetController } from './controllers/spreadsheet.controller';
import { CollaborationController } from './controllers/collaboration.controller';
import { proxyMiddleware, optionalAuth } from './middleware/api-proxy.middleware';
import { 
  validateSpreadsheetId, 
  validateBatchChanges,
  sanitizeInput,
  apiRateLimiter 
} from './middleware/validation.middleware';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import { logger } from './utils/logger';

export function createApp(): Application {
  const app = express();

  // Security middleware
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.WS_CORS_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Compression middleware
  app.use(compression());

  // Rate limiting
  app.use('/api/', apiRateLimiter);

  // Request sanitization
  app.use(sanitizeInput);

  // Request logging
  app.use((req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.logRequest(req.method, req.url, res.statusCode, duration);
    });
    
    next();
  });

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // API Routes

  // Spreadsheet routes (require authentication)
  app.get(
    '/api/spreadsheets/:id',
    proxyMiddleware,
    validateSpreadsheetId,
    SpreadsheetController.getSpreadsheet
  );

  app.put(
    '/api/spreadsheets/:id/save',
    proxyMiddleware,
    validateSpreadsheetId,
    validateBatchChanges,
    SpreadsheetController.saveSpreadsheet
  );

  app.post(
    '/api/spreadsheets/:id/batch',
    proxyMiddleware,
    validateSpreadsheetId,
    validateBatchChanges,
    SpreadsheetController.batchUpdate
  );

  app.get(
    '/api/spreadsheets/:id/permissions',
    proxyMiddleware,
    validateSpreadsheetId,
    SpreadsheetController.checkPermissions
  );

  app.post(
    '/api/spreadsheets/:id/sync',
    proxyMiddleware,
    validateSpreadsheetId,
    SpreadsheetController.forceSync
  );

  // Collaboration routes (optional authentication)
  app.get(
    '/api/spreadsheets/:id/users',
    optionalAuth,
    validateSpreadsheetId,
    SpreadsheetController.getConnectedUsers
  );

  app.get(
    '/api/spreadsheets/:id/session',
    optionalAuth,
    validateSpreadsheetId,
    SpreadsheetController.getSessionInfo
  );

  app.get(
    '/api/spreadsheets/:id/presence',
    optionalAuth,
    validateSpreadsheetId,
    CollaborationController.getUserPresence
  );

  app.get(
    '/api/spreadsheets/:id/pending',
    optionalAuth,
    validateSpreadsheetId,
    SpreadsheetController.getPendingChanges
  );

  // Admin/Debug routes
  app.get(
    '/api/collaboration/stats',
    optionalAuth,
    CollaborationController.getStats
  );

  app.post(
    '/api/collaboration/broadcast/:id',
    proxyMiddleware,
    validateSpreadsheetId,
    CollaborationController.broadcast
  );

  app.post(
    '/api/collaboration/send/:socketId',
    proxyMiddleware,
    CollaborationController.sendToUser
  );

  app.post(
    '/api/collaboration/disconnect/:socketId',
    proxyMiddleware,
    CollaborationController.disconnectUser
  );

  app.post(
    '/api/collaboration/cleanup',
    proxyMiddleware,
    CollaborationController.cleanupSessions
  );

  app.get(
    '/api/spreadsheets/:id/history',
    optionalAuth,
    validateSpreadsheetId,
    CollaborationController.getSessionHistory
  );

  // 404 handler
  app.use(notFoundMiddleware);

  // Error handler (must be last)
  app.use(errorMiddleware);

  return app;
}
