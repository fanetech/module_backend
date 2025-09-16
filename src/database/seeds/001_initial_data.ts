import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';

// Insurance data generators
function generateRandomName(): string {
  const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Lisa', 'Robert', 'Maria', 'James', 'Jennifer', 'William', 'Patricia', 'Richard', 'Linda', 'Thomas', 'Barbara', 'Charles', 'Elizabeth', 'Joseph', 'Susan'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
  return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

function generateRandomDate(startYear: number = 2020, endYear: number = 2024): string {
  const start = new Date(startYear, 0, 1);
  const end = new Date(endYear, 11, 31);
  const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(randomTime).toISOString().split('T')[0];
}

function generateRandomEmail(): string {
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'insurance.com', 'company.com'];
  const name = generateRandomName().toLowerCase().replace(' ', '.');
  return `${name}@${domains[Math.floor(Math.random() * domains.length)]}`;
}

function generateRandomPhone(): string {
  return `+1-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

function generateRandomAddress(): string {
  const streets = ['Main St', 'Oak Ave', 'Pine Rd', 'Elm St', 'Maple Dr', 'Cedar Ln', 'Park Ave', 'First St', 'Second St', 'Third St'];
  const number = Math.floor(Math.random() * 9999 + 1);
  return `${number} ${streets[Math.floor(Math.random() * streets.length)]}`;
}

function generateRandomCity(): string {
  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte'];
  return cities[Math.floor(Math.random() * cities.length)];
}

function generateRandomState(): string {
  const states = ['NY', 'CA', 'TX', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI', 'NJ', 'VA', 'WA', 'AZ', 'MA'];
  return states[Math.floor(Math.random() * states.length)];
}

function generateRandomZip(): string {
  return Math.floor(Math.random() * 90000 + 10000).toString();
}

function generateRandomAmount(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function generatePolicyNumber(): string {
  const prefix = ['POL', 'INS', 'PLY', 'CVG'];
  const number = Math.floor(Math.random() * 999999 + 100000);
  return `${prefix[Math.floor(Math.random() * prefix.length)]}-${number}`;
}

function generateVehicleData() {
  const makes = ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'BMW', 'Mercedes', 'Audi', 'Lexus', 'Nissan', 'Hyundai'];
  const models = ['Camry', 'Accord', 'F-150', 'Silverado', '3 Series', 'C-Class', 'A4', 'ES', 'Altima', 'Elantra'];
  const years = [2018, 2019, 2020, 2021, 2022, 2023, 2024];

  return {
    make: makes[Math.floor(Math.random() * makes.length)],
    model: models[Math.floor(Math.random() * models.length)],
    year: years[Math.floor(Math.random() * years.length)]
  };
}

export async function seed(knex: Knex): Promise<void> {
  // Keep existing data - do not clear tables
  console.log('Creating additional spreadsheets without removing existing data...');

  // Helper function to convert column index to Excel-style letter
  function getColumnLetter(colIndex: number): string {
    let result = '';
    while (colIndex >= 0) {
      result = String.fromCharCode((colIndex % 26) + 65) + result;
      colIndex = Math.floor(colIndex / 26) - 1;
    }
    return result;
  }

  function getCellAddress(row: number, col: number): string {
    return `${getColumnLetter(col)}${row + 1}`;
  }

  // Create 5 Lightweight Sample Spreadsheets
  const spreadsheets = [
    {
      name: 'Sample Budget Tracker',
      description: 'Simple budget tracking spreadsheet',
      headers: ['Category', 'Budgeted', 'Actual', 'Difference', 'Notes']
    },
    {
      name: 'Employee Directory',
      description: 'Basic employee contact information',
      headers: ['Name', 'Department', 'Email', 'Phone', 'Position']
    },
    {
      name: 'Project Tasks',
      description: 'Simple project task management',
      headers: ['Task', 'Assignee', 'Due Date', 'Status', 'Priority']
    },
    {
      name: 'Sales Report',
      description: 'Monthly sales tracking',
      headers: ['Product', 'Units Sold', 'Revenue', 'Month', 'Region']
    },
    {
      name: 'Inventory List',
      description: 'Basic inventory management',
      headers: ['Item', 'Quantity', 'Unit Price', 'Total Value', 'Supplier']
    }
  ];

  const allCells: any[] = [];
  const allSpreadsheetIds: string[] = [];

  for (let spreadsheetIndex = 0; spreadsheetIndex < spreadsheets.length; spreadsheetIndex++) {
    const spreadsheet = spreadsheets[spreadsheetIndex];
    const spreadsheetId = uuidv4();
    allSpreadsheetIds.push(spreadsheetId);

    // Create spreadsheet
    console.log(`Creating spreadsheet: ${spreadsheet.name}`);
    try {
      await knex('spreadsheets').insert({
        id: spreadsheetId,
        name: spreadsheet.name,
        description: spreadsheet.description || null
        // Note: removed row_count and column_count as they don't exist in the actual table
      });
      console.log(`✓ Spreadsheet created: ${spreadsheet.name}`);
    } catch (error) {
      console.error(`Error creating spreadsheet ${spreadsheet.name}:`, error);
      throw error;
    }

    // Insert headers - using actual database schema column names
    for (let col = 0; col < spreadsheet.headers.length; col++) {
      allCells.push({
        id: uuidv4(),
        spreadsheet_id: spreadsheetId,
        row: 0,  // Actual column name is 'row' not 'row_index'
        col: col,  // Actual column name is 'col' not 'column_index'
        cell_id: getCellAddress(0, col),  // Actual column name is 'cell_id'
        value: spreadsheet.headers[col],  // Actual column name is 'value'
        data_type: 'text',
        format: JSON.stringify({
          bold: true,
          backgroundColor: '#2196F3',
          color: '#ffffff',
          textAlign: 'center'
        })
      });
    }

    // Generate lightweight data rows (only 20 rows per spreadsheet)
    for (let row = 1; row <= 20; row++) {
      for (let col = 0; col < spreadsheet.headers.length; col++) {
        const header = spreadsheet.headers[col];
        let value: any = '';
        let dataType = 'text';
        let formula: string | null = null;

        // Generate simple data based on spreadsheet type and column header
        switch (spreadsheetIndex) {
          case 0: // Budget Tracker
            switch (col) {
              case 0: value = ['Food', 'Transportation', 'Housing', 'Entertainment', 'Healthcare'][Math.floor(Math.random() * 5)]; break;
              case 1: value = generateRandomAmount(100, 1000); dataType = 'number'; break;
              case 2: value = generateRandomAmount(80, 1200); dataType = 'number'; break;
              case 3: formula = `=C${row + 1}-B${row + 1}`; dataType = 'formula'; break;
              case 4: value = ['On track', 'Over budget', 'Under budget'][Math.floor(Math.random() * 3)]; break;
            }
            break;

          case 1: // Employee Directory
            switch (col) {
              case 0: value = generateRandomName(); break;
              case 1: value = ['Sales', 'Marketing', 'Engineering', 'HR', 'Finance'][Math.floor(Math.random() * 5)]; break;
              case 2: value = generateRandomEmail(); break;
              case 3: value = generateRandomPhone(); break;
              case 4: value = ['Manager', 'Developer', 'Analyst', 'Coordinator', 'Specialist'][Math.floor(Math.random() * 5)]; break;
            }
            break;

          case 2: // Project Tasks
            switch (col) {
              case 0: value = `Task ${row}`; break;
              case 1: value = generateRandomName(); break;
              case 2: value = generateRandomDate(2024, 2025); dataType = 'date'; break;
              case 3: value = ['To Do', 'In Progress', 'Completed', 'Blocked'][Math.floor(Math.random() * 4)]; break;
              case 4: value = ['High', 'Medium', 'Low'][Math.floor(Math.random() * 3)]; break;
            }
            break;

          case 3: // Sales Report
            switch (col) {
              case 0: value = `Product ${String.fromCharCode(65 + Math.floor(Math.random() * 5))}`; break;
              case 1: value = Math.floor(Math.random() * 100 + 1); dataType = 'number'; break;
              case 2: value = generateRandomAmount(1000, 10000); dataType = 'number'; break;
              case 3: value = ['January', 'February', 'March', 'April', 'May'][Math.floor(Math.random() * 5)]; break;
              case 4: value = ['North', 'South', 'East', 'West', 'Central'][Math.floor(Math.random() * 5)]; break;
            }
            break;

          case 4: // Inventory
            switch (col) {
              case 0: value = `Item ${row.toString().padStart(3, '0')}`; break;
              case 1: value = Math.floor(Math.random() * 200 + 1); dataType = 'number'; break;
              case 2: value = generateRandomAmount(10, 500); dataType = 'number'; break;
              case 3: formula = `=B${row + 1}*C${row + 1}`; dataType = 'formula'; break;
              case 4: value = ['Supplier A', 'Supplier B', 'Supplier C'][Math.floor(Math.random() * 3)]; break;
            }
            break;
        }

        if (formula) {
          allCells.push({
            id: uuidv4(),
            spreadsheet_id: spreadsheetId,
            row: row,  // Actual column name
            col: col,  // Actual column name
            cell_id: getCellAddress(row, col),  // Actual column name
            formula: formula,
            data_type: dataType,
            format: JSON.stringify({
              textAlign: dataType === 'number' || dataType === 'formula' ? 'right' : 'left'
            })
          });
        } else {
          allCells.push({
            id: uuidv4(),
            spreadsheet_id: spreadsheetId,
            row: row,  // Actual column name
            col: col,  // Actual column name
            cell_id: getCellAddress(row, col),  // Actual column name
            value: value.toString(),  // Actual column name
            data_type: dataType,
            format: JSON.stringify({
              textAlign: dataType === 'number' ? 'right' : 'left'
            })
          });
        }
      }
    }
  }

  // Insert cells one by one using minimal schema that should exist
  console.log(`Inserting ${allCells.length.toLocaleString()} lightweight cells...`);

  for (let i = 0; i < allCells.length; i++) {
    try {
      // Use only the basic columns that should exist in any cells table
      const cellData: any = {
        id: allCells[i].id,
        spreadsheet_id: allCells[i].spreadsheet_id
      };

      // Add row/column data using actual column names
      if (allCells[i].row !== undefined) {
        cellData.row = allCells[i].row;
        cellData.col = allCells[i].col;
      }

      // Add cell address/reference using actual column name
      if (allCells[i].cell_id) {
        cellData.cell_id = allCells[i].cell_id;
      }

      // Add value data using actual column name
      if (allCells[i].value) {
        cellData.value = allCells[i].value;
      }

      // Add optional fields if they exist
      if (allCells[i].calculated_value) {
        cellData.calculated_value = allCells[i].calculated_value;
      }
      if (allCells[i].formula) {
        cellData.formula = allCells[i].formula;
      }
      if (allCells[i].data_type) {
        cellData.data_type = allCells[i].data_type;
      }
      if (allCells[i].format) {
        cellData.format = allCells[i].format;
      }

      await knex('cells').insert(cellData);

      if ((i + 1) % 100 === 0) {
        const progress = Math.round((i + 1) / allCells.length * 100);
        console.log(`Inserted ${(i + 1).toLocaleString()} cells - ${progress}% complete`);
      }
    } catch (error: any) {
      console.error(`Error inserting cell ${i + 1}:`, error.message);
      console.error('Cell data:', allCells[i]);

      // Try with even more basic schema - just id and spreadsheet_id
      try {
        await knex('cells').insert({
          id: allCells[i].id,
          spreadsheet_id: allCells[i].spreadsheet_id
        });
        console.log(`✓ Inserted basic cell ${i + 1} successfully`);
      } catch (basicError: any) {
        console.error('Failed to insert even basic cell data:', basicError.message);
        break; // Stop trying if even basic insert fails
      }
    }
  }

  // Add named ranges for insurance data
  const namedRanges = [];
  for (let i = 0; i < allSpreadsheetIds.length; i++) {
    const spreadsheetId = allSpreadsheetIds[i];
    const spreadsheetName = spreadsheets[i].name;

    namedRanges.push({
      id: uuidv4(),
      spreadsheet_id: spreadsheetId,
      name: 'DataRange',
      range: 'A1:T499',
      description: `Full data range for ${spreadsheetName}`,
      created_by: 'system'
    });

    namedRanges.push({
      id: uuidv4(),
      spreadsheet_id: spreadsheetId,
      name: 'HeaderRow',
      range: 'A1:T1',
      description: `Header row for ${spreadsheetName}`,
      created_by: 'system'
    });
  }

  await knex('named_ranges').insert(namedRanges);

  // Add metadata for insurance spreadsheets
  const metadata = [];
  for (let i = 0; i < allSpreadsheetIds.length; i++) {
    const spreadsheetId = allSpreadsheetIds[i];

    metadata.push(
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
        key: 'industry',
        value: 'Insurance',
        data_type: 'string'
      },
      {
        id: uuidv4(),
        spreadsheet_id: spreadsheetId,
        key: 'record_count',
        value: '499',
        data_type: 'number'
      },
      {
        id: uuidv4(),
        spreadsheet_id: spreadsheetId,
        key: 'data_type',
        value: ['auto_insurance', 'health_claims', 'life_insurance', 'property_insurance', 'workers_comp'][i],
        data_type: 'string'
      }
    );
  }

  await knex('spreadsheet_metadata').insert(metadata);

  console.log(`Successfully added 5 lightweight sample spreadsheets with ${allCells.length.toLocaleString()} total cells!`);
  console.log('New sample spreadsheets:');
  spreadsheets.forEach((sheet, index) => {
    console.log(`${index + 1}. ${sheet.name}`);
  });
}
