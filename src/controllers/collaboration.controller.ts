import { Request, Response } from 'express';
import { memoryStore } from '../services/memory-store.service';
import { getSocketServer } from '../websocket/socket.server';
import { asyncHandler } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

export class CollaborationController {
  /**
   * Récupère les statistiques de collaboration
   */
  static getStats = asyncHandler(async (req: Request, res: Response) => {
    logger.info('Getting collaboration statistics');

    const memoryStats = memoryStore.getStats();
    const socketServer = getSocketServer();
    const socketStats = socketServer ? socketServer.getStats() : null;

    res.json({
      success: true,
      data: {
        memory: memoryStats,
        websocket: socketStats
      },
      metadata: {
        timestamp: new Date()
      }
    });
  });

  /**
   * Diffuse un message à tous les utilisateurs d'un spreadsheet
   */
  static broadcast = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { event, data } = req.body;

    logger.info('Broadcasting message', { 
      spreadsheetId: id,
      event 
    });

    const socketServer = getSocketServer();
    
    if (!socketServer) {
      res.status(503).json({
        success: false,
        error: {
          code: 'WEBSOCKET_UNAVAILABLE',
          message: 'WebSocket server is not available'
        }
      });
      return;
    }

    socketServer.broadcast(id, event, data);

    res.json({
      success: true,
      data: {
        message: 'Broadcast sent',
        spreadsheetId: id,
        event
      },
      metadata: {
        timestamp: new Date()
      }
    });
  });

  /**
   * Envoie un message à un utilisateur spécifique
   */
  static sendToUser = asyncHandler(async (req: Request, res: Response) => {
    const { socketId } = req.params;
    const { event, data } = req.body;

    logger.info('Sending message to user', { 
      socketId,
      event 
    });

    const socketServer = getSocketServer();
    
    if (!socketServer) {
      res.status(503).json({
        success: false,
        error: {
          code: 'WEBSOCKET_UNAVAILABLE',
          message: 'WebSocket server is not available'
        }
      });
      return;
    }

    socketServer.sendToSocket(socketId, event, data);

    res.json({
      success: true,
      data: {
        message: 'Message sent',
        socketId,
        event
      },
      metadata: {
        timestamp: new Date()
      }
    });
  });

  /**
   * Déconnecte un utilisateur
   */
  static disconnectUser = asyncHandler(async (req: Request, res: Response) => {
    const { socketId } = req.params;
    const { reason = 'Admin initiated disconnect' } = req.body;

    logger.info('Disconnecting user', { 
      socketId,
      reason 
    });

    const socketServer = getSocketServer();
    
    if (!socketServer) {
      res.status(503).json({
        success: false,
        error: {
          code: 'WEBSOCKET_UNAVAILABLE',
          message: 'WebSocket server is not available'
        }
      });
      return;
    }

    socketServer.disconnectSocket(socketId, reason);

    res.json({
      success: true,
      data: {
        message: 'User disconnected',
        socketId,
        reason
      },
      metadata: {
        timestamp: new Date()
      }
    });
  });

  /**
   * Récupère la présence des utilisateurs pour un spreadsheet
   */
  static getUserPresence = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    logger.info('Getting user presence', { spreadsheetId: id });

    const presence = memoryStore.getUserPresence(id);

    res.json({
      success: true,
      data: {
        spreadsheetId: id,
        presence,
        onlineCount: presence.filter(p => p.isOnline).length
      },
      metadata: {
        timestamp: new Date()
      }
    });
  });

  /**
   * Récupère l'historique des sessions
   */
  static getSessionHistory = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    logger.info('Getting session history', { spreadsheetId: id });

    const session = memoryStore.getSession(id);

    if (!session) {
      res.json({
        success: true,
        data: {
          spreadsheetId: id,
          message: 'No active session',
          history: []
        },
        metadata: {
          timestamp: new Date()
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        spreadsheetId: id,
        currentSession: {
          startedAt: session.startedAt,
          lastActivity: session.lastActivity,
          duration: new Date().getTime() - session.startedAt.getTime(),
          userCount: session.users.size
        }
      },
      metadata: {
        timestamp: new Date()
      }
    });
  });

  /**
   * Nettoie les sessions inactives
   */
  static cleanupSessions = asyncHandler(async (req: Request, res: Response) => {
    logger.info('Cleaning up inactive sessions');

    const socketServer = getSocketServer();
    
    if (socketServer) {
      socketServer.cleanupInactiveConnections();
    }

    res.json({
      success: true,
      data: {
        message: 'Cleanup initiated'
      },
      metadata: {
        timestamp: new Date()
      }
    });
  });
}
