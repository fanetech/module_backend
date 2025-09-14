import { Knex } from 'knex';

export interface ISpreadsheetMetadata {
  id?: string;
  spreadsheet_id: string;
  key: string;
  value?: string | null;
  data_type?: string;
  created_at?: Date;
  updated_at?: Date;
}

export class SpreadsheetMetadata implements ISpreadsheetMetadata {
  id?: string;
  spreadsheet_id: string;
  key: string;
  value?: string | null;
  data_type: string;
  created_at?: Date;
  updated_at?: Date;

  constructor(data: ISpreadsheetMetadata) {
    this.id = data.id;
    this.spreadsheet_id = data.spreadsheet_id;
    this.key = data.key;
    this.value = data.value || null;
    this.data_type = data.data_type || 'string';
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static tableName = 'spreadsheet_metadata';

  /**
   * Common metadata keys
   */
  static CommonKeys = {
    // Display settings
    THEME: 'theme',
    GRIDLINES_VISIBLE: 'gridlines_visible',
    HEADERS_VISIBLE: 'headers_visible',
    FROZEN_ROWS: 'frozen_rows',
    FROZEN_COLUMNS: 'frozen_columns',
    DEFAULT_ROW_HEIGHT: 'default_row_height',
    DEFAULT_COLUMN_WIDTH: 'default_column_width',
    
    // Calculation settings
    CALCULATION_MODE: 'calculation_mode',
    RECALCULATION_INTERVAL: 'recalculation_interval',
    ITERATION_ENABLED: 'iteration_enabled',
    MAX_ITERATIONS: 'max_iterations',
    
    // Collaboration settings
    COLLABORATION_ENABLED: 'collaboration_enabled',
    REAL_TIME_SYNC: 'real_time_sync',
    AUTO_SAVE_ENABLED: 'auto_save_enabled',
    AUTO_SAVE_INTERVAL: 'auto_save_interval',
    
    // Security settings
    PROTECTED: 'protected',
    PASSWORD_HASH: 'password_hash',
    READ_ONLY: 'read_only',
    ALLOW_COMMENTS: 'allow_comments',
    
    // Version control
    VERSION: 'version',
    LAST_MAJOR_UPDATE: 'last_major_update',
    REVISION_NUMBER: 'revision_number',
    
    // Custom properties
    AUTHOR: 'author',
    COMPANY: 'company',
    CATEGORY: 'category',
    TAGS: 'tags',
    LANGUAGE: 'language',
    TIMEZONE: 'timezone'
  };

  /**
   * Data type definitions
   */
  static DataTypes = {
    STRING: 'string',
    NUMBER: 'number',
    BOOLEAN: 'boolean',
    DATE: 'date',
    JSON: 'json',
    ARRAY: 'array'
  };

  /**
   * Parse value based on data type
   */
  static parseValue(value: string | null, dataType: string): any {
    if (value === null || value === undefined) {
      return null;
    }

    switch (dataType) {
      case this.DataTypes.NUMBER:
        return parseFloat(value);
      case this.DataTypes.BOOLEAN:
        return value.toLowerCase() === 'true';
      case this.DataTypes.DATE:
        return new Date(value);
      case this.DataTypes.JSON:
      case this.DataTypes.ARRAY:
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      default:
        return value;
    }
  }

  /**
   * Serialize value based on data type
   */
  static serializeValue(value: any, dataType: string): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    switch (dataType) {
      case this.DataTypes.DATE:
        return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
      case this.DataTypes.JSON:
      case this.DataTypes.ARRAY:
        return JSON.stringify(value);
      default:
        return String(value);
    }
  }

  /**
   * Find metadata by ID
   */
  static async findById(db: Knex, id: string): Promise<SpreadsheetMetadata | null> {
    const result = await db(this.tableName)
      .where('id', id)
      .first();
    
    return result ? new SpreadsheetMetadata(result) : null;
  }

  /**
   * Get metadata value by key
   */
  static async getValue(db: Knex, spreadsheetId: string, key: string): Promise<any> {
    const result = await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .where('key', key)
      .first();
    
    if (!result) {
      return null;
    }
    
    return this.parseValue(result.value, result.data_type);
  }

  /**
   * Get all metadata for a spreadsheet
   */
  static async getBySpreadsheet(db: Knex, spreadsheetId: string): Promise<{ [key: string]: any }> {
    const results = await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId);
    
    const metadata: { [key: string]: any } = {};
    for (const row of results) {
      metadata[row.key] = this.parseValue(row.value, row.data_type);
    }
    
    return metadata;
  }

  /**
   * Set metadata value
   */
  static async setValue(
    db: Knex,
    spreadsheetId: string,
    key: string,
    value: any,
    dataType?: string
  ): Promise<SpreadsheetMetadata> {
    // Determine data type if not provided
    if (!dataType) {
      if (typeof value === 'boolean') {
        dataType = this.DataTypes.BOOLEAN;
      } else if (typeof value === 'number') {
        dataType = this.DataTypes.NUMBER;
      } else if (value instanceof Date) {
        dataType = this.DataTypes.DATE;
      } else if (Array.isArray(value)) {
        dataType = this.DataTypes.ARRAY;
      } else if (typeof value === 'object') {
        dataType = this.DataTypes.JSON;
      } else {
        dataType = this.DataTypes.STRING;
      }
    }
    
    const serializedValue = this.serializeValue(value, dataType);
    
    // Check if metadata exists
    const existing = await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .where('key', key)
      .first();
    
    if (existing) {
      // Update existing
      const [result] = await db(this.tableName)
        .where('id', existing.id)
        .update({
          value: serializedValue,
          data_type: dataType,
          updated_at: new Date()
        })
        .returning('*');
      
      return new SpreadsheetMetadata(result);
    } else {
      // Create new
      const [result] = await db(this.tableName)
        .insert({
          spreadsheet_id: spreadsheetId,
          key,
          value: serializedValue,
          data_type: dataType,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');
      
      return new SpreadsheetMetadata(result);
    }
  }

  /**
   * Set multiple metadata values
   */
  static async setMultiple(
    db: Knex,
    spreadsheetId: string,
    metadata: { [key: string]: { value: any; dataType?: string } }
  ): Promise<void> {
    for (const [key, data] of Object.entries(metadata)) {
      await this.setValue(db, spreadsheetId, key, data.value, data.dataType);
    }
  }

  /**
   * Delete metadata by key
   */
  static async deleteKey(db: Knex, spreadsheetId: string, key: string): Promise<boolean> {
    const rowsAffected = await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .where('key', key)
      .delete();
    
    return rowsAffected > 0;
  }

  /**
   * Delete all metadata for a spreadsheet
   */
  static async deleteBySpreadsheet(db: Knex, spreadsheetId: string): Promise<number> {
    return await db(this.tableName)
      .where('spreadsheet_id', spreadsheetId)
      .delete();
  }

  /**
   * Get display settings
   */
  static async getDisplaySettings(db: Knex, spreadsheetId: string): Promise<any> {
    const keys = [
      this.CommonKeys.THEME,
      this.CommonKeys.GRIDLINES_VISIBLE,
      this.CommonKeys.HEADERS_VISIBLE,
      this.CommonKeys.FROZEN_ROWS,
      this.CommonKeys.FROZEN_COLUMNS,
      this.CommonKeys.DEFAULT_ROW_HEIGHT,
      this.CommonKeys.DEFAULT_COLUMN_WIDTH
    ];
    
    const settings: any = {};
    for (const key of keys) {
      settings[key] = await this.getValue(db, spreadsheetId, key);
    }
    
    return settings;
  }

  /**
   * Set display settings
   */
  static async setDisplaySettings(db: Knex, spreadsheetId: string, settings: any): Promise<void> {
    const metadata: any = {};
    
    if (settings.theme !== undefined) {
      metadata[this.CommonKeys.THEME] = { value: settings.theme };
    }
    if (settings.gridlinesVisible !== undefined) {
      metadata[this.CommonKeys.GRIDLINES_VISIBLE] = { value: settings.gridlinesVisible, dataType: this.DataTypes.BOOLEAN };
    }
    if (settings.headersVisible !== undefined) {
      metadata[this.CommonKeys.HEADERS_VISIBLE] = { value: settings.headersVisible, dataType: this.DataTypes.BOOLEAN };
    }
    if (settings.frozenRows !== undefined) {
      metadata[this.CommonKeys.FROZEN_ROWS] = { value: settings.frozenRows, dataType: this.DataTypes.NUMBER };
    }
    if (settings.frozenColumns !== undefined) {
      metadata[this.CommonKeys.FROZEN_COLUMNS] = { value: settings.frozenColumns, dataType: this.DataTypes.NUMBER };
    }
    if (settings.defaultRowHeight !== undefined) {
      metadata[this.CommonKeys.DEFAULT_ROW_HEIGHT] = { value: settings.defaultRowHeight, dataType: this.DataTypes.NUMBER };
    }
    if (settings.defaultColumnWidth !== undefined) {
      metadata[this.CommonKeys.DEFAULT_COLUMN_WIDTH] = { value: settings.defaultColumnWidth, dataType: this.DataTypes.NUMBER };
    }
    
    await this.setMultiple(db, spreadsheetId, metadata);
  }

  /**
   * Get collaboration settings
   */
  static async getCollaborationSettings(db: Knex, spreadsheetId: string): Promise<any> {
    const keys = [
      this.CommonKeys.COLLABORATION_ENABLED,
      this.CommonKeys.REAL_TIME_SYNC,
      this.CommonKeys.AUTO_SAVE_ENABLED,
      this.CommonKeys.AUTO_SAVE_INTERVAL
    ];
    
    const settings: any = {};
    for (const key of keys) {
      settings[key] = await this.getValue(db, spreadsheetId, key);
    }
    
    return settings;
  }

  /**
   * Set collaboration settings
   */
  static async setCollaborationSettings(db: Knex, spreadsheetId: string, settings: any): Promise<void> {
    const metadata: any = {};
    
    if (settings.collaborationEnabled !== undefined) {
      metadata[this.CommonKeys.COLLABORATION_ENABLED] = { value: settings.collaborationEnabled, dataType: this.DataTypes.BOOLEAN };
    }
    if (settings.realTimeSync !== undefined) {
      metadata[this.CommonKeys.REAL_TIME_SYNC] = { value: settings.realTimeSync, dataType: this.DataTypes.BOOLEAN };
    }
    if (settings.autoSaveEnabled !== undefined) {
      metadata[this.CommonKeys.AUTO_SAVE_ENABLED] = { value: settings.autoSaveEnabled, dataType: this.DataTypes.BOOLEAN };
    }
    if (settings.autoSaveInterval !== undefined) {
      metadata[this.CommonKeys.AUTO_SAVE_INTERVAL] = { value: settings.autoSaveInterval, dataType: this.DataTypes.NUMBER };
    }
    
    await this.setMultiple(db, spreadsheetId, metadata);
  }

  /**
   * Copy metadata from one spreadsheet to another
   */
  static async copyToSpreadsheet(
    db: Knex,
    sourceSpreadsheetId: string,
    targetSpreadsheetId: string,
    excludeKeys?: string[]
  ): Promise<void> {
    const sourceMetadata = await db(this.tableName)
      .where('spreadsheet_id', sourceSpreadsheetId);
    
    const toInsert = sourceMetadata
      .filter(m => !excludeKeys || !excludeKeys.includes(m.key))
      .map(m => ({
        spreadsheet_id: targetSpreadsheetId,
        key: m.key,
        value: m.value,
        data_type: m.data_type,
        created_at: new Date(),
        updated_at: new Date()
      }));
    
    if (toInsert.length > 0) {
      await db.batchInsert(this.tableName, toInsert, 100);
    }
  }
}
