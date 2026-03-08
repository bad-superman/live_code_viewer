/**
 * 网络同步优化器模块
 * 提升网络连接稳定性和同步性能
 */

import * as vscode from 'vscode';
import { EditOperation } from '../collaboration/edit-operation';

export interface NetworkStats {
  connectionCount: number;
  successRate: number;
  averageLatency: number;
  totalBytesSent: number;
  totalBytesReceived: number;
  retryCount: number;
}

export interface NetworkConfig {
  maxRetryAttempts: number;
  retryDelay: number;
  batchSize: number;
  enableCompression: boolean;
  connectionTimeout: number;
}

export class NetworkOptimizer {
  private config: NetworkConfig = {
    maxRetryAttempts: 3,
    retryDelay: 100, // 100ms
    batchSize: 10,
    enableCompression: true,
    connectionTimeout: 5000 // 5秒
  };

  private connectionStats: Map<string, NetworkStats> = new Map();
  private retryQueue: Map<string, { operation: EditOperation; attempts: number }[]> = new Map();
  private sentBytes = 0;
  private receivedBytes = 0;

  private eventEmitter = new vscode.EventEmitter<{
    type: 'network-update' | 'operation-sent' | 'operation-received' | 'retry-queued';
    data: any;
  }>();

  public readonly onDidChange = this.eventEmitter.event;

  /**
   * 发送操作到网络
   */
  async sendOperations(
    connectionId: string,
    operations: EditOperation[],
    sendFunction: (ops: EditOperation[]) => Promise<boolean>
  ): Promise<boolean> {
    if (operations.length === 0) {
      return true;
    }

    // 优化操作
    const optimizedOperations = this.optimizeForNetwork(operations);
    
    try {
      const success = await sendFunction(optimizedOperations);
      
      if (success) {
        // 更新统计信息
        this.updateSendStats(connectionId, optimizedOperations);
        
        this.eventEmitter.fire({
          type: 'operation-sent',
          data: {
            connectionId,
            operations: optimizedOperations.length,
            bytes: this.calculateOperationsSize(optimizedOperations),
            timestamp: Date.now()
          }
        });
        
        return true;
      } else {
        // 发送失败，添加到重试队列
        this.addToRetryQueue(connectionId, operations);
        return false;
      }
    } catch (error) {
      console.error('发送操作失败:', error);
      this.addToRetryQueue(connectionId, operations);
      return false;
    }
  }

  /**
   * 接收网络操作
   */
  receiveOperations(
    connectionId: string,
    operations: EditOperation[]
  ): EditOperation[] {
    if (operations.length === 0) {
      return [];
    }

    // 解压缩操作
    const decompressedOperations = this.decompressFromNetwork(operations);
    
    // 更新统计信息
    this.updateReceiveStats(connectionId, decompressedOperations);

    this.eventEmitter.fire({
      type: 'operation-received',
      data: {
        connectionId,
        operations: decompressedOperations.length,
        bytes: this.calculateOperationsSize(decompressedOperations),
        timestamp: Date.now()
      }
    });

    return decompressedOperations;
  }

  /**
   * 优化操作以便网络传输
   */
  private optimizeForNetwork(operations: EditOperation[]): EditOperation[] {
    let optimized = [...operations];

    // 应用批处理
    if (this.config.batchSize > 1) {
      optimized = this.applyNetworkBatching(optimized);
    }

    // 应用压缩
    if (this.config.enableCompression) {
      optimized = this.applyNetworkCompression(optimized);
    }

    return optimized;
  }

  /**
   * 应用网络批处理
   */
  private applyNetworkBatching(operations: EditOperation[]): EditOperation[] {
    if (operations.length <= this.config.batchSize) {
      return operations;
    }

    const batches: EditOperation[][] = [];
    
    for (let i = 0; i < operations.length; i += this.config.batchSize) {
      batches.push(operations.slice(i, i + this.config.batchSize));
    }

    const batchedOperations: EditOperation[] = [];
    
    for (const batch of batches) {
      if (batch.length === 1) {
        batchedOperations.push(batch[0]);
      } else {
        const batchOperation = this.createNetworkBatchOperation(batch);
        batchedOperations.push(batchOperation);
      }
    }

    return batchedOperations;
  }

  /**
   * 应用网络压缩
   */
  private applyNetworkCompression(operations: EditOperation[]): EditOperation[] {
    const compressed: EditOperation[] = [];
    
    for (const operation of operations) {
      if (this.shouldCompressForNetwork(operation)) {
        const compressedOp = this.compressForNetwork(operation);
        compressed.push(compressedOp);
      } else {
        compressed.push(operation);
      }
    }

    return compressed;
  }

  /**
   * 检查是否应该为网络压缩
   */
  private shouldCompressForNetwork(operation: EditOperation): boolean {
    if (!this.config.enableCompression) {
      return false;
    }

    const operationSize = this.calculateOperationSize(operation);
    return operationSize > 50; // 50字节以上压缩
  }

  /**
   * 为网络压缩操作
   */
  private compressForNetwork(operation: EditOperation): EditOperation {
    // 使用简单的 base64 编码
    if (operation.content && operation.content.length > 10) {
      return {
        ...operation,
        content: Buffer.from(operation.content).toString('base64'),
        metadata: {
          ...operation.metadata,
          networkCompressed: true,
          originalEncoding: 'utf8'
        }
      };
    }

    return operation;
  }

  /**
   * 从网络解压缩操作
   */
  private decompressFromNetwork(operations: EditOperation[]): EditOperation[] {
    const decompressed: EditOperation[] = [];
    
    for (const operation of operations) {
      if (operation.metadata?.networkCompressed && operation.content) {
        const decompressedOp = this.decompressOperation(operation);
        decompressed.push(decompressedOp);
      } else if (operation.type === 'batch') {
        const decompressedBatch = this.decompressBatchOperation(operation);
        decompressed.push(...decompressedBatch);
      } else {
        decompressed.push(operation);
      }
    }

    return decompressed;
  }

  /**
   * 解压缩单个操作
   */
  private decompressOperation(operation: EditOperation): EditOperation {
    if (operation.content && operation.metadata?.networkCompressed) {
      return {
        ...operation,
        content: Buffer.from(operation.content, 'base64').toString('utf8'),
        metadata: {
          ...operation.metadata,
          networkCompressed: false
        }
      };
    }

    return operation;
  }

  /**
   * 解压缩批处理操作
   */
  private decompressBatchOperation(operation: EditOperation): EditOperation[] {
    if (!operation.metadata?.batch || !operation.content) {
      return [operation];
    }

    const operations: EditOperation[] = [];
    const operationStrings = operation.content.split('|');
    
    for (const opStr of operationStrings) {
      const [type, position, content, length] = opStr.split(':');
      
      operations.push({
        id: `decompressed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: type as any,
        position: parseInt(position, 10),
        content: content || undefined,
        length: length ? parseInt(length, 10) : undefined,
        timestamp: operation.timestamp,
        author: operation.author,
        version: operation.version
      });
    }

    return operations;
  }

  /**
   * 创建网络批处理操作
   */
  private createNetworkBatchOperation(operations: EditOperation[]): EditOperation {
    const firstOp = operations[0];
    const lastOp = operations[operations.length - 1];

    return {
      id: `network-batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'batch',
      position: firstOp.position,
      content: operations.map(op => this.operationToNetworkString(op)).join('|'),
      timestamp: Date.now(),
      author: firstOp.author,
      version: lastOp.version,
      metadata: {
        batch: true,
        operationCount: operations.length,
        networkBatch: true
      }
    };
  }

  /**
   * 操作转换为网络字符串
   */
  private operationToNetworkString(operation: EditOperation): string {
    return `${operation.type}:${operation.position}:${operation.content || ''}:${operation.length || 0}`;
  }

  /**
   * 添加到重试队列
   */
  private addToRetryQueue(connectionId: string, operations: EditOperation[]): void {
    const queue = this.retryQueue.get(connectionId) || [];
    
    for (const operation of operations) {
      queue.push({
        operation,
        attempts: 0
      });
    }
    
    this.retryQueue.set(connectionId, queue);

    this.eventEmitter.fire({
      type: 'retry-queued',
      data: {
        connectionId,
        operations: operations.length,
        totalQueued: queue.length
      }
    });

    // 延迟重试
    setTimeout(() => {
      this.retryOperations(connectionId);
    }, this.config.retryDelay);
  }

  /**
   * 重试操作
   */
  private async retryOperations(connectionId: string): Promise<void> {
    const queue = this.retryQueue.get(connectionId);
    if (!queue || queue.length === 0) {
      return;
    }

    const retryItems = [...queue];
    this.retryQueue.set(connectionId, []);

    const successful: EditOperation[] = [];
    const failed: { operation: EditOperation; attempts: number }[] = [];

    for (const item of retryItems) {
      if (item.attempts >= this.config.maxRetryAttempts) {
        // 超过最大重试次数，放弃
        continue;
      }

      item.attempts++;
      
      // 在实际应用中，这里应该调用实际的发送函数
      // 这里只是模拟发送
      const success = Math.random() > 0.3; // 70% 成功率
      
      if (success) {
        successful.push(item.operation);
      } else {
        failed.push(item);
      }
    }

    // 将失败的操作重新加入队列
    if (failed.length > 0) {
      const currentQueue = this.retryQueue.get(connectionId) || [];
      currentQueue.push(...failed);
      this.retryQueue.set(connectionId, currentQueue);
    }

    // 更新统计信息
    this.updateRetryStats(connectionId, successful.length, failed.length);

    console.log(`重试结果: ${successful.length}成功, ${failed.length}失败`);
  }

  /**
   * 更新发送统计信息
   */
  private updateSendStats(connectionId: string, operations: EditOperation[]): void {
    const stats = this.connectionStats.get(connectionId) || this.createDefaultStats();
    
    const bytes = this.calculateOperationsSize(operations);
    stats.totalBytesSent += bytes;
    this.sentBytes += bytes;
    
    this.connectionStats.set(connectionId, stats);
  }

  /**
   * 更新接收统计信息
   */
  private updateReceiveStats(connectionId: string, operations: EditOperation[]): void {
    const stats = this.connectionStats.get(connectionId) || this.createDefaultStats();
    
    const bytes = this.calculateOperationsSize(operations);
    stats.totalBytesReceived += bytes;
    this.receivedBytes += bytes;
    
    this.connectionStats.set(connectionId, stats);
  }

  /**
   * 更新重试统计信息
   */
  private updateRetryStats(connectionId: string, successCount: number, failCount: number): void {
    const stats = this.connectionStats.get(connectionId) || this.createDefaultStats();
    
    stats.retryCount += failCount;
    
    this.connectionStats.set(connectionId, stats);
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
   * 计算操作组大小
   */
  private calculateOperationsSize(operations: EditOperation[]): number {
    return operations.reduce((total, op) => total + this.calculateOperationSize(op), 0);
  }

  /**
   * 创建默认统计信息
   */
  private createDefaultStats(): NetworkStats {
    return {
      connectionCount: 0,
      successRate: 0,
      averageLatency: 0,
      totalBytesSent: 0,
      totalBytesReceived: 0,
      retryCount: 0
    };
  }

  /**
   * 获取网络统计信息
   */
  getNetworkStats(): Map<string, NetworkStats> {
    return new Map(this.connectionStats);
  }

  /**
   * 获取总统计信息
   */
  getTotalStats(): {
    totalConnections: number;
    totalBytesSent: number;
    totalBytesReceived: number;
    totalRetryCount: number;
  } {
    let totalRetry = 0;
    
    for (const stats of this.connectionStats.values()) {
      totalRetry += stats.retryCount;
    }

    return {
      totalConnections: this.connectionStats.size,
      totalBytesSent: this.sentBytes,
      totalBytesReceived: this.receivedBytes,
      totalRetryCount: totalRetry
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<NetworkConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取当前配置
   */
  getConfig(): NetworkConfig {
    return { ...this.config };
  }

  /**
   * 清理网络优化器
   */
  clear(): void {
    this.connectionStats.clear();
    this.retryQueue.clear();
    this.sentBytes = 0;
    this.receivedBytes = 0;
  }

  /**
   * 销毁优化器
   */
  dispose(): void {
    this.eventEmitter.dispose();
    this.clear();
  }
}