import { Socket } from 'socket.io';
import { memoryStore } from '../../services/memory-store.service';
import { apiProxyService } from '../../services/api-proxy.service';
import { CollaborationUser } from '../../types/collaboration.types';
import { generateUserColor } from '../../utils/ot-transform';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class PresenceHandler {
  /**
   * Gère l'initialisation d'une connexion utilisateur
   */
  static async handleInit(socket: Socket, data: any): Promise<void> {
    try {
      const { token, spreadsheetId } = data;

      if (!token || !spreadsheetId) {
        socket.emit('error', { 
          message: 'Token and spreadsheet ID are required' 
        });
        socket.disconnect();
        return;
      }

      // Stocke les données dans le socket
      socket.data.token = token;
      socket.data.spreadsheetId = spreadsheetId;

      // Optionnel : récupère les infos utilisateur depuis l'API
      try {
        const userInfo = await apiProxyService.getUserInfo(token);
        socket.data.userId = userInfo.id;
        socket.data.userName = userInfo.name;
        socket.data.userEmail = userInfo.email;
        socket.data.userColor = generateUserColor();

        // Crée l'utilisateur collaboratif
        const collaborationUser: CollaborationUser = {
          id: userInfo.id,
          socketId: socket.id,
          name: userInfo.name,
          email: userInfo.email,
          color: socket.data.userColor,
          lastActivity: new Date()
        };

        // Ajoute l'utilisateur au store
        memoryStore.addUser(spreadsheetId, collaborationUser);

        // Joint la room du spreadsheet
        await socket.join(`spreadsheet:${spreadsheetId}`);

        // Récupère la liste des utilisateurs déjà connectés
        const existingUsers = memoryStore.getUsers(spreadsheetId)
          .filter(user => user.socketId !== socket.id)
          .map(user => ({
            userId: user.id,
            userName: user.name,
            color: user.color,
            cursor: user.cursor,
            selection: user.selection
          }));

        // Envoie la confirmation au client avec les infos
        socket.emit('init-success', {
          userId: userInfo.id,
          userName: userInfo.name,
          userColor: socket.data.userColor,
          spreadsheetId,
          existingUsers,
          timestamp: Date.now()
        });

        // Notifie les autres utilisateurs
        socket.to(`spreadsheet:${spreadsheetId}`).emit('user-joined', {
          userId: userInfo.id,
          userName: userInfo.name,
          userColor: socket.data.userColor,
          socketId: socket.id,
          timestamp: Date.now()
        });

        logger.info('User connected to spreadsheet', {
          userId: userInfo.id,
          userName: userInfo.name,
          spreadsheetId,
          socketId: socket.id
        });

      } catch (error) {
        logger.error('Failed to get user info from API', error);
        
        // Connexion anonyme si l'API échoue
        const anonymousId = `anon-${uuidv4()}`;
        socket.data.userId = anonymousId;
        socket.data.userName = 'Anonymous User';
        socket.data.userColor = generateUserColor();

        const anonymousUser: CollaborationUser = {
          id: anonymousId,
          socketId: socket.id,
          name: 'Anonymous User',
          color: socket.data.userColor,
          lastActivity: new Date()
        };

        memoryStore.addUser(spreadsheetId, anonymousUser);
        await socket.join(`spreadsheet:${spreadsheetId}`);

        socket.emit('init-success', {
          userId: anonymousId,
          userName: 'Anonymous User',
          userColor: socket.data.userColor,
          spreadsheetId,
          anonymous: true,
          timestamp: Date.now()
        });

        socket.to(`spreadsheet:${spreadsheetId}`).emit('user-joined', {
          userId: anonymousId,
          userName: 'Anonymous User',
          userColor: socket.data.userColor,
          socketId: socket.id,
          anonymous: true,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      logger.error('Error during socket initialization', error);
      socket.emit('error', { message: 'Failed to initialize connection' });
      socket.disconnect();
    }
  }

  /**
   * Gère la déconnexion d'un utilisateur
   */
  static handleDisconnect(socket: Socket): void {
    try {
      const spreadsheetId = socket.data.spreadsheetId;
      const userId = socket.data.userId;
      const userName = socket.data.userName;

      if (!spreadsheetId) {
        return;
      }

      // Retire l'utilisateur du store
      const removedUser = memoryStore.removeUser(spreadsheetId, socket.id);

      if (removedUser) {
        // Notifie les autres utilisateurs
        socket.to(`spreadsheet:${spreadsheetId}`).emit('user-left', {
          userId: userId || removedUser.id,
          userName: userName || removedUser.name,
          socketId: socket.id,
          timestamp: Date.now()
        });

        logger.info('User disconnected from spreadsheet', {
          userId: userId || removedUser.id,
          userName: userName || removedUser.name,
          spreadsheetId,
          socketId: socket.id
        });
      }

    } catch (error) {
      logger.error('Error during socket disconnect', error);
    }
  }

  /**
   * Récupère la liste des utilisateurs connectés
   */
  static handleGetUsers(socket: Socket): void {
    try {
      const spreadsheetId = socket.data.spreadsheetId;

      if (!spreadsheetId) {
        socket.emit('error', { message: 'Not connected to a spreadsheet' });
        return;
      }

      const users = memoryStore.getUsers(spreadsheetId).map(user => ({
        userId: user.id,
        userName: user.name,
        color: user.color,
        cursor: user.cursor,
        selection: user.selection,
        lastActivity: user.lastActivity
      }));

      socket.emit('users-list', {
        users,
        totalCount: users.length,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error getting users list', error);
      socket.emit('error', { message: 'Failed to get users list' });
    }
  }

  /**
   * Gère le ping pour maintenir la connexion active
   */
  static handlePing(socket: Socket): void {
    try {
      const spreadsheetId = socket.data.spreadsheetId;
      
      if (spreadsheetId) {
        // Met à jour l'activité de l'utilisateur
        const user = memoryStore.getUser(spreadsheetId, socket.id);
        if (user) {
          user.lastActivity = new Date();
        }
      }

      socket.emit('pong', {
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error handling ping', error);
    }
  }

  /**
   * Gère les messages de chat (optionnel)
   */
  static handleChatMessage(socket: Socket, data: any): void {
    try {
      const { message } = data;
      const spreadsheetId = socket.data.spreadsheetId;
      const userId = socket.data.userId || socket.id;
      const userName = socket.data.userName || 'Anonymous';

      if (!spreadsheetId || !message) {
        return;
      }

      // Diffuse le message aux autres utilisateurs
      socket.to(`spreadsheet:${spreadsheetId}`).emit('chat-message', {
        userId,
        userName,
        message,
        timestamp: Date.now()
      });

      logger.debug('Chat message sent', {
        spreadsheetId,
        userId,
        messageLength: message.length
      });

    } catch (error) {
      logger.error('Error handling chat message', error);
    }
  }

  /**
   * Gère le changement de statut d'un utilisateur
   */
  static handleStatusChange(socket: Socket, data: any): void {
    try {
      const { status } = data; // 'active', 'idle', 'away'
      const spreadsheetId = socket.data.spreadsheetId;
      const userId = socket.data.userId || socket.id;
      const userName = socket.data.userName || 'Anonymous';

      if (!spreadsheetId || !status) {
        return;
      }

      // Diffuse le changement de statut
      socket.to(`spreadsheet:${spreadsheetId}`).emit('user-status-changed', {
        userId,
        userName,
        status,
        timestamp: Date.now()
      });

      logger.debug('User status changed', {
        spreadsheetId,
        userId,
        status
      });

    } catch (error) {
      logger.error('Error handling status change', error);
    }
  }
}