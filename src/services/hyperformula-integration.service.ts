import { hyperFormulaEngine } from './hyperformula-engine.service';
import { versionControl } from './version-control.service';
import { Cell, ICell } from '../models/Cell.model';
import { logger } from '../utils/logger';
import { db } from '../database/connection';

/**
 * Integration service that bridges existing services with HyperFormula
 * Provides compatibility layer for gradual migration to dual-engine architecture
 */
export class HyperFormulaIntegrationService {

  /**
   * Initialize HyperFormula engine for a spreadsheet
   */
  async initializeSpreadsheet(spreadsheetId: string): Promise<void> {
    try {
      // Load existing cells from database
      const database = db();
      const cells = await Cell.getBySpreadsheet(database, spreadsheetId);

      // Convert to ICell format for HyperFormula
      const cellData: ICell[] = cells.map(cell => ({
        id: cell.id,
        spreadsheet_id: cell.spreadsheet_id,
        row: cell.row,
        col: cell.col,
        cell_id: cell.cell_id,
        value: cell.value,
        formula: cell.formula,
        computed_value: cell.computed_value,
        format: cell.format,
        data_type: cell.data_type,
        is_locked: cell.is_locked,
        version: cell.version,
        base_version: cell.base_version,
        created_at: cell.created_at,
        updated_at: cell.updated_at,
        updated_by: cell.updated_by
      }));

      // Load into HyperFormula engine
      await hyperFormulaEngine.loadSpreadsheet(spreadsheetId, cellData);

      // Initialize version control
      versionControl.initializeSpreadsheet(spreadsheetId, cellData);

      logger.info('HyperFormula integration initialized', {
        spreadsheetId,
        cellCount: cellData.length
      });

    } catch (error) {
      logger.error('Failed to initialize HyperFormula integration', {
        spreadsheetId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Update cell using HyperFormula engine
   */
  async updateCellWithFormula(
    spreadsheetId: string,
    cellAddress: string,
    value: any,
    formula?: string,
    userId: string = 'system'
  ): Promise<{
    cell: ICell;
    calculatedValue: any;
    affectedCells: string[];
    version: number;
  }> {
    try {
      // Parse cell address
      const { row, col } = Cell.parseCellId(cellAddress);

      // Get current cell from database for base version
      const database = db();
      const existingCell = await Cell.findByPosition(database, spreadsheetId, row, col);
      const baseVersion = existingCell?.version || 0;

      // Process through version control and HyperFormula
      const versionedUpdate = await versionControl.processUpdate(
        spreadsheetId,
        {
          address: cellAddress,
          row,
          col,
          value,
          formula,
          baseVersion,
          timestamp: Date.now(),
          userId,
          changeType: formula ? 'formula' : 'value'
        }
      );

      // Create/update cell in database
      const cellData: ICell = {
        spreadsheet_id: spreadsheetId,
        row,
        col,
        cell_id: cellAddress,
        value: formula ? null : value, // Store null for formulas
        formula: formula,
        computed_value: String(versionedUpdate.calculatedValue),
        version: versionedUpdate.resolvedVersion,
        base_version: baseVersion,
        updated_by: userId,
        updated_at: new Date()
      };

      await Cell.upsert(database, cellData);

      return {
        cell: cellData,
        calculatedValue: versionedUpdate.calculatedValue,
        affectedCells: versionedUpdate.affectedCells,
        version: versionedUpdate.resolvedVersion
      };

    } catch (error) {
      logger.error('Failed to update cell with HyperFormula', {
        spreadsheetId,
        cellAddress,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get calculated values for all formulas in a spreadsheet
   */
  async getCalculatedValues(spreadsheetId: string): Promise<Map<string, any>> {
    try {
      const results = new Map<string, any>();

      // Get formula cells from database
      const database = db();
      const formulaCells = await Cell.getFormulaCells(database, spreadsheetId);

      for (const cell of formulaCells) {
        // Get calculated value from HyperFormula engine
        const cellInfo = hyperFormulaEngine.getCell(cell.cell_id);
        if (cellInfo) {
          results.set(cell.cell_id, cellInfo.calculatedValue);
        }
      }

      return results;

    } catch (error) {
      logger.error('Failed to get calculated values', {
        spreadsheetId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Validate formula using HyperFormula engine
   */
  validateFormula(formula: string): { valid: boolean; error?: string } {
    try {
      return hyperFormulaEngine.validateFormula(formula);
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get spreadsheet data in 2D array format
   */
  getSpreadsheetArray(maxRows: number = 1000, maxCols: number = 26): any[][] {
    try {
      return hyperFormulaEngine.getSpreadsheetData(maxRows, maxCols);
    } catch (error) {
      logger.error('Failed to get spreadsheet array', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Batch update multiple cells
   */
  async batchUpdateCells(
    spreadsheetId: string,
    updates: Array<{
      address: string;
      value: any;
      formula?: string;
    }>,
    userId: string = 'system'
  ): Promise<{
    updatedCells: ICell[];
    totalConflicts: number;
    globalVersion: number;
  }> {
    try {
      // Ensure spreadsheet is initialized
      await this.initializeSpreadsheet(spreadsheetId);

      // Convert to CellUpdate format
      const cellUpdates = updates.map(update => {
        const { row, col } = Cell.parseCellId(update.address);
        return {
          address: update.address,
          row,
          col,
          value: update.value,
          formula: update.formula,
          baseVersion: 0, // TODO: Get actual base versions
          timestamp: Date.now(),
          userId,
          changeType: update.formula ? 'formula' as const : 'value' as const
        };
      });

      // Process batch through version control
      const batchResult = await versionControl.processBatchUpdates(
        spreadsheetId,
        cellUpdates
      );

      // Update database
      const updatedCells: ICell[] = [];

      for (const versionedUpdate of batchResult.updates) {
        const cellData: ICell = {
          spreadsheet_id: spreadsheetId,
          row: versionedUpdate.update.row,
          col: versionedUpdate.update.col,
          cell_id: versionedUpdate.update.address,
          value: versionedUpdate.update.formula ? null : versionedUpdate.update.value,
          formula: versionedUpdate.update.formula,
          computed_value: String(versionedUpdate.calculatedValue),
          version: versionedUpdate.resolvedVersion,
          base_version: versionedUpdate.update.baseVersion,
          updated_by: userId,
          updated_at: new Date()
        };

        const batchDatabase = db();
        await Cell.upsert(batchDatabase, cellData);
        updatedCells.push(cellData);
      }

      return {
        updatedCells,
        totalConflicts: batchResult.totalConflicts,
        globalVersion: batchResult.globalVersion
      };

    } catch (error) {
      logger.error('Failed to batch update cells', {
        spreadsheetId,
        updateCount: updates.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get engine status and health
   */
  getEngineStatus(): {
    hyperFormula: any;
    versionControl: any;
    isHealthy: boolean;
  } {
    try {
      const engineState = hyperFormulaEngine.getEngineState();

      return {
        hyperFormula: {
          version: engineState.version,
          lastUpdated: engineState.lastUpdated,
          cellCount: engineState.cellCount,
          dependencyCount: engineState.dependencies.size
        },
        versionControl: {
          // Add version control status if needed
        },
        isHealthy: true
      };
    } catch (error) {
      logger.error('Failed to get engine status', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        hyperFormula: null,
        versionControl: null,
        isHealthy: false
      };
    }
  }

  /**
   * Sync database with HyperFormula engine state
   */
  async syncWithDatabase(spreadsheetId: string): Promise<void> {
    try {
      // Get current state from HyperFormula
      const spreadsheetData = hyperFormulaEngine.getSpreadsheetData();

      // Convert to cell updates
      const cellUpdates: ICell[] = [];

      for (let row = 0; row < spreadsheetData.length; row++) {
        for (let col = 0; col < spreadsheetData[row].length; col++) {
          const value = spreadsheetData[row][col];
          if (value !== null && value !== undefined) {
            const cellAddress = Cell.generateCellId(row, col);
            const cellInfo = hyperFormulaEngine.getCell(cellAddress);

            if (cellInfo) {
              cellUpdates.push({
                spreadsheet_id: spreadsheetId,
                row,
                col,
                cell_id: cellAddress,
                value: cellInfo.formula ? null : cellInfo.value,
                formula: cellInfo.formula,
                computed_value: String(cellInfo.calculatedValue),
                version: cellInfo.version,
                updated_at: new Date()
              });
            }
          }
        }
      }

      // Batch update database
      if (cellUpdates.length > 0) {
        const syncDatabase = db();
        await Cell.bulkUpsert(syncDatabase, cellUpdates);

        logger.info('Database synced with HyperFormula engine', {
          spreadsheetId,
          cellCount: cellUpdates.length
        });
      }

    } catch (error) {
      logger.error('Failed to sync with database', {
        spreadsheetId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

// Export singleton instance
export const hyperFormulaIntegration = new HyperFormulaIntegrationService();