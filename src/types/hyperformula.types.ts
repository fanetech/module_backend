/**
 * HyperFormula Dual-Engine Architecture Types
 * Based on the documentation specification
 */

// Step 2: Frontend → Backend - Send Update format
export interface FormulaUpdateRequest {
  address: string;
  formula?: string;
  value?: any;
  baseVersion: number;
  timestamp?: number;
  userId?: string;
}

// Step 4: Backend → All Clients - Broadcast format
export interface FormulaUpdateBroadcast {
  address: string;
  formula?: string;
  value: any;
  version: number;
  affectedCells: string[];
  // Additional context fields
  raw_value?: string;
  calculated_value?: any;
  userId?: string;
  userName?: string;
  timestamp?: number;
  changeType?: string;
  conflicts?: {
    type: string;
    resolution: string;
  };
}

// Step 5: Frontend - Reconciliation response format
export interface FormulaUpdateAck {
  address: string;
  formula?: string;
  value: any;
  version: number;
  affectedCells: string[];
  conflicts?: boolean;
  timestamp: number;
}

// Database storage format (Step 3)
export interface DatabaseCellFormat {
  raw_value: string;
  calculated_value: any;
  formula?: string;
  version: number;
}

// Batch update formats
export interface BatchUpdateRequest {
  updates: FormulaUpdateRequest[];
  userId?: string;
}

export interface BatchUpdateBroadcast {
  updates: FormulaUpdateBroadcast[];
  userId?: string;
  userName?: string;
  timestamp: number;
}

export interface BatchUpdateAck {
  updates: Array<{
    address: string;
    value: any;
    version: number;
  }>;
  operationCount: number;
  timestamp: number;
}

// Engine state format
export interface EngineState {
  version: number;
  lastUpdated: Date;
  cellCount: number;
  isInitialized?: boolean;
}

// API Response formats
export interface CellUpdateResponse {
  address: string;
  formula?: string;
  value: any;
  version: number;
  affectedCells: string[];
  raw_value: string;
  calculated_value: any;
}

export interface SpreadsheetDataResponse {
  spreadsheetData: any[][]; // 2D array format for Handsontable compatibility
  dimensions: {
    rows: number;
    cols: number;
  };
  version: number;
  lastUpdated: Date;
  cellCount: number;
}

export interface CalculationResponse {
  calculations: Array<{
    address: string;
    calculated_value: any;
    formula?: string;
    version: number;
  }>;
  engine_state: EngineState;
}

export interface SpreadsheetResponse {
  id: string;
  name: string;
  description?: string;
  rows: number;
  columns: number;
  cells: Array<{
    address: string;
    cell_id: string;
    raw_value?: string;
    calculated_value?: any;
    formula?: string;
    value?: any;
    version: number;
    baseVersion: number;
    format?: any;
    // ... other cell properties
  }>;
  hyperformula: EngineState;
  // ... other spreadsheet properties
}

// WebSocket event types
export interface WebSocketEvents {
  // Incoming events
  'cell-change': FormulaUpdateRequest;
  'bulk-cell-change': BatchUpdateRequest;
  'formula-validation': { formula: string };

  // Outgoing events
  'cell-updated': FormulaUpdateBroadcast;
  'cell-change-ack': FormulaUpdateAck;
  'bulk-cells-updated': BatchUpdateBroadcast;
  'bulk-change-ack': BatchUpdateAck;
  'formula-validation-result': {
    formula: string;
    valid: boolean;
    error?: string;
    timestamp: number;
  };
}

// Conflict resolution types
export interface ConflictInfo {
  hasConflict: boolean;
  type: 'version' | 'concurrent' | 'dependency' | 'none';
  resolution: 'backend_wins' | 'timestamp_wins' | 'user_priority' | 'merge';
}

// Version control types
export interface VersionInfo {
  spreadsheetId: string;
  currentVersion: number;
  engineVersion: number;
  cellCount: number;
  pendingUpdates: number;
  lastUpdated: Date;
}