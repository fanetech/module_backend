import db from '../config/database';
import { 
  CollaborationSession,
  UserPresence,
  Position,
  SelectionRange
} from '../types/spreadsheet.types';
import { v4 as uuidv4 } from 'uuid';

export class CollaborationService {
  // Join collaboration session
  static async joinSession(
    spreadsheetId: string,
    userId: string,
    userName?: string,
    socketId?: string
  ): Promise<CollaborationSession> {
    // Check if user already has an active session
    const existingSession = await db('collaboration_sessions')
      .where({
        spreadsheet_id: spreadsheetId,
        user_id: userId,
        is_active: true
      })
      .first();

    if (existingSession) {
      // Update existing session
      await db('collaboration_sessions')
        .where('id', existingSession.id)
        .update({
          socket_id: socketId,
          last_activity: db.fn.now()
        });

      return existingSession;
    }

    // Create new session
    const session: Partial<CollaborationSession> = {
      id: uuidv4(),
      spreadsheet_id: spreadsheetId,
      user_id: userId,
      user_name: userName || `User ${userId.substring(0, 6)}`,
      socket_id: socketId,
      color: this.generateUserColor(),
      is_active: true
    };

    await db('collaboration_sessions').insert(session);
    return session as CollaborationSession;
  }

  // Leave collaboration session
  static async leaveSession(socketId: string): Promise<void> {
    await db('collaboration_sessions')
      .where('socket_id', socketId)
      .update({
        is_active: false,
        socket_id: null,
        last_activity: db.fn.now()
      });
  }

  // Get active users for a spreadsheet
  static async getActiveUsers(spreadsheetId: string): Promise<UserPresence[]> {
    const sessions = await db('collaboration_sessions')
      .where({
        spreadsheet_id: spreadsheetId,
        is_active: true
      })
      .orderBy('joined_at', 'asc');

    return sessions.map((session: any) => {
      // Parse JSON fields
      if (session.cursor_position) {
        session.cursor_position = typeof session.cursor_position === 'string' 
          ? JSON.parse(session.cursor_position) 
          : session.cursor_position;
      }
      if (session.selection_range) {
        session.selection_range = typeof session.selection_range === 'string' 
          ? JSON.parse(session.selection_range) 
          : session.selection_range;
      }

      return {
        user_id: session.user_id,
        user_name: session.user_name,
        socket_id: session.socket_id,
        color: session.color,
        cursor_position: session.cursor_position,
        selection_range: session.selection_range,
        is_active: session.is_active,
        last_activity: session.last_activity
      };
    });
  }

  // Update cursor position
  static async updateCursorPosition(
    socketId: string,
    position: Position
  ): Promise<void> {
    await db('collaboration_sessions')
      .where('socket_id', socketId)
      .update({
        cursor_position: JSON.stringify(position),
        last_activity: db.fn.now()
      });
  }

  // Update selection range
  static async updateSelectionRange(
    socketId: string,
    range: SelectionRange
  ): Promise<void> {
    await db('collaboration_sessions')
      .where('socket_id', socketId)
      .update({
        selection_range: JSON.stringify(range),
        last_activity: db.fn.now()
      });
  }

  // Clear selection
  static async clearSelection(socketId: string): Promise<void> {
    await db('collaboration_sessions')
      .where('socket_id', socketId)
      .update({
        selection_range: null,
        last_activity: db.fn.now()
      });
  }

  // Get session by socket ID
  static async getSessionBySocketId(socketId: string): Promise<CollaborationSession | null> {
    const session = await db('collaboration_sessions')
      .where('socket_id', socketId)
      .first();

    if (session) {
      // Parse JSON fields
      if (session.cursor_position) {
        session.cursor_position = typeof session.cursor_position === 'string' 
          ? JSON.parse(session.cursor_position) 
          : session.cursor_position;
      }
      if (session.selection_range) {
        session.selection_range = typeof session.selection_range === 'string' 
          ? JSON.parse(session.selection_range) 
          : session.selection_range;
      }
    }

    return session;
  }

  // Clean up inactive sessions
  static async cleanupInactiveSessions(maxInactiveMinutes: number = 30): Promise<number> {
    const cutoffTime = new Date(Date.now() - maxInactiveMinutes * 60 * 1000);

    const result = await db('collaboration_sessions')
      .where('is_active', true)
      .where('last_activity', '<', cutoffTime)
      .update({
        is_active: false,
        socket_id: null
      });

    return result;
  }

  // Get collaboration statistics
  static async getCollaborationStats(): Promise<any> {
    const [totalSessions, activeSessions, uniqueUsers, activeSpreadsheets] = await Promise.all([
      db('collaboration_sessions').count('* as count').first(),
      db('collaboration_sessions').where('is_active', true).count('* as count').first(),
      db('collaboration_sessions').countDistinct('user_id as count').first(),
      db('collaboration_sessions')
        .where('is_active', true)
        .countDistinct('spreadsheet_id as count')
        .first()
    ]);

    return {
      totalSessions: totalSessions?.count || 0,
      activeSessions: activeSessions?.count || 0,
      uniqueUsers: uniqueUsers?.count || 0,
      activeSpreadsheets: activeSpreadsheets?.count || 0
    };
  }

  // Generate a random color for user cursor
  private static generateUserColor(): string {
    const colors = [
      '#FF5733', '#33FF57', '#3357FF', '#FF33F5', '#F5FF33',
      '#33FFF5', '#FF8C33', '#8C33FF', '#33FF8C', '#FF3333',
      '#33FF33', '#3333FF', '#FFFF33', '#FF33FF', '#33FFFF',
      '#FFA500', '#800080', '#008080', '#FF1493', '#00CED1'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Check if user has access to spreadsheet (placeholder for future auth)
  static async checkUserAccess(userId: string, spreadsheetId: string): Promise<boolean> {
    // For now, everyone has access
    // In the future, this would check permissions
    return true;
  }

  // Record user activity
  static async recordActivity(socketId: string): Promise<void> {
    await db('collaboration_sessions')
      .where('socket_id', socketId)
      .update({
        last_activity: db.fn.now()
      });
  }
}
