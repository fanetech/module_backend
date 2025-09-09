import { Operation, TransformResult } from '../types/collaboration.types';
import { logger } from '../utils/logger';

/**
 * Service de résolution de conflits basé sur Operational Transformation (OT)
 */
export class ConflictResolutionService {
  
  /**
   * Transforme deux opérations concurrentes
   */
  transform(op1: Operation, op2: Operation): TransformResult {
    const result: TransformResult = {
      operation: op1,
      transformed: false,
      conflicts: []
    };

    // Pas de conflit si les opérations concernent des cellules différentes
    if (op1.cellId !== op2.cellId) {
      return result;
    }

    // Conflit détecté
    logger.debug('Conflict detected between operations:', { op1, op2 });
    result.conflicts.push(`Conflict on cell ${op1.cellId}`);

    // Stratégie de résolution basée sur le timestamp
    if (op1.timestamp === op2.timestamp) {
      // En cas d'égalité, on utilise l'ID utilisateur pour départager
      if (op1.userId < op2.userId) {
        result.operation = op1;
      } else {
        result.operation = op2;
        result.transformed = true;
      }
    } else if (op1.timestamp < op2.timestamp) {
      // op1 est plus ancien, op2 a la priorité
      result.operation = this.mergeOperations(op1, op2);
      result.transformed = true;
    } else {
      // op1 est plus récent et garde la priorité
      result.operation = op1;
    }

    return result;
  }

  /**
   * Fusionne deux opérations sur la même cellule
   */
  private mergeOperations(op1: Operation, op2: Operation): Operation {
    const merged: Operation = { ...op2 };

    switch (op2.type) {
      case 'update':
        // Pour une mise à jour, on garde la valeur la plus récente
        merged.value = op2.value;
        break;

      case 'format':
        // Pour le formatage, on fusionne les propriétés
        if (op1.type === 'format' && op1.format && op2.format) {
          merged.format = { ...op1.format, ...op2.format };
        }
        break;

      case 'delete':
        // Une suppression annule les autres opérations
        merged.type = 'delete';
        merged.value = null;
        merged.format = null;
        break;

      case 'insert':
        // Une insertion remplace tout
        merged.value = op2.value;
        merged.format = op2.format;
        break;
    }

    return merged;
  }

  /**
   * Applique une série de transformations à une opération
   */
  transformAgainstHistory(
    operation: Operation,
    history: Operation[]
  ): TransformResult {
    let currentOp = operation;
    const conflicts: string[] = [];
    let wasTransformed = false;

    for (const historicalOp of history) {
      const result = this.transform(currentOp, historicalOp);
      if (result.transformed) {
        wasTransformed = true;
        currentOp = result.operation;
        conflicts.push(...result.conflicts);
      }
    }

    return {
      operation: currentOp,
      transformed: wasTransformed,
      conflicts
    };
  }

  /**
   * Résout les conflits dans un ensemble d'opérations concurrentes
   */
  resolveConflicts(operations: Operation[]): Operation[] {
    if (operations.length <= 1) {
      return operations;
    }

    // Trie les opérations par timestamp et version
    const sorted = [...operations].sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return a.version - b.version;
    });

    const resolved: Operation[] = [];
    const processed = new Set<string>();

    for (const op of sorted) {
      if (processed.has(op.id)) {
        continue;
      }

      // Transforme contre toutes les opérations déjà résolues
      const result = this.transformAgainstHistory(op, resolved);
      
      // Ajoute l'opération transformée si elle n'est pas en conflit total
      if (!this.isCompleteConflict(result.operation, resolved)) {
        resolved.push(result.operation);
        processed.add(op.id);
      } else {
        logger.warn('Operation completely conflicted and dropped:', op);
      }
    }

    return resolved;
  }

  /**
   * Vérifie si une opération est en conflit total avec l'historique
   */
  private isCompleteConflict(operation: Operation, history: Operation[]): boolean {
    // Une opération est en conflit total si elle tente de modifier
    // une cellule qui a été supprimée
    for (const histOp of history) {
      if (histOp.cellId === operation.cellId && 
          histOp.type === 'delete' && 
          histOp.timestamp < operation.timestamp) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calcule la version suivante pour une opération
   */
  getNextVersion(operations: Operation[]): number {
    if (operations.length === 0) {
      return 1;
    }
    return Math.max(...operations.map(op => op.version)) + 1;
  }

  /**
   * Valide qu'une opération peut être appliquée
   */
  validateOperation(operation: Operation): boolean {
    // Vérifications de base
    if (!operation.id || !operation.cellId || !operation.userId) {
      return false;
    }

    // Vérification du type d'opération
    const validTypes = ['insert', 'delete', 'update', 'format'];
    if (!validTypes.includes(operation.type)) {
      return false;
    }

    // Vérification des coordonnées
    if (operation.row < 0 || operation.column < 0) {
      return false;
    }

    return true;
  }
}

// Export singleton instance
export const conflictResolution = new ConflictResolutionService();
