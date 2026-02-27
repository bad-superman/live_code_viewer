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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const host_1 = require("./host");
const viewer_1 = require("./viewer");
const virtualDocument_1 = require("./virtualDocument");
const liveCodeTree_1 = require("./liveCodeTree");
let host = null;
let viewer = null;
function activate(context) {
    const documentProvider = new virtualDocument_1.LiveCodeDocumentProvider();
    const treeProvider = new liveCodeTree_1.LiveCodeTreeDataProvider();
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('livecode', documentProvider));
    context.subscriptions.push(vscode.window.registerTreeDataProvider('liveCodeViewer', treeProvider));
    // ============ Host 命令 ============
    context.subscriptions.push(vscode.commands.registerCommand('live-code-viewer.startHosting', async () => {
        if (host) {
            vscode.window.showWarningMessage('Live Code: 已在直播中');
            return;
        }
        if (viewer) {
            vscode.window.showWarningMessage('Live Code: 当前处于观看模式，请先断开连接');
            return;
        }
        const config = vscode.workspace.getConfiguration('liveCodeViewer');
        const port = config.get('port', 3456);
        host = new host_1.Host(port);
        try {
            await host.start();
        }
        catch (err) {
            vscode.window.showErrorMessage(`Live Code: 启动失败 - ${err.message}`);
            host.dispose();
            host = null;
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('live-code-viewer.stopHosting', () => {
        if (!host) {
            vscode.window.showWarningMessage('Live Code: 当前未在直播');
            return;
        }
        host.dispose();
        host = null;
    }));
    // ============ Viewer 命令 ============
    context.subscriptions.push(vscode.commands.registerCommand('live-code-viewer.connect', async () => {
        if (viewer) {
            vscode.window.showWarningMessage('Live Code: 已连接到主播');
            return;
        }
        if (host) {
            vscode.window.showWarningMessage('Live Code: 当前处于直播模式，请先停止直播');
            return;
        }
        const address = await vscode.window.showInputBox({
            prompt: '输入主播地址 (IP:端口)',
            placeHolder: '192.168.1.100:3456',
            validateInput: (value) => {
                if (!value.match(/^[\w.\-]+:\d+$/)) {
                    return '请输入有效地址，格式: IP:端口 (例如 192.168.1.100:3456)';
                }
                return null;
            },
        });
        if (!address) {
            return;
        }
        viewer = new viewer_1.Viewer(documentProvider, treeProvider);
        viewer.onDisconnect = () => {
            viewer = null;
        };
        try {
            await viewer.connect(address);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Live Code: 连接失败 - ${err.message}`);
            viewer.dispose();
            viewer = null;
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('live-code-viewer.disconnect', () => {
        if (!viewer) {
            vscode.window.showWarningMessage('Live Code: 当前未连接');
            return;
        }
        viewer.dispose();
        viewer = null;
        vscode.window.showInformationMessage('Live Code: 已断开连接');
    }));
}
function deactivate() {
    host?.dispose();
    host = null;
    viewer?.dispose();
    viewer = null;
}
//# sourceMappingURL=extension.js.map