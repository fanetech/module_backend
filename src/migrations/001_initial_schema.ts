import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Check if we're using SQLite or SQL Server
  const isSQLite = knex.client.config.client === 'sqlite3';
  
  // Create spreadsheets table
  await knex.schema.createTable('spreadsheets', (table) => {
    if (isSQLite) {
      table.string('id').primary().defaultTo(knex.raw('(lower(hex(randomblob(16))))'));
    } else {
      table.uuid('id').primary().defaultTo(knex.raw('NEWID()'));
    }
    table.string('name', 255).notNullable();
    table.text('description').nullable();
    table.integer('row_count').defaultTo(100);
    table.integer('column_count').defaultTo(26);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.text('metadata').nullable(); // JSON column
  });

  // Create cells table
  await knex.schema.createTable('cells', (table) => {
    if (isSQLite) {
      table.string('id').primary().defaultTo(knex.raw('(lower(hex(randomblob(16))))'));
      table.string('spreadsheet_id').notNullable();
    } else {
      table.uuid('id').primary().defaultTo(knex.raw('NEWID()'));
      table.uuid('spreadsheet_id').notNullable();
    }
    table.integer('row_index').notNullable();
    table.integer('column_index').notNullable();
    table.string('cell_address', 10).notNullable();
    table.text('raw_value').nullable();
    table.text('calculated_value').nullable();
    table.text('formula').nullable();
    table.string('data_type', 20).nullable();
    table.text('format').nullable(); // JSON for cell formatting
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.integer('version').defaultTo(1);
    
    table.foreign('spreadsheet_id').references('id').inTable('spreadsheets').onDelete('CASCADE');
    table.unique(['spreadsheet_id', 'row_index', 'column_index']);
    table.index(['spreadsheet_id', 'cell_address'], 'idx_cell_address');
  });

  // Create change_history table
  await knex.schema.createTable('change_history', (table) => {
    if (isSQLite) {
      table.string('id').primary().defaultTo(knex.raw('(lower(hex(randomblob(16))))'));
      table.string('spreadsheet_id').notNullable();
      table.string('cell_id').notNullable();
    } else {
      table.uuid('id').primary().defaultTo(knex.raw('NEWID()'));
      table.uuid('spreadsheet_id').notNullable();
      table.uuid('cell_id').notNullable();
    }
    table.string('user_session_id', 255).nullable();
    table.string('operation_type', 20).nullable();
    table.text('old_value').nullable();
    table.text('new_value').nullable();
    table.timestamp('timestamp').defaultTo(knex.fn.now());
    
    table.foreign('spreadsheet_id').references('id').inTable('spreadsheets');
    table.foreign('cell_id').references('id').inTable('cells');
    table.index(['spreadsheet_id', 'timestamp'], 'idx_history_timestamp');
  });

  // Create active_sessions table
  await knex.schema.createTable('active_sessions', (table) => {
    if (isSQLite) {
      table.string('id').primary().defaultTo(knex.raw('(lower(hex(randomblob(16))))'));
      table.string('spreadsheet_id').notNullable();
    } else {
      table.uuid('id').primary().defaultTo(knex.raw('NEWID()'));
      table.uuid('spreadsheet_id').notNullable();
    }
    table.string('socket_id', 255).unique().notNullable();
    table.string('user_name', 255).nullable();
    table.string('user_color', 7).nullable();
    table.string('cursor_position', 10).nullable();
    table.string('selection_range', 50).nullable();
    table.timestamp('connected_at').defaultTo(knex.fn.now());
    table.timestamp('last_activity').defaultTo(knex.fn.now());
    table.boolean('is_active').defaultTo(true);
    
    table.foreign('spreadsheet_id').references('id').inTable('spreadsheets');
    table.index(['spreadsheet_id', 'is_active'], 'idx_active_sessions');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('active_sessions');
  await knex.schema.dropTableIfExists('change_history');
  await knex.schema.dropTableIfExists('cells');
  await knex.schema.dropTableIfExists('spreadsheets');
}
