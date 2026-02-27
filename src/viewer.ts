import * as vscode from 'vscode';
import * as path from 'path';
import WebSocket from 'ws';
import {
  MessageType,
  LiveMessage,
  Position,
  Selection,
} from './protocol';
import { LiveCodeDocumentProvider } from './virtualDocument';
import { LiveCodeTreeDataProvider } from './liveCodeTree';

/**
 * Viewer 模式 - 观众端
 * 连接主播的 WebSocket 服务器，在 VSCode 中以只读虚拟文档展示主播代码
 */
export class Viewer {

  private ws: WebSocket | null = null;
  private statusBarItem: vscode.StatusBarItem;
  private documentProvider: LiveCodeDocumentProvider;
  private treeProvider: LiveCodeTreeDataProvider | null;

  private currentUri: vscode.Uri | null = null;
  private currentEditor: vscode.TextEditor | null = null;

  /** 主播光标装饰 - 黄色竖线 */
  private cursorDecorationType: vscode.TextEditorDecorationType;
  /** 主播选区装饰 - 半透明黄色背景 */
  private selectionDecorationType: vscode.TextEditorDecorationType;

  private disposables: vscode.Disposable[] = [];

  /** 断开连接回调，通知外部清理引用 */
  private _onDisconnectCallback: (() => void) | null = null;

  constructor(
    documentProvider: LiveCodeDocumentProvider,
    treeProvider: LiveCodeTreeDataProvider | null = null
  ) {
    this.documentProvider = documentProvider;
    this.treeProvider = treeProvider;

    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );

    this.cursorDecorationType = vscode.window.createTextEditorDecorationType({
      border: '2px solid #FFD700',
      borderRadius: '1px',
    });

    this.selectionDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 215, 0, 0.2)',
      borderRadius: '2px',
    });
  }

  set onDisconnect(callback: () => void) {
    this._onDisconnectCallback = callback;
  }

  async connect(address: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const url = `ws://${address}`;
      this.ws = new WebSocket(url);

      const connectTimeout = setTimeout(() => {
        this.ws?.terminate();
        reject(new Error('连接超时'));
      }, 5000);

      this.ws.on('open', () => {
        clearTimeout(connectTimeout);
        this.statusBarItem.text = `$(eye) 观看中: ${address}`;
        this.statusBarItem.tooltip = '点击断开连接';
        this.statusBarItem.command = 'live-code-viewer.disconnect';
        this.statusBarItem.show();

        this.registerEditorTracking();

        vscode.window.showInformationMessage(
          `Live Code: 已连接到 ${address}`
        );
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message: LiveMessage = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch {
          /* 忽略格式错误的消息 */
        }
      });

      this.ws.on('close', () => {
        clearTimeout(connectTimeout);
        this.handleDisconnected('连接已断开');
      });

      this.ws.on('error', (err: Error) => {
        clearTimeout(connectTimeout);
        reject(new Error(`连接失败: ${err.message}`));
      });
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.handleDisconnected();
  }

  private handleDisconnected(reason?: string): void {
    this.statusBarItem.hide();
    this.cleanupDecorations();
    this.currentEditor = null;
    this.currentUri = null;
    this.treeProvider?.clear();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];

    if (reason) {
      vscode.window.showInformationMessage(`Live Code: ${reason}`);
    }

    this._onDisconnectCallback?.();
  }

  /** 跟踪可见编辑器变化，确保 currentEditor 引用有效 */
  private registerEditorTracking(): void {
    this.disposables.push(
      vscode.window.onDidChangeVisibleTextEditors((editors) => {
        if (!this.currentUri) { return; }
        const target = editors.find(
          (e) => e.document.uri.toString() === this.currentUri!.toString()
        );
        if (target) {
          this.currentEditor = target;
        } else {
          this.currentEditor = null;
        }
      })
    );
  }

  private async handleMessage(message: LiveMessage): Promise<void> {
    switch (message.type) {
      case MessageType.Sync:
      case MessageType.FileChange:
        await this.handleFileSync(
          message.fileName,
          message.languageId,
          message.content,
          message.relativePath
        );
        if ('cursor' in message && message.cursor) {
          this.updateCursorDecoration(message.cursor);
        }
        if ('selections' in message && message.selections) {
          this.updateSelectionDecorations(message.selections);
        }
        break;

      case MessageType.FileClose:
        if (this.currentUri) {
          this.cleanupDecorations();
          await this.closeLiveCodeEditor(this.currentUri);
        }
        this.currentUri = null;
        this.currentEditor = null;
        break;

      case MessageType.ContentChange:
        if (this.currentUri) {
          this.documentProvider.updateContent(
            this.currentUri,
            message.fullContent
          );
        }
        break;

      case MessageType.SelectionChange:
        this.updateCursorDecoration(message.cursor);
        this.updateSelectionDecorations(message.selections);
        break;

      case MessageType.WorkspaceTree:
        this.treeProvider?.updatePaths(Array.isArray(message.paths) ? message.paths : []);
        break;

      case MessageType.ViewerCount:
        break;
    }
  }

  /**
   * 文件同步处理：创建/更新虚拟文档并打开编辑器
   * URI 使用 relativePath 或 basename，观众端标签页可显示项目内路径
   */
  private async handleFileSync(
    fileName: string,
    languageId: string,
    content: string,
    relativePath?: string
  ): Promise<void> {
    const pathSegment = relativePath ?? path.basename(fileName);
    const uri = vscode.Uri.parse(`livecode:/${pathSegment}`);

    this.documentProvider.updateContent(uri, content);
    this.currentUri = uri;

    try {
      const doc = await vscode.workspace.openTextDocument(uri);

      // 尝试设置语言模式（URI 扩展名可能无法覆盖所有语言）
      try {
        await vscode.languages.setTextDocumentLanguage(doc, languageId);
      } catch {
        /* 语言 ID 不存在时忽略，依赖 URI 扩展名推断 */
      }

      this.currentEditor = await vscode.window.showTextDocument(doc, {
        preview: false,
        preserveFocus: false,
      });
    } catch (err) {
      console.error('Live Code Viewer: 打开文档失败', err);
    }
  }

  /** 渲染主播光标位置（黄色边框装饰） */
  private updateCursorDecoration(cursor: Position): void {
    if (!this.currentEditor) { return; }

    const pos = new vscode.Position(cursor.line, cursor.character);
    const endPos = pos.translate(0, 1);
    const range = new vscode.Range(pos, endPos);

    this.currentEditor.setDecorations(this.cursorDecorationType, [{ range }]);

    this.currentEditor.revealRange(
      new vscode.Range(pos, pos),
      vscode.TextEditorRevealType.InCenterIfOutsideViewport
    );
  }

  /** 渲染主播选区（半透明黄色背景） */
  private updateSelectionDecorations(selections: Selection[]): void {
    if (!this.currentEditor) { return; }

    const decorations = selections
      .filter(
        (s) =>
          s.start.line !== s.end.line ||
          s.start.character !== s.end.character
      )
      .map((s) => ({
        range: new vscode.Range(
          new vscode.Position(s.start.line, s.start.character),
          new vscode.Position(s.end.line, s.end.character)
        ),
      }));

    this.currentEditor.setDecorations(
      this.selectionDecorationType,
      decorations
    );
  }

  private cleanupDecorations(): void {
    if (this.currentEditor) {
      this.currentEditor.setDecorations(this.cursorDecorationType, []);
      this.currentEditor.setDecorations(this.selectionDecorationType, []);
    }
  }

  /** 关闭观众端展示的直播文档标签页 */
  private async closeLiveCodeEditor(uri: vscode.Uri): Promise<void> {
    const target = vscode.window.visibleTextEditors.find(
      (e) => e.document.uri.toString() === uri.toString()
    );
    if (target) {
      await vscode.window.showTextDocument(target.document, { preserveFocus: false });
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }
  }

  dispose(): void {
    this.disconnect();
    this.cursorDecorationType.dispose();
    this.selectionDecorationType.dispose();
    this.statusBarItem.dispose();
  }
}
