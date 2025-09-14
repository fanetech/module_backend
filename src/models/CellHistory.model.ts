import { Knex } from 'knex';

export interface ICellHistory {
  id?: string;
  cell_id: string;
  spreadsheet_id: string;
  cell_reference: string;
  old_value?: string | null;
  new_value?: string | null;
  old_formula?: string | null;
  new_formula?: string | null;
  change_type?: string | null;
  changed_by?: string | null;
  changed_at?: Date;
  metadata?: any | null;
}

export class CellHistory implements ICellHistory {
  id?: string;
  cell_id: string;
  spreadsheet_id: string;
  cell_reference: string;
  old_value?: string | null;
  new_value?: string | null;
  old_formula?: string | null;
  new_formula?: string | null;
  change_type?: string | null;
  changed_by?: string | null;
  changed_at?: Date;
  metadata?: any | null;

  constructor(data: ICellHistory) {
    this.id = data.id;
    this.cell_id = data.cell_id;
    this.spreadsheet_id = data.spreadsheet_id;
    this.cell_reference = data.cell_reference;
    this.old_value = data.old_value || null;
    this.new_value = data.new_value || null;
    this.old_formula = data.old_formula || null;
    this.new_formula = data.new_formula || null;
    this.change_type = data.change_type || null;
    this.changed_by = data.changed_by || null;
    this.changed_at = data.changed_at;
    this.metadata = data.metadata || null;
  }

  static tableName = 'cell_history';

  /**
   * Change types enum
   */
  static ChangeTypes = {
    VALUE: 'value',
    FORMULA: 'formula',
    FORMAT: 'format',
    DELETE: 'delete',
    CREATE: 'create',
    CLEAR: 'clear'
  };

  /**
   * Record a cell change
   */
  static async recordChange(db: Knex, data: ICellHistory): Promise<CellHistory> {
    const [result] = await db(this.tableName)
      .insert({
        ...data,
        changed_at: new Date()
      })
      .returning('*');
    
    return new CellHistory(result);
  }

  /**
   * Bulk record changes
   */
  static async bulkRecordChanges(db: Knex, changes: ICellHistory[]): Promise<void> {
    const records = changes.map(change => ({
      ...change,
      changed_at: new Date()
    }));
    
    await db.batchInsert(this.tableName, records, 100);
  }

  /**
   * Get history for a specific cell
   */
  static async getByCellReference(
    db: Knex,
    spreadsheetId: string,
    cellReference: string,
    limit?: number
  ): Promise<CellHistory[]> {
    let query = db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .where('cell_reference', cellReference)
      .orderBy('changed_at', 'desc');
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const results = await query;
    return results.map(row => new CellHistory(row));
  }

  /**
   * Get history for a spreadsheet
   */
  static async getBySpreadsheet(
    db: Knex,
    spreadsheetId: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      userId?: string;
      changeType?: string;
    }
  ): Promise<CellHistory[]> {
    let query = db(this.tableName)
      .where('spreadsheet_id', spreadsheetId);
    
    if (options?.startDate) {
      query = query.where('changed_at', '>=', options.startDate);
    }
    
    if (options?.endDate) {
      query = query.where('changed_at', '<=', options.endDate);
    }
    
    if (options?.userId) {
      query = query.where('changed_by', options.userId);
    }
    
    if (options?.changeType) {
      query = query.where('change_type', options.changeType);
    }
    
    query = query.orderBy('changed_at', 'desc');
    
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    
    if (options?.offset) {
      query = query.offset(options.offset);
    }
    
    const results = await query;
    return results.map(row => new CellHistory(row));
  }

  /**
   * Get history by user
   */
  static async getByUser(
    db: Knex,
    userId: string,
    spreadsheetId?: string,
    limit?: number
  ): Promise<CellHistory[]> {
    let query = db(this.tableName)
      .where('changed_by', userId);
    
    if (spreadsheetId) {
      query = query.where('spreadsheet_id', spreadsheetId);
    }
    
    query = query.orderBy('changed_at', 'desc');
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const results = await query;
    return results.map(row => new CellHistory(row));
  }

  /**
   * Get recent changes
   */
  static async getRecent(
    db: Knex,
    spreadsheetId: string,
    minutes: number = 60
  ): Promise<CellHistory[]> {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    
    const results = await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .where('changed_at', '>=', cutoffTime)
      .orderBy('changed_at', 'desc');
    
    return results.map(row => new CellHistory(row));
  }

  /**
   * Get undo stack for a user
   */
  static async getUndoStack(
    db: Knex,
    spreadsheetId: string,
    userId: string,
    limit: number = 50
  ): Promise<CellHistory[]> {
    const results = await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .where('changed_by', userId)
      .orderBy('changed_at', 'desc')
      .limit(limit);
    
    return results.map(row => new CellHistory(row));
  }

  /**
   * Clean up old history records
   */
  static async cleanupOld(db: Knex, daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    return await db(this.tableName)
      .where('changed_at', '<', cutoffDate)
      .delete();
  }

  /**
   * Get change statistics
   */
  static async getStatistics(
    db: Knex,
    spreadsheetId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      groupBy?: 'hour' | 'day' | 'week' | 'month';
    }
  ): Promise<any[]> {
    let query = db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .select(db.raw('COUNT(*) as total_changes'))
      .select(db.raw('COUNT(DISTINCT changed_by) as unique_users'))
      .select(db.raw('COUNT(DISTINCT cell_reference) as unique_cells'));
    
    if (options?.startDate) {
      query = query.where('changed_at', '>=', options.startDate);
    }
    
    if (options?.endDate) {
      query = query.where('changed_at', '<=', options.endDate);
    }
    
    // Add grouping if specified
    if (options?.groupBy) {
      let dateFormat: string;
      switch (options.groupBy) {
        case 'hour':
          dateFormat = "FORMAT(changed_at, 'yyyy-MM-dd HH:00')";
          break;
        case 'day':
          dateFormat = "FORMAT(changed_at, 'yyyy-MM-dd')";
          break;
        case 'week':
          dateFormat = "FORMAT(DATEADD(week, DATEDIFF(week, 0, changed_at), 0), 'yyyy-MM-dd')";
          break;
        case 'month':
          dateFormat = "FORMAT(changed_at, 'yyyy-MM')";
          break;
        default:
          dateFormat = "FORMAT(changed_at, 'yyyy-MM-dd')";
      }
      
      query = query
        .select(db.raw(`${dateFormat} as period`))
        .groupBy(db.raw(dateFormat))
        .orderBy('period', 'asc');
    }
    
    return await query;
  }

  /**
   * Get most edited cells
   */
  static async getMostEditedCells(
    db: Knex,
    spreadsheetId: string,
    limit: number = 10
  ): Promise<any[]> {
    return await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .select('cell_reference')
      .count('* as edit_count')
      .groupBy('cell_reference')
      .orderBy('edit_count', 'desc')
      .limit(limit);
  }

  /**
   * Get most active users
   */
  static async getMostActiveUsers(
    db: Knex,
    spreadsheetId: string,
    limit: number = 10
  ): Promise<any[]> {
    return await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .select('changed_by')
      .count('* as change_count')
      .groupBy('changed_by')
      .orderBy('change_count', 'desc')
      .limit(limit);
  }

  /**
   * Restore cell to previous state
   */
  static async restoreToPreviousState(
    db: Knex,
    historyId: string
  ): Promise<{ cellId: string; oldValue: string | null; oldFormula: string | null }> {
    const history = await db(this.tableName)
      .where('id', historyId)
      .first();
    
    if (!history) {
      throw new Error('History record not found');
    }
    
    return {
      cellId: history.cell_id,
      oldValue: history.old_value,
      oldFormula: history.old_formula
    };
  }
}
