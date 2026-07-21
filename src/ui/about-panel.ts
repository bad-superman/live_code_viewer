import * as vscode from 'vscode';

export class AboutPanel {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private context: vscode.ExtensionContext) {}

  show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'liveCodeAbout',
      '关于 Live Code Viewer',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.context.extensionUri]
      }
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    }, null, this.context.subscriptions);

    this._update();
  }

  private _update(): void {
    if (!this.panel) return;

    const version = this.context.extension?.packageJSON?.version || '0.2.2';
    const repository = this.context.extension?.packageJSON?.repository?.url || 'https://github.com/bad-superman/live_code_viewer.git';
    const marketplaceUrl = `https://marketplace.visualstudio.com/items?itemName=${this.context.extension?.packageJSON?.publisher}.${this.context.extension?.packageJSON?.name}`;

    this.panel.webview.html = this._getHtmlForWebview(version, repository, marketplaceUrl);
  }

  private _getHtmlForWebview(version: string, repository: string, marketplaceUrl: string): string {
    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>关于 Live Code Viewer</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 24px;
            margin: 0;
          }
          .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
            margin-bottom: 24px;
          }
          .logo {
            width: 64px;
            height: 64px;
            margin: 0 auto 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 16px;
            font-size: 32px;
          }
          h1 {
            font-size: 22px;
            font-weight: 600;
            margin: 0 0 4px;
          }
          .version {
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
          }
          .section {
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 16px;
          }
          .section-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .description {
            color: var(--vscode-descriptionForeground);
            line-height: 1.6;
            font-size: 13px;
          }
          .info-list {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          .info-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 13px;
          }
          .info-item:last-child {
            border-bottom: none;
          }
          .info-label {
            color: var(--vscode-descriptionForeground);
          }
          .links {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .link-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border-radius: 4px;
            text-decoration: none;
            cursor: pointer;
            transition: background 0.2s;
          }
          .link-item:hover {
            background: var(--vscode-button-hoverBackground);
          }
          .shortcut-link {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
          }
          .shortcut-link:hover {
            background: var(--vscode-button-hoverBackground);
          }
          .license {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            text-align: center;
            padding-top: 16px;
            border-top: 1px solid var(--vscode-panel-border);
          }
          .footer {
            text-align: center;
            margin-top: 16px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">📺</div>
          <h1>Live Code Viewer</h1>
          <div class="version">版本 ${version}</div>
        </div>

        <div class="section">
          <div class="section-title">📝 简介</div>
          <p class="description">
            Live Code Viewer 是一款 VS Code 局域网实时协作编程扩展。
            支持实时代码共享、多人协作编辑、房间管理、录制回放等功能，
            让团队在没有远程桌面的情况下也能高效协作。
          </p>
        </div>

        <div class="section">
          <div class="section-title">ℹ️ 详细信息</div>
          <ul class="info-list">
            <li class="info-item">
              <span class="info-label">发布者</span>
              <span>RoyKou</span>
            </li>
            <li class="info-item">
              <span class="info-label">许可证</span>
              <span>MIT</span>
            </li>
            <li class="info-item">
              <span class="info-label">引擎</span>
              <span>VS Code ^1.93.0</span>
            </li>
            <li class="info-item">
              <span class="info-label">最后更新</span>
              <span>${new Date().toLocaleDateString('zh-CN')}</span>
            </li>
          </ul>
        </div>

        <div class="section">
          <div class="section-title">🔗 相关链接</div>
          <div class="links">
            <a class="link-item" onclick="openLink('${repository}')">
              🐙 GitHub 仓库
            </a>
            <a class="link-item" onclick="openLink('${marketplaceUrl}')">
              🏪 VS Code Marketplace
            </a>
          </div>
        </div>

        <div class="section">
          <div class="section-title">⌨️ 快捷键帮助</div>
          <p class="description" style="margin-bottom: 12px;">
            查看完整快捷键列表和使用说明
          </p>
          <button class="shortcut-link" onclick="openShortcutHelp()">
            📋 打开快捷键帮助
          </button>
        </div>

        <div class="license">
          Licensed under MIT License · Copyright © 2026 RoyKou
        </div>

        <div class="footer">
          如有问题或建议，欢迎在 GitHub 提交 Issue
        </div>

        <script>
          const vscode = acquireVsCodeApi();

          function openLink(url) {
            vscode.postMessage({
              command: 'openExternal',
              url: url
            });
          }

          function openShortcutHelp() {
            vscode.postMessage({
              command: 'showShortcutHelp'
            });
          }

          window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'shortcutHelpShown') {
              // 快捷键帮助面板已显示
            }
          });
        </script>
      </body>
      </html>
    `;
  }

  dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
  }
}
