import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { createSocketServer } from '../config/socket.config';
import { CellHandler } from './handlers/cell.handler';
import { CursorHandler } from './handlers/cursor.handler';
import { PresenceHandler } from './handlers/presence.handler';
import { RoomsManager } from './rooms.manager';
import { logger } from '../utils/logger';

export class SocketServer {
  private io: Server;
  private roomsManager: RoomsManager;

  constructor(httpServer: HttpServer) {
    this.io = createSocketServer(httpServer);
    this.roomsManager = new RoomsManager(this.io);
    this.setupEventHandlers();
  }

  /**
   * Configure tous les gestionnaires d'événements Socket.IO
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info('New socket connection', {
        socketId: socket.id,
        address: socket.handshake.address
      });

      // Événements d'initialisation et de présence
      socket.on('init', (data) => PresenceHandler.handleInit(socket, data));
      socket.on('disconnect', () => PresenceHandler.handleDisconnect(socket));
      socket.on('ping', () => PresenceHandler.handlePing(socket));
      socket.on('get-users', () => PresenceHandler.handleGetUsers(socket));
      socket.on('status-change', (data) => PresenceHandler.handleStatusChange(socket, data));
      socket.on('chat-message', (data) => PresenceHandler.handleChatMessage(socket, data));

      // Événements de modification de cellules
      socket.on('cell-change', (data) => CellHandler.handleCellChange(socket, data));
      socket.on('cell-format', (data) => CellHandler.handleCellFormat(socket, data));
      socket.on('bulk-cell-change', (data) => CellHandler.handleBulkCellChange(socket, data));

      // Événements de curseur et sélection
      socket.on('cursor-move', (data) => CursorHandler.handleCursorMove(socket, data));
      socket.on('selection-change', (data) => CursorHandler.handleSelectionChange(socket, data));
      socket.on('clear-selection', () => CursorHandler.handleClearSelection(socket));
      socket.on('get-cursors', () => CursorHandler.handleGetCursors(socket));
      socket.on('get-selections', () => CursorHandler.handleGetSelections(socket));

      // Gestion des erreurs socket
      socket.on('error', (error) => {
        logger.error('Socket error', {
          socketId: socket.id,
          error: error.message
        });
      });

      // Événements de room
      socket.on('join-room', (roomId) => this.roomsManager.joinRoom(socket, roomId));
      socket.on('leave-room', (roomId) => this.roomsManager.leaveRoom(socket, roomId));
      socket.on('room-info', (roomId) => this.roomsManager.getRoomInfo(socket, roomId));
    });

    // Middleware pour logger tous les événements (debug)
    if (process.env.LOG_LEVEL === 'debug') {
      this.io.use((socket, next) => {
        const originalEmit = socket.emit;
        socket.emit = function(...args: any[]) {
          logger.debug('Socket emit', {
            socketId: socket.id,
            event: args[0],
            dataSize: JSON.stringify(args[1] || {}).length
          });
          return originalEmit.apply(socket, args as any);
        };
        next();
      });
    }

    logger.info('Socket.IO server initialized');
  }

  /**
   * Diffuse un message à tous les clients d'un spreadsheet
   */
  public broadcast(spreadsheetId: string, event: string, data: any): void {
    this.io.to(`spreadsheet:${spreadsheetId}`).emit(event, data);
  }

  /**
   * Envoie un message à un client spécifique
   */
  public sendToSocket(socketId: string, event: string, data: any): void {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit(event, data);
    }
  }

  /**
   * Déconnecte un client spécifique
   */
  public disconnectSocket(socketId: string, reason: string = 'Server initiated disconnect'): void {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('force-disconnect', { reason });
      socket.disconnect(true);
    }
  }

  /**
   * Récupère les statistiques du serveur WebSocket
   */
  public getStats(): any {
    const sockets = Array.from(this.io.sockets.sockets.values());
    const rooms = Array.from(this.io.sockets.adapter.rooms.entries());
    
    return {
      totalConnections: sockets.length,
      totalRooms: rooms.filter(([name]) => name.startsWith('spreadsheet:')).length,
      connections: sockets.map(socket => ({
        id: socket.id,
        connected: socket.connected,
        spreadsheetId: socket.data.spreadsheetId,
        userId: socket.data.userId,
        userName: socket.data.userName
      })),
      rooms: rooms
        .filter(([name]) => name.startsWith('spreadsheet:'))
        .map(([name, sockets]) => ({
          name,
          spreadsheetId: name.replace('spreadsheet:', ''),
          userCount: sockets.size
        }))
    };
  }

  /**
   * Nettoie les connexions inactives
   */
  public cleanupInactiveConnections(): void {
    const now = Date.now();
    const maxInactivity = 10 * 60 * 1000; // 10 minutes

    this.io.sockets.sockets.forEach((socket) => {
      const lastActivity = socket.data.lastActivity || socket.handshake.time;
      
      if (now - lastActivity > maxInactivity) {
        logger.info('Disconnecting inactive socket', {
          socketId: socket.id,
          inactivityDuration: now - lastActivity
        });
        
        this.disconnectSocket(socket.id, 'Inactivity timeout');
      }
    });
  }

  /**
   * Ferme le serveur WebSocket
   */
  public close(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => {
        logger.info('Socket.IO server closed');
        resolve();
      });
    });
  }
}

// Export singleton instance
let socketServer: SocketServer | null = null;

export const initSocketServer = (httpServer: HttpServer): SocketServer => {
  if (!socketServer) {
    socketServer = new SocketServer(httpServer);
    
    // Nettoie les connexions inactives toutes les 5 minutes
    setInterval(() => {
      socketServer?.cleanupInactiveConnections();
    }, 5 * 60 * 1000);
  }
  return socketServer;
};

export const getSocketServer = (): SocketServer | null => {
  return socketServer;
};