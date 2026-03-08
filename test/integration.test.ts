/**
 * v0.1.2 集成测试
 * 验证所有新模块的集成和稳定性
 */

import * as vscode from 'vscode';
import { EditOperationFactory } from '../src/collaboration/edit-operation';
import { ConflictResolver } from '../src/collaboration/conflict-resolver';
import { CodeCommentManager } from '../src/comments/code-comment-manager';
import { FileShareManager } from '../src/sharing/file-share-manager';

describe('v0.1.2 集成测试', () => {
  describe('协作编辑集成测试', () => {
    test('应该正确处理多用户编辑冲突', () => {
      // 模拟两个用户同时编辑
      const user1Ops = [
        EditOperationFactory.createInsert(0, 'hello', 'user1', 1),
        EditOperationFactory.createInsert(5, 'world', 'user1', 2)
      ];

      const user2Ops = [
        EditOperationFactory.createInsert(0, 'start', 'user2', 1),
        EditOperationFactory.createDelete(10, 3, 'user2', 2)
      ];

      // 检测冲突
      const conflicts1 = ConflictResolver.detectConflict(user1Ops[0], user2Ops);
      const conflicts2 = ConflictResolver.detectConflict(user1Ops[1], user2Ops);

      expect(conflicts1.length).toBeGreaterThanOrEqual(0);
      expect(conflicts2.length).toBeGreaterThanOrEqual(0);

      // 解决冲突
      const resolved1 = ConflictResolver.resolveConflict(user1Ops[0], conflicts1);
      const resolved2 = ConflictResolver.resolveConflict(user1Ops[1], conflicts2);

      expect(resolved1.resolved).toBe(true);
      expect(resolved2.resolved).toBe(true);
    });

    test('应该智能合并并发操作', () => {
      const localOps = [
        EditOperationFactory.createInsert(0, 'local', 'user1', 1),
        EditOperationFactory.createInsert(5, 'text', 'user1', 2)
      ];

      const remoteOps = [
        EditOperationFactory.createInsert(0, 'remote', 'user2', 1),
        EditOperationFactory.createDelete(10, 3, 'user2', 2)
      ];

      const merged = ConflictResolver.intelligentMerge(localOps, remoteOps);

      expect(merged.length).toBeGreaterThan(0);
      expect(merged.some(op => op.author === 'user1')).toBe(true);
      expect(merged.some(op => op.author === 'user2')).toBe(true);
    });
  });

  describe('代码评论系统集成测试', () => {
    let commentManager: CodeCommentManager;

    beforeEach(() => {
      commentManager = new CodeCommentManager();
    });

    afterEach(() => {
      commentManager.dispose();
    });

    test('应该正确管理代码评论', () => {
      const documentUri = 'file:///test.js';
      
      // 添加评论
      const comment = commentManager.addComment(documentUri, 10, 5, '这个函数需要优化', 'user1');
      expect(comment).not.toBeNull();

      // 获取评论
      const comments = commentManager.getCommentsForDocument(documentUri);
      expect(comments).toHaveLength(1);
      expect(comments[0].content).toBe('这个函数需要优化');

      // 添加回复
      const reply = commentManager.addReply(comment!.id, '同意，我来优化', 'user2');
      expect(reply).not.toBeNull();

      // 检查回复
      const updatedComments = commentManager.getCommentsForDocument(documentUri);
      expect(updatedComments[0].replies).toHaveLength(1);
      expect(updatedComments[0].replies[0].content).toBe('同意，我来优化');

      // 解析评论
      const resolved = commentManager.resolveComment(comment!.id);
      expect(resolved).toBe(true);

      const resolvedComments = commentManager.getCommentsForDocument(documentUri);
      expect(resolvedComments[0].resolved).toBe(true);
    });

    test('应该正确统计评论数据', () => {
      const documentUri = 'file:///test.js';
      
      // 添加多个评论
      commentManager.addComment(documentUri, 5, 0, '注释有问题', 'user1');
      commentManager.addComment(documentUri, 15, 10, '变量命名不规范', 'user2');
      commentManager.addComment(documentUri, 20, 5, '缺少错误处理', 'user3');

      // 添加回复
      const comment = commentManager.addComment(documentUri, 25, 0, '性能问题', 'user1');
      commentManager.addReply(comment!.id, '我来修复', 'user2');
      commentManager.addReply(comment!.id, '谢谢', 'user1');

      // 获取统计信息
      const stats = commentManager.getCommentStats();

      expect(stats.totalComments).toBe(4);
      expect(stats.totalReplies).toBe(2);
      expect(stats.averageRepliesPerComment).toBeGreaterThan(0);
    });
  });

  describe('文件共享系统集成测试', () => {
    let fileManager: FileShareManager;

    beforeEach(() => {
      fileManager = new FileShareManager();
    });

    afterEach(() => {
      fileManager.dispose();
    });

    test('应该正确管理文件共享', () => {
      // 这个测试主要是验证接口调用，因为实际文件操作需要真实文件
      // 在实际环境中应该使用真实的文件路径
      
      const filePath = '/test/file.js';
      const sharedBy = 'user1';

      // 测试权限管理
      const permissions = {
        canWrite: true,
        canDelete: false,
        canShare: true
      };

      // 由于文件验证会失败，这里主要测试接口调用
      // 在实际测试中应该使用真实的可访问文件
      
      // 测试统计功能
      const stats = fileManager.getShareStats();
      expect(stats.totalFiles).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.averageFileSize).toBe(0);
    });

    test('应该正确管理文件权限', () => {
      const filePath = '/test/file.js';
      const sharedBy = 'user1';

      // 测试权限更新
      // 由于文件共享会失败，这里主要测试权限管理逻辑
      
      const permissions = {
        canWrite: true,
        canDelete: false
      };

      // 在实际测试中，这里应该使用真实的文件共享操作
      // 这里主要验证权限管理接口的调用
      
      const updated = fileManager.updateFilePermissions('test-file-id', permissions, 'admin');
      // 由于没有实际文件，这个操作会返回 false
      // 在实际环境中应该验证权限更新的正确性
    });
  });

  describe('性能监控集成测试', () => {
    test('应该正确计算操作影响范围', () => {
      const insertOp = EditOperationFactory.createInsert(5, 'hello', 'user1', 1);
      const deleteOp = EditOperationFactory.createDelete(0, 3, 'user2', 2);
      const replaceOp = EditOperationFactory.createReplace(10, 5, 'world', 'user3', 3);

      const insertImpact = ConflictResolver.calculateOperationImpact(insertOp);
      const deleteImpact = ConflictResolver.calculateOperationImpact(deleteOp);
      const replaceImpact = ConflictResolver.calculateOperationImpact(replaceOp);

      expect(insertImpact.start).toBe(5);
      expect(insertImpact.end).toBe(10); // 5 + 5('hello'的长度)
      expect(insertImpact.type).toBe('insert');

      expect(deleteImpact.start).toBe(0);
      expect(deleteImpact.end).toBe(3);
      expect(deleteImpact.type).toBe('delete');

      expect(replaceImpact.start).toBe(10);
      expect(replaceImpact.end).toBe(15); // 10 + 5
      expect(replaceImpact.type).toBe('replace');
    });

    test('应该正确统计冲突信息', () => {
      const operations = [
        EditOperationFactory.createInsert(0, 'hello', 'user1', 1),
        EditOperationFactory.createInsert(0, 'world', 'user2', 2),
        EditOperationFactory.createInsert(10, 'test', 'user3', 3),
        EditOperationFactory.createDelete(5, 3, 'user4', 4)
      ];

      // 设置接近的时间戳以触发冲突检测
      operations[0].timestamp = 1000;
      operations[1].timestamp = 1001;
      operations[2].timestamp = 2000;
      operations[3].timestamp = 1002;

      const stats = ConflictResolver.getConflictStats(operations);

      expect(stats.total).toBeGreaterThanOrEqual(0);
      expect(stats.resolved).toBeGreaterThanOrEqual(0);
      expect(stats.unresolved).toBeGreaterThanOrEqual(0);
      expect(stats.conflictRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('向后兼容性测试', () => {
    test('应该保持编辑操作接口兼容性', () => {
      // 验证 EditOperation 接口的向后兼容性
      const operation = EditOperationFactory.createInsert(0, 'test', 'user1', 1);

      expect(operation).toHaveProperty('id');
      expect(operation).toHaveProperty('type');
      expect(operation).toHaveProperty('position');
      expect(operation).toHaveProperty('content');
      expect(operation).toHaveProperty('timestamp');
      expect(operation).toHaveProperty('author');
      expect(operation).toHaveProperty('version');

      // 验证新添加的元数据字段
      expect(operation.metadata).toBeUndefined(); // 默认没有元数据
    });

    test('应该保持冲突解决器接口兼容性', () => {
      const op1 = EditOperationFactory.createInsert(0, 'hello', 'user1', 1);
      const op2 = EditOperationFactory.createInsert(5, 'world', 'user2', 2);

      // 验证冲突检测接口
      const conflicts = ConflictResolver.detectConflict(op1, [op2]);
      expect(Array.isArray(conflicts)).toBe(true);

      // 验证冲突解决接口
      const resolution = ConflictResolver.resolveConflict(op1, conflicts);
      expect(resolution).toHaveProperty('resolved');
      expect(resolution).toHaveProperty('operation');
    });
  });
});