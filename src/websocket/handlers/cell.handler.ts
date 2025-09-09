import { Socket } from 'socket.io';
import { memoryStore } from '../../services/memory-store.service';
import { conflictResolution } from '../../services/conflict-resolution.service';
import { apiProxyService } from '../../services/api-proxy.service';
import { Operation } from '../../types/collaboration.types';
import { CellChange } from '../../types/spreadsheet.types';
import { logger } from '../../utils/logger';
import { hashCellId } from '../../utils/ot-transform';
import { v4 as uuidv4 } from 'uuid';

export class CellHandler {
  /**
   * Gère les changements de cellule
   */
  static async handleCellChange(socket: Socket, data: any): Promise<void> {
    try {
      const { row, column, value, formula, format, changeType = 'value' } = data;
      const spreadsheetId = socket.data.spreadsheetId;
      const userId = socket.data.userId || socket.id;
      const userName = socket.data.userName || 'Anonymous';

      if (!spreadsheetId) {
        socket.emit('error', { message: 'Not connected to a spreadsheet' });
        return;
      }

      // Validation des données
      if (row === undefined || column === undefined) {
        socket.emit('error', { message: 'Invalid cell coordinates' });
        return;
      }

      // Création de l'opération
      const operation: Operation = {
        id: uuidv4(),
        type: 'update',
        cellId: hashCellId(row, column),
        row,
        column,
        value,
        format,
        timestamp: Date.now(),
        userId,
        version: 1
      };

      // Validation de l'opération
      if (!conflictResolution.validateOperation(operation)) {
        socket.emit('error', { message: 'Invalid operation' });
        return;
      }

      // Récupère les opérations en attente pour ce spreadsheet
      const pendingChanges = memoryStore.getPendingChanges(spreadsheetId);
      
      // Transforme l'opération contre les changements en attente
      if (pendingChanges.length > 0) {
        const pendingOps = pendingChanges.map(change => ({
          id: change.cellId,
          type: 'update' as const,
          cellId: change.cellId,
          row: change.row,
          column: change.column,
          value: change.newValue,
          timestamp: change.timestamp,
          userId: change.userId,
          version: 1,
          format: undefined
        }));

        const result = conflictResolution.transformAgainstHistory(operation, pendingOps);
        
        if (result.conflicts.length > 0) {
          logger.warn('Conflicts detected during cell change', {
            conflicts: result.conflicts,
            operation
          });
        }
      }

      // Création du changement
      const cellChange: CellChange = {
        cellId: operation.cellId,
        row,
        column,
        oldValue: null, // Devrait être récupéré de l'état actuel
        newValue: value,
        timestamp: operation.timestamp,
        userId,
        changeType
      };

      // Ajoute le changement aux changements en attente
      memoryStore.addPendingChange(spreadsheetId, cellChange);

      // Diffuse le changement aux autres utilisateurs
      socket.to(`spreadsheet:${spreadsheetId}`).emit('cell-updated', {
        cellId: operation.cellId,
        row,
        column,
        value,
        formula,
        format,
        userId,
        userName,
        timestamp: operation.timestamp,
        changeType
      });

      // Confirme au client qui a envoyé le changement
      socket.emit('cell-change-ack', {
        operationId: operation.id,
        cellId: operation.cellId,
        timestamp: operation.timestamp
      });

      logger.debug('Cell change processed', {
        spreadsheetId,
        cellId: operation.cellId,
        userId,
        userName
      });

      // Programme la sauvegarde batch (débounce)
      CellHandler.scheduleBatchSave(spreadsheetId, socket.data.token);

    } catch (error) {
      logger.error('Error handling cell change', error);
      socket.emit('error', { message: 'Failed to process cell change' });
    }
  }

  /**
   * Gère les changements de format de cellule
   */
  static async handleCellFormat(socket: Socket, data: any): Promise<void> {
    try {
      const { row, column, format } = data;
      const spreadsheetId = socket.data.spreadsheetId;
      const userId = socket.data.userId || socket.id;
      const userName = socket.data.userName || 'Anonymous';

      if (!spreadsheetId) {
        socket.emit('error', { message: 'Not connected to a spreadsheet' });
        return;
      }

      // Diffuse le changement de format
      socket.to(`spreadsheet:${spreadsheetId}`).emit('cell-formatted', {
        cellId: hashCellId(row, column),
        row,
        column,
        format,
        userId,
        userName,
        timestamp: Date.now()
      });

      socket.emit('cell-format-ack', {
        cellId: hashCellId(row, column),
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error handling cell format', error);
      socket.emit('error', { message: 'Failed to process cell format' });
    }
  }

  /**
   * Gère la sélection multiple de cellules pour modification
   */
  static async handleBulkCellChange(socket: Socket, data: any): Promise<void> {
    try {
      const { changes } = data;
      const spreadsheetId = socket.data.spreadsheetId;
      const userId = socket.data.userId || socket.id;
      const userName = socket.data.userName || 'Anonymous';

      if (!spreadsheetId) {
        socket.emit('error', { message: 'Not connected to a spreadsheet' });
        return;
      }

      if (!Array.isArray(changes) || changes.length === 0) {
        socket.emit('error', { message: 'Invalid changes array' });
        return;
      }

      const operations: Operation[] = [];
      const cellChanges: CellChange[] = [];

      // Traite chaque changement
      for (const change of changes) {
        const { row, column, value, formula, format } = change;

        const operation: Operation = {
          id: uuidv4(),
          type: 'update',
          cellId: hashCellId(row, column),
          row,
          column,
          value,
          format,
          timestamp: Date.now(),
          userId,
          version: 1
        };

        operations.push(operation);

        cellChanges.push({
          cellId: operation.cellId,
          row,
          column,
          oldValue: null,
          newValue: value,
          timestamp: operation.timestamp,
          userId,
          changeType: 'value'
        });
      }

      // Résout les conflits dans le batch
      const resolvedOperations = conflictResolution.resolveConflicts(operations);

      // Ajoute les changements résolus au store
      for (const change of cellChanges) {
        memoryStore.addPendingChange(spreadsheetId, change);
      }

      // Diffuse les changements
      socket.to(`spreadsheet:${spreadsheetId}`).emit('bulk-cells-updated', {
        changes: resolvedOperations.map(op => ({
          cellId: op.cellId,
          row: op.row,
          column: op.column,
          value: op.value,
          format: op.format,
          userId,
          userName,
          timestamp: op.timestamp
        }))
      });

      socket.emit('bulk-change-ack', {
        operationCount: resolvedOperations.length,
        timestamp: Date.now()
      });

      // Programme la sauvegarde
      CellHandler.scheduleBatchSave(spreadsheetId, socket.data.token);

    } catch (error) {
      logger.error('Error handling bulk cell change', error);
      socket.emit('error', { message: 'Failed to process bulk changes' });
    }
  }

  /**
   * Programme une sauvegarde batch avec débounce
   */
  private static batchSaveTimers = new Map<string, NodeJS.Timeout>();

  private static scheduleBatchSave(spreadsheetId: string, userToken: string): void {
    // Annule le timer existant s'il y en a un
    const existingTimer = this.batchSaveTimers.get(spreadsheetId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Programme une nouvelle sauvegarde dans 2 secondes
    const timer = setTimeout(async () => {
      try {
        const changes = memoryStore.flushPendingChanges(spreadsheetId);
        
        if (changes.length > 0) {
          await apiProxyService.batchSave(spreadsheetId, changes, userToken);
          logger.info('Batch save completed', {
            spreadsheetId,
            changeCount: changes.length
          });
        }
        
        this.batchSaveTimers.delete(spreadsheetId);
      } catch (error) {
        logger.error('Batch save failed', error);
      }
    }, 2000);

    this.batchSaveTimers.set(spreadsheetId, timer);
  }
}