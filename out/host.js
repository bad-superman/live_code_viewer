"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Host = void 0;
const vscode = __importStar(require("vscode"));
const http = __importStar(require("http"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const ws_1 = require("ws");
const protocol_1 = require("./protocol");
/**
 * Host 模式 - 主播端
 * 启动 WebSocket 服务器，监听编辑器事件并广播给所有连接的观众
 */
class Host {
    constructor(port = 3456) {
        this.server = null;
        this.wss = null;
        this.clients = new Set();
        this.disposables = [];
        this.isRunning = false;
        this.port = port;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    }
    async start() {
        if (this.isRunning) {
            vscode.window.showWarningMessage('Live Code: 已在直播中');
            return;
        }
        this.server = http.createServer();
        this.wss = new ws_1.WebSocketServer({ server: this.server });
        this.wss.on('connection', (ws) => {
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
        await new Promise((resolve, reject) => {
            this.server.listen(this.port, '0.0.0.0', () => resolve());
            this.server.on('error', (err) => reject(err));
        });
        this.isRunning = true;
        this.registerEditorListeners();
        this.updateStatusBar();
        this.statusBarItem.show();
        const ip = this.getLocalIP();
        vscode.window.showInformationMessage(`Live Code: 直播已启动 ${ip}:${this.port}`);
    }
    stop() {
        if (!this.isRunning) {
            return;
        }
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
        this.clients.forEach((ws) => {
            try {
                ws.close();
            }
            catch { /* ignore */ }
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
    registerEditorListeners() {
        // 活动编辑器切换 → 文件切换 或 关闭文件
        this.disposables.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && editor.document.uri.scheme === 'file') {
                this.broadcastFileChange(editor);
            }
            else {
                this.broadcastFileClose();
            }
        }));
        // 文档内容变更 → 推送全量内容
        this.disposables.push(vscode.workspace.onDidChangeTextDocument((event) => {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && event.document === activeEditor.document) {
                this.broadcastContentChange(event);
            }
        }));
        // 光标/选区变化
        this.disposables.push(vscode.window.onDidChangeTextEditorSelection((event) => {
            if (event.textEditor === vscode.window.activeTextEditor) {
                this.broadcastSelectionChange(event);
            }
        }));
    }
    /** 向新连接的观众发送全量同步 */
    sendSync(ws) {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.scheme !== 'file') {
            this.safeSend(ws, { type: protocol_1.MessageType.FileClose });
            return;
        }
        const message = {
            type: protocol_1.MessageType.Sync,
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
    broadcastFileClose() {
        const message = { type: protocol_1.MessageType.FileClose };
        this.broadcast(message);
    }
    /** 向指定观众发送工作区目录树（相对路径列表） */
    async sendWorkspaceTree(ws) {
        const paths = await this.getWorkspacePaths();
        const message = {
            type: protocol_1.MessageType.WorkspaceTree,
            paths,
        };
        this.safeSend(ws, message);
    }
    /** 获取工作区内文件相对路径列表，排除常见无关目录 */
    async getWorkspacePaths() {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders?.length) {
            return [];
        }
        const exclude = '{**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/.vscode/**,**/*.min.js}';
        const uris = await vscode.workspace.findFiles('**/*', exclude, 2000);
        const result = [];
        for (const uri of uris) {
            try {
                result.push(vscode.workspace.asRelativePath(uri, false));
            }
            catch {
                result.push(path.basename(uri.fsPath));
            }
        }
        result.sort();
        return result;
    }
    getRelativePath(uri) {
        try {
            return vscode.workspace.asRelativePath(uri, false);
        }
        catch {
            return path.basename(uri.fsPath);
        }
    }
    broadcastFileChange(editor) {
        const message = {
            type: protocol_1.MessageType.FileChange,
            fileName: editor.document.fileName,
            relativePath: this.getRelativePath(editor.document.uri),
            languageId: editor.document.languageId,
            content: editor.document.getText(),
        };
        this.broadcast(message);
    }
    broadcastContentChange(event) {
        const message = {
            type: protocol_1.MessageType.ContentChange,
            fullContent: event.document.getText(),
        };
        this.broadcast(message);
    }
    broadcastSelectionChange(event) {
        const message = {
            type: protocol_1.MessageType.SelectionChange,
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
    broadcastViewerCount() {
        const message = {
            type: protocol_1.MessageType.ViewerCount,
            count: this.clients.size,
        };
        this.broadcast(message);
        this.updateStatusBar();
    }
    broadcast(message) {
        const data = JSON.stringify(message);
        this.clients.forEach((ws) => {
            if (ws.readyState === ws_1.WebSocket.OPEN) {
                try {
                    ws.send(data);
                }
                catch { /* ignore broken pipe */ }
            }
        });
    }
    safeSend(ws, message) {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(message));
            }
            catch { /* ignore */ }
        }
    }
    updateStatusBar() {
        const ip = this.getLocalIP();
        this.statusBarItem.text =
            `$(broadcast) Live: ${ip}:${this.port} (${this.clients.size} 观众)`;
        this.statusBarItem.tooltip = '点击停止直播';
        this.statusBarItem.command = 'live-code-viewer.stopHosting';
    }
    /** 获取第一个局域网 IPv4 地址 */
    getLocalIP() {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
        return '127.0.0.1';
    }
    dispose() {
        this.stop();
        this.statusBarItem.dispose();
    }
}
exports.Host = Host;
//# sourceMappingURL=host.js.map