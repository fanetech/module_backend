import { Knex } from 'knex';

export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
}

export interface ICell {
  id?: string;
  spreadsheet_id: string;
  row: number;
  col: number;
  cell_id: string;
  value?: string | null;
  formula?: string | null;
  computed_value?: string | null;
  format?: CellFormat | null;
  data_type?: string | null;
  is_locked?: boolean;
  created_at?: Date;
  updated_at?: Date;
  updated_by?: string | null;
}

export class Cell implements ICell {
  id?: string;
  spreadsheet_id: string;
  row: number;
  col: number;
  cell_id: string;
  value?: string | null;
  formula?: string | null;
  computed_value?: string | null;
  format?: CellFormat | null;
  data_type?: string | null;
  is_locked: boolean;
  created_at?: Date;
  updated_at?: Date;
  updated_by?: string | null;

  constructor(data: ICell) {
    this.id = data.id;
    this.spreadsheet_id = data.spreadsheet_id;
    this.row = data.row;
    this.col = data.col;
    this.cell_id = data.cell_id;
    this.value = data.value || null;
    this.formula = data.formula || null;
    this.computed_value = data.computed_value || null;
    this.format = data.format || null;
    this.data_type = data.data_type || null;
    this.is_locked = data.is_locked || false;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.updated_by = data.updated_by || null;
  }

  static tableName = 'cells';

  /**
   * Create the cells table if it doesn't exist
   */
  static async createTable(db: Knex): Promise<void> {
    const exists = await db.schema.hasTable(this.tableName);
    
    if (!exists) {
      await db.schema.createTable(this.tableName, (table) => {
        table.uuid('id').primary().defaultTo(db.raw('NEWID()'));
        table.uuid('spreadsheet_id').notNullable();
        table.integer('row').notNullable();
        table.integer('col').notNullable();
        table.string('cell_id', 10).notNullable(); // Like 'A1', 'B2', etc.
        table.text('value');
        table.text('formula');
        table.text('computed_value');
        table.json('format'); // Store formatting as JSON
        table.string('data_type', 50); // number, text, date, boolean, formula
        table.boolean('is_locked').defaultTo(false);
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
        table.string('updated_by', 255);
        
        // Foreign key
        table.foreign('spreadsheet_id').references('id').inTable('spreadsheets').onDelete('CASCADE');
        
        // Indexes
        table.unique(['spreadsheet_id', 'row', 'col']);
        table.index(['spreadsheet_id', 'cell_id']);
      });
      
      console.log(`✅ Table '${this.tableName}' created successfully`);
    } else {
      console.log(`ℹ️ Table '${this.tableName}' already exists`);
    }
  }

  /**
   * Drop the cells table
   */
  static async dropTable(db: Knex): Promise<void> {
    const exists = await db.schema.hasTable(this.tableName);
    
    if (exists) {
      await db.schema.dropTable(this.tableName);
      console.log(`✅ Table '${this.tableName}' dropped successfully`);
    } else {
      console.log(`ℹ️ Table '${this.tableName}' does not exist`);
    }
  }

  /**
   * Check if the table exists
   */
  static async tableExists(db: Knex): Promise<boolean> {
    return await db.schema.hasTable(this.tableName);
  }

  /**
   * Convert column number to letter (0 -> A, 1 -> B, etc.)
   */
  static colToLetter(col: number): string {
    let letter = '';
    while (col >= 0) {
      letter = String.fromCharCode((col % 26) + 65) + letter;
      col = Math.floor(col / 26) - 1;
    }
    return letter;
  }

  /**
   * Convert letter to column number (A -> 0, B -> 1, etc.)
   */
  static letterToCol(letter: string): number {
    let col = 0;
    for (let i = 0; i < letter.length; i++) {
      col = col * 26 + (letter.charCodeAt(i) - 64);
    }
    return col - 1;
  }

  /**
   * Generate cell ID from row and column (e.g., row 0, col 0 -> "A1")
   */
  static generateCellId(row: number, col: number): string {
    return `${this.colToLetter(col)}${row + 1}`;
  }

  /**
   * Parse cell ID to get row and column
   */
  static parseCellId(cellId: string): { row: number; col: number } {
    const match = cellId.match(/^([A-Z]+)(\d+)$/);
    if (!match) {
      throw new Error(`Invalid cell ID: ${cellId}`);
    }
    const col = this.letterToCol(match[1]);
    const row = parseInt(match[2]) - 1;
    return { row, col };
  }

  /**
   * Find cell by spreadsheet ID and cell ID
   */
  static async findByCell(db: Knex, spreadsheetId: string, cellId: string): Promise<Cell | null> {
    const result = await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .where('cell_id', cellId)
      .first();
    
    return result ? new Cell(result) : null;
  }

  /**
   * Find cell by spreadsheet ID, row, and column
   */
  static async findByPosition(db: Knex, spreadsheetId: string, row: number, col: number): Promise<Cell | null> {
    const result = await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .where('row', row)
      .where('col', col)
      .first();
    
    return result ? new Cell(result) : null;
  }

  /**
   * Get all cells for a spreadsheet
   */
  static async getBySpreadsheet(db: Knex, spreadsheetId: string): Promise<Cell[]> {
    const results = await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .orderBy('row', 'asc')
      .orderBy('col', 'asc');
    
    return results.map(row => new Cell(row));
  }

  /**
   * Get cells in a range
   */
  static async getRange(
    db: Knex,
    spreadsheetId: string,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
  ): Promise<Cell[]> {
    const results = await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .whereBetween('row', [startRow, endRow])
      .whereBetween('col', [startCol, endCol])
      .orderBy('row', 'asc')
      .orderBy('col', 'asc');
    
    return results.map(row => new Cell(row));
  }

  /**
   * Create or update a cell
   */
  static async upsert(db: Knex, data: ICell): Promise<Cell> {
    const existing = await this.findByPosition(db, data.spreadsheet_id, data.row, data.col);
    
    if (existing) {
      const [result] = await db(this.tableName)
        .where('id', existing.id)
        .update({
          ...data,
          updated_at: new Date()
        })
        .returning('*');
      
      return new Cell(result);
    } else {
      const cellId = data.cell_id || this.generateCellId(data.row, data.col);
      const [result] = await db(this.tableName)
        .insert({
          ...data,
          cell_id: cellId,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');
      
      return new Cell(result);
    }
  }

  /**
   * Bulk upsert cells
   */
  static async bulkUpsert(db: Knex, cells: ICell[]): Promise<void> {
    // Build a query to find existing cells
    let existingQuery = db(this.tableName).select('id', 'spreadsheet_id', 'row', 'col');
    
    // Add WHERE conditions for each cell
    if (cells.length > 0) {
      existingQuery = existingQuery.where(function() {
        for (const cell of cells) {
          this.orWhere({
            spreadsheet_id: cell.spreadsheet_id,
            row: cell.row,
            col: cell.col
          });
        }
      });
    }

    const existing = await existingQuery;

    const existingMap = new Map(
      existing.map(e => [`${e.spreadsheet_id}-${e.row}-${e.col}`, e.id])
    );

    const toUpdate: any[] = [];
    const toInsert: any[] = [];

    for (const cell of cells) {
      const key = `${cell.spreadsheet_id}-${cell.row}-${cell.col}`;
      const existingId = existingMap.get(key);

      if (existingId) {
        toUpdate.push({
          ...cell,
          id: existingId,
          updated_at: new Date()
        });
      } else {
        toInsert.push({
          ...cell,
          cell_id: cell.cell_id || this.generateCellId(cell.row, cell.col),
          created_at: new Date(),
          updated_at: new Date()
        });
      }
    }

    // Perform batch operations
    if (toInsert.length > 0) {
      await db.batchInsert(this.tableName, toInsert, 100);
    }

    if (toUpdate.length > 0) {
      // Update in batches
      for (const cell of toUpdate) {
        await db(this.tableName)
          .where('id', cell.id)
          .update(cell);
      }
    }
  }

  /**
   * Delete a cell
   */
  static async delete(db: Knex, id: string): Promise<boolean> {
    const rowsAffected = await db(this.tableName)
      .where('id', id)
      .delete();
    
    return rowsAffected > 0;
  }

  /**
   * Delete cells in a range
   */
  static async deleteRange(
    db: Knex,
    spreadsheetId: string,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
  ): Promise<number> {
    return await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .whereBetween('row', [startRow, endRow])
      .whereBetween('col', [startCol, endCol])
      .delete();
  }

  /**
   * Clear cell values but keep formatting
   */
  static async clearValues(db: Knex, spreadsheetId: string, cellIds: string[]): Promise<void> {
    await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .whereIn('cell_id', cellIds)
      .update({
        value: null,
        formula: null,
        computed_value: null,
        updated_at: new Date()
      });
  }

  /**
   * Lock/unlock cells
   */
  static async setLockStatus(db: Knex, spreadsheetId: string, cellIds: string[], isLocked: boolean): Promise<void> {
    await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .whereIn('cell_id', cellIds)
      .update({
        is_locked: isLocked,
        updated_at: new Date()
      });
  }

  /**
   * Get cells with formulas
   */
  static async getFormulaCells(db: Knex, spreadsheetId: string): Promise<Cell[]> {
    const results = await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .whereNotNull('formula')
      .orderBy('row', 'asc')
      .orderBy('col', 'asc');
    
    return results.map(row => new Cell(row));
  }
}
