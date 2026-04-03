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
  TerminalOpenMessage,
  TerminalCloseMessage,
  TerminalCommandMessage,
  TerminalOutputMessage,
  TerminalCommandEndMessage,
  TerminalInputMessage,
  TerminalInputAckMessage,
  TerminalInputStatusMessage,
  SecurityCheckInfo,
} from './protocol';
import { CommandFilter, createStrictCommandFilter } from './security/command-filter';

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

  private terminalIdMap = new Map<vscode.Terminal, number>();
  private terminalIdToTerminalMap = new Map<number, vscode.Terminal>();
  private nextTerminalId = 1;
  private commandFilter: CommandFilter;

  constructor(port: number = 3456) {
    this.port = port;
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.commandFilter = createStrictCommandFilter();
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
      this.sendTerminalSync(ws);
      this.broadcastViewerCount();

      ws.on('close', () => {
        this.clients.delete(ws);
        this.broadcastViewerCount();
      });

      ws.on('error', () => {
        this.clients.delete(ws);
        this.broadcastViewerCount();
      });

      // 处理来自观众端的消息
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as LiveMessage;
          this.handleClientMessage(ws, message);
        } catch (error) {
          console.error('Live Code: 解析客户端消息失败', error);
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.listen(this.port, '0.0.0.0', () => resolve());
      this.server!.on('error', (err: Error) => reject(err));
    });

    this.isRunning = true;
    this.registerEditorListeners();
    this.registerTerminalListeners();
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
    this.terminalIdMap.clear();
    this.terminalIdToTerminalMap.clear();

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

  /** 为终端分配 ID，如已存在则返回已有 ID */
  private getOrAssignTerminalId(terminal: vscode.Terminal): number {
    let id = this.terminalIdMap.get(terminal);
    if (id === undefined) {
      id = this.nextTerminalId++;
      this.terminalIdMap.set(terminal, id);
      this.terminalIdToTerminalMap.set(id, terminal);
    }
    return id;
  }

  /** 根据终端ID获取终端对象 */
  private getTerminalById(terminalId: number): vscode.Terminal | undefined {
    return this.terminalIdToTerminalMap.get(terminalId);
  }

  /** 注册终端相关事件监听 */
  private registerTerminalListeners(): void {
    for (const terminal of vscode.window.terminals) {
      this.getOrAssignTerminalId(terminal);
    }

    this.disposables.push(
      vscode.window.onDidOpenTerminal((terminal) => {
        const id = this.getOrAssignTerminalId(terminal);
        const msg: TerminalOpenMessage = {
          type: MessageType.TerminalOpen,
          terminalId: id,
          name: terminal.name,
        };
        this.broadcast(msg);
      })
    );

    this.disposables.push(
      vscode.window.onDidCloseTerminal((terminal) => {
        const id = this.terminalIdMap.get(terminal);
        if (id === undefined) { return; }
        this.terminalIdMap.delete(terminal);
        this.terminalIdToTerminalMap.delete(id);
        const msg: TerminalCloseMessage = {
          type: MessageType.TerminalClose,
          terminalId: id,
        };
        this.broadcast(msg);
      })
    );

    this.disposables.push(
      vscode.window.onDidStartTerminalShellExecution((e) => {
        const id = this.getOrAssignTerminalId(e.terminal);
        const command = e.execution.commandLine.value;
        const cmdMsg: TerminalCommandMessage = {
          type: MessageType.TerminalCommand,
          terminalId: id,
          command,
        };
        this.broadcast(cmdMsg);
        this.streamExecutionOutput(id, e.execution);
      })
    );

    this.disposables.push(
      vscode.window.onDidEndTerminalShellExecution((e) => {
        const id = this.terminalIdMap.get(e.terminal);
        if (id === undefined) { return; }
        const msg: TerminalCommandEndMessage = {
          type: MessageType.TerminalCommandEnd,
          terminalId: id,
          exitCode: e.exitCode,
        };
        this.broadcast(msg);
      })
    );
  }

  /** 异步读取命令输出并逐块广播 */
  private async streamExecutionOutput(
    terminalId: number,
    execution: vscode.TerminalShellExecution
  ): Promise<void> {
    try {
      for await (const data of execution.read()) {
        const msg: TerminalOutputMessage = {
          type: MessageType.TerminalOutput,
          terminalId,
          data,
        };
        this.broadcast(msg);
      }
    } catch {
      /* 终端可能已关闭，忽略读取错误 */
    }
  }

  /** 向新连接的观众发送当前所有终端状态 */
  private sendTerminalSync(ws: WebSocket): void {
    for (const [terminal, id] of this.terminalIdMap) {
      const msg: TerminalOpenMessage = {
        type: MessageType.TerminalOpen,
        terminalId: id,
        name: terminal.name,
      };
      this.safeSend(ws, msg);
    }
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
    this.statusBarItem.tooltip = `直播地址: ${ip}:${this.port} | 点击停止直播 | 使用命令"Live Code: Copy Broadcast Address"复制地址`;
    this.statusBarItem.command = 'live-code-viewer.stopHosting';
  }

  /** 处理来自客户端的消息 */
  private handleClientMessage(ws: WebSocket, message: LiveMessage): void {
    console.log(`[Host] Received client message type: ${message.type}`);
    
    switch (message.type) {
      case MessageType.TerminalInput:
        this.handleTerminalInput(ws, message);
        break;
        
      // 可以添加其他客户端消息类型的处理
      default:
        console.warn(`[Host] Unhandled client message type: ${message.type}`);
    }
  }

  /** 处理终端输入消息 */
  private handleTerminalInput(ws: WebSocket, msg: TerminalInputMessage): void {
    console.log(`[Host] Received terminal input for terminal ${msg.terminalId}: ${msg.input.substring(0, 50)}...`);
    
    // 基本权限检查：确保有用户ID
    if (!msg.userId) {
      console.warn(`[Host] Rejected terminal input: missing userId`);
      const ackMessage: TerminalInputAckMessage = {
        type: MessageType.TerminalInputAck,
        terminalId: msg.terminalId,
        inputId: msg.sessionId || `input-${Date.now()}`,
        status: 'rejected',
        reason: '未提供用户ID',
        timestamp: Date.now()
      };
      ws.send(JSON.stringify(ackMessage));
      return;
    }
    
    // 安全检查：在主机端进行最终验证
    const securityCheck = this.performSecurityCheck(msg);
    
    if (!securityCheck.passed) {
      console.warn(`[Host] Rejected terminal input: security check failed - ${securityCheck.reason}`);
      const ackMessage: TerminalInputAckMessage = {
        type: MessageType.TerminalInputAck,
        terminalId: msg.terminalId,
        inputId: msg.sessionId || `input-${Date.now()}`,
        status: 'rejected',
        reason: `安全检查失败: ${securityCheck.reason}`,
        timestamp: Date.now(),
        securityCheck: securityCheck
      };
      ws.send(JSON.stringify(ackMessage));
      return;
    }
    
    // 查找对应的终端
    const terminal = this.getTerminalById(msg.terminalId);
    
    // 发送输入确认
    const ackMessage: TerminalInputAckMessage = {
      type: MessageType.TerminalInputAck,
      terminalId: msg.terminalId,
      inputId: msg.sessionId || `input-${Date.now()}`,
      status: terminal ? 'accepted' : 'rejected',
      reason: terminal ? undefined : `终端 ${msg.terminalId} 不存在或已关闭`,
      timestamp: Date.now(),
      securityCheck: securityCheck
    };
    
    ws.send(JSON.stringify(ackMessage));
    
    if (terminal) {
      // 实际将输入发送到终端
      try {
        terminal.sendText(msg.input);
        console.log(`[Host] Sent input to terminal ${msg.terminalId} from user ${msg.userId}: ${msg.input}`);
        
        // 更新确认状态为已处理
        ackMessage.status = 'accepted';
        ackMessage.reason = undefined;
        ws.send(JSON.stringify(ackMessage));
      } catch (error) {
        console.error(`[Host] Failed to send input to terminal ${msg.terminalId}:`, error);
        
        // 更新确认状态为失败
        ackMessage.status = 'rejected';
        ackMessage.reason = `发送失败: ${error instanceof Error ? error.message : String(error)}`;
        ws.send(JSON.stringify(ackMessage));
      }
    } else {
      console.warn(`[Host] Terminal ${msg.terminalId} not found`);
    }
    
    // 广播输入状态给所有客户端
    const statusMessage: TerminalInputStatusMessage = {
      type: MessageType.TerminalInputStatus,
      terminalId: msg.terminalId,
      currentInput: msg.input,
      inputUserId: msg.userId,
      status: terminal ? 'submitted' : 'idle',
      timestamp: Date.now(),
      securityCheck: securityCheck
    };
    
    this.broadcast(statusMessage);
  }

  /** 执行安全检查 */
  private performSecurityCheck(msg: TerminalInputMessage): SecurityCheckInfo {
    // 如果客户端已经进行了安全检查，验证其结果
    if (msg.securityCheck) {
      console.log(`[Host] Client performed security check: ${JSON.stringify(msg.securityCheck)}`);
      
      // 在主机端进行二次验证
      const hostCheck = this.commandFilter.checkCommand(msg.input);
      
      // 如果客户端检查通过但主机检查不通过，使用主机检查结果
      if (msg.securityCheck.passed && !hostCheck.allowed) {
        console.warn(`[Host] Client security check passed but host check failed: ${hostCheck.reason}`);
        return {
          passed: false,
          category: hostCheck.category,
          reason: `主机端验证失败: ${hostCheck.reason}`,
          timestamp: Date.now()
        };
      }
      
      // 如果客户端检查不通过，直接使用客户端结果
      if (!msg.securityCheck.passed) {
        return {
          passed: false,
          category: msg.securityCheck.category,
          reason: `客户端安全检查失败: ${msg.securityCheck.reason}`,
          timestamp: Date.now()
        };
      }
      
      // 两者都通过，使用客户端检查结果
      return {
        passed: true,
        category: msg.securityCheck.category,
        reason: msg.securityCheck.reason,
        timestamp: Date.now()
      };
    }
    
    // 客户端未进行安全检查，在主机端执行完整检查
    console.log(`[Host] Performing full security check for command: ${msg.input.substring(0, 50)}...`);
    const filterResult = this.commandFilter.checkCommand(msg.input);
    
    return {
      passed: filterResult.allowed,
      category: filterResult.category,
      reason: filterResult.reason,
      timestamp: Date.now()
    };
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

  /** 获取当前直播地址 */
  getBroadcastAddress(): string {
    if (!this.isRunning) {
      throw new Error('Live Code: 直播未启动');
    }
    const ip = this.getLocalIP();
    return `${ip}:${this.port}`;
  }

  dispose(): void {
    this.stop();
    this.statusBarItem.dispose();
  }
}
