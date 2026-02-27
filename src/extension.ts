import * as vscode from 'vscode';
import { Host } from './host';
import { Viewer } from './viewer';
import { LiveCodeDocumentProvider } from './virtualDocument';
import { LiveCodeTreeDataProvider } from './liveCodeTree';

let host: Host | null = null;
let viewer: Viewer | null = null;

export function activate(context: vscode.ExtensionContext) {
  const documentProvider = new LiveCodeDocumentProvider();
  const treeProvider = new LiveCodeTreeDataProvider();

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      'livecode',
      documentProvider
    )
  );

  const treeView = vscode.window.createTreeView('liveCodeViewer', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  /** 供 Viewer 使用：同步主播当前文件时在树中展开并选中 */
  const getTreeView = () => treeView;

  // ============ Host 命令 ============

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.startHosting',
      async () => {
        if (host) {
          vscode.window.showWarningMessage('Live Code: 已在直播中');
          return;
        }
        if (viewer) {
          vscode.window.showWarningMessage(
            'Live Code: 当前处于观看模式，请先断开连接'
          );
          return;
        }

        const config = vscode.workspace.getConfiguration('liveCodeViewer');
        const port = config.get<number>('port', 3456);

        host = new Host(port);
        try {
          await host.start();
        } catch (err: any) {
          vscode.window.showErrorMessage(
            `Live Code: 启动失败 - ${err.message}`
          );
          host.dispose();
          host = null;
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('live-code-viewer.stopHosting', () => {
      if (!host) {
        vscode.window.showWarningMessage('Live Code: 当前未在直播');
        return;
      }
      host.dispose();
      host = null;
    })
  );

  // ============ Viewer 命令 ============

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.connect',
      async () => {
        if (viewer) {
          vscode.window.showWarningMessage('Live Code: 已连接到主播');
          return;
        }
        if (host) {
          vscode.window.showWarningMessage(
            'Live Code: 当前处于直播模式，请先停止直播'
          );
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

        if (!address) { return; }

        viewer = new Viewer(documentProvider, treeProvider, getTreeView());
        viewer.onDisconnect = () => {
          viewer = null;
        };

        try {
          await viewer.connect(address);
        } catch (err: any) {
          vscode.window.showErrorMessage(
            `Live Code: 连接失败 - ${err.message}`
          );
          viewer.dispose();
          viewer = null;
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('live-code-viewer.disconnect', () => {
      if (!viewer) {
        vscode.window.showWarningMessage('Live Code: 当前未连接');
        return;
      }
      viewer.dispose();
      viewer = null;
      vscode.window.showInformationMessage('Live Code: 已断开连接');
    })
  );
}

export function deactivate() {
  host?.dispose();
  host = null;
  viewer?.dispose();
  viewer = null;
}
