import { Server, Socket } from 'socket.io';
import { memoryStore } from '../services/memory-store.service';
import { logger } from '../utils/logger';

interface RoomInfo {
  id: string;
  spreadsheetId: string;
  userCount: number;
  users: Array<{
    socketId: string;
    userId: string;
    userName: string;
  }>;
  createdAt: Date;
  lastActivity: Date;
}

export class RoomsManager {
  private io: Server;
  private roomsInfo: Map<string, RoomInfo>;

  constructor(io: Server) {
    this.io = io;
    this.roomsInfo = new Map();
  }

  /**
   * Fait rejoindre un utilisateur à une room
   */
  async joinRoom(socket: Socket, roomId: string): Promise<void> {
    try {
      const roomName = `spreadsheet:${roomId}`;
      
      // Quitte les autres rooms de spreadsheet
      socket.rooms.forEach(room => {
        if (room.startsWith('spreadsheet:') && room !== roomName) {
          socket.leave(room);
        }
      });

      // Joint la nouvelle room
      await socket.join(roomName);

      // Met à jour les informations de la room
      if (!this.roomsInfo.has(roomName)) {
        this.roomsInfo.set(roomName, {
          id: roomName,
          spreadsheetId: roomId,
          userCount: 0,
          users: [],
          createdAt: new Date(),
          lastActivity: new Date()
        });
      }

      const roomInfo = this.roomsInfo.get(roomName)!;
      roomInfo.userCount = this.io.sockets.adapter.rooms.get(roomName)?.size || 0;
      roomInfo.lastActivity = new Date();

      // Ajoute l'utilisateur à la liste
      const userInfo = {
        socketId: socket.id,
        userId: socket.data.userId || socket.id,
        userName: socket.data.userName || 'Anonymous'
      };

      if (!roomInfo.users.find(u => u.socketId === socket.id)) {
        roomInfo.users.push(userInfo);
      }

      logger.info('User joined room', {
        roomName,
        socketId: socket.id,
        userId: socket.data.userId,
        userCount: roomInfo.userCount
      });

      // Notifie le client
      socket.emit('room-joined', {
        roomId,
        userCount: roomInfo.userCount,
        timestamp: Date.now()
      });

      // Notifie les autres membres de la room
      socket.to(roomName).emit('room-user-joined', {
        roomId,
        user: userInfo,
        userCount: roomInfo.userCount,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error joining room', {
        error,
        roomId,
        socketId: socket.id
      });
      
      socket.emit('error', {
        message: 'Failed to join room',
        roomId
      });
    }
  }

  /**
   * Fait quitter une room à un utilisateur
   */
  async leaveRoom(socket: Socket, roomId: string): Promise<void> {
    try {
      const roomName = `spreadsheet:${roomId}`;
      
      // Quitte la room
      await socket.leave(roomName);

      // Met à jour les informations de la room
      const roomInfo = this.roomsInfo.get(roomName);
      if (roomInfo) {
        roomInfo.userCount = this.io.sockets.adapter.rooms.get(roomName)?.size || 0;
        roomInfo.users = roomInfo.users.filter(u => u.socketId !== socket.id);
        roomInfo.lastActivity = new Date();

        // Supprime la room si elle est vide
        if (roomInfo.userCount === 0) {
          this.roomsInfo.delete(roomName);
        }
      }

      logger.info('User left room', {
        roomName,
        socketId: socket.id,
        userId: socket.data.userId,
        userCount: roomInfo?.userCount || 0
      });

      // Notifie le client
      socket.emit('room-left', {
        roomId,
        timestamp: Date.now()
      });

      // Notifie les autres membres de la room
      socket.to(roomName).emit('room-user-left', {
        roomId,
        user: {
          socketId: socket.id,
          userId: socket.data.userId || socket.id,
          userName: socket.data.userName || 'Anonymous'
        },
        userCount: roomInfo?.userCount || 0,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error leaving room', {
        error,
        roomId,
        socketId: socket.id
      });
      
      socket.emit('error', {
        message: 'Failed to leave room',
        roomId
      });
    }
  }

  /**
   * Récupère les informations d'une room
   */
  getRoomInfo(socket: Socket, roomId: string): void {
    try {
      const roomName = `spreadsheet:${roomId}`;
      const roomInfo = this.roomsInfo.get(roomName);

      if (!roomInfo) {
        socket.emit('room-info', {
          roomId,
          exists: false,
          timestamp: Date.now()
        });
        return;
      }

      // Récupère les utilisateurs depuis le memory store
      const users = memoryStore.getUsers(roomId).map(user => ({
        userId: user.id,
        userName: user.name,
        color: user.color,
        cursor: user.cursor,
        selection: user.selection,
        lastActivity: user.lastActivity
      }));

      socket.emit('room-info', {
        roomId,
        exists: true,
        userCount: roomInfo.userCount,
        users,
        createdAt: roomInfo.createdAt,
        lastActivity: roomInfo.lastActivity,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error getting room info', {
        error,
        roomId,
        socketId: socket.id
      });
      
      socket.emit('error', {
        message: 'Failed to get room info',
        roomId
      });
    }
  }

  /**
   * Diffuse un message à tous les membres d'une room
   */
  broadcastToRoom(roomId: string, event: string, data: any, excludeSocket?: string): void {
    const roomName = `spreadsheet:${roomId}`;
    
    if (excludeSocket) {
      const socket = this.io.sockets.sockets.get(excludeSocket);
      if (socket) {
        socket.to(roomName).emit(event, data);
      }
    } else {
      this.io.to(roomName).emit(event, data);
    }
  }

  /**
   * Récupère la liste de toutes les rooms actives
   */
  getAllRooms(): Array<{
    roomId: string;
    spreadsheetId: string;
    userCount: number;
    lastActivity: Date;
  }> {
    const rooms: Array<any> = [];
    
    this.roomsInfo.forEach((info, roomName) => {
      rooms.push({
        roomId: roomName,
        spreadsheetId: info.spreadsheetId,
        userCount: info.userCount,
        lastActivity: info.lastActivity
      });
    });

    return rooms;
  }

  /**
   * Nettoie les rooms inactives
   */
  cleanupInactiveRooms(maxInactivityMs: number = 30 * 60 * 1000): void {
    const now = new Date();
    
    this.roomsInfo.forEach((info, roomName) => {
      const inactivityDuration = now.getTime() - info.lastActivity.getTime();
      
      if (inactivityDuration > maxInactivityMs && info.userCount === 0) {
        logger.info('Cleaning up inactive room', {
          roomName,
          inactivityDuration,
          lastActivity: info.lastActivity
        });
        
        this.roomsInfo.delete(roomName);
      }
    });
  }

  /**
   * Force la fermeture d'une room
   */
  closeRoom(roomId: string): void {
    const roomName = `spreadsheet:${roomId}`;
    const room = this.io.sockets.adapter.rooms.get(roomName);
    
    if (room) {
      // Déconnecte tous les sockets de la room
      room.forEach(socketId => {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.leave(roomName);
          socket.emit('room-closed', {
            roomId,
            reason: 'Room closed by server',
            timestamp: Date.now()
          });
        }
      });
    }

    // Supprime les informations de la room
    this.roomsInfo.delete(roomName);
    
    logger.info('Room closed', { roomName });
  }

  /**
   * Récupère les statistiques des rooms
   */
  getStats(): any {
    const stats = {
      totalRooms: this.roomsInfo.size,
      totalUsers: 0,
      rooms: [] as any[]
    };

    this.roomsInfo.forEach((info, roomName) => {
      stats.totalUsers += info.userCount;
      stats.rooms.push({
        id: info.spreadsheetId,
        userCount: info.userCount,
        createdAt: info.createdAt,
        lastActivity: info.lastActivity
      });
    });

    return stats;
  }
}