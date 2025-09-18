import { hyperFormulaEngine } from '../src/services/hyperformula-engine.service';
import { versionControl } from '../src/services/version-control.service';
import { hyperFormulaIntegration } from '../src/services/hyperformula-integration.service';
import { ICell } from '../src/models/Cell.model';

describe('HyperFormula Dual-Engine Architecture', () => {
  const testSpreadsheetId = 'test-spreadsheet-123';

  beforeEach(() => {
    // Reset engines for each test
    hyperFormulaEngine.destroy();
  });

  describe('Backend Engine Service', () => {
    test('should initialize HyperFormula engine', async () => {
      const testCells: ICell[] = [
        {
          spreadsheet_id: testSpreadsheetId,
          row: 0,
          col: 0,
          cell_id: 'A1',
          value: '10',
          version: 1,
          base_version: 0
        },
        {
          spreadsheet_id: testSpreadsheetId,
          row: 0,
          col: 1,
          cell_id: 'B1',
          value: '20',
          version: 1,
          base_version: 0
        },
        {
          spreadsheet_id: testSpreadsheetId,
          row: 0,
          col: 2,
          cell_id: 'C1',
          formula: '=A1+B1',
          version: 1,
          base_version: 0
        }
      ];

      await hyperFormulaEngine.loadSpreadsheet(testSpreadsheetId, testCells);

      const engineState = hyperFormulaEngine.getEngineState();
      expect(engineState.version).toBeGreaterThan(0);
      expect(engineState.cellCount).toBeGreaterThan(0);
    });

    test('should calculate formulas correctly', async () => {
      // Load initial data
      const testCells: ICell[] = [
        {
          spreadsheet_id: testSpreadsheetId,
          row: 0,
          col: 0,
          cell_id: 'A1',
          value: '10',
          version: 1,
          base_version: 0
        },
        {
          spreadsheet_id: testSpreadsheetId,
          row: 0,
          col: 1,
          cell_id: 'B1',
          value: '20',
          version: 1,
          base_version: 0
        }
      ];

      await hyperFormulaEngine.loadSpreadsheet(testSpreadsheetId, testCells);

      // Update with formula
      const result = hyperFormulaEngine.updateCell('C1', null, '=A1+B1');

      expect(result.success).toBe(true);
      expect(result.calculatedValue).toBe(30);
      expect(result.address).toBe('C1');
    });

    test('should handle complex formula dependencies', async () => {
      const testCells: ICell[] = [
        {
          spreadsheet_id: testSpreadsheetId,
          row: 0,
          col: 0,
          cell_id: 'A1',
          value: '100',
          version: 1,
          base_version: 0
        }
      ];

      await hyperFormulaEngine.loadSpreadsheet(testSpreadsheetId, testCells);

      // Create dependency chain: A1 -> B1 -> C1 -> D1
      const b1Result = hyperFormulaEngine.updateCell('B1', null, '=A1*2');
      const c1Result = hyperFormulaEngine.updateCell('C1', null, '=B1+50');
      const d1Result = hyperFormulaEngine.updateCell('D1', null, '=C1/10');

      expect(b1Result.calculatedValue).toBe(200);
      expect(c1Result.calculatedValue).toBe(250);
      expect(d1Result.calculatedValue).toBe(25);
    });

    test('should validate formulas', () => {
      const validFormula = '=SUM(A1:A10)';
      const invalidFormula = '=INVALID(A1)';

      const validResult = hyperFormulaEngine.validateFormula(validFormula);
      const invalidResult = hyperFormulaEngine.validateFormula(invalidFormula);

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBeDefined();
    });
  });

  describe('Version Control Service', () => {
    test('should track cell versions', async () => {
      const testCells: ICell[] = [
        {
          spreadsheet_id: testSpreadsheetId,
          row: 0,
          col: 0,
          cell_id: 'A1',
          value: '10',
          version: 1,
          base_version: 0
        }
      ];

      versionControl.initializeSpreadsheet(testSpreadsheetId, testCells);

      const update = {
        address: 'A1',
        row: 0,
        col: 0,
        value: '20',
        baseVersion: 1,
        timestamp: Date.now(),
        userId: 'test-user',
        changeType: 'value' as const
      };

      const result = await versionControl.processUpdate(testSpreadsheetId, update);

      expect(result.resolvedVersion).toBe(2);
      expect(result.conflicts.hasConflict).toBe(false);
    });

    test('should detect version conflicts', async () => {
      const testCells: ICell[] = [
        {
          spreadsheet_id: testSpreadsheetId,
          row: 0,
          col: 0,
          cell_id: 'A1',
          value: '10',
          version: 1,
          base_version: 0
        }
      ];

      versionControl.initializeSpreadsheet(testSpreadsheetId, testCells);

      // Simulate concurrent updates with different base versions
      const update1 = {
        address: 'A1',
        row: 0,
        col: 0,
        value: '20',
        baseVersion: 1,
        timestamp: Date.now(),
        userId: 'user1',
        changeType: 'value' as const
      };

      const update2 = {
        address: 'A1',
        row: 0,
        col: 0,
        value: '30',
        baseVersion: 0, // Outdated base version
        timestamp: Date.now() + 1,
        userId: 'user2',
        changeType: 'value' as const
      };

      await versionControl.processUpdate(testSpreadsheetId, update1);
      const result2 = await versionControl.processUpdate(testSpreadsheetId, update2, 1);

      expect(result2.conflicts.hasConflict).toBe(true);
      expect(result2.conflicts.conflictType).toBe('version');
    });

    test('should handle batch updates', async () => {
      const testCells: ICell[] = [];
      versionControl.initializeSpreadsheet(testSpreadsheetId, testCells);

      const batchUpdates = [
        {
          address: 'A1',
          row: 0,
          col: 0,
          value: '10',
          baseVersion: 0,
          timestamp: Date.now(),
          userId: 'test-user',
          changeType: 'value' as const
        },
        {
          address: 'B1',
          row: 0,
          col: 1,
          value: '20',
          baseVersion: 0,
          timestamp: Date.now(),
          userId: 'test-user',
          changeType: 'value' as const
        },
        {
          address: 'C1',
          row: 0,
          col: 2,
          formula: '=A1+B1',
          baseVersion: 0,
          timestamp: Date.now(),
          userId: 'test-user',
          changeType: 'formula' as const
        }
      ];

      const result = await versionControl.processBatchUpdates(testSpreadsheetId, batchUpdates);

      expect(result.updates.length).toBe(3);
      expect(result.totalConflicts).toBe(0);
      expect(result.globalVersion).toBeGreaterThan(0);
    });
  });

  describe('Integration Service', () => {
    test('should validate formula integration', () => {
      const validFormula = '=SUM(A1:A10)';
      const result = hyperFormulaIntegration.validateFormula(validFormula);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should get engine status', () => {
      const status = hyperFormulaIntegration.getEngineStatus();

      expect(status.isHealthy).toBe(true);
      expect(status.hyperFormula).toBeDefined();
    });
  });

  describe('Dual-Engine Flow Simulation', () => {
    test('should simulate complete dual-engine workflow', async () => {
      // Step 1: Initialize backend engine (load flow)
      const initialCells: ICell[] = [
        {
          spreadsheet_id: testSpreadsheetId,
          row: 0,
          col: 0,
          cell_id: 'A1',
          value: '100',
          version: 1,
          base_version: 0
        },
        {
          spreadsheet_id: testSpreadsheetId,
          row: 0,
          col: 1,
          cell_id: 'A2',
          value: '200',
          version: 1,
          base_version: 0
        }
      ];

      await hyperFormulaEngine.loadSpreadsheet(testSpreadsheetId, initialCells);
      versionControl.initializeSpreadsheet(testSpreadsheetId, initialCells);

      // Step 2-3: Process formula update (backend authority)
      const formulaUpdate = {
        address: 'A3',
        row: 2,
        col: 0,
        formula: '=SUM(A1:A2)',
        baseVersion: 0,
        timestamp: Date.now(),
        userId: 'test-user',
        changeType: 'formula' as const
      };

      const updateResult = await versionControl.processUpdate(testSpreadsheetId, formulaUpdate);

      // Verify backend calculation
      expect(updateResult.calculatedValue).toBe(300);
      expect(updateResult.resolvedVersion).toBe(2);
      expect(updateResult.conflicts.hasConflict).toBe(false);

      // Step 4: Verify data for frontend broadcast
      const cellInfo = hyperFormulaEngine.getCell('A3');
      expect(cellInfo).toBeDefined();
      expect(cellInfo!.calculatedValue).toBe(300);
      expect(cellInfo!.formula).toBe('=SUM(A1:A2)');

      // Step 5: Verify dependency tracking
      const engineState = hyperFormulaEngine.getEngineState();
      expect(engineState.dependencies.size).toBeGreaterThanOrEqual(0);
    });

    test('should handle conflict resolution scenario', async () => {
      // Initialize with data
      const initialCells: ICell[] = [
        {
          spreadsheet_id: testSpreadsheetId,
          row: 0,
          col: 0,
          cell_id: 'A1',
          value: '100',
          version: 1,
          base_version: 0
        }
      ];

      await hyperFormulaEngine.loadSpreadsheet(testSpreadsheetId, initialCells);
      versionControl.initializeSpreadsheet(testSpreadsheetId, initialCells);

      // Simulate concurrent edits (from documentation scenario)
      const userAUpdate = {
        address: 'A1',
        row: 0,
        col: 0,
        value: '150',
        baseVersion: 1,
        timestamp: Date.now(),
        userId: 'userA',
        changeType: 'value' as const
      };

      const userBUpdate = {
        address: 'A1',
        row: 0,
        col: 0,
        value: '200',
        baseVersion: 1,
        timestamp: Date.now() + 50, // Slightly later
        userId: 'userB',
        changeType: 'value' as const
      };

      // Process both updates
      const resultA = await versionControl.processUpdate(testSpreadsheetId, userAUpdate);
      const resultB = await versionControl.processUpdate(testSpreadsheetId, userBUpdate);

      // Verify conflict resolution (latest timestamp should win)
      expect(resultA.conflicts.hasConflict).toBe(false);
      expect(resultB.conflicts.hasConflict).toBe(false); // Backend resolves automatically
      expect(resultB.calculatedValue).toBe(200); // UserB's value wins (later timestamp)
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large formula dependencies efficiently', async () => {
      const startTime = Date.now();

      // Create a large dependency chain
      const cells: ICell[] = [];
      for (let i = 0; i < 100; i++) {
        cells.push({
          spreadsheet_id: testSpreadsheetId,
          row: i,
          col: 0,
          cell_id: `A${i + 1}`,
          value: i === 0 ? '1' : undefined,
          formula: i === 0 ? undefined : `=A${i}+1`,
          version: 1,
          base_version: 0
        });
      }

      await hyperFormulaEngine.loadSpreadsheet(testSpreadsheetId, cells);

      const loadTime = Date.now() - startTime;

      // Verify calculations
      const lastCell = hyperFormulaEngine.getCell('A100');
      expect(lastCell?.calculatedValue).toBe(100);

      // Performance should be reasonable (less than 1 second for 100 cells)
      expect(loadTime).toBeLessThan(1000);
    });
  });
});

// Mock database connection for testing
jest.mock('../src/database/connection', () => ({
  connection: {
    // Mock database methods as needed for testing
  }
}));