import { Request, Response } from 'express';
import { SpreadsheetService } from '../services/spreadsheet.service';
import { CollaborationService } from '../services/collaboration.service';
import { ApiResponse, SpreadsheetData, BatchUpdate } from '../types/spreadsheet.types';

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

      // Calculate formulas
      const calculatedValues = await SpreadsheetService.calculateFormulas(id);
      
      // Add calculated values to cells
      spreadsheetData.cells = spreadsheetData.cells.map((cell: any) => {
        if (cell.formula && calculatedValues.has(cell.cell_id)) {
          cell.computed_value = String(calculatedValues.get(cell.cell_id));
        }
        return cell;
      });

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

  // Update cell
  static async updateCell(req: Request, res: Response): Promise<void> {
    try {
      const { id, cellId } = req.params;
      const [row, col] = this.parseCellId(cellId);
      
      const cell = await SpreadsheetService.updateCell(
        id,
        { ...req.body, row, col },
        req.body.user_id
      );

      // Recalculate formulas if needed
      if (req.body.formula || req.body.value) {
        await SpreadsheetService.calculateFormulas(id);
      }

      const response: ApiResponse<any> = {
        success: true,
        data: cell
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

  // Batch update cells
  static async batchUpdateCells(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const batchUpdate: BatchUpdate = {
        spreadsheet_id: id,
        updates: req.body.updates,
        user_id: req.body.user_id
      };

      const cells = await SpreadsheetService.batchUpdateCells(batchUpdate);

      // Recalculate formulas
      await SpreadsheetService.calculateFormulas(id);

      const response: ApiResponse<any> = {
        success: true,
        data: cells
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

  // Calculate formulas
  static async calculateFormulas(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const results = await SpreadsheetService.calculateFormulas(id);
      
      const response: ApiResponse<any> = {
        success: true,
        data: Array.from(results.entries()).map(([cellId, value]: [string, any]) => ({
          cell_id: cellId,
          computed_value: value
        }))
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
    const col = this.letterToColumn(match[1]);
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
}
