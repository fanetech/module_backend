import { Knex } from 'knex';
import { Spreadsheet } from './Spreadsheet.model';
import { Cell } from './Cell.model';
import { CollaborationSession } from './CollaborationSession.model';
import { CellHistory } from './CellHistory.model';
import { NamedRange } from './NamedRange.model';
import { SpreadsheetMetadata } from './SpreadsheetMetadata.model';
import { logger } from '../utils/logger';

/**
 * Table Manager for handling database schema creation
 * This centralizes all table creation/deletion operations
 * instead of using migrations for table creation
 */
export class TableManager {
  private db: Knex;
  
  constructor(db: Knex) {
    this.db = db;
  }

  /**
   * Create all tables in the correct order (respecting foreign key constraints)
   */
  async createAllTables(): Promise<void> {
    logger.info('🔨 Starting table creation process...');
    
    try {
      // 1. Create parent tables first (no foreign key dependencies)
      await this.createSpreadsheetsTable();
      
      // 2. Create child tables (depend on spreadsheets)
      await this.createCellsTable();
      await this.createCollaborationSessionsTable();
      await this.createCellHistoryTable();
      await this.createNamedRangesTable();
      await this.createSpreadsheetMetadataTable();
      
      logger.info('✅ All tables created successfully!');
    } catch (error) {
      logger.error('❌ Error creating tables:', error);
      throw error;
    }
  }

  /**
   * Drop all tables in reverse order (respecting foreign key constraints)
   */
  async dropAllTables(): Promise<void> {
    logger.info('🗑️ Starting table deletion process...');
    
    try {
      // Drop child tables first
      await this.dropSpreadsheetMetadataTable();
      await this.dropNamedRangesTable();
      await this.dropCellHistoryTable();
      await this.dropCollaborationSessionsTable();
      await this.dropCellsTable();
      
      // Drop parent table last
      await this.dropSpreadsheetsTable();
      
      logger.info('✅ All tables dropped successfully!');
    } catch (error) {
      logger.error('❌ Error dropping tables:', error);
      throw error;
    }
  }

  /**
   * Check if all required tables exist
   */
  async checkAllTables(): Promise<{
    allExist: boolean;
    tables: { [key: string]: boolean };
  }> {
    const tables = {
      spreadsheets: await Spreadsheet.tableExists(this.db),
      cells: await Cell.tableExists(this.db),
      collaboration_sessions: await CollaborationSession.tableExists(this.db),
      cell_history: await this.checkCellHistoryTable(),
      named_ranges: await this.checkNamedRangesTable(),
      spreadsheet_metadata: await this.checkSpreadsheetMetadataTable()
    };
    
    const allExist = Object.values(tables).every(exists => exists);
    
    return { allExist, tables };
  }

  /**
   * Create only missing tables
   */
  async ensureTablesExist(): Promise<void> {
    logger.info('🔍 Checking and creating missing tables...');
    
    const { allExist, tables } = await this.checkAllTables();
    
    if (allExist) {
      logger.info('✅ All tables already exist');
      return;
    }
    
    // Create missing tables in order
    if (!tables.spreadsheets) await this.createSpreadsheetsTable();
    if (!tables.cells) await this.createCellsTable();
    if (!tables.collaboration_sessions) await this.createCollaborationSessionsTable();
    if (!tables.cell_history) await this.createCellHistoryTable();
    if (!tables.named_ranges) await this.createNamedRangesTable();
    if (!tables.spreadsheet_metadata) await this.createSpreadsheetMetadataTable();
    
    logger.info('✅ Missing tables created successfully');
  }

  // Individual table creation methods
  
  private async createSpreadsheetsTable(): Promise<void> {
    await Spreadsheet.createTable(this.db);
  }
  
  private async createCellsTable(): Promise<void> {
    await Cell.createTable(this.db);
  }
  
  private async createCollaborationSessionsTable(): Promise<void> {
    await CollaborationSession.createTable(this.db);
  }
  
  private async createCellHistoryTable(): Promise<void> {
    const exists = await this.db.schema.hasTable('cell_history');
    
    if (!exists) {
      await this.db.schema.createTable('cell_history', (table) => {
        table.uuid('id').primary().defaultTo(this.db.raw('NEWID()'));
        table.uuid('cell_id').notNullable();
        table.uuid('spreadsheet_id').notNullable();
        table.string('cell_reference', 10).notNullable();
        table.text('old_value');
        table.text('new_value');
        table.text('old_formula');
        table.text('new_formula');
        table.string('change_type', 50); // 'value', 'formula', 'format'
        table.string('changed_by', 255);
        table.timestamp('changed_at').defaultTo(this.db.fn.now());
        table.json('metadata'); // Additional info about the change
        
        // Foreign key
        table.foreign('spreadsheet_id').references('id').inTable('spreadsheets').onDelete('CASCADE');
        
        // Indexes
        table.index(['spreadsheet_id', 'changed_at']);
        table.index(['cell_reference']);
      });
      
      logger.info(`✅ Table 'cell_history' created successfully`);
    } else {
      logger.info(`ℹ️ Table 'cell_history' already exists`);
    }
  }
  
  private async createNamedRangesTable(): Promise<void> {
    const exists = await this.db.schema.hasTable('named_ranges');
    
    if (!exists) {
      await this.db.schema.createTable('named_ranges', (table) => {
        table.uuid('id').primary().defaultTo(this.db.raw('NEWID()'));
        table.uuid('spreadsheet_id').notNullable();
        table.string('name', 100).notNullable();
        table.string('range', 50).notNullable(); // Like 'A1:D10'
        table.text('description');
        table.timestamp('created_at').defaultTo(this.db.fn.now());
        table.string('created_by', 255);
        
        // Foreign key
        table.foreign('spreadsheet_id').references('id').inTable('spreadsheets').onDelete('CASCADE');
        
        // Unique constraint
        table.unique(['spreadsheet_id', 'name']);
      });
      
      logger.info(`✅ Table 'named_ranges' created successfully`);
    } else {
      logger.info(`ℹ️ Table 'named_ranges' already exists`);
    }
  }
  
  private async createSpreadsheetMetadataTable(): Promise<void> {
    const exists = await this.db.schema.hasTable('spreadsheet_metadata');
    
    if (!exists) {
      await this.db.schema.createTable('spreadsheet_metadata', (table) => {
        table.uuid('id').primary().defaultTo(this.db.raw('NEWID()'));
        table.uuid('spreadsheet_id').notNullable();
        table.string('key', 100).notNullable();
        table.text('value');
        table.string('data_type', 50).defaultTo('string');
        table.timestamp('created_at').defaultTo(this.db.fn.now());
        table.timestamp('updated_at').defaultTo(this.db.fn.now());
        
        // Foreign key
        table.foreign('spreadsheet_id').references('id').inTable('spreadsheets').onDelete('CASCADE');
        
        // Unique constraint
        table.unique(['spreadsheet_id', 'key']);
      });
      
      logger.info(`✅ Table 'spreadsheet_metadata' created successfully`);
    } else {
      logger.info(`ℹ️ Table 'spreadsheet_metadata' already exists`);
    }
  }

  // Individual table dropping methods
  
  private async dropSpreadsheetsTable(): Promise<void> {
    await Spreadsheet.dropTable(this.db);
  }
  
  private async dropCellsTable(): Promise<void> {
    await Cell.dropTable(this.db);
  }
  
  private async dropCollaborationSessionsTable(): Promise<void> {
    await CollaborationSession.dropTable(this.db);
  }
  
  private async dropCellHistoryTable(): Promise<void> {
    const exists = await this.db.schema.hasTable('cell_history');
    
    if (exists) {
      await this.db.schema.dropTable('cell_history');
      logger.info(`✅ Table 'cell_history' dropped successfully`);
    } else {
      logger.info(`ℹ️ Table 'cell_history' does not exist`);
    }
  }
  
  private async dropNamedRangesTable(): Promise<void> {
    const exists = await this.db.schema.hasTable('named_ranges');
    
    if (exists) {
      await this.db.schema.dropTable('named_ranges');
      logger.info(`✅ Table 'named_ranges' dropped successfully`);
    } else {
      logger.info(`ℹ️ Table 'named_ranges' does not exist`);
    }
  }
  
  private async dropSpreadsheetMetadataTable(): Promise<void> {
    const exists = await this.db.schema.hasTable('spreadsheet_metadata');
    
    if (exists) {
      await this.db.schema.dropTable('spreadsheet_metadata');
      logger.info(`✅ Table 'spreadsheet_metadata' dropped successfully`);
    } else {
      logger.info(`ℹ️ Table 'spreadsheet_metadata' does not exist`);
    }
  }

  // Check methods for tables without model classes
  
  private async checkCellHistoryTable(): Promise<boolean> {
    return await this.db.schema.hasTable('cell_history');
  }
  
  private async checkNamedRangesTable(): Promise<boolean> {
    return await this.db.schema.hasTable('named_ranges');
  }
  
  private async checkSpreadsheetMetadataTable(): Promise<boolean> {
    return await this.db.schema.hasTable('spreadsheet_metadata');
  }

  /**
   * Get database schema information
   */
  async getSchemaInfo(): Promise<any> {
    const { tables } = await this.checkAllTables();
    
    const tableInfo: any = {};
    
    for (const [tableName, exists] of Object.entries(tables)) {
      if (exists) {
        try {
          const [countResult] = await this.db(tableName).count('* as count');
          const columns = await this.db.raw(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
          `, [tableName]);
          
          tableInfo[tableName] = {
            exists: true,
            rowCount: parseInt(countResult.count as string),
            columns: columns.map((col: any) => ({
              name: col.COLUMN_NAME,
              type: col.DATA_TYPE,
              nullable: col.IS_NULLABLE === 'YES'
            }))
          };
        } catch (error) {
          tableInfo[tableName] = {
            exists: true,
            error: 'Could not fetch table info'
          };
        }
      } else {
        tableInfo[tableName] = {
          exists: false
        };
      }
    }
    
    return tableInfo;
  }
}

export default TableManager;
