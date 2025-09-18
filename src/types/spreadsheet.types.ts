// Spreadsheet related types
export interface Spreadsheet {
  id: string;
  name: string;
  description?: string;
  rows: number;
  columns: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface Cell {
  id: string;
  spreadsheet_id: string;
  row: number;
  col: number;
  cell_id: string; // A1, B2, etc.
  value?: string;
  formula?: string;
  computed_value?: string;
  format?: CellFormat;
  data_type?: 'text' | 'number' | 'date' | 'boolean' | 'formula';
  is_locked: boolean;
  created_at: Date;
  updated_at: Date;
  updated_by?: string;
}

export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
  numberFormat?: string;
}

export interface CellChange {
  address: string;
  row: number;
  col: number;
  value?: any;
  formula?: string;
  oldValue?: any;
  newValue?: any;
  timestamp: number;
  userId: string;
  userName?: string;
  changeType: 'value' | 'formula' | 'format' | 'delete';
}

export interface CollaborationSession {
  id: string;
  spreadsheet_id: string;
  user_id: string;
  user_name?: string;
  socket_id?: string;
  color?: string;
  is_active: boolean;
  cursor_position?: Position;
  selection_range?: SelectionRange;
  joined_at: Date;
  last_activity: Date;
}

export interface Position {
  row: number;
  col: number;
}

export interface SelectionRange {
  start: Position;
  end: Position;
}

export interface CellHistory {
  id: string;
  cell_id: string;
  spreadsheet_id: string;
  cell_reference: string;
  old_value?: string;
  new_value?: string;
  old_formula?: string;
  new_formula?: string;
  change_type?: 'value' | 'formula' | 'format';
  changed_by?: string;
  changed_at: Date;
  metadata?: any;
}

export interface NamedRange {
  id: string;
  spreadsheet_id: string;
  name: string;
  range: string;
  description?: string;
  created_at: Date;
  created_by?: string;
}

export interface SpreadsheetMetadata {
  id: string;
  spreadsheet_id: string;
  key: string;
  value?: string;
  data_type: string;
  created_at: Date;
  updated_at: Date;
}

// WebSocket event types
export interface CellChangeEvent {
  spreadsheet_id: string;
  cell_id: string;
  row: number;
  col: number;
  value?: string;
  formula?: string;
  format?: CellFormat;
  user_id: string;
  timestamp: number;
}

export interface CursorMoveEvent {
  spreadsheet_id: string;
  user_id: string;
  position: Position;
  color: string;
  user_name?: string;
}

export interface SelectionChangeEvent {
  spreadsheet_id: string;
  user_id: string;
  range: SelectionRange;
  color: string;
}

export interface BulkCellChangeEvent {
  spreadsheet_id: string;
  changes: CellChangeEvent[];
  user_id: string;
  timestamp: number;
}

export interface UserPresence {
  user_id: string;
  user_name?: string;
  socket_id: string;
  color: string;
  cursor_position?: Position;
  selection_range?: SelectionRange;
  is_active: boolean;
  last_activity: Date;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SpreadsheetData {
  spreadsheet: Spreadsheet;
  cells: Cell[];
  named_ranges?: NamedRange[];
  metadata?: SpreadsheetMetadata[];
  active_users?: UserPresence[];
}

export interface CellUpdate {
  cell_id: string;
  value?: string;
  formula?: string;
  format?: CellFormat;
}

export interface BatchUpdate {
  spreadsheet_id: string;
  updates: CellUpdate[];
  user_id?: string;
}

// Calculation engine types
export interface CalculationResult {
  cell_id: string;
  computed_value: string;
  error?: string;
  dependencies?: string[];
}

export interface FormulaEvaluation {
  formula: string;
  result: any;
  error?: string;
  type: string;
}
