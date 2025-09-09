import { Socket } from 'socket.io';
import { memoryStore } from '../../services/memory-store.service';
import { CursorPosition } from '../../types/collaboration.types';
import { logger } from '../../utils/logger';

export class CursorHandler {
  /**
   * Gère le mouvement du curseur
   */
  static handleCursorMove(socket: Socket, data: any): void {
    try {
      const { row, column, sheet } = data;
      const spreadsheetId = socket.data.spreadsheetId;
      const userId = socket.data.userId || socket.id;
      const userName = socket.data.userName || 'Anonymous';
      const userColor = socket.data.userColor || '#000000';

      if (!spreadsheetId) {
        socket.emit('error', { message: 'Not connected to a spreadsheet' });
        return;
      }

      // Validation des coordonnées
      if (typeof row !== 'number' || typeof column !== 'number') {
        socket.emit('error', { message: 'Invalid cursor position' });
        return;
      }

      if (row < 0 || column < 0) {
        socket.emit('error', { message: 'Cursor position must be non-negative' });
        return;
      }

      // Création de la position du curseur
      const cursorPosition: CursorPosition = {
        row,
        column,
        sheet
      };

      // Met à jour la position dans le store
      memoryStore.updateCursorPosition(spreadsheetId, socket.id, cursorPosition);

      // Diffuse la position aux autres utilisateurs
      socket.to(`spreadsheet:${spreadsheetId}`).emit('cursor-updated', {
        userId,
        userName,
        color: userColor,
        position: cursorPosition,
        timestamp: Date.now()
      });

      logger.debug('Cursor position updated', {
        spreadsheetId,
        userId,
        position: cursorPosition
      });

    } catch (error) {
      logger.error('Error handling cursor move', error);
      socket.emit('error', { message: 'Failed to update cursor position' });
    }
  }

  /**
   * Gère la sélection de cellules
   */
  static handleSelectionChange(socket: Socket, data: any): void {
    try {
      const { startRow, startColumn, endRow, endColumn, sheet } = data;
      const spreadsheetId = socket.data.spreadsheetId;
      const userId = socket.data.userId || socket.id;
      const userName = socket.data.userName || 'Anonymous';
      const userColor = socket.data.userColor || '#000000';

      if (!spreadsheetId) {
        socket.emit('error', { message: 'Not connected to a spreadsheet' });
        return;
      }

      // Validation de la sélection
      if (
        typeof startRow !== 'number' || 
        typeof startColumn !== 'number' ||
        typeof endRow !== 'number' || 
        typeof endColumn !== 'number'
      ) {
        socket.emit('error', { message: 'Invalid selection coordinates' });
        return;
      }

      if (
        startRow < 0 || startColumn < 0 || 
        endRow < 0 || endColumn < 0
      ) {
        socket.emit('error', { message: 'Selection coordinates must be non-negative' });
        return;
      }

      // Normalise la sélection (s'assure que start <= end)
      const selection = {
        startRow: Math.min(startRow, endRow),
        startColumn: Math.min(startColumn, endColumn),
        endRow: Math.max(startRow, endRow),
        endColumn: Math.max(startColumn, endColumn),
        sheet
      };

      // Met à jour la sélection dans le store
      memoryStore.updateSelection(spreadsheetId, socket.id, selection);

      // Diffuse la sélection aux autres utilisateurs
      socket.to(`spreadsheet:${spreadsheetId}`).emit('selection-updated', {
        userId,
        userName,
        color: userColor,
        selection,
        timestamp: Date.now()
      });

      logger.debug('Selection updated', {
        spreadsheetId,
        userId,
        selection
      });

    } catch (error) {
      logger.error('Error handling selection change', error);
      socket.emit('error', { message: 'Failed to update selection' });
    }
  }

  /**
   * Efface la sélection d'un utilisateur
   */
  static handleClearSelection(socket: Socket): void {
    try {
      const spreadsheetId = socket.data.spreadsheetId;
      const userId = socket.data.userId || socket.id;

      if (!spreadsheetId) {
        return;
      }

      // Supprime la sélection du store
      memoryStore.removeSelection(spreadsheetId, socket.id);

      // Notifie les autres utilisateurs
      socket.to(`spreadsheet:${spreadsheetId}`).emit('selection-cleared', {
        userId,
        timestamp: Date.now()
      });

      logger.debug('Selection cleared', {
        spreadsheetId,
        userId
      });

    } catch (error) {
      logger.error('Error clearing selection', error);
    }
  }

  /**
   * Récupère toutes les positions de curseur actives
   */
  static handleGetCursors(socket: Socket): void {
    try {
      const spreadsheetId = socket.data.spreadsheetId;

      if (!spreadsheetId) {
        socket.emit('error', { message: 'Not connected to a spreadsheet' });
        return;
      }

      // Récupère tous les utilisateurs et leurs curseurs
      const users = memoryStore.getUsers(spreadsheetId);
      const cursors = users
        .filter(user => user.cursor && user.socketId !== socket.id)
        .map(user => ({
          userId: user.id,
          userName: user.name,
          color: user.color,
          position: user.cursor
        }));

      socket.emit('all-cursors', {
        cursors,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error getting cursors', error);
      socket.emit('error', { message: 'Failed to get cursors' });
    }
  }

  /**
   * Récupère toutes les sélections actives
   */
  static handleGetSelections(socket: Socket): void {
    try {
      const spreadsheetId = socket.data.spreadsheetId;

      if (!spreadsheetId) {
        socket.emit('error', { message: 'Not connected to a spreadsheet' });
        return;
      }

      // Récupère tous les utilisateurs et leurs sélections
      const users = memoryStore.getUsers(spreadsheetId);
      const selections = users
        .filter(user => user.selection && user.socketId !== socket.id)
        .map(user => ({
          userId: user.id,
          userName: user.name,
          color: user.color,
          selection: user.selection
        }));

      socket.emit('all-selections', {
        selections,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error getting selections', error);
      socket.emit('error', { message: 'Failed to get selections' });
    }
  }
}