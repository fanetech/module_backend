import { OperationalTransform } from '../src/utils/ot-transform';
import { Operation } from '../src/types/collaboration.types';

describe('OperationalTransform', () => {
  describe('transformOperation', () => {
    it('should not transform operations on different cells', () => {
      const op1: Operation = {
        id: '1',
        type: 'update',
        cellId: 'A1',
        row: 0,
        column: 0,
        value: 'value1',
        timestamp: 1000,
        userId: 'user1',
        version: 1
      };

      const op2: Operation = {
        id: '2',
        type: 'update',
        cellId: 'B1',
        row: 0,
        column: 1,
        value: 'value2',
        timestamp: 2000,
        userId: 'user2',
        version: 1
      };

      const result = OperationalTransform.transformOperation(op1, op2);
      expect(result.cellId).toBe(op1.cellId);
      expect(result.value).toBe(op1.value);
    });

    it('should resolve conflicts based on timestamp', () => {
      const op1: Operation = {
        id: '1',
        type: 'update',
        cellId: 'A1',
        row: 0,
        column: 0,
        value: 'value1',
        timestamp: 1000,
        userId: 'user1',
        version: 1
      };

      const op2: Operation = {
        id: '2',
        type: 'update',
        cellId: 'A1',
        row: 0,
        column: 0,
        value: 'value2',
        timestamp: 2000,
        userId: 'user2',
        version: 1
      };

      const result = OperationalTransform.transformOperation(op1, op2);
      expect(result.value).toBe('value2'); // op2 has later timestamp
    });
  });

  describe('hasConflict', () => {
    it('should detect conflicts on same cell', () => {
      const op1: Operation = {
        id: '1',
        type: 'update',
        cellId: 'A1',
        row: 0,
        column: 0,
        value: 'value1',
        timestamp: 1000,
        userId: 'user1',
        version: 1
      };

      const op2: Operation = {
        id: '2',
        type: 'update',
        cellId: 'A1',
        row: 0,
        column: 0,
        value: 'value2',
        timestamp: 2000,
        userId: 'user2',
        version: 1
      };

      expect(OperationalTransform.hasConflict(op1, op2)).toBe(true);
    });

    it('should not detect conflict for same user', () => {
      const op1: Operation = {
        id: '1',
        type: 'update',
        cellId: 'A1',
        row: 0,
        column: 0,
        value: 'value1',
        timestamp: 1000,
        userId: 'user1',
        version: 1
      };

      const op2: Operation = {
        id: '2',
        type: 'update',
        cellId: 'A1',
        row: 0,
        column: 0,
        value: 'value2',
        timestamp: 2000,
        userId: 'user1',
        version: 1
      };

      expect(OperationalTransform.hasConflict(op1, op2)).toBe(false);
    });
  });
});
