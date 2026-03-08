/**
 * 协作管理器模块
 * 集成协作编辑器到现有应用架构
 */

import * as vscode from 'vscode';
import { CollaborativeEditor } from './collaborative-editor';
import { OperationManager } from './operation-manager';
import { EditOperation } from './edit-operation';

export class CollaborationManager {
  private static instance: CollaborationManager;
  private editors: Map<string, CollaborativeEditor> = new Map();
  private operationManager = new OperationManager();
  private isEnabled = false;

  private eventEmitter = new vscode.EventEmitter<{
    type: 'editor-created' | 'editor-destroyed' | 'collaboration-started' | 'collaboration-stopped';
    data: any;
  }>();

  public readonly onDidChange = this.eventEmitter.event;

  private constructor() {
    this.setupEventListeners();
  }

  static getInstance(): CollaborationManager {
    if (!CollaborationManager.instance) {
      CollaborationManager.instance = new CollaborationManager();
    }
    return CollaborationManager.instance;
  }

  /**
   * 启用协作编辑
   */
  enableCollaboration(): void {
    if (this.isEnabled) {
      return;
    }

    this.isEnabled = true;
    
    // 为所有打开的文档创建协作编辑器
    vscode.workspace.textDocuments.forEach(document => {
      this.createEditorForDocument(document);
    });

    this.eventEmitter.fire({
      type: 'collaboration-started',
      data: { timestamp: Date.now() }
    });

    vscode.window.showInformationMessage('协作编辑已启用');
  }

  /**
   * 禁用协作编辑
   */
  disableCollaboration(): void {
    if (!this.isEnabled) {
      return;
    }

    this.isEnabled = false;
    
    // 销毁所有协作编辑器
    this.editors.forEach(editor => {
      editor.dispose();
    });
    this.editors.clear();

    this.eventEmitter.fire({
      type: 'collaboration-stopped',
      data: { timestamp: Date.now() }
    });

    vscode.window.showInformationMessage('协作编辑已禁用');
  }

  /**
   * 获取文档的协作编辑器
   */
  getEditorForDocument(document: vscode.TextDocument): CollaborativeEditor | undefined {
    return this.editors.get(document.uri.toString());
  }

  /**
   * 创建协作状态面板
   */
  createCollaborationPanel(): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      'collaborationStatus',
      '协作状态',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = this.getCollaborationPanelHtml();

    // 更新面板内容
    const updatePanel = () => {
      panel.webview.html = this.getCollaborationPanelHtml();
    };

    // 监听状态变化
    const disposable = this.onDidChange(() => {
      updatePanel();
    });

    panel.onDidDispose(() => {
      disposable.dispose();
    });

    return panel;
  }

  /**
   * 发送本地操作到远程
   */
  sendLocalOperations(operations: EditOperation[]): void {
    // 在实际应用中，这里应该通过网络发送操作
    // 这里只是模拟发送
    console.log('发送操作到远程:', operations.length);
    
    // 添加到操作管理器
    this.operationManager.addOperations(operations);
  }

  /**
   * 接收远程操作
   */
  receiveRemoteOperations(documentUri: string, operations: EditOperation[]): void {
    const editor = this.editors.get(documentUri);
    if (editor) {
      editor.receiveRemoteOperations(operations);
    }
  }

  /**
   * 获取协作统计信息
   */
  getCollaborationStats(): {
    enabled: boolean;
    activeEditors: number;
    totalOperations: number;
    operationStats: any;
  } {
    const opStats = this.operationManager.getStats();
    
    return {
      enabled: this.isEnabled,
      activeEditors: this.editors.size,
      totalOperations: opStats.totalApplied,
      operationStats: opStats
    };
  }

  /**
   * 销毁管理器
   */
  dispose(): void {
    this.disableCollaboration();
    this.operationManager.dispose();
    this.eventEmitter.dispose();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听文档打开
    vscode.workspace.onDidOpenTextDocument(document => {
      if (this.isEnabled) {
        this.createEditorForDocument(document);
      }
    });

    // 监听文档关闭
    vscode.workspace.onDidCloseTextDocument(document => {
      const editor = this.editors.get(document.uri.toString());
      if (editor) {
        editor.dispose();
        this.editors.delete(document.uri.toString());
        
        this.eventEmitter.fire({
          type: 'editor-destroyed',
          data: { uri: document.uri.toString() }
        });
      }
    });

    // 监听文档变更
    vscode.workspace.onDidChangeTextDocument(event => {
      if (this.isEnabled && event.contentChanges.length > 0) {
        this.handleDocumentChange(event);
      }
    });
  }

  /**
   * 为文档创建协作编辑器
   */
  private createEditorForDocument(document: vscode.TextDocument): void {
    const uri = document.uri.toString();
    
    if (!this.editors.has(uri)) {
      const editor = new CollaborativeEditor(document);
      
      // 监听编辑器事件
      editor.onDidChange(event => {
        if (event.type === 'operation') {
          this.sendLocalOperations([event.data]);
        } else if (event.type === 'sync') {
          // 更新状态面板
          this.eventEmitter.fire({
            type: 'editor-created',
            data: { uri, state: editor.getState() }
          });
        }
      });

      this.editors.set(uri, editor);

      this.eventEmitter.fire({
        type: 'editor-created',
        data: { uri }
      });
    }
  }

  /**
   * 处理文档变更
   */
  private handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    const editor = this.editors.get(event.document.uri.toString());
    if (!editor) {
      return;
    }

    // 将 VS Code 的变更转换为协作操作
    const operations = this.convertChangesToOperations(event.contentChanges, 'local-user', event.document, editor);
    
    for (const operation of operations) {
      editor.applyOperation(operation);
    }
  }

  /**
   * 将 VS Code 变更转换为协作操作
   */
  private convertChangesToOperations(
    changes: readonly vscode.TextDocumentContentChangeEvent[],
    author: string,
    document: vscode.TextDocument,
    editor: CollaborativeEditor
  ): EditOperation[] {
    const operations: EditOperation[] = [];

    for (const change of changes) {
      const position = document.offsetAt(change.range.start);
      
      if (change.range.isEmpty) {
        // 插入操作
        operations.push(editor.createInsertOperation(position, change.text, author));
      } else if (change.text === '') {
        // 删除操作
        const length = document.offsetAt(change.range.end) - position;
        operations.push(editor.createDeleteOperation(position, length, author));
      } else {
        // 替换操作
        const length = document.offsetAt(change.range.end) - position;
        operations.push(editor.createReplaceOperation(position, length, change.text, author));
      }
    }

    return operations;
  }

  /**
   * 获取协作面板 HTML
   */
  private getCollaborationPanelHtml(): string {
    const stats = this.getCollaborationStats();
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            padding: 20px; 
            background: #1e1e1e; 
            color: #cccccc;
          }
          .status-item { 
            margin: 10px 0; 
            padding: 10px; 
            background: #252526; 
            border-radius: 5px; 
          }
          .status-label { 
            font-weight: bold; 
            color: #569cd6;
          }
          .status-value { 
            color: #ce9178;
          }
          .enabled { color: #4ec9b0; }
          .disabled { color: #f44747; }
        </style>
      </head>
      <body>
        <h2>协作编辑状态</h2>
        
        <div class="status-item">
          <span class="status-label">协作状态:</span>
          <span class="status-value ${stats.enabled ? 'enabled' : 'disabled'}">
            ${stats.enabled ? '已启用' : '已禁用'}
          </span>
        </div>

        <div class="status-item">
          <span class="status-label">活跃编辑器:</span>
          <span class="status-value">${stats.activeEditors}</span>
        </div>

        <div class="status-item">
          <span class="status-label">总操作数:</span>
          <span class="status-value">${stats.totalOperations}</span>
        </div>

        <div class="status-item">
          <span class="status-label">缓冲区大小:</span>
          <span class="status-value">${stats.operationStats.bufferSize}</span>
        </div>

        <div class="status-item">
          <span class="status-label">重试队列:</span>
          <span class="status-value">${stats.operationStats.retryQueueSize}</span>
        </div>

        <div class="status-item">
          <span class="status-label">压缩率:</span>
          <span class="status-value">${stats.operationStats.compressionRate.toFixed(2)}%</span>
        </div>

        <div class="status-item">
          <span class="status-label">当前版本:</span>
          <span class="status-value">${stats.operationStats.currentVersion}</span>
        </div>
      </body>
      </html>
    `;
  }
}