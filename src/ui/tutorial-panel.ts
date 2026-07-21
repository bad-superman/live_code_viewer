import * as vscode from 'vscode';

export class TutorialPanel {
  private panel: vscode.WebviewPanel | undefined;
  private readonly hasSeenTutorialKey = 'hasSeenTutorial';

  constructor(private context: vscode.ExtensionContext) {}

  show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'liveCodeTutorial',
      'Live Code Viewer - 使用教程',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.context.extensionUri]
      }
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    }, null, this.context.subscriptions);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'skip':
            await this.markTutorialSeen();
            break;
          case 'next':
          case 'prev':
            this._update(message.command);
            break;
        }
      },
      null,
      this.context.subscriptions
    );

    this._update('next');
  }

  /**
   * 首次启动时自动触发引导
   */
  autoTriggerIfFirstTime(): void {
    const hasSeen = this.context.globalState.get<boolean>(this.hasSeenTutorialKey, false);

    if (!hasSeen) {
      // 延迟一下，避免和激活消息冲突
      setTimeout(() => {
        this.show();
      }, 1000);
    }
  }

  private async markTutorialSeen(): Promise<void> {
    await this.context.globalState.update(this.hasSeenTutorialKey, true);
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
  }

  private _update(direction: string = 'next'): void {
    if (!this.panel) return;

    const currentStep = this.getCurrentStep(direction);
    this.panel.webview.html = this._getHtmlForWebview(currentStep);
  }

  private getCurrentStep(direction: string): number {
    // 简单实现：始终显示第一步，后续可通过消息控制
    if (direction === 'prev') {
      return Math.max(0, 4); // 循环到末尾
    }
    return 0;
  }

  private _getHtmlForWebview(step: number): string {
    const steps = [
      {
        icon: '👋',
        title: '欢迎使用 Live Code Viewer！',
        content: `
          <p>Live Code Viewer 是一款 <strong>局域网实时协作编程</strong> 工具。</p>
          <p>通过它，你可以：</p>
          <ul>
            <li>📺 <strong>开启直播</strong> — 将你的代码共享给其他人实时查看</li>
            <li>👥 <strong>多人协作</strong> — 支持多人同时在线编辑同一文件</li>
            <li>🏠 <strong>房间管理</strong> — 创建公开、私有或邀请制房间</li>
            <li>🎬 <strong>录制回放</strong> — 录制编码过程并随时回放</li>
          </ul>
        `,
        buttonText: '开始使用 →'
      },
      {
        icon: '🚀',
        title: '第一步：开始直播',
        content: `
          <p>点击 VS Code 底部状态栏的 <strong>Live Code</strong> 图标，或从命令面板运行：</p>
          <div style="background: var(--vscode-input-background); padding: 12px; border-radius: 4px; margin: 12px 0;">
            <code>Live Code: Start Hosting</code>
          </div>
          <p>启动后，你会获得一个直播地址。将此地址分享给需要观看的人即可。</p>
          <p>💡 你也可以通过命令 <code>Copy Broadcast Address</code> 快速复制地址。</p>
        `,
        buttonText: '下一步 →'
      },
      {
        icon: '👥',
        title: '第二步：让观众加入',
        content: `
          <p>观众需要通过以下方式使用 viewer 页面连接：</p>
          <ol>
            <li>在浏览器中打开你分享的直播地址</li>
            <li>点击 <strong>Connect</strong> 按钮加入直播</li>
            <li>连接成功后即可实时看到你的代码变化</li>
          </ol>
          <p>🏠 如果你想进行多人协作，可以创建房间，观众通过房间加入。</p>
        `,
        buttonText: '下一步 →'
      },
      {
        icon: '🏠',
        title: '第三步：房间管理',
        content: `
          <p>使用 <strong>Live Code: Show Room Panel</strong> 打开房间管理面板：</p>
          <ul>
            <li><strong>公开房间</strong> — 任何人都可以通过房间 ID 加入</li>
            <li><strong>私有房间</strong> — 需要密码才能加入</li>
            <li><strong>邀请制房间</strong> — 仅受邀用户可加入</li>
          </ul>
          <p>在设置中可以配置新建房间的默认类型。</p>
        `,
        buttonText: '下一步 →'
      },
      {
        icon: '🎉',
        title: '完成！',
        content: `
          <p>现在你已经了解了 Live Code Viewer 的基本用法。</p>
          <p>🔧 更多设置选项，请使用 <strong>Live Code: Show Settings</strong></p>
          <p>⌨️ 快捷键帮助，请使用 <strong>Live Code: Show Shortcut Help</strong></p>
          <p>ℹ️ 关于页面，请使用 <strong>Live Code: Show About</strong></p>
          <br>
          <p style="text-align: center; color: var(--vscode-descriptionForeground);">
            祝你编码愉快！ 🚀
          </p>
        `,
        buttonText: '开始使用 ✨'
      }
    ];

    const current = steps[step];
    const progress = ((step + 1) / steps.length) * 100;

    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Live Code Viewer - 使用教程</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 0;
            margin: 0;
          }

          .progress-bar {
            height: 3px;
            background: var(--vscode-progressBar-background);
            width: ${progress}%;
            transition: width 0.3s ease;
          }

          .container {
            padding: 32px 24px;
            max-width: 600px;
            margin: 0 auto;
          }

          .step-indicator {
            text-align: center;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 16px;
          }

          .icon {
            font-size: 48px;
            text-align: center;
            margin-bottom: 16px;
          }

          h1 {
            font-size: 22px;
            font-weight: 600;
            text-align: center;
            margin: 0 0 20px;
          }

          .content {
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 24px;
            line-height: 1.7;
          }

          .content p {
            margin: 0 0 12px;
          }

          .content ul, .content ol {
            padding-left: 20px;
            margin: 8px 0;
          }

          .content li {
            margin-bottom: 6px;
          }

          code {
            background: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 13px;
          }

          .actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .btn {
            padding: 8px 20px;
            border: 1px solid var(--vscode-button-border);
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }

          .btn:hover {
            background: var(--vscode-button-hoverBackground);
          }

          .btn-secondary {
            background: transparent;
            color: var(--vscode-descriptionForeground);
            border-color: transparent;
          }

          .btn-secondary:hover {
            color: var(--vscode-foreground);
            background: transparent;
          }

          .skip-link {
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
            cursor: pointer;
            text-decoration: underline;
          }

          .skip-link:hover {
            color: var(--vscode-foreground);
          }
        </style>
      </head>
      <body>
        <div class="progress-bar"></div>
        <div class="container">
          <div class="step-indicator">步骤 ${step + 1} / ${steps.length}</div>
          <div class="icon">${current.icon}</div>
          <h1>${current.title}</h1>
          <div class="content">
            ${current.content}
          </div>
          <div class="actions">
            <span class="skip-link" onclick="skipTutorial()">跳过引导</span>
            <button class="btn" onclick="nextStep()">${current.buttonText}</button>
          </div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          let currentStep = ${step};
          const totalSteps = ${steps.length};

          function nextStep() {
            if (currentStep < totalSteps - 1) {
              currentStep++;
              vscode.postMessage({ command: 'next' });
            } else {
              vscode.postMessage({ command: 'skip' });
            }
          }

          function skipTutorial() {
            vscode.postMessage({ command: 'skip' });
          }

          window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'next') {
              currentStep = Math.min(currentStep + 1, totalSteps - 1);
              location.reload();
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
