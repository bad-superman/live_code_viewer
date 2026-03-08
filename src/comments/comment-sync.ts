/**
 * 评论同步模块
 * 实现评论的实时同步功能
 */

import * as vscode from 'vscode';
import { CodeCommentManager, CodeComment, CommentReply } from './code-comment-manager';

export interface SyncOperation {
  type: 'comment-add' | 'comment-resolve' | 'comment-unresolve' | 'reply-add' | 'comment-delete';
  data: any;
  timestamp: number;
  author: string;
}

export interface SyncConfig {
  syncInterval: number;
  enableRealTimeSync: boolean;
  conflictResolution: 'timestamp' | 'authority';
  maxSyncRetries: number;
}

export class CommentSync {
  private config: SyncConfig = {
    syncInterval: 5000, // 5秒
    enableRealTimeSync: true,
    conflictResolution: 'timestamp',
    maxSyncRetries: 3
  };

  private commentManager: CodeCommentManager;
  private syncQueue: SyncOperation[] = [];
  private syncTimer?: NodeJS.Timeout;

  private eventEmitter = new vscode.EventEmitter<{
    type: 'sync-operation' | 'sync-complete' | 'conflict-detected';
    data: any;
  }>();

  public readonly onDidChange = this.eventEmitter.event;

  constructor(commentManager: CodeCommentManager) {
    this.commentManager = commentManager;
    this.setupSyncTimer();
    this.setupEventListeners();
  }

  /**
   * 添加评论同步操作
   */
  addComment(
    documentUri: string,
    line: number,
    character: number,
    content: string,
    author: string
  ): void {
    const syncOp: SyncOperation = {
      type: 'comment-add',
      data: {
        documentUri,
        line,
        character,
        content
      },
      timestamp: Date.now(),
      author
    };

    this.addToSyncQueue(syncOp);
  }

  /**
   * 解析评论同步操作
   */
  resolveComment(commentId: string, author: string): void {
    const syncOp: SyncOperation = {
      type: 'comment-resolve',
      data: { commentId },
      timestamp: Date.now(),
      author
    };

    this.addToSyncQueue(syncOp);
  }

  /**
   * 取消解析评论同步操作
   */
  unresolveComment(commentId: string, author: string): void {
    const syncOp: SyncOperation = {
      type: 'comment-unresolve',
      data: { commentId },
      timestamp: Date.now(),
      author
    };

    this.addToSyncQueue(syncOp);
  }

  /**
   * 添加回复同步操作
   */
  addReply(commentId: string, content: string, author: string): void {
    const syncOp: SyncOperation = {
      type: 'reply-add',
      data: {
        commentId,
        content
      },
      timestamp: Date.now(),
      author
    };

    this.addToSyncQueue(syncOp);
  }

  /**
   * 删除评论同步操作
   */
  deleteComment(commentId: string, author: string): void {
    const syncOp: SyncOperation = {
      type: 'comment-delete',
      data: { commentId },
      timestamp: Date.now(),
      author
    };

    this.addToSyncQueue(syncOp);
  }

  /**
   * 处理远程同步操作
   */
  processRemoteOperation(operation: SyncOperation): boolean {
    try {
      switch (operation.type) {
        case 'comment-add':
          return this.processRemoteCommentAdd(operation);
        
        case 'comment-resolve':
          return this.processRemoteCommentResolve(operation);
        
        case 'comment-unresolve':
          return this.processRemoteCommentUnresolve(operation);
        
        case 'reply-add':
          return this.processRemoteReplyAdd(operation);
        
        case 'comment-delete':
          return this.processRemoteCommentDelete(operation);
        
        default:
          console.warn('未知的同步操作类型:', operation.type);
          return false;
      }
    } catch (error) {
      console.error('处理远程操作失败:', error);
      return false;
    }
  }

  /**
   * 批量处理远程操作
   */
  processRemoteOperations(operations: SyncOperation[]): number {
    let processedCount = 0;

    for (const operation of operations) {
      if (this.processRemoteOperation(operation)) {
        processedCount++;
      }
    }

    return processedCount;
  }

  /**
   * 获取待同步操作
   */
  getPendingOperations(): SyncOperation[] {
    const operations = [...this.syncQueue];
    this.syncQueue = [];
    return operations;
  }

  /**
   * 处理远程评论添加
   */
  private processRemoteCommentAdd(operation: SyncOperation): boolean {
    const { documentUri, line, character, content } = operation.data;
    
    const comment = this.commentManager.addComment(
      documentUri,
      line,
      character,
      content,
      operation.author
    );

    return comment !== null;
  }

  /**
   * 处理远程评论解析
   */
  private processRemoteCommentResolve(operation: SyncOperation): boolean {
    const { commentId } = operation.data;
    return this.commentManager.resolveComment(commentId);
  }

  /**
   * 处理远程评论取消解析
   */
  private processRemoteCommentUnresolve(operation: SyncOperation): boolean {
    const { commentId } = operation.data;
    return this.commentManager.unresolveComment(commentId);
  }

  /**
   * 处理远程回复添加
   */
  private processRemoteReplyAdd(operation: SyncOperation): boolean {
    const { commentId, content } = operation.data;
    
    const reply = this.commentManager.addReply(
      commentId,
      content,
      operation.author
    );

    return reply !== null;
  }

  /**
   * 处理远程评论删除
   */
  private processRemoteCommentDelete(operation: SyncOperation): boolean {
    const { commentId } = operation.data;
    return this.commentManager.deleteComment(commentId);
  }

  /**
   * 添加到同步队列
   */
  private addToSyncQueue(operation: SyncOperation): void {
    this.syncQueue.push(operation);

    // 实时同步
    if (this.config.enableRealTimeSync) {
      this.triggerSync();
    }
  }

  /**
   * 设置同步定时器
   */
  private setupSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.triggerSync();
    }, this.config.syncInterval);
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听评论管理器事件
    this.commentManager.onDidChange(event => {
      if (event.type === 'comment-added') {
        this.onLocalCommentAdded(event.data);
      } else if (event.type === 'comment-resolved') {
        this.onLocalCommentResolved(event.data);
      } else if (event.type === 'reply-added') {
        this.onLocalReplyAdded(event.data);
      }
    });
  }

  /**
   * 本地评论添加处理
   */
  private onLocalCommentAdded(comment: CodeComment): void {
    // 本地操作已经通过同步方法处理，这里不需要额外处理
  }

  /**
   * 本地评论解析处理
   */
  private onLocalCommentResolved(comment: CodeComment): void {
    // 本地操作已经通过同步方法处理，这里不需要额外处理
  }

  /**
   * 本地回复添加处理
   */
  private onLocalReplyAdded(data: { comment: CodeComment; reply: CommentReply }): void {
    // 本地操作已经通过同步方法处理，这里不需要额外处理
  }

  /**
   * 触发同步
   */
  private triggerSync(): void {
    const pendingOps = this.getPendingOperations();
    if (pendingOps.length === 0) {
      return;
    }

    // 在实际应用中，这里应该发送到服务器或其他客户端
    this.eventEmitter.fire({
      type: 'sync-operation',
      data: {
        operations: pendingOps,
        timestamp: Date.now()
      }
    });

    this.eventEmitter.fire({
      type: 'sync-complete',
      data: {
        syncedCount: pendingOps.length,
        timestamp: Date.now()
      }
    });
  }

  /**
   * 检测冲突
   */
  private detectConflict(localOp: SyncOperation, remoteOp: SyncOperation): boolean {
    // 相同类型的操作可能冲突
    if (localOp.type !== remoteOp.type) {
      return false;
    }

    // 相同评论的操作可能冲突
    if (localOp.data.commentId && remoteOp.data.commentId) {
      return localOp.data.commentId === remoteOp.data.commentId;
    }

    // 相同位置的操作可能冲突
    if (localOp.data.documentUri && remoteOp.data.documentUri) {
      return (
        localOp.data.documentUri === remoteOp.data.documentUri &&
        localOp.data.line === remoteOp.data.line &&
        localOp.data.character === remoteOp.data.character
      );
    }

    return false;
  }

  /**
   * 解决冲突
   */
  private resolveConflict(localOp: SyncOperation, remoteOp: SyncOperation): SyncOperation {
    switch (this.config.conflictResolution) {
      case 'timestamp':
        // 基于时间戳：较新的操作优先
        return localOp.timestamp > remoteOp.timestamp ? localOp : remoteOp;
      
      case 'authority':
        // 基于权限：特定作者优先
        // 这里可以扩展为更复杂的权限系统
        return localOp;
      
      default:
        return localOp;
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.syncInterval) {
      this.setupSyncTimer();
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): SyncConfig {
    return { ...this.config };
  }

  /**
   * 获取同步统计信息
   */
  getSyncStats(): {
    queueSize: number;
    totalSynced: number;
    lastSyncTime: number;
  } {
    return {
      queueSize: this.syncQueue.length,
      totalSynced: 0, // 在实际应用中应该记录
      lastSyncTime: Date.now()
    };
  }

  /**
   * 清理同步器
   */
  clear(): void {
    this.syncQueue = [];
  }

  /**
   * 销毁同步器
   */
  dispose(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    this.eventEmitter.dispose();
    this.clear();
  }
}