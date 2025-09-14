import { Knex } from 'knex';

export interface INamedRange {
  id?: string;
  spreadsheet_id: string;
  name: string;
  range: string;
  description?: string | null;
  created_at?: Date;
  created_by?: string | null;
}

export class NamedRange implements INamedRange {
  id?: string;
  spreadsheet_id: string;
  name: string;
  range: string;
  description?: string | null;
  created_at?: Date;
  created_by?: string | null;

  constructor(data: INamedRange) {
    this.id = data.id;
    this.spreadsheet_id = data.spreadsheet_id;
    this.name = data.name;
    this.range = data.range;
    this.description = data.description || null;
    this.created_at = data.created_at;
    this.created_by = data.created_by || null;
  }

  static tableName = 'named_ranges';

  /**
   * Parse range string (e.g., "A1:D10") to get start and end positions
   */
  static parseRange(range: string): {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } {
    const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!match) {
      throw new Error(`Invalid range format: ${range}`);
    }
    
    const startCol = this.letterToCol(match[1]);
    const startRow = parseInt(match[2]) - 1;
    const endCol = this.letterToCol(match[3]);
    const endRow = parseInt(match[4]) - 1;
    
    return { startRow, startCol, endRow, endCol };
  }

  /**
   * Convert letter to column number
   */
  static letterToCol(letter: string): number {
    let col = 0;
    for (let i = 0; i < letter.length; i++) {
      col = col * 26 + (letter.charCodeAt(i) - 64);
    }
    return col - 1;
  }

  /**
   * Convert column number to letter
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
   * Format range from coordinates
   */
  static formatRange(startRow: number, startCol: number, endRow: number, endCol: number): string {
    const startColLetter = this.colToLetter(startCol);
    const endColLetter = this.colToLetter(endCol);
    return `${startColLetter}${startRow + 1}:${endColLetter}${endRow + 1}`;
  }

  /**
   * Validate range name
   */
  static validateName(name: string): boolean {
    // Range names must start with a letter or underscore
    // Can contain letters, numbers, underscores, and periods
    // Cannot be a cell reference (like A1)
    const validNamePattern = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;
    const cellReferencePattern = /^[A-Z]+\d+$/;
    
    return validNamePattern.test(name) && !cellReferencePattern.test(name);
  }

  /**
   * Find named range by ID
   */
  static async findById(db: Knex, id: string): Promise<NamedRange | null> {
    const result = await db(this.tableName)
      .where('id', id)
      .first();
    
    return result ? new NamedRange(result) : null;
  }

  /**
   * Find named range by name in a spreadsheet
   */
  static async findByName(db: Knex, spreadsheetId: string, name: string): Promise<NamedRange | null> {
    const result = await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .where('name', name)
      .first();
    
    return result ? new NamedRange(result) : null;
  }

  /**
   * Get all named ranges for a spreadsheet
   */
  static async getBySpreadsheet(db: Knex, spreadsheetId: string): Promise<NamedRange[]> {
    const results = await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .orderBy('name', 'asc');
    
    return results.map(row => new NamedRange(row));
  }

  /**
   * Create a new named range
   */
  static async create(db: Knex, data: INamedRange): Promise<NamedRange> {
    // Validate name
    if (!this.validateName(data.name)) {
      throw new Error(`Invalid range name: ${data.name}`);
    }
    
    // Validate range format
    try {
      this.parseRange(data.range);
    } catch (error) {
      throw new Error(`Invalid range format: ${data.range}`);
    }
    
    // Check if name already exists
    const existing = await this.findByName(db, data.spreadsheet_id, data.name);
    if (existing) {
      throw new Error(`Named range '${data.name}' already exists in this spreadsheet`);
    }
    
    const [result] = await db(this.tableName)
      .insert({
        ...data,
        created_at: new Date()
      })
      .returning('*');
    
    return new NamedRange(result);
  }

  /**
   * Update a named range
   */
  static async update(db: Knex, id: string, data: Partial<INamedRange>): Promise<NamedRange | null> {
    // Validate name if provided
    if (data.name && !this.validateName(data.name)) {
      throw new Error(`Invalid range name: ${data.name}`);
    }
    
    // Validate range format if provided
    if (data.range) {
      try {
        this.parseRange(data.range);
      } catch (error) {
        throw new Error(`Invalid range format: ${data.range}`);
      }
    }
    
    const [result] = await db(this.tableName)
      .where('id', id)
      .update(data)
      .returning('*');
    
    return result ? new NamedRange(result) : null;
  }

  /**
   * Delete a named range
   */
  static async delete(db: Knex, id: string): Promise<boolean> {
    const rowsAffected = await db(this.tableName)
      .where('id', id)
      .delete();
    
    return rowsAffected > 0;
  }

  /**
   * Delete all named ranges for a spreadsheet
   */
  static async deleteBySpreadsheet(db: Knex, spreadsheetId: string): Promise<number> {
    return await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .delete();
  }

  /**
   * Check if a cell is within a named range
   */
  static isCellInRange(cellRow: number, cellCol: number, range: string): boolean {
    try {
      const { startRow, startCol, endRow, endCol } = this.parseRange(range);
      return cellRow >= startRow && cellRow <= endRow &&
             cellCol >= startCol && cellCol <= endCol;
    } catch {
      return false;
    }
  }

  /**
   * Get all named ranges that include a specific cell
   */
  static async getRangesContainingCell(
    db: Knex,
    spreadsheetId: string,
    row: number,
    col: number
  ): Promise<NamedRange[]> {
    const allRanges = await this.getBySpreadsheet(db, spreadsheetId);
    
    return allRanges.filter(range => {
      return this.isCellInRange(row, col, range.range);
    });
  }

  /**
   * Expand range to include additional cells
   */
  static expandRange(currentRange: string, newCells: string): string {
    const current = this.parseRange(currentRange);
    const additional = this.parseRange(newCells);
    
    const startRow = Math.min(current.startRow, additional.startRow);
    const startCol = Math.min(current.startCol, additional.startCol);
    const endRow = Math.max(current.endRow, additional.endRow);
    const endCol = Math.max(current.endCol, additional.endCol);
    
    return this.formatRange(startRow, startCol, endRow, endCol);
  }

  /**
   * Get cells count in range
   */
  static getCellsCount(range: string): number {
    const { startRow, startCol, endRow, endCol } = this.parseRange(range);
    return (endRow - startRow + 1) * (endCol - startCol + 1);
  }

  /**
   * Search named ranges by name or description
   */
  static async search(db: Knex, spreadsheetId: string, searchTerm: string): Promise<NamedRange[]> {
    const results = await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .where(function() {
        this.where('name', 'like', `%${searchTerm}%`)
            .orWhere('description', 'like', `%${searchTerm}%`);
      })
      .orderBy('name', 'asc');
    
    return results.map(row => new NamedRange(row));
  }

  /**
   * Copy named ranges from one spreadsheet to another
   */
  static async copyToSpreadsheet(
    db: Knex,
    sourceSpreadsheetId: string,
    targetSpreadsheetId: string,
    userId?: string
  ): Promise<NamedRange[]> {
    const sourceRanges = await this.getBySpreadsheet(db, sourceSpreadsheetId);
    
    const copiedRanges: NamedRange[] = [];
    for (const range of sourceRanges) {
      const newRange = await this.create(db, {
        spreadsheet_id: targetSpreadsheetId,
        name: range.name,
        range: range.range,
        description: range.description,
        created_by: userId
      });
      copiedRanges.push(newRange);
    }
    
    return copiedRanges;
  }
}
