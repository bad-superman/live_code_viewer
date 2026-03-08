/**
 * 延迟优化器模块
 * 实现编辑延迟 < 50ms 的性能优化
 */

import * as vscode from 'vscode';
import { EditOperation } from '../collaboration/edit-operation';

export interface LatencyStats {
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  operationCount: number;
  optimizationRate: number;
}

export interface OptimizationConfig {
  targetLatency: number;
  batchSize: number;
  compressionThreshold: number;
  enableBatching: boolean;
  enableCompression: boolean;
}

export class LatencyOptimizer {
  private config: OptimizationConfig = {
    targetLatency: 50, // 50ms 目标延迟
    batchSize: 10,
    compressionThreshold: 100, // 100字节以上压缩
    enableBatching: true,
    enableCompression: true
  };

  private latencyHistory: number[] = [];
  private operationBuffer: EditOperation[] = [];
  private lastOptimizationTime = 0;

  private eventEmitter = new vscode.EventEmitter<{
    type: 'latency-update' | 'optimization-applied' | 'threshold-exceeded';
    data: any;
  }>();

  public readonly onDidChange = this.eventEmitter.event;

  /**
   * 优化操作批处理
   */
  optimizeOperations(operations: EditOperation[]): EditOperation[] {
    if (operations.length === 0) {
      return [];
    }

    let optimizedOperations = [...operations];

    // 应用批处理优化
    if (this.config.enableBatching) {
      optimizedOperations = this.applyBatching(optimizedOperations);
    }

    // 应用压缩优化
    if (this.config.enableCompression) {
      optimizedOperations = this.applyCompression(optimizedOperations);
    }

    // 记录延迟统计
    this.recordLatency(optimizedOperations);

    // 触发优化事件
    this.eventEmitter.fire({
      type: 'optimization-applied',
      data: {
        originalCount: operations.length,
        optimizedCount: optimizedOperations.length,
        optimizationRate: this.calculateOptimizationRate(operations, optimizedOperations),
        timestamp: Date.now()
      }
    });

    return optimizedOperations;
  }

  /**
   * 应用批处理优化
   */
  private applyBatching(operations: EditOperation[]): EditOperation[] {
    if (operations.length <= this.config.batchSize) {
      return operations;
    }

    const batches: EditOperation[][] = [];
    
    // 按作者分组批处理
    const authorGroups = this.groupOperationsByAuthor(operations);
    
    for (const [author, authorOps] of authorGroups) {
      // 按位置排序
      const sortedOps = authorOps.sort((a, b) => a.position - b.position);
      
      // 分批处理
      for (let i = 0; i < sortedOps.length; i += this.config.batchSize) {
        batches.push(sortedOps.slice(i, i + this.config.batchSize));
      }
    }

    // 合并批次
    const batchedOperations: EditOperation[] = [];
    for (const batch of batches) {
      if (batch.length === 1) {
        batchedOperations.push(batch[0]);
      } else {
        // 创建批处理操作
        const batchOperation = this.createBatchOperation(batch);
        batchedOperations.push(batchOperation);
      }
    }

    return batchedOperations;
  }

  /**
   * 应用压缩优化
   */
  private applyCompression(operations: EditOperation[]): EditOperation[] {
    const compressed: EditOperation[] = [];
    
    for (const operation of operations) {
      if (this.shouldCompressOperation(operation)) {
        const compressedOp = this.compressOperation(operation);
        compressed.push(compressedOp);
      } else {
        compressed.push(operation);
      }
    }

    return compressed;
  }

  /**
   * 检查是否应该压缩操作
   */
  private shouldCompressOperation(operation: EditOperation): boolean {
    if (!this.config.enableCompression) {
      return false;
    }

    // 检查操作大小
    const operationSize = this.calculateOperationSize(operation);
    return operationSize > this.config.compressionThreshold;
  }

  /**
   * 压缩操作
   */
  private compressOperation(operation: EditOperation): EditOperation {
    // 简化压缩：只对内容进行简单编码
    // 在实际应用中可以使用更复杂的压缩算法
    if (operation.content && operation.content.length > 10) {
      return {
        ...operation,
        content: this.simpleEncode(operation.content),
        metadata: {
          ...operation.metadata,
          compressed: true,
          originalLength: operation.content.length
        }
      };
    }

    return operation;
  }

  /**
   * 简单编码
   */
  private simpleEncode(content: string): string {
    // 在实际应用中可以使用 base64 或其他编码
    // 这里使用简单的转义编码
    return content.replace(/\n/g, '\\n').replace(/\t/g, '\\t');
  }

  /**
   * 简单解码
   */
  private simpleDecode(content: string): string {
    return content.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  }

  /**
   * 创建批处理操作
   */
  private createBatchOperation(operations: EditOperation[]): EditOperation {
    const firstOp = operations[0];
    const lastOp = operations[operations.length - 1];

    return {
      id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'batch',
      position: firstOp.position,
      content: operations.map(op => this.operationToString(op)).join('|'),
      timestamp: Date.now(),
      author: firstOp.author,
      version: lastOp.version,
      metadata: {
        batch: true,
        operationCount: operations.length,
        operations: operations.map(op => ({
          id: op.id,
          type: op.type,
          position: op.position
        }))
      }
    };
  }

  /**
   * 操作转换为字符串
   */
  private operationToString(operation: EditOperation): string {
    return `${operation.type}:${operation.position}:${operation.content || ''}:${operation.length || 0}`;
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

    return size;
  }

  /**
   * 记录延迟统计
   */
  private recordLatency(operations: EditOperation[]): void {
    const now = Date.now();
    
    for (const operation of operations) {
      const latency = now - operation.timestamp;
      this.latencyHistory.push(latency);

      // 保持历史记录大小
      if (this.latencyHistory.length > 100) {
        this.latencyHistory.shift();
      }

      // 检查延迟阈值
      if (latency > this.config.targetLatency) {
        this.eventEmitter.fire({
          type: 'threshold-exceeded',
          data: {
            operation,
            latency,
            threshold: this.config.targetLatency
          }
        });
      }
    }

    // 定期更新延迟统计
    if (now - this.lastOptimizationTime > 5000) { // 每5秒更新一次
      this.eventEmitter.fire({
        type: 'latency-update',
        data: this.getLatencyStats()
      });
      this.lastOptimizationTime = now;
    }
  }

  /**
   * 计算优化率
   */
  private calculateOptimizationRate(original: EditOperation[], optimized: EditOperation[]): number {
    if (original.length === 0) {
      return 0;
    }

    return ((original.length - optimized.length) / original.length) * 100;
  }

  /**
   * 获取延迟统计信息
   */
  getLatencyStats(): LatencyStats {
    if (this.latencyHistory.length === 0) {
      return {
        averageLatency: 0,
        maxLatency: 0,
        minLatency: 0,
        operationCount: 0,
        optimizationRate: 0
      };
    }

    const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
    const average = sum / this.latencyHistory.length;
    const max = Math.max(...this.latencyHistory);
    const min = Math.min(...this.latencyHistory);

    return {
      averageLatency: average,
      maxLatency: max,
      minLatency: min,
      operationCount: this.latencyHistory.length,
      optimizationRate: this.calculateOptimizationRate([], [])
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取当前配置
   */
  getConfig(): OptimizationConfig {
    return { ...this.config };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.latencyHistory = [];
    this.operationBuffer = [];
    this.lastOptimizationTime = 0;
  }

  /**
   * 销毁优化器
   */
  dispose(): void {
    this.eventEmitter.dispose();
    this.resetStats();
  }
}