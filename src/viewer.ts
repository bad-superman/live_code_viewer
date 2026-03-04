import * as vscode from 'vscode';
import * as path from 'path';
import WebSocket from 'ws';
import {
  MessageType,
  LiveMessage,
  Position,
  Selection,
  TerminalOpenMessage,
  TerminalCloseMessage,
  TerminalCommandMessage,
  TerminalOutputMessage,
  TerminalCommandEndMessage,
} from './protocol';
import { LiveCodeDocumentProvider } from './virtualDocument';
import { LiveCodeTreeDataProvider, LiveCodeTreeNode } from './liveCodeTree';

/** 伪终端：在观众端原生终端面板中展示主播终端内容（只读） */
class LiveCodePseudoterminal implements vscode.Pseudoterminal {
  private writeEmitter = new vscode.EventEmitter<string>();
  readonly onDidWrite = this.writeEmitter.event;

  private closeEmitter = new vscode.EventEmitter<number | void>();
  readonly onDidClose = this.closeEmitter.event;

  open(): void {}
  close(): void {}

  /** 向终端写入文本（供外部调用） */
  fire(data: string): void {
    this.writeEmitter.fire(data);
  }

  /** 关闭此伪终端 */
  shutdown(): void {
    this.closeEmitter.fire();
  }

  dispose(): void {
    this.writeEmitter.dispose();
    this.closeEmitter.dispose();
  }
}

/**
 * Viewer 模式 - 观众端
 * 连接主播的 WebSocket 服务器，在 VSCode 中以只读虚拟文档展示主播代码
 */
export class Viewer {

  private ws: WebSocket | null = null;
  private statusBarItem: vscode.StatusBarItem;
  private documentProvider: LiveCodeDocumentProvider;
  private treeProvider: LiveCodeTreeDataProvider | null;
  private treeView: vscode.TreeView<LiveCodeTreeNode> | null;

  private currentUri: vscode.Uri | null = null;
  /** 当前展示文件的相对路径，用于目录树 reveal */
  private currentRelativePath: string | null = null;
  private currentEditor: vscode.TextEditor | null = null;

  /** 主播光标装饰 - 黄色竖线 */
  private cursorDecorationType: vscode.TextEditorDecorationType;
  /** 主播选区装饰 - 半透明黄色背景 */
  private selectionDecorationType: vscode.TextEditorDecorationType;

  private disposables: vscode.Disposable[] = [];

  /** 主播终端 ID → 观众端伪终端和 VS Code Terminal 实例 */
  private terminalMap = new Map<number, { pty: LiveCodePseudoterminal; terminal: vscode.Terminal }>();

  /** 断开连接回调，通知外部清理引用 */
  private _onDisconnectCallback: (() => void) | null = null;

  constructor(
    documentProvider: LiveCodeDocumentProvider,
    treeProvider: LiveCodeTreeDataProvider | null = null,
    treeView: vscode.TreeView<LiveCodeTreeNode> | null = null
  ) {
    this.documentProvider = documentProvider;
    this.treeProvider = treeProvider;
    this.treeView = treeView;

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
    this.cleanupTerminals();
    this.currentEditor = null;
    this.currentUri = null;
    this.currentRelativePath = null;
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
        this.revealInTree(message.relativePath ?? this.currentRelativePath);
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
        this.currentRelativePath = null;
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
        this.revealInTree(this.currentRelativePath);
        break;

      case MessageType.ViewerCount:
        break;

      case MessageType.TerminalOpen:
        this.handleTerminalOpen(message);
        break;

      case MessageType.TerminalClose:
        this.handleTerminalClose(message);
        break;

      case MessageType.TerminalCommand:
        this.handleTerminalCommand(message);
        break;

      case MessageType.TerminalOutput:
        this.handleTerminalOutput(message);
        break;

      case MessageType.TerminalCommandEnd:
        this.handleTerminalCommandEnd(message);
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
    this.currentRelativePath = pathSegment;
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

  /** 在目录树中展开并选中指定相对路径的节点，与主播当前打开文件同步 */
  private revealInTree(relativePath: string | null | undefined): void {
    if (!relativePath || !this.treeView || !this.treeProvider) return;
    const node = this.treeProvider.getNodeByPath(relativePath);
    if (node) {
      this.treeView.reveal(node, { select: true, focus: false, expand: true }).then(
        () => {},
        () => {}
      );
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

  /** 创建伪终端并在终端面板中显示 */
  private handleTerminalOpen(msg: TerminalOpenMessage): void {
    if (this.terminalMap.has(msg.terminalId)) { return; }

    const pty = new LiveCodePseudoterminal();
    const terminal = vscode.window.createTerminal({
      name: `[Live] ${msg.name}`,
      pty,
    });
    this.terminalMap.set(msg.terminalId, { pty, terminal });
  }

  private handleTerminalClose(msg: TerminalCloseMessage): void {
    const entry = this.terminalMap.get(msg.terminalId);
    if (!entry) { return; }
    entry.pty.shutdown();
    entry.pty.dispose();
    this.terminalMap.delete(msg.terminalId);
  }

  private handleTerminalCommand(msg: TerminalCommandMessage): void {
    const entry = this.ensureTerminal(msg.terminalId);
    entry.pty.fire(`\x1b[1;32m$ ${msg.command}\x1b[0m\r\n`);
    entry.terminal.show(true);
  }

  private handleTerminalOutput(msg: TerminalOutputMessage): void {
    const entry = this.ensureTerminal(msg.terminalId);
    const data = msg.data.replace(/\r?\n/g, '\r\n');
    entry.pty.fire(data);
  }

  private handleTerminalCommandEnd(msg: TerminalCommandEndMessage): void {
    const entry = this.terminalMap.get(msg.terminalId);
    if (!entry) { return; }
    if (msg.exitCode !== undefined && msg.exitCode !== 0) {
      entry.pty.fire(`\x1b[1;31m[exit: ${msg.exitCode}]\x1b[0m\r\n`);
    }
  }

  /** 确保终端存在，不存在时自动创建（处理连接前已有终端的情况） */
  private ensureTerminal(terminalId: number): { pty: LiveCodePseudoterminal; terminal: vscode.Terminal } {
    let entry = this.terminalMap.get(terminalId);
    if (!entry) {
      const pty = new LiveCodePseudoterminal();
      const terminal = vscode.window.createTerminal({
        name: `[Live] Terminal ${terminalId}`,
        pty,
      });
      entry = { pty, terminal };
      this.terminalMap.set(terminalId, entry);
    }
    return entry;
  }

  /** 清理所有观众端伪终端 */
  private cleanupTerminals(): void {
    for (const [, entry] of this.terminalMap) {
      entry.pty.shutdown();
      entry.pty.dispose();
    }
    this.terminalMap.clear();
  }

  dispose(): void {
    this.disconnect();
    this.cursorDecorationType.dispose();
    this.selectionDecorationType.dispose();
    this.statusBarItem.dispose();
  }
}
