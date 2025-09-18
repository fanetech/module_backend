import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { SpreadsheetController } from './controllers/spreadsheet.controller';
import { CollaborationController } from './controllers/collaboration.controller';

dotenv.config();

const app: Application = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Spreadsheet routes
app.get('/api/spreadsheets', SpreadsheetController.getAllSpreadsheets);
app.get('/api/spreadsheets/:id', SpreadsheetController.getSpreadsheetById);
app.post('/api/spreadsheets', SpreadsheetController.createSpreadsheet);
app.put('/api/spreadsheets/:id', SpreadsheetController.updateSpreadsheet);
app.delete('/api/spreadsheets/:id', SpreadsheetController.deleteSpreadsheet);

// Cell operations
app.put('/api/spreadsheets/:id/cells/:cellId', SpreadsheetController.updateCell);
app.post('/api/spreadsheets/:id/cells/batch', SpreadsheetController.batchUpdateCells);
app.get('/api/spreadsheets/:id/cells/range', SpreadsheetController.getCellsInRange);
app.get('/api/spreadsheets/:id/cells/history', SpreadsheetController.getCellHistory);

// Formula calculation with HyperFormula
app.post('/api/spreadsheets/:id/calculate', SpreadsheetController.calculateFormulas);

// HyperFormula integrated endpoints
app.post('/api/spreadsheets/:id/init-engine', SpreadsheetController.initializeEngine);
app.get('/api/spreadsheets/:id/data', SpreadsheetController.getSpreadsheetData);
app.get('/api/spreadsheets/:id/engine-status', SpreadsheetController.getEngineStatus);
app.post('/api/spreadsheets/validate-formula', SpreadsheetController.validateFormula);

// Collaboration routes
app.post('/api/collaboration/:spreadsheetId/join', CollaborationController.joinSession);
app.post('/api/collaboration/:socketId/leave', CollaborationController.leaveSession);
app.get('/api/collaboration/:spreadsheetId/users', CollaborationController.getActiveUsers);
app.put('/api/collaboration/:socketId/cursor', CollaborationController.updateCursorPosition);
app.put('/api/collaboration/:socketId/selection', CollaborationController.updateSelectionRange);
app.delete('/api/collaboration/:socketId/selection', CollaborationController.clearSelection);
app.post('/api/collaboration/cleanup', CollaborationController.cleanupInactiveSessions);
app.get('/api/collaboration/stats', CollaborationController.getCollaborationStats);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

export default app;
