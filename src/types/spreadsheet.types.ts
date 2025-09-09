export interface Cell {
  id: string;
  row: number;
  column: number;
  value: any;
  formula?: string;
  format?: CellFormat;
  locked?: boolean;
}

export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  backgroundColor?: string;
  horizontalAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  numberFormat?: string;
  borders?: {
    top?: BorderStyle;
    right?: BorderStyle;
    bottom?: BorderStyle;
    left?: BorderStyle;
  };
}

export interface BorderStyle {
  style: 'thin' | 'medium' | 'thick' | 'dashed' | 'dotted';
  color: string;
}

export interface Spreadsheet {
  id: string;
  name: string;
  sheets: Sheet[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  permissions: SpreadsheetPermissions;
}

export interface Sheet {
  id: string;
  name: string;
  cells: Cell[][];
  rowCount: number;
  columnCount: number;
  frozenRows?: number;
  frozenColumns?: number;
  rowHeights?: number[];
  columnWidths?: number[];
}

export interface SpreadsheetPermissions {
  owner: string;
  editors: string[];
  viewers: string[];
  public: boolean;
}

export interface CellChange {
  cellId: string;
  row: number;
  column: number;
  oldValue: any;
  newValue: any;
  timestamp: number;
  userId: string;
  changeType: 'value' | 'formula' | 'format';
}

export interface SpreadsheetMetadata {
  id: string;
  name: string;
  lastModified: Date;
  activeUsers: number;
  size: number;
}
