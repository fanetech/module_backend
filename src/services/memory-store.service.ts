import { 
  CollaborationUser, 
  CollaborationSession, 
  CursorPosition, 
  CellSelection,
  UserPresence
} from '../types/collaboration.types';
import { CellChange } from '../types/spreadsheet.types';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export class MemoryStoreService {
  // Stockage temporaire des utilisateurs connectés
  private connectedUsers = new Map<string, Set<CollaborationUser>>();
  
  // Stockage temporaire des modifications en attente
  private pendingChanges = new Map<string, CellChange[]>();
  
  // Cache temporaire des positions de curseurs
  private cursorPositions = new Map<string, Map<string, CursorPosition>>();
  
  // Sessions actives
  private activeSessions = new Map<string, CollaborationSession>();

  // Sélections des utilisateurs
  private userSelections = new Map<string, Map<string, CellSelection>>();

  constructor() {
    // Nettoyage périodique des données obsolètes
    setInterval(() => this.cleanup(), 60000); // Toutes les minutes
  }

  /**
   * Ajoute un utilisateur à une session spreadsheet
   */
  addUser(spreadsheetId: string, user: CollaborationUser): void {
    if (!this.connectedUsers.has(spreadsheetId)) {
      this.connectedUsers.set(spreadsheetId, new Set());
    }
    
    this.connectedUsers.get(spreadsheetId)!.add(user);
    
    // Initialise ou met à jour la session
    if (!this.activeSessions.has(spreadsheetId)) {
      this.activeSessions.set(spreadsheetId, {
        spreadsheetId,
        users: new Map(),
        startedAt: new Date(),
        lastActivity: new Date()
      });
    }
    
    const session = this.activeSessions.get(spreadsheetId)!;
    session.users.set(user.socketId, user);
    session.lastActivity = new Date();
    
    logger.info(`User ${user.name} joined spreadsheet ${spreadsheetId}`);
  }

  /**
   * Retire un utilisateur d'une session
   */
  removeUser(spreadsheetId: string, socketId: string): CollaborationUser | undefined {
    const users = this.connectedUsers.get(spreadsheetId);
    let removedUser: CollaborationUser | undefined;
    
    if (users) {
      users.forEach(user => {
        if (user.socketId === socketId) {
          removedUser = user;
          users.delete(user);
        }
      });
      
      // Supprime le set s'il est vide
      if (users.size === 0) {
        this.connectedUsers.delete(spreadsheetId);
      }
    }
    
    // Nettoie les données associées
    this.removeCursorPosition(spreadsheetId, socketId);
    this.removeSelection(spreadsheetId, socketId);
    
    // Met à jour la session
    const session = this.activeSessions.get(spreadsheetId);
    if (session) {
      session.users.delete(socketId);
      if (session.users.size === 0) {
        this.activeSessions.delete(spreadsheetId);
      }
    }
    
    if (removedUser) {
      logger.info(`User ${removedUser.name} left spreadsheet ${spreadsheetId}`);
    }
    
    return removedUser;
  }

  /**
   * Récupère tous les utilisateurs d'un spreadsheet
   */
  getUsers(spreadsheetId: string): CollaborationUser[] {
    const users = this.connectedUsers.get(spreadsheetId);
    return users ? Array.from(users) : [];
  }

  /**
   * Récupère un utilisateur spécifique
   */
  getUser(spreadsheetId: string, socketId: string): CollaborationUser | undefined {
    const users = this.connectedUsers.get(spreadsheetId);
    if (users) {
      for (const user of users) {
        if (user.socketId === socketId) {
          return user;
        }
      }
    }
    return undefined;
  }

  /**
   * Met à jour la position du curseur
   */
  updateCursorPosition(spreadsheetId: string, socketId: string, position: CursorPosition): void {
    if (!this.cursorPositions.has(spreadsheetId)) {
      this.cursorPositions.set(spreadsheetId, new Map());
    }
    
    this.cursorPositions.get(spreadsheetId)!.set(socketId, position);
    
    // Met à jour l'utilisateur
    const user = this.getUser(spreadsheetId, socketId);
    if (user) {
      user.cursor = position;
      user.lastActivity = new Date();
    }
  }

  /**
   * Récupère la position du curseur
   */
  getCursorPosition(spreadsheetId: string, socketId: string): CursorPosition | undefined {
    return this.cursorPositions.get(spreadsheetId)?.get(socketId);
  }

  /**
   * Supprime la position du curseur
   */
  removeCursorPosition(spreadsheetId: string, socketId: string): void {
    this.cursorPositions.get(spreadsheetId)?.delete(socketId);
  }

  /**
   * Met à jour la sélection d'un utilisateur
   */
  updateSelection(spreadsheetId: string, socketId: string, selection: CellSelection): void {
    if (!this.userSelections.has(spreadsheetId)) {
      this.userSelections.set(spreadsheetId, new Map());
    }
    
    this.userSelections.get(spreadsheetId)!.set(socketId, selection);
    
    // Met à jour l'utilisateur
    const user = this.getUser(spreadsheetId, socketId);
    if (user) {
      user.selection = selection;
      user.lastActivity = new Date();
    }
  }

  /**
   * Récupère la sélection d'un utilisateur
   */
  getSelection(spreadsheetId: string, socketId: string): CellSelection | undefined {
    return this.userSelections.get(spreadsheetId)?.get(socketId);
  }

  /**
   * Supprime la sélection d'un utilisateur
   */
  removeSelection(spreadsheetId: string, socketId: string): void {
    this.userSelections.get(spreadsheetId)?.delete(socketId);
  }

  /**
   * Ajoute un changement en attente
   */
  addPendingChange(spreadsheetId: string, change: CellChange): void {
    if (!this.pendingChanges.has(spreadsheetId)) {
      this.pendingChanges.set(spreadsheetId, []);
    }
    
    this.pendingChanges.get(spreadsheetId)!.push(change);
  }

  /**
   * Récupère et vide les changements en attente
   */
  flushPendingChanges(spreadsheetId: string): CellChange[] {
    const changes = this.pendingChanges.get(spreadsheetId) || [];
    this.pendingChanges.delete(spreadsheetId);
    return changes;
  }

  /**
   * Récupère les changements en attente sans les supprimer
   */
  getPendingChanges(spreadsheetId: string): CellChange[] {
    return this.pendingChanges.get(spreadsheetId) || [];
  }

  /**
   * Récupère la présence de tous les utilisateurs
   */
  getUserPresence(spreadsheetId: string): UserPresence[] {
    const users = this.getUsers(spreadsheetId);
    return users.map(user => ({
      userId: user.id,
      userName: user.name,
      color: user.color,
      isOnline: true,
      lastSeen: user.lastActivity,
      cursor: user.cursor,
      selection: user.selection
    }));
  }

  /**
   * Récupère les informations de session
   */
  getSession(spreadsheetId: string): CollaborationSession | undefined {
    return this.activeSessions.get(spreadsheetId);
  }

  /**
   * Nettoie les données obsolètes
   */
  private cleanup(): void {
    const now = new Date();
    const maxInactivity = 5 * 60 * 1000; // 5 minutes
    
    // Nettoie les sessions inactives
    this.activeSessions.forEach((session, spreadsheetId) => {
      if (now.getTime() - session.lastActivity.getTime() > maxInactivity) {
        logger.info(`Cleaning up inactive session for spreadsheet ${spreadsheetId}`);
        this.activeSessions.delete(spreadsheetId);
        this.connectedUsers.delete(spreadsheetId);
        this.cursorPositions.delete(spreadsheetId);
        this.userSelections.delete(spreadsheetId);
        this.pendingChanges.delete(spreadsheetId);
      }
    });
  }

  /**
   * Statistiques du store
   */
  getStats(): any {
    return {
      activeSessions: this.activeSessions.size,
      totalUsers: Array.from(this.connectedUsers.values())
        .reduce((sum, users) => sum + users.size, 0),
      pendingChanges: Array.from(this.pendingChanges.values())
        .reduce((sum, changes) => sum + changes.length, 0)
    };
  }
}

// Export singleton instance
export const memoryStore = new MemoryStoreService();
