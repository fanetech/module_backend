import { Request, Response } from 'express';
import { SpreadsheetService } from '../services/spreadsheet.service';
import { CollaborationService } from '../services/collaboration.service';
import { hyperFormulaIntegration } from '../services/hyperformula-integration.service';
import { hyperFormulaEngine } from '../services/hyperformula-engine.service';
import { versionControl } from '../services/version-control.service';
import { ApiResponse, SpreadsheetData } from '../types/spreadsheet.types';
// Types are available but not currently used directly in controller
// Will be used when implementing stricter typing in the future

export class SpreadsheetController {
  // Get all spreadsheets
  static async getAllSpreadsheets(req: Request, res: Response): Promise<void> {
    try {
      const spreadsheets = await SpreadsheetService.getAllSpreadsheets();
      
      const response: ApiResponse<any> = {
        success: true,
        data: spreadsheets
      };
      
      res.json(response);
    } catch (error) {
      console.error('Error getting spreadsheets:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to fetch spreadsheets',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // Get spreadsheet by ID
  static async getSpreadsheetById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const includeActiveUsers = req.query.includeActiveUsers === 'true';
      
      const spreadsheetData = await SpreadsheetService.getSpreadsheetById(id);
      
      if (!spreadsheetData) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'Spreadsheet not found'
        };
        res.status(404).json(response);
        return;
      }

      // Include active users if requested
      if (includeActiveUsers) {
        const activeUsers = await CollaborationService.getActiveUsers(id);
        spreadsheetData.active_users = activeUsers;
      }

      // Initialize HyperFormula engine if not already done
      try {
        await hyperFormulaIntegration.initializeSpreadsheet(id);
      } catch (error) {
        // Engine might already be initialized, continue
      }

      // Get calculated values from HyperFormula
      const calculatedValues = await hyperFormulaIntegration.getCalculatedValues(id);

      // Add calculated values to cells and include version info
      spreadsheetData.cells = spreadsheetData.cells.map((cell: any) => {
        if (cell.formula && calculatedValues.has(cell.cell_id)) {
          cell.computed_value = String(calculatedValues.get(cell.cell_id));
        }
        // Ensure version fields are included
        if (!cell.version) cell.version = 1;
        if (!cell.base_version) cell.base_version = 0;
        return cell;
      });

      // Add HyperFormula engine state to response following documentation format
      const engineState = hyperFormulaEngine.getEngineState();
      spreadsheetData.hyperformula = {
        version: engineState.version,
        lastUpdated: engineState.lastUpdated,
        cellCount: engineState.cellCount,
        isInitialized: true
      };

      // Ensure cells include all documentation-specified fields
      spreadsheetData.cells = spreadsheetData.cells.map((cell: any) => ({
        ...cell,
        address: cell.cell_id,
        raw_value: cell.formula || cell.value,
        calculated_value: cell.computed_value || cell.value,
        version: cell.version || 1,
        baseVersion: cell.base_version || 0
      }));

      const response: ApiResponse<SpreadsheetData> = {
        success: true,
        data: spreadsheetData
      };
      
      res.json(response);
    } catch (error) {
      console.error('Error getting spreadsheet:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to fetch spreadsheet',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // Create new spreadsheet
  static async createSpreadsheet(req: Request, res: Response): Promise<void> {
    try {
      const spreadsheet = await SpreadsheetService.createSpreadsheet(req.body);
      
      const response: ApiResponse<any> = {
        success: true,
        data: spreadsheet
      };
      
      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating spreadsheet:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to create spreadsheet',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // Update spreadsheet
  static async updateSpreadsheet(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updated = await SpreadsheetService.updateSpreadsheet(id, req.body);
      
      if (!updated) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'Spreadsheet not found'
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<any> = {
        success: true,
        message: 'Spreadsheet updated successfully'
      };
      
      res.json(response);
    } catch (error) {
      console.error('Error updating spreadsheet:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to update spreadsheet',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // Delete spreadsheet
  static async deleteSpreadsheet(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await SpreadsheetService.deleteSpreadsheet(id);
      
      if (!deleted) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'Spreadsheet not found'
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<any> = {
        success: true,
        message: 'Spreadsheet deleted successfully'
      };
      
      res.json(response);
    } catch (error) {
      console.error('Error deleting spreadsheet:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to delete spreadsheet',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // Update cell with HyperFormula integration
  static async updateCell(req: Request, res: Response): Promise<void> {
    try {
      const { id, cellId } = req.params;
      const { value, formula, user_id = 'api-user' } = req.body;

      // Use HyperFormula integration for cell updates
      const result = await hyperFormulaIntegration.updateCellWithFormula(
        id,
        cellId,
        value,
        formula,
        user_id
      );

      // Format response according to documentation specification
      const response: ApiResponse<any> = {
        success: true,
        data: {
          address: cellId,
          formula: result.cell.formula,
          value: result.calculatedValue,
          version: result.version,
          affectedCells: result.affectedCells,
          raw_value: result.cell.formula || result.cell.value,
          calculated_value: result.calculatedValue
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error updating cell:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to update cell',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // Batch update cells with HyperFormula integration
  static async batchUpdateCells(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { updates, user_id = 'api-user' } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'Valid updates array is required'
        };
        res.status(400).json(response);
        return;
      }

      // Transform frontend format (cell_id) to service format (address)
      const transformedUpdates = updates.map(update => ({
        address: update.cell_id,
        value: update.value,
        formula: update.formula
      }));

      // Use HyperFormula integration for batch updates
      const result = await hyperFormulaIntegration.batchUpdateCells(id, transformedUpdates, user_id);

      // Format batch response according to documentation
      const response: ApiResponse<any> = {
        success: true,
        data: {
          updates: result.updatedCells.map(cell => ({
            address: cell.cell_id,
            formula: cell.formula,
            value: cell.computed_value,
            version: cell.version,
            raw_value: cell.formula || cell.value,
            calculated_value: cell.computed_value
          })),
          globalVersion: result.globalVersion,
          totalConflicts: result.totalConflicts,
          processedCount: result.updatedCells.length
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error batch updating cells:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to batch update cells',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // Get cells in range
  static async getCellsInRange(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { startRow, startCol, endRow, endCol } = req.query;
      
      const cells = await SpreadsheetService.getCellsInRange(
        id,
        Number(startRow),
        Number(startCol),
        Number(endRow),
        Number(endCol)
      );

      const response: ApiResponse<any> = {
        success: true,
        data: cells
      };
      
      res.json(response);
    } catch (error) {
      console.error('Error getting cells in range:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to fetch cells',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // Get cell history
  static async getCellHistory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { cellId, limit } = req.query;
      
      const history = await SpreadsheetService.getCellHistory(
        id,
        cellId as string,
        Number(limit) || 50
      );

      const response: ApiResponse<any> = {
        success: true,
        data: history
      };
      
      res.json(response);
    } catch (error) {
      console.error('Error getting cell history:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to fetch cell history',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // Calculate formulas using HyperFormula
  static async calculateFormulas(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Get calculated values from HyperFormula engine
      const results = await hyperFormulaIntegration.getCalculatedValues(id);
      const engineState = hyperFormulaEngine.getEngineState();

      // Format calculation response according to documentation
      const response: ApiResponse<any> = {
        success: true,
        data: {
          calculations: Array.from(results.entries()).map(([address, value]: [string, any]) => ({
            address,
            calculated_value: value,
            formula: null, // Will be populated if available
            version: engineState.version
          })),
          engine_state: {
            version: engineState.version,
            lastUpdated: engineState.lastUpdated,
            cellCount: engineState.cellCount
          }
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error calculating formulas:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to calculate formulas',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // Helper: Parse cell ID
  private static parseCellId(cellId: string): [number, number] {
    const match = cellId.match(/^([A-Z]+)(\d+)$/);
    if (!match) {
      throw new Error(`Invalid cell ID: ${cellId}`);
    }
    const col = SpreadsheetController.letterToColumn(match[1]);
    const row = parseInt(match[2]) - 1;
    return [row, col];
  }

  // Helper: Convert letter to column index
  private static letterToColumn(letter: string): number {
    let col = 0;
    for (let i = 0; i < letter.length; i++) {
      col = col * 26 + (letter.charCodeAt(i) - 64);
    }
    return col - 1;
  }

  // Validate formula syntax
  static async validateFormula(req: Request, res: Response): Promise<void> {
    try {
      const { formula } = req.body;

      if (!formula || typeof formula !== 'string') {
        const response: ApiResponse<any> = {
          success: false,
          error: 'Formula string is required'
        };
        res.status(400).json(response);
        return;
      }

      const validation = hyperFormulaIntegration.validateFormula(formula);

      const response: ApiResponse<any> = {
        success: true,
        data: {
          formula,
          valid: validation.valid,
          error: validation.error
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error validating formula:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to validate formula',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // Get spreadsheet data in 2D array format (Handsontable compatible)
  static async getSpreadsheetData(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { maxRows = 1000, maxCols = 26 } = req.query;

      // Initialize HyperFormula if needed
      try {
        await hyperFormulaIntegration.initializeSpreadsheet(id);
      } catch (error) {
        // Engine might already be initialized
      }

      const spreadsheetData = hyperFormulaIntegration.getSpreadsheetArray(
        Number(maxRows),
        Number(maxCols)
      );

      const engineState = hyperFormulaEngine.getEngineState();

      // Format spreadsheet data response according to documentation
      const response: ApiResponse<any> = {
        success: true,
        data: {
          spreadsheetData, // 2D array format for Handsontable compatibility
          dimensions: {
            rows: Number(maxRows),
            cols: Number(maxCols)
          },
          version: engineState.version,
          lastUpdated: engineState.lastUpdated,
          cellCount: engineState.cellCount
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting spreadsheet data:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to get spreadsheet data',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // Get HyperFormula engine status
  static async getEngineStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const status = hyperFormulaIntegration.getEngineStatus();
      const versionStatus = versionControl.getVersionStatus(id);

      const response: ApiResponse<any> = {
        success: true,
        data: {
          spreadsheetId: id,
          engine: status,
          versionControl: versionStatus,
          isHealthy: status.isHealthy
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting engine status:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to get engine status',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // Initialize HyperFormula engine for spreadsheet
  static async initializeEngine(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await hyperFormulaIntegration.initializeSpreadsheet(id);
      const engineState = hyperFormulaEngine.getEngineState();

      const response: ApiResponse<any> = {
        success: true,
        data: {
          spreadsheetId: id,
          initialized: true,
          engine_state: {
            version: engineState.version,
            lastUpdated: engineState.lastUpdated,
            cellCount: engineState.cellCount
          }
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error initializing engine:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to initialize HyperFormula engine',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }
}
