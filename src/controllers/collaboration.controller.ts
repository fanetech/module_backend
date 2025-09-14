import { Request, Response } from 'express';
import { CollaborationService } from '../services/collaboration.service';
import { ApiResponse } from '../types/spreadsheet.types';

export class CollaborationController {
  // Join collaboration session
  static async joinSession(req: Request, res: Response): Promise<void> {
    try {
      const { spreadsheetId } = req.params;
      const { userId, userName, socketId } = req.body;

      const session = await CollaborationService.joinSession(
        spreadsheetId,
        userId,
        userName,
        socketId
      );

      const response: ApiResponse<any> = {
        success: true,
        data: session
      };

      res.json(response);
    } catch (error) {
      console.error('Error joining session:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to join collaboration session',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // Leave collaboration session
  static async leaveSession(req: Request, res: Response): Promise<void> {
    try {
      const { socketId } = req.params;

      await CollaborationService.leaveSession(socketId);

      const response: ApiResponse<any> = {
        success: true,
        message: 'Left collaboration session successfully'
      };

      res.json(response);
    } catch (error) {
      console.error('Error leaving session:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to leave collaboration session',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // Get active users for a spreadsheet
  static async getActiveUsers(req: Request, res: Response): Promise<void> {
    try {
      const { spreadsheetId } = req.params;

      const users = await CollaborationService.getActiveUsers(spreadsheetId);

      const response: ApiResponse<any> = {
        success: true,
        data: users
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting active users:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to fetch active users',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // Update cursor position
  static async updateCursorPosition(req: Request, res: Response): Promise<void> {
    try {
      const { socketId } = req.params;
      const { position } = req.body;

      await CollaborationService.updateCursorPosition(socketId, position);

      const response: ApiResponse<any> = {
        success: true,
        message: 'Cursor position updated'
      };

      res.json(response);
    } catch (error) {
      console.error('Error updating cursor position:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to update cursor position',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // Update selection range
  static async updateSelectionRange(req: Request, res: Response): Promise<void> {
    try {
      const { socketId } = req.params;
      const { range } = req.body;

      await CollaborationService.updateSelectionRange(socketId, range);

      const response: ApiResponse<any> = {
        success: true,
        message: 'Selection range updated'
      };

      res.json(response);
    } catch (error) {
      console.error('Error updating selection range:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to update selection range',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // Clear selection
  static async clearSelection(req: Request, res: Response): Promise<void> {
    try {
      const { socketId } = req.params;

      await CollaborationService.clearSelection(socketId);

      const response: ApiResponse<any> = {
        success: true,
        message: 'Selection cleared'
      };

      res.json(response);
    } catch (error) {
      console.error('Error clearing selection:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to clear selection',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // Clean up inactive sessions
  static async cleanupInactiveSessions(req: Request, res: Response): Promise<void> {
    try {
      const { maxInactiveMinutes } = req.body;

      const cleaned = await CollaborationService.cleanupInactiveSessions(
        maxInactiveMinutes || 30
      );

      const response: ApiResponse<any> = {
        success: true,
        data: {
          sessions_cleaned: cleaned
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error cleaning up sessions:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to cleanup inactive sessions',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }

  // Get collaboration statistics
  static async getCollaborationStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await CollaborationService.getCollaborationStats();

      const response: ApiResponse<any> = {
        success: true,
        data: stats
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting collaboration stats:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: 'Failed to fetch collaboration statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  }
}
