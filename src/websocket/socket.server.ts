import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { CollaborationService } from '../services/collaboration.service';
import { SpreadsheetService } from '../services/spreadsheet.service';
import {
  CellChangeEvent,
  CursorMoveEvent,
  SelectionChangeEvent,
  BulkCellChangeEvent
} from '../types/spreadsheet.types';

export class WebSocketServer {
  private io: Server;

  constructor(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`New client connected: ${socket.id}`);

      // Handle joining a spreadsheet room
      socket.on('join-spreadsheet', async (data: {
        spreadsheetId: string;
        userId: string;
        userName?: string;
      }) => {
        try {
          // Join the room
          socket.join(`spreadsheet-${data.spreadsheetId}`);

          // Create/update collaboration session
          const session = await CollaborationService.joinSession(
            data.spreadsheetId,
            data.userId,
            data.userName,
            socket.id
          );

          // Get active users
          const activeUsers = await CollaborationService.getActiveUsers(data.spreadsheetId);

          // Notify others in the room
          socket.to(`spreadsheet-${data.spreadsheetId}`).emit('user-joined', {
            user_id: data.userId,
            user_name: session.user_name,
            color: session.color,
            socket_id: socket.id
          });

          // Send active users list to the joining user
          socket.emit('active-users', activeUsers);

          console.log(`User ${data.userId} joined spreadsheet ${data.spreadsheetId}`);
        } catch (error) {
          console.error('Error joining spreadsheet:', error);
          socket.emit('error', { message: 'Failed to join spreadsheet' });
        }
      });

      // Handle leaving a spreadsheet room
      socket.on('leave-spreadsheet', async (data: { spreadsheetId: string }) => {
        socket.leave(`spreadsheet-${data.spreadsheetId}`);
        await this.handleDisconnect(socket);
      });

      // Handle cell changes
      socket.on('cell-change', async (data: CellChangeEvent) => {
        try {
          // Update cell in database
          const [row, col] = this.parseCellId(data.cell_id);
          await SpreadsheetService.updateCell(
            data.spreadsheet_id,
            {
              row,
              col,
              value: data.value,
              formula: data.formula,
              format: data.format,
              cell_id: data.cell_id
            },
            data.user_id
          );

          // Recalculate formulas
          const calculatedValues = await SpreadsheetService.calculateFormulas(data.spreadsheet_id);

          // Broadcast to others in the room
          socket.to(`spreadsheet-${data.spreadsheet_id}`).emit('cell-updated', {
            ...data,
            computed_values: Array.from(calculatedValues.entries()).map(([cellId, value]) => ({
              cell_id: cellId,
              computed_value: value
            }))
          });

          // Record activity
          await CollaborationService.recordActivity(socket.id);
        } catch (error) {
          console.error('Error handling cell change:', error);
          socket.emit('error', { message: 'Failed to update cell' });
        }
      });

      // Handle bulk cell changes
      socket.on('bulk-cell-change', async (data: BulkCellChangeEvent) => {
        try {
          // Update cells in database
          await SpreadsheetService.batchUpdateCells({
            spreadsheet_id: data.spreadsheet_id,
            updates: data.changes.map(change => ({
              cell_id: change.cell_id,
              value: change.value,
              formula: change.formula,
              format: change.format
            })),
            user_id: data.user_id
          });

          // Recalculate formulas
          const calculatedValues = await SpreadsheetService.calculateFormulas(data.spreadsheet_id);

          // Broadcast to others in the room
          socket.to(`spreadsheet-${data.spreadsheet_id}`).emit('bulk-updated', {
            ...data,
            computed_values: Array.from(calculatedValues.entries()).map(([cellId, value]) => ({
              cell_id: cellId,
              computed_value: value
            }))
          });

          // Record activity
          await CollaborationService.recordActivity(socket.id);
        } catch (error) {
          console.error('Error handling bulk cell change:', error);
          socket.emit('error', { message: 'Failed to update cells' });
        }
      });

      // Handle cursor movement
      socket.on('cursor-move', async (data: CursorMoveEvent) => {
        try {
          // Update cursor position in database
          await CollaborationService.updateCursorPosition(socket.id, data.position);

          // Get session info
          const session = await CollaborationService.getSessionBySocketId(socket.id);
          if (session) {
            // Broadcast to others in the room
            socket.to(`spreadsheet-${data.spreadsheet_id}`).emit('cursor-updated', {
              user_id: data.user_id,
              user_name: session.user_name,
              position: data.position,
              color: session.color
            });
          }

          // Record activity
          await CollaborationService.recordActivity(socket.id);
        } catch (error) {
          console.error('Error handling cursor move:', error);
        }
      });

      // Handle selection change
      socket.on('selection-change', async (data: SelectionChangeEvent) => {
        try {
          // Update selection in database
          await CollaborationService.updateSelectionRange(socket.id, data.range);

          // Get session info
          const session = await CollaborationService.getSessionBySocketId(socket.id);
          if (session) {
            // Broadcast to others in the room
            socket.to(`spreadsheet-${data.spreadsheet_id}`).emit('selection-updated', {
              user_id: data.user_id,
              range: data.range,
              color: session.color
            });
          }

          // Record activity
          await CollaborationService.recordActivity(socket.id);
        } catch (error) {
          console.error('Error handling selection change:', error);
        }
      });

      // Handle clear selection
      socket.on('clear-selection', async (data: { spreadsheet_id: string }) => {
        try {
          // Clear selection in database
          await CollaborationService.clearSelection(socket.id);

          // Get session info
          const session = await CollaborationService.getSessionBySocketId(socket.id);
          if (session) {
            // Broadcast to others in the room
            socket.to(`spreadsheet-${data.spreadsheet_id}`).emit('selection-cleared', {
              user_id: session.user_id
            });
          }
        } catch (error) {
          console.error('Error clearing selection:', error);
        }
      });

      // Handle get users request
      socket.on('get-users', async (data: { spreadsheet_id: string }) => {
        try {
          const activeUsers = await CollaborationService.getActiveUsers(data.spreadsheet_id);
          socket.emit('active-users', activeUsers);
        } catch (error) {
          console.error('Error getting users:', error);
          socket.emit('error', { message: 'Failed to get active users' });
        }
      });

      // Handle ping for keeping connection alive
      socket.on('ping', () => {
        socket.emit('pong');
      });

      // Handle disconnect
      socket.on('disconnect', async () => {
        await this.handleDisconnect(socket);
      });
    });
  }

  private async handleDisconnect(socket: Socket): Promise<void> {
    try {
      console.log(`Client disconnected: ${socket.id}`);

      // Get session before leaving
      const session = await CollaborationService.getSessionBySocketId(socket.id);

      if (session) {
        // Leave the session
        await CollaborationService.leaveSession(socket.id);

        // Notify others in the room
        socket.to(`spreadsheet-${session.spreadsheet_id}`).emit('user-left', {
          user_id: session.user_id,
          user_name: session.user_name
        });
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  }

  // Helper: Parse cell ID
  private parseCellId(cellId: string): [number, number] {
    const match = cellId.match(/^([A-Z]+)(\d+)$/);
    if (!match) {
      throw new Error(`Invalid cell ID: ${cellId}`);
    }
    const col = this.letterToColumn(match[1]);
    const row = parseInt(match[2]) - 1;
    return [row, col];
  }

  // Helper: Convert letter to column index
  private letterToColumn(letter: string): number {
    let col = 0;
    for (let i = 0; i < letter.length; i++) {
      col = col * 26 + (letter.charCodeAt(i) - 64);
    }
    return col - 1;
  }

  public getIO(): Server {
    return this.io;
  }
}
