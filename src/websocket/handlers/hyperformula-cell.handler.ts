import { Socket } from 'socket.io';
import { logger } from '../../utils/logger';
import { hyperFormulaEngine } from '../../services/hyperformula-engine.service';
import { versionControl, CellUpdate } from '../../services/version-control.service';
import { apiProxyService } from '../../services/api-proxy.service';
import { Cell } from '../../models/Cell.model';
import { v4 as uuidv4 } from 'uuid';

/**
 * HyperFormula cell handler implementing dual-engine architecture
 * Handles immediate frontend calculations and authoritative backend processing
 */
export class HyperFormulaCellHandler {

  /**
   * Handle formula update with dual-engine architecture
   * Step 2-3 from the documentation: Backend authoritative calculation
   */
  static async handleFormulaUpdate(socket: Socket, data: any): Promise<void> {
    try {
      const { address, formula, value, baseVersion, timestamp } = data;
      const spreadsheetId = socket.data.spreadsheetId;
      const userId = socket.data.userId || socket.id;
      const userName = socket.data.userName || 'Anonymous';

      if (!spreadsheetId) {
        socket.emit('error', { message: 'Not connected to a spreadsheet' });
        return;
      }

      // Validate input
      if (!address) {
        socket.emit('error', { message: 'Cell address is required' });
        return;
      }

      // Parse address to get row/col
      const { row, col } = Cell.parseCellId(address);

      // Create update object for version control
      const cellUpdate: CellUpdate = {
        address,
        row,
        col,
        value: value,
        formula: formula,
        baseVersion: baseVersion || 0,
        timestamp: timestamp || Date.now(),
        userId,
        changeType: formula ? 'formula' : 'value'
      };

      // Process update through version control system
      const versionedUpdate = await versionControl.processUpdate(
        spreadsheetId,
        cellUpdate
      );

      // Prepare broadcast data for Step 4: Backend → All Clients
      const broadcastData = {
        address,
        formula: versionedUpdate.update.formula,
        value: versionedUpdate.calculatedValue,
        version: versionedUpdate.resolvedVersion,
        affectedCells: versionedUpdate.affectedCells,
        userId,
        userName,
        timestamp: Date.now(),
        conflicts: versionedUpdate.conflicts.hasConflict ? {
          type: versionedUpdate.conflicts.conflictType,
          resolution: versionedUpdate.conflicts.resolution
        } : undefined
      };

      // Step 4: Broadcast to all clients for frontend reconciliation
      socket.to(`spreadsheet:${spreadsheetId}`).emit('formula-update-broadcast', broadcastData);

      // Confirm to the sender (Step 5: Frontend reconciliation data)
      socket.emit('formula-update-ack', {
        address,
        calculatedValue: versionedUpdate.calculatedValue,
        version: versionedUpdate.resolvedVersion,
        affectedCells: versionedUpdate.affectedCells,
        conflicts: versionedUpdate.conflicts.hasConflict,
        timestamp: Date.now()
      });

      logger.debug('Formula update processed with HyperFormula', {
        spreadsheetId,
        address,
        userId,
        version: versionedUpdate.resolvedVersion,
        hasConflicts: versionedUpdate.conflicts.hasConflict,
        affectedCells: versionedUpdate.affectedCells.length
      });

      // Schedule database persistence (debounced)
      HyperFormulaCellHandler.scheduleDatabaseSync(spreadsheetId, socket.data.token);

    } catch (error) {
      logger.error('Error handling formula update', error);
      socket.emit('error', {
        message: 'Failed to process formula update',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle batch cell updates with HyperFormula
   */
  static async handleBatchUpdate(socket: Socket, data: any): Promise<void> {
    try {
      const { updates } = data;
      const spreadsheetId = socket.data.spreadsheetId;
      const userId = socket.data.userId || socket.id;
      const userName = socket.data.userName || 'Anonymous';

      if (!spreadsheetId) {
        socket.emit('error', { message: 'Not connected to a spreadsheet' });
        return;
      }

      if (!Array.isArray(updates) || updates.length === 0) {
        socket.emit('error', { message: 'Invalid updates array' });
        return;
      }

      // Convert to CellUpdate format
      const cellUpdates: CellUpdate[] = updates.map(update => {
        const { row, col } = Cell.parseCellId(update.address);
        return {
          address: update.address,
          row,
          col,
          value: update.value,
          formula: update.formula,
          baseVersion: update.baseVersion || 0,
          timestamp: Date.now(),
          userId,
          changeType: update.formula ? 'formula' : 'value'
        };
      });

      // Process batch through version control
      const batchResult = await versionControl.processBatchUpdates(
        spreadsheetId,
        cellUpdates
      );

      // Prepare batch broadcast data
      const batchBroadcast = {
        updates: batchResult.updates.map(versionedUpdate => ({
          address: versionedUpdate.update.address,
          formula: versionedUpdate.update.formula,
          value: versionedUpdate.calculatedValue,
          version: versionedUpdate.resolvedVersion,
          affectedCells: versionedUpdate.affectedCells
        })),
        globalVersion: batchResult.globalVersion,
        userId,
        userName,
        timestamp: Date.now(),
        totalConflicts: batchResult.totalConflicts
      };

      // Broadcast to all clients
      socket.to(`spreadsheet:${spreadsheetId}`).emit('batch-update-broadcast', batchBroadcast);

      // Confirm to sender
      socket.emit('batch-update-ack', {
        processedCount: batchResult.updates.length,
        globalVersion: batchResult.globalVersion,
        conflicts: batchResult.totalConflicts,
        processingTime: batchResult.processingTime,
        timestamp: Date.now()
      });

      logger.info('Batch update processed with HyperFormula', {
        spreadsheetId,
        updateCount: updates.length,
        conflicts: batchResult.totalConflicts,
        processingTime: batchResult.processingTime
      });

      // Schedule database sync
      HyperFormulaCellHandler.scheduleDatabaseSync(spreadsheetId, socket.data.token);

    } catch (error) {
      logger.error('Error handling batch update', error);
      socket.emit('error', {
        message: 'Failed to process batch update',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle formula validation request
   */
  static async handleFormulaValidation(socket: Socket, data: any): Promise<void> {
    try {
      const { formula } = data;

      if (!formula || typeof formula !== 'string') {
        socket.emit('error', { message: 'Formula is required' });
        return;
      }

      // Validate formula syntax using HyperFormula
      const validation = hyperFormulaEngine.validateFormula(formula);

      socket.emit('formula-validation-result', {
        formula,
        valid: validation.valid,
        error: validation.error,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error validating formula', error);
      socket.emit('error', {
        message: 'Failed to validate formula',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle request for spreadsheet data in HyperFormula format
   */
  static async handleGetSpreadsheetData(socket: Socket, data: any): Promise<void> {
    try {
      const { maxRows = 1000, maxCols = 26 } = data;
      const spreadsheetId = socket.data.spreadsheetId;

      if (!spreadsheetId) {
        socket.emit('error', { message: 'Not connected to a spreadsheet' });
        return;
      }

      // Get data from HyperFormula engine
      const spreadsheetData = hyperFormulaEngine.getSpreadsheetData(maxRows, maxCols);
      const engineState = hyperFormulaEngine.getEngineState();

      socket.emit('spreadsheet-data-response', {
        data: spreadsheetData,
        version: engineState.version,
        lastUpdated: engineState.lastUpdated,
        cellCount: engineState.cellCount,
        timestamp: Date.now()
      });

      logger.debug('Spreadsheet data sent to client', {
        spreadsheetId,
        dimensions: `${maxRows}x${maxCols}`,
        version: engineState.version
      });

    } catch (error) {
      logger.error('Error getting spreadsheet data', error);
      socket.emit('error', {
        message: 'Failed to get spreadsheet data',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle dependency analysis request
   */
  static async handleDependencyAnalysis(socket: Socket, data: any): Promise<void> {
    try {
      const { address } = data;

      if (!address) {
        socket.emit('error', { message: 'Cell address is required' });
        return;
      }

      // Get cell information including dependencies
      const cellInfo = hyperFormulaEngine.getCell(address);
      const engineState = hyperFormulaEngine.getEngineState();

      const dependencies = engineState.dependencies.get(address) || [];

      socket.emit('dependency-analysis-result', {
        address,
        cellInfo,
        dependencies,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error analyzing dependencies', error);
      socket.emit('error', {
        message: 'Failed to analyze dependencies',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle engine state request
   */
  static async handleEngineStateRequest(socket: Socket): Promise<void> {
    try {
      const spreadsheetId = socket.data.spreadsheetId;

      if (!spreadsheetId) {
        socket.emit('error', { message: 'Not connected to a spreadsheet' });
        return;
      }

      const engineState = hyperFormulaEngine.getEngineState();
      const versionStatus = versionControl.getVersionStatus(spreadsheetId);

      socket.emit('engine-state-response', {
        hyperFormula: {
          version: engineState.version,
          lastUpdated: engineState.lastUpdated,
          cellCount: engineState.cellCount,
          dependencies: Array.from(engineState.dependencies.entries())
        },
        versionControl: versionStatus,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error getting engine state', error);
      socket.emit('error', {
        message: 'Failed to get engine state',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Database sync scheduling with debounce
   */
  private static syncTimers = new Map<string, NodeJS.Timeout>();

  private static scheduleDatabaseSync(spreadsheetId: string, userToken: string): void {
    // Clear existing timer
    const existingTimer = this.syncTimers.get(spreadsheetId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new sync in 2 seconds (debounce)
    const timer = setTimeout(async () => {
      try {
        // Get current spreadsheet data from HyperFormula
        const spreadsheetData = hyperFormulaEngine.getSpreadsheetData();
        const engineState = hyperFormulaEngine.getEngineState();

        // Convert to database format and save
        const cells: any[] = [];
        for (let row = 0; row < spreadsheetData.length; row++) {
          for (let col = 0; col < spreadsheetData[row].length; col++) {
            const value = spreadsheetData[row][col];
            if (value !== null && value !== undefined) {
              const cellInfo = hyperFormulaEngine.getCell(Cell.generateCellId(row, col));
              if (cellInfo) {
                cells.push({
                  spreadsheet_id: spreadsheetId,
                  row,
                  col,
                  cell_id: cellInfo.address,
                  value: cellInfo.formula ? null : cellInfo.value,
                  formula: cellInfo.formula,
                  computed_value: cellInfo.calculatedValue,
                  version: cellInfo.version,
                  updated_at: new Date()
                });
              }
            }
          }
        }

        // Batch save to database
        if (cells.length > 0) {
          await apiProxyService.batchSave(spreadsheetId, cells, userToken);
          logger.info('Database sync completed', {
            spreadsheetId,
            cellCount: cells.length,
            version: engineState.version
          });
        }

        this.syncTimers.delete(spreadsheetId);

      } catch (error) {
        logger.error('Database sync failed', {
          spreadsheetId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, 2000); // 2 second debounce

    this.syncTimers.set(spreadsheetId, timer);
  }
}

// Event handler mappings for the dual-engine architecture
export const hyperFormulaCellHandlers = {
  'formula-update': HyperFormulaCellHandler.handleFormulaUpdate,
  'batch-update': HyperFormulaCellHandler.handleBatchUpdate,
  'formula-validation': HyperFormulaCellHandler.handleFormulaValidation,
  'get-spreadsheet-data': HyperFormulaCellHandler.handleGetSpreadsheetData,
  'dependency-analysis': HyperFormulaCellHandler.handleDependencyAnalysis,
  'engine-state': HyperFormulaCellHandler.handleEngineStateRequest
};