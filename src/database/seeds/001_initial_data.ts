import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';

export async function seed(knex: Knex): Promise<void> {
  // Clear existing data
  await knex('cells').del();
  await knex('spreadsheets').del();

  // Create test spreadsheet
  const spreadsheetId = uuidv4();
  
  await knex('spreadsheets').insert({
    id: spreadsheetId,
    name: 'Financial Report 2024',
    description: 'Sample financial spreadsheet with formulas',
    rows: 100,
    columns: 26,
    created_by: 'system',
    updated_by: 'system'
  });

  // Sample data matching your example with formulas
  const cellData = [
    // Headers row (row 1)
    { row: 0, col: 0, cell_id: 'A1', value: 'Date', data_type: 'text' },
    { row: 0, col: 1, cell_id: 'B1', value: 'Revenue', data_type: 'text' },
    { row: 0, col: 2, cell_id: 'C1', value: 'Expenses', data_type: 'text' },
    { row: 0, col: 3, cell_id: 'D1', value: 'Profit', data_type: 'text' },
    { row: 0, col: 4, cell_id: 'E1', value: 'Margin %', data_type: 'text' },
    { row: 0, col: 5, cell_id: 'F1', value: 'Cumulative', data_type: 'text' },
    { row: 0, col: 6, cell_id: 'G1', value: 'Avg Revenue', data_type: 'text' },
    { row: 0, col: 7, cell_id: 'H1', value: 'Status', data_type: 'text' },

    // Data rows with formulas (rows 2-6)
    { row: 1, col: 0, cell_id: 'A2', value: '2024-01-01', data_type: 'date' },
    { row: 1, col: 1, cell_id: 'B2', value: '1000', data_type: 'number' },
    { row: 1, col: 2, cell_id: 'C2', value: '600', data_type: 'number' },
    { row: 1, col: 3, cell_id: 'D2', formula: '=B2-C2', data_type: 'formula' },
    { row: 1, col: 4, cell_id: 'E2', formula: '=D2/B2*100', data_type: 'formula' },
    { row: 1, col: 5, cell_id: 'F2', formula: '=D2', data_type: 'formula' },
    { row: 1, col: 6, cell_id: 'G2', formula: '=AVERAGE(B2:B2)', data_type: 'formula' },
    { row: 1, col: 7, cell_id: 'H2', formula: '=IF(D2>300,"Good","Poor")', data_type: 'formula' },

    { row: 2, col: 0, cell_id: 'A3', value: '2024-01-02', data_type: 'date' },
    { row: 2, col: 1, cell_id: 'B3', value: '1500', data_type: 'number' },
    { row: 2, col: 2, cell_id: 'C3', value: '900', data_type: 'number' },
    { row: 2, col: 3, cell_id: 'D3', formula: '=B3-C3', data_type: 'formula' },
    { row: 2, col: 4, cell_id: 'E3', formula: '=D3/B3*100', data_type: 'formula' },
    { row: 2, col: 5, cell_id: 'F3', formula: '=D3+F2', data_type: 'formula' },
    { row: 2, col: 6, cell_id: 'G3', formula: '=AVERAGE(B2:B3)', data_type: 'formula' },
    { row: 2, col: 7, cell_id: 'H3', formula: '=IF(D3>300,"Good","Poor")', data_type: 'formula' },

    { row: 3, col: 0, cell_id: 'A4', value: '2024-01-03', data_type: 'date' },
    { row: 3, col: 1, cell_id: 'B4', value: '800', data_type: 'number' },
    { row: 3, col: 2, cell_id: 'C4', value: '500', data_type: 'number' },
    { row: 3, col: 3, cell_id: 'D4', formula: '=B4-C4', data_type: 'formula' },
    { row: 3, col: 4, cell_id: 'E4', formula: '=D4/B4*100', data_type: 'formula' },
    { row: 3, col: 5, cell_id: 'F4', formula: '=D4+F3', data_type: 'formula' },
    { row: 3, col: 6, cell_id: 'G4', formula: '=AVERAGE(B2:B4)', data_type: 'formula' },
    { row: 3, col: 7, cell_id: 'H4', formula: '=IF(D4>300,"Good","Poor")', data_type: 'formula' },

    { row: 4, col: 0, cell_id: 'A5', value: '2024-01-04', data_type: 'date' },
    { row: 4, col: 1, cell_id: 'B5', value: '2000', data_type: 'number' },
    { row: 4, col: 2, cell_id: 'C5', value: '1100', data_type: 'number' },
    { row: 4, col: 3, cell_id: 'D5', formula: '=B5-C5', data_type: 'formula' },
    { row: 4, col: 4, cell_id: 'E5', formula: '=D5/B5*100', data_type: 'formula' },
    { row: 4, col: 5, cell_id: 'F5', formula: '=D5+F4', data_type: 'formula' },
    { row: 4, col: 6, cell_id: 'G5', formula: '=AVERAGE(B2:B5)', data_type: 'formula' },
    { row: 4, col: 7, cell_id: 'H5', formula: '=IF(D5>300,"Good","Poor")', data_type: 'formula' },

    { row: 5, col: 0, cell_id: 'A6', value: '2024-01-05', data_type: 'date' },
    { row: 5, col: 1, cell_id: 'B6', value: '1200', data_type: 'number' },
    { row: 5, col: 2, cell_id: 'C6', value: '700', data_type: 'number' },
    { row: 5, col: 3, cell_id: 'D6', formula: '=B6-C6', data_type: 'formula' },
    { row: 5, col: 4, cell_id: 'E6', formula: '=D6/B6*100', data_type: 'formula' },
    { row: 5, col: 5, cell_id: 'F6', formula: '=D6+F5', data_type: 'formula' },
    { row: 5, col: 6, cell_id: 'G6', formula: '=AVERAGE(B2:B6)', data_type: 'formula' },
    { row: 5, col: 7, cell_id: 'H6', formula: '=IF(D6>300,"Good","Poor")', data_type: 'formula' },

    // TOTAL row (row 7)
    { row: 6, col: 0, cell_id: 'A7', value: 'TOTAL', data_type: 'text' },
    { row: 6, col: 1, cell_id: 'B7', formula: '=SUM(B2:B6)', data_type: 'formula' },
    { row: 6, col: 2, cell_id: 'C7', formula: '=SUM(C2:C6)', data_type: 'formula' },
    { row: 6, col: 3, cell_id: 'D7', formula: '=SUM(D2:D6)', data_type: 'formula' },
    { row: 6, col: 4, cell_id: 'E7', formula: '=AVERAGE(E2:E6)', data_type: 'formula' },
    { row: 6, col: 5, cell_id: 'F7', formula: '=MAX(F2:F6)', data_type: 'formula' },
    { row: 6, col: 6, cell_id: 'G7', formula: '=AVERAGE(G2:G6)', data_type: 'formula' },
    { row: 6, col: 7, cell_id: 'H7', formula: '=COUNTIF(H2:H6,"Good")', data_type: 'formula' }
  ];

  // Insert cells with formatting
  const cells = cellData.map(cell => ({
    id: uuidv4(),
    spreadsheet_id: spreadsheetId,
    ...cell,
    format: JSON.stringify({
      bold: cell.row === 0 || (cell.row === 6 && cell.col === 0), // Bold headers and TOTAL
      backgroundColor: cell.row === 0 ? '#f0f0f0' : (cell.row === 6 ? '#e0e0e0' : null),
      textAlign: cell.data_type === 'number' || cell.data_type === 'formula' ? 'right' : 'left'
    }),
    updated_by: 'system'
  }));

  await knex('cells').insert(cells);

  // Create another sample spreadsheet - Budget Tracker
  const budgetSpreadsheetId = uuidv4();
  
  await knex('spreadsheets').insert({
    id: budgetSpreadsheetId,
    name: 'Budget Tracker 2024',
    description: 'Monthly budget tracking with categories',
    rows: 50,
    columns: 12,
    created_by: 'system',
    updated_by: 'system'
  });

  // Budget tracker data
  const budgetCells = [
    // Headers
    { row: 0, col: 0, cell_id: 'A1', value: 'Category', data_type: 'text' },
    { row: 0, col: 1, cell_id: 'B1', value: 'Budget', data_type: 'text' },
    { row: 0, col: 2, cell_id: 'C1', value: 'Actual', data_type: 'text' },
    { row: 0, col: 3, cell_id: 'D1', value: 'Variance', data_type: 'text' },
    { row: 0, col: 4, cell_id: 'E1', value: 'Status', data_type: 'text' },

    // Data
    { row: 1, col: 0, cell_id: 'A2', value: 'Housing', data_type: 'text' },
    { row: 1, col: 1, cell_id: 'B2', value: '2000', data_type: 'number' },
    { row: 1, col: 2, cell_id: 'C2', value: '1950', data_type: 'number' },
    { row: 1, col: 3, cell_id: 'D2', formula: '=B2-C2', data_type: 'formula' },
    { row: 1, col: 4, cell_id: 'E2', formula: '=IF(D2>=0,"Under Budget","Over Budget")', data_type: 'formula' },

    { row: 2, col: 0, cell_id: 'A3', value: 'Food', data_type: 'text' },
    { row: 2, col: 1, cell_id: 'B3', value: '600', data_type: 'number' },
    { row: 2, col: 2, cell_id: 'C3', value: '650', data_type: 'number' },
    { row: 2, col: 3, cell_id: 'D3', formula: '=B3-C3', data_type: 'formula' },
    { row: 2, col: 4, cell_id: 'E3', formula: '=IF(D3>=0,"Under Budget","Over Budget")', data_type: 'formula' },

    { row: 3, col: 0, cell_id: 'A4', value: 'Transportation', data_type: 'text' },
    { row: 3, col: 1, cell_id: 'B4', value: '400', data_type: 'number' },
    { row: 3, col: 2, cell_id: 'C4', value: '380', data_type: 'number' },
    { row: 3, col: 3, cell_id: 'D4', formula: '=B4-C4', data_type: 'formula' },
    { row: 3, col: 4, cell_id: 'E4', formula: '=IF(D4>=0,"Under Budget","Over Budget")', data_type: 'formula' },

    // Totals
    { row: 5, col: 0, cell_id: 'A6', value: 'TOTAL', data_type: 'text' },
    { row: 5, col: 1, cell_id: 'B6', formula: '=SUM(B2:B4)', data_type: 'formula' },
    { row: 5, col: 2, cell_id: 'C6', formula: '=SUM(C2:C4)', data_type: 'formula' },
    { row: 5, col: 3, cell_id: 'D6', formula: '=B6-C6', data_type: 'formula' },
    { row: 5, col: 4, cell_id: 'E6', formula: '=IF(D6>=0,"Within Budget","Over Budget")', data_type: 'formula' }
  ];

  const budgetCellsToInsert = budgetCells.map(cell => ({
    id: uuidv4(),
    spreadsheet_id: budgetSpreadsheetId,
    ...cell,
    format: JSON.stringify({
      bold: cell.row === 0 || cell.cell_id === 'A6',
      backgroundColor: cell.row === 0 ? '#4CAF50' : (cell.row === 5 ? '#FFC107' : null),
      color: cell.row === 0 ? '#ffffff' : null,
      textAlign: cell.data_type === 'number' || cell.data_type === 'formula' ? 'right' : 'left'
    }),
    updated_by: 'system'
  }));

  await knex('cells').insert(budgetCellsToInsert);

  // Add some named ranges
  await knex('named_ranges').insert([
    {
      id: uuidv4(),
      spreadsheet_id: spreadsheetId,
      name: 'RevenueData',
      range: 'B2:B6',
      description: 'Revenue data for all days',
      created_by: 'system'
    },
    {
      id: uuidv4(),
      spreadsheet_id: spreadsheetId,
      name: 'ExpenseData',
      range: 'C2:C6',
      description: 'Expense data for all days',
      created_by: 'system'
    },
    {
      id: uuidv4(),
      spreadsheet_id: budgetSpreadsheetId,
      name: 'BudgetAmounts',
      range: 'B2:B4',
      description: 'Budget amounts by category',
      created_by: 'system'
    }
  ]);

  // Add metadata
  await knex('spreadsheet_metadata').insert([
    {
      id: uuidv4(),
      spreadsheet_id: spreadsheetId,
      key: 'currency',
      value: 'USD',
      data_type: 'string'
    },
    {
      id: uuidv4(),
      spreadsheet_id: spreadsheetId,
      key: 'decimal_places',
      value: '2',
      data_type: 'number'
    },
    {
      id: uuidv4(),
      spreadsheet_id: budgetSpreadsheetId,
      key: 'currency',
      value: 'USD',
      data_type: 'string'
    },
    {
      id: uuidv4(),
      spreadsheet_id: budgetSpreadsheetId,
      key: 'fiscal_year',
      value: '2024',
      data_type: 'string'
    }
  ]);

  console.log('Seed data inserted successfully!');
}
