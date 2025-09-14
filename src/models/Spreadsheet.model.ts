import { Knex } from 'knex';

export interface ISpreadsheet {
  id?: string;
  name: string;
  description?: string | null;
  rows?: number;
  columns?: number;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
  created_by?: string | null;
  updated_by?: string | null;
}

export class Spreadsheet implements ISpreadsheet {
  id?: string;
  name: string;
  description?: string | null;
  rows: number;
  columns: number;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
  created_by?: string | null;
  updated_by?: string | null;

  constructor(data: ISpreadsheet) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description || null;
    this.rows = data.rows || 1000;
    this.columns = data.columns || 26;
    this.is_active = data.is_active !== undefined ? data.is_active : true;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.created_by = data.created_by || null;
    this.updated_by = data.updated_by || null;
  }

  static tableName = 'spreadsheets';

  /**
   * Create the spreadsheets table if it doesn't exist
   */
  static async createTable(db: Knex): Promise<void> {
    const exists = await db.schema.hasTable(this.tableName);
    
    if (!exists) {
      await db.schema.createTable(this.tableName, (table) => {
        table.uuid('id').primary().defaultTo(db.raw('NEWID()'));
        table.string('name', 255).notNullable();
        table.text('description');
        table.integer('rows').defaultTo(1000);
        table.integer('columns').defaultTo(26);
        table.boolean('is_active').defaultTo(true);
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
        table.string('created_by', 255);
        table.string('updated_by', 255);
        
        // Indexes
        table.index(['name']);
        table.index(['created_at']);
      });
      
      console.log(`✅ Table '${this.tableName}' created successfully`);
    } else {
      console.log(`ℹ️ Table '${this.tableName}' already exists`);
    }
  }

  /**
   * Drop the spreadsheets table
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
   * Find all spreadsheets
   */
  static async findAll(db: Knex, filters?: Partial<ISpreadsheet>): Promise<Spreadsheet[]> {
    const query = db(this.tableName).select('*');
    
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof ISpreadsheet] !== undefined) {
          query.where(key, filters[key as keyof ISpreadsheet]);
        }
      });
    }
    
    const results = await query;
    return results.map(row => new Spreadsheet(row));
  }

  /**
   * Find spreadsheet by ID
   */
  static async findById(db: Knex, id: string): Promise<Spreadsheet | null> {
    const result = await db(this.tableName)
      .where('id', id)
      .first();
    
    return result ? new Spreadsheet(result) : null;
  }

  /**
   * Find spreadsheet by name
   */
  static async findByName(db: Knex, name: string): Promise<Spreadsheet | null> {
    const result = await db(this.tableName)
      .where('name', name)
      .first();
    
    return result ? new Spreadsheet(result) : null;
  }

  /**
   * Create a new spreadsheet
   */
  static async create(db: Knex, data: ISpreadsheet): Promise<Spreadsheet> {
    const [result] = await db(this.tableName)
      .insert({
        ...data,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');
    
    return new Spreadsheet(result);
  }

  /**
   * Update a spreadsheet
   */
  static async update(db: Knex, id: string, data: Partial<ISpreadsheet>): Promise<Spreadsheet | null> {
    const [result] = await db(this.tableName)
      .where('id', id)
      .update({
        ...data,
        updated_at: new Date()
      })
      .returning('*');
    
    return result ? new Spreadsheet(result) : null;
  }

  /**
   * Delete a spreadsheet (soft delete by setting is_active to false)
   */
  static async softDelete(db: Knex, id: string): Promise<boolean> {
    const rowsAffected = await db(this.tableName)
      .where('id', id)
      .update({
        is_active: false,
        updated_at: new Date()
      });
    
    return rowsAffected > 0;
  }

  /**
   * Delete a spreadsheet (hard delete)
   */
  static async delete(db: Knex, id: string): Promise<boolean> {
    const rowsAffected = await db(this.tableName)
      .where('id', id)
      .delete();
    
    return rowsAffected > 0;
  }

  /**
   * Get active spreadsheets
   */
  static async getActive(db: Knex): Promise<Spreadsheet[]> {
    const results = await db(this.tableName)
      .where('is_active', true)
      .orderBy('updated_at', 'desc');
    
    return results.map(row => new Spreadsheet(row));
  }

  /**
   * Get spreadsheets created by a specific user
   */
  static async getByCreator(db: Knex, userId: string): Promise<Spreadsheet[]> {
    const results = await db(this.tableName)
      .where('created_by', userId)
      .orderBy('created_at', 'desc');
    
    return results.map(row => new Spreadsheet(row));
  }

  /**
   * Search spreadsheets by name or description
   */
  static async search(db: Knex, searchTerm: string): Promise<Spreadsheet[]> {
    const results = await db(this.tableName)
      .where('name', 'like', `%${searchTerm}%`)
      .orWhere('description', 'like', `%${searchTerm}%`)
      .orderBy('updated_at', 'desc');
    
    return results.map(row => new Spreadsheet(row));
  }

  /**
   * Get paginated spreadsheets
   */
  static async paginate(db: Knex, page: number = 1, limit: number = 10): Promise<{
    data: Spreadsheet[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;
    
    const [countResult] = await db(this.tableName).count('* as total');
    const total = parseInt(countResult.total as string);
    
    const results = await db(this.tableName)
      .select('*')
      .orderBy('updated_at', 'desc')
      .limit(limit)
      .offset(offset);
    
    return {
      data: results.map(row => new Spreadsheet(row)),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }
}
