import { Request, Response } from 'express';
import { apiProxyService } from '../services/api-proxy.service';
import { memoryStore } from '../services/memory-store.service';
import { asyncHandler } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

export class SpreadsheetController {
  /**
   * Récupère les données d'un spreadsheet
   */
  static getSpreadsheet = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userToken = req.userToken!;

    logger.info('Getting spreadsheet data', { spreadsheetId: id });

    // Proxy vers l'API externe
    const data = await apiProxyService.getSpreadsheetData(id, userToken);

    res.json({
      success: true,
      data,
      metadata: {
        timestamp: new Date(),
        spreadsheetId: id
      }
    });
  });

  /**
   * Sauvegarde les modifications d'un spreadsheet
   */
  static saveSpreadsheet = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { changes } = req.body;
    const userToken = req.userToken!;

    logger.info('Saving spreadsheet changes', { 
      spreadsheetId: id,
      changeCount: changes?.length || 0 
    });

    // Proxy vers l'API externe
    const result = await apiProxyService.saveSpreadsheetData(id, changes, userToken);

    res.json({
      success: true,
      data: result,
      metadata: {
        timestamp: new Date(),
        spreadsheetId: id,
        changeCount: changes?.length || 0
      }
    });
  });

  /**
   * Récupère les utilisateurs connectés à un spreadsheet
   */
  static getConnectedUsers = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    logger.info('Getting connected users', { spreadsheetId: id });

    // Récupère depuis le memory store local
    const users = memoryStore.getUsers(id);
    const presence = memoryStore.getUserPresence(id);

    res.json({
      success: true,
      data: {
        users: users.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          color: user.color,
          cursor: user.cursor,
          selection: user.selection,
          lastActivity: user.lastActivity
        })),
        presence,
        totalCount: users.length
      },
      metadata: {
        timestamp: new Date(),
        spreadsheetId: id
      }
    });
  });

  /**
   * Récupère les informations de session d'un spreadsheet
   */
  static getSessionInfo = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    logger.info('Getting session info', { spreadsheetId: id });

    const session = memoryStore.getSession(id);
    
    if (!session) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'No active session for this spreadsheet'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        spreadsheetId: session.spreadsheetId,
        startedAt: session.startedAt,
        lastActivity: session.lastActivity,
        userCount: session.users.size,
        users: Array.from(session.users.values()).map(user => ({
          id: user.id,
          name: user.name,
          color: user.color
        }))
      },
      metadata: {
        timestamp: new Date()
      }
    });
  });

  /**
   * Applique des changements en batch
   */
  static batchUpdate = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { operations } = req.body;
    const userToken = req.userToken!;

    logger.info('Batch update', { 
      spreadsheetId: id,
      operationCount: operations?.length || 0 
    });

    // Proxy vers l'API externe
    const result = await apiProxyService.batchSave(id, operations, userToken);

    res.json({
      success: true,
      data: result,
      metadata: {
        timestamp: new Date(),
        spreadsheetId: id,
        operationCount: operations?.length || 0
      }
    });
  });

  /**
   * Vérifie les permissions d'un utilisateur sur un spreadsheet
   */
  static checkPermissions = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userToken = req.userToken!;

    logger.info('Checking permissions', { spreadsheetId: id });

    // Proxy vers l'API externe
    const permissions = await apiProxyService.checkPermissions(id, userToken);

    res.json({
      success: true,
      data: permissions,
      metadata: {
        timestamp: new Date(),
        spreadsheetId: id
      }
    });
  });

  /**
   * Récupère les changements en attente
   */
  static getPendingChanges = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    logger.info('Getting pending changes', { spreadsheetId: id });

    const changes = memoryStore.getPendingChanges(id);

    res.json({
      success: true,
      data: {
        changes,
        count: changes.length
      },
      metadata: {
        timestamp: new Date(),
        spreadsheetId: id
      }
    });
  });

  /**
   * Force la synchronisation des changements en attente
   */
  static forceSync = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userToken = req.userToken!;

    logger.info('Forcing sync', { spreadsheetId: id });

    // Récupère et vide les changements en attente
    const changes = memoryStore.flushPendingChanges(id);

    if (changes.length === 0) {
      res.json({
        success: true,
        data: {
          message: 'No pending changes to sync',
          syncedCount: 0
        },
        metadata: {
          timestamp: new Date(),
          spreadsheetId: id
        }
      });
      return;
    }

    // Envoie les changements à l'API externe
    const result = await apiProxyService.batchSave(id, changes, userToken);

    res.json({
      success: true,
      data: {
        message: 'Sync completed',
        syncedCount: changes.length,
        result
      },
      metadata: {
        timestamp: new Date(),
        spreadsheetId: id
      }
    });
  });
}
