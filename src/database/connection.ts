import knex, { Knex } from 'knex';
import knexConfig from '../../knexfile';
import { logger } from '../utils/logger';
import TableManager from '../models/TableManager';

/**
 * Database Connection Manager
 * Provides a singleton connection to the database using Knex
 */
class DatabaseConnection {
  private static instance: Knex | null = null;
  private static connectionAttempts = 0;
  private static maxRetries = 5;
  private static retryDelay = 5000; // 5 seconds

  /**
   * Get the database connection instance
   */
  static getInstance(): Knex {
    if (!this.instance) {
      const environment = process.env.NODE_ENV || 'development';
      const config = knexConfig[environment];
      
      if (!config) {
        throw new Error(`No database configuration found for environment: ${environment}`);
      }

      this.instance = knex(config);
      
      // Add connection event handlers
      this.setupEventHandlers();
      
      // Test the connection
      this.testConnection();
    }
    
    return this.instance;
  }

  /**
   * Setup database event handlers
   */
  private static setupEventHandlers(): void {
    if (!this.instance) return;

    // Log query errors
    this.instance.on('query-error', (error: any, obj: any) => {
      logger.error('Database query error:', {
        error: error.message,
        sql: obj.sql,
        bindings: obj.bindings
      });
    });

    // Log slow queries (queries taking more than 1 second)
    this.instance.on('query-response', (response: any, obj: any, builder: any) => {
      const queryTime = Date.now() - builder.startTime;
      if (queryTime > 1000) {
        logger.warn('Slow query detected:', {
          sql: obj.sql,
          duration: `${queryTime}ms`,
          bindings: obj.bindings
        });
      }
    });
  }

  /**
   * Test database connection and ensure tables exist
   */
  private static async testConnection(): Promise<void> {
    if (!this.instance) return;

    try {
      await this.instance.raw('SELECT 1');
      logger.info('✅ Database connection established successfully');
      this.connectionAttempts = 0;
      
      // Ensure tables exist on startup (if configured)
      if (process.env.AUTO_CREATE_TABLES !== 'false') {
        const tableManager = new TableManager(this.instance);
        await tableManager.ensureTablesExist();
      }
    } catch (error) {
      this.connectionAttempts++;
      logger.error(`❌ Database connection failed (attempt ${this.connectionAttempts}/${this.maxRetries}):`, error);
      
      if (this.connectionAttempts < this.maxRetries) {
        logger.info(`Retrying database connection in ${this.retryDelay / 1000} seconds...`);
        setTimeout(() => {
          this.testConnection();
        }, this.retryDelay);
      } else {
        logger.error('Max database connection retries reached. Please check your database configuration.');
        process.exit(1);
      }
    }
  }

  /**
   * Close database connection
   */
  static async close(): Promise<void> {
    if (this.instance) {
      await this.instance.destroy();
      this.instance = null;
      logger.info('Database connection closed');
    }
  }

  /**
   * Execute a transaction
   */
  static async transaction<T>(
    callback: (trx: Knex.Transaction) => Promise<T>
  ): Promise<T> {
    const db = this.getInstance();
    return await db.transaction(callback);
  }

  /**
   * Run migrations
   */
  static async runMigrations(): Promise<void> {
    const db = this.getInstance();
    try {
      const [batchNo, migrations] = await db.migrate.latest();
      if (migrations.length > 0) {
        logger.info(`✅ Ran ${migrations.length} migrations:`, migrations);
      } else {
        logger.info('✅ Database is already up to date');
      }
    } catch (error) {
      logger.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Rollback migrations
   */
  static async rollbackMigrations(): Promise<void> {
    const db = this.getInstance();
    try {
      const [batchNo, migrations] = await db.migrate.rollback();
      if (migrations.length > 0) {
        logger.info(`✅ Rolled back ${migrations.length} migrations:`, migrations);
      } else {
        logger.info('No migrations to rollback');
      }
    } catch (error) {
      logger.error('❌ Rollback failed:', error);
      throw error;
    }
  }

  /**
   * Run seeds
   */
  static async runSeeds(): Promise<void> {
    const db = this.getInstance();
    try {
      await db.seed.run();
      logger.info('✅ Database seeded successfully');
    } catch (error) {
      logger.error('❌ Seeding failed:', error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  static async getStats(): Promise<{
    tables: number;
    connections: number;
    version: string;
  }> {
    const db = this.getInstance();
    
    try {
      // Get table count
      const tables = await db.raw(`
        SELECT COUNT(*) as count 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE'
      `);
      
      // Get connection count
      const connections = await db.raw(`
        SELECT COUNT(*) as count 
        FROM sys.dm_exec_connections 
        WHERE session_id = @@SPID
      `);
      
      // Get SQL Server version
      const version = await db.raw('SELECT @@VERSION as version');
      
      return {
        tables: tables[0].count,
        connections: connections[0].count,
        version: version[0].version
      };
    } catch (error) {
      logger.error('Failed to get database stats:', error);
      return {
        tables: 0,
        connections: 0,
        version: 'Unknown'
      };
    }
  }

  /**
   * Health check
   */
  static async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    message: string;
    details?: any;
  }> {
    try {
      const db = this.getInstance();
      await db.raw('SELECT 1');
      
      const stats = await this.getStats();
      
      return {
        status: 'healthy',
        message: 'Database connection is healthy',
        details: stats
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: 'Database connection failed',
        details: {
          error: error.message
        }
      };
    }
  }
}

// Export the database instance getter
export const db = () => DatabaseConnection.getInstance();

// Export the DatabaseConnection class for advanced usage
export default DatabaseConnection;

// Export commonly used Knex types
export { Knex };