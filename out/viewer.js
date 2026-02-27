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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Viewer = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const ws_1 = __importDefault(require("ws"));
const protocol_1 = require("./protocol");
/**
 * Viewer 模式 - 观众端
 * 连接主播的 WebSocket 服务器，在 VSCode 中以只读虚拟文档展示主播代码
 */
class Viewer {
    constructor(documentProvider, treeProvider = null) {
        this.ws = null;
        this.currentUri = null;
        this.currentEditor = null;
        this.disposables = [];
        /** 断开连接回调，通知外部清理引用 */
        this._onDisconnectCallback = null;
        this.documentProvider = documentProvider;
        this.treeProvider = treeProvider;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.cursorDecorationType = vscode.window.createTextEditorDecorationType({
            border: '2px solid #FFD700',
            borderRadius: '1px',
        });
        this.selectionDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 215, 0, 0.2)',
            borderRadius: '2px',
        });
    }
    set onDisconnect(callback) {
        this._onDisconnectCallback = callback;
    }
    async connect(address) {
        return new Promise((resolve, reject) => {
            const url = `ws://${address}`;
            this.ws = new ws_1.default(url);
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
                vscode.window.showInformationMessage(`Live Code: 已连接到 ${address}`);
                resolve();
            });
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleMessage(message);
                }
                catch {
                    /* 忽略格式错误的消息 */
                }
            });
            this.ws.on('close', () => {
                clearTimeout(connectTimeout);
                this.handleDisconnected('连接已断开');
            });
            this.ws.on('error', (err) => {
                clearTimeout(connectTimeout);
                reject(new Error(`连接失败: ${err.message}`));
            });
        });
    }
    disconnect() {
        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws.close();
            this.ws = null;
        }
        this.handleDisconnected();
    }
    handleDisconnected(reason) {
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
    registerEditorTracking() {
        this.disposables.push(vscode.window.onDidChangeVisibleTextEditors((editors) => {
            if (!this.currentUri) {
                return;
            }
            const target = editors.find((e) => e.document.uri.toString() === this.currentUri.toString());
            if (target) {
                this.currentEditor = target;
            }
            else {
                this.currentEditor = null;
            }
        }));
    }
    async handleMessage(message) {
        switch (message.type) {
            case protocol_1.MessageType.Sync:
            case protocol_1.MessageType.FileChange:
                await this.handleFileSync(message.fileName, message.languageId, message.content, message.relativePath);
                if ('cursor' in message && message.cursor) {
                    this.updateCursorDecoration(message.cursor);
                }
                if ('selections' in message && message.selections) {
                    this.updateSelectionDecorations(message.selections);
                }
                break;
            case protocol_1.MessageType.FileClose:
                if (this.currentUri) {
                    this.cleanupDecorations();
                    await this.closeLiveCodeEditor(this.currentUri);
                }
                this.currentUri = null;
                this.currentEditor = null;
                break;
            case protocol_1.MessageType.ContentChange:
                if (this.currentUri) {
                    this.documentProvider.updateContent(this.currentUri, message.fullContent);
                }
                break;
            case protocol_1.MessageType.SelectionChange:
                this.updateCursorDecoration(message.cursor);
                this.updateSelectionDecorations(message.selections);
                break;
            case protocol_1.MessageType.WorkspaceTree:
                this.treeProvider?.updatePaths(Array.isArray(message.paths) ? message.paths : []);
                break;
            case protocol_1.MessageType.ViewerCount:
                break;
        }
    }
    /**
     * 文件同步处理：创建/更新虚拟文档并打开编辑器
     * URI 使用 relativePath 或 basename，观众端标签页可显示项目内路径
     */
    async handleFileSync(fileName, languageId, content, relativePath) {
        const pathSegment = relativePath ?? path.basename(fileName);
        const uri = vscode.Uri.parse(`livecode:/${pathSegment}`);
        this.documentProvider.updateContent(uri, content);
        this.currentUri = uri;
        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            // 尝试设置语言模式（URI 扩展名可能无法覆盖所有语言）
            try {
                await vscode.languages.setTextDocumentLanguage(doc, languageId);
            }
            catch {
                /* 语言 ID 不存在时忽略，依赖 URI 扩展名推断 */
            }
            this.currentEditor = await vscode.window.showTextDocument(doc, {
                preview: false,
                preserveFocus: false,
            });
        }
        catch (err) {
            console.error('Live Code Viewer: 打开文档失败', err);
        }
    }
    /** 渲染主播光标位置（黄色边框装饰） */
    updateCursorDecoration(cursor) {
        if (!this.currentEditor) {
            return;
        }
        const pos = new vscode.Position(cursor.line, cursor.character);
        const endPos = pos.translate(0, 1);
        const range = new vscode.Range(pos, endPos);
        this.currentEditor.setDecorations(this.cursorDecorationType, [{ range }]);
        this.currentEditor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }
    /** 渲染主播选区（半透明黄色背景） */
    updateSelectionDecorations(selections) {
        if (!this.currentEditor) {
            return;
        }
        const decorations = selections
            .filter((s) => s.start.line !== s.end.line ||
            s.start.character !== s.end.character)
            .map((s) => ({
            range: new vscode.Range(new vscode.Position(s.start.line, s.start.character), new vscode.Position(s.end.line, s.end.character)),
        }));
        this.currentEditor.setDecorations(this.selectionDecorationType, decorations);
    }
    cleanupDecorations() {
        if (this.currentEditor) {
            this.currentEditor.setDecorations(this.cursorDecorationType, []);
            this.currentEditor.setDecorations(this.selectionDecorationType, []);
        }
    }
    /** 关闭观众端展示的直播文档标签页 */
    async closeLiveCodeEditor(uri) {
        const target = vscode.window.visibleTextEditors.find((e) => e.document.uri.toString() === uri.toString());
        if (target) {
            await vscode.window.showTextDocument(target.document, { preserveFocus: false });
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        }
    }
    dispose() {
        this.disconnect();
        this.cursorDecorationType.dispose();
        this.selectionDecorationType.dispose();
        this.statusBarItem.dispose();
    }
}
exports.Viewer = Viewer;
//# sourceMappingURL=viewer.js.map