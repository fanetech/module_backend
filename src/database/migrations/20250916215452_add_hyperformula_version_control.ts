const { Knex } = require('knex');

exports.up = async function(knex) {
  // Check if columns already exist in cells table
  const hasVersionColumn = await knex.schema.hasColumn('cells', 'version');
  const hasBaseVersionColumn = await knex.schema.hasColumn('cells', 'base_version');
  
  if (!hasVersionColumn || !hasBaseVersionColumn) {
    // Add version control columns to cells table for HyperFormula dual-engine architecture
    await knex.schema.alterTable('cells', (table) => {
      // Version for conflict resolution (current cell version)
      if (!hasVersionColumn) {
        table.integer('version').defaultTo(1);
      }

      // Base version for conflict detection (version when edit started)
      if (!hasBaseVersionColumn) {
        table.integer('base_version').defaultTo(0);
      }

      // Add index for version queries (check if it doesn't exist)
      table.index(['spreadsheet_id', 'version'], 'idx_cells_spreadsheet_version');
    });
  }

  // Create spreadsheet_versions table to track global spreadsheet versions
  const hasSpreadsheetVersions = await knex.schema.hasTable('spreadsheet_versions');
  if (!hasSpreadsheetVersions) {
    await knex.schema.createTable('spreadsheet_versions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('NEWID()'));
    table.uuid('spreadsheet_id').notNullable();
    table.integer('version').notNullable();
    table.json('snapshot'); // Optional: store state snapshot
    table.text('description'); // Optional: version description
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.string('created_by', 255);

    // Foreign key
    table.foreign('spreadsheet_id').references('id').inTable('spreadsheets').onDelete('CASCADE');

    // Indexes
    table.unique(['spreadsheet_id', 'version']);
    table.index(['spreadsheet_id', 'created_at'], 'idx_spreadsheet_versions_recent');
    });
  }

  // Create cell_history table for tracking all cell changes with HyperFormula
  const hasCellHistory = await knex.schema.hasTable('cell_history');
  if (!hasCellHistory) {
    await knex.schema.createTable('cell_history', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('NEWID()'));
    table.uuid('spreadsheet_id').notNullable();
    table.uuid('cell_id').nullable(); // Reference to cells.id
    table.string('cell_address', 10).notNullable(); // A1, B2, etc.
    table.integer('row').notNullable();
    table.integer('col').notNullable();
    table.text('old_value');
    table.text('new_value');
    table.text('old_formula');
    table.text('new_formula');
    table.text('old_computed_value');
    table.text('new_computed_value');
    table.integer('version').notNullable();
    table.string('change_type', 50).notNullable(); // 'value', 'formula', 'format', 'delete'
    table.timestamp('changed_at').defaultTo(knex.fn.now());
    table.string('changed_by', 255).notNullable();
    table.json('metadata'); // Additional change metadata

    // Foreign keys
    table.foreign('spreadsheet_id').references('id').inTable('spreadsheets').onDelete('CASCADE');
    table.foreign('cell_id').references('id').inTable('cells').onDelete('SET NULL');

    // Indexes
    table.index(['spreadsheet_id', 'changed_at'], 'idx_cell_history_recent');
    table.index(['spreadsheet_id', 'cell_address'], 'idx_cell_history_address');
    table.index(['spreadsheet_id', 'version'], 'idx_cell_history_version');
    });
  }

  // Create conflict_resolutions table to track resolved conflicts
  const hasConflictResolutions = await knex.schema.hasTable('conflict_resolutions');
  if (!hasConflictResolutions) {
    await knex.schema.createTable('conflict_resolutions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('NEWID()'));
    table.uuid('spreadsheet_id').notNullable();
    table.string('cell_address', 10).notNullable();
    table.string('conflict_type', 50).notNullable(); // 'version', 'concurrent', 'dependency'
    table.string('resolution_strategy', 50).notNullable(); // 'backend_wins', 'timestamp_wins', etc.
    table.json('original_update'); // Store original conflicting update
    table.json('resolved_update'); // Store resolved update
    table.integer('original_version').notNullable();
    table.integer('resolved_version').notNullable();
    table.timestamp('resolved_at').defaultTo(knex.fn.now());
    table.string('resolved_by', 255);
    table.text('resolution_notes');

    // Foreign key
    table.foreign('spreadsheet_id').references('id').inTable('spreadsheets').onDelete('CASCADE');

    // Indexes
    table.index(['spreadsheet_id', 'resolved_at'], 'idx_conflicts_recent');
    table.index(['spreadsheet_id', 'cell_address'], 'idx_conflicts_address');
    });
  }

  console.log('✅ HyperFormula version control schema created successfully');
};

exports.down = async function(knex) {
  // Drop new tables (in reverse order of creation)
  await knex.schema.dropTableIfExists('conflict_resolutions');
  await knex.schema.dropTableIfExists('cell_history');
  await knex.schema.dropTableIfExists('spreadsheet_versions');

  // Remove version control columns from cells table
  await knex.schema.alterTable('cells', (table) => {
    table.dropIndex([], 'idx_cells_spreadsheet_version');
    table.dropColumn('version');
    table.dropColumn('base_version');
  });

  console.log('✅ HyperFormula version control schema rollback completed');
};