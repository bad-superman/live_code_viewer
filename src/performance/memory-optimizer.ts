/**
 * 内存使用优化器模块
 * 降低资源使用，优化内存管理
 */

import * as vscode from 'vscode';
import { EditOperation } from '../collaboration/edit-operation';

export interface MemoryStats {
  totalOperations: number;
  activeOperations: number;
  memoryUsage: number;
  garbageCollected: number;
  optimizationRate: number;
}

export interface MemoryConfig {
  maxOperationHistory: number;
  garbageCollectionInterval: number;
  enableCompression: boolean;
  enableLazyLoading: boolean;
}

export class MemoryOptimizer {
  private config: MemoryConfig = {
    maxOperationHistory: 1000,
    garbageCollectionInterval: 30000, // 30秒
    enableCompression: true,
    enableLazyLoading: true
  };

  private operationHistory: EditOperation[] = [];
  private activeOperations: Map<string, EditOperation> = new Map();
  private memoryStats: MemoryStats = {
    totalOperations: 0,
    activeOperations: 0,
    memoryUsage: 0,
    garbageCollected: 0,
    optimizationRate: 0
  };

  private gcTimer?: NodeJS.Timeout;

  private eventEmitter = new vscode.EventEmitter<{
    type: 'memory-update' | 'garbage-collected' | 'threshold-exceeded';
    data: any;
  }>();

  public readonly onDidChange = this.eventEmitter.event;

  constructor() {
    this.setupGarbageCollection();
  }

  /**
   * 添加操作到内存管理
   */
  addOperation(operation: EditOperation): void {
    // 添加到历史记录
    this.operationHistory.push(operation);
    
    // 添加到活跃操作
    this.activeOperations.set(operation.id, operation);

    // 更新统计信息
    this.updateMemoryStats();

    // 检查是否需要垃圾回收
    if (this.operationHistory.length > this.config.maxOperationHistory) {
      this.performGarbageCollection();
    }
  }

  /**
   * 批量添加操作
   */
  addOperations(operations: EditOperation[]): void {
    for (const operation of operations) {
      this.addOperation(operation);
    }
  }

  /**
   * 获取操作历史
   */
  getOperationHistory(): EditOperation[] {
    return [...this.operationHistory];
  }

  /**
   * 获取活跃操作
   */
  getActiveOperations(): EditOperation[] {
    return Array.from(this.activeOperations.values());
  }

  /**
   * 压缩操作历史
   */
  compressOperationHistory(): EditOperation[] {
    if (!this.config.enableCompression) {
      return this.operationHistory;
    }

    const compressed: EditOperation[] = [];
    const authorGroups = this.groupOperationsByAuthor(this.operationHistory);

    for (const [author, operations] of authorGroups) {
      const compressedOps = this.compressAuthorOperations(operations);
      compressed.push(...compressedOps);
    }

    return compressed;
  }

  /**
   * 按作者分组操作
   */
  private groupOperationsByAuthor(operations: EditOperation[]): Map<string, EditOperation[]> {
    const groups = new Map<string, EditOperation[]>();
    
    for (const operation of operations) {
      const authorOps = groups.get(operation.author) || [];
      authorOps.push(operation);
      groups.set(operation.author, authorOps);
    }

    return groups;
  }

  /**
   * 压缩同一作者的操作
   */
  private compressAuthorOperations(operations: EditOperation[]): EditOperation[] {
    if (operations.length <= 1) {
      return operations;
    }

    const compressed: EditOperation[] = [];
    const sortedOps = operations.sort((a, b) => a.timestamp - b.timestamp);

    let currentBatch: EditOperation[] = [];

    for (const operation of sortedOps) {
      if (currentBatch.length === 0) {
        currentBatch.push(operation);
      } else {
        const lastOp = currentBatch[currentBatch.length - 1];
        
        // 检查是否可以合并
        if (this.canMergeOperations(lastOp, operation)) {
          currentBatch.push(operation);
        } else {
          // 压缩当前批次
          if (currentBatch.length > 1) {
            compressed.push(this.createCompressedOperation(currentBatch));
          } else {
            compressed.push(currentBatch[0]);
          }
          currentBatch = [operation];
        }
      }
    }

    // 处理最后一个批次
    if (currentBatch.length > 0) {
      if (currentBatch.length > 1) {
        compressed.push(this.createCompressedOperation(currentBatch));
      } else {
        compressed.push(currentBatch[0]);
      }
    }

    return compressed;
  }

  /**
   * 检查是否可以合并操作
   */
  private canMergeOperations(op1: EditOperation, op2: EditOperation): boolean {
    // 相同类型
    if (op1.type !== op2.type) {
      return false;
    }

    // 时间接近
    const timeDiff = Math.abs(op1.timestamp - op2.timestamp);
    if (timeDiff > 5000) { // 5秒内
      return false;
    }

    // 位置连续
    const op1End = op1.position + (op1.length || (op1.content?.length || 0));
    return op1End === op2.position;
  }

  /**
   * 创建压缩操作
   */
  private createCompressedOperation(operations: EditOperation[]): EditOperation {
    const firstOp = operations[0];
    const lastOp = operations[operations.length - 1];

    let compressedContent = '';
    let totalLength = 0;

    for (const op of operations) {
      if (op.content) {
        compressedContent += op.content;
      }
      totalLength += op.length || (op.content?.length || 0);
    }

    return {
      id: `compressed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: firstOp.type,
      position: firstOp.position,
      content: compressedContent,
      length: totalLength,
      timestamp: lastOp.timestamp,
      author: firstOp.author,
      version: lastOp.version,
      metadata: {
        compressed: true,
        operationCount: operations.length,
        originalOperations: operations.map(op => ({
          id: op.id,
          type: op.type,
          position: op.position,
          timestamp: op.timestamp
        }))
      }
    };
  }

  /**
   * 执行垃圾回收
   */
  performGarbageCollection(): void {
    const beforeCount = this.operationHistory.length;
    
    // 清理旧的操作历史
    const now = Date.now();
    const cutoffTime = now - 300000; // 5分钟前的操作
    
    this.operationHistory = this.operationHistory.filter(op => 
      op.timestamp > cutoffTime
    );

    // 清理不活跃的操作
    const activeIds = new Set(this.operationHistory.map(op => op.id));
    for (const [id, operation] of this.activeOperations) {
      if (!activeIds.has(id)) {
        this.activeOperations.delete(id);
      }
    }

    const afterCount = this.operationHistory.length;
    const collectedCount = beforeCount - afterCount;

    this.memoryStats.garbageCollected += collectedCount;

    // 更新统计信息
    this.updateMemoryStats();

    this.eventEmitter.fire({
      type: 'garbage-collected',
      data: {
        collected: collectedCount,
        remaining: afterCount,
        timestamp: now
      }
    });
  }

  /**
   * 更新内存统计信息
   */
  private updateMemoryStats(): void {
    const totalSize = this.calculateTotalMemoryUsage();
    
    this.memoryStats = {
      totalOperations: this.operationHistory.length,
      activeOperations: this.activeOperations.size,
      memoryUsage: totalSize,
      garbageCollected: this.memoryStats.garbageCollected,
      optimizationRate: this.calculateOptimizationRate()
    };

    this.eventEmitter.fire({
      type: 'memory-update',
      data: this.memoryStats
    });
  }

  /**
   * 计算总内存使用量
   */
  private calculateTotalMemoryUsage(): number {
    let totalSize = 0;

    for (const operation of this.operationHistory) {
      totalSize += this.calculateOperationSize(operation);
    }

    return totalSize;
  }

  /**
   * 计算操作大小
   */
  private calculateOperationSize(operation: EditOperation): number {
    let size = 0;
    
    size += operation.id.length;
    size += operation.type.length;
    size += operation.author.length;
    
    if (operation.content) {
      size += operation.content.length;
    }

    // 元数据大小
    if (operation.metadata) {
      size += JSON.stringify(operation.metadata).length;
    }

    return size;
  }

  /**
   * 计算优化率
   */
  private calculateOptimizationRate(): number {
    const compressed = this.compressOperationHistory();
    const originalCount = this.operationHistory.length;
    const compressedCount = compressed.length;

    if (originalCount === 0) {
      return 0;
    }

    return ((originalCount - compressedCount) / originalCount) * 100;
  }

  /**
   * 设置垃圾回收定时器
   */
  private setupGarbageCollection(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
    }

    this.gcTimer = setInterval(() => {
      this.performGarbageCollection();
    }, this.config.garbageCollectionInterval);
  }

  /**
   * 获取内存统计信息
   */
  getMemoryStats(): MemoryStats {
    return { ...this.memoryStats };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<MemoryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.garbageCollectionInterval) {
      this.setupGarbageCollection();
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): MemoryConfig {
    return { ...this.config };
  }

  /**
   * 清理内存优化器
   */
  clear(): void {
    this.operationHistory = [];
    this.activeOperations.clear();
    this.memoryStats = {
      totalOperations: 0,
      activeOperations: 0,
      memoryUsage: 0,
      garbageCollected: 0,
      optimizationRate: 0
    };
  }

  /**
   * 销毁优化器
   */
  dispose(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
    }
    this.eventEmitter.dispose();
    this.clear();
  }
}