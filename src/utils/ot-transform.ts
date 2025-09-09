import { Operation } from '../types/collaboration.types';

/**
 * Implémentation simplifiée d'Operational Transformation
 * pour la synchronisation en temps réel
 */
export class OperationalTransform {
  
  /**
   * Transforme une opération op1 contre une opération op2
   * Retourne op1' tel que: op1 ∘ op2 = op2' ∘ op1'
   */
  static transformOperation(op1: Operation, op2: Operation): Operation {
    // Si les opérations affectent des cellules différentes, pas de transformation nécessaire
    if (op1.cellId !== op2.cellId) {
      return op1;
    }

    // Clone l'opération pour éviter les mutations
    const transformed: Operation = { ...op1 };

    // Gestion selon les types d'opérations
    switch (op1.type) {
      case 'update':
        transformed.value = this.transformUpdate(op1, op2);
        break;
      
      case 'insert':
        transformed.row = this.transformInsertPosition(op1, op2);
        break;
      
      case 'delete':
        if (op2.type === 'delete' && op1.cellId === op2.cellId) {
          // Double suppression - on annule
          transformed.type = 'update';
          transformed.value = null;
        }
        break;
      
      case 'format':
        transformed.format = this.transformFormat(op1, op2);
        break;
    }

    // Mise à jour de la version
    transformed.version = Math.max(op1.version, op2.version) + 1;

    return transformed;
  }

  /**
   * Transforme une valeur de mise à jour
   */
  private static transformUpdate(op1: Operation, op2: Operation): any {
    // Stratégie: Last Write Wins basé sur le timestamp
    if (op2.timestamp > op1.timestamp) {
      return op2.value;
    }
    return op1.value;
  }

  /**
   * Transforme une position d'insertion
   */
  private static transformInsertPosition(op1: Operation, op2: Operation): number {
    if (op2.type === 'insert') {
      // Si op2 insère avant op1, décale op1
      if (op2.row <= op1.row) {
        return op1.row + 1;
      }
    } else if (op2.type === 'delete') {
      // Si op2 supprime avant op1, décale op1 vers le haut
      if (op2.row < op1.row) {
        return op1.row - 1;
      }
    }
    return op1.row;
  }

  /**
   * Transforme le formatage
   */
  private static transformFormat(op1: Operation, op2: Operation): any {
    if (!op1.format || !op2.format) {
      return op1.format;
    }

    // Fusionne les formats, op2 a la priorité pour les propriétés en conflit
    return {
      ...op1.format,
      ...op2.format
    };
  }

  /**
   * Compose deux opérations en une seule
   */
  static composeOperations(op1: Operation, op2: Operation): Operation | null {
    // Si les opérations affectent des cellules différentes, pas de composition possible
    if (op1.cellId !== op2.cellId) {
      return null;
    }

    // Création de l'opération composée
    const composed: Operation = {
      ...op2,
      id: `${op1.id}-${op2.id}`,
      timestamp: op2.timestamp,
      version: op2.version
    };

    // Logique de composition selon les types
    if (op1.type === 'update' && op2.type === 'update') {
      // Deux mises à jour successives = dernière valeur
      composed.value = op2.value;
    } else if (op1.type === 'insert' && op2.type === 'delete') {
      // Insertion puis suppression = rien
      return null;
    } else if (op1.type === 'format' && op2.type === 'format') {
      // Deux formatages = fusion
      composed.format = { ...op1.format, ...op2.format };
    }

    return composed;
  }

  /**
   * Inverse une opération
   */
  static invertOperation(op: Operation): Operation {
    const inverted: Operation = {
      ...op,
      id: `inv-${op.id}`,
      timestamp: Date.now()
    };

    switch (op.type) {
      case 'insert':
        inverted.type = 'delete';
        inverted.value = null;
        break;
      
      case 'delete':
        inverted.type = 'insert';
        // La valeur devrait être stockée quelque part pour pouvoir la restaurer
        break;
      
      case 'update':
        // Pour inverser une mise à jour, il faudrait connaître la valeur précédente
        // Dans un système complet, cela serait stocké
        inverted.value = null; // Placeholder
        break;
      
      case 'format':
        // Pour inverser un formatage, il faudrait le format précédent
        inverted.format = {}; // Reset format
        break;
    }

    return inverted;
  }

  /**
   * Vérifie si deux opérations sont en conflit
   */
  static hasConflict(op1: Operation, op2: Operation): boolean {
    // Pas de conflit si cellules différentes
    if (op1.cellId !== op2.cellId) {
      return false;
    }

    // Pas de conflit si les opérations sont du même utilisateur
    if (op1.userId === op2.userId) {
      return false;
    }

    // Conflit si les deux modifient la valeur
    if ((op1.type === 'update' || op1.type === 'insert') &&
        (op2.type === 'update' || op2.type === 'insert')) {
      return true;
    }

    // Conflit si l'une supprime et l'autre modifie
    if ((op1.type === 'delete' && op2.type !== 'delete') ||
        (op2.type === 'delete' && op1.type !== 'delete')) {
      return true;
    }

    return false;
  }

  /**
   * Applique une liste d'opérations transformées dans l'ordre
   */
  static applyOperations(operations: Operation[]): Map<string, any> {
    const state = new Map<string, any>();

    for (const op of operations) {
      switch (op.type) {
        case 'insert':
        case 'update':
          state.set(op.cellId, op.value);
          break;
        
        case 'delete':
          state.delete(op.cellId);
          break;
        
        case 'format':
          const current = state.get(op.cellId) || {};
          state.set(op.cellId, {
            ...current,
            format: op.format
          });
          break;
      }
    }

    return state;
  }
}

/**
 * Génère une couleur aléatoire pour un utilisateur
 */
export function generateUserColor(): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#F8B739',
    '#52B788', '#F72585', '#4CC9F0', '#7209B7', '#F9C74F'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Calcule un hash simple pour un ID de cellule
 */
export function hashCellId(row: number, column: number): string {
  return `${row}_${column}`;
}

/**
 * Parse un ID de cellule pour récupérer row et column
 */
export function parseCellId(cellId: string): { row: number; column: number } {
  const [row, column] = cellId.split('_').map(Number);
  return { row, column };
}

/**
 * Convertit un index de colonne en lettre (0 -> A, 1 -> B, etc.)
 */
export function columnIndexToLetter(index: number): string {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
}

/**
 * Convertit une lettre de colonne en index (A -> 0, B -> 1, etc.)
 */
export function columnLetterToIndex(letter: string): number {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 65) + 1;
  }
  return index - 1;
}

/**
 * Génère une référence de cellule style Excel (A1, B2, etc.)
 */
export function getCellReference(row: number, column: number): string {
  return `${columnIndexToLetter(column)}${row + 1}`;
}

/**
 * Parse une référence de cellule style Excel
 */
export function parseCellReference(reference: string): { row: number; column: number } {
  const match = reference.match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    throw new Error(`Invalid cell reference: ${reference}`);
  }
  
  const column = columnLetterToIndex(match[1]);
  const row = parseInt(match[2], 10) - 1;
  
  return { row, column };
}
