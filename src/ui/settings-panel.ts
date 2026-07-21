import * as vscode from 'vscode';

export class SettingsPanel {
  private panel: vscode.WebviewPanel | undefined;
  private readonly configKey = 'liveCodeViewer';

  constructor(private context: vscode.ExtensionContext) {}

  show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'liveCodeSettings',
      'Live Code Viewer - 设置',
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

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'save':
            await this.saveSettings(message.settings);
            break;
          case 'reset':
            await this.resetSettings();
            break;
        }
      },
      null,
      this.context.subscriptions
    );

    this._update();
  }

  private async saveSettings(settings: Record<string, unknown>): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.configKey);

    for (const [key, value] of Object.entries(settings)) {
      await config.update(key, value, vscode.ConfigurationTarget.Global);
    }

    if (this.panel) {
      this.panel.webview.postMessage({ command: 'saved' });
    }
  }

  private async resetSettings(): Promise<void> {
    const defaults: Record<string, unknown> = {
      autoReconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      defaultRoomType: 'public',
      enablePerformanceMonitor: true,
      language: 'zh-CN'
    };

    await this.saveSettings(defaults);
  }

  private _update(): void {
    if (!this.panel) return;

    const config = vscode.workspace.getConfiguration(this.configKey);
    const settings = {
      autoReconnect: config.get<boolean>('autoReconnect', true),
      reconnectInterval: config.get<number>('reconnectInterval', 3000),
      maxReconnectAttempts: config.get<number>('maxReconnectAttempts', 10),
      defaultRoomType: config.get<string>('defaultRoomType', 'public'),
      enablePerformanceMonitor: config.get<boolean>('enablePerformanceMonitor', true),
      language: config.get<string>('language', 'zh-CN')
    };

    this.panel.webview.html = this._getHtmlForWebview(settings);
  }

  private _getHtmlForWebview(settings: Record<string, unknown>): string {
    const roomTypes = [
      { value: 'public', label: '公开房间' },
      { value: 'private', label: '私有房间' },
      { value: 'invite-only', label: '邀请制房间' }
    ];

    const languages = [
      { value: 'zh-CN', label: '简体中文' },
      { value: 'en-US', label: 'English' }
    ];

    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Live Code Viewer - 设置</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 24px;
            margin: 0;
          }
          h1 {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 4px;
          }
          .subtitle {
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
            margin-bottom: 24px;
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
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .setting-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
          }
          .setting-row:last-child {
            border-bottom: none;
          }
          .setting-label {
            flex: 1;
          }
          .setting-name {
            font-weight: 500;
            margin-bottom: 2px;
          }
          .setting-desc {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
          }
          .setting-control {
            min-width: 180px;
            text-align: right;
          }
          input[type="checkbox"] {
            width: 16px;
            height: 16px;
            cursor: pointer;
          }
          input[type="number"] {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 4px 8px;
            border-radius: 3px;
            width: 100px;
            text-align: right;
          }
          select {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 4px 8px;
            border-radius: 3px;
            width: 160px;
          }
          .actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            margin-top: 16px;
          }
          .btn {
            padding: 6px 16px;
            border: 1px solid var(--vscode-button-border);
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-radius: 3px;
            cursor: pointer;
            font-size: 13px;
          }
          .btn:hover {
            background: var(--vscode-button-hoverBackground);
          }
          .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
          }
          .toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--vscode-notifications-background);
            color: var(--vscode-notifications-foreground);
            padding: 10px 16px;
            border-radius: 4px;
            box-shadow: var(--vscode-widget-shadow);
            display: none;
            animation: slideIn 0.3s ease;
          }
          @keyframes slideIn {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        </style>
      </head>
      <body>
        <h1>⚙️ Live Code Viewer 设置</h1>
        <p class="subtitle">自定义扩展行为与偏好</p>

        <div class="section">
          <div class="section-title">🔄 连接设置</div>
          <div class="setting-row">
            <div class="setting-label">
              <div class="setting-name">自动重连</div>
              <div class="setting-desc">断线后自动尝试重新连接</div>
            </div>
            <div class="setting-control">
              <input type="checkbox" id="autoReconnect" ${settings.autoReconnect ? 'checked' : ''}>
            </div>
          </div>
          <div class="setting-row">
            <div class="setting-label">
              <div class="setting-name">重连间隔</div>
              <div class="setting-desc">两次重连之间的等待时间（毫秒）</div>
            </div>
            <div class="setting-control">
              <input type="number" id="reconnectInterval" value="${settings.reconnectInterval}" min="500" max="30000" step="500">
            </div>
          </div>
          <div class="setting-row">
            <div class="setting-label">
              <div class="setting-name">最大重连次数</div>
              <div class="setting-desc">达到此次数后停止自动重连</div>
            </div>
            <div class="setting-control">
              <input type="number" id="maxReconnectAttempts" value="${settings.maxReconnectAttempts}" min="1" max="100">
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">🏠 房间设置</div>
          <div class="setting-row">
            <div class="setting-label">
              <div class="setting-name">新建房间默认类型</div>
              <div class="setting-desc">创建新房间时默认选择的类型</div>
            </div>
            <div class="setting-control">
              <select id="defaultRoomType">
                ${roomTypes.map(t => `<option value="${t.value}" ${settings.defaultRoomType === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">📊 性能设置</div>
          <div class="setting-row">
            <div class="setting-label">
              <div class="setting-name">启用性能监控</div>
              <div class="setting-desc">在后台收集性能指标数据</div>
            </div>
            <div class="setting-control">
              <input type="checkbox" id="enablePerformanceMonitor" ${settings.enablePerformanceMonitor ? 'checked' : ''}>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">🌐 界面设置</div>
          <div class="setting-row">
            <div class="setting-label">
              <div class="setting-name">界面语言</div>
              <div class="setting-desc">设置插件界面显示语言</div>
            </div>
            <div class="setting-control">
              <select id="language">
                ${languages.map(l => `<option value="${l.value}" ${settings.language === l.value ? 'selected' : ''}>${l.label}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="actions">
          <button class="btn btn-secondary" onclick="resetSettings()">恢复默认</button>
          <button class="btn" onclick="saveSettings()">保存设置</button>
        </div>

        <div class="toast" id="toast">✅ 设置已保存</div>

        <script>
          const vscode = acquireVsCodeApi();

          function showToast(msg) {
            const toast = document.getElementById('toast');
            toast.textContent = msg;
            toast.style.display = 'block';
            setTimeout(() => { toast.style.display = 'none'; }, 2000);
          }

          function saveSettings() {
            const settings = {
              autoReconnect: document.getElementById('autoReconnect').checked,
              reconnectInterval: parseInt(document.getElementById('reconnectInterval').value) || 3000,
              maxReconnectAttempts: parseInt(document.getElementById('maxReconnectAttempts').value) || 10,
              defaultRoomType: document.getElementById('defaultRoomType').value,
              enablePerformanceMonitor: document.getElementById('enablePerformanceMonitor').checked,
              language: document.getElementById('language').value
            };
            vscode.postMessage({ command: 'save', settings });
            showToast('✅ 设置已保存');
          }

          function resetSettings() {
            if (confirm('确定要恢复所有默认设置吗？')) {
              vscode.postMessage({ command: 'reset' });
              showToast('✅ 已恢复默认设置');
            }
          }

          window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'saved') {
              showToast('✅ 设置已保存');
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
