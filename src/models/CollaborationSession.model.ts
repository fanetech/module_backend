import { Knex } from 'knex';

export interface CursorPosition {
  row: number;
  col: number;
}

export interface SelectionRange {
  start: {
    row: number;
    col: number;
  };
  end: {
    row: number;
    col: number;
  };
}

export interface ICollaborationSession {
  id?: string;
  spreadsheet_id: string;
  user_id: string;
  user_name?: string | null;
  socket_id?: string | null;
  color?: string | null;
  is_active?: boolean;
  cursor_position?: CursorPosition | null;
  selection_range?: SelectionRange | null;
  joined_at?: Date;
  last_activity?: Date;
}

export class CollaborationSession implements ICollaborationSession {
  id?: string;
  spreadsheet_id: string;
  user_id: string;
  user_name?: string | null;
  socket_id?: string | null;
  color?: string | null;
  is_active: boolean;
  cursor_position?: CursorPosition | null;
  selection_range?: SelectionRange | null;
  joined_at?: Date;
  last_activity?: Date;

  constructor(data: ICollaborationSession) {
    this.id = data.id;
    this.spreadsheet_id = data.spreadsheet_id;
    this.user_id = data.user_id;
    this.user_name = data.user_name || null;
    this.socket_id = data.socket_id || null;
    this.color = data.color || null;
    this.is_active = data.is_active !== undefined ? data.is_active : true;
    this.cursor_position = data.cursor_position || null;
    this.selection_range = data.selection_range || null;
    this.joined_at = data.joined_at;
    this.last_activity = data.last_activity;
  }

  static tableName = 'collaboration_sessions';

  /**
   * Create the collaboration_sessions table if it doesn't exist
   */
  static async createTable(db: Knex): Promise<void> {
    const exists = await db.schema.hasTable(this.tableName);
    
    if (!exists) {
      await db.schema.createTable(this.tableName, (table) => {
        table.uuid('id').primary().defaultTo(db.raw('NEWID()'));
        table.uuid('spreadsheet_id').notNullable();
        table.string('user_id', 255).notNullable();
        table.string('user_name', 255);
        table.string('socket_id', 255);
        table.string('color', 7); // Hex color for cursor
        table.boolean('is_active').defaultTo(true);
        table.json('cursor_position'); // {row: 0, col: 0}
        table.json('selection_range'); // {start: {row, col}, end: {row, col}}
        table.timestamp('joined_at').defaultTo(db.fn.now());
        table.timestamp('last_activity').defaultTo(db.fn.now());
        
        // Foreign key
        table.foreign('spreadsheet_id').references('id').inTable('spreadsheets').onDelete('CASCADE');
        
        // Indexes
        table.index(['spreadsheet_id', 'is_active']);
        table.index(['socket_id']);
      });
      
      console.log(`✅ Table '${this.tableName}' created successfully`);
    } else {
      console.log(`ℹ️ Table '${this.tableName}' already exists`);
    }
  }

  /**
   * Drop the collaboration_sessions table
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
   * Generate a random color for user cursor
   */
  static generateUserColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
      '#F8B739', '#52B788', '#E76F51', '#A8DADC', '#E9C46A'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Find session by ID
   */
  static async findById(db: Knex, id: string): Promise<CollaborationSession | null> {
    const result = await db(this.tableName)
      .where('id', id)
      .first();
    
    return result ? new CollaborationSession(result) : null;
  }

  /**
   * Find session by socket ID
   */
  static async findBySocketId(db: Knex, socketId: string): Promise<CollaborationSession | null> {
    const result = await db(this.tableName)
      .where('socket_id', socketId)
      .where('is_active', true)
      .first();
    
    return result ? new CollaborationSession(result) : null;
  }

  /**
   * Find active session for user in spreadsheet
   */
  static async findActiveSession(db: Knex, spreadsheetId: string, userId: string): Promise<CollaborationSession | null> {
    const result = await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .where('user_id', userId)
      .where('is_active', true)
      .first();
    
    return result ? new CollaborationSession(result) : null;
  }

  /**
   * Get all active sessions for a spreadsheet
   */
  static async getActiveSessionsBySpreadsheet(db: Knex, spreadsheetId: string): Promise<CollaborationSession[]> {
    const results = await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .where('is_active', true)
      .orderBy('joined_at', 'asc');
    
    return results.map(row => new CollaborationSession(row));
  }

  /**
   * Get all sessions for a user
   */
  static async getSessionsByUser(db: Knex, userId: string, activeOnly: boolean = true): Promise<CollaborationSession[]> {
    let query = db(this.tableName).where('user_id', userId);
    
    if (activeOnly) {
      query = query.where('is_active', true);
    }
    
    const results = await query.orderBy('last_activity', 'desc');
    return results.map(row => new CollaborationSession(row));
  }

  /**
   * Create a new session
   */
  static async create(db: Knex, data: ICollaborationSession): Promise<CollaborationSession> {
    // First, deactivate any existing active sessions for this user in this spreadsheet
    await db(this.tableName)
      .where('spreadsheet_id', data.spreadsheet_id)
      .where('user_id', data.user_id)
      .where('is_active', true)
      .update({ is_active: false });

    // Create new session
    const [result] = await db(this.tableName)
      .insert({
        ...data,
        color: data.color || this.generateUserColor(),
        is_active: true,
        joined_at: new Date(),
        last_activity: new Date()
      })
      .returning('*');
    
    return new CollaborationSession(result);
  }

  /**
   * Update session activity
   */
  static async updateActivity(db: Knex, sessionId: string): Promise<void> {
    await db(this.tableName)
      .where('id', sessionId)
      .update({
        last_activity: new Date()
      });
  }

  /**
   * Update cursor position
   */
  static async updateCursor(db: Knex, sessionId: string, position: CursorPosition): Promise<void> {
    await db(this.tableName)
      .where('id', sessionId)
      .update({
        cursor_position: JSON.stringify(position),
        last_activity: new Date()
      });
  }

  /**
   * Update selection range
   */
  static async updateSelection(db: Knex, sessionId: string, range: SelectionRange | null): Promise<void> {
    await db(this.tableName)
      .where('id', sessionId)
      .update({
        selection_range: range ? JSON.stringify(range) : null,
        last_activity: new Date()
      });
  }

  /**
   * Update socket ID
   */
  static async updateSocketId(db: Knex, sessionId: string, socketId: string): Promise<void> {
    await db(this.tableName)
      .where('id', sessionId)
      .update({
        socket_id: socketId,
        last_activity: new Date()
      });
  }

  /**
   * Deactivate session
   */
  static async deactivate(db: Knex, sessionId: string): Promise<void> {
    await db(this.tableName)
      .where('id', sessionId)
      .update({
        is_active: false,
        socket_id: null,
        last_activity: new Date()
      });
  }

  /**
   * Deactivate session by socket ID
   */
  static async deactivateBySocketId(db: Knex, socketId: string): Promise<void> {
    await db(this.tableName)
      .where('socket_id', socketId)
      .update({
        is_active: false,
        socket_id: null,
        last_activity: new Date()
      });
  }

  /**
   * Clean up inactive sessions (older than specified minutes)
   */
  static async cleanupInactive(db: Knex, inactiveMinutes: number = 30): Promise<number> {
    const cutoffTime = new Date(Date.now() - inactiveMinutes * 60 * 1000);
    
    return await db(this.tableName)
      .where('is_active', true)
      .where('last_activity', '<', cutoffTime)
      .update({
        is_active: false,
        socket_id: null
      });
  }

  /**
   * Get session statistics for a spreadsheet
   */
  static async getStatsBySpreadsheet(db: Knex, spreadsheetId: string): Promise<{
    totalSessions: number;
    activeSessions: number;
    uniqueUsers: number;
  }> {
    const [totalResult] = await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .count('* as total');
    
    const [activeResult] = await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .where('is_active', true)
      .count('* as active');
    
    const uniqueUsersResult = await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .countDistinct('user_id as unique_users');
    
    return {
      totalSessions: parseInt(totalResult.total as string),
      activeSessions: parseInt(activeResult.active as string),
      uniqueUsers: parseInt(uniqueUsersResult[0].unique_users as string)
    };
  }

  /**
   * Get recently active spreadsheets
   */
  static async getRecentlyActiveSpreadsheets(db: Knex, limit: number = 10): Promise<string[]> {
    const results = await db(this.tableName)
      .select('spreadsheet_id')
      .max('last_activity as max_activity')
      .where('is_active', true)
      .groupBy('spreadsheet_id')
      .orderBy('max_activity', 'desc')
      .limit(limit);
    
    return results.map(r => r.spreadsheet_id);
  }
}
