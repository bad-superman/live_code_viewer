/**
 * 冲突解决器模块
 * 处理协作编辑中的操作冲突，确保最终一致性
 */

import { EditOperation, OperationTransformer } from './edit-operation';

export interface ConflictResolution {
  resolved: boolean;
  operation?: EditOperation;
  message?: string;
}

export class ConflictResolver {
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly CONFLICT_THRESHOLD_MS = 1000; // 1秒内的操作视为可能冲突

  /**
   * 检测操作冲突
   */
  static detectConflict(
    operation: EditOperation,
    existingOperations: EditOperation[]
  ): EditOperation[] {
    const potentialConflicts: EditOperation[] = [];
    
    for (const existingOp of existingOperations) {
      if (this.isPotentialConflict(operation, existingOp)) {
        potentialConflicts.push(existingOp);
      }
    }

    return potentialConflicts;
  }

  /**
   * 解决操作冲突
   */
  static resolveConflict(
    operation: EditOperation,
    conflicts: EditOperation[]
  ): ConflictResolution {
    if (conflicts.length === 0) {
      return { resolved: true, operation };
    }

    // 按时间戳排序冲突操作
    const sortedConflicts = conflicts.sort((a, b) => a.timestamp - b.timestamp);
    
    let resolvedOperation = operation;
    
    // 应用 Operational Transformation 算法
    for (const conflict of sortedConflicts) {
      resolvedOperation = OperationTransformer.transform(resolvedOperation, conflict);
    }

    // 验证转换后的操作是否有效
    if (this.isValidOperation(resolvedOperation)) {
      return {
        resolved: true,
        operation: resolvedOperation
      };
    } else {
      return {
        resolved: false,
        message: '无法解决操作冲突，操作无效'
      };
    }
  }

  /**
   * 批量解决冲突
   */
  static resolveBatchConflicts(
    operations: EditOperation[],
    existingOperations: EditOperation[]
  ): EditOperation[] {
    const resolvedOperations: EditOperation[] = [];
    
    for (const operation of operations) {
      const conflicts = this.detectConflict(operation, existingOperations);
      const resolution = this.resolveConflict(operation, conflicts);
      
      if (resolution.resolved && resolution.operation) {
        resolvedOperations.push(resolution.operation);
      } else {
        console.warn(`操作冲突解决失败: ${resolution.message}`);
      }
    }

    return resolvedOperations;
  }

  /**
   * 智能合并策略
   */
  static intelligentMerge(
    localOperations: EditOperation[],
    remoteOperations: EditOperation[]
  ): EditOperation[] {
    const allOperations = [...localOperations, ...remoteOperations];
    
    // 按时间戳排序
    const sortedOperations = allOperations.sort((a, b) => a.timestamp - b.timestamp);
    
    // 应用冲突解决
    const resolvedOperations: EditOperation[] = [];
    
    for (const operation of sortedOperations) {
      const conflicts = this.detectConflict(operation, resolvedOperations);
      const resolution = this.resolveConflict(operation, conflicts);
      
      if (resolution.resolved && resolution.operation) {
        resolvedOperations.push(resolution.operation);
      }
    }

    return resolvedOperations;
  }

  /**
   * 检测潜在冲突
   */
  private static isPotentialConflict(
    op1: EditOperation,
    op2: EditOperation
  ): boolean {
    // 相同作者的操作通常不会冲突
    if (op1.author === op2.author) {
      return false;
    }

    // 时间接近的操作可能冲突
    const timeDiff = Math.abs(op1.timestamp - op2.timestamp);
    if (timeDiff > this.CONFLICT_THRESHOLD_MS) {
      return false;
    }

    // 检查操作范围是否重叠
    return this.isOperationOverlapping(op1, op2);
  }

  /**
   * 检查操作范围是否重叠
   */
  private static isOperationOverlapping(
    op1: EditOperation,
    op2: EditOperation
  ): boolean {
    const op1Start = op1.position;
    const op1End = op1.position + (op1.length || (op1.content?.length || 0));
    const op2Start = op2.position;
    const op2End = op2.position + (op2.length || (op2.content?.length || 0));

    // 检查范围重叠
    return !(op1End <= op2Start || op2End <= op1Start);
  }

  /**
   * 验证操作有效性
   */
  private static isValidOperation(operation: EditOperation): boolean {
    if (operation.position < 0) {
      return false;
    }

    if (operation.type === 'delete' && (!operation.length || operation.length <= 0)) {
      return false;
    }

    if (operation.type === 'insert' && !operation.content) {
      return false;
    }

    if (operation.type === 'replace' && (!operation.length || operation.length <= 0 || !operation.content)) {
      return false;
    }

    return true;
  }

  /**
   * 计算操作影响范围
   */
  static calculateOperationImpact(operation: EditOperation): {
    start: number;
    end: number;
    type: 'insert' | 'delete' | 'replace' | 'selection';
  } {
    const start = operation.position;
    let end = start;

    switch (operation.type) {
      case 'insert':
        end = start + (operation.content?.length || 0);
        break;
      case 'delete':
        end = start + (operation.length || 0);
        break;
      case 'replace':
        end = start + (operation.length || 0);
        break;
    }

    return { start, end, type: operation.type };
  }

  /**
   * 获取冲突统计信息
   */
  static getConflictStats(operations: EditOperation[]): {
    total: number;
    resolved: number;
    unresolved: number;
    conflictRate: number;
  } {
    let resolved = 0;
    let unresolved = 0;

    for (let i = 0; i < operations.length; i++) {
      for (let j = i + 1; j < operations.length; j++) {
        if (this.isPotentialConflict(operations[i], operations[j])) {
          const resolution = this.resolveConflict(operations[i], [operations[j]]);
          if (resolution.resolved) {
            resolved++;
          } else {
            unresolved++;
          }
        }
      }
    }

    const total = resolved + unresolved;
    const conflictRate = total > 0 ? (unresolved / total) * 100 : 0;

    return {
      total,
      resolved,
      unresolved,
      conflictRate
    };
  }
}