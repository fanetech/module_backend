import { logger } from '../utils/logger';
import { ICell } from '../models/Cell.model';
import { hyperFormulaEngine, FormulaUpdateResult } from './hyperformula-engine.service';

export interface CellUpdate {
  address: string;
  row: number;
  col: number;
  value?: any;
  formula?: string;
  baseVersion: number;
  timestamp: number;
  userId: string;
  changeType: 'value' | 'formula' | 'format' | 'delete';
}

export interface ConflictDetection {
  hasConflict: boolean;
  conflictType: 'version' | 'concurrent' | 'dependency' | 'none';
  conflictingUpdates: CellUpdate[];
  resolution: 'backend_wins' | 'timestamp_wins' | 'user_priority' | 'merge';
}

export interface VersionedUpdate {
  update: CellUpdate;
  resolvedVersion: number;
  calculatedValue: any;
  affectedCells: string[];
  conflicts: ConflictDetection;
}

export interface BatchVersionedUpdate {
  updates: VersionedUpdate[];
  globalVersion: number;
  totalConflicts: number;
  processingTime: number;
}

/**
 * Version control service for HyperFormula dual-engine architecture
 * Handles conflict resolution and maintains authoritative state
 */
export class VersionControlService {
  private spreadsheetVersions: Map<string, number> = new Map();
  private cellVersions: Map<string, Map<string, number>> = new Map();
  private pendingUpdates: Map<string, CellUpdate[]> = new Map();
  private updateQueue: Map<string, CellUpdate[]> = new Map();

  /**
   * Process a single cell update with version control
   */
  async processUpdate(
    spreadsheetId: string,
    update: CellUpdate,
    currentCellVersion?: number
  ): Promise<VersionedUpdate> {
    const startTime = Date.now();

    try {
      // Get current versions
      const globalVersion = this.getSpreadsheetVersion(spreadsheetId);
      const cellVersion = this.getCellVersion(spreadsheetId, update.address);

      // Detect conflicts
      const conflicts = this.detectConflicts(
        spreadsheetId,
        update,
        cellVersion,
        currentCellVersion
      );

      // Resolve conflicts if any
      const resolvedUpdate = conflicts.hasConflict
        ? this.resolveConflict(update, conflicts)
        : update;

      // Update HyperFormula engine with resolved value
      const formulaResult = hyperFormulaEngine.updateCell(
        resolvedUpdate.address,
        resolvedUpdate.value,
        resolvedUpdate.formula
      );

      if (!formulaResult.success) {
        throw new Error(`HyperFormula update failed: ${formulaResult.error}`);
      }

      // Update version tracking
      const newVersion = this.incrementCellVersion(spreadsheetId, update.address);
      this.incrementSpreadsheetVersion(spreadsheetId);

      const versionedUpdate: VersionedUpdate = {
        update: resolvedUpdate,
        resolvedVersion: newVersion,
        calculatedValue: formulaResult.calculatedValue,
        affectedCells: formulaResult.dependentCells,
        conflicts
      };

      logger.debug('Cell update processed with version control', {
        spreadsheetId,
        address: update.address,
        version: newVersion,
        hasConflicts: conflicts.hasConflict,
        processingTime: Date.now() - startTime
      });

      return versionedUpdate;

    } catch (error) {
      logger.error('Failed to process versioned update', {
        spreadsheetId,
        address: update.address,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Process multiple cell updates as a batch
   */
  async processBatchUpdates(
    spreadsheetId: string,
    updates: CellUpdate[]
  ): Promise<BatchVersionedUpdate> {
    const startTime = Date.now();

    try {
      // Sort updates by timestamp to ensure consistent processing order
      const sortedUpdates = [...updates].sort((a, b) => a.timestamp - b.timestamp);

      // Group updates by dependency order
      const dependencyGroups = this.groupByDependencies(sortedUpdates);

      const processedUpdates: VersionedUpdate[] = [];
      let totalConflicts = 0;

      // Process each dependency group sequentially
      for (const group of dependencyGroups) {
        const groupResults = await Promise.all(
          group.map(update => this.processUpdate(spreadsheetId, update))
        );

        processedUpdates.push(...groupResults);
        totalConflicts += groupResults.filter(r => r.conflicts.hasConflict).length;
      }

      const globalVersion = this.getSpreadsheetVersion(spreadsheetId);

      const batchResult: BatchVersionedUpdate = {
        updates: processedUpdates,
        globalVersion,
        totalConflicts,
        processingTime: Date.now() - startTime
      };

      logger.info('Batch updates processed with version control', {
        spreadsheetId,
        updateCount: updates.length,
        conflicts: totalConflicts,
        globalVersion,
        processingTime: batchResult.processingTime
      });

      return batchResult;

    } catch (error) {
      logger.error('Failed to process batch versioned updates', {
        spreadsheetId,
        updateCount: updates.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Detect conflicts in cell updates
   */
  private detectConflicts(
    spreadsheetId: string,
    update: CellUpdate,
    currentCellVersion: number,
    expectedVersion?: number
  ): ConflictDetection {
    const conflicts: ConflictDetection = {
      hasConflict: false,
      conflictType: 'none',
      conflictingUpdates: [],
      resolution: 'backend_wins'
    };

    // Check version conflicts
    if (expectedVersion !== undefined && currentCellVersion !== expectedVersion) {
      conflicts.hasConflict = true;
      conflicts.conflictType = 'version';
      conflicts.resolution = 'backend_wins';

      logger.debug('Version conflict detected', {
        address: update.address,
        currentVersion: currentCellVersion,
        expectedVersion,
        baseVersion: update.baseVersion
      });
    }

    // Check for concurrent updates (same timestamp different users)
    const pendingForCell = this.getPendingUpdatesForCell(spreadsheetId, update.address);
    const concurrentUpdates = pendingForCell.filter(
      pending => Math.abs(pending.timestamp - update.timestamp) < 1000 && // Within 1 second
                 pending.userId !== update.userId
    );

    if (concurrentUpdates.length > 0) {
      conflicts.hasConflict = true;
      conflicts.conflictType = 'concurrent';
      conflicts.conflictingUpdates = concurrentUpdates;
      conflicts.resolution = 'timestamp_wins';

      logger.debug('Concurrent update conflict detected', {
        address: update.address,
        concurrentCount: concurrentUpdates.length
      });
    }

    return conflicts;
  }

  /**
   * Resolve conflicts using various strategies
   */
  private resolveConflict(update: CellUpdate, conflicts: ConflictDetection): CellUpdate {
    switch (conflicts.resolution) {
      case 'backend_wins':
        // Backend version always wins - no change to update
        return update;

      case 'timestamp_wins':
        // Latest timestamp wins
        const latestUpdate = conflicts.conflictingUpdates.reduce((latest, current) =>
          current.timestamp > latest.timestamp ? current : latest, update
        );
        return latestUpdate;

      case 'user_priority':
        // Could implement user-based priority logic here
        return update;

      case 'merge':
        // For certain types of updates, attempt to merge
        return this.mergeUpdates(update, conflicts.conflictingUpdates);

      default:
        return update;
    }
  }

  /**
   * Merge conflicting updates when possible
   */
  private mergeUpdates(primary: CellUpdate, conflicting: CellUpdate[]): CellUpdate {
    // Simple merge strategy - for format updates, combine properties
    if (primary.changeType === 'format' && conflicting.some(c => c.changeType === 'format')) {
      const mergedValue = { ...primary.value };

      for (const conflict of conflicting) {
        if (conflict.changeType === 'format' && typeof conflict.value === 'object') {
          Object.assign(mergedValue, conflict.value);
        }
      }

      return { ...primary, value: mergedValue };
    }

    // For value/formula conflicts, latest timestamp wins
    const latest = conflicting.reduce((latest, current) =>
      current.timestamp > latest.timestamp ? current : latest, primary
    );

    return latest;
  }

  /**
   * Group updates by their dependency relationships
   */
  private groupByDependencies(updates: CellUpdate[]): CellUpdate[][] {
    // Simple grouping - in a more sophisticated implementation,
    // this would analyze formula dependencies to determine optimal processing order
    const groups: CellUpdate[][] = [];
    const formulaUpdates: CellUpdate[] = [];
    const valueUpdates: CellUpdate[] = [];

    for (const update of updates) {
      if (update.formula) {
        formulaUpdates.push(update);
      } else {
        valueUpdates.push(update);
      }
    }

    // Process value updates first, then formula updates
    if (valueUpdates.length > 0) groups.push(valueUpdates);
    if (formulaUpdates.length > 0) groups.push(formulaUpdates);

    return groups;
  }

  /**
   * Get current spreadsheet version
   */
  private getSpreadsheetVersion(spreadsheetId: string): number {
    return this.spreadsheetVersions.get(spreadsheetId) || 0;
  }

  /**
   * Get current cell version
   */
  private getCellVersion(spreadsheetId: string, address: string): number {
    const cellVersions = this.cellVersions.get(spreadsheetId);
    return cellVersions?.get(address) || 0;
  }

  /**
   * Increment spreadsheet version
   */
  private incrementSpreadsheetVersion(spreadsheetId: string): number {
    const currentVersion = this.getSpreadsheetVersion(spreadsheetId);
    const newVersion = currentVersion + 1;
    this.spreadsheetVersions.set(spreadsheetId, newVersion);
    return newVersion;
  }

  /**
   * Increment cell version
   */
  private incrementCellVersion(spreadsheetId: string, address: string): number {
    if (!this.cellVersions.has(spreadsheetId)) {
      this.cellVersions.set(spreadsheetId, new Map());
    }

    const cellVersions = this.cellVersions.get(spreadsheetId)!;
    const currentVersion = cellVersions.get(address) || 0;
    const newVersion = currentVersion + 1;
    cellVersions.set(address, newVersion);

    return newVersion;
  }

  /**
   * Get pending updates for a specific cell
   */
  private getPendingUpdatesForCell(spreadsheetId: string, address: string): CellUpdate[] {
    const pending = this.pendingUpdates.get(spreadsheetId) || [];
    return pending.filter(update => update.address === address);
  }

  /**
   * Add update to pending queue
   */
  addPendingUpdate(spreadsheetId: string, update: CellUpdate): void {
    if (!this.pendingUpdates.has(spreadsheetId)) {
      this.pendingUpdates.set(spreadsheetId, []);
    }

    this.pendingUpdates.get(spreadsheetId)!.push(update);
  }

  /**
   * Remove update from pending queue
   */
  removePendingUpdate(spreadsheetId: string, updateId: string): void {
    const pending = this.pendingUpdates.get(spreadsheetId);
    if (pending) {
      const index = pending.findIndex(u => `${u.address}-${u.timestamp}` === updateId);
      if (index !== -1) {
        pending.splice(index, 1);
      }
    }
  }

  /**
   * Clear all pending updates for a spreadsheet
   */
  clearPendingUpdates(spreadsheetId: string): void {
    this.pendingUpdates.delete(spreadsheetId);
  }

  /**
   * Initialize version tracking for a spreadsheet
   */
  initializeSpreadsheet(spreadsheetId: string, cells: ICell[]): void {
    // Set initial spreadsheet version
    this.spreadsheetVersions.set(spreadsheetId, 1);

    // Initialize cell versions
    const cellVersions = new Map<string, number>();
    for (const cell of cells) {
      cellVersions.set(cell.cell_id, cell.version || 1);
    }
    this.cellVersions.set(spreadsheetId, cellVersions);

    logger.info('Version control initialized for spreadsheet', {
      spreadsheetId,
      cellCount: cells.length,
      initialVersion: 1
    });
  }

  /**
   * Get version status for a spreadsheet
   */
  getVersionStatus(spreadsheetId: string): {
    globalVersion: number;
    cellCount: number;
    pendingUpdates: number;
    lastUpdated: Date;
  } {
    const globalVersion = this.getSpreadsheetVersion(spreadsheetId);
    const cellVersions = this.cellVersions.get(spreadsheetId);
    const pendingUpdates = this.pendingUpdates.get(spreadsheetId)?.length || 0;

    return {
      globalVersion,
      cellCount: cellVersions?.size || 0,
      pendingUpdates,
      lastUpdated: new Date()
    };
  }
}

// Singleton instance
export const versionControl = new VersionControlService();