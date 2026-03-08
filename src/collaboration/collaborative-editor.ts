/**
 * 协作编辑器核心模块
 * 实现真正的实时协作编辑功能
 */

import * as vscode from 'vscode';
import { EditOperation, EditOperationFactory, OperationVersionManager } from './edit-operation';
import { ConflictResolver } from './conflict-resolver';

export interface CollaborativeEditorConfig {
  maxOperationHistory: number;
  syncInterval: number;
  conflictRetryAttempts: number;
  enableAutoMerge: boolean;
}

export interface EditorState {
  content: string;
  version: number;
  activeUsers: string[];
  lastSyncTime: number;
}

export class CollaborativeEditor {
  private config: CollaborativeEditorConfig = {
    maxOperationHistory: 1000,
    syncInterval: 100, // 100ms
    conflictRetryAttempts: 3,
    enableAutoMerge: true
  };

  private versionManager = new OperationVersionManager();
  private operationQueue: EditOperation[] = [];
  private pendingOperations: EditOperation[] = [];
  private syncTimer?: NodeJS.Timeout;
  private currentState: EditorState = {
    content: '',
    version: 0,
    activeUsers: [],
    lastSyncTime: Date.now()
  };

  private eventEmitter = new vscode.EventEmitter<{
    type: 'operation' | 'state' | 'conflict' | 'sync';
    data: any;
  }>();

  public readonly onDidChange = this.eventEmitter.event;

  constructor(private document: vscode.TextDocument) {
    this.currentState.content = document.getText();
    this.setupSyncTimer();
  }

  /**
   * 应用编辑操作
   */
  applyOperation(operation: EditOperation): boolean {
    try {
      // 检测冲突
      const conflicts = ConflictResolver.detectConflict(operation, this.pendingOperations);
      
      if (conflicts.length > 0) {
        // 尝试解决冲突
        const resolution = ConflictResolver.resolveConflict(operation, conflicts);
        
        if (!resolution.resolved || !resolution.operation) {
          this.eventEmitter.fire({
            type: 'conflict',
            data: {
              operation,
              conflicts,
              message: resolution.message
            }
          });
          return false;
        }

        operation = resolution.operation;
      }

      // 应用操作到文档
      this.applyToDocument(operation);

      // 添加到操作队列
      this.operationQueue.push(operation);
      this.versionManager.addOperation(operation);

      // 更新状态
      this.currentState.version = operation.version;
      this.currentState.lastSyncTime = Date.now();

      this.eventEmitter.fire({
        type: 'operation',
        data: operation
      });

      return true;
    } catch (error) {
      console.error('应用操作失败:', error);
      return false;
    }
  }

  /**
   * 批量应用操作
   */
  applyOperations(operations: EditOperation[]): number {
    let appliedCount = 0;
    
    for (const operation of operations) {
      if (this.applyOperation(operation)) {
        appliedCount++;
      }
    }

    return appliedCount;
  }

  /**
   * 接收远程操作
   */
  receiveRemoteOperations(operations: EditOperation[]): void {
    // 智能合并远程操作
    const mergedOperations = ConflictResolver.intelligentMerge(
      this.pendingOperations,
      operations
    );

    // 应用合并后的操作
    this.applyOperations(mergedOperations);

    this.eventEmitter.fire({
      type: 'sync',
      data: {
        received: operations.length,
        applied: mergedOperations.length,
        timestamp: Date.now()
      }
    });
  }

  /**
   * 获取待同步操作
   */
  getPendingOperations(): EditOperation[] {
    const operations = [...this.operationQueue];
    this.operationQueue = [];
    return operations;
  }

  /**
   * 获取当前状态
   */
  getState(): EditorState {
    return { ...this.currentState };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<CollaborativeEditorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.syncInterval) {
      this.setupSyncTimer();
    }
  }

  /**
   * 添加活动用户
   */
  addActiveUser(userId: string): void {
    if (!this.currentState.activeUsers.includes(userId)) {
      this.currentState.activeUsers.push(userId);
      this.eventEmitter.fire({
        type: 'state',
        data: { activeUsers: this.currentState.activeUsers }
      });
    }
  }

  /**
   * 移除活动用户
   */
  removeActiveUser(userId: string): void {
    const index = this.currentState.activeUsers.indexOf(userId);
    if (index > -1) {
      this.currentState.activeUsers.splice(index, 1);
      this.eventEmitter.fire({
        type: 'state',
        data: { activeUsers: this.currentState.activeUsers }
      });
    }
  }

  /**
   * 获取操作历史
   */
  getOperationHistory(): EditOperation[] {
    return this.versionManager.getAllOperations();
  }

  /**
   * 清理操作历史
   */
  clearHistory(): void {
    this.versionManager.clear();
    this.operationQueue = [];
    this.pendingOperations = [];
  }

  /**
   * 销毁编辑器
   */
  dispose(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    this.eventEmitter.dispose();
  }

  /**
   * 应用操作到文档
   */
  private applyToDocument(operation: EditOperation): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document !== this.document) {
      return;
    }

    const edit = new vscode.WorkspaceEdit();
    const position = this.document.positionAt(operation.position);

    switch (operation.type) {
      case 'insert':
        if (operation.content) {
          edit.insert(this.document.uri, position, operation.content);
        }
        break;

      case 'delete':
        if (operation.length) {
          const endPosition = this.document.positionAt(operation.position + operation.length);
          const range = new vscode.Range(position, endPosition);
          edit.delete(this.document.uri, range);
        }
        break;

      case 'replace':
        if (operation.length && operation.content) {
          const endPosition = this.document.positionAt(operation.position + operation.length);
          const range = new vscode.Range(position, endPosition);
          edit.replace(this.document.uri, range, operation.content);
        }
        break;
    }

    vscode.workspace.applyEdit(edit);
  }

  /**
   * 设置同步定时器
   */
  private setupSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.syncOperations();
    }, this.config.syncInterval);
  }

  /**
   * 同步操作
   */
  private syncOperations(): void {
    const pendingOps = this.getPendingOperations();
    if (pendingOps.length > 0) {
      // 在实际应用中，这里应该发送到服务器或其他客户端
      this.eventEmitter.fire({
        type: 'sync',
        data: {
          operations: pendingOps,
          timestamp: Date.now()
        }
      });
    }

    // 更新状态
    this.currentState.lastSyncTime = Date.now();
    this.eventEmitter.fire({
      type: 'state',
      data: this.currentState
    });
  }

  /**
   * 创建插入操作
   */
  createInsertOperation(position: number, content: string, author: string): EditOperation {
    const version = this.versionManager.getNextVersion();
    return EditOperationFactory.createInsert(position, content, author, version);
  }

  /**
   * 创建删除操作
   */
  createDeleteOperation(position: number, length: number, author: string): EditOperation {
    const version = this.versionManager.getNextVersion();
    return EditOperationFactory.createDelete(position, length, author, version);
  }

  /**
   * 创建替换操作
   */
  createReplaceOperation(position: number, length: number, content: string, author: string): EditOperation {
    const version = this.versionManager.getNextVersion();
    return EditOperationFactory.createReplace(position, length, content, author, version);
  }
}