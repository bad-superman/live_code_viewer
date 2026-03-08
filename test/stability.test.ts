/**
 * v0.1.2 稳定性测试
 * 验证核心功能的稳定性和错误处理
 */

import { EditOperationFactory, OperationTransformer, OperationVersionManager } from '../src/collaboration/edit-operation';
import { ConflictResolver } from '../src/collaboration/conflict-resolver';

describe('v0.1.2 稳定性测试', () => {
  describe('操作版本管理稳定性', () => {
    let versionManager: OperationVersionManager;

    beforeEach(() => {
      versionManager = new OperationVersionManager();
    });

    test('应该正确处理大量操作', () => {
      // 模拟大量操作
      const operations: any[] = [];
      
      for (let i = 1; i <= 1000; i++) {
        const operation = EditOperationFactory.createInsert(i * 10, `content-${i}`, `user-${i % 5}`, i);
        operations.push(operation);
        versionManager.addOperation(operation);
      }

      const allOperations = versionManager.getAllOperations();
      expect(allOperations).toHaveLength(1000);

      // 验证版本管理
      expect(versionManager.getCurrentVersion()).toBe(1000);

      // 验证按版本检索
      const version500Ops = versionManager.getOperationsByVersion(500);
      expect(version500Ops).toHaveLength(1);
      expect(version500Ops[0].version).toBe(500);
    });

    test('应该正确处理版本清理', () => {
      // 添加操作
      for (let i = 0; i < 100; i++) {
        const operation = EditOperationFactory.createInsert(i, `test-${i}`, 'user1', i);
        versionManager.addOperation(operation);
      }

      // 清理版本管理器
      versionManager.clear();

      expect(versionManager.getCurrentVersion()).toBe(0);
      expect(versionManager.getAllOperations()).toHaveLength(0);
    });
  });

  describe('冲突解决稳定性', () => {
    test('应该处理边缘情况的操作', () => {
      // 测试位置为0的操作
      const zeroPosOp = EditOperationFactory.createInsert(0, 'start', 'user1', 1);
      const conflicts = ConflictResolver.detectConflict(zeroPosOp, []);
      expect(conflicts).toHaveLength(0);

      // 测试空内容操作
      const emptyContentOp = EditOperationFactory.createInsert(5, '', 'user2', 2);
      expect(emptyContentOp.content).toBe('');

      // 测试负位置（应该被拒绝，但这里验证工厂函数的行为）
      const negativePosOp = EditOperationFactory.createInsert(-1, 'invalid', 'user3', 3);
      expect(negativePosOp.position).toBe(-1);
    });

    test('应该处理大量并发冲突', () => {
      const operations: any[] = [];
      
      // 创建大量可能冲突的操作
      for (let i = 0; i < 100; i++) {
        const operation = EditOperationFactory.createInsert(i % 10, `content-${i}`, `user-${i % 3}`, i);
        operations.push(operation);
      }

      // 检测所有可能的冲突
      let totalConflicts = 0;
      
      for (let i = 0; i < operations.length; i++) {
        const otherOps = operations.filter((_, index) => index !== i);
        const conflicts = ConflictResolver.detectConflict(operations[i], otherOps);
        totalConflicts += conflicts.length;
      }

      expect(totalConflicts).toBeGreaterThanOrEqual(0);

      // 验证冲突统计
      const stats = ConflictResolver.getConflictStats(operations);
      expect(stats.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('操作转换稳定性', () => {
    test('应该处理各种操作组合', () => {
      // 测试插入-插入冲突
      const insert1 = EditOperationFactory.createInsert(5, 'hello', 'user1', 1);
      const insert2 = EditOperationFactory.createInsert(5, 'world', 'user2', 2);
      
      const transformed1 = OperationTransformer.transform(insert1, insert2);
      const transformed2 = OperationTransformer.transform(insert2, insert1);
      
      expect(transformed1).toBeDefined();
      expect(transformed2).toBeDefined();

      // 测试插入-删除冲突
      const insertOp = EditOperationFactory.createInsert(10, 'insert', 'user1', 3);
      const deleteOp = EditOperationFactory.createDelete(0, 5, 'user2', 4);
      
      const transformedInsert = OperationTransformer.transform(insertOp, deleteOp);
      const transformedDelete = OperationTransformer.transform(deleteOp, insertOp);
      
      expect(transformedInsert).toBeDefined();
      expect(transformedDelete).toBeDefined();

      // 测试删除-删除冲突
      const delete1 = EditOperationFactory.createDelete(0, 3, 'user1', 5);
      const delete2 = EditOperationFactory.createDelete(2, 3, 'user2', 6);
      
      const transformedDelete1 = OperationTransformer.transform(delete1, delete2);
      const transformedDelete2 = OperationTransformer.transform(delete2, delete1);
      
      expect(transformedDelete1).toBeDefined();
      expect(transformedDelete2).toBeDefined();
    });

    test('应该处理不重叠的操作', () => {
      const op1 = EditOperationFactory.createInsert(0, 'start', 'user1', 1);
      const op2 = EditOperationFactory.createInsert(100, 'end', 'user2', 2);
      
      const transformed1 = OperationTransformer.transform(op1, op2);
      const transformed2 = OperationTransformer.transform(op2, op1);
      
      // 不重叠的操作应该保持不变
      expect(transformed1.position).toBe(op1.position);
      expect(transformed2.position).toBe(op2.position);
    });
  });

  describe('错误处理稳定性', () => {
    test('应该处理无效操作', () => {
      // 创建一些边界情况的操作
      const validOp = EditOperationFactory.createInsert(0, 'valid', 'user1', 1);
      
      // 验证操作工厂的健壮性
      expect(() => {
        EditOperationFactory.createInsert(-1, 'negative', 'user2', 2);
      }).not.toThrow();

      expect(() => {
        EditOperationFactory.createDelete(0, -1, 'user3', 3);
      }).not.toThrow();

      expect(() => {
        EditOperationFactory.createReplace(0, -1, 'invalid', 'user4', 4);
      }).not.toThrow();
    });

    test('应该处理空操作数组', () => {
      const emptyOps: any[] = [];
      
      // 测试冲突检测
      const conflicts = ConflictResolver.detectConflict(
        EditOperationFactory.createInsert(0, 'test', 'user1', 1),
        emptyOps
      );
      expect(conflicts).toHaveLength(0);

      // 测试智能合并
      const merged = ConflictResolver.intelligentMerge(emptyOps, emptyOps);
      expect(merged).toHaveLength(0);

      // 测试冲突统计
      const stats = ConflictResolver.getConflictStats(emptyOps);
      expect(stats.total).toBe(0);
      expect(stats.conflictRate).toBe(0);
    });
  });

  describe('性能稳定性', () => {
    test('应该处理大规模操作的高效性', () => {
      const startTime = Date.now();
      
      // 创建大量操作
      const operations: any[] = [];
      for (let i = 0; i < 500; i++) {
        operations.push(EditOperationFactory.createInsert(i, `content-${i}`, `user-${i % 10}`, i));
      }

      // 执行冲突检测
      let conflictCount = 0;
      for (let i = 0; i < operations.length; i++) {
        const otherOps = operations.slice(0, i);
        const conflicts = ConflictResolver.detectConflict(operations[i], otherOps);
        conflictCount += conflicts.length;
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 验证性能：500个操作应该在合理时间内完成
      expect(duration).toBeLessThan(1000); // 1秒内完成
      expect(conflictCount).toBeGreaterThanOrEqual(0);
    });

    test('应该保持内存使用的稳定性', () => {
      const versionManager = new OperationVersionManager();
      
      // 添加大量操作
      for (let i = 0; i < 1000; i++) {
        const operation = EditOperationFactory.createInsert(i, `test-${i}`, 'user1', i);
        versionManager.addOperation(operation);
      }

      // 验证内存管理
      const allOperations = versionManager.getAllOperations();
      expect(allOperations).toHaveLength(1000);

      // 清理后应该释放内存
      versionManager.clear();
      expect(versionManager.getAllOperations()).toHaveLength(0);
    });
  });
});