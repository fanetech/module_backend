import { Request, Response } from 'express';
import { hyperFormulaEngine } from '../services/hyperformula-engine.service';
import { versionControl, CellUpdate } from '../services/version-control.service';
import { Cell } from '../models/Cell.model';
import { logger } from '../utils/logger';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  version?: number;
  timestamp?: number;
}

/**
 * HyperFormula Controller for dual-engine architecture REST API
 * Handles Step 1 (Initial Load) and provides backend calculation authority
 */
export class HyperFormulaController {

  /**
   * Initialize HyperFormula engine with spreadsheet data
   * Implements Step 1: Initial Load Flow from documentation
   */
  static async loadSpreadsheet(req: Request, res: Response): Promise<void> {
    try {
      const { spreadsheetId } = req.params;
      const { cells = [] } = req.body;

      // Load data into HyperFormula engine
      await hyperFormulaEngine.loadSpreadsheet(spreadsheetId, cells);

      // Initialize version control
      versionControl.initializeSpreadsheet(spreadsheetId, cells);

      // Get calculated values for response
      const engineState = hyperFormulaEngine.getEngineState();
      const spreadsheetData = hyperFormulaEngine.getSpreadsheetData();

      const response: ApiResponse<any> = {
        success: true,
        data: {
          spreadsheetData,
          engineState: {
            version: engineState.version,
            lastUpdated: engineState.lastUpdated,
            cellCount: engineState.cellCount
          }
        },
        version: engineState.version,
        timestamp: Date.now()
      };

      res.json(response);

      logger.info('HyperFormula engine loaded for spreadsheet', {
        spreadsheetId,
        cellCount: cells.length,
        version: engineState.version
      });

    } catch (error) {
      logger.error('Error loading spreadsheet into HyperFormula', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to load spreadsheet into HyperFormula engine',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get spreadsheet data in HyperFormula format
   * Returns calculated values in 2D array format (Handsontable compatible)
   */
  static async getSpreadsheetData(req: Request, res: Response): Promise<void> {
    try {
      const { spreadsheetId } = req.params;
      const { maxRows = 1000, maxCols = 26 } = req.query;

      const spreadsheetData = hyperFormulaEngine.getSpreadsheetData(
        Number(maxRows),
        Number(maxCols)
      );
      const engineState = hyperFormulaEngine.getEngineState();

      const response: ApiResponse<any> = {
        success: true,
        data: {
          spreadsheetData,
          dimensions: {
            rows: Number(maxRows),
            cols: Number(maxCols)
          }
        },
        version: engineState.version,
        timestamp: Date.now()
      };

      res.json(response);

    } catch (error) {
      logger.error('Error getting spreadsheet data', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to get spreadsheet data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
      res.status(500).json(response);
    }
  }

  /**
   * Process formula update with version control
   * Backend authoritative calculation for Step 3 of dual-engine flow
   */
  static async processFormulaUpdate(req: Request, res: Response): Promise<void> {
    try {
      const { spreadsheetId } = req.params;
      const { address, formula, value, baseVersion, userId = 'api-user' } = req.body;

      if (!address) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'Cell address is required',
          timestamp: Date.now()
        };
        res.status(400).json(response);
        return;
      }

      // Parse address to get row/col
      const { row, col } = Cell.parseCellId(address);

      // Create update object
      const cellUpdate: CellUpdate = {
        address,
        row,
        col,
        value,
        formula,
        baseVersion: baseVersion || 0,
        timestamp: Date.now(),
        userId,
        changeType: formula ? 'formula' : 'value'
      };

      // Process update with version control
      const versionedUpdate = await versionControl.processUpdate(
        spreadsheetId,
        cellUpdate
      );

      const response: ApiResponse<any> = {
        success: true,
        data: {
          address,
          calculatedValue: versionedUpdate.calculatedValue,
          version: versionedUpdate.resolvedVersion,
          affectedCells: versionedUpdate.affectedCells,
          conflicts: versionedUpdate.conflicts.hasConflict ? {
            type: versionedUpdate.conflicts.conflictType,
            resolution: versionedUpdate.conflicts.resolution
          } : null
        },
        version: versionedUpdate.resolvedVersion,
        timestamp: Date.now()
      };

      res.json(response);

      logger.debug('Formula update processed via API', {
        spreadsheetId,
        address,
        version: versionedUpdate.resolvedVersion,
        hasConflicts: versionedUpdate.conflicts.hasConflict
      });

    } catch (error) {
      logger.error('Error processing formula update', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to process formula update',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
      res.status(500).json(response);
    }
  }

  /**
   * Process batch cell updates
   */
  static async processBatchUpdate(req: Request, res: Response): Promise<void> {
    try {
      const { spreadsheetId } = req.params;
      const { updates, userId = 'api-user' } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'Valid updates array is required',
          timestamp: Date.now()
        };
        res.status(400).json(response);
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

      // Process batch
      const batchResult = await versionControl.processBatchUpdates(
        spreadsheetId,
        cellUpdates
      );

      const response: ApiResponse<any> = {
        success: true,
        data: {
          processedCount: batchResult.updates.length,
          updates: batchResult.updates.map(versionedUpdate => ({
            address: versionedUpdate.update.address,
            calculatedValue: versionedUpdate.calculatedValue,
            version: versionedUpdate.resolvedVersion,
            affectedCells: versionedUpdate.affectedCells
          })),
          conflicts: batchResult.totalConflicts,
          processingTime: batchResult.processingTime
        },
        version: batchResult.globalVersion,
        timestamp: Date.now()
      };

      res.json(response);

      logger.info('Batch update processed via API', {
        spreadsheetId,
        updateCount: updates.length,
        conflicts: batchResult.totalConflicts,
        processingTime: batchResult.processingTime
      });

    } catch (error) {
      logger.error('Error processing batch update', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to process batch update',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
      res.status(500).json(response);
    }
  }

  /**
   * Validate formula syntax
   */
  static async validateFormula(req: Request, res: Response): Promise<void> {
    try {
      const { formula } = req.body;

      if (!formula || typeof formula !== 'string') {
        const response: ApiResponse<any> = {
          success: false,
          error: 'Formula string is required',
          timestamp: Date.now()
        };
        res.status(400).json(response);
        return;
      }

      const validation = hyperFormulaEngine.validateFormula(formula);

      const response: ApiResponse<any> = {
        success: true,
        data: {
          formula,
          valid: validation.valid,
          error: validation.error
        },
        timestamp: Date.now()
      };

      res.json(response);

    } catch (error) {
      logger.error('Error validating formula', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to validate formula',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get cell information including formula and calculated value
   */
  static async getCell(req: Request, res: Response): Promise<void> {
    try {
      const { spreadsheetId, address } = req.params;

      const cellInfo = hyperFormulaEngine.getCell(address);

      if (!cellInfo) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'Cell not found or empty',
          timestamp: Date.now()
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<any> = {
        success: true,
        data: cellInfo,
        version: cellInfo.version,
        timestamp: Date.now()
      };

      res.json(response);

    } catch (error) {
      logger.error('Error getting cell info', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to get cell information',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get engine state and statistics
   */
  static async getEngineState(req: Request, res: Response): Promise<void> {
    try {
      const { spreadsheetId } = req.params;

      const engineState = hyperFormulaEngine.getEngineState();
      const versionStatus = versionControl.getVersionStatus(spreadsheetId);

      const response: ApiResponse<any> = {
        success: true,
        data: {
          hyperFormula: {
            version: engineState.version,
            lastUpdated: engineState.lastUpdated,
            cellCount: engineState.cellCount,
            dependencyCount: engineState.dependencies.size
          },
          versionControl: versionStatus
        },
        version: engineState.version,
        timestamp: Date.now()
      };

      res.json(response);

    } catch (error) {
      logger.error('Error getting engine state', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to get engine state',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
      res.status(500).json(response);
    }
  }

  /**
   * Analyze cell dependencies
   */
  static async analyzeDependencies(req: Request, res: Response): Promise<void> {
    try {
      const { spreadsheetId, address } = req.params;

      const cellInfo = hyperFormulaEngine.getCell(address);
      const engineState = hyperFormulaEngine.getEngineState();
      const dependencies = engineState.dependencies.get(address) || [];

      const response: ApiResponse<any> = {
        success: true,
        data: {
          address,
          cellInfo,
          dependencies: Array.from(dependencies),
          dependentCount: dependencies.length
        },
        timestamp: Date.now()
      };

      res.json(response);

    } catch (error) {
      logger.error('Error analyzing dependencies', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to analyze dependencies',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get version information
   */
  static async getVersionInfo(req: Request, res: Response): Promise<void> {
    try {
      const { spreadsheetId } = req.params;

      const versionStatus = versionControl.getVersionStatus(spreadsheetId);
      const engineState = hyperFormulaEngine.getEngineState();

      const response: ApiResponse<any> = {
        success: true,
        data: {
          spreadsheetId,
          currentVersion: versionStatus.globalVersion,
          engineVersion: engineState.version,
          cellCount: versionStatus.cellCount,
          pendingUpdates: versionStatus.pendingUpdates,
          lastUpdated: versionStatus.lastUpdated
        },
        version: versionStatus.globalVersion,
        timestamp: Date.now()
      };

      res.json(response);

    } catch (error) {
      logger.error('Error getting version info', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to get version information',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
      res.status(500).json(response);
    }
  }

  /**
   * Health check for HyperFormula engine
   */
  static async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const engineState = hyperFormulaEngine.getEngineState();

      const response: ApiResponse<any> = {
        success: true,
        data: {
          status: 'healthy',
          engine: 'HyperFormula',
          version: engineState.version,
          lastUpdated: engineState.lastUpdated,
          uptime: Date.now() - engineState.lastUpdated.getTime()
        },
        timestamp: Date.now()
      };

      res.json(response);

    } catch (error) {
      logger.error('HyperFormula health check failed', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'HyperFormula engine unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
      res.status(500).json(response);
    }
  }
}