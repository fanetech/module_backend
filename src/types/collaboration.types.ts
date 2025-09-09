import { Socket } from 'socket.io';

export interface CollaborationUser {
  id: string;
  socketId: string;
  name: string;
  email?: string;
  color: string;
  cursor?: CursorPosition;
  selection?: CellSelection;
  lastActivity: Date;
}

export interface CursorPosition {
  row: number;
  column: number;
  sheet?: string;
}

export interface CellSelection {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
  sheet?: string;
}

export interface CollaborationSession {
  spreadsheetId: string;
  users: Map<string, CollaborationUser>;
  startedAt: Date;
  lastActivity: Date;
}

export interface Operation {
  id: string;
  type: 'insert' | 'delete' | 'update' | 'format';
  cellId: string;
  row: number;
  column: number;
  value?: any;
  format?: any;
  timestamp: number;
  userId: string;
  version: number;
}

export interface TransformResult {
  operation: Operation;
  transformed: boolean;
  conflicts: string[];
}

export interface SocketData {
  token: string;
  spreadsheetId: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userColor?: string;
}

export interface CollaborationEvent {
  type: 'cell-change' | 'cursor-move' | 'selection-change' | 'user-join' | 'user-leave';
  data: any;
  userId: string;
  timestamp: number;
}

export interface UserPresence {
  userId: string;
  userName: string;
  color: string;
  isOnline: boolean;
  lastSeen: Date;
  cursor?: CursorPosition;
  selection?: CellSelection;
}

export interface ConflictResolution {
  originalOperation: Operation;
  conflictingOperation: Operation;
  resolvedOperation: Operation;
  strategy: 'timestamp' | 'user-priority' | 'merge';
  resolvedAt: Date;
}

export interface SyncState {
  spreadsheetId: string;
  version: number;
  lastSyncedAt: Date;
  pendingOperations: Operation[];
  acknowledgedOperations: string[];
}
