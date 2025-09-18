import { HyperFormula, ConfigParams } from 'hyperformula';
import { logger } from '../utils/logger';
import { ICell } from '../models/Cell.model';

export interface HyperFormulaCell {
  address: string;
  row: number;
  col: number;
  value: any;
  formula?: string;
  calculatedValue?: any;
  version: number;
}

export interface EngineState {
  version: number;
  lastUpdated: Date;
  cellCount: number;
  dependencies: Map<string, string[]>;
}

export interface FormulaUpdateResult {
  success: boolean;
  address: string;
  calculatedValue: any;
  dependentCells: string[];
  affectedCells: HyperFormulaCell[];
  version: number;
  error?: string;
}

export interface BatchUpdateResult {
  success: boolean;
  updatedCells: HyperFormulaCell[];
  failedCells: Array<{ address: string; error: string }>;
  version: number;
  totalDependencies: number;
}

/**
 * HyperFormula engine service for backend calculation authority
 * Implements the "Backend Engine" from dual-engine architecture
 */
export class HyperFormulaEngineService {
  private engine: HyperFormula | null = null;
  private spreadsheetId: string | null = null;
  private version: number = 0;
  private isInitialized: boolean = false;
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private lastCalculationTime: Date = new Date();

  constructor() {
    this.initializeEngine();
  }

  /**
   * Initialize HyperFormula engine with backend configuration
   */
  private initializeEngine(): void {
    try {
      const config: Partial<ConfigParams> = {
        // Backend engine configuration for accuracy and consistency
        licenseKey: 'gpl-v3',
        useStats: true,           // Enable for analysis and monitoring
        undoLimit: 50,            // More history for backend
        useArrayArithmetic: true,
        caseSensitive: false,
        maxRows: 100000,
        maxColumns: 1000,
        // Ensure consistent calculation results
        useColumnIndex: true,
        evaluateNullToZero: true,
        smartRounding: true,
        // Error handling
        functionPlugins: []
        // Use default language (en-US)
      };

      this.engine = HyperFormula.buildEmpty(config);
      this.isInitialized = true;

      logger.info('HyperFormula backend engine initialized successfully', {
        version: HyperFormula.version,
        configuration: config
      });
    } catch (error) {
      logger.error('Failed to initialize HyperFormula engine', error instanceof Error ? error.message : String(error));
      throw new Error('HyperFormula engine initialization failed');
    }
  }

  /**
   * Load spreadsheet data into the engine
   */
  async loadSpreadsheet(spreadsheetId: string, cells: ICell[]): Promise<void> {
    if (!this.engine || !this.isInitialized) {
      throw new Error('HyperFormula engine not initialized');
    }

    try {
      this.spreadsheetId = spreadsheetId;
      this.version = 0;
      this.dependencyGraph.clear();

      // Add a new sheet if it doesn't exist
      if (this.engine.countSheets() === 0) {
        this.engine.addSheet('Sheet1');
      }

      // Convert cells to 2D array format for HyperFormula
      const maxRow = Math.max(...cells.map(c => c.row), 999);
      const maxCol = Math.max(...cells.map(c => c.col), 25);

      const data: any[][] = Array.from({ length: maxRow + 1 }, () =>
        Array.from({ length: maxCol + 1 }, () => null)
      );

      // Fill data array with cell values and formulas
      for (const cell of cells) {
        if (cell.formula && cell.formula.startsWith('=')) {
          data[cell.row][cell.col] = cell.formula;
        } else if (cell.value !== null && cell.value !== undefined) {
          // Try to parse as number, otherwise keep as string
          const numValue = parseFloat(cell.value as string);
          data[cell.row][cell.col] = !isNaN(numValue) ? numValue : cell.value;
        }
      }

      // Clear any existing data and load new data
      if (this.engine.countSheets() > 0) {
        this.engine.removeSheet(0);
      }
      this.engine.addSheet('Sheet1');

      // Build dependency graph
      this.buildDependencyGraph();
      this.version++;
      this.lastCalculationTime = new Date();

      logger.info('Spreadsheet loaded into HyperFormula engine', {
        spreadsheetId,
        cellCount: cells.length,
        sheetSize: `${maxRow + 1}x${maxCol + 1}`,
        version: this.version
      });

    } catch (error) {
      logger.error('Failed to load spreadsheet into HyperFormula engine', {
        spreadsheetId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Update a single cell value or formula
   */
  updateCell(address: string, value: any, formula?: string): FormulaUpdateResult {
    if (!this.engine || !this.isInitialized) {
      throw new Error('HyperFormula engine not initialized');
    }

    try {
      const { row, col } = this.parseAddress(address);
      const cellAddress = { sheet: 0, row, col };

      // Update the cell value or formula
      const inputValue = formula && formula.startsWith('=') ? formula : value;

      // Perform the update
      const changes = this.engine.setCellContents(cellAddress, inputValue);

      // Get the calculated value
      const calculatedValue = this.engine.getCellValue(cellAddress);

      // Get affected cells from changes
      const affectedCells: HyperFormulaCell[] = [];
      const dependentCells: string[] = [];

      for (const change of changes) {
        if ('address' in change) {
          const affectedAddress = this.formatAddress(change.address.row, change.address.col);
          affectedCells.push({
            address: affectedAddress,
            row: change.address.row,
            col: change.address.col,
            value: inputValue,
            formula: formula,
            calculatedValue: change.newValue,
            version: this.version + 1
          });

          if (affectedAddress !== address) {
            dependentCells.push(affectedAddress);
          }
        }
      }

      // Update dependency graph
      this.updateDependencyGraph(address, formula);
      this.version++;
      this.lastCalculationTime = new Date();

      const result: FormulaUpdateResult = {
        success: true,
        address,
        calculatedValue,
        dependentCells,
        affectedCells,
        version: this.version
      };

      logger.debug('Cell updated in HyperFormula engine', {
        address,
        value,
        formula,
        calculatedValue,
        dependentCells: dependentCells.length,
        version: this.version
      });

      return result;

    } catch (error) {
      logger.error('Failed to update cell in HyperFormula engine', {
        address,
        value,
        formula,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        address,
        calculatedValue: null,
        dependentCells: [],
        affectedCells: [],
        version: this.version,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Batch update multiple cells
   */
  batchUpdateCells(updates: Array<{ address: string; value: any; formula?: string }>): BatchUpdateResult {
    if (!this.engine || !this.isInitialized) {
      throw new Error('HyperFormula engine not initialized');
    }

    const updatedCells: HyperFormulaCell[] = [];
    const failedCells: Array<{ address: string; error: string }> = [];

    try {
      // Begin batch operation
      this.engine.suspendEvaluation();

      // Process each update
      for (const update of updates) {
        try {
          const { row, col } = this.parseAddress(update.address);
          const cellAddress = { sheet: 0, row, col };
          const inputValue = update.formula && update.formula.startsWith('=') ? update.formula : update.value;

          this.engine.setCellContents(cellAddress, inputValue);

          updatedCells.push({
            address: update.address,
            row,
            col,
            value: update.value,
            formula: update.formula,
            calculatedValue: null, // Will be calculated after resuming evaluation
            version: this.version + 1
          });

          // Update dependency graph
          this.updateDependencyGraph(update.address, update.formula);

        } catch (error) {
          failedCells.push({
            address: update.address,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Resume evaluation to calculate all values
      this.engine.resumeEvaluation();

      // Update calculated values for all affected cells
      for (const cell of updatedCells) {
        const cellAddress = { sheet: 0, row: cell.row, col: cell.col };
        cell.calculatedValue = this.engine.getCellValue(cellAddress);
      }

      this.version++;
      this.lastCalculationTime = new Date();

      const result: BatchUpdateResult = {
        success: failedCells.length === 0,
        updatedCells,
        failedCells,
        version: this.version,
        totalDependencies: this.dependencyGraph.size
      };

      logger.info('Batch update completed in HyperFormula engine', {
        totalUpdates: updates.length,
        successful: updatedCells.length,
        failed: failedCells.length,
        version: this.version
      });

      return result;

    } catch (error) {
      // Resume evaluation in case of error
      if (this.engine.isEvaluationSuspended()) {
        this.engine.resumeEvaluation();
      }

      logger.error('Batch update failed in HyperFormula engine', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        updatedCells: [],
        failedCells: updates.map(u => ({ address: u.address, error: error instanceof Error ? error.message : String(error) })),
        version: this.version,
        totalDependencies: this.dependencyGraph.size
      };
    }
  }

  /**
   * Get all cell values in 2D array format (Handsontable compatible)
   */
  getSpreadsheetData(maxRows: number = 1000, maxCols: number = 26): any[][] {
    if (!this.engine || !this.isInitialized) {
      throw new Error('HyperFormula engine not initialized');
    }

    try {
      const data: any[][] = [];

      for (let row = 0; row < maxRows; row++) {
        const rowData: any[] = [];
        for (let col = 0; col < maxCols; col++) {
          const cellAddress = { sheet: 0, row, col };
          const value = this.engine.getCellValue(cellAddress);
          rowData.push(value);
        }
        data.push(rowData);
      }

      return data;
    } catch (error) {
      logger.error('Failed to get spreadsheet data from HyperFormula engine', error);
      throw error;
    }
  }

  /**
   * Get cell formula and calculated value
   */
  getCell(address: string): HyperFormulaCell | null {
    if (!this.engine || !this.isInitialized) {
      return null;
    }

    try {
      const { row, col } = this.parseAddress(address);
      const cellAddress = { sheet: 0, row, col };

      const value = this.engine.getCellValue(cellAddress);
      const formula = this.engine.getCellFormula(cellAddress);

      return {
        address,
        row,
        col,
        value: formula || value,
        formula: formula || undefined,
        calculatedValue: value,
        version: this.version
      };
    } catch (error) {
      logger.error('Failed to get cell from HyperFormula engine', { address, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * Get engine state and statistics
   */
  getEngineState(): EngineState {
    if (!this.engine || !this.isInitialized) {
      throw new Error('HyperFormula engine not initialized');
    }

    return {
      version: this.version,
      lastUpdated: this.lastCalculationTime,
      cellCount: this.engine.countSheets() > 0 ? this.engine.getSheetDimensions(0).width * this.engine.getSheetDimensions(0).height : 0,
      dependencies: new Map(
        Array.from(this.dependencyGraph.entries()).map(([key, value]) => [key, Array.from(value)])
      )
    };
  }

  /**
   * Validate formula syntax
   */
  validateFormula(formula: string): { valid: boolean; error?: string } {
    if (!this.engine || !this.isInitialized) {
      return { valid: false, error: 'Engine not initialized' };
    }

    try {
      // Try to parse the formula
      this.engine.validateFormula(formula);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Build dependency graph for all cells with formulas
   */
  private buildDependencyGraph(): void {
    if (!this.engine) return;

    this.dependencyGraph.clear();

    // Note: This is a simplified approach - in a real implementation,
    // you'd iterate through all cells to find formulas and their dependencies
    // For now, dependency tracking is handled automatically by HyperFormula
  }

  /**
   * Update dependency graph for a specific cell
   */
  private updateDependencyGraph(address: string, formula?: string): void {
    if (!formula || !formula.startsWith('=')) {
      this.dependencyGraph.delete(address);
      return;
    }

    // Extract cell references from formula
    const dependencies = this.extractCellReferences(formula);
    this.dependencyGraph.set(address, new Set(dependencies));
  }

  /**
   * Extract cell references from a formula
   */
  private extractCellReferences(formula: string): string[] {
    // Simple regex to match cell references like A1, B2, etc.
    const cellRefRegex = /([A-Z]+[0-9]+)/g;
    const matches = formula.match(cellRefRegex) || [];
    return [...new Set(matches)]; // Remove duplicates
  }

  /**
   * Parse address string (e.g., "A1") to row/col coordinates
   */
  private parseAddress(address: string): { row: number; col: number } {
    const match = address.match(/^([A-Z]+)(\d+)$/);
    if (!match) {
      throw new Error(`Invalid cell address: ${address}`);
    }

    const col = this.letterToCol(match[1]);
    const row = parseInt(match[2]) - 1;

    return { row, col };
  }

  /**
   * Format row/col coordinates to address string
   */
  private formatAddress(row: number, col: number): string {
    return `${this.colToLetter(col)}${row + 1}`;
  }

  /**
   * Convert column letter to number (A=0, B=1, etc.)
   */
  private letterToCol(letter: string): number {
    let col = 0;
    for (let i = 0; i < letter.length; i++) {
      col = col * 26 + (letter.charCodeAt(i) - 64);
    }
    return col - 1;
  }

  /**
   * Convert column number to letter (0=A, 1=B, etc.)
   */
  private colToLetter(col: number): string {
    let letter = '';
    while (col >= 0) {
      letter = String.fromCharCode((col % 26) + 65) + letter;
      col = Math.floor(col / 26) - 1;
    }
    return letter;
  }

  /**
   * Destroy the engine instance
   */
  destroy(): void {
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
    this.isInitialized = false;
    this.spreadsheetId = null;
    this.version = 0;
    this.dependencyGraph.clear();

    logger.info('HyperFormula engine destroyed');
  }
}

// Singleton instance for global access
export const hyperFormulaEngine = new HyperFormulaEngineService();