import * as vscode from 'vscode';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import {
  MessageType,
  LiveMessage,
  SyncMessage,
  FileChangeMessage,
  FileCloseMessage,
  WorkspaceTreeMessage,
  ContentChangeMessage,
  SelectionChangeMessage,
  ViewerCountMessage,
} from './protocol';

/**
 * Host 模式 - 主播端
 * 启动 WebSocket 服务器，监听编辑器事件并广播给所有连接的观众
 */
export class Host {

  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private statusBarItem: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];
  private port: number;
  private isRunning = false;

  constructor(port: number = 3456) {
    this.port = port;
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      vscode.window.showWarningMessage('Live Code: 已在直播中');
      return;
    }

    this.server = http.createServer();
    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      this.sendSync(ws);
      this.sendWorkspaceTree(ws).catch((err) => {
        console.error('Live Code: 发送目录树失败', err);
      });
      this.broadcastViewerCount();

      ws.on('close', () => {
        this.clients.delete(ws);
        this.broadcastViewerCount();
      });

      ws.on('error', () => {
        this.clients.delete(ws);
        this.broadcastViewerCount();
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.listen(this.port, '0.0.0.0', () => resolve());
      this.server!.on('error', (err: Error) => reject(err));
    });

    this.isRunning = true;
    this.registerEditorListeners();
    this.updateStatusBar();
    this.statusBarItem.show();

    const ip = this.getLocalIP();
    vscode.window.showInformationMessage(
      `Live Code: 直播已启动 ${ip}:${this.port}`
    );
  }

  stop(): void {
    if (!this.isRunning) { return; }

    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];

    this.clients.forEach((ws) => {
      try { ws.close(); } catch { /* ignore */ }
    });
    this.clients.clear();

    this.wss?.close();
    this.server?.close();
    this.wss = null;
    this.server = null;
    this.isRunning = false;

    this.statusBarItem.hide();
    vscode.window.showInformationMessage('Live Code: 直播已停止');
  }

  /** 注册编辑器事件监听 */
  private registerEditorListeners(): void {
    // 活动编辑器切换 → 文件切换 或 关闭文件
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document.uri.scheme === 'file') {
          this.broadcastFileChange(editor);
        } else {
          this.broadcastFileClose();
        }
      })
    );

    // 文档内容变更 → 推送全量内容
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && event.document === activeEditor.document) {
          this.broadcastContentChange(event);
        }
      })
    );

    // 光标/选区变化
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection((event) => {
        if (event.textEditor === vscode.window.activeTextEditor) {
          this.broadcastSelectionChange(event);
        }
      })
    );
  }

  /** 向新连接的观众发送全量同步 */
  private sendSync(ws: WebSocket): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== 'file') {
      this.safeSend(ws, { type: MessageType.FileClose } as FileCloseMessage);
      return;
    }

    const message: SyncMessage = {
      type: MessageType.Sync,
      fileName: editor.document.fileName,
      relativePath: this.getRelativePath(editor.document.uri),
      languageId: editor.document.languageId,
      content: editor.document.getText(),
      cursor: {
        line: editor.selection.active.line,
        character: editor.selection.active.character,
      },
      selections: editor.selections.map((s) => ({
        start: { line: s.start.line, character: s.start.character },
        end: { line: s.end.line, character: s.end.character },
      })),
    };

    this.safeSend(ws, message);
  }

  private broadcastFileClose(): void {
    const message: FileCloseMessage = { type: MessageType.FileClose };
    this.broadcast(message);
  }

  /** 向指定观众发送工作区目录树（相对路径列表） */
  private async sendWorkspaceTree(ws: WebSocket): Promise<void> {
    const paths = await this.getWorkspacePaths();
    const message: WorkspaceTreeMessage = {
      type: MessageType.WorkspaceTree,
      paths,
    };
    this.safeSend(ws, message);
  }

  /** 获取工作区内文件相对路径列表，排除常见无关目录 */
  private async getWorkspacePaths(): Promise<string[]> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      return [];
    }

    const exclude = '{**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/.vscode/**,**/*.min.js}';
    const uris = await vscode.workspace.findFiles('**/*', exclude, 2000);
    const result: string[] = [];
    for (const uri of uris) {
      try {
        result.push(vscode.workspace.asRelativePath(uri, false));
      } catch {
        result.push(path.basename(uri.fsPath));
      }
    }
    result.sort();
    return result;
  }

  private getRelativePath(uri: vscode.Uri): string {
    try {
      return vscode.workspace.asRelativePath(uri, false);
    } catch {
      return path.basename(uri.fsPath);
    }
  }

  private broadcastFileChange(editor: vscode.TextEditor): void {
    const message: FileChangeMessage = {
      type: MessageType.FileChange,
      fileName: editor.document.fileName,
      relativePath: this.getRelativePath(editor.document.uri),
      languageId: editor.document.languageId,
      content: editor.document.getText(),
    };
    this.broadcast(message);
  }

  private broadcastContentChange(event: vscode.TextDocumentChangeEvent): void {
    const message: ContentChangeMessage = {
      type: MessageType.ContentChange,
      fullContent: event.document.getText(),
    };
    this.broadcast(message);
  }

  private broadcastSelectionChange(
    event: vscode.TextEditorSelectionChangeEvent
  ): void {
    const message: SelectionChangeMessage = {
      type: MessageType.SelectionChange,
      cursor: {
        line: event.selections[0].active.line,
        character: event.selections[0].active.character,
      },
      selections: event.selections.map((s) => ({
        start: { line: s.start.line, character: s.start.character },
        end: { line: s.end.line, character: s.end.character },
      })),
    };
    this.broadcast(message);
  }

  private broadcastViewerCount(): void {
    const message: ViewerCountMessage = {
      type: MessageType.ViewerCount,
      count: this.clients.size,
    };
    this.broadcast(message);
    this.updateStatusBar();
  }

  private broadcast(message: LiveMessage): void {
    const data = JSON.stringify(message);
    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(data); } catch { /* ignore broken pipe */ }
      }
    });
  }

  private safeSend(ws: WebSocket, message: LiveMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify(message)); } catch { /* ignore */ }
    }
  }

  private updateStatusBar(): void {
    const ip = this.getLocalIP();
    this.statusBarItem.text =
      `$(broadcast) Live: ${ip}:${this.port} (${this.clients.size} 观众)`;
    this.statusBarItem.tooltip = '点击停止直播';
    this.statusBarItem.command = 'live-code-viewer.stopHosting';
  }

  /** 获取第一个局域网 IPv4 地址 */
  private getLocalIP(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]!) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }

  dispose(): void {
    this.stop();
    this.statusBarItem.dispose();
  }
}
