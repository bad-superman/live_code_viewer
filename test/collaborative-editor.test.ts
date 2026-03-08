/**
 * 协作编辑器测试
 */

import * as vscode from 'vscode';
import { EditOperationFactory, OperationTransformer, OperationVersionManager } from '../src/collaboration/edit-operation';
import { ConflictResolver } from '../src/collaboration/conflict-resolver';

describe('协作编辑器核心功能测试', () => {
  describe('EditOperationFactory', () => {
    test('应该创建有效的插入操作', () => {
      const operation = EditOperationFactory.createInsert(10, 'hello', 'user1', 1);
      
      expect(operation.type).toBe('insert');
      expect(operation.position).toBe(10);
      expect(operation.content).toBe('hello');
      expect(operation.author).toBe('user1');
      expect(operation.version).toBe(1);
      expect(operation.id).toBeDefined();
    });

    test('应该创建有效的删除操作', () => {
      const operation = EditOperationFactory.createDelete(5, 3, 'user2', 2);
      
      expect(operation.type).toBe('delete');
      expect(operation.position).toBe(5);
      expect(operation.length).toBe(3);
      expect(operation.author).toBe('user2');
      expect(operation.version).toBe(2);
    });

    test('应该创建有效的替换操作', () => {
      const operation = EditOperationFactory.createReplace(0, 5, 'world', 'user3', 3);
      
      expect(operation.type).toBe('replace');
      expect(operation.position).toBe(0);
      expect(operation.length).toBe(5);
      expect(operation.content).toBe('world');
      expect(operation.author).toBe('user3');
      expect(operation.version).toBe(3);
    });
  });

  describe('OperationTransformer', () => {
    test('应该处理不重叠的插入操作', () => {
      const op1 = EditOperationFactory.createInsert(0, 'hello', 'user1', 1);
      const op2 = EditOperationFactory.createInsert(10, 'world', 'user2', 2);
      
      const transformed = OperationTransformer.transform(op1, op2);
      
      expect(transformed).toEqual(op1); // 不重叠的操作应该保持不变
    });

    test('应该处理重叠的插入操作', () => {
      const op1 = EditOperationFactory.createInsert(5, 'hello', 'user1', 1);
      const op2 = EditOperationFactory.createInsert(0, 'start', 'user2', 2);
      
      const transformed = OperationTransformer.transform(op1, op2);
      
      // 由于op2插入在位置0，op1的位置应该调整
      expect(transformed.position).toBeGreaterThan(5);
      expect(transformed.content).toBe('hello');
    });

    test('应该处理删除操作的影响', () => {
      const insertOp = EditOperationFactory.createInsert(10, 'hello', 'user1', 1);
      const deleteOp = EditOperationFactory.createDelete(0, 5, 'user2', 2);
      
      const transformed = OperationTransformer.transform(insertOp, deleteOp);
      
      // 删除操作应该影响插入位置
      expect(transformed.position).toBe(5); // 10 - 5 = 5
      expect(transformed.content).toBe('hello');
    });
  });

  describe('ConflictResolver', () => {
    test('应该检测潜在冲突', () => {
      const op1 = EditOperationFactory.createInsert(5, 'hello', 'user1', 1);
      const op2 = EditOperationFactory.createInsert(5, 'world', 'user2', 2);
      
      // 确保时间戳接近以触发冲突检测
      op1.timestamp = 1000;
      op2.timestamp = 1001;
      
      const conflicts = ConflictResolver.detectConflict(op1, [op2]);
      
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toBe(op2);
    });

    test('应该解决操作冲突', () => {
      const op1 = EditOperationFactory.createInsert(5, 'hello', 'user1', 1);
      const op2 = EditOperationFactory.createInsert(5, 'world', 'user2', 2);
      
      const resolution = ConflictResolver.resolveConflict(op1, [op2]);
      
      expect(resolution.resolved).toBe(true);
      expect(resolution.operation).toBeDefined();
    });

    test('应该智能合并操作', () => {
      const localOps = [
        EditOperationFactory.createInsert(0, 'hello', 'user1', 1)
      ];
      const remoteOps = [
        EditOperationFactory.createInsert(5, 'world', 'user2', 2)
      ];
      
      const merged = ConflictResolver.intelligentMerge(localOps, remoteOps);
      
      expect(merged).toHaveLength(2);
      expect(merged[0].author).toBe('user1');
      expect(merged[1].author).toBe('user2');
    });
  });

  describe('OperationVersionManager', () => {
    let versionManager: OperationVersionManager;

    beforeEach(() => {
      versionManager = new OperationVersionManager();
    });

    test('应该正确管理版本号', () => {
      expect(versionManager.getNextVersion()).toBe(1);
      expect(versionManager.getNextVersion()).toBe(2);
      expect(versionManager.getCurrentVersion()).toBe(2);
    });

    test('应该正确存储和检索操作', () => {
      const op1 = EditOperationFactory.createInsert(0, 'hello', 'user1', 1);
      const op2 = EditOperationFactory.createInsert(5, 'world', 'user2', 2);
      
      versionManager.addOperation(op1);
      versionManager.addOperation(op2);
      
      const version1Ops = versionManager.getOperationsByVersion(1);
      const version2Ops = versionManager.getOperationsByVersion(2);
      const allOps = versionManager.getAllOperations();
      
      expect(version1Ops).toHaveLength(1);
      expect(version2Ops).toHaveLength(1);
      expect(allOps).toHaveLength(2);
    });

    test('应该按时间戳排序操作', () => {
      const op1 = EditOperationFactory.createInsert(0, 'hello', 'user1', 1);
      const op2 = EditOperationFactory.createInsert(5, 'world', 'user2', 2);
      
      // 手动设置时间戳以确保顺序
      op1.timestamp = 1000;
      op2.timestamp = 500;
      
      versionManager.addOperation(op1);
      versionManager.addOperation(op2);
      
      const allOps = versionManager.getAllOperations();
      
      expect(allOps[0].timestamp).toBe(500); // 应该按时间戳排序
      expect(allOps[1].timestamp).toBe(1000);
    });
  });

  describe('冲突统计信息', () => {
    test('应该计算冲突率', () => {
      const operations = [
        EditOperationFactory.createInsert(0, 'hello', 'user1', 1),
        EditOperationFactory.createInsert(0, 'world', 'user2', 2),
        EditOperationFactory.createInsert(10, 'test', 'user3', 3)
      ];
      
      // 确保时间戳接近以触发冲突检测
      operations[0].timestamp = 1000;
      operations[1].timestamp = 1001;
      operations[2].timestamp = 2000; // 这个不会冲突
      
      const stats = ConflictResolver.getConflictStats(operations);
      
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.resolved).toBeGreaterThanOrEqual(0);
      expect(stats.unresolved).toBeGreaterThanOrEqual(0);
      expect(stats.conflictRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('操作影响范围计算', () => {
    test('应该正确计算插入操作影响范围', () => {
      const op = EditOperationFactory.createInsert(5, 'hello', 'user1', 1);
      const impact = ConflictResolver.calculateOperationImpact(op);
      
      expect(impact.start).toBe(5);
      expect(impact.end).toBe(10); // 5 + 5('hello'的长度)
      expect(impact.type).toBe('insert');
    });

    test('应该正确计算删除操作影响范围', () => {
      const op = EditOperationFactory.createDelete(0, 3, 'user2', 2);
      const impact = ConflictResolver.calculateOperationImpact(op);
      
      expect(impact.start).toBe(0);
      expect(impact.end).toBe(3);
      expect(impact.type).toBe('delete');
    });
  });
});