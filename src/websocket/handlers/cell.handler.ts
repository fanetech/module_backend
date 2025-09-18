import { Socket } from 'socket.io';
import { memoryStore } from '../../services/memory-store.service';
import { conflictResolution } from '../../services/conflict-resolution.service';
import { apiProxyService } from '../../services/api-proxy.service';
import { hyperFormulaIntegration } from '../../services/hyperformula-integration.service';
import { versionControl } from '../../services/version-control.service';
import { Operation } from '../../types/collaboration.types';
import { CellChange } from '../../types/spreadsheet.types';
import { logger } from '../../utils/logger';
import { hashCellId } from '../../utils/ot-transform';
import { Cell } from '../../models/Cell.model';
import { v4 as uuidv4 } from 'uuid';

export class CellHandler {
  /**
   * Gère les changements de cellule avec HyperFormula dual-engine
   */
  static async handleCellChange(socket: Socket, data: any): Promise<void> {
    try {
      const { row, column, value, formula, format, changeType = 'value', baseVersion = 0 } = data;
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

      const cellAddress = Cell.generateCellId(row, column);

      try {
        // Process through HyperFormula version control (dual-engine Step 2-3)
        const versionedUpdate = await versionControl.processUpdate(
          spreadsheetId,
          {
            address: cellAddress,
            row,
            col: column,
            value,
            formula,
            baseVersion,
            timestamp: Date.now(),
            userId,
            changeType: formula ? 'formula' : 'value'
          }
        );

        // Step 4: Backend → All Clients - Broadcast (exact documentation format)
        const broadcastData = {
          address: cellAddress,
          formula: formula,
          value: versionedUpdate.calculatedValue,
          version: versionedUpdate.resolvedVersion,
          affectedCells: versionedUpdate.affectedCells,
          // Additional context for frontend
          raw_value: formula || value,
          calculated_value: versionedUpdate.calculatedValue,
          userId,
          userName,
          timestamp: Date.now(),
          changeType,
          conflicts: versionedUpdate.conflicts.hasConflict ? {
            type: versionedUpdate.conflicts.conflictType,
            resolution: versionedUpdate.conflicts.resolution
          } : undefined
        };

        // Broadcast to other users
        socket.to(`spreadsheet:${spreadsheetId}`).emit('cell-updated', broadcastData);

        // Step 5: Frontend reconciliation data (exact documentation format)
        socket.emit('cell-change-ack', {
          address: cellAddress,
          formula: formula,
          value: versionedUpdate.calculatedValue,
          version: versionedUpdate.resolvedVersion,
          affectedCells: versionedUpdate.affectedCells,
          conflicts: versionedUpdate.conflicts.hasConflict,
          timestamp: Date.now()
        });

        logger.debug('Cell change processed with HyperFormula', {
          spreadsheetId,
          cellAddress,
          userId,
          version: versionedUpdate.resolvedVersion,
          hasConflicts: versionedUpdate.conflicts.hasConflict
        });

        // Schedule database persistence
        CellHandler.scheduleBatchSave(spreadsheetId, socket.data.token);

      } catch (error) {
        logger.error('Error processing cell change with HyperFormula', {
          spreadsheetId,
          cellAddress,
          error: error instanceof Error ? error.message : String(error)
        });

        socket.emit('error', {
          message: 'Failed to process cell change',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }

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
          address: operation.cellId,
          row,
          col: column,
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

      // Broadcast batch changes following documentation format
      socket.to(`spreadsheet:${spreadsheetId}`).emit('bulk-cells-updated', {
        updates: resolvedOperations.map(op => ({
          address: op.cellId,
          formula: op.format, // This should be formula if available
          value: op.value,
          version: op.version,
          affectedCells: [] // Would be populated by actual dependency tracking
        })),
        userId,
        userName,
        timestamp: Date.now()
      });

      socket.emit('bulk-change-ack', {
        updates: resolvedOperations.map(op => ({
          address: op.cellId,
          value: op.value,
          version: op.version
        })),
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