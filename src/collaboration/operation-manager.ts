/**
 * 操作管理器模块
 * 管理编辑操作的执行、同步和版本控制
 */

import * as vscode from 'vscode';
import { EditOperation, OperationVersionManager } from './edit-operation';
import { ConflictResolver } from './conflict-resolver';

export interface OperationManagerConfig {
  maxBufferSize: number;
  syncThreshold: number;
  retryDelay: number;
  enableCompression: boolean;
}

export class OperationManager {
  private config: OperationManagerConfig = {
    maxBufferSize: 100,
    syncThreshold: 10, // 10个操作后同步
    retryDelay: 100, // 100ms重试延迟
    enableCompression: true
  };

  private versionManager = new OperationVersionManager();
  private operationBuffer: EditOperation[] = [];
  private appliedOperations: Set<string> = new Set();
  private retryQueue: EditOperation[] = [];

  private eventEmitter = new vscode.EventEmitter<{
    type: 'buffer-full' | 'sync-ready' | 'operation-applied' | 'retry-queued';
    data: any;
  }>();

  public readonly onDidChange = this.eventEmitter.event;

  /**
   * 添加操作到缓冲区
   */
  addOperation(operation: EditOperation): boolean {
    // 检查是否已经应用过
    if (this.appliedOperations.has(operation.id)) {
      return false;
    }

    // 检查缓冲区是否已满
    if (this.operationBuffer.length >= this.config.maxBufferSize) {
      this.eventEmitter.fire({
        type: 'buffer-full',
        data: { bufferSize: this.operationBuffer.length }
      });
      return false;
    }

    // 添加到缓冲区
    this.operationBuffer.push(operation);
    this.appliedOperations.add(operation.id);
    this.versionManager.addOperation(operation);

    // 检查是否需要同步
    if (this.operationBuffer.length >= this.config.syncThreshold) {
      this.eventEmitter.fire({
        type: 'sync-ready',
        data: { operations: this.getBufferOperations() }
      });
    }

    this.eventEmitter.fire({
      type: 'operation-applied',
      data: operation
    });

    return true;
  }

  /**
   * 批量添加操作
   */
  addOperations(operations: EditOperation[]): number {
    let addedCount = 0;
    
    for (const operation of operations) {
      if (this.addOperation(operation)) {
        addedCount++;
      }
    }

    return addedCount;
  }

  /**
   * 获取缓冲区操作
   */
  getBufferOperations(): EditOperation[] {
    const operations = [...this.operationBuffer];
    this.operationBuffer = [];
    return operations;
  }

  /**
   * 获取所有操作
   */
  getAllOperations(): EditOperation[] {
    return this.versionManager.getAllOperations();
  }

  /**
   * 获取操作版本
   */
  getCurrentVersion(): number {
    return this.versionManager.getCurrentVersion();
  }

  /**
   * 获取指定版本的操作
   */
  getOperationsByVersion(version: number): EditOperation[] {
    return this.versionManager.getOperationsByVersion(version);
  }

  /**
   * 处理操作失败
   */
  handleOperationFailure(operation: EditOperation, error: Error): void {
    console.warn(`操作失败: ${operation.id}`, error);
    
    // 添加到重试队列
    this.retryQueue.push(operation);
    
    this.eventEmitter.fire({
      type: 'retry-queued',
      data: {
        operation,
        error: error.message,
        retryCount: this.retryQueue.length
      }
    });

    // 延迟重试
    setTimeout(() => {
      this.retryFailedOperations();
    }, this.config.retryDelay);
  }

  /**
   * 重试失败的操作
   */
  private retryFailedOperations(): void {
    if (this.retryQueue.length === 0) {
      return;
    }

    const retryOperations = [...this.retryQueue];
    this.retryQueue = [];

    let successCount = 0;
    for (const operation of retryOperations) {
      if (this.addOperation(operation)) {
        successCount++;
      } else {
        // 再次失败，保留在重试队列
        this.retryQueue.push(operation);
      }
    }

    console.log(`重试结果: ${successCount}成功, ${this.retryQueue.length}失败`);
  }

  /**
   * 压缩操作
   */
  compressOperations(operations: EditOperation[]): EditOperation[] {
    if (!this.config.enableCompression) {
      return operations;
    }

    const compressed: EditOperation[] = [];
    let lastOperation: EditOperation | null = null;

    for (const operation of operations) {
      if (lastOperation && this.canCompress(lastOperation, operation)) {
        // 合并操作
        lastOperation = this.mergeOperations(lastOperation, operation);
      } else {
        if (lastOperation) {
          compressed.push(lastOperation);
        }
        lastOperation = operation;
      }
    }

    if (lastOperation) {
      compressed.push(lastOperation);
    }

    return compressed;
  }

  /**
   * 检查是否可以压缩操作
   */
  private canCompress(op1: EditOperation, op2: EditOperation): boolean {
    // 相同作者
    if (op1.author !== op2.author) {
      return false;
    }

    // 时间接近
    const timeDiff = Math.abs(op1.timestamp - op2.timestamp);
    if (timeDiff > 1000) { // 1秒内
      return false;
    }

    // 相同类型
    if (op1.type !== op2.type) {
      return false;
    }

    // 位置连续
    const op1End = op1.position + (op1.length || 0);
    return op1End === op2.position;
  }

  /**
   * 合并操作
   */
  private mergeOperations(op1: EditOperation, op2: EditOperation): EditOperation {
    switch (op1.type) {
      case 'insert':
        return {
          ...op1,
          content: (op1.content || '') + (op2.content || ''),
          timestamp: Math.max(op1.timestamp, op2.timestamp)
        };

      case 'delete':
        return {
          ...op1,
          length: (op1.length || 0) + (op2.length || 0),
          timestamp: Math.max(op1.timestamp, op2.timestamp)
        };

      case 'replace':
        return {
          ...op1,
          length: (op1.length || 0) + (op2.length || 0),
          content: (op1.content || '') + (op2.content || ''),
          timestamp: Math.max(op1.timestamp, op2.timestamp)
        };

      default:
        return op2;
    }
  }

  /**
   * 获取操作统计信息
   */
  getStats(): {
    totalApplied: number;
    bufferSize: number;
    retryQueueSize: number;
    currentVersion: number;
    compressionRate: number;
  } {
    const allOperations = this.getAllOperations();
    const compressed = this.compressOperations(allOperations);
    const compressionRate = allOperations.length > 0 
      ? ((allOperations.length - compressed.length) / allOperations.length) * 100 
      : 0;

    return {
      totalApplied: allOperations.length,
      bufferSize: this.operationBuffer.length,
      retryQueueSize: this.retryQueue.length,
      currentVersion: this.getCurrentVersion(),
      compressionRate
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<OperationManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 清理操作管理器
   */
  clear(): void {
    this.operationBuffer = [];
    this.retryQueue = [];
    this.appliedOperations.clear();
    this.versionManager.clear();
  }

  /**
   * 销毁管理器
   */
  dispose(): void {
    this.eventEmitter.dispose();
    this.clear();
  }
}