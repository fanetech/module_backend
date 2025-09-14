#!/usr/bin/env node

import DatabaseConnection from './src/database/connection';
import { logger } from './src/utils/logger';
import { config } from 'dotenv';

// Load environment variables
config();

/**
 * Database CLI Tool
 * Provides command-line interface for database operations
 */
class DatabaseCLI {
  private args: string[];
  private command: string;

  constructor() {
    this.args = process.argv.slice(2);
    this.command = this.args[0] || 'help';
  }

  async run(): Promise<void> {
    try {
      switch (this.command) {
        case 'migrate':
        case 'migrate:latest':
          await this.migrate();
          break;
        
        case 'migrate:rollback':
        case 'rollback':
          await this.rollback();
          break;
        
        case 'seed':
        case 'seed:run':
          await this.seed();
          break;
        
        case 'reset':
          await this.reset();
          break;
        
        case 'fresh':
          await this.fresh();
          break;
        
        case 'status':
          await this.status();
          break;
        
        case 'health':
          await this.healthCheck();
          break;
        
        case 'stats':
          await this.stats();
          break;
        
        case 'help':
        default:
          this.showHelp();
          break;
      }
    } catch (error) {
      logger.error('CLI Error:', error);
      process.exit(1);
    } finally {
      await DatabaseConnection.close();
    }
  }

  private async migrate(): Promise<void> {
    console.log('🔄 Running database migrations...\n');
    await DatabaseConnection.runMigrations();
    console.log('\n✅ Migrations completed successfully!');
  }

  private async rollback(): Promise<void> {
    console.log('🔄 Rolling back database migrations...\n');
    await DatabaseConnection.rollbackMigrations();
    console.log('\n✅ Rollback completed successfully!');
  }

  private async seed(): Promise<void> {
    console.log('🌱 Seeding database with sample data...\n');
    await DatabaseConnection.runSeeds();
    console.log('\n✅ Database seeded successfully!');
  }

  private async reset(): Promise<void> {
    console.log('⚠️  This will rollback all migrations and re-run them.');
    console.log('   All data will be lost!\n');
    
    if (!this.confirmAction()) {
      console.log('Operation cancelled.');
      return;
    }

    console.log('\n🔄 Resetting database...\n');
    await DatabaseConnection.rollbackMigrations();
    await DatabaseConnection.runMigrations();
    console.log('\n✅ Database reset completed!');
  }

  private async fresh(): Promise<void> {
    console.log('⚠️  This will reset the database and seed it with fresh data.');
    console.log('   All existing data will be lost!\n');
    
    if (!this.confirmAction()) {
      console.log('Operation cancelled.');
      return;
    }

    console.log('\n🔄 Creating fresh database...\n');
    await DatabaseConnection.rollbackMigrations();
    await DatabaseConnection.runMigrations();
    await DatabaseConnection.runSeeds();
    console.log('\n✅ Fresh database created and seeded!');
  }

  private async status(): Promise<void> {
    console.log('📊 Database Migration Status\n');
    
    const db = DatabaseConnection.getInstance();
    
    try {
      // Check if migrations table exists
      const tableExists = await db.schema.hasTable('knex_migrations');
      
      if (!tableExists) {
        console.log('❌ Migrations table does not exist.');
        console.log('   Run "npm run migrate" to create it.');
        return;
      }

      // Get completed migrations
      const completed = await db('knex_migrations')
        .select('name', 'batch', 'migration_time')
        .orderBy('batch', 'asc')
        .orderBy('migration_time', 'asc');

      if (completed.length === 0) {
        console.log('No migrations have been run yet.');
        return;
      }

      console.log('Completed Migrations:');
      console.log('─'.repeat(80));
      
      let currentBatch = -1;
      completed.forEach((migration: any) => {
        if (migration.batch !== currentBatch) {
          currentBatch = migration.batch;
          console.log(`\nBatch ${currentBatch}:`);
        }
        const timestamp = new Date(migration.migration_time).toLocaleString();
        console.log(`  ✅ ${migration.name} (${timestamp})`);
      });

      // Check for pending migrations
      const files = await db.migrate.list();
      const pending = files[1]; // Pending migrations
      
      if (pending.length > 0) {
        console.log('\n\nPending Migrations:');
        console.log('─'.repeat(80));
        pending.forEach((file: string) => {
          console.log(`  ⏳ ${file}`);
        });
      } else {
        console.log('\n\n✅ All migrations are up to date!');
      }
    } catch (error) {
      console.error('Error checking migration status:', error);
    }
  }

  private async healthCheck(): Promise<void> {
    console.log('🏥 Database Health Check\n');
    
    const health = await DatabaseConnection.healthCheck();
    
    if (health.status === 'healthy') {
      console.log('✅ Database is healthy!\n');
      if (health.details) {
        console.log('Details:');
        console.log(`  Tables: ${health.details.tables}`);
        console.log(`  Active Connections: ${health.details.connections}`);
        console.log(`  Version: ${health.details.version?.split('\n')[0]}`);
      }
    } else {
      console.log('❌ Database is unhealthy!\n');
      console.log(`Error: ${health.message}`);
      if (health.details?.error) {
        console.log(`Details: ${health.details.error}`);
      }
    }
  }

  private async stats(): Promise<void> {
    console.log('📊 Database Statistics\n');
    
    const db = DatabaseConnection.getInstance();
    
    try {
      // Get table statistics
      const tables = await db.raw(`
        SELECT 
          t.name AS table_name,
          p.rows AS row_count,
          SUM(a.total_pages) * 8 AS size_kb
        FROM 
          sys.tables t
        INNER JOIN 
          sys.indexes i ON t.object_id = i.object_id
        INNER JOIN 
          sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
        INNER JOIN 
          sys.allocation_units a ON p.partition_id = a.container_id
        WHERE 
          t.is_ms_shipped = 0
        GROUP BY 
          t.name, p.rows
        ORDER BY 
          p.rows DESC
      `);

      console.log('Table Statistics:');
      console.log('─'.repeat(60));
      console.log('Table Name'.padEnd(30) + 'Rows'.padEnd(15) + 'Size (KB)');
      console.log('─'.repeat(60));
      
      let totalRows = 0;
      let totalSize = 0;
      
      tables.forEach((table: any) => {
        const name = table.table_name.padEnd(30);
        const rows = table.row_count.toString().padEnd(15);
        const size = table.size_kb || 0;
        console.log(`${name}${rows}${size}`);
        totalRows += table.row_count;
        totalSize += size;
      });
      
      console.log('─'.repeat(60));
      console.log(`Total`.padEnd(30) + `${totalRows}`.padEnd(15) + `${totalSize}`);

      // Get index statistics
      const indexes = await db.raw(`
        SELECT 
          COUNT(*) as index_count
        FROM 
          sys.indexes
        WHERE 
          object_id IN (SELECT object_id FROM sys.tables WHERE is_ms_shipped = 0)
      `);

      console.log(`\nTotal Indexes: ${indexes[0].index_count}`);

      // Get collaboration statistics
      const [activeSessionsCount] = await db('collaboration_sessions')
        .where('is_active', true)
        .count('* as count');

      const [totalSpreadsheetsCount] = await db('spreadsheets')
        .where('is_active', true)
        .count('* as count');

      const [totalCellsCount] = await db('cells')
        .count('* as count');

      const [totalHistoryCount] = await db('cell_history')
        .count('* as count');

      console.log('\nApplication Statistics:');
      console.log('─'.repeat(60));
      console.log(`Active Spreadsheets: ${totalSpreadsheetsCount.count}`);
      console.log(`Total Cells: ${totalCellsCount.count}`);
      console.log(`Active Sessions: ${activeSessionsCount.count}`);
      console.log(`History Records: ${totalHistoryCount.count}`);

    } catch (error) {
      console.error('Error getting statistics:', error);
    }
  }

  private confirmAction(): boolean {
    // In a real CLI, you would use readline or inquirer for user input
    // For now, we'll check for a --force flag
    return this.args.includes('--force') || process.env.NODE_ENV === 'development';
  }

  private showHelp(): void {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║         Collaborative Spreadsheet Database CLI            ║
╚════════════════════════════════════════════════════════════╝

Usage: npm run db [command] [options]

Commands:
  migrate, migrate:latest   Run all pending migrations
  rollback                  Rollback the last batch of migrations
  seed, seed:run           Seed the database with sample data
  reset                    Rollback all migrations and re-run them
  fresh                    Reset database and seed with fresh data
  status                   Show migration status
  health                   Check database health
  stats                    Show database statistics
  help                     Show this help message

Options:
  --force                  Skip confirmation prompts (use with caution!)

Examples:
  npm run db migrate       # Run migrations
  npm run db seed          # Seed database
  npm run db fresh --force # Reset and seed without confirmation
  npm run db status        # Check migration status
  npm run db stats         # View database statistics

Environment Variables:
  NODE_ENV                 Set to 'production', 'staging', or 'development'
  DB_SERVER               Database server address
  DB_PORT                 Database port (default: 1433)
  DB_USER                 Database username
  DB_PASSWORD             Database password
  DB_NAME                 Database name

Current Environment: ${process.env.NODE_ENV || 'development'}
Database: ${process.env.DB_NAME || 'CollaborativeSpreadsheet'}
Server: ${process.env.DB_SERVER || 'localhost'}:${process.env.DB_PORT || '1433'}
    `);
  }
}

// Run the CLI
const cli = new DatabaseCLI();
cli.run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
