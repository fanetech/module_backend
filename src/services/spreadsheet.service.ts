import { db, Knex } from '../database/connection';
import { 
  Spreadsheet, 
  Cell, 
  CollaborationSession, 
  CellHistory, 
  NamedRange, 
  SpreadsheetMetadata 
} from '../models';
import { logger } from '../utils/logger';

/**
 * Spreadsheet Service
 * Demonstrates how to use the entity models for spreadsheet operations
 */
export class SpreadsheetService {
  /**
   * Get all spreadsheets
   */
  static async getAllSpreadsheets(): Promise<Spreadsheet[]> {
    const database = db();
    
    try {
      return await Spreadsheet.getActive(database);
    } catch (error) {
      logger.error('Failed to get all spreadsheets:', error);
      throw error;
    }
  }

  /**
   * Get spreadsheet by ID with all data
   */
  static async getSpreadsheetById(spreadsheetId: string): Promise<any> {
    const database = db();
    
    try {
      const data = await this.getSpreadsheetWithData(spreadsheetId);
      
      if (!data.spreadsheet) {
        return null;
      }

      // Format response for controller
      return {
        id: data.spreadsheet.id,
        name: data.spreadsheet.name,
        description: data.spreadsheet.description,
        rows: data.spreadsheet.rows,
        columns: data.spreadsheet.columns,
        cells: data.cells,
        named_ranges: data.namedRanges,
        metadata: data.metadata,
        created_at: data.spreadsheet.created_at,
        updated_at: data.spreadsheet.updated_at
      };
    } catch (error) {
      logger.error('Failed to get spreadsheet by ID:', error);
      throw error;
    }
  }

  /**
   * Update spreadsheet details
   */
  static async updateSpreadsheet(spreadsheetId: string, data: Partial<Spreadsheet>): Promise<Spreadsheet | null> {
    const database = db();
    
    try {
      return await Spreadsheet.update(database, spreadsheetId, data);
    } catch (error) {
      logger.error('Failed to update spreadsheet:', error);
      throw error;
    }
  }

  /**
   * Delete spreadsheet
   */
  static async deleteSpreadsheet(spreadsheetId: string): Promise<boolean> {
    const database = db();
    
    try {
      return await Spreadsheet.delete(database, spreadsheetId);
    } catch (error) {
      logger.error('Failed to delete spreadsheet:', error);
      throw error;
    }
  }

  /**
   * Update a single cell
   */
  static async updateCell(spreadsheetId: string, cellData: any, userId: string): Promise<Cell> {
    const database = db();
    
    try {
      const cell = await Cell.upsert(database, {
        spreadsheet_id: spreadsheetId,
        row: cellData.row,
        col: cellData.col,
        cell_id: Cell.generateCellId(cellData.row, cellData.col),
        value: cellData.value,
        formula: cellData.formula,
        format: cellData.format,
        data_type: cellData.data_type,
        updated_by: userId
      });

      // Record history
      await CellHistory.recordChange(database, {
        cell_id: cell.id!,
        spreadsheet_id: spreadsheetId,
        cell_reference: cell.cell_id,
        new_value: cellData.value,
        new_formula: cellData.formula,
        change_type: cellData.formula ? 'formula' : 'value',
        changed_by: userId
      });

      return cell;
    } catch (error) {
      logger.error('Failed to update cell:', error);
      throw error;
    }
  }

  /**
   * Batch update cells
   */
  static async batchUpdateCells(batchUpdate: any): Promise<Cell[]> {
    const database = db();
    
    try {
      const cellsToUpdate = batchUpdate.updates.map((update: any) => ({
        spreadsheet_id: batchUpdate.spreadsheet_id,
        row: update.row,
        col: update.col,
        cell_id: Cell.generateCellId(update.row, update.col),
        value: update.value,
        formula: update.formula,
        format: update.format,
        data_type: update.data_type,
        updated_by: batchUpdate.user_id
      }));

      await Cell.bulkUpsert(database, cellsToUpdate);
      
      // Return updated cells
      const cellIds = cellsToUpdate.map((c: any) => c.cell_id);
      const updatedCells = await database('cells')
        .where('spreadsheet_id', batchUpdate.spreadsheet_id)
        .whereIn('cell_id', cellIds);
      
      return updatedCells.map((row: any) => new Cell(row));
    } catch (error) {
      logger.error('Failed to batch update cells:', error);
      throw error;
    }
  }

  /**
   * Get cells in a specific range
   */
  static async getCellsInRange(
    spreadsheetId: string,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
  ): Promise<Cell[]> {
    const database = db();
    
    try {
      return await Cell.getRange(database, spreadsheetId, startRow, startCol, endRow, endCol);
    } catch (error) {
      logger.error('Failed to get cells in range:', error);
      throw error;
    }
  }

  /**
   * Calculate formulas (placeholder - actual implementation would use HyperFormula)
   */
  static async calculateFormulas(spreadsheetId: string): Promise<Map<string, any>> {
    const database = db();
    const results = new Map<string, any>();
    
    try {
      // Get all cells with formulas
      const formulaCells = await Cell.getFormulaCells(database, spreadsheetId);
      
      // This is a placeholder - in reality, you'd use HyperFormula here
      for (const cell of formulaCells) {
        if (cell.formula) {
          // Simple placeholder calculation
          let computedValue = 'CALCULATED';
          
          // Handle simple formulas as examples
          if (cell.formula.startsWith('=SUM')) {
            computedValue = '0'; // Placeholder
          } else if (cell.formula.startsWith('=AVERAGE')) {
            computedValue = '0'; // Placeholder
          } else if (cell.formula.includes('-')) {
            computedValue = '0'; // Placeholder
          }
          
          results.set(cell.cell_id, computedValue);
          
          // Update computed value in database
          await database('cells')
            .where('id', cell.id)
            .update({ computed_value: computedValue });
        }
      }
      
      return results;
    } catch (error) {
      logger.error('Failed to calculate formulas:', error);
      throw error;
    }
  }
  /**
   * Create a new spreadsheet with initial setup
   */
  static async createSpreadsheet(data: {
    name: string;
    description?: string;
    rows?: number;
    columns?: number;
    createdBy: string;
    metadata?: { [key: string]: any };
  }): Promise<Spreadsheet> {
    const database = db();
    
    try {
      // Start a transaction
      const result = await database.transaction(async (trx: Knex.Transaction) => {
        // Create the spreadsheet
        const spreadsheet = await Spreadsheet.create(trx, {
          name: data.name,
          description: data.description,
          rows: data.rows || 1000,
          columns: data.columns || 26,
          created_by: data.createdBy,
          updated_by: data.createdBy
        });

        // Set default metadata
        const defaultMetadata = {
          theme: 'default',
          gridlines_visible: true,
          headers_visible: true,
          collaboration_enabled: true,
          real_time_sync: true,
          auto_save_enabled: true,
          auto_save_interval: 30000,
          ...data.metadata
        };

        for (const [key, value] of Object.entries(defaultMetadata)) {
          await SpreadsheetMetadata.setValue(trx, spreadsheet.id!, key, value);
        }

        // Create header row cells (optional)
        const headerCells = [];
        for (let col = 0; col < Math.min(10, spreadsheet.columns); col++) {
          const cellId = Cell.generateCellId(0, col);
          headerCells.push({
            spreadsheet_id: spreadsheet.id!,
            row: 0,
            col: col,
            cell_id: cellId,
            value: `Column ${cellId.replace('1', '')}`,
            format: { bold: true, backgroundColor: '#E0E0E0' },
            data_type: 'text',
            updated_by: data.createdBy
          });
        }

        if (headerCells.length > 0) {
          await Cell.bulkUpsert(trx, headerCells);
        }

        logger.info(`Created spreadsheet: ${spreadsheet.name} (${spreadsheet.id})`);
        return spreadsheet;
      });

      return result;
    } catch (error) {
      logger.error('Failed to create spreadsheet:', error);
      throw error;
    }
  }

  /**
   * Get spreadsheet with all its data
   */
  static async getSpreadsheetWithData(spreadsheetId: string): Promise<{
    spreadsheet: Spreadsheet | null;
    cells: Cell[];
    namedRanges: NamedRange[];
    metadata: { [key: string]: any };
    activeSessions: CollaborationSession[];
  }> {
    const database = db();
    
    try {
      const [spreadsheet, cells, namedRanges, metadata, activeSessions] = await Promise.all([
        Spreadsheet.findById(database, spreadsheetId),
        Cell.getBySpreadsheet(database, spreadsheetId),
        NamedRange.getBySpreadsheet(database, spreadsheetId),
        SpreadsheetMetadata.getBySpreadsheet(database, spreadsheetId),
        CollaborationSession.getActiveSessionsBySpreadsheet(database, spreadsheetId)
      ]);

      return {
        spreadsheet,
        cells,
        namedRanges,
        metadata,
        activeSessions
      };
    } catch (error) {
      logger.error('Failed to get spreadsheet data:', error);
      throw error;
    }
  }

  /**
   * Update cells in bulk with history tracking
   */
  static async updateCells(data: {
    spreadsheetId: string;
    userId: string;
    changes: Array<{
      row: number;
      col: number;
      value?: string | null;
      formula?: string | null;
      format?: any;
    }>;
  }): Promise<void> {
    const database = db();
    
    try {
      await database.transaction(async (trx: Knex.Transaction) => {
        const historyRecords = [];
        const cellsToUpdate = [];

        for (const change of data.changes) {
          const cellId = Cell.generateCellId(change.row, change.col);
          
          // Get existing cell data for history
          const existingCell = await Cell.findByPosition(
            trx, 
            data.spreadsheetId, 
            change.row, 
            change.col
          );

          // Prepare cell update
          cellsToUpdate.push({
            spreadsheet_id: data.spreadsheetId,
            row: change.row,
            col: change.col,
            cell_id: cellId,
            value: change.value,
            formula: change.formula,
            format: change.format,
            updated_by: data.userId
          });

          // Prepare history record if cell exists and has changes
          if (existingCell) {
            const hasValueChange = change.value !== undefined && change.value !== existingCell.value;
            const hasFormulaChange = change.formula !== undefined && change.formula !== existingCell.formula;
            
            if (hasValueChange || hasFormulaChange) {
              historyRecords.push({
                cell_id: existingCell.id!,
                spreadsheet_id: data.spreadsheetId,
                cell_reference: cellId,
                old_value: existingCell.value,
                new_value: change.value,
                old_formula: existingCell.formula,
                new_formula: change.formula,
                change_type: hasFormulaChange ? 'formula' : 'value',
                changed_by: data.userId,
                metadata: { bulk_update: true }
              });
            }
          }
        }

        // Update cells
        await Cell.bulkUpsert(trx, cellsToUpdate);

        // Record history
        if (historyRecords.length > 0) {
          await CellHistory.bulkRecordChanges(trx, historyRecords);
        }

        // Update spreadsheet's updated_at
        await Spreadsheet.update(trx, data.spreadsheetId, {
          updated_by: data.userId
        });

        logger.info(`Updated ${cellsToUpdate.length} cells in spreadsheet ${data.spreadsheetId}`);
      });
    } catch (error) {
      logger.error('Failed to update cells:', error);
      throw error;
    }
  }

  /**
   * Join a collaboration session
   */
  static async joinCollaboration(data: {
    spreadsheetId: string;
    userId: string;
    userName: string;
    socketId: string;
  }): Promise<CollaborationSession> {
    const database = db();
    
    try {
      const session = await CollaborationSession.create(database, {
        spreadsheet_id: data.spreadsheetId,
        user_id: data.userId,
        user_name: data.userName,
        socket_id: data.socketId
      });

      logger.info(`User ${data.userName} joined spreadsheet ${data.spreadsheetId}`);
      return session;
    } catch (error) {
      logger.error('Failed to join collaboration:', error);
      throw error;
    }
  }

  /**
   * Leave a collaboration session
   */
  static async leaveCollaboration(socketId: string): Promise<void> {
    const database = db();
    
    try {
      await CollaborationSession.deactivateBySocketId(database, socketId);
      logger.info(`Socket ${socketId} left collaboration`);
    } catch (error) {
      logger.error('Failed to leave collaboration:', error);
      throw error;
    }
  }

  /**
   * Update cursor position
   */
  static async updateCursorPosition(data: {
    sessionId: string;
    row: number;
    col: number;
  }): Promise<void> {
    const database = db();
    
    try {
      await CollaborationSession.updateCursor(database, data.sessionId, {
        row: data.row,
        col: data.col
      });
    } catch (error) {
      logger.error('Failed to update cursor position:', error);
      throw error;
    }
  }

  /**
   * Create a named range
   */
  static async createNamedRange(data: {
    spreadsheetId: string;
    name: string;
    range: string;
    description?: string;
    createdBy: string;
  }): Promise<NamedRange> {
    const database = db();
    
    try {
      const namedRange = await NamedRange.create(database, {
        spreadsheet_id: data.spreadsheetId,
        name: data.name,
        range: data.range,
        description: data.description,
        created_by: data.createdBy
      });

      logger.info(`Created named range '${data.name}' in spreadsheet ${data.spreadsheetId}`);
      return namedRange;
    } catch (error) {
      logger.error('Failed to create named range:', error);
      throw error;
    }
  }

  /**
   * Get cell history for undo functionality
   */
  static async getCellHistory(
    spreadsheetId: string,
    cellId?: string,
    limit?: number
  ): Promise<CellHistory[]> {
    const database = db();
    
    try {
      if (cellId) {
        return await CellHistory.getByCellReference(
          database,
          spreadsheetId,
          cellId,
          limit || 50
        );
      } else {
        return await CellHistory.getBySpreadsheet(
          database,
          spreadsheetId,
          { limit: limit || 100 }
        );
      }
    } catch (error) {
      logger.error('Failed to get cell history:', error);
      throw error;
    }
  }

  /**
   * Clone a spreadsheet
   */
  static async cloneSpreadsheet(data: {
    sourceId: string;
    newName: string;
    userId: string;
    includeData?: boolean;
    includeNamedRanges?: boolean;
    includeMetadata?: boolean;
  }): Promise<Spreadsheet> {
    const database = db();
    
    try {
      return await database.transaction(async (trx: Knex.Transaction) => {
        // Get source spreadsheet
        const source = await Spreadsheet.findById(trx, data.sourceId);
        if (!source) {
          throw new Error('Source spreadsheet not found');
        }

        // Create new spreadsheet
        const newSpreadsheet = await Spreadsheet.create(trx, {
          name: data.newName,
          description: `Cloned from: ${source.name}`,
          rows: source.rows,
          columns: source.columns,
          created_by: data.userId,
          updated_by: data.userId
        });

        // Clone cells if requested
        if (data.includeData) {
          const sourceCells = await Cell.getBySpreadsheet(trx, data.sourceId);
          const cellsToInsert = sourceCells.map(cell => ({
            ...cell,
            id: undefined,
            spreadsheet_id: newSpreadsheet.id!,
            created_at: undefined,
            updated_at: undefined,
            updated_by: data.userId
          }));

          if (cellsToInsert.length > 0) {
            await Cell.bulkUpsert(trx, cellsToInsert);
          }
        }

        // Clone named ranges if requested
        if (data.includeNamedRanges) {
        await NamedRange.copyToSpreadsheet(
        trx, 
        data.sourceId, 
        newSpreadsheet.id!, 
        data.userId
        );
        }

        // Clone metadata if requested
        if (data.includeMetadata) {
        await SpreadsheetMetadata.copyToSpreadsheet(
        trx, 
        data.sourceId, 
        newSpreadsheet.id!,
        ['password_hash'] // Exclude sensitive metadata
        );
        }

        logger.info(`Cloned spreadsheet ${data.sourceId} to ${newSpreadsheet.id}`);
        return newSpreadsheet;
      });
    } catch (error) {
      logger.error('Failed to clone spreadsheet:', error);
      throw error;
    }
  }

  /**
   * Get spreadsheet statistics
   */
  static async getStatistics(spreadsheetId: string): Promise<any> {
    const database = db();
    
    try {
      const [
        cellCount,
        formulaCount,
        sessionStats,
        recentChanges,
        mostEditedCells,
        mostActiveUsers
      ] = await Promise.all([
        database('cells').where('spreadsheet_id', spreadsheetId).count('* as count'),
        database('cells').where('spreadsheet_id', spreadsheetId).whereNotNull('formula').count('* as count'),
        CollaborationSession.getStatsBySpreadsheet(database, spreadsheetId),
        CellHistory.getRecent(database, spreadsheetId, 60),
        CellHistory.getMostEditedCells(database, spreadsheetId, 5),
        CellHistory.getMostActiveUsers(database, spreadsheetId, 5)
      ]);

      return {
        cells: {
          total: cellCount[0].count,
          withFormulas: formulaCount[0].count
        },
        collaboration: sessionStats,
        activity: {
          recentChangesCount: recentChanges.length,
          mostEditedCells,
          mostActiveUsers
        }
      };
    } catch (error) {
      logger.error('Failed to get spreadsheet statistics:', error);
      throw error;
    }
  }

  /**
   * Clean up old data
   */
  static async cleanup(options: {
    inactiveSessionMinutes?: number;
    historyDaysToKeep?: number;
  } = {}): Promise<{
    sessionsCleanedUp: number;
    historyDeleted: number;
  }> {
    const database = db();
    
    try {
      const sessionsCleanedUp = await CollaborationSession.cleanupInactive(
        database, 
        options.inactiveSessionMinutes || 30
      );
      
      const historyDeleted = await CellHistory.cleanupOld(
        database, 
        options.historyDaysToKeep || 30
      );

      logger.info(`Cleanup completed: ${sessionsCleanedUp} sessions, ${historyDeleted} history records`);
      
      return {
        sessionsCleanedUp,
        historyDeleted
      };
    } catch (error) {
      logger.error('Failed to run cleanup:', error);
      throw error;
    }
  }
}